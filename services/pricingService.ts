import { ConfigurationState, PricingResult } from '../types';
import { supabase } from './supabaseClient';
import { calculateQuote } from './mockBackend';

/**
 * Pricing Service
 * 
 * Calls the server-side calculate-price Edge Function for secure pricing.
 * Falls back to local calculation if Edge Function is unavailable.
 * 
 * Role-based pricing:
 * - Public: sees retail price
 * - Distributor: sees their tier-discounted price
 * - Staff: sees retail, cost, margin, discount details
 */

// Extended response type for staff users
export interface ExtendedPricingResult extends PricingResult {
  retailPrice?: number;
  cost?: number;
  margin?: number;
  discountApplied?: number;
  tierName?: string;
}

// Flag to enable/disable Edge Function (useful for development)
const USE_EDGE_FUNCTION = true;

export const getQuote = async (config: ConfigurationState): Promise<PricingResult> => {
  // If Edge Function is disabled or config is missing productId, use local calculation
  if (!USE_EDGE_FUNCTION || !config.productId) {
    return calculateQuoteLocally(config);
  }

  try {
    // Get current session for auth token
    const { data: { session } } = await supabase.auth.getSession();
    
    // Build request payload
    const payload = {
      productId: config.productId,
      selections: config.selections,
      customDrawers: config.customDrawers,
      embeddedCabinets: config.embeddedCabinets,
    };

    // Call Edge Function
    const { data, error } = await supabase.functions.invoke('calculate-price', {
      body: payload,
      headers: session?.access_token 
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    });

    if (error) {
      console.warn('Edge Function error, falling back to local calculation:', error);
      return calculateQuoteLocally(config);
    }

    // Return the server response
    return data as PricingResult;

  } catch (err) {
    console.warn('Failed to call pricing Edge Function, using local fallback:', err);
    return calculateQuoteLocally(config);
  }
};

// Extended quote for staff users (includes cost/margin data)
export const getQuoteExtended = async (config: ConfigurationState): Promise<ExtendedPricingResult> => {
  const result = await getQuote(config);
  return result as ExtendedPricingResult;
};

// Local fallback calculation (uses mockBackend)
const calculateQuoteLocally = async (config: ConfigurationState): Promise<PricingResult> => {
  const result = await calculateQuote({
    productId: config.productId,
    selections: config.selections,
    customDrawers: config.customDrawers,
    embeddedCabinets: config.embeddedCabinets,
    customerType: 'RETAIL',
  });
  
  return result;
};
