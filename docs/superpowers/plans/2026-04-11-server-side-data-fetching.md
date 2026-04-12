# Server-Side Data Fetching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all pollen and AQI data fetching to server-side Vercel API routes so every device gets identical, CDN-cached responses.

**Architecture:** Two new Vercel serverless functions (`api/nc-pollen.js`, `api/aqi.js`) fetch upstream data server-side and set `Cache-Control: s-maxage` headers so Vercel's CDN caches one shared response per URL. Client-side code is stripped of CORS proxies and `localStorage` data caching — it calls the API routes directly.

**Tech Stack:** Node.js Vercel serverless functions (CommonJS `module.exports`), `node-html-parser` for server-side HTML parsing, existing Vite frontend (vanilla JS ES modules).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `api/nc-pollen.js` | Create | Fetch + parse NC DEQ HTML server-side, return JSON |
| `api/aqi.js` | Create | Proxy Open-Meteo AQI data server-side |
| `src/pollenService.js` | Rewrite | Thin client — calls `/api/nc-pollen`, no proxies, no localStorage |
| `src/aqiService.js` | Rewrite | Thin client — calls `/api/pollen` and `/api/aqi`, no proxies, no localStorage |
| `main.js` | Edit | Remove `getCachedPollenData` import and fallback branch |

---

## Task 1: Install `node-html-parser`

`DOMParser` is browser-only. The NC DEQ parsing needs a server-side equivalent. `node-html-parser` is lightweight (35 kB, zero dependencies) with a near-identical query API.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install node-html-parser
```

Expected output: `added 1 package` (or similar — no errors).

- [ ] **Step 2: Verify it's in package.json**

Check `package.json` now has `"node-html-parser"` under `"dependencies"` (not `"devDependencies"`).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add node-html-parser for server-side HTML parsing"
```

---

## Task 2: Create `api/nc-pollen.js`

This replaces the three-CORS-proxy browser fetch. It fetches the NC DEQ page directly (no CORS issues server-side), parses it with `node-html-parser`, and returns structured JSON. The `s-maxage=3600` header makes Vercel CDN cache one shared response for all devices for 1 hour.

**Files:**
- Create: `api/nc-pollen.js`

- [ ] **Step 1: Create the file with this exact content**

```js
const { parse } = require('node-html-parser');

const NC_DEQ_URL = 'https://xapps.ncdenr.org/aq/ambient/Pollen.jsp';
const FETCH_TIMEOUT = 15000;

function parsePollenHTML(html) {
    const root = parse(html);

    const titleEl = root.querySelector('h2');
    if (!titleEl) throw new Error('Parsing failed — no report header found');

    // Period text lives in a text node after the h2; extract via regex on raw HTML
    const afterH2 = html.slice(html.indexOf('</h2>') + 5, html.indexOf('</h2>') + 300);
    const periodMatch = afterH2.match(/summary of the pollen collected during ([^.<]+)\./);
    const period = periodMatch ? periodMatch[1].trim() : 'Latest Report';

    const dateMatch = titleEl.text.match(/Report for (.*)/);
    const displayDate = dateMatch ? `Location: ${dateMatch[1].trim()}` : 'Raleigh, NC';

    const allRows = root.querySelectorAll('table tr');
    const rows = allRows.filter(r => {
        const cells = r.querySelectorAll('td');
        return cells.length >= 4 && !r.text.includes('Pollen Type');
    });

    if (rows.length === 0) throw new Error('No pollen data rows found');

    const pollen = rows.map(row => {
        const cols = row.querySelectorAll('td');
        const type = cols[0].text.trim();
        const severity = cols[2].text.trim().toUpperCase();
        const concentration = parseFloat(cols[3].text.trim()) || 0;

        let severityLevel = 1;
        if (severity.includes('VERY HIGH')) severityLevel = 4;
        else if (severity.includes('HIGH')) severityLevel = 3;
        else if (severity.includes('MODERATE')) severityLevel = 2;

        return { type, count: concentration, severity, severityLevel, unit: 'grains/m³' };
    });

    // Extract tree species details from the 5th cell of the Trees row
    const treeRow = rows.find(r => r.text.includes('Trees'));
    let details = [];
    if (treeRow) {
        const cols = treeRow.querySelectorAll('td');
        const detailsText = cols[4] ? cols[4].text.trim() : '';
        if (detailsText && detailsText !== '&nbsp;' && detailsText !== '-') {
            details = detailsText.split(',').map(s => s.trim()).filter(s => s && s.length > 1);
        }
    }

    const treePollen = pollen.find(p => p.type === 'Trees');
    if (treePollen) treePollen.details = details;

    return {
        date: displayDate,
        period,
        lastUpdated: new Date().toISOString(),
        pollen,
        totalCount: pollen.reduce((acc, p) => acc + p.count, 0).toFixed(1),
    };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
        const response = await fetch(NC_DEQ_URL, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PollenTracker/1.0)' },
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return res.status(502).json({ error: `NC DEQ returned ${response.status}` });
        }

        const html = await response.text();
        const data = parsePollenHTML(html);

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');
        return res.status(200).json(data);
    } catch (err) {
        clearTimeout(timeout);
        console.error('nc-pollen handler error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch NC DEQ pollen data' });
    }
};
```

