// lib/logo.ts - STUBBED FOR TESTING
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGO_STORAGE_KEY = '@quotecat/company-logo';

export interface CompanyLogo {
  url: string;
  base64?: string;
  localUri?: string;
  uploadedAt: string;
}

export async function requestImagePermissions(): Promise<boolean> { return false; }
export async function pickImage(): Promise<string | null> { throw new Error('Disabled'); }
export async function processImage(uri: string): Promise<string> { return uri; }
export async function convertToBase64(uri: string): Promise<string> { return ''; }
export async function uploadLogoToSupabase(userId: string, imageUri: string): Promise<string> { throw new Error('Disabled'); }
export async function saveLogoToProfile(userId: string, logoUrl: string): Promise<void> { }
export async function cacheLogoLocally(logoUrl: string, localUri: string, base64: string): Promise<void> {
  await AsyncStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify({ url: logoUrl, localUri, base64, uploadedAt: new Date().toISOString() }));
}
export async function getCachedLogo(): Promise<CompanyLogo | null> {
  try { const data = await AsyncStorage.getItem(LOGO_STORAGE_KEY); return data ? JSON.parse(data) : null; } catch { return null; }
}
export async function deleteLogo(userId: string): Promise<void> { await AsyncStorage.removeItem(LOGO_STORAGE_KEY); }
export async function uploadCompanyLogo(userId: string): Promise<CompanyLogo> { throw new Error('Disabled'); }
export async function getCompanyLogo(userId: string): Promise<CompanyLogo | null> {
  const cached = await getCachedLogo();
  if (cached) return cached;
  const { data, error } = await supabase.from('profiles').select('logo_url').eq('id', userId).single();
  if (error || !data?.logo_url) return null;
  return { url: data.logo_url, uploadedAt: new Date().toISOString() };
}
