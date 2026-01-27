/**
 * Argent Catalog Service
 * 
 * Converts Argent product data into the standard ProductDefinition format
 * used by the configurator.
 * 
 * Each Argent series is exposed as a separate ProductDefinition with
 * series-specific option groups for dimensions, doors, panels, locks, and accessories.
 */

import { ProductDefinition, OptionGroup, ProductAttribute } from '../../types';
import { TOOLBOX_COLOURS } from '../../data/catalog';
import {
  ARGENT_SERIES,
  ArgentSeriesKey,
  ArgentSeries,
  SecurityGrade,
  SecurityContext,
  SECURITY_CONTEXTS,
  getAvailableRuHeights,
  getAvailableWidths,
  getAvailableDepths,
  findDimensionConfig,
  getDimensionsForSeries,
  getDoorOptionsForSeries,
  getLockOptionsForSeries,
  getAccessoriesForSeries,
  SIDE_PANEL_OPTIONS,
  ARGENT_ACCESSORIES,
  generateArgentCode,
  evaluateCommercialRules,
} from './argentConstants';
import {
  PANEL_WIDTHS,
  HEIGHT_CALCULATION,
  DOORS as CAGE_DOORS,
  CAGE_LOCKS,
  CAGE_COMMERCIAL_RULES,
} from './argentDataCageConstants';

// ============================================================================
// OPTION BUILDERS
// ============================================================================

/**
 * Build RU height options for a series
 */
function buildRuHeightOptions(seriesKey: ArgentSeriesKey): ProductAttribute[] {
  const heights = getAvailableRuHeights(seriesKey);
  return heights.map(ru => ({
    id: `ru-${ru}`,
    label: `${ru}RU`,
    value: ru,
    code: String(ru),
    priceDelta: 0, // Price comes from dimension matrix
    meta: {
      heightMm: ru * 44.45, // Standard RU = 44.45mm
      displayLabel: `${ru} Rack Units`,
    },
    description: seriesKey === 'v50' 
      ? `${ru}RU secure compartment`
      : `${ru} rack units (${Math.round(ru * 44.45)}mm internal height)`,
  }));
}

/**
 * Build width options for a series
 * Note: Width options depend on selected RU height, but we show all possible widths
 * and filter in the UI based on RU selection
 */
function buildWidthOptions(seriesKey: ArgentSeriesKey): ProductAttribute[] {
  const widths = getAvailableWidths(seriesKey);
  
  // For V50, width is fixed at 19"
  if (seriesKey === 'v50') {
    return [{
      id: 'width-482',
      label: '19" Standard',
      value: 482,
      code: '482',
      priceDelta: 0,
      meta: { widthMm: 482 },
      description: 'Standard 19-inch rack width',
    }];
  }
  
  // For 40 series 2-post, width is fixed
  if (seriesKey === '40') {
    return [
      {
        id: 'width-482',
        label: '19" (2-Post)',
        value: 482,
        code: '482',
        priceDelta: 0,
        meta: { widthMm: 482, postType: '2-post' },
        description: 'Standard 19-inch width for 2-post frames',
      },
      {
        id: 'width-600',
        label: '600mm (4-Post)',
        value: 600,
        code: '600',
        priceDelta: 0,
        meta: { widthMm: 600, postType: '4-post' },
        description: '600mm width for 4-post frames',
      },
      {
        id: 'width-800',
        label: '800mm (4-Post)',
        value: 800,
        code: '800',
        priceDelta: 0,
        meta: { widthMm: 800, postType: '4-post' },
        description: '800mm width for 4-post frames',
      },
    ];
  }
  
  return widths.map(w => ({
    id: `width-${w}`,
    label: `${w}mm`,
    value: w,
    code: String(w),
    priceDelta: 0,
    meta: { widthMm: w },
    description: `${w}mm external width`,
  }));
}

/**
 * Build depth options for a series
 */
