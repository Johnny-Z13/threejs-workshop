import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * CRT Screen Pass - Scanlines, chromatic aberration, screen curvature
 */
export class CRTPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0.0 },
        uCurvature: { value: 3.0 },
        uScanlineIntensity: { value: 0.15 },
        uVignetteIntensity: { value: 0.3 }
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
        uniform float uCurvature;
        uniform float uScanlineIntensity;
        uniform float uVignetteIntensity;
        varying vec2 vUv;

        // CRT screen curvature
        vec2 curveScreen(vec2 uv) {
          uv = uv * 2.0 - 1.0;
          vec2 offset = abs(uv.yx) / uCurvature;
          uv = uv + uv * offset * offset;
          uv = uv * 0.5 + 0.5;
          return uv;
        }

        void main() {
          vec2 uv = curveScreen(vUv);

          // Out of bounds check
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
          }

          // Chromatic aberration
          float aberration = 0.002;
          vec2 aberrationOffset = (uv - 0.5) * aberration;
          float r = texture2D(tDiffuse, uv - aberrationOffset).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, uv + aberrationOffset).b;
          vec3 color = vec3(r, g, b);

          // Scanlines
          float scanline = sin(uv.y * 800.0) * uScanlineIntensity;
          color -= scanline;

          // Vignette
          vec2 vignetteUV = vUv * (1.0 - vUv.yx);
          float vignette = vignetteUV.x * vignetteUV.y * 15.0;
          vignette = pow(vignette, uVignetteIntensity);
          color *= vignette;

          // Subtle flicker
          color *= 0.95 + 0.05 * sin(110.0 * uTime);

          gl_FragColor = vec4(color, 1.0);
        }
      `
    };
    super(shader);
  }

  updateUniforms(options) {
    if (options.time !== undefined) {
      this.uniforms.uTime.value = options.time;
    }
    if (options.curvature !== undefined) {
      this.uniforms.uCurvature.value = options.curvature;
    }
    if (options.scanlineIntensity !== undefined) {
      this.uniforms.uScanlineIntensity.value = options.scanlineIntensity;
    }
    if (options.vignetteIntensity !== undefined) {
      this.uniforms.uVignetteIntensity.value = options.vignetteIntensity;
    }
  }
}
