
import { ProductDefinition, DrawerInteriorOption, DrawerAccessory } from '../types';

// --- DRAWER INTERIOR DEFINITIONS ---

// Helper to create ID
const _id = (prefix: string, code: string) => `${prefix}-${code.replace(/\./g, '-')}`;

export const INTERIOR_OPTIONS: DrawerInteriorOption[] = [
  // ==========================================================
  // SERIES 46 (560mm Wide / Deep Depth 'D') - 10 Partition Set Styles
  // Usable Approx: 450mm W x 600mm D
  // Code format: PS.46.X.{width_code}.{depth_code} where X = drawer height
  // Note: # suffix indicates available with plastic dividers up to 150mm drawer
  // ==========================================================
  // Row 1: Shallow depth (75mm cells)
  { id: 'ps-46-x-3-3', type: 'partition_set', width_mm: 560, depth_type: 'D', code_base: 'PS.46.X.3.3', price: 45, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '75mm x 75mm (48 Compartments)', cell_width_mm: 75, cell_depth_mm: 75, cell_count: 48 },
  { id: 'ps-46-x-3-4', type: 'partition_set', width_mm: 560, depth_type: 'D', code_base: 'PS.46.X.3.4', price: 44, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '75mm x 100mm (36 Compartments)', cell_width_mm: 75, cell_depth_mm: 100, cell_count: 36 },
  { id: 'ps-46-x-3-6', type: 'partition_set', width_mm: 560, depth_type: 'D', code_base: 'PS.46.X.3.6', price: 42, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '75mm x 150mm (24 Compartments)', cell_width_mm: 75, cell_depth_mm: 150, cell_count: 24 },
  { id: 'ps-46-x-6-3', type: 'partition_set', width_mm: 560, depth_type: 'D', code_base: 'PS.46.X.6.3', price: 42, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '150mm x 75mm (24 Compartments)', cell_width_mm: 150, cell_depth_mm: 75, cell_count: 24 },
  { id: 'ps-46-x-6-4', type: 'partition_set', width_mm: 560, depth_type: 'D', code_base: 'PS.46.X.6.4', price: 40, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '150mm x 100mm (18 Compartments)', cell_width_mm: 150, cell_depth_mm: 100, cell_count: 18 },
  // Row 2: Medium/Deep cells
  { id: 'ps-46-x-6-6', type: 'partition_set', width_mm: 560, depth_type: 'D', code_base: 'PS.46.X.6.6', price: 38, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '150mm x 150mm (12 Compartments)', cell_width_mm: 150, cell_depth_mm: 150, cell_count: 12 },
  { id: 'ps-46-x-9-4', type: 'partition_set', width_mm: 560, depth_type: 'D', code_base: 'PS.46.X.9.4', price: 40, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '225mm x 100mm (12 Compartments)', cell_width_mm: 225, cell_depth_mm: 100, cell_count: 12 },
  { id: 'ps-46-x-9-8', type: 'partition_set', width_mm: 560, depth_type: 'D', code_base: 'PS.46.X.9.8', price: 36, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '225mm x 200mm (6 Compartments)', cell_width_mm: 225, cell_depth_mm: 200, cell_count: 6 },
  { id: 'ps-46-x-18-3', type: 'partition_set', width_mm: 560, depth_type: 'D', code_base: 'PS.46.X.18.3', price: 38, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '450mm x 75mm (8 Compartments)', cell_width_mm: 450, cell_depth_mm: 75, cell_count: 8 },
  { id: 'ps-46-x-18-6', type: 'partition_set', width_mm: 560, depth_type: 'D', code_base: 'PS.46.X.18.6', price: 35, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '450mm x 150mm (4 Compartments)', cell_width_mm: 450, cell_depth_mm: 150, cell_count: 4 },

  // ==========================================================
  // Bin Sets (BS.46) - 5 Styles (Recommended in 75mm drawers only)
  // ==========================================================
  { id: 'bs-46-001', type: 'bin_set', width_mm: 560, depth_type: 'D', code_base: 'BS.46.001', price: 110, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: '50x100mm (6) + 100x100mm (24) = 30 Bins', components_summary: '50mm x 100mm (6), 100mm x 100mm (24)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 30 },
  { id: 'bs-46-002', type: 'bin_set', width_mm: 560, depth_type: 'D', code_base: 'BS.46.002', price: 125, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: '100x50 (14) + 100x100 (4) + 100x200 (4) + 200x200 (2) = 24 Bins', components_summary: '100mm x 50mm (14), 100mm x 100mm (4), 100mm x 200mm (4), 200mm x 200mm (2)', cell_width_mm: 100, cell_depth_mm: 125, cell_count: 24 },
  { id: 'bs-46-003', type: 'bin_set', width_mm: 560, depth_type: 'D', code_base: 'BS.46.003', price: 150, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: '50mm x 50mm (108 Bins)', components_summary: '50mm x 50mm (108)', cell_width_mm: 50, cell_depth_mm: 50, cell_count: 108 },
  { id: 'bs-46-004', type: 'bin_set', width_mm: 560, depth_type: 'D', code_base: 'BS.46.004', price: 90, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: '50x100mm (6) + 200x200mm (6) = 12 Bins', components_summary: '50mm x 100mm (6), 200mm x 200mm (6)', cell_width_mm: 150, cell_depth_mm: 150, cell_count: 12 },
  { id: 'bs-46-005', type: 'bin_set', width_mm: 560, depth_type: 'D', code_base: 'BS.46.005', price: 115, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: '50x100 (14) + 100x100 (4) + 100x200 (8) = 26 Bins', components_summary: '50mm x 100mm (14), 100mm x 100mm (4), 100mm x 200mm (8)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 26 },

  // ==========================================================
  // Mixed Sets (MS.46) - 5 Styles (Recommended in 75mm drawers only)
  // Combines partitions, dividers, bins, trays, and tool supports
  // ==========================================================
  { id: 'ms-46-001', type: 'mixed_set', width_mm: 560, depth_type: 'D', code_base: 'MS.46.001', price: 180, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: 'Partition (1), Tool Supports (1), Tray - 100/7 (1)', components_summary: 'Partition (1), Tool Supports (1), Tray 100/7 (1)', cell_width_mm: 100, cell_depth_mm: 100 },
  { id: 'ms-46-002', type: 'mixed_set', width_mm: 560, depth_type: 'D', code_base: 'MS.46.002', price: 165, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: 'Partition (2), Divider AL-75 (7), AL-150 (3), Bins 50x100 (8), Groove Tray (2)', components_summary: 'Partitions (2), Dividers AL-75mm (7) + AL-150mm (3), Bins 50x100mm (8), Groove Trays (2)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 8 },
  { id: 'ms-46-003', type: 'mixed_set', width_mm: 560, depth_type: 'D', code_base: 'MS.46.003', price: 170, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: 'Partitions (2), Divider AL-75 (7), AL-150 (3), Bins: 50x50 (4), 50x100 (2), 100x100 (2), 200x200 (1), Groove Tray', components_summary: 'Partitions (2), Dividers AL-75mm (7) + AL-150mm (3), Bins 50x50mm (4) + 50x100mm (2) + 100x100mm (2) + 200x200mm (1), Groove Tray (1)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 9 },
  { id: 'ms-46-004', type: 'mixed_set', width_mm: 560, depth_type: 'D', code_base: 'MS.46.004', price: 175, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: 'Partitions (2), Dividers AL-75 (10), Bins: 50x50 (12), 50x100 (6), 100x100 (4), 100x200 (1)', components_summary: 'Partitions (2), Dividers AL-75mm (10), Bins 50x50mm (12) + 50x100mm (6) + 100x100mm (4) + 100x200mm (1)', cell_width_mm: 50, cell_depth_mm: 50, cell_count: 23 },
  { id: 'ms-46-005', type: 'mixed_set', width_mm: 560, depth_type: 'D', code_base: 'MS.46.005', price: 190, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: 'Partitions (3), Dividers AL-75 (7), AL-100 (5), Bins: 50x50 (2), 50x100 (3), 100x100 (2), 100x200 (1), Trays 50/6, 100/3', components_summary: 'Partitions (3), Dividers AL-75mm (7) + AL-100mm (5), Bins 50x50mm (2) + 50x100mm (3) + 100x100mm (2) + 100x200mm (1), Trays 50/6 + 100/3', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 8 },

  // ==========================================================
  // SERIES 66 (710mm Wide / Deep)
  // ==========================================================
  { id: 'ps-66-x-3-3', type: 'partition_set', width_mm: 710, depth_type: 'D', code_base: 'PS.66.X.3.3', price: 65, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '75mm x 75mm (64 Compartments)', cell_width_mm: 75, cell_depth_mm: 75, cell_count: 64 },
  { id: 'ps-66-x-3-6', type: 'partition_set', width_mm: 710, depth_type: 'D', code_base: 'PS.66.X.3.6', price: 60, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '75mm x 150mm (32 Compartments)', cell_width_mm: 75, cell_depth_mm: 150, cell_count: 32 },
  { id: 'ps-66-x-4-4', type: 'partition_set', width_mm: 710, depth_type: 'D', code_base: 'PS.66.X.4.4', price: 58, supported_drawer_heights_mm: [100, 150, 225, 300], layout_description: '100mm x 100mm (36 Compartments)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 36 },
  { id: 'ps-66-x-4-8', type: 'partition_set', width_mm: 710, depth_type: 'D', code_base: 'PS.66.X.4.8', price: 55, supported_drawer_heights_mm: [100, 150, 225, 300], layout_description: '100mm x 200mm (18 Compartments)', cell_width_mm: 100, cell_depth_mm: 200, cell_count: 18 },
  { id: 'ps-66-x-6-6', type: 'partition_set', width_mm: 710, depth_type: 'D', code_base: 'PS.66.X.6.6', price: 52, supported_drawer_heights_mm: [150, 225, 300], layout_description: '150mm x 150mm (16 Compartments)', cell_width_mm: 150, cell_depth_mm: 150, cell_count: 16 },
  { id: 'ps-66-x-8-6', type: 'partition_set', width_mm: 710, depth_type: 'D', code_base: 'PS.66.X.8.6', price: 50, supported_drawer_heights_mm: [225, 300], layout_description: '200mm x 150mm (12 Compartments)', cell_width_mm: 200, cell_depth_mm: 150, cell_count: 12 },
  { id: 'ps-66-x-8-8', type: 'partition_set', width_mm: 710, depth_type: 'D', code_base: 'PS.66.X.8.8', price: 48, supported_drawer_heights_mm: [225, 300], layout_description: '200mm x 200mm (9 Compartments)', cell_width_mm: 200, cell_depth_mm: 200, cell_count: 9 },
  { id: 'ps-66-x-12-8', type: 'partition_set', width_mm: 710, depth_type: 'D', code_base: 'PS.66.X.12.8', price: 45, supported_drawer_heights_mm: [300], layout_description: '300mm x 200mm (6 Compartments)', cell_width_mm: 300, cell_depth_mm: 200, cell_count: 6 },
  
  // Bin Sets (BS.66)
  { id: 'bs-66-001', type: 'bin_set', width_mm: 710, depth_type: 'D', code_base: 'BS.66.001', price: 150, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm', layout_description: '50mm x 50mm (144 Bins)', cell_width_mm: 50, cell_depth_mm: 50, cell_count: 144 },
  { id: 'bs-66-002', type: 'bin_set', width_mm: 710, depth_type: 'D', code_base: 'BS.66.002', price: 140, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm', layout_description: '50mm x 100mm (72 Bins)', cell_width_mm: 50, cell_depth_mm: 100, cell_count: 72 },
  { id: 'bs-66-003', type: 'bin_set', width_mm: 710, depth_type: 'D', code_base: 'BS.66.003', price: 130, supported_drawer_heights_mm: [75, 100], layout_description: '100mm x 100mm (36 Bins)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 36 },
  { id: 'bs-66-004', type: 'bin_set', width_mm: 710, depth_type: 'D', code_base: 'BS.66.004', price: 125, supported_drawer_heights_mm: [75, 100], layout_description: 'Mixed Bins (27 Total)', components_summary: '50x100 (12), 100x100 (6), 100x200 (6), 200x200 (3)', cell_width_mm: 100, cell_depth_mm: 125, cell_count: 27 },

  // ==========================================================
  // SERIES 44 (560mm Wide / Standard Depth 'S') - 10 Styles
  // Usable Approx: 450mm W x 450mm D
  // ==========================================================
  { id: 'ps-44-x-3-3', type: 'partition_set', width_mm: 560, depth_type: 'S', code_base: 'PS.44.X.3.3', price: 35, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '75mm x 75mm (36 Compartments)', cell_width_mm: 75, cell_depth_mm: 75, cell_count: 36 },
  { id: 'ps-44-x-6-3', type: 'partition_set', width_mm: 560, depth_type: 'S', code_base: 'PS.44.X.6.3', price: 32, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '150mm x 75mm (18 Compartments)', cell_width_mm: 150, cell_depth_mm: 75, cell_count: 18 },
  { id: 'ps-44-x-9-3', type: 'partition_set', width_mm: 560, depth_type: 'S', code_base: 'PS.44.X.9.3', price: 30, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '225mm x 75mm (12 Compartments)', cell_width_mm: 225, cell_depth_mm: 75, cell_count: 12 },
  { id: 'ps-44-x-18-3', type: 'partition_set', width_mm: 560, depth_type: 'S', code_base: 'PS.44.X.18.3', price: 28, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '450mm x 75mm (6 Compartments)', cell_width_mm: 450, cell_depth_mm: 75, cell_count: 6 },
  
  { id: 'ps-44-x-3-6', type: 'partition_set', width_mm: 560, depth_type: 'S', code_base: 'PS.44.X.3.6', price: 32, supported_drawer_heights_mm: [150, 225, 300], layout_description: '75mm x 150mm (18 Compartments)', cell_width_mm: 75, cell_depth_mm: 150, cell_count: 18 },
  { id: 'ps-44-x-6-6', type: 'partition_set', width_mm: 560, depth_type: 'S', code_base: 'PS.44.X.6.6', price: 30, supported_drawer_heights_mm: [150, 225, 300], layout_description: '150mm x 150mm (9 Compartments)', cell_width_mm: 150, cell_depth_mm: 150, cell_count: 9 },
  { id: 'ps-44-x-9-6', type: 'partition_set', width_mm: 560, depth_type: 'S', code_base: 'PS.44.X.9.6', price: 28, supported_drawer_heights_mm: [150, 225, 300], layout_description: '225mm x 150mm (6 Compartments)', cell_width_mm: 225, cell_depth_mm: 150, cell_count: 6 },

  { id: 'ps-44-x-3-9', type: 'partition_set', width_mm: 560, depth_type: 'S', code_base: 'PS.44.X.3.9', price: 30, supported_drawer_heights_mm: [225, 300], layout_description: '75mm x 225mm (12 Compartments)', cell_width_mm: 75, cell_depth_mm: 225, cell_count: 12 },
  { id: 'ps-44-x-6-9', type: 'partition_set', width_mm: 560, depth_type: 'S', code_base: 'PS.44.X.6.9', price: 28, supported_drawer_heights_mm: [225, 300], layout_description: '150mm x 225mm (6 Compartments)', cell_width_mm: 150, cell_depth_mm: 225, cell_count: 6 },
  { id: 'ps-44-x-9-9', type: 'partition_set', width_mm: 560, depth_type: 'S', code_base: 'PS.44.X.9.9', price: 26, supported_drawer_heights_mm: [225, 300], layout_description: '225mm x 225mm (4 Compartments)', cell_width_mm: 225, cell_depth_mm: 225, cell_count: 4 },
  
  // Bin Sets (BS.44)
  { id: 'bs-44-001', type: 'bin_set', width_mm: 560, depth_type: 'S', code_base: 'BS.44.001', price: 90, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm', layout_description: '50mm x 50mm (81 Bins)', cell_width_mm: 50, cell_depth_mm: 50, cell_count: 81 },
  { id: 'bs-44-002', type: 'bin_set', width_mm: 560, depth_type: 'S', code_base: 'BS.44.002', price: 95, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm', layout_description: 'Mixed Bins (45 Total)', components_summary: '50x50 (9), 50x100 (36)', cell_width_mm: 50, cell_depth_mm: 100, cell_count: 45 },
  { id: 'bs-44-003', type: 'bin_set', width_mm: 560, depth_type: 'S', code_base: 'BS.44.003', price: 100, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm', layout_description: 'Mixed Bins (33 Total)', components_summary: '50x50 (17), 100x100 (16)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 33 },
  { id: 'bs-44-004', type: 'bin_set', width_mm: 560, depth_type: 'S', code_base: 'BS.44.004', price: 105, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm', layout_description: 'Mixed Bins (23 Total)', components_summary: '50x50 (17), 100x200 (4), 200x200 (2)', cell_width_mm: 50, cell_depth_mm: 100, cell_count: 23 },
  { id: 'bs-44-005', type: 'bin_set', width_mm: 560, depth_type: 'S', code_base: 'BS.44.005', price: 110, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm', layout_description: 'Mixed Bins (32 Total)', components_summary: '50x50 (17), 50x100 (8), 100x100 (4), 100x200 (2), 200x200 (1)', cell_width_mm: 50, cell_depth_mm: 50, cell_count: 32 },

  // ==========================================================
  // Mixed Sets (MS.44) - 5 Styles (Recommended in 75mm drawers only)
  // S Series - Standard Depth 560mm Wide
  // ==========================================================
  { id: 'ms-44-001', type: 'mixed_set', width_mm: 560, depth_type: 'S', code_base: 'MS.44.001', price: 140, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: 'Partition (2), Divider AL-100 (5), Groove Tray (2), Bins: 50x50 (7), 50x100 (8), 100x100 (2)', components_summary: 'Partitions (2), Dividers AL-100mm (5), Groove Trays (2), Bins 50x50mm (7) + 50x100mm (8) + 100x100mm (2)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 17 },
  { id: 'ms-44-002', type: 'mixed_set', width_mm: 560, depth_type: 'S', code_base: 'MS.44.002', price: 145, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: 'Partition (2), Dividers AL-100 (5), AL-150 (2), Bins: 50x50 (4), 50x100 (4), 100x100 (2), 100x200 (2)', components_summary: 'Partitions (2), Dividers AL-100mm (5) + AL-150mm (2), Bins 50x50mm (4) + 50x100mm (4) + 100x100mm (2) + 100x200mm (2)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 12 },
  { id: 'ms-44-003', type: 'mixed_set', width_mm: 560, depth_type: 'S', code_base: 'MS.44.003', price: 150, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: 'Partitions (3), Divider AL-75 (5), AL-100 (4), Tray 50/4 + 100/4, Bins: 50x100 (3), 100x100 (3)', components_summary: 'Partitions (3), Dividers AL-75mm (5) + AL-100mm (4), Trays 50/4 + 100/4, Bins 50x100mm (3) + 100x100mm (3)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 6 },
  { id: 'ms-44-004', type: 'mixed_set', width_mm: 560, depth_type: 'S', code_base: 'MS.44.004', price: 155, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: 'Partitions (3), Dividers AL-75 (4), AL-100 (5), Groove Tray (1), Bins: 50x50 (4), 50x100 (4), 100x100 (2)', components_summary: 'Partitions (3), Dividers AL-75mm (4) + AL-100mm (5), Groove Tray (1), Bins 50x50mm (4) + 50x100mm (4) + 100x100mm (2)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 10 },
  { id: 'ms-44-005', type: 'mixed_set', width_mm: 560, depth_type: 'S', code_base: 'MS.44.005', price: 160, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm drawers only', layout_description: 'Partitions (2), Dividers AL-75 (7), Bins: 50x50 (6), 50x100 (4), 100x100 (4), 100x200 (1), 200x200 (1)', components_summary: 'Partitions (2), Dividers AL-75mm (7), Bins 50x50mm (6) + 50x100mm (4) + 100x100mm (4) + 100x200mm (1) + 200x200mm (1)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 16 },

  // --- SERIES 96 (1010mm Wide / Deep Depth 'D') ---
  { id: 'ps-96-x-3-3', type: 'partition_set', width_mm: 1010, depth_type: 'D', code_base: 'PS.96.X.3.3', price: 95, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '75mm x 75mm (96 Compartments)', cell_width_mm: 75, cell_depth_mm: 75, cell_count: 96 },
  { id: 'ps-96-x-3-6', type: 'partition_set', width_mm: 1010, depth_type: 'D', code_base: 'PS.96.X.3.6', price: 85, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '75mm x 150mm (48 Compartments)', cell_width_mm: 75, cell_depth_mm: 150, cell_count: 48 },
  { id: 'bs-96-001', type: 'bin_set', width_mm: 1010, depth_type: 'D', code_base: 'BS.96.001', price: 200, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm', layout_description: '50mm x 50mm (216 Bins)', cell_width_mm: 50, cell_depth_mm: 50, cell_count: 216 },
  { id: 'bs-96-002', type: 'bin_set', width_mm: 1010, depth_type: 'D', code_base: 'BS.96.002', price: 180, supported_drawer_heights_mm: [75], drawer_height_note: 'Recommended in 75mm', layout_description: '100mm x 100mm (54 Bins)', cell_width_mm: 100, cell_depth_mm: 100, cell_count: 54 },
  { id: 'ms-96-001', type: 'mixed_set', width_mm: 1010, depth_type: 'D', code_base: 'MS.96.001', price: 240, supported_drawer_heights_mm: [75], layout_description: 'Partitions & Groove Tray', components_summary: 'Partitions, Groove Tray, 27 Bins (Mixed)', cell_width_mm: 50, cell_depth_mm: 50, cell_count: 27 },

  // --- SERIES 94 (1010mm Wide / Standard Depth 'S') ---
  { id: 'ps-94-x-3-3', type: 'partition_set', width_mm: 1010, depth_type: 'S', code_base: 'PS.94.X.3.3', price: 75, supported_drawer_heights_mm: [75, 100, 150, 225, 300], layout_description: '75mm x 75mm (72 Compartments)', cell_width_mm: 75, cell_depth_mm: 75, cell_count: 72 },
];

export const getPartitionOptions = (widthMm: number, depthMm: number, drawerHeight: number) => {
  const isDeep = depthMm > 700;
  const depthType = isDeep ? 'D' : 'S';

  return INTERIOR_OPTIONS.filter(p => {
    if (p.width_mm !== widthMm) return false;
    if (p.depth_type !== depthType) return false;
    if (!p.supported_drawer_heights_mm.includes(drawerHeight)) return false;
    return true;
  });
};

export const getPartitionById = (id: string) => INTERIOR_OPTIONS.find(p => p.id === id);

export const resolvePartitionCode = (option: DrawerInteriorOption, drawerHeight: number): string => {
  if (option.code_base.includes('X')) {
    return option.code_base.replace('X', drawerHeight.toString());
  }
  return option.code_base;
};


// --- DRAWER ACCESSORIES ---
// Individual items that can be added to any drawer (separate from pre-configured sets)

export const DRAWER_ACCESSORIES: DrawerAccessory[] = [
  // ==========================================================
  // STEEL PARTITIONS (P.X.depth)
  // Run front to rear, slotted at 25mm increments for dividers
  // X = drawer height (75/100/150/225/300)
  // ==========================================================
  { 
    id: 'part-450', 
    category: 'partition', 
    code_base: 'P.X.450', 
    name: 'Steel Partition 450mm', 
    description: '450mm depth steel partition (S Series) - front to rear',
    price: 15,
    depth_mm: 450,
    supported_drawer_heights_mm: [75, 100, 150, 225, 300]
  },
  { 
    id: 'part-600', 
    category: 'partition', 
    code_base: 'P.X.600', 
    name: 'Steel Partition 600mm', 
    description: '600mm depth steel partition (D Series) - front to rear',
    price: 18,
    depth_mm: 600,
    supported_drawer_heights_mm: [75, 100, 150, 225, 300]
  },

  // ==========================================================
  // STEEL DRAWER TRAYS (T.height.width.depth)
  // Removable compartments for holding contents
  // S Series = 450mm depth, D Series = 600mm depth
  // ==========================================================
  { 
    id: 'tray-50-450', 
    category: 'tray', 
    code_base: 'T.75.50.450', 
    name: 'Steel Tray 50mm (S)', 
    description: '50mm (h) x 50mm (w) removable tray - 450mm deep (S Series)',
    price: 10,
    width_mm: 50,
    height_mm: 50,
    depth_mm: 450,
    supported_drawer_heights_mm: [75, 100, 150, 225, 300]
  },
  { 
    id: 'tray-50-600', 
    category: 'tray', 
    code_base: 'T.75.50.600', 
    name: 'Steel Tray 50mm (D)', 
    description: '50mm (h) x 50mm (w) removable tray - 600mm deep (D Series)',
    price: 12,
    width_mm: 50,
    height_mm: 50,
    depth_mm: 600,
    supported_drawer_heights_mm: [75, 100, 150, 225, 300]
  },
  { 
    id: 'tray-100-450', 
    category: 'tray', 
    code_base: 'T.75.100.450', 
    name: 'Steel Tray 100mm (S)', 
    description: '50mm (h) x 100mm (w) removable tray - 450mm deep (S Series)',
    price: 13,
    width_mm: 100,
    height_mm: 50,
    depth_mm: 450,
    supported_drawer_heights_mm: [75, 100, 150, 225, 300]
  },
  { 
    id: 'tray-100-600', 
    category: 'tray', 
    code_base: 'T.75.100.600', 
    name: 'Steel Tray 100mm (D)', 
    description: '50mm (h) x 100mm (w) removable tray - 600mm deep (D Series)',
    price: 15,
    width_mm: 100,
    height_mm: 50,
    depth_mm: 600,
    supported_drawer_heights_mm: [75, 100, 150, 225, 300]
  },

  // ==========================================================
  // TRAY DIVIDERS (TD.75.xx)
  // ==========================================================
  { 
    id: 'td-50', 
    category: 'tray_divider', 
    code_base: 'TD.75.50', 
    name: 'Tray Divider 50mm', 
    description: '50mm (h) tray divider',
    price: 5,
    height_mm: 50,
    supported_drawer_heights_mm: [75, 100, 150, 225, 300]
  },
  { 
    id: 'td-100', 
    category: 'tray_divider', 
    code_base: 'TD.75.100', 
    name: 'Tray Divider 100mm', 
    description: '100mm (h) tray divider',
    price: 6,
    height_mm: 100,
    supported_drawer_heights_mm: [100, 150, 225, 300]
  },

  // ==========================================================
  // POWDERCOATED STEEL DIVIDERS (D.X.xxx)
  // Run left to right, interconnect with partitions
  // ==========================================================
  { id: 'div-steel-75', category: 'divider_steel', code_base: 'D.X.75', name: 'Steel Divider 75mm', description: '75mm width powdercoated steel divider', price: 8, width_mm: 75, supported_drawer_heights_mm: [75, 100, 150, 225, 300] },
  { id: 'div-steel-100', category: 'divider_steel', code_base: 'D.X.100', name: 'Steel Divider 100mm', description: '100mm width powdercoated steel divider', price: 9, width_mm: 100, supported_drawer_heights_mm: [75, 100, 150, 225, 300] },
  { id: 'div-steel-150', category: 'divider_steel', code_base: 'D.X.150', name: 'Steel Divider 150mm', description: '150mm width powdercoated steel divider', price: 10, width_mm: 150, supported_drawer_heights_mm: [75, 100, 150, 225, 300] },
  { id: 'div-steel-200', category: 'divider_steel', code_base: 'D.X.200', name: 'Steel Divider 200mm', description: '200mm width powdercoated steel divider', price: 11, width_mm: 200, supported_drawer_heights_mm: [75, 100, 150, 225, 300] },
  { id: 'div-steel-225', category: 'divider_steel', code_base: 'D.X.225', name: 'Steel Divider 225mm', description: '225mm width powdercoated steel divider', price: 12, width_mm: 225, supported_drawer_heights_mm: [75, 100, 150, 225, 300] },
  { id: 'div-steel-250', category: 'divider_steel', code_base: 'D.X.250', name: 'Steel Divider 250mm', description: '250mm width powdercoated steel divider', price: 13, width_mm: 250, supported_drawer_heights_mm: [75, 100, 150, 225, 300] },
  { id: 'div-steel-300', category: 'divider_steel', code_base: 'D.X.300', name: 'Steel Divider 300mm', description: '300mm width powdercoated steel divider', price: 14, width_mm: 300, supported_drawer_heights_mm: [75, 100, 150, 225, 300] },
  { id: 'div-steel-350', category: 'divider_steel', code_base: 'D.X.350', name: 'Steel Divider 350mm', description: '350mm width powdercoated steel divider', price: 15, width_mm: 350, supported_drawer_heights_mm: [75, 100, 150, 225, 300] },
  { id: 'div-steel-450', category: 'divider_steel', code_base: 'D.X.450', name: 'Steel Divider 450mm', description: '450mm width powdercoated steel divider', price: 17, width_mm: 450, supported_drawer_heights_mm: [75, 100, 150, 225, 300] },

  // ==========================================================
  // ALUMINIUM DIVIDERS (D.X-A.xxx)
  // ==========================================================
  { id: 'div-alu-75', category: 'divider_alu', code_base: 'D.X-A.75', name: 'Aluminium Divider 75mm', description: '75mm width aluminium divider', price: 10, width_mm: 75, supported_drawer_heights_mm: [75, 100, 150] },
  { id: 'div-alu-100', category: 'divider_alu', code_base: 'D.X-A.100', name: 'Aluminium Divider 100mm', description: '100mm width aluminium divider', price: 11, width_mm: 100, supported_drawer_heights_mm: [75, 100, 150] },
  { id: 'div-alu-150', category: 'divider_alu', code_base: 'D.X-A.150', name: 'Aluminium Divider 150mm', description: '150mm width aluminium divider', price: 12, width_mm: 150, supported_drawer_heights_mm: [75, 100, 150] },
  { id: 'div-alu-200', category: 'divider_alu', code_base: 'D.X-A.200', name: 'Aluminium Divider 200mm', description: '200mm width aluminium divider', price: 13, width_mm: 200, supported_drawer_heights_mm: [75, 100, 150] },
  { id: 'div-alu-250', category: 'divider_alu', code_base: 'D.X-A.250', name: 'Aluminium Divider 250mm', description: '250mm width aluminium divider', price: 15, width_mm: 250, supported_drawer_heights_mm: [75, 100, 150] },
  { id: 'div-alu-350', category: 'divider_alu', code_base: 'D.X-A.350', name: 'Aluminium Divider 350mm', description: '350mm width aluminium divider', price: 17, width_mm: 350, supported_drawer_heights_mm: [75, 100, 150] },
  { id: 'div-alu-450', category: 'divider_alu', code_base: 'D.X-A.450', name: 'Aluminium Divider 450mm', description: '450mm width aluminium divider', price: 19, width_mm: 450, supported_drawer_heights_mm: [75, 100, 150] },

  // ==========================================================
  // BLUE PLASTIC DIVIDERS (D.X-P.xxx)
  // ==========================================================
  { id: 'div-plastic-75', category: 'divider_plastic', code_base: 'D.X-P.75', name: 'Plastic Divider 75mm', description: '75mm width blue plastic divider', price: 6, width_mm: 75, supported_drawer_heights_mm: [75, 100, 150] },
  { id: 'div-plastic-100', category: 'divider_plastic', code_base: 'D.X-P.100', name: 'Plastic Divider 100mm', description: '100mm width blue plastic divider', price: 7, width_mm: 100, supported_drawer_heights_mm: [75, 100, 150] },
  { id: 'div-plastic-150', category: 'divider_plastic', code_base: 'D.X-P.150', name: 'Plastic Divider 150mm', description: '150mm width blue plastic divider', price: 8, width_mm: 150, supported_drawer_heights_mm: [75, 100, 150] },
  { id: 'div-plastic-200', category: 'divider_plastic', code_base: 'D.X-P.200', name: 'Plastic Divider 200mm', description: '200mm width blue plastic divider', price: 9, width_mm: 200, supported_drawer_heights_mm: [150, 225] },
  { id: 'div-plastic-225', category: 'divider_plastic', code_base: 'D.X-P.225', name: 'Plastic Divider 225mm', description: '225mm width blue plastic divider', price: 10, width_mm: 225, supported_drawer_heights_mm: [75, 100, 150, 225, 300] },

  // ==========================================================
  // PLASTIC DRAWER BINS (B55.xxx)
  // Suitable for 75mm high drawers
  // ==========================================================
  { id: 'bin-50-50', category: 'bin', code_base: 'B55.50.50', name: 'Plastic Bin 50x50', description: '50mm (h) x 50mm (w) x 50mm (d)', price: 3, width_mm: 50, height_mm: 50, depth_mm: 50, supported_drawer_heights_mm: [75] },
  { id: 'bin-100-50', category: 'bin', code_base: 'B55.100.50', name: 'Plastic Bin 100x50', description: '50mm (h) x 100mm (w) x 50mm (d)', price: 4, width_mm: 100, height_mm: 50, depth_mm: 50, supported_drawer_heights_mm: [75] },
  { id: 'bin-100-100', category: 'bin', code_base: 'B55.100.100', name: 'Plastic Bin 100x100', description: '50mm (h) x 100mm (w) x 100mm (d)', price: 5, width_mm: 100, height_mm: 50, depth_mm: 100, supported_drawer_heights_mm: [75] },
  { id: 'bin-200-100', category: 'bin', code_base: 'B55.200.100', name: 'Plastic Bin 200x100', description: '50mm (h) x 200mm (w) x 100mm (d)', price: 7, width_mm: 200, height_mm: 50, depth_mm: 100, supported_drawer_heights_mm: [75] },
  { id: 'bin-200-200', category: 'bin', code_base: 'B55.200.200', name: 'Plastic Bin 200x200', description: '50mm (h) x 200mm (w) x 200mm (d)', price: 10, width_mm: 200, height_mm: 50, depth_mm: 200, supported_drawer_heights_mm: [75] },

  // ==========================================================
  // GROOVE TRAYS (GT.xxx)
  // For sensitive tools and components
  // ==========================================================
  { 
    id: 'groove-tray-192', 
    category: 'groove_tray', 
    code_base: 'GT.28.192', 
    name: 'Groove Tray', 
    description: '28mm (h) x 192mm (w) x 195mm (d) groove tray',
    price: 25,
    width_mm: 192,
    height_mm: 28,
    depth_mm: 195,
    supported_drawer_heights_mm: [75, 100, 150, 225, 300]
  },
  { 
    id: 'groove-divider', 
    category: 'groove_divider', 
    code_base: 'GT.DIV', 
    name: 'Groove Tray Divider', 
    description: 'Divider for groove trays',
    price: 8,
    supported_drawer_heights_mm: [75, 100, 150, 225, 300]
  },

  // ==========================================================
  // FOAM INSERTS (BT.FOAM.xxx)
  // Pick 'n' pluck foam for custom layouts
  // ==========================================================
  { 
    id: 'foam-30-500', 
    category: 'foam', 
    code_base: 'BT.FOAM.30.500', 
    name: 'Foam Insert', 
    description: "30mm (h) x 500mm (w) x 300mm (d) Pick 'n' Pluck foam",
    price: 45,
    width_mm: 500,
    height_mm: 30,
    depth_mm: 300,
    supported_drawer_heights_mm: [75, 100, 150, 225, 300]
  },

  // ==========================================================
  // TOOL SUPPORTS (TS.xxx)
  // For spanners and irregular tools
  // ==========================================================
  { 
    id: 'tool-support-455', 
    category: 'tool_support', 
    code_base: 'TS.40.455', 
    name: 'Tool Support', 
    description: '40mm (h) x 455mm (w) mild steel tool support',
    price: 35,
    width_mm: 455,
    height_mm: 40,
    supported_drawer_heights_mm: [75, 100, 150, 225, 300]
  },
];

// Helper to resolve accessory code (replace X with drawer height)
export const resolveAccessoryCode = (accessory: DrawerAccessory, drawerHeight: number): string => {
  if (accessory.code_base.includes('X')) {
    return accessory.code_base.replace('X', drawerHeight.toString());
  }
  return accessory.code_base;
};

// Filter accessories by drawer height
export const filterAccessoriesForDrawer = (accessories: DrawerAccessory[], drawerHeight: number): DrawerAccessory[] => {
  return accessories.filter(acc => {
    if (acc.isVisible === false) return false;
    if (!acc.supported_drawer_heights_mm.includes(drawerHeight)) return false;
    return true;
  });
};

// Get accessory by ID
export const getAccessoryById = (id: string): DrawerAccessory | undefined => 
  DRAWER_ACCESSORIES.find(a => a.id === id);


// PDF Color Palette
const COLORS = [
  { id: 'col-mg', label: 'Monument Grey (MG)', value: '#292926', code: 'MG', priceDelta: 0, description: 'Finish - Texture' },
  { id: 'col-sg', label: 'Surfmist Grey (SG)', value: '#e5e7d9', code: 'SG', priceDelta: 0, description: 'Finish - Texture' },
  { id: 'col-lg', label: 'Light Grey (LG)', value: '#aaaaa4', code: 'LG', priceDelta: 50, description: 'Finish - Satin' },
  { id: 'col-lb', label: 'Light Blue (LB)', value: '#3c4e61', code: 'LB', priceDelta: 50, description: 'Finish - Satin' },
  { id: 'col-gg', label: 'Green (GG)', value: '#6d764f', code: 'GG', priceDelta: 50, description: 'Finish - Satin' },
  { id: 'col-cc', label: 'Cream (CC)', value: '#999482', code: 'CC', priceDelta: 50, description: 'Finish - Satin' },
  { id: 'col-dg', label: 'Dark Grey (DG)', value: '#545859', code: 'DG', priceDelta: 50, description: 'Finish - Satin' },
  { id: 'col-bk', label: 'Black (BK)', value: '#1a1b1c', code: 'BK', priceDelta: 50, description: 'Finish - Satin' },
  { id: 'col-db', label: 'Dark Blue (DB)', value: '#22293e', code: 'DB', priceDelta: 80, description: 'Finish - Gloss' },
  { id: 'col-bb', label: 'Bright Blue (BB)', value: '#3b557e', code: 'BB', priceDelta: 80, description: 'Finish - Gloss' },
  { id: 'col-mb', label: 'Mid Blue (MB)', value: '#2a3865', code: 'MB', priceDelta: 80, description: 'Finish - Gloss' },
  { id: 'col-yw', label: 'Yellow (YW)', value: '#d1b33e', code: 'YW', priceDelta: 80, description: 'Finish - Gloss' },
  { id: 'col-rd', label: 'Red (RD)', value: '#832224', code: 'RD', priceDelta: 80, description: 'Finish - Gloss' },
  { id: 'col-or', label: 'Orange (OR)', value: '#c67831', code: 'OR', priceDelta: 80, description: 'Finish - Gloss' },
];

export const CATALOG: ProductDefinition[] = [
  {
    id: 'prod-workbench-heavy',
    name: 'Heavy Duty Workbench',
    description: '1 Tonne static load capacity (UDL). Thick tubular construction with 80mm levelling feet. (Codes: WBH)',
    basePrice: 1200,
    groups: [
      {
        id: 'size',
        label: 'Workbench Size',
        type: 'radio',
        step: 1,
        description: 'Standard Height: 900mm | Depth: 750mm',
        options: [
          { id: 'w-1500', label: '1500mm Wide', value: 1500, code: '915', priceDelta: 0, meta: { width: 1.5 } },
          { id: 'w-1800', label: '1800mm Wide', value: 1800, code: '918', priceDelta: 150, meta: { width: 1.8 } },
          { id: 'w-2100', label: '2100mm Wide', value: 2100, code: '921', priceDelta: 300, meta: { width: 2.1 } },
        ]
      },
      {
        id: 'worktop',
        label: 'Bench Top Material',
        type: 'radio',
        step: 2,
        options: [
          { id: 'top-lam', label: 'Laminated Timber', value: 'lam', code: 'L', priceDelta: 0, meta: { color: '#a1a1aa' } },
          { id: 'top-oak', label: 'Oak Hardwood', value: 'oak', code: 'O', priceDelta: 350, meta: { color: '#d97706' } },
          { id: 'top-ss', label: 'Stainless Steel', value: 'ss', code: 'SS', priceDelta: 450, meta: { color: '#e4e4e7' } },
          { id: 'top-mild2', label: '2mm Mild Steel', value: 'mild', code: 'M2', priceDelta: 250, meta: { color: '#18181b' } },
          { id: 'top-mild3', label: '3mm Mild Steel', value: 'mild3', code: 'M3', priceDelta: 350, meta: { color: '#3f3f46' } },
          { id: 'top-galv', label: 'Galvanised Steel', value: 'galv', code: 'G', priceDelta: 200, meta: { color: '#9ca3af' } },
        ]
      },
      {
        id: 'under_bench',
        label: 'Under Bench Options',
        type: 'select',
        step: 3,
        options: [
          { id: 'B0', label: 'B0: Open Frame', value: 'B0', code: 'B0', priceDelta: 0 },
          { id: 'B1', label: 'B1: 1 Drawer Unit', value: 'B1', code: 'B1', priceDelta: 300 },
          { id: 'B2', label: 'B2: 2 Drawer Unit', value: 'B2', code: 'B2', priceDelta: 500 },
          { id: 'B3', label: 'B3: 3 Drawer Unit', value: 'B3', code: 'B3', priceDelta: 700 },
          { id: 'B4', label: 'B4: Mobile 5-Drawer Cabinet', value: 'B4', code: 'B4', priceDelta: 950 },
          { id: 'B5', label: 'B5: Mobile Cupboard', value: 'B5', code: 'B5', priceDelta: 850 },
          { id: 'B6', label: 'B6: Mobile 5-Drawer + 1 Drawer', value: 'B6', code: 'B6', priceDelta: 1250 },
          { id: 'B7', label: 'B7: Mobile Cupboard + 1 Drawer', value: 'B7', code: 'B7', priceDelta: 1150 },
          { id: 'B12', label: 'B12: Dual 3 Drawer Units', value: 'B12', code: 'B12', priceDelta: 1400 },
          { id: 'B13', label: 'B13: Mobile 5-Drawer + Cupboard', value: 'B13', code: 'B13', priceDelta: 1800 },
          { id: 'B14', label: 'B14: Undershelf', value: 'B14', code: 'B14', priceDelta: 150 },
          { id: 'B15', label: 'B15: Undershelf + 1 Drawer', value: 'B15', code: 'B15', priceDelta: 450 },
          { id: 'B16', label: 'B16: Undershelf + 2 Drawer Unit', value: 'B16', code: 'B16', priceDelta: 650 },
          { id: 'B17', label: 'B17: Undershelf + 3 Drawer Unit', value: 'B17', code: 'B17', priceDelta: 850 },
          { id: 'B18', label: 'B18: Undershelf + 1 Drawer', value: 'B18', code: 'B18', priceDelta: 450 },
          { id: 'B19', label: 'B19: Undershelf + 1 Drw + 2 Drw', value: 'B19', code: 'B19', priceDelta: 950 },
          { id: 'B20', label: 'B20: Undershelf + 1 Drw + 3 Drw', value: 'B20', code: 'B20', priceDelta: 1150 },
          { id: 'B21', label: 'B21: Undershelf + 5 Drawer Cabinet', value: 'B21', code: 'B21', priceDelta: 1200 },
          { id: 'B22', label: 'B22: Undershelf + 1 Drw + 5 Drawer', value: 'B22', code: 'B22', priceDelta: 1500 },
          { id: 'B23', label: 'B23: Undershelf + Cupboard', value: 'B23', code: 'B23', priceDelta: 900 },
          { id: 'B24', label: 'B24: Undershelf + 1 Drw + Cupboard', value: 'B24', code: 'B24', priceDelta: 1200 },
          { id: 'B25', label: 'B25: Undershelf + 5 Drw + Cupboard', value: 'B25', code: 'B25', priceDelta: 2000 },
          { id: 'B26', label: 'B26: Undershelf + Dual 5 Drawers', value: 'B26', code: 'B26', priceDelta: 2200 },
          { id: 'B27', label: 'B27: Undershelf + Dual Cupboards', value: 'B27', code: 'B27', priceDelta: 1700 },
          { id: 'B28', label: 'B28: Mobile 5 Drawer Cabinet', value: 'B28', code: 'B28', priceDelta: 950 },
        ]
      },
      {
        id: 'under_bench_pos',
        label: 'Unit Position',
        type: 'select',
        step: 3,
        defaultValue: 'pos-right',
        description: 'Position for single units (Mobile or Fixed).',
        options: [
          { id: 'pos-left', label: 'Left Side', value: 'left', code: 'PL', priceDelta: 0 },
          { id: 'pos-center', label: 'Centre', value: 'center', code: 'PC', priceDelta: 0 },
          { id: 'pos-right', label: 'Right Side', value: 'right', code: 'PR', priceDelta: 0 },
        ]
      },
      {
        id: 'above_bench',
        label: 'Above Bench Options',
        type: 'select',
        step: 4,
        options: [
          { id: 'T0', label: 'T0: None', value: 'T0', code: 'T0', priceDelta: 0 },
          { id: 'T1', label: 'T1: 3x Shelves', value: 'T1', code: 'T1', priceDelta: 350 },
          { id: 'T2', label: 'T2: 4x Shelves', value: 'T2', code: 'T2', priceDelta: 420 },
          { id: 'T3', label: 'T3: 2x Shelf + 2x Pegboard', value: 'T3', code: 'T3', priceDelta: 450 },
          { id: 'T4', label: 'T4: 2x Shelf + 2x Louvre', value: 'T4', code: 'T4', priceDelta: 450 },
          { id: 'T5', label: 'T5: 2x Shelf + Peg/Louvre', value: 'T5', code: 'T5', priceDelta: 450 },
          { id: 'T6', label: 'T6: 1x Shelf + 4x Pegboard', value: 'T6', code: 'T6', priceDelta: 500 },
          { id: 'T7', label: 'T7: 1x Shelf + 4x Louvre', value: 'T7', code: 'T7', priceDelta: 500 },
          { id: 'T8', label: 'T8: 1x Shelf + 2x Peg/2x Louvre', value: 'T8', code: 'T8', priceDelta: 500 },
          { id: 'T9', label: 'T9: Fixed Shelf', value: 'T9', code: 'T9', priceDelta: 200 },
          { id: 'T10', label: 'T10: Inclined Shelf', value: 'T10', code: 'T10', priceDelta: 250 },
        ]
      },
      {
        id: 'shelf_incline',
        label: 'Shelf Incline',
        type: 'radio',
        step: 4,
        defaultValue: 'inc-0',
        description: 'Angle setting for overhead shelves.',
        options: [
          { id: 'inc-0', label: 'Flat (0°)', value: 0, code: 'I0', priceDelta: 0 },
          { id: 'inc-15', label: '15° Incline', value: 15, code: 'I15', priceDelta: 0 },
          { id: 'inc-30', label: '30° Incline', value: 30, code: 'I30', priceDelta: 0 },
        ]
      },
      {
        id: 'hanging_kits',
        label: 'Tool Hanging Accessories (Kits)',
        type: 'select',
        step: 5,
        description: 'Pre-configured kits for pegboard panels.',
        options: [
          { id: 'kit-none', label: 'None', value: 'none', code: '', priceDelta: 0 },
          { id: 'kit-red', label: 'Red Kit (44 Pieces)', value: 'red', code: 'HK-RED', priceDelta: 145, description: 'Recommended for 720mm & 1440mm wide panels' },
          { id: 'kit-green', label: 'Green Kit (76 Pieces)', value: 'green', code: 'HK-GRN', priceDelta: 220, description: 'Recommended for 2052mm wide panels' },
        ]
      },
      {
        id: 'individual_accessories',
        label: 'Individual Accessories',
        type: 'qty_list',
        step: 5,
        description: 'Select quantity for individual hooks and holders.',
        options: [
           { id: 'acc-mph', label: 'Multi-Purpose Holder', value: 0, code: 'A-MPH', priceDelta: 12 },
           { id: 'acc-sp100', label: 'Single Pin (100mm)', value: 0, code: 'A-SP100', priceDelta: 5 },
           { id: 'acc-sh', label: 'Spanner Holder', value: 0, code: 'A-SH', priceDelta: 15 },
           { id: 'acc-sp25', label: 'Single Pin (25mm)', value: 0, code: 'A-SP25', priceDelta: 4 },
           { id: 'acc-ush', label: 'U Shape Holder', value: 0, code: 'A-USH', priceDelta: 8 },
           { id: 'acc-th', label: 'Tool Hook', value: 0, code: 'A-TH', priceDelta: 6 },
           { id: 'acc-rh', label: 'Round Hook', value: 0, code: 'A-RH', priceDelta: 6 },
           { id: 'acc-dh', label: 'Double Hook', value: 0, code: 'A-DH', priceDelta: 7 },
           { id: 'acc-mh', label: 'Multi Hook', value: 0, code: 'A-MH', priceDelta: 10 },
           { id: 'acc-saw', label: 'Saw Holder', value: 0, code: 'A-SAW', priceDelta: 12 },
           { id: 'acc-sdh', label: 'Screwdriver Holder', value: 0, code: 'A-SDH', priceDelta: 15 },
           { id: 'acc-dbh', label: 'Drill Bit Holder', value: 0, code: 'A-DBH', priceDelta: 15 },
           { id: 'acc-trh', label: 'Tri Hook', value: 0, code: 'A-TRH', priceDelta: 8 },
           { id: 'acc-akh', label: 'Allen Key Holder', value: 0, code: 'A-AKH', priceDelta: 14 },
        ]
      },
      {
        id: 'mobility',
        label: 'Mobility',
        type: 'checkbox',
        step: 6,
        options: [
          { id: 'castors', label: 'Heavy Duty Lockable Castors', value: true, code: 'C', priceDelta: 180 },
        ]
      },
      {
        id: 'color',
        label: 'Frame & Carcass Colour',
        type: 'color',
        step: 7,
        options: COLORS
      },
      {
        id: 'drawer_facia',
        label: 'Drawer Facia Colour',
        type: 'color',
        step: 7,
        defaultValue: 'col-sg', // Surfmist default
        options: COLORS
      }
    ]
  },
  
  // 2. INDUSTRIAL WORKBENCH
  {
    id: 'prod-workbench-industrial',
    name: 'Industrial Workbench',
    description: 'Industrial Grade (800kg UDL). 800mm Deep. Ideal for assembly, packing and general heavy use.',
    basePrice: 950,
    groups: [
      {
        id: 'size',
        label: 'Workbench Size (Width)',
        type: 'radio',
        step: 1,
        options: [
          { id: 'iw-1200', label: '1200mm Wide', value: 1200, code: '1200', priceDelta: 0, meta: { width: 1.2 } },
          { id: 'iw-1500', label: '1500mm Wide', value: 1500, code: '1500', priceDelta: 150, meta: { width: 1.5 } },
          { id: 'iw-1800', label: '1800mm Wide', value: 1800, code: '1800', priceDelta: 300, meta: { width: 1.8 } },
        ]
      },
      {
        id: 'bench_height',
        label: 'Bench Height',
        type: 'radio',
        step: 1,
        defaultValue: 'h-900',
        options: [
          { id: 'h-700', label: '700mm High', value: 700, code: '700', priceDelta: 0, meta: { height: 0.7 } },
          { id: 'h-900', label: '900mm High', value: 900, code: '900', priceDelta: 50, meta: { height: 0.9 } },
          { id: 'h-adj', label: 'Adjustable Legs', value: 900, code: 'ADJ', priceDelta: 150, meta: { height: 0.9 }, description: 'Varies height 740mm - 1040mm' },
        ]
      },
      {
        id: 'worktop',
        label: 'Bench Top Material',
        type: 'select',
        step: 2,
        options: [
          { id: 'iw-top-mild', label: 'Mild Steel (3mm)', value: 'mild', code: 'M', priceDelta: 0, meta: { color: '#3f3f46' } },
          { id: 'iw-top-formica', label: 'Formica (White)', value: 'formica', code: 'F', priceDelta: 50, meta: { color: '#f3f4f6' } }, // White
          { id: 'iw-top-masonite', label: 'Masonite', value: 'masonite', code: 'MAS', priceDelta: 80, meta: { color: '#7c5e42' } },
          { id: 'iw-top-hardwood', label: 'Oak Hardwood', value: 'hardwood', code: 'HW', priceDelta: 300, meta: { color: '#d97706' } },
          { id: 'iw-top-ss', label: 'Stainless Steel', value: 'ss', code: 'SS', priceDelta: 400, meta: { color: '#e4e4e7' } },
          { id: 'iw-top-duraloid', label: 'Duraloid', value: 'duraloid', code: 'DUR', priceDelta: 150, meta: { color: '#525252' } },
          { id: 'iw-top-antistatic', label: 'Anti-Static', value: 'antistatic', code: 'AS', priceDelta: 250, meta: { color: '#d4d4d8' } },
        ]
      },
      {
        id: 'under_bench',
        label: 'Under Bench Options',
        type: 'select',
        step: 3,
        options: [
           { id: 'iw-ub-none', label: 'Open Frame', value: 'none', code: '00', priceDelta: 0 },
           { id: 'iw-ub-shelf', label: 'Full Under Shelf', value: 'shelf', code: 'US', priceDelta: 120 },
           { id: 'iw-ub-half-shelf', label: 'Half Under Shelf', value: 'half_shelf', code: 'HUS', priceDelta: 80 },
           
           // Single Units
           { id: 'iw-ub-drawer-1', label: 'Single Drawer Unit', value: 'dr1', code: 'D1', priceDelta: 350 },
           { id: 'iw-ub-door-1', label: 'Single Cupboard Unit (Door)', value: 'door1', code: 'DOR', priceDelta: 400 },
           { id: 'iw-ub-cabinet-1', label: '1x High Density Cabinet', value: 'cab1', code: 'C1', priceDelta: 850 },
           
           // Dual Units
           { id: 'iw-ub-drawer-2', label: '2x Single Drawer Units', value: 'dr2', code: 'D2', priceDelta: 700 },
           { id: 'iw-ub-door-2', label: '2x Cupboard Units (Doors)', value: 'door2', code: 'DOR2', priceDelta: 800 },
           { id: 'iw-ub-cabinet-2', label: '2x High Density Cabinets', value: 'cab2', code: 'C2', priceDelta: 1700 },
           
           // Mixed Storage (Cabinet Base)
           { id: 'iw-ub-cabinet-door', label: '1x Cabinet + 1x Cupboard', value: 'cab_door', code: 'CD', priceDelta: 1250 },
           { id: 'iw-ub-cabinet-drawer', label: '1x Cabinet + 1x Drawer', value: 'cab_dr', code: 'CD1', priceDelta: 1200 },
           
           // Mixed Storage (Other)
           { id: 'iw-ub-door-drawer', label: '1x Cupboard + 1x Drawer', value: 'door_dr', code: 'DD1', priceDelta: 750 },

           // Shelf Combinations
           { id: 'iw-ub-shelf-drawer', label: 'Full Shelf + 1 Drawer', value: 'shelf_dr1', code: 'SD1', priceDelta: 470 },
           { id: 'iw-ub-drawers-2-shelf', label: 'Full Shelf + 2x Drawers', value: 'dr2_us', code: '2D1US', priceDelta: 820 },
           
           // Half Shelf Combinations
           { id: 'iw-ub-drawer-half-shelf', label: 'Half Shelf + 1 Drawer', value: 'dr1_hs', code: 'D1HS', priceDelta: 430 },
           { id: 'iw-ub-shelf-cabinet', label: 'Half Shelf + Cabinet', value: 'shelf_cab', code: 'SC', priceDelta: 930 },
           { id: 'iw-ub-shelf-door', label: 'Half Shelf + Cupboard', value: 'shelf_door', code: 'SDOR', priceDelta: 520 },
           
           // Complex Half Shelf
           { id: 'iw-ub-half-shelf-drawer-cabinet', label: 'Half Shelf + 1 Drw + Cabinet', value: 'hs_dr_cab', code: 'SDC', priceDelta: 1300 },
           { id: 'iw-ub-half-shelf-drawer-cupboard', label: 'Half Shelf + 1 Drw + Cupboard', value: 'hs_dr_cup', code: 'SDCP', priceDelta: 1100 },
        ]
      },
      {
        id: 'above_bench',
        label: 'Above Bench Accessories',
        type: 'select',
        step: 4,
        options: [
           { id: 'iw-ab-none', label: 'None', value: 'none', code: '00', priceDelta: 0 },
           { id: 'iw-ab-shelf', label: 'Adjustable Shelf', value: 'shelf', code: 'AS', priceDelta: 250 },
           { id: 'iw-ab-shelf-light', label: 'Shelf + Light Kit', value: 'shelf_light', code: 'SL', priceDelta: 450 },
           { id: 'iw-ab-power', label: 'Power Panel (Rail)', value: 'power', code: 'P', priceDelta: 300 },
           { id: 'iw-ab-shelf-power', label: 'Shelf + Power Panel', value: 'shelf_power', code: 'SP', priceDelta: 550 },
        ]
      },
      {
        id: 'accessories',
        label: 'Additional Accessories',
        type: 'qty_list',
        step: 5,
        options: [
           { id: 'acc-monitor', label: 'Monitor Stand (Clamped)', value: 0, code: 'MON', priceDelta: 180 },
        ]
      },
      {
        id: 'mobility',
        label: 'Mobility',
        type: 'checkbox',
        step: 6,
        options: [
           { id: 'iw-castors', label: 'Lockable Castor Kit', value: true, code: 'C', priceDelta: 160 },
        ]
      },
      {
        id: 'color',
        label: 'Frame Colour',
        type: 'color',
        step: 7,
        options: COLORS
      },
      {
        id: 'drawer_facia',
        label: 'Drawer Facia Colour',
        type: 'color',
        step: 7,
        defaultValue: 'col-sg',
        options: COLORS
      }
    ]
  },

  // 3. HIGH DENSITY CABINET
  {
    id: 'prod-hd-cabinet',
    name: 'High Density Cabinet',
    description: 'XT Shield coated cabinet with configurable high-density drawers. Auto-sorting stack logic.',
    basePrice: 850,
    groups: [
      { id: 'series', label: 'Series (Depth)', type: 'radio', step: 1, options: [{ id: 'series-s', label: 'S Series (605mm Deep)', value: 605, code: 'BTCS', priceDelta: 0, meta: { depth: 0.605 } }, { id: 'series-d', label: 'D Series (755mm Deep)', value: 755, code: 'BTCD', priceDelta: 150, meta: { depth: 0.755 } }] },
      { id: 'width', label: 'Cabinet Width', type: 'radio', step: 1, options: [{ id: 'w-560', label: '560mm', value: 560, code: '560', priceDelta: 0, meta: { width: 0.56 } }, { id: 'w-710', label: '710mm', value: 710, code: '710', priceDelta: 120, meta: { width: 0.71 } }, { id: 'w-1010', label: '1010mm', value: 1010, code: '1010', priceDelta: 250, meta: { width: 1.01 } }] },
      { id: 'height', label: 'Cabinet Height', type: 'select', step: 2, options: [
        { id: 'h-660', label: '660mm (Standard)', value: 660, code: '700', priceDelta: -100, meta: { height: 0.66, usableHeight: 525 } },
        { id: 'h-810', label: '810mm (Workbench Integrated)', value: 810, code: '810', priceDelta: -50, meta: { height: 0.81, usableHeight: 675 } },
        { id: 'h-850', label: '850mm (Bench Height)', value: 850, code: '850', priceDelta: 0, meta: { height: 0.85, usableHeight: 750 } }, 
        { id: 'h-1000', label: '1000mm', value: 1000, code: '1000', priceDelta: 100, meta: { height: 1.0, usableHeight: 900 } }, 
        { id: 'h-1200', label: '1200mm', value: 1200, code: '1200', priceDelta: 200, meta: { height: 1.2, usableHeight: 1100 } }, 
        { id: 'h-1450', label: '1450mm (Eye Level)', value: 1450, code: '1450', priceDelta: 350, meta: { height: 1.45, usableHeight: 1350 } }
      ] },
      { id: 'config', label: 'Drawer Configuration', type: 'drawer_stack', step: 3, description: 'Build your custom stack.', options: [
        { id: 'dr-75', label: '75mm Drawer', value: '75', code: '75', priceDelta: 120, meta: { front: 75, usable: 50, loadCapacity: 200 } }, 
        { id: 'dr-100', label: '100mm Drawer', value: '100', code: '100', priceDelta: 140, meta: { front: 100, usable: 75, loadCapacity: 200 } }, 
        { id: 'dr-150', label: '150mm Drawer', value: '150', code: '150', priceDelta: 160, meta: { front: 150, usable: 125, loadCapacity: 200 } }, 
        { id: 'dr-225', label: '225mm Drawer', value: '225', code: '225', priceDelta: 200, meta: { front: 225, usable: 200, loadCapacity: 200 } }, 
        { id: 'dr-300', label: '300mm Drawer', value: '300', code: '300', priceDelta: 240, meta: { front: 300, usable: 275, loadCapacity: 200 } }
      ] },
      { id: 'housing_color', label: 'Housing / Cavity Colour', type: 'color', step: 4, defaultValue: 'col-mg', description: 'Select the cabinet shell colour.', options: COLORS },
      { id: 'facia_color', label: 'Drawer Facia Colour', type: 'color', step: 5, defaultValue: 'col-sg', description: 'Select the drawer front colour.', options: COLORS }
    ]
  }
];
