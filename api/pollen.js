export default async function handler(req, res) {
    const { zip } = req.query;

    if (!zip || !/^\d{5}$/.test(zip)) {
        return res.status(400).json({ error: 'Valid 5-digit zip code required' });
    }

    try {
        const response = await fetch(
            `https://www.pollen.com/api/forecast/current/pollen/${zip}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'Referer': 'https://www.pollen.com/',
                    'User-Agent': 'Mozilla/5.0',
                },
            }
        );

        if (!response.ok) {
            return res.status(response.status).json({ error: `Pollen API returned ${response.status}` });
        }

        const data = await response.json();

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch pollen data' });
    }
}
