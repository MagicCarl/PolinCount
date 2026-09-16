# Where the numbers come from

Every value shown in the app is read from a provider. Nothing is estimated,
interpolated, or filled in from a hardcoded list. If a provider cannot be
reached, the app says so instead of showing a substitute.

## Sources

| Source | Used for | Unit | Kind |
|---|---|---|---|
| NC DEQ (`/api/nc-pollen`) | Raleigh, NC | grains/m³ | Measured — grains counted in a 24-hour air sample |
| Google Pollen API (`/api/pollen`) | All other cities | UPI 0–5 | Forecast — modelled index |
| Open-Meteo (`/api/aqi`) | Air quality, all cities | US AQI | Measured/modelled blend |

Raleigh prefers NC DEQ because those are physically counted grains. If NC DEQ
is unreachable, Raleigh falls back to the Google forecast and the UI relabels
itself from "Measured" to "Forecast".

The two pollen units are **not** interchangeable and are never mixed. The unit
travels with every value and is displayed on each card. `severityLevel` (1–4)
is normalized by the server for both sources, which is what drives the danger
badge and Breathable Score.

## Setup

`GOOGLE_POLLEN_API_KEY` must be set for the 19 non-Raleigh cities:

```
vercel env add GOOGLE_POLLEN_API_KEY production
vercel env add GOOGLE_POLLEN_API_KEY preview
vercel env pull .env.local --yes    # to run locally
```

The command reads the value from the prompt — do not pass it as `NAME=value`.

Enable the **Pollen API** in Google Cloud first. Responses are cached
server-side for one hour (`s-maxage=3600`), so usage stays well inside the
free tier.

## Things that are deliberately absent

These were removed because they produced plausible-looking but false output:

- **Invented per-type splits.** The old code derived grass and weed numbers as
  `overallIndex × 0.6` and `× 0.4` from a single blended index. Those
  multipliers had no basis in the source data.
- **Hardcoded species lists.** Per-city "common allergens" arrays were rendered
  identically to real detections, so Raleigh listed oak and pine in September
  while the actual predominant pollen was ragweed. Species are now shown only
  when a provider reports them.
- **Silent stale fallback.** A failed fetch used to return a hardcoded March
  2026 snapshot stamped with the current time. Failures are now visible.

## Upstream fragility

NC DEQ is scraped from HTML, so a redesign will break it — this already
happened once, when the page moved to `<h1>` and `<th scope="row">` markup.
`test/pollen.test.js` pins the parser against a saved fixture and asserts it
throws on unexpected structure, so the next redesign fails loudly.

Refresh the fixture with:

```
curl -A 'Mozilla/5.0 (compatible; PollenTracker/1.0)' \
  https://xapps.ncdenr.org/aq/ambient/Pollen.jsp \
  -o test/fixtures/ncdeq-$(date +%F).html
```

## "No data" is a real state

A pollen type the provider did not report is shown as **"No data reported"**,
not as zero. An absent reading rendered as `0 / NONE` produces a false SAFE
badge and a 10/10 Breathable Score built on data that was never received —
the same failure class as the original always-zero weeds bug. Unreported types
carry `severityLevel: null` and are excluded from the danger badge, the
Breathable Score and the health guidance.

For NC DEQ, one unreadable cell marks only that row unavailable; the report
still renders the rows that parsed. Only a report where *nothing* parses fails
the whole request.

## Route protection

`/api/pollen` is public and Google's Pollen API is metered, so the route
validates `lat`/`lon` against the 20 known city coordinates
(`api/_lib/cities.json`, shared with the client). Arbitrary coordinates are
rejected, which also stops cache-busting by walking the coordinate space. The
API key is sent as an `X-Goog-Api-Key` header rather than a query parameter so
it does not land in request logs.
