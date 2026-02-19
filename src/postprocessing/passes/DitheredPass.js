import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * 1-bit Dithered Pass - Obra Dinn style black and white with Bayer dithering
 */
export class DitheredPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uThreshold: { value: 0.5 },
        uDitherScale: { value: 1.0 }
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
        uniform float uThreshold;
        uniform float uDitherScale;
        varying vec2 vUv;

        // Bayer 8x8 dithering matrix
        float bayer8x8(vec2 coord) {
          int x = int(mod(coord.x, 8.0));
          int y = int(mod(coord.y, 8.0));
          int index = x + y * 8;

          float matrix[64];
          matrix[0] = 0.0; matrix[1] = 32.0; matrix[2] = 8.0; matrix[3] = 40.0; matrix[4] = 2.0; matrix[5] = 34.0; matrix[6] = 10.0; matrix[7] = 42.0;
          matrix[8] = 48.0; matrix[9] = 16.0; matrix[10] = 56.0; matrix[11] = 24.0; matrix[12] = 50.0; matrix[13] = 18.0; matrix[14] = 58.0; matrix[15] = 26.0;
          matrix[16] = 12.0; matrix[17] = 44.0; matrix[18] = 4.0; matrix[19] = 36.0; matrix[20] = 14.0; matrix[21] = 46.0; matrix[22] = 6.0; matrix[23] = 38.0;
          matrix[24] = 60.0; matrix[25] = 28.0; matrix[26] = 52.0; matrix[27] = 20.0; matrix[28] = 62.0; matrix[29] = 30.0; matrix[30] = 54.0; matrix[31] = 22.0;
          matrix[32] = 3.0; matrix[33] = 35.0; matrix[34] = 11.0; matrix[35] = 43.0; matrix[36] = 1.0; matrix[37] = 33.0; matrix[38] = 9.0; matrix[39] = 41.0;
          matrix[40] = 51.0; matrix[41] = 19.0; matrix[42] = 59.0; matrix[43] = 27.0; matrix[44] = 49.0; matrix[45] = 17.0; matrix[46] = 57.0; matrix[47] = 25.0;
          matrix[48] = 15.0; matrix[49] = 47.0; matrix[50] = 7.0; matrix[51] = 39.0; matrix[52] = 13.0; matrix[53] = 45.0; matrix[54] = 5.0; matrix[55] = 37.0;
          matrix[56] = 63.0; matrix[57] = 31.0; matrix[58] = 55.0; matrix[59] = 23.0; matrix[60] = 61.0; matrix[61] = 29.0; matrix[62] = 53.0; matrix[63] = 21.0;

          return matrix[index] / 64.0;
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);

          // Convert to grayscale
          float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

          // Apply dithering
          vec2 ditherCoord = vUv * vec2(1920.0, 1080.0) * uDitherScale;
          float threshold = bayer8x8(ditherCoord);

          float dithered = step(threshold, gray);

          // Output pure black or white
          gl_FragColor = vec4(vec3(dithered), 1.0);
        }
      `
    };
    super(shader);
  }

  updateUniforms(options) {
    if (options.threshold !== undefined) {
      this.uniforms.uThreshold.value = options.threshold;
    }
    if (options.ditherScale !== undefined) {
      this.uniforms.uDitherScale.value = options.ditherScale;
    }
  }
}
