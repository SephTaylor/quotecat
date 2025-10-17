// app/(forms)/_layout.tsx
import { Screen } from "@/modules/core/ui";
import { Slot } from "expo-router";
import React from "react";

/**
 * Forms layout:
 * - Wraps every child route in our shared <Screen> shell
 * - Ensures consistent safe areas and keyboard handling for form flows
 */
export default function FormsLayout() {
  return (
    <Screen
      // Forms typically manage their own ScrollView, so leave scroll off here
      scroll={false}
      // Keep padding zero; individual screens add their own content padding
      contentStyle={{ paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 }}
    >
      <Slot />
    </Screen>
  );
}
