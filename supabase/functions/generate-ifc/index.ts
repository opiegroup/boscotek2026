import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate IFC 4 file content
 * This creates a valid IFC file with geometry and metadata
 */
function generateIFCContent(configData: any): string {
  const { configuration, product, pricing, referenceCode } = configData;
  const timestamp = new Date().toISOString();
  
  // Extract dimensions from configuration
  // Priority: configuration.dimensions (pre-calculated) > product option metadata > defaults
  let dimensions: { width: number; height: number; depth: number };
  
  // Set product-appropriate defaults
  const isWorkbench = product.id.includes('workbench');
  const isIndustrial = product.id.includes('industrial');
  const defaultWidth = isWorkbench ? 1800 : 560;
  const defaultHeight = isWorkbench ? 900 : 850;
  const defaultDepth = isWorkbench ? (isIndustrial ? 800 : 750) : 750;
  
  if (configuration.dimensions) {
    // Use pre-calculated dimensions from configuration (in mm, convert to meters)
    dimensions = {
      width: (configuration.dimensions.width || defaultWidth) / 1000,
      height: (configuration.dimensions.height || defaultHeight) / 1000,
      depth: (configuration.dimensions.depth || defaultDepth) / 1000
    };
  } else {
    // Derive dimensions from product option selections
    const getOptionValue = (groupId: string, defaultMm: number): number => {
      const selectionId = configuration.selections?.[groupId];
      if (!selectionId) return defaultMm;
      
      const group = product.groups?.find((g: any) => g.id === groupId);
      const option = group?.options?.find((o: any) => o.id === selectionId);
      
      // Check for meta values (in meters) or value field (in mm)
      if (option?.meta?.width) return option.meta.width * 1000;
      if (option?.meta?.height) return option.meta.height * 1000;
      if (option?.meta?.depth) return option.meta.depth * 1000;
      if (typeof option?.value === 'number') return option.value;
      
      return defaultMm;
    };
    
    // Get dimensions based on product type
    let widthMm: number, heightMm: number, depthMm: number;
    
    if (isWorkbench) {
      // Workbench: width from 'size', height from 'bench_height', depth is fixed
      widthMm = getOptionValue('size', defaultWidth);
      heightMm = getOptionValue('bench_height', defaultHeight);
      depthMm = defaultDepth; // Fixed depth for workbenches
    } else {
      // Cabinet: width from 'width', height from 'height', depth from 'series'
      widthMm = getOptionValue('width', defaultWidth);
      heightMm = getOptionValue('height', defaultHeight);
      depthMm = getOptionValue('series', defaultDepth);
    }
    
    dimensions = {
      width: widthMm / 1000,
      height: heightMm / 1000,
      depth: depthMm / 1000
    };
  }
  
  console.log('IFC Generation - Dimensions (meters):', {
    width: dimensions.width,
    height: dimensions.height,
    depth: dimensions.depth,
    source: configuration.dimensions ? 'config.dimensions' : 'product options'
  });

  // IFC Header (Section 2: Enhanced with CoordinationView4 and detailed metadata)
  const ifcHeader = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView4]'), '2;1');
FILE_NAME('${referenceCode}.ifc', '${timestamp}', ('Boscotek Configurator'), ('Opie Manufacturing Group'), 'Boscotek Configurator v1.0', 'Boscotek Configurator', 'IFC4');
FILE_SCHEMA(('IFC4'));
ENDSEC;

DATA;`;

  let entityId = 1;
  const entities: string[] = [];

  // Helper to mark IFC enum values (will be formatted as .ENUM. not 'ENUM')
  const E = (value: string) => ({ __ifcEnum: value });

  // Helper to create entity with FIXED type detection (Bugs 1 & 2)
  const createEntity = (type: string, ...params: any[]): number => {
    const id = entityId++;
    const paramsStr = params.map(p => {
      if (p === null || p === undefined) return '$';
      // Check for enum marker BEFORE string check
      // NOTE: IFC requires .ENUM. format. BlenderBIM v0.8.4 has a bug parsing this.
      // Valid IFC format is required for other tools (Revit, ArchiCAD, etc.)
      if (p && typeof p === 'object' && '__ifcEnum' in p) {
        return `.${p.__ifcEnum}.`;
      }
      // Special tokens: *, $, .T., .F.
      if (p === '*') return '*';
      if (p === '.T.' || p === '.F.') return p;
      // Regular strings (names, descriptions) - quoted
      if (typeof p === 'string') return `'${p}'`;
      if (Array.isArray(p)) {
        if (p.length === 0) return '()';
        
        // Check if ALL elements are numbers
        const allNumbers = p.every(item => typeof item === 'number');
        
        if (allNumbers) {
          // PROPER FIX: Distinguish coordinates from entity references
          // Entity IDs are ALWAYS positive integers starting from 1 (never 0, never negative)
          // Coordinates often contain 0 (origins, directions) or negative values (offsets)
          
          const hasZero = p.some((n: number) => n === 0);
          const hasNegative = p.some((n: number) => n < 0);
          const hasDecimals = p.some((n: number) => n % 1 !== 0);
          
          // If array contains 0, negative, or decimals → it's coordinates
          if (hasZero || hasNegative || hasDecimals) {
            // Coordinates: format as floats
            return `(${p.map(n => {
              const str = n.toString();
              return str.includes('.') ? str : `${str}.`;
            }).join(',')})`;
          }
        }
        
        // Entity reference list: all positive non-zero integers are entity references
        return `(${p.map(item => typeof item === 'number' ? `#${item}` : item).join(',')})`;
      }
      if (typeof p === 'number') {
        // Distinguish between dimension values and entity references
        // Entity IDs are positive integers (1, 2, 3...)
        // Dimension values are floats (0.56, 0.75) or special values (0)
        if (p === 0 || p < 0 || p % 1 !== 0) {
          // It's a dimension value (0, negative, or has decimals)
          const str = p.toString();
          return str.includes('.') ? str : `${str}.`;
        }
        // It's an entity reference (positive integer)
        return `#${p}`;
      }
      return String(p);
    }).join(',');
    entities.push(`#${id}=${type}(${paramsStr});`);
    return id;
  };

  // 1. Owner History
  const ownerHistoryId = createEntity('IFCOWNERHISTORY', null, null, null, E('NOCHANGE'), null, null, null, Date.now());
  
  // 2. Units (Section 5: Use METRES - dimensions will be in meters, not millimeters)
  // FIX: Use $ (null) for Dimensions, and no prefix for METRE to avoid BlenderBIM parsing issues
  const lengthUnit = createEntity('IFCSIUNIT', null, E('LENGTHUNIT'), null, E('METRE'));
  const areaUnit = createEntity('IFCSIUNIT', null, E('AREAUNIT'), null, E('SQUARE_METRE'));
  const volumeUnit = createEntity('IFCSIUNIT', null, E('VOLUMEUNIT'), null, E('CUBIC_METRE'));
  const massUnit = createEntity('IFCSIUNIT', null, E('MASSUNIT'), E('KILO'), E('GRAM'));
  const angleUnit = createEntity('IFCSIUNIT', null, E('PLANEANGLEUNIT'), null, E('RADIAN'));
  
  const unitAssignment = createEntity('IFCUNITASSIGNMENT', [lengthUnit, areaUnit, volumeUnit, massUnit, angleUnit]);
  
  // 3. Geometric Representation Context (MUST be created BEFORE project)
  // CRITICAL: WorldCoordinateSystem is REQUIRED for geometry to render
  const wcsOrigin = createEntity('IFCCARTESIANPOINT', [0., 0., 0.]);
  const wcsZAxis = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const wcsXAxis = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const worldCoordinateSystem = createEntity('IFCAXIS2PLACEMENT3D', wcsOrigin, wcsZAxis, wcsXAxis);
  
  const geometricContext = createEntity('IFCGEOMETRICREPRESENTATIONCONTEXT', 
    null,                    // ContextIdentifier
    E('Model'),              // ContextType
    3,                       // CoordinateSpaceDimension
    1.E-5,                   // Precision
    worldCoordinateSystem,   // WorldCoordinateSystem (REQUIRED!)
    null                     // TrueNorth
  );
  
  // 4. Project Structure - Use "Boscotek" as the project name with config code
  const projectName = `Boscotek - ${referenceCode}`;
  const projectId = createEntity('IFCPROJECT', referenceCode, ownerHistoryId, projectName, `Boscotek ${product.name} - Configuration: ${referenceCode}`, null, null, null, [geometricContext], unitAssignment);
  
  // 5. Spatial Hierarchy: Site → Building → BuildingStorey
  const siteId = createEntity('IFCSITE', 'Site', ownerHistoryId, 'Default Site', null, null, null, null, E('ELEMENT'), null, null, null, null, null);
  const buildingId = createEntity('IFCBUILDING', 'Building', ownerHistoryId, 'Default Building', null, null, null, null, E('ELEMENT'), null, null, null);
  const storeyId = createEntity('IFCBUILDINGSTOREY', 'Storey', ownerHistoryId, 'Level 0', null, null, null, null, E('ELEMENT'), null, null, null);
  
  // 6. Spatial Aggregation Relationships
  createEntity('IFCRELAGGREGATES', 'ProjectContainer', ownerHistoryId, null, null, projectId, [siteId]);
  createEntity('IFCRELAGGREGATES', 'SiteContainer', ownerHistoryId, null, null, siteId, [buildingId]);
  createEntity('IFCRELAGGREGATES', 'BuildingContainer', ownerHistoryId, null, null, buildingId, [storeyId]);
  
  // 6. Main Product Geometry
  // Create proper placement hierarchy
  const originPoint = createEntity('IFCCARTESIANPOINT', [0., 0., 0.]);
  const zDirection = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const xDirection = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const productPlacement = createEntity('IFCAXIS2PLACEMENT3D', originPoint, zDirection, xDirection);
  const productLocalPlacement = createEntity('IFCLOCALPLACEMENT', null, productPlacement);
  
  // Create product geometry based on product type
  let bodyRepresentation: number;
  
  if (product.id === 'prod-mobile-tool-cart') {
    // Mobile Tool Cart geometry (cart body + drawers + rear accessories)
    bodyRepresentation = createMobileToolCartGeometry(dimensions, createEntity, geometricContext, configuration, product);
  } else if (product.id === 'prod-storage-cupboard') {
    // Industrial Storage Cupboard geometry (shell + doors + shelves)
    bodyRepresentation = createStorageCupboardGeometry(dimensions, createEntity, geometricContext, configuration, product);
  } else if (product.id === 'prod-hilo-workbench') {
    // HiLo Height-Adjustable Workbench geometry - exported at MAXIMUM HEIGHT
    bodyRepresentation = createHiLoWorkbenchGeometry(dimensions, createEntity, geometricContext, configuration, product);
  } else if (product.id.includes('workbench')) {
    // Workbench geometry (frame + worktop)
    const isIndustrial = product.id.includes('industrial');
    // Check multiple ways castors might be indicated
    const hasCastors = configuration.selections?.mobility === true || 
                       configuration.selections?.mobility === 'castors' ||
                       configuration.selections?.mobility === 'C' ||
                       referenceCode.endsWith('-C'); // Config code ends with -C for castors
    bodyRepresentation = createWorkbenchGeometry(dimensions, createEntity, geometricContext, configuration, product, isIndustrial, hasCastors);
  } else if (product.id.includes('argent')) {
    // Argent Server Rack geometry (enclosure with posts, rails, doors)
    bodyRepresentation = createArgentServerRackGeometry(dimensions, createEntity, geometricContext, configuration, product);
  } else {
    // Cabinet geometry (carcass + drawers)
    bodyRepresentation = createCabinetGeometry(dimensions, createEntity, geometricContext, configuration, product);
  }
  
  // 7. Product Instance (Section 6 & 7: Add ObjectType with full Boscotek code)
  // Name format: "Boscotek - [Configuration Code]" e.g. "Boscotek - BTCS.700.560.100.100.MG.SG"
  const productName = `Boscotek - ${referenceCode}`;
  
  const productInstance = createEntity(
    'IFCFURNISHINGELEMENT',
    referenceCode,           // GlobalId
    ownerHistoryId,          // OwnerHistory
    productName,             // Name = "Boscotek - BTCS.700.560..."
    product.description,     // Description
    referenceCode,           // ObjectType = Full configuration code
    productLocalPlacement,   // ObjectPlacement
    bodyRepresentation,      // Representation
    referenceCode            // Tag = Configuration code
  );
  
  // 8. Property Sets (Metadata)
  addPropertySets(productInstance, configuration, product, pricing, referenceCode, createEntity, ownerHistoryId);
  
  // 9. Drawer fronts are now integrated into the main cabinet geometry
  // (see createCabinetGeometry function for detailed drawer front extrusions)
  // This consolidates all visual geometry into a single IfcProductDefinitionShape
  // as recommended for LOD 200-300 BIM models
  
  console.log('IFC Generation - Cabinet geometry includes:', {
    hasDrawerFronts: !!configuration.customDrawers && configuration.customDrawers.length > 0,
    drawerCount: configuration.customDrawers?.length || 0,
    drawers: configuration.customDrawers?.map((d: any) => d.id) || []
  });
  
  // 10. Add cabinet to building storey (single consolidated element)
  createEntity('IFCRELCONTAINEDINSPATIALSTRUCTURE', 'StoreyContainer', ownerHistoryId, null, null, [productInstance], storeyId);

  // Close IFC file
  const ifcContent = `${ifcHeader}
${entities.join('\n')}
ENDSEC;
END-ISO-10303-21;`;

  return ifcContent;
}

/**
 * Create professional cabinet geometry with distinct components
 * LOD 200-300: Plinth, carcass (sides/back/top), and drawer fronts
 * 
 * Geometry Components:
 * 1. Plinth/Base - Bottom structural support
 * 2. Carcass - Back panel, side panels, top panel
 * 3. Drawer Fronts - Individual front faces for each drawer
 */
