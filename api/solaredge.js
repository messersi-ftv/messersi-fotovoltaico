// Proxy SolarEdge — API V2 (la V1 e' stata ritirata da SolarEdge il 03/11/2026)
// Traduce le risposte V2 nel formato V1 che il frontend si aspetta.
// La chiave API NON e' nel codice: va configurata su Vercel come variabile
// d'ambiente SOLAREDGE_API_KEY (Settings -> Environment Variables).

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const API_KEY = process.env.SOLAREDGE_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({
            error: 'Variabile d\'ambiente SOLAREDGE_API_KEY non configurata su Vercel.',
            timestamp: new Date().toISOString()
        });
    }

    const SITE_ID = '4858098';
    const BASE = 'https://monitoringapi.solaredge.com/v2';
    const { endpoint, timeUnit, startDate, endDate } = req.query;

    async function v2get(path) {
        const response = await fetch(BASE + path, {
            headers: { 'x-api-key': API_KEY, 'Accept': 'application/json' }
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error('SolarEdge V2 API ' + response.status + ': ' + errorText);
        }
        return response.json();
    }

    try {
        if (endpoint === 'overview') {
            // Chiamate in parallelo: dettagli sito, totali, energia di oggi, potenza
            const [siteInfo, energyToday, powerToday] = await Promise.all([
                v2get(`/sites/${SITE_ID}`),
                v2get(`/sites/${SITE_ID}/energy?resolution=HOUR`),
                v2get(`/sites/${SITE_ID}/power`)
            ]);

            // Totali lifetime: l'overview vuole from/to in formato ISO (Instant).
            // La data di inizio e' la data di installazione del sito.
            const fromDate = siteInfo.installationDate || '2020-01-01T00:00:00Z';
            const toDate = new Date().toISOString();
            const overview = await v2get(`/sites/${SITE_ID}/overview?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`);

            // Potenza attuale = ultimo valore non nullo della serie di oggi
            const lastPower = [...(powerToday.values || [])]
                .reverse()
                .find(v => v.value !== null && v.value !== undefined);

            // Energia prodotta oggi = somma dei valori orari non nulli
            const dayEnergy = (energyToday.values || [])
                .reduce((sum, v) => sum + (v.value || 0), 0);

            return res.status(200).json({
                sitesOverviews: {
                    siteEnergyList: [{
                        siteOverview: {
                            lastUpdateTime: lastPower ? lastPower.timestamp : new Date().toISOString(),
                            currentPower: { power: lastPower ? lastPower.value : 0 },
                            lastDayData: { energy: dayEnergy },
                            lastMonthData: { energy: 0 },
                            lifeTimeData: { energy: overview.production ? overview.production.total : 0 }
                        }
                    }]
                }
            });
        }

        if (endpoint === 'energy') {
            const resolution = timeUnit === 'HOUR' ? 'HOUR' : 'DAY';
            const params = new URLSearchParams({ resolution: resolution });
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);

            const data = await v2get(`/sites/${SITE_ID}/energy?${params.toString()}`);

            return res.status(200).json({
                energy: {
                    timeUnit: timeUnit || 'DAY',
                    unit: data.unit || 'Wh',
                    values: (data.values || []).map(v => ({
                        date: v.timestamp,
                        value: v.value
                    }))
                }
            });
        }

        return res.status(400).json({
            error: 'Endpoint non supportato: ' + endpoint,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
