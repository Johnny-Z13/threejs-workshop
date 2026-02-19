import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Vaporwave Pass — retrowave color grading with chromatic aberration and subtle scanlines
 */
export class VaporwavePass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0.0 },
        uIntensity: { value: 1.0 },
        uGridDensity: { value: 20.0 }
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
        uniform float uGridDensity;
        varying vec2 vUv;

        void main() {
          // Chromatic aberration
          float aberration = 0.0015 * uIntensity;
          vec4 color;
          color.r = texture2D(tDiffuse, vUv + vec2(aberration, 0.0)).r;
          color.g = texture2D(tDiffuse, vUv).g;
          color.b = texture2D(tDiffuse, vUv - vec2(aberration, 0.0)).b;
          color.a = 1.0;

          float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

          // Vaporwave color grading — shadows to pink/magenta, highlights to cyan
          vec3 shadowTint = vec3(0.6, 0.1, 0.5);  // deep magenta
          vec3 midTint    = vec3(0.9, 0.2, 0.6);   // hot pink
          vec3 highTint   = vec3(0.3, 0.9, 1.0);   // cyan

          vec3 graded = color.rgb;
          float shadowMask = smoothstep(0.5, 0.0, luma);
          float highMask   = smoothstep(0.5, 1.0, luma);
          float midMask    = 1.0 - shadowMask - highMask;

          graded = mix(graded, graded * shadowTint * 2.0, shadowMask * 0.5 * uIntensity);
          graded = mix(graded, graded + midTint * 0.15, midMask * uIntensity);
          graded = mix(graded, graded + highTint * 0.2, highMask * uIntensity);

          // Boost saturation slightly
          vec3 saturated = mix(vec3(luma), graded, 1.0 + 0.3 * uIntensity);

          // Subtle scanlines
          float scanline = sin(vUv.y * 600.0) * 0.5 + 0.5;
          scanline = mix(1.0, scanline, 0.06 * uIntensity);
          saturated *= scanline;

          // Soft vignette
          float vignette = 1.0 - smoothstep(0.4, 1.2, length(vUv - 0.5) * 1.5);
          saturated *= mix(1.0, vignette, 0.3 * uIntensity);

          gl_FragColor = vec4(saturated, 1.0);
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
    if (options.gridDensity !== undefined) {
      this.uniforms.uGridDensity.value = options.gridDensity;
    }
  }
}
