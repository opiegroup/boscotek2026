import { createClient } from "npm:@supabase/supabase-js";

/**
 * calculate-price Edge Function
 * 
 * Server-side pricing calculation with role-based access:
 * - Public: sees retail price only
 * - Distributor: sees their tier-discounted price (not the discount %)
 * - Sales/Pricing Manager/Admin: sees retail, cost, margin, and can view distributor prices
 */

const supabaseUrl = Deno.env.get("PROJECT_URL");
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("PROJECT_URL or SERVICE_ROLE_KEY is not set");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Types
type UserRole = 'admin' | 'pricing_manager' | 'sales' | 'distributor' | 'viewer' | null;

interface DrawerConfiguration {
  id: string;
  interiorId?: string;
  accessories?: Array<{ accessoryId: string; quantity: number }>;
}

interface EmbeddedCabinet {
  id: string;
  placement: 'left' | 'right' | 'center';
  configuration: {
    productId: string;
    selections: Record<string, unknown>;
    customDrawers: DrawerConfiguration[];
  };
}

interface PricingRequest {
  productId: string;
  selections: Record<string, unknown>;
  customDrawers: DrawerConfiguration[];
  embeddedCabinets?: EmbeddedCabinet[];
  currency?: string; // ISO code: AUD, USD, EUR, etc.
}

interface LineItem {
  code: string;
  label: string;
  price: number;
}

interface PricingResponse {
  totalPrice: number;
  basePrice: number;
  gst: number;
  currency: string;
  currencySymbol: string;
  exchangeRate: number;
  breakdown: LineItem[];
  // Original AUD values (for reference)
  totalPriceAUD?: number;
  // Tier info (for logged-in users)
  tierName?: string;
  tierCode?: string;
  markupPercent?: number;
  // Staff-only fields
  retailPrice?: number;  // Public price (Cash Sale)
  cost?: number;         // Wholesale price (base)
  margin?: number;       // Markup amount
}

interface CurrencyInfo {
  code: string;
  symbol: string;
  exchange_rate: number;
  decimal_places: number;
}

interface UserContext {
  userId: string | null;
  role: UserRole;
  hasCustomTier: boolean;  // True if user has a specific pricing tier assigned
  markupPercentage: number; // The markup % to apply (0 = wholesale, 25 = public/cash)
  tierName: string | null;
  tierCode: string | null;
}

// Helper to resolve partition code with drawer height
const resolvePartitionCode = (codeBase: string, drawerHeight: number): string => {
  if (codeBase.includes('X')) {
    return codeBase.replace('X', drawerHeight.toString());
  }
  return codeBase;
};

// Helper to resolve accessory code with drawer height  
const resolveAccessoryCode = (codeBase: string, drawerHeight: number): string => {
  if (codeBase.includes('X')) {
    return codeBase.replace('X', drawerHeight.toString());
  }
  return codeBase;
};

