# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuoteCat is a React Native Expo app for creating and managing construction quotes. It allows users to build quotes from a product catalog, manage materials, calculate labor costs, and generate PDFs. The app uses local AsyncStorage for persistence with plans to migrate to Supabase.

## Commands

### Development

```bash
npm install              # Install dependencies
npx expo start           # Start Metro bundler
npx expo start -c        # Start with cache cleared
npm run android          # Run on Android
npm run ios              # Run on iOS
npm run web              # Run on web
```

### Code Quality

```bash
npm run lint             # Run ESLint (expo lint)
```

### Environment Setup

Create a `.env` file at project root with:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

If these are missing, you'll see an error in development. Restart Metro after adding: `npx expo start -c`

## Architecture

### Module System

The codebase uses a modular architecture with domain-specific modules in `modules/`:

- **quotes**: Quote persistence and business logic using AsyncStorage. Handles legacy key migration from multiple storage keys.
- **catalog**: Product catalog with categories (framing, drywall, electrical, plumbing). Products have id, name, unit, and unitPrice.
- **assemblies**: Templates for groups of products with computed quantities (e.g., "frame a room" uses dynamic qty calculations based on room dimensions).
- **materials**: Product selection UI with Map-based selection state.
- **wizard**: Multi-step form navigation system with validation.
- **library**: In-memory storage for reusable entries (assemblies, templates). Designed to swap with Supabase later.
- **core/ui**: Shared UI components (FormScreen, BottomBar, MoneyInput, Stepper, Screen).
- **providers**: Context providers for app-wide state.
- **settings**: App settings and configuration.
- **review**: Quote review and PDF generation logic.

### File Structure Conventions

- `modules/[domain]/index.ts`: Main exports for the module
- `modules/[domain]/types.ts`: TypeScript types and interfaces
- `modules/[domain]/ui/`: React components specific to that domain
- `lib/`: Cross-cutting utilities (storage, supabase, quotes API)
- `app/`: Expo Router file-based routing
  - `app/(main)/`: Main tab navigation screens
  - `app/(forms)/`: Form and wizard screens
  - `app/_layout.tsx`: Root layout with SafeAreaProvider

### Routing

Uses Expo Router (v6) with file-based routing:

- `/` → Home screen (quote list)
- `/quote/[id]/edit` → Edit quote form
- `/quote/[id]/materials` → Material selection
- `/quote/[id]/review` → Review and generate PDF
- `/wizard/...` → Multi-step quote creation wizard

### Data Layer

**Quotes Storage (`modules/quotes/index.ts`)**:

- Uses AsyncStorage with legacy key migration
- Reads from multiple keys: `@quotecat/quotes`, `quotes`, `qc:quotes:v1`
- Always writes to primary key: `@quotecat/quotes`
- De-duplicates by id, preferring latest updatedAt/createdAt
- Normalizes data with forward-compatible extra fields

**Library Storage (`modules/library/`)**:

- Currently in-memory Map
- Designed to swap with Supabase without changing call sites
- Exports: `saveEntry`, `getAll`, `getByKind`, `removeEntry`

**Quote Types**:

- `StoredQuote`: Persisted quote with id, name, clientName, items[], labor, timestamps
- `QuoteItem`: Product reference with productId, name, unitPrice, qty, optional currency
- Both types support forward-compatible extra fields via `[key: string]: any`

**Normalization**:

- `normalizeQuote()` and `normalizeItem()` ensure data integrity
- Computes total on save (never trust stored totals)
- Handles missing/invalid timestamps gracefully

### Path Aliases

- `@/*` maps to project root
- Configured in both `tsconfig.json` and `babel.config.js`
- Use `@/modules/...`, `@/lib/...`, `@/constants/...` for imports

### TypeScript

- Strict mode enabled
- Expo base config extended
- Excludes: `node_modules`, `app/_old`, `modules/_old`

### Key Dependencies

- **Expo Router**: File-based navigation (v6)
- **React Native Reanimated**: Animations (keep plugin LAST in babel.config.js)
- **AsyncStorage**: Local persistence
- **Supabase**: Backend (configured but not fully integrated)
- **expo-print & expo-sharing**: PDF generation

## Important Patterns

### Async Storage Patterns

When working with quotes, always use the repo functions in `modules/quotes/index.ts`:

- `listQuotes()`: Returns all quotes sorted by most recent
- `getQuoteById(id)`: Fetch single quote
- `saveQuote(quote)`: Create or update (auto-merges and timestamps)
- `updateQuote(id, patch)`: Partial update
- `deleteQuote(id)`: Remove quote

### Form State Management

Multi-step forms use the wizard pattern:

- Define steps with id, title, optional validate function
- Validation returns error message or null/undefined
- See `modules/wizard/types.ts` for `WizardStep<TState>` interface

### Assembly Expansion

Assemblies can have fixed or computed quantities:

- `{ productId, qty }`: Fixed quantity
- `{ productId, qtyFn: (vars) => number }`: Computed from variables
- See `modules/assemblies/expand.ts` for pricing logic

### Navigation Defaults

Quote UI components accept optional `onPress`/`onLongPress` handlers. When omitted, they default to navigating to edit screen. See `modules/quotes/ui/index.ts:8`.

## Code Style

### ESLint

- Uses expo's flat config format
- Ignores `dist/*`
- Note: `import/no-named-as-default` is silenced for this project

### Prettier

- Active for formatting
- Ignores `_old/` directories
- Run format before commits

### Recent Fixes

- Import warnings silenced for default exports
- Quote UI handlers now accept optional callbacks
- Unescaped apostrophes fixed in JSX strings
