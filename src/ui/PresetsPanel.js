import { EventBus } from '../utils/EventBus.js';
import { PresetManager } from '../utils/PresetManager.js';

/**
 * Presets panel UI - save, load, export, and import visual configurations
 */
export class PresetsPanel {
  constructor(presetManager) {
    this.presetManager = presetManager;
    this.isOpen = false;
    this.createPanel();
    this.setupEventListeners();
    this.renderPresetList();
  }

  createPanel() {
    const panel = document.createElement('div');
    panel.className = 'presets-panel';
    panel.id = 'presetsPanel';

    panel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">Presets</span>
        <button class="panel-close" id="closePresetsPanel">&times;</button>
      </div>
      <div class="panel-subtitle">Save material, effects & lighting as one look</div>
      <div class="panel-content">
        <div class="panel-section">
          <button class="preset-save-btn" id="presetSaveBtn">
            <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save Current
          </button>
          <div class="preset-save-row hidden" id="presetSaveRow">
            <input type="text" class="preset-name-input" id="presetNameInput"
                   placeholder="Preset name..." maxlength="30" autocomplete="off">
            <button class="preset-confirm-btn" id="presetConfirmBtn">SAVE</button>
          </div>
          <button class="preset-import-btn" id="presetImportBtn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Import JSON
          </button>
          <div class="preset-import-row hidden" id="presetImportRow">
            <textarea class="preset-import-input" id="presetImportInput"
                      placeholder="Paste preset JSON..." rows="3"></textarea>
            <button class="preset-confirm-btn" id="presetImportConfirmBtn">IMPORT</button>
          </div>
        </div>

        <div class="panel-section">
          <label class="panel-label">Saved Presets</label>
          <div id="presetList"></div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
  }

  setupEventListeners() {
    document.getElementById('btnPresets')?.addEventListener('click', () => this.toggle());
    document.getElementById('closePresetsPanel')?.addEventListener('click', () => this.close());

    EventBus.on('panel:close-others', (source) => {
      if (source !== 'presets' && this.isOpen) this.close();
    });

    document.getElementById('presetSaveBtn')?.addEventListener('click', () => {
      const saveRow = document.getElementById('presetSaveRow');
      const input = document.getElementById('presetNameInput');
      saveRow.classList.remove('hidden');
      input.value = '';
      input.focus();
    });

    document.getElementById('presetConfirmBtn')?.addEventListener('click', () => this.handleSave());

    document.getElementById('presetNameInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleSave();
      } else if (e.key === 'Escape') {
        document.getElementById('presetSaveRow').classList.add('hidden');
      }
    });

    // Import
    document.getElementById('presetImportBtn')?.addEventListener('click', () => {
      const importRow = document.getElementById('presetImportRow');
      importRow.classList.toggle('hidden');
      if (!importRow.classList.contains('hidden')) {
        document.getElementById('presetImportInput').focus();
      }
    });

    document.getElementById('presetImportConfirmBtn')?.addEventListener('click', () => this.handleImport());

    document.getElementById('presetImportInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.getElementById('presetImportRow').classList.add('hidden');
      }
    });

    EventBus.on('presets:changed', () => this.renderPresetList());
  }

  handleSave() {
    const input = document.getElementById('presetNameInput');
    const name = input.value.trim();
    if (!name) return;

    this.presetManager.savePreset(name);
    document.getElementById('presetSaveRow').classList.add('hidden');
    input.value = '';
  }

  handleImport() {
    const input = document.getElementById('presetImportInput');
    const json = input.value.trim();
    if (!json) return;

    const imported = PresetManager.importPreset(json);
    if (!imported) {
      this.showToast('Invalid preset JSON');
      return;
    }

    // Apply imported preset (material + effects + lighting)
    EventBus.emit('shader:apply', imported.material.id);
    this.presetManager.renderModeController.setEffectsStack(imported.effects);

    // Apply lighting if present
    if (imported.lighting) {
      EventBus.emit('lighting:preset', imported.lighting.preset);
      setTimeout(() => {
        if (imported.lighting.intensities) {
          for (const [name, intensity] of Object.entries(imported.lighting.intensities)) {
            EventBus.emit('lighting:setIntensity', name, intensity);
          }
        }
      }, 100);
    }

    // Apply params after delay
    setTimeout(() => {
      if (imported.material.params) {
        for (const [key, value] of Object.entries(imported.material.params)) {
          EventBus.emit('shader:updateParam', key, value);
        }
      }
      for (const effect of imported.effects) {
        if (effect.params) {
          for (const [key, value] of Object.entries(effect.params)) {
            EventBus.emit('postprocess:updateParam', { passId: effect.id, key, value });
          }
        }
      }
    }, 100);

    document.getElementById('presetImportRow').classList.add('hidden');
    input.value = '';
    this.showToast('Preset imported');
  }

  renderPresetList() {
    const container = document.getElementById('presetList');
    if (!container) return;

    const presets = this.presetManager.getAllPresets();

    if (presets.length === 0) {
      container.innerHTML = '<div class="preset-empty">No saved presets yet.<br>Save your current setup to get started.</div>';
      return;
    }

    container.innerHTML = '';
    presets.forEach(preset => {
      const item = document.createElement('div');
      item.className = 'preset-item';

      const meta = this.buildMetaString(preset);

      item.innerHTML = `
        <div class="preset-item-info">
          <div class="preset-item-name">${this.escapeHtml(preset.name)}</div>
          <div class="preset-item-meta">${meta}</div>
        </div>
        <button class="preset-export-btn" title="Copy JSON">
          <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="preset-delete-btn" title="Delete preset">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      `;

      item.querySelector('.preset-item-info').addEventListener('click', () => {
        this.presetManager.applyPreset(preset);
      });

      item.querySelector('.preset-export-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const json = PresetManager.exportPreset(preset);
        navigator.clipboard.writeText(json).then(() => {
          this.showToast('Copied');
        }).catch(() => {
          this.showToast('Copy failed');
        });
      });

      item.querySelector('.preset-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.presetManager.deletePreset(preset.timestamp);
      });

      container.appendChild(item);
    });
  }

  buildMetaString(preset) {
    const parts = [];
    if (preset.material) {
      parts.push(preset.material.id);
    }
    if (preset.effects && preset.effects.length > 0) {
      const effectNames = preset.effects.map(e => e.id).join(' + ');
      parts.push(effectNames);
    }
    if (preset.lighting) {
      parts.push(preset.lighting.preset);
    }
    return parts.join(' · ');
  }

  showToast(message) {
    document.querySelector('.preset-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'preset-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 1500);
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    const panel = document.getElementById('presetsPanel');
    const toolstrip = document.querySelector('.toolstrip');

    if (this.isOpen) EventBus.emit('panel:close-others', 'presets');

    panel.classList.toggle('open', this.isOpen);
    document.getElementById('btnPresets')?.classList.toggle('active', this.isOpen);

    if (this.isOpen) {
      toolstrip?.classList.add('hidden');
    } else {
      toolstrip?.classList.remove('hidden');
    }
  }

  close() {
    this.isOpen = false;
    document.getElementById('presetsPanel')?.classList.remove('open');
    document.getElementById('btnPresets')?.classList.remove('active');
    document.querySelector('.toolstrip')?.classList.remove('hidden');
    document.getElementById('presetSaveRow')?.classList.add('hidden');
    document.getElementById('presetImportRow')?.classList.add('hidden');
  }
}
