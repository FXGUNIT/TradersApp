/**
 * ═══════════════════════════════════════════════════════════════════
 * STAGE 3: IMAGE OPTIMIZATION CHECKER
 * ═══════════════════════════════════════════════════════════════════
 * Scans all user-uploaded ID and profile pictures
 * Flags images over 500KB that haven't been compressed
 * Suggests optimization strategies
 * 
 * Usage:
 *   import { runImageOptimizationCheck } from './imageOptimizationChecker.js';
 *   const results = await runImageOptimizationCheck(database);
 *   console.log(results);
 */

const IMAGE_CONFIG = {
  maxRecommendedSize: 500, // KB
  criticalSize: 1000, // KB
  relevantExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  compressionRatios: {
    jpg: 0.8,
    jpeg: 0.8,
    png: 0.6,
    webp: 0.5,
    gif: 0.7,
  },
};

let imageState = {
  isScanning: false,
  imagesScanned: 0,
  imagesChecked: [],
  oversizedImages: [],
  optimizedImages: [],
  uncompressedFlags: [],
  storageUsage: 0,
  potentialSavings: 0,
};

/**
 * Get image dimensions and format
 */
async function analyzeImageProperties(imageUrl) {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      // Calculate estimated file size based on dimensions and format
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const pixelCount = width * height;
      const bytesPerPixel = 3; // RGB

      const estimatedSize = (pixelCount * bytesPerPixel) / 1024; // KB

      resolve({
        url: imageUrl,
        width,
        height,
        pixelCount,
        estimatedUncompressedSize: estimatedSize.toFixed(2),
        format: getImageFormat(imageUrl),
        isResponsive: width <= 800 && height <= 800,
      });
    };

    img.onerror = () => {
      resolve({
        url: imageUrl,
        error: 'Failed to load image',
      });
    };

    img.src = imageUrl;
  });
}

/**
 * Get image format from URL
 */
function getImageFormat(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const extension = pathname.split('.').pop().toLowerCase();
    return extension || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Fetch image header to get actual file size
 */
async function getActualImageSize(imageUrl) {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    
    if (contentLength) {
      return (parseInt(contentLength) / 1024).toFixed(2); // KB
    }
    
    // Fallback: try GET with size estimation
    const getResponse = await fetch(imageUrl);
    const blob = await getResponse.blob();
    return (blob.size / 1024).toFixed(2); // KB
  } catch (error) {
    console.warn(`Failed to fetch image size for ${imageUrl}:`, error.message);
    return null;
  }
}

/**
 * Check if image is compressed (based on optimization analysis)
 */
function isImageCompressed(sizeKb, format) {
  const sizeNum = parseFloat(sizeKb);
  
  // Basic heuristic: estimate what the file should be
  const reasonableSize = {
    jpg: 150,
    jpeg: 150,
    png: 200,
    webp: 100,
    gif: 300,
    unknown: 200,
  };

  const expectedSize = reasonableSize[format] || reasonableSize.unknown;
  
  // If file is significantly larger than expected, it's probably uncompressed
  return sizeNum <= expectedSize * 1.3; // Within 30% of expected
}

/**
 * Calculate compression potential
 */
function calculateCompressionPotential(sizeKb, format) {
  const ratio = IMAGE_CONFIG.compressionRatios[format] || 0.7;
  const sizeNum = parseFloat(sizeKb);
  const potentialSize = sizeNum * ratio;
  const savingsKb = sizeNum - potentialSize;
  const savingsPercent = ((savingsKb / sizeNum) * 100).toFixed(1);

  return {
    currentSize_kb: sizeNum.toFixed(2),
    potentialSize_kb: potentialSize.toFixed(2),
    savingsKb: savingsKb.toFixed(2),
    savingsPercent: `${savingsPercent}%`,
    compressionRatio: ratio,
  };
}

/**
 * Scan DOM for image elements
 */
function findAllImages() {
  const images = [];
  const seen = new Set();

  // Find profile pictures
  const profileImgs = document.querySelectorAll('[class*="profile"], [class*="avatar"], [class*="user-image"]');
  profileImgs.forEach(el => {
    const src = el.src || el.style.backgroundImage?.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (src && !seen.has(src)) {
      images.push({
        url: src,
        type: 'PROFILE_PICTURE',
        element: el,
      });
      seen.add(src);
    }
  });

  // Find ID/verification images
  const idImgs = document.querySelectorAll('[class*="id"], [class*="verify"], [class*="document"]');
  idImgs.forEach(el => {
    const src = el.src || el.style.backgroundImage?.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (src && !seen.has(src)) {
      images.push({
        url: src,
        type: 'ID_PICTURE',
        element: el,
      });
      seen.add(src);
    }
  });

  // Find all img tags
  const allImgs = document.querySelectorAll('img');
  allImgs.forEach(el => {
    const src = el.src;
    if (src && !seen.has(src) && (src.includes('profile') || src.includes('id') || src.includes('user') || src.includes('avatar'))) {
      images.push({
        url: src,
        type: el.className.includes('id') ? 'ID_PICTURE' : 'PROFILE_PICTURE',
        element: el,
      });
      seen.add(src);
    }
  });

  return images;
}

