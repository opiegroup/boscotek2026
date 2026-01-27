/**
 * Argent Commercial Data Cage - Component Definitions
 * 
 * Plan-based modular enclosure system for data centre environments.
 * Configured as posts + panels + doors, not a single SKU.
 * 
 * Reference: Argent_Data Cages.pdf
 */

// ============================================================================
// DIMENSIONAL CONSTANTS
// ============================================================================

/** Standard panel widths in mm */
export const PANEL_WIDTHS = {
  STANDARD: 900,
  FILLER: 250,
} as const;

/** Standard panel heights in mm */
export const PANEL_HEIGHTS = {
  BOTTOM: 2300,
  UPPER: 1200,
  INFILL_DEFAULT: 330, // Varies based on ceiling height
} as const;

/** Post dimensions */
export const POST_DIMENSIONS = {
  WIDTH: 50,  // 50×50 RHS
  DEPTH: 50,
  MAX_HEIGHT: 3500,
} as const;

/** Door dimensions */
export const DOOR_DIMENSIONS = {
  OPENING_HEIGHT: 2260,
  OPENING_WIDTH: 1200,
  FRAME_WIDTH: 1300, // Total width including frame
  LINTEL_WIDTH: 1140,
} as const;

/** Height calculation constants */
export const HEIGHT_CALCULATION = {
  STANDARD_STACK: 3500, // Bottom (2300) + Upper (1200)
  MIN_CEILING: 2500,    // Minimum practical ceiling height
  MAX_CEILING: 4000,    // Maximum practical ceiling height
  DEFAULT_CEILING: 3500,
} as const;

// ============================================================================
// POST DEFINITIONS
// ============================================================================

export type PostType = 'corner' | 'repeat';

export interface PostDefinition {
  id: string;
  type: PostType;
  code: string;
  name: string;
  description: string;
  heightMm: number;
  widthMm: number;
  depthMm: number;
  price: number;
}

export const POSTS: PostDefinition[] = [
  {
    id: 'post-corner',
    type: 'corner',
    code: '9TAT DCCP.3500',
    name: 'Corner Post',
    description: '50×50 RHS corner post, 3500mm',
    heightMm: 3500,
    widthMm: 50,
    depthMm: 50,
    price: 185,
  },
  {
    id: 'post-repeat',
    type: 'repeat',
    code: '9TAT DCRP.3500',
    name: 'Repeat Post',
    description: '50×50 RHS intermediate post, 3500mm',
    heightMm: 3500,
    widthMm: 50,
    depthMm: 50,
    price: 165,
  },
];

// ============================================================================
// SPIGOT DEFINITIONS (Post connectors)
// ============================================================================

export type SpigotType = 'standard' | 'medium' | 'corner' | 'large';

export interface SpigotDefinition {
  id: string;
  type: SpigotType;
  code: string;
  name: string;
  description: string;
  price: number;
}

export const SPIGOTS: SpigotDefinition[] = [
  {
    id: 'spigot-standard',
    type: 'standard',
    code: '9TAT DCSS.500',
    name: 'Standard Spigot',
    description: 'Standard spigot connector',
    price: 25,
  },
  {
    id: 'spigot-medium',
    type: 'medium',
    code: '9TAT DCMS.500',
    name: 'Medium Spigot',
    description: 'Medium spigot connector',
    price: 30,
  },
  {
    id: 'spigot-corner',
    type: 'corner',
    code: '9TAT DCCS.500',
    name: 'Corner Spigot',
    description: 'Corner spigot connector',
    price: 35,
  },
  {
    id: 'spigot-large',
    type: 'large',
    code: '9TAT DCLS.500',
    name: 'Large Spigot',
    description: 'Large spigot connector',
    price: 40,
  },
];

// ============================================================================
// PANEL DEFINITIONS
// ============================================================================

export type PanelPosition = 'bottom' | 'upper' | 'infill';
export type PanelWidthType = 'standard' | 'filler';

