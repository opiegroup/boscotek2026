import { supabase } from './supabaseClient';
import { uuid } from './uuid';
import { 
  BIMLeadData, 
  BIMLead, 
  ConfigurationState, 
  ProductDefinition, 
  PricingResult,
  ConfigurationRecord,
  ExportRequest,
  ExportResponse,
  ExportType
} from '../types';

/**
 * Generate a unique geometry hash for a configuration
 * Used to detect duplicate exports and enable caching
 */
export const generateGeometryHash = (config: ConfigurationState, product: ProductDefinition): string => {
  const hashData = {
    productId: product.id,
    selections: config.selections,
    drawers: config.customDrawers,
    cabinets: config.embeddedCabinets
  };
  
  // Simple hash function (in production, use a proper hashing library)
  const str = JSON.stringify(hashData);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

/**
 * Capture lead information
 */
export const captureLead = async (leadData: BIMLeadData, configId?: string): Promise<BIMLead> => {
  const { data, error } = await supabase
    .from('bim_leads')
    .insert([{
      name: leadData.name,
      email: leadData.email,
      company: leadData.company || null,
      role: leadData.role,
      project_name: leadData.projectName || null,
      project_location: leadData.projectLocation || null,
      config_id: configId || null,
      consent: leadData.consent,
      session_id: sessionStorage.getItem('session_id') || uuid(),
      user_agent: navigator.userAgent
    }])
    .select()
    .single();

  if (error) {
    console.error('❌ Error capturing lead:', error);
    console.error('   Error details:', {
      message: error.message,
      code: error.code,
      hint: error.hint,
      details: error.details
    });
    throw new Error(`Failed to capture lead: ${error.message} (code: ${error.code})`);
  }

  // Track analytics event
  await trackExportEvent('lead_captured', data.id, configId, leadData.role);

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    company: data.company,
    role: data.role as any,
    projectName: data.project_name,
    projectLocation: data.project_location,
    configId: data.config_id,
    timestamp: data.timestamp,
    ipAddress: data.ip_address,
    sessionId: data.session_id,
    userAgent: data.user_agent,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    consent: data.consent
  };
};

/**
 * Save configuration to database
 */
