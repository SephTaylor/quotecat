// app/(main)/team-members.tsx
// Team member management screen (Premium feature)
// Syncs with portal via Supabase

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import type { TeamMember } from "@/lib/types";
import {
  getLocalTeamMembers,
  syncTeamMembers,
  uploadTeamMember,
  updateTeamMemberCloud,
  deleteTeamMemberCloud,
} from "@/lib/teamMembersSync";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DISMISSED_INFO_KEY = "@quotecat/team-members-info-dismissed";
const DISMISSED_TECHS_KEY = "@quotecat/team-members-techs-dismissed";

export default function TeamMembersScreen() {
  const router = useRouter();
  const { theme, mode } = useTheme();
  const isDark = mode === "dark";
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [infoDismissed, setInfoDismissed] = useState(false);
  const [techsDismissed, setTechsDismissed] = useState(false);

  // Load dismissed state on mount
  React.useEffect(() => {
    (async () => {
      try {
        const [info, techs] = await Promise.all([
          AsyncStorage.getItem(DISMISSED_INFO_KEY),
          AsyncStorage.getItem(DISMISSED_TECHS_KEY),
        ]);
        if (info === "true") setInfoDismissed(true);
        if (techs === "true") setTechsDismissed(true);
      } catch {}
    })();
  }, []);

  const dismissInfo = async () => {
    setInfoDismissed(true);
    await AsyncStorage.setItem(DISMISSED_INFO_KEY, "true");
  };

  const dismissTechs = async () => {
    setTechsDismissed(true);
    await AsyncStorage.setItem(DISMISSED_TECHS_KEY, "true");
  };

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");

  const loadMembers = useCallback(async () => {
    try {
      const localMembers = getLocalTeamMembers();
      setMembers(localMembers);
    } catch (error) {
      console.error("Failed to load team members:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMembers();
    }, [loadMembers])
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncTeamMembers();
      await loadMembers();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Sync failed:", error);
      Alert.alert("Sync Failed", "Could not sync team members. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await handleSync();
    setRefreshing(false);
  };

  const handleToggleActive = async (member: TeamMember) => {
    try {
      const updated = await updateTeamMemberCloud(member.id, {
        isActive: !member.isActive,
      });
      if (updated) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await loadMembers();
      }
    } catch (error) {
      console.error("Toggle failed:", error);
      Alert.alert("Error", "Failed to update status.");
    }
  };

  // Stats calculations
  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter((m) => m.isActive !== false).length;
    return { total, active };
  }, [members]);

  const openAddModal = () => {
    setEditingMember(null);
    setFormName("");
    setFormRole("");
    setFormRate("");
    setFormPhone("");
    setFormEmail("");
    setShowModal(true);
  };

  const openEditModal = (member: TeamMember) => {
    setEditingMember(member);
    setFormName(member.name);
    setFormRole(member.role || "");
    setFormRate(member.defaultRate > 0 ? member.defaultRate.toString() : "");
    setFormPhone(member.phone || "");
    setFormEmail(member.email || "");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert("Required", "Please enter a name.");
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: formName.trim(),
        role: formRole.trim() || undefined,
        defaultRate: parseFloat(formRate) || 0,
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
      };

      if (editingMember) {
        // Update existing
        const updated = await updateTeamMemberCloud(editingMember.id, data);
        if (updated) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowModal(false);
          await loadMembers();
        } else {
          Alert.alert("Error", "Failed to update team member. Please try again.");
        }
      } else {
        // Create new
        const created = await uploadTeamMember(data);
        if (created) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowModal(false);
          await loadMembers();
        } else {
          Alert.alert("Error", "Failed to create team member. Please try again.");
        }
      }
    } catch (error) {
      console.error("Save failed:", error);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (member: TeamMember) => {
    Alert.alert(
      "Delete Team Member",
      `Are you sure you want to remove ${member.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const success = await deleteTeamMemberCloud(member.id);
            if (success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await loadMembers();
            } else {
              Alert.alert("Error", "Failed to delete team member.");
            }
          },
        },
      ]
    );
  };

  // Filter members based on search
  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const query = search.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.role?.toLowerCase().includes(query) ||
        m.email?.toLowerCase().includes(query)
    );
  }, [members, search]);

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Team Members",
          headerTitleAlign: "center",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
        }}
      />
      <GradientBackground>
        <GestureHandlerRootView style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.accent}
              />
            }
          >
            {/* Header Row with Add Button */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pageTitle}>Workers</Text>
                <Text style={styles.pageSubtitle}>Track labor costs per team member</Text>
              </View>
              <Pressable style={styles.addButtonHeader} onPress={openAddModal}>
                <Ionicons name="add" size={20} color="#000" />
                <Text style={styles.addButtonHeaderText}>Add</Text>
              </Pressable>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: "#34C759" }]}>{stats.active}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: theme.colors.muted }]}>
                  {stats.total - stats.active}
                </Text>
                <Text style={styles.statLabel}>Inactive</Text>
              </View>
            </View>

            {/* Info Box */}
            {!infoDismissed && (
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="#3B82F6" />
                <Text style={styles.infoText}>
                  Workers receive SMS notifications for job assignments. Tap avatar to toggle active/inactive. Swipe left to delete.
                </Text>
                <Pressable onPress={dismissInfo} hitSlop={8}>
                  <Ionicons name="close" size={18} color={isDark ? "#93C5FD" : "#1D4ED8"} />
                </Pressable>
              </View>
            )}

            {/* Techs Portal Note */}
            {!techsDismissed && (
              <View style={styles.techsNote}>
                <Ionicons name="phone-portrait-outline" size={18} color="#5856D6" />
                <Text style={styles.techsNoteText}>
                  Need team members with app access? Manage <Text style={styles.techsNoteLink}>Techs</Text> from the web portal at portal.quotecat.ai
                </Text>
                <Pressable onPress={dismissTechs} hitSlop={8}>
                  <Ionicons name="close" size={18} color={isDark ? "#C4B5FD" : "#5B21B6"} />
                </Pressable>
              </View>
            )}

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={18}
                color={theme.colors.muted}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search team members..."
                placeholderTextColor={theme.colors.muted}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
                </Pressable>
              )}
            </View>

            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
              </View>
            ) : filteredMembers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="people-outline"
                  size={64}
                  color={theme.colors.muted}
                />
                <Text style={styles.emptyTitle}>
                  {search ? "No Results" : "No Team Members"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {search
                    ? "Try a different search"
                    : "Add your workers to track labor costs per person"}
                </Text>
                {!search && (
                  <Pressable style={styles.addButton} onPress={openAddModal}>
                    <Ionicons name="add" size={20} color="#000" />
                    <Text style={styles.addButtonText}>Add Team Member</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.list}>
                {filteredMembers.map((member) => (
                  <SwipeableMemberCard
                    key={member.id}
                    member={member}
                    onEdit={() => openEditModal(member)}
                    onDelete={() => handleDelete(member)}
                    onToggleActive={() => handleToggleActive(member)}
                    theme={theme}
                    isDark={isDark}
                  />
                ))}
                <Text style={styles.hint}>Swipe left to delete</Text>
              </View>
            )}
          </ScrollView>
        </GestureHandlerRootView>
      </GradientBackground>

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>
              {editingMember ? "Edit Team Member" : "New Team Member"}
            </Text>
            <Pressable onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.formLabel}>Name *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Worker name"
              placeholderTextColor={theme.colors.muted}
              value={formName}
              onChangeText={setFormName}
              autoCapitalize="words"
            />

            <Text style={styles.formLabel}>Role</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g., Journeyman, Apprentice, Foreman"
              placeholderTextColor={theme.colors.muted}
              value={formRole}
              onChangeText={setFormRole}
              autoCapitalize="words"
            />

            <Text style={styles.formLabel}>Default Rate ($/hr)</Text>
            <View style={styles.currencyInput}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={[styles.formInput, styles.currencyTextInput]}
                placeholder="0.00"
                placeholderTextColor={theme.colors.muted}
                value={formRate}
                onChangeText={(text) => setFormRate(text.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
              />
            </View>

            <Text style={styles.formLabel}>Phone</Text>
            <TextInput
              style={styles.formInput}
              placeholder="(555) 123-4567"
              placeholderTextColor={theme.colors.muted}
              value={formPhone}
              onChangeText={(text) => setFormPhone(formatPhoneNumber(text))}
              keyboardType="phone-pad"
            />

            <Text style={styles.formLabel}>Email</Text>
            <TextInput
              style={styles.formInput}
              placeholder="worker@email.com"
              placeholderTextColor={theme.colors.muted}
              value={formEmail}
              onChangeText={setFormEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// Swipeable member card component
function SwipeableMemberCard({
  member,
  onEdit,
  onDelete,
  onToggleActive,
  theme,
  isDark,
}: {
  member: TeamMember;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
  isDark: boolean;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const isActive = member.isActive !== false; // Default to active if undefined

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        style={[
          {
            flexDirection: "row",
            transform: [{ translateX }],
          },
        ]}
      >
        <Pressable
          style={{
            backgroundColor: "#FF3B30",
            justifyContent: "center",
            alignItems: "center",
            width: 80,
            borderTopRightRadius: theme.radius.md,
            borderBottomRightRadius: theme.radius.md,
          }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            swipeableRef.current?.close();
            onDelete();
          }}
        >
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
            Delete
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  const isTech = member.isTechAccount === true;

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={isTech ? undefined : renderRightActions}
      friction={2}
      overshootRight={false}
      enabled={!isTech}
    >
      <Pressable
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: isTech
            ? "#FF8C42" + "50"
            : isActive
              ? theme.colors.border
              : theme.colors.muted + "50",
          padding: theme.spacing(2),
          marginBottom: theme.spacing(1.5),
          opacity: isActive ? 1 : 0.7,
        }}
        onPress={isTech ? undefined : onEdit}
      >
        {/* Avatar / Status Toggle */}
        <TouchableOpacity
          onPress={isTech ? undefined : onToggleActive}
          activeOpacity={isTech ? 1 : 0.7}
          disabled={isTech}
          style={{
            marginRight: theme.spacing(1.5),
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: isTech
                ? isDark ? "#3D2B1F" : "#FFF3E0"
                : isActive
                  ? isDark ? "#1B4332" : "#D1FAE5"
                  : isDark ? "#374151" : "#E5E7EB",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: isTech
                ? "#FF8C42"
                : isActive
                  ? "#34C759"
                  : theme.colors.muted,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: isTech
                  ? "#FF8C42"
                  : isActive
                    ? "#34C759"
                    : theme.colors.muted,
              }}
            >
              {member.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Member Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: theme.colors.text,
              }}
            >
              {member.name}
            </Text>
            {!isActive && (
              <View
                style={{
                  backgroundColor: isDark ? "#374151" : "#E5E7EB",
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "600",
                    color: theme.colors.muted,
                  }}
                >
                  INACTIVE
                </Text>
              </View>
            )}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing(1),
              marginTop: 4,
            }}
          >
            {member.role && (
              <View
                style={{
                  backgroundColor: isDark ? "#2B4B7A" : "#DBEAFE",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: isDark ? "#93C5FD" : "#2563EB",
                  }}
                >
                  {member.role}
                </Text>
              </View>
            )}
            {member.defaultRate > 0 && (
              <View
                style={{
                  backgroundColor: isDark ? "#1F2D1F" : "#D1FAE5",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#34C759",
                  }}
                >
                  ${member.defaultRate.toFixed(2)}/hr
                </Text>
              </View>
            )}
          </View>

          {/* Contact Info Row */}
          {(member.phone || member.email) && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }}>
              {member.phone && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="call-outline" size={12} color={theme.colors.muted} />
                  <Text style={{ fontSize: 12, color: theme.colors.muted }}>
                    {member.phone}
                  </Text>
                </View>
              )}
              {member.email && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="mail-outline" size={12} color={theme.colors.muted} />
                  <Text style={{ fontSize: 12, color: theme.colors.muted }} numberOfLines={1}>
                    {member.email}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
      </Pressable>
    </Swipeable>
  );
}

function createStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  isDark: boolean
) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(4),
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing(2),
    },
    pageTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    pageSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: 2,
    },
    addButtonHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: theme.radius.md,
    },
    addButtonHeaderText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#000",
    },
    statsRow: {
      flexDirection: "row",
      gap: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1.5),
      alignItems: "center",
    },
    statValue: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    infoBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing(1.5),
      backgroundColor: isDark ? "#1E3A5F" : "#EFF6FF",
      borderRadius: theme.radius.md,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: isDark ? "#2563EB40" : "#BFDBFE",
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: isDark ? "#93C5FD" : "#1D4ED8",
      lineHeight: 18,
    },
    techsNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing(1.5),
      backgroundColor: isDark ? "#2D2640" : "#F3F0FF",
      borderRadius: theme.radius.md,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: isDark ? "#5856D640" : "#DDD6FE",
    },
    techsNoteText: {
      flex: 1,
      fontSize: 13,
      color: isDark ? "#C4B5FD" : "#5B21B6",
      lineHeight: 18,
    },
    techsNoteLink: {
      fontWeight: "700",
      color: "#5856D6",
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
    },
    searchIcon: {
      marginRight: theme.spacing(1),
    },
    searchInput: {
      flex: 1,
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: theme.spacing(8),
    },
    emptyState: {
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: theme.spacing(8),
      paddingHorizontal: theme.spacing(4),
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginTop: theme.spacing(2),
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      marginTop: theme.spacing(1),
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.lg,
      marginTop: theme.spacing(3),
    },
    addButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    list: {
      flex: 1,
    },
    hint: {
      fontSize: 12,
      color: theme.colors.muted,
      textAlign: "center",
      marginTop: theme.spacing(1),
    },
    // Modal styles
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    modalCancel: {
      fontSize: 16,
      color: theme.colors.text,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.text,
    },
    modalSave: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    modalContent: {
      flex: 1,
      padding: theme.spacing(2),
    },
    formLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.muted,
      marginBottom: theme.spacing(1),
      marginTop: theme.spacing(2),
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    formInput: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
    },
    currencyInput: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingLeft: theme.spacing(2),
    },
    currencySymbol: {
      fontSize: 16,
      color: theme.colors.muted,
    },
    currencyTextInput: {
      flex: 1,
      borderWidth: 0,
      backgroundColor: "transparent",
    },
  });
}
