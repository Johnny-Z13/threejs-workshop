import { ShaderRegistry } from './ShaderRegistry.js';
import { EventBus } from '../utils/EventBus.js';

/**
 * Orchestrates shader mode switching — materials are exclusive, effects are stackable
 */
export class RenderModeController {
  constructor(modelManager, postProcess) {
    this.modelManager = modelManager;
    this.postProcess = postProcess;
    this.currentMaterial = 'standard';
    this.activeEffects = new Map(); // effectId → { paramValues }
    this.wireframeEnabled = false;

    EventBus.on('shader:apply', (shaderId, options) => this.applyShader(shaderId, options));
    EventBus.on('postprocess:toggle', (effectId) => this.toggleEffect(effectId));
    EventBus.on('toggle:wireframe', () => this.toggleWireframe());
    EventBus.on('shader:updateParam', (paramKey, value) => this.updateMaterialParam(paramKey, value));
  }

  // Backward compat getter
  get currentMode() {
    return this.currentMaterial;
  }

  applyShader(shaderId, options = {}) {
    const shader = ShaderRegistry.get(shaderId);
    if (!shader) return;

    if (shader.category === 'post-process') {
      // Redirect post-process shaders to toggleEffect
      this.toggleEffect(shaderId);
      return;
    }

    // Material application — don't touch effects stack
    const model = this.modelManager.modelRef;
    if (model) {
      model.traverse((child) => {
        if (child.isMesh && child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial;
        }
      });

      shader.apply(model, shaderId);
      if (this.wireframeEnabled) this.applyWireframe(true);
    }

    this.currentMaterial = shaderId;
    EventBus.emit('material:changed', shaderId, shader.name);
    // Backward compat
    EventBus.emit('shader:changed', shaderId, shader.name);
  }

  toggleEffect(effectId) {
    const shader = ShaderRegistry.get(effectId);
    if (!shader || shader.category !== 'post-process') return;

    if (this.activeEffects.has(effectId)) {
      // Disable
      this.activeEffects.delete(effectId);
      EventBus.emit('postprocess:disable', effectId);
    } else {
      // Check budget
      const currentIds = Array.from(this.activeEffects.keys());
      const check = ShaderRegistry.canAddEffect(currentIds, effectId);
      if (!check.allowed) {
        EventBus.emit('effects:budgetBlocked', effectId, check.reason);
        return;
      }

      // Build default params
      const paramValues = {};
      if (shader.params) {
        shader.params.forEach(p => { paramValues[p.key] = p.default; });
      }
      this.activeEffects.set(effectId, { paramValues });

      // Enable via pipeline — apply() emits postprocess:enable, but we bypass that
      // and call the pipeline directly via event
      const options = { ...paramValues };
      // Some effects have special clearColor in their apply(), we need to get those defaults
      EventBus.emit('postprocess:enable', effectId, options);
    }

    EventBus.emit('effects:changed', this.getActiveEffectIds());
  }

  getActiveEffectIds() {
    return Array.from(this.activeEffects.keys());
  }

  getEffectParams(effectId) {
    const entry = this.activeEffects.get(effectId);
    return entry ? { ...entry.paramValues } : null;
  }

  updateEffectParam(effectId, key, value) {
    const entry = this.activeEffects.get(effectId);
    if (entry) {
      entry.paramValues[key] = value;
    }
  }

  updateMaterialParam(paramKey, value) {
    const model = this.modelManager.modelRef;
    if (!model) return;

    model.traverse((child) => {
      if (child.isMesh && child.material) {
        const mat = child.material;
        if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
          if (paramKey === 'envMapIntensity') mat.envMapIntensity = value;
          if (paramKey === 'roughness') mat.roughness = value;
          mat.needsUpdate = true;
        }
      }
    });
  }

  toggleWireframe() {
    this.wireframeEnabled = !this.wireframeEnabled;
    this.applyWireframe(this.wireframeEnabled);
    EventBus.emit('wireframe:changed', this.wireframeEnabled);
  }

  applyWireframe(enabled) {
    const model = this.modelManager.modelRef;
    if (!model) return;

    model.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.wireframe = enabled);
        } else {
          child.material.wireframe = enabled;
        }
      }
    });
  }

  /**
   * Restore full effects state (for preset loading)
   */
  setEffectsStack(effects) {
    // Clear current
    for (const effectId of this.activeEffects.keys()) {
      EventBus.emit('postprocess:disable', effectId);
    }
    this.activeEffects.clear();

    // Apply new stack
    for (const { id, params } of effects) {
      const shader = ShaderRegistry.get(id);
      if (!shader) continue;
      const paramValues = params ? { ...params } : {};
      this.activeEffects.set(id, { paramValues });
      EventBus.emit('postprocess:enable', id, paramValues);
    }

    EventBus.emit('effects:changed', this.getActiveEffectIds());
  }
}
