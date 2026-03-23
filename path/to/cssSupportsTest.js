// cssSupportsTest.js

function isCSSSupportsSupported() {
  try {
    // Check for @supports rule support
    return window.CSS.supports('display: grid');
  } catch (error) {
    console.error('CSS @supports rule not supported', error);
    return false;
  }
}

export default {
  isCSSSupportsSupported
};
