/**
 * Cookie Consent Helper & Status Updater
 * 1. Re-opens Google's native consent modal from footer.
 * 2. Listens for consent changes and updates Gtag manually (Safety Net).
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Footer Link Functionality ---
    const footerCookieBtn = document.getElementById('footer-cookie-settings');

    if (footerCookieBtn) {
        footerCookieBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.googlefc && typeof window.googlefc.callbackQueue !== 'undefined') {
                window.googlefc.callbackQueue.push(window.googlefc.showRevocationMessage);
            } else {
                console.warn('Google CMP not ready or blocked by extension.');
                alert('Cookie preferences are managed by Google. Please disable ad blockers to modify your settings.');
            }
        });
        console.log('Cookie consent helper initialized: Footer link active.');
    }

    // --- 2. Gtag Update Logic (The "Bridge") ---
    // This watches for the standard IAB TCF (Consent Framework) API 
    // which Google uses behind the scenes.
    
    const updateGtagConsent = (tcData) => {
        // If the CMP says we have valid consent data
        if (tcData && tcData.eventStatus === 'tcloaded' || tcData.eventStatus === 'useractioncomplete') {
            
            // We blindly assume "granted" if the user completed the flow, 
            // strictly to override the "denied" default. 
            // Google's script usually handles the granular details, 
            // but this ensures the 'denied' flag is lifted.
            
            console.log('Consent action detected. Updating Gtag...');
            
            gtag('consent', 'update', {
                'ad_storage': 'granted',
                'ad_user_data': 'granted',
                'ad_personalization': 'granted',
                'analytics_storage': 'granted'
            });
        }
    };

    // Check if the TCF API exists (Standard for Google Funding Choices)
    if (typeof window.__tcfapi !== 'undefined') {
        window.__tcfapi('addEventListener', 2, updateGtagConsent);
    }
});