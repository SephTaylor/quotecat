// modules/changeOrders/types.ts
// Re-export types from central types file

export type {
  ChangeOrder,
  ChangeOrderItem,
  ChangeOrderStatus,
  ChangeOrderUpdate,
} from "@/lib/types";

export { ChangeOrderStatusMeta } from "@/lib/types";

/**
 * Snapshot of quote state for diff comparison
 */
export type QuoteSnapshot = {
  items: Array<{
    productId?: string;
    name: string;
    unit: string;
    unitPrice: number;
    qty: number;
  }>;
  labor: number;
  total: number;
};
