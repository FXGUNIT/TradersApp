// browserAccelerationDetector.js

function isBrowserAccelerated() {
  const testElement = document.createElement('div');
  testElement.style.transform = 'rotateY(45deg)';
  testElement.style.webkitTransform = 'rotateY(45deg)'; // For older browsers

  return testElement.style.transform !== '' || testElement.style.webkitTransform !== '';
}

function isGPUInfoAvailable() {
  try {
    const gpuInfo = navigator.gpu;
    if (gpuInfo && typeof gpuInfo.requestAdapter === 'function') {
      return true;
    }
    return false;
  } catch (error) {
    console.error('GPU info not available', error);
    return false;
  }
}

export default {
  isBrowserAccelerated,
  isGPUInfoAvailable
};
