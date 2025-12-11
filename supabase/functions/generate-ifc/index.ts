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
  
  // Extract dimensions
  const dimensions = configData.dimensions || {
    width: 0.56,
    height: 0.85,
    depth: 0.75
  };

  // IFC Header
  const ifcHeader = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'), '2;1');
FILE_NAME('${referenceCode}.ifc', '${timestamp}', ('Boscotek Configurator'), ('Boscotek'), 'Boscotek Configurator v1.0', 'Boscotek Configurator', 'IFC4');
FILE_SCHEMA(('IFC4'));
ENDSEC;

DATA;`;

  let entityId = 1;
  const entities: string[] = [];

  // Helper to create entity with improved type detection
  const createEntity = (type: string, ...params: any[]): number => {
    const id = entityId++;
    const paramsStr = params.map(p => {
      if (p === null || p === undefined) return '$';
      if (typeof p === 'string') return `'${p}'`;
      if (Array.isArray(p)) {
        if (p.length === 0) return '()';
        
        // Check if ALL elements are numbers
        const allNumbers = p.every(item => typeof item === 'number');
        
        if (allNumbers) {
          // Detect if this is a coordinate list (has decimals OR small length + reasonable range)
          const hasDecimals = p.some((n: number) => n % 1 !== 0);
          const isSmallArray = p.length <= 4;
          const isReasonableRange = p.every((n: number) => n >= -10000 && n <= 10000);
          
          // Coordinates: small arrays with decimals or reasonable ranges
          if (hasDecimals || (isSmallArray && isReasonableRange)) {
            return `(${p.map(n => {
              const str = n.toString();
              // Add trailing dot for integers to make them floats in IFC
              return str.includes('.') ? str : `${str}.`;
            }).join(',')})`;
          }
        }
        
        // Entity reference list: treat numbers as #references
        return `(${p.map(item => typeof item === 'number' ? `#${item}` : item).join(',')})`;
      }
      if (typeof p === 'number') {
        // Single numbers are ALWAYS entity references in IFC parameters
        return `#${p}`;
      }
      return String(p);
    }).join(',');
    entities.push(`#${id}=${type}(${paramsStr});`);
    return id;
  };

  // 1. Owner History
  const ownerHistoryId = createEntity('IFCOWNERHISTORY', null, null, null, 'NOCHANGE', null, null, null, Date.now());
  
  // 2. Units (MUST be created BEFORE project)
  const lengthUnit = createEntity('IFCSIUNIT', '*', 'LENGTHUNIT', null, 'METRE');
  const areaUnit = createEntity('IFCSIUNIT', '*', 'AREAUNIT', null, 'SQUARE_METRE');
  const volumeUnit = createEntity('IFCSIUNIT', '*', 'VOLUMEUNIT', null, 'CUBIC_METRE');
  const massUnit = createEntity('IFCSIUNIT', '*', 'MASSUNIT', null, 'GRAM');
  
  const unitAssignment = createEntity('IFCUNITASSIGNMENT', [lengthUnit, areaUnit, volumeUnit, massUnit]);
  
  // 3. Geometric Representation Context (MUST be created BEFORE project)
  const geometricContext = createEntity('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', 3, 1.E-5, null, null);
  
  // 4. Project Structure (NOW with proper references to units and context)
  // FIX: Pass [geometricContext] and unitAssignment instead of null
  const projectId = createEntity('IFCPROJECT', referenceCode, ownerHistoryId, product.name, `Boscotek ${product.name} Configuration`, null, null, null, [geometricContext], unitAssignment);
  
  // 5. Spatial Hierarchy: Site → Building → BuildingStorey
  const siteId = createEntity('IFCSITE', 'Site', ownerHistoryId, 'Default Site', null, null, null, null, 'ELEMENT', null, null, null, null, null);
  const buildingId = createEntity('IFCBUILDING', 'Building', ownerHistoryId, 'Default Building', null, null, null, null, 'ELEMENT', null, null, null);
  const storeyId = createEntity('IFCBUILDINGSTOREY', 'Storey', ownerHistoryId, 'Level 0', null, null, null, null, 'ELEMENT', null, null, null);
  
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
  
  // 7. Product Instance
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
    null,
    productLocalPlacement,  // This is now a proper entity reference, not a float
    bodyRepresentation,
    null
  );
  
  // 8. Add to building storey (NOT building directly)
  // FIX: Products should be contained in BuildingStorey, not Building
  createEntity('IFCRELCONTAINEDINSPATIALSTRUCTURE', 'StoreyContainer', ownerHistoryId, null, null, [productInstance], storeyId);
  
  // 9. Property Sets (Metadata)
  addPropertySets(productInstance, configuration, product, pricing, referenceCode, createEntity, ownerHistoryId);
  
  // 10. Drawers (if HD Cabinet)
  if (configuration.customDrawers && configuration.customDrawers.length > 0) {
    addDrawerGeometry(configuration.customDrawers, product, dimensions, productInstance, createEntity, ownerHistoryId, geometricContext, productLocalPlacement);
  }

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
  const rectangleProfile = createEntity('IFCRECTANGLEPROFILEDEF', 'AREA', null, profilePosition, width, depth);
  
  // Create extrusion
  const extrudedSolid = createEntity('IFCEXTRUDEDAREASOLID', rectangleProfile, position, extrusionDirection, height);
  
  // Shape representation
  const shapeRepresentation = createEntity('IFCSHAPEREPRESENTATION', contextId, 'Body', 'SweptSolid', [extrudedSolid]);
  
  // Product definition shape
  return createEntity('IFCPRODUCTDEFINITIONSHAPE', null, null, [shapeRepresentation]);
}

