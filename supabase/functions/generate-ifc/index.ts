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
  
  if (configuration.dimensions) {
    // Use pre-calculated dimensions from configuration (in mm, convert to meters)
    dimensions = {
      width: (configuration.dimensions.width || 560) / 1000,
      height: (configuration.dimensions.height || 850) / 1000,
      depth: (configuration.dimensions.depth || 750) / 1000
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
    
    // For HD Cabinet: width from 'width', height from 'height', depth from 'series'
    // Check both possible group names
    const widthMm = getOptionValue('width', 560) || getOptionValue('size', 560);
    const heightMm = getOptionValue('height', 850) || getOptionValue('bench_height', 850);
    const depthMm = getOptionValue('series', 750);
    
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
  const geometricContext = createEntity('IFCGEOMETRICREPRESENTATIONCONTEXT', null, E('Model'), 3, 1.E-5, null, null);
  
  // 4. Project Structure (NOW with proper references to units and context)
  // FIX: Pass [geometricContext] and unitAssignment instead of null
  const projectId = createEntity('IFCPROJECT', referenceCode, ownerHistoryId, product.name, `Boscotek ${product.name} Configuration`, null, null, null, [geometricContext], unitAssignment);
  
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
  
  // Create cabinet/workbench body with detailed geometry components
  const bodyRepresentation = createCabinetGeometry(dimensions, createEntity, geometricContext, configuration, product);
  
  // 7. Product Instance (Section 6 & 7: Add ObjectType with full Boscotek code)
  let productIfcType = 'IFCFURNISHINGELEMENT';
  if (product.id.includes('cabinet')) {
    productIfcType = 'IFCFURNISHINGELEMENT'; // IFC4 doesn't have specific cabinet type
  }
  
  const productInstance = createEntity(
    productIfcType,
    referenceCode,
    ownerHistoryId,
    product.name,
    product.description,
    referenceCode,          // ObjectType = Full Boscotek configuration code (e.g., BTCS.700.560.75.200.250.MG.SG)
    productLocalPlacement,  // This is now a proper entity reference, not a float
    bodyRepresentation,
    null                    // Tag
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
  
  // ==========================================================
  // 1. PLINTH / BASE (bottom structural support)
  // Slightly recessed from cabinet front for visual distinction
  // ==========================================================
  const plinthOrigin = createEntity('IFCCARTESIANPOINT', [-width/2, -depth/2 + plinthSetback, 0.]);
  const plinthZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const plinthXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const plinthPosition = createEntity('IFCAXIS2PLACEMENT3D', plinthOrigin, plinthZDir, plinthXDir);
  
  const plinthProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const plinthProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const plinthProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', plinthProfileOrigin, plinthProfileXDir);
  const plinthProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, plinthProfilePosition, width, depth - plinthSetback);
  
  const plinthSolid = createEntity('IFCEXTRUDEDAREASOLID', plinthProfile, plinthPosition, extrusionDir, plinthHeight);
  solids.push(plinthSolid);
  
  // ==========================================================
  // 2. TOP PANEL (cabinet top surface)
  // ==========================================================
  const topOrigin = createEntity('IFCCARTESIANPOINT', [-width/2, -depth/2, height - topPanelHeight]);
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
  // ==========================================================
  const internalHeight = height - plinthHeight - topPanelHeight;
  const backOrigin = createEntity('IFCCARTESIANPOINT', [-width/2, -depth/2, plinthHeight]);
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
  // ==========================================================
  const leftOrigin = createEntity('IFCCARTESIANPOINT', [-width/2, -depth/2 + backPanelThickness, plinthHeight]);
  const leftZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const leftXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const leftPosition = createEntity('IFCAXIS2PLACEMENT3D', leftOrigin, leftZDir, leftXDir);
  
  const leftProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const leftProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const leftProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', leftProfileOrigin, leftProfileXDir);
  const leftProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, leftProfilePosition, sideWallThickness, depth - backPanelThickness);
  
  const leftSolid = createEntity('IFCEXTRUDEDAREASOLID', leftProfile, leftPosition, extrusionDir, internalHeight);
  solids.push(leftSolid);
  
  // ==========================================================
  // 5. RIGHT SIDE PANEL
  // ==========================================================
  const rightOrigin = createEntity('IFCCARTESIANPOINT', [width/2 - sideWallThickness, -depth/2 + backPanelThickness, plinthHeight]);
  const rightZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const rightXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const rightPosition = createEntity('IFCAXIS2PLACEMENT3D', rightOrigin, rightZDir, rightXDir);
  
  const rightProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const rightProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const rightProfilePosition = createEntity('IFCAXIS2PLACEMENT2D', rightProfileOrigin, rightProfileXDir);
  const rightProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, rightProfilePosition, sideWallThickness, depth - backPanelThickness);
  
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
    
    // Sort drawers by height descending (largest at bottom, matching 3D viewer)
    const drawersWithHeights = configuration.customDrawers.map((d: any, idx: number) => {
      const opt = drawerGroup?.options?.find((o: any) => o.id === d.id);
      const heightMm = opt?.meta?.front || 150;
      return { ...d, heightMm, originalIndex: idx };
    }).sort((a: any, b: any) => b.heightMm - a.heightMm);
    
    let currentZ = plinthHeight; // Start stacking from top of plinth
    
    drawersWithHeights.forEach((drawer: any, idx: number) => {
      const drawerHeight = drawer.heightMm / 1000; // Convert to meters
      
      // Create drawer front panel on the front face (positive Y direction)
      const dfOrigin = createEntity('IFCCARTESIANPOINT', [
        -width/2 + drawerInset, 
        depth/2 - drawerFrontThickness, 
        currentZ + drawerGap/2
      ]);
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
 * Add comprehensive property sets (Section 10, 11: Metadata per specification)
 * Includes all Pset_BoscotekCabinet properties as per IFC Export Brief
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
  
  // ==========================================================
  // Section 10.2: Standard Properties - Pset_BoscotekCabinet
  // ==========================================================
  
  // Core Identification
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BoscotekCode', null, createEntity('IFCIDENTIFIER', referenceCode), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Family', null, createEntity('IFCLABEL', product.name), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Manufacturer', null, createEntity('IFCLABEL', 'Boscotek'), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'OwnerOrganisation', null, createEntity('IFCLABEL', 'Opie Manufacturing Group'), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'AustralianMade', null, createEntity('IFCBOOLEAN', '.T.'), null));
  
  // Dimensions (in millimeters as per specification)
  // Use configuration.dimensions if available, otherwise derive from selections
  let widthMm = 560, depthMm = 750, heightMm = 850;
  
  if (configuration.dimensions) {
    widthMm = configuration.dimensions.width || widthMm;
    depthMm = configuration.dimensions.depth || depthMm;
    heightMm = configuration.dimensions.height || heightMm;
  } else {
    // Derive from product option selections
    const getOptionValueMm = (groupId: string): number | null => {
      const selectionId = configuration.selections?.[groupId];
      if (!selectionId) return null;
      
      const group = product.groups?.find((g: any) => g.id === groupId);
      const option = group?.options?.find((o: any) => o.id === selectionId);
      
      // Check for value field (in mm) or meta values (in meters, convert)
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
  // Drawer Configuration
  // ==========================================================
  if (configuration.customDrawers && configuration.customDrawers.length > 0) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'NumberOfDrawers', null, createEntity('IFCINTEGER', configuration.customDrawers.length), null));
    
    // Get drawer heights from product options
    const drawerGroup = product.groups?.find((g: any) => g.type === 'drawer_stack' || g.id === 'config');
    const drawerHeights = configuration.customDrawers.map((d: any) => {
      const opt = drawerGroup?.options?.find((o: any) => o.id === d.id);
      return opt?.meta?.front || 150;
    });
    
    // Drawer configuration code (e.g., "75.200.250" for drawer heights in mm)
    // Sort descending to match stacking order (largest at bottom)
    const sortedHeights = [...drawerHeights].sort((a, b) => b - a);
    const drawerConfigCode = sortedHeights.join('.');
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DrawerConfigurationCode', null, createEntity('IFCLABEL', drawerConfigCode), null));
    
    // Individual drawer heights property
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DrawerHeights', null, createEntity('IFCLABEL', drawerHeights.join(', ') + ' mm'), null));
  } else {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'NumberOfDrawers', null, createEntity('IFCINTEGER', 0), null));
  }
  
  // ==========================================================
  // Load Ratings (Section 10.2) - Standard Boscotek capacities
  // ==========================================================
  // Get from selections or use Boscotek standard values
  const drawerUDL = configuration.selections?.drawerCapacity || 
                    product.specifications?.drawerUDL || 
                    '200 kg (HD Cabinet Standard)';
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'UDLDrawerCapacity', null, createEntity('IFCLABEL', drawerUDL), null));
  
  const cabinetUDL = configuration.selections?.cabinetCapacity || 
                     product.specifications?.cabinetUDL || 
                     '1200 kg (HD Cabinet Standard)';
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'UDLCabinetCapacity', null, createEntity('IFCLABEL', cabinetUDL), null));
  
  // ==========================================================
  // Materials and Finishes (Section 10.2, 11)
  // ==========================================================
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'MaterialBody', null, createEntity('IFCLABEL', 'Steel - XT Shield Powder Coated'), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'MaterialFronts', null, createEntity('IFCLABEL', 'Steel - XT Shield Powder Coated'), null));
  
  // Map color codes to finish descriptions
  const housingColorId = configuration.selections?.housing_color || configuration.selections?.color;
  const faciaColorId = configuration.selections?.facia_color || configuration.selections?.drawer_facia;
  
  if (housingColorId) {
    const finishBody = mapColorCodeToFinish(housingColorId);
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'FinishBody', null, createEntity('IFCLABEL', finishBody), null));
  } else {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'FinishBody', null, createEntity('IFCLABEL', 'MG - Monument Grey (Standard)'), null));
  }
  
  if (faciaColorId) {
    const finishFronts = mapColorCodeToFinish(faciaColorId);
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'FinishFronts', null, createEntity('IFCLABEL', finishFronts), null));
  } else {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'FinishFronts', null, createEntity('IFCLABEL', 'SG - Surfmist Grey (Standard)'), null));
  }
  
  // ==========================================================
  // Pricing (Section 11)
  // ==========================================================
  if (pricing) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BasePrice', null, createEntity('IFCMONETARYMEASURE', pricing.basePrice || 0), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'TotalPrice', null, createEntity('IFCMONETARYMEASURE', pricing.totalPrice || 0), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Currency', null, createEntity('IFCLABEL', pricing.currency || 'AUD'), null));
  }
  
  // ==========================================================
  // Product URL (Section 11)
  // ==========================================================
  const productUrl = product.url || 'https://www.boscotek.com.au/products/high-density-cabinets';
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'URLProductPage', null, createEntity('IFCTEXT', productUrl), null));
  
  // Product description
  if (product.description) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Description', null, createEntity('IFCTEXT', product.description), null));
  }
  
  // ==========================================================
  // Series/Depth Type (for HD Cabinet)
  // ==========================================================
  const seriesId = configuration.selections?.series;
  if (seriesId) {
    const seriesGroup = product.groups?.find((g: any) => g.id === 'series');
    const seriesOption = seriesGroup?.options?.find((o: any) => o.id === seriesId);
    if (seriesOption) {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Series', null, createEntity('IFCLABEL', seriesOption.code || seriesOption.label), null));
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DepthType', null, createEntity('IFCLABEL', seriesId.includes('d') ? 'D - Deep' : 'S - Standard'), null));
    }
  }
  
  // ==========================================================
  // Create property set (Section 10.1)
  // ==========================================================
  const pset = createEntity('IFCPROPERTYSET', 'Pset_BoscotekCabinet', ownerHistoryId, 'Boscotek cabinet configuration properties', null, properties);
  
  // Relate to element
  createEntity('IFCRELDEFINESBYPROPERTIES', 'PropertiesRel', ownerHistoryId, null, null, [elementId], pset);
  
  console.log(`Property set created with ${properties.length} properties`);
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
    const fileName = `Boscotek_${product.id}_${referenceCode}_CFG${configId}_LEAD${leadId || 'NONE'}.ifc`;
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