function createCabinetGeometry(
  dimensions: any, 
  createEntity: Function, 
  contextId: number,
  configuration?: any,
  product?: any
): number {
  // Access E function from parent scope
  const E = (value: string) => ({ __ifcEnum: value });
  
  const { width, height, depth } = dimensions;
  
  // Calculate cabinet geometry parameters based on product configuration
  // These match the 3D viewer calculations in Viewer3D.tsx
  const heightGroup = product?.groups?.find((g: any) => g.id === 'height');
  const selectedHeightId = configuration?.selections?.['height'];
  const selectedHeightOption = heightGroup?.options?.find((o: any) => o.id === selectedHeightId);
  const usableHeightMeters = (selectedHeightOption?.meta?.usableHeight || 750) / 1000;
  
  // Shell thickness distribution (matches 3D viewer)
  const totalShellThickness = height - usableHeightMeters;
  const plinthHeight = Math.max(0.06, totalShellThickness * 0.6); // 60% to plinth, min 60mm
  const topPanelHeight = Math.max(0.02, totalShellThickness * 0.4); // 40% to top panel, min 20mm
  
  // Panel thicknesses (standard steel cabinet construction)
  const sideWallThickness = 0.02; // 20mm side panels
  const backPanelThickness = 0.02; // 20mm back panel
  const drawerFrontThickness = 0.02; // 20mm drawer front faces
  
  // Plinth setback (recessed from cabinet front)
  const plinthSetback = 0.015; // 15mm setback
  
  console.log('Creating detailed cabinet geometry:', { 
    width, height, depth,
    plinthHeight,
    topPanelHeight,
    usableHeight: usableHeightMeters,
    drawerCount: configuration?.customDrawers?.length || 0
  });
  
  const solids: number[] = [];
  const extrusionDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  
  // IMPORTANT: IFCRECTANGLEPROFILEDEF creates a rectangle CENTERED at the placement origin
  // So we must specify CENTER positions, not corner positions
  
  // ==========================================================
  // 1. PLINTH / BASE (bottom structural support)
  // Slightly recessed from cabinet front for visual distinction
  // ==========================================================
  // Plinth spans: X from -width/2 to +width/2, Y from -depth/2 to +depth/2 - plinthSetback
  // Plinth depth = depth - plinthSetback
  // Plinth center Y = (-depth/2 + (depth/2 - plinthSetback)) / 2 = -plinthSetback/2
  const plinthDepth = depth - plinthSetback;
  const plinthCenterY = -plinthSetback / 2;
  
  const plinthOrigin = createEntity('IFCCARTESIANPOINT', [0., plinthCenterY, 0.]);
  const plinthZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const plinthXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const plinthPosition = createEntity('IFCAXIS2PLACEMENT3D', plinthOrigin, plinthZDir, plinthXDir);
  
  const plinthProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const plinthProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const plinthProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', plinthProfileOrigin, plinthProfileXDir);
  const plinthProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, plinthProfilePosition, width, plinthDepth);
  
  const plinthSolid = createEntity('IFCEXTRUDEDAREASOLID', plinthProfile, plinthPosition, extrusionDir, plinthHeight);
  solids.push(plinthSolid);
  
  // ==========================================================
  // 2. TOP PANEL (cabinet top surface)
  // Centered at (0, 0, height - topPanelHeight)
  // ==========================================================
  const topOrigin = createEntity('IFCCARTESIANPOINT', [0., 0., height - topPanelHeight]);
  const topZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const topXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const topPosition = createEntity('IFCAXIS2PLACEMENT3D', topOrigin, topZDir, topXDir);
  
  const topProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const topProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const topProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', topProfileOrigin, topProfileXDir);
  const topProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, topProfilePosition, width, depth);
  
  const topSolid = createEntity('IFCEXTRUDEDAREASOLID', topProfile, topPosition, extrusionDir, topPanelHeight);
  solids.push(topSolid);
  
  // ==========================================================
  // 3. BACK PANEL (full height between plinth and top)
  // Back panel at Y = -depth/2 + backPanelThickness/2 (centered on its thickness)
  // ==========================================================
  const internalHeight = height - plinthHeight - topPanelHeight;
  const backCenterY = -depth/2 + backPanelThickness/2;
  
  const backOrigin = createEntity('IFCCARTESIANPOINT', [0., backCenterY, plinthHeight]);
  const backZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const backXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const backPosition = createEntity('IFCAXIS2PLACEMENT3D', backOrigin, backZDir, backXDir);
  
  const backProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const backProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const backProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', backProfileOrigin, backProfileXDir);
  const backProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, backProfilePosition, width, backPanelThickness);
  
  const backSolid = createEntity('IFCEXTRUDEDAREASOLID', backProfile, backPosition, extrusionDir, internalHeight);
  solids.push(backSolid);
  
  // ==========================================================
  // 4. LEFT SIDE PANEL
  // Left side at X = -width/2 + sideWallThickness/2 (centered on its thickness)
  // Spans from back panel to front
  // ==========================================================
  const sidePanelDepth = depth - backPanelThickness;
  const sidePanelCenterY = backPanelThickness / 2; // Shifted forward from center by half back panel
  const leftCenterX = -width/2 + sideWallThickness/2;
  
  const leftOrigin = createEntity('IFCCARTESIANPOINT', [leftCenterX, sidePanelCenterY, plinthHeight]);
  const leftZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const leftXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const leftPosition = createEntity('IFCAXIS2PLACEMENT3D', leftOrigin, leftZDir, leftXDir);
  
  const leftProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const leftProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const leftProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', leftProfileOrigin, leftProfileXDir);
  const leftProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, leftProfilePosition, sideWallThickness, sidePanelDepth);
  
  const leftSolid = createEntity('IFCEXTRUDEDAREASOLID', leftProfile, leftPosition, extrusionDir, internalHeight);
  solids.push(leftSolid);
  
  // ==========================================================
  // 5. RIGHT SIDE PANEL
  // Right side at X = +width/2 - sideWallThickness/2 (centered on its thickness)
  // ==========================================================
  const rightCenterX = width/2 - sideWallThickness/2;
  
  const rightOrigin = createEntity('IFCCARTESIANPOINT', [rightCenterX, sidePanelCenterY, plinthHeight]);
  const rightZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const rightXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const rightPosition = createEntity('IFCAXIS2PLACEMENT3D', rightOrigin, rightZDir, rightXDir);
  
  const rightProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const rightProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const rightProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', rightProfileOrigin, rightProfileXDir);
  const rightProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, rightProfilePosition, sideWallThickness, sidePanelDepth);
  
  const rightSolid = createEntity('IFCEXTRUDEDAREASOLID', rightProfile, rightPosition, extrusionDir, internalHeight);
  solids.push(rightSolid);
  
  // ==========================================================
  // 6. DRAWER FRONTS (individual panels for each drawer)
  // Positioned on the front face, stacked from bottom to top
  // ==========================================================
  if (configuration?.customDrawers && configuration.customDrawers.length > 0) {
    const drawerGroup = product?.groups?.find((g: any) => g.type === 'drawer_stack' || g.id === 'config');
    const drawerGap = 0.004; // 4mm gap between drawers
    const drawerInset = sideWallThickness + 0.002; // Inset from cabinet edges
    const drawerFrontWidth = width - (drawerInset * 2);
    
    // Drawer front center Y = front of cabinet minus half the drawer thickness
    const drawerFrontCenterY = depth/2 - drawerFrontThickness/2;
    
    // Sort drawers by height descending (largest at bottom, matching 3D viewer)
    const drawersWithHeights = configuration.customDrawers.map((d: any, idx: number) => {
      const opt = drawerGroup?.options?.find((o: any) => o.id === d.id);
      const heightMm = opt?.meta?.front || 150;
      return { ...d, heightMm, originalIndex: idx };
    }).sort((a: any, b: any) => b.heightMm - a.heightMm);
    
    let currentZ = plinthHeight; // Start stacking from top of plinth
    
    drawersWithHeights.forEach((drawer: any, idx: number) => {
      const drawerHeight = drawer.heightMm / 1000; // Convert to meters
      const drawerCenterZ = currentZ + drawerGap/2; // Z position for this drawer
      
      // Create drawer front panel - CENTERED at (0, drawerFrontCenterY, drawerCenterZ)
      const dfOrigin = createEntity('IFCCARTESIANPOINT', [0., drawerFrontCenterY, drawerCenterZ]);
      const dfZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
      const dfXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
      const dfPosition = createEntity('IFCAXIS2PLACEMENT3D', dfOrigin, dfZDir, dfXDir);
      
      const dfProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
      const dfProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
      const dfProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', dfProfileOrigin, dfProfileXDir);
      const dfProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, dfProfilePosition, drawerFrontWidth, drawerFrontThickness);
      
      const dfSolid = createEntity('IFCEXTRUDEDAREASOLID', dfProfile, dfPosition, extrusionDir, drawerHeight - drawerGap);
      solids.push(dfSolid);
      
      currentZ += drawerHeight;
      
      console.log(`Drawer front ${idx + 1}: height=${drawer.heightMm}mm, z=${(currentZ * 1000).toFixed(0)}mm`);
    });
  }
  
  // Create single shape representation with all geometry components
  const shapeRepresentation = createEntity('IFCSHAPEREPRESENTATION', contextId, E('Body'), E('SweptSolid'), solids);
  
  console.log(`Cabinet geometry created: ${solids.length} solid components`);
  
  // Product definition shape
  return createEntity('IFCPRODUCTDEFINITIONSHAPE', null, null, [shapeRepresentation]);
}

// Note: Drawer geometry is now integrated into the main cabinet geometry
// (see createCabinetGeometry function) for a consolidated LOD 200-300 representation.
// Drawer fronts are extruded as part of the cabinet's ProductDefinitionShape.
// Drawer metadata (heights, counts, configuration) is included in Pset_BoscotekCabinet.

/**
 * Create Argent Server Rack geometry
 * LOD 200-300: Enclosure with corner posts, rails, panels, and doors
 * 
 * Geometry Components:
 * 1. Corner posts (4 vertical posts)
 * 2. Frame rails (horizontal connecting elements)
 * 3. Side panels (left and right)
 * 4. Rear panel/door
 * 5. Front door (solid or perforated)
 * 6. 19" mounting rails (internal)
 */
function createArgentServerRackGeometry(
  dimensions: any,
  createEntity: Function,
  contextId: number,
  configuration?: any,
  product?: any
): number {
  const E = (value: string) => ({ __ifcEnum: value });
  
  // Extract dimensions - Argent uses mm in configuration
  const widthMm = configuration?.selections?.width ? 
    parseInt(String(configuration.selections.width).replace('width-', '')) : 
    (dimensions.width * 1000) || 600;
  const depthMm = configuration?.selections?.depth ?
    parseInt(String(configuration.selections.depth).replace('depth-', '')) :
    (dimensions.depth * 1000) || 800;
  
  // RU height from selection
  const ruSelection = configuration?.selections?.['ru-height'] || configuration?.selections?.ru_height;
  const ruHeight = ruSelection ? parseInt(String(ruSelection).replace('ru-', '')) : 42;
  const heightMm = ruHeight * 44.45 + 100; // Add 100mm for top/bottom frames
  
  // Convert to meters for IFC
  const width = widthMm / 1000;
  const depth = depthMm / 1000;
  const height = heightMm / 1000;
  
  console.log('Creating Argent Server Rack IFC geometry:', {
    widthMm, depthMm, heightMm, ruHeight,
    widthM: width, depthM: depth, heightM: height,
    productId: product?.id
  });
  
  const solids: number[] = [];
  
  // Standard rack construction dimensions (in meters)
  const postSize = 0.05; // 50mm corner posts
  const frameThickness = 0.003; // 3mm steel panels
  const railWidth = 0.025; // 25mm mounting rail width
  
  const extrusionDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  
  // Helper to create extruded box
  const createBox = (cx: number, cy: number, cz: number, w: number, d: number, h: number): number => {
    const profilePoint = createEntity('IFCCARTESIANPOINT', [cx - w/2, cy - d/2]);
    const profileAxis = createEntity('IFCAXIS2PLACEMENT2D', profilePoint, null);
    const profile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, profileAxis, w, d);
    
    const positionPoint = createEntity('IFCCARTESIANPOINT', [0., 0., cz]);
    const position = createEntity('IFCAXIS2PLACEMENT3D', positionPoint, null, null);
    
    return createEntity('IFCEXTRUDEDAREASOLID', profile, position, extrusionDir, h);
  };
  
  // 1. CORNER POSTS (4 vertical posts)
  // Front-left post
  solids.push(createBox(-width/2 + postSize/2, depth/2 - postSize/2, 0, postSize, postSize, height));
  // Front-right post
  solids.push(createBox(width/2 - postSize/2, depth/2 - postSize/2, 0, postSize, postSize, height));
  // Rear-left post
  solids.push(createBox(-width/2 + postSize/2, -depth/2 + postSize/2, 0, postSize, postSize, height));
  // Rear-right post
  solids.push(createBox(width/2 - postSize/2, -depth/2 + postSize/2, 0, postSize, postSize, height));
  
  // 2. TOP AND BOTTOM FRAME RAILS
  const railHeight = 0.04; // 40mm frame rails
  
  // Bottom frame - front
  solids.push(createBox(0, depth/2 - postSize/2, 0, width - postSize * 2, postSize, railHeight));
  // Bottom frame - rear
  solids.push(createBox(0, -depth/2 + postSize/2, 0, width - postSize * 2, postSize, railHeight));
  // Bottom frame - left
  solids.push(createBox(-width/2 + postSize/2, 0, 0, postSize, depth - postSize * 2, railHeight));
  // Bottom frame - right
  solids.push(createBox(width/2 - postSize/2, 0, 0, postSize, depth - postSize * 2, railHeight));
  
  // Top frame - front
  solids.push(createBox(0, depth/2 - postSize/2, height - railHeight, width - postSize * 2, postSize, railHeight));
  // Top frame - rear
  solids.push(createBox(0, -depth/2 + postSize/2, height - railHeight, width - postSize * 2, postSize, railHeight));
  // Top frame - left
  solids.push(createBox(-width/2 + postSize/2, 0, height - railHeight, postSize, depth - postSize * 2, railHeight));
  // Top frame - right
  solids.push(createBox(width/2 - postSize/2, 0, height - railHeight, postSize, depth - postSize * 2, railHeight));
  
  // 3. SIDE PANELS (solid or vented)
  const panelHeight = height - railHeight * 2;
  const panelZ = railHeight;
  
  // Left side panel
  solids.push(createBox(-width/2 + frameThickness/2, 0, panelZ, frameThickness, depth - postSize * 2, panelHeight));
  // Right side panel
  solids.push(createBox(width/2 - frameThickness/2, 0, panelZ, frameThickness, depth - postSize * 2, panelHeight));
  
  // 4. REAR PANEL
  solids.push(createBox(0, -depth/2 + frameThickness/2, panelZ, width - postSize * 2, frameThickness, panelHeight));
  
  // 5. FRONT DOOR (simplified as single panel)
  const doorThickness = 0.004; // 4mm door
  solids.push(createBox(0, depth/2 - doorThickness/2, panelZ, width - postSize * 2, doorThickness, panelHeight));
  
  // 6. TOP PANEL (roof)
  solids.push(createBox(0, 0, height - frameThickness, width - postSize * 2, depth - postSize * 2, frameThickness));
  
  // 7. 19" MOUNTING RAILS (internal, front pair)
  const railInset = 0.08; // 80mm from front
  const railDepth = 0.025;
  const internalRailHeight = panelHeight - 0.02;
  
  // Front-left mounting rail
  solids.push(createBox(-width/2 + postSize + railWidth/2 + 0.01, depth/2 - railInset, panelZ + 0.01, railWidth, railDepth, internalRailHeight));
  // Front-right mounting rail  
  solids.push(createBox(width/2 - postSize - railWidth/2 - 0.01, depth/2 - railInset, panelZ + 0.01, railWidth, railDepth, internalRailHeight));
  
  // Rear mounting rails (if 4-post)
  const rearRailInset = 0.08;
  solids.push(createBox(-width/2 + postSize + railWidth/2 + 0.01, -depth/2 + rearRailInset, panelZ + 0.01, railWidth, railDepth, internalRailHeight));
  solids.push(createBox(width/2 - postSize - railWidth/2 - 0.01, -depth/2 + rearRailInset, panelZ + 0.01, railWidth, railDepth, internalRailHeight));
  
  console.log(`Argent Server Rack IFC: ${solids.length} solid components created`);
  
  // Create composite solid from all parts
  const shapeRepresentation = createEntity(
    'IFCSHAPEREPRESENTATION',
    contextId,
    'Body',
    'SweptSolid',
    solids
  );
  
  return createEntity('IFCPRODUCTDEFINITIONSHAPE', null, null, [shapeRepresentation]);
}

/**
 * Create Industrial Storage Cupboard geometry
 * LOD 200-300: Shell, doors, and internal shelves
 * 
 * Fixed dimensions: 900mm W × 450mm D × 1800/2000mm H
 * 
 * Geometry Components:
 * 1. Base/Plinth - Recessed black base
 * 2. Cabinet Shell - Left/right side panels, back panel, top panel (flat or sloped)
 * 3. Double Doors - Front doors with handles
 * 4. Internal Shelves - Adjustable or fixed shelving
 */
