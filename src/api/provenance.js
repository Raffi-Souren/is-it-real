/**
 * Provenance Verification (C2PA / EXIF)
 *
 * Priority 1 in our verification pipeline.
 * If valid C2PA credentials exist, we can skip probabilistic detection.
 *
 * This is the "provenance-first" architecture advocated in the blog:
 * - Cryptographic proof > probabilistic detection
 * - Zero false positives for signed content
 * - Near-zero marginal cost per verification
 *
 * @author Raf Khatchadourian
 */

/**
 * Extract and verify C2PA Content Credentials
 *
 * C2PA (Coalition for Content Provenance and Authenticity) provides
 * cryptographically signed provenance data embedded in media files.
 *
 * @param {File|Blob} file - Image/video file to check
 * @returns {Object} C2PA verification result
 */
/**
 * C2PA verification is currently disabled in demo mode.
 * To enable full C2PA verification:
 * 1. Install c2pa: npm install c2pa
 * 2. Set VITE_ENABLE_C2PA=true in your environment
 *
 * C2PA provides cryptographic provenance verification for signed media.
 * When enabled, it checks for Content Credentials signed by Adobe, Microsoft, etc.
 */
export async function verifyC2PA(file) {
  // C2PA disabled in demo mode - requires WASM module
  // In production, enable via VITE_ENABLE_C2PA=true after installing c2pa
  const c2paEnabled = import.meta.env.VITE_ENABLE_C2PA === 'true';

  if (!c2paEnabled) {
    return {
      hasCredentials: false,
      isValid: false,
      issuer: null,
      signedAt: null,
      error: null,
      metadata: {
        note: 'C2PA verification disabled in demo mode (set VITE_ENABLE_C2PA=true to enable)'
      }
    };
  }

  // Full C2PA implementation for production use
  // Requires: npm install c2pa
  try {
    // Dynamic import c2pa-js (browser WASM module)
    const c2paModule = await Function('return import("c2pa")')();
    await c2paModule.init();

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();

    // Verify C2PA manifest
    const result = await c2paModule.read(buffer);

    if (!result || !result.active_manifest) {
      return {
        hasCredentials: false,
        isValid: false,
        issuer: null,
        signedAt: null,
        error: null,
        metadata: {
          note: 'No C2PA manifest found in file'
        }
      };
    }

    const manifest = result.active_manifest;

    // Extract key information
    return {
      hasCredentials: true,
      isValid: manifest.validation_status?.length === 0, // Empty = no errors
      issuer: manifest.claim_generator || manifest.signature_info?.issuer,
      signedAt: manifest.signature_info?.time || null,
      metadata: {
        title: manifest.title,
        format: manifest.format,
        claimGenerator: manifest.claim_generator,
        assertions: manifest.assertions?.map(a => a.label) || [],
        ingredients: manifest.ingredients?.length || 0,
        validationStatus: manifest.validation_status || [],
        signatureInfo: manifest.signature_info
      }
    };
  } catch (error) {
    // C2PA library not available or file parsing failed
    console.warn('C2PA verification failed:', error.message);

    return {
      hasCredentials: false,
      isValid: false,
      issuer: null,
      signedAt: null,
      error: error.message,
      metadata: {
        note: 'C2PA verification failed - ensure c2pa package is installed'
      }
    };
  }
}

/**
 * Extract EXIF metadata from image
 *
 * EXIF provides creation context but is NOT cryptographically secure.
 * Used for heuristic analysis, not verification.
 *
 * @param {File|Blob} file - Image file to extract EXIF from
 * @returns {Object} EXIF metadata
 */
