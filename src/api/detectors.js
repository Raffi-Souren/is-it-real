/**
 * Detection API Integrations
 *
 * Real API integrations for Hive AI, SightEngine, and heuristic analysis.
 * Graceful degradation if APIs unavailable.
 *
 * @author Raf Khatchadourian
 */

// API endpoints
const ENDPOINTS = {
  HIVE: 'https://api.thehive.ai/api/v2/task/sync',
  SIGHTENGINE: 'https://api.sightengine.com/1.0/check.json'
};

/**
 * Hive AI Detection
 * Specialized for deepfakes and AI-generated content
 *
 * @param {string} imageUrl - URL of image to analyze
 * @param {string} apiKey - Hive API key
 * @returns {Object} Detection result
 */
export async function detectWithHive(imageUrl, apiKey) {
  if (!apiKey) {
    return {
      source: 'hive',
      score: null,
      confidence: 0,
      error: 'API key not configured',
      metadata: {}
    };
  }

  try {
    const response = await fetch(ENDPOINTS.HIVE, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: imageUrl,
        models: ['ai_generated_image', 'deepfake']
      })
    });

    if (!response.ok) {
      throw new Error(`Hive API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract AI-generated score
    const aiGenerated = data.status?.[0]?.response?.ai_generated_image;
    const deepfake = data.status?.[0]?.response?.deepfake;

    // Combine scores (higher of the two)
    const aiScore = aiGenerated?.classes?.find(c => c.class === 'ai_generated')?.score || 0;
    const deepfakeScore = deepfake?.classes?.find(c => c.class === 'yes_deepfake')?.score || 0;
    const combinedScore = Math.max(aiScore, deepfakeScore) * 100;

    return {
      source: 'hive',
      score: combinedScore,
      confidence: data.status?.[0]?.response?.confidence || 0.85,
      metadata: {
        aiGeneratedScore: aiScore * 100,
        deepfakeScore: deepfakeScore * 100,
        model: aiGenerated?.model || 'unknown',
        rawResponse: data
      }
    };
  } catch (error) {
    console.error('Hive detection error:', error);
    return {
      source: 'hive',
      score: null,
      confidence: 0,
      error: error.message,
      metadata: {}
    };
  }
}

/**
 * SightEngine Detection
 * Multi-model AI content detection
 *
 * @param {string} imageUrl - URL of image to analyze
 * @param {string} apiUser - SightEngine API user
 * @param {string} apiSecret - SightEngine API secret
 * @returns {Object} Detection result
 */
export async function detectWithSightEngine(imageUrl, apiUser, apiSecret) {
  if (!apiUser || !apiSecret) {
    return {
      source: 'sightengine',
      score: null,
      confidence: 0,
      error: 'API credentials not configured',
      metadata: {}
    };
  }

  try {
    const params = new URLSearchParams({
      url: imageUrl,
      models: 'genai',
      api_user: apiUser,
      api_secret: apiSecret
    });

    const response = await fetch(`${ENDPOINTS.SIGHTENGINE}?${params}`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`SightEngine API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract AI-generated score (0-1, convert to 0-100)
    const aiScore = (data.type?.ai_generated || 0) * 100;

    return {
      source: 'sightengine',
      score: aiScore,
      confidence: 0.90, // SightEngine typically high confidence
      metadata: {
        mediaType: data.media?.type,
        rawScore: data.type?.ai_generated,
        photoScore: data.type?.photo,
        illustrationScore: data.type?.illustration,
        rawResponse: data
      }
    };
  } catch (error) {
    console.error('SightEngine detection error:', error);
    return {
      source: 'sightengine',
      score: null,
      confidence: 0,
      error: error.message,
      metadata: {}
    };
  }
}

/**
 * Illuminarty Detection (placeholder - requires partnership access)
 * Multi-model ensemble from academic research
 *
 * @param {string} imageUrl - URL of image to analyze
 * @param {string} apiKey - Illuminarty API key
 * @returns {Object} Detection result
 */
export async function detectWithIlluminarty(imageUrl, apiKey) {
  // Illuminarty requires partnership access
  // This is a placeholder that returns null to gracefully degrade

  if (!apiKey) {
    return {
      source: 'illuminarty',
      score: null,
      confidence: 0,
      error: 'API key not configured (requires partnership)',
      metadata: {}
    };
  }

  // TODO: Implement when API access available
  return {
    source: 'illuminarty',
    score: null,
    confidence: 0,
    error: 'Integration pending',
    metadata: {}
  };
}

// ============================================
// TEXT DETECTION APIS
// ============================================

/**
 * GPTZero Text Detection
 * Specialized for detecting AI-generated text (ChatGPT, Claude, etc.)
 *
 * @param {string} text - Text to analyze
 * @param {string} apiKey - GPTZero API key
 * @returns {Object} Detection result
 */