function buildDepthOptions(seriesKey: ArgentSeriesKey): ProductAttribute[] {
  const depths = getAvailableDepths(seriesKey);
  
  // V50 has adjustable depth (400-700mm to fit various rack depths)
  if (seriesKey === 'v50') {
    return [
      {
        id: 'depth-400',
        label: '400mm',
        value: 400,
        code: '400',
        priceDelta: 0,
        meta: { depthMm: 400 },
        description: 'Compact depth for shallow racks',
      },
      {
        id: 'depth-500',
        label: '500mm',
        value: 500,
        code: '500',
        priceDelta: 45,
        meta: { depthMm: 500 },
        description: 'Medium depth for standard equipment',
      },
      {
        id: 'depth-600',
        label: '600mm',
        value: 600,
        code: '600',
        priceDelta: 95,
        meta: { depthMm: 600 },
        description: 'Extended depth for larger servers',
      },
      {
        id: 'depth-700',
        label: '700mm',
        value: 700,
        code: '700',
        priceDelta: 145,
        meta: { depthMm: 700 },
        description: 'Maximum depth for deep racks',
      },
    ];
  }
  
  // 40 series - all configurations use depth (VCM cabinets need 600mm)
  if (seriesKey === '40') {
    // Standard depths for 40 series: 600, 800, 1000mm
    const standardDepths = [600, 800, 1000];
    return standardDepths.map(d => ({
      id: `depth-${d}`,
      label: `${d}mm`,
      value: d,
      code: String(d),
      priceDelta: 0,
      meta: { depthMm: d },
      description: `${d}mm depth`,
    }));
  }
  
  return depths.map(d => ({
    id: `depth-${d}`,
    label: `${d}mm`,
    value: d,
    code: String(d),
    priceDelta: 0,
    meta: { depthMm: d },
    description: `${d}mm external depth`,
  }));
}

/**
 * Build door options for a series
 */
function buildDoorOptions(seriesKey: ArgentSeriesKey): ProductAttribute[] {
  const doors = getDoorOptionsForSeries(seriesKey);
  return doors.map(door => ({
    id: door.id,
    label: door.label,
    value: door.id,
    code: door.code,
    priceDelta: door.priceDelta,
    meta: {
      doorType: door.type,
      securityCompatible: door.securityCompatible,
    },
    description: door.description,
  }));
}

/**
 * Build side panel options for a series
 */
function buildSidePanelOptions(seriesKey: ArgentSeriesKey): ProductAttribute[] {
  const panels = SIDE_PANEL_OPTIONS.filter(p => p.applicableSeries.includes(seriesKey));
  return panels.map(panel => ({
    id: panel.id,
    label: panel.label,
    value: panel.id,
    code: panel.code,
    priceDelta: panel.priceDelta,
    meta: {
      panelType: panel.type,
      securityRequired: panel.securityRequired,
    },
    description: panel.description,
  }));
}

/**
 * Build lock options for a series
 */
function buildLockOptions(seriesKey: ArgentSeriesKey): ProductAttribute[] {
  const locks = getLockOptionsForSeries(seriesKey);
  return locks.map(lock => ({
    id: lock.id,
    label: lock.label,
    value: lock.id,
    code: lock.code,
    priceDelta: lock.priceDelta,
    meta: {
      lockType: lock.type,
      securityLevel: lock.security,
      requiresConsult: lock.requiresConsult,
    },
    description: lock.description,
  }));
}

/**
 * Build security class options (50 Series only)
 */
function buildSecurityClassOptions(): ProductAttribute[] {
  return [
    {
      id: 'security-class-b',
      label: 'SCEC Class B',
      value: 'class_b',
      code: 'B',
      priceDelta: 0, // Base price includes Class B
      meta: {
        securityGrade: 'class_b',
        scecApproved: true,
      },
      description: 'SCEC-approved Class B security for sensitive but unclassified information.',
    },
    {
      id: 'security-class-c',
      label: 'SCEC Class C',
      value: 'class_c',
      code: 'C',
      priceDelta: 2000, // Premium for Class C
      meta: {
        securityGrade: 'class_c',
        scecApproved: true,
        requiresConsult: true,
      },
      description: 'SCEC-approved Class C security for SECRET and TOP SECRET classified information.',
    },
  ];
}

/**
 * Build security context options (V50 and security-focused products)
 * This is the first step in security-led configuration
 */
function buildSecurityContextOptions(seriesKey: ArgentSeriesKey): ProductAttribute[] {
  const contexts = SECURITY_CONTEXTS.filter(ctx => ctx.applicableSeries.includes(seriesKey));
  return contexts.map(ctx => ({
    id: `context-${ctx.id}`,
    label: ctx.label,
    value: ctx.id,
    code: ctx.id.toUpperCase().replace('_', ''),
    priceDelta: 0,
    meta: {
      securityContext: ctx.id,
      complianceMessages: ctx.complianceMessages,
      defaultOptions: ctx.defaultOptions,
    },
    description: ctx.description,
  }));
}

