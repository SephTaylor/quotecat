// lib/auth.ts
// Authentication service using Supabase

import { supabase } from "./supabase";
import { activateProTier, deactivateProTier, signOutUser } from "./user";
// Dynamic imports to avoid circular dependency with quotesSync

/**
 * Check if user is currently authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch (error) {
    // If Supabase client is broken (missing env vars), treat as not authenticated
    console.warn("Failed to check authentication:", error);
    return false;
  }
}

/**
 * Get current user's email
 */
export async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.email || null;
  } catch (error) {
    // If Supabase client is broken (missing env vars), treat as not authenticated
    console.warn("Failed to get current user email:", error);
    return null;
  }
}

/**
 * Get current user's ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id || null;
  } catch (error) {
    // If Supabase client is broken (missing env vars), treat as not authenticated
    console.warn("Failed to get current user ID:", error);
    return null;
  }
}

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
          await activateProTier(profile.email);

          // Auto-migrate if needed (first time Pro/Premium user)
          // Use dynamic import to avoid circular dependency
          const { hasMigrated, migrateLocalQuotesToCloud, syncQuotes } = await import("./quotesSync");
          const migrated = await hasMigrated();
          if (!migrated) {
            console.log("🔄 Auto-migrating quotes to cloud...");
            await migrateLocalQuotesToCloud();
          } else {
            // Already migrated, just sync
            console.log("🔄 Syncing quotes...");
            await syncQuotes();
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
