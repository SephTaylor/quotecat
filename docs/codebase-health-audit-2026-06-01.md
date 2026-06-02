# QuoteCat Codebase Health Audit — 2026-06-01

**Conducted at:** `main` commit `7251d6b` (v1.2.6 prep complete, v1.2.5 in App Store / Play production review).

**Method:** Three parallel audit agents covering architecture & file bloat, duplication & dead code & stale docs, and TypeScript / dependencies / performance.

**Bottom line:** **Health rating MEDIUM.** Fine to ship from today. Will become painful at roughly 2x the current code volume (~30K lines) if a few specific items aren't addressed. The most urgent finding is a single piece of duplicate business logic that's a real bug-spawner. Everything else is technical debt that can be scheduled.

## Scope of this audit (refreshed 2026-06-02)

**What was audited:** the QuoteCat mobile app codebase at `/Users/sephtaylor/Projects/quotecat` only. That's `app/`, `lib/`, `modules/`, `components/`, `scripts/`, `supabase/functions/`, and `website/`.

**What was NOT audited but is part of the shipping product:** the QuoteCat portal at `/Users/sephtaylor/Projects/quotecat-portal` — a separate Next.js project that hosts the Premium-tier web experience (contractor dashboard, client-facing quote/contract/payment pages, worker job-assignment portal, analytics, QuickBooks sync, two-way SMS via Twilio, scheduling, profitability setup). Premium tier specifically markets portal access, so audit findings that ask "is feature X really shipped?" need to check both projects, not just mobile.

**Concrete example of the blindspot:** during a follow-up verification on 2026-06-02 (sourcing a marketing brief), three Premium-tier features were initially flagged as "not in code" — two-way client texting, job scheduling & calendar, QuickBooks sync. All three are real and shipped, just on the portal side: `src/components/SMSSettings.tsx` + `src/app/api/messages/route.ts` (Twilio SMS with provisioning, business hours, after-hours auto-reply), `src/app/dashboard/jobs` + `src/app/worker/[token]` (worker-side job view with phone auth), and `src/app/api/quickbooks/route.ts` + `src/app/api/quickbooks/sync/all/route.ts` (QuickBooks integration). The audit didn't flag these as missing because the agents weren't asked about them — but the precedent is real: when re-running audits, give the agents both projects or run separate sweeps per project.

**What this means for the findings below:**

- **Architecture / file-size findings** are mobile-only. Portal may have its own offenders, unmeasured.
- **Sync / database / hook-pattern findings** are mobile-only. Portal uses Next.js + Supabase server-side helpers — entirely different architecture, different risks.
- **TypeScript / dependency findings** are mobile-only. Portal has its own `package.json`, `tsconfig.json`, and TS error inventory — all unmeasured here.
- **CLAUDE.md drift findings** mostly hold up — they're about backend/feature-status (Drew tier gating, xByte status, "30K+ products", supplier API state) rather than mobile-vs-portal feature presence. But future drift work on CLAUDE.md should check both projects when verifying a claim.

**Follow-up:** add a "Portal codebase health audit" item to the remediation plan (now in Tier 3).

---

## TL;DR — The five things that matter most

If you only do five things from this audit:

1. **Fix the `calculateQuoteTotals` duplication.** It exists in BOTH `lib/calculations.ts:25-69` AND `lib/validation.ts:176-206` with different signatures. Different callers grab different versions. This is the most likely source of a future "the dashboard and the PDF show different numbers" bug.
2. **Delete the `_old/` directory.** ~980 lines of dead code. Excluded from TypeScript but still eats brain space when navigating. Pure cleanup, zero risk.
3. **Get TypeScript back to zero errors.** Currently 91 errors across 14 categories. Most are mechanical (function signature mismatches). About 4-6 hours of focused work, and from that point on, real type errors will be visible instead of buried in noise.
4. **Decide what to do about `expo-dev-client` shipping in production builds.** It's in `dependencies`, not `devDependencies`. Either intentional (verify why) or accidental (move it and reduce bundle size).
5. **Fix the 8 stale CLAUDE.md claims** — especially the ones about features that don't actually ship or that have changed since the doc was written. These mislead future-you (and future-Claude) into making the wrong calls.

