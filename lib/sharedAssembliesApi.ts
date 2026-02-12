// lib/sharedAssembliesApi.ts
// API for shared community assemblies

import { supabase } from "./supabase";
import { getCurrentUserId } from "./authUtils";
import type {
  SharedAssembly,
  SharedAssemblyItem,
  AssemblyVote,
  AssemblyTrade,
  SharedAssemblySortOption,
} from "./types";

const PAGE_SIZE = 20;

// =============================================================================
// BROWSE / FETCH
// =============================================================================

export type FetchSharedAssembliesOptions = {
  trade?: AssemblyTrade | "all";
  category?: string;
  search?: string;
  sort?: SharedAssemblySortOption;
  page?: number;
};

/**
 * Fetch shared assemblies from the community library
 */
export async function fetchSharedAssemblies(
  options: FetchSharedAssembliesOptions = {}
): Promise<{ assemblies: SharedAssembly[]; hasMore: boolean }> {
  const { trade = "all", category, search, sort = "popular", page = 0 } = options;

  let query = supabase
    .from("shared_assemblies")
    .select("*")
    .eq("is_active", true)
    .is("hidden_at", null);

  // Filter by trade
  if (trade !== "all") {
    query = query.eq("trade", trade);
  }

  // Filter by category
  if (category) {
    query = query.eq("category", category);
  }

  // Full-text search
  if (search?.trim()) {
    query = query.textSearch("name", search, { type: "websearch" });
  }

  // Sorting
  switch (sort) {
    case "popular":
      query = query.order("copy_count", { ascending: false });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "top_rated":
      // Order by net votes (upvotes - downvotes)
      query = query.order("upvote_count", { ascending: false });
      break;
  }

  // Pagination
  const start = page * PAGE_SIZE;
  query = query.range(start, start + PAGE_SIZE);

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch shared assemblies:", error);
    throw error;
  }

  return {
    assemblies: (data || []).map(mapToSharedAssembly),
    hasMore: (data?.length || 0) === PAGE_SIZE + 1,
  };
}

/**
 * Fetch a single shared assembly by ID
 */
export async function fetchSharedAssemblyById(
  id: string
): Promise<SharedAssembly | null> {
  const { data, error } = await supabase
    .from("shared_assemblies")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("Failed to fetch shared assembly:", error);
    throw error;
  }

  return mapToSharedAssembly(data);
}

// =============================================================================
// SHARE
// =============================================================================

export type ShareAssemblyOptions = {
  name: string;
  description?: string;
  trade: AssemblyTrade;
  category?: string;
  tags?: string[];
  items: SharedAssemblyItem[];
  showCompanyName: boolean;
  companyName?: string;
};

/**
 * Share an assembly to the community library
 */
export async function shareAssembly(
  options: ShareAssemblyOptions
): Promise<SharedAssembly> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Must be authenticated to share assemblies");
  }

  const { data, error } = await supabase
    .from("shared_assemblies")
    .insert({
      creator_id: userId,
      creator_display_name: options.showCompanyName ? options.companyName : null,
      name: options.name,
      description: options.description || null,
      trade: options.trade,
      category: options.category || null,
      tags: options.tags || [],
      items: options.items,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to share assembly:", error);
    throw error;
  }

  return mapToSharedAssembly(data);
}

/**
 * Update a shared assembly (owner only)
 */
export async function updateSharedAssembly(
  id: string,
  updates: Partial<ShareAssemblyOptions>
): Promise<SharedAssembly> {
  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.trade !== undefined) updateData.trade = updates.trade;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.items !== undefined) updateData.items = updates.items;
  if (updates.showCompanyName !== undefined) {
    updateData.creator_display_name = updates.showCompanyName
      ? updates.companyName
      : null;
  }

  const { data, error } = await supabase
    .from("shared_assemblies")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update shared assembly:", error);
    throw error;
  }

  return mapToSharedAssembly(data);
}

/**
 * Delete a shared assembly (owner only)
 */
export async function deleteSharedAssembly(id: string): Promise<void> {
  const { error } = await supabase
    .from("shared_assemblies")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete shared assembly:", error);
    throw error;
  }
}

// =============================================================================
// LIKES (downvotes removed - using comments for feedback instead)
// =============================================================================

/**
 * Like or unlike a shared assembly
 */
export async function voteOnAssembly(
  assemblyId: string,
  voteType: "up" | null
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Must be authenticated to like");
  }

  if (voteType === null) {
    // Remove like
    const { error } = await supabase
      .from("assembly_votes")
      .delete()
      .eq("shared_assembly_id", assemblyId)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to remove like:", error);
      throw error;
    }
  } else {
    // Upsert like
    const { error } = await supabase.from("assembly_votes").upsert(
      {
        shared_assembly_id: assemblyId,
        user_id: userId,
        vote_type: "up",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shared_assembly_id,user_id" }
    );

    if (error) {
      console.error("Failed to like:", error);
      throw error;
    }
  }
}

