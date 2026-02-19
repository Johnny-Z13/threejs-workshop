import { EventBus } from '../utils/EventBus.js';

/**
 * Central registry for all shaders (material and post-process modes)
 */
export class ShaderRegistry {
  static shaders = new Map();
  static activeShader = 'standard';

  static COST_WEIGHTS = { trivial: 0.2, light: 1, medium: 2, heavy: 4 };
  static MAX_BUDGET = 6;
  static MAX_STACK = 6;

  static async initialize() {
    await this.registerBuiltIns();
    console.log(`ShaderRegistry: ${this.shaders.size} shaders registered`);
    EventBus.emit('shaders:loaded', Array.from(this.shaders.keys()));
    return this;
  }

  static register(id, shaderDefinition) {
    const category = shaderDefinition.category || 'material';
    this.shaders.set(id, {
      id,
      name: shaderDefinition.name,
      key: shaderDefinition.key || null,
      category,
      apply: shaderDefinition.apply,
      uiPosition: shaderDefinition.uiPosition || 999,
      variants: shaderDefinition.variants || null,
      params: shaderDefinition.params || [],
      costTier: shaderDefinition.costTier || null,
      stackable: shaderDefinition.stackable !== undefined
        ? shaderDefinition.stackable
        : category === 'post-process'
    });
  }

  static async registerBuiltIns() {
    const builtIns = [
      import('./library/cinematic.js'),
      import('./library/standard.js'),
      import('./library/chrome.js'),
      import('./library/matcap.js'),
      import('./library/normals.js'),
      import('./library/ascii.js'),
      import('./library/sketch.js'),
      import('./library/celshading.js'),
      import('./library/glitch.js'),
      import('./library/dithered.js'),
      import('./library/pixelated.js'),
      import('./library/crt.js'),
      import('./library/psychedelic.js'),
      import('./library/vhs.js'),
      import('./library/gameboy.js'),
      import('./library/vaporwave.js'),
      import('./library/thermal.js'),
      import('./library/xray.js'),
      import('./library/bloom.js'),
      import('./library/dof.js'),
      import('./library/filmgrain.js'),
      import('./library/halftone.js'),
      import('./library/outline.js')
    ];

    const modules = await Promise.all(builtIns);
    modules.forEach(mod => {
      this.register(mod.id, mod);
      if (mod.variants) {
        mod.variants.forEach(variant => {
          this.register(variant.id, { ...mod, ...variant, isVariant: true });
        });
      }
    });
  }

  static get(shaderId) {
    return this.shaders.get(shaderId);
  }

  static getAllByCategory(category) {
    return Array.from(this.shaders.values())
      .filter(shader => shader.category === category && !shader.isVariant)
      .sort((a, b) => a.uiPosition - b.uiPosition);
  }

  static getAll() {
    return Array.from(this.shaders.values());
  }

  /**
   * Check if adding an effect would exceed the performance budget
   * @param {string[]} currentStackIds - IDs of currently active effects
   * @param {string} candidateId - ID of the effect to add
   * @returns {{ allowed: boolean, reason?: string, totalCost?: number }}
   */
  static canAddEffect(currentStackIds, candidateId) {
    if (currentStackIds.includes(candidateId)) {
      return { allowed: true }; // toggling off is always allowed
    }

    if (currentStackIds.length >= this.MAX_STACK) {
      return { allowed: false, reason: `Maximum ${this.MAX_STACK} effects allowed` };
    }

    const candidate = this.shaders.get(candidateId);
    if (!candidate || !candidate.costTier) {
      return { allowed: true };
    }

    let totalCost = this.COST_WEIGHTS[candidate.costTier] || 0;
    for (const id of currentStackIds) {
      const shader = this.shaders.get(id);
      if (shader && shader.costTier) {
        totalCost += this.COST_WEIGHTS[shader.costTier] || 0;
      }
    }

    if (totalCost > this.MAX_BUDGET) {
      return {
        allowed: false,
        reason: `Budget exceeded (${totalCost.toFixed(1)}/${this.MAX_BUDGET})`,
        totalCost
      };
    }

    return { allowed: true, totalCost };
  }
}
