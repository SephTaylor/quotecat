// lib/logo.ts
// Company logo management - stores logo as base64 in profiles table

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGO_STORAGE_KEY = '@quotecat/company-logo';
const MAX_LOGO_WIDTH = 800;
const MAX_LOGO_HEIGHT = 400;
const LOGO_QUALITY = 0.85;

export interface CompanyLogo {
  base64: string;
  uploadedAt: string;
}

/**
 * Request permissions for image picker
 */
export async function requestImagePermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Pick an image from the device's library
 */
export async function pickImage(): Promise<string | null> {
  const hasPermission = await requestImagePermissions();
  if (!hasPermission) {
    throw new Error('Permission to access media library is required');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [2, 1], // Wide aspect ratio for logos
    quality: 1,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * Resize and compress an image
 */
export async function processImage(uri: string): Promise<string> {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [
      {
        resize: {
          width: MAX_LOGO_WIDTH,
          height: MAX_LOGO_HEIGHT,
        },
      },
    ],
    {
      compress: LOGO_QUALITY,
      format: ImageManipulator.SaveFormat.PNG,
    }
  );

  return manipResult.uri;
}

/**
 * Convert image URI to base64 string
 */
export async function convertToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Return the full data URL (includes mime type prefix)
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Save logo to local cache
 */
async function cacheLogoLocally(base64: string): Promise<void> {
  const logoData: CompanyLogo = {
    base64,
    uploadedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify(logoData));
}

/**
 * Get cached logo from local storage
 */
export async function getCachedLogo(): Promise<CompanyLogo | null> {
  try {
    const data = await AsyncStorage.getItem(LOGO_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Clear cached logo
 */
async function clearCachedLogo(): Promise<void> {
  await AsyncStorage.removeItem(LOGO_STORAGE_KEY);
}

/**
 * Upload logo to Supabase profiles table (if authenticated)
 */
async function uploadLogoToCloud(base64: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('Not authenticated, logo saved locally only');
      return false;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ logo_base64: base64 })
      .eq('id', userId);

    if (error) {
      console.error('Failed to upload logo to cloud:', error);
      return false;
    }

    console.log('✅ Logo uploaded to cloud');
    return true;
  } catch (error) {
    console.error('Logo cloud upload error:', error);
    return false;
  }
}

/**
 * Download logo from Supabase profiles table
 */
async function downloadLogoFromCloud(): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('logo_base64')
      .eq('id', userId)
      .single();

    if (error || !data?.logo_base64) {
      return null;
    }

    return data.logo_base64;
  } catch (error) {
    console.error('Logo cloud download error:', error);
    return null;
  }
}

/**
 * Delete logo from cloud
 */
async function deleteLogoFromCloud(): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('profiles')
      .update({ logo_base64: null })
      .eq('id', userId);

    if (error) {
      console.error('Failed to delete logo from cloud:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Logo cloud delete error:', error);
    return false;
  }
}

/**
 * Full logo upload flow: pick, process, save locally, and sync to cloud
 * Works without authentication (saves locally, syncs when auth available)
 */
export async function uploadCompanyLogo(): Promise<CompanyLogo> {
  // Step 1: Pick image
  const imageUri = await pickImage();
  if (!imageUri) {
    throw new Error('No image selected');
  }

  // Step 2: Process (resize/compress)
  const processedUri = await processImage(imageUri);

  // Step 3: Convert to base64
  const base64 = await convertToBase64(processedUri);

  // Step 4: Save locally (always works)
  await cacheLogoLocally(base64);

  // Step 5: Try to sync to cloud (non-blocking, fails gracefully if not auth'd)
  uploadLogoToCloud(base64).catch(() => {
    console.log('Logo saved locally, will sync when authenticated');
  });

  return {
    base64,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Get company logo (from cache or cloud)
 */
export async function getCompanyLogo(): Promise<CompanyLogo | null> {
  // Try cache first (fast, works offline)
  const cached = await getCachedLogo();
  if (cached) return cached;

  // Try cloud if not cached
  const cloudBase64 = await downloadLogoFromCloud();
  if (cloudBase64) {
    // Cache it locally
    await cacheLogoLocally(cloudBase64);
    return {
      base64: cloudBase64,
      uploadedAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Delete company logo (local and cloud)
 */
export async function deleteLogo(): Promise<void> {
  // Clear local cache
  await clearCachedLogo();

  // Try to delete from cloud (non-blocking)
  deleteLogoFromCloud().catch(() => {
    console.log('Could not delete from cloud, local cleared');
  });
}

/**
 * Sync local logo to cloud (call after authentication)
 */
export async function syncLogoToCloud(): Promise<void> {
  const cached = await getCachedLogo();
  if (cached) {
    await uploadLogoToCloud(cached.base64);
  }
}
