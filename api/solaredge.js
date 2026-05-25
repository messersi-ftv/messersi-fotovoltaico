export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { endpoint, timeUnit, startDate, endDate } = req.query;
    const API_KEY = 'DV71FTR8PW46BHEMV6CH5GS67IQFT1CF';
    const SITE_ID = '4858098';
    
    let url = `https://monitoringapi.solaredge.com/sites/${SITE_ID}/${endpoint}?api_key=${API_KEY}`;
    
    if (timeUnit) url += `&timeUnit=${timeUnit}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;

    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SolarEdge API ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        res.status(200).json(data);
        
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
