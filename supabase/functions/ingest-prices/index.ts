// supabase/functions/ingest-prices/index.ts
// Ingests price data from supplier APIs (xByte, 1Build, etc.)
// Called manually or via scheduled job to store weekly price snapshots

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INGEST_API_KEY = Deno.env.get("INGEST_API_KEY");

interface PriceRecord {
  product_id: string;      // Must match products.id
  supplier_id: string;     // Must match suppliers.id
  location_id: string;     // Must match locations.id
  price: number;
  currency?: string;       // Default 'USD'
  effective_at?: string;   // Default NOW()
}

interface IngestPayload {
  prices: PriceRecord[];
  source?: string;         // e.g., "xbyte", "1build", "manual"
}

Deno.serve(async (req) => {
  // CORS headers for potential dashboard calls
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Content-Type": "application/json",
  };

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check - require API key
  const authHeader = req.headers.get("Authorization");
  if (!INGEST_API_KEY || authHeader !== `Bearer ${INGEST_API_KEY}`) {
    console.error("[ingest-prices] Unauthorized request");
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: corsHeaders }
    );
  }

  // Only POST allowed
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const payload: IngestPayload = await req.json();
    const { prices, source = "api" } = payload;

    // Validate payload
    if (!Array.isArray(prices) || prices.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "prices array is required and must not be empty" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate each price record
    const invalidRecords: string[] = [];
    for (let i = 0; i < prices.length; i++) {
      const p = prices[i];
      if (!p.product_id || !p.supplier_id || !p.location_id || typeof p.price !== "number") {
        invalidRecords.push(`Record ${i}: missing product_id, supplier_id, location_id, or price`);
      }
    }

    if (invalidRecords.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid records",
          details: invalidRecords.slice(0, 10) // Limit to first 10
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const weekOf = getWeekStart(now);

    // Transform for insert
    const records = prices.map((p) => ({
      product_id: p.product_id,
      supplier_id: p.supplier_id,
      location_id: p.location_id,
      price: p.price,
      currency: p.currency || "USD",
      effective_at: p.effective_at || now.toISOString(),
      week_of: weekOf,
    }));

    // Batch insert (Supabase handles batching internally for large arrays)
    const { data, error } = await supabase
      .from("product_prices")
      .insert(records)
      .select("id");

    if (error) {
      console.error("[ingest-prices] Insert failed:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          code: error.code
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const insertedCount = data?.length || records.length;
    console.log(`[ingest-prices] Ingested ${insertedCount} prices from ${source} for week ${weekOf}`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedCount,
        source,
        weekOf,
        timestamp: now.toISOString(),
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error("[ingest-prices] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error"
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

/**
 * Get the start of the week (Sunday) for a given date
 */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Move to Sunday
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}
