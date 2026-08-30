---
description: Build and submit QuoteCat to the App Store and Google Play, with preflight checks and the app.json bump committed afterward.
argument-hint: [ios|android|all]  (default: all)
---

Ship a production release of QuoteCat.

Platform: **$ARGUMENTS** — if empty, ship **both**, which is the normal case. iOS and
Android go out together.

Work through this in order. Stop and report if any preflight check fails; do not
"helpfully" continue past a problem.

## 1. Preflight — report all of these before doing anything

- **Working tree.** `git status --short`. If anything is uncommitted, list it and ask
  whether it belongs in this build. `eas build` uploads what is on disk, not what is
  committed.
- **Branch.** Confirm which branch, and that it is the intended one.
- **Credentials.** `keys/google-play-service-account.json` must exist for Android;
  `keys/AuthKey_XRMPFXY7DD.p8` for iOS. Both are gitignored, so a fresh clone will not
  have them.
- **Current version.** Read `app.json` and report `version`, `ios.buildNumber`, and
  `android.versionCode`. State what the next build numbers will be.

- **⚠️ Build numbers are AHEAD of everything already built.** This is the check that
  prevents a burned release. Run:

      eas build:list --platform ios --limit 15 --non-interactive
      eas build:list --platform android --limit 15 --non-interactive

  Find the **highest build number that exists on each platform** — including builds that
  failed, were cancelled, or never shipped. A consumed number is consumed.

  Because `appVersionSource` is `local` with `autoIncrement`, the next build is
  **`app.json`'s current value plus one**. So `app.json` must be **greater than or equal
  to** the highest existing build number. If it is behind, the next build produces a
  number the store has already seen and the submission is rejected — and a version code
  cannot be reused, even from a deleted release, so recovering means burning numbers to
  climb back past the collision.

  **If `app.json` is behind, stop.** Report both numbers and ask whether to raise
  `app.json` to a safe value before continuing. Do not raise it silently.

  *Why this check exists: on 2026-06-05 a version-source mismatch shipped v1.2.5 builds
  while `app.json` said 1.2.6, and three iOS builds were burned finding out (208, 209,
  and one more). The fix commit `9fa6710` recommended exactly this preflight and it was
  never written down until now.*
- **Unpushed commits.** `git log origin/main..HEAD --oneline`. Shipping code that is not
  pushed means the repo does not match what is in the store.

- **Does this release contradict anything written down?** *(Report only — this does not
  block the build.)* Look at what is actually in the release and ask whether it makes a
  documented claim false. Two checks worth doing every time:

  - **New dependency?** `git diff origin/main..HEAD -- package.json`. If an SDK was added,
    it probably receives user data, which means the **Data Safety form and the App Store
    privacy answers need updating** — and both stores treat a mismatch as a compliance
    issue, not paperwork.
  - **Does any shipped behavior contradict a rule in `CLAUDE.md`?** Policies written for
    an earlier phase do not retract themselves.

  *Why this check exists: `CLAUDE.md` said "DO NOT implement in-app purchases" for months
  after RevenueCat shipped — an instruction that would have led an agent to delete working
  revenue code. Nothing caught it, because shipping the feature never triggered a review
  of the rule forbidding it. Found 2026-08-30 by an audit, not by the release process.
  The same audit found RevenueCat and Sentry missing from the Data Safety disclosures.*

## 2. Confirm before building

Builds cost money and take time, so stop here once and show:

- version and the build numbers that will be produced
- which platforms
- which track each will land on

**Android goes to the `internal` track**, despite the submit profile being named
`production`. That is deliberate — promoting to public is a manual step in Play Console
so an accidental submit cannot reach users.

Get a yes, then continue without stopping again.

## 3. Build

    eas build --platform all --profile production

Or a single platform if one was specified. The production profile has
`autoIncrement: true` and produces an Android app-bundle.

## 4. Commit the version bump — do not skip this

`eas.json` sets `appVersionSource: "local"`, so the build writes the incremented
`ios.buildNumber` and `android.versionCode` **into `app.json` in the working tree**. EAS
does not commit it.

    git add app.json && git commit -m "chore: bump build numbers for <version>"

Leave this uncommitted and the next build increments from a stale base, and the repo
stops recording which commit shipped which build. This has already happened once —
2026-08-28, iOS 227→228 and Android 74→75 were found sitting uncommitted.

## 5. Submit

    eas submit --platform android --profile production
    eas submit --platform ios --profile production

## 6. Report what is left for a human

- Android is on the **internal** track. Public release is Play Console → Release →
  Production → create from the internal build → roll out.
- iOS is in App Store Connect and needs release action there.
- Confirm the `app.json` bump was committed.
- If any new third-party SDK landed in this release, the **Play Data Safety form and the
  App Store privacy answers need updating** — a mismatch between what the app does and
  what the form says is a compliance problem, not paperwork. **Regenerate the disclosure
  list from `package.json`; do not trust any written copy of it**, including the one in
  the `google-play-release` Skill. That copy was missing RevenueCat and Sentry until
  2026-08-30.

## Notes

- `versionCode` must strictly increase and cannot be reused, even from a deleted release.
- The `preview` profile builds an APK, not an app-bundle, and cannot be submitted to Play.
- Deeper detail on the Android side lives in the `google-play-release` Skill. This command
  is the user-invoked entry point; the Skill is the reference the model loads when the
  topic comes up.
