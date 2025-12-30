/**
 * ProvenanceCheck - C2PA and EXIF metadata display
 *
 * Shows provenance information with emphasis on C2PA credentials
 * as the gold standard for authenticity verification.
 *
 * @author Raf Khatchadourian
 */

import React from 'react';

export default function ProvenanceCheck({ provenance }) {
  if (!provenance) return null;

  const { c2pa, exif, hasVerifiedProvenance, summary } = provenance;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          Provenance Check
        </h3>
        <p className="text-sm text-gray-500">{summary}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* C2PA Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
              hasVerifiedProvenance
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {hasVerifiedProvenance ? '✓ C2PA Verified' : 'No C2PA'}
            </span>
            <a
              href="https://c2pa.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              What is C2PA?
            </a>
          </div>

          {c2pa.hasCredentials ? (
            <div className="bg-green-50 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Issuer:</span>
                  <span className="ml-2 font-medium">{c2pa.issuer || 'Unknown'}</span>
                </div>
                {c2pa.signedAt && (
                  <div>
                    <span className="text-gray-500">Signed:</span>
                    <span className="ml-2 font-medium">
                      {new Date(c2pa.signedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
              {c2pa.metadata?.assertions && (
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Assertions:</span>
                  <span className="ml-2">{c2pa.metadata.assertions.join(', ')}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No Content Credentials found. This doesn't mean the content is fake—
              most content today lacks C2PA credentials.
            </p>
          )}
        </div>

        {/* EXIF Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
              exif.hasExif
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {exif.hasExif ? 'EXIF Found' : 'No EXIF'}
            </span>
            {exif.suspicionIndicators?.length > 0 && (
              <span className="text-xs text-yellow-600">
                {exif.suspicionIndicators.length} suspicion indicator(s)
              </span>
            )}
          </div>

          {exif.hasExif && exif.metadata ? (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {/* Camera */}
                {(exif.metadata.camera?.make || exif.metadata.camera?.model) && (
                  <div>
                    <span className="text-gray-500">Camera:</span>
                    <span className="ml-2">
                      {[exif.metadata.camera.make, exif.metadata.camera.model]
                        .filter(Boolean)
                        .join(' ')}
                    </span>
                  </div>
                )}

                {/* Software */}
                {exif.metadata.camera?.software && (
                  <div>
                    <span className="text-gray-500">Software:</span>
                    <span className="ml-2">{exif.metadata.camera.software}</span>
                  </div>
                )}

                {/* Date */}
                {exif.metadata.datetime?.created && (
                  <div>
                    <span className="text-gray-500">Created:</span>
                    <span className="ml-2">
                      {new Date(exif.metadata.datetime.created).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Dimensions */}
                {exif.metadata.image?.width && (
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <span className="ml-2">
                      {exif.metadata.image.width} × {exif.metadata.image.height}
                    </span>
                  </div>
                )}

                {/* Location */}
                {exif.metadata.location && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Location:</span>
                    <span className="ml-2">
                      {exif.metadata.location.latitude.toFixed(4)},
                      {exif.metadata.location.longitude.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>

              {/* Suspicion Indicators */}
              {exif.suspicionIndicators?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-yellow-700">
                    <strong>Note:</strong> {exif.note}
                  </p>
                  <ul className="mt-1 text-xs text-gray-600 list-disc list-inside">
                    {exif.suspicionIndicators.map((indicator) => (
                      <li key={indicator}>{indicator.replace(/_/g, ' ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {exif.note || 'No EXIF metadata available.'}
            </p>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
          <strong>Why provenance matters:</strong> C2PA credentials are cryptographically
          signed and cannot be forged. EXIF data can be modified or stripped. We check
          both but prioritize C2PA for verification decisions.
        </div>
      </div>
    </div>
  );
}
