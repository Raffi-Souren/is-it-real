/**
 * Vercel Serverless Function - SightEngine Proxy
 * Avoids CORS issues by calling SightEngine API from server-side
 */

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;

  if (!apiUser || !apiSecret) {
    return res.status(500).json({ error: 'SightEngine credentials not configured' });
  }

  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl required' });
    }

    const params = new URLSearchParams({
      url: imageUrl,
      models: 'genai',
      api_user: apiUser,
      api_secret: apiSecret
    });

    const response = await fetch(`https://api.sightengine.com/1.0/check.json?${params}`, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `SightEngine API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();

    // Check for API-level errors
    if (data.status === 'failure') {
      return res.status(400).json({
        error: data.error?.message || 'SightEngine API failure',
        source: 'sightengine'
      });
    }

    const aiScore = (data.type?.ai_generated || 0) * 100;

    return res.status(200).json({
      source: 'sightengine',
      score: aiScore,
      confidence: 0.90,
      metadata: {
        mediaType: data.media?.type,
        rawScore: data.type?.ai_generated,
        photoScore: data.type?.photo,
        illustrationScore: data.type?.illustration
      }
    });

  } catch (error) {
    console.error('SightEngine proxy error:', error);
    return res.status(500).json({
      error: error.message,
      source: 'sightengine'
    });
  }
}
