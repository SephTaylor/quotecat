// lib/logo.ts
// Company logo management - local storage with cloud sync for Pro+ users

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserState } from './user';

const LOGO_STORAGE_KEY = '@quotecat/company-logo';
const MAX_LOGO_WIDTH = 800;
const LOGO_QUALITY = 0.85;

export interface CompanyLogo {
  base64: string;
  uploadedAt: string;
}

/**
 * Pick an image from the device's library
 */
export async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission to access photo library is required');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [2, 1],
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * Resize image to fit within max bounds while maintaining aspect ratio
 */
async function processImage(uri: string): Promise<string> {
  // Only set width - ImageManipulator will maintain aspect ratio
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_LOGO_WIDTH } }],
    { compress: LOGO_QUALITY, format: ImageManipulator.SaveFormat.PNG }
  );
  return result.uri;
}

/**
 * Convert image URI to base64 data URL
 */
async function convertToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Trigger cloud sync for logo (non-blocking, for Pro+ users)
 */
async function triggerCloudSync(): Promise<void> {
  try {
    const userState = await getUserState();
    const isPaidTier = userState.tier === 'pro' || userState.tier === 'premium';

    if (isPaidTier) {
      // Dynamic import to avoid circular dependency
      const { forceSyncBusinessSettings } = await import('./businessSettingsSync');
      // Fire and forget - don't wait for cloud sync
      forceSyncBusinessSettings().catch(error => {
        console.error('Logo cloud sync failed:', error);
      });
    }
  } catch (error) {
    // Silent fail - local save already succeeded
    console.error('Failed to trigger logo cloud sync:', error);
  }
}

/**
 * Upload company logo (pick, process, save locally, sync to cloud for Pro+ users)
 */
export async function uploadCompanyLogo(): Promise<CompanyLogo | null> {
  const imageUri = await pickImage();
  if (!imageUri) {
    // User cancelled - return null instead of throwing
    return null;
  }

  const processedUri = await processImage(imageUri);
  const base64 = await convertToBase64(processedUri);

  const logo: CompanyLogo = {
    base64,
    uploadedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify(logo));

  // Trigger cloud sync for Pro+ users (non-blocking)
  triggerCloudSync();

  return logo;
}

/**
 * Get company logo from local storage
 */
export async function getCompanyLogo(): Promise<CompanyLogo | null> {
  try {
    const data = await AsyncStorage.getItem(LOGO_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Alias for backwards compatibility
export const getCachedLogo = getCompanyLogo;

/**
 * Delete company logo (local and cloud)
 */
export async function deleteLogo(): Promise<void> {
  await AsyncStorage.removeItem(LOGO_STORAGE_KEY);

  // Also delete from cloud storage for Pro+ users
  try {
    const userState = await getUserState();
    const isPaidTier = userState.tier === 'pro' || userState.tier === 'premium';

    if (isPaidTier) {
      const { deleteLogoFromStorage } = await import('./businessSettingsSync');
      // Fire and forget - local delete already succeeded
      deleteLogoFromStorage().catch(error => {
        console.error('Cloud logo delete failed:', error);
      });
    }
  } catch (error) {
    console.error('Failed to delete logo from cloud:', error);
  }
}
