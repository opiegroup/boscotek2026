import { createClient } from "npm:@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set for the function environment.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

type Product = {
  id: string;
  name: string;
  basePrice: number;
  data: unknown;
};

type Interior = {
  id: string;
  type: string;
  price: number;
  data: unknown;
};

export const handler = async (req: Request): Promise<Response> => {
  try {
    const { products, interiors } = await req.json();

    if (!Array.isArray(products) || !Array.isArray(interiors)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload. Expect { products: [], interiors: [] }" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Upsert products
    const productPayload = products.map((p: Product) => ({
      id: p.id,
      name: p.name,
      base_price: p.basePrice ?? 0,
      data: p.data ?? p,
    }));

    const { error: prodError } = await supabase
      .from("products")
      .upsert(productPayload, { onConflict: "id" });

    if (prodError) {
      console.error("Product upsert error:", prodError);
      return new Response(JSON.stringify({ error: prodError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Upsert interiors
    const interiorPayload = interiors.map((i: Interior) => ({
      id: i.id,
      type: i.type,
      price: i.price ?? 0,
      data: i.data ?? i,
    }));

    const { error: intError } = await supabase
      .from("drawer_interiors")
      .upsert(interiorPayload, { onConflict: "id" });

    if (intError) {
      console.error("Interior upsert error:", intError);
      return new Response(JSON.stringify({ error: intError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Unhandled seed error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// Supabase Edge runtime entrypoint
if (import.meta.main) {
  Deno.serve(handler);
}

