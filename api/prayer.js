// CORS proxy for e-solat.gov.my monthly prayer time endpoint.
// The browser fetch is blocked by e-solat's missing CORS headers.

export default async function handler(req, res) {
  const { zone, year, month } = req.query;

  if (!zone || !year || !month) {
    return res.status(400).json({ error: 'Missing zone, year or month' });
  }

  const url =
    `https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat` +
    `&period=month&zone=${encodeURIComponent(zone)}` +
    `&year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'MySurau/1.0 (mysurau.com)' },
      signal: AbortSignal.timeout(12000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream error ${upstream.status}` });
    }

    const data = await upstream.json();

    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (err) {
    console.error('prayer proxy error:', err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
}
