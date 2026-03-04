// lib/teamMembers.ts
// High-level API for managing team members (Premium feature)
// Team members are synced from Supabase and used for labor tracking

import { v4 as uuid } from "uuid";
import type { TeamMember } from "./types";
import {
  listTeamMembersDB,
  getTeamMemberByIdDB,
  saveTeamMemberDB,
  deleteTeamMemberDB,
  searchTeamMembersDB,
  saveTeamMembersBatchDB,
  clearTeamMembersDB,
} from "./database";

/**
 * Create a new team member locally
 * Note: For Premium users, team members should be created via portal and synced
 */
export function createTeamMember(data: {
  name: string;
  role?: string;
  defaultRate: number;
  phone?: string;
  email?: string;
}): TeamMember {
  const now = new Date().toISOString();
  const member: TeamMember = {
    id: uuid(),
    name: data.name,
    role: data.role,
    defaultRate: data.defaultRate,
    phone: data.phone,
    email: data.email,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  saveTeamMemberDB(member);
  return member;
}

/**
 * Update an existing team member
 */
export function updateTeamMember(
  id: string,
  updates: Partial<Omit<TeamMember, "id" | "createdAt" | "updatedAt">>
): TeamMember | null {
  const existing = getTeamMemberByIdDB(id);
  if (!existing) return null;

  const updated: TeamMember = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveTeamMemberDB(updated);
  return updated;
}

/**
 * Get all team members (active only)
 */
export function getTeamMembers(): TeamMember[] {
  return listTeamMembersDB({ activeOnly: true });
}

/**
 * Get a team member by ID
 */
export function getTeamMemberById(id: string): TeamMember | null {
  return getTeamMemberByIdDB(id);
}

/**
 * Delete (deactivate) a team member
 */
export function deleteTeamMember(id: string): void {
  deleteTeamMemberDB(id);
}

/**
 * Search team members by name (for autocomplete)
 */
export function searchTeamMembers(query: string, limit = 10): TeamMember[] {
  return searchTeamMembersDB(query, limit);
}

/**
 * Sync team members from Supabase (replaces all local data)
 */
export function syncTeamMembers(members: TeamMember[]): void {
  clearTeamMembersDB();
  if (members.length > 0) {
    saveTeamMembersBatchDB(members);
  }
}

// ============================================
// Backwards compatibility exports (deprecated)
// ============================================

/** @deprecated Use getTeamMembers instead */
export const getSavedWorkers = getTeamMembers;

/** @deprecated Use getTeamMemberById instead */
export const getSavedWorkerById = getTeamMemberById;

/** @deprecated Use searchTeamMembers instead */
export const searchWorkers = searchTeamMembers;
