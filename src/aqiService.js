/**
 * Air Quality + Pollen service.
 *
 * AQI:    /api/aqi     (Open-Meteo, server-side cached)
 * Pollen: /api/pollen  (Google Pollen API — per-type UPI 0-5, all cities)
 *         /api/nc-pollen (NC DEQ — real measured grains/m3, Raleigh only)
 *
 * Raleigh prefers NC DEQ because those are physically counted grains rather
 * than a modelled forecast. Every other city uses Google. The two use different
 * units, so the unit always travels with the data and is shown in the UI.
 */

// Single source of truth, shared with the serverless routes' allowlist.
import CITY_LIST from '../api/_lib/cities.json';

export const CITIES = CITY_LIST;

export function getAQILevel(aqi) {
    if (aqi <= 50) return { label: 'Good', class: 'aqi-good', color: '#22c55e', description: 'Air quality is satisfactory.' };
    if (aqi <= 100) return { label: 'Moderate', class: 'aqi-moderate', color: '#eab308', description: 'Acceptable air quality. Some pollutants may be a concern for sensitive individuals.' };
    if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', class: 'aqi-usg', color: '#f97316', description: 'Sensitive groups may experience health effects.' };
    if (aqi <= 200) return { label: 'Unhealthy', class: 'aqi-unhealthy', color: '#ef4444', description: 'Everyone may begin to experience health effects.' };
    if (aqi <= 300) return { label: 'Very Unhealthy', class: 'aqi-very-unhealthy', color: '#7c3aed', description: 'Health alert: everyone may experience serious health effects.' };
    return { label: 'Hazardous', class: 'aqi-hazardous', color: '#991b1b', description: 'Health warning of emergency conditions.' };
}

async function getJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${response.status}`);
    }
    return response.json();
}

export async function fetchAQI(city) {
    const data = await getJSON(`/api/aqi?lat=${city.lat}&lon=${city.lon}`);
    // Add city identity — the server only knows lat/lon.
    return { ...data, city: city.name, state: city.state };
}

/**
 * Fetch pollen for a city. Resolves to a payload whose `source` and `unit`
 * describe exactly where the numbers came from. Rejects if no real data is
 * available — callers must surface that rather than substituting a guess.
 */
export async function fetchCityPollen(city) {
    let data;

    if (city.preferNcDeq) {
        try {
            data = await getJSON('/api/nc-pollen');
        } catch (ncError) {
            console.warn('NC DEQ unavailable, falling back to Google forecast:', ncError.message);
            try {
                data = await getJSON(`/api/pollen?lat=${city.lat}&lon=${city.lon}`);
            } catch (googleError) {
                // Surface both causes — otherwise the NC DEQ reason is lost.
                throw new Error(`${ncError.message} (forecast fallback also failed: ${googleError.message})`);
            }
        }
    } else {
        data = await getJSON(`/api/pollen?lat=${city.lat}&lon=${city.lon}`);
    }

    return {
        ...data,
        city: city.name,
        state: city.state,
        period: data.period || `Pollen report for ${city.name}, ${city.state}`,
    };
}
