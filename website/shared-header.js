// Shared header component for all QuoteCat pages
// Include this script and call insertHeader() to add the header

function insertHeader() {
    const headerHTML = `
    <header>
        <div class="header-container">
            <div class="header-content">
                <a href="/" class="logo">
                    <img src="/qc-splash.png" alt="QuoteCat Logo">
                    <span class="logo-text">QuoteCat</span>
                </a>
                <div class="header-nav">
                    <a href="/resources.html" class="nav-link">Resources</a>
                    <a href="https://portal.quotecat.ai/login" class="nav-link" style="color: #f97316;">Login</a>
                    <a href="/#pricing" class="status-badge">Get Started</a>
                    <button class="hamburger" onclick="toggleMenu()" aria-label="Menu">
                        <span class="hamburger-line"></span>
                        <span class="hamburger-line"></span>
                        <span class="hamburger-line"></span>
                    </button>
                </div>
            </div>
        </div>
    </header>

    <!-- Menu Backdrop -->
    <div class="menu-backdrop" id="menuBackdrop" onclick="toggleMenu()"></div>

    <!-- Mobile Menu -->
    <div class="mobile-menu" id="mobileMenu">
        <div class="mobile-menu-header">
            <span class="mobile-menu-title">Menu</span>
            <button class="close-menu" onclick="toggleMenu()" aria-label="Close">&times;</button>
        </div>
        <div class="mobile-menu-content">
            <div class="menu-section">
                <div class="menu-section-title">Navigation</div>
                <a href="/" class="menu-link">Home</a>
                <a href="/#pricing" class="menu-link">Pricing</a>
                <a href="https://portal.quotecat.ai/login" class="menu-link" style="color: #f97316;">Login</a>
            </div>
            <div class="menu-section">
                <div class="menu-section-title">Free Tools</div>
                <a href="/resources.html" class="menu-link" style="color: #22c55e;">All Resources</a>
                <a href="/resources/markup-calculator.html" class="menu-link">Markup Calculator</a>
                <a href="/resources/labor-rate-calculator.html" class="menu-link">Labor Rate Calculator</a>
                <a href="/resources/profit-margin-calculator.html" class="menu-link">Profit Margin Calculator</a>
            </div>
            <div class="menu-section">
                <div class="menu-section-title">Company</div>
                <a href="/privacy.html" class="menu-link">Privacy Policy</a>
                <a href="/terms.html" class="menu-link">Terms of Service</a>
                <a href="mailto:hello@quotecat.ai" class="menu-link">Contact Us</a>
            </div>
        </div>
    </div>
    `;

    // Insert at the beginning of body
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
}

function toggleMenu() {
    document.getElementById('mobileMenu').classList.toggle('open');
    document.getElementById('menuBackdrop').classList.toggle('open');
}

// Shared header CSS
const headerCSS = `
    .header-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 24px;
    }

    header {
        padding: 16px 0;
        backdrop-filter: blur(10px);
        background: rgba(20, 20, 20, 0.95);
        border-bottom: 1px solid rgba(249, 115, 22, 0.3);
        position: sticky;
        top: 0;
        z-index: 100;
    }

    .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
    }

    .header-nav {
        display: flex;
        align-items: center;
        gap: 24px;
    }

    .logo {
        display: flex;
        align-items: center;
        gap: 0;
        text-decoration: none;
        cursor: pointer;
        transition: opacity 0.2s;
        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        padding: 0 20px 0 0;
        border-radius: 12px;
    }

    .logo:hover {
        opacity: 0.9;
    }

    .logo img {
        height: 65px;
        width: auto;
        margin-right: -8px;
    }

    .logo-text {
        font-size: 28px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: -0.5px;
    }

    .nav-link {
        color: #d1d5db;
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        transition: color 0.2s;
    }

    .nav-link:hover {
        color: #ffffff;
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
        text-decoration: none;
    }

    .hamburger {
        width: 32px;
        height: 32px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        background: none;
        border: none;
        padding: 0;
    }

    .hamburger-line {
        width: 100%;
        height: 2px;
        background: #f97316;
        transition: all 0.3s;
        border-radius: 2px;
    }

    .hamburger:hover .hamburger-line {
        background: #ea580c;
    }

    .mobile-menu {
        position: fixed;
        top: 0;
        right: -100%;
        width: 300px;
        height: 100vh;
        background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
        transition: right 0.3s ease;
        z-index: 1000;
        overflow-y: auto;
    }

    .mobile-menu.open {
        right: 0;
    }

    .mobile-menu-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid rgba(249, 115, 22, 0.3);
    }

    .mobile-menu-title {
        font-size: 20px;
        font-weight: 700;
        color: #ffffff;
    }

    .close-menu {
        width: 32px;
        height: 32px;
        background: none;
        border: none;
        color: #f97316;
        font-size: 28px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
    }

    .close-menu:hover {
        color: #ea580c;
    }

    .mobile-menu-content {
        padding: 24px;
    }

    .menu-section {
        margin-bottom: 32px;
    }

    .menu-section-title {
        font-size: 12px;
        font-weight: 700;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 16px;
    }

    .menu-link {
        display: block;
        padding: 12px 0;
        color: #e5e7eb;
        text-decoration: none;
        font-weight: 500;
        font-size: 16px;
        transition: color 0.2s;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .menu-link:last-child {
        border-bottom: none;
    }

    .menu-link:hover {
        color: #f97316;
    }

    .menu-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s;
        z-index: 999;
    }

    .menu-backdrop.open {
        opacity: 1;
        pointer-events: all;
    }
`;

function insertHeaderStyles() {
    const style = document.createElement('style');
    style.textContent = headerCSS;
    document.head.appendChild(style);
}

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', function() {
    insertHeaderStyles();
    insertHeader();
});
