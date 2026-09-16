const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function redisCommand(...args) {
    const res = await fetch(`${UPSTASH_URL}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
    });
    return res.json();
}

async function sendEmail(to, subject, html) {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'PollenTracker <onboarding@resend.dev>', to, subject, html }),
    });
    return res.json();
}

function getAQILabel(aqi) {
    if (aqi <= 50) return { label: 'Good', color: '#22c55e' };
    if (aqi <= 100) return { label: 'Moderate', color: '#eab308' };
    if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: '#f97316' };
    if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' };
    return { label: 'Very Unhealthy', color: '#7c3aed' };
}

const { UPI_CATEGORY, UPI_TO_SEVERITY_LEVEL, calculateBreathableScore } = require('../_lib/upi.js');

function pollenSeverityLabel(upi) {
    return UPI_CATEGORY[upi] || 'Unknown';
}

async function geocodeZip(zip) {
    try {
        const res = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zip)}&count=1&countryCode=US&language=en&format=json`
        );
        if (!res.ok) return null;
        const json = await res.json();
        const loc = json.results?.[0];
        return loc ? { lat: loc.latitude, lon: loc.longitude } : null;
    } catch {
        return null;
    }
}

/**
 * Per-type pollen from the Google Pollen API — the same source the site uses.
 * Returns null when it cannot be read, so the caller skips rather than
 * emailing a number it did not actually retrieve.
 */
async function fetchPollen(lat, lon) {
    const apiKey = process.env.GOOGLE_POLLEN_API_KEY;
    if (!apiKey) return null;

    try {
        const url = `https://pollen.googleapis.com/v1/forecast:lookup?key=${apiKey}`
            + `&location.latitude=${lat}&location.longitude=${lon}`
            + '&days=1&languageCode=en&plantsDescription=false';
        const res = await fetch(url);
        if (!res.ok) return null;

        const json = await res.json();
        const daily = json.dailyInfo?.[0];
        if (!daily) return null;

        const types = daily.pollenTypeInfo || [];
        const upi = Math.max(0, ...types.map(t => t.indexInfo?.value ?? 0));
        const triggers = types
            .filter(t => (t.indexInfo?.value ?? 0) > 0)
            .map(t => `${t.displayName} (${t.indexInfo.category})`);

        return { upi, severityLevel: UPI_TO_SEVERITY_LEVEL[upi] || 1, triggers };
    } catch {
        return null;
    }
}

async function fetchAQIData(lat, lon) {
    try {
        const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`);
        if (!res.ok) return null;
        const json = await res.json();
        return json.current?.us_aqi ?? null;
    } catch {
        return null;
    }
}

function buildEmailHTML(zip, pollen, aqi, breathableScore, unsubscribeUrl) {
    const aqiInfo = aqi !== null ? getAQILabel(aqi) : { label: 'Unavailable', color: '#94a3b8' };
    const pollenLevel = pollenSeverityLabel(pollen.upi);
    const scoreColor = breathableScore >= 7 ? '#22c55e' : breathableScore >= 4 ? '#eab308' : '#ef4444';
    const triggers = pollen.triggers?.slice(0, 5).join(', ') || 'None detected';

    return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:500px;margin:0 auto;background:#1e293b;color:#e2e8f0;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px;text-align:center;">
            <h1 style="margin:0;font-size:22px;color:#0f172a;">Pollen & Air Quality Alert</h1>
            <p style="margin:4px 0 0;color:#451a03;font-size:14px;">Zip Code: ${zip}</p>
        </div>
        <div style="padding:24px;">
            <div style="text-align:center;margin-bottom:20px;">
                <div style="font-size:14px;color:#94a3b8;margin-bottom:8px;">Breathable Score</div>
                <div style="display:inline-block;width:64px;height:64px;border-radius:50%;border:3px solid ${scoreColor};line-height:64px;font-size:28px;font-weight:bold;color:${scoreColor};">${breathableScore}</div>
                <div style="font-size:12px;color:#64748b;margin-top:4px;">/10</div>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <tr>
                    <td style="padding:12px;background:#334155;border-radius:8px 8px 0 0;">
                        <div style="font-size:12px;color:#94a3b8;">Pollen Level</div>
                        <div style="font-size:18px;font-weight:bold;color:#f59e0b;">${pollenLevel} (${pollen.upi}/5 UPI)</div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:12px;background:#334155;">
                        <div style="font-size:12px;color:#94a3b8;">Air Quality</div>
                        <div style="font-size:18px;font-weight:bold;color:${aqiInfo.color};">${aqiInfo.label}${aqi !== null ? ` (AQI ${aqi})` : ''}</div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:12px;background:#334155;border-radius:0 0 8px 8px;">
                        <div style="font-size:12px;color:#94a3b8;">Active Pollen Types</div>
                        <div style="font-size:14px;color:#e2e8f0;">${triggers}</div>
                    </td>
                </tr>
            </table>
            <p style="font-size:11px;color:#64748b;text-align:center;margin:12px 0 0;">
                Forecast from the Google Pollen API (UPI 0-5). The site may show
                measured grain counts where a local monitoring station is available.
            </p>
            <p style="font-size:12px;color:#64748b;text-align:center;margin:16px 0 0;">
                <a href="https://nc-pollen-tracker.vercel.app" style="color:#f59e0b;">View Full Report</a>
                &nbsp;|&nbsp;
                <a href="${unsubscribeUrl}" style="color:#64748b;">Unsubscribe</a>
            </p>
        </div>
    </div>`;
}

module.exports = async function handler(req, res) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await redisCommand('SMEMBERS', 'subscribers');
    const emails = result?.result || [];
    if (!emails || emails.length === 0) {
        return res.status(200).json({ message: 'No subscribers', sent: 0 });
    }

    let sent = 0;
    let skipped = 0;

    for (const email of emails) {
        try {
            const subResult = await redisCommand('HGETALL', `subscriber:${email}`);
            const fields = subResult?.result || [];
            if (!fields || fields.length === 0) continue;

            // HGETALL returns flat array: [key, value, key, value, ...]
            const subscriber = {};
            for (let i = 0; i < fields.length; i += 2) {
                subscriber[fields[i]] = fields[i + 1];
            }

            const { zip } = subscriber;
            if (!zip) continue;

            const coords = await geocodeZip(zip);
            if (!coords) {
                console.warn(`Skipping ${email}: could not geocode zip ${zip}`);
                skipped++;
                continue;
            }

            const [pollen, aqi] = await Promise.all([
                fetchPollen(coords.lat, coords.lon),
                fetchAQIData(coords.lat, coords.lon),
            ]);

            // Never email a score built on data we failed to fetch.
            if (!pollen) {
                console.warn(`Skipping ${email}: pollen data unavailable for ${zip}`);
                skipped++;
                continue;
            }

            const breathableScore = calculateBreathableScore(pollen.severityLevel, aqi);

            // Only send if conditions are concerning (breathable score <= 7)
            if (breathableScore > 7) {
                skipped++;
                continue;
            }

            const unsubscribeUrl = `https://nc-pollen-tracker.vercel.app/api/unsubscribe?email=${encodeURIComponent(email)}`;
            const html = buildEmailHTML(zip, pollen, aqi, breathableScore, unsubscribeUrl);

            await sendEmail(email, `Pollen Alert: Breathable Score ${breathableScore}/10 for ${zip}`, html);
            sent++;
        } catch (err) {
            console.error(`Failed to process ${email}:`, err);
        }
    }

    return res.status(200).json({ message: 'Alerts processed', sent, skipped, total: emails.length });
};
