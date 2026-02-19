import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * VHS Tape Pass - Tracking lines, color bleeding, noise, chromatic aberration
 */
export class VHSPass extends ShaderPass {
  constructor() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0.0 },
        uNoiseIntensity: { value: 0.15 }
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
        uniform float uNoiseIntensity;
        varying vec2 vUv;

        // Random noise function
        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
          vec2 uv = vUv;

          // VHS tracking lines
          float trackingLine = step(0.98, fract(uv.y * 50.0 + uTime * 2.0));
          uv.x += trackingLine * 0.05 * sin(uTime * 20.0);

          // Chromatic aberration (stronger than CRT)
          float aberration = 0.005;
          float r = texture2D(tDiffuse, uv + vec2(aberration, 0.0)).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, uv - vec2(aberration, 0.0)).b;
          vec3 color = vec3(r, g, b);

          // VHS noise
          float noise = random(uv * uTime) * uNoiseIntensity;
          color += noise;

          // Color bleeding
          vec2 bleedOffset = vec2(0.003, 0.0);
          vec3 bleed = texture2D(tDiffuse, uv - bleedOffset).rgb * 0.3;
          color = mix(color, bleed, 0.3);

          // Horizontal sync issues
          float syncError = step(0.95, random(vec2(uv.y * 10.0, floor(uTime * 3.0))));
          uv.x += syncError * 0.1 * sin(uTime * 50.0);

          // Tape wear darkening
          float wear = 0.85 + 0.15 * random(vec2(uTime * 0.1, uv.y));
          color *= wear;

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
    if (options.noiseIntensity !== undefined) {
      this.uniforms.uNoiseIntensity.value = options.noiseIntensity;
    }
  }
}
