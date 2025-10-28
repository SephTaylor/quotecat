# Platform-Specific Build Configuration for QuoteCat

## File Organization Strategy

### 1. Platform-Specific File Extensions

React Native automatically resolves platform-specific files:

```
lib/
  pdf.ts              # Shared code/interface
  pdf.native.ts       # iOS + Android implementation
  pdf.web.ts          # Web implementation
```

**Resolution Order:**
- Mobile: `pdf.native.ts` → `pdf.ts`
- Web: `pdf.web.ts` → `pdf.ts`

### 2. Current Implementation Example

**lib/pdf.ts** (Current - needs refactoring):
```typescript
import { Platform } from 'react-native';
import * as Print from 'expo-print';  // Only needed on mobile
import html2pdf from 'html2pdf.js';   // Only needed on web

// This approach loads BOTH libraries in ALL builds ❌
```

**Better Approach:**

**lib/pdf.ts** (Interface):
```typescript
import type { Quote } from './types';
import type { CompanyDetails } from './preferences';

export type PDFOptions = {
  includeBranding: boolean;
  companyDetails?: CompanyDetails;
};

export async function generateAndSharePDF(
  quote: Quote,
  options: PDFOptions
): Promise<void> {
  // Re-export from platform-specific implementation
  const impl = require('./pdf-impl').default;
  return impl.generateAndSharePDF(quote, options);
}
```

**lib/pdf-impl.native.ts** (Mobile):
```typescript
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Quote } from './types';
import type { PDFOptions } from './pdf';
import { generateQuoteHTML } from './pdf-html';
import { trackEvent, AnalyticsEvents } from './app-analytics';

async function generateAndSharePDF(
  quote: Quote,
  options: PDFOptions
): Promise<void> {
  const html = generateQuoteHTML(quote, options);
  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${quote.name || 'Quote'}.pdf`,
      UTI: 'com.adobe.pdf',
    });
  }

  trackEvent(AnalyticsEvents.PDF_GENERATED, {
    quoteId: quote.id,
    itemCount: quote.items?.length || 0,
    total: quote.total,
  });
}

export default { generateAndSharePDF };
```

**lib/pdf-impl.web.ts** (Web):
```typescript
import type { Quote } from './types';
import type { PDFOptions } from './pdf';
import { generateQuoteHTML } from './pdf-html';
import { trackEvent, AnalyticsEvents } from './app-analytics';

async function generateAndSharePDF(
  quote: Quote,
  options: PDFOptions
): Promise<void> {
  // Dynamic import - only loaded when function is called
  const html2pdf = (await import('html2pdf.js')).default;

  const html = generateQuoteHTML(quote, options);
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  try {
    const fileName = `${quote.name || 'Quote'}_${new Date().toISOString().split('T')[0]}.pdf`;

    await html2pdf()
      .set({
        margin: [20, 15, 20, 15],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      })
      .from(container)
      .save();

    trackEvent(AnalyticsEvents.PDF_GENERATED, {
      quoteId: quote.id,
      itemCount: quote.items?.length || 0,
      total: quote.total,
    });
  } finally {
    document.body.removeChild(container);
  }
}

export default { generateAndSharePDF };
```

**lib/pdf-html.ts** (Shared):
```typescript
// HTML generation logic - shared by both platforms
import type { Quote } from './types';
import type { PDFOptions } from './pdf';

export function generateQuoteHTML(quote: Quote, options: PDFOptions): string {
  // All the HTML generation code (shared)
  return `<!DOCTYPE html>...`;
}
```

## 3. Conditional Dependencies in package.json

Mark web-only dependencies as optional:

```json
{
  "dependencies": {
    "expo-print": "^15.0.7",
    "expo-sharing": "^13.0.3"
  },
  "optionalDependencies": {
    "html2pdf.js": "^0.10.2"
  }
}
```

## 4. Metro Bundler Configuration

**metro.config.js**:
```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Optimize tree shaking
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    compress: {
      drop_console: true, // Remove console.logs in production
      drop_debugger: true,
    },
  },
};

// Platform-specific extensions
config.resolver.sourceExts = ['tsx', 'ts', 'jsx', 'js', 'json'];
config.resolver.platforms = ['ios', 'android', 'web', 'native'];

module.exports = config;
```

## 5. Webpack Configuration for Web

**webpack.config.js** (if using custom Expo web config):
```javascript
const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Externals - don't bundle these for web
  config.externals = {
    'expo-print': 'commonjs expo-print',
    'expo-sharing': 'commonjs expo-sharing',
    'expo-file-system': 'commonjs expo-file-system',
  };

  return config;
};
```

## 6. Tree Shaking with Dynamic Imports

Use dynamic imports for platform-specific code:

```typescript
// ❌ BAD - Always loaded
import html2pdf from 'html2pdf.js';

// ✅ GOOD - Only loaded when called
const html2pdf = (await import('html2pdf.js')).default;
```

## 7. Build Size Analysis

### Check Mobile Build Size:
```bash
# iOS
eas build --platform ios --profile production
# Check .ipa size

