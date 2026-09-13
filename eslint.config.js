// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // `supabase/functions/**` runs on Deno, not React Native. Deno imports
    // modules by URL (`https://esm.sh/...`, `https://deno.land/...`), which is
    // correct there but which this config — built for the Expo app — cannot
    // resolve. It reported 30 `import/no-unresolved` errors against working
    // code, which was most of the total and the reason nobody read the output.
    //
    // Those functions are typechecked and bundled by the Supabase CLI on
    // deploy, so they are not going unchecked. They are just not this
    // linter's job.
    ignores: ["dist/*", "supabase/functions/**", "website/_site/**"],
  },
  {
    rules: {
      // Narrowed, not disabled, 2026-09-13.
      //
      // This rule covers four characters in JSX text: > } " and '. Only the
      // first two are risky — a stray `>` or `}` can break parsing or silently
      // render wrong. Quotes and apostrophes in text are harmless; they only
      // matter inside attributes, where you are quoting differently anyway.
      //
      // All 17 reports in this codebase were quotes and apostrophes in copy
      // users read, e.g. `No products match "{searchQuery}"`. Every one
      // rendered correctly. A rule that only ever reports harmless things is a
      // rule people learn to ignore, and then switch off entirely — losing the
      // half that matters.
      //
      // So: keep > and } enforced, stop reporting quotes.
      //
      // Verified afterwards, and worth knowing: in TSX both > and } are caught
      // by the PARSER as hard syntax errors before this rule is consulted. So
      // the rule adds nothing on top of the compiler here. Kept anyway because
      // it costs nothing and is a real safety net if the tooling ever changes
      // (plain .js, a different parser). Do not read its silence as coverage.
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
    },
  },
]);
