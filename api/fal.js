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

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return new Response(JSON.stringify({ error: 'FAL_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { path, body } = await req.json();
    
    // Process body to convert base64 images to URLs
    const processedBody = { ...body };
    
    // Check for base64 images and convert them
    if (processedBody.image_url && processedBody.image_url.startsWith('data:')) {
      processedBody.image_url = await uploadBase64ToBlob(processedBody.image_url);
    }
    
    if (processedBody.image && processedBody.image.startsWith('data:')) {
      processedBody.image = await uploadBase64ToBlob(processedBody.image);
    }

    // Handle image_urls array
    if (Array.isArray(processedBody.image_urls)) {
      processedBody.image_urls = await Promise.all(
        processedBody.image_urls.map(async (url) => {
          if (url && url.startsWith('data:')) {
            return await uploadBase64ToBlob(url);
          }
          return url;
        })
      );
    }
    
    const targetUrl = `https://fal.run${path}`;
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(processedBody),
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
    console.error('FAL API error:', error);
    return new Response(JSON.stringify({ error: 'FAL API request failed', details: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

async function uploadBase64ToBlob(base64String) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  
  if (!blobToken) {
    throw new Error('BLOB_READ_WRITE_TOKEN not configured');
  }

  // Extract the base64 data and mime type
  const matches = base64String.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 string format');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const extension = mimeType.split('/')[1] || 'png';

  // Convert base64 to binary
  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  // Upload to Vercel Blob
  const filename = `avatar-${Date.now()}.${extension}`;
  
  const response = await fetch(`https://blob.vercel-storage.com/${filename}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${blobToken}`,
      'Content-Type': mimeType,
      'x-api-version': '7',
    },
    body: binaryData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Blob upload failed: ${errorText}`);
  }

  const result = await response.json();
  return result.url;
}
