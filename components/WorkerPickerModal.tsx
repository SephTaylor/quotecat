// components/WorkerPickerModal.tsx
// Modal for selecting multiple workers to assign to a quote (Premium)

import React, { useState, useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import type { TeamMember, LaborEntry } from "@/lib/types";
import { uploadTeamMember } from "@/lib/teamMembersSync";

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (entries: LaborEntry[]) => void;
  teamMembers: TeamMember[];
  existingEntries: LaborEntry[]; // To show which workers are already assigned
  defaultHours?: number; // Default hours per worker (e.g., 8)
  onTeamMembersChanged?: () => void; // Callback when a new member is added
};

function generateId(): string {
  return `labor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function WorkerPickerModal({
  visible,
  onClose,
  onConfirm,
  teamMembers,
  existingEntries,
  defaultHours = 8,
  onTeamMembersChanged,
}: Props) {
  const { theme, mode } = useTheme();
  const isDark = mode === "dark";
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // New worker form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset selection when modal opens
  React.useEffect(() => {
    if (visible) {
      setSelectedIds(new Set());
      setSearch("");
      setShowNewForm(false);
      setNewName("");
      setNewRole("");
      setNewRate("");
    }
  }, [visible]);

  // Filter team members based on search
  const filteredMembers = useMemo(() => {
    if (!search.trim()) return teamMembers;
    const query = search.toLowerCase();
    return teamMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.role?.toLowerCase().includes(query)
    );
  }, [teamMembers, search]);

  // Check if a worker is already assigned
  const isAlreadyAssigned = (memberId: string) => {
    return existingEntries.some((e) => e.workerId === memberId);
  };

  // Toggle worker selection
  const toggleWorker = (memberId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  // Handle confirm - create labor entries for selected workers
  const handleConfirm = () => {
    const newEntries: LaborEntry[] = [];

    selectedIds.forEach((memberId) => {
      const member = teamMembers.find((m) => m.id === memberId);
      if (member) {
        newEntries.push({
          id: generateId(),
          workerId: member.id,
          name: member.name,
          role: member.role || undefined,
          hours: 0,  // Start with 0 - user fills in actual hours
          rate: member.defaultRate || 0,
        });
      }
    });

    onConfirm(newEntries);
    onClose();
  };

  // Handle creating a new worker
  const handleCreateWorker = async () => {
    if (!newName.trim()) return;

    setSaving(true);
    try {
      const created = await uploadTeamMember({
        name: newName.trim(),
        role: newRole.trim() || undefined,
        defaultRate: parseFloat(newRate) || 0,
      });

      if (created) {
        // Select the new worker
        setSelectedIds((prev) => new Set([...prev, created.id]));
        setShowNewForm(false);
        setNewName("");
        setNewRole("");
        setNewRate("");
        // Notify parent to refresh team members
        onTeamMembersChanged?.();
      }
    } catch (error) {
      console.error("Failed to create worker:", error);
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>Assign Workers</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>

            {/* New Worker Form */}
            {showNewForm ? (
              <View style={styles.newWorkerForm}>
                <Text style={styles.newWorkerTitle}>New Team Member</Text>
                <TextInput
                  style={styles.newWorkerInput}
                  placeholder="Name *"
                  placeholderTextColor={theme.colors.muted}
                  value={newName}
                  onChangeText={setNewName}
                  autoCapitalize="words"
                  autoFocus
                />
                <View style={styles.newWorkerRow}>
                  <TextInput
                    style={[styles.newWorkerInput, { flex: 1 }]}
                    placeholder="Role"
                    placeholderTextColor={theme.colors.muted}
                    value={newRole}
                    onChangeText={setNewRole}
                    autoCapitalize="words"
                  />
                  <View style={styles.rateInputWrapper}>
                    <Text style={styles.ratePrefix}>$</Text>
                    <TextInput
                      style={[styles.newWorkerInput, styles.rateInput]}
                      placeholder="0"
                      placeholderTextColor={theme.colors.muted}
                      value={newRate}
                      onChangeText={(t) => setNewRate(t.replace(/[^0-9.]/g, ""))}
                      keyboardType="decimal-pad"
                    />
                    <Text style={styles.rateSuffix}>/hr</Text>
                  </View>
                </View>
                <View style={styles.newWorkerActions}>
                  <Pressable
                    style={styles.newWorkerCancel}
                    onPress={() => setShowNewForm(false)}
                  >
                    <Text style={styles.newWorkerCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.newWorkerSave,
                      !newName.trim() && styles.newWorkerSaveDisabled,
                    ]}
                    onPress={handleCreateWorker}
                    disabled={!newName.trim() || saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={styles.newWorkerSaveText}>Add</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                {/* Search */}
                <View style={styles.searchContainer}>
                  <Ionicons
                    name="search"
                    size={18}
                    color={theme.colors.muted}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search workers..."
                    placeholderTextColor={theme.colors.muted}
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable
                    onPress={() => setShowNewForm(true)}
                    hitSlop={8}
                    style={styles.addNewBtn}
                  >
                    <Ionicons name="add-circle" size={24} color={theme.colors.accent} />
                  </Pressable>
                </View>

                {/* Worker List */}
                <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                  {filteredMembers.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {search ? "No workers found" : "No team members yet"}
                    </Text>
                  ) : (
                    filteredMembers.map((member) => {
                      const alreadyAssigned = isAlreadyAssigned(member.id);
                      const isSelected = selectedIds.has(member.id);

                      return (
                        <Pressable
                          key={member.id}
                          style={[
                            styles.workerRow,
                            alreadyAssigned && styles.workerRowDisabled,
                          ]}
                          onPress={() => {
                            if (!alreadyAssigned) {
                              toggleWorker(member.id);
                            }
                          }}
                          disabled={alreadyAssigned}
                        >
                          <View style={styles.checkbox}>
                            {alreadyAssigned ? (
                              <Ionicons
                                name="checkmark-circle"
                                size={24}
                                color={theme.colors.muted}
                              />
                            ) : isSelected ? (
                              <Ionicons
                                name="checkbox"
                                size={24}
                                color={theme.colors.accent}
                              />
                            ) : (
                              <Ionicons
                                name="square-outline"
                                size={24}
                                color={theme.colors.border}
                              />
                            )}
                          </View>
                          <View style={styles.workerInfo}>
                            <Text
                              style={[
                                styles.workerName,
                                alreadyAssigned && styles.workerNameDisabled,
                              ]}
                            >
                              {member.name}
                            </Text>
                            <View style={styles.workerMeta}>
                              {member.role && (
                                <Text style={styles.workerRole}>{member.role}</Text>
                              )}
                              {member.defaultRate > 0 && (
                                <Text style={styles.workerRate}>
                                  ${member.defaultRate.toFixed(2)}/hr
                                </Text>
                              )}
                              {alreadyAssigned && (
                                <Text style={styles.assignedBadge}>Assigned</Text>
                              )}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </>
            )}

          {/* Footer */}
          {!showNewForm && (
            <View style={styles.footer}>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmBtn,
                  selectedCount === 0 && styles.confirmBtnDisabled,
                ]}
                onPress={handleConfirm}
                disabled={selectedCount === 0}
              >
                <Text
                  style={[
                    styles.confirmText,
                    selectedCount === 0 && styles.confirmTextDisabled,
                  ]}
                >
                  {selectedCount > 0
                    ? `Add ${selectedCount} Worker${selectedCount > 1 ? "s" : ""}`
                    : "Select Workers"}
                </Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  isDark: boolean
) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    content: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      padding: theme.spacing(3),
      width: "90%",
      maxWidth: 400,
      maxHeight: "80%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(2),
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.bg,
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
    list: {
      maxHeight: 300,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      paddingVertical: theme.spacing(4),
    },
    workerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing(1.5),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    workerRowDisabled: {
      opacity: 0.5,
    },
    checkbox: {
      marginRight: theme.spacing(1.5),
    },
    workerInfo: {
      flex: 1,
    },
    workerName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    workerNameDisabled: {
      color: theme.colors.muted,
    },
    workerMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      marginTop: 2,
    },
    workerRole: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    workerRate: {
      fontSize: 13,
      color: theme.colors.accent,
      fontWeight: "500",
    },
    assignedBadge: {
      fontSize: 11,
      color: isDark ? "#8CB4E8" : "#2563EB",
      backgroundColor: isDark ? "#2B4B7A" : "#E8F4FF",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      overflow: "hidden",
    },
    footer: {
      flexDirection: "row",
      gap: theme.spacing(2),
      marginTop: theme.spacing(2),
    },
    cancelBtn: {
      flex: 1,
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    cancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    confirmBtn: {
      flex: 2,
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
    },
    confirmBtnDisabled: {
      opacity: 0.4,
    },
    confirmText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    confirmTextDisabled: {
      color: "#666",
    },
    keyboardView: {
      flex: 1,
    },
    addNewBtn: {
      marginLeft: theme.spacing(1),
    },
    // New worker form styles
    newWorkerForm: {
      paddingBottom: theme.spacing(2),
    },
    newWorkerTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    newWorkerInput: {
      backgroundColor: theme.colors.bg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: theme.spacing(1.5),
    },
    newWorkerRow: {
      flexDirection: "row",
      gap: theme.spacing(1.5),
    },
    rateInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.bg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(1),
      minWidth: 100,
    },
    ratePrefix: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.muted,
      marginRight: 2,
    },
    rateInput: {
      flex: 1,
      borderWidth: 0,
      backgroundColor: "transparent",
      marginBottom: 0,
      paddingVertical: 0,
      paddingHorizontal: 4,
      minWidth: 40,
      textAlign: "center",
      fontSize: 16,
      fontWeight: "600",
    },
    rateSuffix: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.muted,
    },
    newWorkerActions: {
      flexDirection: "row",
      gap: theme.spacing(1.5),
      marginTop: theme.spacing(1),
    },
    newWorkerCancel: {
      flex: 1,
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    newWorkerCancelText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    newWorkerSave: {
      flex: 1,
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
    },
    newWorkerSaveDisabled: {
      opacity: 0.4,
    },
    newWorkerSaveText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#000",
    },
  });
}

export default WorkerPickerModal;
