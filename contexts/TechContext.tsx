// contexts/TechContext.tsx
// React Context for tech/team state

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getTechContext, TechContext as TechContextType, TechPermissions, canViewPricing, canCreateQuotes, canEditQuote } from '@/lib/team';
import { getCurrentUserId } from '@/lib/authUtils';

interface TechContextValue {
  // State
  techContext: TechContextType | null;
  isLoading: boolean;

  // Computed values
  isTech: boolean;
  ownerId: string | null;
  ownerCompanyName: string | null;
  permissions: TechPermissions | null;

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
