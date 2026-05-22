// babel.config.js
module.exports = function (api) {
  api.cache(true);

  const isProduction = process.env.NODE_ENV === "production";

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      ["module-resolver", { alias: { "@": "./" } }],
      // Strip console.log / .info / .debug in production builds only — keeps
      // dev/debug output intact, removes ~880 calls from prod JS bundle and
      // stops potential PII leaks to logcat. We DELIBERATELY keep .warn and
      // .error because they often feed Sentry breadcrumbs and we want them
      // in production stack traces.
      ...(isProduction
        ? [["transform-remove-console", { exclude: ["warn", "error"] }]]
        : []),
      "react-native-reanimated/plugin", // keep LAST
    ],
  };
};
