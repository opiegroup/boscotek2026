/**
 * Lectrum Product Constants
 * 
 * Colour options, dimensions, and configuration constants for Lectrum lecterns.
 */

// ============================================================================
// FRAME COLOURS
// ============================================================================

export interface FrameColour {
  id: string;
  label: string;
  hex: string;
  code: string;
  texture?: string; // Path to texture image
}

export const FRAME_COLOURS: FrameColour[] = [
  { id: 'black', label: 'Black', hex: '#1C1C1C', code: 'BLK', texture: '/textures/lectrum/frames/black.jpg' },
  { id: 'white', label: 'White', hex: '#F2F0EC', code: 'WHT', texture: '/textures/lectrum/frames/white.jpg' },
  { id: 'silver', label: 'Silver', hex: '#B5B5B5', code: 'SLV', texture: '/textures/lectrum/frames/silver.jpg' },
  { id: 'gold', label: 'Gold', hex: '#C9A227', code: 'GLD', texture: '/textures/lectrum/frames/gold.jpg' },
];

// ============================================================================
// PANEL / DRESS FABRIC COLOURS
// ============================================================================

export interface PanelColour {
  id: string;
  label: string;
  hex: string;
  code: string;
  description?: string;
  texture?: string; // Path to Autex fabric texture
}

// Autex Vertiface fabric colours - CORRECT hex values
export const PANEL_COLOURS: PanelColour[] = [
  { id: 'savoye', label: 'Savoye', hex: '#DEDBD6', code: 'SAV', description: 'Warm off-white', texture: '/textures/lectrum/panels/savoye.jpg' },
  { id: 'parthenon', label: 'Parthenon', hex: '#AA9E8C', code: 'PAR', description: 'Sandstone beige', texture: '/textures/lectrum/panels/parthenon.jpg' },
  { id: 'koala', label: 'Koala', hex: '#4E5153', code: 'KOA', description: 'Soft grey', texture: '/textures/lectrum/panels/koala.jpg' },
  { id: 'flatiron', label: 'Flatiron', hex: '#757575', code: 'FLT', description: 'Mid grey', texture: '/textures/lectrum/panels/flatiron.jpg' },
  { id: 'petronas', label: 'Petronas', hex: '#0C0C0C', code: 'PET', description: 'True black', texture: '/textures/lectrum/panels/petronas.jpg' },
  { id: 'ink', label: 'Ink', hex: '#202A4F', code: 'INK', description: 'Inky navy', texture: '/textures/lectrum/panels/ink.jpg' },
  { id: 'calypso', label: 'Calypso', hex: '#5E6891', code: 'CAL', description: 'Muted indigo', texture: '/textures/lectrum/panels/calypso.jpg' },
  { id: 'atlantis', label: 'Atlantis', hex: '#4F86A8', code: 'ATL', description: 'Ocean blue', texture: '/textures/lectrum/panels/atlantis.jpg' },
  { id: 'electric-blue', label: 'Electric Blue', hex: '#0270B8', code: 'EBL', description: 'Vivid blue', texture: '/textures/lectrum/panels/electric-blue.jpg' },
  { id: 'granny-smith', label: 'Granny Smith', hex: '#4BA245', code: 'GRS', description: 'Fresh green', texture: '/textures/lectrum/panels/granny-smith.jpg' },
  { id: 'sargazo', label: 'Sargazo', hex: '#4F2229', code: 'SAR', description: 'Oxblood red', texture: '/textures/lectrum/panels/sargazo.jpg' },
  { id: 'blazing-red', label: 'Blazing Red', hex: '#B5171F', code: 'BRD', description: 'Signal red', texture: '/textures/lectrum/panels/blazing-red.jpg' },
];

// ============================================================================
// PRODUCT SERIES
// ============================================================================

export type LectrumSeries = 'aero' | 'classic';

export const SERIES_INFO: Record<LectrumSeries, { name: string; description: string }> = {
  aero: {
    name: 'Aero Series',
    description: 'Sleek, modern design with curved panels and premium finishes.',
  },
  classic: {
    name: 'Classic Series',
    description: 'Timeless reliability with clean lines and proven durability.',
  },
};

// ============================================================================
// PRODUCT MODELS
// ============================================================================

export interface LectrumModel {
  id: string;
  name: string;
  series: LectrumSeries;
  type: 'floor-lectern' | 'floor-lectern-timer' | 'floor-lectern-control' | 'floor-lectern-clock' | 'extra-wide';
  description: string;
  basePrice: number;
  dimensions: {
    width: number;
    height: number;
    depth: number;
    heightRear?: number;
  };
  features: string[];
  hasElectronics: boolean;
  hasTimer: boolean;
  hasControlCutout: boolean;
}

