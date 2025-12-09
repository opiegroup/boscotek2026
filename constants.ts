import { Option, DimensionOption, FrameColorOption } from './types';

// --- DIMENSIONS ---
export const WIDTH_OPTIONS: DimensionOption[] = [
  { id: 'w-1500', label: '1500mm', valueMm: 1500, code: '915', priceDelta: 0 },
  { id: 'w-1800', label: '1800mm', valueMm: 1800, code: '918', priceDelta: 150 },
  { id: 'w-2100', label: '2100mm', valueMm: 2100, code: '921', priceDelta: 300 },
];

export const DEPTH_OPTIONS: DimensionOption[] = [
  { id: 'd-750', label: '750mm', valueMm: 750, code: '750', priceDelta: 0 },
];

export const HEIGHT_OPTIONS: DimensionOption[] = [
  { id: 'h-900', label: '900mm', valueMm: 900, code: '900', priceDelta: 0 },
];

// --- STEP 2: BENCH TOP OPTIONS ---
export const WORKTOP_OPTIONS: Option[] = [
  { id: 'top-lam', label: 'Laminated Timber', code: 'L', priceDelta: 0, description: '35mm grey laminate, black edge banding' },
  { id: 'top-oak', label: 'Oak Hardwood', code: 'O', priceDelta: 350, description: '40mm solid hardwood, oiled' },
  { id: 'top-mild2', label: '2mm Mild Steel', code: 'M2', priceDelta: 250, description: 'Powder coated black over timber' },
  { id: 'top-mild3', label: '3mm Mild Steel', code: 'M3', priceDelta: 350, description: 'Powder coated black (welding)' },
  { id: 'top-ss', label: 'Stainless Steel', code: 'SS', priceDelta: 450, description: '1.2mm 304 grade over timber' },
  { id: 'top-galv', label: 'Galvanised Steel', code: 'G', priceDelta: 200, description: '1.5mm galvanised over timber' },
];

// --- STEP 3: UNDER BENCH (B Codes) ---
// Selected representative options from the PDF to avoid overwhelming the file
export const UNDER_BENCH_OPTIONS: Option[] = [
  { id: 'B0', label: 'B0: Open Frame', code: 'B0', priceDelta: 0, description: 'No accessories' },
  { id: 'B1', label: 'B1: 1 Drawer', code: 'B1', priceDelta: 300, description: 'Single drawer unit' },
  { id: 'B2', label: 'B2: 2 Drawers', code: 'B2', priceDelta: 500, description: 'Two drawer unit' },
  { id: 'B3', label: 'B3: 3 Drawers', code: 'B3', priceDelta: 700, description: 'Three drawer unit' },
  { id: 'B14', label: 'B14: Undershelf', code: 'B14', priceDelta: 150, description: 'Full width undershelf' },
  { id: 'B15', label: 'B15: Shelf + 1 Drawer', code: 'B15', priceDelta: 450, description: 'Undershelf and single drawer' },
  { id: 'B18', label: 'B18: Shelf + 2 Drawers', code: 'B18', priceDelta: 650, description: 'Undershelf and two 1-drawer units' },
  { id: 'B21', label: 'B21: Shelf + 5 Drawers', code: 'B21', priceDelta: 1100, description: 'Undershelf and 5-drawer cabinet' },
  { id: 'B24', label: 'B24: Shelf + Cupboard', code: 'B24', priceDelta: 800, description: 'Undershelf and cupboard unit' },
];

// --- STEP 4: ABOVE BENCH (T Codes) ---
export const ABOVE_BENCH_OPTIONS: Option[] = [
  { id: 'T0', label: 'T0: None', code: 'T0', priceDelta: 0, description: 'No above bench accessories' },
  { id: 'T2', label: 'T2: 4x Shelves', code: 'T2', priceDelta: 400, description: 'Posts + 4 adjustable shelves' },
  { id: 'T3', label: 'T3: Shelves & Pegs', code: 'T3', priceDelta: 450, description: '2 Shelves + 2 Pegboards' },
  { id: 'T4', label: 'T4: Shelves & Louvre', code: 'T4', priceDelta: 450, description: '2 Shelves + 2 Louvre panels' },
  { id: 'T8', label: 'T8: Mixed Combo', code: 'T8', priceDelta: 500, description: '1 Shelf + 2 Peg + 2 Louvre' },
  { id: 'T9', label: 'T9: Fixed Shelf', code: 'T9', priceDelta: 200, description: 'Overhead fixed shelf' },
];

// --- COLOURS ---
export const FRAME_COLORS: FrameColorOption[] = [
  { id: 'col-blue-wedge', label: 'Wedgewood Blue', hex: '#5f7895', code: 'WB' }, // Standard Boscotek Blue
  { id: 'col-charcoal', label: 'Charcoal Satin', hex: '#363636', code: 'CH' },
  { id: 'col-black', label: 'Black Satin', hex: '#1a1a1a', code: 'BK' },
  { id: 'col-grey', label: 'Transformer Grey', hex: '#9ca3af', code: 'TG' },
  { id: 'col-white', label: 'Pearl White', hex: '#f3f4f6', code: 'PW' },
  { id: 'col-red', label: 'Signal Red', hex: '#b91c1c', code: 'SR' },
];

export const DEFAULT_CONFIG = {
  benchWidth: WIDTH_OPTIONS[1].id, // 1800mm default
  benchDepth: DEPTH_OPTIONS[0].id,
  benchHeight: HEIGHT_OPTIONS[0].id,
  worktop: WORKTOP_OPTIONS[0].id, // Laminated
  underBench: UNDER_BENCH_OPTIONS[0].id, // B0
  aboveBench: ABOVE_BENCH_OPTIONS[0].id, // T0
  castors: false,
  frameColor: FRAME_COLORS[0].id, // Wedgewood Blue
  notes: '',
  internalReference: '',
};