// modules/changeOrders/hooks/useChangeDetection.ts
// Hook for detecting material changes in a quote

import { useState, useCallback, useRef, useEffect } from "react";
import type { Quote } from "@/lib/types";
import type { QuoteSnapshot } from "../types";
import { createSnapshot, calculateDiff } from "../diff";

type ChangeDetectionReturn = {
  /** Whether the quote has changes from the original snapshot */
  hasChanges: boolean;
  /** Whether the changes are material (affect price/items) */
  hasMaterialChanges: boolean;
  /** The current diff if changes exist */
  diff: ReturnType<typeof calculateDiff> | null;
  /** Take a snapshot of the current quote state */
  takeSnapshot: (quote: Quote) => void;
  /** Check current quote against snapshot */
  checkChanges: (quote: Quote) => ReturnType<typeof calculateDiff> | null;
  /** Clear the snapshot (e.g., after CO is created) */
  clearSnapshot: () => void;
  /** Get the original snapshot */
  getSnapshot: () => QuoteSnapshot | null;
};

/**
 * Hook for tracking changes to a quote since it was loaded
 * Use this to detect when a Change Order should be created
 */
export function useChangeDetection(): ChangeDetectionReturn {
  const snapshotRef = useRef<QuoteSnapshot | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasMaterialChanges, setHasMaterialChanges] = useState(false);
  const [diff, setDiff] = useState<ReturnType<typeof calculateDiff> | null>(null);

  const takeSnapshot = useCallback((quote: Quote) => {
    snapshotRef.current = createSnapshot(quote);
    setHasChanges(false);
    setHasMaterialChanges(false);
    setDiff(null);
  }, []);

  const checkChanges = useCallback((quote: Quote): ReturnType<typeof calculateDiff> | null => {
    if (!snapshotRef.current) return null;

    const currentDiff = calculateDiff(snapshotRef.current, quote);

    setHasChanges(currentDiff.netChange !== 0 || currentDiff.items.length > 0);
    setHasMaterialChanges(currentDiff.hasMaterialChanges);
    setDiff(currentDiff);

    return currentDiff;
  }, []);

  const clearSnapshot = useCallback(() => {
    snapshotRef.current = null;
    setHasChanges(false);
    setHasMaterialChanges(false);
    setDiff(null);
  }, []);

  const getSnapshot = useCallback(() => snapshotRef.current, []);

  return {
    hasChanges,
    hasMaterialChanges,
    diff,
    takeSnapshot,
    checkChanges,
    clearSnapshot,
    getSnapshot,
  };
}

/**
 * Hook variant that auto-takes snapshot when quote loads
 * and auto-checks on quote changes
 */
export function useAutoChangeDetection(
  quote: Quote | null,
  enabled: boolean = true
): ChangeDetectionReturn {
  const detection = useChangeDetection();
  const initializedRef = useRef(false);

  // Take snapshot when quote first loads
  useEffect(() => {
    if (quote && enabled && !initializedRef.current) {
      detection.takeSnapshot(quote);
      initializedRef.current = true;
    }
  }, [quote, enabled, detection]);

  // Check for changes whenever quote changes (after initial snapshot)
  useEffect(() => {
    if (quote && enabled && initializedRef.current) {
      detection.checkChanges(quote);
    }
  }, [quote, enabled, detection]);

  // Reset when disabled or quote cleared
  useEffect(() => {
    if (!enabled || !quote) {
      initializedRef.current = false;
      detection.clearSnapshot();
    }
  }, [enabled, quote, detection]);

  return detection;
}