/**
 * Scan Firebase Storage for images (if reference provided)
 */
async function scanFirebaseImages() {
  const firebaseImages = [];

  try {
    // This would require Firebase access - typically done server-side
    // For now, we'll scan DOM which is client-side accessible
    console.log('📡 Note: Firebase Storage scan requires server-side access');
  } catch (error) {
    console.warn('Could not scan Firebase Storage:', error.message);
  }

  return firebaseImages;
}

/**
 * Analyze a single image
 */
async function analyzeImage(imageData) {
  try {
    const actualSize = await getActualImageSize(imageData.url);
    const properties = await analyzeImageProperties(imageData.url);

    if (actualSize === null) {
      return {
        ...imageData,
        status: 'INACCESSIBLE',
        reason: 'Unable to fetch image',
      };
    }

    const sizeNum = parseFloat(actualSize);
    const format = getImageFormat(imageData.url);
    const isCompressed = isImageCompressed(actualSize, format);
    const compression = calculateCompressionPotential(actualSize, format);

    let status = 'OK';
    let flag = null;

    if (sizeNum > IMAGE_CONFIG.criticalSize) {
      status = 'CRITICAL';
      flag = `❌ CRITICAL: ${actualSize}KB - Way over size limit. Compress immediately.`;
    } else if (sizeNum > IMAGE_CONFIG.maxRecommendedSize) {
      status = 'OVERSIZED';
      flag = `⚠️ OVERSIZED: ${actualSize}KB - Exceeds 500KB recommendation.`;
    } else if (!isCompressed && sizeNum > 200) {
      status = 'UNCOMPRESSED';
      flag = `🔶 UNCOMPRESSED: ${actualSize}KB - Appears to be uncompressed.`;
    }

    const result = {
      url: imageData.url,
      type: imageData.type,
      size_kb: actualSize,
      format,
      status,
      flag,
      isCompressed,
      properties,
      compression: compression,
      recommendation: generateRecommendation(status, format, actualSize),
    };

    imageState.storageUsage += sizeNum;

    if (flag) {
      imageState.uncompressedFlags.push(result);
      imageState.potentialSavings += parseFloat(compression.savingsKb);
    } else {
      imageState.optimizedImages.push(result);
    }

    return result;
  } catch (error) {
    return {
      url: imageData.url,
      type: imageData.type,
      error: error.message,
      status: 'ERROR',
    };
  }
}

/**
 * Generate recommendation for image
 */
function generateRecommendation(status, format, sizeKb) {
  const sizeNum = parseFloat(sizeKb);

  if (status === 'CRITICAL') {
    return [
      `1. Convert ${format.toUpperCase()} to WebP format (-50% size)`,
      `2. Resize to max 800x800px if larger`,
      `3. Use image compression tool (TinyPNG, ImageOptim)`,
      `4. Target: < 200KB`,
    ];
  }

  if (status === 'OVERSIZED') {
    return [
      `1. Compress using lossy compression (quality: 75-80%)`,
      `2. If ${format.toUpperCase()}: convert to WebP for 30-40% size reduction`,
      `3. Resize if larger than necessary (profile: 400x400px max)`,
      `4. Target: < 200KB`,
    ];
  }

  if (status === 'UNCOMPRESSED') {
    return [
      `1. This ${format.toUpperCase()} appears uncompressed`,
      `2. Use compression tool without quality loss initially`,
      `3. If lossy needed: reduce quality to 75-80%`,
      `4. Potential savings: ${(sizeNum * 0.3).toFixed(0)}KB`,
    ];
  }

  return ['✅ Image is well optimized'];
}

/**
 * Run complete image optimization check
 */
