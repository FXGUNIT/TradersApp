// gpuAccelerationDetector.js

function isWebGLSupported() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) {
      return false;
    }

    // Check for WebGL extensions that indicate GPU acceleration
    const extensions = [
      'OES_texture_float',
      'OES_texture_half_float',
      'WEBGL_depth_texture',
      'EXT_shader_texture_lod'
    ];

    for (let extension of extensions) {
      if (!gl.getExtension(extension)) {
        return false;
      }
    }

    // Additional checks to ensure WebGL is fully supported
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, `
      attribute vec3 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 1.0);
      }
    `);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, `
      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return false;
    }

    // Clean up
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    gl.deleteProgram(program);

    return true;
  } catch (error) {
    console.error('WebGL not supported', error);
    return false;
  }
}

function isCSS3DSupported() {
  const testElement = document.createElement('div');
  testElement.style.transform = 'rotateY(45deg)';
  testElement.style.webkitTransform = 'rotateY(45deg)'; // For older browsers

  return testElement.style.transform !== '' || testElement.style.webkitTransform !== '';
}

export default {
  isWebGLSupported,
  isCSS3DSupported
};
