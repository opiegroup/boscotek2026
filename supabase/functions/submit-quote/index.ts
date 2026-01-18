import { createClient } from "npm:@supabase/supabase-js";

// Supabase edge functions reserve SUPABASE_*; use neutral names for secrets.
const supabaseUrl = Deno.env.get("PROJECT_URL");
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set for the function environment.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json",
};

type Totals = {
  subtotal: number;
  gst: number;
  total: number;
};

type CustomerDetails = {
  name: string;
  email: string;
  company?: string;
  phone?: string;
};

type QuoteItem = {
  productName: string;
  referenceCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  configuration?: any;
};

type EmailSettings = {
  testMode?: boolean;
  testEmail?: string;
  sendToCustomer?: boolean;
  sendToMarketing?: boolean;
  sendToOpieGroupSales?: boolean;
  sendToBoscotekSales?: boolean;
};

type QuotePayload = {
  customer: CustomerDetails;
  items: QuoteItem[];
  totals: Totals;
  emailSettings?: EmailSettings;
};

// Send confirmation and notification emails via the email function
const sendQuoteEmails = async (
  quoteReference: string,
  customer: CustomerDetails,
  items: QuoteItem[],
  totals: Totals,
  emailSettings?: EmailSettings
): Promise<void> => {
  try {
    // Call the send-quote-emails edge function
    const emailPayload = {
      quoteReference,
      customer,
      items,
      totals,
      emailSettings: emailSettings || {}
    };

    // Use Supabase functions invoke for internal call
    const { error } = await supabase.functions.invoke('send-quote-emails', {
      body: emailPayload
    });

    if (error) {
      console.error("Email function error:", error);
      // Don't throw - emails are non-critical, quote was already saved
    } else {
      console.log("Quote emails triggered successfully for", quoteReference);
    }
  } catch (emailErr) {
    console.error("Failed to trigger quote emails:", emailErr);
    // Non-critical failure - quote was still saved successfully
  }
};

export const handler = async (req: Request): Promise<Response> => {
  console.log("submit-quote: Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("submit-quote: Parsing request body...");
    const body: QuotePayload = await req.json();
    console.log("submit-quote: Body parsed, customer:", body?.customer?.email);

    if (!body?.customer || !body?.items || !body?.totals) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Generate reference using DB helper
    console.log("submit-quote: Generating quote reference...");
    const { data: refData, error: refError } = await supabase.rpc("next_quote_reference");
    console.log("submit-quote: RPC result - data:", refData, "error:", refError);
    if (refError || !refData) {
      console.error("Reference generation failed:", refError);
      return new Response(JSON.stringify({ error: refError?.message || "Ref generation failed" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const quoteReference = refData as string;
    console.log("submit-quote: Quote reference generated:", quoteReference);

    const newQuote = {
      reference: quoteReference,
      status: "new",
      customer_data: body.customer,
      items_data: body.items,
      totals: body.totals,
    };

    console.log("submit-quote: Inserting quote into database...");
    const { data, error } = await supabase.from("quotes").insert(newQuote).select().single();
    console.log("submit-quote: Insert result - data:", data?.id, "error:", error);
    if (error) {
      console.error("Quote insert failed:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Trigger confirmation and notification emails (async, non-blocking)
    // Don't await - let it run in background so we can respond quickly
    sendQuoteEmails(quoteReference, body.customer, body.items, body.totals, body.emailSettings);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    console.error("Unhandled submit-quote error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

if (import.meta.main) {
  Deno.serve(handler);
}

