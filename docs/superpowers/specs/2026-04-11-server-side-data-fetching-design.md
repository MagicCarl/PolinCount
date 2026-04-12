# Server-Side Data Fetching — Design Spec

**Date:** 2026-04-11
**Status:** Approved

## Problem

Pollen and AQI data differs between devices (iPhone vs Mac) even when loaded at the same time. Root causes:

1. **NC DEQ pollen** (`pollenService.js`) fetches HTML via three random CORS proxies from the browser. Each proxy has its own cache and may return different (or stale) data. Whichever proxy wins the race determines what the user sees — and the winning proxy may differ by device/network.
2. **City pollen** (`aqiService.js`) already tries `/api/pollen` server-side but falls back to the same CORS proxies when it fails.
3. **AQI** (`aqiService.js`) fetches Open-Meteo directly from the browser.
4. All three use `localStorage` to cache results per-device. Two devices caching the same data at different times will diverge for up to an hour.

## Solution

Move all data fetching to server-side Vercel API routes with CDN cache headers (`s-maxage`). The Vercel CDN caches one response per unique URL and serves it identically to all devices worldwide. Per-device `localStorage` caching is removed entirely.

## Architecture

```text
Browser (any device)
  └── fetch('/api/nc-pollen')           → Vercel CDN (s-maxage=3600)
        └── Vercel Function              → NC DEQ HTML page (direct, no proxy)

  └── fetch('/api/pollen?zip=ZIP')      → Vercel CDN (s-maxage=3600)
        └── Vercel Function              → pollen.com API (already exists, no change)

  └── fetch('/api/aqi?lat=LAT&lon=LON') → Vercel CDN (s-maxage=1800)
        └── Vercel Function              → Open-Meteo API (direct)
```

CDN cache is keyed by URL, so each city gets its own cache slot:

- `/api/pollen?zip=27601` → Raleigh (shared by all devices)
- `/api/pollen?zip=75201` → Dallas (shared by all devices)
- `/api/aqi?lat=35.77&lon=-78.63` → Raleigh AQI (shared by all devices)
- ...20 cities total, each independently cached

## Files Changed

### New: `api/nc-pollen.js`

- Fetches `https://xapps.ncdenr.org/aq/ambient/Pollen.jsp` directly server-side (no CORS issue)
- Contains HTML parsing logic moved from `src/pollenService.js`
- Returns structured JSON matching the existing shape `{ date, period, lastUpdated, pollen[], totalCount }`
- Sets `Cache-Control: s-maxage=3600, stale-while-revalidate=1800`
- Returns 500 with `{ error }` on failure

### New: `api/aqi.js`

- Accepts `?lat=` and `?lon=` query params
- Fetches Open-Meteo `air-quality` endpoint server-side
- Returns `{ aqi, pm25, pm10, no2, ozone, time }` (no city/state — client adds those from its own `CITIES` list)
- Sets `Cache-Control: s-maxage=1800, stale-while-revalidate=900`
- Returns 400 on missing params, 500 on fetch failure

### Updated: `src/pollenService.js`

- Remove `PROXIES`, `fetchFromProxy`, `fetchWithTimeout`, proxy race logic
- Remove `CACHE_KEY`, `CACHE_TTL`, `getCachedPollenData`, `localStorage` usage
- `fetchPollenData()` becomes: `fetch('/api/nc-pollen')` → parse JSON → return data
- `getCachedPollenData` export removed (callers in `main.js` updated accordingly)

### Updated: `src/aqiService.js`

- Remove `CORS_PROXIES`, `fetchViaProxy`, `AQI_CACHE_KEY`, `POLLEN_CACHE_KEY`, `AQI_CACHE_TTL`, `POLLEN_CACHE_TTL`
- Remove `getCached`, `setCache`, all `localStorage` usage
- `fetchAQI(city)` → `fetch('/api/aqi?lat=${city.lat}&lon=${city.lon}')` → merge city/state from caller → return
- `fetchCityPollen(city)` → `fetch('/api/pollen?zip=${city.zip}')` → parse and return (no proxy fallback)
- Remove `fetchPollenJSON` and `fetchViaProxy` helpers entirely

### Updated: `main.js`

- Remove import of `getCachedPollenData`
- In `loadPollenData()`: remove the `getCachedPollenData()` fallback branch (keep hardcoded `fallbackData` as last resort)
- No other behavioral changes

## Cache Strategy

| Route | s-maxage | stale-while-revalidate | Rationale |
|---|---|---|---|
| `/api/nc-pollen` | 3600s (1hr) | 1800s | NC DEQ updates once daily |
| `/api/pollen?zip=` | 3600s (1hr) | 1800s | Already set, no change |
| `/api/aqi?lat=&lon=` | 1800s (30min) | 900s | AQI updates more frequently |

## Error Handling

- API routes return `{ error: string }` with appropriate HTTP status codes
- Client shows existing error UI when any fetch fails (no behavioral change)
- No retry logic needed on client — Vercel's `stale-while-revalidate` handles transient upstream failures transparently

## Out of Scope

- Changing the data sources (NC DEQ, pollen.com, Open-Meteo)
- Changing the UI or how data is displayed
- Adding new cities
- Upstash Redis caching (CDN caching is sufficient)