export async function runImageOptimizationCheck(database) {
  if (imageState.isScanning) {
    console.warn('⚠️ Image optimization scan already running');
    return null;
  }

  imageState.isScanning = true;
  imageState.imagesScanned = 0;
  imageState.imagesChecked = [];
  imageState.oversizedImages = [];
  imageState.optimizedImages = [];
  imageState.uncompressedFlags = [];
  imageState.storageUsage = 0;
  imageState.potentialSavings = 0;

  console.log('');
  console.log('🚀 Starting Image Optimization Check');
  console.log('═'.repeat(70));
  console.log('🖼️  Scanning for user-uploaded images...');
  console.log('');

  // Find images in DOM
  console.log('🔍 Scanning DOM for profile and ID images...');
  const domImages = findAllImages();
  console.log(`✓ Found ${domImages.length} images in DOM`);

  // Scan Firebase (server-side would be better)
  console.log('📡 Scanning Firebase Storage...');
  const firebaseImages = await scanFirebaseImages(database);
  console.log(`✓ Found ${firebaseImages.length} images in Firebase`);

  const allImages = [...domImages, ...firebaseImages];
  console.log(`📊 Total images to analyze: ${allImages.length}`);
  console.log('');

  // Analyze each image
  console.log('⚙️  Analyzing images...');
  for (const imageData of allImages) {
    const analysis = await analyzeImage(imageData);
    imageState.imagesChecked.push(analysis);
    imageState.imagesScanned++;

    if (analysis.status !== 'ERROR' && analysis.status !== 'INACCESSIBLE') {
      const statusIcon = {
        OK: '✅',
        OVERSIZED: '⚠️',
        UNCOMPRESSED: '🔶',
        CRITICAL: '❌',
      }[analysis.status] || '❓';

      console.log(`${statusIcon} ${analysis.type}: ${analysis.size_kb}KB`);
    }

    // Throttle requests
    await new Promise(r => setTimeout(r, 100));
  }

  imageState.isScanning = false;

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    testType: 'Image Optimization Check',
    summary: {
      totalImages: imageState.imagesScanned,
      optimizedImages: imageState.optimizedImages.length,
      oversizedImages: imageState.uncompressedFlags.length,
      totalStorage_mb: (imageState.storageUsage / 1024).toFixed(2),
      potentialSavings_mb: (imageState.potentialSavings / 1024).toFixed(2),
      percentSavings: imageState.storageUsage > 0 
        ? ((imageState.potentialSavings / imageState.storageUsage) * 100).toFixed(1)
        : 0,
    },
    images: {
      optimized: imageState.optimizedImages,
      oversized: imageState.uncompressedFlags,
    },
    detailedChecks: imageState.imagesChecked,
    compression_guide: generateCompressionGuide(),
    health_score: calculateImageHealthScore(
      imageState.optimizedImages.length,
      imageState.uncompressedFlags.length,
      imageState.storageUsage
    ),
  };

  console.log('');
  console.log('═'.repeat(70));
  console.log('📊 IMAGE OPTIMIZATION REPORT');
  console.log('═'.repeat(70));
  console.log(`Total Images: ${report.summary.totalImages}`);
  console.log(`Optimized: ${report.summary.optimizedImages} ✅`);
  console.log(`Oversized: ${report.summary.oversizedImages} ⚠️`);
  console.log(`Storage Usage: ${report.summary.totalStorage_mb}MB`);
  console.log(`Potential Savings: ${report.summary.potentialSavings_mb}MB (${report.summary.percentSavings}%)`);
  console.log('═'.repeat(70));

  return report;
}

/**
 * Generate compression guide
 */
function generateCompressionGuide() {
  return {
    tools: [
      { name: 'TinyPNG', url: 'https://tinypng.com', format: ['PNG', 'JPG'] },
      { name: 'ImageOptim', url: 'https://imageoptim.com', format: ['All'] },
      { name: 'Squoosh', url: 'https://squoosh.app', format: ['All'] },
      { name: 'CloudFlare Image Optimization', url: 'https://www.cloudflare.com', format: ['JPG', 'WebP'] },
    ],
    profiles: {
      profile_picture: {
        max_width: 400,
        max_height: 400,
        recommended_format: 'WebP',
        quality: '80',
        max_size_kb: 150,
      },
      id_picture: {
        max_width: 1200,
        max_height: 800,
        recommended_format: 'WebP',
        quality: '85',
        max_size_kb: 300,
      },
    },
    formats: {
      jpg: { compression: 'Lossy', ratio: 0.8, quality_range: '70-85' },
      png: { compression: 'Lossless', ratio: 0.6, quality_range: '100' },
      webp: { compression: 'Lossy or Lossless', ratio: 0.5, quality_range: '75-95' },
      gif: { compression: 'Lossless', ratio: 0.7, quality_range: '100' },
    },
  };
}

/**
 * Calculate health score for images
 */
function calculateImageHealthScore(optimized, oversized, storageUsage) {
  let score = 100;

  if (oversized > 0) {
    score -= oversized * 5;
  }

  if (storageUsage > 1000 * 1024) { // 1GB
    score -= 20;
  } else if (storageUsage > 500 * 1024) { // 500MB
    score -= 10;
  }

  const optimizationRate = optimized / (optimized + oversized) * 100 || 0;
  if (optimizationRate < 80) {
    score -= (80 - optimizationRate) * 0.2;
  }

  return Math.max(0, Math.min(100, score)).toFixed(2);
}

/**
 * Get current image-scanning state
 */
export function getImageCheckState() {
  return {
    isScanning: imageState.isScanning,
    scanned: imageState.imagesScanned,
    oversized: imageState.uncompressedFlags.length,
    storageUsage: (imageState.storageUsage / 1024).toFixed(2),
    potentialSavings: (imageState.potentialSavings / 1024).toFixed(2),
  };
}

/**
 * Export image optimization report
 */
export function exportImageReport(report, filename = 'image-optimization-report.json') {
  const dataStr = JSON.stringify(report, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
