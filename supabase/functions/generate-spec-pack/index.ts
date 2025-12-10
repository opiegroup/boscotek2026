import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate complete specification pack
 * This calls the IFC and Data export functions, then combines the URLs
 */
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

    const startTime = Date.now();
    const urls: any = {};

    // Call IFC generation
    try {
      const ifcResponse = await supabaseClient.functions.invoke('generate-ifc', {
        body: { configId, leadId, configuration, product, pricing, referenceCode }
      });
      
      if (ifcResponse.data) {
        urls.ifc = ifcResponse.data.ifcUrl;
      }
    } catch (err) {
      console.error('Error generating IFC:', err);
    }

    // Call Data export generation
    try {
      const dataResponse = await supabaseClient.functions.invoke('generate-data-export', {
        body: { configId, leadId, configuration, product, pricing, referenceCode }
      });
      
      if (dataResponse.data) {
        urls.data = dataResponse.data.dataUrls;
      }
    } catch (err) {
      console.error('Error generating data export:', err);
    }

    const generationTime = Date.now() - startTime;

    // Save combined export record
    const { data: exportData, error: exportError } = await supabaseClient
      .from('bim_exports')
      .insert([{
        lead_id: leadId || null,
        config_id: configId,
        ifc_url: urls.ifc,
        csv_export_url: urls.data?.csv,
        json_export_url: urls.data?.json,
        data_export_url: urls.data?.txt,
        export_type: 'SPEC_PACK',
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
        specPackUrl: urls,
        ifcUrl: urls.ifc,
        dataUrls: urls.data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error generating spec pack:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
