// lib/biometrics.ts
// Biometric authentication (Face ID, Touch ID, Fingerprint)
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const CREDENTIALS_KEY = 'quotecat_user_credentials';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

/**
 * Check if device supports biometric authentication
 */
export async function isBiometricSupported(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  } catch (error) {
    console.error('Error checking biometric support:', error);
    return false;
  }
}

/**
 * Get available biometric types on device
 */
export async function getAvailableBiometricTypes(): Promise<BiometricType[]> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const result: BiometricType[] = [];

    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      result.push('fingerprint');
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      result.push('facial');
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      result.push('iris');
    }

    return result.length > 0 ? result : ['none'];
  } catch (error) {
    console.error('Error getting biometric types:', error);
    return ['none'];
  }
}

/**
 * Get friendly name for biometric type
 */
export function getBiometricName(types: BiometricType[]): string {
  if (types.includes('facial')) return 'Face ID';
  if (types.includes('fingerprint')) return 'Fingerprint';
  if (types.includes('iris')) return 'Iris';
  return 'Biometric';
}

/**
 * Authenticate user with biometrics
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to QuoteCat',
      fallbackLabel: 'Use password instead',
      cancelLabel: 'Cancel',
    });

    return result.success;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return false;
  }
}

/**
 * Save user credentials securely (encrypted by device)
 */
export async function saveCredentials(email: string, password: string): Promise<boolean> {
  try {
    const credentials = JSON.stringify({ email, password });
    await SecureStore.setItemAsync(CREDENTIALS_KEY, credentials);
    return true;
  } catch (error) {
    console.error('Error saving credentials:', error);
    return false;
  }
}

/**
 * Get saved credentials (requires biometric auth first)
 */
export async function getCredentials(): Promise<{ email: string; password: string } | null> {
  try {
    const credentials = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    if (!credentials) return null;

    return JSON.parse(credentials);
  } catch (error) {
    console.error('Error getting credentials:', error);
    return null;
  }
}

/**
 * Check if credentials are saved
 */
export async function hasCredentials(): Promise<boolean> {
  try {
    const credentials = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    return !!credentials;
  } catch (error) {
    return false;
  }
}

/**
 * Delete saved credentials (sign out)
 */
export async function deleteCredentials(): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
    return true;
  } catch (error) {
    console.error('Error deleting credentials:', error);
    return false;
  }
}
