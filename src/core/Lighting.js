import { EventBus } from '../utils/EventBus.js';

/**
 * Lighting controller with multiple presets and intensity controls
 */
export class LightingController {
  constructor(lights) {
    this.lights = lights;
    this.currentPreset = '3-point';

    this.presets = {
      '3-point': {
        name: '3-Point',
        description: 'Classic 3-point lighting (key, fill, rim)',
        setup: () => this.apply3Point()
      },
      'studio': {
        name: 'Studio',
        description: 'Bright, even studio lighting',
        setup: () => this.applyStudio()
      },
      'dramatic': {
        name: 'Dramatic',
        description: 'High contrast single-source',
        setup: () => this.applyDramatic()
      },
      'natural': {
        name: 'Natural',
        description: 'Soft outdoor lighting',
        setup: () => this.applyNatural()
      }
    };

    EventBus.on('lighting:preset', (presetId) => this.applyPreset(presetId));
    EventBus.on('lighting:setIntensity', (lightName, intensity) => this.setLightIntensity(lightName, intensity));
  }

  applyPreset(presetId) {
    const preset = this.presets[presetId];
    if (!preset) return;
    this.currentPreset = presetId;
    preset.setup();
    EventBus.emit('lighting:changed', presetId);
  }

  apply3Point() {
    this.lights.key.intensity = 2.0;
    this.lights.key.position.set(3, 6, 4);
    this.lights.fill.intensity = 0.5;
    this.lights.fill.position.set(-3, 2, -2);
    this.lights.rim.intensity = 0.3;
    this.lights.rim.position.set(0, 3, -5);
    this.lights.ambient.intensity = 0.6;
    this.lights.hemi.intensity = 0.5;
  }

  applyStudio() {
    this.lights.key.intensity = 1.2;
    this.lights.key.position.set(0, 10, 5);
    this.lights.fill.intensity = 1.0;
    this.lights.fill.position.set(-8, 6, 0);
    this.lights.rim.intensity = 0.8;
    this.lights.rim.position.set(8, 6, 0);
    this.lights.ambient.intensity = 0.7;
    this.lights.hemi.intensity = 0.6;
  }

  applyDramatic() {
    this.lights.key.intensity = 3.0;
    this.lights.key.position.set(10, 12, 8);
    this.lights.fill.intensity = 0.1;
    this.lights.fill.position.set(-2, 2, -4);
    this.lights.rim.intensity = 0.2;
    this.lights.rim.position.set(-5, 4, -8);
    this.lights.ambient.intensity = 0.1;
    this.lights.hemi.intensity = 0.2;
  }

  applyNatural() {
    this.lights.key.intensity = 1.4;
    this.lights.key.position.set(8, 15, 10);
    this.lights.fill.intensity = 0.5;
    this.lights.fill.position.set(-6, 8, 6);
    this.lights.rim.intensity = 0.3;
    this.lights.rim.position.set(4, 6, -10);
    this.lights.ambient.intensity = 0.5;
    this.lights.hemi.intensity = 0.8;
  }

  setLightIntensity(lightName, intensity) {
    const light = this.lights[lightName];
    if (light) {
      light.intensity = intensity;
      EventBus.emit('lighting:intensity:changed', lightName, intensity);
    }
  }

  getLightIntensity(lightName) {
    const light = this.lights[lightName];
    return light ? light.intensity : 0;
  }

  getAllPresets() {
    return Object.entries(this.presets).map(([id, preset]) => ({
      id,
      name: preset.name,
      description: preset.description
    }));
  }
}
