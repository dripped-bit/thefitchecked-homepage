export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed', method: req.method }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
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

    // Construct status URL: https://queue.fal.run/{path}/requests/{request_id}/status
    const statusUrl = `https://queue.fal.run${path}/requests/${requestId}/status`;

    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${falKey}`,
      },
    });

    // Get response as text first to handle non-JSON responses
    const responseText = await response.text();

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return new Response(JSON.stringify({
        error: 'FAL returned non-JSON response',
        status: response.status,
        statusText: response.statusText,
        url: statusUrl,
        body: responseText.substring(0, 500)
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

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
