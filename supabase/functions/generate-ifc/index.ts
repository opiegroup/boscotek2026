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
  
  // Extract dimensions (Section 5: Use METERS - no conversion needed)
  const dimensions = configData.dimensions || {
    width: 0.56,
    height: 0.85,
    depth: 0.75
  };

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
  
  // Create cabinet/workbench body
  const bodyRepresentation = createCabinetGeometry(dimensions, createEntity, geometricContext);
  
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
  
  // 9. Drawers (Section 9: Proper aggregation and assembly)
  let allProducts = [productInstance]; // Start with cabinet
  
  if (configuration.customDrawers && configuration.customDrawers.length > 0) {
    const drawerIds = addDrawerGeometry(configuration.customDrawers, product, dimensions, productInstance, createEntity, ownerHistoryId, geometricContext, productLocalPlacement);
    
    // Section 9: Aggregate drawers under cabinet using IfcRelAggregates
    if (drawerIds.length > 0) {
      createEntity('IFCRELAGGREGATES', 'CabinetDrawerAssembly', ownerHistoryId, 'Cabinet with Drawers', null, productInstance, drawerIds);
      
      // FIX (Bug 3): Drawers must also be added to allProducts for spatial containment
      allProducts = allProducts.concat(drawerIds);
    }
  }
  
  // 10. Add ALL products (cabinet + drawers) to building storey
  // FIX (Bug 3): All products must be contained in BuildingStorey per IFC requirements
  createEntity('IFCRELCONTAINEDINSPATIALSTRUCTURE', 'StoreyContainer', ownerHistoryId, null, null, allProducts, storeyId);

  // Close IFC file
  const ifcContent = `${ifcHeader}
${entities.join('\n')}
ENDSEC;
END-ISO-10303-21;`;

  return ifcContent;
}

/**
 * Create cabinet/workbench body geometry
 */
function createCabinetGeometry(dimensions: any, createEntity: Function, contextId: number): number {
  // Access E function from parent scope
  const E = (value: string) => ({ __ifcEnum: value });
  
  const { width, height, depth } = dimensions;
  
  // Create proper placement with all directions
  const extrusionDirection = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const originPoint = createEntity('IFCCARTESIANPOINT', [-width/2, -depth/2, 0.]);
  const zDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const xDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const position = createEntity('IFCAXIS2PLACEMENT3D', originPoint, zDir, xDir);
  
  // Create rectangular profile (centered at origin)
  const profileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
  const profileXDir = createEntity('IFCDIRECTION', [1., 0.]);
  const profilePosition = createEntity('IFCAXIS2PLACEMENT2D', profileOrigin, profileXDir);
  const rectangleProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, profilePosition, width, depth);
  
  // Create extrusion
  const extrudedSolid = createEntity('IFCEXTRUDEDAREASOLID', rectangleProfile, position, extrusionDirection, height);
  
  // Shape representation
  const shapeRepresentation = createEntity('IFCSHAPEREPRESENTATION', contextId, E('Body'), E('SweptSolid'), [extrudedSolid]);
  
  // Product definition shape
  return createEntity('IFCPRODUCTDEFINITIONSHAPE', null, null, [shapeRepresentation]);
}

/**
 * Add drawer geometry to IFC (Section 9: Return drawer IDs for aggregation)
 */
