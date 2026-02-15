import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { getQuoteById, saveQuote } from "@/lib/quotes";
import { useProducts, usePrices } from "@/modules/catalog";
import { loadPreferences } from "@/lib/preferences";
import { BottomBar, Button } from "@/modules/core/ui";
import {
  MaterialsPicker,
  transformSelectionToItems,
  useSelection,
  type ActiveFilter,
} from "@/modules/materials";
import { mergeById } from "@/modules/quotes/merge";
import type { Product } from "@/modules/catalog/seed";
import { useTheme } from "@/contexts/ThemeContext";
import { Text, View, StyleSheet, Pressable, Alert, RefreshControl, Modal, TouchableOpacity, TouchableWithoutFeedback, Keyboard, ScrollView, Linking, FlatList, TextInput, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { QuoteItem, PricebookItem } from "@/lib/types";
import { trackProductUsage } from "@/lib/analytics";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { getPricebookItems, getPricebookCategories } from "@/lib/pricebook";
import { listAssemblies } from "@/modules/assemblies/storage";
import type { Assembly } from "@/modules/assemblies/types";
import { getUserState } from "@/lib/user";
import { canAccessPricebook, canAccessAssemblies } from "@/lib/features";

export type SourceType = "catalog" | "pricebook" | "assemblies";

export default function QuoteMaterials() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  // Memoize styles to avoid recreating StyleSheet on every render
  const themedStyles = useMemo(() => createStyles(theme), [theme]);

  const { products, categories, loading, syncing, syncProgress, lastSync, refresh } = useProducts();

  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [initialSelectionLoaded, setInitialSelectionLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Source toggle state
  const [activeSource, setActiveSource] = useState<SourceType>("catalog");
  const [hasPricebookAccess, setHasPricebookAccess] = useState(false);
  const [hasAssembliesAccess, setHasAssembliesAccess] = useState(false);

  // Pricebook data
  const [pricebookItems, setPricebookItems] = useState<PricebookItem[]>([]);
  const [pricebookCategories, setPricebookCategories] = useState<string[]>([]);
  const [pricebookLoading, setPricebookLoading] = useState(false);

  // Assemblies data
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [assembliesLoading, setAssembliesLoading] = useState(false);

  // Create initial selection from quote items
  const initialSelection = useMemo(() => {
    if (!initialSelectionLoaded || quoteItems.length === 0) return new Map();

    const map = new Map();
    quoteItems.forEach((item) => {
      const product = products.find((p) => p.id === item.id);
      if (product) {
        map.set(product.id, { product, qty: item.qty });
      }
    });
    return map;
  }, [quoteItems, products, initialSelectionLoaded]);

  const { selection, inc, dec, clear, units, setSelection, setQty, getSelection } = useSelection(initialSelection);

  // Filter state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]); // empty = all suppliers
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]); // empty = all categories
  const [expandedParents, setExpandedParents] = useState<string[]>([]); // for collapsible category sections

  const supplierOptions = [
    { id: "lowes", name: "Lowe's" },
    { id: "homedepot", name: "Home Depot" },
    { id: "menards", name: "Menards" },
  ];

  const locationOptions = [
    { id: "", name: "None (Base prices)" },
    { id: "kalamazoo", name: "Kalamazoo" },
    { id: "battle_creek", name: "Battle Creek" },
    { id: "lansing", name: "Lansing" },
  ];

  // Location pricing state
  const [defaultLocationId, setDefaultLocationId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const { priceMap, getPriceForProduct, setLocationId: setPriceLocationId, loading: pricesLoading, refresh: refreshPrices } = usePrices(selectedLocationId);

  // Load default location from preferences
  useEffect(() => {
    const loadDefaultLocation = async () => {
      const prefs = await loadPreferences();
      const locationId = prefs.pricing?.locationId || "";
      setDefaultLocationId(locationId);
      setSelectedLocationId(locationId);
      setPriceLocationId(locationId);
    };
    loadDefaultLocation();
  }, [setPriceLocationId]);

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(s => s !== supplierId)
        : [...prev, supplierId]
    );
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleParentExpanded = (parentId: string) => {
    setExpandedParents(prev =>
      prev.includes(parentId)
        ? prev.filter(id => id !== parentId)
        : [...prev, parentId]
    );
  };

  const clearFilters = () => {
    setSelectedSuppliers([]);
    setSelectedCategories([]);
    setSelectedLocationId(defaultLocationId);
    setPriceLocationId(defaultLocationId);
  };

  const activeFilterCount = selectedSuppliers.length + selectedCategories.length + (selectedLocationId !== defaultLocationId ? 1 : 0);

  // Build active filters array for Picker display
  const activeFilters = useMemo((): ActiveFilter[] => {
    const filters: ActiveFilter[] = [];

    // Add category filters
    selectedCategories.forEach(catId => {
      const cat = categories.find(c => c.id === catId);
      filters.push({
        type: "category",
        id: catId,
        label: cat?.name || catId,
      });
    });

    // Add supplier filters
    selectedSuppliers.forEach(supplierId => {
      const supplier = supplierOptions.find(s => s.id === supplierId);
      filters.push({
        type: "supplier",
        id: supplierId,
        label: supplier?.name || supplierId,
      });
    });

    // Add location filter if different from default
    if (selectedLocationId !== defaultLocationId) {
      const location = locationOptions.find(l => l.id === selectedLocationId);
      filters.push({
        type: "location",
        id: selectedLocationId,
        label: location?.name || selectedLocationId || "No location",
      });
    }

    return filters;
  }, [selectedCategories, selectedSuppliers, selectedLocationId, defaultLocationId, categories]);

  // Handle removing individual filters
  const handleRemoveFilter = useCallback((filter: ActiveFilter) => {
    switch (filter.type) {
      case "category":
        setSelectedCategories(prev => prev.filter(c => c !== filter.id));
        break;
      case "supplier":
        setSelectedSuppliers(prev => prev.filter(s => s !== filter.id));
        break;
      case "location":
        setSelectedLocationId(defaultLocationId);
        setPriceLocationId(defaultLocationId);
        break;
    }
  }, [defaultLocationId, setPriceLocationId]);

  // Load quote items function
  const loadQuote = useCallback(async () => {
    if (!id) return;
    const q = await getQuoteById(id);
    if (q) {
      const items = q.items ?? [];
      setQuoteItems(items);

      // Pre-populate selection with existing items
      if (items.length > 0 && products.length > 0 && !initialSelectionLoaded) {
        const map = new Map();
        items.forEach((item) => {
          const product = products.find((p) => p.id === item.id);
          if (product) {
            map.set(product.id, { product, qty: item.qty });
          }
        });
        setSelection(map);
        setInitialSelectionLoaded(true);
      }
    }
  }, [id, products, initialSelectionLoaded, setSelection]);

  // Load on mount
  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  // Check user tier access on mount
  useEffect(() => {
    const checkAccess = async () => {
      const user = await getUserState();
      setHasPricebookAccess(canAccessPricebook(user));
      setHasAssembliesAccess(canAccessAssemblies(user));
    };
    checkAccess();
  }, []);

  // Load pricebook items when switching to pricebook tab
  useEffect(() => {
    if (activeSource === "pricebook" && hasPricebookAccess) {
      const loadPricebook = async () => {
        setPricebookLoading(true);
        try {
          const [items, cats] = await Promise.all([
            getPricebookItems(),
            getPricebookCategories(),
          ]);
          setPricebookItems(items);
          setPricebookCategories(cats);
        } catch (error) {
          console.error("Failed to load pricebook:", error);
        } finally {
          setPricebookLoading(false);
        }
      };
      loadPricebook();
    }
  }, [activeSource, hasPricebookAccess]);

  // Load assemblies when switching to assemblies tab
  useEffect(() => {
    if (activeSource === "assemblies" && hasAssembliesAccess) {
      const loadAssembliesData = async () => {
        setAssembliesLoading(true);
        try {
          const data = await listAssemblies();
          setAssemblies(data);
        } catch (error) {
          console.error("Failed to load assemblies:", error);
        } finally {
          setAssembliesLoading(false);
        }
      };
      loadAssembliesData();
    }
  }, [activeSource, hasAssembliesAccess]);


  // Reload when returning from edit-items screen
  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        if (!id) return;
        const q = await getQuoteById(id);
        if (q) {
          const items = q.items ?? [];
          setQuoteItems(items);

          // Don't reload selection on focus - let it stay cleared after "Add items"
          // Selection will only be populated when user manually clicks +/-
          // This gives clean UI for accumulate mode

          setInitialSelectionLoaded(true);
        }
      };
      refresh();
    }, [id])
  );

  // Products with location prices overlaid
  const productsWithPrices = useMemo(() => {
    if (!selectedLocationId || priceMap.size === 0) return products;

    return products.map((p) => {
      const locationPrice = getPriceForProduct(p.id, p.supplierId);
      if (locationPrice !== null) {
        return { ...p, unitPrice: locationPrice, _hasLocationPrice: true };
      }
      return { ...p, _hasLocationPrice: false };
    });
  }, [products, selectedLocationId, priceMap, getPriceForProduct]);

  // Calculate product counts per category (for category picker display)
  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    productsWithPrices.forEach((p) => {
      counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
    });
    return counts;
  }, [productsWithPrices]);

  // Filtered category list for the category picker (alphabetized, filtered by search)
  // Used when search is active (flat view)
  const filteredCategoryList = useMemo(() => {
    // Get leaf categories only (ones that have products)
    const leafCategories = categories.filter(c => productCounts[c.id] > 0);

    // Sort alphabetically
    const sorted = leafCategories.sort((a, b) => a.name.localeCompare(b.name));

    // Filter by search
    if (!categorySearch.trim()) return sorted;
    const search = categorySearch.toLowerCase();
    return sorted.filter(c => c.name.toLowerCase().includes(search));
  }, [categories, productCounts, categorySearch]);

  // Canonical category keywords for on-the-fly classification
  // (Used when products don't have canonicalCategory set yet)
  const CANONICAL_KEYWORDS: Record<string, string[]> = {
    "Lumber": ["lumber", "dimensional", "plywood", "osb", "stud", "board", "timber", "mdf"],
    "Electrical": ["electrical", "wire", "wiring", "outlet", "switch", "breaker", "panel", "conduit"],
    "Plumbing": ["plumbing", "pipe", "fitting", "faucet", "toilet", "valve", "drain", "pvc", "pex"],
    "Drywall": ["drywall", "sheetrock", "gypsum", "joint compound"],
    "Hardware": ["hardware", "fastener", "screw", "nail", "bolt", "anchor", "bracket", "hinge"],
    "Paint": ["paint", "primer", "stain", "coating", "sealer"],
    "Flooring": ["flooring", "tile", "laminate", "vinyl floor", "hardwood floor", "carpet"],
    "Roofing": ["roofing", "shingle", "flashing", "gutter", "soffit", "fascia"],
    "Insulation": ["insulation", "foam board", "fiberglass", "weatherstrip"],
    "HVAC": ["hvac", "duct", "vent", "furnace", "thermostat"],
    "Doors & Windows": ["door", "window", "threshold", "screen"],
    "Decking": ["deck", "decking", "railing", "composite deck", "pergola"],
    "Fencing": ["fence", "fencing", "gate", "picket"],
    "Concrete & Masonry": ["concrete", "cement", "mortar", "brick", "block", "paver", "rebar"],
    "Tools": ["tool", "saw", "drill", "hammer", "level", "blade"],
    "Safety": ["safety", "glove", "glasses", "mask", "harness"],
    "Lighting": ["lighting", "light fixture", "bulb", "led", "lamp"],
    "Outdoor & Landscaping": ["outdoor", "landscape", "garden", "lawn", "sprinkler"],
  };

  // Get canonical category for a product (from stored value or computed on-the-fly)
  const getCanonical = useCallback((product: Product): string => {
    // Use stored canonicalCategory if available
    if (product.canonicalCategory && product.canonicalCategory !== "Other") {
      return product.canonicalCategory;
    }
    // Compute on-the-fly from categoryId (last segment of supplier path)
    const lowerCat = product.categoryId.toLowerCase();
    for (const [category, keywords] of Object.entries(CANONICAL_KEYWORDS)) {
      if (keywords.some(kw => lowerCat.includes(kw))) {
        return category;
      }
    }
    return "Other";
  }, []);

  // Grouped categories for collapsible sections (Amazon-style canonical categories)
  type CategoryGroup = {
    parent: { id: string; name: string };
    children: { id: string; name: string }[];
    totalProducts: number;
    selectedCount: number;
  };

  const groupedCategories = useMemo((): CategoryGroup[] => {
    // Group products by canonical category, then by sub-category (categoryId)
    const canonicalGroups = new Map<string, Map<string, number>>();

    productsWithPrices.forEach(product => {
      const canonical = getCanonical(product);
      const subCat = product.categoryId;

      if (!canonicalGroups.has(canonical)) {
        canonicalGroups.set(canonical, new Map());
      }
      const subCats = canonicalGroups.get(canonical)!;
      subCats.set(subCat, (subCats.get(subCat) || 0) + 1);
    });

    // Convert to CategoryGroup array
    const groups: CategoryGroup[] = [];

    for (const [canonical, subCats] of canonicalGroups) {
      const children = Array.from(subCats.entries())
        .map(([name, count]) => ({ id: name, name, count }))
        .filter(c => c.count > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

      const totalProducts = Array.from(subCats.values()).reduce((sum, c) => sum + c, 0);
      const selectedCount = children.filter(c => selectedCategories.includes(c.id)).length;

      groups.push({
        parent: { id: canonical, name: canonical },
        children: children.map(c => ({ id: c.id, name: c.name })),
        totalProducts,
        selectedCount,
      });
    }

    // Sort by product count (most products first), then alphabetically
    return groups.sort((a, b) => {
      if (b.totalProducts !== a.totalProducts) {
        return b.totalProducts - a.totalProducts;
      }
      return a.parent.name.localeCompare(b.parent.name);
    });
  }, [productsWithPrices, selectedCategories, getCanonical]);

  // Helper to get all category IDs that should be included when filtering
  // Includes selected categories AND all children of selected parent categories
  const getFilteredCategoryIds = useMemo(() => {
    if (selectedCategories.length === 0) return null; // null = no filter (show all)

    const allowed = new Set<string>();
    selectedCategories.forEach((id) => {
      allowed.add(id);
      // Also add children if this is a parent
      categories
        .filter((c) => c.parentId === id)
        .forEach((child) => allowed.add(child.id));
    });
    return allowed;
  }, [selectedCategories, categories]);

  // Group products by category for MaterialsPicker (with supplier + category filters)
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, (Product & { _hasLocationPrice?: boolean })[]> = {};

    // Filter by supplier if any selected
    let filteredProducts = selectedSuppliers.length > 0
      ? productsWithPrices.filter(p => p.supplierId && selectedSuppliers.includes(p.supplierId))
      : productsWithPrices;

    // Filter by category if any selected
    if (getFilteredCategoryIds !== null) {
      filteredProducts = filteredProducts.filter(p => getFilteredCategoryIds.has(p.categoryId));
    }

    filteredProducts.forEach((product) => {
      if (!grouped[product.categoryId]) {
        grouped[product.categoryId] = [];
      }
      grouped[product.categoryId].push(product);
    });

    return grouped;
  }, [productsWithPrices, selectedSuppliers, selectedCategories, getFilteredCategoryIds]);

  // Convert pricebook items to Product format for the picker
  const pricebookAsProducts = useMemo((): Product[] => {
    return pricebookItems.map((item) => ({
      id: item.id,
      name: item.name,
      unit: item.unitType || "ea",
      unitPrice: item.unitPrice,
      categoryId: item.category || "custom",
    }));
  }, [pricebookItems]);

  // Group pricebook products by category
  const pricebookByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    pricebookAsProducts.forEach((product) => {
      if (!grouped[product.categoryId]) {
        grouped[product.categoryId] = [];
      }
      grouped[product.categoryId].push(product);
    });
    return grouped;
  }, [pricebookAsProducts]);

  // Get categories for pricebook
  const pricebookCategoryObjects = useMemo(() => {
    return pricebookCategories.map((cat) => ({ id: cat, name: cat }));
  }, [pricebookCategories]);

  // Selection summary calculation
  const selectionSummary = useMemo(() => {
    const selectedItems = Array.from(selection.values());
    const totalItems = selectedItems.reduce((sum, item) => sum + item.qty, 0);
    const totalValue = selectedItems.reduce(
      (sum, item) => sum + item.product.unitPrice * item.qty,
      0
    );
    return { count: totalItems, value: totalValue };
  }, [selection]);

  // Handle source toggle
  const handleSourceChange = useCallback((source: SourceType) => {
    if (source === "pricebook" && !hasPricebookAccess) {
      Alert.alert(
        "Pro Feature",
        "Price Book lets you create and manage your own custom products with your pricing.",
        [
          { text: "OK", style: "cancel" },
          { text: "Learn More", onPress: () => Linking.openURL("https://quotecat.ai/#pricing") },
        ]
      );
      return;
    }
    if (source === "assemblies" && !hasAssembliesAccess) {
      Alert.alert(
        "Pro Feature",
        "Assemblies let you save groups of materials as reusable templates for faster quoting.",
        [
          { text: "OK", style: "cancel" },
          { text: "Learn More", onPress: () => Linking.openURL("https://quotecat.ai/#pricing") },
        ]
      );
      return;
    }
    setActiveSource(source);
  }, [hasPricebookAccess, hasAssembliesAccess, router]);

  // Get current items/categories based on active source
  const currentItemsByCategory = useMemo(() => {
    if (activeSource === "catalog") return productsByCategory;
    if (activeSource === "pricebook") return pricebookByCategory;
    return {};
  }, [activeSource, productsByCategory, pricebookByCategory]);

  const currentCategories = useMemo(() => {
    if (activeSource === "catalog") return categories;
    if (activeSource === "pricebook") return pricebookCategoryObjects;
    return [];
  }, [activeSource, categories, pricebookCategoryObjects]);

  const isCurrentSourceLoading = useMemo(() => {
    if (activeSource === "catalog") return loading;
    if (activeSource === "pricebook") return pricebookLoading;
    if (activeSource === "assemblies") return assembliesLoading;
    return false;
  }, [activeSource, loading, pricebookLoading, assembliesLoading]);

  const saveSelected = useCallback(
    async (goBack: boolean) => {
      // Dismiss keyboard to trigger onBlur and commit any pending quantity edits
      Keyboard.dismiss();

      // Wait for state update to propagate after onBlur commits the quantity
      await new Promise(resolve => setTimeout(resolve, 50));

      if (!id) {
        Alert.alert("Error", "No quote ID found. Please try again.");
        return;
      }

      // Convert current selection to items (use getSelection for latest state)
      const currentSelection = getSelection();
      const newlySelectedItems = transformSelectionToItems(currentSelection);

      // Track usage for analytics (privacy-friendly)
      newlySelectedItems.forEach((item) => {
        trackProductUsage(item.productId || item.id || "", item.qty);
      });

      try {
        const q = await getQuoteById(id);
        if (!q) {
          Alert.alert("Error", "Quote not found. Please try again.");
          return;
        }

        // Get current quote items
        const existingItems = q.items ?? [];

        // Merge existing items with newly selected items (accumulate mode)
        const mergedItems = mergeById(existingItems, newlySelectedItems);

        // Save the merged items list
        await saveQuote({ ...q, id, items: mergedItems });

        if (goBack) {
          router.back();
        } else {
          // Update the indicator to show all saved items
          setQuoteItems(mergedItems);

          // Clear the selection UI so user can select new items
          clear();

          // Show success message
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 3000);
        }
      } catch (error) {
        console.error("Failed to save materials:", error);
        Alert.alert("Error", "Failed to add materials. Please try again.");
      }
    },
    [id, getSelection, router, clear],
  );

  // Calculate status text for header
  const statusText = React.useMemo(() => {
    if (syncing) {
      if (syncProgress && syncProgress.total > 0) {
        const pct = Math.round((syncProgress.loaded / syncProgress.total) * 100);
        return `${pct}%`;
      }
      return "Syncing";
    }
    if (lastSync) {
      const hoursAgo = Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60 * 60));
      if (hoursAgo < 24) return "Online";
      return "Refresh";
    }
    return "Offline";
  }, [syncing, syncProgress, lastSync]);

  const statusMessage = React.useMemo(() => {
    if (syncing) {
      if (syncProgress && syncProgress.total > 0) {
        const pct = Math.round((syncProgress.loaded / syncProgress.total) * 100);
        return `Syncing products... ${syncProgress.loaded.toLocaleString()} / ${syncProgress.total.toLocaleString()} (${pct}%)`;
      }
      return "Syncing product catalog from cloud...";
    }
    if (lastSync) {
      const hoursAgo = Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60 * 60));
      if (hoursAgo < 1) return "Online (Up to date)\n\nProduct catalog is current.";
      if (hoursAgo < 24) return `Online (Updated ${hoursAgo}h ago)\n\nProduct catalog is recent.`;
      const daysAgo = Math.floor(hoursAgo / 24);
      return `Sync recommended\n\nLast updated ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago.\nPull down to refresh.`;
    }
    return "Not synced\n\nPull down to sync product catalog from cloud.";
  }, [syncing, syncProgress, lastSync]);

  const showStatusInfo = () => {
    Alert.alert(
      "Product Catalog Status",
      statusMessage,
      [
        { text: "OK", style: "cancel" },
        {
          text: "Refresh Now",
          onPress: async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          },
        },
      ]
    );
  };

  // Filter button handler
  const handleFilterPress = () => {
    setFilterModalVisible(true);
  };

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Source toggle component
  const SourceToggle = () => (
    <View style={themedStyles.sourceToggle}>
      <Pressable
        style={[
          themedStyles.sourceTab,
          activeSource === "catalog" && themedStyles.sourceTabActive,
        ]}
        onPress={() => handleSourceChange("catalog")}
      >
        <Text
          style={[
            themedStyles.sourceTabText,
            activeSource === "catalog" && themedStyles.sourceTabTextActive,
          ]}
        >
          Catalog
        </Text>
      </Pressable>
      <Pressable
        style={[
          themedStyles.sourceTab,
          activeSource === "pricebook" && themedStyles.sourceTabActive,
          !hasPricebookAccess && themedStyles.sourceTabLocked,
        ]}
        onPress={() => handleSourceChange("pricebook")}
      >
        <Text
          style={[
            themedStyles.sourceTabText,
            activeSource === "pricebook" && themedStyles.sourceTabTextActive,
          ]}
        >
          Pricebook
        </Text>
        {!hasPricebookAccess && (
          <Ionicons name="lock-closed" size={12} color={theme.colors.muted} style={{ marginLeft: 4 }} />
        )}
      </Pressable>
      <Pressable
        style={[
          themedStyles.sourceTab,
          activeSource === "assemblies" && themedStyles.sourceTabActive,
          !hasAssembliesAccess && themedStyles.sourceTabLocked,
        ]}
        onPress={() => handleSourceChange("assemblies")}
      >
        <Text
          style={[
            themedStyles.sourceTabText,
            activeSource === "assemblies" && themedStyles.sourceTabTextActive,
          ]}
        >
          Assemblies
        </Text>
        {!hasAssembliesAccess && (
          <Ionicons name="lock-closed" size={12} color={theme.colors.muted} style={{ marginLeft: 4 }} />
        )}
      </Pressable>
    </View>
  );

  // Assemblies list view
  const AssembliesView = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={themedStyles.assembliesContainer}
    >
      {assembliesLoading ? (
        <Text style={themedStyles.emptyText}>Loading assemblies...</Text>
      ) : assemblies.length === 0 ? (
        <View style={themedStyles.emptyState}>
          <Text style={themedStyles.emptyTitle}>No Assemblies</Text>
          <Text style={themedStyles.emptyText}>
            Create assemblies in Pro Tools to use them here.
          </Text>
        </View>
      ) : (
        assemblies.map((assembly) => (
          <Pressable
            key={assembly.id}
            style={themedStyles.assemblyCard}
            onPress={() => {
              // Navigate to assembly calculator
              router.push(`/(main)/assembly/${assembly.id}?quoteId=${id}` as any);
            }}
          >
            <View style={themedStyles.assemblyInfo}>
              <Text style={themedStyles.assemblyName}>{assembly.name}</Text>
              <Text style={themedStyles.assemblyItems}>
                {assembly.items.length} item{assembly.items.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
          </Pressable>
        ))
      )}
    </ScrollView>
  );

  if (isCurrentSourceLoading && activeSource === "catalog") {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Add/Edit Materials",
            headerShown: true,
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
            headerRight: () => (
              <Pressable onPress={showStatusInfo} style={{ marginRight: 16, padding: 8 }}>
                <Text style={{ fontSize: 15, color: theme.colors.text }}>{statusText}</Text>
              </Pressable>
            ),
          }}
        />
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <SourceToggle />
          <MaterialsPicker
            categories={currentCategories}
            itemsByCategory={{}}
            selection={selection}
            onInc={inc}
            onDec={dec}
            onSetQty={setQty}
            recentProductIds={[]}
            onFilterPress={handleFilterPress}
            activeFilters={activeFilters}
            onRemoveFilter={handleRemoveFilter}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.accent}
              />
            }
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Add/Edit Materials",
          headerShown: true,
          headerTitleAlign: 'center', // Center title on all platforms (Android defaults to left)
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: {
            color: theme.colors.text,
          },
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerRight: () => (
            <Pressable onPress={showStatusInfo} style={{ marginRight: 16, padding: 8 }}>
              <Text style={{ fontSize: 15, color: theme.colors.text }}>{statusText}</Text>
            </Pressable>
          ),
        }}
      />

      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        {quoteItems.length > 0 && (
          <Pressable
            style={themedStyles.quoteItemsIndicator}
            onPress={() => id && router.push(`/quote/${id}/edit-items`)}
          >
            <View style={themedStyles.indicatorContent}>
              <View style={themedStyles.indicatorTextContainer}>
                <Text style={themedStyles.indicatorText}>
                  Quote has {quoteItems.reduce((sum, item) => sum + item.qty, 0)}{" "}
                  item
                  {quoteItems.reduce((sum, item) => sum + item.qty, 0) !== 1
                    ? "s"
                    : ""}{" "}
                  ({quoteItems.length} product
                  {quoteItems.length !== 1 ? "s" : ""})
                </Text>
                <Text style={themedStyles.indicatorSubtext}>
                  Total items cost: $
                  {quoteItems
                    .reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
                    .toFixed(2)}
                </Text>
              </View>
              <View style={themedStyles.editButton}>
                <Text style={themedStyles.editButtonText}>Edit</Text>
              </View>
            </View>
          </Pressable>
        )}

        {showSuccessMessage && (
          <View style={themedStyles.successMessage}>
            <Text style={themedStyles.successText}>✓ Items added to quote!</Text>
          </View>
        )}

        {/* Sync Progress Banner */}
        {syncing && syncProgress && syncProgress.total > 0 && (
          <View style={themedStyles.syncProgressBanner}>
            <Text style={themedStyles.syncProgressText}>
              Syncing products... {syncProgress.loaded.toLocaleString()} / {syncProgress.total.toLocaleString()}
            </Text>
            <View style={themedStyles.syncProgressBarBg}>
              <View
                style={[
                  themedStyles.syncProgressBarFill,
                  { width: `${Math.round((syncProgress.loaded / syncProgress.total) * 100)}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Source Toggle */}
        <SourceToggle />

        {/* Content based on active source */}
        {activeSource === "assemblies" ? (
          <AssembliesView />
        ) : (
          <MaterialsPicker
            categories={currentCategories}
            itemsByCategory={currentItemsByCategory}
            selection={selection}
            onInc={inc}
            onDec={dec}
            onSetQty={setQty}
            recentProductIds={[]}
            onFilterPress={activeSource === "catalog" ? handleFilterPress : undefined}
            activeFilters={activeSource === "catalog" ? activeFilters : []}
            onRemoveFilter={activeSource === "catalog" ? handleRemoveFilter : undefined}
            refreshControl={
              activeSource === "catalog" ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.accent}
                />
              ) : undefined
            }
          />
        )}
      </View>

      {/* Updated Bottom Bar with selection summary */}
      <View style={themedStyles.bottomBarWrapper}>
        {selectionSummary.count > 0 && (
          <View style={themedStyles.selectionSummary}>
            <Text style={themedStyles.selectionSummaryText}>
              + {selectionSummary.count} selected · ${selectionSummary.value.toFixed(2)}
            </Text>
          </View>
        )}
        <BottomBar>
          <Button
            variant="secondary"
            onPress={() => saveSelected(false)}
            disabled={selectionSummary.count === 0}
          >
            Add Items
          </Button>

          <Button variant="primary" onPress={() => saveSelected(true)}>
            Done
          </Button>
        </BottomBar>
      </View>

      {/* Filter Modal - Full screen for better UX */}
      {filterModalVisible && (
      <Modal
        visible={true}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <SafeAreaView style={themedStyles.filterModalContainer}>
          {/* Header */}
          <View style={themedStyles.filterModalHeader}>
            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
              <Text style={themedStyles.filterModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={themedStyles.filterModalTitle}>Filters</Text>
            {activeFilterCount > 0 ? (
              <TouchableOpacity onPress={clearFilters}>
                <Text style={themedStyles.filterModalClear}>Clear</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 50 }} />
            )}
          </View>

          <View style={themedStyles.filterModalContent}>
            {/* Supplier Filter - Horizontal chips */}
            <View style={themedStyles.filterSection}>
              <Text style={themedStyles.filterSectionTitle}>Supplier</Text>
              <View style={themedStyles.chipRow}>
                {supplierOptions.map((supplier) => {
                  const isSelected = selectedSuppliers.includes(supplier.id);
                  return (
                    <TouchableOpacity
                      key={supplier.id}
                      style={[
                        themedStyles.filterChip,
                        isSelected && themedStyles.filterChipSelected,
                      ]}
                      onPress={() => toggleSupplier(supplier.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          themedStyles.filterChipText,
                          isSelected && themedStyles.filterChipTextSelected,
                        ]}
                      >
                        {supplier.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Location Filter - Horizontal chips */}
            <View style={themedStyles.filterSection}>
              <Text style={themedStyles.filterSectionTitle}>Location</Text>
              <View style={themedStyles.chipRow}>
                {locationOptions.map((location) => {
                  const isSelected = selectedLocationId === location.id;
                  return (
                    <TouchableOpacity
                      key={location.id}
                      style={[
                        themedStyles.filterChip,
                        isSelected && themedStyles.filterChipSelected,
                      ]}
                      onPress={() => {
                        setSelectedLocationId(location.id);
                        setPriceLocationId(location.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          themedStyles.filterChipText,
                          isSelected && themedStyles.filterChipTextSelected,
                        ]}
                      >
                        {location.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Category Filter - Row that opens category picker */}
            <TouchableOpacity
              style={themedStyles.categorySelectRow}
              onPress={() => {
                setFilterModalVisible(false);
                setCategoryPickerVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View>
                <Text style={themedStyles.categorySelectLabel}>Category</Text>
                <Text style={themedStyles.categorySelectValue}>
                  {selectedCategories.length === 0
                    ? "All categories"
                    : `${selectedCategories.length} selected`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Done Button */}
          <View style={themedStyles.filterModalFooter}>
            <TouchableOpacity
              style={themedStyles.applyButton}
              onPress={() => setFilterModalVisible(false)}
            >
              <Text style={themedStyles.applyButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      )}

      {/* Category Picker Modal - Separate for performance */}
      {categoryPickerVisible && (
      <Modal
        visible={true}
        animationType="slide"
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <SafeAreaView style={themedStyles.categoryPickerContainer}>
          {/* Header */}
          <View style={themedStyles.categoryPickerHeader}>
            <TouchableOpacity onPress={() => setCategoryPickerVisible(false)}>
              <Text style={themedStyles.categoryPickerCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={themedStyles.categoryPickerTitle}>Categories</Text>
            <TouchableOpacity onPress={() => setSelectedCategories([])}>
              <Text style={themedStyles.categoryPickerClear}>Clear</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={themedStyles.categorySearchContainer}>
            <Ionicons name="search" size={18} color={theme.colors.muted} />
            <TextInput
              style={themedStyles.categorySearchInput}
              placeholder="Search categories..."
              placeholderTextColor={theme.colors.muted}
              value={categorySearch}
              onChangeText={setCategorySearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {categorySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCategorySearch("")}>
                <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category List - Grouped when no search, flat when searching */}
          {categorySearch.trim() ? (
            // Flat list when searching
            <FlatList
              data={filteredCategoryList}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedCategories.includes(item.id);
                return (
                  <TouchableOpacity
                    style={themedStyles.categoryListItem}
                    onPress={() => toggleCategory(item.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        themedStyles.checkbox,
                        isSelected && themedStyles.checkboxSelected,
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#000" />
                      )}
                    </View>
                    <Text style={themedStyles.categoryListItemText} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={themedStyles.categoryListItemCount}>
                      {productCounts[item.id] || 0}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={themedStyles.categoryListSeparator} />}
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={10}
            />
          ) : (
            // Grouped list when not searching
            <FlatList
              data={groupedCategories}
              keyExtractor={(item) => item.parent.id}
              renderItem={({ item: group }) => {
                const isExpanded = expandedParents.includes(group.parent.id);
                return (
                  <View>
                    {/* Parent row - tap to expand/collapse */}
                    <TouchableOpacity
                      style={themedStyles.parentRow}
                      onPress={() => toggleParentExpanded(group.parent.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isExpanded ? "chevron-down" : "chevron-forward"}
                        size={20}
                        color={theme.colors.muted}
                        style={{ width: 24 }}
                      />
                      <Text style={themedStyles.parentRowText} numberOfLines={1}>
                        {group.parent.name}
                      </Text>
                      <Text style={themedStyles.parentRowCount}>
                        {group.totalProducts}
                        {group.selectedCount > 0 && ` · ${group.selectedCount} selected`}
                      </Text>
                    </TouchableOpacity>

                    {/* Children - only show if expanded */}
                    {isExpanded && group.children.map((child) => {
                      const isSelected = selectedCategories.includes(child.id);
                      return (
                        <TouchableOpacity
                          key={child.id}
                          style={themedStyles.childRow}
                          onPress={() => toggleCategory(child.id)}
                          activeOpacity={0.7}
                        >
                          <View style={{ width: 24 }} />
                          <View
                            style={[
                              themedStyles.checkbox,
                              isSelected && themedStyles.checkboxSelected,
                            ]}
                          >
                            {isSelected && (
                              <Ionicons name="checkmark" size={14} color="#000" />
                            )}
                          </View>
                          <Text style={themedStyles.categoryListItemText} numberOfLines={1}>
                            {child.name}
                          </Text>
                          <Text style={themedStyles.categoryListItemCount}>
                            {productCounts[child.id] || 0}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              }}
              initialNumToRender={30}
              maxToRenderPerBatch={20}
              windowSize={10}
            />
          )}

          {/* Done Button */}
          <View style={themedStyles.categoryPickerFooter}>
            <TouchableOpacity
              style={themedStyles.applyButton}
              onPress={() => setCategoryPickerVisible(false)}
            >
              <Text style={themedStyles.applyButtonText}>
                {selectedCategories.length > 0
                  ? `Done (${selectedCategories.length} selected)`
                  : "Done"}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      )}
    </>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    // Source toggle styles
    sourceToggle: {
      flexDirection: "row",
      marginHorizontal: theme.spacing(1.5),
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(0.5),
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: 3,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sourceTab: {
      flex: 1,
      paddingVertical: theme.spacing(0.75),
      paddingHorizontal: theme.spacing(1),
      borderRadius: theme.radius.sm,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },
    sourceTabActive: {
      backgroundColor: theme.colors.accent,
    },
    sourceTabLocked: {
      opacity: 0.6,
    },
    sourceTabText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    sourceTabTextActive: {
      color: "#000",
    },
    // Assemblies view styles
    assembliesContainer: {
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(8),
    },
    assemblyCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    assemblyInfo: {
      flex: 1,
    },
    assemblyName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 2,
    },
    assemblyItems: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: theme.spacing(6),
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
    },
    // Bottom bar styles
    bottomBarWrapper: {
      backgroundColor: theme.colors.bg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    selectionSummary: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(1.5),
      paddingBottom: theme.spacing(0.5),
    },
    selectionSummaryText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.accent,
      textAlign: "center",
    },
    quoteItemsIndicator: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginHorizontal: theme.spacing(2),
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    indicatorContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing(2),
    },
    indicatorTextContainer: {
      flex: 1,
    },
    indicatorText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 4,
    },
    indicatorSubtext: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    editButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    editButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#000",
    },
    successMessage: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(1.5),
      marginHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(2),
      alignItems: "center",
    },
    successText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#000", // Black on orange accent (good contrast)
    },
    // Sync progress banner
    syncProgressBanner: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(1),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    syncProgressText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
      textAlign: "center",
    },
    syncProgressBarBg: {
      height: 6,
      backgroundColor: theme.colors.bg,
      borderRadius: 3,
      overflow: "hidden",
    },
    syncProgressBarFill: {
      height: "100%",
      backgroundColor: theme.colors.accent,
      borderRadius: 3,
    },
    // Filter modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: theme.spacing(3),
      paddingBottom: theme.spacing(4),
      paddingTop: theme.spacing(1.5),
      maxHeight: "85%",
    },
    modalScrollView: {
      flexGrow: 0,
    },
    modalHandle: {
      width: 36,
      height: 4,
      backgroundColor: theme.colors.muted,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: theme.spacing(2),
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(3),
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    clearButton: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    filterSection: {
      marginBottom: theme.spacing(3),
    },
    filterSectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    filterOptions: {
      gap: theme.spacing(1),
    },
    filterSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1.5),
    },
    filterBadge: {
      backgroundColor: theme.colors.accent,
      color: "#000",
      fontSize: 12,
      fontWeight: "700",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: "hidden",
    },
    checkboxRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing(1.25),
      gap: theme.spacing(1.5),
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.bg,
    },
    checkboxSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    checkboxLabel: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text,
    },
    radioButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.bg,
    },
    radioButtonSelected: {
      borderColor: theme.colors.accent,
    },
    radioButtonInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.colors.accent,
    },
    // Chip row styles
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing(1),
    },
    filterChip: {
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(2),
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.bg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterChipSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    filterChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    filterChipTextSelected: {
      color: "#000",
    },
    // Category select row
    categorySelectRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing(2),
      paddingHorizontal: theme.spacing(2),
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing(2),
    },
    categorySelectLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
      marginBottom: 4,
    },
    categorySelectValue: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text,
    },
    // Full-screen filter modal styles
    filterModalContainer: {
      flex: 1,
      backgroundColor: theme.colors.card,
    },
    filterModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    filterModalCancel: {
      fontSize: 16,
      color: theme.colors.text,
      minWidth: 50,
    },
    filterModalTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.text,
    },
    filterModalClear: {
      fontSize: 16,
      color: theme.colors.accent,
      minWidth: 50,
      textAlign: "right",
    },
    filterModalContent: {
      flex: 1,
      paddingHorizontal: theme.spacing(3),
      paddingTop: theme.spacing(3),
    },
    filterModalFooter: {
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(2),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    // Category picker modal styles
    categoryPickerContainer: {
      flex: 1,
      backgroundColor: theme.colors.card,
    },
    categoryPickerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    categoryPickerCancel: {
      fontSize: 16,
      color: theme.colors.text,
    },
    categoryPickerTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.text,
    },
    categoryPickerClear: {
      fontSize: 16,
      color: theme.colors.accent,
    },
    categorySearchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.bg,
      marginHorizontal: theme.spacing(2),
      marginVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      gap: theme.spacing(1),
    },
    categorySearchInput: {
      flex: 1,
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
    },
    categoryListItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      gap: theme.spacing(1.5),
    },
    categoryListItemText: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    categoryListItemCount: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    categoryListSeparator: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginLeft: theme.spacing(2),
    },
    // Parent/child row styles for grouped categories
    parentRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      backgroundColor: theme.colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    parentRowText: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginLeft: theme.spacing(0.5),
    },
    parentRowCount: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    childRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing(1.25),
      paddingHorizontal: theme.spacing(2),
      paddingLeft: theme.spacing(3),
      gap: theme.spacing(1),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    categoryPickerFooter: {
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(2),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    applyButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing(2),
      borderRadius: theme.radius.lg,
      alignItems: "center",
      marginTop: theme.spacing(1),
    },
    applyButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
  });
