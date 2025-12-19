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