export const saveConfiguration = async (
  config: ConfigurationState,
  product: ProductDefinition,
  pricing: PricingResult,
  referenceCode: string,
  leadId?: string
): Promise<ConfigurationRecord> => {
  const geometryHash = generateGeometryHash(config, product);
  
  // Extract dimensions
  const dimensions = {
    width: 0,
    height: 0,
    depth: 0
  };
  
  // Get dimensions from selections
  const widthOpt = product.groups.find(g => g.id === 'width' || g.id === 'size')?.options.find(o => o.id === config.selections['width'] || o.id === config.selections['size']);
  const heightOpt = product.groups.find(g => g.id === 'height' || g.id === 'bench_height')?.options.find(o => o.id === config.selections['height'] || o.id === config.selections['bench_height']);
  const depthOpt = product.groups.find(g => g.id === 'series')?.options.find(o => o.id === config.selections['series']);
  
  dimensions.width = widthOpt?.meta?.width || (widthOpt?.value as number) / 1000 || 0;
  dimensions.height = heightOpt?.meta?.height || (heightOpt?.value as number) / 1000 || 0;
  dimensions.depth = depthOpt?.meta?.depth || 0;

  const { data, error } = await supabase
    .from('configurations')
    .insert([{
      product_type: product.id,
      dimensions_json: dimensions,
      drawer_stack_json: config.customDrawers || null,
      partition_data_json: null, // TODO: Extract partition data
      accessories_json: config.embeddedCabinets || null,
      colour_options_json: {
        frame: config.selections['color'] || config.selections['housing_color'],
        facia: config.selections['drawer_facia'] || config.selections['facia_color']
      },
      price_json: pricing,
      full_config_json: config,
      reference_code: referenceCode,
      geometry_hash: geometryHash,
      lead_id: leadId || null
    }])
    .select()
    .single();

  if (error) {
    console.error('❌ Error saving configuration:', error);
    console.error('   Error details:', {
      message: error.message,
      code: error.code,
      hint: error.hint,
      details: error.details
    });
    throw new Error(`Failed to save configuration: ${error.message} (code: ${error.code})`);
  }

  // Track analytics event
  await trackExportEvent('configuration_saved', leadId, data.id, product.id);

  return {
    id: data.id,
    productType: data.product_type,
    dimensionsJson: data.dimensions_json,
    drawerStackJson: data.drawer_stack_json,
    partitionDataJson: data.partition_data_json,
    accessoriesJson: data.accessories_json,
    colourOptionsJson: data.colour_options_json,
    priceJson: data.price_json,
    fullConfigJson: data.full_config_json,
    referenceCode: data.reference_code,
    geometryHash: data.geometry_hash,
    leadId: data.lead_id,
    timestamp: data.timestamp,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
};

/**
 * Track export analytics event
 */
export const trackExportEvent = async (
  eventType: string,
  leadId?: string,
  configId?: string,
  metadata?: any
): Promise<void> => {
  try {
    await supabase.from('export_analytics').insert([{
      event_type: eventType,
      lead_id: leadId || null,
      config_id: configId || null,
      product_type: metadata,
      session_id: sessionStorage.getItem('session_id') || uuid(),
      user_agent: navigator.userAgent,
      metadata: typeof metadata === 'object' ? metadata : { value: metadata }
    }]);
  } catch (error) {
    console.error('Error tracking analytics:', error);
    // Don't throw - analytics should not block the main flow
  }
};

/**
 * Generate exports client-side (temporary until backend is deployed)
 */
const generateClientSideExports = (exportRequest: ExportRequest) => {
  const { configuration, product, pricing, referenceCode } = exportRequest;
  
  // Generate CSV
  const csvContent = generateCSV(configuration, product, pricing, referenceCode);
  const csvBlob = new Blob([csvContent], { type: 'text/csv' });
  const csvUrl = URL.createObjectURL(csvBlob);
  
  // Generate JSON
  const jsonContent = generateJSON(configuration, product, pricing, referenceCode);
  const jsonBlob = new Blob([jsonContent], { type: 'application/json' });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  
  // Generate TXT
  const txtContent = generateTXT(configuration, product, pricing, referenceCode);
  const txtBlob = new Blob([txtContent], { type: 'text/plain' });
  const txtUrl = URL.createObjectURL(txtBlob);
  
  return { csvUrl, jsonUrl, txtUrl };
};

const generateCSV = (config: any, product: any, pricing: any, refCode: string): string => {
  const rows = ['Category,Field,Value'];
  rows.push(`Product,Family,${product.name}`);
  rows.push(`Product,Code,${refCode}`);
  rows.push(`Product,Manufacturer,Boscotek`);
  Object.entries(config.selections || {}).forEach(([key, value]) => {
    if (value) rows.push(`Configuration,${key},${value}`);
  });
  if (pricing) {
    rows.push(`Pricing,Total Ex GST,$${pricing.totalPrice}`);
    rows.push(`Pricing,GST,$${pricing.gst}`);
    rows.push(`Pricing,Total Inc GST,$${pricing.totalWithGst}`);
  }
  return rows.join('\n');
};

const generateJSON = (config: any, product: any, pricing: any, refCode: string): string => {
  return JSON.stringify({
    configurationCode: refCode,
    product: { id: product.id, name: product.name },
    configuration: config,
    pricing: pricing,
    exportDate: new Date().toISOString()
  }, null, 2);
};

const generateTXT = (config: any, product: any, pricing: any, refCode: string): string => {
  let txt = '═══════════════════════════════════════\n';
  txt += '    BOSCOTEK SPECIFICATION\n';
  txt += '═══════════════════════════════════════\n\n';
  txt += `Product: ${product.name}\n`;
  txt += `Code: ${refCode}\n`;
  txt += `Date: ${new Date().toLocaleDateString()}\n\n`;
  if (pricing) {
    txt += `Total (Ex GST): $${pricing.totalPrice}\n`;
    txt += `Total (Inc GST): $${pricing.totalWithGst}\n`;
  }
  return txt;
};

/**
 * Request BIM/Data export
 * Calls the backend Edge Function to generate files
 */
export const requestExport = async (
  exportRequest: ExportRequest
): Promise<ExportResponse> => {
  try {
    // TRY BACKEND FIRST
    try {
      // First, capture lead if provided
      let leadId: string | undefined;
      if (exportRequest.lead) {
        const lead = await captureLead(exportRequest.lead);
        leadId = lead.id;
      }

      // Save configuration
      const configRecord = await saveConfiguration(
        exportRequest.configuration,
        exportRequest.product,
        exportRequest.pricing,
        exportRequest.referenceCode,
        leadId
      );

      // Call the appropriate Edge Function based on export type
      const functionName = exportRequest.exportType === 'IFC' 
        ? 'generate-ifc' 
        : exportRequest.exportType === 'DATA'
        ? 'generate-data-export'
        : exportRequest.exportType === 'OBJ'
        ? 'generate-obj'
        : exportRequest.exportType === 'BLENDER_SCRIPT'
        ? 'generate-blender-script'
        : 'generate-spec-pack';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          configId: configRecord.id,
          leadId: leadId,
          configuration: exportRequest.configuration,
          product: exportRequest.product,
          pricing: exportRequest.pricing,
          referenceCode: exportRequest.referenceCode
        }
      });

      if (error) throw error;

      // Track successful export
      await trackExportEvent(`export_${exportRequest.exportType.toLowerCase()}`, leadId, configRecord.id, {
        productType: exportRequest.product.id,
        exportType: exportRequest.exportType
      });

      return {
        success: true,
        exportId: data.exportId,
        ifcUrl: data.ifcUrl,
        objUrl: data.objUrl,
        mtlUrl: data.mtlUrl,
        blenderScriptUrl: data.scriptUrl,
        dataUrls: data.dataUrls,
        specPackUrl: data.specPackUrl
      };
    } catch (backendError) {
      console.warn('Backend export failed, using client-side generation:', backendError);
      
      // FALLBACK TO CLIENT-SIDE GENERATION
      const { csvUrl, jsonUrl, txtUrl } = generateClientSideExports(exportRequest);
      
      return {
        success: true,
        dataUrls: {
          csv: csvUrl,
          json: jsonUrl,
          txt: txtUrl
        }
      };
    }

  } catch (error: any) {
    console.error('Export request failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate export'
    };
  }
};

/**
 * Check if lead was recently captured (within 24 hours)
 * Returns cached lead data if available
 */
export const getCachedLead = (): BIMLeadData | null => {
  const cachedLead = localStorage.getItem('bim_lead_data');
  const cacheTimestamp = localStorage.getItem('bim_lead_timestamp');
  
  if (!cachedLead || !cacheTimestamp) return null;
  
  const timestamp = parseInt(cacheTimestamp);
  const now = Date.now();
  const hoursSinceCapture = (now - timestamp) / (1000 * 60 * 60);
  
  // If less than 24 hours, return cached lead
  if (hoursSinceCapture < 24) {
    try {
      return JSON.parse(cachedLead) as BIMLeadData;
    } catch (err) {
      console.error('Error parsing cached lead:', err);
      return null;
    }
  }
  
  // Clear expired cache
  localStorage.removeItem('bim_lead_data');
  localStorage.removeItem('bim_lead_timestamp');
  return null;
};

/**
 * Initialize session ID for analytics tracking
 */
export const initializeSession = (): string => {
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = uuid();
    sessionStorage.setItem('session_id', sessionId);
  }
  return sessionId;
};
