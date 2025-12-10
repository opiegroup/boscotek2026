import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate CSV export
 */
function generateCSV(configData: any): string {
  const { configuration, product, pricing, referenceCode, dimensions } = configData;
  const rows: string[] = [];
  
  // Header
  rows.push('Category,Field,Value');
  
  // Product Identity
  rows.push(`Product,Family,${product.name}`);
  rows.push(`Product,Product Code,${referenceCode}`);
  rows.push(`Product,Manufacturer,Boscotek`);
  rows.push(`Product,Australian Made,Yes`);
  
  // Dimensions
  rows.push(`Dimensions,Width (mm),${(dimensions.width * 1000).toFixed(0)}`);
  rows.push(`Dimensions,Height (mm),${(dimensions.height * 1000).toFixed(0)}`);
  rows.push(`Dimensions,Depth (mm),${(dimensions.depth * 1000).toFixed(0)}`);
  
  // Selections
  Object.entries(configuration.selections || {}).forEach(([key, value]) => {
    if (value) {
      rows.push(`Configuration,${key},${value}`);
    }
  });
  
  // Drawers
  if (configuration.customDrawers) {
    configuration.customDrawers.forEach((drawer: any, idx: number) => {
      rows.push(`Drawer ${idx + 1},Type,${drawer.id}`);
      if (drawer.interiorId) {
        rows.push(`Drawer ${idx + 1},Interior,${drawer.interiorId}`);
      }
    });
  }
  
  // Pricing
  if (pricing) {
    rows.push(`Pricing,Base Price,$${pricing.basePrice}`);
    rows.push(`Pricing,Total Price,$${pricing.totalPrice}`);
    rows.push(`Pricing,GST,$${pricing.gst}`);
    rows.push(`Pricing,Total Inc GST,$${pricing.totalWithGst}`);
  }
  
  return rows.join('\n');
}

/**
 * Generate JSON export
 */
function generateJSON(configData: any): string {
  const { configuration, product, pricing, referenceCode, dimensions } = configData;
  
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      configurationCode: referenceCode,
      version: '1.0'
    },
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      manufacturer: 'Boscotek',
      australianMade: true
    },
    dimensions: {
      width: {
        meters: dimensions.width,
        millimeters: dimensions.width * 1000
      },
      height: {
        meters: dimensions.height,
        millimeters: dimensions.height * 1000
      },
      depth: {
        meters: dimensions.depth,
        millimeters: dimensions.depth * 1000
      }
    },
    configuration: {
      selections: configuration.selections,
      drawers: configuration.customDrawers || [],
      accessories: configuration.embeddedCabinets || []
    },
    pricing: pricing || {},
    specifications: {
      loadCapacity: '200kg per drawer',
      runnerType: 'Full Extension',
      warranty: '5 years',
      compliance: 'Australian Standards',
      finish: 'Powder Coated Steel'
    }
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate detailed text specification
 */
function generateTextSpec(configData: any): string {
  const { configuration, product, pricing, referenceCode, dimensions } = configData;
  
  let spec = '';
  spec += '═══════════════════════════════════════════════════════\n';
  spec += '           BOSCOTEK PRODUCT SPECIFICATION\n';
  spec += '═══════════════════════════════════════════════════════\n\n';
  
  spec += `Product: ${product.name}\n`;
  spec += `Configuration Code: ${referenceCode}\n`;
  spec += `Generated: ${new Date().toLocaleString()}\n`;
  spec += `Manufacturer: Boscotek\n`;
  spec += `Australian Made: Yes\n\n`;
  
  spec += '───────────────────────────────────────────────────────\n';
  spec += '  DIMENSIONS\n';
  spec += '───────────────────────────────────────────────────────\n';
  spec += `Width:  ${(dimensions.width * 1000).toFixed(0)}mm\n`;
  spec += `Height: ${(dimensions.height * 1000).toFixed(0)}mm\n`;
  spec += `Depth:  ${(dimensions.depth * 1000).toFixed(0)}mm\n\n`;
  
  if (configuration.customDrawers && configuration.customDrawers.length > 0) {
    spec += '───────────────────────────────────────────────────────\n';
    spec += '  DRAWER CONFIGURATION\n';
    spec += '───────────────────────────────────────────────────────\n';
    configuration.customDrawers.forEach((drawer: any, idx: number) => {
      spec += `Drawer ${idx + 1}: ${drawer.id}`;
      if (drawer.interiorId) {
        spec += ` - Interior: ${drawer.interiorId}`;
      }
      spec += '\n';
    });
    spec += '\n';
  }
  
  spec += '───────────────────────────────────────────────────────\n';
  spec += '  FEATURES\n';
  spec += '───────────────────────────────────────────────────────\n';
  spec += '• Full Extension Drawer Runners\n';
  spec += '• 200kg Load Capacity per Drawer\n';
  spec += '• Powder Coated Steel Construction\n';
  spec += '• Australian Made\n';
  spec += '• 5 Year Warranty\n\n';
  
  if (pricing) {
    spec += '───────────────────────────────────────────────────────\n';
    spec += '  PRICING\n';
    spec += '───────────────────────────────────────────────────────\n';
    spec += `Base Price:      $${pricing.basePrice.toLocaleString()}\n`;
    spec += `Total (Ex GST):  $${pricing.totalPrice.toLocaleString()}\n`;
    spec += `GST (10%):       $${pricing.gst.toLocaleString()}\n`;
    spec += `Total (Inc GST): $${pricing.totalWithGst.toLocaleString()}\n\n`;
  }
  
  spec += '═══════════════════════════════════════════════════════\n';
  spec += '  For more information: www.boscotek.com.au\n';
  spec += '═══════════════════════════════════════════════════════\n';
  
  return spec;
}

