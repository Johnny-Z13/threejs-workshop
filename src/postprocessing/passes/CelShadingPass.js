import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Cel Shading / Toon post-processing pass
 * Creates anime/cartoon-style rendering with posterized colors and hard edges
 */
export class CelShadingPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uColorLevels: { value: 4.0 },      // Number of color bands
        uEdgeThreshold: { value: 0.15 },   // Edge detection sensitivity
        uEdgeColor: { value: new THREE.Vector3(0.0, 0.0, 0.0) }  // Black outlines
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
        uniform float uColorLevels;
        uniform float uEdgeThreshold;
        uniform vec3 uEdgeColor;
        varying vec2 vUv;

        float luma(vec3 c) {
          return dot(c, vec3(0.299, 0.587, 0.114));
        }

        // Posterize color to discrete levels
        vec3 posterize(vec3 color, float levels) {
          return floor(color * levels) / levels;
        }

        void main() {
          vec2 texel = 1.0 / uResolution;
          vec4 color = texture2D(tDiffuse, vUv);

          // Posterize colors for toon effect
          vec3 toonColor = posterize(color.rgb, uColorLevels);

          // Edge detection (Sobel operator)
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

          // Apply edge as outline
          vec3 finalColor = toonColor;
          if (edge > uEdgeThreshold) {
            finalColor = uEdgeColor;
          }

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    };

    super(shader);
  }

  updateUniforms(options = {}) {
    if (options.colorLevels !== undefined) {
      this.uniforms.uColorLevels.value = options.colorLevels;
    }
    if (options.edgeThreshold !== undefined) {
      this.uniforms.uEdgeThreshold.value = options.edgeThreshold;
    }
    if (options.edgeDarkness !== undefined) {
      const v = options.edgeDarkness;
      this.uniforms.uEdgeColor.value.set(v, v, v);
    }
  }

  setSize(width, height) {
    this.uniforms.uResolution.value.set(width, height);
  }
}
