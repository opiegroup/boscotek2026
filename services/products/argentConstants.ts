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
    description: 'SCEC-approved Security Class B and Class C server racks for defence and government applications.',
    securityGrade: 'class_b', // Default, can be upgraded to class_c
    requiresConsultDefault: true,
    isActive: true,
    features: [
      'SCEC Class B or Class C compliant',
      'High-security locking systems',
      'Reinforced construction',
      'Tamper-evident seals',
      'Restricted key systems',
      'Government-approved design',
      'Audit trail capability',
      'Secure cable entry',
    ],
    useCase: 'Defence, government agencies, classified data storage',
  },
  {
    key: 'v50',
    name: 'V50 Data Vault',
    shortName: 'Data Vault',
    type: 'in_rack_security',
    description: 'Patented in-rack security enclosure. Adds secure compartments within standard 19-inch racks.',
    securityGrade: 'commercial',
    requiresConsultDefault: false,
    isActive: true,
    features: [
      'Fits inside 19-inch racks',
      'Available in 2RU, 4RU, 6RU',
      'Lockable steel construction',
      'Quick-release mounting',
      'Ventilated design',
      'Key or combination lock options',
      'Standalone or add-on use',
      'Patent-protected design',
    ],
    useCase: 'In-rack security, co-location protection, sensitive equipment isolation',
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

export interface DimensionMatrix {
  seriesKey: ArgentSeriesKey;
  ruHeight: number;
  widthMm: number;
  depthMm: number;
  isStandard: boolean;
  isCustomAllowed: boolean;
  partCode: string;
  basePrice: number;
}

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

// 50 Series - Security racks (SCEC Class B and C)
export const SERIES_50_DIMENSIONS: DimensionMatrix[] = [
  // Class B configurations
  { seriesKey: '50', ruHeight: 22, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.B.22.600.800', basePrice: 4850 },
  { seriesKey: '50', ruHeight: 22, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.B.22.600.1000', basePrice: 5050 },
  { seriesKey: '50', ruHeight: 27, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.B.27.600.800', basePrice: 5250 },
  { seriesKey: '50', ruHeight: 27, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.B.27.600.1000', basePrice: 5450 },
  { seriesKey: '50', ruHeight: 32, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.B.32.600.1000', basePrice: 5850 },
  { seriesKey: '50', ruHeight: 37, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.B.37.600.1000', basePrice: 6250 },
  { seriesKey: '50', ruHeight: 42, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.B.42.600.1000', basePrice: 6650 },
  { seriesKey: '50', ruHeight: 42, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.B.42.800.1000', basePrice: 7050 },
  // Class C configurations (higher security)
  { seriesKey: '50', ruHeight: 22, widthMm: 600, depthMm: 800, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.C.22.600.800', basePrice: 6850 },
  { seriesKey: '50', ruHeight: 22, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.C.22.600.1000', basePrice: 7050 },
  { seriesKey: '50', ruHeight: 27, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.C.27.600.1000', basePrice: 7450 },
  { seriesKey: '50', ruHeight: 32, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.C.32.600.1000', basePrice: 7850 },
  { seriesKey: '50', ruHeight: 37, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.C.37.600.1000', basePrice: 8250 },
  { seriesKey: '50', ruHeight: 42, widthMm: 600, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.C.42.600.1000', basePrice: 8650 },
  { seriesKey: '50', ruHeight: 42, widthMm: 800, depthMm: 1000, isStandard: true, isCustomAllowed: false, partCode: '5ARG.50.C.42.800.1000', basePrice: 9050 },
];

// V50 Data Vault - In-rack security enclosures
export const SERIES_V50_DIMENSIONS: DimensionMatrix[] = [
  { seriesKey: 'v50', ruHeight: 2, widthMm: 482, depthMm: 400, isStandard: true, isCustomAllowed: false, partCode: '5ARG.V50.2', basePrice: 650 },
  { seriesKey: 'v50', ruHeight: 4, widthMm: 482, depthMm: 400, isStandard: true, isCustomAllowed: false, partCode: '5ARG.V50.4', basePrice: 850 },
  { seriesKey: 'v50', ruHeight: 6, widthMm: 482, depthMm: 400, isStandard: true, isCustomAllowed: false, partCode: '5ARG.V50.6', basePrice: 1050 },
];

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
  {
    id: 'door-perf-steel',
    type: 'perforated',
    label: 'Perforated Steel Door',
    description: '70% perforated steel for optimal airflow. Left or right hand hinged, single point lock.',
    applicableSeries: ['10', '25', '50'],
    priceDelta: 0, // Standard option
    code: 'PD',
    securityCompatible: true,
  },
  {
    id: 'door-solid-steel',
    type: 'solid',
    label: 'Solid Steel Door',
    description: 'Solid steel construction for maximum security. Single point lock included.',
    applicableSeries: ['25', '50'],
    priceDelta: 150,
    code: 'SD',
    securityCompatible: true,
  },
  {
    id: 'door-polycarbonate',
    type: 'polycarbonate',
    label: 'Polycarbonate Window Door',
    description: 'Steel frame with polycarbonate window for equipment visibility.',
    applicableSeries: ['25', '50'],
    priceDelta: 250,
    code: 'WD',
    securityCompatible: false, // Not for Class C
  },
  {
    id: 'door-split',
    type: 'split',
    label: 'Split Hinged Doors',
    description: 'Two-section doors for tight aisle access. Ideal for data centres.',
    applicableSeries: ['25', '50'],
    priceDelta: 350,
    code: 'SPD',
    securityCompatible: true,
  },
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
}

export const SIDE_PANEL_OPTIONS: SidePanelOption[] = [
  {
    id: 'panel-solid-lockable',
    type: 'lockable',
    label: 'Solid Lockable Side Panels',
    description: 'Removable lockable steel side panels (pair).',
    applicableSeries: ['10', '25', '50'],
    priceDelta: 0, // Standard for enclosures
    code: 'SLP',
    securityRequired: true,
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
  // Class B locks
  {
    id: 'lock-combo-class-b',
    type: 'combination',
    security: 'class_b',
    label: 'SCEC Class B Combination Lock',
    description: 'SCEC-approved Class B combination lock. Required for Class B racks.',
    applicableSeries: ['50'],
    priceDelta: 450,
    code: 'BCL',
    requiresConsult: true,
  },
  // Class C locks
  {
    id: 'lock-key-class-c',
    type: 'key',
    security: 'class_c',
    label: 'SCEC Class C Keyed Lock',
    description: 'SCEC-approved Class C restricted key lock. Required for Class C racks.',
    applicableSeries: ['50'],
    priceDelta: 650,
    code: 'CKL',
    requiresConsult: true,
  },
  // Advanced locks
  {
    id: 'lock-digital',
    type: 'digital',
    security: 'standard',
    label: 'Digital Keypad Lock',
    description: 'Electronic keypad with audit trail. Battery backup included.',
    applicableSeries: ['25', '50'],
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
  requiresSize?: boolean; // Needs to match rack dimensions
}

export const ARGENT_ACCESSORIES: ArgentAccessory[] = [
  // Cable Management
  {
    id: 'acc-cable-ladder',
    category: 'cable_management',
    name: 'Cable Ladder',
    description: 'Provides a structured overhead pathway for routing large cable bundles from front to rear or between racks. Mounted at the top rear or internally and aligned with vertical cable paths. Textura Black powder coat to match rack frame and internal components.',
    applicableSeries: ['10', '25', '40', '50'],
    price: 185,
    code: 'CL',
  },
  {
    id: 'acc-finger-manager',
    category: 'cable_management',
    name: 'Finger Manager (Horizontal)',
    description: 'Horizontal cable management fingers. 1RU.',
    applicableSeries: ['10', '25', '50'],
    price: 45,
    code: 'FM',
  },
  {
    id: 'acc-vcm-150-250',
    category: 'cable_management',
    name: 'Vertical Cable Manager 150W x 250D',
    description: 'OPEN DATA 45U Vertical cable manager, 150mm wide x 250mm deep. Full height duct with perforated front.',
    applicableSeries: ['25', '40', '50'],
    price: 195,
    code: '5ARG891029',
    requiresSize: true,
  },
  {
    id: 'acc-vcm-150-450',
    category: 'cable_management',
    name: 'Vertical Cable Manager 150W x 450D',
    description: 'OPEN DATA 45U Vertical cable manager, 150mm wide x 450mm deep. Full height duct with perforated front.',
    applicableSeries: ['25', '40', '50'],
    price: 245,
    code: '5ARG891015',
    requiresSize: true,
  },
  {
    id: 'acc-vcm-300-250',
    category: 'cable_management',
    name: 'Vertical Cable Manager 300W x 250D',
    description: 'OPEN DATA 45U Vertical cable manager, 300mm wide x 250mm deep. Full height duct with perforated front.',
    applicableSeries: ['25', '40', '50'],
    price: 295,
    code: '5ARG891007',
    requiresSize: true,
  },
  {
    id: 'acc-vcm-300-450',
    category: 'cable_management',
    name: 'Vertical Cable Manager 300W x 450D',
    description: 'OPEN DATA 45U Vertical cable manager, 300mm wide x 450mm deep. Full height duct with perforated front.',
    applicableSeries: ['25', '40', '50'],
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
    applicableSeries: ['40'],
    price: 245,
    code: 'CSA',
  },
  {
    id: 'acc-chimney',
    category: 'cable_management',
    name: 'Cable Chimney',
    description: 'Top-mounted cable chimney for vertical cable egress. 300mm wide x 250mm deep.',
    applicableSeries: ['40'],
    price: 165,
    code: 'CCH',
  },
  {
    id: 'acc-slack-spool-195',
    category: 'cable_management',
    name: 'Slack Spool 195mm',
    description: 'Large cable slack management spool, 195mm diameter.',
    applicableSeries: ['40'],
    price: 45,
    code: 'SS195',
  },
  {
    id: 'acc-slack-spool-125',
    category: 'cable_management',
    name: 'Slack Spool 125mm',
    description: 'Small cable slack management spool, 125mm diameter.',
    applicableSeries: ['40'],
    price: 35,
    code: 'SS125',
  },
  {
    id: 'acc-bolt-down-bracket',
    category: 'infrastructure',
    name: 'Bolt Down Bracket',
    description: 'Cable manager bolt down bracket for floor mounting.',
    applicableSeries: ['40'],
    price: 55,
    code: 'BDB',
  },
  // Infrastructure
  {
    id: 'acc-castors',
    category: 'infrastructure',
    name: 'Heavy-Duty Castors (Set of 4)',
    description: 'Heavy-duty lockable castors. 500kg rated per castor.',
    applicableSeries: ['10', '25', '40', '50'],
    price: 185,
    code: 'HDC',
  },
  {
    id: 'acc-baying-kit',
    category: 'infrastructure',
    name: 'Baying Kit',
    description: 'Kit to join multiple racks together.',
    applicableSeries: ['10', '25', '50'],
    price: 95,
    code: 'BK',
  },
  {
    id: 'acc-stabiliser',
    category: 'infrastructure',
    name: 'Stabiliser Kit',
    description: 'Floor anchoring stabiliser kit for seismic zones.',
    applicableSeries: ['10', '25', '50'],
    price: 145,
    code: 'STK',
  },
  // Top Panel Options
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
  // Cooling
  {
    id: 'acc-fan-tray-2',
    category: 'cooling',
    name: 'Fan Tray (2 Fan)',
    description: 'Roof-mounted fan tray with 2 fans. Thermostat controlled.',
    applicableSeries: ['10', '25', '50'],
    price: 245,
    code: 'FT2',
  },
  {
    id: 'acc-fan-tray-4',
    category: 'cooling',
    name: 'Fan Tray (4 Fan)',
    description: 'Roof-mounted fan tray with 4 fans. Thermostat controlled.',
    applicableSeries: ['25', '50'],
    price: 385,
    code: 'FT4',
  },
  // Mounting
  {
    id: 'acc-shelf-fixed',
    category: 'mounting',
    name: 'Fixed Shelf',
    description: 'Fixed cantilever shelf. 50kg capacity.',
    applicableSeries: 'all',
    price: 65,
    code: 'FSH',
  },
  {
    id: 'acc-shelf-sliding',
    category: 'mounting',
    name: 'Sliding Shelf',
    description: 'Sliding keyboard/equipment shelf. Ball bearing slides.',
    applicableSeries: 'all',
    price: 125,
    code: 'SSH',
  },
  {
    id: 'acc-blanking-panel-1u',
    category: 'mounting',
    name: 'Blanking Panel 1RU',
    description: 'Steel blanking panel, 1RU.',
    applicableSeries: 'all',
    price: 15,
    code: 'BP1',
  },
  {
    id: 'acc-blanking-panel-2u',
    category: 'mounting',
    name: 'Blanking Panel 2RU',
    description: 'Steel blanking panel, 2RU.',
    applicableSeries: 'all',
    price: 20,
    code: 'BP2',
  },
  // Power
  {
    id: 'acc-pdu-6',
    category: 'power',
    name: 'PDU 6-Way (Horizontal)',
    description: '6-way horizontal power distribution unit. 10A.',
    applicableSeries: 'all',
    price: 95,
    code: 'PDU6H',
  },
  {
    id: 'acc-pdu-10-v',
    category: 'power',
    name: 'PDU 10-Way (Vertical)',
    description: '10-way vertical power distribution unit. 10A.',
    applicableSeries: 'all',
    price: 145,
    code: 'PDU10V',
  },
  {
    id: 'acc-pdu-20-v',
    category: 'power',
    name: 'PDU 20-Way (Vertical)',
    description: '20-way vertical power distribution unit. 15A.',
    applicableSeries: ['25', '50'],
    price: 295,
    code: 'PDU20V',
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
    id: 'rule-class-c-requires-keyed-lock',
    type: 'requires',
    description: 'Class C security requires Class C keyed lock',
    condition: { securityClass: 'class_c' },
    target: { option: 'lock', values: ['lock-key-class-c'] },
    message: 'SCEC Class C requires a Class C approved keyed lock.',
  },
  {
    id: 'rule-class-b-requires-combo-lock',
    type: 'requires',
    description: 'Class B security requires combination lock',
    condition: { securityClass: 'class_b' },
    target: { option: 'lock', values: ['lock-combo-class-b'] },
    message: 'SCEC Class B requires a Class B approved combination lock.',
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