function createStorageCupboardGeometry(
  dimensions: any,
  createEntity: Function,
  contextId: number,
  configuration?: any,
  product?: any
): number {
  const E = (value: string) => ({ __ifcEnum: value });
  
  // Fixed cupboard dimensions (in meters)
  const width = 0.9;   // 900mm
  const depth = 0.45;  // 450mm
  
  // Get configuration to determine height and shelf layout
  const configGroup = product?.groups?.find((g: any) => g.id === 'cupboard_config');
  const selectedConfigId = configuration?.selections?.['cupboard_config'];
  const configOption = configGroup?.options?.find((o: any) => o.id === selectedConfigId);
  
  const height = configOption?.meta?.height || 1.8;
  const topType = configOption?.meta?.topType || 'flat';
  const shelfCount = configOption?.meta?.shelfCount || 4;
  const shelfType = configOption?.meta?.shelfType || 'adjustable';
  const fixedShelves = configOption?.meta?.fixedShelves || 0;
  const halfShelves = configOption?.meta?.halfShelves || 0;
  
  // Geometry constants
  const panelThickness = 0.015;  // 15mm steel panels
  const baseHeight = 0.1;        // 100mm plinth
  const slopeHeight = 0.12;      // 120mm slope rise
  const shelfThickness = 0.02;   // 20mm shelf
  const doorGap = 0.003;         // 3mm gap between doors
  const handleWidth = 0.03;
  const handleHeight = 0.15;
  const handleDepth = 0.02;
  
  // Calculate interior dimensions
  const interiorWidth = width - (panelThickness * 2);
  const interiorDepth = depth - (panelThickness * 2);
  const interiorTop = height - panelThickness - baseHeight;
  const interiorBottom = baseHeight + panelThickness;
  const usableHeight = interiorTop - interiorBottom;
  
  const solids: number[] = [];
  const extrusionDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  
  console.log('Creating Storage Cupboard geometry:', { width, height, depth, topType, shelfCount });
  
  // ==========================================================
  // 1. BASE / PLINTH
  // ==========================================================
  const plinthOrigin = createEntity('IFCCARTESIANPOINT', [0., 0., 0.]);
  const plinthZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const plinthXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const plinthPosition = createEntity('IFCAXIS2PLACEMENT3D', plinthOrigin, plinthZDir, plinthXDir);
  
  const plinthProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const plinthProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const plinthProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', plinthProfileOrigin, plinthProfileXDir);
  const plinthProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, plinthProfilePosition, width, depth);
  
  const plinthSolid = createEntity('IFCEXTRUDEDAREASOLID', plinthProfile, plinthPosition, extrusionDir, baseHeight);
  solids.push(plinthSolid);
  
  // ==========================================================
  // 2. LEFT SIDE PANEL
  // ==========================================================
  const leftCenterX = -width/2 + panelThickness/2;
  const sidePanelHeight = height - baseHeight;
  
  const leftOrigin = createEntity('IFCCARTESIANPOINT', [leftCenterX, 0., baseHeight]);
  const leftZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const leftXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const leftPosition = createEntity('IFCAXIS2PLACEMENT3D', leftOrigin, leftZDir, leftXDir);
  
  const leftProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const leftProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const leftProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', leftProfileOrigin, leftProfileXDir);
  const leftProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, leftProfilePosition, panelThickness, depth);
  
  const leftSolid = createEntity('IFCEXTRUDEDAREASOLID', leftProfile, leftPosition, extrusionDir, sidePanelHeight);
  solids.push(leftSolid);
  
  // ==========================================================
  // 3. RIGHT SIDE PANEL
  // ==========================================================
  const rightCenterX = width/2 - panelThickness/2;
  
  const rightOrigin = createEntity('IFCCARTESIANPOINT', [rightCenterX, 0., baseHeight]);
  const rightZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const rightXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const rightPosition = createEntity('IFCAXIS2PLACEMENT3D', rightOrigin, rightZDir, rightXDir);
  
  const rightProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const rightProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const rightProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', rightProfileOrigin, rightProfileXDir);
  const rightProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, rightProfilePosition, panelThickness, depth);
  
  const rightSolid = createEntity('IFCEXTRUDEDAREASOLID', rightProfile, rightPosition, extrusionDir, sidePanelHeight);
  solids.push(rightSolid);
  
  // ==========================================================
  // 4. BACK PANEL
  // ==========================================================
  const backCenterY = -depth/2 + panelThickness/2;
  
  const backOrigin = createEntity('IFCCARTESIANPOINT', [0., backCenterY, baseHeight]);
  const backZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const backXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const backPosition = createEntity('IFCAXIS2PLACEMENT3D', backOrigin, backZDir, backXDir);
  
  const backProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const backProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const backProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', backProfileOrigin, backProfileXDir);
  const backProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, backProfilePosition, width - panelThickness*2, panelThickness);
  
  const backSolid = createEntity('IFCEXTRUDEDAREASOLID', backProfile, backPosition, extrusionDir, sidePanelHeight);
  solids.push(backSolid);
  
  // ==========================================================
  // 5. TOP PANEL (flat or sloped)
  // ==========================================================
  if (topType === 'flat') {
    const topOrigin = createEntity('IFCCARTESIANPOINT', [0., 0., height - panelThickness]);
    const topZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const topXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
    const topPosition = createEntity('IFCAXIS2PLACEMENT3D', topOrigin, topZDir, topXDir);
    
    const topProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
    const topProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
    const topProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', topProfileOrigin, topProfileXDir);
    const topProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, topProfilePosition, width, depth);
    
    const topSolid = createEntity('IFCEXTRUDEDAREASOLID', topProfile, topPosition, extrusionDir, panelThickness);
    solids.push(topSolid);
  } else {
    // Sloped top - simplified as flat top at the slope's midpoint height
    // (full slope geometry would require IfcArbitraryClosedProfileDef)
    const slopeAvgHeight = height - panelThickness + slopeHeight/2;
    const topOrigin = createEntity('IFCCARTESIANPOINT', [0., 0., slopeAvgHeight]);
    const topZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const topXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
    const topPosition = createEntity('IFCAXIS2PLACEMENT3D', topOrigin, topZDir, topXDir);
    
    const topProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
    const topProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
    const topProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', topProfileOrigin, topProfileXDir);
    const topProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, topProfilePosition, width, depth);
    
    const topSolid = createEntity('IFCEXTRUDEDAREASOLID', topProfile, topPosition, extrusionDir, panelThickness);
    solids.push(topSolid);
  }
  
  // ==========================================================
  // 6. BOTTOM PANEL (interior floor)
  // ==========================================================
  const bottomOrigin = createEntity('IFCCARTESIANPOINT', [0., 0., baseHeight]);
  const bottomZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const bottomXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const bottomPosition = createEntity('IFCAXIS2PLACEMENT3D', bottomOrigin, bottomZDir, bottomXDir);
  
  const bottomProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const bottomProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const bottomProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', bottomProfileOrigin, bottomProfileXDir);
  const bottomProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, bottomProfilePosition, interiorWidth, interiorDepth);
  
  const bottomSolid = createEntity('IFCEXTRUDEDAREASOLID', bottomProfile, bottomPosition, extrusionDir, panelThickness);
  solids.push(bottomSolid);
  
  // ==========================================================
  // 7. DOUBLE DOORS
  // ==========================================================
  const doorWidth = (width - panelThickness*2 - doorGap) / 2;
  const doorHeight = height - baseHeight - panelThickness;
  const doorCenterZ = baseHeight + doorHeight/2 + panelThickness/2;
  const doorCenterY = depth/2 - panelThickness/2;
  
  // Left Door
  const leftDoorOrigin = createEntity('IFCCARTESIANPOINT', [-doorWidth/2 - doorGap/2, doorCenterY, baseHeight + panelThickness]);
  const leftDoorZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const leftDoorXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const leftDoorPosition = createEntity('IFCAXIS2PLACEMENT3D', leftDoorOrigin, leftDoorZDir, leftDoorXDir);
  
  const leftDoorProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const leftDoorProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const leftDoorProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', leftDoorProfileOrigin, leftDoorProfileXDir);
  const leftDoorProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, leftDoorProfilePosition, doorWidth, panelThickness);
  
  const leftDoorSolid = createEntity('IFCEXTRUDEDAREASOLID', leftDoorProfile, leftDoorPosition, extrusionDir, doorHeight);
  solids.push(leftDoorSolid);
  
  // Right Door
  const rightDoorOrigin = createEntity('IFCCARTESIANPOINT', [doorWidth/2 + doorGap/2, doorCenterY, baseHeight + panelThickness]);
  const rightDoorZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const rightDoorXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const rightDoorPosition = createEntity('IFCAXIS2PLACEMENT3D', rightDoorOrigin, rightDoorZDir, rightDoorXDir);
  
  const rightDoorProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const rightDoorProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const rightDoorProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', rightDoorProfileOrigin, rightDoorProfileXDir);
  const rightDoorProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, rightDoorProfilePosition, doorWidth, panelThickness);
  
  const rightDoorSolid = createEntity('IFCEXTRUDEDAREASOLID', rightDoorProfile, rightDoorPosition, extrusionDir, doorHeight);
  solids.push(rightDoorSolid);
  
  // Door Handles (simplified as boxes)
  const leftHandleOrigin = createEntity('IFCCARTESIANPOINT', [doorWidth/2 - 0.08, doorCenterY + panelThickness/2 + handleDepth/2, doorCenterZ - handleHeight/2]);
  const leftHandleZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const leftHandleXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const leftHandlePosition = createEntity('IFCAXIS2PLACEMENT3D', leftHandleOrigin, leftHandleZDir, leftHandleXDir);
  
  const leftHandleProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const leftHandleProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const leftHandleProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', leftHandleProfileOrigin, leftHandleProfileXDir);
  const leftHandleProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, leftHandleProfilePosition, handleWidth, handleDepth);
  
  const leftHandleSolid = createEntity('IFCEXTRUDEDAREASOLID', leftHandleProfile, leftHandlePosition, extrusionDir, handleHeight);
  solids.push(leftHandleSolid);
  
  // Right handle on right door
  const rightHandleOrigin = createEntity('IFCCARTESIANPOINT', [-doorWidth/2 + 0.08 + doorGap, doorCenterY + panelThickness/2 + handleDepth/2, doorCenterZ - handleHeight/2]);
  const rightHandleZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const rightHandleXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const rightHandlePosition = createEntity('IFCAXIS2PLACEMENT3D', rightHandleOrigin, rightHandleZDir, rightHandleXDir);
  
  const rightHandleProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const rightHandleProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const rightHandleProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', rightHandleProfileOrigin, rightHandleProfileXDir);
  const rightHandleProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, rightHandleProfilePosition, handleWidth, handleDepth);
  
  const rightHandleSolid = createEntity('IFCEXTRUDEDAREASOLID', rightHandleProfile, rightHandlePosition, extrusionDir, handleHeight);
  solids.push(rightHandleSolid);
  
  // ==========================================================
  // 8. INTERNAL SHELVES
  // ==========================================================
  const shelfWidth = interiorWidth - 0.01; // Small gap from sides
  const shelfDepth = interiorDepth - 0.02; // Small gap from back
  
  // Calculate shelf positions based on configuration
  const shelfPositions: { z: number; width: number }[] = [];
  
  if (shelfType === 'mixed' && fixedShelves > 0 && halfShelves > 0) {
    // Implement layout: 1 fixed at center, 2 half shelves
    const fixedZ = interiorBottom + usableHeight * 0.5;
    shelfPositions.push({ z: fixedZ, width: shelfWidth });
    
    const halfShelfZ1 = interiorBottom + usableHeight * 0.25;
    const halfShelfZ2 = interiorBottom + usableHeight * 0.75;
    shelfPositions.push({ z: halfShelfZ1, width: shelfWidth / 2 - 0.01 });
    shelfPositions.push({ z: halfShelfZ2, width: shelfWidth / 2 - 0.01 });
  } else {
    // Regular adjustable shelves - evenly distributed
    const spacing = usableHeight / (shelfCount + 1);
    for (let i = 1; i <= shelfCount; i++) {
      const z = interiorBottom + (spacing * i);
      shelfPositions.push({ z, width: shelfWidth });
    }
  }
  
  // Create each shelf
  shelfPositions.forEach((shelf, idx) => {
    const isHalfShelf = shelfType === 'mixed' && shelf.width < shelfWidth;
    const xOffset = isHalfShelf ? (idx % 2 === 0 ? -shelfWidth/4 : shelfWidth/4) : 0;
    
    const shelfOrigin = createEntity('IFCCARTESIANPOINT', [xOffset, 0., shelf.z]);
    const shelfZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const shelfXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
    const shelfPosition = createEntity('IFCAXIS2PLACEMENT3D', shelfOrigin, shelfZDir, shelfXDir);
    
    const shelfProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
    const shelfProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
    const shelfProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', shelfProfileOrigin, shelfProfileXDir);
    const shelfProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, shelfProfilePosition, shelf.width, shelfDepth);
    
    const shelfSolid = createEntity('IFCEXTRUDEDAREASOLID', shelfProfile, shelfPosition, extrusionDir, shelfThickness);
    solids.push(shelfSolid);
  });
  
  console.log(`Storage Cupboard geometry created: ${solids.length} solid components`);
  
  // Create shape representation
  const shapeRepresentation = createEntity(
    'IFCSHAPEREPRESENTATION',
    contextId,
    'Body',
    'SweptSolid',
    solids
  );
  
  return createEntity('IFCPRODUCTDEFINITIONSHAPE', null, null, [shapeRepresentation]);
}

/**
 * Create professional workbench geometry with distinct components
 * LOD 200-300: Frame legs, crossbars, and worktop
 * 
 * Geometry Components:
 * 1. 4 Vertical legs (square tubular steel)
 * 2. Top frame crossbars (front, back, sides)
 * 3. Lower frame bracing (optional, based on variant)
 * 4. Worktop surface
 */
