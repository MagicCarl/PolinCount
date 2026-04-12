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