- [ ] **Step 2: Smoke-test locally with curl (requires `vercel dev` running in another terminal)**

```bash
curl http://localhost:3000/api/nc-pollen
```

Expected: JSON with `pollen` array containing Trees, Grasses, Weeds entries. Not an error object.

- [ ] **Step 3: Commit**

```bash
git add api/nc-pollen.js
git commit -m "Add /api/nc-pollen server-side route for NC DEQ pollen data"
```

---

## Task 3: Create `api/aqi.js`

Moves Open-Meteo AQI fetching server-side. Accepts `?lat=` and `?lon=` from the client. The `s-maxage=1800` header caches 30 minutes at the CDN edge — shared across all devices for the same city.

**Files:**
- Create: `api/aqi.js`

- [ ] **Step 1: Create the file with this exact content**

```js
module.exports = async function handler(req, res) {
    const { lat, lon } = req.query;

    if (!lat || !lon || isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
        return res.status(400).json({ error: 'Valid lat and lon query params required' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone&timezone=auto`;
        const response = await fetch(url);

        if (!response.ok) {
            return res.status(502).json({ error: `Open-Meteo returned ${response.status}` });
        }

        const json = await response.json();
        const current = json.current;

        const data = {
            aqi: Math.round(current.us_aqi || 0),
            pm25: current.pm2_5 != null ? current.pm2_5.toFixed(1) : '--',
            pm10: current.pm10 != null ? current.pm10.toFixed(1) : '--',
            no2: current.nitrogen_dioxide != null ? current.nitrogen_dioxide.toFixed(1) : '--',
            ozone: current.ozone != null ? current.ozone.toFixed(1) : '--',
            time: new Date(current.time).toLocaleString(),
        };

        res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900');
        return res.status(200).json(data);
    } catch (err) {
        console.error('aqi handler error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch AQI data' });
    }
};
```

- [ ] **Step 2: Smoke-test locally**

```bash
curl "http://localhost:3000/api/aqi?lat=35.7796&lon=-78.6382"
```

Expected: JSON with `aqi`, `pm25`, `pm10`, `no2`, `ozone`, `time` fields. No error object.

- [ ] **Step 3: Commit**

```bash
git add api/aqi.js
git commit -m "Add /api/aqi server-side route for Open-Meteo AQI data"
```

---

## Task 4: Rewrite `src/pollenService.js`

Strip everything except the thin client fetch to `/api/nc-pollen` and the two helper functions still used by `main.js` (`getDangerZoneLevel`). All proxy logic, `localStorage` caching, and `getCachedPollenData` are removed.

**Files:**
- Modify: `src/pollenService.js`

- [ ] **Step 1: Replace the entire file content**

```js
/**
 * Client-side pollen service — fetches from /api/nc-pollen (server-side cached)
 */

