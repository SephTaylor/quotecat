// lib/contracts.ts
// Contract management service for Premium users

import { supabase } from "./supabase";
import type { Contract, ContractUpdate, Signature, Quote, QuoteItem } from "./types";
import { getCurrentUserId } from "./authUtils";
import { loadPreferences, updateContractSettings } from "./preferences";
import { calculateQuoteTotal } from "./calculations";

/**
 * Generate next contract number using user preferences
 * Format: PREFIX-###  (e.g., CTR-001, CONTRACT-001, etc.)
 * Number only increments, never resets (even after deletions)
 */
async function generateContractNumber(): Promise<string> {
  const prefs = await loadPreferences();
  const { prefix, nextNumber } = prefs.contract;

  // Increment the next number in preferences
  await updateContractSettings({ nextNumber: nextNumber + 1 });

  return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
}

/**
 * Create a contract from a quote
 */
export async function createContractFromQuote(
  quote: Quote,
  options?: {
    paymentTerms?: string;
    termsAndConditions?: string;
    startDate?: string;
    completionDate?: string;
  }
): Promise<Contract | null> {
  try {
    const userId = await getCurrentUserId();
    console.log("📋 createContractFromQuote - userId:", userId);
    console.log("📋 createContractFromQuote - quote.id:", quote.id);

    if (!userId) {
      console.error("Cannot create contract: user not authenticated");
      return null;
    }

    // Validate quote ID is a real ID, not "new"
    if (!quote.id || quote.id === "new") {
      console.error("Cannot create contract: quote has not been saved yet");
      return null;
    }

    // Defensive check: only approved or completed quotes can become contracts
    if (quote.status !== "approved" && quote.status !== "completed") {
      console.error("Cannot create contract: quote must be approved or completed");
      return null;
    }

  const contractNumber = await generateContractNumber();

  // Use centralized calculation (markup on line items only, not material estimate)
  const total = calculateQuoteTotal(quote);

  const now = new Date().toISOString();

  // quote_id should be null for local quotes (non-UUID IDs)
  // Only set quote_id if it's a valid Supabase UUID
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quote.id);

  const contractData = {
    user_id: userId,
    quote_id: isValidUuid ? quote.id : null,
    contract_number: contractNumber,
    client_name: quote.clientName || "Unnamed Client",
    client_email: quote.clientEmail || null,
    client_phone: quote.clientPhone || null,
    client_address: quote.clientAddress || null,
    project_name: quote.name || "Untitled Project",
    scope_of_work: quote.notes || null,
    materials: quote.items,
    labor: quote.labor || 0,
    material_estimate: quote.materialEstimate || null,
    markup_percent: quote.markupPercent || null,
    tax_percent: quote.taxPercent || null,
    total,
    payment_terms: options?.paymentTerms || null,
    terms_and_conditions: options?.termsAndConditions || null,
    start_date: options?.startDate || null,
    completion_date: options?.completionDate || null,
    status: "draft",
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("contracts")
    .insert(contractData)
    .select()
    .single();

  if (error) {
    console.error("Failed to create contract:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return null;
  }

  console.log("✅ Contract created successfully:", data?.id);
  return mapSupabaseToContract(data);
  } catch (err) {
    console.error("Contract creation exception:", err);
    return null;
  }
}

/**
 * Get all contracts for current user (with signatures)
 */
export async function listContracts(): Promise<Contract[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("contracts")
    .select("*, signatures(*)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to list contracts:", error);
    return [];
  }

  return (data || []).map((row) => {
    const contract = mapSupabaseToContract(row);
    // Add signatures from the joined data
    if (row.signatures && Array.isArray(row.signatures)) {
      contract.signatures = row.signatures.map(mapSupabaseToSignature);
    }
    return contract;
  });
}

/**
 * Get a single contract by ID
 */
export async function getContractById(id: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Failed to get contract:", error);
    return null;
  }

  return mapSupabaseToContract(data);
}

/**
 * Get contract with signatures
 */
export async function getContractWithSignatures(id: string): Promise<Contract | null> {
  const contract = await getContractById(id);
  if (!contract) return null;

  const signatures = await getSignaturesForContract(id);
  return { ...contract, signatures };
}

/**
 * Update a contract
 */
export async function updateContract(
  id: string,
  update: Partial<ContractUpdate>
): Promise<Contract | null> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Map fields from camelCase to snake_case
  if (update.clientName !== undefined) updateData.client_name = update.clientName;
  if (update.clientEmail !== undefined) updateData.client_email = update.clientEmail;
  if (update.clientPhone !== undefined) updateData.client_phone = update.clientPhone;
  if (update.clientAddress !== undefined) updateData.client_address = update.clientAddress;
  if (update.projectName !== undefined) updateData.project_name = update.projectName;
  if (update.scopeOfWork !== undefined) updateData.scope_of_work = update.scopeOfWork;
  if (update.materials !== undefined) updateData.materials = update.materials;
  if (update.labor !== undefined) updateData.labor = update.labor;
  if (update.materialEstimate !== undefined) updateData.material_estimate = update.materialEstimate;
  if (update.markupPercent !== undefined) updateData.markup_percent = update.markupPercent;
  if (update.taxPercent !== undefined) updateData.tax_percent = update.taxPercent;
  if (update.total !== undefined) updateData.total = update.total;
  if (update.paymentTerms !== undefined) updateData.payment_terms = update.paymentTerms;
  if (update.termsAndConditions !== undefined) updateData.terms_and_conditions = update.termsAndConditions;
  if (update.startDate !== undefined) updateData.start_date = update.startDate;
  if (update.completionDate !== undefined) updateData.completion_date = update.completionDate;
  if (update.status !== undefined) updateData.status = update.status;
  if (update.sentAt !== undefined) updateData.sent_at = update.sentAt;
  if (update.viewedAt !== undefined) updateData.viewed_at = update.viewedAt;
  if (update.signedAt !== undefined) updateData.signed_at = update.signedAt;
  if (update.expiresAt !== undefined) updateData.expires_at = update.expiresAt;

  const { data, error } = await supabase
    .from("contracts")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update contract:", error);
    return null;
  }

  return mapSupabaseToContract(data);
}

