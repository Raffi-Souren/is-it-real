/**
 * Vercel Serverless Function - Hive AI Proxy
 * Avoids CORS issues by calling Hive API from server-side
 * Supports both URL and base64 image data
 */

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HIVE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Hive API key not configured' });
  }

  try {
    const { imageUrl, imageBase64 } = req.body;

    let requestBody;

    if (imageBase64) {
      // Send base64 image data
      requestBody = {
        image: { base64: imageBase64 },
        models: ['ai_generated_image', 'deepfake']
      };
    } else if (imageUrl && !imageUrl.startsWith('blob:')) {
      // Use URL for public images
      requestBody = {
        url: imageUrl,
        models: ['ai_generated_image', 'deepfake']
      };
    } else {
      return res.status(400).json({ error: 'Valid imageUrl or imageBase64 required' });
    }

    const response = await fetch('https://api.thehive.ai/api/v2/task/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Hive API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();

    // Extract scores
    const aiGenerated = data.status?.[0]?.response?.ai_generated_image;
    const deepfake = data.status?.[0]?.response?.deepfake;

    const aiScore = aiGenerated?.classes?.find(c => c.class === 'ai_generated')?.score || 0;
    const deepfakeScore = deepfake?.classes?.find(c => c.class === 'yes_deepfake')?.score || 0;
    const combinedScore = Math.max(aiScore, deepfakeScore) * 100;

    return res.status(200).json({
      source: 'hive',
      score: combinedScore,
      confidence: data.status?.[0]?.response?.confidence || 0.85,
      metadata: {
        aiGeneratedScore: aiScore * 100,
        deepfakeScore: deepfakeScore * 100,
        model: aiGenerated?.model || 'unknown'
      }
    });

  } catch (error) {
    console.error('Hive proxy error:', error);
    return res.status(500).json({
      error: error.message,
      source: 'hive'
    });
  }
}
