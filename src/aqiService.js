/**
 * Air Quality Index (AQI) + City Pollen service
 * AQI: /api/aqi (proxies Open-Meteo, server-side cached)
 * Pollen: /api/pollen (proxies pollen.com, server-side cached)
 */

export const CITIES = [
    { name: 'Boise', state: 'ID', lat: 43.6150, lon: -116.2023, zip: '83702' },
    { name: 'Charleston', state: 'SC', lat: 32.7765, lon: -79.9311, zip: '29401' },
    { name: 'Dallas', state: 'TX', lat: 32.7767, lon: -96.7970, zip: '75201' },
    { name: 'Detroit', state: 'MI', lat: 42.3314, lon: -83.0458, zip: '48201' },
    { name: 'Greenville', state: 'SC', lat: 34.8526, lon: -82.3940, zip: '29601' },
    { name: 'Indianapolis', state: 'IN', lat: 39.7684, lon: -86.1581, zip: '46204' },
    { name: 'Kihei', state: 'HI', lat: 20.7644, lon: -156.4450, zip: '96753' },
    { name: 'Los Angeles', state: 'CA', lat: 34.0522, lon: -118.2437, zip: '90012' },
    { name: 'New Orleans', state: 'LA', lat: 29.9511, lon: -90.0715, zip: '70112' },
    { name: 'New York', state: 'NY', lat: 40.7128, lon: -74.0060, zip: '10001' },
    { name: 'Oklahoma City', state: 'OK', lat: 35.4676, lon: -97.5164, zip: '73102' },
    { name: 'Orlando', state: 'FL', lat: 28.5383, lon: -81.3792, zip: '32801' },
    { name: 'Philadelphia', state: 'PA', lat: 39.9526, lon: -75.1652, zip: '19103' },
    { name: 'Raleigh', state: 'NC', lat: 35.7796, lon: -78.6382, zip: '27601' },
    { name: 'Richmond', state: 'VA', lat: 37.5407, lon: -77.4360, zip: '23219' },
    { name: 'San Diego', state: 'CA', lat: 32.7157, lon: -117.1611, zip: '92101' },
    { name: 'San Francisco', state: 'CA', lat: 37.7749, lon: -122.4194, zip: '94102' },
    { name: 'Tulsa', state: 'OK', lat: 36.1540, lon: -95.9928, zip: '74103' },
    { name: 'Wichita', state: 'KS', lat: 37.6872, lon: -97.3301, zip: '67202' },
    { name: 'Wilmington', state: 'DE', lat: 39.7391, lon: -75.5398, zip: '19801' },
];

export function getAQILevel(aqi) {
    if (aqi <= 50) return { label: 'Good', class: 'aqi-good', color: '#22c55e', description: 'Air quality is satisfactory.' };
    if (aqi <= 100) return { label: 'Moderate', class: 'aqi-moderate', color: '#eab308', description: 'Acceptable air quality. Some pollutants may be a concern for sensitive individuals.' };
    if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', class: 'aqi-usg', color: '#f97316', description: 'Sensitive groups may experience health effects.' };
    if (aqi <= 200) return { label: 'Unhealthy', class: 'aqi-unhealthy', color: '#ef4444', description: 'Everyone may begin to experience health effects.' };
    if (aqi <= 300) return { label: 'Very Unhealthy', class: 'aqi-very-unhealthy', color: '#7c3aed', description: 'Health alert: everyone may experience serious health effects.' };
    return { label: 'Hazardous', class: 'aqi-hazardous', color: '#991b1b', description: 'Health warning of emergency conditions.' };
}

function pollenIndexToSeverity(index) {
    if (index >= 9.7) return { severity: 'VERY HIGH', severityLevel: 4 };
    if (index >= 7.3) return { severity: 'HIGH', severityLevel: 3 };
    if (index >= 4.9) return { severity: 'MODERATE', severityLevel: 2 };
    if (index >= 2.5) return { severity: 'LOW-MODERATE', severityLevel: 2 };
    return { severity: 'LOW', severityLevel: 1 };
}

// Common allergens by city (used when API triggers are sparse)
const COMMON_TREE_ALLERGENS = {
    'Boise': ['Oak', 'Birch', 'Alder', 'Juniper', 'Cottonwood', 'Elm'],
    'Charleston': ['Oak', 'Pine', 'Cedar', 'Cypress', 'Maple', 'Hickory'],
    'Dallas': ['Oak', 'Cedar', 'Elm', 'Pecan', 'Ash', 'Cottonwood'],
    'Detroit': ['Oak', 'Maple', 'Birch', 'Elm', 'Ash', 'Walnut'],
    'Greenville': ['Oak', 'Pine', 'Birch', 'Maple', 'Cedar', 'Sweet Gum'],
    'Indianapolis': ['Oak', 'Maple', 'Elm', 'Ash', 'Birch', 'Cottonwood'],
    'Kihei': ['Palm', 'Ironwood', 'Eucalyptus', 'Mango', 'Monkeypod'],
    'Los Angeles': ['Oak', 'Olive', 'Mulberry', 'Ash', 'Eucalyptus', 'Alder'],
    'New Orleans': ['Oak', 'Cedar', 'Pine', 'Pecan', 'Cypress', 'Elm'],
    'New York': ['Oak', 'Birch', 'Maple', 'Elm', 'Ash', 'Cedar'],
    'Oklahoma City': ['Oak', 'Cedar', 'Elm', 'Pecan', 'Ash', 'Cottonwood'],
    'Orlando': ['Oak', 'Pine', 'Cedar', 'Cypress', 'Maple', 'Palm'],
    'Philadelphia': ['Oak', 'Birch', 'Maple', 'Elm', 'Ash', 'Walnut'],
    'Raleigh': ['Oak', 'Pine', 'Cedar', 'Birch', 'Maple', 'Sweet Gum', 'Mulberry'],
    'Richmond': ['Oak', 'Birch', 'Maple', 'Cedar', 'Pine', 'Elm'],
    'San Diego': ['Oak', 'Olive', 'Eucalyptus', 'Ash', 'Mulberry', 'Palm'],
    'San Francisco': ['Oak', 'Alder', 'Birch', 'Eucalyptus', 'Cypress', 'Olive'],
    'Tulsa': ['Oak', 'Cedar', 'Elm', 'Pecan', 'Ash', 'Cottonwood'],
    'Wichita': ['Oak', 'Elm', 'Cedar', 'Ash', 'Cottonwood', 'Mulberry'],
    'Wilmington': ['Oak', 'Birch', 'Maple', 'Elm', 'Ash', 'Cedar'],
};

