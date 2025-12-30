/**
 * AuthenticityVerifier - Main Component
 *
 * Drag-and-drop media verification with provenance-first architecture.
 * Shows multi-signal scores and audit trail.
 *
 * @author Raf Khatchadourian
 */

import React, { useState, useCallback } from 'react';
import { checkProvenance } from '../api/provenance';
import { runAllDetectors } from '../api/detectors';
import { verifyContent, VERDICTS } from '../api/scoring';
import VerdictDisplay from './VerdictDisplay';
import DetectorPanel from './DetectorPanel';
import ProvenanceCheck from './ProvenanceCheck';

// Get API keys from environment (Vite)
const API_KEYS = {
  hive: import.meta.env.VITE_HIVE_API_KEY,
  sightengineUser: import.meta.env.VITE_SIGHTENGINE_API_USER,
  sightengineSecret: import.meta.env.VITE_SIGHTENGINE_API_SECRET,
  illuminarty: import.meta.env.VITE_ILLUMINARTY_API_KEY
};

export default function AuthenticityVerifier() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('idle'); // idle, provenance, detection, complete
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Handle file drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer?.files?.[0] || e.target?.files?.[0];

    if (!droppedFile) return;

    // Validate file type
    if (!droppedFile.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, WebP)');
      return;
    }

    setFile(droppedFile);
    setPreview(URL.createObjectURL(droppedFile));
    setResult(null);
    setError(null);
  }, []);

  // Prevent default drag behavior
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Run verification pipeline
  const verify = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Stage 1: Provenance check
      setStage('provenance');
      const provenanceResult = await checkProvenance(file);

      // If valid C2PA credentials, we can skip detection
      if (provenanceResult.hasVerifiedProvenance) {
        const finalResult = verifyContent(
          { hasCredentials: true, isValid: true, ...provenanceResult.c2pa },
          []
        );
        setResult({
          provenance: provenanceResult,
          detectors: [],
          verdict: finalResult
        });
        setStage('complete');
        setLoading(false);
        return;
      }

      // Stage 2: Run detection APIs
      setStage('detection');

      // Convert file to base64 for API calls (works on mobile)
      const imageBase64 = await fileToBase64(file);

      // Run all detectors in parallel with base64 data
      const detectorResults = await runAllDetectors(
        null, // No URL needed when using base64
        provenanceResult.imageData,
        API_KEYS,
        imageBase64
      );

      // Stage 3: Calculate verdict
      const finalResult = verifyContent(
        provenanceResult.c2pa,
        detectorResults
      );

      setResult({
        provenance: provenanceResult,
        detectors: detectorResults,
        verdict: finalResult
      });
      setStage('complete');

    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message || 'Verification failed');
      setStage('idle');
    } finally {
      setLoading(false);
    }
  };

  // Reset state
  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStage('idle');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Media Authenticity Verifier
        </h1>
        <p className="text-gray-600">
          Provenance-first verification with ensemble detection.
          {' '}
          <a
            href="https://arxiv.org/abs/2511.07585"
            className="text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Based on LLM Output Drift research
          </a>
          {' | '}
          <a
            href="https://github.com/Raffi-Souren/is-it-real"
            className="text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Results are probabilistic, not definitive. Use as one signal among many for high-stakes decisions.
        </p>
      </header>

      {/* Drop Zone */}
      {!file && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleDrop}
            className="hidden"
            id="file-input"
          />
          <label htmlFor="file-input" className="cursor-pointer">
            <div className="text-gray-500">
              <svg
                className="mx-auto h-12 w-12 mb-4"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-lg mb-2">Drop an image here or click to upload</p>
              <p className="text-sm">PNG, JPG, WebP supported</p>
            </div>
          </label>
        </div>
      )}

      {/* Preview & Controls */}
      {file && (
        <div className="space-y-6">
          {/* Image Preview */}
          <div className="relative bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={preview}
              alt="Preview"
              className="max-h-96 mx-auto object-contain"
            />
            <button
              onClick={reset}
              className="absolute top-2 right-2 bg-white rounded-full p-2 shadow hover:bg-gray-100"
              title="Remove image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* File Info */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">{file.name}</span>
            <span className="mx-2">·</span>
            <span>{(file.size / 1024).toFixed(1)} KB</span>
            <span className="mx-2">·</span>
            <span>{file.type}</span>
          </div>

          {/* Verify Button */}
          {!result && (
            <button
              onClick={verify}
              disabled={loading}
              className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-colors ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {stage === 'provenance' ? 'Checking provenance...' : 'Running detection...'}
                </span>
              ) : (
                'Verify Authenticity'
              )}
            </button>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-6">
              {/* Main Verdict */}
              <VerdictDisplay verdict={result.verdict} />

              {/* Provenance Details */}
              <ProvenanceCheck provenance={result.provenance} />

              {/* Detector Results */}
              {result.detectors.length > 0 && (
                <DetectorPanel detectors={result.detectors} />
              )}

              {/* Audit Trail */}
              <details className="bg-gray-50 rounded-lg p-4">
                <summary className="cursor-pointer font-medium text-gray-700">
                  View Full Audit Trail
                </summary>
                <pre className="mt-4 text-xs overflow-auto bg-gray-900 text-green-400 p-4 rounded">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>

              {/* Reset */}
              <button
                onClick={reset}
                className="w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Verify Another Image
              </button>
            </div>
          )}
        </div>
      )}

      {/* Architecture Note */}
      <footer className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500">
        <h3 className="font-medium text-gray-700 mb-2">How it works</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li><strong>Provenance First:</strong> Check for C2PA Content Credentials (cryptographic proof)</li>
          <li><strong>Ensemble Detection:</strong> If no credentials, run multiple AI detectors in parallel</li>
          <li><strong>Weighted Scoring:</strong> Combine results with variance-based confidence</li>
          <li><strong>Audit Trail:</strong> Full transparency on all signals and decisions</li>
        </ol>
        <p className="mt-4">
          Based on{' '}
          <a href="https://arxiv.org/abs/2511.07585" className="text-blue-600 hover:underline">
            LLM Output Drift v2
          </a>
          {' '}and{' '}
          <a href="#" className="text-blue-600 hover:underline">
            Replayable Agents
          </a>
          {' '}research.
        </p>
      </footer>
    </div>
  );
}
