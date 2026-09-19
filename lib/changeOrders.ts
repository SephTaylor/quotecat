// lib/changeOrders.ts
//
// Creating a change order against a signed contract. The contract-side entry
// point, mirroring lib/contracts.ts createContractFromQuote.
//
// Rules live in docs/CHANGE-ORDERS-CONTRACT.md. The short version: a change
// order is a modification to a signed contract, it is built as its own
// document rather than by editing the parent, and its number hangs off the
// contract's number.

import type { ChangeOrder, Contract, QuoteItem, Signature } from "./types";
import {
  createChangeOrder,
  updateChangeOrder,
} from "@/modules/changeOrders/storageSQLite";
import { calculateMaterialSubtotal } from "./calculations";
import { supabase } from "./supabase";

/**
 * Whether a contract can take a change order at all.
 *
 * Only once it is signed. Before that there is nothing to modify: the
 * contractor should edit the contract, or revert it to draft and edit it. A
 * modification to an unsigned document is just an edit.
 *
 * `completed` also qualifies, deliberately. Mike was explicit that a late
 * change order on a finished job happens constantly and must keep the
 * contract's number: "this will happen almost every job and you will want to
 * retain the contract number for cost tracking especially if it's going to be
 * linked to a PO number."
 */
export function canAddChangeOrder(contract: Pick<Contract, "status">): boolean {
  return contract.status === "signed" || contract.status === "completed";
}

/**
 * Why a contract cannot take one, for the UI to explain rather than just
 * hiding the button. Returns null when it can.
 */
export function whyCannotAddChangeOrder(
  contract: Pick<Contract, "status">
): string | null {
  if (canAddChangeOrder(contract)) return null;
  if (contract.status === "draft") {
    return "This contract has not been signed yet, so edit it directly instead of raising a change order.";
  }
  if (contract.status === "sent" || contract.status === "viewed") {
    return "Your client has not signed yet. Revert to Draft to make changes, or wait for the signature.";
  }
  if (contract.status === "declined" || contract.status === "changes_requested") {
    return "Your client has not agreed to this contract yet. Sort that out before raising a change order.";
  }
  return "This contract expired without a signature, so there is nothing to modify.";
}

export type NewChangeOrderInput = {
  /** What work this modification covers. Required: it is a signed document. */
  description: string;
  /** Materials added or removed by this change. May be empty for labor-only. */
  items?: QuoteItem[];
  /** Labor dollars this change adds. Negative is allowed for credits. */
  labor?: number;
  /** Optional free text, "Reason for Change". */
  note?: string;
  /**
   * Set when this modifies another change order rather than the contract.
   * Its displayNumber becomes the numbering parent.
   */
  parent?: Pick<ChangeOrder, "id" | "displayNumber">;
};

/**
 * Build and store a change order against a contract.
 *
 * Deliberately does NOT touch the contract. A signed contract is the
 * authoritative instrument and is never rewritten; the modification sits
 * alongside it and carries its own money. Contract totals are recomputed for
 * display by summing signed change orders, not by editing the contract row.
 */