/**
 * Get user's likes for a list of assemblies
 */
export async function getUserVotes(
  assemblyIds: string[]
): Promise<Map<string, "up">> {
  const userId = await getCurrentUserId();
  if (!userId) return new Map();

  const { data, error } = await supabase
    .from("assembly_votes")
    .select("shared_assembly_id, vote_type")
    .eq("user_id", userId)
    .in("shared_assembly_id", assemblyIds);

  if (error) {
    console.error("Failed to get user likes:", error);
    return new Map();
  }

  const map = new Map<string, "up">();
  data?.forEach((v) => map.set(v.shared_assembly_id, "up"));
  return map;
}

// =============================================================================
// COMMENTS
// =============================================================================

import type { AssemblyComment } from "./types";

/**
 * Get comments for a shared assembly
 */
export async function getAssemblyComments(
  assemblyId: string
): Promise<AssemblyComment[]> {
  const { data, error } = await supabase
    .from("assembly_comments")
    .select("*")
    .eq("shared_assembly_id", assemblyId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to get comments:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    sharedAssemblyId: row.shared_assembly_id,
    userId: row.user_id,
    userDisplayName: row.user_display_name,
    content: row.content,
    createdAt: row.created_at,
  }));
}

/**
 * Add a comment to a shared assembly
 */
export async function addAssemblyComment(
  assemblyId: string,
  content: string
): Promise<AssemblyComment | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Must be authenticated to comment");
  }

  // Get user's display name from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name, email")
    .eq("id", userId)
    .single();

  const displayName = profile?.company_name || profile?.email || undefined;

  const { data, error } = await supabase
    .from("assembly_comments")
    .insert({
      shared_assembly_id: assemblyId,
      user_id: userId,
      user_display_name: displayName,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to add comment:", error);
    throw error;
  }

  return {
    id: data.id,
    sharedAssemblyId: data.shared_assembly_id,
    userId: data.user_id,
    userDisplayName: data.user_display_name,
    content: data.content,
    createdAt: data.created_at,
  };
}

/**
 * Delete a comment (only owner can delete)
 */
export async function deleteAssemblyComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from("assembly_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("Failed to delete comment:", error);
    throw error;
  }
}

// =============================================================================
// COPY TRACKING
// =============================================================================

/**
 * Record when a user copies a shared assembly
 */
export async function recordCopy(
  sharedAssemblyId: string,
  localAssemblyId: string
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const { error } = await supabase.from("assembly_copies").insert({
    shared_assembly_id: sharedAssemblyId,
    user_id: userId,
    local_assembly_id: localAssemblyId,
  });

  if (error) {
    // Don't throw - this is just tracking, not critical
    console.error("Failed to record copy:", error);
  }
}

/**
 * Check if user has already copied a shared assembly
 */
export async function hasUserCopied(sharedAssemblyId: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { data, error } = await supabase
    .from("assembly_copies")
    .select("id")
    .eq("shared_assembly_id", sharedAssemblyId)
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    console.error("Failed to check copy status:", error);
    return false;
  }

  return (data?.length || 0) > 0;
}

// =============================================================================
// REPORTING
// =============================================================================

export type ReportReason = "inappropriate" | "spam" | "misleading" | "other";

/**
 * Report a shared assembly for moderation
 */
export async function reportAssembly(
  assemblyId: string,
  reason: ReportReason,
  details?: string
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Must be authenticated to report");
  }

  const { error } = await supabase.from("assembly_reports").insert({
    shared_assembly_id: assemblyId,
    reporter_id: userId,
    reason,
    details: details || null,
  });

  if (error) {
    if (error.code === "23505") {
      // Already reported by this user
      throw new Error("You have already reported this assembly");
    }
    console.error("Failed to report assembly:", error);
    throw error;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map Supabase row to SharedAssembly type
 */
function mapToSharedAssembly(row: Record<string, unknown>): SharedAssembly {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string | undefined,
    creatorDisplayName: row.creator_display_name as string | undefined,
    name: row.name as string,
    description: row.description as string | undefined,
    trade: row.trade as AssemblyTrade,
    category: row.category as string | undefined,
    tags: (row.tags as string[]) || [],
    items: (row.items as SharedAssemblyItem[]) || [],
    copyCount: (row.copy_count as number) || 0,
    upvoteCount: (row.upvote_count as number) || 0,
    commentCount: (row.comment_count as number) || 0,
    isActive: row.is_active as boolean,
    isFeatured: row.is_featured as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
