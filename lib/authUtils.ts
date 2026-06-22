// lib/authUtils.ts
// Simple auth utilities without sync dependencies
// This breaks circular dependencies between auth.ts and sync modules

import { supabase } from "./supabase";

/**
 * Check if user is currently authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/**
 * Get current user's email
 */
export async function getCurrentUserEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email || null;
}

/**
 * Get current user's ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}

/**
 * Ensure a profile exists for the given user (creates one if missing).
 * Used after OAuth sign-in since profiles aren't created automatically.
 *
 * Returns true if a NEW profile was inserted (i.e. this is a first-time
 * signup), false if an existing profile was found (returning user). The
 * boolean lets analytics callers fire signup_completed only on the genuine
 * first-account creation, not on every OAuth sign-in.
 */
export async function ensureProfileExists(user: { id: string; email?: string | null }): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    await supabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      tier: "free",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return true;
  }
  return false;
}
