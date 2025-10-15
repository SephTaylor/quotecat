import { getSettings } from './index';

export function formatMoney(value: number): string {
  const { currency, locale } = getSettings();
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value ?? 0);
}
