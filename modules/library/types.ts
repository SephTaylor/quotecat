import type { Assembly } from '@/modules/assemblies';

export type LibraryKind = 'assembly' | 'quoteTemplate' | 'favoriteItem';

export type LibraryEntry =
  | { id: string; kind: 'assembly'; name: string; data: Assembly }
  | { id: string; kind: 'quoteTemplate'; name: string; data: any } // define later
  | { id: string; kind: 'favoriteItem'; name: string; data: { productId: string; defaultQty?: number } };
