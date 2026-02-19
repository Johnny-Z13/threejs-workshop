import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Sketch (Sobel edge detection + cross-hatch) post-processing pass
 */
export class SketchPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uEdgeThreshold: { value: 0.04 },
        uHatchDensity: { value: 80.0 },
        uInkDarkness: { value: 0.0 },
        uPaperTone: { value: 0.95 },
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
        uniform float uEdgeThreshold;
        uniform float uHatchDensity;
        uniform float uInkDarkness;
        uniform float uPaperTone;
        varying vec2 vUv;

        float luma(vec3 c) {
          return dot(c, vec3(0.299, 0.587, 0.114));
        }

        void main() {
          vec2 texel = 1.0 / uResolution;

          // 3x3 Sobel kernel samples
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
          float edge = sqrt(gx*gx + gy*gy);

          // Tonal fill from scene luminance
          float sceneLum = luma(texture2D(tDiffuse, vUv).rgb);

          // Warm paper base
          vec3 paper = vec3(uPaperTone, uPaperTone * 0.978, uPaperTone * 0.937);
          vec3 tone = paper * (0.82 + sceneLum * 0.18);

          // Cross-hatch darkening in shadows
          float hatch = 0.0;
          if (sceneLum < 0.4) {
            float line1 = abs(sin((vUv.x + vUv.y) * uHatchDensity));
            hatch += smoothstep(0.3, 0.0, sceneLum) * (1.0 - smoothstep(0.0, 0.15, line1)) * 0.3;
          }
          if (sceneLum < 0.25) {
            float line2 = abs(sin((vUv.x - vUv.y) * uHatchDensity));
            hatch += smoothstep(0.15, 0.0, sceneLum) * (1.0 - smoothstep(0.0, 0.15, line2)) * 0.25;
          }

          // Ink edges
          float ink = smoothstep(uEdgeThreshold, uEdgeThreshold + 0.16, edge);
          vec3 inkColor = vec3(0.12 - uInkDarkness * 0.12, 0.10 - uInkDarkness * 0.10, 0.08 - uInkDarkness * 0.08);

          vec3 result = tone;
          result = mix(result, inkColor, hatch);
          result = mix(result, inkColor, ink);

          gl_FragColor = vec4(result, 1.0);
        }
      `
    };

    super(shader);
  }

  updateUniforms(options = {}) {
    if (options.edgeThreshold !== undefined) {
      this.uniforms.uEdgeThreshold.value = options.edgeThreshold;
    }
    if (options.hatchDensity !== undefined) {
      this.uniforms.uHatchDensity.value = options.hatchDensity;
    }
    if (options.inkDarkness !== undefined) {
      this.uniforms.uInkDarkness.value = options.inkDarkness;
    }
    if (options.paperTone !== undefined) {
      this.uniforms.uPaperTone.value = options.paperTone;
    }
  }

  setSize(width, height) {
    this.uniforms.uResolution.value.set(width, height);
  }
}