/**
 * Delete a contract
 */
export async function deleteContract(id: string): Promise<boolean> {
  const { error } = await supabase.from("contracts").delete().eq("id", id);

  if (error) {
    console.error("Failed to delete contract:", error);
    return false;
  }

  return true;
}

/**
 * Mark contract as sent
 */
export async function markContractSent(id: string): Promise<Contract | null> {
  return updateContract(id, {
    status: "sent",
    sentAt: new Date().toISOString(),
  });
}

/**
 * Get signatures for a contract
 */
export async function getSignaturesForContract(contractId: string): Promise<Signature[]> {
  const { data, error } = await supabase
    .from("signatures")
    .select("*")
    .eq("contract_id", contractId)
    .order("signed_at", { ascending: true });

  if (error) {
    console.error("Failed to get signatures:", error);
    return [];
  }

  return (data || []).map(mapSupabaseToSignature);
}

/**
 * Add contractor signature to contract
 */
export async function addContractorSignature(
  contractId: string,
  signatureImage: string,
  signerName: string,
  signerEmail?: string
): Promise<Signature | null> {
  const signatureData = {
    contract_id: contractId,
    signer_type: "contractor",
    signer_name: signerName,
    signer_email: signerEmail || null,
    signature_image: signatureImage,
    signed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("signatures")
    .insert(signatureData)
    .select()
    .single();

  if (error) {
    console.error("Failed to add signature:", error);
    return null;
  }

  return mapSupabaseToSignature(data);
}

/**
 * Check if contract is fully signed (both parties)
 */
export async function isContractFullySigned(contractId: string): Promise<boolean> {
  const signatures = await getSignaturesForContract(contractId);
  const hasContractor = signatures.some((s) => s.signerType === "contractor");
  const hasClient = signatures.some((s) => s.signerType === "client");
  return hasContractor && hasClient;
}

/**
 * Delete a signature by ID
 */
export async function deleteSignature(signatureId: string): Promise<boolean> {
  const { error } = await supabase
    .from("signatures")
    .delete()
    .eq("id", signatureId);

  if (error) {
    console.error("Failed to delete signature:", error);
    return false;
  }

  return true;
}

/**
 * Generate share link for contract
 */
export function getContractShareLink(contractId: string): string {
  // This will be the webapp URL
  return `https://portal.quotecat.ai/c/${contractId}`;
}

// Helper: Map Supabase row to Contract type
function mapSupabaseToContract(row: Record<string, unknown>): Contract {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    quoteId: row.quote_id as string | undefined,
    contractNumber: row.contract_number as string,
    clientName: row.client_name as string,
    clientEmail: row.client_email as string | undefined,
    clientPhone: row.client_phone as string | undefined,
    clientAddress: row.client_address as string | undefined,
    projectName: row.project_name as string,
    scopeOfWork: row.scope_of_work as string | undefined,
    materials: (row.materials || []) as QuoteItem[],
    labor: Number(row.labor) || 0,
    materialEstimate: row.material_estimate ? Number(row.material_estimate) : undefined,
    markupPercent: row.markup_percent ? Number(row.markup_percent) : undefined,
    taxPercent: row.tax_percent ? Number(row.tax_percent) : undefined,
    total: Number(row.total) || 0,
    paymentTerms: row.payment_terms as string | undefined,
    termsAndConditions: row.terms_and_conditions as string | undefined,
    startDate: row.start_date as string | undefined,
    completionDate: row.completion_date as string | undefined,
    status: row.status as Contract["status"],
    sentAt: row.sent_at as string | undefined,
    viewedAt: row.viewed_at as string | undefined,
    signedAt: row.signed_at as string | undefined,
    expiresAt: row.expires_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    currency: "USD",
  };
}

// Helper: Map Supabase row to Signature type
function mapSupabaseToSignature(row: Record<string, unknown>): Signature {
  return {
    id: row.id as string,
    contractId: row.contract_id as string,
    signerType: row.signer_type as "contractor" | "client",
    signerName: row.signer_name as string,
    signerEmail: row.signer_email as string | undefined,
    signatureImage: row.signature_image as string,
    ipAddress: row.ip_address as string | undefined,
    userAgent: row.user_agent as string | undefined,
    signedAt: row.signed_at as string,
  };
}