export const LECTRUM_MODELS: LectrumModel[] = [
  // Aero Series
  {
    id: 'L2001',
    name: 'L2001 Aero',
    series: 'aero',
    type: 'floor-lectern',
    description: 'Award-winning sleek curved panel lectern with dual XLR inputs and LED light.',
    basePrice: 4840,
    dimensions: { width: 600, height: 1160, depth: 495, heightRear: 1030 },
    features: ['Dual XLR inputs', 'LED reading light', 'Seamless cable management', 'Curved panel design'],
    hasElectronics: true,
    hasTimer: false,
    hasControlCutout: false,
  },
  {
    id: 'L2001C',
    name: 'L2001C Aero Timer',
    series: 'aero',
    type: 'floor-lectern-timer',
    description: 'Aero lectern with programmable clock and countdown timer.',
    basePrice: 5465,
    dimensions: { width: 600, height: 1160, depth: 495, heightRear: 1030 },
    features: ['Dual XLR inputs', 'LED reading light', 'Programmable clock/timer', 'Curved panel design'],
    hasElectronics: true,
    hasTimer: true,
    hasControlCutout: false,
  },
  {
    id: 'L2001-CTL',
    name: 'L2001 CTL Aero Control',
    series: 'aero',
    type: 'floor-lectern-control',
    description: 'Aero lectern with integrated AV control system cut-out.',
    basePrice: 6338,
    dimensions: { width: 600, height: 1160, depth: 495, heightRear: 1030 },
    features: ['Dual XLR inputs', 'LED reading light', 'AV control cut-out', 'Touchscreen ready'],
    hasElectronics: true,
    hasTimer: false,
    hasControlCutout: true,
  },
  
  // Classic Series
  {
    id: 'L20',
    name: 'L20 Classic',
    series: 'classic',
    type: 'floor-lectern',
    description: 'Timeless reliability with integrated logo space and clean design.',
    basePrice: 2473,
    dimensions: { width: 600, height: 1160, depth: 495, heightRear: 1030 },
    features: ['Integrated logo space', 'Cable management', 'Timeless design'],
    hasElectronics: false,
    hasTimer: false,
    hasControlCutout: false,
  },
  {
    id: 'L20S',
    name: 'L20S Classic Electronics',
    series: 'classic',
    type: 'floor-lectern',
    description: 'Classic lectern with dual XLR inputs and LED reading light.',
    basePrice: 3139,
    dimensions: { width: 600, height: 1160, depth: 495, heightRear: 1030 },
    features: ['Dual XLR inputs', 'LED reading light', 'Discreet audio connections', 'Timeless design'],
    hasElectronics: true,
    hasTimer: false,
    hasControlCutout: false,
  },
  {
    id: 'L20S-NCTL',
    name: 'L20S NCTL Classic Control',
    series: 'classic',
    type: 'floor-lectern-control',
    description: 'Classic lectern with integrated control system cut-out.',
    basePrice: 4937,
    dimensions: { width: 600, height: 1160, depth: 495, heightRear: 1030 },
    features: ['Dual XLR inputs', 'LED reading light', 'Control cut-out panel', 'Timeless design'],
    hasElectronics: true,
    hasTimer: false,
    hasControlCutout: true,
  },
  {
    id: 'L900',
    name: 'L900 Extra Wide',
    series: 'classic',
    type: 'extra-wide',
    description: 'Extra wide lectern with broader panel area for maximum presence.',
    basePrice: 4146,
    dimensions: { width: 900, height: 1160, depth: 495, heightRear: 1030 },
    features: ['Dual XLR inputs', 'LED reading light', 'Power supply', 'Extra wide footprint'],
    hasElectronics: true,
    hasTimer: false,
    hasControlCutout: false,
  },
  {
    id: 'L101',
    name: 'L101 Classic Clock',
    series: 'classic',
    type: 'floor-lectern-clock',
    description: 'Classic lectern with built-in digital clock and countdown timer.',
    basePrice: 4572,
    dimensions: { width: 600, height: 1160, depth: 495, heightRear: 1030 },
    features: ['Dual XLR inputs', 'LED reading light', 'Digital clock/timer', 'Timeless design'],
    hasElectronics: true,
    hasTimer: true,
    hasControlCutout: false,
  },
];

// ============================================================================
// ACCESSORIES
// ============================================================================

export interface LectrumAccessory {
  id: string;
  name: string;
  description: string;
  price: number;
  applicableSeries: LectrumSeries[] | 'all';
  category: 'shelf' | 'logo' | 'mobility' | 'protection' | 'microphone' | 'other';
}

