# QuoteCat Website Page Template

This document defines the standard structure and styling for all QuoteCat website pages to ensure visual consistency.

## Standard Spacing (Desktop)

```css
/* Section Padding */
main sections: padding: 60px 0 80px;
footer:        padding: 60px 0 40px;
header:        padding: 16px 0;
```

## Standard Spacing (Mobile - @media max-width: 768px)

```css
/* Section Padding */
main sections: padding: 40px 0 60px;
footer:        padding: 60px 0 40px;
header:        padding: 12px 0;
container:     padding: 0 16px; /* Was 0 24px on desktop */
```

## Logo Sizing

```css
/* Logo container */
.logo {
    display: flex;
    align-items: center;
    gap: 0px;  /* No gap between Drew icon and text */
}

/* Desktop */
.logo img {
    height: 100px;
    width: auto;
    margin-right: -20px;  /* Pull text closer to compensate for image padding */
}

.logo-text {
    font-size: 42px;
}

/* Mobile */
.logo img {
    height: 60px;
    margin-right: -12px;  /* Pull text closer on mobile */
}

.logo-text {
    font-size: 28px;
}
```

## Required HTML Structure

### Header (Identical on all pages)

```html
<header>
    <div class="header-container">
        <div class="header-content">
            <a href="index.html" class="logo">
                <img src="logo.png" alt="QuoteCat Logo">
                <span class="logo-text">QuoteCat</span>
            </a>
            <div class="header-nav">
                <span class="status-badge">Beta Coming Soon</span>
                <button class="hamburger" onclick="toggleMenu()" aria-label="Menu">
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                </button>
            </div>
        </div>
    </div>
</header>
```

### Hamburger Menu (Identical on all pages)

```html
<!-- Menu Backdrop -->
<div class="menu-backdrop" id="menuBackdrop" onclick="toggleMenu()"></div>

<!-- Mobile Menu -->
<div class="mobile-menu" id="mobileMenu">
    <div class="mobile-menu-header">
        <span class="mobile-menu-title">Menu</span>
        <button class="close-menu" onclick="toggleMenu()" aria-label="Close">&times;</button>
    </div>
    <div class="mobile-menu-content">
        <a href="https://quotecat.ai/signin" class="menu-signin-button">Sign In</a>
        <div class="menu-section">
            <div class="menu-section-title">Navigation</div>
            <a href="index.html" class="menu-link">Home</a>
            <a href="faq.html" class="menu-link">FAQ</a>
        </div>
        <div class="menu-section">
            <div class="menu-section-title">Resources</div>
            <a href="privacy.html" class="menu-link">Privacy Policy</a>
            <a href="terms.html" class="menu-link">Terms of Service</a>
        </div>
        <div class="menu-section">
            <div class="menu-section-title">Contact</div>
            <a href="mailto:hello@quotecat.ai" class="menu-link">Email Support</a>
        </div>
    </div>
</div>
```

### Footer (Identical on all pages)

```html
<footer>
    <div class="container">
        <p style="margin-bottom: 20px;">
            <strong>QuoteCat</strong> - Built for contractors, by developers who care.
        </p>
        <p style="color: #9ca3af;">
            Questions? Email us at <a href="mailto:hello@quotecat.ai">hello@quotecat.ai</a>
        </p>
        <p style="margin-top: 40px; font-size: 14px; color: #6b7280;">
            &copy; 2025 QuoteCat.ai. All rights reserved. |
            <a href="faq.html">FAQ</a> |
            <a href="privacy.html">Privacy Policy</a> |
            <a href="terms.html">Terms of Service</a>
        </p>
    </div>
</footer>
```

### JavaScript (Required on all pages)

```javascript
<script>
    function toggleMenu() {
        const menu = document.getElementById('mobileMenu');
        const backdrop = document.getElementById('menuBackdrop');
        menu.classList.toggle('open');
        backdrop.classList.toggle('open');
    }

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const menu = document.getElementById('mobileMenu');
            if (menu.classList.contains('open')) {
                toggleMenu();
            }
        }
    });
</script>
```

## Standard CSS (Required on all pages)

### CSS Variables

```css
:root {
    --primary: #f97316;
    --primary-dark: #ea580c;
    --text: #1f2937;
    --text-light: #6b7280;
}
```

### Background Gradient

```css
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    line-height: 1.6;
    color: #ffffff;
    background: linear-gradient(to bottom,
        #1a1a1a 0%,
        #2d2d2d 25%,
        #1f1f1f 50%,
        #2d2d2d 75%,
        #1a1a1a 100%
    );
    min-height: 100vh;
}
```

### Container

```css
/* Main content container - varies by page type */
.container {
    max-width: 1200px;  /* Landing pages with cards */
    /* OR max-width: 900px; for text-heavy pages like FAQ/Privacy/Terms */
    margin: 0 auto;
    padding: 0 24px;
}

/* Header container - ALWAYS 1200px on all pages for consistency */
.header-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
}

@media (max-width: 768px) {
    .container {
        padding: 0 16px;
    }

    .header-container {
        padding: 0 16px;
    }
}
```

### Header

```css
header {
    padding: 16px 0;
    backdrop-filter: blur(10px);
    background: rgba(20, 20, 20, 0.95);
    border-bottom: 1px solid rgba(249, 115, 22, 0.3);
    position: relative;  /* NOT sticky - causes scroll issues */
    z-index: 100;
}

.status-badge {
    display: inline-block;
    padding: 8px 16px;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    color: #92400e;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(251, 191, 36, 0.2);
}

@media (max-width: 768px) {
    header {
        padding: 12px 0;
    }

    .status-badge {
        font-size: 11px;
        padding: 6px 12px;
    }
}
```

