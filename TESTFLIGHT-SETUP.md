# TestFlight Setup Guide for QuoteCat

## Why TestFlight is Better than Expo Go

**Expo Go Issues:**
- Limited to development mode only
- Slower performance
- Some native features don't work properly
- Feels like a "demo app"
- Crashes more frequently

**TestFlight Benefits:**
- ✅ Full production build
- ✅ Real app performance
- ✅ Professional experience
- ✅ Easy distribution to testers
- ✅ Automatic updates
- ✅ Crash reporting built-in
- ✅ Testers get the real app experience

---

## Prerequisites

### 1. Apple Developer Account
- **Need:** Apple Developer Program membership ($99/year)
- **Sign up:** https://developer.apple.com/programs/
- **Note:** This is REQUIRED for TestFlight distribution

### 2. EAS (Expo Application Services) Account
- **Need:** Expo account (free tier is fine for testing)
- **Sign up:** https://expo.dev/signup
- **Install EAS CLI:** `npm install -g eas-cli`

---

## Step-by-Step Setup

### Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

### Step 2: Login to EAS

```bash
eas login
```

Enter your Expo account credentials.

### Step 3: Configure EAS Build

```bash
eas build:configure
```

This will:
- Create `eas.json` in your project
- Ask you to choose iOS/Android (choose iOS)
- Set up build profiles

### Step 4: Update app.json with Bundle Identifier

You need a unique bundle identifier. Add this to `app.json`:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.quotecat",
      "supportsTablet": true
    }
  }
}
```

**Replace `yourcompany` with your actual company name or use:**
- `com.quotecat.app`
- `ai.quotecat.app`
- etc.

### Step 5: Build for TestFlight

```bash
eas build --platform ios --profile preview
```

**What this does:**
- Builds your app in the cloud (takes 10-20 minutes)
- Creates an `.ipa` file for iOS
- Optimizes for TestFlight distribution

**Note:** First build is FREE on Expo. After that, you may need a paid plan or build locally.

### Step 6: Submit to TestFlight

```bash
eas submit --platform ios
```

**You'll be asked for:**
- Apple ID
- App-specific password (create at appleid.apple.com)
- Bundle identifier

**This will:**
- Upload your app to App Store Connect
- Make it available in TestFlight
- Takes 5-10 minutes

---

## Alternative: Faster Local Build (If EAS is slow)

If you want to build locally on your Mac:

### Prerequisites
- Mac computer
- Xcode installed
- Apple Developer account

### Steps

```bash
# Generate native iOS project
npx expo prebuild --platform ios

# Open in Xcode
open ios/quotecat.xcworkspace

# In Xcode:
# 1. Select your team (Apple Developer account)
# 2. Choose "Any iOS Device" as target
# 3. Product → Archive
# 4. Distribute App → TestFlight
```

---

## Adding Testers to TestFlight

### Option 1: Internal Testing (Fastest)
1. Go to App Store Connect: https://appstoreconnect.apple.com
2. Select your app
3. Go to TestFlight tab
4. Click "Internal Testing"
5. Add testers by email (must have Apple IDs)
6. They'll receive an invite via email
7. They install TestFlight app from App Store
8. They can install your app immediately (no review needed)

**Limit:** 100 internal testers

### Option 2: External Testing (More testers)
1. Same as above, but click "External Testing"
2. Add testers by email
3. Apple reviews your app (1-2 days)
4. After approval, testers can install

**Limit:** 10,000 external testers

---

## Recommended EAS Configuration

Create or update `eas.json`:

```json
{
  "build": {
    "preview": {
      "ios": {
        "simulator": false,
        "distribution": "internal",
        "developmentClient": false
      }
    },
    "production": {
      "ios": {
        "distribution": "store",
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your.email@example.com",
        "ascAppId": "your-app-store-connect-id",
        "appleTeamId": "your-team-id"
      }
    }
  }
}
```

---

## Quick Start (Recommended Path)

**For your 2 iPhone testers, here's the fastest path:**

### 1. One-Time Setup (30 minutes)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure
```

