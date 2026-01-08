// hooks/useSettingsState.ts
// Extracted hook for settings screen state and operations

import { useCallback, useState } from "react";
import { Alert, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { getUserState, type UserState } from "@/lib/user";
import {
  loadPreferences,
  savePreferences,
  updateDashboardPreferences,
  updateNotificationPreferences,
  resetPreferences,
  type DashboardPreferences,
  type UserPreferences,
} from "@/lib/preferences";
import {
  syncQuotes,
  getLastSyncTime,
  isSyncAvailable,
  resetSyncMetadata,
} from "@/lib/quotesSync";
import { syncInvoices } from "@/lib/invoicesSync";
import { syncClients } from "@/lib/clientsSync";
import { listQuotes } from "@/lib/quotes";
import { listInvoices } from "@/lib/invoices";
import { getClients } from "@/lib/clients";
import { supabase } from "@/lib/supabase";

export type ExpandedSections = {
  usage: boolean;
  cloudSync: boolean;
  appearance: boolean;
  dashboard: boolean;
  notifications: boolean;
  privacy: boolean;
  comingSoon: boolean;
  about: boolean;
};

export function useSettingsState() {
  const router = useRouter();
  const [isPro, setIsPro] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userState, setUserState] = useState<UserState | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  // Sync state
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncAvailable, setSyncAvailable] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [localCounts, setLocalCounts] = useState({ quotes: 0, invoices: 0, clients: 0, assemblies: 0 });
  const [cloudCounts, setCloudCounts] = useState({ quotes: 0, invoices: 0, clients: 0, assemblies: 0 });

  // Email capture state
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  // Track expanded sections
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    usage: false,
    cloudSync: false,
    appearance: false,
    dashboard: false,
    notifications: false,
    privacy: false,
    comingSoon: false,
    about: false,
  });

  const toggleSection = useCallback((section: keyof ExpandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const load = useCallback(async () => {
    const [user, fullPrefs] = await Promise.all([
      getUserState(),
      loadPreferences(),
    ]);
    const isPaidTier = user.tier === "pro" || user.tier === "premium";
    setIsPro(isPaidTier);
    setUserEmail(user.email);
    setUserState(user);
    setPreferences(fullPrefs);

    // Load sync state - SEQUENTIALLY to avoid OOM from parallel loading
    const syncTime = await getLastSyncTime();
    const available = await isSyncAvailable();

    setLastSyncTime(syncTime);
    setSyncAvailable(available && isPaidTier);

    // Load counts SEQUENTIALLY with GC breaks to prevent memory pressure
    // This is critical when background sync may also be running
    const localQuotes = await listQuotes();
    const quotesCount = localQuotes.length;
    // Allow GC to clean up before loading next batch
    await new Promise(resolve => setTimeout(resolve, 100));

    const localInvoices = await listInvoices();
    const invoicesCount = localInvoices.length;
    await new Promise(resolve => setTimeout(resolve, 100));

    const localClients = await getClients();
    const clientsCount = localClients.length;
    await new Promise(resolve => setTimeout(resolve, 100));

    // Load assemblies count
    const { listAssemblies } = await import("@/modules/assemblies/storage");
    const localAssemblies = await listAssemblies();
    const assembliesCount = localAssemblies.length;

    const counts = {
      quotes: quotesCount,
      invoices: invoicesCount,
      clients: clientsCount,
      assemblies: assembliesCount,
    };
    setLocalCounts(counts);

    // Show local counts as cloud counts (they should match after sync)
    // On fresh install, this will be 0 until first sync completes
    if (available && isPaidTier) {
      setCloudCounts(counts);
    }

    // Check if user has already subscribed to updates
    try {
      const subscribedEmail = await AsyncStorage.getItem(
        "@quotecat/subscribed-email"
      );
      if (subscribedEmail) {
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error("Failed to load subscription status:", error);
    }
  }, []);

  // Load on focus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSubscribe = useCallback(async () => {
    if (!subscribeEmail.trim()) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(subscribeEmail.trim())) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setSubscribing(true);
    try {
      const email = subscribeEmail.trim().toLowerCase();

      // Save to Supabase
      const { error } = await supabase
        .from("email_subscribers")
        .upsert({ email }, { onConflict: "email" });

      if (error) {
        console.error("Supabase error:", error);
        // Still save locally as fallback
      }

      // Store locally to remember subscription state
      await AsyncStorage.setItem("@quotecat/subscribed-email", email);

      setIsSubscribed(true);
      setSubscribeEmail("");
      Alert.alert(
        "Subscribed!",
        "You'll receive updates about new features and tips."
      );
    } catch (error) {
      console.error("Failed to subscribe:", error);
      Alert.alert("Error", "Failed to subscribe. Please try again.");
    } finally {
      setSubscribing(false);
    }
  }, [subscribeEmail]);

  const handleUnsubscribe = useCallback(async () => {
    try {
      await AsyncStorage.removeItem("@quotecat/subscribed-email");
      setIsSubscribed(false);
    } catch (error) {
      console.error("Failed to unsubscribe:", error);
    }
  }, []);

  const handleManageAccount = useCallback(async () => {
    if (!userEmail) {
      Alert.alert("Error", "Please sign in to manage your account.");
      return;
    }

    try {
      const response = await fetch(
        "https://eouikzjzsartaabvlbee.supabase.co/functions/v1/create-portal-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWlremp6c2FydGFhYnZsYmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTA0NzEsImV4cCI6MjA3NTY4NjQ3MX0.xa7mZtOfLocL_QX2wrhpywsKbhu2hZ699O3U7KiVJzo",
            Authorization:
              "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWlremp6c2FydGFhYnZsYmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTA0NzEsImV4cCI6MjA3NTY4NjQ3MX0.xa7mZtOfLocL_QX2wrhpywsKbhu2hZ699O3U7KiVJzo",
          },
          body: JSON.stringify({ email: userEmail }),
        }
      );

      const data = await response.json();

      if (data.error) {
        if (data.error === "No subscription found for this account") {
          Alert.alert(
            "No Subscription",
            "No active subscription found for this account."
          );
        } else {
          Alert.alert("Error", data.error);
        }
        return;
      }

      if (data.url) {
        Linking.openURL(data.url);
      }
    } catch (error) {
      console.error("Portal session error:", error);
      Alert.alert(
        "Error",
        "Could not open account management. Please try again."
      );
    }
  }, [userEmail]);

  const handleSignIn = useCallback(() => {
    router.push("/(auth)/sign-in" as any);
  }, [router]);

  const handleUpdatePreference = useCallback(
    async (updates: Partial<DashboardPreferences>) => {
      if (!preferences) return;
      const updated = {
        ...preferences,
        dashboard: {
          ...preferences.dashboard,
          ...updates,
        },
      };
      setPreferences(updated);
      await updateDashboardPreferences(updates);
    },
    [preferences]
  );

  const handleResetDashboard = useCallback(async () => {
    Alert.alert(
      "Reset Dashboard",
      "This will reset your dashboard to default settings. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            const defaults = await resetPreferences();
            setPreferences(defaults);
          },
        },
      ]
    );
  }, []);

  const handleSyncNow = useCallback(async () => {
    if (!syncAvailable) {
      Alert.alert(
        "Sync Unavailable",
        "Please sign in to sync your data to the cloud."
      );
      return;
    }

    setSyncing(true);
    try {
      // Sync data types SEQUENTIALLY with delays for GC to prevent memory pressure
      console.log("🔄 Starting quotes sync...");
      const quotesResult = await syncQuotes();

      // Give GC time to clean up
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log("🔄 Starting invoices sync...");
      const invoicesResult = await syncInvoices();

      // Give GC time to clean up
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log("🔄 Starting clients sync...");
      const clientsResult = await syncClients();

      if (quotesResult.success && invoicesResult.success && clientsResult.success) {
        setLastSyncTime(new Date());

        // Reload counts SEQUENTIALLY to avoid memory pressure
        const localQuotes = await listQuotes();
        const quotesCount = localQuotes.length;
        await new Promise(resolve => setTimeout(resolve, 100));

        const localInvoices = await listInvoices();
        const invoicesCount = localInvoices.length;
        await new Promise(resolve => setTimeout(resolve, 100));

        const localClients = await getClients();
        const clientsCount = localClients.length;
        await new Promise(resolve => setTimeout(resolve, 100));

        const { listAssemblies } = await import("@/modules/assemblies/storage");
        const localAssemblies = await listAssemblies();
        const assembliesCount = localAssemblies.length;

        const counts = {
          quotes: quotesCount,
          invoices: invoicesCount,
          clients: clientsCount,
          assemblies: assembliesCount,
        };
        setLocalCounts(counts);
        setCloudCounts(counts);

        const totalDownloaded = quotesResult.downloaded + invoicesResult.downloaded + clientsResult.downloaded;
        const totalUploaded = quotesResult.uploaded + invoicesResult.uploaded + clientsResult.uploaded;

        const message =
          totalDownloaded === 0 && totalUploaded === 0
            ? "Everything is up to date!"
            : `Synced! Downloaded ${totalDownloaded}, uploaded ${totalUploaded} item${totalUploaded === 1 ? "" : "s"}.`;

        Alert.alert("Sync Complete", message);
      } else {
        Alert.alert(
          "Sync Failed",
          "Unable to sync with the cloud. Please try again later."
        );
      }
    } catch (error) {
      console.error("Sync error:", error);
      Alert.alert(
        "Sync Error",
        "An error occurred while syncing. Please try again."
      );
    } finally {
      setSyncing(false);
    }
  }, [syncAvailable]);

  const handleForceSync = useCallback(async () => {
    if (!syncAvailable) return;

    Alert.alert(
      "Force Full Sync",
      "This will re-upload all local data to the cloud. This may take a moment. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Force Sync",
          onPress: async () => {
            setSyncing(true);
            try {
              // Reset sync metadata to force re-upload
              await resetSyncMetadata();

              // Run sync SEQUENTIALLY with delays for GC
              console.log("🔄 Force sync: starting quotes...");
              const quotesResult = await syncQuotes();

              await new Promise(resolve => setTimeout(resolve, 500));

              console.log("🔄 Force sync: starting invoices...");
              const invoicesResult = await syncInvoices();

              await new Promise(resolve => setTimeout(resolve, 500));

              console.log("🔄 Force sync: starting clients...");
              const clientsResult = await syncClients();

              if (quotesResult.success && invoicesResult.success && clientsResult.success) {
                setLastSyncTime(new Date());

                // Reload counts SEQUENTIALLY to avoid memory pressure
                const localQuotes = await listQuotes();
                const quotesCount = localQuotes.length;
                await new Promise(resolve => setTimeout(resolve, 100));

                const localInvoices = await listInvoices();
                const invoicesCount = localInvoices.length;
                await new Promise(resolve => setTimeout(resolve, 100));

                const localClients = await getClients();
                const clientsCount = localClients.length;
                await new Promise(resolve => setTimeout(resolve, 100));

                const { listAssemblies } = await import("@/modules/assemblies/storage");
                const localAssemblies = await listAssemblies();
                const assembliesCount = localAssemblies.length;

                const counts = {
                  quotes: quotesCount,
                  invoices: invoicesCount,
                  clients: clientsCount,
                  assemblies: assembliesCount,
                };
                setLocalCounts(counts);
                setCloudCounts(counts);

                const totalUploaded = quotesResult.uploaded + invoicesResult.uploaded + clientsResult.uploaded;

                Alert.alert(
                  "Success",
                  `Force sync complete! Uploaded ${totalUploaded} item${totalUploaded === 1 ? "" : "s"}.`
                );
              } else {
                Alert.alert("Sync Failed", "Unable to complete force sync.");
              }
            } catch (error) {
              console.error("Force sync error:", error);
              Alert.alert("Error", "Force sync failed. Please try again.");
            } finally {
              setSyncing(false);
            }
          },
        },
      ]
    );
  }, [syncAvailable]);

  const handleUpdateNotifications = useCallback(
    async (
      updates: Parameters<typeof updateNotificationPreferences>[0]
    ): Promise<UserPreferences> => {
      const updated = await updateNotificationPreferences(updates);
      setPreferences(updated);
      return updated;
    },
    []
  );

  const handleUpdatePrivacy = useCallback(
    async (shareAnonymousUsage: boolean) => {
      if (!preferences) return;
      const updated = {
        ...preferences,
        privacy: {
          ...preferences.privacy,
          shareAnonymousUsage,
        },
      };
      setPreferences(updated);
      await savePreferences(updated);
    },
    [preferences]
  );

  return {
    // State
    isPro,
    userEmail,
    userState,
    preferences,
    lastSyncTime,
    syncAvailable,
    syncing,
    localCounts,
    cloudCounts,
    subscribeEmail,
    isSubscribed,
    subscribing,
    expandedSections,

    // Setters
    setSubscribeEmail,
    setPreferences,

    // Handlers
    toggleSection,
    handleSubscribe,
    handleUnsubscribe,
    handleManageAccount,
    handleSignIn,
    handleUpdatePreference,
    handleResetDashboard,
    handleSyncNow,
    handleForceSync,
    handleUpdateNotifications,
    handleUpdatePrivacy,
  };
}

/**
 * Format sync time as relative time (e.g., "just now", "2 minutes ago")
 */
export function formatSyncTime(date: Date): string {
  const now = Date.now();
  const syncTime = date.getTime();
  const diffMs = now - syncTime;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}
