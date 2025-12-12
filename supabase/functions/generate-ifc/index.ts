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
  
  if (product.id.includes('workbench')) {
    // Workbench geometry (frame + worktop)
    const isIndustrial = product.id.includes('industrial');
    // Check multiple ways castors might be indicated
    const hasCastors = configuration.selections?.mobility === true || 
                       configuration.selections?.mobility === 'castors' ||
                       configuration.selections?.mobility === 'C' ||
                       referenceCode.endsWith('-C'); // Config code ends with -C for castors
    bodyRepresentation = createWorkbenchGeometry(dimensions, createEntity, geometricContext, configuration, product, isIndustrial, hasCastors);
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
    const flushLeft = -width/2 + LEG_SIZE + DRAWER_UNIT_WIDTH/2;
    const flushRight = width/2 - LEG_SIZE - DRAWER_UNIT_WIDTH/2;
    
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
  const isWorkbench = product.id.includes('workbench');
  
  // ==========================================================
  // Core Identification (Common to all products)
  // ==========================================================
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BoscotekCode', null, createEntity('IFCIDENTIFIER', referenceCode), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Family', null, createEntity('IFCLABEL', product.name), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Manufacturer', null, createEntity('IFCLABEL', 'Boscotek'), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'OwnerOrganisation', null, createEntity('IFCLABEL', 'Opie Manufacturing Group'), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'AustralianMade', null, createEntity('IFCBOOLEAN', '.T.'), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ProductType', null, createEntity('IFCLABEL', isWorkbench ? 'Workbench' : 'Cabinet'), null));
  
  // ==========================================================
  // Dimensions (in millimeters as per specification)
  // ==========================================================
  let widthMm = isWorkbench ? 1800 : 560;
  let depthMm = isWorkbench ? 750 : 750;
  let heightMm = isWorkbench ? 900 : 850;
  
  if (configuration.dimensions) {
    widthMm = configuration.dimensions.width || widthMm;
    depthMm = configuration.dimensions.depth || depthMm;
    heightMm = configuration.dimensions.height || heightMm;
  } else {
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
  if (isWorkbench) {
    // --- WORKBENCH PROPERTIES ---
    
    // Worktop material
    const worktopId = configuration.selections?.worktop;
    if (worktopId) {
      const worktopGroup = product.groups?.find((g: any) => g.id === 'worktop');
      const worktopOption = worktopGroup?.options?.find((o: any) => o.id === worktopId);
      if (worktopOption) {
        properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'WorktopMaterial', null, createEntity('IFCLABEL', worktopOption.label), null));
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
    'prod-workbench-industrial': 'https://www.boscotek.com.au/products/industrial-workbenches'
  };
  const productUrl = productUrls[product.id] || 'https://www.boscotek.com.au';
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'URLProductPage', null, createEntity('IFCTEXT', productUrl), null));
  
  if (product.description) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Description', null, createEntity('IFCTEXT', product.description), null));
  }
  
  // ==========================================================
  // Create property set with appropriate name
  // ==========================================================
  const psetName = isWorkbench ? 'Pset_BoscotekWorkbench' : 'Pset_BoscotekCabinet';
  const psetDescription = isWorkbench ? 'Boscotek workbench configuration properties' : 'Boscotek cabinet configuration properties';
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
        upsert: false
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
