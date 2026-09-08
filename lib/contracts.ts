// lib/contracts.ts
// Contract management service for Premium users

import { supabase } from "./supabase";
import type { Contract, ContractUpdate, Signature, Quote, QuoteItem } from "./types";
import { getCurrentUserId } from "./authUtils";
import { loadPreferences, updateContractSettings } from "./preferences";
import { calculateQuoteTotal } from "./calculations";

/** Escape a user-supplied prefix before putting it in a RegExp. */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highest number already issued to a live contract for this user.
 *
 * The stored counter alone is not trustworthy: it lives in AsyncStorage and
 * was being reset to 1 on every launch by the cloud merge in
 * businessSettingsSync. On 2026-09-08 that produced two contracts 24 minutes
 * apart both numbered CTR-001. Reading the records makes a duplicate
 * impossible even if the counter is stale.
 */
async function getHighestIssuedContractNumber(prefix: string): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) return 0;

  const { data, error } = await supabase
    .from("contracts")
    .select("contract_number")
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to read existing contract numbers:", error);
    return 0;
  }

  const pattern = new RegExp(`^${escapeForRegExp(prefix)}-(\\d+)$`);
  return (data || []).reduce<number>((highest, row) => {
    const match = pattern.exec(String(row.contract_number ?? ""));
    const parsed = match ? parseInt(match[1], 10) : NaN;
    return Number.isFinite(parsed) && parsed > highest ? parsed : highest;
  }, 0);
}

/**
 * Generate the next contract number.
 * Format: PREFIX-###  (e.g., CTR-001)
 *
 * The stored counter is a FLOOR, not the answer, and it only advances when a
 * contract is actually sent (see burnContractNumber). So:
 *   - a draft deleted before it was ever sent returns its number to the pool
 *   - a number that reached a client is retired permanently
 * which is the behaviour contractors expect when numbers are tied to cost
 * tracking and PO matching.
 */
async function generateContractNumber(): Promise<string> {
  const prefs = await loadPreferences();
  const { prefix } = prefs.contract;

  const floor = prefs.contract.nextNumber || 1;
  const highest = await getHighestIssuedContractNumber(prefix);
  const assigned = Math.max(floor, highest + 1);

  return `${prefix}-${String(assigned).padStart(3, "0")}`;
}

/**
 * Retire a contract number so it can never be reused.
 *
 * Called when a contract is SENT, not when it is created. A number the client
 * has seen has to stay with that job even if the contract is later deleted.
 * A draft that never left the building has no such claim on its number.
 */
async function burnContractNumber(contractNumber: string): Promise<void> {
  const prefs = await loadPreferences();
  const prefix = prefs.contract.prefix;
  const match = new RegExp(`^${escapeForRegExp(prefix)}-(\\d+)$`).exec(contractNumber);
  if (!match) return;

  const used = parseInt(match[1], 10);
  if (!Number.isFinite(used)) return;

  const floor = prefs.contract.nextNumber || 1;
  if (used + 1 > floor) {
    await updateContractSettings({ nextNumber: used + 1 });
  }
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
    // Work dates default to whatever's on the quote so a contractor who
    // scheduled the job at the quote stage doesn't have to re-enter them.
    // Explicit options override the quote's values.
    start_date: options?.startDate || quote.startDate || null,
    completion_date: options?.completionDate || quote.completionDate || null,
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
  const updated = await updateContract(id, {
    status: "sent",
    sentAt: new Date().toISOString(),
  });

  // Sending is what makes a number permanent. Do this after the update
  // succeeds so a failed send does not consume a number.
  if (updated?.contractNumber) {
    await burnContractNumber(updated.contractNumber);
  }

  return updated;
}

/**
 * Move a contract back to Draft for editing.
 *
 * Clears the send and view timestamps along with the status. Leaving them
 * behind produced records that read "draft" while still carrying a sent_at,
 * so any report counting sent contracts disagreed with any report reading
 * status. It also left the client's existing link showing the contract above
 * a banner claiming it had never been sent.
 *
 * Signatures are deleted by the caller, which already confirms with the user.
 */
export async function revertContractToDraft(id: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from("contracts")
    .update({
      status: "draft",
      sent_at: null,
      viewed_at: null,
      signed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to revert contract to draft:", error);
    return null;
  }

  return mapSupabaseToContract(data);
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
    declineReason: row.decline_reason as string | undefined,
    changeRequestMessage: row.change_request_message as string | undefined,
    declinedAt: row.declined_at as string | undefined,
    changeRequestedAt: row.change_requested_at as string | undefined,
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
