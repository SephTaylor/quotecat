// lib/teamMembersSync.ts
// Cloud sync service for team members (Premium feature)
// One-way sync: Downloads team members from portal to mobile
// Team members are managed via the portal, not the mobile app

import { supabase } from "./supabase";
import type { TeamMember } from "./types";
import { getCurrentUserId } from "./authUtils";
import { getTechContext } from "./team";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  saveTeamMembersBatchDB,
  clearTeamMembersDB,
  listTeamMembersDB,
  deleteTeamMemberDB,
} from "./database";

const SYNC_METADATA_KEY = "@quotecat/team_members_sync_metadata";
const SYNC_COOLDOWN_MS = 30000; // 30 seconds between syncs

type SyncMetadata = {
  lastSyncAt: string | null;
};

/**
 * Get sync metadata from storage
 */
async function getSyncMetadata(): Promise<SyncMetadata> {
  try {
    const json = await AsyncStorage.getItem(SYNC_METADATA_KEY);
    if (!json) return { lastSyncAt: null };
    return JSON.parse(json);
  } catch {
    return { lastSyncAt: null };
  }
}

/**
 * Save sync metadata to storage
 */
async function saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error("Failed to save team members sync metadata:", error);
  }
}

/**
 * Check if enough time has passed since last sync
 */
async function checkSyncCooldown(): Promise<boolean> {
  try {
    const metadata = await getSyncMetadata();
    if (!metadata.lastSyncAt) return true;

    const lastSync = new Date(metadata.lastSyncAt).getTime();
    const elapsed = Date.now() - lastSync;

    if (elapsed < SYNC_COOLDOWN_MS) {
      console.log(
        `⏳ Team members sync cooldown: ${Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000)}s remaining`
      );
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Download team members from Supabase
 * For techs, downloads team members owned by the team owner
 */
export async function downloadTeamMembers(): Promise<TeamMember[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot download team members: user not authenticated");
      return [];
    }

    // Check if user is a tech - if so, use owner's user_id
    const techContext = await getTechContext(userId);
    const effectiveUserId =
      techContext.isTech && techContext.ownerId ? techContext.ownerId : userId;

    if (techContext.isTech) {
      console.log(
        `🔄 Downloading team members from team owner (${techContext.ownerCompanyName})...`
      );
    }

    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("user_id", effectiveUserId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to download team members:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Map Supabase data to local TeamMember type
    const members: TeamMember[] = data.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name || "",
      phone: row.phone || undefined,
      email: row.email || undefined,
      role: row.role || undefined,
      defaultRate: row.default_rate || 0,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    console.log(`✅ Downloaded ${members.length} team members from cloud`);
    return members;
  } catch (error) {
    console.error("Download team members error:", error);
    return [];
  }
}

/**
 * Sync team members from cloud to local (one-way download)
 * This replaces all local team members with cloud data
 */
export async function syncTeamMembers(): Promise<{
  success: boolean;
  count: number;
}> {
  // Check cooldown
  const canSync = await checkSyncCooldown();
  if (!canSync) {
    console.warn("Team members sync skipped: cooldown active");
    return { success: false, count: 0 };
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot sync team members: user not authenticated");
      return { success: false, count: 0 };
    }

    console.log("🔄 Syncing team members from cloud...");

    // Download all team members from cloud
    const cloudMembers = await downloadTeamMembers();

    // Replace local data with cloud data (full sync)
    clearTeamMembersDB();
    if (cloudMembers.length > 0) {
      saveTeamMembersBatchDB(cloudMembers);
    }

    // Update sync metadata
    await saveSyncMetadata({
      lastSyncAt: new Date().toISOString(),
    });

    console.log(`✅ Team members sync complete: ${cloudMembers.length} members`);
    return { success: true, count: cloudMembers.length };
  } catch (error) {
    console.error("Team members sync error:", error);
    return { success: false, count: 0 };
  }
}

/**
 * Get all local team members (from SQLite cache)
 */
export function getLocalTeamMembers(): TeamMember[] {
  return listTeamMembersDB({ activeOnly: true });
}

/**
 * Check if sync is available (user must be authenticated)
 */
export async function isTeamMembersSyncAvailable(): Promise<boolean> {
  const userId = await getCurrentUserId();
  return !!userId;
}

/**
 * Get last sync timestamp
 */
export async function getTeamMembersLastSyncTime(): Promise<Date | null> {
  const metadata = await getSyncMetadata();
  return metadata.lastSyncAt ? new Date(metadata.lastSyncAt) : null;
}

/**
 * Upload a new team member to Supabase (Premium feature)
 * Also saves locally for immediate use
 */
export async function uploadTeamMember(data: {
  name: string;
  role?: string;
  defaultRate: number;
  phone?: string;
  email?: string;
}): Promise<TeamMember | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot upload team member: user not authenticated");
      return null;
    }

    const { data: inserted, error } = await supabase
      .from("team_members")
      .insert({
        user_id: userId,
        name: data.name,
        role: data.role || null,
        default_rate: data.defaultRate,
        phone: data.phone || null,
        email: data.email || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to upload team member:", error);
      return null;
    }

    // Convert to local format and save locally
    const member: TeamMember = {
      id: inserted.id,
      userId: inserted.user_id,
      name: inserted.name || "",
      phone: inserted.phone || undefined,
      email: inserted.email || undefined,
      role: inserted.role || undefined,
      defaultRate: inserted.default_rate || 0,
      isActive: inserted.is_active,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };

    // Save to local DB
    saveTeamMembersBatchDB([member]);

    console.log(`✅ Uploaded team member: ${member.name}`);
    return member;
  } catch (error) {
    console.error("Upload team member error:", error);
    return null;
  }
}

/**
 * Update a team member in Supabase (Premium feature)
 */
export async function updateTeamMemberCloud(
  id: string,
  updates: Partial<{
    name: string;
    role: string;
    defaultRate: number;
    phone: string;
    email: string;
    isActive: boolean;
  }>
): Promise<TeamMember | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot update team member: user not authenticated");
      return null;
    }

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.defaultRate !== undefined) updateData.default_rate = updates.defaultRate;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    updateData.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("team_members")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Failed to update team member:", error);
      return null;
    }

    // Convert to local format
    const member: TeamMember = {
      id: updated.id,
      userId: updated.user_id,
      name: updated.name || "",
      phone: updated.phone || undefined,
      email: updated.email || undefined,
      role: updated.role || undefined,
      defaultRate: updated.default_rate || 0,
      isActive: updated.is_active,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };

    // Update local DB
    saveTeamMembersBatchDB([member]);

    console.log(`✅ Updated team member: ${member.name}`);
    return member;
  } catch (error) {
    console.error("Update team member error:", error);
    return null;
  }
}

/**
 * Hard delete a team member from Supabase (Premium feature)
 * Uses actual DELETE to avoid stale data in sync
 */
export async function deleteTeamMemberCloud(id: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn("Cannot delete team member: user not authenticated");
      return false;
    }

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to delete team member:", error);
      return false;
    }

    // Remove from local DB
    deleteTeamMemberDB(id);

    console.log(`✅ Deleted team member: ${id}`);
    return true;
  } catch (error) {
    console.error("Delete team member error:", error);
    return false;
  }
}
