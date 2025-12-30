/**
 * DetectorPanel - Individual detector results display
 *
 * Shows each detector's score with visual bars and metadata.
 * Transparency is key for enterprise trust.
 *
 * @author Raf Khatchadourian
 */

import React from 'react';
import { DETECTOR_WEIGHTS } from '../api/scoring';

// Detector display configurations
const DETECTOR_CONFIG = {
  hive: {
    name: 'Hive AI',
    description: 'Specialized deepfake detection',
    color: 'bg-purple-500',
    url: 'https://thehive.ai'
  },
  sightengine: {
    name: 'SightEngine',
    description: 'Multi-model AI detection',
    color: 'bg-blue-500',
    url: 'https://sightengine.com'
  },
  illuminarty: {
    name: 'Illuminarty',
    description: 'Academic AI detection',
    color: 'bg-indigo-500',
    url: 'https://illuminarty.ai'
  },
  heuristics: {
    name: 'Heuristics',
    description: 'Metadata & artifact analysis',
    color: 'bg-gray-500',
    url: null
  }
};

function DetectorCard({ detector }) {
  const config = DETECTOR_CONFIG[detector.source] || {
    name: detector.source,
    description: 'Unknown detector',
    color: 'bg-gray-400',
    url: null
  };

  const weight = DETECTOR_WEIGHTS[detector.source] || 0;
  const hasScore = detector.score !== null && detector.score !== undefined;
  const hasError = detector.error && !hasScore;

  return (
    <div className={`bg-white rounded-lg border p-4 ${hasError ? 'border-gray-200 opacity-60' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium text-gray-900">
            {config.url ? (
              <a
                href={config.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600"
              >
                {config.name}
              </a>
            ) : (
              config.name
            )}
          </h4>
          <p className="text-xs text-gray-500">{config.description}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400">
            Weight: {(weight * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Score Display */}
      {hasScore ? (
        <>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold text-gray-900">
              {detector.score.toFixed(1)}
            </span>
            <span className="text-gray-500 mb-1">%</span>
          </div>

          {/* Score Bar */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${config.color} transition-all duration-500`}
              style={{ width: `${Math.min(detector.score, 100)}%` }}
            />
          </div>

          {/* Confidence */}
          <div className="mt-2 text-xs text-gray-500">
            Confidence: {(detector.confidence * 100).toFixed(0)}%
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-400 italic">
          {detector.error || 'No result'}
        </div>
      )}

      {/* Metadata */}
      {detector.metadata && Object.keys(detector.metadata).length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
            View details
          </summary>
          <div className="mt-2 text-xs bg-gray-50 rounded p-2 overflow-auto max-h-32">
            <pre className="text-gray-600">
              {JSON.stringify(detector.metadata, null, 2)}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}

export default function DetectorPanel({ detectors }) {
  // Separate available and unavailable detectors
  const available = detectors.filter(d => d.score !== null);
  const unavailable = detectors.filter(d => d.score === null);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">
        Detection Results
        <span className="ml-2 text-sm font-normal text-gray-500">
          ({available.length} of {detectors.length} detectors)
        </span>
      </h3>

      {/* Available Detectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {detectors.map((detector) => (
          <DetectorCard key={detector.source} detector={detector} />
        ))}
      </div>

      {/* Scoring Explanation */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">
        <strong>How scoring works:</strong> Each detector's score is weighted by
        its reliability. The ensemble score is a weighted average, and variance
        measures detector agreement. High variance (σ &gt; 25) indicates
        conflicting signals.
      </div>
    </div>
  );
}