export interface PanelDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  position: PanelPosition;
  heightMm: number;
  widthMm: number;
  widthType: PanelWidthType;
  price: number;
  isInfill: boolean; // Infill panels have variable height
}

export const PANELS: PanelDefinition[] = [
  // Bottom panels (2300mm height)
  {
    id: 'panel-bottom-900',
    code: '9TAT DCP.2300.900',
    name: 'Bottom Panel 900',
    description: 'Bottom panel 2300h × 900w',
    position: 'bottom',
    heightMm: 2300,
    widthMm: 900,
    widthType: 'standard',
    price: 320,
    isInfill: false,
  },
  {
    id: 'panel-bottom-250',
    code: '9TAT DCP.2300.250',
    name: 'Bottom Panel 250',
    description: 'Bottom panel 2300h × 250w',
    position: 'bottom',
    heightMm: 2300,
    widthMm: 250,
    widthType: 'filler',
    price: 145,
    isInfill: false,
  },
  // Upper panels (1200mm height)
  {
    id: 'panel-upper-900',
    code: '9TAT DCP.1200.900',
    name: 'Upper Panel 900',
    description: 'Upper panel 1200h × 900w',
    position: 'upper',
    heightMm: 1200,
    widthMm: 900,
    widthType: 'standard',
    price: 195,
    isInfill: false,
  },
  {
    id: 'panel-upper-250',
    code: '9TAT DCP.1200.250',
    name: 'Upper Panel 250',
    description: 'Upper panel 1200h × 250w',
    position: 'upper',
    heightMm: 1200,
    widthMm: 250,
    widthType: 'filler',
    price: 85,
    isInfill: false,
  },
  // Infill panels (variable height, typically ~330mm)
  {
    id: 'panel-infill-900',
    code: '9TAT DCP.330.900',
    name: 'Infill Panel 900',
    description: 'Infill panel (height varies) × 900w',
    position: 'infill',
    heightMm: 330, // Default, actual varies
    widthMm: 900,
    widthType: 'standard',
    price: 95,
    isInfill: true,
  },
  {
    id: 'panel-infill-250',
    code: '9TAT DCP.330.250',
    name: 'Infill Panel 250',
    description: 'Infill panel (height varies) × 250w',
    position: 'infill',
    heightMm: 330, // Default, actual varies
    widthMm: 250,
    widthType: 'filler',
    price: 45,
    isInfill: true,
  },
];

// ============================================================================
// DOOR DEFINITIONS
// ============================================================================

export type DoorType = 'sliding';

export interface DoorDefinition {
  id: string;
  type: DoorType;
  code: string;
  name: string;
  description: string;
  openingHeightMm: number;
  openingWidthMm: number;
  frameWidthMm: number;
  price: number;
}

export const DOORS: DoorDefinition[] = [
  {
    id: 'door-sliding',
    type: 'sliding',
    code: '9TAT DCSD.2270.1300',
    name: 'Sliding Door Assembly',
    description: 'Sliding door with 2260h × 1200w opening',
    openingHeightMm: 2260,
    openingWidthMm: 1200,
    frameWidthMm: 1300,
    price: 1450,
  },
];

// ============================================================================
// LINTEL PANEL DEFINITIONS (Above doors)
// ============================================================================

export interface LintelPanelDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  heightMm: number;
  widthMm: number;
  price: number;
  isInfill: boolean;
}

export const LINTEL_PANELS: LintelPanelDefinition[] = [
  {
    id: 'lintel-upper',
    code: '9TAT DCP.1200.1140',
    name: 'Lintel Upper Panel',
    description: 'Upper panel above door opening 1200h × 1140w',
    heightMm: 1200,
    widthMm: 1140,
    price: 185,
    isInfill: false,
  },
  {
    id: 'lintel-infill',
    code: '9TAT DCP.330.1200',
    name: 'Lintel Infill Panel',
    description: 'Infill panel above door (height varies) × 1200w',
    heightMm: 330, // Default, actual varies
    widthMm: 1200,
    price: 75,
    isInfill: true,
  },
];

