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

type QuotePayload = {
  customer: unknown;
  items: unknown;
  totals: Totals;
};

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: QuotePayload = await req.json();

    if (!body?.customer || !body?.items || !body?.totals) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Generate reference using DB helper
    const { data: refData, error: refError } = await supabase.rpc("next_quote_reference");
    if (refError || !refData) {
      console.error("Reference generation failed:", refError);
      return new Response(JSON.stringify({ error: refError?.message || "Ref generation failed" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const newQuote = {
      reference: refData as string,
      status: "new",
      customer_data: body.customer,
      items_data: body.items,
      totals: body.totals,
    };

    const { data, error } = await supabase.from("quotes").insert(newQuote).select().single();
    if (error) {
      console.error("Quote insert failed:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

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