export async function detectTextWithGPTZero(text, apiKey) {
  if (!apiKey) {
    return {
      source: 'gptzero',
      score: null,
      confidence: 0,
      error: 'API key not configured',
      metadata: {}
    };
  }

  try {
    const response = await fetch('https://api.gptzero.me/v2/predict/text', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ document: text })
    });

    if (!response.ok) {
      throw new Error(`GPTZero API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract AI probability (0-1, convert to 0-100)
    const aiScore = (data.documents?.[0]?.completely_generated_prob || 0) * 100;

    return {
      source: 'gptzero',
      score: aiScore,
      confidence: 0.88,
      metadata: {
        averageGeneratedProb: data.documents?.[0]?.average_generated_prob * 100,
        completelyGeneratedProb: aiScore,
        mixedProb: (data.documents?.[0]?.mixed_prob || 0) * 100,
        sentenceCount: data.documents?.[0]?.sentences?.length || 0,
        rawResponse: data
      }
    };
  } catch (error) {
    console.error('GPTZero detection error:', error);
    return {
      source: 'gptzero',
      score: null,
      confidence: 0,
      error: error.message,
      metadata: {}
    };
  }
}

/**
 * Originality.AI Text Detection
 * Enterprise-grade AI content detection
 *
 * @param {string} text - Text to analyze
 * @param {string} apiKey - Originality.AI API key
 * @returns {Object} Detection result
 */
export async function detectTextWithOriginality(text, apiKey) {
  if (!apiKey) {
    return {
      source: 'originality',
      score: null,
      confidence: 0,
      error: 'API key not configured',
      metadata: {}
    };
  }

  try {
    const response = await fetch('https://api.originality.ai/api/v1/scan/ai', {
      method: 'POST',
      headers: {
        'X-OAI-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: text })
    });

    if (!response.ok) {
      throw new Error(`Originality.AI API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract AI score (0-1, convert to 0-100)
    const aiScore = (data.score?.ai || 0) * 100;

    return {
      source: 'originality',
      score: aiScore,
      confidence: 0.92,
      metadata: {
        aiScore: aiScore,
        originalScore: (data.score?.original || 0) * 100,
        rawResponse: data
      }
    };
  } catch (error) {
    console.error('Originality.AI detection error:', error);
    return {
      source: 'originality',
      score: null,
      confidence: 0,
      error: error.message,
      metadata: {}
    };
  }
}

/**
 * Text Heuristics Analysis (no API required)
 * Pattern-based analysis for AI text detection
 *
 * @param {string} text - Text to analyze
 * @returns {Object} Heuristic analysis result
 */
export function analyzeTextHeuristics(text) {
  const signals = [];
  let suspicionScore = 0;

  if (!text || text.length < 50) {
    return {
      source: 'text_heuristics',
      score: 0,
      confidence: 0.3,
      metadata: { signals, note: 'Text too short for reliable analysis' }
    };
  }

  // Signal 1: Repetitive sentence starters
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const starters = sentences.map(s => s.trim().split(' ').slice(0, 2).join(' ').toLowerCase());
  const uniqueStarters = new Set(starters);
  const repetitionRatio = 1 - (uniqueStarters.size / starters.length);

  if (repetitionRatio > 0.4) {
    signals.push({
      signal: 'repetitive_starters',
      weight: 15,
      description: `${(repetitionRatio * 100).toFixed(0)}% repetitive sentence starters`
    });
    suspicionScore += 15;
  }

  // Signal 2: Overly formal/perfect punctuation
  const perfectPunctuation = text.match(/[.!?]\s+[A-Z]/g)?.length || 0;
  const punctuationRatio = perfectPunctuation / sentences.length;
  if (punctuationRatio > 0.9 && sentences.length > 5) {
    signals.push({
      signal: 'perfect_punctuation',
      weight: 10,
      description: 'Unusually consistent punctuation patterns'
    });
    suspicionScore += 10;
  }

  // Signal 3: Common AI phrases
  const aiPhrases = [
    'it\'s important to note',
    'it\'s worth noting',
    'in conclusion',
    'to summarize',
    'as an ai',
    'as a language model',
    'delve into',
    'dive into',
    'in today\'s world',
    'in this day and age',
    'game changer',
    'foster a sense of',
    'navigate the complexities'
  ];

  const lowerText = text.toLowerCase();
  const foundPhrases = aiPhrases.filter(p => lowerText.includes(p));

  if (foundPhrases.length > 0) {
    signals.push({
      signal: 'ai_phrases_detected',
      weight: 10 * foundPhrases.length,
      description: `AI-typical phrases found: ${foundPhrases.join(', ')}`
    });
    suspicionScore += 10 * foundPhrases.length;
  }

  // Signal 4: Uniform sentence length
  const sentenceLengths = sentences.map(s => s.split(' ').length);
  const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  const variance = sentenceLengths.reduce((acc, len) => acc + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev < 5 && sentences.length > 5) {
    signals.push({
      signal: 'uniform_sentence_length',
      weight: 10,
      description: `Low sentence length variance (σ=${stdDev.toFixed(1)})`
    });
    suspicionScore += 10;
  }

  // Cap at 100
  suspicionScore = Math.min(suspicionScore, 100);

  return {
    source: 'text_heuristics',
    score: suspicionScore,
    confidence: 0.55,
    metadata: {
      signals,
      sentenceCount: sentences.length,
      avgSentenceLength: avgLength.toFixed(1),
      note: 'Heuristic analysis based on text patterns'
    }
  };
}

