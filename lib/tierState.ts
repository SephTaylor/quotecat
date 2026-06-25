// lib/tierState.ts
// Tracks user tier changes and notifies UI components immediately.
//
// Modeled exactly on lib/syncState.ts — same simple event-emitter pattern.
//
// Why this exists: lib/user.ts:setUserTier (and the four other tier-mutating
// functions) write to AsyncStorage but don't tell React anything. React state
// in contexts/TechContext.tsx only refreshes on mount, sync-complete, or
// SIGNED_IN auth events. A successful in-app purchase triggers NONE of those,
// so the UI stays stale until the user signs out and back in.
//
// This event emitter closes that loop. Tier-mutating functions emit
// markTierChanged(tier); TechContext subscribes and refreshes its React state
// when an event fires.

import type { UserTier } from "./user";

type TierListener = (tier: UserTier) => void;

const listeners: Set<TierListener> = new Set();

/**
 * Subscribe to tier change events.
 * Returns an unsubscribe function.
 */
export function onTierChange(listener: TierListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Notify all subscribers that the user tier has changed.
 * Called from lib/user.ts after every saveUserState that mutates tier.
 */
export function markTierChanged(tier: UserTier): void {
  listeners.forEach((listener) => {
    try {
      listener(tier);
    } catch (error) {
      console.error("Tier listener error:", error);
    }
  });
}
