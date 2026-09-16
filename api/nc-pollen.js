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

/**
 * Pull species names out of the report's comment footer, which reads e.g.
 * "Comments: Predominant Pollen: Weeds (Ragweed, Pigweed, Urtica)".
 * Returns a map of pollen type -> species array.
 */
function parseSpeciesByType(tableText) {
    const species = {};
    const commentMatch = tableText.match(/Comments:(.*)$/i);
    if (!commentMatch) return species;

    const re = /([A-Za-z]+)\s*\(([^)]+)\)/g;
    let match;
    while ((match = re.exec(commentMatch[1])) !== null) {
        const names = match[2]
            .split(',')
            .map(s => normalize(s))
            .filter(Boolean);
        if (names.length > 0) species[speciesKey(match[1])] = names;
    }
    return species;
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
    const speciesByType = parseSpeciesByType(tableText);

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

    const predominantMatch = tableText.match(/Predominant Pollen:\s*([^(]+)/i);

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
        predominant: predominantMatch ? normalize(predominantMatch[1]) : null,
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
