/**
 * Air Quality Index (AQI) + City Pollen service
 * AQI: Open-Meteo API (free, no key)
 * Pollen: pollen.com API via CORS proxy (free, no key)
 */

export const CITIES = [
    { name: 'Boise', state: 'ID', lat: 43.6150, lon: -116.2023, zip: '83702' },
    { name: 'Tulsa', state: 'OK', lat: 36.1540, lon: -95.9928, zip: '74103' },
    { name: 'Wichita', state: 'KS', lat: 37.6872, lon: -97.3301, zip: '67202' },
    { name: 'Raleigh', state: 'NC', lat: 35.7796, lon: -78.6382, zip: '27601' },
    { name: 'San Diego', state: 'CA', lat: 32.7157, lon: -117.1611, zip: '92101' },
    { name: 'Dallas', state: 'TX', lat: 32.7767, lon: -96.7970, zip: '75201' },
    { name: 'Oklahoma City', state: 'OK', lat: 35.4676, lon: -97.5164, zip: '73102' },
    { name: 'New Orleans', state: 'LA', lat: 29.9511, lon: -90.0715, zip: '70112' },
    { name: 'Richmond', state: 'VA', lat: 37.5407, lon: -77.4360, zip: '23219' },
    { name: 'Greenville', state: 'SC', lat: 34.8526, lon: -82.3940, zip: '29601' },
    { name: 'Indianapolis', state: 'IN', lat: 39.7684, lon: -86.1581, zip: '46204' },
    { name: 'Kihei', state: 'HI', lat: 20.7644, lon: -156.4450, zip: '96753' },
    { name: 'Detroit', state: 'MI', lat: 42.3314, lon: -83.0458, zip: '48201' },
    { name: 'Philadelphia', state: 'PA', lat: 39.9526, lon: -75.1652, zip: '19103' },
    { name: 'New York', state: 'NY', lat: 40.7128, lon: -74.0060, zip: '10001' },
    { name: 'Wilmington', state: 'DE', lat: 39.7391, lon: -75.5398, zip: '19801' },
    { name: 'Los Angeles', state: 'CA', lat: 34.0522, lon: -118.2437, zip: '90012' },
    { name: 'San Francisco', state: 'CA', lat: 37.7749, lon: -122.4194, zip: '94102' },
    { name: 'Orlando', state: 'FL', lat: 28.5383, lon: -81.3792, zip: '32801' },
    { name: 'Charleston', state: 'SC', lat: 32.7765, lon: -79.9311, zip: '29401' },
];

const AQI_CACHE_KEY = 'aqi_data_cache';
const POLLEN_CACHE_KEY = 'pollen_city_cache';
const AQI_CACHE_TTL = 1000 * 60 * 30; // 30 minutes
const POLLEN_CACHE_TTL = 1000 * 60 * 60; // 1 hour

const CORS_PROXIES = [
    { url: 'https://api.allorigins.win/get?url=', type: 'json' },
    { url: 'https://corsproxy.io/?', type: 'text' },
    { url: 'https://api.codetabs.com/v1/proxy?quest=', type: 'text' },
];

/**
 * Get AQI level info from US AQI value
 */
export function getAQILevel(aqi) {
    if (aqi <= 50) return { label: 'Good', class: 'aqi-good', color: '#22c55e', description: 'Air quality is satisfactory.' };
    if (aqi <= 100) return { label: 'Moderate', class: 'aqi-moderate', color: '#eab308', description: 'Acceptable air quality. Some pollutants may be a concern for sensitive individuals.' };
    if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', class: 'aqi-usg', color: '#f97316', description: 'Sensitive groups may experience health effects.' };
    if (aqi <= 200) return { label: 'Unhealthy', class: 'aqi-unhealthy', color: '#ef4444', description: 'Everyone may begin to experience health effects.' };
    if (aqi <= 300) return { label: 'Very Unhealthy', class: 'aqi-very-unhealthy', color: '#7c3aed', description: 'Health alert: everyone may experience serious health effects.' };
    return { label: 'Hazardous', class: 'aqi-hazardous', color: '#991b1b', description: 'Health warning of emergency conditions.' };
}

/**
 * Convert pollen.com index (0-12) to severity
 */
function pollenIndexToSeverity(index) {
    if (index >= 9.7) return { severity: 'VERY HIGH', severityLevel: 4 };
    if (index >= 7.3) return { severity: 'HIGH', severityLevel: 3 };
    if (index >= 4.9) return { severity: 'MODERATE', severityLevel: 2 };
    if (index >= 2.5) return { severity: 'LOW-MODERATE', severityLevel: 2 };
    return { severity: 'LOW', severityLevel: 1 };
}

