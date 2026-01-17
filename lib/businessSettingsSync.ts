// lib/businessSettingsSync.ts
// Cloud sync for business settings and logo (Pro/Premium feature)
// Syncs company details, logo, and preferences to Supabase so the portal has everything ready

import { supabase } from "./supabase";
import { getCurrentUserId } from "./authUtils";
import { getTechContext } from "./team";
import { loadPreferences, savePreferences, type UserPreferences } from "./preferences";
import { getCompanyLogo, type CompanyLogo } from "./logo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";

const LOGO_STORAGE_KEY = "@quotecat/company-logo";

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
 * Download business settings from cloud to local storage
 * Called on login to sync settings from another device
 * For techs, downloads the OWNER's settings so PDFs use the owner's branding
 */
export async function downloadBusinessSettings(): Promise<{ success: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log("⏭️ Business settings download skipped - no user ID");
    return { success: true };
  }

  try {
    // Check if user is a tech - if so, download OWNER's settings
    const techContext = await getTechContext(userId);
    const effectiveUserId = techContext.isTech && techContext.ownerId
      ? techContext.ownerId
      : userId;

    if (techContext.isTech) {
      console.log(`🔄 Downloading business settings from team owner (${techContext.ownerCompanyName})...`);
    } else {
      console.log("🔄 Downloading business settings from cloud...");
    }

    // Fetch profile from Supabase (owner's profile for techs)
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("company_name, company_email, company_phone, company_website, company_address, company_logo_url, zip_code, preferences")
      .eq("id", effectiveUserId)
      .single();

    if (fetchError) {
      console.error("❌ Failed to fetch profile:", fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!profile) {
      console.log("⏭️ No profile found in cloud");
      return { success: true };
    }

    // Load current local preferences to merge with cloud data
    const localPrefs = await loadPreferences();

    // Check if cloud has any data worth downloading
    const hasCloudData = profile.company_name || profile.company_email ||
                         profile.company_phone || profile.preferences;

    if (!hasCloudData) {
      console.log("⏭️ Cloud profile has no business settings to download");
      return { success: true };
    }

    // For techs: ALWAYS override with owner's settings (not merge)
    // For owners: merge cloud data into local preferences
    let updatedPrefs: UserPreferences;

    if (techContext.isTech) {
      // Techs get owner's settings as-is (override local)
      updatedPrefs = {
        ...localPrefs,
        company: {
          companyName: profile.company_name || "",
          email: profile.company_email || "",
          phone: profile.company_phone || "",
          website: profile.company_website || "",
          address: profile.company_address || "",
        },
        pricing: {
          ...localPrefs.pricing,
          zipCode: profile.zip_code || "",
        },
      };

      // Override preferences with owner's
      if (profile.preferences) {
        const cloudPrefs = profile.preferences as any;
        if (cloudPrefs.invoice) updatedPrefs.invoice = cloudPrefs.invoice;
        if (cloudPrefs.contract) updatedPrefs.contract = cloudPrefs.contract;
        if (cloudPrefs.quote) updatedPrefs.quote = cloudPrefs.quote;
        if (cloudPrefs.pricing) updatedPrefs.pricing = { ...updatedPrefs.pricing, ...cloudPrefs.pricing };
        if (cloudPrefs.paymentMethods) updatedPrefs.paymentMethods = cloudPrefs.paymentMethods;
      }
    } else {
      // Owners merge cloud data into local
      updatedPrefs = {
        ...localPrefs,
        company: {
          ...localPrefs.company,
          companyName: profile.company_name || localPrefs.company?.companyName || "",
          email: profile.company_email || localPrefs.company?.email || "",
          phone: profile.company_phone || localPrefs.company?.phone || "",
          website: profile.company_website || localPrefs.company?.website || "",
          address: profile.company_address || localPrefs.company?.address || "",
        },
        pricing: {
          ...localPrefs.pricing,
          zipCode: profile.zip_code || localPrefs.pricing?.zipCode || "",
        },
      };

      // Merge cloud preferences if they exist
      if (profile.preferences) {
        const cloudPrefs = profile.preferences as any;
        if (cloudPrefs.invoice) {
          updatedPrefs.invoice = { ...localPrefs.invoice, ...cloudPrefs.invoice };
        }
        if (cloudPrefs.contract) {
          updatedPrefs.contract = { ...localPrefs.contract, ...cloudPrefs.contract };
        }
        if (cloudPrefs.quote) {
          updatedPrefs.quote = { ...localPrefs.quote, ...cloudPrefs.quote };
        }
        if (cloudPrefs.pricing) {
          updatedPrefs.pricing = { ...updatedPrefs.pricing, ...cloudPrefs.pricing };
        }
        if (cloudPrefs.paymentMethods) {
          updatedPrefs.paymentMethods = cloudPrefs.paymentMethods;
        }
      }
    }

    // Save preferences locally
    await savePreferences(updatedPrefs);
    console.log("✅ Business settings downloaded from cloud");

    // Download logo from cloud
    // For techs: ALWAYS update logo to match owner's current logo (including removal)
    // For owners: only download if local is missing
    if (profile.company_logo_url) {
      const localLogo = await getCompanyLogo();
      const shouldDownloadLogo = techContext.isTech || !localLogo;

      if (shouldDownloadLogo) {
        console.log("🔄 Downloading logo from cloud...");
        try {
          // Fetch the logo image
          const response = await fetch(profile.company_logo_url);
          if (response.ok) {
            const blob = await response.blob();
            // Convert blob to base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
              reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result);
              };
              reader.onerror = reject;
            });
            reader.readAsDataURL(blob);
            const base64 = await base64Promise;

            // Save logo locally
            const logo: CompanyLogo = {
              base64,
              uploadedAt: new Date().toISOString(),
            };
            await AsyncStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify(logo));
            console.log("✅ Logo downloaded from cloud");
          }
        } catch (logoError) {
          console.error("⚠️ Failed to download logo:", logoError);
          // Non-fatal - continue without logo
        }
      }
    } else if (techContext.isTech) {
      // Owner has no logo - remove any local logo for tech to stay in sync
      const localLogo = await getCompanyLogo();
      if (localLogo) {
        await AsyncStorage.removeItem(LOGO_STORAGE_KEY);
        console.log("🗑️ Removed local logo to match owner (no logo set)");
      }
    }

    return { success: true };
  } catch (error) {
    console.error("❌ Business settings download error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Sync business settings to cloud (profiles table)
 * This includes company details, logo URL, and preferences
 * NOTE: Techs should NOT upload settings - they use the owner's settings
 */
export async function syncBusinessSettings(): Promise<{ success: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log("⏭️ Business settings sync skipped - no user ID");
    return { success: true };
  }

  // Techs should not upload business settings - they use the owner's
  const techContext = await getTechContext(userId);
  if (techContext.isTech) {
    console.log("⏭️ Business settings upload skipped - techs use owner's settings");
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
