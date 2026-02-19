import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { TextureUtils } from '../../utils/TextureUtils.js';
import { CONFIG } from '../../config.js';

/**
 * ASCII art post-processing pass
 */
export class AsciiPass extends ShaderPass {
  constructor() {
    const fontAtlas = TextureUtils.createFontAtlas();

    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        tFont: { value: fontAtlas },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uCellSize: { value: new THREE.Vector2(CONFIG.ASCII_CELL_W, CONFIG.ASCII_CELL_H) },
        uNumChars: { value: CONFIG.ASCII_CHARS.length },
        uTintColor: { value: new THREE.Vector3(1, 1, 1) },
        uBgColor: { value: new THREE.Vector3(0.02, 0.02, 0.03) },
        uUseSceneColor: { value: 1.0 },
        uScanlines: { value: 0.0 },
        uBrightness: { value: 1.0 },
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
        uniform sampler2D tFont;
        uniform vec2 uResolution;
        uniform vec2 uCellSize;
        uniform float uNumChars;
        uniform vec3 uTintColor;
        uniform vec3 uBgColor;
        uniform float uUseSceneColor;
        uniform float uScanlines;
        uniform float uBrightness;
        varying vec2 vUv;

        void main() {
          vec2 pixel = vUv * uResolution;
          vec2 cellCoord = floor(pixel / uCellSize);
          vec2 cellCenterUV = (cellCoord * uCellSize + uCellSize * 0.5) / uResolution;

          vec4 sceneColor = texture2D(tDiffuse, cellCenterUV);
          float lum = dot(sceneColor.rgb, vec3(0.299, 0.587, 0.114));

          // Map luminance to character index
          float charIdx = floor(lum * (uNumChars - 1.0) + 0.5);
          charIdx = clamp(charIdx, 0.0, uNumChars - 1.0);

          // Position within cell [0, 1]
          vec2 posInCell = fract(pixel / uCellSize);

          // Lookup into font atlas (single-row texture)
          vec2 fontUV = vec2(
            (charIdx + posInCell.x) / uNumChars,
            posInCell.y
          );

          float charVal = texture2D(tFont, fontUV).r;

          // Color mode: scene-tinted or monochrome
          vec3 tint;
          if (uUseSceneColor > 0.5) {
            tint = sceneColor.rgb * 1.4 + 0.1;
          } else {
            tint = uTintColor * (lum * 1.2 + 0.2);
          }
          vec3 color = mix(uBgColor, tint * uBrightness, charVal);

          // CRT scanline effect
          if (uScanlines > 0.5) {
            float scanline = sin(pixel.y * 1.5) * 0.5 + 0.5;
            color *= 0.8 + scanline * 0.2;
            // Phosphor glow
            float glow = charVal * lum * 0.15;
            color += uTintColor * glow;
            // CRT vignette
            vec2 vig = vUv * 2.0 - 1.0;
            color *= 1.0 - dot(vig * 0.45, vig * 0.45);
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `
    };

    super(shader);
  }

  updateUniforms(options = {}) {
    if (options.cellSize) {
      if (Array.isArray(options.cellSize)) {
        this.uniforms.uCellSize.value.set(options.cellSize[0], options.cellSize[1]);
      } else {
        // Single number from slider — maintain ~1:1.75 aspect ratio
        const w = options.cellSize;
        const h = Math.round(w * 1.75);
        this.uniforms.uCellSize.value.set(w, h);
      }
    }
    if (options.tintColor) {
      this.uniforms.uTintColor.value.set(...options.tintColor);
    }
    if (options.bgColor) {
      this.uniforms.uBgColor.value.set(...options.bgColor);
    }
    if (options.useSceneColor !== undefined) {
      this.uniforms.uUseSceneColor.value = options.useSceneColor;
    }
    if (options.scanlines !== undefined) {
      this.uniforms.uScanlines.value = options.scanlines;
    }
    if (options.colorMix !== undefined) {
      this.uniforms.uUseSceneColor.value = options.colorMix;
    }
    if (options.brightness !== undefined) {
      this.uniforms.uBrightness.value = options.brightness;
    }
  }

  setSize(width, height) {
    this.uniforms.uResolution.value.set(width, height);
  }
}
