/**
 * Detect GPU acceleration support in the browser
 * Tests for CSS 3D transforms which enable hardware acceleration
 * @returns {Object} GPU support detection results
 */
export const detectGPUSupport = () => {
  try {
    // Create a test element
    const testEl = document.createElement('div');
    testEl.style.transform = 'translateZ(0)';
    
    // Check if transform is applied (browser support)
    const hasTransformZ = testEl.style.transform !== '';
    
    // Check for CSS @supports rule support
    const hasSupportsRule = CSS && CSS.supports && CSS.supports('transform', 'translateZ(0)');
    
    // Check browser acceleration via GPU info
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
    const hasWebGL = !!gl;
    
    // Composite the detection results
    const isGPUAccelerated = hasTransformZ && (hasSupportsRule || hasWebGL);
    
    const result = {
      supported: isGPUAccelerated,
      hasTransformZ,
      hasSupportsRule,
      hasWebGL,
      agent: navigator.userAgent.split(' ').slice(-1)[0]
    };
    
    // Log acceleration info for diagnostics
    /* eslint-disable no-console */
    if (isGPUAccelerated) {
      console.log('\u2705 GPU Acceleration: ENABLED (TransformZ + WebGL)');
    } else {
      console.log('\u26A0\uFE0F GPU Acceleration: FALLBACK MODE (CPU rendering)');
    }
    /* eslint-enable no-console */
    
    return result;
  } catch (error) {
    console.warn('GPU detection error:', error);
    return {
      supported: false,
      error: error.message
    };
  }
};

export const getDevice = () => ({
  ua: navigator.userAgent,
  platform: navigator.platform,
  lang: navigator.language,
  ts: new Date().toISOString()
});
