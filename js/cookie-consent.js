document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('custom-consent-banner');
    const acceptBtn = document.getElementById('btn-accept');
    const rejectBtn = document.getElementById('btn-reject');
    const footerSettingsBtn = document.getElementById('footer-cookie-settings');

    // 1. Check Local Storage on load
    // If no choice is stored, show the banner
    if (!localStorage.getItem('site_consent_mode')) {
        if(banner) banner.style.display = 'block';
    }

    // 2. Helper to Update Consent
    function updateConsent(state) {
        const consentSettings = {
            'ad_storage': state,
            'ad_user_data': state,
            'ad_personalization': state,
            'analytics_storage': state
        };

        // Send signal to Google (Gtag)
        if (typeof gtag === 'function') {
            gtag('consent', 'update', consentSettings);
        }

        // Save to storage
        localStorage.setItem('site_consent_mode', JSON.stringify(consentSettings));

        // Hide banner
        if(banner) banner.style.display = 'none';
    }

    // 3. Button Listeners
    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => updateConsent('granted'));
    }

    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => updateConsent('denied'));
    }

    // 4. Re-open settings from Footer Link
    if (footerSettingsBtn) {
        footerSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if(banner) banner.style.display = 'block';
        });
    }
});