Everything below expands on these and adds the rest of the findings.

---

## Architecture & file bloat

### Top 5 file-size offenders

| File | Lines | Verdict |
|---|---|---|
| `lib/database.ts` | 3,042 | 🔴 Bloated. SQLite layer with 60+ functions spanning quote, invoice, client, pricebook, payment, labor, assembly, contract. Split by domain. |
| `app/(main)/invoice/[id].tsx` | 2,851 | 🔴 Too large. Mixes payment logic, profit calc, state (22 `useState` calls), and UI. Missing a `useInvoiceForm` hook. |
| `app/(forms)/quote/[id]/edit.tsx` | 2,696 | 🔴 Too large. 31 `useState` calls. Has a `useQuoteForm` hook but it doesn't consolidate state aggressively enough. |
| `supabase/functions/drew-agent/index.ts` | 2,206 | 🟡 Acceptable. AI logic is inherently complex; state-machine refactor noted in CLAUDE.md will help. |
| `lib/pdf.ts` | 1,572 | 🟡 Acceptable. PDF generation is legitimately complex. Debug logs at the top are noisy but harmless. |

### Module boundary findings

- **Module boundaries are clean.** `catalog` doesn't import from `quotes`. `assemblies` depends only on `catalog`. `materials` (picker UI) depends only on `catalog`. No circular dependencies detected. **This is working well.**
- **Sync logic is scattered.** 8 separate sync files (`quotesSync.ts`, `invoicesSync.ts`, `clientsSync.ts`, `assembliesSync.ts`, `pricebookSync.ts`, `businessSettingsSync.ts`, `changeOrdersSync.ts`, `teamMembersSync.ts`) totaling ~4,788 lines. Each has roughly the same retry/cooldown/lock logic but no shared orchestrator. Adding a new syncable resource means duplicating the pattern.
- **Calculation source-of-truth is split.** `lib/calculations.ts` AND `modules/quotes/calc.ts` AND `modules/job-calculator/formulas/*` all do margin/totals math. `pdf.ts` has a comment "recalculate fresh to ensure correct math" (line 60-62), which is a tell that stored totals diverge in practice.
- **Custom-hooks pattern is inconsistent.** `app/(forms)/quote/[id]/edit.tsx` uses `useQuoteForm()` — good. `app/(main)/invoice/[id].tsx` does NOT have an equivalent — 22 `useState` calls inline. `dashboard.tsx` also doesn't.

### What's working well

- Module cohesion across `modules/`
- `useQuoteForm` as a template (other screens should follow)
- Sync safety: persistent lock survives crashes; `saveQuoteLocally` prevents the sync-loop bug correctly
- Crash-loop detection in `app/_layout.tsx` before data reads
- Lazy init for Supabase and RevenueCat — no crash-on-startup risk

---

## Duplication, dead code, stale docs

### CRITICAL — `calculateQuoteTotals` duplicated

- **File A:** `lib/calculations.ts:25-69` — current source of truth, used by `invoices.ts`, `modules/quotes`, etc.
- **File B:** `lib/validation.ts:176-206` — different signature (includes overhead field), still imported by `quotesSync.ts:7` and others.
- **Risk:** Callers grab whichever they happen to import first. Result: subtle "numbers don't agree across screens" bugs. The validation.ts version is functionally legacy and should be removed; callers migrated to calculations.ts.

### Dead code

| Item | Location | Confidence | Action |
|---|---|---|---|
| `_old/` directory (~980 lines) | `_old/` | HIGH | Delete. Excluded from tsconfig already; pure cleanup. |
| Private `normalizeQuote/Invoice/Client` duplicates | `lib/asyncStorageMigration.ts:197-277` | HIGH | Call the public ones from `lib/validation.ts` (or wherever they end up after consolidating with calculations.ts). |
| `cleanupAsyncStorage()` | `lib/asyncStorageMigration.ts:283-302` | MEDIUM | Exported, never called. Either run it once or delete it. |
| `lib/validation.ts` (whole file) | — | MEDIUM | After consolidating `calculateQuoteTotals` into calculations.ts and migrating normalization helpers, this file likely goes away entirely. |