function createWorkbenchGeometry(
  dimensions: any,
  createEntity: Function,
  contextId: number,
  configuration?: any,
  product?: any,
  isIndustrial: boolean = false,
  hasCastors: boolean = false
): number {
  const E = (value: string) => ({ __ifcEnum: value });
  
  const { width, height, depth } = dimensions;
  
  // Workbench constants (matching 3D viewer)
  const LEG_SIZE = 0.06; // 60mm square legs
  const CASTOR_HEIGHT = 0.12; // 120mm castors
  const FOOT_HEIGHT = 0.05; // 50mm levelling feet
  const WORKTOP_THICKNESS = 0.04; // 40mm worktop
  const WORKTOP_OVERHANG = 0.02; // 20mm overhang each side
  
  // Calculate leg dimensions
  const legOffset = hasCastors ? CASTOR_HEIGHT : FOOT_HEIGHT;
  const legHeight = height - legOffset;
  
  console.log('Creating workbench geometry:', {
    width, height, depth,
    isIndustrial,
    hasCastors,
    legHeight,
    legOffset
  });
  
  const solids: number[] = [];
  const extrusionDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  
  // Helper function to create a vertical extrusion (box) at specified position
  const createBox = (centerX: number, centerY: number, baseZ: number, boxWidth: number, boxDepth: number, boxHeight: number): number => {
    const origin = createEntity('IFCCARTESIANPOINT', [centerX, centerY, baseZ]);
    const zDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const xDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
    const position = createEntity('IFCAXIS2PLACEMENT3D', origin, zDir, xDir);
    
    const profileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
    const profileXDir = createEntity('IFCDIRECTION', [1., 0.]);
    const profilePosition = createEntity('IFCAXIS2PLACEMENT2D', profileOrigin, profileXDir);
    const profile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, profilePosition, boxWidth, boxDepth);
    
    return createEntity('IFCEXTRUDEDAREASOLID', profile, position, extrusionDir, boxHeight);
  };
  
  // ==========================================================
  // 1. FOUR VERTICAL LEGS + CASTORS/FEET
  // Positioned at corners, inset by half leg size
  // ==========================================================
  const legPositions = [
    // [X, Y] positions for each leg (centered on leg)
    [width/2 - LEG_SIZE/2, depth/2 - LEG_SIZE/2],   // Front-right
    [-width/2 + LEG_SIZE/2, depth/2 - LEG_SIZE/2],  // Front-left
    [width/2 - LEG_SIZE/2, -depth/2 + LEG_SIZE/2],  // Back-right
    [-width/2 + LEG_SIZE/2, -depth/2 + LEG_SIZE/2]  // Back-left
  ];
  
  legPositions.forEach(([x, y]) => {
    // Add leg
    solids.push(createBox(x, y, legOffset, LEG_SIZE, LEG_SIZE, legHeight));
    
    // Add castor or levelling foot at base
    if (hasCastors) {
      // Castor housing (bracket) - 60mm x 60mm x 40mm
      const CASTOR_BRACKET_SIZE = 0.06;
      const CASTOR_BRACKET_HEIGHT = 0.04;
      solids.push(createBox(x, y, CASTOR_HEIGHT - CASTOR_BRACKET_HEIGHT, CASTOR_BRACKET_SIZE, CASTOR_BRACKET_SIZE, CASTOR_BRACKET_HEIGHT));
      
      // Castor wheel (simplified as box) - 100mm diameter x 40mm wide
      const WHEEL_DIAMETER = 0.10;
      const WHEEL_WIDTH = 0.04;
      const wheelZ = WHEEL_DIAMETER / 2;
      solids.push(createBox(x, y, wheelZ - WHEEL_DIAMETER/4, WHEEL_WIDTH, WHEEL_DIAMETER, WHEEL_DIAMETER/2));
    } else {
      // Levelling foot (simplified as small cylinder/box) - 80mm base x 50mm height
      const FOOT_BASE = 0.08;
      const FOOT_HEIGHT_ACTUAL = 0.05;
      solids.push(createBox(x, y, 0, FOOT_BASE, FOOT_BASE, FOOT_HEIGHT_ACTUAL));
    }
  });
  
  // ==========================================================
  // 2. TOP FRAME CROSSBARS (at worktop height)
  // ==========================================================
  const crossbarZ = height - LEG_SIZE/2;
  const crossbarCenterZ = height - LEG_SIZE;
  
  // Front crossbar (full width)
  solids.push(createBox(0, depth/2 - LEG_SIZE/2, crossbarCenterZ, width, LEG_SIZE, LEG_SIZE));
  
  // Back crossbar (full width)
  solids.push(createBox(0, -depth/2 + LEG_SIZE/2, crossbarCenterZ, width, LEG_SIZE, LEG_SIZE));
  
  // Left side crossbar (between front and back legs)
  const sideBarLength = depth - LEG_SIZE * 2;
  solids.push(createBox(-width/2 + LEG_SIZE/2, 0, crossbarCenterZ, LEG_SIZE, sideBarLength, LEG_SIZE));
  
  // Right side crossbar
  solids.push(createBox(width/2 - LEG_SIZE/2, 0, crossbarCenterZ, LEG_SIZE, sideBarLength, LEG_SIZE));
  
  // ==========================================================
  // 3. LOWER FRAME BRACING (variant-specific)
  // ==========================================================
  const lowerBraceZ = legOffset + 0.15; // 150mm above floor/castor
  
  if (isIndustrial) {
    // Industrial: H-frame with left, right, and center braces
    // Left side brace
    solids.push(createBox(-width/2 + LEG_SIZE/2, 0, lowerBraceZ, LEG_SIZE, sideBarLength, LEG_SIZE));
    // Right side brace
    solids.push(createBox(width/2 - LEG_SIZE/2, 0, lowerBraceZ, LEG_SIZE, sideBarLength, LEG_SIZE));
    // Center cross brace
    const centerBraceWidth = width - LEG_SIZE * 2;
    solids.push(createBox(0, 0, lowerBraceZ, centerBraceWidth, LEG_SIZE, LEG_SIZE));
  } else {
    // Heavy Duty: Single back brace
    const backBraceWidth = width - 0.1; // Slightly shorter
    const backBraceHeight = LEG_SIZE * 0.8;
    const backBraceZ = 0.2 + (hasCastors ? 0.05 : 0);
    solids.push(createBox(0, -depth/2 + LEG_SIZE/2, backBraceZ, backBraceWidth, backBraceHeight, backBraceHeight));
  }
  
  // ==========================================================
  // 4. WORKTOP SURFACE
  // Overhangs frame slightly, sits on top of frame
  // ==========================================================
  const worktopWidth = width + WORKTOP_OVERHANG * 2;
  const worktopDepth = depth + WORKTOP_OVERHANG * 2;
  const worktopZ = height; // Sits on top of frame
  
  solids.push(createBox(0, 0, worktopZ, worktopWidth, worktopDepth, WORKTOP_THICKNESS));
  
  // ==========================================================
  // 5. UNDER-BENCH STORAGE (drawer units, cabinets, undershelves)
  // Matching Viewer3D.tsx geometry exactly
  // ==========================================================
  const underBenchOption = configuration?.selections?.under_bench;
  const underBenchPos = configuration?.selections?.under_bench_pos || 'right';
  const embeddedCabinets = configuration?.embeddedCabinets || [];
  
  if (underBenchOption && underBenchOption !== 'B0' && underBenchOption !== 'iw-ub-none') {
    const DRAWER_UNIT_WIDTH = 0.56; // 560mm drawer unit width
    const UNIT_DEPTH = depth - 0.1;
    const DRAWER_HEIGHT = 0.15; // Height per drawer (150mm)
    const SHELL_THICK = 0.02;
    const SHELF_THICK = 0.025; // Undershelf thickness
    
    // Positions - flush against legs
    // NOTE: IFC X-axis is flipped relative to Three.js viewer orientation
    // In Three.js: +X = right, -X = left (when viewing from front)
    // In IFC/Blender: +X appears on LEFT, -X appears on RIGHT (when viewing from front)
    // So we SWAP the signs to match the web viewer appearance
    const flushLeft = width/2 - LEG_SIZE - DRAWER_UNIT_WIDTH/2;   // Positive X = LEFT in IFC
    const flushRight = -width/2 + LEG_SIZE + DRAWER_UNIT_WIDTH/2; // Negative X = RIGHT in IFC
    
    // Determine single unit position based on under_bench_pos setting
    let singlePos: number;
    let singlePlacement: 'left' | 'right';
    
    if (underBenchPos === 'left' || underBenchPos === 'pos-left' || underBenchPos === 'PL') {
      singlePos = flushLeft;
      singlePlacement = 'left';
    } else if (underBenchPos === 'center' || underBenchPos === 'pos-center' || underBenchPos === 'PC') {
      singlePos = 0;
      singlePlacement = 'right'; // Default for embedded cabinet lookup
    } else {
      // Default: right (pos-right, PR, right, or any other value)
      singlePos = flushRight;
      singlePlacement = 'right';
    }
    
    console.log(`IFC: Under-bench position: ${underBenchPos} → singlePos=${singlePos.toFixed(3)}m (flushL=${flushLeft.toFixed(3)}, flushR=${flushRight.toFixed(3)})`);
    
    // Undershelf height (lower position on frame)
    const shelfHeight = legOffset + 0.2; // 200mm above floor
    
    // Helper: Add undershelf (spans frame width)
    const addUndershelf = (shelfWidth?: number, offsetX?: number) => {
      const sw = shelfWidth || (width - 0.15);
      const ox = offsetX || 0;
      solids.push(createBox(ox, 0, shelfHeight, sw, depth - 0.2, SHELF_THICK));
    };
    
    // Helper: Add drawer unit with individual drawer fronts
    // Drawers stack from TOP (i=0) to BOTTOM (i=n-1) to match 3D viewer
    const addDrawerUnit = (x: number, drawerCount: number, suspended: boolean = true) => {
      const unitHeight = drawerCount * DRAWER_HEIGHT + 0.05;
      const unitZ = suspended ? (height - unitHeight - 0.05) : (shelfHeight + SHELF_THICK);
    
      // Cabinet shell/body
      solids.push(createBox(x, 0, unitZ, DRAWER_UNIT_WIDTH, UNIT_DEPTH, unitHeight));
      
      // Individual drawer fronts (stacked from TOP to BOTTOM like 3D viewer)
      for (let i = 0; i < drawerCount; i++) {
        // Top drawer (i=0) is at top, each subsequent drawer is lower
        const drawerZ = unitZ + unitHeight - 0.025 - ((i + 1) * DRAWER_HEIGHT);
        // Drawer front face at front of unit
        solids.push(createBox(
          x, 
          UNIT_DEPTH/2 + 0.01, // Front face (positive Y = front)
          drawerZ,
          DRAWER_UNIT_WIDTH - 0.04,
          SHELL_THICK,
          DRAWER_HEIGHT - 0.01
        ));
      }
      
      console.log(`IFC: Added ${drawerCount}-drawer unit at x=${x.toFixed(3)} (pos=${underBenchPos})`);
    };
    
    // Helper: Add cupboard unit (single door)
    const addCupboardUnit = (x: number) => {
      const cupHeight = 0.65;
      const unitZ = height - cupHeight - 0.05;
      
      // Cupboard body
      solids.push(createBox(x, 0, unitZ, DRAWER_UNIT_WIDTH, UNIT_DEPTH, cupHeight));
      
      // Door front
      solids.push(createBox(
        x,
        UNIT_DEPTH/2 - SHELL_THICK/2 + 0.01,
        unitZ + cupHeight/2,
        DRAWER_UNIT_WIDTH - 0.04,
        SHELL_THICK,
        cupHeight - 0.04
      ));
    };
    
    // Helper: Add cabinet with embedded drawer configuration
    const addCabinetWithDrawers = (x: number, placement: 'left' | 'right') => {
      const embeddedConfig = embeddedCabinets.find((c: any) => c.placement === placement);
      const customDrawers = embeddedConfig?.configuration?.customDrawers;
      
      if (customDrawers && customDrawers.length > 0 && product) {
        const drawerGroup = product.groups?.find((g: any) => g.type === 'drawer_stack' || g.id === 'config');
        const drawersWithHeights = customDrawers.map((d: any) => {
          const opt = drawerGroup?.options?.find((o: any) => o.id === d.id);
          return opt?.meta?.front || 100;
        }).sort((a: number, b: number) => b - a); // Largest at bottom
        
        const totalHeight = drawersWithHeights.reduce((sum: number, h: number) => sum + h, 0) / 1000 + 0.07;
        const unitZ = height - totalHeight - 0.05;
        
        // Cabinet shell
        solids.push(createBox(x, 0, unitZ, DRAWER_UNIT_WIDTH, UNIT_DEPTH, totalHeight));
        
        // Individual drawer fronts
        let currentZ = unitZ + 0.04;
        drawersWithHeights.forEach((heightMm: number) => {
          const dh = heightMm / 1000;
          solids.push(createBox(
            x,
            UNIT_DEPTH/2 - SHELL_THICK/2 + 0.01,
            currentZ + dh/2,
            DRAWER_UNIT_WIDTH - 0.04,
            SHELL_THICK,
            dh - 0.004
          ));
          currentZ += dh;
        });
        
        console.log(`IFC: Added embedded cabinet at ${placement} with ${customDrawers.length} drawers`);
      } else {
        // Fallback to 5-drawer cabinet
        addDrawerUnit(x, 5, true);
      }
    };
    
    // Heavy Duty (Bxx codes) - match Viewer3D.tsx switch statement exactly
    if (underBenchOption.startsWith('B')) {
      switch(underBenchOption) {
        case 'B1': addDrawerUnit(singlePos, 1, true); break;
        case 'B2': addDrawerUnit(singlePos, 2, true); break;
        case 'B3': addDrawerUnit(singlePos, 3, true); break;
        case 'B4': case 'B28': addCabinetWithDrawers(singlePos, singlePlacement as 'left' | 'right'); break;
        case 'B5': addCupboardUnit(singlePos); break;
        case 'B6': addCabinetWithDrawers(flushLeft, 'left'); addDrawerUnit(flushRight, 1, true); break;
        case 'B7': addCupboardUnit(flushLeft); addDrawerUnit(flushRight, 1, true); break;
        case 'B12': addDrawerUnit(flushLeft, 3, true); addDrawerUnit(flushRight, 3, true); break;
        case 'B13': addCabinetWithDrawers(flushLeft, 'left'); addCupboardUnit(flushRight); break;
        case 'B14': addUndershelf(); break;
        case 'B15': case 'B18': addUndershelf(); addDrawerUnit(singlePos, 1, true); break;
        case 'B16': addUndershelf(); addDrawerUnit(singlePos, 2, true); break;
        case 'B17': addUndershelf(); addDrawerUnit(singlePos, 3, true); break;
        case 'B19': addUndershelf(); addDrawerUnit(flushLeft, 1, true); addDrawerUnit(flushRight, 2, true); break;
        case 'B20': addUndershelf(); addDrawerUnit(flushLeft, 1, true); addDrawerUnit(flushRight, 3, true); break;
        case 'B21': case 'B22': addUndershelf(); addCabinetWithDrawers(singlePos, singlePlacement as 'left' | 'right'); break;
        case 'B23': case 'B24': addUndershelf(); addCupboardUnit(singlePos); break;
        case 'B25': addUndershelf(); addCabinetWithDrawers(flushLeft, 'left'); addCupboardUnit(flushRight); break;
        case 'B26': addUndershelf(); addCabinetWithDrawers(flushLeft, 'left'); addCabinetWithDrawers(flushRight, 'right'); break;
        case 'B27': addUndershelf(); addCupboardUnit(flushLeft); addCupboardUnit(flushRight); break;
      }
    }
    
    // Industrial (iw-ub-xxx codes)
    if (underBenchOption.startsWith('iw-ub-')) {
      const addHalfShelf = () => addUndershelf(width/2 - 0.05, -width/4);
      
      switch(underBenchOption) {
        case 'iw-ub-shelf': addUndershelf(); break;
        case 'iw-ub-half-shelf': addHalfShelf(); break;
        case 'iw-ub-drawer-1': addDrawerUnit(singlePos, 1, true); break;
        case 'iw-ub-door-1': addCupboardUnit(singlePos); break;
        case 'iw-ub-cabinet-1': addCabinetWithDrawers(singlePos, singlePlacement as 'left' | 'right'); break;
        case 'iw-ub-drawer-2': addDrawerUnit(flushLeft, 1, true); addDrawerUnit(flushRight, 1, true); break;
        case 'iw-ub-door-2': addCupboardUnit(flushLeft); addCupboardUnit(flushRight); break;
        case 'iw-ub-cabinet-2': addCabinetWithDrawers(flushLeft, 'left'); addCabinetWithDrawers(flushRight, 'right'); break;
        case 'iw-ub-door-drawer': addCupboardUnit(flushLeft); addDrawerUnit(flushRight, 1, true); break;
        case 'iw-ub-cabinet-door': addCabinetWithDrawers(flushLeft, 'left'); addCupboardUnit(flushRight); break;
        case 'iw-ub-shelf-cabinet': case 'iw-ub-shelf_cab': addUndershelf(); addCabinetWithDrawers(flushRight, 'right'); break;
        case 'iw-ub-half-shelf-drawer-cabinet': addHalfShelf(); addDrawerUnit(flushLeft, 1, true); addCabinetWithDrawers(flushRight, 'right'); break;
        case 'iw-ub-half-shelf-drawer-cupboard': addHalfShelf(); addDrawerUnit(flushLeft, 1, true); addCupboardUnit(flushRight); break;
      }
    }
  }
  
  // ==========================================================
  // 6. ABOVE-BENCH STRUCTURE - Matching Viewer3D.tsx exactly
  // Uses 3 posts (left, center, right), multiple shelves, and back panels
  // ==========================================================
  const aboveBenchOption = configuration?.selections?.above_bench;
  
  if (aboveBenchOption && aboveBenchOption !== 'T0' && aboveBenchOption !== 'iw-ab-none') {
    const POST_SIZE = 0.04; // 40mm square posts
    const POST_HEIGHT = 1.1; // Height of uprights above worktop
    const SHELF_THICK = 0.02;
    const SHELF_DEPTH = 0.25;
    const PANEL_THICK = 0.015; // Back panel thickness
    const PANEL_HEIGHT = 0.3; // Pegboard/louvre panel height
    
    // Z position base (top of worktop)
    const baseZ = height + WORKTOP_THICKNESS;
    const backY = -depth/2 + POST_SIZE/2 + 0.01; // Y position for back elements
    
    // Bay width (space between posts for panels)
    const bayWidth = (width - POST_SIZE * 3) / 2 - 0.02;
    
    // Power panel only (no frame structure)
    const isPowerOnly = aboveBenchOption === 'iw-ab-power' || aboveBenchOption === 'P';
    
    if (isPowerOnly) {
      // Just a power rail at the back
      solids.push(createBox(0, backY, baseZ + 0.04, width - 0.12, 0.04, 0.1));
    } else {
      // Determine shelf positions and panel config based on T-code
      // Matching Viewer3D.tsx switch statement
      let shelfHeights: number[] = [];
      let panels: { y: number; left: string; right: string }[] = [];
      const yLower = 0.45; // Lower panel position
      const yUpper = 0.65; // Upper panel position (if 4 panels)
      
      switch(aboveBenchOption) {
        case 'T1': shelfHeights = [1.05, 0.7, 0.35]; break;
        case 'T2': shelfHeights = [1.05, 0.8, 0.55, 0.3]; break;
        case 'T3':
          shelfHeights = [1.05, 0.75];
          panels = [{ y: yLower, left: 'panel', right: 'panel' }];
          break;
        case 'T4':
          shelfHeights = [1.05, 0.75];
          panels = [{ y: yLower, left: 'panel', right: 'panel' }];
          break;
        case 'T5':
          shelfHeights = [1.05, 0.75];
          panels = [{ y: yLower, left: 'panel', right: 'panel' }];
          break;
        case 'T6':
          shelfHeights = [1.05];
          panels = [
            { y: yUpper, left: 'panel', right: 'panel' },
            { y: yLower, left: 'panel', right: 'panel' }
          ];
          break;
        case 'T7':
          shelfHeights = [1.05];
          panels = [
            { y: yUpper, left: 'panel', right: 'panel' },
            { y: yLower, left: 'panel', right: 'panel' }
          ];
          break;
        case 'T8':
          shelfHeights = [1.05];
          panels = [
            { y: yUpper, left: 'panel', right: 'panel' },
            { y: yLower, left: 'panel', right: 'panel' }
          ];
          break;
        case 'T9': shelfHeights = [0.5]; break; // Fixed shelf only
        case 'T10': shelfHeights = [0.5]; break; // Inclined shelf
        // Industrial above-bench options
        case 'iw-ab-shelf': case 'SP': shelfHeights = [1.05]; break;
        default:
          if (aboveBenchOption.includes('shelf')) {
            shelfHeights = [1.05];
          }
      }
      
      // Only render frame if we have shelves or panels
      if (shelfHeights.length > 0 || panels.length > 0) {
        // THREE UPRIGHT POSTS (left, center, right) - matching Viewer3D
        // Posts sit ON TOP of worktop, so start at baseZ (not baseZ + offset)
        const postPositions = [
          -width/2 + POST_SIZE/2 + 0.02,  // Left
          0,                               // Center
          width/2 - POST_SIZE/2 - 0.02    // Right
        ];
        
        postPositions.forEach(xPos => {
          // Start post at baseZ (top of worktop), extend UP by POST_HEIGHT
          solids.push(createBox(xPos, backY, baseZ, POST_SIZE, POST_SIZE, POST_HEIGHT));
        });
        
        // TOP CROSSBAR (connects all posts) - at top of posts
        solids.push(createBox(
          0,
          backY, 
          baseZ + POST_HEIGHT - POST_SIZE, // Top of posts minus crossbar thickness
          width - 0.04,
          POST_SIZE,
          POST_SIZE
        ));
        
        // SHELVES at specified heights (relative to baseZ)
        shelfHeights.forEach(h => {
          solids.push(createBox(
            0,
            backY + SHELF_DEPTH/2 - POST_SIZE/2, // Slightly forward of posts
            baseZ + h - SHELF_THICK/2, // Position shelf at this height
            width - 0.1,
            SHELF_DEPTH,
            SHELF_THICK
          ));
        });
        
        // BACK PANELS (pegboard/louvre) - two bays between posts
        panels.forEach(panelRow => {
          const panelZ = baseZ + panelRow.y - PANEL_HEIGHT/2;
          
          // Left bay panel (between left and center post)
          solids.push(createBox(
            -bayWidth/2 - POST_SIZE/2,
            backY,
            panelZ,
            bayWidth,
            PANEL_THICK,
            PANEL_HEIGHT
          ));
          
          // Right bay panel (between center and right post)
        solids.push(createBox(
            bayWidth/2 + POST_SIZE/2,
            backY,
            panelZ,
            bayWidth,
            PANEL_THICK,
            PANEL_HEIGHT
        ));
        });
        
        // Power panel for SP (Shelf + Power) options
        const hasPower = aboveBenchOption === 'SP' || 
                         aboveBenchOption.includes('power') ||
                         aboveBenchOption === 'iw-ab-shelf-power';
        if (hasPower) {
          solids.push(createBox(0, backY + 0.02, baseZ + 0.15, width - 0.12, 0.04, 0.1));
      }
    }
    }
    
    console.log(`IFC: Above-bench ${aboveBenchOption} added with shelves and panels`);
  }
  
  // Create single shape representation with all geometry components
  const shapeRepresentation = createEntity('IFCSHAPEREPRESENTATION', contextId, E('Body'), E('SweptSolid'), solids);
  
  console.log(`Workbench geometry created: ${solids.length} solid components`);
  
  // Product definition shape
  return createEntity('IFCPRODUCTDEFINITIONSHAPE', null, null, [shapeRepresentation]);
}

