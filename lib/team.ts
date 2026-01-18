// lib/team.ts
// Team/Tech context for Premium users who invite technicians

import { supabase } from './supabase';

export type TechPermissions = {
  can_create_quotes: boolean;
  can_edit_own_quotes: boolean;
  can_edit_all_quotes: boolean;
  can_view_pricing: boolean;
  can_manage_clients: boolean;
  can_view_invoices: boolean;
};

export type TechAccount = {
  id: string;
  owner_id: string;
  tech_auth_id: string;
  role: 'admin' | 'tech';
  status: 'pending' | 'active' | 'suspended' | 'removed';
  name: string;
  email: string;
  phone?: string;
  permissions: TechPermissions;
  invited_at: string;
  joined_at?: string;
  removed_at?: string;
  // Owner's company details (joined from profiles)
  owner_company_name?: string;
  owner_email?: string;
};

export type TechContext = {
  isTech: boolean;
  techAccount: TechAccount | null;
  ownerId: string | null;  // The owner's user_id (for creating quotes)
  ownerCompanyName: string | null;
  permissions: TechPermissions | null;
  // Removal detection
  wasRemoved: boolean;  // True if tech was removed or suspended
  removalReason: 'removed' | 'suspended' | null;
};

const DEFAULT_PERMISSIONS: TechPermissions = {
  can_create_quotes: true,
  can_edit_own_quotes: true,
  can_edit_all_quotes: false,
  can_view_pricing: false,
  can_manage_clients: false,
  can_view_invoices: false,
};

/**
 * Check if the current user is a tech on someone's team
 * Returns null if not a tech, or the TechContext if they are
 * Also detects if the tech was removed/suspended
 */
export async function getTechContext(userId: string): Promise<TechContext> {
  const notATech: TechContext = {
    isTech: false,
    techAccount: null,
    ownerId: null,
    ownerCompanyName: null,
    permissions: null,
    wasRemoved: false,
    removalReason: null,
  };

  if (!userId) {
    return notATech;
  }

  try {
    // Query team_tech_accounts where this user is the tech
    // Don't filter by status - we need to detect removed/suspended
    const { data, error } = await supabase
      .from('team_tech_accounts')
      .select(`
        id,
        owner_id,
        tech_auth_id,
        role,
        status,
        name,
        email,
        phone,
        permissions,
        invited_at,
        joined_at,
        removed_at
      `)
      .eq('tech_auth_id', userId)
      .single();

    if (error || !data) {
      // Not a tech (never was)
      return notATech;
    }

    // Check if tech was removed or suspended
    if (data.status === 'removed' || data.status === 'suspended') {
      console.log(`⚠️ Tech account ${data.status}:`, {
        name: data.name,
        status: data.status,
        removedAt: data.removed_at,
      });

      // Get owner's company name for the removal message
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('company_name')
        .eq('id', data.owner_id)
        .single();

      return {
        isTech: false,
        techAccount: null,
        ownerId: null,
        ownerCompanyName: ownerProfile?.company_name || 'the team',
        permissions: null,
        wasRemoved: true,
        removalReason: data.status as 'removed' | 'suspended',
      };
    }

    // Check if still pending (hasn't fully joined)
    if (data.status === 'pending') {
      return notATech;
    }

    // Get owner's company details for active tech
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('company_name, email')
      .eq('id', data.owner_id)
      .single();

    const techAccount: TechAccount = {
      ...data,
      permissions: data.permissions || DEFAULT_PERMISSIONS,
      owner_company_name: ownerProfile?.company_name || 'Unknown Company',
      owner_email: ownerProfile?.email,
    };

    return {
      isTech: true,
      techAccount,
      ownerId: data.owner_id,
      ownerCompanyName: ownerProfile?.company_name || 'Unknown Company',
      permissions: techAccount.permissions,
      wasRemoved: false,
      removalReason: null,
    };
  } catch (err) {
    console.error('Error fetching tech context:', err);
    return notATech;
  }
}

/**
 * Get the effective owner ID for creating data
 * Returns the owner's ID if user is a tech, otherwise returns the user's own ID
 */
export function getEffectiveOwnerId(userId: string, techContext: TechContext | null): string {
  if (techContext?.isTech && techContext.ownerId) {
    return techContext.ownerId;
  }
  return userId;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(
  techContext: TechContext | null,
  permission: keyof TechPermissions
): boolean {
  // Not a tech = full permissions (they're the owner)
  if (!techContext?.isTech) {
    return true;
  }

  return techContext.permissions?.[permission] ?? false;
}

/**
 * Check if user can view pricing/costs
 */
export function canViewPricing(techContext: TechContext | null): boolean {
  return hasPermission(techContext, 'can_view_pricing');
}

/**
 * Check if user can create quotes
 */
export function canCreateQuotes(techContext: TechContext | null): boolean {
  return hasPermission(techContext, 'can_create_quotes');
}

/**
 * Check if user can edit a specific quote
 */
export function canEditQuote(
  techContext: TechContext | null,
  quoteCreatedByTechId?: string,
  currentUserId?: string
): boolean {
  // Not a tech = can edit all
  if (!techContext?.isTech) {
    return true;
  }

  // Can edit all quotes
  if (techContext.permissions?.can_edit_all_quotes) {
    return true;
  }

  // Can only edit own quotes
  if (techContext.permissions?.can_edit_own_quotes) {
    return quoteCreatedByTechId === currentUserId;
  }

  return false;
}
