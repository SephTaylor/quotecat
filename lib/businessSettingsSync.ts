// lib/businessSettingsSync.ts
// Cloud sync for business settings and logo (Pro/Premium feature)
// Syncs company details, logo, and preferences to Supabase so the portal has everything ready

import { supabase } from "./supabase";
import { getCurrentUserId } from "./authUtils";
import { loadPreferences, type UserPreferences } from "./preferences";
import { getCompanyLogo, type CompanyLogo } from "./logo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";

const SETTINGS_SYNC_KEY = "@quotecat/business_settings_sync";
const SYNC_COOLDOWN_MS = 30000; // 30 seconds between syncs (settings don't change often)

type SyncMetadata = {
  lastSyncAt: string | null;
  lastLogoSyncAt: string | null;
};

/**
 * Get sync metadata from AsyncStorage
 */
async function getSyncMetadata(): Promise<SyncMetadata> {
  try {
    const json = await AsyncStorage.getItem(SETTINGS_SYNC_KEY);
    if (!json) return { lastSyncAt: null, lastLogoSyncAt: null };
    return JSON.parse(json);
  } catch {
    return { lastSyncAt: null, lastLogoSyncAt: null };
  }
}

/**
 * Save sync metadata to AsyncStorage
 */
async function saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_SYNC_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error("Failed to save settings sync metadata:", error);
  }
}

/**
 * Upload logo to Supabase Storage and get public URL
 * Returns the public URL if successful, null if failed
 */
export async function uploadLogoToStorage(logo: CompanyLogo): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log("⏭️ Logo upload skipped - no user ID");
    return null;
  }

  try {
    // Extract base64 data (remove data URL prefix if present)
    let base64Data = logo.base64;
    let contentType = "image/png";

    if (base64Data.startsWith("data:")) {
      const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        contentType = match[1];
        base64Data = match[2];
      }
    }

    // Convert base64 to ArrayBuffer for upload
    const arrayBuffer = decode(base64Data);

    // Use a consistent filename for the user's logo
    const extension = contentType.split("/")[1] || "png";
    const filePath = `${userId}/logo.${extension}`;

    // Upload to Supabase Storage (company-assets bucket)
    const { error: uploadError } = await supabase.storage
      .from("company-assets")
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: true, // Replace if exists
      });

    if (uploadError) {
      console.error("❌ Logo upload failed:", uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("company-assets")
      .getPublicUrl(filePath);

    console.log("✅ Logo uploaded to storage:", urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error("❌ Logo upload error:", error);
    return null;
  }
}

/**
 * Delete logo from Supabase Storage
 */
export async function deleteLogoFromStorage(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  try {
    // List files in user's folder to find the logo
    const { data: files } = await supabase.storage
      .from("company-assets")
      .list(userId);

    if (!files || files.length === 0) return true;

    // Find and delete logo files
    const logoFiles = files.filter(f => f.name.startsWith("logo."));
    for (const file of logoFiles) {
      await supabase.storage
        .from("company-assets")
        .remove([`${userId}/${file.name}`]);
    }

    console.log("✅ Logo deleted from storage");
    return true;
  } catch (error) {
    console.error("❌ Logo delete error:", error);
    return false;
  }
}

/**
 * Sync business settings to cloud (profiles table)
 * This includes company details, logo URL, and preferences
 */
export async function syncBusinessSettings(): Promise<{ success: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log("⏭️ Business settings sync skipped - no user ID");
    return { success: true };
  }

  try {
    // Check cooldown
    const metadata = await getSyncMetadata();
    if (metadata.lastSyncAt) {
      const elapsed = Date.now() - new Date(metadata.lastSyncAt).getTime();
      if (elapsed < SYNC_COOLDOWN_MS) {
        console.log(`⏳ Business settings sync cooldown: ${Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000)}s remaining`);
        return { success: true };
      }
    }

    console.log("🔄 Syncing business settings to cloud...");

    // Load local data
    const [preferences, logo] = await Promise.all([
      loadPreferences(),
      getCompanyLogo(),
    ]);

    // Upload logo if we have one and it's newer than last sync
    let logoUrl: string | null = null;
    if (logo?.base64) {
      const logoUploadedAt = new Date(logo.uploadedAt).getTime();
      const lastLogoSync = metadata.lastLogoSyncAt ? new Date(metadata.lastLogoSyncAt).getTime() : 0;

      if (logoUploadedAt > lastLogoSync) {
        logoUrl = await uploadLogoToStorage(logo);
      }
    }

    // Prepare profile update data
    const profileUpdate: Record<string, any> = {
      // Company details from preferences
      company_name: preferences.company?.companyName || null,
      company_email: preferences.company?.email || null,
      company_phone: preferences.company?.phone || null,
      company_website: preferences.company?.website || null,
      company_address: preferences.company?.address || null,
      // Zip code from pricing settings
      zip_code: preferences.pricing?.zipCode || null,
      // Full preferences as JSONB for portal to use
      preferences: {
        invoice: preferences.invoice,
        contract: preferences.contract,
        quote: preferences.quote,
        pricing: preferences.pricing,
        paymentMethods: preferences.paymentMethods,
      },
      updated_at: new Date().toISOString(),
    };

    // Add logo URL if we just uploaded
    if (logoUrl) {
      profileUpdate.company_logo_url = logoUrl;
    }

    // Update profiles table
    const { error: updateError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (updateError) {
      console.error("❌ Business settings sync failed:", updateError);
      return { success: false, error: updateError.message };
    }

    // Save sync metadata
    await saveSyncMetadata({
      lastSyncAt: new Date().toISOString(),
      lastLogoSyncAt: logoUrl ? new Date().toISOString() : metadata.lastLogoSyncAt,
    });

    console.log("✅ Business settings synced to cloud");
    return { success: true };
  } catch (error) {
    console.error("❌ Business settings sync error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Force sync business settings (ignores cooldown)
 */
export async function forceSyncBusinessSettings(): Promise<{ success: boolean; error?: string }> {
  // Clear sync metadata to bypass cooldown
  await saveSyncMetadata({ lastSyncAt: null, lastLogoSyncAt: null });
  return syncBusinessSettings();
}

/**
 * Reset sync metadata (for force full sync)
 */
export async function resetBusinessSettingsSyncMetadata(): Promise<void> {
  await AsyncStorage.removeItem(SETTINGS_SYNC_KEY);
}
