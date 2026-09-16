/**
 * Google Pollen API proxy — per-type Tree/Grass/Weed indices for any of the
 * app's cities.
 *
 * Google reports the Universal Pollen Index (UPI), an integer 0-5. It is NOT a
 * grain concentration, so it is never mixed with NC DEQ's measured grains/m3.
 */

const { UPI_CATEGORY, UPI_TO_SEVERITY_LEVEL, isAllowedLocation } = require('./_lib/upi.js');

const GOOGLE_POLLEN_URL = 'https://pollen.googleapis.com/v1/forecast:lookup';
const FETCH_TIMEOUT = 15000;

const TYPE_LABELS = { TREE: 'Trees', GRASS: 'Grasses', WEED: 'Weeds' };

/**
 * Read one pollen type's index.
 *
 * Google omits `indexInfo` for a type that is present but out of season, which
 * genuinely means zero. A type missing from `pollenTypeInfo` altogether means
 * Google reported nothing for it — that is unknown, not zero, and must never
 * render as a reassuring "NONE".
 */
function readIndex(info) {
    if (!info) {
        return { count: null, severity: null, severityLevel: null, description: null, available: false };
    }

    const value = info.indexInfo && Number.isFinite(info.indexInfo.value) ? info.indexInfo.value : 0;
    const category = info.indexInfo && info.indexInfo.category
        ? String(info.indexInfo.category).toUpperCase()
        : String(UPI_CATEGORY[value] || 'UNKNOWN').toUpperCase();

    return {
        count: value,
        severity: category,
        severityLevel: UPI_TO_SEVERITY_LEVEL[value] || 1,
        description: (info.indexInfo && info.indexInfo.indexDescription) || null,
        available: true,
    };
}

function buildPollenPayload(daily) {
    const typeInfo = daily.pollenTypeInfo || [];
    const plantInfo = daily.plantInfo || [];

    return ['TREE', 'GRASS', 'WEED'].map(code => {
        const info = typeInfo.find(t => t.code === code);
        const index = readIndex(info);

        // Only list species Google actually reports as present — an in-season
        // plant, or one carrying a non-zero index. No hardcoded guesswork.
        const details = plantInfo
            .filter(p => {
                const type = p.plantDescription && p.plantDescription.type;
                if (type !== code) return false;
                const value = p.indexInfo && Number.isFinite(p.indexInfo.value) ? p.indexInfo.value : 0;
                return p.inSeason === true || value > 0;
            })
            .map(p => p.displayName)
            .filter(Boolean);

        return {
            type: TYPE_LABELS[code],
            ...index,
            unit: 'UPI (0-5)',
            inSeason: info ? info.inSeason === true : false,
            details,
            healthRecommendations: (info && info.healthRecommendations) || [],
        };
    });
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { lat, lon } = req.query;
    if (!isAllowedLocation(lat, lon)) {
        return res.status(400).json({ error: 'Unsupported location' });
    }

    const apiKey = process.env.GOOGLE_POLLEN_API_KEY;
    if (!apiKey) {
        return res.status(503).json({
            error: 'Pollen forecast unavailable — GOOGLE_POLLEN_API_KEY is not configured',
        });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
        const url = `${GOOGLE_POLLEN_URL}`
            + `?location.latitude=${encodeURIComponent(lat)}`
            + `&location.longitude=${encodeURIComponent(lon)}`
            + '&days=1&languageCode=en&plantsDescription=true';

        // Key goes in a header, never the query string — query params land in
        // request logs at every hop.
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'X-Goog-Api-Key': apiKey },
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            console.error('Google Pollen API error:', response.status, body.slice(0, 300));
            return res.status(502).json({ error: `Pollen provider returned ${response.status}` });
        }

        const json = await response.json();
        const daily = json.dailyInfo && json.dailyInfo[0];

        if (!daily) {
            return res.status(404).json({ error: 'No pollen forecast available for this location' });
        }

        const pollen = buildPollenPayload(daily);

        // If Google reported no type at all, say so rather than rendering three zeros.
        if (pollen.every(p => !p.available)) {
            return res.status(404).json({ error: 'No pollen forecast available for this location' });
        }

        const known = pollen.filter(p => p.available);
        const d = daily.date;
        const reportDate = d ? `${d.month}/${d.day}/${d.year}` : null;

        const data = {
            source: 'Google Pollen API',
            measured: false,
            regionCode: json.regionCode || null,
            reportDate,
            period: reportDate ? `Forecast for ${reportDate}` : 'Current forecast',
            lastUpdated: new Date().toISOString(),
            pollen,
            totalIndex: known.length > 0 ? Math.max(...known.map(p => p.count)) : null,
            unit: 'UPI (0-5)',
        };

        // Google publishes one forecast per day, so a 6-hour edge cache loses
        // nothing and caps worst-case usage at 20 cities x 4/day = ~2,400
        // calls/month — inside the 5K free tier even if every city is busy.
        res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=10800');
        return res.status(200).json(data);
    } catch (err) {
        console.error('pollen handler error:', err.message);
        return res.status(502).json({ error: 'Failed to fetch pollen forecast' });
    } finally {
        clearTimeout(timeout);
    }
};

module.exports.buildPollenPayload = buildPollenPayload;
