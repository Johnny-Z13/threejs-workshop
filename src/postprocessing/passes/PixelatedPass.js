import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * 8-bit Pixelated Pass - Retro pixel art effect with color quantization
 */
export class PixelatedPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: { x: 1920, y: 1080 } },
        uPixelSize: { value: 6.0 },
        uColorDepth: { value: 8.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uPixelSize;
        uniform float uColorDepth;
        varying vec2 vUv;

        void main() {
          // Pixelate
          vec2 pixelatedUV = floor(vUv * uResolution / uPixelSize) * uPixelSize / uResolution;
          vec4 color = texture2D(tDiffuse, pixelatedUV);

          // Color quantization (reduce to N colors per channel)
          float levels = uColorDepth;
          color.r = floor(color.r * levels) / levels;
          color.g = floor(color.g * levels) / levels;
          color.b = floor(color.b * levels) / levels;

          gl_FragColor = color;
        }
      `
    };
    super(shader);
  }

  setSize(width, height) {
    this.uniforms.uResolution.value.x = width;
    this.uniforms.uResolution.value.y = height;
  }

  updateUniforms(options) {
    if (options.pixelSize !== undefined) {
      this.uniforms.uPixelSize.value = options.pixelSize;
    }
    if (options.colorDepth !== undefined) {
      this.uniforms.uColorDepth.value = options.colorDepth;
    }
  }
}
