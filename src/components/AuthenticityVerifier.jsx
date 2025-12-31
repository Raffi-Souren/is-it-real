/**
 * AuthenticityVerifier - Main Component
 *
 * Drag-and-drop and URL-based media verification with provenance-first architecture.
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

// Mobile detection
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// File size limits (bytes)
const MAX_FILE_SIZE_MOBILE = 5 * 1024 * 1024; // 5MB for mobile
const MAX_FILE_SIZE_DESKTOP = 10 * 1024 * 1024; // 10MB for desktop

export default function AuthenticityVerifier() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('idle'); // idle, provenance, detection, complete
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);

  // Global error handler for mobile
  React.useEffect(() => {
    const handleError = (event) => {
      console.error('Global error:', event.error);
      if (event.error?.message?.includes('memory') || event.error?.name === 'QuotaExceededError') {
        setError('Out of memory. Please try a smaller image or close other apps/tabs.');
        setLoading(false);
        setIsCompressing(false);
      }
    };

    const handleUnhandledRejection = (event) => {
      console.error('Unhandled rejection:', event.reason);
      if (event.reason?.message?.includes('memory') || event.reason?.name === 'QuotaExceededError') {
        setError('Out of memory. Please try a smaller image or close other apps/tabs.');
        setLoading(false);
        setIsCompressing(false);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Compress/resize image for mobile compatibility
  const compressImage = async (file, maxSizeMB = 2) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions (max 1920px on longest side for mobile)
          const maxDimension = isMobile() ? 1920 : 2560;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }

          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob with quality adjustment
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: file.type || 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            },
            file.type || 'image/jpeg',
            0.85 // Quality
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Handle file drop
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    let droppedFile = e.dataTransfer?.files?.[0] || e.target?.files?.[0];

    if (!droppedFile) return;

    // Validate file type
    if (!droppedFile.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, WebP)');
      return;
    }

    // Check file size and compress if needed
    const maxSize = isMobile() ? MAX_FILE_SIZE_MOBILE : MAX_FILE_SIZE_DESKTOP;

    if (droppedFile.size > maxSize) {
      setIsCompressing(true);
      setError(null);

      try {
        const compressed = await compressImage(droppedFile);

        // Check if compression was successful
        if (compressed.size > maxSize) {
          setError(
            `Image too large (${(droppedFile.size / 1024 / 1024).toFixed(1)}MB). ` +
            `Please use an image smaller than ${maxSize / 1024 / 1024}MB. ` +
            (isMobile() ? 'Mobile devices have memory limitations.' : '')
          );
          setIsCompressing(false);
          return;
        }

        droppedFile = compressed;
        console.log(`Compressed image from ${(droppedFile.size / 1024 / 1024).toFixed(1)}MB to ${(compressed.size / 1024 / 1024).toFixed(1)}MB`);
      } catch (compressionError) {
        console.error('Compression error:', compressionError);
        setError(
          `Image too large and compression failed. Please resize the image to under ${maxSize / 1024 / 1024}MB before uploading.`
        );
        setIsCompressing(false);
        return;
      }

      setIsCompressing(false);
    }

    setFile(droppedFile);
    setPreview(URL.createObjectURL(droppedFile));
    setResult(null);
    setError(null);
    setImageUrl(''); // Clear URL input
  }, []);

  // Handle URL input change
  const handleUrlChange = (e) => {
    setImageUrl(e.target.value);
    setError(null);
  };

  // Fetch image from URL and convert to File object
  const fetchImageAsFile = async (url) => {
    try {
      // Use our CORS proxy to fetch the image
      const response = await fetch(`/api/cors-proxy?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
      }
      const blob = await response.blob();
      const fileName = url.substring(url.lastIndexOf('/') + 1) || 'image.jpg';
      return new File([blob], fileName, { type: blob.type });
    } catch (err) {
      console.error('Fetch image error:', err);
      setError(`Could not load image from URL. It may be private or invalid. Details: ${err.message}`);
      return null;
    }
  };

  // Handle verification from URL
  const handleUrlVerify = async () => {
    if (!imageUrl) {
      setError('Please enter an image URL');
      return;
    }
    setError(null);
    setResult(null);
    setFile(null);
    setPreview(null);

    const imageFile = await fetchImageAsFile(imageUrl);
    if (imageFile) {
      setFile(imageFile);
      setPreview(URL.createObjectURL(imageFile));
      // The verify function will be triggered by the useEffect
    }
  };

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

  // Run verification pipeline with robust error handling for mobile
  const verify = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // Stage 1: Provenance check
      setStage('provenance');
      let provenanceResult;
      try {
        provenanceResult = await checkProvenance(file);
      } catch (provErr) {
        console.error('Provenance check failed:', provErr);
        // Continue with default provenance result
        provenanceResult = {
          hasVerifiedProvenance: false,
          c2pa: null,
          imageData: { width: 0, height: 0, exif: {} }
        };
      }

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
      let imageBase64;
      try {
        imageBase64 = await fileToBase64(file);
      } catch (b64Err) {
        console.error('Base64 conversion failed:', b64Err);
        const errorMsg = isMobile()
          ? 'Failed to process image. Your device may have limited memory. Try a smaller image.'
          : 'Failed to process image. Try a smaller file.';
        throw new Error(errorMsg);
      }

      // Run all detectors in parallel with base64 data
      let detectorResults;
      try {
        detectorResults = await runAllDetectors(
          null, // No URL needed when using base64
          provenanceResult.imageData,
          API_KEYS,
          imageBase64
        );
      } catch (detectErr) {
        console.error('Detection failed:', detectErr);
        // If all detectors fail, show error to user
        if (isMobile() && detectErr.message?.includes('memory')) {
          throw new Error('Detection failed due to memory constraints. Please try a smaller image.');
        }
        // Use empty results to still show a verdict
        detectorResults = [];
      }

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
      const errorMsg = err.message ||
        (isMobile()
          ? 'Verification failed. Mobile devices have memory limitations - try a smaller image.'
          : 'Verification failed. Please try again.');
      setError(errorMsg);
      setStage('idle');
    } finally {
      setLoading(false);
    }
  }, [file]);

  // Reset state
  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStage('idle');
    setImageUrl('');
  };

  // Automatically trigger verify when a file is set (either from drop or URL)
  React.useEffect(() => {
    if (file && !result && !loading) {
      verify();
    }
  }, [file, result, loading, verify]);

  return (
    <div className="max-w-4xl mx-auto p-6 min-h-screen">
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

      {/* Input Area */}
      {!file && (
        <div className="space-y-4">
          {/* Drop Zone */}
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
                {isMobile() && (
                  <p className="text-xs text-blue-600 mt-2">
                    Recommended: Images under 5MB for best mobile performance
                  </p>
                )}
              </div>
            </label>
          </div>

          {/* URL Input */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={imageUrl}
              onChange={handleUrlChange}
              placeholder="Or paste an image URL here"
              className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              onClick={handleUrlVerify}
              disabled={loading || !imageUrl}
              className={`py-3 px-6 rounded-lg font-medium text-white transition-colors ${
                loading || !imageUrl
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Verify URL
            </button>
          </div>
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

          {/* Verify Button (now hidden, verification is automatic) */}
          {/* ... */}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Compression Indicator */}
          {isCompressing && (
            <div className="w-full py-3 px-6 rounded-lg font-medium text-white bg-blue-500">
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Compressing image for mobile...
              </span>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
             <div className="w-full py-3 px-6 rounded-lg font-medium text-white bg-gray-400 cursor-not-allowed">
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {stage === 'provenance' ? 'Checking provenance...' : 'Running detection...'}
                </span>
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
          <li><strong>Ensemble Detection:</strong> Hive AI, SightEngine, Vision LLM Council, and heuristics</li>
          <li><strong>Vision LLM Council:</strong> Uses Gemini 2.0 Flash to analyze images for AI artifacts</li>
          <li><strong>Weighted Scoring:</strong> Combine results with variance-based confidence</li>
          <li><strong>Audit Trail:</strong> Full transparency on all signals and decisions</li>
        </ol>
        <p className="mt-4">
          Based on{' '}
          <a href="https://arxiv.org/abs/2511.07585" className="text-blue-600 hover:underline">
            LLM Output Drift v2
          </a>
          {' '}and{' '}
          <a href="https://github.com/karpathy/llm-council" className="text-blue-600 hover:underline">
            LLM Council
          </a>
          {' '}approaches.
        </p>
      </footer>
    </div>
  );
}
