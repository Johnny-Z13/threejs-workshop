import { EventBus } from './EventBus.js';
import { ShaderRegistry } from '../shaders/ShaderRegistry.js';

/**
 * Global keyboard shortcut handler
 * Material keys (1-3) are exclusive radio. Effect keys (4-0) toggle on/off.
 */
export class KeyboardShortcuts {
  constructor() {
    this.currentMaterialIndex = 0;
    this.materialShaders = [];
    this.shortcuts = this.defineShortcuts();
    this.setupListener();
    this.initializeShaderList();
  }

  initializeShaderList() {
    EventBus.on('shaders:loaded', () => {
      this.materialShaders = ShaderRegistry.getAllByCategory('material');

      EventBus.on('material:changed', (shaderId) => {
        const index = this.materialShaders.findIndex(s => s.id === shaderId);
        if (index !== -1) {
          this.currentMaterialIndex = index;
        }
      });

      // Backward compat
      EventBus.on('shader:changed', (shaderId) => {
        const index = this.materialShaders.findIndex(s => s.id === shaderId);
        if (index !== -1) {
          this.currentMaterialIndex = index;
        }
      });
    });
  }

  cycleMaterial(direction) {
    if (this.materialShaders.length === 0) return;

    this.currentMaterialIndex += direction;

    if (this.currentMaterialIndex < 0) {
      this.currentMaterialIndex = this.materialShaders.length - 1;
    } else if (this.currentMaterialIndex >= this.materialShaders.length) {
      this.currentMaterialIndex = 0;
    }

    const shader = this.materialShaders[this.currentMaterialIndex];
    EventBus.emit('shader:apply', shader.id);
  }

  defineShortcuts() {
    return {
      // Material modes (1-3) — exclusive radio
      '1': () => EventBus.emit('shader:apply', 'cinematic'),
      '2': () => EventBus.emit('shader:apply', 'matcap'),
      '3': () => EventBus.emit('shader:apply', 'normals'),

      // Post-process effects (4-0) — stackable toggle
      '4': () => EventBus.emit('postprocess:toggle', 'ascii'),
      '5': () => EventBus.emit('postprocess:toggle', 'dithered'),
      '6': () => EventBus.emit('postprocess:toggle', 'pixelated'),
      '7': () => EventBus.emit('postprocess:toggle', 'crt'),
      '8': () => EventBus.emit('postprocess:toggle', 'celshading'),
      '9': () => EventBus.emit('postprocess:toggle', 'glitch'),
      '0': () => EventBus.emit('postprocess:toggle', 'sketch'),

      // Toggles
      'w': () => EventBus.emit('toggle:wireframe'),
      'g': () => EventBus.emit('floor:cycle'),
      'h': () => EventBus.emit('bg:cycle'),

      // Camera modes
      'r': () => EventBus.emit('camera:mode', 'turntable'),
      'c': () => EventBus.emit('camera:mode', 'cinematic'),
      'v': () => EventBus.emit('camera:mode', 'drift'),
      'b': () => EventBus.emit('camera:mode', 'bounce'),
      'f': () => EventBus.emit('fullscreen:toggle'),

      // Render panel
      's': () => document.getElementById('btnRender')?.click(),

      // Lighting panel
      'l': () => document.getElementById('btnLighting')?.click(),

      // Camera panel
      'm': () => document.getElementById('btnCamera')?.click(),

      // Cycle through material modes only
      ',': () => this.cycleMaterial(-1),
      '.': () => this.cycleMaterial(1),

      // Model navigation
      'arrowleft': () => EventBus.emit('folder:prev'),
      'arrowright': () => EventBus.emit('folder:next'),
    };
  }

  setupListener() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();
      const handler = this.shortcuts[key];

      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }
}
