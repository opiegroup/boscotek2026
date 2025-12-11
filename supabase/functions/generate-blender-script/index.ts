import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate Blender Python script to create the cabinet model
 * Users can run this script in Blender's Scripting workspace
 */
function generateBlenderScript(configData: any): string {
  const { configuration, product, referenceCode } = configData;
  
  // Extract dimensions from configuration (in meters)
  const width = (configuration.selections?.width || 560) / 1000; // Convert mm to m
  const height = (configuration.selections?.height || 850) / 1000;
  const depth = (configuration.selections?.depth || 750) / 1000;
  const wallThickness = 0.020; // 20mm walls
  
  // Generate drawer data
  let drawerData = '[]';
  if (configuration.customDrawers && configuration.customDrawers.length > 0) {
    const drawerGroup = product.groups?.find((g: any) => g.type === 'drawer_stack' || g.id === 'config');
    const drawers = configuration.customDrawers.map((drawer: any) => {
      const drawerOption = drawerGroup?.options.find((o: any) => o.id === drawer.id);
      const drawerHeightMm = drawerOption?.meta?.front || 150;
      return {
        height: drawerHeightMm / 1000,
        interior: drawer.interior || 'None',
        capacity: drawer.capacity || 'Unknown'
      };
    });
    drawerData = JSON.stringify(drawers, null, 4);
  }

  const script = `"""
Boscotek ${product.name} - Blender Generator Script
Configuration: ${referenceCode}
Generated: ${new Date().toISOString()}

INSTRUCTIONS:
1. Open Blender
2. Go to Scripting workspace (top menu)
3. Click "New" to create a new script
4. Paste this entire script
5. Click "Run Script" button (or press Alt+P)

This will generate the ${product.name} with all drawers in your Blender scene.
"""

import bpy
import bmesh
from mathutils import Vector

# Configuration Data
CABINET_CONFIG = {
    'name': '${product.name}',
    'reference_code': '${referenceCode}',
    'width': ${width},
    'height': ${height},
    'depth': ${depth},
    'wall_thickness': ${wallThickness},
    'drawers': ${drawerData}
}

def clear_scene():
    """Clear default scene objects"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
def create_box(name, width, height, depth, location=(0, 0, 0), color=(0.7, 0.7, 0.7, 1.0)):
    """Create a box mesh with given dimensions"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (width/2, depth/2, height/2)
    
    # Apply scale
    bpy.ops.object.transform_apply(scale=True)
    
    # Add material
    mat = bpy.data.materials.new(name=f"{name}_Material")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs[0].default_value = color
    obj.data.materials.append(mat)
    
    return obj

def create_cabinet_body():
    """Create cabinet body as 5 panels"""
    config = CABINET_CONFIG
    w = config['width']
    h = config['height']
    d = config['depth']
    t = config['wall_thickness']
    
    panels = []
    
    # Back panel
    back = create_box(
        'Cabinet_Back',
        w, t, h,
        location=(0, d/2 - t/2, h/2),
        color=(0.6, 0.6, 0.6, 1.0)
    )
    panels.append(back)
    
    # Left side panel
    left = create_box(
        'Cabinet_Left',
        t, d, h,
        location=(-w/2 + t/2, 0, h/2),
        color=(0.65, 0.65, 0.65, 1.0)
    )
    panels.append(left)
    
    # Right side panel
    right = create_box(
        'Cabinet_Right',
        t, d, h,
        location=(w/2 - t/2, 0, h/2),
        color=(0.65, 0.65, 0.65, 1.0)
    )
    panels.append(right)
    
    # Bottom panel
    bottom = create_box(
        'Cabinet_Bottom',
        w, d, t,
        location=(0, 0, t/2),
        color=(0.7, 0.7, 0.7, 1.0)
    )
    panels.append(bottom)
    
    # Top panel
    top = create_box(
        'Cabinet_Top',
        w, d, t,
        location=(0, 0, h - t/2),
        color=(0.7, 0.7, 0.7, 1.0)
    )
    panels.append(top)
    
    # Create collection for cabinet
    cabinet_collection = bpy.data.collections.new("Cabinet_Body")
    bpy.context.scene.collection.children.link(cabinet_collection)
    
    # Move panels to collection
    for panel in panels:
        bpy.context.scene.collection.objects.unlink(panel)
        cabinet_collection.objects.link(panel)
    
    return panels

def create_drawers():
    """Create drawer elements"""
    config = CABINET_CONFIG
    drawers_data = config['drawers']
    
    if not drawers_data:
        return []
    
    w = config['width']
    d = config['depth']
    t = config['wall_thickness']
    
    drawer_width = w - 0.04  # 40mm clearance
    drawer_depth = d - 0.05  # 50mm clearance
    
    cumulative_z = t  # Start just above bottom panel
    drawers = []
    
    # Create drawer collection
    drawer_collection = bpy.data.collections.new("Drawers")
    bpy.context.scene.collection.children.link(drawer_collection)
    
    for i, drawer_data in enumerate(drawers_data):
        drawer_height = drawer_data['height']
        
        drawer = create_box(
            f'Drawer_{i+1}',
            drawer_width,
            drawer_height,
            drawer_depth,
            location=(0, 0, cumulative_z + drawer_height/2),
            color=(0.5, 0.5, 0.8, 1.0)  # Blue tint for drawers
        )
        
        # Move to drawer collection
        bpy.context.scene.collection.objects.unlink(drawer)
        drawer_collection.objects.link(drawer)
        
        drawers.append(drawer)
        cumulative_z += drawer_height
    
    return drawers

def setup_scene():
    """Setup camera and lighting"""
    # Add camera
    bpy.ops.object.camera_add(location=(2, -2, 1.5))
    camera = bpy.context.active_object
    camera.rotation_euler = (1.1, 0, 0.8)
    bpy.context.scene.camera = camera
    
    # Add sun light
    bpy.ops.object.light_add(type='SUN', location=(5, 5, 5))
    sun = bpy.context.active_object
    sun.data.energy = 2.0
    
    # Add fill light
    bpy.ops.object.light_add(type='AREA', location=(-3, -3, 3))
    fill = bpy.context.active_object
    fill.data.energy = 300
    fill.data.size = 5

def main():
    """Main function to generate the cabinet"""
    print(f"\\nGenerating Boscotek Cabinet: {CABINET_CONFIG['name']}")
    print(f"Reference Code: {CABINET_CONFIG['reference_code']}")
    print(f"Dimensions: {CABINET_CONFIG['width']}m x {CABINET_CONFIG['depth']}m x {CABINET_CONFIG['height']}m")
    print(f"Number of drawers: {len(CABINET_CONFIG['drawers'])}\\n")
    
    # Clear scene
    clear_scene()
    
    # Create cabinet body
    print("Creating cabinet body...")
    panels = create_cabinet_body()
    print(f"  Created {len(panels)} panels")
    
    # Create drawers
    print("Creating drawers...")
    drawers = create_drawers()
    print(f"  Created {len(drawers)} drawers")
    
    # Setup scene
    print("Setting up scene...")
    setup_scene()
    
    # Set viewport shading to solid
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'SOLID'
    
    print("\\n✅ Cabinet generated successfully!")
    print("\\nTIP: Press Numpad 0 to view through camera")
    print("TIP: Press Z to change viewport shading")

# Run the script
if __name__ == "__main__":
    main()
`;

  return script;
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

    // Generate Blender Python script
    const startTime = Date.now();
    const script = generateBlenderScript({ configuration, product, pricing, referenceCode });
    const generationTime = Date.now() - startTime;

    // Upload script file
    const fileName = `Boscotek_${product.id}_${referenceCode}_CFG${configId}_LEAD${leadId || 'NONE'}_blender.py`;
    const filePath = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from('bim-exports')
      .upload(filePath, script, {
        contentType: 'text/x-python',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get signed URL
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
        ifc_url: urlData?.signedUrl, // Store script URL
        export_type: 'BLENDER_SCRIPT',
        file_size_bytes: new TextEncoder().encode(script).length,
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
        scriptUrl: urlData?.signedUrl,
        fileName: fileName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error generating Blender script:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
