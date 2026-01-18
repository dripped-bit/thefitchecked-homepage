export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const fashnKey = process.env.FASHN_API_KEY;
  if (!fashnKey) {
    return new Response(JSON.stringify({ error: 'FASHN_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Extract path from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.replace('/api/fashn', '');
    const fashnPath = pathParts || '/v1/run';
    
    const targetUrl = `https://api.fashn.ai${fashnPath}`;

    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${fashnKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (req.method === 'POST') {
      const body = await req.json();
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('FASHN API error:', error);
    return new Response(JSON.stringify({ error: 'FASHN API request failed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
