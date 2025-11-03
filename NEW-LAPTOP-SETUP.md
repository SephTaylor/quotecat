# New Laptop Setup Guide for QuoteCat Development

**Last Updated:** January 2025
**Project:** QuoteCat v1.1.0
**Branch:** integration/all-features

## 📋 Pre-Migration Checklist (Do This NOW on OLD Laptop)

### ✅ Already Done:
- [x] All code committed and pushed to GitHub
- [x] Latest commit: 464eb08 (Logo upload feature)
- [x] Branch: integration/all-features

### 🔑 Export/Backup These Files:

1. **Supabase Credentials** (`C:\Users\Kelli\Documents\quotecat\.env`):
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```
   ⚠️ Copy this file to a secure location (USB drive, password manager, encrypted cloud)

2. **EAS Credentials**:
   - Already stored in Expo account (ai.quotecat.app)
   - No action needed if you can log back into Expo

3. **Apple Developer Account**:
   - Email: (your email)
   - Password: (stored in your password manager)
   - Team ID: (check in Apple Developer portal)

4. **GitHub SSH Keys** (if using SSH):
   - Location: `C:\Users\Kelli\.ssh\id_rsa` and `id_rsa.pub`
   - Or just use HTTPS (easier on new laptop)

---

## 🆕 New Laptop Setup (Step by Step)

### 1. Install Core Tools

**Node.js (LTS)**:
- Download from: https://nodejs.org/ (v20.x LTS recommended)
- Verify: `node --version` and `npm --version`

**Git**:
- Download from: https://git-scm.com/
- Verify: `git --version`

**VS Code** (recommended):
- Download from: https://code.visualstudio.com/

**Android Studio** (for Android development):
- Download from: https://developer.android.com/studio
- Install Android SDK
- Set up emulator

**Xcode** (for iOS development, macOS only):
- Install from Mac App Store
- Install Command Line Tools: `xcode-select --install`

---

### 2. Clone QuoteCat Repository

```bash
# Navigate to your projects folder
cd Documents

# Clone the repo (HTTPS method - easiest)
git clone https://github.com/SephTaylor/quotecat.git

# Enter the project
cd quotecat

# Checkout the working branch
git checkout integration/all-features

# Verify you're on the right branch and commit
git log --oneline -n 5
# Should show: 464eb08 feat: add company logo upload feature...
```

---

### 3. Install Project Dependencies

```bash
# Install npm packages (this will take a few minutes)
npm install

# Verify installation
npm list --depth=0
```

---

### 4. Set Up Environment Variables

Create `.env` file in project root:

```bash
# In C:\Users\[YourName]\Documents\quotecat\.env

EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ Use the credentials you backed up from old laptop

---

### 5. Install Expo CLI & EAS CLI

```bash
# Install globally
npm install -g expo-cli eas-cli

# Verify
expo --version
eas --version
```

---

### 6. Log Into Expo Account

```bash
# Login to Expo
eas login

# Verify you're logged in
eas whoami
# Should show your Expo username
```

---

### 7. Install Claude Code CLI

**Windows:**
```bash
npm install -g @anthropic-ai/claude-code
```

**macOS/Linux:**
```bash
npm install -g @anthropic-ai/claude-code
```

Verify installation:
```bash
claude --version
```

---

### 8. Configure Claude Code

Run Claude Code in the project directory:
```bash
cd C:\Users\[YourName]\Documents\quotecat
claude
```

**First time setup:**
- You'll be asked for your Anthropic API key
- Get it from: https://console.anthropic.com/settings/keys
- It will be saved locally for future sessions

**Important Settings:**
- Model: Sonnet 4.5 (recommended for best results)
- Auto-approve commands: Configure in `.claude/settings.local.json`

---

### 9. Test Everything Works

```bash
# Start Metro bundler (Expo dev server)
npx expo start

# In a new terminal, verify lint passes
npm run lint

# Verify iOS build config (macOS only)
cat ios/quotecat.xcodeproj/project.pbxproj | grep BUNDLE_IDENTIFIER
# Should show: ai.quotecat.app

# Verify Android build config
cat android/app/build.gradle | grep applicationId
# Should show: ai.quotecat.app
```

