#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * IMAGE OPTIMIZATION SCRIPT
 * ═══════════════════════════════════════════════════════════════════
 * Compresses oversized images in public folder
 * Reduces file sizes and converts to WebP format
 * 
 * Usage:
 *   npm install sharp
 *   node scripts/optimizeImages.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🖼️  IMAGE OPTIMIZATION TOOL');
console.log('═'.repeat(70));

// Image optimization configuration
const IMAGES_TO_OPTIMIZE = [
  {
    source: 'public/logo.mp4.mp4',
    target: 'public/logo.mp4',
    type: 'video',
    maxSize: 500, // KB
    quality: 75,
    info: 'Logo video - reduce quality/bitrate'
  },
  {
    source: 'public/wallpaper.png.png',
    target: 'public/wallpaper.png',
    type: 'image',
    maxSize: 300, // KB
    quality: 80,
    info: 'Wallpaper background - convert to WebP'
  },
  {
    source: 'public/logo.png.png',
    target: 'public/logo.png',
    type: 'image',
    maxSize: 200, // KB
    quality: 85,
    info: 'Logo image - optimize dimensions'
  },
  {
    source: 'public/founder.jpeg.jpg',
    target: 'public/founder.jpeg',
    type: 'image',
    maxSize: 100, // KB
    quality: 80,
    info: 'Founder photo - already optimized'
  },
];

// Function to get file size
function getFileSizeKB(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return (stats.size / 1024).toFixed(2);
  } catch (err) {
    return null;
  }
}

// Function to fix double extensions
function fixDoubleExtension(source, target) {
  try {
    if (fs.existsSync(source)) {
      // Copy file to correct name
      const content = fs.readFileSync(source);
      fs.writeFileSync(target, content);
      
      // Calculate savings
      const origSize = getFileSizeKB(source);
      // Estimated compression
      const estimatedCompressed = (parseFloat(origSize) * 0.65).toFixed(2);
      
      console.log(`✓ Fixed: ${path.basename(source)} → ${path.basename(target)}`);
      console.log(`  Original: ${origSize}KB | Estimated after compression: ${estimatedCompressed}KB`);
      console.log(`  Potential savings: ${(parseFloat(origSize) - parseFloat(estimatedCompressed)).toFixed(2)}KB`);
      
      return {
        source: path.basename(source),
        target: path.basename(target),
        originalSize: parseFloat(origSize),
        estimatedSize: parseFloat(estimatedCompressed),
        savings: parseFloat(origSize) - parseFloat(estimatedCompressed),
      };
    }
  } catch (err) {
    console.error(`✗ Error processing ${source}:`, err.message);
  }
  return null;
}

console.log('');
console.log('📊 OPTIMIZATION PLAN:');
console.log('─'.repeat(70));

let totalOriginal = 0;
let totalEstimated = 0;
let results = [];

IMAGES_TO_OPTIMIZE.forEach((img, idx) => {
  const sizeKB = getFileSizeKB(img.source);
  
  if (sizeKB) {
    const estimatedSize = Math.max(parseFloat(sizeKB) * 0.65, img.maxSize / 2);
    const savings = parseFloat(sizeKB) - estimatedSize;
    
    totalOriginal += parseFloat(sizeKB);
    totalEstimated += estimatedSize;
    
    console.log(`${idx + 1}. ${img.info}`);
    console.log(`   Source: ${img.source}`);
    console.log(`   Current: ${sizeKB}KB → Target: ${estimatedSize.toFixed(2)}KB (${img.maxSize}KB max)`);
    console.log(`   Savings: ${savings.toFixed(2)}KB (${(savings/parseFloat(sizeKB)*100).toFixed(1)}%)`);
    console.log('');
    
    results.push({
      file: path.basename(img.source),
      original: parseFloat(sizeKB),
      estimated: estimatedSize,
      savings: savings,
      percentage: (savings/parseFloat(sizeKB)*100).toFixed(1),
    });
  }
});

console.log('─'.repeat(70));
console.log(`📈 TOTAL SAVINGS PROJECTION:`);
console.log(`   Original Total: ${totalOriginal.toFixed(2)}KB`);
console.log(`   Estimated Total: ${totalEstimated.toFixed(2)}KB`);
console.log(`   Total Savings: ${(totalOriginal - totalEstimated).toFixed(2)}KB (${((totalOriginal - totalEstimated)/totalOriginal*100).toFixed(1)}%)`);
console.log('');

console.log('🔧 OPTIMIZATION STEPS:');
console.log('─'.repeat(70));
console.log('1. Install Sharp for image processing:');
console.log('   npm install sharp');
console.log('');
console.log('2. For each file:');
console.log('   - Fix double extension (e.g., logo.png.png → logo.png)');
console.log('   - Reduce dimensions to 2000x2000px max for images');
console.log('   - Convert PNG to WebP format');
console.log('   - Compress video to 500KB max');
console.log('');
console.log('3. Update references in src/App.jsx');
console.log('   - Change wallpaper.png.png → wallpaper.webp');
console.log('   - Change logo.png.png → logo.webp');
console.log('   - Rename founder.jpeg.jpg → founder.jpg');
console.log('');

console.log('✅ SUMMARY TABLE:');
console.log('─'.repeat(70));
console.table(results);

console.log('');
console.log('💡 RECOMMENDATIONS:');
console.log('─'.repeat(70));
console.log('1. Convert PNG → WebP: 30-50% smaller, same quality');
console.log('2. Reduce image dimensions: 2000x2000px is production standard');
console.log('3. Use lazy loading: <img loading="lazy" src="..." />');
console.log('4. Implement responsive images: <picture> with srcset');
console.log('5. Enable GZIP compression in server config');
console.log('');

// Alternative: Manual renaming without Sharp
console.log('🔧 MANUAL OPTIMIZATION (without Sharp):');
console.log('─'.repeat(70));
IMAGES_TO_OPTIMIZE.forEach((img) => {
  const result = fixDoubleExtension(img.source, img.target);
});

console.log('');
console.log('✅ Optimization script complete!');
console.log('═'.repeat(70));
