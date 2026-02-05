// components/NotificationPanel.tsx
// Slide-in panel for showing notifications/reminders

import React, { useCallback, useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "expo-router";
import {
  type Reminder,
  dismissReminder,
  markProWelcomeAsSeen,
  markPremiumWelcomeAsSeen,
  markNotificationAsRead,
} from "@/lib/reminders";

const PANEL_WIDTH = Dimensions.get("window").width * 0.85;
const MAX_PANEL_WIDTH = 400;

interface NotificationPanelProps {
  visible: boolean;
  onClose: () => void;
  reminders: Reminder[];
  onRefresh: () => void;
}

export function NotificationPanel({
  visible,
  onClose,
  reminders,
  onRefresh,
}: NotificationPanelProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const slideAnim = React.useRef(new Animated.Value(PANEL_WIDTH)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: PANEL_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleDismiss = useCallback(async (reminder: Reminder) => {
    await dismissReminder(reminder.id);
    onRefresh();
  }, [onRefresh]);

  const handleSnooze = useCallback(async (reminder: Reminder, days: number) => {
    await dismissReminder(reminder.id, days);
    onRefresh();
  }, [onRefresh]);

  const handleTap = useCallback(async (reminder: Reminder) => {
    if (reminder.type === "pro_welcome") {
      // Pro welcome doesn't navigate anywhere on tap
      return;
    }

    // Mark cloud notifications as read when tapped
    if (reminder.id.startsWith("notification_")) {
      await markNotificationAsRead(reminder.id);
    }

    onClose();
    if (reminder.entityType === "quote") {
      router.push(`/quote/${reminder.entityId}/edit`);
    } else if (reminder.entityType === "invoice") {
      router.push(`/(main)/invoice/${reminder.entityId}` as any);
    } else if (reminder.entityType === "contract") {
      router.push(`/(forms)/contract/${reminder.entityId}/edit` as any);
    } else if (reminder.entityType === "assembly") {
      router.push(`/(main)/assembly-editor/${reminder.entityId}` as any);
    }
  }, [onClose, router]);

  const handleProWelcomeDismiss = useCallback(async () => {
    await markProWelcomeAsSeen();
    onRefresh();
  }, [onRefresh]);

  const handlePremiumWelcomeDismiss = useCallback(async () => {
    await markPremiumWelcomeAsSeen();
    onRefresh();
  }, [onRefresh]);

  const handleProFeatureTap = useCallback((route: string) => {
    onClose();
    router.push(route as any);
  }, [onClose, router]);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const panelWidth = Math.min(PANEL_WIDTH, MAX_PANEL_WIDTH);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Panel */}
        <Animated.View
          style={[
            styles.panel,
            { width: panelWidth, transform: [{ translateX: slideAnim }] },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {reminders.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={48}
                  color={theme.colors.muted}
                />
                <Text style={styles.emptyText}>All caught up!</Text>
                <Text style={styles.emptySubtext}>
                  No follow-ups or reminders at this time.
                </Text>
              </View>
            ) : (
              reminders.map((reminder) => (
                reminder.type === "pro_welcome" ? (
                  <ProWelcomeCard
                    key={reminder.id}
                    onDismiss={handleProWelcomeDismiss}
                    onFeatureTap={handleProFeatureTap}
                    theme={theme}
                  />
                ) : reminder.type === "premium_welcome" ? (
                  <PremiumWelcomeCard
                    key={reminder.id}
                    onDismiss={handlePremiumWelcomeDismiss}
                    onFeatureTap={handleProFeatureTap}
                    theme={theme}
                  />
                ) : (
                  <ReminderItem
                    key={reminder.id}
                    reminder={reminder}
                    onTap={() => handleTap(reminder)}
                    onDismiss={() => handleDismiss(reminder)}
                    onSnooze={(days) => handleSnooze(reminder, days)}
                    theme={theme}
                  />
                )
              ))
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface ReminderItemProps {
  reminder: Reminder;
  onTap: () => void;
  onDismiss: () => void;
  onSnooze: (days: number) => void;
  theme: ReturnType<typeof useTheme>["theme"];
}

// Pro feature list for welcome card
const PRO_FEATURES = [
  { icon: "people-outline" as const, label: "Save & sync clients", route: "/client-manager" },
  { icon: "cube-outline" as const, label: "Reusable assemblies", route: "/(main)/(tabs)/assemblies" },
  { icon: "cloud-outline" as const, label: "Cloud backup & sync", route: "/(main)/settings" },
  { icon: "image-outline" as const, label: "Company logo on PDFs", route: "/(main)/settings" },
  { icon: "infinite-outline" as const, label: "Unlimited quotes & exports", route: null },
];

interface ProWelcomeCardProps {
  onDismiss: () => void;
  onFeatureTap: (route: string) => void;
  theme: ReturnType<typeof useTheme>["theme"];
}

function ProWelcomeCard({ onDismiss, onFeatureTap, theme }: ProWelcomeCardProps) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.proWelcomeCard}>
      <View style={styles.proWelcomeHeader}>
        <View style={styles.proWelcomeIcon}>
          <Ionicons name="star" size={24} color="#FFD700" />
        </View>
        <View style={styles.proWelcomeHeaderText}>
          <Text style={styles.proWelcomeTitle}>Welcome to Pro!</Text>
          <Text style={styles.proWelcomeSubtitle}>Here&apos;s what you unlocked</Text>
        </View>
      </View>

      <View style={styles.proFeatureList}>
        {PRO_FEATURES.map((feature, index) => (
          <Pressable
            key={index}
            style={styles.proFeatureItem}
            onPress={() => feature.route && onFeatureTap(feature.route)}
            disabled={!feature.route}
          >
            <Ionicons
              name={feature.icon}
              size={18}
              color={theme.colors.accent}
              style={styles.proFeatureIcon}
            />
            <Text style={[
              styles.proFeatureLabel,
              feature.route && styles.proFeatureLabelTappable
            ]}>
              {feature.label}
            </Text>
            {feature.route && (
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.muted}
              />
            )}
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.proWelcomeDismiss} onPress={onDismiss}>
        <Text style={styles.proWelcomeDismissText}>Got it!</Text>
      </Pressable>
    </View>
  );
}

// Premium feature list for welcome card
const PREMIUM_FEATURES = [
  { icon: "laptop-outline" as const, label: "Exclusive web portal", route: "https://portal.quotecat.ai", isExternal: true },
  { icon: "document-text-outline" as const, label: "Contracts & e-signatures", route: "/(main)/(tabs)/contracts", isExternal: false },
  { icon: "pricetag-outline" as const, label: "Custom price book", route: "/(main)/price-book", isExternal: false },
  { icon: "sparkles-outline" as const, label: "Quote Wizard (AI)", route: "/(main)/wizard", isExternal: false },
  { icon: "cube-outline" as const, label: "Reusable assemblies", route: "/(main)/(tabs)/assemblies", isExternal: false },
  { icon: "infinite-outline" as const, label: "Everything in Pro, plus more", route: null, isExternal: false },
];

interface PremiumWelcomeCardProps {
  onDismiss: () => void;
  onFeatureTap: (route: string) => void;
  theme: ReturnType<typeof useTheme>["theme"];
}

function PremiumWelcomeCard({ onDismiss, onFeatureTap, theme }: PremiumWelcomeCardProps) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const handleFeaturePress = useCallback((feature: typeof PREMIUM_FEATURES[0]) => {
    if (!feature.route) return;
    if (feature.isExternal) {
      Linking.openURL(feature.route);
    } else {
      onFeatureTap(feature.route);
    }
  }, [onFeatureTap]);

  return (
    <View style={[styles.proWelcomeCard, styles.premiumWelcomeCard]}>
      <View style={styles.proWelcomeHeader}>
        <View style={[styles.proWelcomeIcon, styles.premiumWelcomeIcon]}>
          <Ionicons name="diamond" size={24} color="#5856D6" />
        </View>
        <View style={styles.proWelcomeHeaderText}>
          <Text style={styles.proWelcomeTitle}>Welcome to Premium!</Text>
          <Text style={styles.proWelcomeSubtitle}>Here&apos;s what you unlocked</Text>
        </View>
      </View>

      <View style={styles.proFeatureList}>
        {PREMIUM_FEATURES.map((feature, index) => (
          <Pressable
            key={index}
            style={styles.proFeatureItem}
            onPress={() => handleFeaturePress(feature)}
            disabled={!feature.route}
          >
            <Ionicons
              name={feature.icon}
              size={18}
              color="#5856D6"
              style={styles.proFeatureIcon}
            />
            <Text style={[
              styles.proFeatureLabel,
              feature.route && styles.proFeatureLabelTappable
            ]}>
              {feature.label}
            </Text>
            {feature.route && (
              <Ionicons
                name={feature.isExternal ? "open-outline" : "chevron-forward"}
                size={16}
                color={theme.colors.muted}
              />
            )}
          </Pressable>
        ))}
      </View>

      <Pressable style={[styles.proWelcomeDismiss, styles.premiumWelcomeDismiss]} onPress={onDismiss}>
        <Text style={[styles.proWelcomeDismissText, styles.premiumWelcomeDismissText]}>Got it!</Text>
      </Pressable>
    </View>
  );
}

interface ReminderItemProps {
  reminder: Reminder;
  onTap: () => void;
  onDismiss: () => void;
  onSnooze: (days: number) => void;
  theme: ReturnType<typeof useTheme>["theme"];
}

// Get display info for reminder type
function getReminderTypeInfo(reminder: Reminder): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
} {
  switch (reminder.type) {
    case "quote_followup":
      return { label: "FOLLOW UP", icon: "call-outline", color: "#FF9500" };
    case "invoice_overdue":
      return { label: "OVERDUE", icon: "alert-circle-outline", color: "#FF3B30" };
    case "invoice_due_today":
      return { label: "DUE TODAY", icon: "today-outline", color: "#FF9500" };
    case "invoice_due_soon":
      return { label: "DUE SOON", icon: "time-outline", color: "#007AFF" };
    case "quote_approved":
      return { label: "APPROVED", icon: "checkmark-circle-outline", color: "#34C759" };
    case "quote_declined":
      return { label: "DECLINED", icon: "close-circle-outline", color: "#FF3B30" };
    case "quote_viewed":
      return { label: "VIEWED", icon: "eye-outline", color: "#007AFF" };
    case "contract_signed":
      return { label: "SIGNED", icon: "checkmark-circle-outline", color: "#34C759" };
    case "contract_viewed":
      return { label: "VIEWED", icon: "eye-outline", color: "#007AFF" };
    case "contract_declined":
      return { label: "DECLINED", icon: "close-circle-outline", color: "#FF3B30" };
    case "invoice_paid":
      return { label: "PAID", icon: "checkmark-circle-outline", color: "#34C759" };
    case "assembly_unhealthy":
      return { label: "NEEDS REVIEW", icon: "warning-outline", color: "#FF9500" };
    default:
      return { label: "NOTIFICATION", icon: "notifications-outline", color: "#8E8E93" };
  }
}

function ReminderItem({
  reminder,
  onTap,
  onDismiss,
  onSnooze,
  theme,
}: ReminderItemProps) {
  const [showActions, setShowActions] = useState(false);
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const typeInfo = getReminderTypeInfo(reminder);

  return (
    <View style={styles.reminderItem}>
      <Pressable style={styles.reminderContent} onPress={onTap}>
        <View style={[styles.reminderIcon, { backgroundColor: `${typeInfo.color}20` }]}>
          <Ionicons name={typeInfo.icon} size={20} color={typeInfo.color} />
        </View>
        <View style={styles.reminderText}>
          <Text style={[styles.reminderLabel, { color: typeInfo.color }]}>
            {typeInfo.label}
          </Text>
          <Text style={styles.reminderTitle} numberOfLines={1}>
            {reminder.title}
          </Text>
        </View>
        <Pressable
          style={styles.reminderMenuButton}
          onPress={() => setShowActions(!showActions)}
          hitSlop={8}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={18}
            color={theme.colors.muted}
          />
        </Pressable>
      </Pressable>

      {showActions && (
        <View style={styles.reminderActions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              setShowActions(false);
              onSnooze(1);
            }}
          >
            <Text style={styles.actionText}>Snooze 24h</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.dismissButton]}
            onPress={() => {
              setShowActions(false);
              onDismiss();
            }}
          >
            <Text style={[styles.actionText, styles.dismissText]}>Dismiss</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.4)",
    },
    panel: {
      height: "100%",
      backgroundColor: theme.colors.bg,
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.border,
      shadowColor: "#000",
      shadowOffset: { width: -2, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 10,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingTop: 60, // Account for status bar
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: 4,
      textAlign: "center",
    },
    reminderItem: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    reminderContent: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
    },
    reminderIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${theme.colors.accent}20`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    reminderText: {
      flex: 1,
    },
    reminderLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    reminderTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    reminderMenuButton: {
      padding: 4,
    },
    reminderActions: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.bg,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRightWidth: 1,
      borderRightColor: theme.colors.border,
    },
    actionText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    dismissButton: {
      borderRightWidth: 0,
    },
    dismissText: {
      color: theme.colors.muted,
    },
    // Pro Welcome Card styles
    proWelcomeCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      overflow: "hidden",
    },
    proWelcomeHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      backgroundColor: `${theme.colors.accent}15`,
    },
    proWelcomeIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${theme.colors.accent}25`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    proWelcomeHeaderText: {
      flex: 1,
    },
    proWelcomeTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    proWelcomeSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: 2,
    },
    proFeatureList: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    proFeatureItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
    },
    proFeatureIcon: {
      marginRight: 12,
    },
    proFeatureLabel: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
    },
    proFeatureLabelTappable: {
      color: theme.colors.accent,
    },
    proWelcomeDismiss: {
      backgroundColor: theme.colors.accent,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    proWelcomeDismissText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    // Premium welcome card overrides
    premiumWelcomeCard: {
      borderColor: "#5856D6",
    },
    premiumWelcomeIcon: {
      backgroundColor: "#5856D620",
    },
    premiumWelcomeDismiss: {
      backgroundColor: "#5856D6",
    },
    premiumWelcomeDismissText: {
      color: "#FFF",
    },
  });
}
