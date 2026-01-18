export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const serpApiKey = process.env.SERPAPI_API_KEY;
  if (!serpApiKey) {
    return new Response(JSON.stringify({ error: 'SERPAPI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { query, num = 5, userGender, budgetMin, budgetMax } = await req.json();

    // Add gender to query if provided
    let genderQuery = query;
    if (userGender && !query.toLowerCase().includes(userGender.toLowerCase())) {
      genderQuery = `${userGender}'s ${query}`;
    }

    const params = new URLSearchParams({
      api_key: serpApiKey,
      engine: 'google_shopping',
      q: genderQuery,
      location: 'Austin, Texas, United States',
      hl: 'en',
      gl: 'us',
      num: num.toString(),
    });

    // Add budget filtering if provided
    if (budgetMin || budgetMax) {
      const tbs = [];
      if (budgetMin) tbs.push(`ppr_min:${budgetMin}`);
      if (budgetMax) tbs.push(`ppr_max:${budgetMax}`);
      params.append('tbs', tbs.join(','));
    }

    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    const data = await response.json();

    // Filter out children's products
    if (data.shopping_results) {
      data.shopping_results = data.shopping_results.filter(item => {
        const title = (item.title || '').toLowerCase();
        return !title.includes('kids') && !title.includes('children') && !title.includes('toddler') && !title.includes('baby');
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('SerpAPI error:', error);
    return new Response(JSON.stringify({ error: 'Shopping search failed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