### Stale CLAUDE.md claims (8 specific drift items)

| Line(s) in CLAUDE.md | Claim | Reality |
|---|---|---|
| Lines 30-31 | "All data stored locally on your device" | Pro/Premium users sync to Supabase. Misleading for non-Free tiers. |
| Line 300 | "Drew AI quote building" as Premium feature | Drew exists but `canAccessDrewSupport()` in `lib/features.ts:160-162` returns `true` for **all** tiers. Tier gating is inconsistent. |
| Line 335 | Catalog populated by "1Build API sync job" | Actual sync function is `sync-xbyte` for xByte (Lowe's, HD, Menards). No 1Build code exists. |
| Line 400 | "30k+ products" | Catalog is seeded in-memory from `modules/catalog/seed.ts`. No evidence the xByte sync has ever populated a real production catalog. |
| Lines 395-419 | Supplier API integration architecture as if shipped | Sync function exists but no scheduler / triggers. ~70% built, not 100%. |
| Line 837 | "Real-time pricing data" via xByte | Code is weekly-snapshot based (see `week_of` column). Not real-time. |
| Lines 882-888 | Mobile app pulls current prices from Supabase | No such code in the mobile app. `modules/catalog/productService.ts` doesn't sync from Supabase. |
| Line 1063 | xByte feature "strategically deferred" | Code is ~80% implemented. "Deferred" suggests not started; the actual state is "paused mid-build." |

### Why this matters

These drift items affect decision-making more than they affect the code itself. If you (or a future Claude) reads CLAUDE.md to figure out "do we have xByte data?" the answer needs to be "the function exists but has never been wired up to a scheduler" — not "30k+ products real-time." Same for Drew, same for "all data local." Rewriting these sections to reflect today's reality is a higher-leverage fix than most code changes.

---

## TypeScript health

### 91 errors across 14 categories

Most are mechanical — recent refactors left some callers behind.

| Category | Count | Examples |
|---|---|---|
| Argument count mismatch (TS2554) | 9 | `lib/safeStorage.ts:261` calls `getQuoteCountDB(false)` on a zero-arg signature |
| `SharedAssembly` missing `downvoteCount` | 4 | `community-assemblies.tsx:152,167,184,203,284` — UI built for downvotes that don't exist in the type |
| Switch handler return type | 4 | `settings.tsx:630,651,660,669` — handlers return `Promise<UserPreferences>` to a Switch expecting `void` |
| `OverheadSettings` optional field | 3 | `confirm-target-margin.tsx:104`, `labor-rate-calculator.tsx:111`, `OnboardingFlow.tsx:140` |
| Missing `@types/uuid` | 1 | Add `@types/uuid` to devDependencies — one-line fix |
| Other | ~70 | FlashList prop API drift, ThemeMode indexing, scattered null/undefined assignability |

**Total cleanup time: ~4-6 hours.** Most are signature changes or adding optional chaining.

### `as any` / `: any` overuse

**119 `any` casts** in source — 73 `as any`, 46 `: any`. Worst offenders:

- `lib/preferences.ts:211` — `JSON.parse(json) as any` for stored preferences. **No runtime validation.** If cloud sync returns malformed data, the cast hides it until something downstream blows up.
- `lib/user.ts:92-100` — multiple `(state as any)` casts for migration fields.
- `lib/businessSettingsSync.ts:214,243` — cloud-payload deserialization without validation.
- `app/(forms)/quote/[id]/edit.tsx:57,60,798,1120,1309` — `as any` to suppress router path types. Cosmetic, but adds up.

The biggest risk is the deserialization escape hatches. Adding lightweight Zod (or similar) validation at sync ingress points would catch malformed data at the boundary instead of three function calls later when it crashes.

---

## Dependencies

### Should move to devDependencies

| Package | Current location | Why it should be devDep |
|---|---|---|
| `pg` | `dependencies` | PostgreSQL driver. No `import "pg"` in `app/`, `lib/`, `modules/`, or `components/`. Used only by backend scripts. |
| `supabase` | `dependencies` | The CLI tool itself. Only for migrations / Edge Function work. Not imported in app code. |
| `xlsx` | `dependencies` | Spreadsheet utility. No imports found. |

Moving these doesn't break anything but reduces declared production surface area and clarifies intent.

### `expo-dev-client` decision

Currently in `dependencies`. It's the dev-client launcher; production builds typically exclude it. Two paths:

- **If it's intentional** (you want dev-client deep linking to keep working in release builds): keep it but note it in CLAUDE.md so future-you doesn't move it accidentally.
- **If it's accidental**: move it to `devDependencies`. As a bonus, this would *also* drop the ML Kit barcode scanner transitive dependency that Google Play flagged in v1.2.4 — but only relevant if you're not adding `expo-camera` for the v1.2.7 scanner feature (which legitimizes the ML Kit dep anyway).

The v1.2.7 scanner plan resolves this question by-product: when `expo-camera` lands in v1.2.7, the ML Kit dep is intentional, and `expo-dev-client` can go to devDeps without affecting Play Store flags.

### What's working well

- No security advisories or wildly outdated packages.
- TypeScript 5.9 / React 19 / Expo 54 — current generation.
- `react-native-purchases` lazy-init pattern keeps RevenueCat off the startup path.

---

## Performance smells

Most of the codebase is fine. Five specific items worth fixing:

1. **`app/(main)/price-book.tsx:78-87`** — `onRefresh` and `loadItems` have a circular `useCallback` dependency. Causes more re-renders than necessary on focus. Not a crash, but noisy.
2. **`modules/materials/Picker.tsx:669`** — `FlashList` prop API drift (`estimatedItemSize` vs newer required props). TypeScript flags it; runtime still works. Indicates `@shopify/flash-list` is due for either an API update on our side or a version pin clarification.
3. **`app/(forms)/quote/[id]/edit.tsx:1120`** — Inline `onPress={() => router.push(...) as any}` allocates a new function every render. Extract to `useCallback`.
4. **`lib/safeStorage.ts:261-276`** — Database count calls (`getQuoteCountDB`, etc.) on the startup integrity check, with wrong argument counts. If the database is ever large, these block startup. Wrap in a timeout or move off the synchronous path.
5. **Heavy state without consolidation** — already covered in architecture; 22 `useState` calls in invoice / dashboard screens means React reconciliation does more work per render than necessary.

### Startup risks — mostly handled

- Supabase lazy-init via Proxy ✓
- RevenueCat lazy-init on paywall present ✓
- Crash-loop detection before data reads ✓
- AsyncStorage → SQLite migration runs once per device ✓ (but leaves dead duplicate code behind — see Dead Code section)

---

## Recommended remediation plan (prioritized)

### Tier 1 — Do soon (low effort, high impact)

| Item | Status |
|---|---|
| Fix `calculateQuoteTotals` duplication | ✅ shipped in `fed5c8a` (2026-06-02). Five-step verification chain documented in commit message: TS compile, importer trace, canonical-version-caller trace, math smoke test (17/17 assertions), lint. Surface area was bigger than the audit said — included a stranded re-export in `modules/quotes/types.ts:18` that the deeper sweep caught. |
| Delete `_old/` directory | ✅ shipped in `6e57200` (2026-06-02). 36 files, 3,132 lines removed. Already excluded from TS compile (`include` list) and EAS builds (`.easignore`); zero references from live code. Pre-Oct-2025 archaeology preserved in git via commit `8ccac91^`. |
| ~~Move `pg`, `supabase`, `xlsx` to devDependencies~~ | ⚠️ **Audit was wrong** — these three are *already* in `devDependencies` at commit `7251d6b` and earlier. Verified by reading `package.json` directly. The audit agent's claim that they were in `dependencies` was a misread. No action needed. |
| Add `@types/uuid` to devDependencies | 🔄 **Pending — needs care.** First attempt on 2026-06-02 (rolled back) ran `npm install uuid @types/uuid` which silently jumped uuid from v7.0.3 (transitive from Expo → @expo/config-plugins → xcode → uuid) to v14.0.0 — a 7-major-version jump. Rolled back to commit `6e57200` state. When this is picked up, decide explicitly between (A) just `@types/uuid` as devDep (relies on Expo's chain to keep providing uuid transitively), or (B) `uuid@^7.0.3` as a direct dep + `@types/uuid` as devDep (explicit ownership, protects against transitive drop). Don't let `npm install` auto-pick the latest. |
| Update CLAUDE.md drift items | 🔄 Pending. 8 specific claims need updating: "all data local" misleading for Pro/Premium, Drew tier gating ambiguity, "1Build" should be xByte, "30k+ products" never verified, xByte "deferred" but ~80% built, "real-time pricing" is actually weekly, mobile product sync code doesn't exist, supplier API architecture aspirational vs real. See lines starting "Stale CLAUDE.md sections" in the Duplication / Dead Code / Stale Docs section above for specifics. |

### Tier 2 — Schedule for v1.2.7 or v1.3.0 cycle (~half to full day)

| Item | Est. effort |
|---|---|
| Get TypeScript back to 0 errors | 4-6 hrs |
| Decide `expo-dev-client` location | 30 min (mostly a decision, not work) |
| Add `@types/uuid` (already in Tier 1) | — |
| Fix the 5 performance smells | 2-3 hrs |

### Tier 3 — Refactors worth a dedicated cycle (~2-3 working days total)

| Item | Est. effort |
|---|---|
| Split `lib/database.ts` into domain files (`quotesDB.ts`, `invoicesDB.ts`, etc.) | 3-4 hrs |
| Extract `useInvoiceForm` hook (mirror `useQuoteForm`) | 2 hrs |
| Extract `useDashboardState` hook | 2 hrs |
| Unify calculation source of truth (one canonical `lib/calculations.ts`) | 2-3 hrs |
| Build `lib/syncManager.ts` orchestrator (replaces ad-hoc cooldown duplication) | 3 hrs |
| **Audit the portal codebase** (`/Users/sephtaylor/Projects/quotecat-portal`) with the same three-dimensional sweep — architecture/bloat, duplication/dead code/stale docs, TypeScript/deps/perf. Premium features live there and the original audit didn't look. | 1 day |

### Tier 4 — Longer-term hygiene

- Remove `as any` escape hatches at cloud-data ingress; add Zod or similar runtime validation
- Decide on Drew tier gating (currently inconsistent between code and CLAUDE.md description)
- Decide xByte fate (finish wiring OR delete the code and update CLAUDE.md to match)
- Add a smoke-test layer for the calculation pipeline (PDF totals vs invoice totals vs dashboard totals must agree)

---

## What's working well (don't break these)

- **Module boundaries.** `modules/` is genuinely clean. The discipline shows.
- **`useQuoteForm` pattern.** Best example in the codebase of "screen-as-glue, hook-as-brain." Worth replicating.
- **Sync safety.** The persistent lock + local-only saves during sync correctly prevent the loop bug documented in CLAUDE.md.
- **Lazy init for Supabase and RevenueCat.** Keeps startup fast and crash-resistant.
- **Feature flag centralization.** `lib/features.ts` is a single source of truth — no scattered `if (isPro)` blocks across 20 files.
- **Type safety in `lib/types.ts`.** Forward-compatible field handling (`[key: string]: any` on Quote/Invoice) means schema additions don't break old saved data.

---

## How to use this doc

This is a checkpoint, not a mandate. The codebase is shipping and earning. None of these findings are blockers for current work.

When you start a release cycle and have an hour to spare, pick one Tier 1 item. When you start a "tech debt sprint," tackle the Tier 3 list. When you find yourself fighting the calculation logic for the third time, that's the signal to do the calculation unification.

**Next audit recommended at ~50K lines of app code** (currently ~30K), or after the next two major releases — whichever comes first.
