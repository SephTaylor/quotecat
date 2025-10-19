// app/(main)/index.tsx
// Redirect to tabs
import { Redirect } from "expo-router";

export default function MainIndex() {
  return <Redirect href="./(tabs)" />;
}
