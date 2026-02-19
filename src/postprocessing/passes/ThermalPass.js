import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Thermal Vision Pass - Heat map color mapping
 */
export class ThermalPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0.0 },
        uNoiseAmount: { value: 0.1 },
        uScanlineIntensity: { value: 0.05 }
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
        uniform float uNoiseAmount;
        uniform float uScanlineIntensity;
        varying vec2 vUv;

        // Thermal color palette
        vec3 thermal(float t) {
          // Black -> Purple -> Red -> Orange -> Yellow -> White
          vec3 color;

          if (t < 0.2) {
            // Black to purple
            color = mix(vec3(0.0, 0.0, 0.0), vec3(0.5, 0.0, 0.5), t * 5.0);
          } else if (t < 0.4) {
            // Purple to red
            color = mix(vec3(0.5, 0.0, 0.5), vec3(1.0, 0.0, 0.0), (t - 0.2) * 5.0);
          } else if (t < 0.6) {
            // Red to orange
            color = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 0.5, 0.0), (t - 0.4) * 5.0);
          } else if (t < 0.8) {
            // Orange to yellow
            color = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 1.0, 0.0), (t - 0.6) * 5.0);
          } else {
            // Yellow to white
            color = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 1.0, 1.0), (t - 0.8) * 5.0);
          }

          return color;
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);

          // Convert to brightness
          float heat = dot(color.rgb, vec3(0.299, 0.587, 0.114));

          // Add animated noise
          float noise = fract(sin(dot(vUv + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
          heat += noise * uNoiseAmount;

          // Apply thermal palette
          vec3 thermalColor = thermal(heat);

          // Scanline effect
          float scanline = sin(vUv.y * 500.0) * uScanlineIntensity;
          thermalColor += scanline;

          gl_FragColor = vec4(thermalColor, 1.0);
        }
      `
    };
    super(shader);
  }

  updateUniforms(options) {
    if (options.time !== undefined) {
      this.uniforms.uTime.value = options.time;
    }
    if (options.noiseAmount !== undefined) {
      this.uniforms.uNoiseAmount.value = options.noiseAmount;
    }
    if (options.scanlineIntensity !== undefined) {
      this.uniforms.uScanlineIntensity.value = options.scanlineIntensity;
    }
  }
}
