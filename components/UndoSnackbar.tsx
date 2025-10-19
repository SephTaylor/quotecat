// components/UndoSnackbar.tsx
import React, { useEffect } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/constants/theme";

type UndoSnackbarProps = {
  visible: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
};

export const UndoSnackbar: React.FC<UndoSnackbarProps> = ({
  visible,
  message,
  onUndo,
  onDismiss,
  duration = 4000,
}) => {
  const translateY = React.useRef(new Animated.Value(100)).current;

  useEffect(() => {
    if (visible) {
      // Slide up
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }).start();

      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      // Slide down
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, duration, onDismiss, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.message}>{message}</Text>
        <Pressable
          style={styles.undoButton}
          onPress={() => {
            onUndo();
            onDismiss();
          }}
        >
          <Text style={styles.undoText}>UNDO</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing(2),
    paddingBottom: theme.spacing(3),
    zIndex: 1000,
  },
  content: {
    backgroundColor: "#323232",
    borderRadius: theme.radius.lg,
    padding: theme.spacing(2),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  message: {
    color: "#FFFFFF",
    fontSize: 14,
    flex: 1,
  },
  undoButton: {
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1),
  },
  undoText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
});