### Hamburger Menu CSS

```css
/* Full hamburger menu CSS block - see existing pages for complete styles */
.hamburger { width: 32px; height: 32px; /* ... */ }
.mobile-menu { position: fixed; right: -100%; /* ... */ }
.menu-signin-button {
    padding: 14px 24px;
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    /* ... */
}
```

## Card Padding Standards

When using cards in content:

```css
/* Feature Cards (white background with orange accents) */
.feature-card {
    padding: 32px 28px;  /* Desktop */
}

@media (max-width: 768px) {
    .feature-card {
        padding: 24px 20px;  /* Mobile */
    }
}

/* Tier Cards (pricing cards) */
.tier-card {
    padding: 48px 36px;  /* Desktop */
}

@media (max-width: 768px) {
    .tier-card {
        padding: 36px 24px;  /* Mobile */
    }
}

/* Content Items (FAQ, list items) */
.content-item {
    padding: 24px;  /* Desktop */
}

@media (max-width: 768px) {
    .content-item {
        padding: 20px;  /* Mobile */
    }
}
```

## Typography Standards

```css
/* Page Title */
h1 {
    font-size: 48px;
    font-weight: 800;
    margin-bottom: 16px;
    color: #ffffff;
    text-align: center;
}

@media (max-width: 768px) {
    h1 {
        font-size: 36px;
    }
}

/* Section Titles */
.section-title {
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 16px;
    color: #ffffff;
}

@media (max-width: 768px) {
    .section-title {
        font-size: 28px;
    }
}

/* Subtitles */
.subtitle {
    font-size: 18px;
    color: #d1d5db;
    margin-bottom: 60px;
    text-align: center;
}

@media (max-width: 768px) {
    .subtitle {
        font-size: 16px;
        margin-bottom: 40px;
    }
}
```

## Apple Compliance Rules

**NEVER include in any page:**
- ❌ Pricing amounts ($29, $79, $99, etc.)
- ❌ "Buy", "Purchase", "Subscribe", "Upgrade" buttons
- ❌ Payment forms
- ❌ Urgency messaging with prices

**ALWAYS allowed:**
- ✅ "Learn More" links that open external website in browser
- ✅ "Sign In" button linking to external auth page
- ✅ Feature descriptions and tier names
- ✅ Display user's current tier in settings (in app only)

## File Naming Conventions

- Use lowercase with hyphens: `privacy-policy.html` ❌ `PrivacyPolicy.html`
- Exception: `README.md`, `PAGE-TEMPLATE.md` (documentation files)
- All HTML pages should use relative paths: `faq.html` not `/faq.html`

## Color Palette

```css
/* Primary Brand Colors */
--primary: #f97316;        /* Orange */
--primary-dark: #ea580c;   /* Dark Orange */

/* Text Colors (for white backgrounds) */
--text: #1f2937;          /* Dark Gray */
--text-light: #6b7280;    /* Medium Gray */

/* Text Colors (for dark backgrounds) */
color: #ffffff;           /* White - headings */
color: #e5e7eb;           /* Light Gray - body text */
color: #d1d5db;           /* Medium Light Gray - subtitles */
color: #9ca3af;           /* Medium Gray - labels */
color: #6b7280;           /* Dark Gray - footer small text */
```

## Checklist for New Pages

Before publishing a new page, verify:

- [ ] Header with logo, status badge, and hamburger menu
- [ ] Menu backdrop and mobile menu structure
- [ ] Sign In button at top of menu
- [ ] All 4 menu sections (Navigation, Resources, Contact)
- [ ] Relative links to all pages (`index.html` not `/` or `https://quotecat.ai/`)
- [ ] Footer with all links (FAQ, Privacy, Terms)
- [ ] Desktop padding: `60px 0 80px` for sections, `60px 0 40px` for footer
- [ ] Mobile padding: `40px 0 60px` for sections, `60px 0 40px` for footer
- [ ] Logo sizing: 100px → 60px mobile
- [ ] Container max-width: 1200px (landing) or 900px (text pages)
- [ ] Background gradient on body
- [ ] Orange color scheme (#f97316)
- [ ] JavaScript for menu toggle and Escape key
- [ ] No Apple-prohibited pricing or purchase language
- [ ] Responsive @media queries for mobile

## Page Structure Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Page Title] - QuoteCat</title>
    <meta name="description" content="[Page description for SEO]">
    <style>
        /* Copy standard CSS from existing pages */
    </style>
</head>
<body>
    <!-- Header -->
    <header><!-- Standard header --></header>

    <!-- Menu Backdrop -->
    <div class="menu-backdrop" id="menuBackdrop" onclick="toggleMenu()"></div>

    <!-- Mobile Menu -->
    <div class="mobile-menu" id="mobileMenu"><!-- Standard menu --></div>

    <!-- Main Content -->
    <main>
        <div class="container">
            <h1>[Page Title]</h1>
            <p class="subtitle">[Subtitle/description]</p>

            <!-- Page-specific content here -->
        </div>
    </main>

    <!-- Footer -->
    <footer><!-- Standard footer --></footer>

    <script>
        /* Standard menu JavaScript */
    </script>
</body>
</html>
```

## Reference Pages

- **Homepage (complex layout):** `index.html`
- **Simple list page:** `faq.html`
- **Text-heavy legal page:** `privacy.html`, `terms.html`

Always check these pages for the latest standard structure and styling.

---

**Last Updated:** October 27, 2025
**Version:** 1.0
