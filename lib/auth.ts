// lib/auth.ts
// Authentication service using Supabase

import { supabase } from "./supabase";
import { activateProTier, activatePremiumTier, deactivateProTier, signOutUser } from "./user";
import { syncQuotes, hasMigrated, migrateLocalQuotesToCloud } from "./quotesSync";
import { syncClients, migrateLocalClientsToCloud } from "./clientsSync";
import { syncInvoices, hasInvoicesMigrated, migrateLocalInvoicesToCloud } from "./invoicesSync";

// Re-export auth utilities for backwards compatibility
export { isAuthenticated, getCurrentUserEmail, getCurrentUserId } from "./authUtils";

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await signOutUser(); // Clear local user state
}

/**
 * Initialize auth - check session and sync user state
 * Call this on app launch
 */
export async function initializeAuth(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();

    if (data.session?.user) {
      // User is authenticated, fetch their profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier, email")
        .eq("id", data.session.user.id)
        .single();

      if (profile) {
        // Sync local user state with Supabase
        const isPaidTier = profile.tier === "pro" || profile.tier === "premium";

        if (isPaidTier) {
          // Set the correct tier based on profile
          if (profile.tier === "premium") {
            await activatePremiumTier(profile.email);
          } else {
            await activateProTier(profile.email);
          }

          // Auto-migrate if needed (first time Pro/Premium user)
          const quotesMigrated = await hasMigrated();
          const invoicesMigrated = await hasInvoicesMigrated();

          if (!quotesMigrated) {
            console.log("🔄 Auto-migrating quotes to cloud...");
            await migrateLocalQuotesToCloud();
          }
          if (!invoicesMigrated) {
            console.log("🔄 Auto-migrating invoices to cloud...");
            await migrateLocalInvoicesToCloud();
          }
          console.log("🔄 Auto-migrating clients to cloud...");
          await migrateLocalClientsToCloud();

          // Sync all data
          console.log("🔄 Syncing quotes...");
          await syncQuotes();
          console.log("🔄 Syncing invoices...");
          await syncInvoices();
          console.log("🔄 Syncing clients...");
          await syncClients();
        } else {
          await deactivateProTier();
        }
      }
    } else {
      // No session, ensure user is set to free tier
      await deactivateProTier();
    }
  } catch (error) {
    console.error("Auth initialization error:", error);
    // On error, default to free tier
    await deactivateProTier();
  }
}
