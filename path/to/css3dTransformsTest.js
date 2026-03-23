// css3dTransformsTest.js

function isCSS3DSupported() {
  const testElement = document.createElement('div');
  testElement.style.transform = 'rotateY(45deg)';
  testElement.style.webkitTransform = 'rotateY(45deg)'; // For older browsers

  return testElement.style.transform !== '' || testElement.style.webkitTransform !== '';
}

export default {
  isCSS3DSupported
};