/**
 * Build post type options (40 Series only)
 */
function buildPostTypeOptions(): ProductAttribute[] {
  return [
    {
      id: 'post-2',
      label: '2-Post Frame',
      value: '2-post',
      code: '2P',
      priceDelta: 0,
      meta: {
        postCount: 2,
        maxLoad: 300, // kg
      },
      description: 'Two-post open frame for lightweight equipment. 300kg static load capacity.',
    },
    {
      id: 'post-4',
      label: '4-Post Frame',
      value: '4-post',
      code: '4P',
      priceDelta: 400,
      meta: {
        postCount: 4,
        maxLoad: 800, // kg
      },
      description: 'Four-post open frame for heavy equipment. 800kg static load capacity.',
    },
  ];
}

/**
 * Build accessory options for a series
 */
function buildAccessoryOptions(seriesKey: ArgentSeriesKey): ProductAttribute[] {
  const accessories = getAccessoriesForSeries(seriesKey);
  return accessories.map(acc => ({
    id: acc.id,
    label: acc.name,
    value: acc.id,
    code: acc.code,
    priceDelta: acc.price,
    meta: {
      category: acc.category,
      requiresSize: acc.requiresSize,
    },
    description: acc.description,
  }));
}

/**
 * Build paint colour options (matches HD toolbox colours)
 */
function buildPaintColourOptions(): ProductAttribute[] {
  return TOOLBOX_COLOURS.map(colour => ({
    id: colour.id,
    label: colour.label,
    value: colour.value,
    code: colour.code,
    priceDelta: colour.priceDelta,
    meta: { hex: colour.value, finish: colour.description },
    description: colour.description,
  }));
}

// ============================================================================
// OPTION GROUP BUILDERS
// ============================================================================

/**
 * Build mount type options (50 Series only - wall mount vs free standing)
 */
function buildMountTypeOptions(): ProductAttribute[] {
  return [
    {
      id: 'mount-wall',
      label: 'Wall Mount',
      value: 'wall_mount',
      code: 'WM',
      priceDelta: 0,
      meta: { mountType: 'wall_mount' },
      description: 'Wall mounted security rack. Available in 6RU, 12RU, and 18RU.',
    },
    {
      id: 'mount-freestanding',
      label: 'Free Standing',
      value: 'free_standing',
      code: 'FS',
      priceDelta: 0,
      meta: { mountType: 'free_standing' },
      description: 'Free standing floor rack. Available in 18RU to 46RU.',
    },
  ];
}

/**
 * Build option groups for a specific Argent series
 */