// Get user context from auth token
async function getUserContext(authHeader: string | null, supabaseClient: any): Promise<UserContext> {
  // Default context for public users = Cash Sale markup (25%)
  const PUBLIC_MARKUP = 25;
  
  const defaultContext: UserContext = {
    userId: null,
    role: null,
    hasCustomTier: false,
    markupPercentage: PUBLIC_MARKUP, // Public sees Cash Sale price
    tierName: 'Cash Sale',
    tierCode: 'CASH',
  };

  if (!authHeader) {
    return defaultContext;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      return defaultContext;
    }

    // Get user role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .order('role')
      .limit(1);

    const role = roleData?.[0]?.role as UserRole || null;

    // Check if user is linked to a company with a pricing tier (new schema)
    const { data: contactData } = await supabaseClient
      .from('contacts')
      .select(`
        company:companies (
          pricing_tier_id,
          is_active,
          is_approved,
          pricing_tier:pricing_tiers (
            markup_percentage,
            name,
            code
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (contactData?.company) {
      const company = contactData.company as { 
        is_active: boolean; 
        is_approved: boolean; 
        pricing_tier: { markup_percentage: number; name: string; code: string } | null 
      };
      
      if (company.is_active && company.is_approved && company.pricing_tier) {
        return {
          userId: user.id,
          role,
          hasCustomTier: true,
          markupPercentage: company.pricing_tier.markup_percentage || 0,
          tierName: company.pricing_tier.name,
          tierCode: company.pricing_tier.code,
        };
      }
    }

    // Fallback: Check old distributors table for backwards compatibility
    const { data: distData } = await supabaseClient
      .from('distributors')
      .select(`
        pricing_tier_id,
        pricing_tiers (
          markup_percentage,
          name,
          code
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('is_approved', true)
      .single();

    if (distData?.pricing_tiers) {
      const tier = distData.pricing_tiers as { markup_percentage: number; name: string; code: string };
      return {
        userId: user.id,
        role,
        hasCustomTier: true,
        markupPercentage: tier.markup_percentage || 0,
        tierName: tier.name,
        tierCode: tier.code,
      };
    }

    // User is logged in but no custom tier - still sees public price
    return {
      userId: user.id,
      role,
      hasCustomTier: false,
      markupPercentage: PUBLIC_MARKUP,
      tierName: 'Cash Sale',
      tierCode: 'CASH',
    };
  } catch (err) {
    console.error('Error getting user context:', err);
    return defaultContext;
  }
}

// Core pricing calculation (mirrors mockBackend.ts logic)
async function calculatePricing(
  request: PricingRequest,
  products: any[],
  interiors: any[],
  accessories: any[]
): Promise<{ totalPrice: number; basePrice: number; breakdown: LineItem[] }> {
  const product = products.find(p => p.id === request.productId);
  if (!product) {
    throw new Error(`Product not found: ${request.productId}`);
  }

  const breakdown: LineItem[] = [];
  let total = product.basePrice;

  // Base product
  breakdown.push({
    code: product.id,
    label: `${product.name} (Base)`,
    price: product.basePrice,
  });

  // Process standard options
  for (const group of product.groups) {
    if (group.type === 'drawer_stack') continue;

    const val = request.selections[group.id];
    if (val === undefined || val === null || val === '') continue;

    // Quantity list
    if (group.type === 'qty_list') {
      const qtyMap = val as Record<string, number>;
      for (const [itemId, qty] of Object.entries(qtyMap)) {
        if (qty > 0) {
          const opt = group.options.find((o: any) => o.id === itemId);
          if (opt?.priceDelta) {
            const lineTotal = opt.priceDelta * qty;
            total += lineTotal;
            breakdown.push({
              code: opt.code || opt.id,
              label: `${opt.label} (x${qty})`,
              price: lineTotal,
            });
          }
        }
      }
      continue;
    }

    // Checkbox
    if (group.type === 'checkbox') {
      if (val === true) {
        const opt = group.options.find((o: any) => o.value === true);
        if (opt?.priceDelta) {
          total += opt.priceDelta;
          breakdown.push({
            code: opt.code || opt.id,
            label: opt.label,
            price: opt.priceDelta,
          });
        }
      }
      continue;
    }

    // Standard select/radio/color
    const opt = group.options.find((o: any) => o.id === val);
    if (opt?.priceDelta) {
      let priceToAdd = opt.priceDelta;
      let labelSuffix = '';

      // Cabinet credits for embedded
      if (group.id === 'under_bench' && request.embeddedCabinets?.length) {
        const hasCabinet = opt.id.includes('cabinet') || opt.id.includes('cab');
        const cabinetCredit = 850;
        const embeddedCount = request.embeddedCabinets.length;
        if (hasCabinet) {
          const isDual = opt.id.includes('cabinet-2') || opt.id.includes('cab2');
          const cabinetsReplaced = isDual ? 2 : 1;
          const credit = Math.min(embeddedCount, cabinetsReplaced) * cabinetCredit;
          if (credit > 0) priceToAdd -= credit;
        }
      }

      // Position info for under_bench
      if (group.id === 'under_bench') {
        const posGroup = product.groups.find((g: any) => g.id === 'under_bench_pos');
        const posVal = request.selections['under_bench_pos'];
        if (posGroup && posVal) {
          const posOpt = posGroup.options.find((o: any) => o.id === posVal);
          if (posOpt) {
            labelSuffix = ` (${posOpt.label})`;
          }
        }
      }

      total += priceToAdd;
      breakdown.push({
        code: opt.code || opt.id,
        label: `${group.label}: ${opt.label}${labelSuffix}`,
        price: priceToAdd,
      });
    }
  }

  // Process custom drawers
  if (request.customDrawers?.length) {
    const drawerGroup = product.groups.find((g: any) => g.type === 'drawer_stack');

    if (drawerGroup) {
      if (product.id === 'prod-hd-cabinet') {
        // HD Cabinet: aggregate drawer costs
        const counts: Record<number, number> = {};
        let drawerCost = 0;
        const interiorItems: Record<string, { count: number; price: number; desc: string; code: string }> = {};
        const accessoryItems: Record<string, { count: number; price: number; name: string; code: string }> = {};

        for (const drawer of request.customDrawers) {
          const shellOpt = drawerGroup.options.find((o: any) => o.id === drawer.id);
          if (shellOpt?.priceDelta) {
            drawerCost += shellOpt.priceDelta;
            const h = shellOpt.meta?.front || 0;
            counts[h] = (counts[h] || 0) + 1;
          }

          if (drawer.interiorId) {
            const interior = interiors.find(i => i.id === drawer.interiorId);
            if (interior) {
              const h = shellOpt?.meta?.front || 0;
              const code = resolvePartitionCode(interior.code_base, h);
              if (!interiorItems[code]) {
                interiorItems[code] = { count: 0, price: interior.price, desc: interior.layout_description, code };
              }
              interiorItems[code].count++;
            }
          }

          if (drawer.accessories?.length) {
            const h = shellOpt?.meta?.front || 0;
            for (const accSel of drawer.accessories) {
              const accessory = accessories.find(a => a.id === accSel.accessoryId);
              if (accessory && accSel.quantity > 0) {
                const code = resolveAccessoryCode(accessory.code_base, h);
                if (!accessoryItems[code]) {
                  accessoryItems[code] = { count: 0, price: accessory.price, name: accessory.name, code };
                }
                accessoryItems[code].count += accSel.quantity;
              }
            }
          }
        }

        const summary = Object.entries(counts)
          .sort(([h1], [h2]) => Number(h2) - Number(h1))
          .map(([h, c]) => `${c} × ${h}mm`)
          .join(', ');

        total += drawerCost;
        breakdown.push({
          code: 'DRAWERS',
          label: `Drawer Fronts: ${summary}`,
          price: drawerCost,
        });

        for (const item of Object.values(interiorItems)) {
          const itemTotal = item.price * item.count;
          total += itemTotal;
          breakdown.push({
            code: item.code,
            label: `${item.desc} (x${item.count})`,
            price: itemTotal,
          });
        }

        for (const item of Object.values(accessoryItems)) {
          const itemTotal = item.price * item.count;
          total += itemTotal;
          breakdown.push({
            code: item.code,
            label: `${item.name} (x${item.count})`,
            price: itemTotal,
          });
        }
      } else {
        // Other products: itemize each drawer
        for (let idx = 0; idx < request.customDrawers.length; idx++) {
          const drawer = request.customDrawers[idx];
          const shellOpt = drawerGroup.options.find((o: any) => o.id === drawer.id);

          if (shellOpt?.priceDelta) {
            total += shellOpt.priceDelta;
            breakdown.push({
              code: shellOpt.code || shellOpt.id,
              label: `Drawer ${idx + 1}: ${shellOpt.label}`,
              price: shellOpt.priceDelta,
            });
          }

          if (drawer.interiorId) {
            const interior = interiors.find(i => i.id === drawer.interiorId);
            if (interior) {
              const h = shellOpt?.meta?.front || 0;
              const code = resolvePartitionCode(interior.code_base, h);
              total += interior.price;
              breakdown.push({
                code,
                label: `  ↳ ${interior.layout_description}`,
                price: interior.price,
              });
            }
          }

          if (drawer.accessories?.length) {
            const h = shellOpt?.meta?.front || 0;
            for (const accSel of drawer.accessories) {
              const accessory = accessories.find(a => a.id === accSel.accessoryId);
              if (accessory && accSel.quantity > 0) {
                const code = resolveAccessoryCode(accessory.code_base, h);
                const lineTotal = accessory.price * accSel.quantity;
                total += lineTotal;
                breakdown.push({
                  code,
                  label: `  ↳ ${accessory.name} (x${accSel.quantity})`,
                  price: lineTotal,
                });
              }
            }
          }
        }
      }
    }
  }

  // Process embedded cabinets (recursive)
  if (request.embeddedCabinets?.length) {
    for (const cab of request.embeddedCabinets) {
      const hdProduct = products.find(p => p.id === 'prod-hd-cabinet');
      if (hdProduct) {
        const cabRequest: PricingRequest = {
          productId: hdProduct.id,
          selections: cab.configuration.selections,
          customDrawers: cab.configuration.customDrawers,
        };
        const cabPricing = await calculatePricing(cabRequest, products, interiors, accessories);
        total += cabPricing.totalPrice;

        breakdown.push({
          code: `EMBED-${cab.placement.toUpperCase()}`,
          label: `HD Cabinet (${cab.placement.charAt(0).toUpperCase() + cab.placement.slice(1)})`,
          price: 0,
        });

        for (const item of cabPricing.breakdown) {
          breakdown.push({ code: item.code, label: `  ${item.label}`, price: item.price });
        }

        breakdown.push({ code: 'SUBTOTAL', label: '  = Cabinet Total', price: cabPricing.totalPrice });
      }
    }
  }

  return {
    basePrice: product.basePrice,
    totalPrice: total,
    breakdown,
  };
}

// Log pricing request for analytics/audit
async function logPricingRequest(
  userId: string | null,
  productId: string,
  request: PricingRequest,
  response: { totalPrice: number },
  userRole: UserRole
): Promise<void> {
  try {
    await supabase.from('pricing_logs').insert({
      user_id: userId,
      product_id: productId,
      request_data: request,
      response_total: response.totalPrice,
      user_role: userRole,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Non-critical, don't fail the request
    console.error('Failed to log pricing request:', err);
  }
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Get user context
    const authHeader = req.headers.get('Authorization');
    const userContext = await getUserContext(authHeader, supabase);

    // Parse request
    const body: PricingRequest = await req.json();

    if (!body?.productId) {
      return new Response(JSON.stringify({ error: "productId is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Fetch catalog data and currency info
    const [productsRes, interiorsRes, currencyRes] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('drawer_interiors').select('*'),
      supabase.from('currencies').select('*').eq('is_active', true),
    ]);

    const products = productsRes.data?.map((row: any) => row.data) || [];
    const interiors = interiorsRes.data?.map((row: any) => row.data) || [];
    const currencies = currencyRes.data || [];

    // Determine target currency (default to AUD)
    const requestedCurrency = body.currency || 'AUD';
    const currencyInfo: CurrencyInfo = currencies.find((c: any) => c.code === requestedCurrency) || {
      code: 'AUD',
      symbol: '$',
      exchange_rate: 1,
      decimal_places: 2,
    };
    
    // TODO: Fetch accessories from DB when table exists
    // For now, return empty array - accessories priced at 0 if not in DB
    const accessories: any[] = [];

    // Calculate base pricing (this is WHOLESALE price)
    const pricing = await calculatePricing(body, products, interiors, accessories);
    const wholesalePrice = pricing.totalPrice;
    
    // Apply markup based on user's tier
    // Wholesale (0%) = base price, Cash Sale (25%) = public price
    const markupMultiplier = 1 + (userContext.markupPercentage / 100);
    const markedUpPrice = wholesalePrice * markupMultiplier;
    
    // GST is calculated on the marked-up price
    const gst = markedUpPrice * 0.1;

    // For staff view: show wholesale as "cost" and markup as margin
    const publicPrice = wholesalePrice * 1.25; // Cash Sale price (25% markup)
    const margin = markedUpPrice - wholesalePrice;

    // The price to show is the marked-up price for this user's tier
    const priceToShowAUD = markedUpPrice;
    const gstToShowAUD = gst;

    // Convert to requested currency
    const convertPrice = (audAmount: number): number => {
      if (currencyInfo.code === 'AUD') return audAmount;
      return Math.round(audAmount * currencyInfo.exchange_rate * 100) / 100;
    };

    // Apply markup to breakdown items, then convert currency
    const markedUpBreakdown = pricing.breakdown.map(item => ({
      ...item,
      price: item.price * markupMultiplier, // Apply markup to each line item
    }));

    // Convert breakdown items to target currency
    const convertedBreakdown = markedUpBreakdown.map(item => ({
      ...item,
      price: convertPrice(item.price),
    }));

    // Build response based on role
    const response: PricingResponse = {
      totalPrice: convertPrice(priceToShowAUD),
      basePrice: convertPrice(pricing.basePrice),
      gst: convertPrice(gstToShowAUD),
      currency: currencyInfo.code,
      currencySymbol: currencyInfo.symbol,
      exchangeRate: currencyInfo.exchange_rate,
      breakdown: convertedBreakdown,
    };

    // Include original AUD values if currency is different
    if (currencyInfo.code !== 'AUD') {
      response.totalPriceAUD = priceToShowAUD;
    }

    // Add staff-only fields
    const isStaff = ['admin', 'sales', 'pricing_manager'].includes(userContext.role || '');
    
    if (isStaff) {
      response.retailPrice = convertPrice(publicPrice); // Cash Sale price (public)
      response.cost = convertPrice(wholesalePrice); // Wholesale price (base cost)
      response.margin = convertPrice(margin); // Markup amount
    }

    // Always include tier info for logged-in users
    if (userContext.userId) {
      (response as any).tierName = userContext.tierName;
      (response as any).tierCode = userContext.tierCode;
      (response as any).markupPercent = userContext.markupPercentage;
    }

    // Log the pricing request (non-blocking)
    logPricingRequest(
      userContext.userId,
      body.productId,
      body,
      { totalPrice: response.totalPrice },
      userContext.role
    );

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (err: any) {
    console.error("Pricing calculation error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Pricing calculation failed" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

if (import.meta.main) {
  Deno.serve(handler);
}
