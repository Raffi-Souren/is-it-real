/**
 * Vercel Serverless Function - Vision LLM Council
 *
 * Uses vision-capable LLMs to analyze images for AI-generation artifacts.
 * Inspired by compliance_judge.py "LLM Council" approach from the research.
 *
 * Key insight: Single detectors inherit stochastic behavior; multi-model
 * consensus provides more reliable detection.
 */

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Need at least one vision API
  if (!geminiKey && !openaiKey) {
    return res.status(500).json({
      error: 'No vision API configured',
      source: 'vision_council'
    });
  }

  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 required' });
    }

    const councilResults = [];

    // Comprehensive prompt for AI generation AND deepfake detection (2025 state-of-art)
    const visionPrompt = `You are an expert forensic analyst specializing in detecting AI-generated images, deepfakes, and face swaps.

## CRITICAL ANALYSIS STEPS

### Step 1: CONTEXT CHECK (Very Important!)
- Does this image show famous/notable people in unusual or controversial contexts?
- "Fake meeting" images (celebrities with controversial figures) are a common AI misuse
- If you recognize public figures, ask: Does this meeting make sense? Is this plausible?

### Step 2: HAND & FINGER ANALYSIS (Key AI Giveaway)
- Count fingers on all visible hands - AI often gets this wrong
- Check if fingers are poorly defined, fused, or lack detail
- Look for hands that appear simplified or lack realistic knuckle/joint detail

### Step 3: SKIN & TEXTURE ANALYSIS
- AI skin often has a "plastic" or smoothed-over appearance
- Look for unnatural uniformity - real skin has pores, imperfections, variation
- Compare skin texture between face, neck, and hands - mismatches indicate manipulation

### Step 4: DETAIL CONSISTENCY
- Watches, jewelry, text should have clear, consistent details
- Blurry accessories (watch faces, rings) while rest is sharp = red flag
- Check reflections - do they match the environment?

### Step 5: LIGHTING & SHADOWS
- Are shadows consistent across all subjects?
- Does lighting on faces match the ambient lighting?
- Look for impossible shadow directions or missing shadows

### Step 6: BACKGROUND ANALYSIS
- Wood grain, fabric patterns should be consistent
- Look for unexplained glares, smudges, or artifacts
- Background objects should connect properly to scene

### Step 7: FACE SWAP / DEEPFAKE SPECIFIC
- Skin tone mismatch between face and neck/body
- Blurring or color shifts at hairline/face boundaries
- One face looking "off" compared to others in frame
- Eyes: check for unnatural reflections, dead/flat appearance

## Output Format (JSON only, be thorough)
{
  "ai_generated_probability": 0-100,
  "deepfake_probability": 0-100,
  "confidence": 0-100,
  "is_deepfake": true/false,
  "is_fake_meeting": true/false,
  "artifacts_detected": ["be specific: e.g., 'right hand has poorly defined fingers', 'watch is blurry'"],
  "deepfake_indicators": ["specific face manipulation signs"],
  "context_red_flags": ["e.g., 'famous person in implausible scenario'"],
  "faces_analyzed": "describe each face and whether it appears manipulated",
  "suspected_generator": "deepfake|face_swap|midjourney|dalle|stable_diffusion|firefly|google_ai|unknown|none",
  "explanation": "Detailed explanation of findings"
}`;

    // Call Gemini Vision if available
    if (geminiKey) {
      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: visionPrompt },
                  {
                    inline_data: {
                      mime_type: 'image/png',
                      data: imageBase64
                    }
                  }
                ]
              }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 1024
              }
            })
          }
        );

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

          // Parse JSON from response
          const jsonMatch = geminiText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              // Use MAX of ai_generated and deepfake probability
              const aiScore = parsed.ai_generated_probability || 0;
              const deepfakeScore = parsed.deepfake_probability || 0;
              const finalScore = Math.max(aiScore, deepfakeScore);

              councilResults.push({
                model: 'gemini-2.0-flash',
                score: finalScore,
                aiScore: aiScore,
                deepfakeScore: deepfakeScore,
                isDeepfake: parsed.is_deepfake || deepfakeScore > 50,
                isFakeMeeting: parsed.is_fake_meeting || false,
                confidence: (parsed.confidence || 70) / 100,
                artifacts: parsed.artifacts_detected || [],
                deepfakeIndicators: parsed.deepfake_indicators || [],
                contextRedFlags: parsed.context_red_flags || [],
                facesAnalyzed: parsed.faces_analyzed || '',
                generator: parsed.suspected_generator || 'unknown',
                explanation: parsed.explanation || ''
              });
            } catch (e) {
              console.error('Gemini JSON parse error:', e);
            }
          }
        }
      } catch (geminiError) {
        console.error('Gemini error:', geminiError);
      }
    }

    // Call OpenAI Vision if available
    if (openaiKey) {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: visionPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${imageBase64}`,
                    detail: 'high'
                  }
                }
              ]
            }],
            temperature: 0.1,
            max_tokens: 1024
          })
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          const openaiText = openaiData.choices?.[0]?.message?.content || '';

          const jsonMatch = openaiText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              const aiScore = parsed.ai_generated_probability || 0;
              const deepfakeScore = parsed.deepfake_probability || 0;
              const finalScore = Math.max(aiScore, deepfakeScore);

              councilResults.push({
                model: 'gpt-4o-mini',
                score: finalScore,
                aiScore: aiScore,
                deepfakeScore: deepfakeScore,
                isDeepfake: parsed.is_deepfake || deepfakeScore > 50,
                isFakeMeeting: parsed.is_fake_meeting || false,
                confidence: (parsed.confidence || 70) / 100,
                artifacts: parsed.artifacts_detected || [],
                deepfakeIndicators: parsed.deepfake_indicators || [],
                contextRedFlags: parsed.context_red_flags || [],
                facesAnalyzed: parsed.faces_analyzed || '',
                generator: parsed.suspected_generator || 'unknown',
                explanation: parsed.explanation || ''
              });
            } catch (e) {
              console.error('OpenAI JSON parse error:', e);
            }
          }
        }
      } catch (openaiError) {
        console.error('OpenAI error:', openaiError);
      }
    }

    // No results from any model
    if (councilResults.length === 0) {
      return res.status(500).json({
        error: 'All vision models failed',
        source: 'vision_council'
      });
    }

    // Calculate council consensus (average with variance awareness)
    const scores = councilResults.map(r => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Variance indicates disagreement
    const variance = scores.length > 1
      ? Math.sqrt(scores.reduce((acc, s) => acc + Math.pow(s - avgScore, 2), 0) / scores.length)
      : 0;

    // Confidence decreases with variance (council disagrees = less certain)
    const avgConfidence = councilResults.reduce((a, r) => a + r.confidence, 0) / councilResults.length;
    const adjustedConfidence = Math.max(0.3, avgConfidence - (variance / 100));

    // Collect all detected artifacts and deepfake indicators
    const allArtifacts = [...new Set(councilResults.flatMap(r => r.artifacts || []))];
    const allDeepfakeIndicators = [...new Set(councilResults.flatMap(r => r.deepfakeIndicators || []))];
    const allContextRedFlags = [...new Set(councilResults.flatMap(r => r.contextRedFlags || []))];

    // Check if any model detected deepfake
    const anyDeepfakeDetected = councilResults.some(r => r.isDeepfake);
    const anyFakeMeetingDetected = councilResults.some(r => r.isFakeMeeting);

    // Get max deepfake score
    const maxDeepfakeScore = Math.max(...councilResults.map(r => r.deepfakeScore || 0));

    return res.status(200).json({
      source: 'vision_council',
      score: Math.round(avgScore * 100) / 100,
      confidence: Math.round(adjustedConfidence * 100) / 100,
      isDeepfake: anyDeepfakeDetected,
      isFakeMeeting: anyFakeMeetingDetected,
      deepfakeScore: maxDeepfakeScore,
      metadata: {
        modelsUsed: councilResults.map(r => r.model),
        modelCount: councilResults.length,
        variance: Math.round(variance * 100) / 100,
        artifactsDetected: allArtifacts,
        deepfakeIndicators: allDeepfakeIndicators,
        contextRedFlags: allContextRedFlags,
        facesAnalyzed: councilResults.map(r => r.facesAnalyzed).filter(Boolean).join('; '),
        councilDetails: councilResults.map(r => ({
          model: r.model,
          score: r.score,
          aiScore: r.aiScore,
          deepfakeScore: r.deepfakeScore,
          isDeepfake: r.isDeepfake,
          generator: r.generator,
          explanation: r.explanation
        }))
      }
    });

  } catch (error) {
    console.error('Vision Council error:', error);
    return res.status(500).json({
      error: error.message,
      source: 'vision_council'
    });
  }
}
