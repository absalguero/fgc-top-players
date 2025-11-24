/**
 * Cookie Consent Helper
 * Integrates with Google's Privacy & Messaging (CMP)
 * * This script replaces the old custom consent manager. 
 * It listens for clicks on the footer "Cookie Settings" link
 * and re-opens Google's native consent modal.
 */

document.addEventListener('DOMContentLoaded', () => {
    const footerCookieBtn = document.getElementById('footer-cookie-settings');

    if (footerCookieBtn) {
        footerCookieBtn.addEventListener('click', (e) => {
            e.preventDefault();

            // Check if Google's CMP API (Funding Choices) is loaded
            if (window.googlefc && typeof window.googlefc.callbackQueue !== 'undefined') {
                // This command forces Google's popup to reappear
                // giving the user a chance to change their "Consent" or "Do Not Sell" settings
                window.googlefc.callbackQueue.push(window.googlefc.showRevocationMessage);
            } else {
                // Fallback if ad blocker is active or Google script hasn't loaded yet
                console.warn('Google CMP not ready or blocked by extension.');
                alert('Cookie preferences are managed by Google. Please disable ad blockers to modify your settings.');
            }
        });
        
        console.log('Cookie consent helper initialized: Footer link active.');
    }
});