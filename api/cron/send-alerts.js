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

function pollenSeverityLabel(index) {
    if (index >= 9.7) return 'Very High';
    if (index >= 7.3) return 'High';
    if (index >= 4.9) return 'Moderate';
    if (index >= 2.5) return 'Low-Moderate';
    return 'Low';
}

function calculateBreathableScore(pollenIndex, aqi) {
    const pollenScore = Math.max(0, 10 - (pollenIndex / 12) * 10);
    const aqiScore = Math.max(0, 10 - (aqi / 300) * 10);
    return Math.round(pollenScore * 0.6 + aqiScore * 0.4);
}

async function fetchPollenData(zip) {
    try {
        const response = await fetch(
            `https://www.pollen.com/api/forecast/current/pollen/${zip}`,
            { headers: { 'Accept': 'application/json', 'Referer': 'https://www.pollen.com/', 'User-Agent': 'Mozilla/5.0' } }
        );
        if (!response.ok) return null;
        const json = await response.json();
        const today = json.Location?.periods?.[1] || json.Location?.periods?.[0];
        if (!today) return null;
        const triggers = (today.Triggers || []).map(t => t.Name).filter(Boolean);
        return { index: today.Index ?? 0, triggers };
    } catch {
        return null;
    }
}

async function fetchAQIData(zip) {
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${zip}&count=1&language=en&format=json`);
        if (!geoRes.ok) return null;
        const geoData = await geoRes.json();
        const loc = geoData.results?.[0];
        if (!loc) return null;

        const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.latitude}&longitude=${loc.longitude}&current=us_aqi&timezone=auto`);
        if (!aqiRes.ok) return null;
        const aqiData = await aqiRes.json();
        return aqiData.current?.us_aqi ?? null;
    } catch {
        return null;
    }
}

function buildEmailHTML(zip, pollen, aqi, breathableScore, unsubscribeUrl) {
    const aqiInfo = aqi !== null ? getAQILabel(aqi) : { label: 'Unavailable', color: '#94a3b8' };
    const pollenLevel = pollenSeverityLabel(pollen?.index || 0);
    const scoreColor = breathableScore >= 7 ? '#22c55e' : breathableScore >= 4 ? '#eab308' : '#ef4444';
    const triggers = pollen?.triggers?.slice(0, 5).join(', ') || 'None detected';

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
                        <div style="font-size:18px;font-weight:bold;color:#f59e0b;">${pollenLevel} (${pollen?.index || 0}/12)</div>
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
                        <div style="font-size:12px;color:#94a3b8;">Top Allergens</div>
                        <div style="font-size:14px;color:#e2e8f0;">${triggers}</div>
                    </td>
                </tr>
            </table>
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

            const pollen = await fetchPollenData(zip);
            const aqi = await fetchAQIData(zip);
            const pollenIndex = pollen?.index || 0;
            const aqiValue = aqi ?? 0;
            const breathableScore = calculateBreathableScore(pollenIndex, aqiValue);

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
