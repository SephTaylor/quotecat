// Eleventy data file — exposed to all templates as `site.*`
// Values come from build-time env vars so secrets/keys aren't committed.
//
// Set these in Netlify: Site settings → Environment variables.
//   POSTHOG_PUBLIC_KEY     — PostHog project API key (safe to embed; it's public)
//   POSTHOG_HOST           — Optional; defaults to PostHog US cloud
//
// For local builds, set them in your shell or in a website-scoped .env loaded
// by your build runner. If unset, the analytics include renders a no-op so
// the site still builds without tracking.

module.exports = {
  posthogKey: process.env.POSTHOG_PUBLIC_KEY || "",
  posthogHost: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
};
