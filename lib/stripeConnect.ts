// lib/stripeConnect.ts
// Mobile-side wrapper around the portal's /api/stripe/connect endpoint.
//
// Why this exists: v1.2.9 adds Stripe Connect onboarding to the mobile app
// (Pro+). Stripe's Express onboarding is a web flow — we open it in an
// in-app browser sheet via WebBrowser.openAuthSessionAsync. When the
// contractor finishes (or refreshes / cancels) onboarding, Stripe redirects
// to the portal's /dashboard/settings/mobile-return page. The redirectUrl
// param on openAuthSessionAsync detects that navigation and closes the
// sheet, returning control to the Payment Collection screen.
//
// Auth: the portal /api/stripe/connect route accepts both cookie-based
// (portal/desktop) and bearer-token (mobile) auth as of v1.2.9. This module
// always uses the bearer-token path.

import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

const PORTAL_URL = "https://portal.quotecat.ai";
const RETURN_URL_PREFIX = `${PORTAL_URL}/dashboard/settings/mobile-return`;

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export interface StripeConnectStatus {
  connected: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  email?: string;
}

/**
 * Fetch the current Stripe Connect status for the signed-in user. Returns
 * `{ connected: false }` when no Stripe account exists yet. Throws on auth /
 * network failure so the caller can render an explicit error state.
 */
export async function getStripeConnectStatus(): Promise<StripeConnectStatus> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not signed in");
  }

  const res = await fetch(`${PORTAL_URL}/api/stripe/connect`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Stripe status (${res.status})`);
  }

  return (await res.json()) as StripeConnectStatus;
}

export type OnboardingResult =
  | { kind: "success" }
  | { kind: "refresh" }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

/**
 * Start (or resume) the Stripe Connect Express onboarding flow. Creates the
 * Stripe account if it doesn't exist yet, opens the onboarding URL in an
 * in-app browser sheet, and resolves when the sheet dismisses.
 *
 * The caller should re-fetch `getStripeConnectStatus()` after this resolves
 * to read the actual onboarding state — the result here only tells you HOW
 * the sheet closed (Stripe returned success / refresh / user dismissed),
 * not whether Stripe has actually verified the account (that arrives later
 * via the account.updated webhook → profiles.stripe_charges_enabled).
 */
export async function startStripeOnboarding(): Promise<OnboardingResult> {
  const token = await getAccessToken();
  if (!token) {
    return { kind: "error", message: "Not signed in" };
  }

  let onboardingUrl: string;
  try {
    const res = await fetch(`${PORTAL_URL}/api/stripe/connect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "mobile" }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        kind: "error",
        message: body?.error || `Failed to start onboarding (${res.status})`,
      };
    }

    const body = (await res.json()) as { url?: string };
    if (!body.url) {
      return { kind: "error", message: "Stripe did not return an onboarding URL" };
    }
    onboardingUrl = body.url;
  } catch (err) {
    return {
      kind: "error",
      message: (err as Error).message || "Network error starting onboarding",
    };
  }

  const result = await WebBrowser.openAuthSessionAsync(onboardingUrl, RETURN_URL_PREFIX);

  if (result.type !== "success" || !result.url) {
    // User dismissed the sheet without completing — treat as cancelled.
    return { kind: "cancelled" };
  }

  // Stripe appends ?stripe=success or ?stripe=refresh to the return URL.
  const url = result.url;
  if (url.includes("stripe=refresh")) {
    return { kind: "refresh" };
  }
  return { kind: "success" };
}
