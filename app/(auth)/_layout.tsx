// app/(auth)/_layout.tsx
import { Stack } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";

export default function AuthLayout() {
  return (
    <GradientBackground>
      <Stack />
    </GradientBackground>
  );
}
