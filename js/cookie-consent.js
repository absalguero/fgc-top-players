/**
 * Cookie Consent Manager - GDPR Compliant
 * Handles cookie consent banner, preferences, and Google Analytics loading
 */

class CookieConsentManager {
  constructor() {
    this.CONSENT_KEY = 'fgctp_cookie_consent';
    this.CONSENT_VERSION = '1.0';
    this.GA_ID = 'G-47ZV9G37SY';

    this.banner = null;
    this.preferencesBtn = null;
    this.analyticsCheckbox = null;

    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    console.log('Cookie consent manager initializing...');

    // Get DOM elements
    this.banner = document.getElementById('cookie-consent-banner');
    this.preferencesBtn = document.getElementById('cookie-preferences-btn');
    this.analyticsCheckbox = document.getElementById('cookie-analytics');

    console.log('Banner found:', !!this.banner);
    console.log('Preferences button found:', !!this.preferencesBtn);

    if (!this.banner) {
      console.error('Cookie consent banner not found in DOM');
      return;
    }

    // Set up event listeners first
    this.setupEventListeners();

    // Check for Global Privacy Control (GPC)
    if (this.detectGPC()) {
      console.log('GPC signal detected - respecting user privacy preference');
      this.saveConsent({ analytics: false });
      this.applyConsent();
      return;
    }

    // Check existing consent
    const consent = this.getConsent();

    if (consent) {
      // User has already made a choice
      console.log('Existing consent found:', consent);
      this.applyConsent();
    } else {
      // Show banner for first-time visitors
      console.log('No consent found - showing banner');
      this.showBanner();
    }
  }

  setupEventListeners() {
    console.log('Setting up event listeners...');

    // Accept All button
    const acceptAllBtn = document.getElementById('cookie-accept-all');
    if (acceptAllBtn) {
      acceptAllBtn.addEventListener('click', () => this.acceptAll());
      console.log('Accept All button listener added');
    }

    // Reject All button
    const rejectAllBtn = document.getElementById('cookie-reject-all');
    if (rejectAllBtn) {
      rejectAllBtn.addEventListener('click', () => this.rejectAll());
      console.log('Reject All button listener added');
    }

    // Save Preferences button
    const savePrefsBtn = document.getElementById('cookie-accept-selected');
    if (savePrefsBtn) {
      savePrefsBtn.addEventListener('click', () => this.savePreferences());
      console.log('Save Preferences button listener added');
    }

    // Cookie Preferences button (floating button)
    if (this.preferencesBtn) {
      this.preferencesBtn.addEventListener('click', () => {
        console.log('Cookie preferences button clicked!');
        this.showBanner();
      });
      console.log('Cookie preferences button listener added');
    } else {
      console.warn('Cookie preferences button not found!');
    }

    // Footer Cookie Settings button
    const footerCookieBtn = document.getElementById('footer-cookie-settings');
    if (footerCookieBtn) {
      footerCookieBtn.addEventListener('click', () => {
        console.log('Footer cookie settings clicked!');
        this.showBanner();
      });
      console.log('Footer cookie settings button listener added');
    } else {
      console.warn('Footer cookie settings button not found!');
    }
  }

  detectGPC() {
    // Check for Global Privacy Control signal
    return navigator.globalPrivacyControl === true;
  }

  showBanner() {
    console.log('showBanner() called, banner exists:', !!this.banner);
    if (this.banner) {
      this.banner.removeAttribute('hidden');
      this.banner.setAttribute('aria-hidden', 'false');
      console.log('Banner should now be visible');

      // Set checkbox state based on current consent
      const consent = this.getConsent();
      if (this.analyticsCheckbox && consent) {
        this.analyticsCheckbox.checked = consent.analytics;
      }
    } else {
      console.error('Cannot show banner - banner element is null');
    }
  }

  hideBanner() {
    if (this.banner) {
      this.banner.setAttribute('hidden', '');
      this.banner.setAttribute('aria-hidden', 'true');
    }
  }

  acceptAll() {
    this.saveConsent({ analytics: true });
    this.applyConsent();
    this.hideBanner();
    this.showNotification('All cookies accepted');
  }

  rejectAll() {
    this.saveConsent({ analytics: false });
    this.applyConsent();
    this.hideBanner();
    this.showNotification('Optional cookies rejected');
  }

  savePreferences() {
    const analyticsConsent = this.analyticsCheckbox ? this.analyticsCheckbox.checked : false;
    this.saveConsent({ analytics: analyticsConsent });
    this.applyConsent();
    this.hideBanner();
    this.showNotification('Cookie preferences saved');
  }

  saveConsent(preferences) {
    const consentData = {
      version: this.CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      preferences: preferences
    };

    try {
      localStorage.setItem(this.CONSENT_KEY, JSON.stringify(consentData));
    } catch (e) {
      console.error('Failed to save cookie consent:', e);
    }
  }

  getConsent() {
    try {
      const stored = localStorage.getItem(this.CONSENT_KEY);
      if (!stored) return null;

      const consentData = JSON.parse(stored);

      // Check if consent version matches (invalidate old consents)
      if (consentData.version !== this.CONSENT_VERSION) {
        localStorage.removeItem(this.CONSENT_KEY);
        return null;
      }

      return consentData.preferences;
    } catch (e) {
      console.error('Failed to read cookie consent:', e);
      return null;
    }
  }

  applyConsent() {
    const consent = this.getConsent();

    if (!consent) {
      return;
    }

    // Apply analytics consent
    if (consent.analytics) {
      this.enableGoogleAnalytics();
    } else {
      this.disableGoogleAnalytics();
    }
  }

  enableGoogleAnalytics() {
    // Check if GA is already loaded
    if (window.gtag) {
      console.log('Google Analytics already loaded');
      return;
    }

    console.log('Loading Google Analytics with consent');

    // Create and inject GA script
    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${this.GA_ID}`;
    document.head.appendChild(script1);

    // Initialize GA
    const script2 = document.createElement('script');
    script2.textContent = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${this.GA_ID}', {
        'anonymize_ip': true,
        'cookie_flags': 'SameSite=None;Secure'
      });
    `;
    document.head.appendChild(script2);
  }

  disableGoogleAnalytics() {
    // Disable GA if it's running
    if (window.gtag) {
      console.log('Disabling Google Analytics');

      // Set GA to deny consent
      window.gtag('consent', 'update', {
        'analytics_storage': 'denied'
      });
    }

    // Delete GA cookies
    this.deleteGACookies();
  }

  deleteGACookies() {
    // Delete GA cookies
    const gaCookies = ['_ga', '_gat', '_gid'];
    gaCookies.forEach(cookieName => {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
    });
  }

  showNotification(message) {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 20px;
      background: #0096FF;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 150, 255, 0.4);
      border: 2px solid rgba(255, 255, 255, 0.1);
      z-index: 10001;
      animation: slideInLeft 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutLeft 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Add animations for notification
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInLeft {
    from {
      transform: translateX(-400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOutLeft {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(-400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize cookie consent manager
window.cookieConsentManager = new CookieConsentManager();
