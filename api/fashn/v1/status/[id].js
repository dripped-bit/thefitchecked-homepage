export const config = {
  runtime: 'edge',
};

export default async function handler(req, context) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    // Extract job ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const jobId = pathParts[pathParts.length - 1];

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Missing job ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(`https://api.fashn.ai/v1/status/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${fashnKey}`,
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
    console.error('FASHN status error:', error);
    return new Response(JSON.stringify({ error: 'FASHN status check failed', details: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
