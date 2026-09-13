# What the lint output actually means

**Written 2026-09-13**, after a full pass through `npx eslint .`

Read this before reacting to a lint number. Most of what it reports is not a problem, and
knowing which parts are not is the whole point of this document.

---

## The short version

**Errors: 0.** There were 48 at the start of the pass. One was a real defect. The rest were the
tool misunderstanding the codebase.

**Warnings: 193.** They predate this pass by months, nothing today created them, and **none of
them need doing.** They are suggestions, not defects. The app builds, ships and has paying
customers with every one of them present.

**A warning is not a problem.** It is closer to a spellchecker flagging a surname: not wrong to
mention it, not something to act on.

---

## The one real defect, and it is fixed

**`modules/core/ui/Screen.tsx` claimed to do a job it never did.** Two lines: a comment saying it
aliased `Screen` "so existing imports keep working", and a re-export of a default. The barrel
uses `export *`, which does not carry defaults, so it contributed nothing. Nothing imported it
directly either.

`Screen` has always come from `safe-screen.tsx` line 104. `Screen.tsx` was created two days
**after** that named export already made it work, in a commit that solved the same problem twice
and only got it right once. Redundant from birth.

**The danger ran backwards from how it looked.** A file called `Screen.tsx` claiming to handle
aliasing made the line that actually works look redundant. Deleting that line breaks four
screens.

Deleted 2026-09-13. Full account in `CLAUDE.md`, and `safe-screen.tsx` line 104 now carries a
LOAD-BEARING comment naming the four screens.

⚠️ **Do not confuse `Screen.tsx` with `safe-screen.tsx`.** The second one is 104 lines of real
work: notch and status bar handling, keyboard avoidance, and the 88px bottom padding that stops
a fixed button bar covering content. **That is the file that fixes "buttons going off the bottom
of the screen."**

---

## Why 30 errors were not errors

Everything under `supabase/functions/` runs on **Deno**, which imports modules by web address
(`https://esm.sh/...`, `https://deno.land/...`). That is correct for Deno and unresolvable for a
config built for the Expo app, so it reported working code as broken — and it was most of the
total, which is why the output was not worth reading.

**Now ignored in `eslint.config.js`.** They are not going unchecked: the Supabase CLI typechecks
and bundles them on deploy.

---

## Why the punctuation rule was narrowed, not switched off

`react/no-unescaped-entities` covers four characters in on-screen text: `>` `}` `"` `'`.

All 17 reports here were quotes and apostrophes in copy users read, like
`No products match "{searchQuery}"`. **Every one rendered correctly.**

The rule now only reports `>` and `}`, the two that can genuinely break something.

🔍 **Checked afterwards, and worth knowing:** in TSX, `>` and `}` are caught by the **parser** as
hard syntax errors before this rule runs. **If one ever appears in the wrong place, the app will
not build.** You will find out immediately and loudly.

So the rule adds nothing on top of the compiler here. It was kept anyway because it costs
nothing and would still help if the tooling changed (a plain `.js` file, a different parser).
**Do not read its silence as coverage — the compiler is what is protecting you.**

---

## What the 193 warnings are, and why to leave them

| Roughly | What it is | Worth acting on |
|---|---|---|
| Half | A variable or import declared and never used | No. Tidiness. |
| A quarter | Import ordering and duplicate import lines | No. Style. |
| A handful | `@typescript-eslint/array-type`, `Array<T>` vs `T[]` | No. Pure preference. |
| ~15 | `react-hooks/exhaustive-deps` | **Only these.** Occasionally a real bug, but wrong more often than right, and the most commonly ignored rule in React. |

**About a third are auto-fixable with `npx eslint . --fix`.** That is offered as a fact, not a
task. Running it touches a lot of files for no behavioural gain, which is a poor trade when
there is real work elsewhere.

---

## How to read this output in future

1. **Errors are worth a look. Warnings usually are not.**
2. **If errors appear under `supabase/functions/`**, check the ignore rule is still in
   `eslint.config.js` before believing them.
3. **If the count jumps suddenly**, compare against this baseline: 0 errors, ~193 warnings, as of
   2026-09-13.
4. **Do not chase zero warnings.** The value was never in the count. It was in finding the one
   file that lied about what it did, and that took reading git history, not reading a number.
