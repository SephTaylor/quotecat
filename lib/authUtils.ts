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
 * Ensure a profile exists for the given user (creates one if missing)
 * Used after OAuth sign-in since profiles aren't created automatically
 */
export async function ensureProfileExists(user: { id: string; email?: string | null }): Promise<void> {
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
  }
}
