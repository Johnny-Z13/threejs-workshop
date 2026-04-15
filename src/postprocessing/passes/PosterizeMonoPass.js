import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Posterize Mono — high-contrast monochrome posterisation pass.
 * Converts to greyscale, then snaps luminance into exactly N tonal bands
 * with hard (no-gradient) boundaries. Optional Sobel edge stroke for silhouette.
 */
export class PosterizeMonoPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse:       { value: null },
        uResolution:    { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uToneLevels:    { value: 4.0 },      // number of discrete tonal bands
        uBrightness:    { value: 0.05 },      // overall brightness offset
        uContrast:      { value: 1.4 },       // contrast multiplier (applied before quantise)
        uEdgeStrength:  { value: 0.3 },       // 0 = no edge, 1 = heavy silhouette stroke
        uEdgeThreshold: { value: 0.12 },      // Sobel sensitivity
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uToneLevels;
        uniform float uBrightness;
        uniform float uContrast;
        uniform float uEdgeStrength;
        uniform float uEdgeThreshold;
        varying vec2 vUv;

        float luma(vec3 c) {
          return dot(c, vec3(0.299, 0.587, 0.114));
        }

        void main() {
          vec2 texel = 1.0 / uResolution;
          vec4 src = texture2D(tDiffuse, vUv);

          // ── greyscale ──
          float grey = luma(src.rgb);

          // ── contrast + brightness ──
          grey = clamp((grey - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0);

          // ── hard posterise into N levels ──
          // e.g. 4 levels → values 0.0, 0.333, 0.667, 1.0
          float levels = max(uToneLevels, 2.0);
          float q = floor(grey * levels) / (levels - 1.0);
          q = clamp(q, 0.0, 1.0);

          // ── optional Sobel edge detection ──
          float edge = 0.0;
          if (uEdgeStrength > 0.001) {
            float tl = luma(texture2D(tDiffuse, vUv + vec2(-texel.x,  texel.y)).rgb);
            float t  = luma(texture2D(tDiffuse, vUv + vec2(     0.0,  texel.y)).rgb);
            float tr = luma(texture2D(tDiffuse, vUv + vec2( texel.x,  texel.y)).rgb);
            float l  = luma(texture2D(tDiffuse, vUv + vec2(-texel.x,      0.0)).rgb);
            float r  = luma(texture2D(tDiffuse, vUv + vec2( texel.x,      0.0)).rgb);
            float bl = luma(texture2D(tDiffuse, vUv + vec2(-texel.x, -texel.y)).rgb);
            float b  = luma(texture2D(tDiffuse, vUv + vec2(     0.0, -texel.y)).rgb);
            float br = luma(texture2D(tDiffuse, vUv + vec2( texel.x, -texel.y)).rgb);

            float gx = tl + 2.0*l + bl - tr - 2.0*r - br;
            float gy = tl + 2.0*t + tr - bl - 2.0*b - br;
            edge = sqrt(gx*gx + gy*gy);
            edge = step(uEdgeThreshold, edge); // hard edge, no feather
          }

          // ── composite: darken where edge detected ──
          float final = mix(q, 0.0, edge * uEdgeStrength);

          gl_FragColor = vec4(vec3(final), 1.0);
        }
      `
    };

    super(shader);
  }

  updateUniforms(options = {}) {
    if (options.toneLevels !== undefined) {
      this.uniforms.uToneLevels.value = options.toneLevels;
    }
    if (options.brightness !== undefined) {
      this.uniforms.uBrightness.value = options.brightness;
    }
    if (options.contrast !== undefined) {
      this.uniforms.uContrast.value = options.contrast;
    }
    if (options.edgeStrength !== undefined) {
      this.uniforms.uEdgeStrength.value = options.edgeStrength;
    }
    if (options.edgeThreshold !== undefined) {
      this.uniforms.uEdgeThreshold.value = options.edgeThreshold;
    }
  }

  setSize(width, height) {
    this.uniforms.uResolution.value.set(width, height);
  }
}
