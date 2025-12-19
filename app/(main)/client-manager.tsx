// app/(main)/client-manager.tsx
// Pro tool for managing saved clients
import { useTheme } from "@/contexts/ThemeContext";
import { getUserState } from "@/lib/user";
import {
  getClients,
  saveClient,
  deleteClient,
  createClientId,
  setLastCreatedClientId,
  type Client,
} from "@/lib/clients";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { Ionicons } from "@expo/vector-icons";
import { HeaderBackButton } from "@/components/HeaderBackButton";

export default function ClientManager() {
  const { theme } = useTheme();
  const router = useRouter();
  const { returnTo, createNew } = useLocalSearchParams<{ returnTo?: string; createNew?: string }>();
  const [clients, setClients] = useState<Client[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const loadClients = useCallback(async () => {
    const data = await getClients();
    // Sort by name
    data.sort((a, b) => a.name.localeCompare(b.name));
    setClients(data);
  }, []);

  // Load Pro status and clients
  React.useEffect(() => {
    const load = async () => {
      const user = await getUserState();
      setIsPro(user.tier === "pro" || user.tier === "premium");
    };
    load();
  }, []);

  // Reload clients when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadClients();
    }, [loadClients])
  );

  // Auto-open create modal if createNew param is set
  React.useEffect(() => {
    if (createNew === "true" && isPro) {
      resetForm();
      setShowModal(true);
    }
  }, [createNew, isPro]);

  const filteredClients = React.useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
    );
  }, [clients, searchQuery]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setNotes("");
    setEditingClient(null);
  };

  // Format phone number as (XXX) XXX-XXXX
  const formatPhoneNumber = (text: string): string => {
    // Remove all non-digits
    const digits = text.replace(/\D/g, "");

    // Format based on length
    if (digits.length === 0) return "";
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhoneNumber(text));
  };

  const handleAddClient = () => {
    if (!isPro) {
      // Pro feature - button should be disabled for free users
      return;
    }
    resetForm();
    setShowModal(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setEmail(client.email || "");
    setPhone(client.phone || "");
    setAddress(client.address || "");
    setNotes(client.notes || "");
    setShowModal(true);
  };

  const handleSaveClient = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Name Required", "Please enter a client name.");
      return;
    }

    try {
      const client: Client = {
        id: editingClient?.id || createClientId(),
        name: trimmedName,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: editingClient?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveClient(client);
      setShowModal(false);
      resetForm();

      // If we came from quote edit (creating new client), save the ID and go back
      if (returnTo && !editingClient) {
        await setLastCreatedClientId(client.id);
        router.back();
        return;
      }

      await loadClients();
    } catch (error) {
      console.error("Failed to save client:", error);
      Alert.alert("Error", "Failed to save client. Please try again.");
    }
  };

  const handleDeleteClient = (client: Client) => {
    Alert.alert(
      "Delete Client",
      `Are you sure you want to delete "${client.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteClient(client.id);
              await loadClients();
            } catch {
              Alert.alert("Error", "Failed to delete client.");
            }
          },
        },
      ]
    );
  };

  const renderRightActions = (client: Client) => (
    <View style={styles.swipeActions}>
      <Pressable
        style={styles.editAction}
        onPress={() => handleEditClient(client)}
      >
        <Text style={styles.editText}>Edit</Text>
      </Pressable>
      <Pressable
        style={styles.deleteAction}
        onPress={() => handleDeleteClient(client)}
      >
        <Text style={styles.deleteText}>Delete</Text>
      </Pressable>
    </View>
  );

  const renderClient = ({ item }: { item: Client }) => (
    <Swipeable renderRightActions={() => renderRightActions(item)}>
      <Pressable
        style={styles.clientCard}
        onPress={() => handleEditClient(item)}
      >
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{item.name}</Text>
          {(item.email || item.phone) && (
            <Text style={styles.clientContact}>
              {[item.email, item.phone].filter(Boolean).join(" · ")}
            </Text>
          )}
          {item.address && (
            <Text style={styles.clientAddress} numberOfLines={1}>
              {item.address}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
      </Pressable>
    </Swipeable>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "Client Manager",
          headerShown: true,
          headerTitleAlign: "center",
          headerBackTitle: "Back",
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: {
            color: theme.colors.text,
          },
        }}
      />

      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>
              Save client info to quickly add to quotes
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search clients..."
              placeholderTextColor={theme.colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery("")}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Clients Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Clients ({filteredClients.length})
              </Text>
              <Pressable
                style={styles.createButton}
                onPress={handleAddClient}
              >
                <Text style={styles.createButtonText}>+ New</Text>
              </Pressable>
            </View>

            {/* Client List */}
            {filteredClients.length === 0 ? (
              <View style={styles.emptyStateSimple}>
                <Text style={styles.emptyTextSimple}>
                  {searchQuery
                    ? `No clients match "${searchQuery}"`
                    : isPro
                    ? "No clients yet. Tap + New to add your first client."
                    : "No clients yet. Pro users can save clients."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredClients}
                keyExtractor={(item) => item.id}
                renderItem={renderClient}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </ScrollView>
      </View>

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowModal(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalOverlayInner}
            onPress={() => {
              setShowModal(false);
              resetForm();
            }}
          >
            <Pressable style={styles.modalContent} onPress={() => Keyboard.dismiss()}>
            <Text style={styles.modalTitle}>
              {editingClient ? "Edit Client" : "New Client"}
            </Text>
            <Text style={styles.modalDescription}>
              {editingClient ? "Update client information" : "Enter client details"}
            </Text>

            <ScrollView
              style={styles.formScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Client name"
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="words"
                  autoFocus={!editingClient}
                />
              </View>

              {/* Email */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email</Text>
                <TextInput
                  style={styles.formInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                />
              </View>

              {/* Phone */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone</Text>
                <TextInput
                  style={styles.formInput}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Address */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Address</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMultiline]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="123 Main St, City, State ZIP"
                  placeholderTextColor={theme.colors.muted}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMultiline]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional notes..."
                  placeholderTextColor={theme.colors.muted}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalSaveBtn}
                onPress={handleSaveClient}
              >
                <Text style={styles.modalSaveText}>
                  {editingClient ? "Save" : "Add"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </GestureHandlerRootView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    content: {
      padding: theme.spacing(3),
    },
    descriptionContainer: {
      paddingBottom: theme.spacing(1.5),
    },
    description: {
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
    },
    searchContainer: {
      position: "relative",
      marginBottom: theme.spacing(3),
    },
    searchInput: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
      paddingRight: 40,
    },
    clearButton: {
      position: "absolute",
      right: 12,
      top: 12,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.muted,
      justifyContent: "center",
      alignItems: "center",
    },
    clearButtonText: {
      color: theme.colors.bg,
      fontSize: 14,
      fontWeight: "700",
    },
    section: {
      marginBottom: theme.spacing(3),
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1.5),
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    createButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(0.75),
      borderRadius: theme.radius.md,
    },
    createButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#000",
    },
    emptyStateSimple: {
      paddingVertical: theme.spacing(3),
      alignItems: "center",
    },
    emptyTextSimple: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 20,
    },
    clientCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
    },
    clientInfo: {
      flex: 1,
    },
    clientName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    clientContact: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    clientAddress: {
      fontSize: 13,
      color: theme.colors.muted,
      marginTop: 2,
    },
    swipeActions: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing(1.5),
    },
    editAction: {
      backgroundColor: theme.colors.accent,
      justifyContent: "center",
      alignItems: "center",
      width: 70,
      borderRadius: theme.radius.lg,
      marginLeft: theme.spacing(1),
    },
    editText: {
      color: "#000",
      fontWeight: "700",
      fontSize: 14,
    },
    deleteAction: {
      backgroundColor: theme.colors.danger,
      justifyContent: "center",
      alignItems: "center",
      width: 70,
      borderRadius: theme.radius.lg,
      marginLeft: theme.spacing(1),
    },
    deleteText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
    },
    modalOverlayInner: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      padding: theme.spacing(3),
      width: "90%",
      maxWidth: 420,
      maxHeight: "85%",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    modalDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1.5),
    },
    formScroll: {
      flexGrow: 0,
    },
    formGroup: {
      marginBottom: theme.spacing(2),
    },
    formLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
      marginBottom: theme.spacing(0.75),
    },
    formInput: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
    },
    formInputMultiline: {
      minHeight: 60,
      textAlignVertical: "top",
    },
    modalButtons: {
      flexDirection: "row",
      gap: theme.spacing(1.5),
      marginTop: theme.spacing(2),
    },
    modalCancelBtn: {
      flex: 1,
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    modalCancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    modalSaveBtn: {
      flex: 1,
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
    },
    modalSaveText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
  });
}
