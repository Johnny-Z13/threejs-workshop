import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Glitch Effect post-processing pass
 * Creates cyberpunk-style digital corruption with chromatic aberration and scanlines
 */
export class GlitchPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uGlitchIntensity: { value: 0.5 }
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
        uniform float uTime;
        uniform vec2 uResolution;
        uniform float uGlitchIntensity;
        varying vec2 vUv;

        // Pseudo-random function
        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }

        // Noise function
        float noise(vec2 st) {
          vec2 i = floor(st);
          vec2 f = fract(st);
          float a = random(i);
          float b = random(i + vec2(1.0, 0.0));
          float c = random(i + vec2(0.0, 1.0));
          float d = random(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          vec2 uv = vUv;

          // Glitch blocks - random horizontal shifts
          float blockSize = 20.0;
          float blockY = floor(uv.y * uResolution.y / blockSize);
          float glitchRandom = random(vec2(blockY, floor(uTime * 4.0)));

          // Apply horizontal shift to some blocks
          if (glitchRandom > 0.85) {
            float shift = (random(vec2(blockY, uTime)) - 0.5) * 0.1 * uGlitchIntensity;
            uv.x += shift;
          }

          // Chromatic aberration (RGB split)
          float aberration = 0.003 * uGlitchIntensity;
          vec2 direction = vec2(sin(uTime * 2.0), cos(uTime * 3.0));

          float r = texture2D(tDiffuse, uv + direction * aberration).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, uv - direction * aberration).b;

          vec3 color = vec3(r, g, b);

          // Random color corruption on some scanlines
          float scanline = floor(uv.y * uResolution.y);
          float corruptRandom = random(vec2(scanline, floor(uTime * 8.0)));

          if (corruptRandom > 0.95) {
            color = vec3(random(uv + uTime), random(uv - uTime), random(uv * uTime));
          }

          // Digital scanlines
          float scanlineEffect = sin(uv.y * uResolution.y * 2.0) * 0.04;
          color -= scanlineEffect;

          // Vertical sync glitch (occasional full-screen shift)
          float vsyncGlitch = step(0.98, noise(vec2(uTime * 0.5, 0.5)));
          if (vsyncGlitch > 0.5) {
            uv.y = fract(uv.y + noise(vec2(uTime * 10.0, 0.0)) * 0.1);
            color = texture2D(tDiffuse, uv).rgb;
          }

          // RGB noise overlay
          float noiseAmount = 0.05 * uGlitchIntensity;
          color += (random(uv + uTime) - 0.5) * noiseAmount;

          // Vignette for cyberpunk feel
          vec2 vignetteUV = vUv * 2.0 - 1.0;
          float vignette = 1.0 - dot(vignetteUV * 0.3, vignetteUV * 0.3);
          color *= vignette;

          gl_FragColor = vec4(color, 1.0);
        }
      `
    };

    super(shader);
    this.time = 0;
  }

  updateUniforms(options = {}) {
    if (options.glitchIntensity !== undefined) {
      this.uniforms.uGlitchIntensity.value = options.glitchIntensity;
    }
  }

  update(deltaTime) {
    this.time += deltaTime;
    this.uniforms.uTime.value = this.time;
  }

  setSize(width, height) {
    this.uniforms.uResolution.value.set(width, height);
  }
}
