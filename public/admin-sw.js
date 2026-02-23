// Minimal service worker for PWA installability on mobile.
// Required for beforeinstallprompt to fire on Android Chrome.
self.addEventListener('fetch', () => {});
