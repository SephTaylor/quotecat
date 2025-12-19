// app/(main)/(tabs)/invoices.tsx
// Invoices list - Pro feature
import { useTheme } from "@/contexts/ThemeContext";
import type { InvoiceStatus } from "@/lib/types";
import { InvoiceStatusMeta } from "@/lib/types";
import { calculateQuoteTotal } from "@/lib/calculations";
import { Stack } from "expo-router";
import React from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GradientBackground } from "@/components/GradientBackground";
import { Ionicons } from "@expo/vector-icons";
import { SwipeableInvoiceItem } from "@/components/SwipeableInvoiceItem";
import { UndoSnackbar } from "@/components/UndoSnackbar";
import { useInvoiceList } from "@/hooks/useInvoiceList";

export default function InvoicesList() {
  const { theme } = useTheme();
  const filterScrollRef = React.useRef<ScrollView>(null);
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const {
    // State
    filteredInvoices,
    refreshing,
    searchQuery,
    selectedStatus,
    isPro,
    isPremium,
    deletedInvoice,
    showUndo,
    editingStatusForInvoice,
    showQuotePicker,
    showContractPicker,
    showSourcePicker,
    availableQuotes,
    availableContracts,

    // Setters
    setSearchQuery,
    setSelectedStatus,

    // Handlers
    onRefresh,
    handleSignIn,
    handleDeleteInvoice,
    handleUndoDelete,
    handleDismissUndo,
    handleExportInvoice,
    handleUpdateStatus,
    handleSaveStatus,
    handleCloseStatusModal,
    handleViewInvoice,
    handleCopyInvoice,
    handleSelectQuote,
    handleSelectContract,
    handleSelectSource,
    handleCloseQuotePicker,
    handleCloseContractPicker,
    handleCloseSourcePicker,
  } = useInvoiceList();

  // If not Pro, show locked state
  if (!isPro) {
    return (
      <>
        <Stack.Screen options={{ title: "Invoices", headerTitleAlign: "center" }} />
        <GradientBackground>
          <View style={styles.lockedContainer}>
            <Ionicons name="lock-closed" size={64} color={theme.colors.muted} />
            <Text style={styles.lockedTitle}>Invoices</Text>
            <Text style={styles.lockedDescription}>
              Create, track, and manage invoices from your quotes.
            </Text>
            <Pressable style={styles.upgradeButton} onPress={handleSignIn}>
              <Text style={styles.upgradeButtonText}>Sign In</Text>
            </Pressable>
          </View>
        </GradientBackground>
      </>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Invoices", headerTitleAlign: "center" }} />
      <GradientBackground>
        {/* Status Filters */}
        <ScrollView
          ref={filterScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
          style={styles.filterScrollView}
        >
          <FilterChip
            label="All"
            active={selectedStatus === "all"}
            onPress={() => setSelectedStatus("all")}
            theme={theme}
          />
          <FilterChip
            label="Unpaid"
            active={selectedStatus === "unpaid"}
            onPress={() => setSelectedStatus("unpaid")}
            color={InvoiceStatusMeta.unpaid.color}
            theme={theme}
          />
          <FilterChip
            label="Partial"
            active={selectedStatus === "partial"}
            onPress={() => setSelectedStatus("partial")}
            color={InvoiceStatusMeta.partial.color}
            theme={theme}
          />
          <FilterChip
            label="Paid"
            active={selectedStatus === "paid"}
            onPress={() => setSelectedStatus("paid")}
            color={InvoiceStatusMeta.paid.color}
            theme={theme}
          />
          <FilterChip
            label="Overdue"
            active={selectedStatus === "overdue"}
            onPress={() => setSelectedStatus("overdue")}
            color={InvoiceStatusMeta.overdue.color}
            theme={theme}
          />
        </ScrollView>

        {/* Search */}
        <View style={styles.topBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search invoices..."
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Invoice List */}
        <FlatList
          data={filteredInvoices}
          keyExtractor={(inv) => inv.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <SwipeableInvoiceItem
              item={item}
              onPress={() => handleViewInvoice(item)}
              onDelete={() => handleDeleteInvoice(item)}
              onExport={() => handleExportInvoice(item)}
              onUpdateStatus={() => handleUpdateStatus(item)}
              onCopy={() => handleCopyInvoice(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {selectedStatus === "all" && searchQuery === ""
                  ? "No invoices yet"
                  : searchQuery !== ""
                  ? "No matches"
                  : `No ${selectedStatus} invoices`}
              </Text>
              <Text style={styles.emptyDescription}>
                {selectedStatus === "all" && searchQuery === ""
                  ? "Create invoices from quote review screens"
                  : searchQuery !== ""
                  ? "Try a different search term"
                  : "Create invoices from quote review screens"}
              </Text>
            </View>
          }
        />
        <UndoSnackbar
          visible={showUndo}
          message={`Deleted invoice ${deletedInvoice?.invoiceNumber}`}
          onUndo={handleUndoDelete}
          onDismiss={handleDismissUndo}
        />

        {/* Status Selector Modal */}
        <Modal
          visible={editingStatusForInvoice !== null}
          transparent
          animationType="fade"
          onRequestClose={handleCloseStatusModal}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={handleCloseStatusModal}
          >
            <View style={styles.modalContainer}>
              <Pressable
                style={styles.statusModal}
                onPress={(e) => e.stopPropagation()}
              >
                <Text style={styles.modalTitle}>Update Status</Text>
                <Text style={styles.modalSubtitle}>
                  Current: {editingStatusForInvoice ? InvoiceStatusMeta[editingStatusForInvoice.status].label : ''}
                </Text>

                {(["unpaid", "partial", "paid", "overdue"] as const).map((status) => (
                  <Pressable
                    key={status}
                    style={[
                      styles.statusOption,
                      editingStatusForInvoice?.status === status && styles.statusOptionActive,
                    ]}
                    onPress={() => handleSaveStatus(status)}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        editingStatusForInvoice?.status === status && styles.statusOptionTextActive,
                      ]}
                    >
                      {InvoiceStatusMeta[status].label}
                    </Text>
                  </Pressable>
                ))}
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Quote Picker Modal */}
        <Modal
          visible={showQuotePicker}
          transparent
          animationType="slide"
          onRequestClose={handleCloseQuotePicker}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={handleCloseQuotePicker}
          >
            <View style={styles.modalContainer}>
              <View style={styles.quotePickerModal}>
                <Text style={styles.modalTitle}>Select Quote to Invoice</Text>
                <Text style={styles.modalSubtitle}>
                  Choose an approved or completed quote
                </Text>

                <ScrollView style={styles.quoteList} nestedScrollEnabled>
                  {availableQuotes.map((quote) => (
                    <Pressable
                      key={quote.id}
                      style={styles.quoteOption}
                      onPress={() => handleSelectQuote(quote)}
                    >
                      <View style={styles.quoteOptionContent}>
                        <Text style={styles.quoteOptionTitle}>{quote.name}</Text>
                        <Text style={styles.quoteOptionSubtitle}>
                          {quote.clientName} • ${calculateQuoteTotal(quote).toFixed(2)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
                    </Pressable>
                  ))}
                </ScrollView>

                <Pressable
                  style={styles.cancelButton}
                  onPress={handleCloseQuotePicker}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Source Picker Modal (Premium only) */}
        <Modal
          visible={showSourcePicker}
          transparent
          animationType="fade"
          onRequestClose={handleCloseSourcePicker}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={handleCloseSourcePicker}
          >
            <View style={styles.modalContainer}>
              <View style={styles.sourcePickerModal}>
                <Text style={styles.modalTitle}>Create Invoice From</Text>
                <Text style={styles.modalSubtitle}>
                  Choose the source for your invoice
                </Text>

                <Pressable
                  style={styles.sourceOption}
                  onPress={() => handleSelectSource("quote")}
                >
                  <View style={styles.sourceOptionIcon}>
                    <Ionicons name="document-text-outline" size={24} color={theme.colors.accent} />
                  </View>
                  <View style={styles.sourceOptionContent}>
                    <Text style={styles.sourceOptionTitle}>From Quote</Text>
                    <Text style={styles.sourceOptionSubtitle}>
                      {availableQuotes.length} approved quote{availableQuotes.length !== 1 ? "s" : ""} available
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
                </Pressable>

                <Pressable
                  style={styles.sourceOption}
                  onPress={() => handleSelectSource("contract")}
                >
                  <View style={[styles.sourceOptionIcon, { backgroundColor: "#5856D620" }]}>
                    <Ionicons name="document-lock-outline" size={24} color="#5856D6" />
                  </View>
                  <View style={styles.sourceOptionContent}>
                    <Text style={styles.sourceOptionTitle}>From Contract</Text>
                    <Text style={styles.sourceOptionSubtitle}>
                      {availableContracts.length} signed contract{availableContracts.length !== 1 ? "s" : ""} available
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
                </Pressable>

                <Pressable
                  style={styles.cancelButton}
                  onPress={handleCloseSourcePicker}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Contract Picker Modal */}
        <Modal
          visible={showContractPicker}
          transparent
          animationType="slide"
          onRequestClose={handleCloseContractPicker}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={handleCloseContractPicker}
          >
            <View style={styles.modalContainer}>
              <View style={styles.quotePickerModal}>
                <Text style={styles.modalTitle}>Select Contract to Invoice</Text>
                <Text style={styles.modalSubtitle}>
                  Choose a signed contract
                </Text>

                <ScrollView style={styles.quoteList} nestedScrollEnabled>
                  {availableContracts.map((contract) => (
                    <Pressable
                      key={contract.id}
                      style={styles.quoteOption}
                      onPress={() => handleSelectContract(contract)}
                    >
                      <View style={styles.quoteOptionContent}>
                        <Text style={styles.quoteOptionTitle}>{contract.projectName}</Text>
                        <Text style={styles.quoteOptionSubtitle}>
                          {contract.clientName} • ${contract.total.toFixed(2)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
                    </Pressable>
                  ))}
                </ScrollView>

                <Pressable
                  style={styles.cancelButton}
                  onPress={handleCloseContractPicker}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      </GradientBackground>
    </GestureHandlerRootView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  color,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    topBar: {
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      backgroundColor: theme.colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    searchInput: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterScrollView: {
      flexGrow: 0,
      flexShrink: 0,
    },
    filterContainer: {
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      gap: theme.spacing(1),
    },
    filterChip: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(0.75),
      borderRadius: 999,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    filterChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    filterChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    filterChipTextActive: {
      color: "#000",
    },
    listContent: {
      padding: theme.spacing(3),
      paddingBottom: theme.spacing(10),
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing(4),
      marginTop: theme.spacing(8),
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
      textAlign: "center",
    },
    emptyDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 20,
      maxWidth: 300,
    },
    lockedContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing(4),
    },
    lockedTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
    },
    lockedDescription: {
      fontSize: 15,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 320,
      marginBottom: theme.spacing(3),
    },
    upgradeButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    upgradeButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContainer: {
      width: "100%",
      paddingHorizontal: theme.spacing(3),
      justifyContent: "center",
      alignItems: "center",
    },
    statusModal: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(3),
      width: "100%",
      maxWidth: 400,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
      textAlign: "center",
    },
    modalSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(2),
      textAlign: "center",
    },
    statusOption: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(1),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statusOptionActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    statusOptionText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      textAlign: "center",
    },
    statusOptionTextActive: {
      color: "#000",
      fontWeight: "700",
    },
    quotePickerModal: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(3),
      width: "100%",
      maxWidth: 400,
      maxHeight: 500,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    quoteList: {
      maxHeight: 300,
      marginBottom: theme.spacing(2),
    },
    quoteOption: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1),
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    quoteOptionContent: {
      flex: 1,
    },
    quoteOptionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    quoteOptionSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    cancelButton: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    sourcePickerModal: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(3),
      width: "100%",
      maxWidth: 400,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sourceOption: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
    },
    sourceOptionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.accent + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    sourceOptionContent: {
      flex: 1,
    },
    sourceOptionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    sourceOptionSubtitle: {
      fontSize: 13,
      color: theme.colors.muted,
    },
  });
}