export async function createChangeOrderForContract(
  contract: Contract,
  input: NewChangeOrderInput
): Promise<ChangeOrder> {
  if (!canAddChangeOrder(contract)) {
    throw new Error(
      whyCannotAddChangeOrder(contract) ?? "This contract cannot take a change order."
    );
  }

  const description = input.description.trim();
  if (!description) {
    throw new Error("A change order needs a description of the work it covers.");
  }

  const items = input.items ?? [];
  const labor = input.labor ?? 0;

  // What this modification is worth on its own. Materials plus labor, with the
  // contract's markup and tax applied the same way the contract applies them,
  // so a change order priced off the same pricebook lands on the same margin.
  const materials = calculateMaterialSubtotal(items);
  const markupPercent = contract.markupPercent ?? 0;
  const materialsWithMarkup = materials * (1 + markupPercent / 100);
  const subtotal = materialsWithMarkup + labor;
  const taxPercent = contract.taxPercent ?? 0;
  const netChange = subtotal * (1 + taxPercent / 100);

  const now = new Date().toISOString();

  // Numbering parent: the change order being modified, or the contract.
  const parentNumber = input.parent?.displayNumber || contract.contractNumber;

  const draft: ChangeOrder = {
    id: `co_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    contractId: contract.id,
    parentChangeOrderId: input.parent?.id,
    quoteNumber: contract.contractNumber,
    // Replaced by createChangeOrder, which assigns the real sibling counter.
    number: 0,
    description,
    items: items.map((item) => ({
      productId: item.productId,
      name: item.name,
      unit: (item as { unit?: string }).unit ?? "ea",
      unitPrice: item.unitPrice,
      qtyBefore: 0,
      qtyAfter: item.qty,
      qtyDelta: item.qty,
      lineDelta: item.unitPrice * item.qty,
    })),
    laborBefore: 0,
    laborAfter: labor,
    laborDelta: labor,
    netChange,
    // The contract's own total is untouched. These record what the job was
    // worth before this modification and what it is worth after, which is what
    // makes per change order profit readable later.
    quoteTotalBefore: contract.total,
    quoteTotalAfter: contract.total + netChange,
    note: input.note?.trim() || undefined,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  return createChangeOrder(draft, { parentNumber });
}

// ---------------------------------------------------------------------------
// Signing and sending
//
// A change order signs exactly the way a contract signs, because it is an
// amendment to one: contractor signs, customer receives a link, customer signs.
// Same signatures table, same two-signature rule, same audit fields. See
// docs/CHANGE-ORDERS-CONTRACT.md.
// ---------------------------------------------------------------------------

function mapSignature(row: Record<string, unknown>): Signature {
  return {
    id: row.id as string,
    contractId: (row.contract_id as string) || undefined,
    changeOrderId: (row.change_order_id as string) || undefined,
    signerType: row.signer_type as "contractor" | "client",
    signerName: row.signer_name as string,
    signerEmail: (row.signer_email as string) || undefined,
    signatureImage: row.signature_image as string,
    ipAddress: (row.ip_address as string) || undefined,
    userAgent: (row.user_agent as string) || undefined,
    signedAt: row.signed_at as string,
  };
}

export async function getSignaturesForChangeOrder(
  changeOrderId: string
): Promise<Signature[]> {
  const { data, error } = await supabase
    .from("signatures")
    .select("*")
    .eq("change_order_id", changeOrderId)
    .order("signed_at", { ascending: true });

  if (error) {
    console.error("Failed to load change order signatures:", error);
    return [];
  }
  return (data || []).map(mapSignature);
}

/**
 * The contractor signs first.
 *
 * Deliberately mirrors contracts: the customer is never shown a document the
 * contractor has not signed. That rule exists because a client once received a
 * link to an unsigned contract and the portal refused their signature, so the
 * link simply looked broken.
 */
export async function addChangeOrderContractorSignature(
  changeOrderId: string,
  signatureImage: string,
  signerName: string,
  signerEmail?: string
): Promise<Signature | null> {
  const { data, error } = await supabase
    .from("signatures")
    .insert({
      change_order_id: changeOrderId,
      signer_type: "contractor",
      signer_name: signerName,
      signer_email: signerEmail || null,
      signature_image: signatureImage,
      signed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to add change order signature:", error);
    return null;
  }
  return mapSignature(data);
}

export async function isChangeOrderFullySigned(
  changeOrderId: string
): Promise<boolean> {
  const sigs = await getSignaturesForChangeOrder(changeOrderId);
  return (
    sigs.some((s) => s.signerType === "contractor") &&
    sigs.some((s) => s.signerType === "client")
  );
}

export async function removeChangeOrderSignature(
  signatureId: string
): Promise<boolean> {
  const { error } = await supabase.from("signatures").delete().eq("id", signatureId);
  if (error) {
    console.error("Failed to remove change order signature:", error);
    return false;
  }
  return true;
}

/**
 * Mint a share token so the customer can open this change order.
 *
 * Token rather than a bare id, unlike contracts at /c/[id]. The
 * change_order_shares table was built for this in migration 027 and has sat
 * unused since: it carries an expiry and a revocation timestamp, so a link sent
 * to the wrong address can be killed. Contracts cannot do that.
 *
 * Reuses a live token if one exists, so re-sending does not invalidate the link
 * the customer already has.
 */
export async function createChangeOrderShareToken(
  changeOrderId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("change_order_shares")
    .select("token")
    .eq("change_order_id", changeOrderId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].token as string;
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    console.error("Cannot share a change order while signed out");
    return null;
  }

  // Long random token. Not guessable, and not derived from the change order id
  // so a leaked link reveals nothing about the rest of the account.
  const token = `${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}${Date.now().toString(36)}`;

  const { error } = await supabase.from("change_order_shares").insert({
    change_order_id: changeOrderId,
    token,
    created_by_user_id: userId,
  });

  if (error) {
    console.error("Failed to create change order share:", error);
    return null;
  }
  return token;
}

export function getChangeOrderShareLink(token: string): string {
  return `https://portal.quotecat.ai/co/${token}`;
}

/**
 * Send: mint the link and move the change order to `sent`.
 *
 * Refuses if the contractor has not signed. Same guard the portal applies when
 * the customer arrives, enforced here too so the contractor finds out before
 * the customer does rather than after.
 */
export async function sendChangeOrder(
  changeOrderId: string
): Promise<{ link: string } | { error: string }> {
  const sigs = await getSignaturesForChangeOrder(changeOrderId);
  if (!sigs.some((s) => s.signerType === "contractor")) {
    return {
      error:
        "Sign the change order first. Your customer cannot sign something you have not agreed to, so the link would look broken to them.",
    };
  }

  const token = await createChangeOrderShareToken(changeOrderId);
  if (!token) {
    return { error: "Could not create a link to share. Please try again." };
  }

  await updateChangeOrder({ id: changeOrderId, status: "sent" });

  return { link: getChangeOrderShareLink(token) };
}
