/**
 * Ensemble Scoring Algorithm for Media Authenticity Verification
 *
 * Based on faithfulness.py patterns from LLM Output Drift research.
 * Implements weighted ensemble scoring with variance-based confidence.
 *
 * Key insight from our research (arXiv:2511.07585):
 * - Single-model detection inherits LLM inconsistency problems
 * - Ensemble approaches with deterministic aggregation are more reliable
 * - Variance across detectors signals uncertainty (like drift variance)
 *
 * @author Raf Khatchadourian
 * @see econometrics/agentic/metrics/faithfulness.py
 */

// Detector weights (calibrated based on accuracy/reliability)
export const DETECTOR_WEIGHTS = {
  hive: 0.30,           // Specialized deepfake detection
  sightengine: 0.25,    // Multi-model ensemble
  illuminarty: 0.25,    // Academic partnerships
  heuristics: 0.20      // Compression artifact analysis
};

// Verdict thresholds
export const THRESHOLDS = {
  LIKELY_AUTHENTIC: 30,      // Score < 30% = likely authentic
  UNCERTAIN_LOW: 30,         // Score 30-70% = uncertain
  UNCERTAIN_HIGH: 70,
  LIKELY_SYNTHETIC: 70,      // Score > 70% = likely synthetic
  VARIANCE_MODERATE: 15,     // σ < 15 = consistent detectors
  VARIANCE_HIGH: 25          // σ > 25 = detectors disagree
};

// Verdict types (matching our 2x2 matrix from faithfulness.py)
export const VERDICTS = {
  VERIFIED_AUTHENTIC: 'VERIFIED_AUTHENTIC',     // C2PA credentials present
  LIKELY_AUTHENTIC: 'LIKELY_AUTHENTIC',         // Low score, low variance
  UNCERTAIN: 'UNCERTAIN',                       // Mid score or moderate variance
  LIKELY_SYNTHETIC: 'LIKELY_SYNTHETIC',         // High score, low variance
  INCONCLUSIVE: 'INCONCLUSIVE'                  // High variance (detector disagreement)
};

/**
 * Calculate variance of detector scores
 * Used to measure detector agreement (like semantic divergence in our research)
 *
 * @param {number[]} scores - Array of detector scores (0-100)
 * @returns {number} Standard deviation
 */
