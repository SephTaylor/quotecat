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
import { getActiveReminders, type Reminder } from "@/lib/reminders";
import { NotificationPanel } from "./NotificationPanel";

interface NotificationBellProps {
  side?: "left" | "right";
}

export function NotificationBell({ side = "right" }: NotificationBellProps) {
  const { theme } = useTheme();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  const loadReminders = useCallback(async () => {
    try {
      const [quotes, invoices, prefs] = await Promise.all([
        listQuotes(),
        listInvoices(),
        loadPreferences(),
      ]);
      const active = await getActiveReminders(quotes, invoices, prefs.notifications);
      setReminders(active);
    } catch (error) {
      console.error("Failed to load reminders:", error);
    }
  }, []);

  // Load on mount and focus
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
    loadReminders();
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
