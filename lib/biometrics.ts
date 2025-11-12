// lib/biometrics.ts - STUBBED FOR TESTING
// Temporarily disabled expo-local-authentication and expo-secure-store

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export async function isBiometricSupported(): Promise<boolean> {
  return false;
}

export async function getAvailableBiometricTypes(): Promise<BiometricType[]> {
  return ['none'];
}

export function getBiometricName(types: BiometricType[]): string {
  return 'Biometric';
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  return false;
}

export async function saveCredentials(email: string, password: string): Promise<boolean> {
  return false;
}

export async function getCredentials(): Promise<{ email: string; password: string } | null> {
  return null;
}

export async function hasCredentials(): Promise<boolean> {
  return false;
}

export async function deleteCredentials(): Promise<boolean> {
  return true;
}
