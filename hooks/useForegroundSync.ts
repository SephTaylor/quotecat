import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getUserState } from "@/lib/user";
import { syncQuotes } from "@/lib/quotesSync";
import { syncInvoices } from "@/lib/invoicesSync";
import { syncClients } from "@/lib/clientsSync";

/**
 * Trigger a background → foreground cloud sync for Pro+ users.
 *
 * Surfaced 2026-06-29 by Mike Kane's bug report: a customer can approve a
 * quote (or any other portal-side state change) while the contractor is away
 * in their email app. Without this hook, the contractor returns to QuoteCat
 * and sees stale local data — they have to pull-to-refresh to see the update,
 * which feels broken even though it's working as designed.
 *
 * 30s debounce prevents thrash from rapid app-switching.
 *
 * Mount once at the app root. Reads tier via getUserState() per transition
 * so it doesn't depend on any specific React context.
 */
export function useForegroundSync() {
  const lastSyncAtRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const handle = async (next: AppStateStatus) => {
      const wasBackground = /inactive|background/.test(appStateRef.current);
      const isForeground = next === "active";
      appStateRef.current = next;
      if (!wasBackground || !isForeground) return;

      const now = Date.now();
      if (now - lastSyncAtRef.current < 30_000) return;

      const user = await getUserState();
      if (user.tier !== "pro" && user.tier !== "premium") return;

      lastSyncAtRef.current = now;
      Promise.all([
        syncQuotes().catch(() => {}),
        syncInvoices().catch(() => {}),
        syncClients().catch(() => {}),
      ]).catch(() => {});
    };

    const sub = AppState.addEventListener("change", handle);
    return () => sub.remove();
  }, []);
}
