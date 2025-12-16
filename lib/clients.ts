// lib/clients.ts
// Client management for Pro users

import AsyncStorage from "@react-native-async-storage/async-storage";
import { isClientsSyncAvailable, uploadClient, deleteClientFromCloud } from "./clientsSync";

const CLIENTS_KEY = "@quotecat/clients";

export type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Get all saved clients
 */
export async function getClients(): Promise<Client[]> {
  try {
    const json = await AsyncStorage.getItem(CLIENTS_KEY);
    if (!json) return [];
    return JSON.parse(json);
  } catch (error) {
    console.error("Failed to load clients:", error);
    return [];
  }
}

/**
 * Get a client by ID
 */
export async function getClientById(id: string): Promise<Client | null> {
  const clients = await getClients();
  return clients.find((c) => c.id === id) || null;
}

/**
 * Save a client (create or update)
 */
export async function saveClient(client: Client): Promise<void> {
  try {
    const clients = await getClients();
    const existingIndex = clients.findIndex((c) => c.id === client.id);

    let savedClient: Client;
    if (existingIndex >= 0) {
      // Update existing
      savedClient = {
        ...client,
        updatedAt: new Date().toISOString(),
      };
      clients[existingIndex] = savedClient;
    } else {
      // Add new
      savedClient = {
        ...client,
        createdAt: client.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      clients.push(savedClient);
    }

    await AsyncStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));

    // Background sync to cloud (non-blocking)
    isClientsSyncAvailable().then((available) => {
      if (available) {
        uploadClient(savedClient).catch((error) => {
          console.warn("Background client sync failed:", error);
        });
      }
    });
  } catch (error) {
    console.error("Failed to save client:", error);
    throw error;
  }
}

/**
 * Delete a client
 */
export async function deleteClient(id: string): Promise<void> {
  try {
    const clients = await getClients();
    const filtered = clients.filter((c) => c.id !== id);
    await AsyncStorage.setItem(CLIENTS_KEY, JSON.stringify(filtered));

    // Background sync deletion to cloud (non-blocking)
    isClientsSyncAvailable().then((available) => {
      if (available) {
        deleteClientFromCloud(id).catch((error) => {
          console.warn("Background client deletion sync failed:", error);
        });
      }
    });
  } catch (error) {
    console.error("Failed to delete client:", error);
    throw error;
  }
}

/**
 * Search clients by name, email, or phone
 */
export async function searchClients(query: string): Promise<Client[]> {
  const clients = await getClients();
  if (!query.trim()) return clients;

  const q = query.toLowerCase();
  return clients.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
  );
}

/**
 * Create a new client ID
 */
export function createClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