function addDrawerGeometry(
  drawers: any[],
  product: any,
  cabinetDimensions: any,
  parentId: number,
  createEntity: Function,
  ownerHistoryId: number,
  contextId: number,
  parentPlacement: number
): number[] {
  // Access E function from parent scope
  const E = (value: string) => ({ __ifcEnum: value });
  
  const drawerIds: number[] = [];
  
  // Find drawer configuration group to look up heights
  const drawerGroup = product.groups?.find((g: any) => g.type === 'drawer_stack' || g.id === 'config');
  
  // Calculate cumulative Y positions based on actual drawer heights
  let cumulativeY = 0; // Start from bottom of cabinet
  
  // Create individual drawer elements with proper placement
  drawers.forEach((drawer: any, index: number) => {
    // Look up drawer height from product definition
    const drawerOption = drawerGroup?.options.find((o: any) => o.id === drawer.id);
    const drawerHeightMm = drawerOption?.meta?.front || 150; // Default 150mm if not found
    const drawerHeight = drawerHeightMm / 1000; // Convert mm to meters
    
    // Dimensions in meters (consistent with Section 5)
    const drawerWidth = cabinetDimensions.width - 0.04;  // 40mm (0.04m) clearance
    const drawerDepth = cabinetDimensions.depth - 0.05;  // 50mm (0.05m) clearance
    
    // Use cumulative Y position (each drawer starts where the previous one ended)
    const drawerY = cumulativeY;
    
    // Create drawer placement (offset vertically from cabinet)
    const drawerPoint = createEntity('IFCCARTESIANPOINT', [0., 0., drawerY]);
    const drawerZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const drawerXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
    const drawerAxis = createEntity('IFCAXIS2PLACEMENT3D', drawerPoint, drawerZDir, drawerXDir);
    const drawerPlacement = createEntity('IFCLOCALPLACEMENT', parentPlacement, drawerAxis);
    
    // Create drawer geometry
    const dExtrusionDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const dOrigin = createEntity('IFCCARTESIANPOINT', [-drawerWidth/2, -drawerDepth/2, 0.]);
    const dZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const dXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
    const dPosition = createEntity('IFCAXIS2PLACEMENT3D', dOrigin, dZDir, dXDir);
    
    const dProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
    const dProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
    const dProfilePos = createEntity('IFCAXIS2PLACEMENT2D', dProfileOrigin, dProfileXDir);
    const dProfile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, dProfilePos, drawerWidth, drawerDepth);
    
    const dSolid = createEntity('IFCEXTRUDEDAREASOLID', dProfile, dPosition, dExtrusionDir, drawerHeight);
    const dShapeRep = createEntity('IFCSHAPEREPRESENTATION', contextId, E('Body'), E('SweptSolid'), [dSolid]);
    const dProdDefShape = createEntity('IFCPRODUCTDEFINITIONSHAPE', null, null, [dShapeRep]);
    
    // Create drawer element (Section 9)
    const drawerElement = createEntity(
      'IFCFURNISHINGELEMENT',
      `Drawer-${index + 1}`,
      ownerHistoryId,
      `Drawer ${index + 1}`,
      `Drawer Height ${drawerHeightMm.toFixed(0)}mm`, // Description with drawer specs
      `Drawer-${index + 1}`,                        // ObjectType
      drawerPlacement,                              // Proper entity reference
      dProdDefShape,
      null                                          // Tag
    );
    
    drawerIds.push(drawerElement);
    
    // Update cumulative Y for next drawer (stack them vertically)
    cumulativeY += drawerHeight;
    
    // Add drawer-specific properties
    addDrawerProperties(drawerElement, drawer, index, createEntity, ownerHistoryId);
  });
  
  return drawerIds;
}

/**
 * Add drawer-specific property sets (Section 9, 10)
 */
function addDrawerProperties(
  drawerId: number,
  drawer: any,
  index: number,
  createEntity: Function,
  ownerHistoryId: number
): void {
  const properties: number[] = [];
  
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DrawerNumber', null, createEntity('IFCINTEGER', index + 1), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DrawerHeight', null, createEntity('IFCLENGTHMEASURE', drawer.height || 0.15), null));
  
  if (drawer.interior) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DrawerInterior', null, createEntity('IFCLABEL', drawer.interior), null));
  }
  
  if (drawer.capacity) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'LoadCapacity', null, createEntity('IFCLABEL', drawer.capacity), null));
  }
  
  const pset = createEntity('IFCPROPERTYSET', `Pset_Drawer_${index + 1}`, ownerHistoryId, null, null, properties);
  createEntity('IFCRELDEFINESBYPROPERTIES', `DrawerPropsRel_${index + 1}`, ownerHistoryId, null, null, [drawerId], pset);
}

