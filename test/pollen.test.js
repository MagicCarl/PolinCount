const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { parsePollenHTML } = require('../api/nc-pollen.js');
const { buildPollenPayload } = require('../api/pollen.js');

const fixture = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'ncdeq-2026-09-15.html'),
    'utf8'
);

test('NC DEQ: parses every measured value from the live report', () => {
    const data = parsePollenHTML(fixture);
    const byType = Object.fromEntries(data.pollen.map(p => [p.type, p]));

    assert.strictEqual(data.pollen.length, 3);

    assert.deepStrictEqual(
        { count: byType.Grasses.count, severity: byType.Grasses.severity, level: byType.Grasses.severityLevel },
        { count: 23.4, severity: 'HIGH', level: 3 }
    );
    assert.deepStrictEqual(
        { count: byType.Trees.count, severity: byType.Trees.severity, level: byType.Trees.severityLevel },
        { count: 18.3, severity: 'MODERATE', level: 2 }
    );
    assert.deepStrictEqual(
        { count: byType.Weeds.count, severity: byType.Weeds.severity, level: byType.Weeds.severityLevel },
        { count: 38.5, severity: 'MODERATE', level: 2 }
    );

    assert.strictEqual(byType.Grasses.grainCount, 73);
    assert.strictEqual(byType.Weeds.grainCount, 120);
});

test('NC DEQ: uses the published total rather than re-summing the column', () => {
    // The column sums to 80.2; NC DEQ publishes 80.1.
    assert.strictEqual(parsePollenHTML(fixture).totalCount, '80.1');
});

test('NC DEQ: reads species and predominant type from the comment footer', () => {
    const data = parsePollenHTML(fixture);
    const weeds = data.pollen.find(p => p.type === 'Weeds');
    assert.deepStrictEqual(weeds.details, ['Ragweed', 'Pigweed', 'Urtica']);
    assert.strictEqual(data.predominant, 'Weeds');
});

test('NC DEQ: captures location, report date and period', () => {
    const data = parsePollenHTML(fixture);
    assert.strictEqual(data.location, 'Raleigh, NC');
    assert.strictEqual(data.reportDate, '09/15/2026');
    assert.match(data.period, /September 14, 2026 - .*September 15, 2026/);
    assert.strictEqual(data.measured, true);
});

test('NC DEQ: throws loudly when the page structure changes', () => {
    assert.throws(() => parsePollenHTML('<html><body><p>Down for maintenance</p></body></html>'), /no report header found/);
    assert.throws(
        () => parsePollenHTML('<html><body><h1>Pollen Report for Raleigh, NC</h1></body></html>'),
        /pollen table not found/
    );
});

test('NC DEQ: an unreadable severity marks only that row unavailable', () => {
    const mangled = fixture.replace('HIGH (61 - 600 grains)', 'EXTREME (61 - 600 grains)');
    const data = parsePollenHTML(mangled);
    const byType = Object.fromEntries(data.pollen.map(p => [p.type, p]));

    // The bad row must not be guessed at...
    assert.strictEqual(byType.Grasses.available, false);
    assert.strictEqual(byType.Grasses.severityLevel, null);
    assert.strictEqual(byType.Grasses.count, null);
    // ...and must not cost us the rows that did parse.
    assert.strictEqual(byType.Trees.count, 18.3);
    assert.strictEqual(byType.Weeds.count, 38.5);
});