# Android
eas build --platform android --profile production
# Check .apk/.aab size
```

### Check Web Bundle Size:
```bash
npx expo export:web
# Analyze _static/js/main.*.js size

# Or use webpack-bundle-analyzer
npm install --save-dev webpack-bundle-analyzer
```

## 8. EAS Build Configuration

**eas.json**:
```json
{
  "build": {
    "production-mobile": {
      "node": "20.18.0",
      "env": {
        "NODE_ENV": "production"
      },
      "ios": {
        "resourceClass": "m1-medium",
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      }
    },
    "production-web": {
      "node": "20.18.0",
      "env": {
        "NODE_ENV": "production"
      },
      "web": {
        "output": "static"
      }
    }
  }
}
```

## 9. Recommended Structure for QuoteCat

```
lib/
  # Cross-platform (business logic)
  types.ts                    # Shared types
  quotes.ts                   # Quote CRUD
  analytics.ts                # Analytics interface

  # Platform-specific implementations
  pdf.ts                      # PDF interface/exports
  pdf-html.ts                 # HTML generation (shared)
  pdf-impl.native.ts          # Mobile PDF (expo-print)
  pdf-impl.web.ts             # Web PDF (html2pdf.js)

  spreadsheet.ts              # CSV interface/exports
  spreadsheet-impl.native.ts  # Mobile CSV
  spreadsheet-impl.web.ts     # Web CSV

  alert.ts                    # Alert interface
  alert.native.ts             # Mobile Alert
  alert.web.ts                # Web Alert

modules/
  # Business logic modules (cross-platform)
  quotes/
    index.ts
    storage.ts
    merge.ts

  catalog/
    index.ts
    productService.ts
    seed.ts

  assemblies/
    index.ts
    storage.ts
    expand.ts
```

## 10. Migration Strategy

### Current State:
- Single `pdf.ts` with Platform.OS checks
- All dependencies loaded in all builds

### Step 1: Extract HTML Generation
```bash
# Create shared HTML generator
# Move generateQuoteHTML to pdf-html.ts
```

### Step 2: Split Implementations
```bash
# Create pdf-impl.native.ts with expo-print code
# Create pdf-impl.web.ts with html2pdf.js code
```

### Step 3: Update Imports
```bash
# Update pdf.ts to re-export from pdf-impl
```

### Step 4: Test Both Platforms
```bash
# Mobile: npm run ios / npm run android
# Web: npm run web
```

### Step 5: Verify Bundle Sizes
```bash
# Check mobile doesn't include html2pdf.js
# Check web doesn't include expo-print
```

## 11. Build Commands

```bash
# Development
npm run web          # Web dev server
npm run ios          # iOS simulator
npm run android      # Android emulator

# Production builds
npx expo export:web                    # Web static build
eas build --platform ios --profile production
eas build --platform android --profile production

# Bundle analysis
npx expo export:web --dump-sourcemap
# Use source-map-explorer on the generated files
```

## 12. Performance Checklist

### Mobile App Size:
- ✅ No web-specific dependencies (html2pdf.js)
- ✅ No unused Expo modules
- ✅ Optimized images and assets
- ✅ Code splitting with dynamic imports
- ✅ ProGuard/R8 enabled (Android)
- ✅ Bitcode enabled (iOS)

### Web Bundle Size:
- ✅ No native modules (expo-print, expo-file-system)
- ✅ Code splitting for routes
- ✅ Lazy loading for heavy components
- ✅ Compression enabled (gzip/brotli)
- ✅ CDN for static assets

## 13. Current Issues to Fix

### Issue 1: pdf.ts loads both libraries
**Current:**
```typescript
import html2pdf from 'html2pdf.js';  // Always loaded ❌
```

**Fix:**
```typescript
const html2pdf = (await import('html2pdf.js')).default;  // Lazy ✅
```

### Issue 2: Platform checks in business logic
**Current:**
```typescript
if (Platform.OS === 'web') { /* web code */ }
else { /* mobile code */ }
```

**Fix:**
Use `.native.ts` and `.web.ts` extensions instead.

## 14. Testing Strategy

```typescript
// pdf.test.ts
describe('PDF Generation', () => {
  it('should use expo-print on mobile', async () => {
    jest.mock('./pdf-impl', () => ({
      default: require('./pdf-impl.native')
    }));
    // test mobile implementation
  });

  it('should use html2pdf on web', async () => {
    jest.mock('./pdf-impl', () => ({
      default: require('./pdf-impl.web')
    }));
    // test web implementation
  });
});
```

## Summary

**Key Principles:**
1. **Separate implementations** - Use `.native.ts` and `.web.ts`
2. **Dynamic imports** - Lazy load platform-specific code
3. **Shared business logic** - Types, data models, utilities
4. **Platform-specific UI** - PDF generation, file handling, alerts
5. **Build optimization** - Tree shaking, code splitting, minification

**Benefits:**
- Mobile app stays small (no web dependencies)
- Web bundle is optimized (no native modules)
- Clear separation of concerns
- Easy to test and maintain
- Better performance on all platforms