### 2. Update app.json
Add bundle identifier:
```json
"ios": {
  "bundleIdentifier": "com.quotecat.app",
  "supportsTablet": true
}
```

### 3. Build for TestFlight
```bash
eas build --platform ios --profile preview
```

Wait 10-20 minutes for build to complete.

### 4. Submit to TestFlight
```bash
eas submit --platform ios
```

Enter your Apple ID credentials when prompted.

### 5. Add Testers in App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Select QuoteCat
3. TestFlight → Internal Testing
4. Add your 2 testers by email

### 6. Testers Install
They'll receive an email:
1. Install TestFlight app from App Store
2. Tap the invite link
3. Install QuoteCat from TestFlight
4. Start testing!

---

## Updating the Build

When you fix bugs or add features:

```bash
# Make your changes, commit to git
git add .
git commit -m "Fixed XYZ"

# Build new version
eas build --platform ios --profile preview

# Submit update
eas submit --platform ios
```

Testers will automatically get notified of the update in TestFlight!

---

## Costs

### Required
- **Apple Developer:** $99/year (required for TestFlight)

### Optional
- **EAS Build:** First build free, then:
  - Free: 1 build/month
  - Production: $29/month unlimited builds
  - OR build locally for free (requires Mac + Xcode)

### Recommendation for Testing
Use the free EAS build for now. If you need more builds, either:
- Upgrade to EAS Production ($29/month)
- Build locally on Mac (free)

---

## Troubleshooting

### "No Apple ID configured"
- Go to https://appstoreconnect.apple.com
- Create your app there first
- Note the bundle identifier

### "Build failed"
- Check Metro bundler for errors
- Run `npm run lint` and `npx tsc` locally first
- Check EAS build logs: `eas build:list`

### "Testers can't install"
- Make sure they have TestFlight app installed
- Check their email is added in App Store Connect
- Wait 5-10 minutes after adding them

### "App crashes on tester devices"
- Check TestFlight crash logs in App Store Connect
- Make sure you're using production build, not development

---

## Timeline

**From start to testers having the app:**
- Setup EAS: 10 minutes
- First build: 15-20 minutes
- Submit to TestFlight: 5-10 minutes
- Add testers: 5 minutes
- Testers install: 5 minutes

**Total: ~1 hour** for first time, then ~30 minutes for updates

---

## Benefits for Your Testers

1. **Professional:** Feels like a real app, not a development tool
2. **Fast:** Better performance than Expo Go
3. **Reliable:** Fewer crashes and bugs
4. **Updates:** Automatic notifications when you push updates
5. **Feedback:** Built-in screenshot and feedback tools
6. **Convenient:** Just like installing any other app

---

## Next Steps

1. ✅ Get Apple Developer account ($99/year)
2. ✅ Install EAS CLI: `npm install -g eas-cli`
3. ✅ Run `eas build:configure`
4. ✅ Update bundle identifier in app.json
5. ✅ Build: `eas build --platform ios --profile preview`
6. ✅ Submit: `eas submit --platform ios`
7. ✅ Add testers in App Store Connect
8. ✅ Start testing! 🎉

---

## Questions?

Common questions:

**Q: Do I need a Mac?**
A: No! EAS builds in the cloud. You only need a Mac if you want to build locally.

**Q: Can I test before paying $99?**
A: Unfortunately no. Apple requires Developer membership for TestFlight.

**Q: Is this the same as publishing to App Store?**
A: No. TestFlight is for testing only. Publishing to App Store is a separate process.

**Q: How long does the build take?**
A: 10-20 minutes for cloud build. Faster for local builds (5-10 minutes).

**Q: Can I add more testers later?**
A: Yes! You can have up to 100 internal testers.

---

**Ready to get started? Let me know if you need help with any step!** 🚀
