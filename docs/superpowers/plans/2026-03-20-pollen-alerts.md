# Pollen Alerts System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily email alert system that sends subscribers morning pollen/AQI reports when conditions are concerning.

**Architecture:** Vercel KV stores subscriber records (email + zip). A Vercel Cron job fires daily at 7am ET, fetches pollen/AQI data for each subscriber's zip, and sends HTML emails via Resend when levels are moderate or higher. Frontend form POSTs to serverless subscribe/unsubscribe APIs.

**Tech Stack:** Vercel KV (Redis storage), Resend (email), Vercel Cron (scheduler), existing pollen.com + Open-Meteo APIs.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `api/subscribe.js` | Create | POST endpoint — validate email+zip, store in Vercel KV |
| `api/unsubscribe.js` | Create | GET endpoint — remove subscriber from KV (used in email links) |
| `api/cron/send-alerts.js` | Create | Cron job — fetch data per subscriber, send emails via Resend |
| `main.js:340-405` | Modify | Update renderAlerts() to POST to /api/subscribe instead of localStorage |
| `vercel.json` | Modify | Add cron schedule configuration |
| `package.json` | Modify | Add `@vercel/kv` and `resend` dependencies |

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @vercel/kv and resend**

```bash
npm install @vercel/kv resend
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @vercel/kv and resend dependencies for alerts"
```

---

### Task 2: Create subscribe API endpoint

**Files:**
- Create: `api/subscribe.js`

- [ ] **Step 1: Create the subscribe endpoint**

```js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, zip } = req.body;

    if (!email || !/.+@.+\..+/.test(email)) {
        return res.status(400).json({ error: 'Valid email required' });
    }
    if (!zip || !/^\d{5}$/.test(zip)) {
        return res.status(400).json({ error: 'Valid 5-digit zip code required' });
    }

    // Store subscriber keyed by email
    await kv.hset(`subscriber:${email}`, { email, zip, subscribedAt: new Date().toISOString() });
    // Add to subscriber index for iteration
    await kv.sadd('subscribers', email);

    return res.status(200).json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/subscribe.js
git commit -m "feat: add subscribe API endpoint with Vercel KV storage"
```

---

### Task 3: Create unsubscribe API endpoint

**Files:**
- Create: `api/unsubscribe.js`

- [ ] **Step 1: Create the unsubscribe endpoint**

```js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    const { email } = req.query;

    if (!email) return res.status(400).send('Email required');

    await kv.del(`subscriber:${email}`);
    await kv.srem('subscribers', email);

    // Redirect to a friendly page
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
        <html>
        <head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head>
        <body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#e2e8f0;margin:0;">
            <div style="text-align:center;padding:2rem;">
                <h1>Unsubscribed</h1>
                <p>You've been removed from pollen alerts.</p>
                <a href="/" style="color:#f59e0b;">Back to Pollen Tracker</a>
            </div>
        </body>
        </html>
    `);
}
```

- [ ] **Step 2: Commit**

```bash
git add api/unsubscribe.js
git commit -m "feat: add unsubscribe API endpoint"
```

---

### Task 4: Create daily cron job to send alert emails

**Files:**
- Create: `api/cron/send-alerts.js`

- [ ] **Step 1: Create the cron handler**

This endpoint fetches pollen + AQI data for each subscriber's zip, and sends an email via Resend if pollen is moderate or higher.

```js
import { kv } from '@vercel/kv';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
    return Math.round((pollenScore * 0.6 + aqiScore * 0.4));
}

async function fetchPollenData(zip) {
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
}

async function fetchAQIData(zip) {
    // Use a rough lat/lon lookup via zip (Open-Meteo needs coordinates)
    // For simplicity, use the zip with a geocoding service
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${zip}&count=1&language=en&format=json`);
    if (!geoRes.ok) return null;
    const geoData = await geoRes.json();
    const loc = geoData.results?.[0];
    if (!loc) return null;

    const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.latitude}&longitude=${loc.longitude}&current=us_aqi&timezone=auto`);
    if (!aqiRes.ok) return null;
    const aqiData = await aqiRes.json();
    return aqiData.current?.us_aqi ?? null;
}

