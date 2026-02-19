import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Game Boy Pass - 4-color green palette like original Game Boy
 */
export class GameBoyPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uPixelSize: { value: 4.0 },
        uResolution: { value: { x: 1920, y: 1080 } }
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
        uniform float uPixelSize;
        uniform vec2 uResolution;
        varying vec2 vUv;

        // Original Game Boy palette (DMG-01)
        vec3 palette[4];

        void main() {
          // Game Boy colors (darkest to lightest green)
          palette[0] = vec3(0.06, 0.22, 0.06);  // Darkest
          palette[1] = vec3(0.19, 0.38, 0.19);  // Dark
          palette[2] = vec3(0.55, 0.68, 0.06);  // Light
          palette[3] = vec3(0.61, 0.74, 0.06);  // Lightest

          // Pixelate
          vec2 pixelatedUV = floor(vUv * uResolution / uPixelSize) * uPixelSize / uResolution;
          vec4 color = texture2D(tDiffuse, pixelatedUV);

          // Convert to grayscale
          float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

          // Quantize to 4 levels
          int colorIndex = int(gray * 3.0);
          colorIndex = clamp(colorIndex, 0, 3);

          vec3 finalColor = palette[colorIndex];

          gl_FragColor = vec4(finalColor, 1.0);
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
  }
}
