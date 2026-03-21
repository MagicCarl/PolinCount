const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisCommand(...args) {
    const res = await fetch(`${UPSTASH_URL}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
    });
    return res.json();
}

module.exports = async function handler(req, res) {
    const { email } = req.query;

    if (!email) return res.status(400).send('Email required');

    await redisCommand('DEL', `subscriber:${email}`);
    await redisCommand('SREM', 'subscribers', email);

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
};
