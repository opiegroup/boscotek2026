/**
 * Argent Constants
 * 
 * Defines all Argent product series, dimension matrices, options, and rules.
 * Argent specialises in secure server racks, data infrastructure enclosures,
 * and government/defence-grade storage systems.
 * 
 * Brand: Argent
 * Brand Slug: argent
 * Brand ID: AR
 */

// ============================================================================
// SERIES DEFINITIONS
// ============================================================================

export type ArgentSeriesKey = '10' | '25' | '40' | '50' | 'v50';
export type SecurityGrade = 'commercial' | 'class_b' | 'class_c' | null;
export type SeriesType = 'enclosure' | 'open_frame' | 'security_enclosure' | 'in_rack_security';

export interface ArgentSeries {
  key: ArgentSeriesKey;
  name: string;
  shortName: string;
  type: SeriesType;
  description: string;
  securityGrade: SecurityGrade;
  requiresConsultDefault: boolean;
  isActive: boolean;
  features: string[];
  useCase: string;
  // Enhanced fields for 50 Series compliance
  loadCapacityKg?: number;
  construction?: string;
  certifications?: string[];
  manufacturer?: string;
  positioning?: string;
  compliance?: string[];
}

export const ARGENT_SERIES: ArgentSeries[] = [
  {
    key: '10',
    name: 'Argent 10 Series',
    shortName: '10 Series',
    type: 'enclosure',
    description: 'Lite server cabinets for commercial and light infrastructure use. Entry-level rack enclosures with essential features.',
    securityGrade: 'commercial',
    requiresConsultDefault: false,
    isActive: true,
    features: [
      '19-inch mounting width',
      'Labelled RU front rails',
      'Removable lockable doors',
      'Removable lockable side panels',
      '800kg static load capacity',
      'Levelling feet included',
      'Zinc seal steel construction',
      'Mannex black powder-coat finish',
    ],
    useCase: 'Commercial networking, small data rooms, office IT infrastructure',
  },
  {
    key: '25',
    name: 'Argent 25 Series',
    shortName: '25 Series',
    type: 'enclosure',
    description: 'Core commercial network and server racks. Highly configurable with multiple size, door, and cable management options.',
    securityGrade: 'commercial',
    requiresConsultDefault: false,
    isActive: true,
    features: [
      '19-inch EIA-310 compliant',
      'Multiple RU height options',
      'Variable width and depth',
      'Front and rear door options',
      'Comprehensive cable management',
      'Heavy-duty construction',
      'Tool-less rail adjustment',
      'Baying capability',
    ],
    useCase: 'Enterprise data centres, network operations centres, server rooms',
  },
  {
    key: '40',
    name: 'Argent 40 Series',
    shortName: '40 Series',
    type: 'open_frame',
    description: 'Open frame data racks and lab racks. Two-post and four-post configurations with extensive cable management options.',
    securityGrade: null,
    requiresConsultDefault: false,
    isActive: true,
    features: [
      '2-post and 4-post options',
      'Open frame design',
      'Maximum airflow',
      'Easy equipment access',
      'Vertical cable managers',
      'Chimneys and slack spools',
      'Tool-less mounting options',
      'Modular expansion',
    ],
    useCase: 'Data centre hot/cold aisle, lab environments, network distribution',
  },
  {
    key: '50',
    name: 'Argent 50 Series',
    shortName: '50 Series',
    type: 'security_enclosure',
    description: 'SCEC-approved Security Class B and Class C server racks. IEC 60297 compliant. Designed for defence and government applications requiring certified physical security.',
    securityGrade: 'class_b', // Default, can be upgraded to class_c
    requiresConsultDefault: true,
    isActive: true,
    features: [
      'SCEC Class B or Class C compliant',
      'IEC 60297 compliant',
      'KABA X10 digital combination lock (Class B) or L-Handled Bilock (Class C)',
      'Fully welded zinc anneal steel frame',
      '1200kg static load capacity',
      '>180° door opening access',
      '3-point locking mechanism',
      'Perforated, solid, or 6mm polycarbonate doors',
      'Individually serialised with nameplate',
      'SCEC-approved cable entry options',
      'Internally secured solid side panels',
    ],
    useCase: 'Defence sites, government bodies/departments, secure data server/communication rooms, high-density secure data centres',
    // Enhanced fields per PDF specification
    loadCapacityKg: 1200,
    construction: 'Fully welded zinc anneal steel frame, all panels made from zinc anneal steel',
    certifications: ['SCEC Approved June 2016', 'QA Accreditation ISO 9001'],
    manufacturer: 'Opie Manufacturing Group',
    positioning: 'Lock. Guard. Defend Data.',
    compliance: ['IEC 60297', 'SCEC Class B', 'SCEC Class C'],
  },
  {
    key: 'v50',
    name: 'V50 Data Vault',
    shortName: 'Data Vault',
    type: 'in_rack_security',
    description: 'The ultimate security enclosure for 19-inch rack equipment. Patented design provides second-tier physical security for mission-critical IT devices in shared rack environments.',
    securityGrade: 'commercial',
    requiresConsultDefault: false,
    isActive: true,
    features: [
      'Patented Australian design',
      'Installs inside any 19-inch server rack',
      'Available in 2RU, 4RU, 6RU capacities',
      'Front and rear keyed locks (standard)',
      'Integrated ventilation',
      'Secure cable entry',
      'Adjustable depth',
      'Full-width hinge design',
      'Zinc seal steel construction',
      'Space-optimised for valuable RU',
    ],
    useCase: 'Shared data centres, co-location environments, government departments, secure enterprise IT, multi-tenant racks',
    // Enhanced fields per PDF specification
    loadCapacityKg: 50,
    construction: '100% patented, designed and manufactured in Australia by OPIE Manufacturing Group',
    certifications: ['Australian Patented Design', 'QA Accreditation ISO 9001'],
    manufacturer: 'Opie Manufacturing Group',
    positioning: 'Shared Rack Security - Second Tier Physical Protection',
    compliance: ['19-inch EIA-310 Compatible'],
  },
];

// ============================================================================
// SECURITY CONTEXT DEFINITIONS (For security-led configuration)
// ============================================================================

export type SecurityContext = 'shared_datacentre' | 'government' | 'defence' | 'enterprise_secure' | 'colocation' | 'general';

export interface SecurityContextOption {
  id: SecurityContext;
  label: string;
  description: string;
  defaultOptions: Partial<Record<string, string>>;
  complianceMessages: string[];
  applicableSeries: ArgentSeriesKey[];
}

export const SECURITY_CONTEXTS: SecurityContextOption[] = [
  {
    id: 'shared_datacentre',
    label: 'Shared Data Centre',
    description: 'Multi-tenant facility with shared rack space. Second-tier physical security recommended.',
    defaultOptions: {
      'lock': 'lock-key-standard',
    },
    complianceMessages: [
      'Suitable for shared rack environments',
      'Second tier physical security',
      'Protects hardware in multi-tenant facilities',
    ],
    applicableSeries: ['v50'],
  },
  {
    id: 'government',
    label: 'Government Department',
    description: 'Government body requiring physical security for sensitive equipment in data centre environments.',
    defaultOptions: {
      'lock': 'lock-key-standard',
    },
    complianceMessages: [
      'Designed for government and public sector use',
      'Physical security for sensitive hardware',
      'Suitable for controlled access environments',
    ],
    applicableSeries: ['v50', '50'],
  },
  {
    id: 'defence',
    label: 'Defence / Secure Facility',
    description: 'Defence or high-security facility requiring certified physical protection.',
    defaultOptions: {
      'lock': 'lock-key-standard',
    },
    complianceMessages: [
      'Suitable for defence applications',
      'Physical security for classified equipment',
      'Australian designed and manufactured',
    ],
    applicableSeries: ['v50', '50'],
  },
  {
    id: 'enterprise_secure',
    label: 'Secure Enterprise',
    description: 'Enterprise environment with heightened security requirements for IT infrastructure.',
    defaultOptions: {
      'lock': 'lock-key-standard',
    },
    complianceMessages: [
      'Enterprise-grade physical security',
      'Protects mission-critical IT devices',
      'Suitable for sensitive data environments',
    ],
    applicableSeries: ['v50', '50'],
  },
  {
    id: 'colocation',
    label: 'Co-location Provider',
    description: 'Co-location facility where customers share rack space and require individual equipment security.',
    defaultOptions: {
      'lock': 'lock-key-standard',
    },
    complianceMessages: [
      'Ideal for co-location protection',
      'Individual equipment isolation',
      'Tenant-controlled access',
    ],
    applicableSeries: ['v50'],
  },
  {
    id: 'general',
    label: 'General Commercial',
    description: 'Standard commercial environment with basic physical security needs.',
    defaultOptions: {
      'lock': 'lock-key-standard',
    },
    complianceMessages: [
      'Commercial-grade protection',
      'Suitable for office IT infrastructure',
    ],
    applicableSeries: ['10', '25', '40', 'v50'],
  },
];

// ============================================================================
// DIMENSION MATRICES
// ============================================================================

export interface DimensionOption {
  id: string;
  label: string;
  valueMm: number;
  code: string;
  priceDelta: number;
}

export type MountType = 'wall_mount' | 'free_standing';

export interface DimensionMatrix {
  seriesKey: ArgentSeriesKey;
  ruHeight: number;
  widthMm: number;
  depthMm: number;
  externalHeightMm?: number; // External height in mm (for display)
  mountType?: MountType; // Wall mount or free standing (50 Series)
  isStandard: boolean;
  isCustomAllowed: boolean;
  partCode: string;
  basePrice: number;
}

// 50 Series RU to external height mapping (from PDF page 3)
export const SERIES_50_RU_HEIGHT_MAP: Record<number, number> = {
  6: 400,    // Wall mount
  12: 675,   // Wall mount
  18: 950,   // Wall mount / Free standing
  27: 1350,  // Free standing
  39: 1884,  // Free standing
  42: 2017,  // Free standing
  45: 2150,  // Free standing
  46: 2195,  // Free standing
};

// ============================================================================
// 50 SERIES STANDARD INCLUSIONS (Always included - not selectable options)
// Per PDF specification
// ============================================================================

export interface StandardInclusion {
  id: string;
  name: string;
  description: string;
  quantity?: string;
}