/**
 * Create HiLo Height-Adjustable Workbench geometry
 * BIM model exported at MAXIMUM EXTENDED HEIGHT for clearance checking
 * 
 * GEOMETRY REQUIREMENTS:
 * - Export at maximum height (DL6: 1260mm, DL2: 1230mm)
 * - Lift columns with foot plates
 * - Under-top frame
 * - Worktop surface
 * - Optional above-bench accessories (uprights, panels, shelf)
 * 
 * Components:
 * 1. Foot plates (static on floor)
 * 2. Outer lift columns
 * 3. Inner telescoping columns (extended)
 * 4. Under-top frame rails
 * 5. Worktop surface
 * 6. Above-bench system (if configured)
 */
function createHiLoWorkbenchGeometry(
  dimensions: any,
  createEntity: Function,
  contextId: number,
  configuration?: any,
  product?: any
): number {
  const E = (value: string) => ({ __ifcEnum: value });
  
  // ========================================
  // CONFIGURATION EXTRACTION
  // ========================================
  const liftModelGroup = product?.groups?.find((g: any) => g.id === 'lift_model');
  const selectedLiftId = configuration?.selections?.['lift_model'];
  const liftOption = liftModelGroup?.options?.find((o: any) => o.id === selectedLiftId);
  
  const sizeGroup = product?.groups?.find((g: any) => g.id === 'size');
  const selectedSizeId = configuration?.selections?.['size'];
  const sizeOption = sizeGroup?.options?.find((o: any) => o.id === selectedSizeId);
  
  const aboveBenchId = configuration?.selections?.['above_bench'];
  
  // Determine lift model type (DL2 vs DL6)
  const isDL2 = selectedLiftId?.includes('dl2');
  
  // Get max height for BIM export (fully extended position)
  const maxHeightMm = liftOption?.meta?.maxHeightMm || (isDL2 ? 1230 : 1260);
  const currentHeightM = maxHeightMm / 1000; // Export at MAX height
  
  // Dimensions from configuration
  const width = sizeOption?.meta?.width || 1.5;
  const depth = sizeOption?.meta?.depth || 0.75;
  
  console.log('Creating HiLo Workbench geometry (BIM-ready at MAX height):', {
    liftModel: isDL2 ? 'DL2' : 'DL6',
    width: `${(width * 1000).toFixed(0)}mm`,
    depth: `${(depth * 1000).toFixed(0)}mm`,
    height: `${maxHeightMm}mm (MAX)`,
    aboveBench: aboveBenchId
  });
  
  // ========================================
  // FIXED DIMENSIONS (matching Viewer3D.tsx)
  // ========================================
  const footPlateHeight = 0.025;
  const footPlateWidth = isDL2 ? 0.16 : 0.12;
  const footPlateDepth = isDL2 ? 0.55 : 0.45;
  const outerColumnWidth = isDL2 ? 0.12 : 0.08;
  const outerColumnDepth = isDL2 ? 0.12 : 0.08;
  const outerColumnHeight = isDL2 ? 0.45 : 0.40;
  const innerColumnScale = isDL2 ? 0.75 : 0.65;
  const columnX = width / 2 - 0.18;
  const worktopThickness = 0.035;
  const frameHeight = isDL2 ? 0.05 : 0.04;
  const frameThickness = isDL2 ? 0.06 : 0.05;
  
  const solids: number[] = [];
  const extrusionDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  
  // Helper function to create a vertical extrusion (box) at specified position
  const createBox = (centerX: number, centerY: number, baseZ: number, boxWidth: number, boxDepth: number, boxHeight: number): number => {
    const origin = createEntity('IFCCARTESIANPOINT', [centerX, centerY, baseZ]);
    const zDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const xDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
    const position = createEntity('IFCAXIS2PLACEMENT3D', origin, zDir, xDir);
    
    const profileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
    const profileXDir = createEntity('IFCDIRECTION', [1., 0.]);
    const profilePosition = createEntity('IFCAXIS2PLACEMENT2D', profileOrigin, profileXDir);
    const profile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, profilePosition, boxWidth, boxDepth);
    
    return createEntity('IFCEXTRUDEDAREASOLID', profile, position, extrusionDir, boxHeight);
  };
  
  // ========================================
  // 1. FOOT PLATES (on floor, Y=0)
  // ========================================
  [-columnX, columnX].forEach(x => {
    solids.push(createBox(x, 0, 0, footPlateWidth, footPlateDepth, footPlateHeight));
  });
  
  // ========================================
  // 2. OUTER COLUMNS (fixed, above foot plates)
  // ========================================
  [-columnX, columnX].forEach(x => {
    solids.push(createBox(x, 0, footPlateHeight, outerColumnWidth, outerColumnDepth, outerColumnHeight));
  });
  
  // ========================================
  // 3. INNER COLUMNS (telescoping, fully extended)
  // ========================================
  const outerColumnTopZ = footPlateHeight + outerColumnHeight;
  const topMountZ = currentHeightM - 0.02;
  const innerColumnLength = Math.max(0.05, topMountZ - outerColumnTopZ);
  const innerColumnWidth = outerColumnWidth * innerColumnScale;
  const innerColumnDepth = outerColumnDepth * innerColumnScale;
  
  [-columnX, columnX].forEach(x => {
    solids.push(createBox(x, 0, outerColumnTopZ, innerColumnWidth, innerColumnDepth, innerColumnLength));
  });
  
  // ========================================
  // 4. TOP MOUNT BRACKETS
  // ========================================
  const topMountWidth = isDL2 ? 0.14 : 0.10;
  const topMountDepth = isDL2 ? 0.14 : 0.12;
  [-columnX, columnX].forEach(x => {
    solids.push(createBox(x, 0, topMountZ, topMountWidth, topMountDepth, 0.04));
  });
  
  // ========================================
  // 5. UNDER-TOP FRAME
  // ========================================
  const frameZ = currentHeightM - frameHeight;
  
  // Front and rear rails
  solids.push(createBox(0, depth/2 - frameThickness/2, frameZ, width - 0.06, frameThickness, frameHeight));
  solids.push(createBox(0, -depth/2 + frameThickness/2, frameZ, width - 0.06, frameThickness, frameHeight));
  
  // Side rails at column positions
  solids.push(createBox(-columnX, 0, frameZ, frameThickness, depth - frameThickness * 2, frameHeight));
  solids.push(createBox(columnX, 0, frameZ, frameThickness, depth - frameThickness * 2, frameHeight));
  
  // Center cross brace
  solids.push(createBox(0, 0, frameZ, width - 0.36, frameHeight * 0.8, frameThickness * 0.7));
  
  // ========================================
  // 6. WORKTOP
  // ========================================
  const worktopZ = currentHeightM;
  solids.push(createBox(0, 0, worktopZ, width, depth, worktopThickness));
  
  // ========================================
  // 7. ABOVE-BENCH ACCESSORIES (if configured)
  // ========================================
  const hasAboveBench = aboveBenchId && aboveBenchId !== 'ab-none' && aboveBenchId !== 'none';
  const hasFullSystem = hasAboveBench && (aboveBenchId.includes('shelf') || aboveBenchId.includes('power'));
  
  if (hasFullSystem) {
    const accessoryBaseZ = currentHeightM + worktopThickness;
    const postHeight = 0.70;
    const postWidth = 0.05;
    const panelHeight = 0.45;
    const panelWidth = (width - 0.15) / 2;
    
    // Left upright post
    solids.push(createBox(-width/2 + 0.04, -depth/2 + 0.04, accessoryBaseZ, postWidth, postWidth, postHeight));
    // Right upright post
    solids.push(createBox(width/2 - 0.04, -depth/2 + 0.04, accessoryBaseZ, postWidth, postWidth, postHeight));
    // Top crossbar
    solids.push(createBox(0, -depth/2 + 0.04, accessoryBaseZ + postHeight - 0.03, width - 0.06, postWidth, 0.05));
    
    // Pegboard panel (left)
    solids.push(createBox(-panelWidth/2 - 0.001, -depth/2 + 0.06, accessoryBaseZ + 0.15 + panelHeight/2, panelWidth, 0.015, panelHeight));
    // Louvre panel (right)
    solids.push(createBox(panelWidth/2 + 0.001, -depth/2 + 0.06, accessoryBaseZ + 0.15 + panelHeight/2, panelWidth, 0.015, panelHeight));
    
    // Top shelf (if included)
    if (aboveBenchId.includes('shelf') || aboveBenchId.includes('complete')) {
      const shelfZ = accessoryBaseZ + postHeight - 0.095;
      const shelfWidth = width - 0.12;
      const shelfDepth = 0.22;
      // Shelf base
      solids.push(createBox(0, -depth/2 + shelfDepth/2 + 0.05, shelfZ, shelfWidth, shelfDepth, 0.003));
      // Shelf rear lip
      solids.push(createBox(0, -depth/2 + 0.05 + 0.003, shelfZ + 0.095/2, shelfWidth, 0.006, 0.095));
    }
    
    // Power board (if included)
    if (aboveBenchId.includes('power') || aboveBenchId.includes('complete')) {
      solids.push(createBox(0, -depth/2 + 0.06, accessoryBaseZ + 0.08, width - 0.1, 0.03, 0.06));
    }
  }
  
  // ========================================
  // 8. CONTROL BOX (on right column)
  // ========================================
  solids.push(createBox(columnX + (isDL2 ? 0.08 : 0.06), 0, 0.17, 0.04, 0.03, 0.10));
  
  // Create composite shape from all solids
  const shapeRepItems: number[] = solids;
  
  const shapeRep = createEntity('IFCSHAPEREPRESENTATION', contextId, 'Body', 'SweptSolid', shapeRepItems);
  return createEntity('IFCPRODUCTDEFINITIONSHAPE', null, null, [shapeRep]);
}

/**
 * Create Mobile Tool Cart geometry with all components
 * BIM-ready IFC export matching Viewer3D.tsx MobileToolCartGroup exactly
 * 
 * GEOMETRY REQUIREMENTS (per specification):
 * - Use IfcExtrudedAreaSolid with IfcRectangleProfileDef
 * - Model as assembled solids, not one combined box
 * - Drawers stack from bottom up, larger drawers at bottom
 * - No floating benchtop gap
 * - Plinth integrated into cabinet shell
 * 
 * Components:
 * 1. 4 Castors at corners
 * 2. Integrated plinth (recessed base)
 * 3. Cabinet body shell (sides, back, top, bottom, center divider)
 * 4. Worktop surface (flush, no gap)
 * 5. Dual drawer bays with individual drawer fronts + handles
 * 6. Side grab handles
 * 7. Rear accessory system (posts, crossbar, panels, tray shelves)
 */
