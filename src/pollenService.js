/**
 * Service to fetch and parse North Carolina pollen data
 */

const NC_DEQ_POLLEN_URL = 'https://xapps.ncdenr.org/aq/ambient/Pollen.jsp';

// Multiple proxies for redundancy — each handled per its response format
const PROXIES = [
    { url: 'https://api.allorigins.win/get?url=', type: 'json' },
    { url: 'https://corsproxy.io/?', type: 'text' },
    { url: 'https://api.codetabs.com/v1/proxy?quest=', type: 'text' },
];

const CACHE_KEY = 'nc_pollen_data_cache';
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const FETCH_TIMEOUT = 10000; // 10 seconds — generous for free proxies
const MAX_RETRIES = 2;

/**
 * Fetch with timeout helper
 */
async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

/**
 * Get cached data if valid
 */
export function getCachedPollenData() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        if (!data || !data.pollen) return null;

        const isExpired = Date.now() - timestamp > CACHE_TTL;
        return { data, isStale: isExpired };
    } catch (e) {
        return null;
    }
}

/**
 * Parse the NC DEQ pollen HTML page into structured data
 */
function parsePollenHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const titleEl = doc.querySelector('h2');
    if (!titleEl) throw new Error('Parsing failed — no report header found');

    const periodText = titleEl.nextSibling?.textContent?.trim() || '';
    const periodMatch = periodText.match(/summary of the pollen collected during (.*)\./);
    const period = periodMatch ? periodMatch[1] : 'Latest Report';

    const dateMatch = titleEl.textContent.match(/Report for (.*)/);
    const displayDate = dateMatch ? `Location: ${dateMatch[1]}` : 'Raleigh, NC';

    const rows = Array.from(doc.querySelectorAll('table tr'))
        .filter(r => r.cells.length >= 4 && !r.textContent.includes('Pollen Type'));

    if (rows.length === 0) throw new Error('No pollen data rows found');

    const pollen = rows.map(row => {
        const cols = row.querySelectorAll('td');
        const type = cols[0].textContent.trim();
        const severity = cols[2].textContent.trim().toUpperCase();
        const concentration = parseFloat(cols[3].textContent.trim()) || 0;

        let severityLevel = 1;
        if (severity.includes('VERY HIGH')) severityLevel = 4;
        else if (severity.includes('HIGH')) severityLevel = 3;
        else if (severity.includes('MODERATE')) severityLevel = 2;

        return { type, count: concentration, severity, severityLevel, unit: 'grains/m³' };
    });

    // Extract tree species details
    const treeRow = rows.find(r => r.textContent.includes('Trees'));
    let details = [];
    if (treeRow) {
        const detailsText = treeRow.querySelectorAll('td')[4]?.textContent.trim();
        if (detailsText && detailsText !== '&nbsp;' && detailsText !== '-') {
            details = detailsText.split(',').map(s => s.trim()).filter(s => s && s.length > 1);
        }
    }

    const treePollen = pollen.find(p => p.type === 'Trees');
    if (treePollen) treePollen.details = details;

    return {
        date: displayDate,
        period,
        lastUpdated: new Date().toLocaleString(),
        pollen,
        totalCount: pollen.reduce((acc, p) => acc + p.count, 0).toFixed(1)
    };
}

/**
 * Fetch HTML from a single proxy, handling its specific response format
 */
async function fetchFromProxy(proxy) {
    const url = proxy.type === 'json'
        ? `${proxy.url}${encodeURIComponent(NC_DEQ_POLLEN_URL)}`
        : `${proxy.url}${NC_DEQ_POLLEN_URL}`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`Proxy returned status ${response.status}`);

    let html;
    if (proxy.type === 'json') {
        const data = await response.json();
        html = data.contents;
    } else {
        html = await response.text();
    }

    if (!html || typeof html !== 'string' || html.length < 100) {
        throw new Error('Proxy returned empty or invalid content');
    }

    return html;
}

/**
 * Attempt to fetch pollen data with retry logic
 */
export async function fetchPollenData() {
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        // On retry, wait briefly before trying again
        if (attempt > 0) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }

        // Race all proxies — first successful one wins
        const fetchPromises = PROXIES.map(async (proxy) => {
            const html = await fetchFromProxy(proxy);
            return parsePollenHTML(html);
        });

        try {
            const result = await Promise.any(fetchPromises);

            // Cache the successful result
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: result,
                timestamp: Date.now()
            }));

            return result;
        } catch (aggregateError) {
            lastError = aggregateError;
            console.warn(`Fetch attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, aggregateError);
        }
    }

    console.error('All fetch attempts exhausted:', lastError);
    throw new Error('Unable to load pollen data. Please check your connection and try again.');
}

export function getDangerZoneLevel(pollenArray) {
    if (!pollenArray || pollenArray.length === 0) {
        return { label: 'UNKNOWN', class: 'safe', description: 'Unable to determine pollen levels.' };
    }

    const maxLevel = Math.max(...pollenArray.map(p => p.severityLevel));
    if (maxLevel >= 4) return { label: "DANGER", class: "danger", description: "Extreme pollen levels! Stay indoors if possible." };
    if (maxLevel === 3) return { label: "CAUTION", class: "caution", description: "High pollen levels. Limit outdoor exposure." };
    if (maxLevel === 2) return { label: "MODERATE", class: "moderate", description: "Moderate pollen levels. Sensitive individuals should take care." };
    return { label: "SAFE", class: "safe", description: "Pollen levels are currently low." };
}
