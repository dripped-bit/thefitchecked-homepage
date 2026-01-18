export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return new Response(JSON.stringify({ error: 'FAL_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const requestId = url.searchParams.get('request_id');
    const path = url.searchParams.get('path');

    if (!requestId || !path) {
      return new Response(JSON.stringify({ error: 'Missing request_id or path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const statusUrl = `https://queue.fal.run${path}/requests/${requestId}/status`;

    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${falKey}`,
      },
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('FAL status error:', error);
    return new Response(JSON.stringify({ error: 'FAL status check failed', details: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