const COMMON_WEED_ALLERGENS = {
    'Boise': ['Ragweed', 'Sagebrush', 'Russian Thistle', 'Pigweed', 'Nettle'],
    'Charleston': ['Ragweed', 'Mugwort', 'Dock', "Lamb's Quarters", 'Plantain'],
    'Dallas': ['Ragweed', 'Pigweed', "Lamb's Quarters", 'Dock', 'Nettle'],
    'Detroit': ['Ragweed', 'Mugwort', 'Nettle', "Lamb's Quarters", 'Dock'],
    'Greenville': ['Ragweed', 'Mugwort', 'Dock', "Lamb's Quarters", 'Plantain'],
    'Indianapolis': ['Ragweed', 'Mugwort', "Lamb's Quarters", 'Pigweed', 'Dock'],
    'Kihei': ['Plantain', 'Pigweed', "Lamb's Quarters"],
    'Los Angeles': ['Ragweed', 'Sagebrush', 'Russian Thistle', 'Pigweed', 'Nettle'],
    'New Orleans': ['Ragweed', 'Mugwort', 'Dock', "Lamb's Quarters", 'Dog Fennel'],
    'New York': ['Ragweed', 'Mugwort', 'Nettle', "Lamb's Quarters", 'Dock'],
    'Oklahoma City': ['Ragweed', 'Pigweed', "Lamb's Quarters", 'Russian Thistle', 'Dock'],
    'Orlando': ['Ragweed', 'Dog Fennel', 'Dock', "Lamb's Quarters", 'Plantain'],
    'Philadelphia': ['Ragweed', 'Mugwort', 'Nettle', "Lamb's Quarters", 'Dock'],
    'Raleigh': ['Ragweed', 'Mugwort', 'Nettle', "Lamb's Quarters", 'Dock'],
    'Richmond': ['Ragweed', 'Mugwort', 'Dock', "Lamb's Quarters", 'Nettle'],
    'San Diego': ['Ragweed', 'Sagebrush', 'Russian Thistle', 'Pigweed', 'Nettle'],
    'San Francisco': ['Ragweed', 'Sagebrush', 'Nettle', 'Plantain', 'Dock'],
    'Tulsa': ['Ragweed', 'Pigweed', "Lamb's Quarters", 'Russian Thistle', 'Dock'],
    'Wichita': ['Ragweed', 'Pigweed', 'Russian Thistle', "Lamb's Quarters", 'Kochia'],
    'Wilmington': ['Ragweed', 'Mugwort', 'Nettle', "Lamb's Quarters", 'Dock'],
};

export function getCityAllergens(cityName) {
    return {
        trees: COMMON_TREE_ALLERGENS[cityName] || ['Oak', 'Maple', 'Birch', 'Cedar', 'Pine', 'Elm'],
        weeds: COMMON_WEED_ALLERGENS[cityName] || ['Ragweed', 'Mugwort', 'Nettle', "Lamb's Quarters", 'Dock'],
    };
}

export async function fetchAQI(city) {
    const response = await fetch(`/api/aqi?lat=${city.lat}&lon=${city.lon}`);
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `AQI server returned ${response.status}`);
    }
    const data = await response.json();
    // Add city identity (server doesn't know it from lat/lon)
    return { ...data, city: city.name, state: city.state };
}

export async function fetchCityPollen(city) {
    const response = await fetch(`/api/pollen?zip=${city.zip}`);
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Pollen server returned ${response.status}`);
    }
    const json = await response.json();

    // pollen.com returns { Location: { periods: [...] } }
    const today = json.Location?.periods?.[1] || json.Location?.periods?.[0];
    if (!today) throw new Error('No pollen forecast data found');

    const triggers = today.Triggers || [];
    const isTree = t => t.PlantType === 1 || t.PlantType === 'Tree';
    const isGrass = t => t.PlantType === 2 || t.PlantType === 'Grass';
    const isWeed = t => t.PlantType === 3 || t.PlantType === 'Weed';

    const treePollen = triggers.filter(isTree);
    const grassPollen = triggers.filter(isGrass);
    const weedPollen = triggers.filter(isWeed);
    const treeSpecies = treePollen.map(t => t.Name);
    const cityAllergens = getCityAllergens(city.name);

    const overallIndex = today.Index ?? 0;

    const pollen = [
        {
            type: 'Trees',
            count: overallIndex,
            ...pollenIndexToSeverity(treePollen.length > 0 ? overallIndex : 0),
            unit: 'index (0-12)',
            details: treeSpecies.length > 0 ? treeSpecies : cityAllergens.trees,
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
            details: weedPollen.length > 0 ? weedPollen.map(t => t.Name) : cityAllergens.weeds,
        },
    ];

    return {
        city: city.name,
        state: city.state,
        period: `Pollen forecast for ${city.name}, ${city.state}`,
        lastUpdated: new Date().toLocaleString(),
        pollen,
        totalIndex: overallIndex,
    };
}
