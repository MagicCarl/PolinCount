/**
 * Google's Universal Pollen Index (0-5) and its mapping onto the app's
 * 4-step severity scale. Single source of truth — imported by the pollen
 * route and the alert cron so the site and the emails cannot drift apart.
 */

const UPI_CATEGORY = ['None', 'Very Low', 'Low', 'Moderate', 'High', 'Very High'];

const UPI_TO_SEVERITY_LEVEL = { 0: 1, 1: 1, 2: 1, 3: 2, 4: 3, 5: 4 };

// Mirrors computeBreathableScore() in main.js.
function calculateBreathableScore(maxSeverityLevel, aqi) {
    const pollenPenalty = { 1: 0.5, 2: 1.5, 3: 3, 4: 4.5 }[maxSeverityLevel] || 0;

    let aqiPenalty = 0;
    if (aqi !== null && aqi !== undefined) {
        if (aqi > 300) aqiPenalty = 4.5;
        else if (aqi > 200) aqiPenalty = 3.5;
        else if (aqi > 150) aqiPenalty = 2.5;
        else if (aqi > 100) aqiPenalty = 1.5;
        else if (aqi > 50) aqiPenalty = 0.5;
    }

    return Math.max(1, Math.min(10, Math.round(10 - pollenPenalty - aqiPenalty)));
}

const CITIES = require('./cities.json');

// Server-side allowlist: the client only ever requests these 20 coordinates.
// Keeps an open, unauthenticated route from being walked to run up API billing.
const ALLOWED_COORDS = new Set(CITIES.map(c => `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`));

function isAllowedLocation(lat, lon) {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return false;
    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) return false;
    return ALLOWED_COORDS.has(`${latNum.toFixed(4)},${lonNum.toFixed(4)}`);
}

module.exports = {
    UPI_CATEGORY,
    UPI_TO_SEVERITY_LEVEL,
    calculateBreathableScore,
    CITIES,
    isAllowedLocation,
};