---

### 10. Verify Supabase Connection

Open project in VS Code and test Supabase connection:

1. Open any file that imports `@/lib/supabase`
2. Check console for connection errors
3. If successful, you'll see no errors in Metro bundler

---

## 🔄 Continuing Development

### Current State of Project:

**Branch:** integration/all-features
**Latest Feature:** Company logo upload (Pro/Premium feature)
**Version:** 1.1.0

**Completed Features:**
- Quote management system
- Material picker with quantity editing
- Assembly system (Pro feature)
- PDF/CSV export with company branding
- Dashboard with value tracking
- Company details editor
- Logo upload feature (NEW - needs testing)

**Next Steps:**
1. Test logo upload on iOS and Android
2. Implement login/signup screens
3. Add Supabase auth integration
4. Build landing page (quotecat.ai)

---

## 🚨 Important Files & Locations

### Key Config Files:
- `app.json` - Expo configuration
- `eas.json` - EAS Build configuration
- `.env` - Environment variables (CREATE THIS!)
- `package.json` - Dependencies
- `CLAUDE.md` - Project instructions for Claude

### Supabase Database:
- Project URL: Check `.env` file
- Dashboard: https://app.supabase.com/
- Database: 9 tables (profiles, quotes, products, etc.)
- Storage: `logos` bucket with 4 RLS policies

### GitHub Repository:
- URL: https://github.com/SephTaylor/quotecat
- Main branch: `main`
- Working branch: `integration/all-features`

---

## 💡 Tips for Working with Claude Code

1. **Resume Context**: Claude Code maintains conversation history locally. After setup, just run `claude` in the project directory.

2. **Project Instructions**: All project context is in `CLAUDE.md`. Claude reads this automatically.

3. **Git Workflow**: Claude can create commits for you. Just ask "commit this work" and it will write proper commit messages.

4. **Ask Questions**: Claude knows the full project architecture. Ask things like:
   - "Where is the PDF generation code?"
   - "How does the logo upload feature work?"
   - "What needs to be done next?"

5. **Testing**: When you're ready to test, ask Claude to help run the app on your device or emulator.

---

## 🆘 Troubleshooting

### Metro Bundler Won't Start:
```bash
npx expo start -c  # Clear cache
```

### Missing Dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### EAS Build Fails:
```bash
eas build:configure  # Reconfigure
```

### Supabase Connection Fails:
- Check `.env` file exists and has correct credentials
- Restart Metro: `npx expo start -c`

### Claude Code Not Working:
- Verify API key: Check `~/.claude/config.json`
- Update: `npm install -g @anthropic-ai/claude-code`

---

## 📞 Resources

- **Expo Docs**: https://docs.expo.dev/
- **Supabase Docs**: https://supabase.com/docs
- **Claude Code Docs**: https://docs.claude.com/claude-code
- **React Native Docs**: https://reactnative.dev/

---

## ✅ Final Checklist (New Laptop)

- [ ] Node.js installed
- [ ] Git installed
- [ ] QuoteCat repo cloned
- [ ] `npm install` completed
- [ ] `.env` file created with Supabase credentials
- [ ] Expo CLI installed (`npm install -g expo-cli`)
- [ ] EAS CLI installed (`npm install -g eas-cli`)
- [ ] Logged into Expo (`eas login`)
- [ ] Claude Code installed (`npm install -g @anthropic-ai/claude-code`)
- [ ] Claude Code configured with API key
- [ ] Metro bundler starts successfully (`npx expo start`)
- [ ] No lint errors (`npm run lint`)
- [ ] Ready to continue development!

---

**You're all set!** Run `claude` in the project directory and say:

> "I just set up my new laptop. Can you give me a summary of where we left off and what the next priority tasks are?"

Claude will pick up right where you left off and help you continue development.