export async function fetchPollenData() {
    const response = await fetch('/api/nc-pollen');
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${response.status}`);
    }
    return response.json();
}

export function getDangerZoneLevel(pollenArray) {
    if (!pollenArray || pollenArray.length === 0) {
        return { label: 'UNKNOWN', class: 'safe', description: 'Unable to determine pollen levels.' };
    }

    const maxLevel = Math.max(...pollenArray.map(p => p.severityLevel));
    if (maxLevel >= 4) return { label: 'DANGER', class: 'danger', description: 'Extreme pollen levels! Stay indoors if possible.' };
    if (maxLevel === 3) return { label: 'CAUTION', class: 'caution', description: 'High pollen levels. Limit outdoor exposure.' };
    if (maxLevel === 2) return { label: 'MODERATE', class: 'moderate', description: 'Moderate pollen levels. Sensitive individuals should take care.' };
    return { label: 'SAFE', class: 'safe', description: 'Pollen levels are currently low.' };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pollenService.js
git commit -m "Simplify pollenService to call /api/nc-pollen — remove CORS proxies and localStorage cache"
```

---

## Task 5: Rewrite `src/aqiService.js`

Strip `CORS_PROXIES`, `fetchViaProxy`, `fetchPollenJSON`, and all `localStorage` caching. `fetchAQI` calls `/api/aqi`. `fetchCityPollen` calls `/api/pollen?zip=` with no fallback. Everything exported (`CITIES`, `getAQILevel`, `getCityAllergens`) is preserved unchanged.

**Files:**
- Modify: `src/aqiService.js`

- [ ] **Step 1: Replace the entire file content**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add src/aqiService.js
git commit -m "Rewrite aqiService to call server APIs — remove CORS proxies and localStorage cache"
```

---

## Task 6: Update `main.js`

Remove the `getCachedPollenData` import (it no longer exists) and the cache-fallback branch in `loadPollenData`. The hardcoded `fallbackData` stays as the last resort.

**Files:**
- Modify: `main.js:1` (import line)
- Modify: `main.js:530-547` (`loadPollenData` function)

- [ ] **Step 1: Update the import on line 1**

Change:
```js
import { fetchPollenData, getDangerZoneLevel, getCachedPollenData } from './src/pollenService.js';
```

To:
```js
import { fetchPollenData, getDangerZoneLevel } from './src/pollenService.js';
```

- [ ] **Step 2: Update `loadPollenData` to remove the cache branch**

Change:
```js
async function loadPollenData() {
    try {
        return await fetchPollenData();
    } catch (fetchError) {
        console.warn('Live fetch failed:', fetchError);

        // Try cache (even if stale)
        const cached = getCachedPollenData();
        if (cached) {
            console.log('Using cached data as fallback');
            return cached.data;
        }

        // Ultimate fallback: hardcoded sample data
        console.log('Using hardcoded fallback data');
        return { ...fallbackData, lastUpdated: new Date().toLocaleString() };
    }
}
```

To:
```js
async function loadPollenData() {
    try {
        return await fetchPollenData();
    } catch (fetchError) {
        console.warn('Live fetch failed, using hardcoded fallback:', fetchError);
        return { ...fallbackData, lastUpdated: new Date().toLocaleString() };
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "Remove getCachedPollenData usage from main.js"
```

---

## Task 7: Deploy and Verify

- [ ] **Step 1: Build locally to check for errors**

```bash
npm run build
```

Expected: build completes with no errors. Warnings about chunk sizes are acceptable.

- [ ] **Step 2: Deploy to Vercel**

```bash
git push origin main
```

Wait for the Vercel deployment to complete (check Vercel dashboard or watch for the deployment URL in the terminal).

- [ ] **Step 3: Verify `/api/nc-pollen` is live**

```bash
curl https://<your-vercel-url>/api/nc-pollen
```

Expected: JSON with `pollen` array, `date`, `period`, `totalCount`. Check the response headers include `x-vercel-cache: HIT` or `MISS` (confirming CDN is involved).

- [ ] **Step 4: Verify `/api/aqi` is live**

```bash
curl "https://<your-vercel-url>/api/aqi?lat=35.7796&lon=-78.6382"
```

Expected: JSON with numeric `aqi` value and `pm25`, `pm10`, `no2`, `ozone` fields.

- [ ] **Step 5: Cross-device accuracy check**

Open the app simultaneously on iPhone and Mac (hard-refresh both: Cmd+Shift+R on Mac, hold-reload on iPhone). Confirm pollen values and city data match exactly on both devices.

- [ ] **Step 6: Verify CDN cache is working (all devices should now get HIT)**

Wait ~30 seconds after first load, then reload on a second device. Check browser devtools Network tab: the `/api/nc-pollen` response should include `x-vercel-cache: HIT`, confirming the CDN served a shared cached response.
