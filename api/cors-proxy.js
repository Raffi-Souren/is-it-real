
// /api/cors-proxy.js
// Fetches an image from a remote URL and returns it, adding CORS headers.
// This is necessary to load images from any URL into the browser canvas
// without running into cross-origin security restrictions.

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const imageResponse = await fetch(url);

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }

    // Get the raw image data as an ArrayBuffer
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Set CORS headers to allow any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Set the correct content type and send the image buffer
    res.setHeader('Content-Type', contentType);
    res.send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('CORS Proxy Error:', error);
    res.status(500).json({ error: `Failed to fetch image from URL: ${url}. ${error.message}` });
  }
}
