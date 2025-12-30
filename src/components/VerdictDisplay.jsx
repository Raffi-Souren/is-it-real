/**
 * VerdictDisplay - Shows final verification verdict
 *
 * Visual display of authenticity verdict with confidence meter
 * and actionable recommendations.
 *
 * @author Raf Khatchadourian
 */

import React from 'react';
import { VERDICTS } from '../api/scoring';

// Verdict styling configurations
const VERDICT_CONFIG = {
  [VERDICTS.VERIFIED_AUTHENTIC]: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: '✓',
    iconBg: 'bg-green-500',
    label: 'Verified Authentic',
    description: 'Content has valid cryptographic provenance.'
  },
  [VERDICTS.LIKELY_AUTHENTIC]: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: '✓',
    iconBg: 'bg-green-400',
    label: 'Likely Authentic',
    description: 'Low AI indicators with consistent detection.'
  },
  [VERDICTS.UNCERTAIN]: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: '?',
    iconBg: 'bg-yellow-500',
    label: 'Uncertain',
    description: 'Ambiguous signals require human review.'
  },
  [VERDICTS.LIKELY_SYNTHETIC]: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    icon: '!',
    iconBg: 'bg-red-500',
    label: 'Likely Synthetic',
    description: 'High AI indicators detected.'
  },
  [VERDICTS.INCONCLUSIVE]: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    icon: '~',
    iconBg: 'bg-gray-500',
    label: 'Inconclusive',
    description: 'Detectors disagree significantly.'
  }
};

export default function VerdictDisplay({ verdict }) {
  const config = VERDICT_CONFIG[verdict.verdict] || VERDICT_CONFIG[VERDICTS.INCONCLUSIVE];
  const { summary } = verdict;

  return (
    <div className={`rounded-lg border-2 ${config.border} ${config.bg} p-6`}>
      {/* Main Verdict */}
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center text-white text-2xl font-bold`}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1">
          <h2 className={`text-xl font-bold ${config.text}`}>
            {config.label}
          </h2>
          <p className="text-gray-600 mt-1">
            {verdict.explanation || config.description}
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      {summary && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Ensemble Score */}
          {summary.score !== null && (
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {summary.score.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                AI Score
              </div>
            </div>
          )}

          {/* Variance */}
          {summary.variance !== null && (
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">
                σ {summary.variance.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Variance
              </div>
            </div>
          )}

          {/* Confidence */}
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {(summary.confidence * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Confidence
            </div>
          </div>

          {/* Detectors Used */}
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {summary.hasProvenance ? 'C2PA' : `${summary.detectorsUsed}/4`}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              {summary.hasProvenance ? 'Verified' : 'Detectors'}
            </div>
          </div>
        </div>
      )}

      {/* Confidence Bar */}
      {summary && summary.confidence !== undefined && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Confidence Level</span>
            <span>{(summary.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                summary.confidence > 0.7 ? 'bg-green-500' :
                summary.confidence > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${summary.confidence * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Recommendation */}
      {verdict.recommendation && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Recommendation:</span>
            <span className="text-sm text-gray-600">{verdict.recommendation}</span>
          </div>
        </div>
      )}
    </div>
  );
}
