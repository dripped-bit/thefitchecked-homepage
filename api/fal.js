export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return res.status(500).json({ error: 'FAL_KEY not configured' });
  }

  try {
    const { path, body } = req.body;

    if (!body || !body.prompt) {
      console.error('Missing body or prompt:', { hasBody: !!body, hasPrompt: !!body?.prompt });
      return res.status(400).json({ error: 'Missing prompt in request body' });
    }

    console.log('Received request for path:', path, 'prompt length:', body.prompt?.length);

    // Process body to convert base64 images to URLs using Vercel Blob
    const processedBody = { ...body };

    // Handle image_urls array for models that need multiple images
    if (processedBody.image_urls && Array.isArray(processedBody.image_urls)) {
      console.log('Processing image_urls array, count:', processedBody.image_urls.length);
      processedBody.image_urls = await Promise.all(
        processedBody.image_urls.map(async (img, i) => {
          if (img && img.startsWith('data:')) {
            console.log(`Uploading image ${i} to blob...`);
            const url = await uploadBase64ToBlob(img);
            console.log(`Image ${i} result:`, url.startsWith('data:') ? 'base64 (no blob token)' : url);
            return url;
          }
          return img;
        })
      );
    }

    if (processedBody.image_url && processedBody.image_url.startsWith('data:')) {
      processedBody.image_url = await uploadBase64ToBlob(processedBody.image_url);
    }

    if (processedBody.image && processedBody.image.startsWith('data:')) {
      processedBody.image = await uploadBase64ToBlob(processedBody.image);
    }

    // Always use queue endpoint for async processing
    const targetUrl = `https://queue.fal.run${path}`;

    // Log what we're sending (without full image data)
    const imageTypes = processedBody.image_urls?.map(u => {
      if (!u) return 'null';
      if (u.startsWith('data:')) return 'base64:' + u.length;
      return 'url';
    }) || [];

    console.log('Sending to FAL:', {
      url: targetUrl,
      hasPrompt: !!processedBody.prompt,
      promptLength: processedBody.prompt?.length || 0,
      promptStart: processedBody.prompt?.substring(0, 50) || 'MISSING',
      image_urls_count: processedBody.image_urls?.length || 0,
      image_urls_types: imageTypes
    });

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(processedBody),
    });

    const data = await response.json();
    console.log('FAL response:', response.status, data.request_id || data.error || 'ok');
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('FAL API error:', error);
    return res.status(500).json({ error: 'FAL API request failed', details: error.message });
  }
}

async function uploadBase64ToBlob(base64String) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (!blobToken) {
    return base64String;
  }

  try {
    const matches = base64String.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return base64String;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const extension = mimeType.split('/')[1]?.split(';')[0] || 'png';

    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `avatar-${Date.now()}.${extension}`;

    const response = await fetch(`https://blob.vercel-storage.com/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${blobToken}`,
        'Content-Type': mimeType,
        'x-api-version': '7',
      },
      body: buffer,
    });

    if (!response.ok) {
      console.error('Blob upload failed:', await response.text());
      return base64String;
    }

    const result = await response.json();
    return result.url;
  } catch (error) {
    console.error('Blob upload error:', error);
    return base64String;
  }
}