/**
 * Add drawer geometry to IFC
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
): void {
  // Create individual drawer elements with proper placement
  drawers.forEach((drawer: any, index: number) => {
    // Create drawer placement (offset vertically)
    const drawerPoint = createEntity('IFCCARTESIANPOINT', [0., 0., drawer.y || (index * 0.1)]);
    const drawerZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const drawerXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
    const drawerAxis = createEntity('IFCAXIS2PLACEMENT3D', drawerPoint, drawerZDir, drawerXDir);
    const drawerPlacement = createEntity('IFCLOCALPLACEMENT', parentPlacement, drawerAxis);
    
    // Create simple box for drawer
    const drawerWidth = cabinetDimensions.width - 0.04;
    const drawerDepth = cabinetDimensions.depth - 0.05;
    const drawerHeight = drawer.height || 0.15;
    
    const dExtrusionDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const dOrigin = createEntity('IFCCARTESIANPOINT', [-drawerWidth/2, -drawerDepth/2, 0.]);
    const dZDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const dXDir = createEntity('IFCDIRECTION', [1., 0., 0.]);
    const dPosition = createEntity('IFCAXIS2PLACEMENT3D', dOrigin, dZDir, dXDir);
    
    const dProfileOrigin = createEntity('IFCCARTESIANPOINT', [0., 0.]);
    const dProfileXDir = createEntity('IFCDIRECTION', [1., 0.]);
    const dProfilePos = createEntity('IFCAXIS2PLACEMENT2D', dProfileOrigin, dProfileXDir);
    const dProfile = createEntity('IFCRECTANGLEPROFILEDEF', 'AREA', null, dProfilePos, drawerWidth, drawerDepth);
    
    const dSolid = createEntity('IFCEXTRUDEDAREASOLID', dProfile, dPosition, dExtrusionDir, drawerHeight);
    const dShapeRep = createEntity('IFCSHAPEREPRESENTATION', contextId, 'Body', 'SweptSolid', [dSolid]);
    const dProdDefShape = createEntity('IFCPRODUCTDEFINITIONSHAPE', null, null, [dShapeRep]);
    
    // Create drawer element
    const drawerElement = createEntity(
      'IFCFURNISHINGELEMENT',
      `Drawer-${index + 1}`,
      ownerHistoryId,
      `Drawer ${index + 1}`,
      null,
      null,
      drawerPlacement,  // Proper entity reference
      dProdDefShape,
      null
    );
    
    // Could add property for drawer interior here if needed
  });
}

/**
 * Add property sets (metadata) to IFC
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
  // Boscotek Custom Properties
  const properties: number[] = [];
  
  // Product Information
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'Manufacturer', null, createEntity('IFCTEXT', 'Boscotek'), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ProductFamily', null, createEntity('IFCTEXT', product.name), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'ConfigurationCode', null, createEntity('IFCTEXT', referenceCode), null));
  properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'AustralianMade', null, createEntity('IFCBOOLEAN', '.T.'), null));
  
  // Pricing
  if (pricing) {
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'BasePrice', null, createEntity('IFCMONETARYMEASURE', pricing.basePrice), null));
    properties.push(createEntity('IFCPROPERTYSINGLEVALUE', 'TotalPrice', null, createEntity('IFCMONETARYMEASURE', pricing.totalPrice), null));
  }
  
  // Selections
  Object.entries(configuration.selections || {}).forEach(([key, value]) => {
    if (value) {
      properties.push(createEntity('IFCPROPERTYSINGLEVALUE', key, null, createEntity('IFCTEXT', String(value)), null));
    }
  });
  
  // Create property set
  const pset = createEntity('IFCPROPERTYSET', 'BoscotekProperties', ownerHistoryId, null, null, properties);
  
  // Relate to element
  createEntity('IFCRELDEFINESBYPROPERTIES', 'PropertiesRel', ownerHistoryId, null, null, [elementId], pset);
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
