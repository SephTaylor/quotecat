// lib/syncState.ts
// Tracks when background sync completes and notifies UI components
// Uses a simple event emitter pattern for immediate UI updates

type SyncListener = () => void;

// Timestamp of when the last background sync completed
let lastSyncCompletedAt: number | null = null;

// Listeners waiting to be notified when sync completes
const listeners: Set<SyncListener> = new Set();

/**
 * Subscribe to sync completion events
 * Returns an unsubscribe function
 */
export function onSyncComplete(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Mark that background sync has completed
 * Called by runBackgroundSync() in auth.ts
 * Notifies all listeners immediately
 */
export function markSyncComplete(): void {
  lastSyncCompletedAt = Date.now();
  // Notify all listeners
  listeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error("Sync listener error:", error);
    }
  });
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
  listeners.clear();
}