// --- Caching helpers ---

function getCached(key) {
    try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const { data, timestamp, ttl } = JSON.parse(cached);
        if (Date.now() - timestamp > ttl) return null;
        return data;
    } catch {
        return null;
    }
}

function setCache(key, data, ttl) {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now(), ttl }));
}

// --- AQI ---

export async function fetchAQI(city) {
    const cacheKey = `${AQI_CACHE_KEY}_${city.name}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`AQI fetch failed: ${response.status}`);

    const json = await response.json();
    const current = json.current;

    const result = {
        city: city.name,
        state: city.state,
        aqi: Math.round(current.us_aqi || 0),
        pm25: current.pm2_5?.toFixed(1) ?? '--',
        pm10: current.pm10?.toFixed(1) ?? '--',
        no2: current.nitrogen_dioxide?.toFixed(1) ?? '--',
        ozone: current.ozone?.toFixed(1) ?? '--',
        time: new Date(current.time).toLocaleString(),
    };

    setCache(cacheKey, result, AQI_CACHE_TTL);
    return result;
}

// --- City Pollen (pollen.com) ---

async function fetchViaProxy(targetUrl) {
    const fetches = CORS_PROXIES.map(async (proxy) => {
        const url = proxy.type === 'json'
            ? `${proxy.url}${encodeURIComponent(targetUrl)}`
            : `${proxy.url}${targetUrl}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!response.ok) throw new Error(`Proxy ${response.status}`);

            if (proxy.type === 'json') {
                const data = await response.json();
                return data.contents;
            }
            return await response.text();
        } catch (err) {
            clearTimeout(timeout);
            throw err;
        }
    });

    return Promise.any(fetches);
}

async function fetchPollenJSON(zip) {
    // Try our own serverless proxy first (works on Vercel)
    try {
        const response = await fetch(`/api/pollen?zip=${zip}`);
        if (response.ok) return await response.json();
    } catch { /* fall through */ }

    // Fall back to CORS proxies
    const targetUrl = `https://www.pollen.com/api/forecast/current/pollen/${zip}`;
    const raw = await fetchViaProxy(targetUrl);
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function fetchCityPollen(city) {
    const cacheKey = `${POLLEN_CACHE_KEY}_${city.zip}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const json = await fetchPollenJSON(city.zip);

    // pollen.com returns { Location, Type, ForecastDate, Forecast[] }
    // Forecast[0] = yesterday, [1] = today, [2] = tomorrow
    const today = json.Location?.periods?.[1] || json.Location?.periods?.[0];
    if (!today) throw new Error('No pollen forecast data found');

    const triggers = today.Triggers || [];
    const treeSpecies = triggers
        .filter(t => t.PlantType === 1)
        .map(t => t.Name);

    const treePollen = today.Triggers?.filter(t => t.PlantType === 1) || [];
    const grassPollen = today.Triggers?.filter(t => t.PlantType === 2) || [];
    const weedPollen = today.Triggers?.filter(t => t.PlantType === 3) || [];

    // Overall index from pollen.com (0-12 scale)
    const overallIndex = today.Index ?? 0;

    // Build pollen array similar to NC DEQ format
    const pollen = [
        {
            type: 'Trees',
            count: overallIndex,
            ...pollenIndexToSeverity(treePollen.length > 0 ? overallIndex : 0),
            unit: 'index (0-12)',
            details: treeSpecies,
        },
        {
            type: 'Grasses',
            count: grassPollen.length > 0 ? Math.round(overallIndex * 0.6 * 10) / 10 : 0,
            ...pollenIndexToSeverity(grassPollen.length > 0 ? overallIndex * 0.6 : 0),
            unit: 'index (0-12)',
            details: grassPollen.map(t => t.Name),
        },
        {
            type: 'Weeds',
            count: weedPollen.length > 0 ? Math.round(overallIndex * 0.4 * 10) / 10 : 0,
            ...pollenIndexToSeverity(weedPollen.length > 0 ? overallIndex * 0.4 : 0),
            unit: 'index (0-12)',
            details: weedPollen.map(t => t.Name),
        },
    ];

    const result = {
        city: city.name,
        state: city.state,
        period: `Pollen forecast for ${city.name}, ${city.state}`,
        lastUpdated: new Date().toLocaleString(),
        pollen,
        totalIndex: overallIndex,
    };

    setCache(cacheKey, result, POLLEN_CACHE_TTL);
    return result;
}
