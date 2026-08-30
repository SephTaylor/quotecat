---
name: google-play-release
description: |
  Build, submit, and release the QuoteCat Android app to Google Play.
  TRIGGER — read BEFORE running any eas command, whenever: the task is shipping,
  releasing, submitting, or building for Android or Google Play; the prompt mentions
  eas build, eas submit, versionCode, buildNumber, app-bundle, AAB, Play Console, an
  internal/beta/production track, or the Data Safety form; app.json version fields are
  about to be edited; or a build has just finished and the working tree needs checking.
  SKIP when: the work is iOS-only with no Android component (App Store Connect,
  TestFlight, .p8 keys, ascAppId) — this Skill covers Android only; the task is ordinary
  app development that merely happens to touch a file, with no release intent; or the
  question is about the Expo dev client, `expo start`, or the preview profile, none of
  which can be submitted to Play.
---

# Google Play release

The Android half of shipping QuoteCat. iOS is similar but uses App Store Connect and
a different key; this covers Android only.

## Before building

Confirm all five. Skipping any of these is how a build gets burned.

1. **Working tree is clean, or the pending changes are intended for this build.**
   `eas build` uploads what is on disk, not what is committed.
2. **`keys/google-play-service-account.json` exists.** `eas.json` points at it by
   relative path. It is gitignored, so a fresh clone or a new laptop will not have it.
3. **You are on the branch you mean to ship.**
4. **Decide the track before you start** (see Tracks below). It changes which submit
   profile you use.
5. **Has `version` been bumped, if this build has user-visible changes?**
   `autoIncrement` bumps `versionCode` and `buildNumber`. **It does NOT bump `version`** —
   the string users actually see. Ship without bumping it and Play accepts the build
   (the version code went up) while every user sees the same version number as last
   time, so a real release looks like nothing happened. Bump `version` in `app.json`
   **before** building.

## Build

    eas build --platform android --profile production

The `production` profile is configured with `buildType: "app-bundle"` (an AAB, which
Play requires) and `autoIncrement: true`.

### ⚠️ The build edits app.json

`eas.json` sets `"appVersionSource": "local"`, so version state lives in `app.json`
rather than on EAS servers. With `autoIncrement: true`, **the build bumps
`android.versionCode` and `ios.buildNumber` in your local `app.json` file.**

**This leaves an uncommitted change in your working tree after every build.** Commit
it. If you do not, the next build increments from a stale base, and the repo no longer
records which version code went with which commit.

    git add app.json && git commit -m "chore: bump build numbers for <version>"

*(Observed 2026-08-28: `app.json` was sitting uncommitted with iOS 227→228 and Android
74→75, left over from an earlier build. This is not hypothetical.)*

## Submit

    eas submit --platform android --profile production

Or build and submit in one pass:

    eas build --platform all --profile production --auto-submit --non-interactive --no-wait

## Tracks

`eas.json` defines two Android submit profiles, and the distinction matters:

| Profile | Track | Use for |
|---|---|---|
| `production` | **`internal`** | The normal path. Despite the profile name, this lands on the internal track. |
| `beta` | `beta` | Wider beta testers. |

**The `production` submit profile does NOT publish to production.** It uploads to the
internal track. Promoting internal to production is a manual step in Play Console.
That is deliberate: it means an accidental submit cannot reach the public.

To release publicly: Play Console → Release → Production → create a release from the
internal build → review → roll out.

## Data Safety form

Play requires this and re-asks whenever disclosures change. Current answers:

| Question | Answer | Why |
|---|---|---|
| Data encrypted in transit? | Yes | All connections use HTTPS/TLS |
| Data encrypted at rest? | Yes | Supabase uses encrypted storage |
| Users can request deletion? | Yes | Via app settings or hello@quotecat.ai |

**Data collected:** account info (email, name, company details), user content (quotes,
invoices, clients, assemblies), device info (device type, OS version, app version),
analytics (anonymized usage via PostHog).

**Third parties to disclose:** Supabase (database, auth), **RevenueCat** (subscription
purchases, app user IDs), **Sentry** (crash reports, device info), Stripe (payments),
Anthropic/Claude (AI features), OpenAI (embeddings), X-Byte (supplier pricing),
PostHog (analytics).

⚠️ **Do not trust this list — regenerate it.** RevenueCat and Sentry were both shipped
and missing from it until an audit on 2026-08-30. **Check `package.json` against this
list every submission.** A hardcoded list of facts inside a Skill goes stale exactly like
a hardcoded list of facts anywhere else; the Skill's value is the *instruction to check*,
not the copy below it.

**Privacy policy:** https://quotecat.ai/privacy

⚠️ **Adding a third-party service means updating this form.** It is easy to add an SDK
and forget the disclosure, and a mismatch between what the app does and what the form
says is a compliance problem, not a paperwork one.

## After release

- Commit the `app.json` bump if you have not already.
- The release is on the internal track until promoted in Play Console.
- iOS is a separate submit; shipping Android does not ship iOS.

## Notes

- `versionCode` must strictly increase. Play rejects a reused one, and you cannot
  reuse a code even from a deleted release.
- `version` in `app.json` (currently 1.2.x) is the user-visible string. `versionCode`
  is the integer Play orders releases by. They move independently.
- The `preview` build profile produces an APK for internal distribution, not an AAB.
  It cannot be submitted to Play.
