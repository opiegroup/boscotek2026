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
  breakdown: LineItem[];
  // Staff-only fields
  retailPrice?: number;
  cost?: number;
  margin?: number;
  discountApplied?: number;
  tierName?: string;
}

interface UserContext {
  userId: string | null;
  role: UserRole;
  isDistributor: boolean;
  discountPercentage: number;
  tierName: string | null;
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
async function getUserContext(authHeader: string | null): Promise<UserContext> {
  const defaultContext: UserContext = {
    userId: null,
    role: null,
    isDistributor: false,
    discountPercentage: 0,
    tierName: null,
  };

  if (!authHeader) {
    return defaultContext;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return defaultContext;
    }

    // Get user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .order('role')
      .limit(1);

    const role = roleData?.[0]?.role as UserRole || null;

    // Check if distributor and get their pricing tier
    if (role === 'distributor') {
      const { data: distData } = await supabase
        .from('distributors')
        .select(`
          pricing_tier_id,
          pricing_tiers (
            discount_percentage,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('is_approved', true)
        .single();

      if (distData?.pricing_tiers) {
        const tier = distData.pricing_tiers as { discount_percentage: number; name: string };
        return {
          userId: user.id,
          role,
          isDistributor: true,
          discountPercentage: tier.discount_percentage || 0,
          tierName: tier.name,
        };
      }
    }

    return {
      userId: user.id,
      role,
      isDistributor: false,
      discountPercentage: 0,
      tierName: null,
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
    const userContext = await getUserContext(authHeader);

    // Parse request
    const body: PricingRequest = await req.json();

    if (!body?.productId) {
      return new Response(JSON.stringify({ error: "productId is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Fetch catalog data
    const [productsRes, interiorsRes] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('drawer_interiors').select('*'),
    ]);

    const products = productsRes.data?.map((row: any) => row.data) || [];
    const interiors = interiorsRes.data?.map((row: any) => row.data) || [];
    
    // TODO: Fetch accessories from DB when table exists
    // For now, return empty array - accessories priced at 0 if not in DB
    const accessories: any[] = [];

    // Calculate base pricing
    const pricing = await calculatePricing(body, products, interiors, accessories);
    const retailPrice = pricing.totalPrice;
    const gst = retailPrice * 0.1;

    // Apply distributor discount if applicable
    let finalPrice = retailPrice;
    let appliedDiscount = 0;

    if (userContext.isDistributor && userContext.discountPercentage > 0) {
      appliedDiscount = retailPrice * (userContext.discountPercentage / 100);
      finalPrice = retailPrice - appliedDiscount;
    }

    // Calculate GST on final price
    const finalGst = finalPrice * 0.1;

    // Estimated cost (for staff view) - example: 60% of retail
    const estimatedCost = retailPrice * 0.6;
    const margin = retailPrice - estimatedCost;

    // Build response based on role
    const response: PricingResponse = {
      // Distributors see discounted price as their price
      // Public sees retail price
      totalPrice: userContext.isDistributor ? finalPrice : retailPrice,
      basePrice: pricing.basePrice,
      gst: userContext.isDistributor ? finalGst : gst,
      currency: 'AUD',
      breakdown: pricing.breakdown,
    };

    // Add staff-only fields
    const isStaff = ['admin', 'sales', 'pricing_manager'].includes(userContext.role || '');
    
    if (isStaff) {
      response.retailPrice = retailPrice;
      response.cost = estimatedCost;
      response.margin = margin;
      
      if (userContext.isDistributor || appliedDiscount > 0) {
        response.discountApplied = appliedDiscount;
        response.tierName = userContext.tierName;
      }
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
