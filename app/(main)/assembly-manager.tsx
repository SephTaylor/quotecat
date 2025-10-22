// app/(main)/assembly-manager.tsx
// Pro tool for managing custom assemblies
import { useTheme } from "@/contexts/ThemeContext";
import { getUserState } from "@/lib/user";
import { saveAssembly, useAssemblies, deleteAssembly, validateAssembly } from "@/modules/assemblies";
import type { Assembly } from "@/modules/assemblies";
import { useProducts } from "@/modules/catalog";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function AssemblyManager() {
  const router = useRouter();
  const { theme } = useTheme();
  const { assemblies, reload } = useAssemblies();
  const { products } = useProducts();
  const [isPro, setIsPro] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [assemblyName, setAssemblyName] = useState("");
  const [invalidAssemblies, setInvalidAssemblies] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Load Pro status
  React.useEffect(() => {
    const load = async () => {
      const user = await getUserState();
      setIsPro(user.tier === "pro");
    };
    load();
  }, []);

  // Validate all assemblies when products load
  React.useEffect(() => {
    if (assemblies.length > 0 && products.length > 0) {
      const invalid = new Set<string>();
      assemblies.forEach((asm) => {
        const result = validateAssembly(asm, products);
        if (!result.isValid) {
          invalid.add(asm.id);
        }
      });
      setInvalidAssemblies(invalid);
    }
  }, [assemblies, products]);

  const handleCreateAssembly = () => {
    if (!isPro) {
      Alert.alert(
        "Pro Feature",
        "Creating custom assemblies is a Pro feature. Upgrade to Pro to build your template library!",
        [{ text: "OK" }]
      );
      return;
    }

    setShowCreateModal(true);
  };

  const confirmCreateAssembly = async () => {
    const trimmedName = assemblyName.trim();
    if (!trimmedName) {
      Alert.alert("Name Required", "Please enter a name for this assembly.");
      return;
    }

    try {
      // Create empty assembly
      const assembly: Assembly = {
        id: `custom-${Date.now()}`,
        name: trimmedName,
        items: [],
      };

      await saveAssembly(assembly);
      setShowCreateModal(false);
      setAssemblyName("");
      await reload();

      Alert.alert(
        "Assembly Created",
        `"${trimmedName}" has been created. Add products to it now?`,
        [
          { text: "Later", style: "cancel" },
          {
            text: "Add Products",
            onPress: () => router.push(`/(main)/assembly-editor/${assembly.id}` as any),
          },
        ]
      );
    } catch (error) {
      console.error("Failed to create assembly:", error);
      Alert.alert("Error", "Could not create assembly. Please try again.");
    }
  };

  const handleDeleteAssembly = async (assembly: Assembly) => {
    const isCustom = assembly.id.startsWith("custom-");

    if (!isCustom) {
      Alert.alert(
        "Cannot Delete",
        "Built-in assemblies cannot be deleted. Only custom assemblies can be removed.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Delete Assembly?",
      `Are you sure you want to delete "${assembly.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAssembly(assembly.id);
              await reload();
              Alert.alert("Deleted", `"${assembly.name}" has been deleted.`);
            } catch (error) {
              console.error("Failed to delete assembly:", error);
              Alert.alert("Error", "Could not delete assembly. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Filter assemblies by search query
  const filteredAssemblies = React.useMemo(() => {
    if (!searchQuery.trim()) return assemblies;
    const query = searchQuery.toLowerCase();
    return assemblies.filter((a) => a.name.toLowerCase().includes(query));
  }, [assemblies, searchQuery]);

  const customAssemblies = filteredAssemblies.filter((a) => a.id.startsWith("custom-"));
  const builtInAssemblies = filteredAssemblies.filter((a) => !a.id.startsWith("custom-"));

  return (
    <>
      <Stack.Screen
        options={{
          title: "Assembly Manager",
          headerShown: true,
          headerBackTitle: "Pro Tools",
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
              Create and manage reusable material templates
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search assemblies..."
              placeholderTextColor={theme.colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
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

          {/* Custom Assemblies Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Custom Assemblies ({customAssemblies.length})
              </Text>
              <Pressable
                style={styles.createButton}
                onPress={handleCreateAssembly}
              >
                <Text style={styles.createButtonText}>+ New</Text>
              </Pressable>
            </View>

            {customAssemblies.length === 0 ? (
              <View style={styles.emptyStateSimple}>
                <Text style={styles.emptyTextSimple}>
                  {searchQuery.trim()
                    ? `No custom assemblies match "${searchQuery}"`
                    : isPro
                    ? "No custom assemblies yet. Tap + New to create your first template."
                    : "No custom assemblies yet. Pro users can create custom templates."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={customAssemblies}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const isInvalid = invalidAssemblies.has(item.id);
                  return (
                    <Pressable
                      style={[styles.assemblyCard, isInvalid && styles.assemblyCardInvalid]}
                      onPress={() => router.push(`/(main)/assembly-editor/${item.id}` as any)}
                      onLongPress={() => handleDeleteAssembly(item)}
                    >
                      <View style={styles.assemblyHeader}>
                        <Text style={styles.assemblyName}>
                          {isInvalid && "⚠️ "}
                          {item.name}
                        </Text>
                        <View style={styles.customBadge}>
                          <Text style={styles.customBadgeText}>CUSTOM</Text>
                        </View>
                      </View>
                      <Text style={styles.assemblyMeta}>
                        {item.items.length} material{item.items.length !== 1 ? "s" : ""}
                      </Text>
                      {isInvalid && (
                        <Text style={styles.warningText}>
                          Needs review - some products unavailable
                        </Text>
                      )}
                      <Text style={styles.assemblyHint}>
                        Tap to edit • Long press to delete
                      </Text>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>

        </ScrollView>

        {/* Browse Built-In Link - Subtle at bottom */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => router.push("/(main)/built-in-assemblies" as any)}
            style={styles.browseLink}
          >
            <Text style={styles.browseLinkText}>
              Browse {builtInAssemblies.length} built-in assembly templates →
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Create Assembly Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCreateModal(false);
          setAssemblyName("");
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowCreateModal(false);
            setAssemblyName("");
          }}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Create Assembly</Text>
            <Text style={styles.modalDescription}>
              Enter a name for your new assembly template
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Assembly name..."
              placeholderTextColor={theme.colors.muted}
              value={assemblyName}
              onChangeText={setAssemblyName}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowCreateModal(false);
                  setAssemblyName("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalSaveBtn}
                onPress={confirmCreateAssembly}
              >
                <Text style={styles.modalSaveText}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    content: {
      padding: theme.spacing(2),
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
    assemblyCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
    },
    assemblyCardInvalid: {
      borderColor: "#FFC107",
      borderWidth: 2,
      backgroundColor: "#FFF3CD",
    },
    assemblyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(0.5),
    },
    assemblyName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      flex: 1,
    },
    assemblyMeta: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    assemblyHint: {
      fontSize: 11,
      color: theme.colors.muted,
      fontStyle: "italic",
      marginTop: theme.spacing(0.5),
    },
    customBadge: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radius.sm,
    },
    customBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#000",
    },
    warningText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#856404",
      marginTop: 4,
      letterSpacing: 0.5,
    },
    footer: {
      padding: theme.spacing(2),
      paddingTop: theme.spacing(1),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.bg,
    },
    browseLink: {
      padding: theme.spacing(1.5),
      alignItems: "center",
    },
    browseLinkText: {
      fontSize: 14,
      color: theme.colors.accent,
      textAlign: "center",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      padding: theme.spacing(3),
      width: "85%",
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    modalDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(2),
    },
    modalInput: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    modalButtons: {
      flexDirection: "row",
      gap: theme.spacing(1.5),
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
