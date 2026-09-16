const { parse } = require('node-html-parser');

const NC_DEQ_URL = 'https://xapps.ncdenr.org/aq/ambient/Pollen.jsp';
const FETCH_TIMEOUT = 15000;

// NC DEQ reports severity as one of these labels, followed by the grain range
// in parentheses, e.g. "HIGH (61 - 600 grains)".
const SEVERITY_LEVELS = {
    'ABSENT': 1,
    'NONE': 1,
    'TRACE': 1,
    'VERY LOW': 1,
    'LOW': 1,
    'LOW-MODERATE': 2,
    'MODERATE': 2,
    'HIGH': 3,
    'VERY HIGH': 4,
};

function normalize(text) {
    return String(text).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Returns null for a label we do not recognize. The caller marks that single
 * row unavailable rather than discarding the whole report — one odd cell must
 * not cost Raleigh its measured data — but a report where nothing parses still
 * throws.
 */
function parseSeverity(raw) {
    const label = normalize(raw).split('(')[0].trim().toUpperCase();
    const severityLevel = SEVERITY_LEVELS[label];
    if (!severityLevel) {
        console.warn(`Unrecognized NC DEQ severity label: "${label}"`);
        return null;
    }
    return { severity: label, severityLevel };
}

// "Weeds" in a row header vs "Weed" in the comment footer should still match.
function speciesKey(word) {
    return normalize(word).toLowerCase().replace(/s$/, '');
}

// Matched explicitly rather than by stripping a plural suffix: "grass" and
// "grasses" both need to land on Grasses, and no single strip rule does that
// without also turning "trees" into "tre".
const TYPE_ALIASES = {
    tree: 'Trees', trees: 'Trees',
    grass: 'Grasses', grasses: 'Grasses',
    weed: 'Weeds', weeds: 'Weeds',
};

function canonicalType(word) {
    return TYPE_ALIASES[normalize(word).toLowerCase()] || null;
}

// "maple" -> "Maple", "sweet gum" -> "Sweet Gum". NC DEQ is inconsistent about
// capitalising species, sometimes within a single line.
function titleCase(name) {
    return name.replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function splitSpecies(text) {
    return normalize(text)
        .replace(/\.\s*$/, '')
        .split(/,|\sand\s|\s&\s/i)
        .map(part => normalize(part))
        .filter(Boolean)
        .map(titleCase);
}

// NC DEQ words the comment footer differently through the year. All four of
// these are real, pulled from their own archive:
//
//   "Predominant Pollen: Weeds (Ragweed, Pigweed, Urtica)"   2026-09-15
//   "Predominant Pollen (Trees): Maple, oak, pine, walnut"   2026-03-20
//   "Predominant Tree Pollen: Oak, Pine and Sycamore"        2026-04-15
//   "Predominant Pollen (Grasses)."                          2026-06-15
//
// Order matters: the more specific patterns must be tried before the bare
// "(Type)" catch. Anything matching none of them yields no species at all —
// never a guess, which is what the old hardcoded allergen lists did.
const COMMENT_PATTERNS = [
    /Predominant\s+Pollen\s*:\s*(Trees?|Grasses?|Weeds?)\s*\(([^)]*)\)/i,
    /Predominant\s+Pollen\s*\(\s*(Trees?|Grasses?|Weeds?)\s*\)\s*:\s*(.+)/i,
    /Predominant\s+(Tree|Grass|Weed)s?\s+Pollen\s*:\s*(.+)/i,
    /Predominant\s+Pollen\s*\(\s*(Trees?|Grasses?|Weeds?)\s*\)/i,
];

/**
 * Read the comment footer into { predominant, speciesByType }.
 * NC DEQ names species only for the predominant type, so at most one type
 * carries a species list on any given day.
 */
function parseComment(tableText) {
    const empty = { predominant: null, speciesByType: {} };

    const commentMatch = tableText.match(/Comments:(.*)$/i);
    if (!commentMatch) return empty;
    const text = normalize(commentMatch[1]);

    for (const pattern of COMMENT_PATTERNS) {
        const match = text.match(pattern);
        if (!match) continue;

        const type = canonicalType(match[1]);
        if (!type) continue;

        const species = match[2] ? splitSpecies(match[2]) : [];
        return {
            predominant: type,
            speciesByType: species.length > 0 ? { [speciesKey(type)]: species } : {},
        };
    }

    return empty;
}

function parsePollenHTML(html) {
    const root = parse(html);

    const heading = root.querySelector('h1') || root.querySelector('h2');
    if (!heading) throw new Error('Parsing failed — no report header found');

    const locationMatch = normalize(heading.text).match(/Pollen Report for (.+)$/i);
    const location = locationMatch ? locationMatch[1].trim() : 'Raleigh, NC';

    const table = root.querySelector('table.pollen-table') || root.querySelector('table');
    if (!table) throw new Error('Parsing failed — pollen table not found');

    const mainText = normalize((root.querySelector('main') || root).text);
    const periodMatch = mainText.match(/summary of the pollen collected during (.+?)\./i);
    const period = periodMatch ? periodMatch[1].trim() : 'Latest Report';

    // The report date lives in the hidden form input the date picker submits.
    const dateInput = root.querySelector('#date');
    const reportDate = dateInput ? dateInput.getAttribute('value') || null : null;

    // Each data row is <th scope="row">Type</th> followed by three <td> cells:
    // raw grain count, severity, and concentration in grains/m3.
    const dataRows = table.querySelectorAll('tbody tr').filter(row => {
        return row.querySelector('th') && row.querySelectorAll('td').length >= 3;
    });

    if (dataRows.length === 0) {
        throw new Error('No pollen data rows found — NC DEQ page structure may have changed');
    }

    const tableText = normalize(table.text);
    const { predominant, speciesByType } = parseComment(tableText);

    const pollen = dataRows.map(row => {
        const cells = row.querySelectorAll('td');
        const type = normalize(row.querySelector('th').text);
        const grainCount = parseInt(normalize(cells[0].text), 10);
        const parsed = parseSeverity(cells[1].text);
        const count = parseFloat(normalize(cells[2].text));
        const usable = parsed !== null && Number.isFinite(count);

        return {
            type,
            count: usable ? count : null,
            grainCount: Number.isFinite(grainCount) ? grainCount : null,
            severity: usable ? parsed.severity : null,
            severityLevel: usable ? parsed.severityLevel : null,
            available: usable,
            unit: 'grains/m³',
            details: speciesByType[speciesKey(type)] || [],
        };
    });

    if (pollen.every(p => !p.available)) {
        throw new Error('No pollen row could be read — NC DEQ page structure may have changed');
    }

    // Prefer the total NC DEQ prints over summing the column — they round it themselves.
    const totalMatch = tableText.match(/Total Pollen Count for this Reporting Period:\s*([\d.]+)/i);
    const totalCount = totalMatch
        ? totalMatch[1]
        : pollen.reduce((acc, p) => acc + (p.count || 0), 0).toFixed(1);

    return {
        source: 'NC DEQ',
        sourceUrl: NC_DEQ_URL,
        measured: true,
        date: `Location: ${location}`,
        location,
        reportDate,
        period,
        lastUpdated: new Date().toISOString(),
        pollen,
        totalCount,
        predominant,
        unit: 'grains/m³',
    };
}

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
        const response = await fetch(NC_DEQ_URL, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PollenTracker/1.0)' },
        });
        if (!response.ok) {
            return res.status(502).json({ error: `NC DEQ returned ${response.status}` });
        }

        const html = await response.text();
        const data = parsePollenHTML(html);

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');
        return res.status(200).json(data);
    } catch (err) {
        console.error('nc-pollen handler error:', err.message);
        return res.status(502).json({ error: `Failed to read NC DEQ pollen report: ${err.message}` });
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = handler;
module.exports.parsePollenHTML = parsePollenHTML;
