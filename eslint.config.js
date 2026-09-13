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
]);
