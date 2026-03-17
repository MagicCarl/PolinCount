/**
 * Air Quality Index (AQI) service using Open-Meteo API (free, no key needed)
 */

export const CITIES = [
    { name: 'Boise', state: 'ID', lat: 43.6150, lon: -116.2023 },
    { name: 'Tulsa', state: 'OK', lat: 36.1540, lon: -95.9928 },
    { name: 'Wichita', state: 'KS', lat: 37.6872, lon: -97.3301 },
    { name: 'Raleigh', state: 'NC', lat: 35.7796, lon: -78.6382 },
    { name: 'San Diego', state: 'CA', lat: 32.7157, lon: -117.1611 },
    { name: 'Dallas', state: 'TX', lat: 32.7767, lon: -96.7970 },
    { name: 'Oklahoma City', state: 'OK', lat: 35.4676, lon: -97.5164 },
    { name: 'New Orleans', state: 'LA', lat: 29.9511, lon: -90.0715 },
    { name: 'Richmond', state: 'VA', lat: 37.5407, lon: -77.4360 },
    { name: 'Greenville', state: 'SC', lat: 34.8526, lon: -82.3940 },
    { name: 'Indianapolis', state: 'IN', lat: 39.7684, lon: -86.1581 },
    { name: 'Kihei', state: 'HI', lat: 20.7644, lon: -156.4450 },
    { name: 'Detroit', state: 'MI', lat: 42.3314, lon: -83.0458 },
    { name: 'Philadelphia', state: 'PA', lat: 39.9526, lon: -75.1652 },
    { name: 'New York', state: 'NY', lat: 40.7128, lon: -74.0060 },
    { name: 'Wilmington', state: 'DE', lat: 39.7391, lon: -75.5398 },
    { name: 'Los Angeles', state: 'CA', lat: 34.0522, lon: -118.2437 },
    { name: 'San Francisco', state: 'CA', lat: 37.7749, lon: -122.4194 },
    { name: 'Orlando', state: 'FL', lat: 28.5383, lon: -81.3792 },
    { name: 'Charleston', state: 'SC', lat: 32.7765, lon: -79.9311 },
];

const AQI_CACHE_KEY = 'aqi_data_cache';
const AQI_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

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
 * Get cached AQI data for a city
 */
function getCachedAQI(cityName) {
    try {
        const cached = localStorage.getItem(`${AQI_CACHE_KEY}_${cityName}`);
        if (!cached) return null;
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > AQI_CACHE_TTL) return null;
        return data;
    } catch {
        return null;
    }
}

/**
 * Fetch AQI data for a city from Open-Meteo
 */
export async function fetchAQI(city) {
    // Check cache first
    const cached = getCachedAQI(city.name);
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

    // Cache
    localStorage.setItem(`${AQI_CACHE_KEY}_${city.name}`, JSON.stringify({
        data: result,
        timestamp: Date.now(),
    }));

    return result;
}
