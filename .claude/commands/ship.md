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
- **Unpushed commits.** `git log origin/main..HEAD --oneline`. Shipping code that is not
  pushed means the repo does not match what is in the store.

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
- If any new third-party SDK landed in this release, the **Play Data Safety form needs
  updating** — a mismatch between what the app does and what the form says is a
  compliance problem, not paperwork.

## Notes

- `versionCode` must strictly increase and cannot be reused, even from a deleted release.
- The `preview` profile builds an APK, not an app-bundle, and cannot be submitted to Play.
- Deeper detail on the Android side lives in the `google-play-release` Skill. This command
  is the user-invoked entry point; the Skill is the reference the model loads when the
  topic comes up.
