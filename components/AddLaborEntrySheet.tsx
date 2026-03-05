// components/AddLaborEntrySheet.tsx
// Modal for adding/editing labor entries (Premium multi-worker tracking)

import React, { useState, useEffect } from "react";
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
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { LaborEntry, TeamMember, computeLaborEntryTotal } from "@/lib/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (entry: LaborEntry) => void;
  teamMembers: TeamMember[];
  defaultRate?: number;
  editingEntry?: LaborEntry | null;
  showRate?: boolean; // Whether to show rate/pricing (defaults to true)
};

function generateId(): string {
  return `labor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function AddLaborEntrySheet({
  visible,
  onClose,
  onSave,
  teamMembers,
  defaultRate = 0,
  editingEntry,
  showRate = true,
}: Props) {
  const { theme, mode } = useTheme();
  const isDark = mode === "dark";
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  // Form state
  const [mode_, setMode] = useState<"flat" | "calculated">("calculated");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState(defaultRate > 0 ? defaultRate.toString() : "");
  const [flatAmount, setFlatAmount] = useState("");
  const [notes, setNotes] = useState("");

  // Reset form when modal opens/closes or editing entry changes
  useEffect(() => {
    if (visible) {
      if (editingEntry) {
        // Populate form with existing entry data
        setSelectedWorkerId(editingEntry.workerId || "");
        setName(editingEntry.name || "");
        setRole(editingEntry.role || "");
        setNotes(editingEntry.notes || "");

        if (editingEntry.flatAmount !== undefined && editingEntry.flatAmount > 0) {
          setMode("flat");
          setFlatAmount(editingEntry.flatAmount.toString());
          setHours("");
          setRate("");
        } else {
          setMode("calculated");
          setHours(editingEntry.hours?.toString() || "");
          setRate(editingEntry.rate?.toString() || defaultRate.toString());
          setFlatAmount("");
        }
      } else {
        // Reset for new entry
        setSelectedWorkerId("");
        setName("");
        setRole("");
        setHours("");
        setRate(defaultRate > 0 ? defaultRate.toString() : "");
        setFlatAmount("");
        setNotes("");
        setMode("calculated");
      }
    }
  }, [visible, editingEntry, defaultRate]);

  // Auto-fill when selecting a team member
  const handleSelectTeamMember = (memberId: string) => {
    setSelectedWorkerId(memberId);
    if (memberId) {
      const member = teamMembers.find((m) => m.id === memberId);
      if (member) {
        setName(member.name);
        setRole(member.role || "");
        if (member.defaultRate > 0) {
          setRate(member.defaultRate.toString());
        }
      }
    }
  };

  const handleSave = () => {
    const entry: LaborEntry = {
      id: editingEntry?.id || generateId(),
      workerId: selectedWorkerId || undefined,
      name: name.trim() || undefined,
      role: role.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (mode_ === "flat") {
      entry.flatAmount = parseFloat(flatAmount) || 0;
    } else {
      entry.hours = parseFloat(hours) || 0;
      entry.rate = parseFloat(rate) || 0;
    }

    onSave(entry);
    onClose();
  };

  const canSave =
    mode_ === "flat"
      ? flatAmount && parseFloat(flatAmount) > 0
      : showRate
        ? hours && rate && parseFloat(hours) > 0 && parseFloat(rate) > 0
        : hours && parseFloat(hours) > 0; // When showRate is false, only hours required

  const previewTotal =
    mode_ === "calculated" && hours && rate
      ? (parseFloat(hours) || 0) * (parseFloat(rate) || 0)
      : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>
            {editingEntry ? "Edit Labor Entry" : "Add Labor Entry"}
          </Text>
          <Pressable
            onPress={handleSave}
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            disabled={!canSave}
          >
            <Text
              style={[styles.saveText, !canSave && styles.saveTextDisabled]}
            >
              {editingEntry ? "Update" : "Add"}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Team Member Picker */}
          {teamMembers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Select Team Member</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.memberPicker}
              >
                <Pressable
                  style={[
                    styles.memberChip,
                    !selectedWorkerId && styles.memberChipSelected,
                  ]}
                  onPress={() => handleSelectTeamMember("")}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={16}
                    color={!selectedWorkerId ? "#fff" : theme.colors.text}
                  />
                  <Text
                    style={[
                      styles.memberChipText,
                      !selectedWorkerId && styles.memberChipTextSelected,
                    ]}
                  >
                    Custom
                  </Text>
                </Pressable>
                {teamMembers.map((member) => (
                  <Pressable
                    key={member.id}
                    style={[
                      styles.memberChip,
                      selectedWorkerId === member.id && styles.memberChipSelected,
                    ]}
                    onPress={() => handleSelectTeamMember(member.id)}
                  >
                    <Text
                      style={[
                        styles.memberChipText,
                        selectedWorkerId === member.id &&
                          styles.memberChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {member.name}
                    </Text>
                    {member.role && (
                      <Text
                        style={[
                          styles.memberChipRole,
                          selectedWorkerId === member.id &&
                            styles.memberChipRoleSelected,
                        ]}
                      >
                        {member.role}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Name & Role (shown when custom entry) */}
          {!selectedWorkerId && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Name / Description</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Mike, Drive time, Cleanup"
                placeholderTextColor={theme.colors.muted}
              />
              <View style={styles.spacer} />
              <Text style={styles.sectionLabel}>Role (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={role}
                onChangeText={setRole}
                placeholder="e.g., Journeyman, Apprentice"
                placeholderTextColor={theme.colors.muted}
              />
            </View>
          )}

          {/* Mode Toggle - only show if rates are visible */}
          {showRate && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Pricing Type</Text>
              <View style={styles.modeToggle}>
                <Pressable
                  style={[
                    styles.modeButton,
                    mode_ === "calculated" && styles.modeButtonSelected,
                  ]}
                  onPress={() => setMode("calculated")}
                >
                  <Ionicons
                    name="calculator-outline"
                    size={18}
                    color={
                      mode_ === "calculated" ? "#fff" : theme.colors.text
                    }
                  />
                  <Text
                    style={[
                      styles.modeButtonText,
                      mode_ === "calculated" && styles.modeButtonTextSelected,
                    ]}
                  >
                    Hours x Rate
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modeButton,
                    mode_ === "flat" && styles.modeButtonSelected,
                  ]}
                  onPress={() => setMode("flat")}
                >
                  <Ionicons
                    name="cash-outline"
                    size={18}
                    color={mode_ === "flat" ? "#fff" : theme.colors.text}
                  />
                  <Text
                    style={[
                      styles.modeButtonText,
                      mode_ === "flat" && styles.modeButtonTextSelected,
                    ]}
                  >
                    Flat Rate
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Hours × Rate Inputs (or just Hours if showRate is false) */}
          {mode_ === "calculated" && (
            <View style={styles.section}>
              <View style={showRate ? styles.row : undefined}>
                <View style={showRate ? styles.halfInput : undefined}>
                  <Text style={styles.sectionLabel}>Hours</Text>
                  <TextInput
                    style={styles.textInput}
                    value={hours}
                    onChangeText={setHours}
                    placeholder="0"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>
                {showRate && (
                  <View style={styles.halfInput}>
                    <Text style={styles.sectionLabel}>Rate ($/hr)</Text>
                    <View style={styles.currencyInput}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={[styles.textInput, styles.currencyTextInput]}
                        value={rate}
                        onChangeText={setRate}
                        placeholder="0.00"
                        placeholderTextColor={theme.colors.muted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                )}
              </View>
              {showRate && previewTotal !== null && previewTotal > 0 && (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Total:</Text>
                  <Text style={styles.previewValue}>
                    $
                    {previewTotal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Flat Amount Input - only show if rates are visible */}
          {showRate && mode_ === "flat" && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Amount</Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={[styles.textInput, styles.currencyTextInput]}
                  value={flatAmount}
                  onChangeText={setFlatAmount}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          )}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional details..."
              placeholderTextColor={theme.colors.muted}
              multiline
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    closeButton: {
      padding: 4,
    },
    cancelText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    title: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.text,
    },
    saveButton: {
      padding: 4,
    },
    saveButtonDisabled: {
      opacity: 0.4,
    },
    saveText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    saveTextDisabled: {
      color: theme.colors.muted,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.muted,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    textInput: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text,
    },
    spacer: {
      height: 12,
    },
    memberPicker: {
      flexDirection: "row",
    },
    memberChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginRight: 8,
    },
    memberChipSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    memberChipText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.text,
    },
    memberChipTextSelected: {
      color: "#fff",
    },
    memberChipRole: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    memberChipRoleSelected: {
      color: "rgba(255,255,255,0.7)",
    },
    modeToggle: {
      flexDirection: "row",
      gap: 10,
    },
    modeButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: theme.colors.card,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    modeButtonSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    modeButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    modeButtonTextSelected: {
      color: "#fff",
    },
    row: {
      flexDirection: "row",
      gap: 12,
    },
    halfInput: {
      flex: 1,
    },
    currencyInput: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingLeft: 14,
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
    previewRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      marginTop: 12,
      gap: 8,
    },
    previewLabel: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    previewValue: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    notesInput: {
      minHeight: 80,
      textAlignVertical: "top",
    },
  });
}
