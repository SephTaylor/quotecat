// components/RefreshButton.tsx
// Dashboard header button to refresh products and sync data
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useRef, useEffect } from "react";
import {
  Pressable,
  Animated,
  Easing,
  Alert,
  Modal,
  View,
  Text,
  StyleSheet,
} from "react-native";
import { refreshProducts } from "@/modules/catalog/productService";
import { syncQuotes } from "@/lib/quotesSync";
import { syncInvoices } from "@/lib/invoicesSync";
import { syncClients } from "@/lib/clientsSync";
import { isAuthenticated } from "@/lib/auth";
import { getUserState } from "@/lib/user";

export function RefreshButton() {
  const { theme } = useTheme();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0, phase: "" });
  const spinValue = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Spin animation while syncing
  useEffect(() => {
    if (syncing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [syncing, spinValue]);

  // Animate progress bar
  useEffect(() => {
    if (progress.total > 0) {
      const percent = progress.loaded / progress.total;
      Animated.timing(progressAnim, {
        toValue: percent,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [progress.loaded, progress.total, progressAnim]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleRefresh = async () => {
    if (syncing) return;

    setSyncing(true);
    setProgress({ loaded: 0, total: 0, phase: "Starting..." });
    progressAnim.setValue(0);

    try {
      // Refresh products with progress callback
      setProgress({ loaded: 0, total: 100, phase: "Syncing products..." });
      const productSuccess = await refreshProducts((loaded, total) => {
        setProgress({ loaded, total, phase: "Syncing products..." });
      });

      // Sync user data only for Pro/Premium users
      const authenticated = await isAuthenticated();
      const userState = await getUserState();
      const hasSyncAccess =
        authenticated &&
        (userState?.tier === "pro" || userState?.tier === "premium");

      if (hasSyncAccess) {
        setProgress({ loaded: 0, total: 3, phase: "Syncing your data..." });

        await syncQuotes();
        setProgress({ loaded: 1, total: 3, phase: "Syncing invoices..." });

        await syncInvoices();
        setProgress({ loaded: 2, total: 3, phase: "Syncing clients..." });

        await syncClients();
        setProgress({ loaded: 3, total: 3, phase: "Done!" });
      } else {
        setProgress({ loaded: 1, total: 1, phase: "Done!" });
      }

      // Brief pause to show "Done!"
      await new Promise((r) => setTimeout(r, 500));

      if (!productSuccess) {
        Alert.alert("Partial Refresh", "Could not refresh products. Check your connection.");
      }
    } catch (error) {
      console.error("Refresh failed:", error);
      Alert.alert("Refresh Failed", "Could not sync data. Please try again.");
    } finally {
      setSyncing(false);
      setProgress({ loaded: 0, total: 0, phase: "" });
    }
  };

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "transparent",
        },
        progressContainer: {
          backgroundColor: theme.colors.card,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          padding: 16,
          paddingBottom: 32,
        },
        progressHeader: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 12,
          gap: 8,
        },
        progressText: {
          fontSize: 14,
          fontWeight: "600",
          color: theme.colors.text,
          flex: 1,
        },
        progressCount: {
          fontSize: 12,
          color: theme.colors.muted,
        },
        progressBarBg: {
          height: 6,
          backgroundColor: theme.colors.border,
          borderRadius: 3,
          overflow: "hidden",
        },
        progressBarFill: {
          height: "100%",
          backgroundColor: theme.colors.accent,
          borderRadius: 3,
        },
      }),
    [theme]
  );

  return (
    <>
      <Pressable
        onPress={handleRefresh}
        disabled={syncing}
        style={{
          padding: 8,
          marginRight: 4,
          opacity: syncing ? 0.6 : 1,
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Ionicons name="sync-outline" size={22} color={theme.colors.text} />
        </Animated.View>
      </Pressable>

      <Modal
        visible={syncing}
        transparent
        animationType="slide"
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons
                  name="sync-outline"
                  size={18}
                  color={theme.colors.accent}
                />
              </Animated.View>
              <Text style={styles.progressText}>{progress.phase}</Text>
              {progress.total > 3 && (
                <Text style={styles.progressCount}>
                  {progress.loaded.toLocaleString()} / {progress.total.toLocaleString()}
                </Text>
              )}
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