function buildEmailHTML(zip, pollen, aqi, breathableScore) {
    const aqiInfo = aqi !== null ? getAQILabel(aqi) : { label: 'Unavailable', color: '#94a3b8' };
    const pollenLevel = pollenSeverityLabel(pollen?.index || 0);
    const scoreColor = breathableScore >= 7 ? '#22c55e' : breathableScore >= 4 ? '#eab308' : '#ef4444';
    const triggers = pollen?.triggers?.slice(0, 5).join(', ') || 'None detected';
    const unsubscribeUrl = `https://nc-pollen-tracker.vercel.app/api/unsubscribe?email=`;

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
                <a href="UNSUBSCRIBE_URL" style="color:#64748b;">Unsubscribe</a>
            </p>
        </div>
    </div>`;
}

export default async function handler(req, res) {
    // Verify this is called by Vercel Cron (or allow manual trigger in dev)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const emails = await kv.smembers('subscribers');
    if (!emails || emails.length === 0) {
        return res.status(200).json({ message: 'No subscribers', sent: 0 });
    }

    let sent = 0;
    let skipped = 0;

    for (const email of emails) {
        try {
            const subscriber = await kv.hgetall(`subscriber:${email}`);
            if (!subscriber) continue;

            const { zip } = subscriber;
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

            const html = buildEmailHTML(zip, pollen, aqi, breathableScore);
            const unsubscribeUrl = `https://nc-pollen-tracker.vercel.app/api/unsubscribe?email=${encodeURIComponent(email)}`;
            const finalHtml = html.replace('UNSUBSCRIBE_URL', unsubscribeUrl);

            await resend.emails.send({
                from: 'PollenTracker <onboarding@resend.dev>',
                to: email,
                subject: `Pollen Alert: Breathable Score ${breathableScore}/10 for ${zip}`,
                html: finalHtml,
            });

            sent++;
        } catch (err) {
            console.error(`Failed to process ${email}:`, err);
        }
    }

    return res.status(200).json({ message: 'Alerts processed', sent, skipped, total: emails.length });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/cron/send-alerts.js
git commit -m "feat: add daily cron job for pollen alert emails via Resend"
```

---

### Task 5: Update vercel.json with cron config

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add cron schedule**

Add cron configuration to run daily at 7am ET (11:00 UTC, accounting for EDT):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "crons": [
    {
      "path": "/api/cron/send-alerts",
      "schedule": "0 11 * * *"
    }
  ],
  "headers": [
    {
      "source": "/(.*).html",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    },
    {
      "source": "/",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: add cron schedule for daily 7am ET pollen alerts"
```

---

### Task 6: Update frontend to use real API

**Files:**
- Modify: `main.js:340-405`

- [ ] **Step 1: Update renderAlerts() to POST to /api/subscribe**

Replace the localStorage-based form submission with a fetch POST to the subscribe API. Keep localStorage as a fallback indicator so the UI remembers the subscription state.

Replace the form submit handler (lines 370-382) with:

```js
document.getElementById('alerts-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('alert-email').value;
    const zip = document.getElementById('alert-zip').value;
    const btn = document.querySelector('.alerts-btn');
    btn.textContent = 'Signing up...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, zip }),
        });

        if (!res.ok) throw new Error('Signup failed');

        localStorage.setItem('pollen_alert_email', email);
        localStorage.setItem('pollen_alert_zip', zip);
        document.getElementById('alerts-form').style.display = 'none';
        document.getElementById('alerts-success').style.display = 'block';
    } catch (err) {
        btn.textContent = 'Get Pollen Alerts';
        btn.disabled = false;
        alert('Signup failed. Please try again.');
    }
});
```

Replace the unsubscribe handler (lines 385-396) with:

```js
document.getElementById('alerts-unsubscribe').addEventListener('click', async () => {
    const email = localStorage.getItem('pollen_alert_email');
    if (email) {
        try {
            await fetch(`/api/unsubscribe?email=${encodeURIComponent(email)}`);
        } catch { /* still clear locally */ }
    }
    localStorage.removeItem('pollen_alert_email');
    localStorage.removeItem('pollen_alert_zip');
    document.getElementById('alerts-form').style.display = 'block';
    document.getElementById('alerts-success').style.display = 'none';
    document.getElementById('alert-email').value = '';
    document.getElementById('alert-zip').value = '';
});
```

- [ ] **Step 2: Commit**

```bash
git add main.js
git commit -m "feat: connect alerts form to subscribe/unsubscribe APIs"
```

---

### Task 7: Set up Vercel environment variables

**Files:** None (Vercel dashboard config)

- [ ] **Step 1: Create Resend account and get API key**

1. Go to resend.com and sign up (free)
2. Copy the API key from the dashboard

- [ ] **Step 2: Add environment variables in Vercel dashboard**

Go to Vercel project settings > Environment Variables and add:

- `RESEND_API_KEY` = your Resend API key
- `CRON_SECRET` = generate a random string (e.g., `openssl rand -hex 32`)

- [ ] **Step 3: Enable Vercel KV**

1. Go to Vercel dashboard > Storage > Create > KV
2. Connect it to your nc-pollen-tracker project
3. This auto-adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars

- [ ] **Step 4: Deploy and test**

```bash
npx vercel --prod
```

Test subscribe:
```bash
curl -X POST https://nc-pollen-tracker.vercel.app/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","zip":"27601"}'
```
