// lib/logo.ts
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGO_STORAGE_KEY = '@quotecat/company-logo';
const MAX_LOGO_WIDTH = 400;
const MAX_LOGO_HEIGHT = 200;
const LOGO_QUALITY = 0.8;

export interface CompanyLogo {
  url: string;
  base64?: string; // Base64 encoded image for embedding in PDFs
  localUri?: string;
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
 * Convert image URI to base64 string for embedding in PDFs
 */
export async function convertToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Return just the base64 data without the data:image/png;base64, prefix
      resolve(base64.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload logo to Supabase Storage
 */
export async function uploadLogoToSupabase(
  userId: string,
  imageUri: string
): Promise<string> {
  // Convert file URI to blob
  const response = await fetch(imageUri);
  const blob = await response.blob();

  // Create file name with user ID to ensure uniqueness
  const fileExt = 'png';
  const fileName = `${userId}/logo.${fileExt}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('logos')
    .upload(fileName, blob, {
      contentType: 'image/png',
      upsert: true, // Replace existing logo if any
    });

  if (error) {
    throw new Error(`Failed to upload logo: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('logos')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Save logo URL to user's profile in Supabase
 */
export async function saveLogoToProfile(userId: string, logoUrl: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ logo_url: logoUrl })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to save logo to profile: ${error.message}`);
  }
}

/**
 * Cache logo locally for offline access
 */
export async function cacheLogoLocally(
  logoUrl: string,
  localUri: string,
  base64: string
): Promise<void> {
  const logoData: CompanyLogo = {
    url: logoUrl,
    localUri,
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
 * Delete logo from Supabase Storage and profile
 */
export async function deleteLogo(userId: string): Promise<void> {
  const fileName = `${userId}/logo.png`;

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('logos')
    .remove([fileName]);

  if (storageError) {
    throw new Error(`Failed to delete logo from storage: ${storageError.message}`);
  }

  // Remove from profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ logo_url: null })
    .eq('id', userId);

  if (profileError) {
    throw new Error(`Failed to remove logo from profile: ${profileError.message}`);
  }

  // Clear local cache
  await AsyncStorage.removeItem(LOGO_STORAGE_KEY);
}

/**
 * Full logo upload flow: pick, process, upload, and cache
 */
export async function uploadCompanyLogo(userId: string): Promise<CompanyLogo> {
  // Step 1: Pick image
  const imageUri = await pickImage();
  if (!imageUri) {
    throw new Error('No image selected');
  }

  // Step 2: Process (resize/compress)
  const processedUri = await processImage(imageUri);

  // Step 3: Convert to base64 for PDF embedding
  const base64 = await convertToBase64(processedUri);

  // Step 4: Upload to Supabase (for cloud backup and multi-device sync)
  const logoUrl = await uploadLogoToSupabase(userId, processedUri);

  // Step 5: Save URL to profile
  await saveLogoToProfile(userId, logoUrl);

  // Step 6: Cache locally with base64 (for offline PDF generation)
  await cacheLogoLocally(logoUrl, processedUri, base64);

  return {
    url: logoUrl,
    base64,
    localUri: processedUri,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Get logo for current user (from cache or Supabase)
 */
export async function getCompanyLogo(userId: string): Promise<CompanyLogo | null> {
  // Try cache first (offline support, includes base64)
  const cached = await getCachedLogo();
  if (cached) return cached;

  // Fetch from Supabase if not cached
  const { data, error } = await supabase
    .from('profiles')
    .select('logo_url')
    .eq('id', userId)
    .single();

  if (error || !data?.logo_url) {
    return null;
  }

  // Download and convert to base64 for caching
  try {
    const response = await fetch(data.logo_url);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const logo: CompanyLogo = {
      url: data.logo_url,
      base64,
      uploadedAt: new Date().toISOString(),
    };

    // Cache for offline use (with base64 for PDFs)
    await cacheLogoLocally(data.logo_url, data.logo_url, base64);

    return logo;
  } catch (fetchError) {
    // If we can't download/convert, return URL only (fallback)
    return {
      url: data.logo_url,
      uploadedAt: new Date().toISOString(),
    };
  }
}
