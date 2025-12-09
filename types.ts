
// --- GENERIC CATALOG TYPES ---

export interface ProductAttribute {
  id: string;
  label: string;
  value: string | number | boolean;
  priceDelta?: number;
  code?: string; // Suffix for SKU generation
  meta?: any; // For 3D scaling, dimensions, constraints etc.
  isVisible?: boolean; // Controlled by Admin
  isDefault?: boolean; // Controlled by Admin
  description?: string;
}

export interface OptionGroup {
  id: string;
  label: string;
  type: 'select' | 'radio' | 'checkbox' | 'color' | 'drawer_stack' | 'qty_list';
  options: ProductAttribute[];
  defaultValue?: string | any; // Updated to allow objects for qty_list
  step?: number; // For UI ordering
  description?: string;
}

export interface ProductDefinition {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  image?: string; // Thumbnail
  groups: OptionGroup[];
}

export interface Catalog {
  products: ProductDefinition[];
}

// --- APP STATE ---

export interface DrawerConfiguration {
  id: string; // The option ID (e.g. 'dr-150')
  interiorId?: string; // The selected partition set ID (e.g. 'ps-64-3')
}

export type EmbeddedCabinetPlacement = 'left' | 'right' | 'center';

export interface EmbeddedCabinet {
  id: string;
  placement: EmbeddedCabinetPlacement;
  // This reuses the structure of a full configuration but scoped to the cabinet
  configuration: ConfigurationState; 
}

export interface ConfigurationState {
  productId: string;
  selections: Record<string, any>; // groupId -> optionId (or { itemId: qty } for qty_list)
  customDrawers: DrawerConfiguration[]; // Array of drawer objects (Primary product)
  embeddedCabinets?: EmbeddedCabinet[]; // For nested modules like under-bench cabinets
  notes: string;
  internalReference: string;
}

export interface CustomerDetails {
  name: string;
  company: string;
  email: string;
  phone?: string;
  notes?: string;
}

// Updated to match Backend Response
export type LineItem = {
  code: string;
  label: string;
  price: number;
};

export type PricingResult = {
  totalPrice: number;
  basePrice: number; // Base price of the unit
  gst: number;
  currency: string;
  breakdown: LineItem[];
};

// --- QUOTE & CART MODELS ---

export type QuoteStatus = 'new' | 'viewed' | 'contacted' | 'sent_to_customer' | 'accepted' | 'lost' | 'archived';

export interface QuoteLineItem {
  id: string;
  productName: string;
  configuration: ConfigurationState;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specsSummary: string[]; // Human readable list of major options
  breakdown?: LineItem[]; // Detailed list of components and codes
}

export interface Quote {
  id: string;
  reference: string; // BQ-2024-001
  createdAt: string;
  updatedAt: string;
  status: QuoteStatus;
  customer: CustomerDetails;
  items: QuoteLineItem[];
  totals: {
    subtotal: number;
    gst: number;
    total: number;
  };
  internalNotes?: string;
}

// --- INTERIOR CONFIGURATION TYPES ---

export type DrawerInteriorType = 'partition_set' | 'bin_set' | 'mixed_set';

export interface DrawerInteriorOption {
  id: string;
  type: DrawerInteriorType;
  
  // Data Specs
  width_mm: number;
  depth_type: 'D' | 'S'; // Deep or Standard
  supported_drawer_heights_mm: number[];
  drawer_height_note?: string;

  // Visual / Content
  layout_description: string; // e.g. "75mm x 75mm (48 compartments)"
  components_summary?: string; // For mixed/bins

  // Codes & Pricing
  code_base: string; // e.g. "PS.46.X.3.3"
  price: number; 

  // Visualizer Meta
  cell_width_mm?: number;
  cell_depth_mm?: number;
  cell_count?: number;
  
  // Admin
  isVisible?: boolean;
}

// --- LEGACY TYPES (Support for constants.ts) ---

export interface Option {
  id: string;
  label: string;
  code: string;
  priceDelta: number;
  description?: string;
}

export interface DimensionOption {
  id: string;
  label: string;
  valueMm: number;
  code: string;
  priceDelta: number;
}

export interface FrameColorOption {
  id: string;
  label: string;
  hex: string;
  code: string;
}

// --- ADMIN & BACKEND TYPES ---

export type UserRole = 'admin' | 'viewer';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface ImportSource {
  id: string;
  name: string;
  description: string;
  fileName: string;
  createdAt: string;
}

export type ImportStatus = 'processing' | 'review' | 'approved' | 'rejected';

export interface ImportBatch {
  id: string;
  sourceId: string;
  status: ImportStatus;
  pageRange: string;
  items: ImportItem[];
  createdAt: string;
}

export type ImportItemType = 'product_family' | 'option_group' | 'option';

export interface ImportItem {
  id: string;
  batchId: string;
  type: ImportItemType;
  // We store the "Draft" data here. 
  // In a real DB this would be JSONB. Here we use a flexible object.
  data: any; 
  status: 'draft' | 'approved' | 'skipped';
  targetFamilyId?: string; // If this item belongs to a specific product family
  targetGroupId?: string; // If this item belongs to a specific group
}

export interface QuoteRequest {
  productId: string;
  selections: Record<string, any>;
  customDrawers: DrawerConfiguration[];
  embeddedCabinets?: EmbeddedCabinet[];
  customerType?: string;
}
