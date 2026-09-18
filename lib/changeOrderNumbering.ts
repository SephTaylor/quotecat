// lib/changeOrderNumbering.ts
//
// CANONICAL definition of how a change order is numbered. Pure string logic,
// no imports, no platform dependencies, so the portal can mirror it exactly
// when it grows change order support. See docs/CHANGE-ORDERS-CONTRACT.md.
//
// DO NOT write a second version of this. The invoice profitability bug of
// 2026-09-18 was two surfaces each carrying their own copy of one calculation.
//
// ---------------------------------------------------------------------------
// The scheme
//
// A change order is a modification to a signed contract, so its number hangs
// off the contract's number and says which modification it is:
//
//   CTR-001          the signed contract
//     CTR-001.1      first modification
//     CTR-001.2      second modification
//     CTR-001.3      third modification
//       CTR-001.3.1  a change to that third modification
//
// Siblings count up. Depth means, and only means, that you modified a
// modification. Uncapped, which Mike confirmed.
//
// ---------------------------------------------------------------------------
// Why this and not the other reading
//
// Mike described three sequential change orders as 1000.1, then 1000.1.2, then
// 1000.1.2.3. Taken literally that spends a level of depth per change order:
// the eighth reads 1000.1.2.3.4.5.6.7.8, which does not fit on a document or in
// a purchase order field, and tells you nothing without counting segments. It
// also leaves no notation for the nesting he separately asked for, because
// counting and nesting would be competing for the same dots.
//
// What he actually wanted from that comment is stated plainly in it: "a
// separate PO for a particular change order if contractor wants to track cost
// per change order... I used to like to know what kind of profit I made on the
// change orders." Each modification needs its own stable identifier. The dots
// were him thinking out loud about how to write it.
//
// ---------------------------------------------------------------------------
// Why the whole parent number, prefix and all
//
// Contract numbers are `${prefix}-${padded}` where the prefix is a user
// setting (CTR, CON, whatever they choose). Parsing it off would break the day
// someone changes that setting. Appending to the parent number verbatim is
// format-agnostic and makes the lineage readable: CTR-001.2 obviously belongs
// to CTR-001.

/**
 * Compose a change order's display number from its parent's number.
 *
 * @param parentNumber The contract number for a top-level change order
 *                     ("CTR-001"), or the parent change order's display number
 *                     when nesting ("CTR-001.3").
 * @param counter      The sibling counter under that parent, 1-based. This is
 *                     the `number` column, produced by
 *                     getNextChangeOrderNumberDB.
 * @returns e.g. "CTR-001.2", or undefined when the parent has no number yet
 *          (an unsent draft contract), in which case the caller should leave
 *          display_number null and compose it once the parent is numbered.
 */
export function composeChangeOrderNumber(
  parentNumber: string | undefined | null,
  counter: number
): string | undefined {
  const parent = (parentNumber ?? "").trim();
  if (!parent) return undefined;
  if (!Number.isFinite(counter) || counter < 1) return undefined;
  return `${parent}.${Math.floor(counter)}`;
}

/**
 * How deep a change order sits. A top-level modification is 1.
 * "CTR-001.2" -> 1, "CTR-001.2.1" -> 2.
 *
 * Counts the dotted segments appended to the parent contract number rather
 * than every dot in the string, so a contract number containing a dot does not
 * throw the count off.
 */
export function changeOrderDepth(
  displayNumber: string | undefined | null,
  contractNumber: string | undefined | null
): number {
  const display = (displayNumber ?? "").trim();
  const root = (contractNumber ?? "").trim();
  if (!display || !root || !display.startsWith(root + ".")) return 0;
  return display.slice(root.length + 1).split(".").length;
}
