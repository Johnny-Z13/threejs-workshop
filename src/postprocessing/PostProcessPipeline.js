import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import * as THREE from 'three';
import { EventBus } from '../utils/EventBus.js';
import { COLORS } from '../config.js';

/**
 * Post-processing pipeline orchestrator — supports stacking multiple effects
 */
export class PostProcessPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.currentModel = null;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.passes = new Map();
    this.addonPasses = new Set();
    this.activeStack = []; // [{passId, options}]
    this.elapsedTime = 0;

    EventBus.on('postprocess:enable', (passId, options) => this.enablePass(passId, options));
    EventBus.on('postprocess:disable', (passId) => this.disablePass(passId));
    EventBus.on('postprocess:disableAll', () => this.disableAll());
    EventBus.on('postprocess:updateParam', (...args) => {
      // New signature: single object { passId, key, value }
      if (args.length === 1 && typeof args[0] === 'object' && args[0].passId) {
        this.updatePassParam(args[0].passId, args[0].key, args[0].value);
      } else {
        // Backward compat: (paramKey, value)
        this.updateParam(args[0], args[1]);
      }
    });

    this.initializePasses();
  }

  async initializePasses() {
    const passModules = await Promise.all([
      import('./passes/AsciiPass.js'),
      import('./passes/SketchPass.js'),
      import('./passes/CelShadingPass.js'),
      import('./passes/GlitchPass.js'),
      import('./passes/DitheredPass.js'),
      import('./passes/PixelatedPass.js'),
      import('./passes/CRTPass.js'),
      import('./passes/PsychedelicPass.js'),
      import('./passes/VHSPass.js'),
      import('./passes/GameBoyPass.js'),
      import('./passes/VaporwavePass.js'),
      import('./passes/ThermalPass.js'),
      import('./passes/XRayPass.js'),
      import('./passes/FilmGrainPass.js')
    ]);

    const passNames = [
      'ascii', 'sketch', 'celshading', 'glitch', 'dithered', 'pixelated',
      'crt', 'psychedelic', 'vhs', 'gameboy', 'vaporwave', 'thermal', 'xray', 'filmgrain'
    ];
    const classNames = [
      'AsciiPass', 'SketchPass', 'CelShadingPass', 'GlitchPass', 'DitheredPass', 'PixelatedPass',
      'CRTPass', 'PsychedelicPass', 'VHSPass', 'GameBoyPass', 'VaporwavePass', 'ThermalPass', 'XRayPass', 'FilmGrainPass'
    ];

    passModules.forEach((mod, i) => {
      const PassClass = mod[classNames[i]];
      const pass = new PassClass();
      pass.enabled = false;
      this.composer.addPass(pass);
      this.passes.set(passNames[i], pass);
    });

    // --- Addon passes (Three.js built-in) ---
    const size = new THREE.Vector2();
    this.renderer.getSize(size);

    // Bloom
    const bloomPass = new UnrealBloomPass(size, 1.5, 0.4, 0.5);
    bloomPass.enabled = false;
    this.composer.addPass(bloomPass);
    this.passes.set('bloom', bloomPass);
    this.addonPasses.add('bloom');

    // DOF
    const bokehPass = new BokehPass(this.scene, this.camera, {
      focus: 2.0, aperture: 0.025, maxblur: 0.01
    });
    bokehPass.enabled = false;
    this.composer.addPass(bokehPass);
    this.passes.set('dof', bokehPass);
    this.addonPasses.add('dof');

    // Halftone
    const halftonePass = new HalftonePass(size.x, size.y, {
      shape: 1, radius: 6,
      rotateR: Math.PI / 12, rotateB: (Math.PI / 12) * 2, rotateG: (Math.PI / 12) * 3,
      scatter: 0, blending: 1, blendingMode: 1, greyscale: false
    });
    halftonePass.enabled = false;
    this.composer.addPass(halftonePass);
    this.passes.set('halftone', halftonePass);
    this.addonPasses.add('halftone');

    // Outline
    const outlinePass = new OutlinePass(size, this.scene, this.camera);
    outlinePass.edgeStrength = 1.0;
    outlinePass.edgeGlow = 2.0;
    outlinePass.edgeThickness = 1.0;
    outlinePass.visibleEdgeColor.set('#4a9eff');
    outlinePass.hiddenEdgeColor.set('#190a05');
    outlinePass.enabled = false;
    this.composer.addPass(outlinePass);
    this.passes.set('outline', outlinePass);
    this.addonPasses.add('outline');

    if (this.currentModel) this.updateOutlineObjects();
  }

  applyAddonPassOptions(passId, pass, options) {
    switch (passId) {
      case 'bloom':
        if (options.strength !== undefined) pass.strength = options.strength;
        if (options.threshold !== undefined) pass.threshold = options.threshold;
        if (options.radius !== undefined) pass.radius = options.radius;
        break;
      case 'dof':
        if (options.focus !== undefined) pass.uniforms['focus'].value = options.focus;
        if (options.aperture !== undefined) pass.uniforms['aperture'].value = options.aperture;
        if (options.maxblur !== undefined) pass.uniforms['maxblur'].value = options.maxblur;
        break;
      case 'halftone':
        if (options.dotSize !== undefined) pass.uniforms['radius'].value = options.dotSize;
        if (options.shape !== undefined) pass.uniforms['shape'].value = options.shape;
        break;
      case 'outline':
        if (options.edgeStrength !== undefined) pass.edgeStrength = options.edgeStrength;
        if (options.edgeGlow !== undefined) pass.edgeGlow = options.edgeGlow;
        if (options.edgeThickness !== undefined) pass.edgeThickness = options.edgeThickness;
        break;
    }
  }

  /**
   * Enable a single pass and add to the active stack (no disableAll)
   */
  enablePass(passId, options = {}) {
    const pass = this.passes.get(passId);
    if (!pass) return;

    // Don't double-add to stack
    if (!this.activeStack.find(s => s.passId === passId)) {
      this.activeStack.push({ passId, options });
    }

    pass.enabled = true;
    if (passId === 'outline') this.updateOutlineObjects();
    if (this.addonPasses.has(passId)) {
      this.applyAddonPassOptions(passId, pass, options);
    } else if (pass.updateUniforms) {
      pass.updateUniforms(options);
    }
    if (options.clearColor !== undefined) {
      this.renderer.setClearColor(options.clearColor);
    }
  }

  /**
   * Disable a single pass and remove from active stack
   */
  disablePass(passId) {
    const pass = this.passes.get(passId);
    if (pass) pass.enabled = false;
    this.activeStack = this.activeStack.filter(s => s.passId !== passId);

    // Reset clear color if no effects active
    if (this.activeStack.length === 0) {
      this.renderer.setClearColor(COLORS.bgPrimary);
    }
  }

  /**
   * Update a param on a specific pass
   */
  updatePassParam(passId, key, value) {
    const pass = this.passes.get(passId);
    if (!pass || !pass.enabled) return;

    if (this.addonPasses.has(passId)) {
      this.applyAddonPassOptions(passId, pass, { [key]: value });
    } else if (pass.updateUniforms) {
      pass.updateUniforms({ [key]: value });
    }

    // Update stored options in active stack
    const stackEntry = this.activeStack.find(s => s.passId === passId);
    if (stackEntry) {
      stackEntry.options[key] = value;
    }
  }

  /**
   * Backward-compat: broadcast param update to all enabled passes
   */
  updateParam(paramKey, value) {
    this.passes.forEach((pass, passId) => {
      if (pass.enabled) {
        if (this.addonPasses.has(passId)) {
          this.applyAddonPassOptions(passId, pass, { [paramKey]: value });
        } else if (pass.updateUniforms) {
          pass.updateUniforms({ [paramKey]: value });
        }
      }
    });
  }

  /**
   * Disable all passes and clear the stack
   */
  disableAll() {
    this.passes.forEach(pass => { pass.enabled = false; });
    this.activeStack = [];
    this.renderer.setClearColor(COLORS.bgPrimary);
  }

  /**
   * Apply a full stack: disableAll then enable each
   */
  setStack(stack) {
    this.disableAll();
    for (const { passId, options } of stack) {
      this.enablePass(passId, options || {});
    }
  }

  /**
   * Get list of currently active pass IDs
   */
  getActivePassIds() {
    return this.activeStack.map(s => s.passId);
  }

  isActive() {
    return this.activeStack.length > 0;
  }

  setModel(model) {
    this.currentModel = model;
    this.updateOutlineObjects();
  }

  updateOutlineObjects() {
    const outlinePass = this.passes.get('outline');
    if (!outlinePass || !this.currentModel) return;
    const meshes = [];
    this.currentModel.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });
    outlinePass.selectedObjects = meshes;
  }

  render(deltaTime) {
    if (this.isActive()) {
      this.elapsedTime += deltaTime;
      this.passes.forEach((pass) => {
        if (pass.enabled) {
          if (pass.uniforms && pass.uniforms.uTime) {
            pass.uniforms.uTime.value = this.elapsedTime;
          }
          if (pass.update) pass.update(deltaTime);
        }
      });
      this.composer.render();
      return true;
    }
    return false;
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
    const bloomPass = this.passes.get('bloom');
    if (bloomPass && bloomPass.resolution) bloomPass.resolution.set(width, height);
    const outlinePass = this.passes.get('outline');
    if (outlinePass && outlinePass.resolution) outlinePass.resolution.set(width, height);
  }
}
