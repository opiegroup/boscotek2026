import { supabase } from './supabaseClient';
import { CustomerDetails, QuoteLineItem } from '../types';

type Totals = { subtotal: number; gst: number; total: number };

export type SubmitQuoteResponse = {
  id: string;
  reference: string;
  created_at: string;
  status: string;
  customer_data: any;
  items_data: any;
  totals: Totals;
};

export const submitQuoteFunction = async (
  customer: CustomerDetails,
  items: QuoteLineItem[],
  totals: Totals
) => {
  return supabase.functions.invoke<SubmitQuoteResponse>('submit-quote', {
    body: { customer, items, totals }
  });
};

