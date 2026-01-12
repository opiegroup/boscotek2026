import { supabase } from './supabaseClient';
import { CustomerDetails, QuoteLineItem } from '../types';

type Totals = { subtotal: number; gst: number; total: number };

export type EmailSettings = {
  testMode: boolean;
  testEmail: string;
  sendToCustomer: boolean;
  sendToMarketing: boolean;
  sendToOpieGroupSales: boolean;
  sendToBoscotekSales: boolean;
};

export type SubmitQuoteResponse = {
  id: string;
  reference: string;
  created_at: string;
  status: string;
  customer_data: any;
  items_data: any;
  totals: Totals;
};

// Get email settings from localStorage
export const getEmailSettings = (): EmailSettings => {
  const defaults: EmailSettings = {
    testMode: false,
    testEmail: '',
    sendToCustomer: true,
    sendToMarketing: true,
    sendToOpieGroupSales: true,
    sendToBoscotekSales: true
  };
  
  try {
    const saved = localStorage.getItem('boscotek_email_settings');
    if (saved) {
      return { ...defaults, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load email settings', e);
  }
  return defaults;
};

export const submitQuoteFunction = async (
  customer: CustomerDetails,
  items: QuoteLineItem[],
  totals: Totals,
  brandId?: string
) => {
  // Include email settings from localStorage
  const emailSettings = getEmailSettings();
  
  return supabase.functions.invoke<SubmitQuoteResponse>('submit-quote', {
    body: { 
      customer, 
      items, 
      totals, 
      emailSettings,
      brand_id: brandId 
    }
  });
};

