
import { GoogleGenAI, Type } from "@google/genai";
import { supabase } from "./supabaseClient";
import { ImportBatch, ImportItem, User, ImportStatus, ProductDefinition, DrawerInteriorOption, DrawerAccessory, QuoteRequest, PricingResult, Quote, QuoteLineItem, CustomerDetails, QuoteStatus } from "../types";
import { CATALOG as SEED_CATALOG, INTERIOR_OPTIONS as SEED_INTERIORS, DRAWER_ACCESSORIES as SEED_ACCESSORIES, resolvePartitionCode, resolveAccessoryCode } from '../data/catalog';
import { seedCatalog } from "./catalogApi";
import { submitQuoteFunction } from "./quotesApi";

const resolveGeminiApiKey = (): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY as string;
  }
  if (typeof process !== 'undefined') {
    return process.env?.VITE_GEMINI_API_KEY || process.env?.GEMINI_API_KEY;
  }
  return undefined;
};

const GEMINI_API_KEY = resolveGeminiApiKey();

// --- LOCAL CACHE ---
// We keep a local copy of the catalog for the pricing engine to run instantly without 
// fetching from DB on every checkbox click.
let CACHE = {
  products: [] as ProductDefinition[],
  interiors: [] as DrawerInteriorOption[],
  accessories: [] as DrawerAccessory[],
  quotes: [] as Quote[],
  batches: [] as ImportBatch[],
  isLoaded: false
};

// --- AUTH SERVICE ---

export const login = async (email: string, password: string): Promise<User> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error("No user returned");

  return {
    id: data.user.id,
    email: data.user.email || '',
    name: data.user.user_metadata?.full_name || 'Admin',
    role: 'admin' // Assume admin for now
  };
};

export const logout = async () => {
  await supabase.auth.signOut();
};

export const getCurrentUser = (): User | null => {
  // Check mostly for session existence, though for strict RBAC we'd check the token
  // For this frontend wrapper, we rely on the session state
  return null; // State is handled by the component usually, or we could fetch getUser()
};

export const checkSession = async (): Promise<User | null> => {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    return {
      id: data.session.user.id,
      email: data.session.user.email || '',
      name: 'Admin',
      role: 'admin'
    };
  }
  return null;
};

// --- DB SEEDING UTILITY (Crucial for first run) ---

export const seedDatabase = async () => {
  console.log("Starting DB Seed via Edge Function...");
  const { error } = await seedCatalog(SEED_CATALOG, SEED_INTERIORS);

  if (error) {
    console.error("Seed function error:", error);
    throw error;
  }

  console.log("Database Seeded Successfully.");
  await refreshCache();
};

// --- CATALOG API (READ) ---

const refreshCache = async () => {
  // Fetch Products
  const { data: prodData } = await supabase.from('products').select('*');
  if (prodData) {
    CACHE.products = prodData.map((row: any) => row.data as ProductDefinition);
  }

  // Fetch Interiors
  const { data: intData } = await supabase.from('drawer_interiors').select('*');
  if (intData) {
    CACHE.interiors = intData.map((row: any) => row.data as DrawerInteriorOption);
  }

  // Fetch Accessories (if table exists, otherwise use seed)
  const { data: accData } = await supabase.from('drawer_accessories').select('*');
  if (accData && accData.length > 0) {
    CACHE.accessories = accData.map((row: any) => row.data as DrawerAccessory);
  } else {
    CACHE.accessories = SEED_ACCESSORIES;
  }
  
  CACHE.isLoaded = true;
};

export const getProducts = async (): Promise<ProductDefinition[]> => {
  // ALWAYS use SEED_CATALOG as source of truth for product definitions
  // This ensures drawer options are always correct (75, 100, 150, 225, 300 only)
  // Database is used for pricing overrides via Admin, but core structure comes from code
  return SEED_CATALOG;
};

export const getInteriors = async (): Promise<DrawerInteriorOption[]> => {
  if (!CACHE.isLoaded || CACHE.interiors.length === 0) {
    await refreshCache();
  }
  if (CACHE.interiors.length === 0) {
    return SEED_INTERIORS;
  }
  return CACHE.interiors;
};