export async function extractEXIF(file) {
  try {
    // Dynamic import exifr (lightweight EXIF parser)
    const exifr = await import('exifr');

    // Parse EXIF data
    const exif = await exifr.parse(file, {
      // Request common fields
      pick: [
        'Make', 'Model', 'Software', 'DateTime', 'DateTimeOriginal',
        'GPSLatitude', 'GPSLongitude', 'ImageWidth', 'ImageHeight',
        'ExifImageWidth', 'ExifImageHeight', 'Orientation',
        'ColorSpace', 'Flash', 'FocalLength', 'ISO', 'ExposureTime',
        'FNumber', 'Artist', 'Copyright', 'ImageDescription'
      ]
    });

    if (!exif) {
      return {
        hasExif: false,
        metadata: {},
        note: 'No EXIF data found'
      };
    }

    // Calculate suspicion indicators
    const suspicionIndicators = [];

    // Check for camera info
    if (!exif.Make && !exif.Model) {
      suspicionIndicators.push('no_camera_info');
    }

    // Check for AI software hints
    const software = (exif.Software || '').toLowerCase();
    const aiSoftwarePatterns = [
      'stable diffusion', 'midjourney', 'dall-e', 'dall·e',
      'firefly', 'novelai', 'automatic1111', 'comfyui'
    ];

    if (aiSoftwarePatterns.some(p => software.includes(p))) {
      suspicionIndicators.push('ai_software');
    }

    return {
      hasExif: true,
      metadata: {
        camera: {
          make: exif.Make,
          model: exif.Model,
          software: exif.Software
        },
        datetime: {
          created: exif.DateTimeOriginal || exif.DateTime,
          modified: exif.DateTime
        },
        location: exif.GPSLatitude ? {
          latitude: exif.GPSLatitude,
          longitude: exif.GPSLongitude
        } : null,
        image: {
          width: exif.ExifImageWidth || exif.ImageWidth,
          height: exif.ExifImageHeight || exif.ImageHeight,
          orientation: exif.Orientation,
          colorSpace: exif.ColorSpace
        },
        capture: {
          flash: exif.Flash,
          focalLength: exif.FocalLength,
          iso: exif.ISO,
          exposureTime: exif.ExposureTime,
          fNumber: exif.FNumber
        },
        attribution: {
          artist: exif.Artist,
          copyright: exif.Copyright,
          description: exif.ImageDescription
        }
      },
      suspicionIndicators,
      note: suspicionIndicators.length > 0
        ? `Found ${suspicionIndicators.length} suspicion indicator(s)`
        : 'EXIF data appears normal'
    };
  } catch (error) {
    console.warn('EXIF extraction failed:', error.message);
    return {
      hasExif: false,
      metadata: {},
      error: error.message,
      note: 'EXIF extraction failed'
    };
  }
}

/**
 * Get image dimensions from file
 *
 * @param {File|Blob} file - Image file
 * @returns {Promise<{width: number, height: number}>}
 */
export function getImageDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: null, height: null });
    };

    img.src = url;
  });
}

/**
 * Full provenance check
 * Runs C2PA verification and EXIF extraction in parallel
 *
 * @param {File|Blob} file - Media file to check
 * @returns {Object} Complete provenance result
 */
export async function checkProvenance(file) {
  const [c2paResult, exifResult, dimensions] = await Promise.all([
    verifyC2PA(file),
    extractEXIF(file),
    getImageDimensions(file)
  ]);

  // Combine results
  return {
    // C2PA is the primary provenance indicator
    hasVerifiedProvenance: c2paResult.hasCredentials && c2paResult.isValid,

    c2pa: c2paResult,
    exif: exifResult,

    // Convenience fields for heuristic analysis
    imageData: {
      width: dimensions.width || exifResult.metadata?.image?.width,
      height: dimensions.height || exifResult.metadata?.image?.height,
      exif: exifResult.hasExif ? exifResult.metadata : null
    },

    // Summary for UI
    summary: c2paResult.hasCredentials
      ? c2paResult.isValid
        ? `Verified by ${c2paResult.issuer || 'Content Credentials'}`
        : 'Content Credentials present but invalid'
      : exifResult.hasExif
        ? 'No Content Credentials, EXIF metadata available'
        : 'No provenance data found'
  };
}

/**
 * Check if content has valid provenance (for quick decisions)
 *
 * @param {File|Blob} file - Media file to check
 * @returns {boolean} True if cryptographically verified
 */
export async function hasValidProvenance(file) {
  const result = await verifyC2PA(file);
  return result.hasCredentials && result.isValid;
}

export default {
  verifyC2PA,
  extractEXIF,
  getImageDimensions,
  checkProvenance,
  hasValidProvenance
};