export const SERIES_50_STANDARD_INCLUSIONS: StandardInclusion[] = [
  { id: 'inc-mounting-angles', name: '4× Vertical Mounting Angles (RU Labeled)', description: 'RU labeled front rails with square punched holes to accept cage nuts', quantity: '4' },
  { id: 'inc-cable-trays', name: '2× Cable Trays', description: 'Internal cable management trays', quantity: '2' },
  { id: 'inc-fixing-kits', name: '50× Fixing Kits', description: 'Cage nuts and screws for equipment mounting', quantity: '50' },
  { id: 'inc-earth-bar', name: 'Earth Bar', description: 'Grounding bar for equipment earthing' },
  { id: 'inc-earth-stud', name: 'Earth Stud', description: 'Earth bonding point' },
  { id: 'inc-earth-wiring', name: 'Earth Wiring Cord', description: 'Component attaching accessory for grounding' },
  { id: 'inc-solid-side-panels', name: 'Solid Side Panels (Internally Secured)', description: 'All side panels are solid form and internally secured' },
  { id: 'inc-top-bottom-panels', name: 'Top and Bottom Panels', description: 'Included with all configurations' },
  { id: 'inc-levelling-feet', name: 'Levelling Feet', description: 'Adjustable feet for floor levelling' },
  { id: 'inc-nameplate', name: 'Individual Serialisation & Nameplate', description: 'Each rack is individually serialised and name plated' },
];

// ============================================================================
// CABLE ENTRY SCEC ADVISORY (Critical Compliance Element)
// ============================================================================

export const CABLE_ENTRY_ADVISORY = {
  isSCECCritical: true,
  title: 'SCEC Approved Cable Entry',
  message: 'Cable entry into the Argent 50 Series rack is a key component of SCEC Class B & C compliance. Argent has extensive experience in design and manufacture of approved cable entries.',
  recommendation: 'Please contact Argent for more information on this important aspect of a SCEC approved rack.',
  contactRequired: true,
  series: ['50'] as ArgentSeriesKey[],
};

