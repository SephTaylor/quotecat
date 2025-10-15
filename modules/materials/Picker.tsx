// modules/materials/Picker.tsx
import { theme } from '@/constants/theme';
import type { Product } from '@/modules/catalog/seed';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Selection } from './types';

export type Category = { id: string; name: string };
export type MaterialsPickerProps = {
  categories: Category[];
  itemsByCategory: Record<string, Product[]>;
  selection: Selection;
  onInc(product: Product): void;
  onDec(product: Product): void;
};

function MaterialsPicker({
  categories,
  itemsByCategory,
  selection,
  onInc,
  onDec,
}: MaterialsPickerProps) {
  // collapsed by default
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (catId: string) =>
    setExpanded(e => ({ ...e, [catId]: !e[catId] }));

  return (
    <View style={styles.content}>
      <Text style={styles.h1}>Add Materials</Text>
      <Text style={styles.helper}>
        Seed-only catalog. Categories start collapsed.
      </Text>

      {categories.map(cat => {
        const open = !!expanded[cat.id];
        const items = itemsByCategory[cat.id] ?? [];
        return (
          <View key={cat.id} style={styles.catCard}>
            <Pressable style={styles.catHeader} onPress={() => toggle(cat.id)}>
              <Text style={styles.catTitle}>
                {open ? '▾' : '▸'} {cat.name}
              </Text>
              <Text style={styles.catCount}>{items.length}</Text>
            </Pressable>

            {open && (
              <View style={styles.itemsWrap}>
                {items.map(p => {
                  const q = selection.get(p.id)?.qty ?? 0;
                  const active = q > 0;
                  return (
                    <View
                      key={p.id}
                      style={[styles.itemRow, active && styles.itemRowActive]}
                    >
                      <View style={styles.itemMeta}>
                        <Text style={styles.itemName}>{p.name}</Text>
                        <Text style={styles.itemSub}>
                          {p.unitPrice.toFixed(2)} / {p.unit}
                        </Text>
                      </View>

                      <View style={styles.stepper}>
                        <Pressable style={styles.stepBtn} onPress={() => onDec(p)}>
                          <Text style={styles.stepText}>–</Text>
                        </Pressable>
                        <Text style={styles.qtyText}>{q}</Text>
                        <Pressable style={styles.stepBtn} onPress={() => onInc(p)}>
                          <Text style={styles.stepText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: theme.spacing(2),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(8),
  },
  h1: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  helper: { color: theme.colors.muted, fontSize: 12, marginTop: 4, marginBottom: 12 },

  catCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing(2),
    overflow: 'hidden',
  },
  catHeader: {
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1.5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catTitle: { fontWeight: '800', color: theme.colors.text },
  catCount: { color: theme.colors.muted },

  itemsWrap: { paddingHorizontal: theme.spacing(1), paddingBottom: theme.spacing(1) },
  itemRow: {
    paddingHorizontal: theme.spacing(1),
    paddingVertical: theme.spacing(1),
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemRowActive: { backgroundColor: '#fffbe6', borderWidth: 1, borderColor: theme.colors.border },
  itemMeta: { flexShrink: 1, paddingRight: theme.spacing(1) },
  itemName: { color: theme.colors.text, fontWeight: '600' },
  itemSub: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    height: 32, width: 32, borderRadius: 16,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.card,
  },
  stepText: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  qtyText: { minWidth: 20, textAlign: 'center', color: theme.colors.text, fontWeight: '700' },
});

export default MaterialsPicker;           // default export (back-compat)
export { MaterialsPicker }; // named export (barrel-friendly)