serve(async (req) => {
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

    // Extract dimensions
    const dimensions = {
      width: 0.56,
      height: 0.85,
      depth: 0.75
    };
    
    const widthOpt = product.groups.find((g: any) => g.id === 'width' || g.id === 'size')?.options.find((o: any) => o.id === configuration.selections['width'] || o.id === configuration.selections['size']);
    const heightOpt = product.groups.find((g: any) => g.id === 'height' || g.id === 'bench_height')?.options.find((o: any) => o.id === configuration.selections['height'] || o.id === configuration.selections['bench_height']);
    const depthOpt = product.groups.find((g: any) => g.id === 'series')?.options.find((o: any) => o.id === configuration.selections['series']);
    
    if (widthOpt) dimensions.width = widthOpt.meta?.width || (widthOpt.value / 1000) || 0.56;
    if (heightOpt) dimensions.height = heightOpt.meta?.height || (heightOpt.value / 1000) || 0.85;
    if (depthOpt) dimensions.depth = depthOpt.meta?.depth || 0.75;

    const configData = { configuration, product, pricing, referenceCode, dimensions };
    const startTime = Date.now();

    // Generate all formats
    const csvContent = generateCSV(configData);
    const jsonContent = generateJSON(configData);
    const txtContent = generateTextSpec(configData);

    const generationTime = Date.now() - startTime;

    // Upload files
    const baseFileName = `Boscotek_${product.id}_${referenceCode}_CFG${configId}_LEAD${leadId || 'NONE'}`;
    const basePath = `${new Date().getFullYear()}/${new Date().getMonth() + 1}`;

    // Upload CSV
    const csvPath = `${basePath}/${baseFileName}.csv`;
    await supabaseClient.storage.from('bim-exports').upload(csvPath, csvContent, { contentType: 'text/csv' });
    const { data: csvUrl } = await supabaseClient.storage.from('bim-exports').createSignedUrl(csvPath, 3600);

    // Upload JSON
    const jsonPath = `${basePath}/${baseFileName}.json`;
    await supabaseClient.storage.from('bim-exports').upload(jsonPath, jsonContent, { contentType: 'application/json' });
    const { data: jsonUrl } = await supabaseClient.storage.from('bim-exports').createSignedUrl(jsonPath, 3600);

    // Upload TXT spec
    const txtPath = `${basePath}/${baseFileName}.txt`;
    await supabaseClient.storage.from('bim-exports').upload(txtPath, txtContent, { contentType: 'text/plain' });
    const { data: txtUrl } = await supabaseClient.storage.from('bim-exports').createSignedUrl(txtPath, 3600);

    // Save export record
    const { data: exportData, error: exportError } = await supabaseClient
      .from('bim_exports')
      .insert([{
        lead_id: leadId || null,
        config_id: configId,
        csv_export_url: csvUrl?.signedUrl,
        json_export_url: jsonUrl?.signedUrl,
        data_export_url: txtUrl?.signedUrl,
        export_type: 'DATA',
        file_size_bytes: new TextEncoder().encode(csvContent + jsonContent + txtContent).length,
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
        dataUrls: {
          csv: csvUrl?.signedUrl,
          json: jsonUrl?.signedUrl,
          txt: txtUrl?.signedUrl
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error generating data export:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
