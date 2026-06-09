// components/BarcodeScannerModal.tsx
// Pro+ scanner — points the camera at a UPC/EAN/Code-128 barcode and reports
// the scanned value back to the caller. Caller decides what to do with it
// (look up existing pricebook item by exact SKU, or open the create form with
// SKU pre-filled).
//
// Geography-agnostic: works in every country because it doesn't depend on a
// product database. The contractor is at the store holding the product — they
// are the source of truth for what the item is and what they pay for it.

import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  visible: boolean;
  onScan: (sku: string) => void;
  onClose: () => void;
};

export default function BarcodeScannerModal({ visible, onScan, onClose }: Props) {
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const lastScanRef = useRef<{ sku: string; at: number } | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  useEffect(() => {
    if (!visible) {
      lastScanRef.current = null;
      setLastScan(null);
    }
  }, [visible]);

  const handleScan = (result: BarcodeScanningResult) => {
    const sku = (result.data ?? "").trim();
    if (!sku) return;
    const now = Date.now();
    // 2-second debounce — same SKU won't re-fire until the user lifts and points again
    if (lastScanRef.current?.sku === sku && now - lastScanRef.current.at < 2000) {
      return;
    }
    lastScanRef.current = { sku, at: now };
    setLastScan(sku);
    onScan(sku);
  };

  if (!visible) return null;

  // No permission state: render permission-request UI inside the modal
  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.permissionContainer, { backgroundColor: theme.colors.bg }]}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.permissionContainer, { backgroundColor: theme.colors.bg }]}>
          <Ionicons name="camera-outline" size={64} color={theme.colors.muted} />
          <Text style={[styles.permissionTitle, { color: theme.colors.text }]}>
            Camera access needed
          </Text>
          <Text style={[styles.permissionBody, { color: theme.colors.muted }]}>
            QuoteCat uses the camera to scan product barcodes for your pricebook. Nothing leaves your device.
          </Text>
          <Pressable
            style={[styles.permissionButton, { backgroundColor: theme.colors.accent }]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Allow Camera</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={[styles.cancelText, { color: theme.colors.accent }]}>Not now</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["upc_a", "upc_e", "ean13", "ean8", "code128", "code39"],
          }}
          onBarcodeScanned={handleScan}
        />

        <View style={styles.overlay}>
          <View style={styles.reticleWrap}>
            <View style={styles.reticle}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>
          <View style={styles.hintWrap}>
            <Text style={styles.hint}>
              {lastScan ? `Scanned: ${lastScan}` : "Point at a barcode"}
            </Text>
          </View>
        </View>

        <Pressable onPress={onClose} style={styles.closeButton} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  reticleWrap: {
    width: 280,
    height: 180,
    justifyContent: "center",
    alignItems: "center",
  },
  reticle: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#F97316",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  hintWrap: {
    marginTop: 32,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
  },
  hint: {
    color: "#fff",
    fontSize: 14,
  },
  closeButton: {
    position: "absolute",
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  permissionBody: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  permissionButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    marginTop: 8,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelText: {
    fontSize: 15,
    paddingVertical: 8,
  },
});
