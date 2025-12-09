
import { ConfigurationState, PricingResult } from '../types';
import { calculateQuote } from './mockBackend';

// This service now acts as a client-side wrapper for the backend API
// In a real app, this would use fetch('/api/quote', ...)

export const getQuote = async (config: ConfigurationState): Promise<PricingResult> => {
  // Simulate network delay for realism if desired, or call directly for speed in this demo
  const result = await calculateQuote({
    productId: config.productId,
    selections: config.selections,
    customDrawers: config.customDrawers,
    customerType: 'RETAIL' 
  });
  
  return result;
};
