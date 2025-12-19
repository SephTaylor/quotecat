// components/NotificationBell.tsx
// Bell icon with badge for header, opens notification panel

import React, { useCallback, useState } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useFocusEffect } from "expo-router";
import { listQuotes } from "@/lib/quotes";
import { listInvoices } from "@/lib/invoices";
import { loadPreferences } from "@/lib/preferences";
import { getActiveReminders, getProWelcomeReminder, getContractNotifications, type Reminder } from "@/lib/reminders";
import { getUserState } from "@/lib/user";
import { NotificationPanel } from "./NotificationPanel";

interface NotificationBellProps {
  side?: "left" | "right";
}

// Cache reminders for 30 seconds to avoid reloading on every focus
const CACHE_TTL_MS = 30000;

export function NotificationBell({ side = "right" }: NotificationBellProps) {
  const { theme } = useTheme();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);

  const loadReminders = useCallback(async (force = false) => {
    // Skip if recently loaded (unless forced)
    const now = Date.now();
    if (!force && lastLoadTime > 0 && now - lastLoadTime < CACHE_TTL_MS) {
      return;
    }

    try {
      const [quotes, invoices, prefs, userState] = await Promise.all([
        listQuotes(),
        listInvoices(),
        loadPreferences(),
        getUserState(),
      ]);
      const active = await getActiveReminders(quotes, invoices, prefs.notifications);

      // Add Pro welcome reminder if user is Pro/Premium and hasn't seen it
      if (userState.tier === "pro" || userState.tier === "premium") {
        const proWelcome = await getProWelcomeReminder();
        if (proWelcome) {
          // Put welcome at the top of the list
          active.unshift(proWelcome);
        }

        // Fetch contract notifications for Premium users
        if (userState.tier === "premium") {
          const contractNotifications = await getContractNotifications();
          // Add contract notifications at the top (most important)
          active.unshift(...contractNotifications);
        }
      }

      setReminders(active);
      setLastLoadTime(now);
    } catch (error) {
      console.error("Failed to load reminders:", error);
    }
  }, [lastLoadTime]);

  // Load on mount and focus (with cache check)
  useFocusEffect(
    useCallback(() => {
      loadReminders();
    }, [loadReminders])
  );

  // Also load when panel closes (in case user dismissed something)
  const handleClosePanel = useCallback(() => {
    setShowPanel(false);
  }, []);

  const handleRefresh = useCallback(() => {
    loadReminders(true); // Force reload when user manually refreshes
  }, [loadReminders]);

  const count = reminders.length;

  return (
    <>
      <View
        style={[
          styles.container,
          side === "right" ? styles.rightSide : styles.leftSide,
        ]}
      >
        <TouchableOpacity
          onPress={() => setShowPanel(true)}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.button}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color={theme.colors.text}
          />
          {count > 0 && (
            <View style={[styles.badge, { backgroundColor: "#FF3B30" }]}>
              <Text style={styles.badgeText}>
                {count > 9 ? "9+" : count}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <NotificationPanel
        visible={showPanel}
        onClose={handleClosePanel}
        reminders={reminders}
        onRefresh={handleRefresh}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  rightSide: {
    marginRight: 4,
  },
  leftSide: {
    marginLeft: 4,
  },
  button: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
