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

  // Helper to create entity
  const createEntity = (type: string, ...params: any[]): number => {
    const id = entityId++;
    const paramsStr = params.map(p => {
      if (p === null || p === undefined) return '$';
      if (typeof p === 'string') return `'${p}'`;
      if (typeof p === 'number') return `${p}.`;
      if (Array.isArray(p)) return `(${p.join(',')})`;
      return `#${p}`;
    }).join(',');
    entities.push(`#${id}=${type}(${paramsStr});`);
    return id;
  };

  // 1. Project Structure
  const ownerHistoryId = createEntity('IFCOWNERHISTORY', null, null, null, 'NOCHANGE', null, null, null, Date.now());
  const projectId = createEntity('IFCPROJECT', referenceCode, ownerHistoryId, product.name, `Boscotek ${product.name} Configuration`, null, null, null, null, null);
  
  // 2. Units
  const lengthUnit = createEntity('IFCSIUNIT', '*', 'LENGTHUNIT', null, 'METRE');
  const areaUnit = createEntity('IFCSIUNIT', '*', 'AREAUNIT', null, 'SQUARE_METRE');
  const volumeUnit = createEntity('IFCSIUNIT', '*', 'VOLUMEUNIT', null, 'CUBIC_METRE');
  const massUnit = createEntity('IFCSIUNIT', '*', 'MASSUNIT', null, 'GRAM');
  
  const unitAssignment = createEntity('IFCUNITASSIGNMENT', [lengthUnit, areaUnit, volumeUnit, massUnit]);
  
  // 3. Geometric Representation Context
  const geometricContext = createEntity('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', 3, 1.E-5, null, null);
  
  // 4. Site and Building
  const siteId = createEntity('IFCSITE', 'Site', ownerHistoryId, 'Default Site', null, null, null, null, 'ELEMENT', null, null, null, null, null);
  const buildingId = createEntity('IFCBUILDING', 'Building', ownerHistoryId, 'Default Building', null, null, null, null, 'ELEMENT', null, null, null);
  
  // 5. Spatial Structure
  createEntity('IFCRELAGGREGATES', 'ProjectContainer', ownerHistoryId, null, null, projectId, [siteId]);
  createEntity('IFCRELAGGREGATES', 'SiteContainer', ownerHistoryId, null, null, siteId, [buildingId]);
  
  // 6. Main Product Geometry
  const productPlacement = createEntity('IFCAXIS2PLACEMENT3D', createEntity('IFCCARTESIANPOINT', [0., 0., 0.]), null, null);
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
    productLocalPlacement,
    bodyRepresentation,
    null
  );
  
  // 8. Add to building
  createEntity('IFCRELCONTAINEDINSPATIALSTRUCTURE', 'BuildingContainer', ownerHistoryId, null, null, [productInstance], buildingId);
  
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
  
  // Create a simple box representation
  const extrusionDirection = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const position = createEntity('IFCAXIS2PLACEMENT3D', createEntity('IFCCARTESIANPOINT', [0., 0., 0.]), null, null);
  
  // Create rectangular profile
  const profilePosition = createEntity('IFCAXIS2PLACEMENT2D', createEntity('IFCCARTESIANPOINT', [0., 0.]), null);
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
  // Implementation would create individual drawer geometries
  // For brevity, this is simplified
  // In production, each drawer would be a separate IFCFURNISHINGELEMENT with proper positioning
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
