// lib/syncState.ts
// Simple in-memory state to track when background sync completes
// Used by UI components to know when to refresh from local SQLite

// Timestamp of when the last background sync completed
let lastSyncCompletedAt: number | null = null;

/**
 * Mark that background sync has completed
 * Called by runBackgroundSync() in auth.ts
 */
export function markSyncComplete(): void {
  lastSyncCompletedAt = Date.now();
}

/**
 * Get the timestamp of when sync last completed
 * Returns null if sync hasn't completed this session
 */
export function getLastSyncCompletedAt(): number | null {
  return lastSyncCompletedAt;
}

/**
 * Check if sync completed after a given timestamp
 * Used by UI components to determine if they need to refresh
 */
export function hasSyncCompletedSince(timestamp: number): boolean {
  if (lastSyncCompletedAt === null) return false;
  return lastSyncCompletedAt > timestamp;
}

/**
 * Reset sync state (for testing or logout)
 */
export function resetSyncState(): void {
  lastSyncCompletedAt = null;
}