/**
 * Add comprehensive property sets (Section 10, 11: Metadata per specification)
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
  
  // Section 10.2: Standard Properties - Pset_BoscotekCabinet
  
  // Core Identification
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BoscotekCode', null, createEntity('IFCIDENTIFIER', referenceCode), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Family', null, createEntity('IFCLABEL', product.name), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Manufacturer', null, createEntity('IFCLABEL', 'Boscotek'), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'OwnerOrganisation', null, createEntity('IFCLABEL', 'Opie Manufacturing Group'), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'AustralianMade', null, createEntity('IFCBOOLEAN', '.T.'), null));
  
  // Dimensions (in millimeters as per Section 5)
  if (configuration.dimensions) {
    const dims = configuration.dimensions;
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Width', null, createEntity('IFCLENGTHMEASURE', dims.width), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Depth', null, createEntity('IFCLENGTHMEASURE', dims.depth), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Height', null, createEntity('IFCLENGTHMEASURE', dims.height), null));
  }
  
  // Drawer Configuration
  if (configuration.customDrawers && configuration.customDrawers.length > 0) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'NumberOfDrawers', null, createEntity('IFCINTEGER', configuration.customDrawers.length), null));
    
    // Drawer configuration code (e.g., "75.200.250" for drawer heights in mm)
    const drawerHeights = configuration.customDrawers.map((d: any) => (d.height * 1000).toFixed(0)).join('.');
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'DrawerConfigurationCode', null, createEntity('IFCLABEL', drawerHeights), null));
  }
  
  // Load Ratings (Section 10.2)
  if (configuration.selections) {
    const sel = configuration.selections;
    
    // UDL Capacities
    if (sel.drawerCapacity || product.specifications?.drawerUDL) {
      const drawerUDL = sel.drawerCapacity || product.specifications?.drawerUDL || '80 kg';
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'UDLDrawerCapacity', null, createEntity('IFCLABEL', drawerUDL), null));
    }
    
    if (sel.cabinetCapacity || product.specifications?.cabinetUDL) {
      const cabinetUDL = sel.cabinetCapacity || product.specifications?.cabinetUDL || '300 kg';
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'UDLCabinetCapacity', null, createEntity('IFCLABEL', cabinetUDL), null));
    }
    
    // Materials and Finishes (Section 10.2, 11)
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'MaterialBody', null, createEntity('IFCLABEL', 'Steel'), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'MaterialFronts', null, createEntity('IFCLABEL', 'Steel'), null));
    
    // Map color codes to finish descriptions
    if (sel.bodyColor) {
      const finishBody = mapColorCodeToFinish(sel.bodyColor);
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'FinishBody', null, createEntity('IFCLABEL', finishBody), null));
    }
    
    if (sel.frontColor) {
      const finishFronts = mapColorCodeToFinish(sel.frontColor);
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'FinishFronts', null, createEntity('IFCLABEL', finishFronts), null));
    }
  }
  
  // Pricing (Section 11)
  if (pricing) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BasePrice', null, createEntity('IFCMONETARYMEASURE', pricing.basePrice), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'TotalPrice', null, createEntity('IFCMONETARYMEASURE', pricing.totalPrice), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Currency', null, createEntity('IFCLABEL', 'AUD'), null));
  }
  
  // Product URL (Section 11)
  if (product.url) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'URLProductPage', null, createEntity('IFCTEXT', product.url), null));
  } else {
    // Default to Boscotek website
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'URLProductPage', null, createEntity('IFCTEXT', 'https://www.boscotek.com.au'), null));
  }
  
  // Additional configuration selections (Section 11)
  Object.entries(configuration.selections || {}).forEach(([key, value]) => {
    if (value && !['bodyColor', 'frontColor', 'drawerCapacity', 'cabinetCapacity'].includes(key)) {
      const propertyName = key.charAt(0).toUpperCase() + key.slice(1);
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', propertyName, null, createEntity('IFCTEXT', String(value)), null));
    }
  });
  
  // Create property set (Section 10.1)
  const pset = createEntity('IFCPROPERTYSET', 'Pset_BoscotekCabinet', ownerHistoryId, null, null, properties);
  
  // Relate to element
  createEntity('IFCRELDEFINESBYPROPERTIES', 'PropertiesRel', ownerHistoryId, null, null, [elementId], pset);
}

/**
 * Map color codes to descriptive finish names (Section 11)
 */
function mapColorCodeToFinish(colorCode: string): string {
  const colorMap: { [key: string]: string } = {
    'MG': 'MG - Mist Grey',
    'SG': 'SG - Signal Grey',
    'DB': 'DB - Deep Blue',
    'OR': 'OR - Orange',
    'GG': 'GG - Green Grey',
    'BK': 'BK - Black',
    'WH': 'WH - White',
    'RD': 'RD - Red',
    'YL': 'YL - Yellow'
  };
  
  return colorMap[colorCode] || colorCode;
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
