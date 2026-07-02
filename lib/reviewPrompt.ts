// lib/reviewPrompt.ts
// Native in-app review request on iOS + Android via expo-store-review.
//
// The system SDK renders Apple's SKStoreReviewController (iOS) or
// Google Play's In-App Review (Android). Both are rate-limited by the OS
// itself — Apple caps at 3 prompts per user per 365 days, Google caps
// per-user with an undisclosed algorithm — so nagging isn't really
// possible even if we tried.
//
// We add our own guardrails on top:
//   - Only after a genuine "win" moment (quote approved, contract signed).
//   - Never within the first 3 days of app install.
//   - Never more often than every 90 days from our own storage.
//   - Never before the user has done at least a couple of real actions
//     (via a simple "wins" counter).
//
// The point of these extra guards isn't to stop the OS — it's to save
// our precious 3-per-year iOS budget for moments the user is actually
// happy. Wasting one right after install kills a whole year's chances.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const KEY_LAST_REQUEST = "@quotecat/review_prompt_last_request";
const KEY_INSTALL_DATE = "@quotecat/review_prompt_install_date";
const KEY_WIN_COUNT = "@quotecat/review_prompt_win_count";

const MIN_DAYS_SINCE_INSTALL = 3;
const MIN_DAYS_BETWEEN_PROMPTS = 90;
const MIN_WINS_BEFORE_ASK = 2;

async function getInstallDate(): Promise<Date> {
  const stored = await AsyncStorage.getItem(KEY_INSTALL_DATE);
  if (stored) return new Date(stored);
  const now = new Date();
  await AsyncStorage.setItem(KEY_INSTALL_DATE, now.toISOString());
  return now;
}

async function daysSince(iso: string | null): Promise<number> {
  if (!iso) return Infinity;
  const then = new Date(iso).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}

/**
 * Convenience: record a win AND try to show the prompt in one fire-and-
 * forget call. This is what most callers actually want — from an
 * approval handler, they just want to note "something good happened,
 * consider asking for a review." Never blocks the caller.
 */
export function recordWinAndMaybeRequestReview(): void {
  void (async () => {
    await recordWin();
    await requestReviewIfAppropriate();
  })();
}

/**
 * Increment the "wins" counter — call this from every win moment,
 * regardless of whether we then show the prompt. Lets us gate the
 * prompt behind at least a few successful actions so we don't ask
 * a brand-new user immediately after their first approve.
 */
export async function recordWin(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY_WIN_COUNT);
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    await AsyncStorage.setItem(KEY_WIN_COUNT, String(count + 1));
  } catch (e) {
    // Non-fatal — if we can't track wins we just skip the prompt.
    console.warn("recordWin failed:", e);
  }
}

/**
 * Request an in-app review if all our guards pass. Fire-and-forget from
 * a win moment; never blocks the caller. Returns whether we asked the OS
 * (not whether the user actually left a review — the OS never tells us
 * that, by design).
 */
export async function requestReviewIfAppropriate(): Promise<boolean> {
  try {
    // OS-side capability check first.
    const canReview = await StoreReview.isAvailableAsync();
    if (!canReview) return false;

    // Wait at least a few days after install so first-run enthusiasm has
    // settled and we're asking someone who's actually returned to the app.
    const installedAt = await getInstallDate();
    const daysSinceInstall = (Date.now() - installedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceInstall < MIN_DAYS_SINCE_INSTALL) return false;

    // Don't ask again within 90 days of the last ask (Apple's own 365-day
    // cap will still bite even if we bypass this — but this keeps things
    // spaced out on Android too).
    const lastRequestRaw = await AsyncStorage.getItem(KEY_LAST_REQUEST);
    const daysSinceLast = await daysSince(lastRequestRaw);
    if (daysSinceLast < MIN_DAYS_BETWEEN_PROMPTS) return false;

    // Require at least a couple of wins before asking. The first win
    // seeds the counter but doesn't unlock the prompt.
    const winsRaw = await AsyncStorage.getItem(KEY_WIN_COUNT);
    const wins = winsRaw ? parseInt(winsRaw, 10) || 0 : 0;
    if (wins < MIN_WINS_BEFORE_ASK) return false;

    // Record BEFORE the prompt so a crash mid-prompt still marks it as
    // shown — better to miss one ask than to ask on every launch after
    // a crash.
    await AsyncStorage.setItem(KEY_LAST_REQUEST, new Date().toISOString());

    // The OS-side prompt is fire-and-forget. We never learn the outcome.
    await StoreReview.requestReview();
    return true;
  } catch (e) {
    // Anything that goes wrong here is silent — a review prompt failing
    // must never affect the actual user flow it fired from.
    console.warn("requestReviewIfAppropriate failed:", e);
    return false;
  }
}
