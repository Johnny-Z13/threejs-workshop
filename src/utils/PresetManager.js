import { EventBus } from './EventBus.js';
import { ShaderRegistry } from '../shaders/ShaderRegistry.js';

const STORAGE_KEY = 'charviewer_presets';
const MAX_PRESETS = 20;
const PRESET_VERSION = 2;

/**
 * Manages saving and loading of visual configuration presets (v2: material + effects stack)
 */
export class PresetManager {
  constructor({ renderModeController, renderPanel, lightingController, cameraAnimator }) {
    this.renderModeController = renderModeController;
    this.renderPanel = renderPanel;
    this.lightingController = lightingController;
    this.cameraAnimator = cameraAnimator;
  }

  captureCurrentState() {
    const materialId = this.renderModeController.currentMaterial;
    const materialShader = ShaderRegistry.get(materialId);
    const materialParams = {};
    if (materialShader && materialShader.params) {
      // Capture from render panel's accordion (material params not tracked per-effect)
      materialShader.params.forEach(p => {
        materialParams[p.key] = p.default; // best we can do without stored values
      });
    }

    // Capture effects stack
    const effectIds = this.renderModeController.getActiveEffectIds();
    const effects = effectIds.map(id => {
      const params = this.renderModeController.getEffectParams(id) || {};
      return { id, params };
    });

    const lightingPreset = this.lightingController.currentPreset;
    const intensities = {
      key: this.lightingController.getLightIntensity('key'),
      fill: this.lightingController.getLightIntensity('fill'),
      rim: this.lightingController.getLightIntensity('rim'),
      ambient: this.lightingController.getLightIntensity('ambient'),
      hemi: this.lightingController.getLightIntensity('hemi')
    };

    const cameraMode = this.cameraAnimator.mode;
    const cameraSpeed = this.cameraAnimator.speed;
    const cameraFov = this.cameraAnimator.camera.fov;

    const wireframe = this.renderModeController.wireframeEnabled;

    return {
      version: PRESET_VERSION,
      material: { id: materialId, params: materialParams },
      effects,
      lighting: { preset: lightingPreset, intensities },
      camera: { mode: cameraMode, speed: cameraSpeed, fov: cameraFov },
      scene: { wireframe }
    };
  }

  /**
   * Migrate v1 preset to v2 format
   */
  static migrateV1(preset) {
    if (preset.version >= 2) return preset;

    const shaderId = preset.shader?.id || 'standard';
    const shaderParams = preset.shader?.params || {};
    const shader = ShaderRegistry.get(shaderId);

    let material, effects;
    if (shader && shader.category === 'post-process') {
      // V1 stored a single post-process as the "shader" — migrate to effects
      material = { id: 'standard', params: {} };
      effects = [{ id: shaderId, params: shaderParams }];
    } else {
      material = { id: shaderId, params: shaderParams };
      effects = [];
    }

    return {
      ...preset,
      version: 2,
      material,
      effects,
      shader: undefined // remove old field
    };
  }

  savePreset(name) {
    const presets = this.getAllPresets();

    const preset = {
      name,
      timestamp: Date.now(),
      ...this.captureCurrentState()
    };

    presets.unshift(preset);

    if (presets.length > MAX_PRESETS) {
      presets.length = MAX_PRESETS;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    EventBus.emit('presets:changed');
    return preset;
  }

  applyPreset(preset) {
    // Auto-migrate if v1
    if (!preset.version || preset.version < 2) {
      preset = PresetManager.migrateV1(preset);
    }

    // 1. Apply material
    EventBus.emit('shader:apply', preset.material.id);

    // 2. Apply effects stack
    this.renderModeController.setEffectsStack(preset.effects || []);

    // 3. Apply material params + effect params after a small delay
    setTimeout(() => {
      if (preset.material.params) {
        for (const [key, value] of Object.entries(preset.material.params)) {
          EventBus.emit('shader:updateParam', key, value);
        }
      }

      // Apply per-effect params
      for (const effect of (preset.effects || [])) {
        if (effect.params) {
          for (const [key, value] of Object.entries(effect.params)) {
            EventBus.emit('postprocess:updateParam', { passId: effect.id, key, value });
          }
          this.renderPanel.setEffectParamValues(effect.id, effect.params);
        }
      }
    }, 100);

    // 4. Apply lighting preset
    EventBus.emit('lighting:preset', preset.lighting.preset);

    // 5. Apply individual light intensities
    setTimeout(() => {
      for (const [name, intensity] of Object.entries(preset.lighting.intensities)) {
        EventBus.emit('lighting:setIntensity', name, intensity);
      }
    }, 100);

    // 6. Camera
    EventBus.emit('camera:mode', preset.camera.mode);
    EventBus.emit('camera:setSpeed', preset.camera.speed);
    EventBus.emit('camera:setFOV', preset.camera.fov);

    // 7. Wireframe
    if (preset.scene.wireframe !== this.renderModeController.wireframeEnabled) {
      EventBus.emit('toggle:wireframe');
    }
  }

  deletePreset(timestamp) {
    const presets = this.getAllPresets().filter(p => p.timestamp !== timestamp);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    EventBus.emit('presets:changed');
  }

  getAllPresets() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      // Auto-migrate v1 presets on read
      return raw.map(p => (!p.version || p.version < 2) ? PresetManager.migrateV1(p) : p);
    } catch {
      return [];
    }
  }

  /**
   * Export a preset as portable JSON (material + effects + lighting)
   */
  static exportPreset(preset) {
    return JSON.stringify({
      format: 'charviewer-preset',
      version: 1,
      material: preset.material,
      effects: preset.effects || [],
      lighting: preset.lighting || null
    }, null, 2);
  }

  /**
   * Import a portable preset JSON string → { material, effects, lighting }
   */
  static importPreset(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.format !== 'charviewer-preset') {
        throw new Error('Invalid preset format');
      }
      return {
        material: data.material || { id: 'standard', params: {} },
        effects: data.effects || [],
        lighting: data.lighting || null
      };
    } catch (e) {
      console.error('PresetManager: import failed', e);
      return null;
    }
  }
}
