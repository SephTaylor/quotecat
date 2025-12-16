// lib/logo.ts
// Company logo management - fully local (AsyncStorage only)

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
 * Upload company logo (pick, process, save locally)
 */
export async function uploadCompanyLogo(): Promise<CompanyLogo> {
  const imageUri = await pickImage();
  if (!imageUri) {
    throw new Error('No image selected');
  }

  const processedUri = await processImage(imageUri);
  const base64 = await convertToBase64(processedUri);

  const logo: CompanyLogo = {
    base64,
    uploadedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify(logo));
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
 * Delete company logo
 */
export async function deleteLogo(): Promise<void> {
  await AsyncStorage.removeItem(LOGO_STORAGE_KEY);
}
