import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Psychedelic Pass - Color shifting, kaleidoscope, wave distortions
 */
export class PsychedelicPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0.0 },
        uIntensity: { value: 1.0 }
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
        uniform float uTime;
        uniform float uIntensity;
        varying vec2 vUv;

        // HSV to RGB conversion
        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        // RGB to HSV conversion
        vec3 rgb2hsv(vec3 c) {
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
          float d = q.x - min(q.w, q.y);
          float e = 1.0e-10;
          return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        void main() {
          // Wave distortion
          vec2 uv = vUv;
          uv.x += sin(uv.y * 10.0 + uTime * 2.0) * 0.02 * uIntensity;
          uv.y += cos(uv.x * 10.0 + uTime * 2.0) * 0.02 * uIntensity;

          vec4 color = texture2D(tDiffuse, uv);

          // Convert to HSV
          vec3 hsv = rgb2hsv(color.rgb);

          // Shift hue over time
          hsv.x = fract(hsv.x + uTime * 0.1);

          // Boost saturation
          hsv.y = min(hsv.y * 1.5, 1.0);

          // Convert back to RGB
          vec3 finalColor = hsv2rgb(hsv);

          // Add kaleidoscope effect at edges
          vec2 center = vUv - 0.5;
          float angle = atan(center.y, center.x);
          float radius = length(center);

          float kaleidoscope = sin(angle * 6.0 + uTime) * 0.5 + 0.5;
          finalColor += kaleidoscope * radius * 0.3 * uIntensity;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    };
    super(shader);
  }

  updateUniforms(options) {
    if (options.time !== undefined) {
      this.uniforms.uTime.value = options.time;
    }
    if (options.intensity !== undefined) {
      this.uniforms.uIntensity.value = options.intensity;
    }
  }
}
