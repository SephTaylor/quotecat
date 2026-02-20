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
const PADDING_TOP = 10; // Minimal top padding - allows Drew in header area
const PADDING_BOTTOM = 140; // Safe area for tab bar + home indicator
const PADDING_HORIZONTAL = 16; // Side padding

// Helper to clamp position within bounds (outside component for stable reference)
const clampPosition = (x: number, y: number) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const minX = PADDING_HORIZONTAL;
  const maxX = screenWidth - FAB_SIZE - PADDING_HORIZONTAL;
  const minY = PADDING_TOP;
  const maxY = screenHeight - FAB_SIZE - PADDING_BOTTOM;
  return {
    x: Math.min(Math.max(minX, x), maxX),
    y: Math.min(Math.max(minY, y), maxY),
  };
};

export function WizardFAB() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // Get screen dimensions
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Default position (bottom-right, using same padding as clamp bounds)
  const defaultX = screenWidth - FAB_SIZE - PADDING_HORIZONTAL;
  const defaultY = screenHeight - FAB_SIZE - PADDING_BOTTOM;

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
        const clamped = clampPosition(x, y);
        pan.setValue(clamped);
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

        // Calculate proposed position and clamp to bounds in real-time
        const proposedX = startPosition.current.x + gestureState.dx;
        const proposedY = startPosition.current.y + gestureState.dy;
        const clamped = clampPosition(proposedX, proposedY);

        // Set clamped position (offset is already applied, so we set absolute position)
        pan.setOffset({ x: 0, y: 0 });
        pan.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();

        // If it wasn't a drag, treat as tap
        if (!isDragging.current) {
          router.push('/(main)/wizard');
          return;
        }

        // Get final position and clamp to bounds
        const finalX = startPosition.current.x + gestureState.dx;
        const finalY = startPosition.current.y + gestureState.dy;
        const clamped = clampPosition(finalX, finalY);

        // Animate to clamped position with bounce effect
        Animated.spring(pan, {
          toValue: clamped,
          useNativeDriver: false,
          friction: 6,
          tension: 40,
        }).start();

        // Save position
        savePosition(clamped.x, clamped.y);
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
    backgroundColor: '#F97316', // Match Drew avatar for clean Android elevation
    overflow: 'hidden',
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
