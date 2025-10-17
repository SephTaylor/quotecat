import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { formatMoney } from "../lib/money";
import { CATALOG, type MaterialItem } from "./seed-catalog";

type Props = {
  visible: boolean;
  currency: string;
  items: MaterialItem[]; // selected line items (with qty)
  onChange: (next: MaterialItem[]) => void;
  onClose: () => void;
};

type Section = {
  title: string;
  data: MaterialItem[];
  count: number;
};

// small helper so clearing an input never yields NaN
const toInt = (t: string) => {
  const n = parseInt(t.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

export default function MaterialsPicker({
  visible,
  currency,
  items,
  onChange,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  /** ---------- Search ---------- */
  const [search, setSearch] = useState("");

  /** ---------- Categories & sections ---------- */
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const m of CATALOG) if (m.category) set.add(m.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, []);

  const term = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!term) return CATALOG;
    return CATALOG.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        (m.category ?? "").toLowerCase().includes(term),
    );
  }, [term]);

  const allSections: Section[] = useMemo(() => {
    const byCat = new Map<string, MaterialItem[]>();
    for (const c of categories) byCat.set(c, []);
    for (const m of filtered) {
      const c = m.category || "Other";
      if (!byCat.has(c)) byCat.set(c, []);
      byCat.get(c)!.push(m);
    }
    const sections: Section[] = [];
    for (const c of byCat.keys()) {
      const arr = byCat.get(c)!;
      if (arr.length) sections.push({ title: c, data: arr, count: arr.length });
    }
    sections.sort((a, b) => a.title.localeCompare(b.title));
    return sections;
  }, [categories, filtered]);

  /** ---------- Collapse/expand per category ---------- */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // ✅ Default: collapse every category exactly once when first seen.
  React.useEffect(() => {
    if (!allSections.length) return;
    setCollapsed((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const s of allSections) {
        if (next[s.title] === undefined) {
          next[s.title] = true; // start collapsed
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allSections]);

  const toggleSection = (title: string) =>
    setCollapsed((s) => ({ ...s, [title]: !s[title] }));
  const expandAll = () =>
    setCollapsed(Object.fromEntries(allSections.map((s) => [s.title, false])));
  const collapseAll = () =>
    setCollapsed(Object.fromEntries(allSections.map((s) => [s.title, true])));

  const sectionsForList = useMemo(
    () =>
      allSections.map((s) => ({
        ...s,
        data: collapsed[s.title] ? [] : s.data,
      })),
    [allSections, collapsed],
  );

  /** ---------- Pending qty per catalog row (pre-add) ---------- */
  const [pendingQtyById, setPendingQtyById] = useState<Record<string, number>>(
    {},
  );
  const getPending = (id: string) => Math.max(1, pendingQtyById[id] ?? 1);
  const setPending = (id: string, n: number) =>
    setPendingQtyById((s) => ({ ...s, [id]: Math.max(1, Math.round(n || 1)) }));

  /** ---------- Selected items helpers ---------- */
  const setSelectedQty = (productId: string, n: number) => {
    const qty = Math.max(1, Math.round(n || 1));
    const next = items.map((it) =>
      it.productId === productId ? { ...it, qty } : it,
    );
    onChange(next);
  };

  const incSelected = (productId: string, delta: number) => {
    const next = items.map((it) =>
      it.productId === productId
        ? { ...it, qty: Math.max(1, (it.qty ?? 1) + delta) }
        : it,
    );
    onChange(next);
  };

  const removeItem = useCallback(
    (productId: string) =>
      onChange(items.filter((x) => x.productId !== productId)),
    [items, onChange],
  );

  /** ---------- Add from catalog (uses pending qty) ---------- */
  const addItem = useCallback(
    (m: MaterialItem) => {
      const addQty = getPending(m.productId);
      const idx = items.findIndex((x) => x.productId === m.productId);
      const next = [...items];
      if (idx >= 0) {
        next[idx] = { ...next[idx], qty: (next[idx].qty ?? 0) + addQty };
      } else {
        next.push({ ...m, qty: addQty });
      }
      onChange(next);
      setPending(m.productId, 1); // reset row qty after add
    },
    [items, onChange],
  );

  /** ---------- Layout paddings ---------- */
  const bottomListPad = insets.bottom + (items.length > 0 ? 140 : 16);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      {/* Full safe area: top & bottom. Background to app gray */}
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#F4F6FA" }}
        edges={["top", "bottom"]}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.select({ ios: "padding", android: undefined })}
        >
          {/* Header bar safely below the notch */}
          <View style={[styles.headerRow, { paddingHorizontal: 12 }]}>
            <Text style={styles.headerTitle}>Materials</Text>
            <Pressable
              onPress={onClose}
              style={styles.headerBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.headerBtnText}>Done</Text>
            </Pressable>
          </View>

          {/* Search + Expand/Collapse controls */}
          <View style={{ paddingHorizontal: 12, gap: 8 }}>
            <TextInput
              placeholder="Search materials or categories…"
              value={search}
              onChangeText={setSearch}
              style={styles.search}
            />
            <View style={styles.controlsRow}>
              <SmallBtn title="Expand all" onPress={expandAll} />
              <SmallBtn title="Collapse all" onPress={collapseAll} />
            </View>
          </View>

          {/* Accordion list */}
          <SectionList
            sections={sectionsForList}
            keyExtractor={(item) => item.productId}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingTop: 8,
              paddingBottom: bottomListPad,
            }}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <SectionHeader
                title={section.title}
                count={section.count}
                collapsed={!!collapsed[section.title]}
                onPress={() => toggleSection(section.title)}
              />
            )}
            renderItem={({ item }) => {
              const pending = getPending(item.productId);
              return (
                <View style={styles.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    {!!item.category && (
                      <Text style={styles.cat}>{item.category}</Text>
                    )}
                    <Text style={styles.unitPrice}>
                      {formatMoney(item.unitPrice, currency)}
                      {item.unit ? ` / ${item.unit}` : ""}
                    </Text>
                  </View>

                  {/* Qty stepper (pre-add) */}
                  <View style={styles.stepper}>
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => setPending(item.productId, pending - 1)}
                    >
                      <Text style={styles.stepTxt}>-</Text>
                    </Pressable>
                    <TextInput
                      value={String(pending)}
                      keyboardType="number-pad"
                      onChangeText={(t) => setPending(item.productId, toInt(t))}
                      style={styles.qtyInput}
                    />
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => setPending(item.productId, pending + 1)}
                    >
                      <Text style={styles.stepTxt}>+</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    style={styles.addBtn}
                    onPress={() => addItem(item)}
                  >
                    <Text style={styles.addBtnText}>Add</Text>
                  </Pressable>
                </View>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListFooterComponent={<View style={{ height: 8 }} />}
          />

          {/* Selected footer with quantity editors (safe over bottom inset) */}
          {items.length > 0 && (
            <View
              style={{
                padding: 12,
                paddingBottom: 12 + insets.bottom,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: "#eee",
                backgroundColor: "#fff",
              }}
            >
              <Text style={styles.subheader}>Selected</Text>
              {items.map((it) => (
                <View key={it.productId} style={styles.selectedRow}>
                  <Text style={{ flex: 1 }}>
                    {it.name}{" "}
                    <Text style={{ color: "#6b7280" }}>
                      ({formatMoney(it.unitPrice, currency)}
                      {it.unit ? ` / ${it.unit}` : ""})
                    </Text>
                  </Text>

                  {/* Qty stepper (post-add) */}
                  <View style={styles.stepperMini}>
                    <Pressable
                      style={styles.stepBtnMini}
                      onPress={() => incSelected(it.productId, -1)}
                    >
                      <Text style={styles.stepTxt}>-</Text>
                    </Pressable>
                    <TextInput
                      value={String(it.qty ?? 1)}
                      keyboardType="number-pad"
                      onChangeText={(t) =>
                        setSelectedQty(it.productId, toInt(t))
                      }
                      style={styles.qtyInputMini}
                    />
                    <Pressable
                      style={styles.stepBtnMini}
                      onPress={() => incSelected(it.productId, +1)}
                    >
                      <Text style={styles.stepTxt}>+</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.lineTotal}>
                    {formatMoney((it.qty ?? 1) * it.unitPrice, currency)}
                  </Text>

                  <Pressable
                    onPress={() => removeItem(it.productId)}
                    style={{ marginLeft: 8 }}
                  >
                    <Text style={{ color: "#b91c1c", fontWeight: "600" }}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

/* ---------- Small UI bits ---------- */
type SmallBtnProps = { title: string; onPress: () => void };
function SmallBtn({ title, onPress }: SmallBtnProps) {
  return (
    <Pressable onPress={onPress} style={styles.smallBtn}>
      <Text style={styles.smallBtnTxt}>{title}</Text>
    </Pressable>
  );
}

type SectionHeaderProps = {
  title: string;
  count: number;
  collapsed: boolean;
  onPress: () => void;
};
function SectionHeader({
  title,
  count,
  collapsed,
  onPress,
}: SectionHeaderProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.sectionHeader}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
    >
      <Text style={styles.sectionTitle}>
        {collapsed ? "▶" : "▽"} {title}
      </Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </Pressable>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "#F4F6FA",
    paddingVertical: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", flex: 1, paddingLeft: 12 },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#111827",
    marginRight: 12,
  },
  headerBtnText: { color: "#fff", fontWeight: "700" },

  search: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  controlsRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },

  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  smallBtnTxt: { fontWeight: "600", color: "#111827" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F6FA",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  sectionTitle: { fontWeight: "700", fontSize: 16, flex: 1 },
  sectionCount: {
    minWidth: 36,
    textAlign: "right",
    color: "#6b7280",
    fontWeight: "600",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: { fontWeight: "600" },
  cat: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  unitPrice: { fontSize: 12, color: "#6b7280", marginTop: 2 },

  // Pre-add stepper (catalog rows)
  stepper: { flexDirection: "row", alignItems: "center", marginRight: 8 },
  stepBtn: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepTxt: { fontWeight: "700", minWidth: 12, textAlign: "center" },
  qtyInput: {
    minWidth: 44,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: "center",
    marginHorizontal: 6,
    backgroundColor: "#fff",
  },

  addBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { color: "#fff", fontWeight: "700" },

  // Selected footer
  subheader: { fontWeight: "700", marginBottom: 8 },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },

  // Post-add stepper (compact)
  stepperMini: { flexDirection: "row", alignItems: "center", marginRight: 8 },
  stepBtnMini: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyInputMini: {
    minWidth: 40,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    textAlign: "center",
    marginHorizontal: 6,
    backgroundColor: "#fff",
  },
  lineTotal: { fontWeight: "700", minWidth: 80, textAlign: "right" },
});
