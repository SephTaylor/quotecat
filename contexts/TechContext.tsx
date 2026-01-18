// contexts/TechContext.tsx
// React Context for tech/team state

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Alert } from 'react-native';
import { getTechContext, TechContext as TechContextType, TechPermissions, canViewPricing, canCreateQuotes, canEditQuote } from '@/lib/team';
import { getCurrentUserId } from '@/lib/authUtils';
import { signOut } from '@/lib/auth';

interface TechContextValue {
  // State
  techContext: TechContextType | null;
  isLoading: boolean;

  // Computed values
  isTech: boolean;
  ownerId: string | null;
  ownerCompanyName: string | null;
  permissions: TechPermissions | null;

  // Removal detection
  wasRemoved: boolean;
  removalReason: 'removed' | 'suspended' | null;

  // Permission helpers
  canViewPricing: boolean;
  canCreateQuotes: boolean;
  canEditQuote: (quoteCreatedByTechId?: string) => boolean;

  // Actions
  refreshTechContext: () => Promise<void>;
  clearTechContext: () => void;
}

const TechContextContext = createContext<TechContextValue | null>(null);

export function TechContextProvider({ children }: { children: ReactNode }) {
  const [techContext, setTechContext] = useState<TechContextType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Track if we've already shown the removal alert (prevent duplicate alerts)
  const hasShownRemovalAlert = useRef(false);

  const refreshTechContext = useCallback(async () => {
    setIsLoading(true);
    try {
      const userId = await getCurrentUserId();
      setCurrentUserId(userId);

      if (userId) {
        const context = await getTechContext(userId);
        setTechContext(context);

        if (context.isTech) {
          console.log('👷 Tech context loaded:', {
            company: context.ownerCompanyName,
            role: context.techAccount?.role,
            permissions: context.permissions,
          });
        }

        // Handle removed/suspended tech
        if (context.wasRemoved && !hasShownRemovalAlert.current) {
          hasShownRemovalAlert.current = true;
          const companyName = context.ownerCompanyName || 'the team';
          const reason = context.removalReason === 'suspended' ? 'suspended' : 'removed';

          console.log(`🚫 Tech was ${reason} from ${companyName}, signing out...`);

          // Show alert then sign out
          Alert.alert(
            reason === 'suspended' ? 'Account Suspended' : 'Team Access Removed',
            reason === 'suspended'
              ? `Your access to ${companyName} has been temporarily suspended. Please contact your team administrator.`
              : `You have been removed from ${companyName}. You will be signed out.`,
            [
              {
                text: 'OK',
                onPress: async () => {
                  try {
                    await signOut();
                  } catch (error) {
                    console.error('Error signing out after removal:', error);
                  }
                },
              },
            ],
            { cancelable: false }
          );
        }
      } else {
        setTechContext(null);
      }
    } catch (error) {
      console.error('Error loading tech context:', error);
      setTechContext(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearTechContext = useCallback(() => {
    setTechContext(null);
    setCurrentUserId(null);
    hasShownRemovalAlert.current = false; // Reset for next login
  }, []);

  // Load tech context on mount
  useEffect(() => {
    refreshTechContext();
  }, [refreshTechContext]);

  const value: TechContextValue = {
    techContext,
    isLoading,

    isTech: techContext?.isTech ?? false,
    ownerId: techContext?.ownerId ?? null,
    ownerCompanyName: techContext?.ownerCompanyName ?? null,
    permissions: techContext?.permissions ?? null,

    // Removal detection
    wasRemoved: techContext?.wasRemoved ?? false,
    removalReason: techContext?.removalReason ?? null,

    canViewPricing: canViewPricing(techContext),
    canCreateQuotes: canCreateQuotes(techContext),
    canEditQuote: (quoteCreatedByTechId?: string) =>
      canEditQuote(techContext, quoteCreatedByTechId, currentUserId ?? undefined),

    refreshTechContext,
    clearTechContext,
  };

  return (
    <TechContextContext.Provider value={value}>
      {children}
    </TechContextContext.Provider>
  );
}

export function useTechContext(): TechContextValue {
  const context = useContext(TechContextContext);
  if (!context) {
    // Return a default value if used outside provider
    // This allows gradual adoption without breaking existing code
    return {
      techContext: null,
      isLoading: false,
      isTech: false,
      ownerId: null,
      ownerCompanyName: null,
      permissions: null,
      wasRemoved: false,
      removalReason: null,
      canViewPricing: true,
      canCreateQuotes: true,
      canEditQuote: () => true,
      refreshTechContext: async () => {},
      clearTechContext: () => {},
    };
  }
  return context;
}

/**
 * Hook to get the effective owner ID for creating data
 * Returns the owner's ID if user is a tech, otherwise returns the user's own ID
 */
export function useEffectiveOwnerId(): string | null {
  const { isTech, ownerId } = useTechContext();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUserId().then(setUserId);
  }, []);

  if (isTech && ownerId) {
    return ownerId;
  }
  return userId;
}
