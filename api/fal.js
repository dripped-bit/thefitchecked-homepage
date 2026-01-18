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
    const { path, body, async: useAsync } = req.body;

    // Process body to convert base64 images to URLs using Vercel Blob
    const processedBody = { ...body };

    if (processedBody.image_url && processedBody.image_url.startsWith('data:')) {
      processedBody.image_url = await uploadBase64ToBlob(processedBody.image_url);
    }

    if (processedBody.image && processedBody.image.startsWith('data:')) {
      processedBody.image = await uploadBase64ToBlob(processedBody.image);
    }

    // Handle image_urls array for models that need multiple images
    if (processedBody.image_urls && Array.isArray(processedBody.image_urls)) {
      processedBody.image_urls = await Promise.all(
        processedBody.image_urls.map(async (img) => {
          if (img && img.startsWith('data:')) {
            return await uploadBase64ToBlob(img);
          }
          return img;
        })
      );
    }

    // Use queue endpoint for async processing, or direct endpoint for sync
    const baseUrl = useAsync ? 'https://queue.fal.run' : 'https://fal.run';
    const targetUrl = `${baseUrl}${path}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(processedBody),
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('FAL API error:', error);
    return res.status(500).json({ error: 'FAL API request failed', details: error.message });
  }
}

async function uploadBase64ToBlob(base64String) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (!blobToken) {
    // If no blob token, try passing base64 directly (some FAL models accept it)
    return base64String;
  }

  try {
    // Extract the base64 data and mime type
    const matches = base64String.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return base64String; // Return as-is if not valid base64
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const extension = mimeType.split('/')[1]?.split(';')[0] || 'png';

    // Convert base64 to buffer using Node.js Buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Upload to Vercel Blob
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
      return base64String; // Fallback to base64
    }

    const result = await response.json();
    return result.url;
  } catch (error) {
    console.error('Blob upload error:', error);
    return base64String; // Fallback to base64
  }
}