function createMobileToolCartGeometry(
  dimensions: any,
  createEntity: Function,
  contextId: number,
  configuration?: any,
  product?: any
): number {
  const E = (value: string) => ({ __ifcEnum: value });
  
  // ========================================
  // CONFIGURATION EXTRACTION
  // ========================================
  // Bay preset defines the configuration - width is FIXED at 1130mm per Boscotek catalogue
  const bayPresetGroup = product?.groups?.find((g: any) => g.id === 'bay_preset');
  const selectedBayPresetId = configuration?.selections?.['bay_preset'];
  const bayPreset = bayPresetGroup?.options?.find((o: any) => o.id === selectedBayPresetId);
  
  // Fixed width of 1130mm as per Boscotek TCS catalogue specification
  const cabinetWidth = bayPreset?.meta?.width || 1.13;
  
  // Drawer configurations: 150/100/75/75/75mm bottom-to-top as per dimension drawing
  const leftDrawers = bayPreset?.meta?.leftDrawers || [];
  const rightDrawers = bayPreset?.meta?.rightDrawers || [150, 100, 75, 75, 75];
  const leftCupboard = bayPreset?.meta?.leftCupboard || false;
  const rightCupboard = bayPreset?.meta?.rightCupboard || false;
  
  const hasRearPosts = configuration?.selections?.['rear_system'] === true;
  
  const getAccessoryCount = (groupId: string): number => {
    const selectedId = configuration?.selections?.[groupId];
    if (!selectedId) return 0;
    const group = product?.groups?.find((g: any) => g.id === groupId);
    const option = group?.options?.find((o: any) => o.id === selectedId);
    const val = option?.value;
    return typeof val === 'number' ? val : 0;
  };
  
  const toolboardCount = getAccessoryCount('rear_toolboard');
  const louvreCount = getAccessoryCount('rear_louvre');
  const trayCount = getAccessoryCount('rear_trays');
  
  // ========================================
  // FIXED DIMENSIONS (matching Viewer3D.tsx exactly)
  // All dimensions in METERS internally, converted from mm
  // ========================================
  const depth = 0.56;                          // 560mm
  const castorHeight = 0.10;                   // 100mm castor height
  const plinthHeight = 0.02;                   // 20mm integrated plinth
  const plinthSetback = 0.015;                 // 15mm plinth recessed from front
  const worktopThickness = 0.035;              // 35mm worktop
  const shellThickness = 0.018;                // 18mm shell panels
  const drawerReveal = 0.002;                  // 2mm gap between drawers
  const drawerStackHeight = 0.475;             // 475mm for drawer stack area
  const accessCompartmentHeight = 0.120;       // 120mm top compartment
  const cabinetBodyHeight = drawerStackHeight + accessCompartmentHeight + shellThickness * 2;
  const rearPanelHeight = 0.825;               // 825mm rear accessory height
  const worktopOverhangFront = 0.025;          // 25mm front overhang
  const worktopOverhangSide = 0.015;           // 15mm side overhang
  const bayWidth = (cabinetWidth - shellThickness * 3) / 2;
  
  // Drawer handle dimensions
  const drawerHandleWidth_factor = 0.85;       // Handle is 85% of drawer width
  const drawerHandleHeight = 0.016;            // 16mm tall handle bar
  const drawerHandleDepth = 0.012;             // 12mm deep handle
  const drawerHandleOffset = 0.012;            // 12mm from top of drawer
  
  console.log('Creating Mobile Tool Cart geometry (BIM-ready):', {
    cabinetWidth: `${(cabinetWidth * 1000).toFixed(0)}mm`,
    depth: `${(depth * 1000).toFixed(0)}mm`,
    totalHeight: `${((castorHeight + cabinetBodyHeight + worktopThickness) * 1000).toFixed(0)}mm`,
    hasRearPosts, toolboardCount, louvreCount, trayCount,
    leftDrawers: leftDrawers.join('/'),
    rightDrawers: rightDrawers.join('/'),
    leftCupboard, rightCupboard
  });
  
  const solids: number[] = [];
  const extrusionDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  
  // Helper function to create a vertical extrusion (box) at specified position
  // Uses IfcExtrudedAreaSolid with IfcRectangleProfileDef for BIM compliance
  const createBox = (centerX: number, centerY: number, baseZ: number, boxWidth: number, boxDepth: number, boxHeight: number): number => {
    const origin = createEntity('IFCCARTESIANPOINT', [centerX, centerY, baseZ]);
    const zDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const xDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
    const position = createEntity('IFCAXIS2PLACEMENT3D', origin, zDir, xDir);
    
    const profileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
    const profileXDir = createEntity('IFCDIRECTION', [1., 0.]);
    const profilePosition = createEntity('IFCAXIS2PLACEMENT2D', profileOrigin, profileXDir);
    const profile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, profilePosition, boxWidth, boxDepth);
    
    return createEntity('IFCEXTRUDEDAREASOLID', profile, position, extrusionDir, boxHeight);
  };
  
  // ========================================
  // 1. CASTORS (4 at corners - simplified cylinders as boxes)
  // ========================================
  const castorPositions = [
    [-cabinetWidth/2 + 0.07, depth/2 - 0.07],   // Front-left
    [cabinetWidth/2 - 0.07, depth/2 - 0.07],    // Front-right
    [-cabinetWidth/2 + 0.07, -depth/2 + 0.07],  // Back-left
    [cabinetWidth/2 - 0.07, -depth/2 + 0.07]    // Back-right
  ];
  
  castorPositions.forEach(([x, y]) => {
    // Castor housing plate (top)
    solids.push(createBox(x, y, castorHeight - 0.012, 0.055, 0.055, 0.012));
    // Castor stem/fork
    solids.push(createBox(x, y, 0.035, 0.04, 0.04, castorHeight - 0.035 - 0.012));
    // Wheel (simplified as box - 64mm diameter, 22mm wide)
    solids.push(createBox(x, y, 0.005, 0.022, 0.064, 0.054));
  });
  
  // ========================================
  // 2. INTEGRATED PLINTH (recessed base - part of cabinet shell)
  // Plinth is set back from front face, same color as cabinet body
  // ========================================
  const plinthZ = castorHeight;
  const plinthDepth = depth - plinthSetback;
  const plinthCenterY = -plinthSetback / 2;
  
  // Plinth base (recessed from front)
  solids.push(createBox(0, plinthCenterY, plinthZ, cabinetWidth - 0.004, plinthDepth, plinthHeight));
  
  // ========================================
  // 3. CABINET BODY SHELL (above plinth, flush connection)
  // No gap between plinth and cabinet body
  // ========================================
  const cabinetBaseZ = castorHeight + plinthHeight;
  const adjustedBodyHeight = cabinetBodyHeight - plinthHeight;
  
  // Left side panel (full height from plinth to worktop)
  solids.push(createBox(-cabinetWidth/2 + shellThickness/2, 0, cabinetBaseZ, shellThickness, depth, adjustedBodyHeight));
  // Right side panel
  solids.push(createBox(cabinetWidth/2 - shellThickness/2, 0, cabinetBaseZ, shellThickness, depth, adjustedBodyHeight));
  // Back panel (full height of drawer stack area)
  solids.push(createBox(0, -depth/2 + shellThickness/2, cabinetBaseZ, cabinetWidth - shellThickness * 2, shellThickness, drawerStackHeight - plinthHeight));
  // Back panel upper section (access compartment back)
  solids.push(createBox(0, -depth/2 + shellThickness/2, cabinetBaseZ + drawerStackHeight - plinthHeight, cabinetWidth - shellThickness * 2, shellThickness, accessCompartmentHeight + shellThickness * 2));
  // Bottom panel (floor of drawer bays)
  solids.push(createBox(0, 0, cabinetBaseZ, cabinetWidth - shellThickness * 2, depth - shellThickness, shellThickness));
  // Top panel (internal ceiling)
  solids.push(createBox(0, 0, castorHeight + cabinetBodyHeight - shellThickness, cabinetWidth - shellThickness * 2, depth - shellThickness, shellThickness));
  // Center divider (between left and right bays - only drawer stack height)
  solids.push(createBox(0, 0, cabinetBaseZ + shellThickness, shellThickness, depth - shellThickness * 2, drawerStackHeight - plinthHeight - shellThickness));
  // Shelf above drawer stacks (access compartment floor)
  solids.push(createBox(0, 0, cabinetBaseZ + drawerStackHeight - plinthHeight, cabinetWidth - shellThickness * 2, depth - shellThickness * 2, shellThickness));
  
  // ========================================
  // 4. WORKTOP (flush with cabinet, no floating gap)
  // ========================================
  const worktopWidth = cabinetWidth + worktopOverhangSide * 2;
  const worktopDepth = depth + worktopOverhangFront;
  const worktopZ = castorHeight + cabinetBodyHeight;  // Sits directly on top of cabinet
  
  solids.push(createBox(0, worktopOverhangFront/2, worktopZ, worktopWidth, worktopDepth, worktopThickness));
  
  // ========================================
  // 5. DRAWER FRONTS WITH HANDLES (Left and Right Bays)
  // CRITICAL: Drawers stack from BOTTOM UP, larger drawers at BOTTOM
  // ========================================
  const drawerFrontThickness = shellThickness;
  const drawerWidth = bayWidth - 0.006;
  const handleWidth = drawerWidth * drawerHandleWidth_factor;
  
  // Helper to add drawer stack with handles - BOTTOM TO TOP, LARGER AT BOTTOM
  const addDrawerStackWithHandles = (xPos: number, drawerHeights: number[]) => {
    // Sort drawers: LARGER at BOTTOM (descending order = bottom first when stacking)
    const sortedDrawers = [...drawerHeights].sort((a, b) => b - a);
    let currentZ = cabinetBaseZ + shellThickness;  // Start from bottom of drawer bay
    
    sortedDrawers.forEach((heightMm, index) => {
      const heightM = heightMm / 1000;
      const drawerZ = currentZ;
      const drawerFrontHeight = heightM - drawerReveal;
      
      // Drawer front panel
      solids.push(createBox(xPos, depth/2 - drawerFrontThickness/2, drawerZ, drawerWidth, drawerFrontThickness, drawerFrontHeight));
      
      // Drawer handle - centered horizontally, positioned near top of drawer
      const handleZ = drawerZ + drawerFrontHeight - drawerHandleOffset - drawerHandleHeight;
      solids.push(createBox(xPos, depth/2 + drawerHandleDepth/2, handleZ, handleWidth, drawerHandleDepth, drawerHandleHeight));
      
      currentZ += heightM;
      
      console.log(`Drawer ${index + 1}: ${heightMm}mm at Z=${(drawerZ * 1000).toFixed(0)}mm`);
    });
  };
  
  // Helper to add cupboard door with handle
  const addCupboardDoorWithHandle = (xPos: number) => {
    const doorHeight = drawerStackHeight - plinthHeight - shellThickness;
    const doorWidth = bayWidth - 0.006;
    const doorZ = cabinetBaseZ + shellThickness;
    
    // Door panel
    solids.push(createBox(xPos, depth/2 - drawerFrontThickness/2, doorZ, doorWidth, drawerFrontThickness, doorHeight));
    
    // Vertical door handle (right side of door)
    const doorHandleHeight = 0.10;  // 100mm tall handle
    const doorHandleWidth = 0.012;  // 12mm wide
    const doorHandleX = xPos + doorWidth/2 - 0.025;  // 25mm from right edge
    const doorHandleZ = doorZ + doorHeight/2 - doorHandleHeight/2;
    solids.push(createBox(doorHandleX, depth/2 + drawerHandleDepth/2, doorHandleZ, doorHandleWidth, drawerHandleDepth, doorHandleHeight));
  };
  
  // Add left bay
  const leftBayX = -cabinetWidth/4 - shellThickness/4;
  if (leftCupboard) {
    addCupboardDoorWithHandle(leftBayX);
  } else if (leftDrawers.length > 0) {
    addDrawerStackWithHandles(leftBayX, leftDrawers);
  }
  
  // Add right bay
  const rightBayX = cabinetWidth/4 + shellThickness/4;
  if (rightCupboard) {
    addCupboardDoorWithHandle(rightBayX);
  } else if (rightDrawers.length > 0) {
    addDrawerStackWithHandles(rightBayX, rightDrawers);
  }
  
  // ========================================
  // 6. SIDE GRAB HANDLES (push handles on left and right)
  // ========================================
  const sideHandleZ = castorHeight + cabinetBodyHeight - 0.04;
  const sideHandleLength = 0.32;              // 320mm long
  const sideHandleRadius = 0.010;             // 10mm radius tube (20mm diameter)
  const sideHandleStandoff = 0.025;           // 25mm standoff from cabinet
  
  // Left side handle (tube)
  solids.push(createBox(-cabinetWidth/2 - sideHandleStandoff, 0, sideHandleZ - sideHandleRadius, sideHandleRadius * 2, sideHandleLength, sideHandleRadius * 2));
  // Left handle mounting brackets
  solids.push(createBox(-cabinetWidth/2 - sideHandleStandoff/2, sideHandleLength/2 - 0.02, sideHandleZ - sideHandleRadius, sideHandleStandoff, 0.035, 0.035));
  solids.push(createBox(-cabinetWidth/2 - sideHandleStandoff/2, -sideHandleLength/2 + 0.02, sideHandleZ - sideHandleRadius, sideHandleStandoff, 0.035, 0.035));
  
  // Right side handle (tube)
  solids.push(createBox(cabinetWidth/2 + sideHandleStandoff, 0, sideHandleZ - sideHandleRadius, sideHandleRadius * 2, sideHandleLength, sideHandleRadius * 2));
  // Right handle mounting brackets
  solids.push(createBox(cabinetWidth/2 + sideHandleStandoff/2, sideHandleLength/2 - 0.02, sideHandleZ - sideHandleRadius, sideHandleStandoff, 0.035, 0.035));
  solids.push(createBox(cabinetWidth/2 + sideHandleStandoff/2, -sideHandleLength/2 + 0.02, sideHandleZ - sideHandleRadius, sideHandleStandoff, 0.035, 0.035));
  
  // ========================================
  // 7. REAR ACCESSORIES (if enabled)
  // Posts sit on top of worktop, panels and shelves attach to posts
  // ========================================
  if (hasRearPosts) {
    const postSize = 0.04;               // 40mm square posts
    const crossbarHeight = 0.03;         // 30mm crossbar
    const rearPostBaseZ = worktopZ + worktopThickness;  // Start on top of worktop
    const postHeight = rearPanelHeight;  // 825mm tall
    const panelWidth = cabinetWidth - postSize * 2 - 0.01;
    const panelHeight = 0.30;            // 300mm panel height
    const panelThickness = 0.012;        // 12mm thick panels
    
    // Left upright post
    solids.push(createBox(-cabinetWidth/2 + postSize/2 + 0.005, -depth/2 + postSize/2, rearPostBaseZ, postSize, postSize, postHeight));
    // Right upright post
    solids.push(createBox(cabinetWidth/2 - postSize/2 - 0.005, -depth/2 + postSize/2, rearPostBaseZ, postSize, postSize, postHeight));
    // Top crossbar
    solids.push(createBox(0, -depth/2 + postSize/2, rearPostBaseZ + postHeight - crossbarHeight, cabinetWidth - postSize, postSize, crossbarHeight));
    
    // Panel positioning - stack from top down
    const topMargin = 0.115;  // 115mm from top for shelf clearance
    let currentPanelZ = rearPostBaseZ + postHeight - crossbarHeight - topMargin;
    
    // Add louvre panels (slotted panels for bins)
    for (let i = 0; i < louvreCount; i++) {
      currentPanelZ -= panelHeight / 2;
      solids.push(createBox(0, -depth/2 + 0.035, currentPanelZ, panelWidth, panelThickness, panelHeight));
      currentPanelZ -= panelHeight / 2 + 0.005;
    }
    
    // Add toolboard panels (perforated panels for hooks)
    for (let i = 0; i < toolboardCount; i++) {
      currentPanelZ -= panelHeight / 2;
      solids.push(createBox(0, -depth/2 + 0.035, currentPanelZ, panelWidth, panelThickness, panelHeight));
      currentPanelZ -= panelHeight / 2 + 0.005;
    }
    
    // Add tray shelves with wedge brackets
    if (trayCount > 0) {
      const shelfBaseThickness = 0.003;  // 3mm base plate
      const shelfHeight = 0.095;         // 95mm rear lip height (wedge height)
      const shelfGap = 0.004;            // 4mm between shelves
      const trayWidth = cabinetWidth - postSize;
      const trayDepth = 0.208;           // 208mm shelf depth (wedge depth)
      const wedgeThickness = 0.003;      // 3mm sheet metal thickness
      const tipCutoff = 0.012;           // 12mm chamfer at tip
      const trayY = -depth/2 + trayDepth/2 + postSize;
      const topShelfZ = rearPostBaseZ + postHeight - crossbarHeight - shelfHeight - 0.02;
      const bottomMargin = 0.05;
      const usableBottom = rearPostBaseZ + bottomMargin;
      
      // Helper to create a triangular wedge bracket using IfcArbitraryClosedProfileDef
      // The wedge is a right triangle with chamfered tip, extruded along X axis
      const createWedgeBracket = (centerX: number, centerY: number, baseZ: number, isRight: boolean): number => {
        // Define the triangular profile in YZ plane (will be extruded along X)
        // Profile points (going counter-clockwise for correct normals):
        // - v0: bottom-rear (at shelf base, back edge)
        // - v1: top-rear (full wedge height, back edge)  
        // - v2: top-front-chamfer (sloped down to chamfer start)
        // - v3: bottom-front-chamfer (chamfer end at base level)
        const pt0 = createEntity('IFCCARTESIANPOINT', [0., 0.]);                              // bottom-rear
        const pt1 = createEntity('IFCCARTESIANPOINT', [0., shelfHeight]);                     // top-rear
        const pt2 = createEntity('IFCCARTESIANPOINT', [trayDepth - tipCutoff, tipCutoff]);    // top of chamfer (near front)
        const pt3 = createEntity('IFCCARTESIANPOINT', [trayDepth, 0.]);                       // bottom-front
        
        // Create closed polyline for the profile
        const polyline = createEntity('IFCPOLYLINE', [pt0, pt1, pt2, pt3, pt0]);
        
        // Create the arbitrary closed profile
        const profilePosition = createEntity('IFCAXIS2PLACEMENT2D', 
          createEntity('IFCCARTESIANPOINT', [0., 0.]),
          createEntity('IFCDIRECTION', [1., 0.])
        );
        const wedgeProfile = createEntity('IFCARBITRARYCLOSEDPROFILEDEF', E('AREA'), 'WedgeBracket', polyline);
        
        // Position the wedge - the profile is in YZ, extrude along X
        // For right bracket, mirror by extruding in negative X direction
        const xPos = isRight ? centerX + wedgeThickness/2 : centerX - wedgeThickness/2;
        const origin = createEntity('IFCCARTESIANPOINT', [xPos, centerY - trayDepth/2, baseZ]);
        
        // Extrusion direction and placement
        // Profile is defined in 2D, positioned at origin, then extruded along X-axis
        // The IFCAXIS2PLACEMENT3D orients the profile plane:
        // - Axis (Z-dir): normal to profile plane, points along extrusion
        // - RefDirection (X-dir): defines profile X-axis orientation
        const axisDir = createEntity('IFCDIRECTION', [1., 0., 0.]);   // Profile normal = extrusion direction (along X)
        const refDir = createEntity('IFCDIRECTION', [0., 1., 0.]);    // Profile X-axis aligns with world Y
        const position = createEntity('IFCAXIS2PLACEMENT3D', origin, axisDir, refDir);
        
        // Extrude the profile along X-axis (matches the axis direction)
        const extrusionDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
        return createEntity('IFCEXTRUDEDAREASOLID', wedgeProfile, position, extrusionDir, wedgeThickness);
      };
      
      for (let i = 0; i < trayCount; i++) {
        let shelfZ: number;
        
        if (trayCount === 1) {
          // Single shelf: at top
          shelfZ = topShelfZ;
        } else if (trayCount === 2) {
          // Two shelves: top and evenly distributed
          if (i === 0) {
            shelfZ = topShelfZ;
          } else {
            const remainingSpace = topShelfZ - usableBottom - shelfHeight;
            shelfZ = usableBottom + remainingSpace / 2;
          }
        } else {
          // 3+ shelves: stack from top with 4mm gaps
          shelfZ = topShelfZ - (i * (shelfHeight + shelfGap));
        }
        
        // Shelf base plate (3mm thick)
        solids.push(createBox(0, trayY, shelfZ, trayWidth, trayDepth, shelfBaseThickness));
        // Rear lip (95mm tall, 6mm thick)
        solids.push(createBox(0, trayY - trayDepth/2 + 0.003, shelfZ + shelfHeight/2, trayWidth, 0.006, shelfHeight));
        // Front lip (12mm tall, 6mm thick)
        solids.push(createBox(0, trayY + trayDepth/2 - 0.003, shelfZ + 0.006, trayWidth, 0.006, 0.012));
        
        // Triangular wedge brackets (proper wedge shape matching the 3D viewer)
        const leftBracketX = -cabinetWidth/2 + postSize/2;
        const rightBracketX = cabinetWidth/2 - postSize/2;
        solids.push(createWedgeBracket(leftBracketX, trayY, shelfZ, false));
        solids.push(createWedgeBracket(rightBracketX, trayY, shelfZ, true));
      }
    }
    
    console.log(`Rear accessories added: ${louvreCount} louvre panels, ${toolboardCount} toolboard panels, ${trayCount} tray shelves`);
  }
  
  // Create single shape representation with all geometry components
  const shapeRepresentation = createEntity('IFCSHAPEREPRESENTATION', contextId, E('Body'), E('SweptSolid'), solids);
  
  console.log(`Mobile Tool Cart geometry created: ${solids.length} solid components`);
  
  // Product definition shape
  return createEntity('IFCPRODUCTDEFINITIONSHAPE', null, null, [shapeRepresentation]);
}

