// lib/refreshEvents.ts
// Simple event emitter for triggering screen refreshes

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

// Track pending refreshes for screens that weren't subscribed when emit was called
const pendingRefreshes = new Set<string>();

export const RefreshEvents = {
  // Subscribe to a refresh event
  subscribe(event: string, callback: Listener): () => void {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(callback);

    // Check if there's a pending refresh for this event
    if (pendingRefreshes.has(event)) {
      pendingRefreshes.delete(event);
      setTimeout(() => callback(), 0);
    }

    // Return unsubscribe function
    return () => {
      listeners.get(event)?.delete(callback);
    };
  },

  // Emit a refresh event
  emit(event: string): void {
    const listenerSet = listeners.get(event);
    if (!listenerSet || listenerSet.size === 0) {
      pendingRefreshes.add(event);
    } else {
      listenerSet.forEach((callback) => callback());
    }
  },
};

// Event names
export const REFRESH_QUOTES_LIST = "refresh:quotes";