export function calculateVariance(scores) {
  if (scores.length === 0) return 0;
  if (scores.length === 1) return 0;

  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const squaredDiffs = scores.map(s => Math.pow(s - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / scores.length;

  return Math.sqrt(variance);
}

/**
 * Calculate weighted ensemble score from multiple detectors
 *
 * Pattern from faithfulness.py:
 * - Evidence grounding → Provenance check
 * - Evidence alignment → Detector agreement
 * - Constraint satisfaction → Policy thresholds
 *
 * @param {Object[]} results - Array of detector results
 * @param {string} results[].source - Detector name (hive, sightengine, etc.)
 * @param {number|null} results[].score - AI probability score (0-100) or null if unavailable
 * @param {number} results[].confidence - Detector's self-reported confidence (0-1)
 * @param {Object} results[].metadata - Additional detector-specific data
 * @returns {Object} Ensemble result with score, variance, confidence, and audit trail
 */
export function calculateEnsembleScore(results) {
  // Filter to available results (graceful degradation if API fails)
  const available = results.filter(r => r.score !== null && r.score !== undefined);

  if (available.length === 0) {
    return {
      score: null,
      variance: null,
      confidence: 0,
      availableDetectors: 0,
      audit: {
        timestamp: new Date().toISOString(),
        detectors: [],
        note: 'No detector results available'
      }
    };
  }

  // Calculate weighted sum
  let weightedSum = 0;
  let totalWeight = 0;
  const scores = [];

  for (const result of available) {
    const weight = DETECTOR_WEIGHTS[result.source] || 0.10; // Default weight for unknown
    weightedSum += result.score * weight;
    totalWeight += weight;
    scores.push(result.score);
  }

  // Normalize by total weight (handles missing detectors)
  const ensembleScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Calculate variance (detector agreement)
  const variance = calculateVariance(scores);

  // Confidence is inversely related to variance
  // High variance = low confidence (detectors disagree)
  const confidence = Math.max(0, 1 - (variance / 50));

  return {
    score: Math.round(ensembleScore * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    availableDetectors: available.length,
    audit: {
      timestamp: new Date().toISOString(),
      detectors: available.map(r => ({
        source: r.source,
        score: r.score,
        weight: DETECTOR_WEIGHTS[r.source] || 0.10,
        confidence: r.confidence,
        metadata: r.metadata
      })),
      weights: DETECTOR_WEIGHTS,
      calculation: {
        weightedSum,
        totalWeight,
        normalizedScore: ensembleScore
      }
    }
  };
}

/**
 * Determine final verdict based on ensemble score and variance
 *
 * Decision matrix (from our determinism-faithfulness research):
 *
 *                    Low Variance        High Variance
 *   Low Score        LIKELY_AUTHENTIC    INCONCLUSIVE
 *   Mid Score        UNCERTAIN           INCONCLUSIVE
 *   High Score       LIKELY_SYNTHETIC    INCONCLUSIVE
 *
 * @param {Object} ensembleResult - Result from calculateEnsembleScore
 * @param {Object|null} provenanceResult - Result from provenance check
 * @returns {Object} Final verdict with explanation
 */
export function determineVerdict(ensembleResult, provenanceResult = null) {
  // Priority 1: C2PA credentials trump everything
  if (provenanceResult?.hasCredentials && provenanceResult?.isValid) {
    return {
      verdict: VERDICTS.VERIFIED_AUTHENTIC,
      confidence: 1.0,
      explanation: 'Content has valid C2PA credentials from trusted issuer.',
      factors: {
        provenance: {
          present: true,
          valid: true,
          issuer: provenanceResult.issuer,
          timestamp: provenanceResult.signedAt
        },
        detection: ensembleResult // Still include for transparency
      },
      recommendation: 'TRUST - Cryptographically verified provenance.',
      auditTrail: {
        timestamp: new Date().toISOString(),
        method: 'provenance-first',
        provenanceCheck: provenanceResult,
        ensembleCheck: ensembleResult
      }
    };
  }

  // Priority 2: Ensemble detection
  const { score, variance, confidence: ensembleConfidence } = ensembleResult;

  // Handle case where no detection results
  if (score === null) {
    return {
      verdict: VERDICTS.INCONCLUSIVE,
      confidence: 0,
      explanation: 'Unable to analyze content. No detection results available.',
      factors: { provenance: provenanceResult, detection: ensembleResult },
      recommendation: 'MANUAL REVIEW - Automated analysis unavailable.',
      auditTrail: {
        timestamp: new Date().toISOString(),
        method: 'ensemble-fallback',
        error: 'No detector results'
      }
    };
  }

  // High variance = detectors disagree = inconclusive
  if (variance > THRESHOLDS.VARIANCE_HIGH) {
    return {
      verdict: VERDICTS.INCONCLUSIVE,
      confidence: ensembleConfidence,
      explanation: `Detectors disagree significantly (σ=${variance.toFixed(1)}). Cannot determine authenticity.`,
      factors: { provenance: provenanceResult, detection: ensembleResult },
      recommendation: 'MANUAL REVIEW - Detection signals conflict.',
      auditTrail: {
        timestamp: new Date().toISOString(),
        method: 'ensemble-variance-check',
        varianceExceedsThreshold: true
      }
    };
  }

  // Low score + low variance = likely authentic
  if (score < THRESHOLDS.LIKELY_AUTHENTIC && variance < THRESHOLDS.VARIANCE_MODERATE) {
    return {
      verdict: VERDICTS.LIKELY_AUTHENTIC,
      confidence: ensembleConfidence,
      explanation: `Low AI probability (${score.toFixed(1)}%) with consistent detection (σ=${variance.toFixed(1)}).`,
      factors: { provenance: provenanceResult, detection: ensembleResult },
      recommendation: 'LIKELY SAFE - Low synthetic indicators.',
      auditTrail: {
        timestamp: new Date().toISOString(),
        method: 'ensemble-threshold',
        thresholdUsed: THRESHOLDS.LIKELY_AUTHENTIC
      }
    };
  }

  // High score + low variance = likely synthetic
  if (score > THRESHOLDS.LIKELY_SYNTHETIC && variance < THRESHOLDS.VARIANCE_MODERATE) {
    return {
      verdict: VERDICTS.LIKELY_SYNTHETIC,
      confidence: ensembleConfidence,
      explanation: `High AI probability (${score.toFixed(1)}%) with consistent detection (σ=${variance.toFixed(1)}).`,
      factors: { provenance: provenanceResult, detection: ensembleResult },
      recommendation: 'CAUTION - Strong synthetic indicators.',
      auditTrail: {
        timestamp: new Date().toISOString(),
        method: 'ensemble-threshold',
        thresholdUsed: THRESHOLDS.LIKELY_SYNTHETIC
      }
    };
  }

  // Everything else = uncertain
  return {
    verdict: VERDICTS.UNCERTAIN,
    confidence: ensembleConfidence,
    explanation: `Moderate AI probability (${score.toFixed(1)}%) or variance (σ=${variance.toFixed(1)}).`,
    factors: { provenance: provenanceResult, detection: ensembleResult },
    recommendation: 'REVIEW - Ambiguous signals require human judgment.',
    auditTrail: {
      timestamp: new Date().toISOString(),
      method: 'ensemble-threshold',
      scoreInRange: `${THRESHOLDS.UNCERTAIN_LOW}-${THRESHOLDS.UNCERTAIN_HIGH}`,
      varianceInRange: `${THRESHOLDS.VARIANCE_MODERATE}-${THRESHOLDS.VARIANCE_HIGH}`
    }
  };
}

/**
 * Full verification pipeline
 *
 * Architecture: Provenance → Ensemble → Verdict
 * (Mirrors our replayable agents: Evidence → Tools → Decision)
 *
 * @param {Object} provenanceResult - C2PA/EXIF check result
 * @param {Object[]} detectorResults - Array of detector API results
 * @returns {Object} Complete verification result with audit trail
 */
export function verifyContent(provenanceResult, detectorResults) {
  const ensembleResult = calculateEnsembleScore(detectorResults);
  const verdict = determineVerdict(ensembleResult, provenanceResult);

  return {
    ...verdict,
    summary: {
      verdict: verdict.verdict,
      score: ensembleResult.score,
      variance: ensembleResult.variance,
      confidence: verdict.confidence,
      hasProvenance: provenanceResult?.hasCredentials || false,
      detectorsUsed: ensembleResult.availableDetectors
    }
  };
}

// Export for testing
export default {
  DETECTOR_WEIGHTS,
  THRESHOLDS,
  VERDICTS,
  calculateVariance,
  calculateEnsembleScore,
  determineVerdict,
  verifyContent
};