export const getAccessories = async (): Promise<DrawerAccessory[]> => {
  if (!CACHE.isLoaded || CACHE.accessories.length === 0) {
    await refreshCache();
  }
  if (CACHE.accessories.length === 0) {
    return SEED_ACCESSORIES;
  }
  return CACHE.accessories;
};

// --- CATALOG API (WRITE / ADMIN) ---

export const updateBasePrice = async (productId: string, newPrice: number): Promise<void> => {
  // Update Cache
  const prod = CACHE.products.find(p => p.id === productId);
  if (prod) {
    prod.basePrice = newPrice;
    
    // Update DB
    await supabase.from('products').update({ 
      base_price: newPrice,
      data: prod 
    }).eq('id', productId);
  }
};

export const updateOption = async (productId: string, groupId: string, optionId: string, updates: { priceDelta?: number, label?: string, isVisible?: boolean }): Promise<void> => {
  const prod = CACHE.products.find(p => p.id === productId);
  if (!prod) return;
  const group = prod.groups.find(g => g.id === groupId);
  if (!group) return;
  const opt = group.options.find(o => o.id === optionId);
  if (!opt) return;

  if (updates.priceDelta !== undefined) opt.priceDelta = updates.priceDelta;
  if (updates.label !== undefined) opt.label = updates.label;
  if (updates.isVisible !== undefined) opt.isVisible = updates.isVisible;

  // Persist the entire updated product JSON
  await supabase.from('products').update({ data: prod }).eq('id', productId);
};

export const updateInteriorOption = async (interiorId: string, updates: { price?: number, isVisible?: boolean }): Promise<void> => {
  const part = CACHE.interiors.find(i => i.id === interiorId);
  if (!part) return;
  
  if (updates.price !== undefined) part.price = updates.price;
  if (updates.isVisible !== undefined) part.isVisible = updates.isVisible;
  
  await supabase.from('drawer_interiors').update({ 
    price: part.price,
    data: part 
  }).eq('id', interiorId);
};

// --- QUOTE ENGINE (BUSINESS LOGIC) ---

