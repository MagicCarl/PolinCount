module.exports = async function handler(req, res) {
    const { lat, lon } = req.query;

    if (!lat || !lon || isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
        return res.status(400).json({ error: 'Valid lat and lon query params required' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone&timezone=auto`;
        const response = await fetch(url);

        if (!response.ok) {
            return res.status(502).json({ error: `Open-Meteo returned ${response.status}` });
        }

        const json = await response.json();
        const current = json.current;

        const data = {
            aqi: Math.round(current.us_aqi || 0),
            pm25: current.pm2_5 != null ? current.pm2_5.toFixed(1) : '--',
            pm10: current.pm10 != null ? current.pm10.toFixed(1) : '--',
            no2: current.nitrogen_dioxide != null ? current.nitrogen_dioxide.toFixed(1) : '--',
            ozone: current.ozone != null ? current.ozone.toFixed(1) : '--',
            time: new Date(current.time).toLocaleString(),
        };

        res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900');
        return res.status(200).json(data);
    } catch (err) {
        console.error('aqi handler error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch AQI data' });
    }
};
