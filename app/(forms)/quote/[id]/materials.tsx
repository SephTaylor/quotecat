// app/(forms)/quote/[id]/materials.tsx
import { FormScreen } from "@/modules/core/ui";
import React from "react";
import MaterialsInner from "./materials-inner";

/**
 * Wrapper route:
 * - Keeps the existing Materials implementation intact (now in materials-inner.tsx)
 * - Provides consistent form chrome via <FormScreen> (padding/scroll/bottom area)
 * - URL remains /quote/[id]/materials
 */
export default function QuoteMaterials() {
  return (
    <FormScreen
      scroll
      contentStyle={{ paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 }}
    >
      <MaterialsInner />
    </FormScreen>
  );
}