function buildOptionGroups(series: ArgentSeries): OptionGroup[] {
  const groups: OptionGroup[] = [];
  let step = 1;
  
  // ============================================================================
  // V50 DATA VAULT - Security-led configuration flow
  // ============================================================================
  if (series.key === 'v50') {
    // Step 1: Security Context (FIRST CHOICE - sets the tone)
    const contextOptions = buildSecurityContextOptions(series.key);
    if (contextOptions.length > 0) {
      groups.push({
        id: 'security-context',
        label: 'Security Environment',
        type: 'radio',
        options: contextOptions,
        defaultValue: 'context-shared_datacentre',
        step: step++,
        description: 'Select your security environment. This helps configure appropriate options.',
      });
    }
    
    // Step 2: RU Capacity (core variable for V50)
    groups.push({
      id: 'ru-height',
      label: 'Compartment Capacity',
      type: 'radio',
      options: buildRuHeightOptions(series.key),
      defaultValue: 'ru-4', // 4RU is common choice
      step: step++,
      description: 'Select the size of the secure compartment. Available in 2RU, 4RU, or 6RU.',
    });
    
    // Step 3: Depth (adjustable for V50)
    const depthOptions = buildDepthOptions(series.key);
    groups.push({
      id: 'depth',
      label: 'Enclosure Depth',
      type: 'radio',
      options: depthOptions,
      defaultValue: 'depth-500',
      step: step++,
      description: 'Select depth to match your rack and equipment. Depth is adjustable within range.',
    });
    
    // Step 4: Lock Configuration
    groups.push({
      id: 'lock',
      label: 'Lock Configuration',
      type: 'radio',
      options: buildLockOptions(series.key),
      defaultValue: 'lock-key-standard',
      step: step++,
      description: 'Front and rear keyed locks are standard. Upgrade options available.',
    });
    
    // Step 5: Accessories
    const accessories = getAccessoriesForSeries(series.key);
    if (accessories.length > 0) {
      groups.push({
        id: 'accessories',
        label: 'Accessories',
        type: 'accessory',
        options: accessories.map(acc => ({
          id: acc.id,
          label: acc.name,
          value: acc.id,
          code: acc.code,
          priceDelta: acc.price,
          meta: {
            category: acc.category,
            position: acc.position,
            includedStandard: acc.includedStandard,
            requiresConsult: acc.requiresConsult,
          },
          description: acc.description,
        })),
        step: step++,
        description: 'Add cable management, ventilation, and keying options.',
      });
    }
    
    return groups;
  }
  
  // ============================================================================
  // 50 SERIES - SCEC Security Racks
  // ============================================================================
  // Step 1: Security Classification (50 Series - FIRST CHOICE)
  if (series.key === '50') {
    groups.push({
      id: 'security-class',
      label: 'Security Classification',
      type: 'radio',
      options: buildSecurityClassOptions(),
      defaultValue: 'security-class-b',
      step: step++,
      description: 'Select the SCEC security classification. This determines the required lock type.',
    });
  }
  
  // Step 2: Mount Type (50 Series only - wall mount vs free standing)
  if (series.key === '50') {
    groups.push({
      id: 'mount-type',
      label: 'Mount Type',
      type: 'radio',
      options: buildMountTypeOptions(),
      defaultValue: 'mount-freestanding',
      step: step++,
      description: 'Select wall mount or free standing configuration.',
    });
  }
  
  // ============================================================================
  // STANDARD SERIES (10, 25, 40)
  // ============================================================================
  // Step: RU Height
  groups.push({
    id: 'ru-height',
    label: 'Rack Units (RU)',
    type: 'select',
    options: buildRuHeightOptions(series.key),
    defaultValue: buildRuHeightOptions(series.key)[0]?.id,
    step: step++,
    description: series.key === '50'
      ? 'Select the height of the rack. Options vary based on mount type.'
      : 'Select the height of the rack in standard rack units.',
  });
  
  // Step: Frame type (40 Series only)
  if (series.key === '40') {
    groups.push({
      id: 'post-type',
      label: 'Frame Type',
      type: 'radio',
      options: buildPostTypeOptions(),
      defaultValue: 'post-4',
      step: step++,
      description: 'Choose between 2-post or 4-post frame configuration.',
    });
  }
  
  // Step: Width
  const widthOptions = buildWidthOptions(series.key);
  if (widthOptions.length > 1) {
    groups.push({
      id: 'width',
      label: 'Width',
      type: 'select',
      options: widthOptions,
      defaultValue: widthOptions[0]?.id,
      step: step++,
      description: 'Select the external width of the rack.',
    });
  }
  
  // Step: Depth
  const depthOptions = buildDepthOptions(series.key);
  if (depthOptions.length > 1) {
    groups.push({
      id: 'depth',
      label: 'Depth',
      type: 'select',
      options: depthOptions,
      defaultValue: depthOptions.find(d => d.value > 0)?.id || depthOptions[0]?.id,
      step: step++,
      description: 'Select the external depth of the rack.',
    });
  }
  
  // Security Classification already added as first step for 50 Series
  
  // Step: Door Options (enclosure types only)
  if (['10', '25', '50'].includes(series.key)) {
    const doorOptions = buildDoorOptions(series.key);
    if (doorOptions.length > 0) {
      groups.push({
        id: 'front-door',
        label: 'Front Door',
        type: 'radio',
        options: doorOptions,
        defaultValue: doorOptions[0]?.id,
        step: step++,
        description: 'Select the front door type.',
      });
      
      // Hinge side option
      groups.push({
        id: 'hinge-side',
        label: 'Door Hinge Side',
        type: 'radio',
        options: [
          { id: 'hinge-left', label: 'Left Hand Hinged', value: 'hinge-left', description: 'Door hinges on left, opens to right' },
          { id: 'hinge-right', label: 'Right Hand Hinged', value: 'hinge-right', description: 'Door hinges on right, opens to left' },
        ],
        defaultValue: 'hinge-left',
        step: step++,
        description: 'Select which side the door hinges are mounted.',
      });
      
      // Rear door (same options for 25 and 50 series)
      if (series.key !== '10') {
        groups.push({
          id: 'rear-door',
          label: 'Rear Door',
          type: 'radio',
          options: doorOptions,
          defaultValue: doorOptions[0]?.id,
          step: step++,
          description: 'Select the rear door type.',
        });
      }
    }
  }
  
  // Step: Side Panels
  const panelOptions = buildSidePanelOptions(series.key);
  if (panelOptions.length > 0) {
    groups.push({
      id: 'side-panels',
      label: 'Side Panels',
      type: 'radio',
      options: panelOptions,
      defaultValue: panelOptions[0]?.id,
      step: step++,
      description: 'Select side panel configuration.',
    });
  }

  // Step: Frame Colour (all series)
  groups.push({
    id: 'frame-colour',
    label: 'Frame Colour',
    type: 'color',
    options: buildPaintColourOptions(),
    defaultValue: 'col-bk',
    step: step++,
    description: 'Select the frame finish.',
  });

  // Step: Door Colour (all enclosed series)
  if (series.key !== '40') {
    groups.push({
      id: 'door-colour',
      label: 'Door Colour',
      type: 'color',
      options: buildPaintColourOptions(),
      defaultValue: 'col-bk',
      step: step++,
      description: 'Select the door finish.',
    });
  }
  
  // Step: Lock Options
  const lockOptions = buildLockOptions(series.key);
  if (lockOptions.length > 0) {
    groups.push({
      id: 'lock',
      label: 'Lock Type',
      type: 'radio',
      options: lockOptions,
      defaultValue: lockOptions[0]?.id,
      step: step++,
      description: series.key === '50'
        ? 'Select the security-rated lock for this rack.'
        : 'Select the lock type.',
    });
    
    // Lock Quantity - 1 for front only, 2 for front and rear
    groups.push({
      id: 'lock-qty',
      label: 'Lock Quantity',
      type: 'qty',
      min: 1,
      max: 2,
      defaultValue: 1,
      step: step++,
      description: 'Qty 1 = Front door only. Qty 2 = Front and rear doors.',
    });
  }
  
  // Step: Accessories (qty_list for multiple accessories)
  const accessoryOptions = buildAccessoryOptions(series.key);
  if (accessoryOptions.length > 0) {
    groups.push({
      id: 'accessories',
      label: 'Accessories',
      type: 'qty_list',
      options: accessoryOptions,
      defaultValue: {},
      step: step++,
      description: 'Add optional accessories to your configuration.',
    });
  }
  
  return groups;
}