test('NC DEQ: throws when no row can be read at all', () => {
    const mangled = fixture.replace(/(HIGH|MODERATE) \(/g, 'EXTREME (');
    assert.throws(() => parsePollenHTML(mangled), /No pollen row could be read/);
});

test('NC DEQ: matches footer species to rows despite singular/plural wording', () => {
    const singular = fixture.replace('Predominant Pollen: Weeds (', 'Predominant Pollen: Weed (');
    const weeds = parsePollenHTML(singular).pollen.find(p => p.type === 'Weeds');
    assert.deepStrictEqual(weeds.details, ['Ragweed', 'Pigweed', 'Urtica']);
});

test('Google: maps each pollen type to its own real index', () => {
    const pollen = buildPollenPayload({
        pollenTypeInfo: [
            { code: 'TREE', inSeason: false, indexInfo: { value: 0, category: 'None' } },
            { code: 'GRASS', inSeason: true, indexInfo: { value: 3, category: 'Moderate' } },
            { code: 'WEED', inSeason: true, indexInfo: { value: 5, category: 'Very High' } },
        ],
        plantInfo: [],
    });

    assert.deepStrictEqual(
        pollen.map(p => [p.type, p.count, p.severity, p.severityLevel]),
        [
            ['Trees', 0, 'NONE', 1],
            ['Grasses', 3, 'MODERATE', 2],
            ['Weeds', 5, 'VERY HIGH', 4],
        ]
    );
});

test('Google: a type the provider omits is unknown, never a reassuring zero', () => {
    // Regression guard: rendering an absent type as 0/NONE produces a false
    // "SAFE ZONE" and a 10/10 score built on data we never received.
    const pollen = buildPollenPayload({ pollenTypeInfo: [], plantInfo: [] });
    assert.deepStrictEqual(pollen.map(p => p.type), ['Trees', 'Grasses', 'Weeds']);
    assert.ok(pollen.every(p => p.available === false), 'all types should be unavailable');
    assert.ok(pollen.every(p => p.count === null && p.severityLevel === null));
});

test('Google: distinguishes out-of-season (real zero) from absent (unknown)', () => {
    const pollen = buildPollenPayload({
        pollenTypeInfo: [{ code: 'TREE', inSeason: false }],  // present, no index -> real 0
        plantInfo: [],
    });
    const trees = pollen.find(p => p.type === 'Trees');
    const weeds = pollen.find(p => p.type === 'Weeds');       // absent entirely -> unknown

    assert.deepStrictEqual([trees.available, trees.count, trees.severityLevel], [true, 0, 1]);
    assert.deepStrictEqual([weeds.available, weeds.count, weeds.severityLevel], [false, null, null]);
});

test('Google: lists only species actually reported present', () => {
    const pollen = buildPollenPayload({
        pollenTypeInfo: [{ code: 'WEED', inSeason: true, indexInfo: { value: 4, category: 'High' } }],
        plantInfo: [
            { code: 'RAGWEED', displayName: 'Ragweed', inSeason: true, indexInfo: { value: 4 }, plantDescription: { type: 'WEED' } },
            { code: 'MUGWORT', displayName: 'Mugwort', inSeason: false, indexInfo: { value: 0 }, plantDescription: { type: 'WEED' } },
            { code: 'OAK', displayName: 'Oak', inSeason: true, indexInfo: { value: 2 }, plantDescription: { type: 'TREE' } },
        ],
    });

    const weeds = pollen.find(p => p.type === 'Weeds');
    // Mugwort is out of season with a zero index, so it must not be listed.
    assert.deepStrictEqual(weeds.details, ['Ragweed']);
    assert.deepStrictEqual(pollen.find(p => p.type === 'Trees').details, ['Oak']);
});

test('Google: never fabricates a per-type number from a blended index', () => {
    // Regression guard for the old index*0.6 / index*0.4 invention.
    const pollen = buildPollenPayload({
        pollenTypeInfo: [
            { code: 'TREE', inSeason: true, indexInfo: { value: 4, category: 'High' } },
            { code: 'GRASS', inSeason: false },
            { code: 'WEED', inSeason: false },
        ],
        plantInfo: [],
    });
    assert.strictEqual(pollen.find(p => p.type === 'Grasses').count, 0);
    assert.strictEqual(pollen.find(p => p.type === 'Weeds').count, 0);
});

const { isAllowedLocation, calculateBreathableScore, CITIES } = require('../api/_lib/upi.js');

test('location allowlist: accepts the app cities and rejects everything else', () => {
    for (const city of CITIES) {
        assert.ok(isAllowedLocation(String(city.lat), String(city.lon)), `${city.name} should be allowed`);
    }
    // Walking coordinates to bypass the edge cache and run up API billing.
    assert.ok(!isAllowedLocation('35.7797', '-78.6382'));
    assert.ok(!isAllowedLocation('0', '0'));
    assert.ok(!isAllowedLocation('12abc', '5'));
    assert.ok(!isAllowedLocation('999', '999'));
    assert.ok(!isAllowedLocation(undefined, undefined));
});

test('breathable score: email and site use one shared implementation', () => {
    // Mirrors computeBreathableScore() in main.js.
    assert.strictEqual(calculateBreathableScore(1, 10), 10);
    assert.strictEqual(calculateBreathableScore(4, 10), 6);
    assert.strictEqual(calculateBreathableScore(4, 250), 2);
    assert.strictEqual(calculateBreathableScore(1, null), 10);
    assert.strictEqual(calculateBreathableScore(3, 120), 6);
});

test('city list is the single source shared with the client', () => {
    const client = fs.readFileSync(path.join(__dirname, '..', 'src', 'aqiService.js'), 'utf8');
    assert.match(client, /from '\.\.\/api\/_lib\/cities\.json'/);
    assert.strictEqual(CITIES.length, 20);
    assert.strictEqual(CITIES.filter(c => c.preferNcDeq).length, 1);
});
