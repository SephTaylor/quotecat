// supabase/functions/cleanup-deleted/index.ts
// Cleanup job that hard-deletes soft-deleted records older than 30 days
// Run via cron: supabase functions deploy cleanup-deleted --schedule "0 3 * * *" (3am daily)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// How many days before we permanently delete soft-deleted records
const RETENTION_DAYS = 30;

Deno.serve(async (req) => {
  // Only allow POST requests (for cron) or GET with secret for manual trigger
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Create admin client (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calculate cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`🧹 Cleaning up records deleted before ${cutoffISO}`);

    const results = {
      quotes: 0,
      invoices: 0,
      clients: 0,
      errors: [] as string[],
    };

    // Delete old quotes
    try {
      const { data: deletedQuotes, error } = await supabase
        .from("quotes")
        .delete()
        .not("deleted_at", "is", null)
        .lt("deleted_at", cutoffISO)
        .select("id");

      if (error) {
        results.errors.push(`Quotes: ${error.message}`);
      } else {
        results.quotes = deletedQuotes?.length || 0;
        console.log(`✅ Deleted ${results.quotes} old quotes`);
      }
    } catch (e) {
      results.errors.push(`Quotes: ${e.message}`);
    }

    // Delete old invoices
    try {
      const { data: deletedInvoices, error } = await supabase
        .from("invoices")
        .delete()
        .not("deleted_at", "is", null)
        .lt("deleted_at", cutoffISO)
        .select("id");

      if (error) {
        results.errors.push(`Invoices: ${error.message}`);
      } else {
        results.invoices = deletedInvoices?.length || 0;
        console.log(`✅ Deleted ${results.invoices} old invoices`);
      }
    } catch (e) {
      results.errors.push(`Invoices: ${e.message}`);
    }

    // Delete old clients
    try {
      const { data: deletedClients, error } = await supabase
        .from("clients")
        .delete()
        .not("deleted_at", "is", null)
        .lt("deleted_at", cutoffISO)
        .select("id");

      if (error) {
        results.errors.push(`Clients: ${error.message}`);
      } else {
        results.clients = deletedClients?.length || 0;
        console.log(`✅ Deleted ${results.clients} old clients`);
      }
    } catch (e) {
      results.errors.push(`Clients: ${e.message}`);
    }

    const totalDeleted = results.quotes + results.invoices + results.clients;
    const success = results.errors.length === 0;

    console.log(`🧹 Cleanup complete: ${totalDeleted} records permanently deleted`);

    return new Response(
      JSON.stringify({
        success,
        message: `Cleanup complete: ${totalDeleted} records permanently deleted`,
        details: results,
        cutoffDate: cutoffISO,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: success ? 200 : 207, // 207 = partial success
      }
    );
  } catch (error) {
    console.error("Cleanup failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
