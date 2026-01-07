// components/WizardFAB.tsx
// Draggable floating action button to launch the Quote Wizard (Drew)

import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Image,
  Dimensions,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@quotecat/wizard_fab_position';
const FAB_SIZE = 56;

export function WizardFAB() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // Get screen dimensions
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Default position (bottom-right)
  const defaultX = screenWidth - FAB_SIZE - 24;
  const defaultY = screenHeight - FAB_SIZE - 120; // Account for tab bar

  // Animated position
  const pan = useRef(new Animated.ValueXY({ x: defaultX, y: defaultY })).current;

  // Track if this is a tap or drag
  const isDragging = useRef(false);
  const startPosition = useRef({ x: 0, y: 0 });

  // Load saved position on mount
  useEffect(() => {
    loadPosition();
  }, []);

  const loadPosition = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { x, y } = JSON.parse(saved);
        // Validate position is still on screen
        const validX = Math.min(Math.max(0, x), screenWidth - FAB_SIZE);
        const validY = Math.min(Math.max(0, y), screenHeight - FAB_SIZE);
        pan.setValue({ x: validX, y: validY });
      }
    } catch (error) {
      console.error('Failed to load FAB position:', error);
    }
    setIsReady(true);
  };

  const savePosition = async (x: number, y: number) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
    } catch (error) {
      console.error('Failed to save FAB position:', error);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture move if we've moved more than 5 pixels
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        isDragging.current = false;
        // Store current position
        startPosition.current = {
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        };
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gestureState) => {
        // If we've moved more than 10 pixels, it's a drag
        if (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10) {
          isDragging.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        })(_, gestureState);
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();

        // If it wasn't a drag, treat as tap
        if (!isDragging.current) {
          router.push('/(main)/wizard');
          return;
        }

        // Get final position
        let finalX = startPosition.current.x + gestureState.dx;
        let finalY = startPosition.current.y + gestureState.dy;

        // Clamp to screen bounds
        finalX = Math.min(Math.max(0, finalX), screenWidth - FAB_SIZE);
        finalY = Math.min(Math.max(0, finalY), screenHeight - FAB_SIZE - 80); // Account for tab bar

        // Animate to clamped position
        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
          friction: 5,
        }).start();

        // Save position
        savePosition(finalX, finalY);
      },
    })
  ).current;

  // Don't render until position is loaded
  if (!isReady) return null;

  return (
    <Animated.View
      style={[
        styles.fab,
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Image
        source={require('@/assets/images/drew-avatar.png')}
        style={styles.avatar}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    // Shadow for Android
    elevation: 5,
    zIndex: 1000,
  },
  avatar: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
  },
});
