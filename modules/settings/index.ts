export type AppSettings = {
  currency: string;
  locale: string;
  taxRatePct: number;
};

export function getSettings(): AppSettings {
  return { currency: 'USD', locale: 'en-US', taxRatePct: 0 };
}