/**
 * Add comprehensive property sets (Section 10, 11: Metadata per specification)
 * Handles both Cabinets and Workbenches with appropriate properties
 */
function addPropertySets(
  elementId: number,
  configuration: any,
  product: any,
  pricing: any,
  referenceCode: string,
  createEntity: Function,
  ownerHistoryId: number
): void {
  const properties: number[] = [];
  const isHiLoWorkbench = product.id === 'prod-hilo-workbench';
  const isWorkbench = product.id.includes('workbench');
  const isMobileToolCart = product.id === 'prod-mobile-tool-cart';
  const isStorageCupboard = product.id === 'prod-storage-cupboard';
  
  // ==========================================================
  // Core Identification (Common to all products)
  // ==========================================================
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BoscotekCode', null, createEntity('IFCIDENTIFIER', referenceCode), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Family', null, createEntity('IFCLABEL', product.name), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Manufacturer', null, createEntity('IFCLABEL', 'Boscotek'), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'OwnerOrganisation', null, createEntity('IFCLABEL', 'Opie Manufacturing Group'), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'AustralianMade', null, createEntity('IFCBOOLEAN', '.T.'), null));
  const productType = isHiLoWorkbench ? 'HiLo Height-Adjustable Workbench' : (isMobileToolCart ? 'Mobile Tool Cart' : (isStorageCupboard ? 'Storage Cupboard' : (isWorkbench ? 'Workbench' : 'Cabinet')));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ProductType', null, createEntity('IFCLABEL', productType), null));
  
  // ==========================================================
  // Dimensions (in millimeters as per specification)
  // ==========================================================
  let widthMm: number;
  let depthMm: number;
  let heightMm: number;
  
  if (isHiLoWorkbench) {
    // HiLo Workbench - dimensions from configuration, height at MAX EXTENDED
    const sizeGroup = product.groups?.find((g: any) => g.id === 'size');
    const selectedSizeId = configuration.selections?.size;
    const sizeOption = sizeGroup?.options?.find((o: any) => o.id === selectedSizeId);
    
    const liftModelGroup = product.groups?.find((g: any) => g.id === 'lift_model');
    const selectedLiftId = configuration.selections?.lift_model;
    const liftOption = liftModelGroup?.options?.find((o: any) => o.id === selectedLiftId);
    const isDL2 = selectedLiftId?.includes('dl2');
    
    widthMm = (sizeOption?.meta?.width || 1.5) * 1000;
    depthMm = 750;  // Fixed depth for HiLo
    // Export at MAX HEIGHT for BIM clearance checking
    heightMm = liftOption?.meta?.maxHeightMm || (isDL2 ? 1230 : 1260);
    
  } else if (isMobileToolCart) {
    // Mobile Tool Cart fixed dimensions as per Boscotek TCS catalogue specification
    widthMm = 1130;  // Fixed width as per catalogue
    depthMm = 560;   // Fixed depth
    heightMm = 900;  // Fixed height to worktop as per catalogue dimension drawing
    
  } else if (isStorageCupboard) {
    // Industrial Storage Cupboard fixed dimensions
    widthMm = 900;   // Fixed width
    depthMm = 450;   // Fixed depth
    // Height determined by configuration (1800 or 2000mm)
    const cupboardConfigGroup = product.groups?.find((g: any) => g.id === 'cupboard_config');
    const selectedCupboardConfigId = configuration.selections?.cupboard_config;
    const cupboardConfigOption = cupboardConfigGroup?.options?.find((o: any) => o.id === selectedCupboardConfigId);
    heightMm = (cupboardConfigOption?.meta?.height || 1.8) * 1000;
    
  } else if (isWorkbench) {
    widthMm = 1800;
    depthMm = 750;
    heightMm = 900;
  } else {
    widthMm = 560;
    depthMm = 750;
    heightMm = 850;
  }
  
  if (configuration.dimensions) {
    widthMm = configuration.dimensions.width || widthMm;
    depthMm = configuration.dimensions.depth || depthMm;
    heightMm = configuration.dimensions.height || heightMm;
  } else if (!isMobileToolCart) {
    const getOptionValueMm = (groupId: string): number | null => {
      const selectionId = configuration.selections?.[groupId];
      if (!selectionId) return null;
      
      const group = product.groups?.find((g: any) => g.id === groupId);
      const option = group?.options?.find((o: any) => o.id === selectionId);
      
      if (typeof option?.value === 'number') return option.value;
      if (option?.meta?.width) return option.meta.width * 1000;
      if (option?.meta?.height) return option.meta.height * 1000;
      if (option?.meta?.depth) return option.meta.depth * 1000;
      
      return null;
    };
    
    widthMm = getOptionValueMm('width') || getOptionValueMm('size') || widthMm;
    heightMm = getOptionValueMm('height') || getOptionValueMm('bench_height') || heightMm;
    depthMm = getOptionValueMm('series') || depthMm;
  }
  
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Width', null, createEntity('IFCLENGTHMEASURE', widthMm), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Depth', null, createEntity('IFCLENGTHMEASURE', depthMm), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Height', null, createEntity('IFCLENGTHMEASURE', heightMm), null));
  
  // ==========================================================
  // Product-specific properties
  // ==========================================================
  if (isHiLoWorkbench) {
    // --- HILO WORKBENCH PROPERTIES (Height-Adjustable BIM Metadata) ---
    
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ProductRange', null, createEntity('IFCLABEL', 'HiLo Height-Adjustable Workbench'), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Brand', null, createEntity('IFCLABEL', 'Boscotek'), null));
    
    // Lift model details
    const liftModelGroup = product.groups?.find((g: any) => g.id === 'lift_model');
    const selectedLiftId = configuration.selections?.lift_model;
    const liftOption = liftModelGroup?.options?.find((o: any) => o.id === selectedLiftId);
    const isDL2 = selectedLiftId?.includes('dl2');
    
    const liftModel = isDL2 ? 'DL2' : 'DL6';
    const liftCapacity = isDL2 ? 300 : 240;
    const liftSpeed = isDL2 ? 15 : 23;
    const minHeightMm = liftOption?.meta?.minHeightMm || (isDL2 ? 730 : 610);
    const maxHeightMm = liftOption?.meta?.maxHeightMm || (isDL2 ? 1230 : 1260);
    
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'LiftModel', null, createEntity('IFCLABEL', liftModel), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'LiftCapacityKg', null, createEntity('IFCMASSMEASURE', liftCapacity), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'LiftSpeedMmPerSec', null, createEntity('IFCREAL', liftSpeed), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'MinHeightMm', null, createEntity('IFCLENGTHMEASURE', minHeightMm), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'MaxHeightMm', null, createEntity('IFCLENGTHMEASURE', maxHeightMm), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BIMExportHeight', null, createEntity('IFCLABEL', 'Maximum Extended'), null));
    
    // Worktop material
    const worktopId = configuration.selections?.worktop;
    const worktopGroup = product.groups?.find((g: any) => g.id === 'worktop');
    const worktopOption = worktopGroup?.options?.find((o: any) => o.id === worktopId);
    if (worktopOption) {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'WorktopMaterial', null, createEntity('IFCLABEL', worktopOption.label || 'Laminated Timber'), null));
    }
    
    // Above bench accessories
    const aboveBenchId = configuration.selections?.above_bench;
    const aboveBenchGroup = product.groups?.find((g: any) => g.id === 'above_bench');
    const aboveBenchOption = aboveBenchGroup?.options?.find((o: any) => o.id === aboveBenchId);
    if (aboveBenchOption && aboveBenchId !== 'ab-none' && aboveBenchId !== 'none') {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'AboveBenchSystem', null, createEntity('IFCLABEL', aboveBenchOption.label), null));
    }
    
  } else if (isMobileToolCart) {
    // --- MOBILE TOOL CART PROPERTIES (Comprehensive BIM Metadata) ---
    
    // Product range identification
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ProductRange', null, createEntity('IFCLABEL', 'Mobile Tool Cart Station'), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Brand', null, createEntity('IFCLABEL', 'Boscotek'), null));
    
    // Extract bay configuration details
    const bayPresetId = configuration.selections?.bay_preset;
    const bayPresetGroup = product.groups?.find((g: any) => g.id === 'bay_preset');
    const bayPresetOption = bayPresetGroup?.options?.find((o: any) => o.id === bayPresetId);
    const leftDrawers = bayPresetOption?.meta?.leftDrawers || [];
    const rightDrawers = bayPresetOption?.meta?.rightDrawers || [];
    const leftCupboard = bayPresetOption?.meta?.leftCupboard || false;
    const rightCupboard = bayPresetOption?.meta?.rightCupboard || false;
    
    // Product code (e.g., TCS.B26 or TCS.B26.T8 with accessories)
    const bayCode = bayPresetOption?.code || 'B26';
    const hasRearSystem = configuration.selections?.rear_system === true;
    const productCode = hasRearSystem ? `TCS.${bayCode}.T8` : `TCS.${bayCode}`;
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ProductCode', null, createEntity('IFCLABEL', productCode), null));
    
    // Bay configuration summary
    if (bayPresetOption) {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BayConfiguration', null, createEntity('IFCLABEL', bayPresetOption.label), null));
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BayConfigurationCode', null, createEntity('IFCLABEL', bayCode), null));
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'TotalDrawers', null, createEntity('IFCINTEGER', bayPresetOption.meta?.totalDrawers || 0), null));
    }
    
    // Left bay details
    if (leftCupboard) {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'LeftBayType', null, createEntity('IFCLABEL', 'Cupboard'), null));
    } else if (leftDrawers.length > 0) {
      // Sort drawers bottom to top (largest first)
      const sortedLeftDrawers = [...leftDrawers].sort((a: number, b: number) => b - a);
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'LeftBayType', null, createEntity('IFCLABEL', 'Drawer Stack'), null));
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'LeftBayDrawerCount', null, createEntity('IFCINTEGER', leftDrawers.length), null));
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'LeftBayDrawerHeights', null, createEntity('IFCLABEL', sortedLeftDrawers.join('/') + 'mm (bottom to top)'), null));
    }
    
    // Right bay details
    if (rightCupboard) {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'RightBayType', null, createEntity('IFCLABEL', 'Cupboard'), null));
    } else if (rightDrawers.length > 0) {
      const sortedRightDrawers = [...rightDrawers].sort((a: number, b: number) => b - a);
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'RightBayType', null, createEntity('IFCLABEL', 'Drawer Stack'), null));
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'RightBayDrawerCount', null, createEntity('IFCINTEGER', rightDrawers.length), null));
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'RightBayDrawerHeights', null, createEntity('IFCLABEL', sortedRightDrawers.join('/') + 'mm (bottom to top)'), null));
    }
    
    // Worktop material with full specification
    const worktopId = configuration.selections?.worktop;
    if (worktopId) {
      const worktopGroup = product.groups?.find((g: any) => g.id === 'worktop');
      const worktopOption = worktopGroup?.options?.find((o: any) => o.id === worktopId);
      if (worktopOption) {
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'WorktopMaterial', null, createEntity('IFCLABEL', worktopOption.label), null));
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'WorktopMaterialCode', null, createEntity('IFCLABEL', worktopOption.code || 'L'), null));
        // Include thickness and description if available
        if (worktopOption.meta?.thickness) {
          properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'WorktopThickness', null, createEntity('IFCLENGTHMEASURE', worktopOption.meta.thickness), null));
        }
        if (worktopOption.meta?.description) {
          properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'WorktopDescription', null, createEntity('IFCTEXT', worktopOption.meta.description), null));
        }
      }
    }
    
    // Color selections
    const housingColorId = configuration.selections?.housing_color;
    const faciaColorId = configuration.selections?.facia_color;
    
    if (housingColorId) {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'CabinetBodyColor', null, createEntity('IFCLABEL', mapColorCodeToFinish(housingColorId)), null));
      const housingColorGroup = product.groups?.find((g: any) => g.id === 'housing_color');
      const housingColorOption = housingColorGroup?.options?.find((o: any) => o.id === housingColorId);
      if (housingColorOption?.code) {
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'CabinetBodyColorCode', null, createEntity('IFCLABEL', housingColorOption.code), null));
      }
    }
    
    if (faciaColorId) {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DrawerFrontColor', null, createEntity('IFCLABEL', mapColorCodeToFinish(faciaColorId)), null));
      const faciaColorGroup = product.groups?.find((g: any) => g.id === 'facia_color');
      const faciaColorOption = faciaColorGroup?.options?.find((o: any) => o.id === faciaColorId);
      if (faciaColorOption?.code) {
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DrawerFrontColorCode', null, createEntity('IFCLABEL', faciaColorOption.code), null));
      }
    }
    
    // Rear accessory system
    const hasRearPosts = configuration.selections?.rear_system === true;
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'HasRearAccessoryPosts', null, createEntity('IFCBOOLEAN', hasRearPosts ? '.T.' : '.F.'), null));
    
    // Rear panels and shelves
    if (hasRearPosts) {
      const getAccessoryCount = (groupId: string): number => {
        const selectedId = configuration.selections?.[groupId];
        if (!selectedId) return 0;
        const group = product.groups?.find((g: any) => g.id === groupId);
        const option = group?.options?.find((o: any) => o.id === selectedId);
        const val = option?.value;
        return typeof val === 'number' ? val : 0;
      };
      
      const toolboardCount = getAccessoryCount('rear_toolboard');
      const louvreCount = getAccessoryCount('rear_louvre');
      const trayCount = getAccessoryCount('rear_trays');
      
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ToolboardPanelCount', null, createEntity('IFCINTEGER', toolboardCount), null));
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'LouvrePanelCount', null, createEntity('IFCINTEGER', louvreCount), null));
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'TrayShelfCount', null, createEntity('IFCINTEGER', trayCount), null));
      
      // Total rear accessories
      const totalRearAccessories = toolboardCount + louvreCount + trayCount;
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'TotalRearAccessories', null, createEntity('IFCINTEGER', totalRearAccessories), null));
    }
    
    // Mobile features - always has castors
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'HasCastors', null, createEntity('IFCBOOLEAN', '.T.'), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'CastorType', null, createEntity('IFCLABEL', 'Anti-tilt lockable castors (100mm)'), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'CastorCount', null, createEntity('IFCINTEGER', 4), null));
    
    // Load capacity
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'WorktopLoadCapacity', null, createEntity('IFCLABEL', '500 kg UDL'), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DrawerLoadCapacity', null, createEntity('IFCLABEL', '200 kg per drawer'), null));
    
    // Configuration reference
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ConfigurationReferenceID', null, createEntity('IFCIDENTIFIER', referenceCode), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'GeneratedDate', null, createEntity('IFCTEXT', new Date().toISOString()), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'IFCVersion', null, createEntity('IFCLABEL', 'IFC4'), null));
    
  } else if (isWorkbench) {
    // --- WORKBENCH PROPERTIES ---
    
    // Worktop material with full specification
    const worktopId = configuration.selections?.worktop;
    if (worktopId) {
      const worktopGroup = product.groups?.find((g: any) => g.id === 'worktop');
      const worktopOption = worktopGroup?.options?.find((o: any) => o.id === worktopId);
      if (worktopOption) {
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'WorktopMaterial', null, createEntity('IFCLABEL', worktopOption.label), null));
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'WorktopMaterialCode', null, createEntity('IFCLABEL', worktopOption.code || 'L'), null));
        // Include thickness and description if available
        if (worktopOption.meta?.thickness) {
          properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'WorktopThickness', null, createEntity('IFCLENGTHMEASURE', worktopOption.meta.thickness), null));
        }
        if (worktopOption.meta?.description) {
          properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'WorktopDescription', null, createEntity('IFCTEXT', worktopOption.meta.description), null));
        }
      }
    }
    
    // Under-bench configuration
    const underBench = configuration.selections?.under_bench;
    if (underBench && underBench !== 'B0' && underBench !== 'iw-ub-none') {
      const underBenchGroup = product.groups?.find((g: any) => g.id === 'under_bench');
      const underBenchOption = underBenchGroup?.options?.find((o: any) => o.id === underBench);
      if (underBenchOption) {
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'UnderBenchOption', null, createEntity('IFCLABEL', underBenchOption.label), null));
      }
    }
    
    // Above-bench configuration
    const aboveBench = configuration.selections?.above_bench;
    if (aboveBench && aboveBench !== 'T0' && aboveBench !== 'iw-ab-none') {
      const aboveBenchGroup = product.groups?.find((g: any) => g.id === 'above_bench');
      const aboveBenchOption = aboveBenchGroup?.options?.find((o: any) => o.id === aboveBench);
      if (aboveBenchOption) {
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'AboveBenchOption', null, createEntity('IFCLABEL', aboveBenchOption.label), null));
      }
    }
    
    // Mobility (castors)
    const hasCastors = configuration.selections?.mobility === true;
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'HasCastors', null, createEntity('IFCBOOLEAN', hasCastors ? '.T.' : '.F.'), null));
    
    // Load capacity (workbench specific)
    const isHeavyDuty = product.id.includes('heavy');
    const udlCapacity = isHeavyDuty ? '1000 kg (Heavy Duty)' : '800 kg (Industrial)';
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'WorktopLoadCapacity', null, createEntity('IFCLABEL', udlCapacity), null));
    
    // Embedded Cabinet Configurations
    const embeddedCabinets = configuration.embeddedCabinets || [];
    if (embeddedCabinets.length > 0) {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'EmbeddedCabinetCount', null, createEntity('IFCINTEGER', embeddedCabinets.length), null));
      
      embeddedCabinets.forEach((cab: any, idx: number) => {
        const placement = cab.placement || 'unknown';
        const customDrawers = cab.configuration?.customDrawers || [];
        const drawerCount = customDrawers.length;
        
        if (drawerCount > 0) {
          // Find drawer group from product to get heights
          const drawerGroup = product.groups?.find((g: any) => g.type === 'drawer_stack' || g.id === 'config');
          const drawerHeights = customDrawers.map((d: any) => {
            const opt = drawerGroup?.options?.find((o: any) => o.id === d.id);
            return opt?.meta?.front || 150;
          });
          
          const sortedHeights = [...drawerHeights].sort((a: number, b: number) => b - a);
          const configCode = sortedHeights.join('.');
          
          properties.push(createEntity('IFCPROPERTYSINGLEVALUE', `EmbeddedCabinet_${placement}_DrawerCount`, null, createEntity('IFCINTEGER', drawerCount), null));
          properties.push(createEntity('IFCPROPERTYSINGLEVALUE', `EmbeddedCabinet_${placement}_DrawerConfig`, null, createEntity('IFCLABEL', configCode), null));
          properties.push(createEntity('IFCPROPERTYSINGLEVALUE', `EmbeddedCabinet_${placement}_DrawerHeights`, null, createEntity('IFCLABEL', drawerHeights.join(', ') + ' mm'), null));
        }
      });
    }
    
  } else if (isStorageCupboard) {
    // --- INDUSTRIAL STORAGE CUPBOARD PROPERTIES ---
    
    // Product range identification
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ProductRange', null, createEntity('IFCLABEL', 'Industrial Storage Cupboard'), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Brand', null, createEntity('IFCLABEL', 'Boscotek'), null));
    
    // Configuration details
    const cupboardConfigGroup = product.groups?.find((g: any) => g.id === 'cupboard_config');
    const selectedCupboardConfigId = configuration.selections?.cupboard_config;
    const cupboardConfigOption = cupboardConfigGroup?.options?.find((o: any) => o.id === selectedCupboardConfigId);
    
    if (cupboardConfigOption) {
      // Product code from configuration
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ProductCode', null, createEntity('IFCLABEL', cupboardConfigOption.code || 'BTFF.1800.900'), null));
      
      // Top type (flat or slope)
      const topType = cupboardConfigOption.meta?.topType || 'flat';
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'TopType', null, createEntity('IFCLABEL', topType === 'slope' ? 'Sloped Top (2000mm)' : 'Flat Top (1800mm)'), null));
      
      // Configuration type (Factory, Engineering, Implement)
      const configTypeMap: { [key: string]: string } = {
        'F': 'Factory',
        'E': 'Engineering',
        'I': 'Implement'
      };
      const configType = configTypeMap[cupboardConfigOption.meta?.configType] || 'Factory';
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ConfigurationType', null, createEntity('IFCLABEL', configType), null));
      
      // Shelf configuration
      const shelfCount = cupboardConfigOption.meta?.shelfCount || 4;
      const shelfType = cupboardConfigOption.meta?.shelfType || 'adjustable';
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ShelfCount', null, createEntity('IFCINTEGER', shelfCount), null));
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ShelfType', null, createEntity('IFCLABEL', shelfType), null));
      
      // Configuration description
      if (cupboardConfigOption.meta?.description) {
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ConfigurationDescription', null, createEntity('IFCTEXT', cupboardConfigOption.meta.description), null));
      }
    }
    
    // Fixed dimensions
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'FixedWidth', null, createEntity('IFCLENGTHMEASURE', 900), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'FixedDepth', null, createEntity('IFCLENGTHMEASURE', 450), null));
    
    // Door specification
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DoorType', null, createEntity('IFCLABEL', 'Double full-height swing doors'), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DoorOpeningAngle', null, createEntity('IFCLABEL', '110 degrees'), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'HingesPerDoor', null, createEntity('IFCINTEGER', 2), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'LockType', null, createEntity('IFCLABEL', 'Triple-action key lockable'), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'HandleType', null, createEntity('IFCLABEL', 'Flush-mounted lockable handle'), null));
    
    // Construction
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Construction', null, createEntity('IFCLABEL', 'Fully welded steel'), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ShelfAdjustmentIncrement', null, createEntity('IFCLENGTHMEASURE', 20), null));
    
    // Colors
    const bodyColorId = configuration.selections?.body_color;
    const doorColorId = configuration.selections?.door_color;
    
    if (bodyColorId) {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BodyColor', null, createEntity('IFCLABEL', mapColorCodeToFinish(bodyColorId)), null));
      const bodyColorGroup = product.groups?.find((g: any) => g.id === 'body_color');
      const bodyColorOption = bodyColorGroup?.options?.find((o: any) => o.id === bodyColorId);
      if (bodyColorOption?.code) {
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BodyColorCode', null, createEntity('IFCLABEL', bodyColorOption.code), null));
      }
    }
    
    if (doorColorId) {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DoorColor', null, createEntity('IFCLABEL', mapColorCodeToFinish(doorColorId)), null));
      const doorColorGroup = product.groups?.find((g: any) => g.id === 'door_color');
      const doorColorOption = doorColorGroup?.options?.find((o: any) => o.id === doorColorId);
      if (doorColorOption?.code) {
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DoorColorCode', null, createEntity('IFCLABEL', doorColorOption.code), null));
      }
    }
    
    // Configuration reference
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ConfigurationReferenceID', null, createEntity('IFCIDENTIFIER', referenceCode), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'GeneratedDate', null, createEntity('IFCTEXT', new Date().toISOString()), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'IFCVersion', null, createEntity('IFCLABEL', 'IFC4'), null));
    
  } else {
    // --- CABINET PROPERTIES ---
    
    // Drawer Configuration
    if (configuration.customDrawers && configuration.customDrawers.length > 0) {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'NumberOfDrawers', null, createEntity('IFCINTEGER', configuration.customDrawers.length), null));
      
      const drawerGroup = product.groups?.find((g: any) => g.type === 'drawer_stack' || g.id === 'config');
      const drawerHeights = configuration.customDrawers.map((d: any) => {
        const opt = drawerGroup?.options?.find((o: any) => o.id === d.id);
        return opt?.meta?.front || 150;
      });
      
      const sortedHeights = [...drawerHeights].sort((a, b) => b - a);
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DrawerConfigurationCode', null, createEntity('IFCLABEL', sortedHeights.join('.')), null));
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DrawerHeights', null, createEntity('IFCLABEL', drawerHeights.join(', ') + ' mm'), null));
    } else {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'NumberOfDrawers', null, createEntity('IFCINTEGER', 0), null));
    }
    
    // Load Ratings
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'UDLDrawerCapacity', null, createEntity('IFCLABEL', '200 kg (HD Cabinet Standard)'), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'UDLCabinetCapacity', null, createEntity('IFCLABEL', '1200 kg (HD Cabinet Standard)'), null));
    
    // Series/Depth Type
    const seriesId = configuration.selections?.series;
    if (seriesId) {
      const seriesGroup = product.groups?.find((g: any) => g.id === 'series');
      const seriesOption = seriesGroup?.options?.find((o: any) => o.id === seriesId);
      if (seriesOption) {
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Series', null, createEntity('IFCLABEL', seriesOption.code || seriesOption.label), null));
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DepthType', null, createEntity('IFCLABEL', seriesId.includes('d') ? 'D - Deep' : 'S - Standard'), null));
      }
    }
  }
  
  // ==========================================================
  // Materials and Finishes (Common)
  // ==========================================================
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'MaterialFrame', null, createEntity('IFCLABEL', 'Steel - XT Shield Powder Coated'), null));
  
  const frameColorId = configuration.selections?.housing_color || configuration.selections?.color;
  if (frameColorId) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'FinishFrame', null, createEntity('IFCLABEL', mapColorCodeToFinish(frameColorId)), null));
  } else {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'FinishFrame', null, createEntity('IFCLABEL', 'MG - Monument Grey (Standard)'), null));
  }
  
  const faciaColorId = configuration.selections?.facia_color || configuration.selections?.drawer_facia;
  if (faciaColorId) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'FinishDrawers', null, createEntity('IFCLABEL', mapColorCodeToFinish(faciaColorId)), null));
  }
  
  // ==========================================================
  // Pricing
  // ==========================================================
  if (pricing) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BasePrice', null, createEntity('IFCMONETARYMEASURE', pricing.basePrice || 0), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'TotalPrice', null, createEntity('IFCMONETARYMEASURE', pricing.totalPrice || 0), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Currency', null, createEntity('IFCLABEL', pricing.currency || 'AUD'), null));
  }
  
  // ==========================================================
  // Product URL and Description
  // ==========================================================
  const productUrls: { [key: string]: string } = {
    'prod-hd-cabinet': 'https://www.boscotek.com.au/products/high-density-cabinets',
    'prod-workbench-heavy': 'https://www.boscotek.com.au/products/heavy-duty-workbenches',
    'prod-workbench-industrial': 'https://www.boscotek.com.au/products/industrial-workbenches',
    'prod-mobile-tool-cart': 'https://www.boscotek.com.au/products/mobile-tool-cart-stations',
    'prod-storage-cupboard': 'https://www.boscotek.com.au/products/industrial-storage-cupboards',
    'prod-hilo-workbench': 'https://www.boscotek.com.au/products/hilo-workbenches'
  };
  const productUrl = productUrls[product.id] || 'https://www.boscotek.com.au';
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'URLProductPage', null, createEntity('IFCTEXT', productUrl), null));
  
  if (product.description) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Description', null, createEntity('IFCTEXT', product.description), null));
  }
  
  // ==========================================================
  // Create property set with appropriate name
  // ==========================================================
  const psetName = isHiLoWorkbench ? 'Pset_BoscotekHiLoWorkbench' :
                   isMobileToolCart ? 'Pset_BoscotekMobileToolCart' : 
                   isStorageCupboard ? 'Pset_BoscotekStorageCupboard' :
                   isWorkbench ? 'Pset_BoscotekWorkbench' : 'Pset_BoscotekCabinet';
  const psetDescription = isHiLoWorkbench ? 'Boscotek HiLo height-adjustable workbench configuration properties' :
                          isMobileToolCart ? 'Boscotek mobile tool cart configuration properties' :
                          isStorageCupboard ? 'Boscotek industrial storage cupboard configuration properties' :
                          isWorkbench ? 'Boscotek workbench configuration properties' : 'Boscotek cabinet configuration properties';
  const pset = createEntity('IFCPROPERTYSET', psetName, ownerHistoryId, psetDescription, null, properties);
  
  createEntity('IFCRELDEFINESBYPROPERTIES', 'PropertiesRel', ownerHistoryId, null, null, [elementId], pset);
  
  console.log(`Property set ${psetName} created with ${properties.length} properties`);
}