// ============================================================================
// ROOF PANEL DEFINITIONS
// ============================================================================

export interface RoofPanelDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  widthMm: number;
  depthMm: number;
  price: number;
}

export const ROOF_PANELS: RoofPanelDefinition[] = [
  {
    id: 'roof-panel-900',
    code: '9TAT DCR.900.900',
    name: 'Roof Panel 900×900',
    description: 'Mesh roof panel 900mm × 900mm',
    widthMm: 900,
    depthMm: 900,
    price: 185,
  },
  {
    id: 'roof-panel-filler',
    code: '9TAT DCR.900.250',
    name: 'Roof Panel Filler',
    description: 'Mesh roof panel filler 900mm × 250mm',
    widthMm: 900,
    depthMm: 250,
    price: 95,
  },
];

// ============================================================================
// LOCK OPTIONS
// ============================================================================

export type CageLockType = 'keyed' | 'combination' | 'card_access';

export interface CageLockOption {
  id: string;
  type: CageLockType;
  name: string;
  description: string;
  price: number;
  code: string;
}

export const CAGE_LOCKS: CageLockOption[] = [
  {
    id: 'lock-keyed-standard',
    type: 'keyed',
    name: 'Standard Keyed Lock',
    description: 'Standard keyed lock for sliding door',
    price: 85,
    code: 'DCLOCK.KEY',
  },
  {
    id: 'lock-combination',
    type: 'combination',
    name: 'Combination Lock',
    description: 'Mechanical combination lock',
    price: 195,
    code: 'DCLOCK.COMBO',
  },
  {
    id: 'lock-card-access',
    type: 'card_access',
    name: 'Card Access Lock',
    description: 'Electronic card access system (quote required)',
    price: 0, // Quote-driven
    code: 'DCLOCK.CARD',
  },
];

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export type CageFace = 'front' | 'rear' | 'left' | 'right';

export interface CageDoorPlacement {
  face: CageFace;
  positionMm: number; // Distance from left/front corner
  doorId: string;
  lockId: string;
}

export interface CageConfiguration {
  // Dimensions
  lengthMm: number;  // X-axis (front-to-rear depth)
  widthMm: number;   // Z-axis (left-to-right width)
  ceilingHeightMm: number;
  
  // Doors
  doors: CageDoorPlacement[];
  
  // Calculated values (derived)
  infillHeightMm?: number;
  requiresInfill?: boolean;
  
