// lib/auth.ts
// Authentication service using Supabase

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { activateProTier, activatePremiumTier, deactivateProTier, signOutUser } from "./user";
import { syncQuotes, hasMigrated, migrateLocalQuotesToCloud } from "./quotesSync";
import { syncClients, migrateLocalClientsToCloud } from "./clientsSync";
import { syncInvoices, hasInvoicesMigrated, migrateLocalInvoicesToCloud } from "./invoicesSync";
import { syncPricebook } from "./pricebookSync";
import { syncAssemblies, hasAssembliesMigrated, migrateLocalAssembliesToCloud } from "./assembliesSync";
import { syncBusinessSettings, downloadBusinessSettings } from "./businessSettingsSync";
import { syncTeamMembers } from "./teamMembersSync";
import { markSyncComplete } from "./syncState";
import { identifyUser, logOutRevenueCat } from "./revenuecat";

// Re-export auth utilities for backwards compatibility
export { isAuthenticated, getCurrentUserEmail, getCurrentUserId } from "./authUtils";

// Track if we've set up the auth listener
let authListenerSetup = false;

// Sync consent tracking (Apple requirement: disclose download size and prompt user)
const SYNC_CONSENT_KEY = "@quotecat/syncConsent";
let pendingSyncForPaidUser = false; // True when user is Pro/Premium but hasn't consented to sync yet

/**
 * Check if user has previously consented to cloud sync
 */
export async function hasSyncConsent(): Promise<boolean> {
  try {
    const consent = await AsyncStorage.getItem(SYNC_CONSENT_KEY);
    return consent === "true";
  } catch {
    return false;
  }
}

/**
 * Store user's sync consent
 */
export async function setSyncConsent(consented: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_CONSENT_KEY, consented ? "true" : "false");
  } catch (error) {
    console.error("Failed to save sync consent:", error);
  }
}

/**
 * Check if app needs to show sync consent prompt
 * Returns true if user is Pro/Premium and hasn't consented yet
 */
export function needsSyncConsentPrompt(): boolean {
  return pendingSyncForPaidUser;
}

/**
 * Run sync after user grants consent
 * Call this from the consent modal when user taps "Sync Now"
 */
export async function runSyncWithConsent(): Promise<void> {
  await setSyncConsent(true);
  pendingSyncForPaidUser = false;
  await runBackgroundSync();
}

/**
 * Sign out current user
 * Works even when offline - clears local state regardless of network
 */
export async function signOut(): Promise<void> {
  // Try to sign out from Supabase (network call)
  // If this fails (e.g., offline), we still clear local state
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("Supabase sign out failed (offline?):", e);
  }

  // Always clear local user state, even if network failed
  await signOutUser();

  // Clear RevenueCat user identity
  try {
    await logOutRevenueCat();
  } catch (e) {
    console.error("RevenueCat logout error:", e);
  }
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
      // Link RevenueCat to this user
      try {
        await identifyUser(data.session.user.id);
      } catch (e) {
        console.error("RevenueCat identify error:", e);
      }

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

          // Check if user has consented to cloud sync (Apple requirement)
          // Must disclose download size and prompt before syncing
          const hasConsent = await hasSyncConsent();
          if (hasConsent) {
            // User previously consented - run sync in background
            runBackgroundSync().catch(error => {
              console.error("Background sync failed:", error);
            });
          } else {
            // First time Pro/Premium user - need to show consent prompt
            // UI will check needsSyncConsentPrompt() and show modal
            pendingSyncForPaidUser = true;
            console.log("📋 Sync consent needed - waiting for user prompt");
          }
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

  // Link RevenueCat to this user (for subscription sync)
  try {
    await identifyUser(userId);
  } catch (e) {
    console.error("RevenueCat identify error:", e);
  }

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

      // Check sync consent before running (Apple requirement)
      const hasConsent = await hasSyncConsent();
      if (hasConsent) {
        runBackgroundSync().catch(error => {
          console.error("Background sync failed:", error);
        });
      } else {
        pendingSyncForPaidUser = true;
        console.log("📋 Sync consent needed - waiting for user prompt");
      }
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

  // Sync team members for Premium users (used for labor tracking)
  try {
    await syncTeamMembers();
    await gcBreak();
  } catch (error) {
    console.error("❌ Team members sync failed:", error);
  }

  // Mark sync as complete so UI components know to refresh
  markSyncComplete();
  console.log("✅ Background sync complete");
}
