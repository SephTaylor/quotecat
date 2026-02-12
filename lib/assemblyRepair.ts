// lib/assemblyRepair.ts
// Repairs assemblies with invalid product references by matching items to EXISTING pricebook entries
// This runs AFTER cloud sync to fix both local and cloud data
// NOTE: We only match to existing pricebook items - we do NOT create new ones

import { listAssemblies, saveAssembly, deleteAssembly } from "@/modules/assemblies";
import type { Assembly, AssemblyItem } from "@/modules/assemblies/types";
import { getPricebookItems } from "./pricebook";
import type { PricebookItem } from "./types";
import { uploadAssembly, deleteAssemblyFromCloud } from "./assembliesSync";
import { getUserState } from "./user";

type RepairResult = {
  assembliesChecked: number;
  assembliesRepaired: number;
  itemsFixed: number;
  seedAssembliesRemoved: number;
  errors: string[];
};

// Seed assembly IDs that we created - these can be removed if broken
// Include all known variations of seed assembly IDs
const SEED_ASSEMBLY_IDS = new Set([
  // Original IDs
  "seed-ev-charger",
  "seed-kitchen-rough",
  "seed-panel-upgrade",
  // Alternative IDs used in some versions
  "asm-ev-charger-001",
  "asm-kitchen-roughin-001",
  "asm-panel-upgrade-001",
  // Name-based IDs (some versions used names as IDs)
  "EV Charger Install",
  "Kitchen Rough-In",
  "Basic Panel Upgrade",
]);

/**
 * Repair all assemblies by fixing invalid product references
 * - Only matches items to EXISTING pricebook entries (does NOT create new ones)
 * - Removes broken seed assemblies entirely (they're example data, not user data)
 */
export async function repairAssemblies(): Promise<RepairResult> {

  const result: RepairResult = {
    assembliesChecked: 0,
    assembliesRepaired: 0,
    itemsFixed: 0,
    seedAssembliesRemoved: 0,
    errors: [],
  };

  try {
    // Load assemblies and pricebook
    const [assemblies, pricebookItems] = await Promise.all([
      listAssemblies(),
      getPricebookItems(),
    ]);

    // Only log if there's work to do
    if (assemblies.length === 0) {
      console.log("[AssemblyRepair] No assemblies to check");
      return result;
    }

    result.assembliesChecked = assemblies.length;

    // Build pricebook lookup by name (case-insensitive)
    const pricebookByName = new Map<string, PricebookItem>();
    const pricebookById = new Map<string, PricebookItem>();
    pricebookItems.forEach((item) => {
      pricebookByName.set(item.name.toLowerCase(), item);
      pricebookById.set(item.id, item);
    });

    // Check user tier for cloud sync
    const userState = await getUserState();
    const canSyncToCloud =
      userState.tier === "pro" || userState.tier === "premium";

    // Process each assembly
    for (const assembly of assemblies) {
      const isSeedAssembly = SEED_ASSEMBLY_IDS.has(assembly.id);
      let assemblyModified = false;
      let hasUnfixableItems = false;
      const repairedItems: AssemblyItem[] = [];


      for (const item of assembly.items) {
        // Check if item is valid
        const source = item.source || "catalog";

        // If source is pricebook, check if it exists
        if (source === "pricebook") {
          const exists = pricebookById.has(item.productId);
          if (exists) {
            // Item is valid, keep as-is
            repairedItems.push(item);
            continue;
          }
        }

        // Item needs repair - try to find by name in EXISTING pricebook
        const itemName = item.name;
        if (!itemName) {
          // No name to match - can't fix
          hasUnfixableItems = true;
          repairedItems.push(item);
          continue;
        }

        // Look for existing pricebook item by name (case-insensitive)
        const matchedPricebookItem = pricebookByName.get(itemName.toLowerCase());

        if (matchedPricebookItem) {
          // Fix the item with correct pricebook reference
          const fixedItem: AssemblyItem = {
            productId: matchedPricebookItem.id,
            source: "pricebook",
            qty: "qty" in item ? item.qty : 1,
            name: itemName,
          };
          repairedItems.push(fixedItem);
          assemblyModified = true;
          result.itemsFixed++;
          console.log(
            `[AssemblyRepair] Fixed item "${itemName}" in assembly "${assembly.name}"`
          );
        } else {
          // Can't fix - no matching pricebook item
          hasUnfixableItems = true;
          repairedItems.push(item);
        }
      }

      // For seed assemblies with unfixable items, remove them entirely
      // They're example data, not user data - better to remove than show broken
      if (isSeedAssembly && hasUnfixableItems) {
        console.log(
          `[AssemblyRepair] Removing broken seed assembly: ${assembly.name}`
        );
        await deleteAssembly(assembly.id);
        result.seedAssembliesRemoved++;

        // Also remove from cloud if Pro/Premium
        if (canSyncToCloud) {
          try {
            await deleteAssemblyFromCloud(assembly.id);
            console.log(
              `[AssemblyRepair] Removed seed assembly from cloud: ${assembly.name}`
            );
          } catch (deleteError) {
            // Ignore - might not exist in cloud
          }
        }
        continue;
      }

      // Save repaired assembly if modified
      if (assemblyModified) {
        const repairedAssembly: Assembly = {
          ...assembly,
          items: repairedItems,
          updatedAt: new Date().toISOString(),
        };

        // Save locally
        await saveAssembly(repairedAssembly);
        result.assembliesRepaired++;
        console.log(`[AssemblyRepair] Repaired assembly: ${assembly.name}`);

        // Upload to cloud if Pro/Premium
        if (canSyncToCloud) {
          try {
            await uploadAssembly(repairedAssembly);
            console.log(
              `[AssemblyRepair] Uploaded repaired assembly to cloud: ${assembly.name}`
            );
          } catch (uploadError) {
            result.errors.push(
              `Failed to upload ${assembly.name}: ${uploadError}`
            );
          }
        }
      }
    }
  } catch (error) {
    result.errors.push(`Repair failed: ${error}`);
    console.error("[AssemblyRepair] Error:", error);
  }

  // Only log if repairs were made
  if (result.assembliesRepaired > 0 || result.seedAssembliesRemoved > 0) {
    console.log(
      `[AssemblyRepair] Complete: ${result.assembliesRepaired} repaired, ${result.itemsFixed} items fixed, ${result.seedAssembliesRemoved} seed assemblies removed`
    );
  }

  return result;
}

/**
 * Check if any assemblies need repair
 * Quick check without actually repairing
 */
export async function assembliesNeedRepair(): Promise<boolean> {
  try {
    const [assemblies, pricebookItems] = await Promise.all([
      listAssemblies(),
      getPricebookItems(),
    ]);

    const pricebookById = new Map(pricebookItems.map((p) => [p.id, p]));

    for (const assembly of assemblies) {
      for (const item of assembly.items) {
        const source = item.source || "catalog";

        // If it's a pricebook source item, check if it exists
        if (source === "pricebook") {
          if (!pricebookById.has(item.productId)) {
            return true; // Needs repair
          }
        }

        // Seed assemblies with catalog source items need repair
        if (SEED_ASSEMBLY_IDS.has(assembly.id) && source === "catalog") {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}
