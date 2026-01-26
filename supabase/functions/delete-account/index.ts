// supabase/functions/delete-account/index.ts
// Deletes a user's account and all associated data
// Called from the mobile app when user requests account deletion

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // Get the user's JWT from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with the user's JWT to verify identity
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`🗑️ Starting account deletion for user: ${userId}`);

    // Create admin client to bypass RLS and delete user
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const results = {
      stripe_subscriptions_cancelled: 0,
      quotes: 0,
      invoices: 0,
      clients: 0,
      contracts: 0,
      assemblies: 0,
      pricebook_items: 0,
      team_tech_accounts: 0,
      profile: false,
      auth: false,
      errors: [] as string[],
    };

    // Step 1: Cancel Stripe subscriptions if user has a customer ID
    try {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", userId)
        .single();

      if (profile?.stripe_customer_id && STRIPE_SECRET_KEY) {
        console.log(`💳 Found Stripe customer: ${profile.stripe_customer_id}`);

        // Get all active subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: "active",
        });

        // Cancel each subscription
        for (const subscription of subscriptions.data) {
          try {
            await stripe.subscriptions.cancel(subscription.id);
            results.stripe_subscriptions_cancelled++;
            console.log(`✅ Cancelled subscription: ${subscription.id}`);
          } catch (e) {
            console.error(`Failed to cancel subscription ${subscription.id}:`, e.message);
            results.errors.push(`Stripe subscription ${subscription.id}: ${e.message}`);
          }
        }

        // Also cancel any subscriptions in "trialing" or "past_due" status
        const otherSubscriptions = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
        });

        for (const subscription of otherSubscriptions.data) {
          if (subscription.status !== "canceled" && subscription.status !== "active") {
            try {
              await stripe.subscriptions.cancel(subscription.id);
              results.stripe_subscriptions_cancelled++;
              console.log(`✅ Cancelled subscription: ${subscription.id}`);
            } catch (e) {
              // Ignore errors for already cancelled subs
            }
          }
        }
      }
    } catch (e) {
      console.error("Stripe cancellation error:", e.message);
      results.errors.push(`Stripe: ${e.message}`);
    }

    // Delete quotes (including soft-deleted)
    try {
      const { data, error } = await adminClient
        .from("quotes")
        .delete()
        .eq("user_id", userId)
        .select("id");
      if (error) results.errors.push(`Quotes: ${error.message}`);
      else results.quotes = data?.length || 0;
    } catch (e) {
      results.errors.push(`Quotes: ${e.message}`);
    }

    // Delete invoices
    try {
      const { data, error } = await adminClient
        .from("invoices")
        .delete()
        .eq("user_id", userId)
        .select("id");
      if (error) results.errors.push(`Invoices: ${error.message}`);
      else results.invoices = data?.length || 0;
    } catch (e) {
      results.errors.push(`Invoices: ${e.message}`);
    }

    // Delete clients
    try {
      const { data, error } = await adminClient
        .from("clients")
        .delete()
        .eq("user_id", userId)
        .select("id");
      if (error) results.errors.push(`Clients: ${error.message}`);
      else results.clients = data?.length || 0;
    } catch (e) {
      results.errors.push(`Clients: ${e.message}`);
    }

    // Delete contracts
    try {
      const { data, error } = await adminClient
        .from("contracts")
        .delete()
        .eq("user_id", userId)
        .select("id");
      if (error) results.errors.push(`Contracts: ${error.message}`);
      else results.contracts = data?.length || 0;
    } catch (e) {
      results.errors.push(`Contracts: ${e.message}`);
    }

    // Delete assemblies
    try {
      const { data, error } = await adminClient
        .from("assemblies")
        .delete()
        .eq("user_id", userId)
        .select("id");
      if (error) results.errors.push(`Assemblies: ${error.message}`);
      else results.assemblies = data?.length || 0;
    } catch (e) {
      results.errors.push(`Assemblies: ${e.message}`);
    }

    // Delete pricebook items
    try {
      const { data, error } = await adminClient
        .from("pricebook_items")
        .delete()
        .eq("user_id", userId)
        .select("id");
      if (error) results.errors.push(`Pricebook: ${error.message}`);
      else results.pricebook_items = data?.length || 0;
    } catch (e) {
      results.errors.push(`Pricebook: ${e.message}`);
    }

    // Delete team tech accounts (where user is owner)
    try {
      const { data, error } = await adminClient
        .from("team_tech_accounts")
        .delete()
        .eq("owner_id", userId)
        .select("id");
      if (error) results.errors.push(`Team accounts: ${error.message}`);
      else results.team_tech_accounts = data?.length || 0;
    } catch (e) {
      results.errors.push(`Team accounts: ${e.message}`);
    }

    // Delete profile
    try {
      const { error } = await adminClient
        .from("profiles")
        .delete()
        .eq("id", userId);
      if (error) results.errors.push(`Profile: ${error.message}`);
      else results.profile = true;
    } catch (e) {
      results.errors.push(`Profile: ${e.message}`);
    }

    // Finally, delete the auth user
    try {
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) results.errors.push(`Auth: ${error.message}`);
      else results.auth = true;
    } catch (e) {
      results.errors.push(`Auth: ${e.message}`);
    }

    const success = results.auth && results.errors.length === 0;
    console.log(`🗑️ Account deletion ${success ? "complete" : "partial"} for user: ${userId}`);
    console.log("Results:", JSON.stringify(results));

    return new Response(
      JSON.stringify({
        success,
        message: success
          ? "Account deleted successfully"
          : "Account deletion completed with some errors",
        details: results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: success ? 200 : 207,
      }
    );
  } catch (error) {
    console.error("Account deletion failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
