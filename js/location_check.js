// ========================================
// Urdle — Location Check Module
// ========================================
// Detects user geolocation and compares to
// a fixed target location using Haversine.
// Sets window.isUserAtLocation boolean.

(function () {
    'use strict';

    // --- Target Location ---
    // 25 Whitechapel Drive, Mount Laurel, NJ 08054
    const TARGET_LAT = 39.95897;
    const TARGET_LNG = -74.87767;
    const MAX_DISTANCE = 50;       // meters
    const MAX_ACCURACY = 50;       // meters — reject readings noisier than this

    // Default: user is NOT at location
    window.isUserAtLocation = false;

    // ========================================
    // Haversine Formula
    // ========================================

    /**
     * Calculate distance in meters between two lat/lng points.
     */
    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth radius in meters
        const toRad = (deg) => deg * (Math.PI / 180);

        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // ========================================
    // Geolocation Check
    // ========================================

    function checkLocation() {
        if (!navigator.geolocation) {
            console.warn('[LocationCheck] Geolocation API not available.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            onSuccess,
            onError,
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    }

    function onSuccess(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        console.log('[LocationCheck] Latitude :', lat);
        console.log('[LocationCheck] Longitude:', lng);
        console.log('[LocationCheck] Accuracy :', accuracy, 'm');

        // Accuracy validation
        if (accuracy > MAX_ACCURACY) {
            console.warn(
                '[LocationCheck] Accuracy too low (' + accuracy + 'm). ' +
                'Need ≤' + MAX_ACCURACY + 'm. Treating as outside location.'
            );
            window.isUserAtLocation = false;
            return;
        }

        // Distance calculation
        const distance = haversineDistance(lat, lng, TARGET_LAT, TARGET_LNG);
        console.log('[LocationCheck] Distance to target:', distance.toFixed(2), 'm');

        if (distance <= MAX_DISTANCE) {
            window.isUserAtLocation = true;
            console.log('[LocationCheck] ✅ User is WITHIN range (' + distance.toFixed(1) + 'm)');
        } else {
            window.isUserAtLocation = false;
            console.log('[LocationCheck] ❌ User is OUTSIDE range (' + distance.toFixed(1) + 'm)');
        }
    }

    function onError(error) {
        switch (error.code) {
            case 1: // PERMISSION_DENIED
                console.error('[LocationCheck] Permission denied.');
                alert('لوکیشن کی اجازت درکار ہے۔');
                break;
            case 2: // POSITION_UNAVAILABLE
                console.error('[LocationCheck] Position unavailable.');
                break;
            case 3: // TIMEOUT
                console.error('[LocationCheck] Geolocation request timed out.');
                break;
            default:
                console.error('[LocationCheck] Unknown error:', error.message);
        }
        window.isUserAtLocation = false;
    }

    // --- Run on load ---
    checkLocation();

})();
