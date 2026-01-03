// lib/clients.ts
// Client management for Pro users - NOW USING SQLITE
// This fixes OOM crashes by loading data row-by-row

import type { Client } from "./types";
import {
  listClientsDB,
  getClientByIdDB,
  saveClientDB,
  saveClientsBatchDB,
  deleteClientDB,
  getClientCountDB,
} from "./database";

import AsyncStorage from "@react-native-async-storage/async-storage";

// Re-export Client type for backwards compatibility
export type { Client } from "./types";

const LAST_CREATED_CLIENT_KEY = "@quotecat/last_created_client";

/**
 * Generate a unique client ID
 */
export function createClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Set the last created client ID (for navigation back to quote)
 */
export async function setLastCreatedClientId(id: string): Promise<void> {
  await AsyncStorage.setItem(LAST_CREATED_CLIENT_KEY, id);
}

/**
 * Get and clear the last created client ID
 */
export async function getAndClearLastCreatedClientId(): Promise<string | null> {
  const id = await AsyncStorage.getItem(LAST_CREATED_CLIENT_KEY);
  if (id) {
    await AsyncStorage.removeItem(LAST_CREATED_CLIENT_KEY);
  }
  return id;
}

/**
 * Get all saved clients
 */
export async function getClients(): Promise<Client[]> {
  return listClientsDB({ limit: 1000 });
}

/**
 * Get a client by ID
 */
export async function getClientById(id: string): Promise<Client | null> {
  return getClientByIdDB(id);
}

/**
 * Save a client locally WITHOUT triggering cloud upload
 * Used during sync to prevent sync loops
 */
export async function saveClientLocally(client: Client): Promise<void> {
  const now = new Date().toISOString();
  const savedClient: Client = {
    ...client,
    createdAt: client.createdAt || now,
    updatedAt: client.updatedAt || now,
  };
  saveClientDB(savedClient);
}

/**
 * Batch save clients (used by sync)
 */
export async function saveClientsBatch(clients: Client[]): Promise<void> {
  if (clients.length === 0) return;
  saveClientsBatchDB(clients);
}

/**
 * Save a client (triggers cloud sync for Pro/Premium)
 */
export async function saveClient(client: Client): Promise<Client> {
  const now = new Date().toISOString();
  const savedClient: Client = {
    ...client,
    createdAt: client.createdAt || now,
    updatedAt: now,
  };

  saveClientDB(savedClient);

  // Auto-sync to cloud for Pro/Premium users (non-blocking)
  import("./clientsSync").then(({ isClientsSyncAvailable, uploadClient }) => {
    isClientsSyncAvailable().then((available: boolean) => {
      if (available) {
        uploadClient(savedClient).catch((error: Error) => {
          console.warn("Background client cloud sync failed:", error);
        });
      }
    });
  });

  return savedClient;
}

/**
 * Create a new client
 */
export async function createClient(data: Omit<Client, "id" | "createdAt" | "updatedAt">): Promise<Client> {
  const now = new Date().toISOString();
  const client: Client = {
    ...data,
    id: `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  };

  return saveClient(client);
}

/**
 * Update a client
 */
export async function updateClient(
  id: string,
  updates: Partial<Omit<Client, "id" | "createdAt">>
): Promise<Client | null> {
  const current = await getClientById(id);
  if (!current) return null;

  const updated: Client = {
    ...current,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };

  return saveClient(updated);
}

/**
 * Delete a client (soft delete)
 */
export async function deleteClient(id: string): Promise<void> {
  deleteClientDB(id);

  // Delete from cloud for Pro/Premium users (non-blocking)
  import("./clientsSync").then(({ isClientsSyncAvailable, deleteClientFromCloud }) => {
    isClientsSyncAvailable().then((available: boolean) => {
      if (available) {
        deleteClientFromCloud(id).catch((error: Error) => {
          console.warn("Background client cloud deletion failed:", error);
        });
      }
    });
  });
}

/**
 * Search clients by name or email
 */
export async function searchClients(query: string): Promise<Client[]> {
  if (!query.trim()) return getClients();
  return listClientsDB({ search: query, limit: 100 });
}

/**
 * Get client count
 */
export function getClientCount(): number {
  return getClientCountDB(false);
}
