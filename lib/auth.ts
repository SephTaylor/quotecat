// lib/auth.ts
// Authentication service using Supabase

import { supabase } from "./supabase";
import { activateProTier, activatePremiumTier, deactivateProTier, signOutUser } from "./user";
import { syncQuotes, hasMigrated, migrateLocalQuotesToCloud } from "./quotesSync";
import { syncClients, migrateLocalClientsToCloud } from "./clientsSync";
import { syncInvoices, hasInvoicesMigrated, migrateLocalInvoicesToCloud } from "./invoicesSync";
import { syncPricebook } from "./pricebookSync";
import { syncAssemblies, hasAssembliesMigrated, migrateLocalAssembliesToCloud } from "./assembliesSync";
import { syncBusinessSettings, downloadBusinessSettings } from "./businessSettingsSync";
import { markSyncComplete } from "./syncState";

// Re-export auth utilities for backwards compatibility
export { isAuthenticated, getCurrentUserEmail, getCurrentUserId } from "./authUtils";

// Track if we've set up the auth listener
let authListenerSetup = false;

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
 * OPTIMIZED: Sync runs in background, doesn't block app startup
 */
export async function initializeAuth(): Promise<void> {
  // Set up auth state listener (only once)
  if (!authListenerSetup) {
    authListenerSetup = true;
    supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔐 Auth state changed:", event);
      if (event === "SIGNED_IN" && session?.user) {
        // User just logged in - run sync
        handleAuthChange(session.user.id).catch(error => {
          console.error("Auth change handler failed:", error);
        });
      } else if (event === "SIGNED_OUT") {
        // User logged out
        deactivateProTier().catch(console.error);
      }
    });
  }

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

          // Run sync in BACKGROUND - don't block app startup
          // This is the key optimization for fast launches
          runBackgroundSync().catch(error => {
            console.error("Background sync failed:", error);
          });
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

/**
 * Handle auth state change (user logged in)
 * This is called by the auth listener when SIGNED_IN event fires
 */
async function handleAuthChange(userId: string): Promise<void> {
  console.log("🔐 Handling auth change for user:", userId);

  // Fetch their profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, email")
    .eq("id", userId)
    .single();

  if (profile) {
    const isPaidTier = profile.tier === "pro" || profile.tier === "premium";

    if (isPaidTier) {
      if (profile.tier === "premium") {
        await activatePremiumTier(profile.email);
      } else {
        await activateProTier(profile.email);
      }

      // Run sync in background
      runBackgroundSync().catch(error => {
        console.error("Background sync failed:", error);
      });
    } else {
      await deactivateProTier();
    }
  }
}

/**
 * Run sync operations in background
 * Called after auth is established, doesn't block UI
 * IMPORTANT: All operations run SEQUENTIALLY with GC breaks to prevent OOM
 */
async function runBackgroundSync(): Promise<void> {
  // Minimal delay to let UI render before sync starts
  // SQLite is memory-efficient so we can start almost immediately
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log("📡 Starting background sync...");

  // Helper for GC breaks between heavy operations
  // Reduced from 500ms since SQLite is much lighter than AsyncStorage
  const gcBreak = () => new Promise(resolve => setTimeout(resolve, 50));

  // Auto-migrate if needed (first time Pro/Premium user)
  const quotesMigrated = await hasMigrated();
  const invoicesMigrated = await hasInvoicesMigrated();

  if (!quotesMigrated) {
    try {
      console.log("🔄 Auto-migrating quotes to cloud...");
      await migrateLocalQuotesToCloud();
      await gcBreak();
    } catch (error) {
      console.error("❌ Quotes migration failed:", error);
    }
  }
  if (!invoicesMigrated) {
    try {
      console.log("🔄 Auto-migrating invoices to cloud...");
      await migrateLocalInvoicesToCloud();
      await gcBreak();
    } catch (error) {
      console.error("❌ Invoices migration failed:", error);
    }
  }
  try {
    await migrateLocalClientsToCloud();
    await gcBreak();
  } catch (error) {
    console.error("❌ Clients migration failed:", error);
  }

  // Migrate assemblies if needed
  const assembliesMigrated = await hasAssembliesMigrated();
  if (!assembliesMigrated) {
    try {
      console.log("🔄 Auto-migrating assemblies to cloud...");
      await migrateLocalAssembliesToCloud();
      await gcBreak();
    } catch (error) {
      console.error("❌ Assemblies migration failed:", error);
    }
  }

  // Sync all data - each sync is isolated with GC breaks
  try {
    await syncQuotes();
    await gcBreak();
  } catch (error) {
    console.error("❌ Quotes sync failed:", error);
  }

  try {
    await syncInvoices();
    await gcBreak();
  } catch (error) {
    console.error("❌ Invoices sync failed:", error);
  }

  try {
    await syncClients();
    await gcBreak();
  } catch (error) {
    console.error("❌ Clients sync failed:", error);
  }

  // Sync assemblies for Pro/Premium users
  try {
    await syncAssemblies();
    await gcBreak();
  } catch (error) {
    console.error("❌ Assemblies sync failed:", error);
  }

  // Sync pricebook for Premium users
  try {
    await syncPricebook();
    await gcBreak();
  } catch (error) {
    console.error("❌ Pricebook sync failed:", error);
  }

  // Sync business settings (company info, logo, preferences) for Pro+ users
  // Download first (to get settings from other devices), then upload local changes
  try {
    await downloadBusinessSettings();
  } catch (error) {
    console.error("❌ Business settings download failed:", error);
  }

  try {
    await syncBusinessSettings();
  } catch (error) {
    console.error("❌ Business settings sync failed:", error);
  }

  // Mark sync as complete so UI components know to refresh
  markSyncComplete();
  console.log("✅ Background sync complete");
}