export const LECTRUM_ACCESSORIES: LectrumAccessory[] = [
  // Aero Series Accessories
  {
    id: 'pc-shelf-aero',
    name: 'PC Shelf (Aero)',
    description: 'Slide-out PC/notebook shelf for Aero series lecterns.',
    price: 505,
    applicableSeries: ['aero'],
    category: 'shelf',
  },
  {
    id: 'logo-insert-aero-top',
    name: 'Logo Insert - Top Panel (Aero)',
    description: 'Custom logo insert for Aero top panel (200 x 600 x 1mm).',
    price: 376,
    applicableSeries: ['aero'],
    category: 'logo',
  },
  {
    id: 'logo-panel-aero-400',
    name: 'Logo Panel 400x300 (Aero)',
    description: 'Dress panel logo with velcro (400 x 300 x 1mm).',
    price: 613,
    applicableSeries: ['aero'],
    category: 'logo',
  },
  {
    id: 'logo-panel-aero-full',
    name: 'Full Dress Panel Logo (Aero)',
    description: 'Full coverage logo panel with velcro (540 x 1010 x 1mm).',
    price: 700,
    applicableSeries: ['aero'],
    category: 'logo',
  },
  {
    id: 'protective-cover-aero',
    name: 'Protective Cover (Aero)',
    description: 'Heavy duty padded protective cover for L2001 Aero lecterns.',
    price: 689,
    applicableSeries: ['aero'],
    category: 'protection',
  },
  {
    id: 'display-board-aero',
    name: 'Display Board (Aero)',
    description: 'Replacement display board with Petronas fabric (3mm MDF).',
    price: 487,
    applicableSeries: ['aero'],
    category: 'other',
  },
  
  // Classic Series Accessories
  {
    id: 'property-shelf-classic',
    name: 'Property Shelf (Classic)',
    description: 'Discreet internal storage shelf for presenter essentials.',
    price: 223,
    applicableSeries: ['classic'],
    category: 'shelf',
  },
  {
    id: 'notebook-shelf-classic',
    name: 'Slide-Out Notebook Shelf (Classic)',
    description: 'Right-hand slide-out shelf for laptops or tablets.',
    price: 505,
    applicableSeries: ['classic'],
    category: 'shelf',
  },
  {
    id: 'logo-panel-classic-400',
    name: 'Logo Panel 400x300 (Classic)',
    description: 'Dress panel logo with velcro (400 x 300 x 2mm).',
    price: 613,
    applicableSeries: ['classic'],
    category: 'logo',
  },
  {
    id: 'logo-panel-classic-full',
    name: 'Full Dress Panel Logo (Classic)',
    description: 'Full coverage logo panel with velcro (540 x 840 x 2mm).',
    price: 700,
    applicableSeries: ['classic'],
    category: 'logo',
  },
  {
    id: 'crystalite-logo-classic',
    name: 'Crystalite Logo (Classic)',
    description: 'Premium crystalite logo panel (400 x 300).',
    price: 688,
    applicableSeries: ['classic'],
    category: 'logo',
  },
  {
    id: 'protective-cover-classic',
    name: 'Protective Cover (Classic)',
    description: 'Padded protective cover for L20 Classic lecterns.',
    price: 689,
    applicableSeries: ['classic'],
    category: 'protection',
  },
  {
    id: 'phantom-power-classic',
    name: 'Phantom Power Supply (Classic)',
    description: 'Phantom power supply unit for Classic lecterns.',
    price: 516,
    applicableSeries: ['classic'],
    category: 'other',
  },
  
  // Universal Accessories
  {
    id: 'castors',
    name: 'Lockable Castors (Set of 4)',
    description: 'Lockable castors for easy mobility.',
    price: 70,
    applicableSeries: ['classic'],
    category: 'mobility',
  },
  {
    id: 'gooseneck-mic',
    name: 'Gooseneck Microphone Clamp',
    description: 'Gooseneck with spring clamp for handheld wireless microphone.',
    price: 132,
    applicableSeries: 'all',
    category: 'microphone',
  },
  {
    id: 'microphone-set',
    name: 'Microphone Set',
    description: 'Complete microphone set for lectern use.',
    price: 556,
    applicableSeries: 'all',
    category: 'microphone',
  },
];

// ============================================================================
// REFERENCE CODE GENERATION
// ============================================================================

export function generateLectrumCode(
  modelId: string,
  frameColour: string,
  panelColour: string
): string {
  const model = LECTRUM_MODELS.find(m => m.id === modelId);
  const frame = FRAME_COLOURS.find(c => c.id === frameColour);
  const panel = PANEL_COLOURS.find(c => c.id === panelColour);
  
  if (!model || !frame || !panel) {
    return `LT.${modelId}`;
  }
  
  return `LT.${model.id}.${frame.code}.${panel.code}`;
}
