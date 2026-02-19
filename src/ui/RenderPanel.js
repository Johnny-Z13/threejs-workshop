import { EventBus } from '../utils/EventBus.js';
import { ShaderRegistry } from '../shaders/ShaderRegistry.js';

/**
 * Render mode control panel UI — material radio buttons + stackable effect toggles
 */
export class RenderPanel {
  constructor() {
    this.isOpen = false;
    this.currentMaterial = 'standard';
    this.effectParamValues = {}; // { [effectId]: { [key]: value } }
    this.activeEffectIds = [];
    this.createPanel();
    this.setupEventListeners();
    EventBus.on('shaders:loaded', () => this.populateShaders());
  }

  createPanel() {
    const panel = document.createElement('div');
    panel.className = 'render-panel';
    panel.id = 'renderPanel';

    panel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">Render Mode</span>
        <button class="panel-close" id="closeRenderPanel">&times;</button>
      </div>
      <div class="panel-content">
        <div class="panel-section">
          <label class="panel-label">Material Modes</label>
          <div class="render-mode-list" id="materialModes"></div>
        </div>

        <div class="panel-section">
          <label class="panel-label">Post-Process Effects</label>
          <div class="render-mode-list" id="postProcessModes"></div>
        </div>
      </div>
      <div class="effect-settings hidden" id="effectSettings">
        <div class="effect-accordion" id="effectAccordion"></div>
        <button class="effect-reset-btn" id="effectResetBtn">Reset All</button>
      </div>
    `;

    document.body.appendChild(panel);
  }

  setupEventListeners() {
    document.getElementById('btnRender')?.addEventListener('click', () => this.toggle());
    document.getElementById('closeRenderPanel')?.addEventListener('click', () => this.close());

    EventBus.on('panel:close-others', (source) => {
      if (source !== 'render' && this.isOpen) this.close();
    });

    // Material changes — update radio highlight
    EventBus.on('material:changed', (shaderId) => {
      this.currentMaterial = shaderId;
      this.updateMaterialButtons(shaderId);
      this.updateMaterialSettings(shaderId);
    });

    // Backward compat: shader:changed still updates material buttons
    EventBus.on('shader:changed', (shaderId) => {
      this.currentMaterial = shaderId;
      this.updateMaterialButtons(shaderId);
    });

    // Effects stack changed — update toggle highlights + accordion
    EventBus.on('effects:changed', (effectIds) => {
      this.activeEffectIds = effectIds;
      this.updateEffectToggles(effectIds);
      this.updateEffectAccordion();
      this.updateBudgetState();
    });

    // Budget blocked — show toast
    EventBus.on('effects:budgetBlocked', (effectId, reason) => {
      this.showBudgetToast(reason);
    });

    document.getElementById('effectResetBtn')?.addEventListener('click', () => this.resetAllParams());
  }

  populateShaders() {
    const materialContainer = document.getElementById('materialModes');
    const postProcessContainer = document.getElementById('postProcessModes');

    const materialShaders = ShaderRegistry.getAllByCategory('material');
    const postProcessShaders = ShaderRegistry.getAllByCategory('post-process');

    materialShaders.forEach(shader => {
      materialContainer.appendChild(this.createMaterialButton(shader));
    });

    postProcessShaders.forEach(shader => {
      postProcessContainer.appendChild(this.createEffectToggle(shader));
    });
  }

  createMaterialButton(shader) {
    const btn = document.createElement('button');
    btn.className = 'render-mode-btn';
    btn.dataset.mode = shader.id;

    let keyLabel = '';
    if (shader.key) {
      keyLabel = `<span class="render-mode-key" title="Press ${shader.key}">${shader.key}</span>`;
    }

    btn.innerHTML = `
      <span class="render-mode-name">${shader.name}</span>
      ${keyLabel}
    `;

    btn.addEventListener('click', () => {
      EventBus.emit('shader:apply', shader.id);
    });

    return btn;
  }

  createEffectToggle(shader) {
    const btn = document.createElement('button');
    btn.className = 'render-mode-btn effect-toggle';
    btn.dataset.effect = shader.id;

    let keyLabel = '';
    if (shader.key) {
      keyLabel = `<span class="render-mode-key" title="Press ${shader.key}">${shader.key}</span>`;
    }

    const costBadge = shader.costTier
      ? `<span class="effect-cost-badge effect-cost-${shader.costTier}" title="${shader.costTier}">${shader.costTier[0].toUpperCase()}</span>`
      : '';

    btn.innerHTML = `
      <span class="render-mode-name">${shader.name}</span>
      <span class="effect-toggle-right">
        ${costBadge}
        ${keyLabel}
      </span>
    `;

    btn.addEventListener('click', () => {
      EventBus.emit('postprocess:toggle', shader.id);
    });

    return btn;
  }

  updateMaterialButtons(shaderId) {
    document.querySelectorAll('#materialModes .render-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === shaderId);
    });
  }

  updateEffectToggles(effectIds) {
    document.querySelectorAll('.effect-toggle').forEach(btn => {
      btn.classList.toggle('active', effectIds.includes(btn.dataset.effect));
    });
  }

  updateBudgetState() {
    document.querySelectorAll('.effect-toggle').forEach(btn => {
      const effectId = btn.dataset.effect;
      if (this.activeEffectIds.includes(effectId)) {
        btn.classList.remove('budget-blocked');
        btn.title = '';
        return;
      }
      const check = ShaderRegistry.canAddEffect(this.activeEffectIds, effectId);
      if (!check.allowed) {
        btn.classList.add('budget-blocked');
        btn.title = check.reason;
      } else {
        btn.classList.remove('budget-blocked');
        btn.title = '';
      }
    });
  }

  updateMaterialSettings(shaderId) {
    const shader = ShaderRegistry.get(shaderId);
    if (!shader || !shader.params || shader.params.length === 0) {
      // Only hide if no effects either
      if (this.activeEffectIds.length === 0) {
        document.getElementById('effectSettings')?.classList.add('hidden');
      }
      return;
    }
    // Material settings are shown as part of the accordion if needed
    this.updateEffectAccordion();
  }

  updateEffectAccordion() {
    const settingsContainer = document.getElementById('effectSettings');
    const accordion = document.getElementById('effectAccordion');

    // Collect sections: active material params + each active effect
    const sections = [];

    // Material params (if current material has params)
    const materialShader = ShaderRegistry.get(this.currentMaterial);
    if (materialShader && materialShader.params && materialShader.params.length > 0) {
      sections.push({
        id: this.currentMaterial,
        name: materialShader.name,
        params: materialShader.params,
        isMaterial: true
      });
    }

    // Effect params — in uiPosition order
    const effectShaders = this.activeEffectIds
      .map(id => ShaderRegistry.get(id))
      .filter(s => s && s.params && s.params.length > 0)
      .sort((a, b) => a.uiPosition - b.uiPosition);

    for (const shader of effectShaders) {
      sections.push({
        id: shader.id,
        name: shader.name,
        params: shader.params,
        isMaterial: false
      });
    }

    if (sections.length === 0) {
      settingsContainer.classList.add('hidden');
      return;
    }

    accordion.innerHTML = '';

    for (const section of sections) {
      const group = document.createElement('div');
      group.className = 'effect-param-group';
      group.dataset.sectionId = section.id;

      const header = document.createElement('div');
      header.className = 'effect-param-header';
      header.innerHTML = `<span>${section.name}</span><span class="effect-param-chevron">&#9662;</span>`;

      const body = document.createElement('div');
      body.className = 'effect-param-body';

      // Initialize param values store if needed
      if (!section.isMaterial) {
        if (!this.effectParamValues[section.id]) {
          this.effectParamValues[section.id] = {};
          section.params.forEach(p => { this.effectParamValues[section.id][p.key] = p.default; });
        }
      }

      section.params.forEach(param => {
        const currentVal = section.isMaterial
          ? (param.default) // material params don't have stored values per-effect
          : (this.effectParamValues[section.id]?.[param.key] ?? param.default);

        const row = document.createElement('div');
        row.className = 'effect-slider-row';

        const label = document.createElement('label');
        label.className = 'effect-slider-label';
        label.textContent = param.label;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'effect-slider';
        slider.min = param.min;
        slider.max = param.max;
        slider.step = param.step;
        slider.value = currentVal;
        slider.dataset.paramKey = param.key;
        slider.dataset.sectionId = section.id;

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'effect-slider-value';
        valueDisplay.textContent = this.formatValue(currentVal, param.step);

        slider.addEventListener('input', () => {
          const value = parseFloat(slider.value);
          valueDisplay.textContent = this.formatValue(value, param.step);

          if (section.isMaterial) {
            EventBus.emit('shader:updateParam', param.key, value);
          } else {
            this.effectParamValues[section.id] = this.effectParamValues[section.id] || {};
            this.effectParamValues[section.id][param.key] = value;
            EventBus.emit('postprocess:updateParam', { passId: section.id, key: param.key, value });
          }
        });

        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(valueDisplay);
        body.appendChild(row);
      });

      // Toggle collapse
      header.addEventListener('click', () => {
        group.classList.toggle('collapsed');
      });

      group.appendChild(header);
      group.appendChild(body);
      accordion.appendChild(group);
    }

