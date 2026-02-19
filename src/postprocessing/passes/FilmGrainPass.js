import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Film Grain Pass - Cinematic noise texture overlay
 */
export class FilmGrainPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0.0 },
        uIntensity: { value: 0.35 },
        uSpeed: { value: 1.0 }
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
        uniform float uSpeed;
        varying vec2 vUv;

        // Hash-based noise
        float hash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);

          // Animated film grain
          float t = uTime * uSpeed;
          float grain = hash(vUv * 1000.0 + t * 100.0) * 2.0 - 1.0;

          // Larger grain structure
          float grain2 = hash(floor(vUv * 400.0) + t * 50.0) * 2.0 - 1.0;
          grain = mix(grain, grain2, 0.3);

          // Apply grain based on luminance (less grain in bright areas)
          float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          float grainAmount = uIntensity * (1.0 - lum * 0.5);

          color.rgb += grain * grainAmount;

          gl_FragColor = color;
        }
      `
    };
    super(shader);
  }

  updateUniforms(options) {
    if (options.intensity !== undefined) {
      this.uniforms.uIntensity.value = options.intensity;
    }
    if (options.speed !== undefined) {
      this.uniforms.uSpeed.value = options.speed;
    }
    if (options.time !== undefined) {
      this.uniforms.uTime.value = options.time;
    }
  }
}
