// lib/settings.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const CURRENCY_KEY = "qc:currency";
export const DEFAULT_CURRENCY = "USD";

export async function getCurrency(): Promise<string> {
  const v = await AsyncStorage.getItem(CURRENCY_KEY);
  return (v || DEFAULT_CURRENCY).toUpperCase();
}

export async function setCurrency(code: string): Promise<void> {
  await AsyncStorage.setItem(CURRENCY_KEY, code.trim().toUpperCase());
}