    settingsContainer.classList.remove('hidden');
  }

  formatValue(value, step) {
    if (step >= 1) return Math.round(value).toString();
    const decimals = step.toString().split('.')[1]?.length || 1;
    return value.toFixed(Math.min(decimals, 2));
  }

  resetAllParams() {
    // Kill all active effects
    for (const effectId of [...this.activeEffectIds]) {
      EventBus.emit('postprocess:toggle', effectId);
    }
    this.effectParamValues = {};
    this.activeEffectIds = [];

    // Switch back to cinematic material
    EventBus.emit('shader:apply', 'cinematic');

    // Force UI sync — deselect all effect toggles, highlight cinematic
    this.updateEffectToggles([]);
    this.updateMaterialButtons('cinematic');
    this.updateBudgetState();

    // Hide settings accordion (cinematic default needs no tweaking)
    document.getElementById('effectSettings')?.classList.add('hidden');

    // Reset lighting to default preset
    EventBus.emit('lighting:preset', '3-point');

    // Reset camera to default
    EventBus.emit('camera:reset');

    // Reset floor to studio
    EventBus.emit('floor:set', 'studio');

    // Reset background to studio
    EventBus.emit('bg:set', 'studio');
  }

  /**
   * Set param values for a specific effect (used by preset loading)
   */
  setEffectParamValues(effectId, params) {
    if (!params) return;
    this.effectParamValues[effectId] = { ...params };
  }

  /**
   * Get all current param values keyed by effect ID
   */
  getAllEffectParams() {
    return { ...this.effectParamValues };
  }

  showBudgetToast(reason) {
    // Remove existing toast
    document.querySelector('.effect-budget-toast')?.remove();

    const toast = document.createElement('div');
    toast.className = 'effect-budget-toast';
    toast.textContent = reason;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  toggle() {
    this.isOpen = !this.isOpen;
    const panel = document.getElementById('renderPanel');
    const toolstrip = document.querySelector('.toolstrip');

    if (this.isOpen) EventBus.emit('panel:close-others', 'render');

    panel.classList.toggle('open', this.isOpen);
    document.getElementById('btnRender')?.classList.toggle('active', this.isOpen);

    if (this.isOpen) {
      toolstrip?.classList.add('hidden');
    } else {
      toolstrip?.classList.remove('hidden');
    }
  }

  close() {
    this.isOpen = false;
    document.getElementById('renderPanel')?.classList.remove('open');
    document.getElementById('btnRender')?.classList.remove('active');
    document.querySelector('.toolstrip')?.classList.remove('hidden');
  }
}