/**
 * Heuristic Analysis
 * Compression artifact and metadata analysis (no API required)
 *
 * Based on research showing AI-generated images have distinct
 * compression signatures and metadata patterns.
 *
 * @param {Object} imageData - Image data including EXIF
 * @returns {Object} Heuristic analysis result
 */
export function analyzeHeuristics(imageData) {
  const signals = [];
  let suspicionScore = 0;

  // Signal 1: Missing or suspicious EXIF data
  if (!imageData.exif || Object.keys(imageData.exif).length === 0) {
    signals.push({
      signal: 'missing_exif',
      weight: 15,
      description: 'No EXIF metadata (common in AI-generated images)'
    });
    suspicionScore += 15;
  }

  // Signal 2: No camera make/model
  if (imageData.exif && !imageData.exif.Make && !imageData.exif.Model) {
    signals.push({
      signal: 'no_camera_info',
      weight: 10,
      description: 'No camera manufacturer/model info'
    });
    suspicionScore += 10;
  }

  // Signal 3: Suspicious dimensions (common AI sizes)
  const aiDimensions = [
    [512, 512], [768, 768], [1024, 1024], [1024, 1792], [1792, 1024],
    [512, 768], [768, 512], [1024, 768], [768, 1024]
  ];

  if (imageData.width && imageData.height) {
    const isAIDimension = aiDimensions.some(
      ([w, h]) => imageData.width === w && imageData.height === h
    );
    if (isAIDimension) {
      signals.push({
        signal: 'ai_typical_dimensions',
        weight: 20,
        description: `Dimensions ${imageData.width}x${imageData.height} common in AI generators`
      });
      suspicionScore += 20;
    }
  }

  // Signal 4: No GPS data (can be either way)
  if (imageData.exif && !imageData.exif.GPSLatitude) {
    signals.push({
      signal: 'no_gps',
      weight: 5,
      description: 'No GPS coordinates (inconclusive)'
    });
    suspicionScore += 5;
  }

  // Signal 5: Creation software hints
  const software = imageData.exif?.Software?.toLowerCase() || '';
  const aiSoftware = ['stable diffusion', 'midjourney', 'dall-e', 'firefly', 'novelai'];

  if (aiSoftware.some(s => software.includes(s))) {
    signals.push({
      signal: 'ai_software_detected',
      weight: 50,
      description: `AI generation software detected: ${imageData.exif.Software}`
    });
    suspicionScore += 50;
  }

  // Cap at 100
  suspicionScore = Math.min(suspicionScore, 100);

  return {
    source: 'heuristics',
    score: suspicionScore,
    confidence: 0.60, // Heuristics are less reliable than ML models
    metadata: {
      signals,
      totalSignals: signals.length,
      maxPossibleScore: 100,
      note: 'Heuristic analysis based on metadata patterns'
    }
  };
}

/**
 * Run all detectors in parallel
 * Gracefully handles API failures
 *
 * @param {string} imageUrl - URL of image to analyze
 * @param {Object} imageData - Image metadata for heuristics
 * @param {Object} apiKeys - API credentials
 * @returns {Object[]} Array of detector results
 */
export async function runAllDetectors(imageUrl, imageData, apiKeys = {}) {
  const results = await Promise.all([
    detectWithHive(imageUrl, apiKeys.hive),
    detectWithSightEngine(imageUrl, apiKeys.sightengineUser, apiKeys.sightengineSecret),
    detectWithIlluminarty(imageUrl, apiKeys.illuminarty),
    Promise.resolve(analyzeHeuristics(imageData))
  ]);

  return results;
}

/**
 * Run all text detectors in parallel
 * Gracefully handles API failures
 *
 * @param {string} text - Text to analyze
 * @param {Object} apiKeys - API credentials
 * @returns {Object[]} Array of detector results
 */
export async function runAllTextDetectors(text, apiKeys = {}) {
  const results = await Promise.all([
    detectTextWithGPTZero(text, apiKeys.gptzero),
    detectTextWithOriginality(text, apiKeys.originality),
    Promise.resolve(analyzeTextHeuristics(text))
  ]);

  return results;
}

export default {
  // Image detectors
  detectWithHive,
  detectWithSightEngine,
  detectWithIlluminarty,
  analyzeHeuristics,
  runAllDetectors,
  // Text detectors
  detectTextWithGPTZero,
  detectTextWithOriginality,
  analyzeTextHeuristics,
  runAllTextDetectors
};