// 10 Series - Limited options (42RU only as per datasheet)
export const SERIES_10_DIMENSIONS: DimensionMatrix[] = [
  { seriesKey: '10', ruHeight: 42, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.10.42.600.800', basePrice: 2450 },
  { seriesKey: '10', ruHeight: 42, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.10.42.800.1000', basePrice: 2850 },
];

// 25 Series - Full commercial range
export const SERIES_25_DIMENSIONS: DimensionMatrix[] = [
  // 18RU
  { seriesKey: '25', ruHeight: 18, widthMm: 600, depthMm: 600, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.18.600.600', basePrice: 1650 },
  { seriesKey: '25', ruHeight: 18, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.18.600.800', basePrice: 1750 },
  { seriesKey: '25', ruHeight: 18, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.18.600.1000', basePrice: 1850 },
  // 22RU
  { seriesKey: '25', ruHeight: 22, widthMm: 600, depthMm: 600, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.22.600.600', basePrice: 1850 },
  { seriesKey: '25', ruHeight: 22, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.22.600.800', basePrice: 1950 },
  { seriesKey: '25', ruHeight: 22, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.22.600.1000', basePrice: 2050 },
  { seriesKey: '25', ruHeight: 22, widthMm: 800, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.22.800.800', basePrice: 2150 },
  { seriesKey: '25', ruHeight: 22, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.22.800.1000', basePrice: 2250 },
  // 27RU
  { seriesKey: '25', ruHeight: 27, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.27.600.800', basePrice: 2150 },
  { seriesKey: '25', ruHeight: 27, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.27.600.1000', basePrice: 2250 },
  { seriesKey: '25', ruHeight: 27, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.27.800.1000', basePrice: 2450 },
  // 32RU
  { seriesKey: '25', ruHeight: 32, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.32.600.800', basePrice: 2350 },
  { seriesKey: '25', ruHeight: 32, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.32.600.1000', basePrice: 2450 },
  { seriesKey: '25', ruHeight: 32, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.32.800.1000', basePrice: 2650 },
  // 37RU
  { seriesKey: '25', ruHeight: 37, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.37.600.800', basePrice: 2550 },
  { seriesKey: '25', ruHeight: 37, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.37.600.1000', basePrice: 2650 },
  { seriesKey: '25', ruHeight: 37, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.37.800.1000', basePrice: 2850 },
  { seriesKey: '25', ruHeight: 37, widthMm: 800, depthMm: 1200, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.37.800.1200', basePrice: 3050 },
  // 42RU - Standard data centre height
  { seriesKey: '25', ruHeight: 42, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.42.600.800', basePrice: 2750 },
  { seriesKey: '25', ruHeight: 42, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.42.600.1000', basePrice: 2850 },
  { seriesKey: '25', ruHeight: 42, widthMm: 600, depthMm: 1200, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.42.600.1200', basePrice: 2950 },
  { seriesKey: '25', ruHeight: 42, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.42.800.1000', basePrice: 3050 },
  { seriesKey: '25', ruHeight: 42, widthMm: 800, depthMm: 1200, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.42.800.1200', basePrice: 3250 },
  // 45RU
  { seriesKey: '25', ruHeight: 45, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.45.600.1000', basePrice: 3050 },
  { seriesKey: '25', ruHeight: 45, widthMm: 600, depthMm: 1200, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.45.600.1200', basePrice: 3150 },
  { seriesKey: '25', ruHeight: 45, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.45.800.1000', basePrice: 3250 },
  { seriesKey: '25', ruHeight: 45, widthMm: 800, depthMm: 1200, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.45.800.1200', basePrice: 3450 },
  // 47RU
  { seriesKey: '25', ruHeight: 47, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.47.600.1000', basePrice: 3250 },
  { seriesKey: '25', ruHeight: 47, widthMm: 600, depthMm: 1200, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.47.600.1200', basePrice: 3350 },
  { seriesKey: '25', ruHeight: 47, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.47.800.1000', basePrice: 3450 },
  { seriesKey: '25', ruHeight: 47, widthMm: 800, depthMm: 1200, isStandard: true, isCustomAllowed: false, partCode: '5ARG.25.47.800.1200', basePrice: 3650 },
];

// 40 Series - Open frame racks
export const SERIES_40_DIMENSIONS: DimensionMatrix[] = [
  // 2-Post frames
  { seriesKey: '40', ruHeight: 22, widthMm: 482, depthMm: 0, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.2P.22', basePrice: 850 },
  { seriesKey: '40', ruHeight: 27, widthMm: 482, depthMm: 0, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.2P.27', basePrice: 950 },
  { seriesKey: '40', ruHeight: 37, widthMm: 482, depthMm: 0, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.2P.37', basePrice: 1050 },
  { seriesKey: '40', ruHeight: 42, widthMm: 482, depthMm: 0, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.2P.42', basePrice: 1150 },
  { seriesKey: '40', ruHeight: 45, widthMm: 482, depthMm: 0, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.2P.45', basePrice: 1250 },
  // 4-Post frames
  { seriesKey: '40', ruHeight: 22, widthMm: 600, depthMm: 600, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.22.600.600', basePrice: 1250 },
  { seriesKey: '40', ruHeight: 22, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.22.600.800', basePrice: 1350 },
  { seriesKey: '40', ruHeight: 27, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.27.600.800', basePrice: 1450 },
  { seriesKey: '40', ruHeight: 27, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.27.600.1000', basePrice: 1550 },
  { seriesKey: '40', ruHeight: 37, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.37.600.800', basePrice: 1650 },
  { seriesKey: '40', ruHeight: 37, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.37.600.1000', basePrice: 1750 },
  { seriesKey: '40', ruHeight: 42, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.42.600.800', basePrice: 1750 },
  { seriesKey: '40', ruHeight: 42, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.42.600.1000', basePrice: 1850 },
  { seriesKey: '40', ruHeight: 42, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.42.800.1000', basePrice: 1950 },
  { seriesKey: '40', ruHeight: 45, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.45.600.1000', basePrice: 1950 },
  { seriesKey: '40', ruHeight: 45, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.45.800.1000', basePrice: 2050 },
  { seriesKey: '40', ruHeight: 47, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.47.600.1000', basePrice: 2150 },
  { seriesKey: '40', ruHeight: 47, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.40.4P.47.800.1000', basePrice: 2250 },
];

// 50 Series - SCEC Class B and C Security Server Racks (per PDF specification)
// Wall mount: 6RU / 12RU / 18RU
// Free standing: 18RU / 27RU / 39RU / 42RU / 45RU / 46RU
// Widths: 600 / 700 / 750 / 800 mm
// Depths: 700 / 800 / 900 / 1000 / 1050 / 1100 / 1200 mm
export const SERIES_50_DIMENSIONS: DimensionMatrix[] = [
  // ============================================================================
  // WALL MOUNT CONFIGURATIONS (6RU, 12RU, 18RU)
  // ============================================================================
  // 6RU Wall Mount
  { seriesKey: '50', ruHeight: 6, widthMm: 600, depthMm: 700, externalHeightMm: 400, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.6.600.700', basePrice: 3250 },
  { seriesKey: '50', ruHeight: 6, widthMm: 600, depthMm: 800, externalHeightMm: 400, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.6.600.800', basePrice: 3350 },
  { seriesKey: '50', ruHeight: 6, widthMm: 700, depthMm: 700, externalHeightMm: 400, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.6.700.700', basePrice: 3450 },
  { seriesKey: '50', ruHeight: 6, widthMm: 700, depthMm: 800, externalHeightMm: 400, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.6.700.800', basePrice: 3550 },
  { seriesKey: '50', ruHeight: 6, widthMm: 750, depthMm: 700, externalHeightMm: 400, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.6.750.700', basePrice: 3550 },
  { seriesKey: '50', ruHeight: 6, widthMm: 750, depthMm: 800, externalHeightMm: 400, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.6.750.800', basePrice: 3650 },
  { seriesKey: '50', ruHeight: 6, widthMm: 800, depthMm: 700, externalHeightMm: 400, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.6.800.700', basePrice: 3650 },
  { seriesKey: '50', ruHeight: 6, widthMm: 800, depthMm: 800, externalHeightMm: 400, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.6.800.800', basePrice: 3750 },
  
  // 12RU Wall Mount
  { seriesKey: '50', ruHeight: 12, widthMm: 600, depthMm: 700, externalHeightMm: 675, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.12.600.700', basePrice: 3850 },
  { seriesKey: '50', ruHeight: 12, widthMm: 600, depthMm: 800, externalHeightMm: 675, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.12.600.800', basePrice: 3950 },
  { seriesKey: '50', ruHeight: 12, widthMm: 600, depthMm: 900, externalHeightMm: 675, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.12.600.900', basePrice: 4050 },
  { seriesKey: '50', ruHeight: 12, widthMm: 700, depthMm: 700, externalHeightMm: 675, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.12.700.700', basePrice: 4050 },
  { seriesKey: '50', ruHeight: 12, widthMm: 700, depthMm: 800, externalHeightMm: 675, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.12.700.800', basePrice: 4150 },
  { seriesKey: '50', ruHeight: 12, widthMm: 700, depthMm: 900, externalHeightMm: 675, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.12.700.900', basePrice: 4250 },
  { seriesKey: '50', ruHeight: 12, widthMm: 750, depthMm: 700, externalHeightMm: 675, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.12.750.700', basePrice: 4150 },
  { seriesKey: '50', ruHeight: 12, widthMm: 750, depthMm: 800, externalHeightMm: 675, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.12.750.800', basePrice: 4250 },
  { seriesKey: '50', ruHeight: 12, widthMm: 750, depthMm: 900, externalHeightMm: 675, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.12.750.900', basePrice: 4350 },
  { seriesKey: '50', ruHeight: 12, widthMm: 800, depthMm: 700, externalHeightMm: 675, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.12.800.700', basePrice: 4250 },
  { seriesKey: '50', ruHeight: 12, widthMm: 800, depthMm: 800, externalHeightMm: 675, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.12.800.800', basePrice: 4350 },
  { seriesKey: '50', ruHeight: 12, widthMm: 800, depthMm: 900, externalHeightMm: 675, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.12.800.900', basePrice: 4450 },
  
  // 18RU Wall Mount
  { seriesKey: '50', ruHeight: 18, widthMm: 600, depthMm: 700, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.600.700', basePrice: 4450 },
  { seriesKey: '50', ruHeight: 18, widthMm: 600, depthMm: 800, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.600.800', basePrice: 4550 },
  { seriesKey: '50', ruHeight: 18, widthMm: 600, depthMm: 900, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.600.900', basePrice: 4650 },
  { seriesKey: '50', ruHeight: 18, widthMm: 600, depthMm: 1000, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.600.1000', basePrice: 4750 },
  { seriesKey: '50', ruHeight: 18, widthMm: 700, depthMm: 700, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.700.700', basePrice: 4650 },
  { seriesKey: '50', ruHeight: 18, widthMm: 700, depthMm: 800, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.700.800', basePrice: 4750 },
  { seriesKey: '50', ruHeight: 18, widthMm: 700, depthMm: 900, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.700.900', basePrice: 4850 },
  { seriesKey: '50', ruHeight: 18, widthMm: 700, depthMm: 1000, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.700.1000', basePrice: 4950 },
  { seriesKey: '50', ruHeight: 18, widthMm: 750, depthMm: 700, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.750.700', basePrice: 4750 },
  { seriesKey: '50', ruHeight: 18, widthMm: 750, depthMm: 800, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.750.800', basePrice: 4850 },
  { seriesKey: '50', ruHeight: 18, widthMm: 750, depthMm: 900, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.750.900', basePrice: 4950 },
  { seriesKey: '50', ruHeight: 18, widthMm: 750, depthMm: 1000, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.750.1000', basePrice: 5050 },
  { seriesKey: '50', ruHeight: 18, widthMm: 800, depthMm: 700, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.800.700', basePrice: 4850 },
  { seriesKey: '50', ruHeight: 18, widthMm: 800, depthMm: 800, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.800.800', basePrice: 4950 },
  { seriesKey: '50', ruHeight: 18, widthMm: 800, depthMm: 900, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.800.900', basePrice: 5050 },
  { seriesKey: '50', ruHeight: 18, widthMm: 800, depthMm: 1000, externalHeightMm: 950, mountType: 'wall_mount', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.WM.18.800.1000', basePrice: 5150 },
  
  // ============================================================================
  // FREE STANDING CONFIGURATIONS (18RU, 27RU, 39RU, 42RU, 45RU, 46RU)
  // ============================================================================
  // 18RU Free Standing
  { seriesKey: '50', ruHeight: 18, widthMm: 600, depthMm: 700, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.600.700', basePrice: 4850 },
  { seriesKey: '50', ruHeight: 18, widthMm: 600, depthMm: 800, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.600.800', basePrice: 4950 },
  { seriesKey: '50', ruHeight: 18, widthMm: 600, depthMm: 900, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.600.900', basePrice: 5050 },
  { seriesKey: '50', ruHeight: 18, widthMm: 600, depthMm: 1000, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.600.1000', basePrice: 5150 },
  { seriesKey: '50', ruHeight: 18, widthMm: 600, depthMm: 1050, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.600.1050', basePrice: 5250 },
  { seriesKey: '50', ruHeight: 18, widthMm: 600, depthMm: 1100, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.600.1100', basePrice: 5350 },
  { seriesKey: '50', ruHeight: 18, widthMm: 600, depthMm: 1200, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.600.1200', basePrice: 5450 },
  { seriesKey: '50', ruHeight: 18, widthMm: 700, depthMm: 700, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.700.700', basePrice: 5050 },
  { seriesKey: '50', ruHeight: 18, widthMm: 700, depthMm: 800, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.700.800', basePrice: 5150 },
  { seriesKey: '50', ruHeight: 18, widthMm: 700, depthMm: 900, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.700.900', basePrice: 5250 },
  { seriesKey: '50', ruHeight: 18, widthMm: 700, depthMm: 1000, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.700.1000', basePrice: 5350 },
  { seriesKey: '50', ruHeight: 18, widthMm: 700, depthMm: 1050, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.700.1050', basePrice: 5450 },
  { seriesKey: '50', ruHeight: 18, widthMm: 700, depthMm: 1100, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.700.1100', basePrice: 5550 },
  { seriesKey: '50', ruHeight: 18, widthMm: 700, depthMm: 1200, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.700.1200', basePrice: 5650 },
  { seriesKey: '50', ruHeight: 18, widthMm: 750, depthMm: 700, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.750.700', basePrice: 5150 },
  { seriesKey: '50', ruHeight: 18, widthMm: 750, depthMm: 800, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.750.800', basePrice: 5250 },
  { seriesKey: '50', ruHeight: 18, widthMm: 750, depthMm: 900, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.750.900', basePrice: 5350 },
  { seriesKey: '50', ruHeight: 18, widthMm: 750, depthMm: 1000, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.750.1000', basePrice: 5450 },
  { seriesKey: '50', ruHeight: 18, widthMm: 750, depthMm: 1050, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.750.1050', basePrice: 5550 },
  { seriesKey: '50', ruHeight: 18, widthMm: 750, depthMm: 1100, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.750.1100', basePrice: 5650 },
  { seriesKey: '50', ruHeight: 18, widthMm: 750, depthMm: 1200, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.750.1200', basePrice: 5750 },
  { seriesKey: '50', ruHeight: 18, widthMm: 800, depthMm: 700, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.800.700', basePrice: 5250 },
  { seriesKey: '50', ruHeight: 18, widthMm: 800, depthMm: 800, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.800.800', basePrice: 5350 },
  { seriesKey: '50', ruHeight: 18, widthMm: 800, depthMm: 900, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.800.900', basePrice: 5450 },
  { seriesKey: '50', ruHeight: 18, widthMm: 800, depthMm: 1000, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.800.1000', basePrice: 5550 },
  { seriesKey: '50', ruHeight: 18, widthMm: 800, depthMm: 1050, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.800.1050', basePrice: 5650 },
  { seriesKey: '50', ruHeight: 18, widthMm: 800, depthMm: 1100, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.800.1100', basePrice: 5750 },
  { seriesKey: '50', ruHeight: 18, widthMm: 800, depthMm: 1200, externalHeightMm: 950, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.18.800.1200', basePrice: 5850 },
  
  // 27RU Free Standing
  { seriesKey: '50', ruHeight: 27, widthMm: 600, depthMm: 700, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.600.700', basePrice: 5650 },
  { seriesKey: '50', ruHeight: 27, widthMm: 600, depthMm: 800, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.600.800', basePrice: 5750 },
  { seriesKey: '50', ruHeight: 27, widthMm: 600, depthMm: 900, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.600.900', basePrice: 5850 },
  { seriesKey: '50', ruHeight: 27, widthMm: 600, depthMm: 1000, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.600.1000', basePrice: 5950 },
  { seriesKey: '50', ruHeight: 27, widthMm: 600, depthMm: 1050, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.600.1050', basePrice: 6050 },
  { seriesKey: '50', ruHeight: 27, widthMm: 600, depthMm: 1100, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.600.1100', basePrice: 6150 },
  { seriesKey: '50', ruHeight: 27, widthMm: 600, depthMm: 1200, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.600.1200', basePrice: 6250 },
  { seriesKey: '50', ruHeight: 27, widthMm: 700, depthMm: 700, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.700.700', basePrice: 5850 },
  { seriesKey: '50', ruHeight: 27, widthMm: 700, depthMm: 800, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.700.800', basePrice: 5950 },
  { seriesKey: '50', ruHeight: 27, widthMm: 700, depthMm: 900, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.700.900', basePrice: 6050 },
  { seriesKey: '50', ruHeight: 27, widthMm: 700, depthMm: 1000, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.700.1000', basePrice: 6150 },
  { seriesKey: '50', ruHeight: 27, widthMm: 700, depthMm: 1050, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.700.1050', basePrice: 6250 },
  { seriesKey: '50', ruHeight: 27, widthMm: 700, depthMm: 1100, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.700.1100', basePrice: 6350 },
  { seriesKey: '50', ruHeight: 27, widthMm: 700, depthMm: 1200, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.700.1200', basePrice: 6450 },
  { seriesKey: '50', ruHeight: 27, widthMm: 750, depthMm: 700, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.750.700', basePrice: 5950 },
  { seriesKey: '50', ruHeight: 27, widthMm: 750, depthMm: 800, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.750.800', basePrice: 6050 },
  { seriesKey: '50', ruHeight: 27, widthMm: 750, depthMm: 900, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.750.900', basePrice: 6150 },
  { seriesKey: '50', ruHeight: 27, widthMm: 750, depthMm: 1000, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.750.1000', basePrice: 6250 },
  { seriesKey: '50', ruHeight: 27, widthMm: 750, depthMm: 1050, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.750.1050', basePrice: 6350 },
  { seriesKey: '50', ruHeight: 27, widthMm: 750, depthMm: 1100, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.750.1100', basePrice: 6450 },
  { seriesKey: '50', ruHeight: 27, widthMm: 750, depthMm: 1200, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.750.1200', basePrice: 6550 },
  { seriesKey: '50', ruHeight: 27, widthMm: 800, depthMm: 700, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.800.700', basePrice: 6050 },
  { seriesKey: '50', ruHeight: 27, widthMm: 800, depthMm: 800, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.800.800', basePrice: 6150 },
  { seriesKey: '50', ruHeight: 27, widthMm: 800, depthMm: 900, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.800.900', basePrice: 6250 },
  { seriesKey: '50', ruHeight: 27, widthMm: 800, depthMm: 1000, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.800.1000', basePrice: 6350 },
  { seriesKey: '50', ruHeight: 27, widthMm: 800, depthMm: 1050, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.800.1050', basePrice: 6450 },
  { seriesKey: '50', ruHeight: 27, widthMm: 800, depthMm: 1100, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.800.1100', basePrice: 6550 },
  { seriesKey: '50', ruHeight: 27, widthMm: 800, depthMm: 1200, externalHeightMm: 1350, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.27.800.1200', basePrice: 6650 },
  
  // 39RU Free Standing
  { seriesKey: '50', ruHeight: 39, widthMm: 600, depthMm: 700, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.600.700', basePrice: 6850 },
  { seriesKey: '50', ruHeight: 39, widthMm: 600, depthMm: 800, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.600.800', basePrice: 6950 },
  { seriesKey: '50', ruHeight: 39, widthMm: 600, depthMm: 900, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.600.900', basePrice: 7050 },
  { seriesKey: '50', ruHeight: 39, widthMm: 600, depthMm: 1000, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.600.1000', basePrice: 7150 },
  { seriesKey: '50', ruHeight: 39, widthMm: 600, depthMm: 1050, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.600.1050', basePrice: 7250 },
  { seriesKey: '50', ruHeight: 39, widthMm: 600, depthMm: 1100, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.600.1100', basePrice: 7350 },
  { seriesKey: '50', ruHeight: 39, widthMm: 600, depthMm: 1200, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.600.1200', basePrice: 7450 },
  { seriesKey: '50', ruHeight: 39, widthMm: 700, depthMm: 700, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.700.700', basePrice: 7050 },
  { seriesKey: '50', ruHeight: 39, widthMm: 700, depthMm: 800, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.700.800', basePrice: 7150 },
  { seriesKey: '50', ruHeight: 39, widthMm: 700, depthMm: 900, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.700.900', basePrice: 7250 },
  { seriesKey: '50', ruHeight: 39, widthMm: 700, depthMm: 1000, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.700.1000', basePrice: 7350 },
  { seriesKey: '50', ruHeight: 39, widthMm: 700, depthMm: 1050, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.700.1050', basePrice: 7450 },
  { seriesKey: '50', ruHeight: 39, widthMm: 700, depthMm: 1100, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.700.1100', basePrice: 7550 },
  { seriesKey: '50', ruHeight: 39, widthMm: 700, depthMm: 1200, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.700.1200', basePrice: 7650 },
  { seriesKey: '50', ruHeight: 39, widthMm: 750, depthMm: 700, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.750.700', basePrice: 7150 },
  { seriesKey: '50', ruHeight: 39, widthMm: 750, depthMm: 800, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.750.800', basePrice: 7250 },
  { seriesKey: '50', ruHeight: 39, widthMm: 750, depthMm: 900, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.750.900', basePrice: 7350 },
  { seriesKey: '50', ruHeight: 39, widthMm: 750, depthMm: 1000, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.750.1000', basePrice: 7450 },
  { seriesKey: '50', ruHeight: 39, widthMm: 750, depthMm: 1050, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.750.1050', basePrice: 7550 },
  { seriesKey: '50', ruHeight: 39, widthMm: 750, depthMm: 1100, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.750.1100', basePrice: 7650 },
  { seriesKey: '50', ruHeight: 39, widthMm: 750, depthMm: 1200, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.750.1200', basePrice: 7750 },
  { seriesKey: '50', ruHeight: 39, widthMm: 800, depthMm: 700, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.800.700', basePrice: 7250 },
  { seriesKey: '50', ruHeight: 39, widthMm: 800, depthMm: 800, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.800.800', basePrice: 7350 },
  { seriesKey: '50', ruHeight: 39, widthMm: 800, depthMm: 900, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.800.900', basePrice: 7450 },
  { seriesKey: '50', ruHeight: 39, widthMm: 800, depthMm: 1000, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.800.1000', basePrice: 7550 },
  { seriesKey: '50', ruHeight: 39, widthMm: 800, depthMm: 1050, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.800.1050', basePrice: 7650 },
  { seriesKey: '50', ruHeight: 39, widthMm: 800, depthMm: 1100, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.800.1100', basePrice: 7750 },
  { seriesKey: '50', ruHeight: 39, widthMm: 800, depthMm: 1200, externalHeightMm: 1884, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.39.800.1200', basePrice: 7850 },
  
  // 42RU Free Standing
  { seriesKey: '50', ruHeight: 42, widthMm: 600, depthMm: 700, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.600.700', basePrice: 7250 },
  { seriesKey: '50', ruHeight: 42, widthMm: 600, depthMm: 800, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.600.800', basePrice: 7350 },
  { seriesKey: '50', ruHeight: 42, widthMm: 600, depthMm: 900, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.600.900', basePrice: 7450 },
  { seriesKey: '50', ruHeight: 42, widthMm: 600, depthMm: 1000, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.600.1000', basePrice: 7550 },
  { seriesKey: '50', ruHeight: 42, widthMm: 600, depthMm: 1050, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.600.1050', basePrice: 7650 },
  { seriesKey: '50', ruHeight: 42, widthMm: 600, depthMm: 1100, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.600.1100', basePrice: 7750 },
  { seriesKey: '50', ruHeight: 42, widthMm: 600, depthMm: 1200, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.600.1200', basePrice: 7850 },
  { seriesKey: '50', ruHeight: 42, widthMm: 700, depthMm: 700, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.700.700', basePrice: 7450 },
  { seriesKey: '50', ruHeight: 42, widthMm: 700, depthMm: 800, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.700.800', basePrice: 7550 },
  { seriesKey: '50', ruHeight: 42, widthMm: 700, depthMm: 900, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.700.900', basePrice: 7650 },
  { seriesKey: '50', ruHeight: 42, widthMm: 700, depthMm: 1000, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.700.1000', basePrice: 7750 },
  { seriesKey: '50', ruHeight: 42, widthMm: 700, depthMm: 1050, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.700.1050', basePrice: 7850 },
  { seriesKey: '50', ruHeight: 42, widthMm: 700, depthMm: 1100, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.700.1100', basePrice: 7950 },
  { seriesKey: '50', ruHeight: 42, widthMm: 700, depthMm: 1200, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.700.1200', basePrice: 8050 },
  { seriesKey: '50', ruHeight: 42, widthMm: 750, depthMm: 700, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.750.700', basePrice: 7550 },
  { seriesKey: '50', ruHeight: 42, widthMm: 750, depthMm: 800, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.750.800', basePrice: 7650 },
  { seriesKey: '50', ruHeight: 42, widthMm: 750, depthMm: 900, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.750.900', basePrice: 7750 },
  { seriesKey: '50', ruHeight: 42, widthMm: 750, depthMm: 1000, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.750.1000', basePrice: 7850 },
  { seriesKey: '50', ruHeight: 42, widthMm: 750, depthMm: 1050, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.750.1050', basePrice: 7950 },
  { seriesKey: '50', ruHeight: 42, widthMm: 750, depthMm: 1100, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.750.1100', basePrice: 8050 },
  { seriesKey: '50', ruHeight: 42, widthMm: 750, depthMm: 1200, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.750.1200', basePrice: 8150 },
  { seriesKey: '50', ruHeight: 42, widthMm: 800, depthMm: 700, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.800.700', basePrice: 7650 },
  { seriesKey: '50', ruHeight: 42, widthMm: 800, depthMm: 800, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.800.800', basePrice: 7750 },
  { seriesKey: '50', ruHeight: 42, widthMm: 800, depthMm: 900, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.800.900', basePrice: 7850 },
  { seriesKey: '50', ruHeight: 42, widthMm: 800, depthMm: 1000, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.800.1000', basePrice: 7950 },
  { seriesKey: '50', ruHeight: 42, widthMm: 800, depthMm: 1050, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.800.1050', basePrice: 8050 },
  { seriesKey: '50', ruHeight: 42, widthMm: 800, depthMm: 1100, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.800.1100', basePrice: 8150 },
  { seriesKey: '50', ruHeight: 42, widthMm: 800, depthMm: 1200, externalHeightMm: 2017, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.42.800.1200', basePrice: 8250 },
  
  // 45RU Free Standing
  { seriesKey: '50', ruHeight: 45, widthMm: 600, depthMm: 700, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.600.700', basePrice: 7650 },
  { seriesKey: '50', ruHeight: 45, widthMm: 600, depthMm: 800, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.600.800', basePrice: 7750 },
  { seriesKey: '50', ruHeight: 45, widthMm: 600, depthMm: 900, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.600.900', basePrice: 7850 },
  { seriesKey: '50', ruHeight: 45, widthMm: 600, depthMm: 1000, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.600.1000', basePrice: 7950 },
  { seriesKey: '50', ruHeight: 45, widthMm: 600, depthMm: 1050, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.600.1050', basePrice: 8050 },
  { seriesKey: '50', ruHeight: 45, widthMm: 600, depthMm: 1100, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.600.1100', basePrice: 8150 },
  { seriesKey: '50', ruHeight: 45, widthMm: 600, depthMm: 1200, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.600.1200', basePrice: 8250 },
  { seriesKey: '50', ruHeight: 45, widthMm: 700, depthMm: 700, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.700.700', basePrice: 7850 },
  { seriesKey: '50', ruHeight: 45, widthMm: 700, depthMm: 800, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.700.800', basePrice: 7950 },
  { seriesKey: '50', ruHeight: 45, widthMm: 700, depthMm: 900, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.700.900', basePrice: 8050 },
  { seriesKey: '50', ruHeight: 45, widthMm: 700, depthMm: 1000, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.700.1000', basePrice: 8150 },
  { seriesKey: '50', ruHeight: 45, widthMm: 700, depthMm: 1050, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.700.1050', basePrice: 8250 },
  { seriesKey: '50', ruHeight: 45, widthMm: 700, depthMm: 1100, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.700.1100', basePrice: 8350 },
  { seriesKey: '50', ruHeight: 45, widthMm: 700, depthMm: 1200, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.700.1200', basePrice: 8450 },
  { seriesKey: '50', ruHeight: 45, widthMm: 750, depthMm: 700, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.750.700', basePrice: 7950 },
  { seriesKey: '50', ruHeight: 45, widthMm: 750, depthMm: 800, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.750.800', basePrice: 8050 },
  { seriesKey: '50', ruHeight: 45, widthMm: 750, depthMm: 900, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.750.900', basePrice: 8150 },
  { seriesKey: '50', ruHeight: 45, widthMm: 750, depthMm: 1000, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.750.1000', basePrice: 8250 },
  { seriesKey: '50', ruHeight: 45, widthMm: 750, depthMm: 1050, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.750.1050', basePrice: 8350 },
  { seriesKey: '50', ruHeight: 45, widthMm: 750, depthMm: 1100, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.750.1100', basePrice: 8450 },
  { seriesKey: '50', ruHeight: 45, widthMm: 750, depthMm: 1200, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.750.1200', basePrice: 8550 },
  { seriesKey: '50', ruHeight: 45, widthMm: 800, depthMm: 700, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.800.700', basePrice: 8050 },
  { seriesKey: '50', ruHeight: 45, widthMm: 800, depthMm: 800, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.800.800', basePrice: 8150 },
  { seriesKey: '50', ruHeight: 45, widthMm: 800, depthMm: 900, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.800.900', basePrice: 8250 },
  { seriesKey: '50', ruHeight: 45, widthMm: 800, depthMm: 1000, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.800.1000', basePrice: 8350 },
  { seriesKey: '50', ruHeight: 45, widthMm: 800, depthMm: 1050, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.800.1050', basePrice: 8450 },
  { seriesKey: '50', ruHeight: 45, widthMm: 800, depthMm: 1100, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.800.1100', basePrice: 8550 },
  { seriesKey: '50', ruHeight: 45, widthMm: 800, depthMm: 1200, externalHeightMm: 2150, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.45.800.1200', basePrice: 8650 },
  
  // 46RU Free Standing
  { seriesKey: '50', ruHeight: 46, widthMm: 600, depthMm: 700, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.600.700', basePrice: 7750 },
  { seriesKey: '50', ruHeight: 46, widthMm: 600, depthMm: 800, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.600.800', basePrice: 7850 },
  { seriesKey: '50', ruHeight: 46, widthMm: 600, depthMm: 900, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.600.900', basePrice: 7950 },
  { seriesKey: '50', ruHeight: 46, widthMm: 600, depthMm: 1000, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.600.1000', basePrice: 8050 },
  { seriesKey: '50', ruHeight: 46, widthMm: 600, depthMm: 1050, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.600.1050', basePrice: 8150 },
  { seriesKey: '50', ruHeight: 46, widthMm: 600, depthMm: 1100, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.600.1100', basePrice: 8250 },
  { seriesKey: '50', ruHeight: 46, widthMm: 600, depthMm: 1200, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.600.1200', basePrice: 8350 },
  { seriesKey: '50', ruHeight: 46, widthMm: 700, depthMm: 700, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.700.700', basePrice: 7950 },
  { seriesKey: '50', ruHeight: 46, widthMm: 700, depthMm: 800, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.700.800', basePrice: 8050 },
  { seriesKey: '50', ruHeight: 46, widthMm: 700, depthMm: 900, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.700.900', basePrice: 8150 },
  { seriesKey: '50', ruHeight: 46, widthMm: 700, depthMm: 1000, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.700.1000', basePrice: 8250 },
  { seriesKey: '50', ruHeight: 46, widthMm: 700, depthMm: 1050, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.700.1050', basePrice: 8350 },
  { seriesKey: '50', ruHeight: 46, widthMm: 700, depthMm: 1100, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.700.1100', basePrice: 8450 },
  { seriesKey: '50', ruHeight: 46, widthMm: 700, depthMm: 1200, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.700.1200', basePrice: 8550 },
  { seriesKey: '50', ruHeight: 46, widthMm: 750, depthMm: 700, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.750.700', basePrice: 8050 },
  { seriesKey: '50', ruHeight: 46, widthMm: 750, depthMm: 800, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.750.800', basePrice: 8150 },
  { seriesKey: '50', ruHeight: 46, widthMm: 750, depthMm: 900, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.750.900', basePrice: 8250 },
  { seriesKey: '50', ruHeight: 46, widthMm: 750, depthMm: 1000, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.750.1000', basePrice: 8350 },
  { seriesKey: '50', ruHeight: 46, widthMm: 750, depthMm: 1050, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.750.1050', basePrice: 8450 },
  { seriesKey: '50', ruHeight: 46, widthMm: 750, depthMm: 1100, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.750.1100', basePrice: 8550 },
  { seriesKey: '50', ruHeight: 46, widthMm: 750, depthMm: 1200, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.750.1200', basePrice: 8650 },
  { seriesKey: '50', ruHeight: 46, widthMm: 800, depthMm: 700, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.800.700', basePrice: 8150 },
  { seriesKey: '50', ruHeight: 46, widthMm: 800, depthMm: 800, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.800.800', basePrice: 8250 },
  { seriesKey: '50', ruHeight: 46, widthMm: 800, depthMm: 900, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.800.900', basePrice: 8350 },
  { seriesKey: '50', ruHeight: 46, widthMm: 800, depthMm: 1000, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.800.1000', basePrice: 8450 },
  { seriesKey: '50', ruHeight: 46, widthMm: 800, depthMm: 1050, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.800.1050', basePrice: 8550 },
  { seriesKey: '50', ruHeight: 46, widthMm: 800, depthMm: 1100, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.800.1100', basePrice: 8650 },
  { seriesKey: '50', ruHeight: 46, widthMm: 800, depthMm: 1200, externalHeightMm: 2195, mountType: 'free_standing', isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.FS.46.800.1200', basePrice: 8750 },
];

// V50 Data Vault - In-rack security enclosures
// RU heights: 2, 4, 6
// Width: Fixed at 493mm (19" standard with mounting flanges)
// Depth: Adjustable within rack depth constraints (400-700mm)
// Part numbers from PDF: 5ARG 902231-02SK, 5ARG 902231-04SK, 5ARG 902231-06SK
export const SERIES_V50_DIMENSIONS: DimensionMatrix[] = [
  // 2RU Data Vault - Height: 130mm
  { seriesKey: 'v50', ruHeight: 2, widthMm: 493, depthMm: 400, externalHeightMm: 130, isStandard: true, isCustomAllowed: false, partCode: '5ARG.902231-02SK.400', basePrice: 650 },
  { seriesKey: 'v50', ruHeight: 2, widthMm: 493, depthMm: 500, externalHeightMm: 130, isStandard: true, isCustomAllowed: false, partCode: '5ARG.902231-02SK.500', basePrice: 695 },
  { seriesKey: 'v50', ruHeight: 2, widthMm: 493, depthMm: 600, externalHeightMm: 130, isStandard: true, isCustomAllowed: false, partCode: '5ARG.902231-02SK.600', basePrice: 745 },
  { seriesKey: 'v50', ruHeight: 2, widthMm: 493, depthMm: 700, externalHeightMm: 130, isStandard: true, isCustomAllowed: false, partCode: '5ARG.902231-02SK.700', basePrice: 795 },
  // 4RU Data Vault - Height: 220mm
  { seriesKey: 'v50', ruHeight: 4, widthMm: 493, depthMm: 400, externalHeightMm: 220, isStandard: true, isCustomAllowed: false, partCode: '5ARG.902231-04SK.400', basePrice: 850 },
  { seriesKey: 'v50', ruHeight: 4, widthMm: 493, depthMm: 500, externalHeightMm: 220, isStandard: true, isCustomAllowed: false, partCode: '5ARG.902231-04SK.500', basePrice: 895 },
  { seriesKey: 'v50', ruHeight: 4, widthMm: 493, depthMm: 600, externalHeightMm: 220, isStandard: true, isCustomAllowed: false, partCode: '5ARG.902231-04SK.600', basePrice: 945 },
  { seriesKey: 'v50', ruHeight: 4, widthMm: 493, depthMm: 700, externalHeightMm: 220, isStandard: true, isCustomAllowed: false, partCode: '5ARG.902231-04SK.700', basePrice: 995 },
  // 6RU Data Vault - Height: 310mm
  { seriesKey: 'v50', ruHeight: 6, widthMm: 493, depthMm: 400, externalHeightMm: 310, isStandard: true, isCustomAllowed: false, partCode: '5ARG.902231-06SK.400', basePrice: 1050 },
  { seriesKey: 'v50', ruHeight: 6, widthMm: 493, depthMm: 500, externalHeightMm: 310, isStandard: true, isCustomAllowed: false, partCode: '5ARG.902231-06SK.500', basePrice: 1095 },
  { seriesKey: 'v50', ruHeight: 6, widthMm: 493, depthMm: 600, externalHeightMm: 310, isStandard: true, isCustomAllowed: false, partCode: '5ARG.902231-06SK.600', basePrice: 1145 },
  { seriesKey: 'v50', ruHeight: 6, widthMm: 493, depthMm: 700, externalHeightMm: 310, isStandard: true, isCustomAllowed: false, partCode: '5ARG.902231-06SK.700', basePrice: 1195 },
];

// V50 RU to external height mapping (from PDF page 4)
export const SERIES_V50_RU_HEIGHT_MAP: Record<number, number> = {
  2: 130,  // 2RU capacity
  4: 220,  // 4RU capacity
  6: 310,  // 6RU capacity
};

// Unified dimension matrix for lookups
export const ALL_ARGENT_DIMENSIONS: DimensionMatrix[] = [
  ...SERIES_10_DIMENSIONS,
  ...SERIES_25_DIMENSIONS,
  ...SERIES_40_DIMENSIONS,
  ...SERIES_50_DIMENSIONS,
  ...SERIES_V50_DIMENSIONS,
];

// ============================================================================
// DOOR OPTIONS
// ============================================================================

export type DoorType = 'perforated' | 'solid' | 'polycarbonate' | 'mesh' | 'split' | 'none';
export type DoorPosition = 'front' | 'rear' | 'both';

export interface DoorOption {
  id: string;
  type: DoorType;
  label: string;
  description: string;
  applicableSeries: ArgentSeriesKey[];
  priceDelta: number;
  code: string;
  securityCompatible: boolean; // Can be used with security racks
}

export const DOOR_OPTIONS: DoorOption[] = [
  // Standard commercial doors (10, 25 Series)
  {
    id: 'door-perf-steel',
    type: 'perforated',
    label: 'Perforated Steel Door',
    description: '70% perforated steel for optimal airflow. Left or right hand hinged, single point lock.',
    applicableSeries: ['10', '25'],
    priceDelta: 0, // Standard option
    code: 'PD',
    securityCompatible: false,
  },
  {
    id: 'door-solid-steel',
    type: 'solid',
    label: 'Solid Steel Door',
    description: 'Solid steel construction for maximum security. Single point lock included.',
    applicableSeries: ['25'],
    priceDelta: 150,
    code: 'SD',
    securityCompatible: false,
  },
  {
    id: 'door-polycarbonate-25',
    type: 'polycarbonate',
    label: 'Polycarbonate Window Door',
    description: 'Steel frame with polycarbonate window for equipment visibility.',
    applicableSeries: ['25'],
    priceDelta: 250,
    code: 'WD',
    securityCompatible: false,
  },
  {
    id: 'door-split-25',
    type: 'split',
    label: 'Split Hinged Doors',
    description: 'Two-section doors for tight aisle access. Ideal for data centres.',
    applicableSeries: ['25'],
    priceDelta: 350,
    code: 'SPD',
    securityCompatible: false,
  },
  // 50 Series Security Doors (per PDF specification)
  // Perforated and Polycarbonate only - no solid steel option per PDF
  {
    id: 'door-perf-steel-50',
    type: 'perforated',
    label: 'Perforated Steel Door (3-Point Locking)',
    description: '50% perforated mesh / 50% solid steel construction. 3-point locking mechanism. >180° opening access. Hinge pins allow easy door removal during maintenance. Left or right hinged options.',
    applicableSeries: ['50'],
    priceDelta: 0, // Standard option for 50 Series
    code: 'PD50',
    securityCompatible: true,
  },
  {
    id: 'door-polycarbonate-50',
    type: 'polycarbonate',
    label: '6mm Polycarbonate Window Door (3-Point Locking)',
    description: 'Steel frame with 6mm polycarbonate window. 3-point locking mechanism. >180° opening. Left or right hinged options. Not permitted for SCEC Class C security.',
    applicableSeries: ['50'],
    priceDelta: 250,
    code: 'WD50',
    securityCompatible: false, // Not for Class C per PDF
  },
  // Open frame (40 Series)
  {
    id: 'door-none',
    type: 'none',
    label: 'No Door (Open Frame)',
    description: 'Open frame configuration without doors.',
    applicableSeries: ['40'],
    priceDelta: 0,
    code: 'ND',
    securityCompatible: false,
  },
];

// ============================================================================
// HINGE SIDE OPTIONS
// ============================================================================

export interface HingeSideOption {
  id: string;
  label: string;
  description: string;
  code: string;
}

export const HINGE_SIDE_OPTIONS: HingeSideOption[] = [
  {
    id: 'hinge-left',
    label: 'Left Hand Hinged',
    description: 'Door hinges on the left side, opens to the right.',
    code: 'LH',
  },
  {
    id: 'hinge-right',
    label: 'Right Hand Hinged',
    description: 'Door hinges on the right side, opens to the left.',
    code: 'RH',
  },
];

// ============================================================================
// SIDE PANEL OPTIONS
// ============================================================================

export type PanelType = 'solid' | 'vented' | 'removable' | 'lockable' | 'none';

export interface SidePanelOption {
  id: string;
  type: PanelType;
  label: string;
  description: string;
  applicableSeries: ArgentSeriesKey[];
  priceDelta: number; // Per pair
  code: string;
  securityRequired: boolean; // Required for security racks
  onRequest?: boolean; // Available on request only (50 Series)
}

export const SIDE_PANEL_OPTIONS: SidePanelOption[] = [
  // Standard commercial panels
  {
    id: 'panel-solid-lockable',
    type: 'lockable',
    label: 'Solid Lockable Side Panels',
    description: 'Removable lockable steel side panels (pair).',
    applicableSeries: ['10', '25'],
    priceDelta: 0, // Standard for enclosures
    code: 'SLP',
    securityRequired: false,
  },
  {
    id: 'panel-vented',
    type: 'vented',
    label: 'Vented Side Panels',
    description: 'Side panels with ventilation slots for airflow (pair).',
    applicableSeries: ['25'],
    priceDelta: 100,
    code: 'SVP',
    securityRequired: false,
  },
  {
    id: 'panel-none',
    type: 'none',
    label: 'No Side Panels',
    description: 'Open sides for baying or open frame configurations.',
    applicableSeries: ['25', '40'],
    priceDelta: -200,
    code: 'NSP',
    securityRequired: false,
  },
  // 50 Series Security Panels (per PDF specification)
  {
    id: 'panel-solid-internal-50',
    type: 'solid',
    label: 'Solid Side Panels (Internally Secured)',
    description: 'All side panels are solid form and internally secured for SCEC compliance. Standard for 50 Series.',
    applicableSeries: ['50'],
    priceDelta: 0, // Standard for 50 Series
    code: 'SIP50',
    securityRequired: true,
  },
  {
    id: 'panel-discrete-vented-50',
    type: 'vented',
    label: 'Discrete Ventilated Side Panels (On Request)',
    description: 'Solid side panels with discrete ventilation slots. Maintains security compliance while allowing additional airflow. Available on request.',
    applicableSeries: ['50'],
    priceDelta: 200,
    code: 'DVP50',
    securityRequired: false,
    onRequest: true,
  },
];

// ============================================================================
// LOCK OPTIONS (Security-critical for 50 Series)
// ============================================================================

export type LockType = 'key' | 'combination' | 'digital' | 'biometric';
export type LockSecurity = 'standard' | 'class_b' | 'class_c';

export interface LockOption {
  id: string;
  type: LockType;
  security: LockSecurity;
  label: string;
  description: string;
  applicableSeries: ArgentSeriesKey[];
  priceDelta: number;
  code: string;
  requiresConsult: boolean;
}

export const LOCK_OPTIONS: LockOption[] = [
  // Standard locks
  {
    id: 'lock-key-standard',
    type: 'key',
    security: 'standard',
    label: 'Standard Keyed Lock',
    description: 'Single point keyed lock. Master key systems available.',
    applicableSeries: ['10', '25', 'v50'],
    priceDelta: 0,
    code: 'SKL',
    requiresConsult: false,
  },
  {
    id: 'lock-combo-standard',
    type: 'combination',
    security: 'standard',
    label: 'Combination Lock',
    description: 'Four-digit combination lock. User programmable.',
    applicableSeries: ['25', 'v50'],
    priceDelta: 85,
    code: 'SCL',
    requiresConsult: false,
  },
  // Class B locks - KABA X10 Digital Combination (per PDF specification)
  {
    id: 'lock-kaba-x10-class-b',
    type: 'digital',
    security: 'class_b',
    label: 'KABA X10 Digital Combination Lock',
    description: 'SCEC-approved KABA X10 Series digital combination lock. Required for Class B security racks. Features programmable combinations and audit trail capability.',
    applicableSeries: ['50'],
    priceDelta: 450,
    code: 'KABA-X10',
    requiresConsult: true,
  },
  // Class C locks - C Class L-Handled Bilock (per PDF specification)
  {
    id: 'lock-bilock-class-c',
    type: 'key',
    security: 'class_c',
    label: 'Class C L-Handled Bilock (Keyed Alike)',
    description: 'SCEC-approved Class C restricted key system with L-handled bilock. Keyed alike options available. Required for Class C security racks.',
    applicableSeries: ['50'],
    priceDelta: 350,
    code: 'BILOCK-C',
    requiresConsult: true,
  },
  // Advanced locks - Digital Keypad (25 Series only, NOT for 50 Series)
  {
    id: 'lock-digital',
    type: 'digital',
    security: 'standard',
    label: 'Digital Keypad Lock',
    description: 'Electronic keypad with audit trail. Battery backup included.',
    applicableSeries: ['25'],
    priceDelta: 350,
    code: 'DKL',
    requiresConsult: false,
  },
];

// ============================================================================
// ACCESSORIES (Cable Management, etc.)
// ============================================================================

export type AccessoryCategory = 
  | 'cable_management'
  | 'cable'
  | 'power'
  | 'cooling'
  | 'mounting'
  | 'security'
  | 'infrastructure';

export interface ArgentAccessory {
  id: string;
  category: AccessoryCategory;
  name: string;
  description: string;
  applicableSeries: ArgentSeriesKey[] | 'all';
  price: number;
  code: string;
  position?: 'top' | 'rear' | 'internal' | 'side' | 'front'; // Physical position in rack
  includedStandard?: boolean; // Included with base product
  requiresConsult?: boolean; // Needs consultation for ordering
  requiresSize?: boolean; // Needs to match rack dimensions
}

export const ARGENT_ACCESSORIES: ArgentAccessory[] = [
  // ============================================================================
  // CABLE MANAGEMENT (Not for 50 Series except basic cable management)
  // ============================================================================
  {
    id: 'acc-cable-ladder',
    category: 'cable_management',
    name: 'Cable Ladder',
    description: 'Provides a structured overhead pathway for routing large cable bundles from front to rear or between racks. Mounted at the top rear or internally and aligned with vertical cable paths. Textura Black powder coat to match rack frame and internal components.',
    applicableSeries: ['10', '25', '40'], // Removed from 50 Series per PDF
    price: 185,
    code: 'CL',
  },
  {
    id: 'acc-finger-manager',
    category: 'cable_management',
    name: 'Finger Manager (Horizontal)',
    description: 'Horizontal cable management fingers. 1RU.',
    applicableSeries: ['10', '25'], // Removed from 50 Series per PDF
    price: 45,
    code: 'FM',
  },
  {
    id: 'acc-vcm-150-250',
    category: 'cable_management',
    name: 'Vertical Cable Manager 150W x 250D',
    description: 'OPEN DATA 45U Vertical cable manager, 150mm wide x 250mm deep. Full height duct with perforated front.',
    applicableSeries: ['25', '40'], // 40 Series specific per PDF
    price: 195,
    code: '5ARG891029',
    requiresSize: true,
  },
  {
    id: 'acc-vcm-150-450',
    category: 'cable_management',
    name: 'Vertical Cable Manager 150W x 450D',
    description: 'OPEN DATA 45U Vertical cable manager, 150mm wide x 450mm deep. Full height duct with perforated front.',
    applicableSeries: ['25', '40'], // 40 Series specific per PDF
    price: 245,
    code: '5ARG891015',
    requiresSize: true,
  },
  {
    id: 'acc-vcm-300-250',
    category: 'cable_management',
    name: 'Vertical Cable Manager 300W x 250D',
    description: 'OPEN DATA 45U Vertical cable manager, 300mm wide x 250mm deep. Full height duct with perforated front.',
    applicableSeries: ['25', '40'], // 40 Series specific per PDF
    price: 295,
    code: '5ARG891007',
    requiresSize: true,
  },
  {
    id: 'acc-vcm-300-450',
    category: 'cable_management',
    name: 'Vertical Cable Manager 300W x 450D',
    description: 'OPEN DATA 45U Vertical cable manager, 300mm wide x 450mm deep. Full height duct with perforated front.',
    applicableSeries: ['25', '40'], // 40 Series specific per PDF
    price: 345,
    code: '5ARG891023',
    requiresSize: true,
  },
  {
    id: 'acc-vcm-400-250',
    category: 'cable_management',
    name: 'Vertical Cable Manager 400W x 250D',
    description: 'OPEN DATA 45U Vertical cable manager, 400mm wide x 250mm deep. Full height duct with perforated front.',
    applicableSeries: ['40'],
    price: 395,
    code: '5ARG891057',
    requiresSize: true,
  },
  {
    id: 'acc-vcm-400-450',
    category: 'cable_management',
    name: 'Vertical Cable Manager 400W x 450D',
    description: 'OPEN DATA 45U Vertical cable manager, 400mm wide x 450mm deep. Full height duct with perforated front.',
    applicableSeries: ['40'],
    price: 445,
    code: '5ARG891058',
    requiresSize: true,
  },
  {
    id: 'acc-cable-shield',
    category: 'cable_management',
    name: 'Cable Shield Assembly MK2',
    description: 'Horizontal cable shield/tray assembly for overhead cable routing.',
    applicableSeries: ['40'], // 40 Series specific per PDF
    price: 245,
    code: 'CSA',
  },
  {
    id: 'acc-chimney',
    category: 'cable_management',
    name: 'Cable Chimney',
    description: 'Top-mounted cable chimney for vertical cable egress. 300mm wide x 250mm deep.',
    applicableSeries: ['40'], // 40 Series specific per PDF
    price: 165,
    code: 'CCH',
  },
  {
    id: 'acc-slack-spool-195',
    category: 'cable_management',
    name: 'Slack Spool 195mm',
    description: 'Large cable slack management spool, 195mm diameter.',
    applicableSeries: ['40'], // 40 Series specific per PDF
    price: 45,
    code: 'SS195',
  },
  {
    id: 'acc-slack-spool-125',
    category: 'cable_management',
    name: 'Slack Spool 125mm',
    description: 'Small cable slack management spool, 125mm diameter.',
    applicableSeries: ['40'], // 40 Series specific per PDF
    price: 35,
    code: 'SS125',
  },
  {
    id: 'acc-bolt-down-bracket',
    category: 'infrastructure',
    name: 'Bolt Down Bracket',
    description: 'Cable manager bolt down bracket for floor mounting.',
    applicableSeries: ['40'], // 40 Series specific per PDF
    price: 55,
    code: 'BDB',
  },
  // ============================================================================
  // 50 SERIES SPECIFIC ACCESSORIES (Per PDF Specification)
  // ============================================================================
  {
    id: 'acc-cable-management-50',
    category: 'cable_management',
    name: 'Cable Management System',
    description: 'SCEC-compliant cable management for security racks. Internal routing with secure cable entry points.',
    applicableSeries: ['50'],
    price: 195,
    code: 'CM50',
  },
  // ============================================================================
  // INFRASTRUCTURE
  // ============================================================================
  {
    id: 'acc-castors',
    category: 'infrastructure',
    name: 'Heavy-Duty Castors (Set of 4)',
    description: 'Heavy-duty lockable castors. 500kg rated per castor.',
    applicableSeries: ['10', '25', '40'], // Removed from 50 Series per PDF
    price: 185,
    code: 'HDC',
  },
  {
    id: 'acc-baying-kit',
    category: 'infrastructure',
    name: 'Baying Kit',
    description: 'Kit to join multiple racks together.',
    applicableSeries: ['10', '25'], // Removed from 50 Series per PDF
    price: 95,
    code: 'BK',
  },
  {
    id: 'acc-stabiliser',
    category: 'infrastructure',
    name: 'Stabiliser Kit',
    description: 'Floor anchoring stabiliser kit for seismic zones.',
    applicableSeries: ['10', '25'], // Removed from 50 Series per PDF
    price: 145,
    code: 'STK',
  },
  // 50 Series Infrastructure (per PDF)
  {
    id: 'acc-plinth-50',
    category: 'infrastructure',
    name: 'Plinth with Levelling Feet',
    description: 'Secure plinth base with adjustable levelling feet for 50 Series security racks.',
    applicableSeries: ['50'],
    price: 245,
    code: 'PLF50',
  },
  // Top Panel Options (NOT for 50 Series - top panels included as standard)
  {
    id: 'acc-top-blanking',
    category: 'infrastructure',
    name: 'Blanking/Gland Top Panel',
    description: 'Solid top panel with gland plate for cable entry.',
    applicableSeries: ['10', '25'],
    price: 65,
    code: 'TBG',
  },
  {
    id: 'acc-top-vented',
    category: 'infrastructure',
    name: 'Vented Top Panel',
    description: 'Vented top panel for heat exhaust.',
    applicableSeries: ['10', '25'],
    price: 75,
    code: 'TVP',
  },
  {
    id: 'acc-top-brush',
    category: 'infrastructure',
    name: 'Brush Entry Top Panel',
    description: 'Top panel with brush strip cable entry.',
    applicableSeries: ['10', '25'],
    price: 85,
    code: 'TBE',
  },
  // ============================================================================
  // COOLING (50 Series specific per PDF)
  // ============================================================================
  {
    id: 'acc-fan-tray-2',
    category: 'cooling',
    name: 'Fan Tray (2 Fan)',
    description: 'Roof-mounted fan tray with 2 fans. Thermostat controlled.',
    applicableSeries: ['10', '25'],
    price: 245,
    code: 'FT2',
  },
  {
    id: 'acc-fan-tray-4',
    category: 'cooling',
    name: 'Fan Tray (4 Fan)',
    description: 'Roof-mounted fan tray with 4 fans. Thermostat controlled.',
    applicableSeries: ['25'],
    price: 385,
    code: 'FT4',
  },
  // 50 Series Fan Tops (per PDF specification)
  {
    id: 'acc-fan-top-50',
    category: 'cooling',
    name: 'Fan Top (Thermostatic Control)',
    description: 'SCEC-compliant fan top unit with thermostatic control options. Designed for security rack thermal management.',
    applicableSeries: ['50'],
    price: 395,
    code: 'FT50',
  },
  {
    id: 'acc-directional-fan-tray-50',
    category: 'cooling',
    name: 'Directional Fan Tray',
    description: 'Directional fan tray for hot spot mitigation. Used at specific locations within the rack for targeted cooling.',
    applicableSeries: ['50'],
    price: 285,
    code: 'DFT50',
  },
  // 50 Series Air Containment (per PDF specification)
  {
    id: 'acc-air-containment-cold-50',
    category: 'cooling',
    name: 'Air Containment System - Cold Aisle',
    description: 'Cold aisle containment system for SCEC security racks. Optimises cooling efficiency in data centre environments.',
    applicableSeries: ['50'],
    price: 850,
    code: 'ACC50',
  },
  {
    id: 'acc-air-containment-hot-50',
    category: 'cooling',
    name: 'Air Containment System - Hot Aisle',
    description: 'Hot aisle containment system for SCEC security racks. Directs exhaust air for efficient cooling.',
    applicableSeries: ['50'],
    price: 850,
    code: 'ACH50',
  },
  // ============================================================================
  // MOUNTING / SHELVING
  // ============================================================================
  {
    id: 'acc-shelf-fixed',
    category: 'mounting',
    name: 'Fixed Shelf',
    description: 'Fixed cantilever shelf. 50kg capacity.',
    applicableSeries: ['10', '25', '40', '50', 'v50'], // Shelving allowed per PDF
    price: 65,
    code: 'FSH',
  },
  {
    id: 'acc-shelf-sliding',
    category: 'mounting',
    name: 'Sliding Shelf',
    description: 'Sliding keyboard/equipment shelf. Ball bearing slides.',
    applicableSeries: ['10', '25', '40', '50', 'v50'], // Shelving allowed per PDF
    price: 125,
    code: 'SSH',
  },
  {
    id: 'acc-blanking-panel-1u',
    category: 'mounting',
    name: 'Blanking Panel 1RU',
    description: 'Steel blanking panel, 1RU.',
    applicableSeries: ['10', '25', '40', 'v50'], // Generic, not 50 Series
    price: 15,
    code: 'BP1',
  },
  {
    id: 'acc-blanking-panel-2u',
    category: 'mounting',
    name: 'Blanking Panel 2RU',
    description: 'Steel blanking panel, 2RU.',
    applicableSeries: ['10', '25', '40', 'v50'], // Generic, not 50 Series
    price: 20,
    code: 'BP2',
  },
  // ============================================================================
  // POWER (PDUs for 50 Series per PDF)
  // ============================================================================
  {
    id: 'acc-pdu-6',
    category: 'power',
    name: 'PDU 6-Way (Horizontal)',
    description: '6-way horizontal power distribution unit. 10A single phase.',
    applicableSeries: ['10', '25', '40', 'v50'], // Generic PDU
    price: 95,
    code: 'PDU6H',
  },
  {
    id: 'acc-pdu-10-v',
    category: 'power',
    name: 'PDU 10-Way (Vertical)',
    description: '10-way vertical power distribution unit. 10A single phase.',
    applicableSeries: ['10', '25', '40', 'v50'], // Generic PDU
    price: 145,
    code: 'PDU10V',
  },
  {
    id: 'acc-pdu-20-v',
    category: 'power',
    name: 'PDU 20-Way (Vertical)',
    description: '20-way vertical power distribution unit. 15A single phase.',
    applicableSeries: ['25'], // Commercial only
    price: 295,
    code: 'PDU20V',
  },
  // 50 Series PDUs (per PDF - single and three phase)
  {
    id: 'acc-pdu-single-phase-50',
    category: 'power',
    name: 'PDU Single Phase (Tool-less)',
    description: 'Single phase power distribution unit with tool-less technology. Designed for SCEC security racks.',
    applicableSeries: ['50'],
    price: 345,
    code: 'PDU1P50',
  },
  {
    id: 'acc-pdu-three-phase-50',
    category: 'power',
    name: 'PDU Three Phase (Tool-less)',
    description: 'Three phase power distribution unit with tool-less technology. High-density power for security rack deployments.',
    applicableSeries: ['50'],
    price: 695,
    code: 'PDU3P50',
  },
  // ============================================================================
  // SECURITY (50 Series specific per PDF)
  // ============================================================================
  {
    id: 'acc-data-security-cage',
    category: 'security',
    name: 'Data Security Cage',
    description: 'Basic internal enclosure for data security. For fully configurable in-rack security, use the V50 Data Vault instead.',
    applicableSeries: ['50'],
    price: 1250,
    code: 'DSC50',
  },
  // ============================================================================
  // V50 DATA VAULT SPECIFIC ACCESSORIES
  // ============================================================================
  {
    id: 'acc-v50-cable-entry-front',
    category: 'cable',
    name: 'Secure Cable Entry Panel - Front',
    description: 'Secure cable entry panel for front of Data Vault. Maintains security while allowing cable pass-through.',
    applicableSeries: ['v50'],
    price: 45,
    code: 'V50CEF',
    position: 'front',
  },
  {
    id: 'acc-v50-cable-entry-rear',
    category: 'cable',
    name: 'Secure Cable Entry Panel - Rear',
    description: 'Secure cable entry panel for rear of Data Vault. Allows cable egress while maintaining enclosure security.',
    applicableSeries: ['v50'],
    price: 45,
    code: 'V50CER',
    position: 'rear',
  },
  {
    id: 'acc-v50-ventilation-panel',
    category: 'cooling',
    name: 'Additional Ventilation Panel',
    description: 'Extra ventilation panel for enhanced airflow. Integrated design maintains security.',
    applicableSeries: ['v50'],
    price: 35,
    code: 'V50VP',
  },
  {
    id: 'acc-v50-mounting-kit',
    category: 'mounting',
    name: 'Rack Mounting Kit',
    description: 'Quick-release mounting kit for installing Data Vault in standard 19-inch racks. Tool-less installation.',
    applicableSeries: ['v50'],
    price: 0, // Included standard
    code: 'V50MK',
    includedStandard: true,
  },
  {
    id: 'acc-v50-keying-alike',
    category: 'security',
    name: 'Keyed Alike Option',
    description: 'Multiple Data Vaults keyed to the same key for easier management. Specify at time of order.',
    applicableSeries: ['v50'],
    price: 0, // No charge, but requires specification
    code: 'V50KA',
    requiresConsult: true,
  },
  {
    id: 'acc-v50-master-key',
    category: 'security',
    name: 'Master Key System',
    description: 'Master key override for facility management. Individual keys for tenants with master override.',
    applicableSeries: ['v50'],
    price: 75,
    code: 'V50MKS',
    requiresConsult: true,
  },
];

// ============================================================================
// COMMERCIAL RULES
// ============================================================================

export type CommercialAction = 'buy_online' | 'quote_required' | 'consult_required';

export interface CommercialRule {
  id: string;
  description: string;
  conditions: {
    series?: ArgentSeriesKey[];
    securityClass?: SecurityGrade[];
    isCustomSize?: boolean;
    accessoryThreshold?: number; // Number of accessories
  };
  action: CommercialAction;
  message?: string; // User-facing message
}

export const COMMERCIAL_RULES: CommercialRule[] = [
  {
    id: 'rule-security-class-c',
    description: 'Class C security configurations always require consultation',
    conditions: {
      securityClass: ['class_c'],
    },
    action: 'consult_required',
    message: 'SCEC Class C configurations require confirmation. Our team will contact you to verify requirements.',
  },
  {
    id: 'rule-security-class-b',
    description: 'Class B security configurations require a quote',
    conditions: {
      securityClass: ['class_b'],
    },
    action: 'quote_required',
    message: 'Security-rated configurations are quote-only. Pricing shown is indicative.',
  },
  {
    id: 'rule-50-series',
    description: 'All 50 Series configurations require consultation by default',
    conditions: {
      series: ['50'],
    },
    action: 'quote_required',
    message: 'This configuration may require confirmation for compliance verification.',
  },
  {
    id: 'rule-custom-size',
    description: 'Custom sizes require consultation',
    conditions: {
      isCustomSize: true,
    },
    action: 'consult_required',
    message: 'Custom dimensions require consultation. Please submit an enquiry.',
  },
  {
    id: 'rule-heavy-accessories',
    description: 'Configurations with many accessories should be quoted',
    conditions: {
      accessoryThreshold: 10,
    },
    action: 'quote_required',
    message: 'Complex configurations with multiple accessories are best handled via quote.',
  },
  {
    id: 'rule-standard-commercial',
    description: 'Standard commercial configurations can be purchased online',
    conditions: {
      series: ['10', '25', '40', 'v50'],
      securityClass: ['commercial', null],
    },
    action: 'buy_online',
  },
];

// ============================================================================
// VALIDATION RULES
// ============================================================================

export interface CompatibilityRule {
  id: string;
  type: 'requires' | 'forbid' | 'suggests';
  description: string;
  condition: {
    option?: string;
    value?: any;
    series?: ArgentSeriesKey;
    securityClass?: SecurityGrade;
  };
  target: {
    option?: string;
    values?: any[];
  };
  message: string;
}

export const COMPATIBILITY_RULES: CompatibilityRule[] = [
  {
    id: 'rule-class-c-requires-solid-panels',
    type: 'requires',
    description: 'Class C security requires solid lockable side panels',
    condition: { securityClass: 'class_c' },
    target: { option: 'side_panel', values: ['panel-solid-lockable'] },
    message: 'SCEC Class C requires solid lockable side panels.',
  },
  {
    id: 'rule-class-c-requires-bilock',
    type: 'requires',
    description: 'Class C security requires C Class L-Handled Bilock',
    condition: { securityClass: 'class_c' },
    target: { option: 'lock', values: ['lock-bilock-class-c'] },
    message: 'SCEC Class C requires a Class C approved L-Handled Bilock (keyed alike).',
  },
  {
    id: 'rule-class-b-requires-kaba-x10',
    type: 'requires',
    description: 'Class B security requires KABA X10 digital combination lock',
    condition: { securityClass: 'class_b' },
    target: { option: 'lock', values: ['lock-kaba-x10-class-b'] },
    message: 'SCEC Class B requires a KABA X10 digital combination lock.',
  },
  {
    id: 'rule-open-frame-no-security',
    type: 'forbid',
    description: 'Open frame racks cannot have security classification',
    condition: { series: '40' },
    target: { option: 'security_class', values: ['class_b', 'class_c'] },
    message: 'Open frame racks are not suitable for security classification.',
  },
  {
    id: 'rule-v50-19inch-only',
    type: 'requires',
    description: 'V50 Data Vault requires 19-inch compatible racks',
    condition: { series: 'v50' },
    target: { option: 'rack_type', values: ['19inch'] },
    message: 'V50 Data Vault is designed for standard 19-inch racks only.',
  },
  {
    id: 'rule-polycarbonate-no-class-c',
    type: 'forbid',
    description: 'Polycarbonate doors not allowed for Class C',
    condition: { option: 'door', value: 'door-polycarbonate' },
    target: { option: 'security_class', values: ['class_c'] },
    message: 'Polycarbonate doors are not permitted for Class C security.',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get series definition by key
 */
export function getSeriesByKey(key: ArgentSeriesKey): ArgentSeries | undefined {
  return ARGENT_SERIES.find(s => s.key === key);
}

/**
 * Get dimension matrix for a series
 */
export function getDimensionsForSeries(seriesKey: ArgentSeriesKey): DimensionMatrix[] {
  return ALL_ARGENT_DIMENSIONS.filter(d => d.seriesKey === seriesKey);
}

/**
 * Get available RU heights for a series
 */
export function getAvailableRuHeights(seriesKey: ArgentSeriesKey): number[] {
  const dims = getDimensionsForSeries(seriesKey);
  return [...new Set(dims.map(d => d.ruHeight))].sort((a, b) => a - b);
}

/**
 * Get available widths for a series and RU height
 */
export function getAvailableWidths(seriesKey: ArgentSeriesKey, ruHeight?: number): number[] {
  let dims = getDimensionsForSeries(seriesKey);
  if (ruHeight) {
    dims = dims.filter(d => d.ruHeight === ruHeight);
  }
  return [...new Set(dims.map(d => d.widthMm).filter(w => w > 0))].sort((a, b) => a - b);
}

/**
 * Get available depths for a series, RU height, and width
 */
export function getAvailableDepths(seriesKey: ArgentSeriesKey, ruHeight?: number, widthMm?: number): number[] {
  let dims = getDimensionsForSeries(seriesKey);
  if (ruHeight) dims = dims.filter(d => d.ruHeight === ruHeight);
  if (widthMm) dims = dims.filter(d => d.widthMm === widthMm);
  return [...new Set(dims.map(d => d.depthMm).filter(d => d > 0))].sort((a, b) => a - b);
}

/**
 * Find dimension configuration
 */
export function findDimensionConfig(
  seriesKey: ArgentSeriesKey,
  ruHeight: number,
  widthMm: number,
  depthMm: number
): DimensionMatrix | undefined {
  return ALL_ARGENT_DIMENSIONS.find(
    d => d.seriesKey === seriesKey && 
         d.ruHeight === ruHeight && 
         d.widthMm === widthMm && 
         d.depthMm === depthMm
  );
}

/**
 * Get door options for a series
 */
export function getDoorOptionsForSeries(seriesKey: ArgentSeriesKey): DoorOption[] {
  return DOOR_OPTIONS.filter(d => d.applicableSeries.includes(seriesKey));
}

/**
 * Get lock options for a series
 */
export function getLockOptionsForSeries(seriesKey: ArgentSeriesKey): LockOption[] {
  return LOCK_OPTIONS.filter(l => l.applicableSeries.includes(seriesKey));
}

/**
 * Get accessories for a series
 */
export function getAccessoriesForSeries(seriesKey: ArgentSeriesKey): ArgentAccessory[] {
  return ARGENT_ACCESSORIES.filter(
    a => a.applicableSeries === 'all' || a.applicableSeries.includes(seriesKey)
  );
}

/**
 * Evaluate commercial rules for a configuration
 */
export function evaluateCommercialRules(config: {
  seriesKey: ArgentSeriesKey;
  securityClass?: SecurityGrade;
  isCustomSize?: boolean;
  accessoryCount?: number;
}): { action: CommercialAction; message?: string } {
  // Check rules in priority order (most restrictive first)
  for (const rule of COMMERCIAL_RULES) {
    let matches = true;
    
    if (rule.conditions.series && !rule.conditions.series.includes(config.seriesKey)) {
      matches = false;
    }
    if (rule.conditions.securityClass && config.securityClass && 
        !rule.conditions.securityClass.includes(config.securityClass)) {
      matches = false;
    }
    if (rule.conditions.isCustomSize !== undefined && 
        rule.conditions.isCustomSize !== config.isCustomSize) {
      matches = false;
    }
    if (rule.conditions.accessoryThreshold !== undefined &&
        (config.accessoryCount || 0) < rule.conditions.accessoryThreshold) {
      matches = false;
    }
    
    if (matches && rule.action !== 'buy_online') {
      return { action: rule.action, message: rule.message };
    }
  }
  
  return { action: 'buy_online' };
}

/**
 * Generate Argent part code
 */
export function generateArgentCode(
  seriesKey: ArgentSeriesKey,
  ruHeight: number,
  widthMm: number,
  depthMm: number,
  securityClass?: SecurityGrade,
  doorCode?: string,
  lockCode?: string
): string {
  const parts = ['5ARG'];
  
  // Series
  parts.push(seriesKey.toUpperCase());
  
  // Security class for 50 series
  if (seriesKey === '50' && securityClass) {
    parts.push(securityClass === 'class_c' ? 'C' : 'B');
  }
  
  // Dimensions
  parts.push(String(ruHeight));
  if (widthMm > 0) parts.push(String(widthMm));
  if (depthMm > 0) parts.push(String(depthMm));
  
  // Options
  if (doorCode) parts.push(doorCode);
  if (lockCode) parts.push(lockCode);
  
  return parts.join('.');
}
