import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate OBJ file content with MTL material file
 * OBJ format is simpler than IFC and better for visualization testing
 */
function generateOBJContent(configData: any): { obj: string; mtl: string } {
  const { configuration, product, referenceCode } = configData;
  
  // Extract dimensions from configuration (in meters)
  const width = (configuration.selections?.width || 560) / 1000; // Convert mm to m
  const height = (configuration.selections?.height || 850) / 1000;
  const depth = (configuration.selections?.depth || 750) / 1000;
  const wallThickness = 0.020; // 20mm walls
  
  let vertices: string[] = [];
  let faces: string[] = [];
  let vertexIndex = 1;
  
  // OBJ Header
  const objHeader = `# Boscotek ${product.name}
# Configuration: ${referenceCode}
# Generated: ${new Date().toISOString()}
# Units: meters

mtllib ${referenceCode}.mtl

`;

  // MTL (Material) file content
  const mtlContent = `# Boscotek Materials
# Configuration: ${referenceCode}

newmtl CabinetBody
Ka 0.5 0.5 0.5
Kd 0.7 0.7 0.7
Ks 0.8 0.8 0.8
Ns 100.0
d 1.0

newmtl Drawer
Ka 0.4 0.4 0.5
Kd 0.6 0.6 0.8
Ks 0.7 0.7 0.9
Ns 80.0
d 1.0
`;

  // Helper to add a box (8 vertices, 6 faces)
  const addBox = (w: number, h: number, d: number, x: number, y: number, z: number, material: string) => {
    faces.push(`\ng ${material}`);
    faces.push(`usemtl ${material}`);
    
    const startIdx = vertexIndex;
    
    // 8 vertices of a box (centered at x,y,z)
    vertices.push(`v ${(x - w/2).toFixed(6)} ${(y - d/2).toFixed(6)} ${z.toFixed(6)}`); // 0: front-left-bottom
    vertices.push(`v ${(x + w/2).toFixed(6)} ${(y - d/2).toFixed(6)} ${z.toFixed(6)}`); // 1: front-right-bottom
    vertices.push(`v ${(x + w/2).toFixed(6)} ${(y + d/2).toFixed(6)} ${z.toFixed(6)}`); // 2: back-right-bottom
    vertices.push(`v ${(x - w/2).toFixed(6)} ${(y + d/2).toFixed(6)} ${z.toFixed(6)}`); // 3: back-left-bottom
    vertices.push(`v ${(x - w/2).toFixed(6)} ${(y - d/2).toFixed(6)} ${(z + h).toFixed(6)}`); // 4: front-left-top
    vertices.push(`v ${(x + w/2).toFixed(6)} ${(y - d/2).toFixed(6)} ${(z + h).toFixed(6)}`); // 5: front-right-top
    vertices.push(`v ${(x + w/2).toFixed(6)} ${(y + d/2).toFixed(6)} ${(z + h).toFixed(6)}`); // 6: back-right-top
    vertices.push(`v ${(x - w/2).toFixed(6)} ${(y + d/2).toFixed(6)} ${(z + h).toFixed(6)}`); // 7: back-left-top
    
    vertexIndex += 8;
    
    // 6 faces (each face is 2 triangles)
    // Bottom face (z = 0)
    faces.push(`f ${startIdx} ${startIdx + 2} ${startIdx + 1}`);
    faces.push(`f ${startIdx} ${startIdx + 3} ${startIdx + 2}`);
    
    // Top face (z = h)
    faces.push(`f ${startIdx + 4} ${startIdx + 5} ${startIdx + 6}`);
    faces.push(`f ${startIdx + 4} ${startIdx + 6} ${startIdx + 7}`);
    
    // Front face (y = -d/2)
    faces.push(`f ${startIdx} ${startIdx + 1} ${startIdx + 5}`);
    faces.push(`f ${startIdx} ${startIdx + 5} ${startIdx + 4}`);
    
    // Back face (y = d/2)
    faces.push(`f ${startIdx + 2} ${startIdx + 3} ${startIdx + 7}`);
    faces.push(`f ${startIdx + 2} ${startIdx + 7} ${startIdx + 6}`);
    
    // Left face (x = -w/2)
    faces.push(`f ${startIdx} ${startIdx + 4} ${startIdx + 7}`);
    faces.push(`f ${startIdx} ${startIdx + 7} ${startIdx + 3}`);
    
    // Right face (x = w/2)
    faces.push(`f ${startIdx + 1} ${startIdx + 2} ${startIdx + 6}`);
    faces.push(`f ${startIdx + 1} ${startIdx + 6} ${startIdx + 5}`);
  };
  
  // Create cabinet body (as 5 panels)
  faces.push(`\n# Cabinet Body`);
  
  // Back panel
  addBox(width, wallThickness, height, 0, depth/2 - wallThickness/2, height/2, 'CabinetBody');
  
  // Left side panel
  addBox(wallThickness, depth, height, -width/2 + wallThickness/2, 0, height/2, 'CabinetBody');
  
  // Right side panel
  addBox(wallThickness, depth, height, width/2 - wallThickness/2, 0, height/2, 'CabinetBody');
  
  // Bottom panel
  addBox(width, depth, wallThickness, 0, 0, wallThickness/2, 'CabinetBody');
  
  // Top panel
  addBox(width, depth, wallThickness, 0, 0, height - wallThickness/2, 'CabinetBody');
  
  // Add drawers if present
  if (configuration.customDrawers && configuration.customDrawers.length > 0) {
    faces.push(`\n# Drawers`);
    
    const drawerGroup = product.groups?.find((g: any) => g.type === 'drawer_stack' || g.id === 'config');
    let cumulativeY = wallThickness; // Start just above bottom panel
    
    configuration.customDrawers.forEach((drawer: any, index: number) => {
      // Look up drawer height
      const drawerOption = drawerGroup?.options.find((o: any) => o.id === drawer.id);
      const drawerHeightMm = drawerOption?.meta?.front || 150;
      const drawerHeight = drawerHeightMm / 1000; // Convert to meters
      
      const drawerWidth = width - 0.04; // 40mm clearance
      const drawerDepth = depth - 0.05; // 50mm clearance
      
      // Position drawer at cumulative height
      addBox(
        drawerWidth,
        drawerHeight,
        drawerDepth,
        0,
        0,
        cumulativeY + drawerHeight/2,
        `Drawer_${index + 1}`
      );
      
      cumulativeY += drawerHeight;
    });
  }
  
  // Combine all content
  const objContent = objHeader + vertices.join('\n') + '\n' + faces.join('\n');
  
  return {
    obj: objContent,
    mtl: mtlContent
  };
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

    // Generate OBJ and MTL content
    const startTime = Date.now();
    const { obj, mtl } = generateOBJContent({ configuration, product, pricing, referenceCode });
    const generationTime = Date.now() - startTime;

    // Upload OBJ file
    const objFileName = `Boscotek_${product.id}_${referenceCode}_CFG${configId}_LEAD${leadId || 'NONE'}.obj`;
    const objFilePath = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${objFileName}`;

    const { error: objUploadError } = await supabaseClient
      .storage
      .from('bim-exports')
      .upload(objFilePath, obj, {
        contentType: 'model/obj',
        upsert: false
      });

    if (objUploadError) {
      throw objUploadError;
    }

    // Upload MTL file
    const mtlFileName = `Boscotek_${product.id}_${referenceCode}_CFG${configId}_LEAD${leadId || 'NONE'}.mtl`;
    const mtlFilePath = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${mtlFileName}`;

    const { error: mtlUploadError } = await supabaseClient
      .storage
      .from('bim-exports')
      .upload(mtlFilePath, mtl, {
        contentType: 'text/plain',
        upsert: false
      });

    if (mtlUploadError) {
      throw mtlUploadError;
    }

    // Get signed URLs
    const { data: objUrlData } = await supabaseClient
      .storage
      .from('bim-exports')
      .createSignedUrl(objFilePath, 3600);

    const { data: mtlUrlData } = await supabaseClient
      .storage
      .from('bim-exports')
      .createSignedUrl(mtlFilePath, 3600);

    // Save export record
    const { data: exportData, error: exportError } = await supabaseClient
      .from('bim_exports')
      .insert([{
        lead_id: leadId || null,
        config_id: configId,
        ifc_url: objUrlData?.signedUrl, // Store OBJ URL in ifc_url field for now
        export_type: 'OBJ',
        file_size_bytes: new TextEncoder().encode(obj).length + new TextEncoder().encode(mtl).length,
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
        objUrl: objUrlData?.signedUrl,
        mtlUrl: mtlUrlData?.signedUrl,
        fileName: objFileName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error generating OBJ:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});