/**
 * Map color codes/IDs to descriptive finish names (Section 11)
 * Handles both color codes (e.g., 'MG') and selection IDs (e.g., 'col-mg')
 */
function mapColorCodeToFinish(colorCodeOrId: string): string {
  // Full color map including all Boscotek finishes from catalog
  const colorMap: { [key: string]: string } = {
    // By code
    'MG': 'MG - Monument Grey (Texture)',
    'SG': 'SG - Surfmist Grey (Texture)',
    'LG': 'LG - Light Grey (Satin)',
    'LB': 'LB - Light Blue (Satin)',
    'GG': 'GG - Green (Satin)',
    'CC': 'CC - Cream (Satin)',
    'DG': 'DG - Dark Grey (Satin)',
    'BK': 'BK - Black (Satin)',
    'DB': 'DB - Dark Blue (Gloss)',
    'BB': 'BB - Bright Blue (Gloss)',
    'MB': 'MB - Mid Blue (Gloss)',
    'YW': 'YW - Yellow (Gloss)',
    'RD': 'RD - Red (Gloss)',
    'OR': 'OR - Orange (Gloss)',
    // By selection ID
    'col-mg': 'MG - Monument Grey (Texture)',
    'col-sg': 'SG - Surfmist Grey (Texture)',
    'col-lg': 'LG - Light Grey (Satin)',
    'col-lb': 'LB - Light Blue (Satin)',
    'col-gg': 'GG - Green (Satin)',
    'col-cc': 'CC - Cream (Satin)',
    'col-dg': 'DG - Dark Grey (Satin)',
    'col-bk': 'BK - Black (Satin)',
    'col-db': 'DB - Dark Blue (Gloss)',
    'col-bb': 'BB - Bright Blue (Gloss)',
    'col-mb': 'MB - Mid Blue (Gloss)',
    'col-yw': 'YW - Yellow (Gloss)',
    'col-rd': 'RD - Red (Gloss)',
    'col-or': 'OR - Orange (Gloss)'
  };
  
  return colorMap[colorCodeOrId] || colorCodeOrId;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData = await req.json();
    const { configId, leadId, configuration, product, pricing, referenceCode } = requestData;

    // Generate IFC content
    const startTime = Date.now();
    const ifcContent = generateIFCContent({ configuration, product, pricing, referenceCode });
    const generationTime = Date.now() - startTime;

    // Upload to Supabase Storage
    // Clean filename: Boscotek_BTCS.700.560.100.100.MG.SG.ifc
    const fileName = `Boscotek_${referenceCode}.ifc`;
    const filePath = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabaseClient
      .storage
      .from('bim-exports')
      .upload(filePath, ifcContent, {
        contentType: 'application/x-step',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get signed URL (valid for 1 hour)
    const { data: urlData } = await supabaseClient
      .storage
      .from('bim-exports')
      .createSignedUrl(filePath, 3600);

    // Save export record
    const { data: exportData, error: exportError } = await supabaseClient
      .from('bim_exports')
      .insert([{
        lead_id: leadId || null,
        config_id: configId,
        ifc_url: urlData?.signedUrl,
        export_type: 'IFC',
        file_size_bytes: new TextEncoder().encode(ifcContent).length,
        generation_time_ms: generationTime,
        status: 'completed'
      }])
      .select()
      .single();

    if (exportError) {
      throw exportError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        exportId: exportData.id,
        ifcUrl: urlData?.signedUrl,
        fileName: fileName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error generating IFC:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
