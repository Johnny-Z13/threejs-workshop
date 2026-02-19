import { EventBus } from '../utils/EventBus.js';

/**
 * Lighting control panel UI
 */
export class LightingPanel {
  constructor(lightingController) {
    this.lightingController = lightingController;
    this.isOpen = false;
    this.createPanel();
    this.setupEventListeners();
  }

  createPanel() {
    const panel = document.createElement('div');
    panel.className = 'lighting-panel';
    panel.id = 'lightingPanel';

    panel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">Lighting</span>
        <button class="panel-close" id="closeLightingPanel">&times;</button>
      </div>
      <div class="panel-content">
        <div class="panel-section">
          <label class="panel-label">Preset</label>
          <div class="light-preset-buttons" id="lightingPresets"></div>
        </div>

        <div class="panel-section">
          <label class="panel-label">Light Rotation</label>
          <div class="light-dial-wrap">
            <div class="light-dial" id="lightDial">
              <div class="light-dial-dot" id="lightDialDot"></div>
            </div>
            <span class="light-dial-label" id="lightDialLabel">0&deg;</span>
          </div>
        </div>

        <div class="panel-section">
          <label class="panel-label">Key Light</label>
          <input type="range" class="light-slider" id="keyLightSlider"
                 min="0" max="5" step="0.1" value="2.0">
          <span class="slider-value" id="keyLightValue">2.0</span>
        </div>

        <div class="panel-section">
          <label class="panel-label">Fill Light</label>
          <input type="range" class="light-slider" id="fillLightSlider"
                 min="0" max="3" step="0.1" value="0.5">
          <span class="slider-value" id="fillLightValue">0.5</span>
        </div>

        <div class="panel-section">
          <label class="panel-label">Rim Light</label>
          <input type="range" class="light-slider" id="rimLightSlider"
                 min="0" max="2" step="0.1" value="0.3">
          <span class="slider-value" id="rimLightValue">0.3</span>
        </div>

        <div class="panel-section">
          <label class="panel-label">Ambient</label>
          <input type="range" class="light-slider" id="ambientLightSlider"
                 min="0" max="2" step="0.1" value="0.6">
          <span class="slider-value" id="ambientLightValue">0.6</span>
        </div>

        <div class="panel-section">
          <label class="panel-label">Hemisphere</label>
          <input type="range" class="light-slider" id="hemiLightSlider"
                 min="0" max="2" step="0.1" value="0.5">
          <span class="slider-value" id="hemiLightValue">0.5</span>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.populatePresets();
  }

  populatePresets() {
    const container = document.getElementById('lightingPresets');
    const presets = this.lightingController.getAllPresets();

    presets.forEach(preset => {
      const btn = document.createElement('button');
      btn.className = 'light-preset-btn';
      btn.dataset.preset = preset.id;
      btn.textContent = preset.name;
      btn.title = preset.description;

      if (preset.id === '3-point') btn.classList.add('active');

      btn.addEventListener('click', () => {
        EventBus.emit('lighting:preset', preset.id);
      });

      container.appendChild(btn);
    });
  }

  setupEventListeners() {
    document.getElementById('btnLighting')?.addEventListener('click', () => this.toggle());
    document.getElementById('closeLightingPanel')?.addEventListener('click', () => this.close());

    EventBus.on('panel:close-others', (source) => {
      if (source !== 'lighting' && this.isOpen) this.close();
    });

    this.setupSlider('keyLightSlider', 'keyLightValue', 'key');
    this.setupSlider('fillLightSlider', 'fillLightValue', 'fill');
    this.setupSlider('rimLightSlider', 'rimLightValue', 'rim');
    this.setupSlider('ambientLightSlider', 'ambientLightValue', 'ambient');
    this.setupSlider('hemiLightSlider', 'hemiLightValue', 'hemi');

    EventBus.on('lighting:changed', (presetId) => {
      this.updateSliders();
      this.updateActivePreset(presetId);
      this.resetDial();
    });

    this.setupDial();
  }

  setupSlider(sliderId, valueId, lightName) {
    const slider = document.getElementById(sliderId);
    const valueSpan = document.getElementById(valueId);
    if (!slider || !valueSpan) return;

    slider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      valueSpan.textContent = value.toFixed(1);
      EventBus.emit('lighting:setIntensity', lightName, value);
    });
  }

  updateSliders() {
    setTimeout(() => {
      this.updateSlider('keyLightSlider', 'keyLightValue', 'key');
      this.updateSlider('fillLightSlider', 'fillLightValue', 'fill');
      this.updateSlider('rimLightSlider', 'rimLightValue', 'rim');
      this.updateSlider('ambientLightSlider', 'ambientLightValue', 'ambient');
      this.updateSlider('hemiLightSlider', 'hemiLightValue', 'hemi');
    }, 50);
  }

  updateSlider(sliderId, valueId, lightName) {
    const slider = document.getElementById(sliderId);
    const valueSpan = document.getElementById(valueId);
    const intensity = this.lightingController.getLightIntensity(lightName);
    if (slider && valueSpan) {
      slider.value = intensity;
      valueSpan.textContent = intensity.toFixed(1);
    }
  }

  setupDial() {
    const dial = document.getElementById('lightDial');
    if (!dial) return;

    let dragging = false;

    const getAngle = (e) => {
      const rect = dial.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return Math.atan2(clientX - cx, -(clientY - cy));
    };

    const onMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      const angle = getAngle(e);
      this.updateDialVisual(angle);
      EventBus.emit('lighting:setRotation', angle);
    };

    const onUp = () => {
      dragging = false;
      dial.classList.remove('grabbing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    const onDown = (e) => {
      dragging = true;
      dial.classList.add('grabbing');
      const angle = getAngle(e);
      this.updateDialVisual(angle);
      EventBus.emit('lighting:setRotation', angle);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
    };

    dial.addEventListener('mousedown', onDown);
    dial.addEventListener('touchstart', onDown, { passive: true });
  }

  updateDialVisual(angle) {
    const dot = document.getElementById('lightDialDot');
    const label = document.getElementById('lightDialLabel');
    if (!dot || !label) return;

    const radius = 24; // half of 64px dial minus dot offset
    const dotX = Math.sin(angle) * radius;
    const dotY = -Math.cos(angle) * radius;
    dot.style.transform = `translate(${dotX}px, ${dotY}px)`;

    let degrees = Math.round(angle * 180 / Math.PI);
    if (degrees < 0) degrees += 360;
    label.textContent = `${degrees}\u00B0`;
  }

  resetDial() {
    this.updateDialVisual(0);
  }

  updateActivePreset(presetId) {
    document.querySelectorAll('.light-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === presetId);
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    const panel = document.getElementById('lightingPanel');
    const toolstrip = document.querySelector('.toolstrip');

    if (this.isOpen) EventBus.emit('panel:close-others', 'lighting');

    panel.classList.toggle('open', this.isOpen);
    document.getElementById('btnLighting')?.classList.toggle('active', this.isOpen);

    if (this.isOpen) {
      toolstrip?.classList.add('hidden');
    } else {
      toolstrip?.classList.remove('hidden');
    }
  }

  close() {
    this.isOpen = false;
    document.getElementById('lightingPanel')?.classList.remove('open');
    document.getElementById('btnLighting')?.classList.remove('active');
    document.querySelector('.toolstrip')?.classList.remove('hidden');
  }
}
