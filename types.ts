
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

export interface DrawerAccessorySelection {
  accessoryId: string;  // References DrawerAccessory.id
  quantity: number;
}

export interface DrawerConfiguration {
  id: string; // The option ID (e.g. 'dr-150')
  interiorId?: string; // The selected partition set ID (e.g. 'ps-64-3')
  accessories?: DrawerAccessorySelection[]; // Individual accessories for this drawer
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
  logoImageUrl?: string; // Custom logo image for Lectrum products
  logoTransform?: LogoTransform; // Placement controls for Lectrum logo
  notes: string;
  internalReference: string;
}

export interface LogoTransform {
  scale: number;   // User scale slider 0..1 (0 hides, 1 = fit)
  offsetX: number; // Horizontal pan within safe area (-1..1)
  offsetY: number; // Vertical pan within safe area (-1..1)
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
  configurationCode: string; // Full Boscotek product code (e.g. BTCS.1000.560.100...)
  configuration: ConfigurationState;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specsSummary: string[]; // Human readable list of major options
  breakdown?: LineItem[]; // Detailed list of components and codes
  thumbnail?: string; // Base64 data URL of the configured item
  ogNumber?: string; // NetSuite OG number for this line item
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
  salesOrderNumber?: string; // NetSuite Sales Order number
}

// --- INTERIOR CONFIGURATION TYPES ---

export type DrawerInteriorType = 'partition_set' | 'bin_set' | 'mixed_set';

// --- DRAWER ACCESSORY TYPES ---

export type DrawerAccessoryCategory = 
  | 'partition'      // Steel partitions (P.X.600)
  | 'divider_steel'  // Powdercoated steel dividers (D.X.xxx)
  | 'divider_alu'    // Aluminium dividers (D.X-A.xxx)
  | 'divider_plastic'// Blue plastic dividers (D.X-P.xxx)
  | 'tray'           // Steel drawer trays (T.75.xxx)
  | 'tray_divider'   // Tray dividers (TD.75.xxx)
  | 'bin'            // Plastic bins (B55.xxx)
  | 'groove_tray'    // Groove trays (GT.xxx)
  | 'groove_divider' // Groove tray dividers (GT.DIV)
  | 'foam'           // Foam inserts (BT.FOAM.xxx)
  | 'tool_support';  // Tool supports (TS.xxx)

export interface DrawerAccessory {
  id: string;
  category: DrawerAccessoryCategory;
  code_base: string;         // Base code - X gets replaced with drawer height
  name: string;
  description: string;
  price: number;
  width_mm?: number;         // Accessory width (for dividers, trays)
  height_mm?: number;        // Accessory height
  depth_mm?: number;         // Accessory depth
  supported_drawer_heights_mm: number[];  // Which drawer heights this works with
  max_per_drawer?: number;   // Max quantity per drawer (optional limit)
  requires_interior?: boolean; // Whether this requires a partition/bin set first
  isVisible?: boolean;
}

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

// --- BRAND TYPES ---

export type BrandStatus = 'active' | 'draft' | 'disabled';
export type BrandAccessLevel = 'viewer' | 'sales' | 'pricing' | 'admin' | 'none';

export interface BrandTheme {
  logo?: string;
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
}

export interface BrandFeatures {
  enableBimExport?: boolean;
  enableQuoteCart?: boolean;
  enableDistributorPricing?: boolean;
  enableDrawerConfigurator?: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  primaryDomain: string | null;
  allowedDomains: string[];
  status: BrandStatus;
  themeJson: BrandTheme;
  featuresJson: BrandFeatures;
  logoUrl: string | null;      // Direct logo URL (separate from theme)
  contactEmail: string | null;
  salesEmail: string | null;   // Sales enquiry email
  supportEmail: string | null;
  phone: string | null;
  addressJson: Record<string, string> | null;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserBrandAccess {
  id: string;
  userId: string;
  brandId: string;
  accessLevel: BrandAccessLevel;
  scopes: string[];
  isActive: boolean;
  grantedAt: string;
  grantedBy: string | null;
}

// --- ADMIN & BACKEND TYPES ---

export type UserRole = 'admin' | 'pricing_manager' | 'sales' | 'distributor' | 'viewer';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

// Extended user with distributor info
export interface ExtendedUser extends User {
  isDistributor: boolean;
  distributorInfo?: {
    companyName: string;
    accountNumber: string;
    tierName: string | null;
  };
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

// --- BIM EXPORT TYPES ---

export type LeadRole = 'Architect' | 'Builder' | 'Designer' | 'Engineer' | 'Buyer' | 'Other';

// Pipeline stages for BIM leads
export type LeadStage = 
  | 'bim_downloaded'
  | 'not_contacted'
  | 'initial_email_sent'
  | 'follow_up_sent'
  | 'call_meeting_booked'
  | 'quoted'
  | 'negotiation'
  | 'won_order_placed'
  | 'lost_no_project'
  | 'lost_competitor'
  | 'on_hold';

// Sales reps for lead assignment
export type SalesRep = 'Unassigned' | 'Tristan' | 'Marcus' | 'Sarah' | 'Other';

export interface BIMLeadData {
  name: string;
  email: string;
  company?: string;
  role: LeadRole;
  projectName?: string;
  projectLocation?: string;
  consent: boolean;
}

export interface BIMLead extends BIMLeadData {
  id: string;
  configId?: string;
  timestamp: string;
  ipAddress?: string;
  sessionId?: string;
  userAgent?: string;
  created_at: string;  // Database column name
  updated_at: string;  // Database column name
  
  // Pipeline fields
  lead_stage: LeadStage;
  assigned_rep?: SalesRep;
  contacted: boolean;
  last_contact_date?: string;
  next_action?: string;
  notes?: string;
}

export interface ConfigurationRecord {
  id: string;
  productType: string;
  dimensionsJson: {
    width: number;
    height: number;
    depth: number;
  };
  drawerStackJson?: DrawerConfiguration[];
  partitionDataJson?: any;
  accessoriesJson?: any;
  colourOptionsJson?: any;
  priceJson?: PricingResult;
  fullConfigJson: ConfigurationState;
  referenceCode?: string;
  geometryHash?: string;
  leadId?: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export type ExportType = 'IFC' | 'DATA' | 'SPEC_PACK' | 'OBJ' | 'BLENDER_SCRIPT' | 'ALL';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BIMExport {
  id: string;
  leadId?: string;
  configId?: string;
  ifcUrl?: string;
  dataExportUrl?: string;
  csvExportUrl?: string;
  xlsxExportUrl?: string;
  jsonExportUrl?: string;
  specPackUrl?: string;
  geometryHash?: string;
  exportType: ExportType;
  fileSizeBytes?: number;
  generationTimeMs?: number;
  status: ExportStatus;
  errorMessage?: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportAnalytics {
  id: string;
  eventType: string;
  leadId?: string;
  configId?: string;
  productType?: string;
  exportFormat?: string;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  metadata?: any;
  timestamp: string;
  createdAt: string;
}

export interface ExportRequest {
  configuration: ConfigurationState;
  product: ProductDefinition;
  pricing: PricingResult;
  referenceCode: string;
  lead?: BIMLeadData;
  exportType: ExportType;
}

export interface ExportResponse {
  success: boolean;
  exportId?: string;
  ifcUrl?: string;
  objUrl?: string;
  mtlUrl?: string;
  blenderScriptUrl?: string;
  dataUrls?: {
    csv?: string;
    xlsx?: string;
    json?: string;
    txt?: string;
  };
  specPackUrl?: string;
  error?: string;
}
