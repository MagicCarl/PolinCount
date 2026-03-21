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

    await redisCommand('HSET', `subscriber:${email}`, 'email', email, 'zip', zip, 'subscribedAt', new Date().toISOString());
    await redisCommand('SADD', 'subscribers', email);

    return res.status(200).json({ success: true });
};