export const calculateQuote = async (request: QuoteRequest): Promise<PricingResult> => {
  // Ensure we have data
  if (CACHE.interiors.length === 0) await getInteriors();
  if (CACHE.accessories.length === 0) await getAccessories();

  // 1. Find Product
  // ALWAYS use SEED_CATALOG for product definitions to ensure correct drawer options
  const products = SEED_CATALOG;
  const interiors = CACHE.interiors.length > 0 ? CACHE.interiors : SEED_INTERIORS;
  const accessories = CACHE.accessories.length > 0 ? CACHE.accessories : SEED_ACCESSORIES;

  const product = products.find(p => p.id === request.productId);
  if (!product) {
    throw new Error("Product not found");
  }

  const breakdown: { code: string, label: string, price: number }[] = [];
  let total = product.basePrice;

  // 2. Base Product Line Item
  breakdown.push({
    code: product.id,
    label: `${product.name} (Base)`,
    price: product.basePrice
  });

  // 3. Process Standard Options
  product.groups.forEach(group => {
    // Skip drawer stacks here, handled separately below
    if (group.type === 'drawer_stack') return;

    const val = request.selections[group.id];
    if (val === undefined || val === null || val === '') return;

    // Handle Quantity List
    if (group.type === 'qty_list') {
       const qtyMap = val as Record<string, number>;
       Object.entries(qtyMap).forEach(([itemId, qty]) => {
          if (qty > 0) {
             const opt = group.options.find(o => o.id === itemId);
             if (opt && opt.priceDelta) {
                const lineTotal = opt.priceDelta * qty;
                total += lineTotal;
                breakdown.push({
                   code: opt.code || opt.id,
                   label: `${opt.label} (x${qty})`,
                   price: lineTotal
                });
             }
          }
       });
       return;
    }

    // Handle Checkbox
    if (group.type === 'checkbox') {
      if (val === true) {
        const opt = group.options.find(o => o.value === true);
        if (opt && opt.priceDelta) {
          total += opt.priceDelta;
          breakdown.push({ 
            code: opt.code || opt.id, 
            label: opt.label, 
            price: opt.priceDelta 
          });
        }
      }
      return;
    } 

    // Handle Standard Select/Radio/Color
    const opt = group.options.find(o => o.id === val);
    if (opt && opt.priceDelta) {
      let priceToAdd = opt.priceDelta;
      let labelSuffix = '';
      
      // Heuristic: Cabinet Credits for Embedded
      if (group.id === 'under_bench' && request.embeddedCabinets && request.embeddedCabinets.length > 0) {
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
      
      // Add position info for under_bench options (single unit configurations)
      if (group.id === 'under_bench') {
        const posGroup = product.groups.find(g => g.id === 'under_bench_pos');
        const posVal = request.selections['under_bench_pos'];
        if (posGroup && posVal) {
          const posOpt = posGroup.options.find(o => o.id === posVal);
          if (posOpt) {
            labelSuffix = ` (${posOpt.label})`;
          }
        }
      }

      total += priceToAdd;
      breakdown.push({ 
        code: opt.code || opt.id, 
        label: `${group.label}: ${opt.label}${labelSuffix}`, 
        price: priceToAdd 
      });
    }
  });

  // 4. Process Custom Drawers & Interiors
  if (request.customDrawers && request.customDrawers.length > 0) {
    const drawerGroup = product.groups.find(g => g.type === 'drawer_stack');
    
    if (drawerGroup) {
      if (product.id === 'prod-hd-cabinet') {
         const counts: Record<number, number> = {};
         let drawerCost = 0;
         const interiorItems: Record<string, { count: number, price: number, desc: string, code: string }> = {};
         const accessoryItems: Record<string, { count: number, price: number, name: string, code: string }> = {};

         request.customDrawers.forEach(drawer => {
            const shellOpt = drawerGroup.options.find(o => o.id === drawer.id);
            if (shellOpt && shellOpt.priceDelta) {
               drawerCost += shellOpt.priceDelta;
               const h = shellOpt.meta?.front || 0;
               counts[h] = (counts[h] || 0) + 1;
            }
            if (drawer.interiorId) {
               const interior = interiors.find(i => i.id === drawer.interiorId);
               if (interior) {
                   const h = shellOpt?.meta?.front || 0;
                   const code = resolvePartitionCode(interior, h);
                   if (!interiorItems[code]) {
                       interiorItems[code] = { count: 0, price: interior.price, desc: interior.layout_description, code: code };
                   }
                   interiorItems[code].count++;
               }
            }
            // Process accessories
            if (drawer.accessories && drawer.accessories.length > 0) {
               const h = shellOpt?.meta?.front || 0;
               drawer.accessories.forEach(accSel => {
                  const accessory = accessories.find(a => a.id === accSel.accessoryId);
                  if (accessory && accSel.quantity > 0) {
                     const code = resolveAccessoryCode(accessory, h);
                     if (!accessoryItems[code]) {
                        accessoryItems[code] = { count: 0, price: accessory.price, name: accessory.name, code: code };
                     }
                     accessoryItems[code].count += accSel.quantity;
                  }
               });
            }
         });

         const summary = Object.entries(counts)
            .sort(([h1], [h2]) => Number(h2) - Number(h1))
            .map(([h, c]) => `${c} × ${h}mm`)
            .join(', ');

         total += drawerCost;
         breakdown.push({
            code: 'DRAWERS',
            label: `Drawer Fronts: ${summary}`,
            price: drawerCost
         });

         Object.values(interiorItems).forEach(item => {
             const itemTotal = item.price * item.count;
             total += itemTotal;
             breakdown.push({
                 code: item.code,
                 label: `${item.desc} (x${item.count})`,
                 price: itemTotal
             });
         });

         // Add accessory line items
         Object.values(accessoryItems).forEach(item => {
             const itemTotal = item.price * item.count;
             total += itemTotal;
             breakdown.push({
                 code: item.code,
                 label: `${item.name} (x${item.count})`,
                 price: itemTotal
             });
         });

      } else {
         request.customDrawers.forEach((drawer, idx) => {
           const shellOpt = drawerGroup.options.find(o => o.id === drawer.id);
           if (shellOpt && shellOpt.priceDelta) {
             total += shellOpt.priceDelta;
             breakdown.push({
               code: shellOpt.code || shellOpt.id,
               label: `Drawer ${idx + 1}: ${shellOpt.label}`,
               price: shellOpt.priceDelta
             });
           }
           if (drawer.interiorId) {
             const interior = interiors.find(i => i.id === drawer.interiorId);
             if (interior) {
               const h = shellOpt?.meta?.front || 0;
               const code = resolvePartitionCode(interior, h);
               total += interior.price;
               breakdown.push({
                  code: code,
                  label: `  ↳ ${interior.layout_description}`,
                  price: interior.price
               });
             }
           }
           // Process accessories for this drawer
           if (drawer.accessories && drawer.accessories.length > 0) {
             const h = shellOpt?.meta?.front || 0;
             drawer.accessories.forEach(accSel => {
                const accessory = accessories.find(a => a.id === accSel.accessoryId);
                if (accessory && accSel.quantity > 0) {
                   const code = resolveAccessoryCode(accessory, h);
                   const lineTotal = accessory.price * accSel.quantity;
                   total += lineTotal;
                   breakdown.push({
                      code: code,
                      label: `  ↳ ${accessory.name} (x${accSel.quantity})`,
                      price: lineTotal
                   });
                }
             });
           }
         });
      }
    }
  }

  // 5. Process Embedded Cabinets
  if (request.embeddedCabinets && request.embeddedCabinets.length > 0) {
     for (const cab of request.embeddedCabinets) {
        // Recursive call
        const hdProduct = products.find(p => p.id === 'prod-hd-cabinet');
        if (hdProduct) {
           const cabRequest: QuoteRequest = {
              productId: hdProduct.id,
              selections: cab.configuration.selections,
              customDrawers: cab.configuration.customDrawers
           };
           const cabPricing = await calculateQuote(cabRequest);
           total += cabPricing.totalPrice;
           
           breakdown.push({
              code: `EMBED-${cab.placement.toUpperCase()}`,
              label: `HD Cabinet (${cab.placement.charAt(0).toUpperCase() + cab.placement.slice(1)})`,
              price: 0
           });
           cabPricing.breakdown.forEach(item => {
              breakdown.push({ code: item.code, label: `  ${item.label}`, price: item.price });
           });
           breakdown.push({ code: 'SUBTOTAL', label: `  = Cabinet Total`, price: cabPricing.totalPrice });
        }
     }
  }

  return {
    basePrice: product.basePrice,
    totalPrice: total,
    gst: total * 0.1,
    currency: 'AUD',
    breakdown
  };
};

// --- QUOTE SUBMISSION & MANAGEMENT ---

const generateQuoteRef = (count: number) => {
  const year = new Date().getFullYear();
  return `BQ-${year}-${String(count + 1000).padStart(4, '0')}`;
};

export const submitQuote = async (
  customer: CustomerDetails, 
  items: QuoteLineItem[]
): Promise<Quote> => {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  const { data, error } = await submitQuoteFunction(customer, items, { subtotal, gst, total });

  if (error) {
    console.error("Quote Submit Error", error);
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from submit-quote function");
  }

  return {
    id: (data as any).id,
    reference: (data as any).reference,
    createdAt: (data as any).created_at,
    updatedAt: (data as any).created_at,
    status: (data as any).status,
    customer: (data as any).customer_data,
    items: (data as any).items_data,
    totals: (data as any).totals
  };
};

export const getQuotes = async (): Promise<Quote[]> => {
  const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
  if (error) return [];
  
  return data.map((d: any) => ({
    id: d.id,
    reference: d.reference,
    createdAt: d.created_at,
    updatedAt: d.created_at, // or d.updated_at
    status: d.status,
    customer: d.customer_data,
    items: d.items_data,
    totals: d.totals,
    internalNotes: d.internal_notes
  }));
};

export const updateQuoteStatus = async (quoteId: string, status: QuoteStatus, internalNotes?: string): Promise<void> => {
  const updates: any = { status };
  if (internalNotes !== undefined) updates.internal_notes = internalNotes;
  
  await supabase.from('quotes').update(updates).eq('id', quoteId);
};

// --- IMPORT & AI ---

export const getImportHistory = async (): Promise<ImportBatch[]> => {
  return CACHE.batches;
};

export const updateBatchStatus = async (batchId: string, status: ImportStatus): Promise<void> => {
  const batch = CACHE.batches.find(b => b.id === batchId);
  if (batch) batch.status = status;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve((reader.result as string).split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Simple in-memory storage for the file blob during the session
const FILE_STORAGE = new Map<string, string>(); 
const MIME_STORAGE = new Map<string, string>();

export const uploadFile = async (file: File, range: string): Promise<ImportBatch> => {
  const base64 = await fileToBase64(file);
  const batchId = `batch-${Date.now()}`;
  
  FILE_STORAGE.set(batchId, base64);
  MIME_STORAGE.set(batchId, file.type);

  const newBatch: ImportBatch = {
    id: batchId,
    sourceId: `src-${Date.now()}`,
    status: 'processing',
    pageRange: range,
    items: [],
    createdAt: new Date().toISOString()
  };
  
  CACHE.batches.unshift(newBatch);
  return newBatch;
};

export const runAiExtraction = async (batchId: string): Promise<ImportBatch> => {
  const batch = CACHE.batches.find(b => b.id === batchId);
  if (!batch) throw new Error('Batch not found');
  
  const base64Data = FILE_STORAGE.get(batchId);
  const mimeType = MIME_STORAGE.get(batchId);

  if (!base64Data || !mimeType) throw new Error('File data missing');

  try {
    const apiKey = GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('PASTE_')) throw new Error("API Key not valid");
    
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-2.5-flash"; 

    const extractionSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { 
            type: Type.STRING, 
            enum: ["product_family", "option"],
          },
          targetFamilyId: { type: Type.STRING },
          targetGroupId: { type: Type.STRING },
          data: {
            type: Type.OBJECT,
            properties: {
               id: { type: Type.STRING },
               label: { type: Type.STRING },
               name: { type: Type.STRING },
               description: { type: Type.STRING },
               basePrice: { type: Type.NUMBER },
               priceDelta: { type: Type.NUMBER },
               value: { type: Type.STRING },
               code: { type: Type.STRING },
               meta_width: { type: Type.NUMBER },
               meta_depth: { type: Type.NUMBER },
               meta_height: { type: Type.NUMBER },
               meta_front: { type: Type.NUMBER },
               meta_usable: { type: Type.NUMBER },
            }
          }
        },
        required: ["type", "data"]
      }
    };

    const prompt = `Extract Boscotek product data from this catalogue page.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: extractionSchema,
        temperature: 0.1
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No data returned from AI");

    const extractedItems = JSON.parse(resultText);

    const mappedItems: ImportItem[] = extractedItems.map((item: any, idx: number) => {
      const { meta_width, meta_depth, meta_height, meta_front, meta_usable, ...restData } = item.data;
      const meta: any = {};
      if (meta_width) meta.width = meta_width;
      if (meta_depth) meta.depth = meta_depth;
      if (meta_height) meta.height = meta_height;
      if (meta_front) meta.front = meta_front;
      if (meta_usable) meta.usable = meta_usable;

      return {
        id: `ai-item-${Date.now()}-${idx}`,
        batchId,
        type: item.type,
        status: 'draft',
        targetFamilyId: item.targetFamilyId,
        targetGroupId: item.targetGroupId,
        data: {
          ...restData,
          meta: Object.keys(meta).length > 0 ? meta : undefined
        }
      };
    });

    batch.items = mappedItems;
    batch.status = 'review';
    return batch;

  } catch (err) {
    console.error("AI Extraction Failed", err);
    batch.status = 'rejected';
    batch.items = [];
    return batch;
  }
};

export const approveItem = (batchId: string, itemId: string) => {
  const batch = CACHE.batches.find(b => b.id === batchId);
  if (batch) {
    const item = batch.items.find(i => i.id === itemId);
    if (item) item.status = 'approved';
  }
};
