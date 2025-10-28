// lib/alert.ts
// Cross-platform alert utility that works on both mobile and web

import { Platform, Alert as RNAlert } from 'react-native';

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * Cross-platform alert that works on both mobile and web
 *
 * On mobile: Uses React Native Alert.alert()
 * On web: Uses browser alert() with basic functionality
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void {
  if (Platform.OS === 'web') {
    // Web: Use browser alert
    const fullMessage = message ? `${title}\n\n${message}` : title;

    // For web, we'll just use alert() and call the first button's onPress
    // This is a simplified version - for production you might want a modal
    window.alert(fullMessage);

    // Call the first button's callback if it exists
    if (buttons && buttons.length > 0 && buttons[0].onPress) {
      buttons[0].onPress();
    }
  } else {
    // Mobile: Use React Native Alert
    RNAlert.alert(title, message, buttons);
  }
}

/**
 * Convenience method for success messages
 */
export function showSuccess(message: string, onDismiss?: () => void): void {
  showAlert('Success!', message, onDismiss ? [{ text: 'OK', onPress: onDismiss }] : undefined);
}

/**
 * Convenience method for error messages
 */
export function showError(message: string): void {
  showAlert('Error', message);
}