// ============================================================================
// PRODUCT DEFINITION BUILDERS
// ============================================================================

/**
 * Convert an Argent series to a ProductDefinition
 */
function seriesToProductDefinition(series: ArgentSeries): ProductDefinition {
  // Get base price from first standard dimension
  const basePrice = (() => {
    const heights = getAvailableRuHeights(series.key);
    const defaultHeight = heights[0];
    const widths = getAvailableWidths(series.key, defaultHeight);
    const defaultWidth = widths[0] || 0;
    const depths = getAvailableDepths(series.key, defaultHeight, defaultWidth);
    const defaultDepth = depths.find(d => d > 0) || depths[0] || 0;
    
    const config = findDimensionConfig(series.key, defaultHeight, defaultWidth, defaultDepth);
    return config?.basePrice || 0;
  })();
  
  const product = {
    id: `argent-${series.key}-series`,
    name: series.name,
    description: series.description,
    basePrice,
    image: `/argent-${series.key}-series.jpg`, // TODO: Add actual images
    groups: buildOptionGroups(series),
    argentDimensions: getDimensionsForSeries(series.key),
  };

  return product as ProductDefinition;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Build option groups for Data Cage (plan-based configurator)
 */
function buildDataCageOptionGroups(): OptionGroup[] {
  const groups: OptionGroup[] = [];
  let step = 1;
  
  // Step 1: Ceiling Height (drives infill panel calculation)
  groups.push({
    id: 'ceiling-height',
    label: 'Site Ceiling Height',
    type: 'select',
    step: step++,
    options: [
      { id: 'ceiling-2500', label: '2500mm', priceDelta: 0 },
      { id: 'ceiling-2700', label: '2700mm', priceDelta: 0 },
      { id: 'ceiling-3000', label: '3000mm', priceDelta: 0 },
      { id: 'ceiling-3200', label: '3200mm', priceDelta: 0 },
      { id: 'ceiling-3500', label: '3500mm (Standard)', priceDelta: 0 },
      { id: 'ceiling-3800', label: '3800mm', priceDelta: 0 },
      { id: 'ceiling-4000', label: '4000mm', priceDelta: 0 },
      { id: 'ceiling-custom', label: 'Custom Height (specify)', priceDelta: 0 },
    ],
    description: 'Select your site ceiling height. Panels will be calculated to fit.',
  });
  
  // Step 2: Cage Length (front-to-rear)
  groups.push({
    id: 'cage-length',
    label: 'Cage Length',
    type: 'select',
    step: step++,
    options: [
      { id: 'length-1800', label: '1800mm (2 panels)', priceDelta: 0 },
      { id: 'length-2700', label: '2700mm (3 panels)', priceDelta: 0 },
      { id: 'length-3600', label: '3600mm (4 panels)', priceDelta: 0 },
      { id: 'length-4500', label: '4500mm (5 panels)', priceDelta: 0 },
      { id: 'length-5400', label: '5400mm (6 panels)', priceDelta: 0 },
      { id: 'length-6300', label: '6300mm (7 panels)', priceDelta: 0 },
      { id: 'length-7200', label: '7200mm (8 panels)', priceDelta: 0 },
      { id: 'length-custom', label: 'Custom Length (specify)', priceDelta: 0 },
    ],
    description: 'Select cage length (front-to-rear depth). Snaps to 900mm panel modules.',
  });
  
  // Step 3: Cage Width (left-to-right)
  groups.push({
    id: 'cage-width',
    label: 'Cage Width',
    type: 'select',
    step: step++,
    options: [
      { id: 'width-1800', label: '1800mm (2 panels)', priceDelta: 0 },
      { id: 'width-2700', label: '2700mm (3 panels)', priceDelta: 0 },
      { id: 'width-3600', label: '3600mm (4 panels)', priceDelta: 0 },
      { id: 'width-4500', label: '4500mm (5 panels)', priceDelta: 0 },
      { id: 'width-5400', label: '5400mm (6 panels)', priceDelta: 0 },
      { id: 'width-6300', label: '6300mm (7 panels)', priceDelta: 0 },
      { id: 'width-7200', label: '7200mm (8 panels)', priceDelta: 0 },
      { id: 'width-custom', label: 'Custom Width (specify)', priceDelta: 0 },
    ],
    description: 'Select cage width (left-to-right span). Snaps to 900mm panel modules.',
  });
  
  // Step 4: Door Location
  groups.push({
    id: 'door-face',
    label: 'Primary Door Location',
    type: 'radio',
    step: step++,
    options: [
      { id: 'door-front', label: 'Front Face', priceDelta: 0 },
      { id: 'door-rear', label: 'Rear Face', priceDelta: 0 },
      { id: 'door-left', label: 'Left Side', priceDelta: 0 },
      { id: 'door-right', label: 'Right Side', priceDelta: 0 },
    ],
    description: 'Select which face the primary door will be installed on.',
  });
  
  // Step 5: Additional Doors
  groups.push({
    id: 'additional-doors',
    label: 'Additional Doors',
    type: 'select',
    step: step++,
    options: [
      { id: 'doors-0', label: 'No additional doors', priceDelta: 0 },
      { id: 'doors-1', label: '1 additional door', priceDelta: CAGE_DOORS[0].price },
      { id: 'doors-2', label: '2 additional doors', priceDelta: CAGE_DOORS[0].price * 2 },
      { id: 'doors-3', label: '3 additional doors', priceDelta: CAGE_DOORS[0].price * 3 },
    ],
    description: 'Add extra door openings for multiple access points.',
  });
  
  // Step 6: Lock Type
  groups.push({
    id: 'lock-type',
    label: 'Lock Type',
    type: 'radio',
    step: step++,
    options: CAGE_LOCKS.map(lock => ({
      id: lock.id,
      label: lock.name,
      priceDelta: lock.price,
    })),
    description: 'Select lock type for all door assemblies.',
  });
  
  // Step 7: Installation Notes
  groups.push({
    id: 'installation-notes',
    label: 'Site & Installation Notes',
    type: 'text',
    step: step++,
    options: [],
    description: 'Provide any site-specific requirements, access constraints, or installation notes.',
  });
  
  return groups;
}

/**
 * Create the Data Cage product definition
 */
function createDataCageProduct(): ProductDefinition {
  return {
    id: 'argent-data-cage',
    name: 'Argent Commercial Data Cage',
    description: 'Modular floor-mounted security enclosure for server racks. Creates controlled access zones in shared data centres and enterprise facilities. Plan-based configuration with posts, panels, and doors.',
    basePrice: 0, // Quote-driven
    image: '/argent-data-cage.jpg',
    groups: buildDataCageOptionGroups(),
    series: 'data-cage',
    // Custom flags for plan-based configurator
    isDataCage: true,
    isPlanBased: true,
    requiresQuote: true,
  } as ProductDefinition & { isDataCage: boolean; isPlanBased: boolean; requiresQuote: boolean };
}

/**
 * Get all Argent products as ProductDefinitions
 */
export function getArgentProducts(): ProductDefinition[] {
  // Get standard series-based products
  const seriesProducts = ARGENT_SERIES
    .filter(s => s.isActive)
    .map(seriesToProductDefinition);
  
  // Add Data Cage as a special product
  const dataCageProduct = createDataCageProduct();
  
  return [...seriesProducts, dataCageProduct];
}

/**
 * Get Argent products by series type
 */
export function getArgentProductsByType(
  type: 'enclosure' | 'open_frame' | 'security_enclosure' | 'in_rack_security'
): ProductDefinition[] {
  return ARGENT_SERIES
    .filter(s => s.isActive && s.type === type)
    .map(seriesToProductDefinition);
}

/**
 * Get a specific Argent product by series key
 */
export function getArgentProduct(seriesKey: ArgentSeriesKey): ProductDefinition | null {
  const series = ARGENT_SERIES.find(s => s.key === seriesKey);
  if (!series || !series.isActive) return null;
  return seriesToProductDefinition(series);
}

/**
 * Get series info for a product
 */
export function getArgentSeriesInfo(productId: string): ArgentSeries | null {
  // Extract series key from product ID (e.g., 'argent-10-series' -> '10')
  const match = productId.match(/argent-(\d+|v50)-series/);
  if (!match) return null;
  
  const seriesKey = match[1] as ArgentSeriesKey;
  return ARGENT_SERIES.find(s => s.key === seriesKey) || null;
}

/**
 * Calculate price for an Argent configuration
 */
export function calculateArgentPrice(
  productId: string,
  selections: Record<string, any>
): { 
  basePrice: number; 
  optionsTotal: number; 
  accessoriesTotal: number; 
  total: number;
  dimensionConfig: any | null;
} {
  const series = getArgentSeriesInfo(productId);
  if (!series) {
    return { basePrice: 0, optionsTotal: 0, accessoriesTotal: 0, total: 0, dimensionConfig: null };
  }
  
  // Get dimension configuration
  const ruHeight = parseInt(String(selections['ru-height']?.replace?.('ru-', '') || '0')) || 
                   getAvailableRuHeights(series.key)[0];
  const widthMm = parseInt(String(selections['width']?.replace?.('width-', '') || '0')) || 
                  getAvailableWidths(series.key)[0] || 0;
  const depthMm = parseInt(String(selections['depth']?.replace?.('depth-', '') || '0')) || 
                  getAvailableDepths(series.key)[0] || 0;
  
  const dimensionConfig = findDimensionConfig(series.key, ruHeight, widthMm, depthMm);
  const basePrice = dimensionConfig?.basePrice || 0;
  
  let optionsTotal = 0;
  let accessoriesTotal = 0;
  
  // Calculate options price (doors, panels, locks, security class)
  const product = getArgentProduct(series.key);
  if (product) {
    for (const group of product.groups) {
      if (group.type === 'qty_list') continue; // Handle accessories separately
      
      const selectedValue = selections[group.id];
      if (!selectedValue) continue;
      
      const selectedOption = group.options.find(o => o.id === selectedValue || o.value === selectedValue);
      if (selectedOption?.priceDelta) {
        optionsTotal += selectedOption.priceDelta;
      }
    }
    
    // Calculate accessories
    const accessorySelections = selections['accessories'] as Record<string, number> | undefined;
    if (accessorySelections) {
      for (const [accId, qty] of Object.entries(accessorySelections)) {
        const acc = ARGENT_ACCESSORIES.find(a => a.id === accId);
        if (acc && qty > 0) {
          accessoriesTotal += acc.price * qty;
        }
      }
    }
  }
  
  return {
    basePrice,
    optionsTotal,
    accessoriesTotal,
    total: basePrice + optionsTotal + accessoriesTotal,
    dimensionConfig,
  };
}

/**
 * Generate reference code for an Argent configuration
 */
export function generateArgentReferenceCode(
  productId: string,
  selections: Record<string, any>
): string {
  const series = getArgentSeriesInfo(productId);
  if (!series) return 'INVALID';
  
  // Extract values from selections
  const ruHeightMatch = String(selections['ru-height'] || '').match(/ru-(\d+)/);
  const ruHeight = ruHeightMatch ? parseInt(ruHeightMatch[1]) : getAvailableRuHeights(series.key)[0];
  
  const widthMatch = String(selections['width'] || '').match(/width-(\d+)/);
  const widthMm = widthMatch ? parseInt(widthMatch[1]) : getAvailableWidths(series.key)[0] || 0;
  
  const depthMatch = String(selections['depth'] || '').match(/depth-(\d+)/);
  const depthMm = depthMatch ? parseInt(depthMatch[1]) : getAvailableDepths(series.key)[0] || 0;
  
  // Security class for 50 series
  let securityClass: SecurityGrade = null;
  if (series.key === '50') {
    const secClass = selections['security-class'];
    securityClass = secClass === 'security-class-c' ? 'class_c' : 'class_b';
  }
  
  // Door and lock codes
  const doorOptions = getDoorOptionsForSeries(series.key);
  const lockOptions = getLockOptionsForSeries(series.key);
  
  const selectedDoor = doorOptions.find(d => d.id === selections['front-door']);
  const selectedLock = lockOptions.find(l => l.id === selections['lock']);
  
  return generateArgentCode(
    series.key,
    ruHeight,
    widthMm,
    depthMm,
    securityClass,
    selectedDoor?.code,
    selectedLock?.code
  );
}

/**
 * Check if configuration requires quote/consultation
 */
export function checkArgentCommercialRules(
  productId: string,
  selections: Record<string, any>
): { 
  action: 'buy_online' | 'quote_required' | 'consult_required';
  message?: string;
  canPurchaseOnline: boolean;
} {
  const series = getArgentSeriesInfo(productId);
  if (!series) {
    return { action: 'consult_required', message: 'Invalid configuration', canPurchaseOnline: false };
  }
  
  // Determine security class
  let securityClass: SecurityGrade = series.securityGrade;
  if (series.key === '50') {
    const secClass = selections['security-class'];
    securityClass = secClass === 'security-class-c' ? 'class_c' : 'class_b';
  }
  
  // Count accessories
  const accessorySelections = selections['accessories'] as Record<string, number> | undefined;
  const accessoryCount = accessorySelections 
    ? Object.values(accessorySelections).reduce((sum, qty) => sum + qty, 0)
    : 0;
  
  // Check if custom size (not in standard matrix)
  const ruHeightMatch = String(selections['ru-height'] || '').match(/ru-(\d+)/);
  const ruHeight = ruHeightMatch ? parseInt(ruHeightMatch[1]) : 0;
  const widthMatch = String(selections['width'] || '').match(/width-(\d+)/);
  const widthMm = widthMatch ? parseInt(widthMatch[1]) : 0;
  const depthMatch = String(selections['depth'] || '').match(/depth-(\d+)/);
  const depthMm = depthMatch ? parseInt(depthMatch[1]) : 0;
  
  const dimensionConfig = findDimensionConfig(series.key, ruHeight, widthMm, depthMm);
  const isCustomSize = !dimensionConfig?.isStandard;
  
  const result = evaluateCommercialRules({
    seriesKey: series.key,
    securityClass,
    isCustomSize,
    accessoryCount,
  });
  
  return {
    ...result,
    canPurchaseOnline: result.action === 'buy_online',
  };
}

// Default export for convenience
export default {
  getProducts: getArgentProducts,
  getProduct: getArgentProduct,
  getProductsByType: getArgentProductsByType,
  getSeriesInfo: getArgentSeriesInfo,
  calculatePrice: calculateArgentPrice,
  generateReferenceCode: generateArgentReferenceCode,
  checkCommercialRules: checkArgentCommercialRules,
};
