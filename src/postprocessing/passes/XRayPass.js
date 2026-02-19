import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * X-Ray Pass - Inverted colors with edge glow
 */
export class XRayPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: { x: 1920, y: 1080 } },
        uGlowIntensity: { value: 2.0 }
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
        uniform vec2 uResolution;
        uniform float uGlowIntensity;
        varying vec2 vUv;

        void main() {
          vec2 texel = 1.0 / uResolution;

          // Sample neighboring pixels for edge detection
          float center = dot(texture2D(tDiffuse, vUv).rgb, vec3(0.299, 0.587, 0.114));
          float left = dot(texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
          float right = dot(texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
          float top = dot(texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
          float bottom = dot(texture2D(tDiffuse, vUv + vec2(0.0, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));

          // Edge detection
          float edge = abs(left - right) + abs(top - bottom);
          edge = smoothstep(0.05, 0.2, edge);

          // Invert colors
          vec4 color = texture2D(tDiffuse, vUv);
          vec3 inverted = 1.0 - color.rgb;

          // Make it more blue/cyan (X-ray aesthetic)
          inverted.b *= 1.3;
          inverted.g *= 1.1;

          // Add edge glow
          vec3 glowColor = vec3(0.2, 0.8, 1.0) * edge * uGlowIntensity;
          vec3 finalColor = inverted + glowColor;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    };
    super(shader);
  }

  setSize(width, height) {
    this.uniforms.uResolution.value.x = width;
    this.uniforms.uResolution.value.y = height;
  }

  updateUniforms(options) {
    if (options.glowIntensity !== undefined) {
      this.uniforms.uGlowIntensity.value = options.glowIntensity;
    }
  }
}