  // Notes
  installationNotes?: string;
  siteConstraints?: string;
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate panel heights based on ceiling height
 * - Bottom panel: 2300mm (fixed)
 * - Upper panel: 1200mm standard, but adjusted if ceiling is lower than 3500mm
 * - Infill panel: Variable height for ceilings above 3500mm
 */
export function calculateInfillHeight(ceilingHeightMm: number): { 
  requiresInfill: boolean; 
  infillHeightMm: number;
  totalPanelHeight: number;
  bottomHeightMm: number;
  upperHeightMm: number;
} {
  const standardBottom = PANEL_HEIGHTS.BOTTOM; // 2300mm
  const standardUpper = PANEL_HEIGHTS.UPPER;   // 1200mm
  const standardStack = standardBottom + standardUpper; // 3500mm
  
  // Minimum ceiling height must accommodate bottom panels
  const minCeiling = standardBottom + 200; // 2500mm minimum
  const effectiveCeiling = Math.max(ceilingHeightMm, minCeiling);
  
  if (effectiveCeiling <= standardStack) {
    // Ceiling is below or equal to standard stack (3500mm)
    // Upper panel is reduced to fit ceiling
    const upperHeightMm = effectiveCeiling - standardBottom;
    return {
      requiresInfill: false,
      infillHeightMm: 0,
      totalPanelHeight: effectiveCeiling,
      bottomHeightMm: standardBottom,
      upperHeightMm: Math.max(upperHeightMm, 0),
    };
  }
  
  // Ceiling is above standard stack - need infill panels
  const infillHeightMm = effectiveCeiling - standardStack;
  
  return {
    requiresInfill: true,
    infillHeightMm,
    totalPanelHeight: effectiveCeiling,
    bottomHeightMm: standardBottom,
    upperHeightMm: standardUpper,
  };
}

/**
 * Calculate panel count for a given wall length
 * Snaps to valid module increments (900mm + 250mm fillers)
 */
export function calculatePanelLayout(wallLengthMm: number): {
  standardPanels: number;
  fillerPanels: number;
  actualLengthMm: number;
  isValid: boolean;
  errorMessage?: string;
} {
  const minLength = PANEL_WIDTHS.FILLER; // 250mm minimum
  
  if (wallLengthMm < minLength) {
    return {
      standardPanels: 0,
      fillerPanels: 0,
      actualLengthMm: 0,
      isValid: false,
      errorMessage: `Wall length must be at least ${minLength}mm`,
    };
  }
  
  // Calculate how many 900mm panels fit
  const standardPanels = Math.floor(wallLengthMm / PANEL_WIDTHS.STANDARD);
  const remainingLength = wallLengthMm - (standardPanels * PANEL_WIDTHS.STANDARD);
  
  // Calculate 250mm fillers needed for remainder
  const fillerPanels = Math.round(remainingLength / PANEL_WIDTHS.FILLER);
  
  // Actual achievable length
  const actualLengthMm = (standardPanels * PANEL_WIDTHS.STANDARD) + (fillerPanels * PANEL_WIDTHS.FILLER);
  
  return {
    standardPanels,
    fillerPanels,
    actualLengthMm,
    isValid: true,
  };
}

/**
 * Snap a dimension to the nearest valid panel module
 */
export function snapToModule(dimensionMm: number): number {
  const { actualLengthMm } = calculatePanelLayout(dimensionMm);
  return actualLengthMm;
}

/**
 * Calculate post count for cage perimeter
 * Corner posts at corners, repeat posts between panels
 */
export function calculatePostCount(config: Pick<CageConfiguration, 'lengthMm' | 'widthMm'>): {
  cornerPosts: number;
  repeatPosts: number;
  totalPosts: number;
} {
  const lengthLayout = calculatePanelLayout(config.lengthMm);
  const widthLayout = calculatePanelLayout(config.widthMm);
  
  // Always 4 corner posts
  const cornerPosts = 4;
  
  // Repeat posts between panels (on each wall, excluding corners)
  const lengthRepeatPosts = Math.max(0, (lengthLayout.standardPanels + lengthLayout.fillerPanels - 1));
  const widthRepeatPosts = Math.max(0, (widthLayout.standardPanels + widthLayout.fillerPanels - 1));
  
  // Two walls of each dimension
  const repeatPosts = (lengthRepeatPosts * 2) + (widthRepeatPosts * 2);
  
  return {
    cornerPosts,
    repeatPosts,
    totalPosts: cornerPosts + repeatPosts,
  };
}

/**
 * Calculate full Bill of Materials for a cage configuration
 */
export interface CageBOM {
  posts: { item: PostDefinition; quantity: number }[];
  spigots: { item: SpigotDefinition; quantity: number }[];
  panels: { item: PanelDefinition; quantity: number; actualHeightMm?: number }[];
  doors: { item: DoorDefinition; quantity: number }[];
  lintelPanels: { item: LintelPanelDefinition; quantity: number; actualHeightMm?: number }[];
  locks: { item: CageLockOption; quantity: number }[];
  totalPrice: number;
  summary: {
    perimeterMm: number;
    areaSqM: number;
    totalHeightMm: number;
    doorCount: number;
  };
}

export function calculateCageBOM(config: CageConfiguration): CageBOM {
  const { lengthMm, widthMm, ceilingHeightMm, doors } = config;
  
  // Height calculations
  const { requiresInfill, infillHeightMm } = calculateInfillHeight(ceilingHeightMm);
  
  // Panel layout per wall
  const lengthLayout = calculatePanelLayout(lengthMm);
  const widthLayout = calculatePanelLayout(widthMm);
  
  // Post counts
  const postCount = calculatePostCount({ lengthMm, widthMm });
  
  // Posts
  const cornerPost = POSTS.find(p => p.type === 'corner')!;
  const repeatPost = POSTS.find(p => p.type === 'repeat')!;
  
  // Panels (per wall type, ×2 for front/back and left/right)
  const bottomPanel900 = PANELS.find(p => p.id === 'panel-bottom-900')!;
  const bottomPanel250 = PANELS.find(p => p.id === 'panel-bottom-250')!;
  const upperPanel900 = PANELS.find(p => p.id === 'panel-upper-900')!;
  const upperPanel250 = PANELS.find(p => p.id === 'panel-upper-250')!;
  const infillPanel900 = PANELS.find(p => p.id === 'panel-infill-900')!;
  const infillPanel250 = PANELS.find(p => p.id === 'panel-infill-250')!;
  
  // Calculate panel quantities (×2 for opposite walls)
  // Length walls (front + rear)
  const lengthBottomStandard = lengthLayout.standardPanels * 2;
  const lengthBottomFiller = lengthLayout.fillerPanels * 2;
  const lengthUpperStandard = lengthLayout.standardPanels * 2;
  const lengthUpperFiller = lengthLayout.fillerPanels * 2;
  
  // Width walls (left + right)
  const widthBottomStandard = widthLayout.standardPanels * 2;
  const widthBottomFiller = widthLayout.fillerPanels * 2;
  const widthUpperStandard = widthLayout.standardPanels * 2;
  const widthUpperFiller = widthLayout.fillerPanels * 2;
  
  // Door adjustments (doors replace some panels)
  const doorCount = doors.length;
  // Each door replaces approximately 2 standard panels worth of wall
  const doorPanelReduction = doorCount * 2;
  
  // Total panels
  const totalBottomStandard = Math.max(0, lengthBottomStandard + widthBottomStandard - doorPanelReduction);
  const totalBottomFiller = lengthBottomFiller + widthBottomFiller;
  const totalUpperStandard = lengthUpperStandard + widthUpperStandard;
  const totalUpperFiller = lengthUpperFiller + widthUpperFiller;
  
  // Infill panels (if needed)
  const totalInfillStandard = requiresInfill ? totalUpperStandard : 0;
  const totalInfillFiller = requiresInfill ? totalUpperFiller : 0;
  
  // Build BOM
  const bom: CageBOM = {
    posts: [
      { item: cornerPost, quantity: postCount.cornerPosts },
      { item: repeatPost, quantity: postCount.repeatPosts },
    ].filter(p => p.quantity > 0),
    
    spigots: [], // Add based on post connections
    
    panels: [
      { item: bottomPanel900, quantity: totalBottomStandard },
      { item: bottomPanel250, quantity: totalBottomFiller },
      { item: upperPanel900, quantity: totalUpperStandard },
      { item: upperPanel250, quantity: totalUpperFiller },
      { item: infillPanel900, quantity: totalInfillStandard, actualHeightMm: infillHeightMm },
      { item: infillPanel250, quantity: totalInfillFiller, actualHeightMm: infillHeightMm },
    ].filter(p => p.quantity > 0),
    
    doors: doors.map(d => ({
      item: DOORS.find(door => door.id === d.doorId) || DOORS[0],
      quantity: 1,
    })),
    
    lintelPanels: doors.length > 0 ? [
      { item: LINTEL_PANELS[0], quantity: doorCount }, // Upper lintel
      { item: LINTEL_PANELS[1], quantity: requiresInfill ? doorCount : 0, actualHeightMm: infillHeightMm },
    ].filter(p => p.quantity > 0) : [],
    
    locks: doors.map(d => ({
      item: CAGE_LOCKS.find(lock => lock.id === d.lockId) || CAGE_LOCKS[0],
      quantity: 1,
    })),
    
    totalPrice: 0,
    summary: {
      perimeterMm: (lengthMm + widthMm) * 2,
      areaSqM: (lengthMm * widthMm) / 1_000_000,
      totalHeightMm: ceilingHeightMm,
      doorCount,
    },
  };
  
  // Calculate total price
  bom.totalPrice = 
    bom.posts.reduce((sum, p) => sum + (p.item.price * p.quantity), 0) +
    bom.panels.reduce((sum, p) => sum + (p.item.price * p.quantity), 0) +
    bom.doors.reduce((sum, d) => sum + (d.item.price * d.quantity), 0) +
    bom.lintelPanels.reduce((sum, p) => sum + (p.item.price * p.quantity), 0) +
    bom.locks.reduce((sum, l) => sum + (l.item.price * l.quantity), 0);
  
  return bom;
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCageConfiguration(config: CageConfiguration): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Dimension validation
  if (config.lengthMm < 900) {
    errors.push('Cage length must be at least 900mm (one standard panel)');
  }
  if (config.widthMm < 900) {
    errors.push('Cage width must be at least 900mm (one standard panel)');
  }
  
  // Ceiling height validation
  if (config.ceilingHeightMm < HEIGHT_CALCULATION.MIN_CEILING) {
    errors.push(`Ceiling height must be at least ${HEIGHT_CALCULATION.MIN_CEILING}mm`);
  }
  if (config.ceilingHeightMm > HEIGHT_CALCULATION.MAX_CEILING) {
    warnings.push(`Ceiling height exceeds ${HEIGHT_CALCULATION.MAX_CEILING}mm - custom posts may be required`);
  }
  
  // Door validation
  if (config.doors.length === 0) {
    errors.push('At least one door is required for access');
  }
  
  // Check door positions don't overlap
  const doorsByFace: Record<CageFace, CageDoorPlacement[]> = {
    front: [],
    rear: [],
    left: [],
    right: [],
  };
  config.doors.forEach(d => doorsByFace[d.face].push(d));
  
  Object.entries(doorsByFace).forEach(([face, faceDoors]) => {
    if (faceDoors.length > 1) {
      // Check for overlapping doors on same face
      const sorted = [...faceDoors].sort((a, b) => a.positionMm - b.positionMm);
      for (let i = 0; i < sorted.length - 1; i++) {
        const door = DOORS.find(d => d.id === sorted[i].doorId);
        if (door && sorted[i].positionMm + door.frameWidthMm > sorted[i + 1].positionMm) {
          errors.push(`Doors overlap on ${face} face`);
        }
      }
    }
  });
  
  // Check door fits on wall
  config.doors.forEach((door, idx) => {
    const doorDef = DOORS.find(d => d.id === door.doorId);
    if (!doorDef) return;
    
    const wallLength = (door.face === 'front' || door.face === 'rear') 
      ? config.widthMm 
      : config.lengthMm;
    
    if (door.positionMm + doorDef.frameWidthMm > wallLength) {
      errors.push(`Door ${idx + 1} extends beyond ${door.face} wall`);
    }
  });
  
  // Module alignment warnings
  const lengthLayout = calculatePanelLayout(config.lengthMm);
  const widthLayout = calculatePanelLayout(config.widthMm);
  
  if (lengthLayout.actualLengthMm !== config.lengthMm) {
    warnings.push(`Length adjusted to ${lengthLayout.actualLengthMm}mm to align with panel modules`);
  }
  if (widthLayout.actualLengthMm !== config.widthMm) {
    warnings.push(`Width adjusted to ${widthLayout.actualLengthMm}mm to align with panel modules`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// COMMERCIAL RULES
// ============================================================================

export const CAGE_COMMERCIAL_RULES = {
  action: 'quote_required' as const,
  message: 'Data Cage configurations require a formal quote. Our team will review your requirements and provide detailed pricing.',
  minimumLeadTimeDays: 10,
  installationRequired: true,
  siteAssessmentRecommended: true,
};
