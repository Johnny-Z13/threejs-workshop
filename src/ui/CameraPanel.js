import { EventBus } from '../utils/EventBus.js';

/**
 * Camera control panel UI
 */
export class CameraPanel {
  constructor() {
    this.isOpen = false;
    this.currentMode = 'none';
    this.createPanel();
    this.setupEventListeners();
  }

  createPanel() {
    const panel = document.createElement('div');
    panel.className = 'camera-panel';
    panel.id = 'cameraPanel';

    panel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">Camera</span>
        <button class="panel-close" id="closeCameraPanel">&times;</button>
      </div>
      <div class="panel-content">
        <div class="panel-section">
          <label class="panel-label">Animation Mode</label>
          <div class="camera-mode-grid">
            <button class="cam-mode-btn" data-mode="none">
              <svg viewBox="0 0 24 24"><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/><path d="M2.5 8.5A1.5 1.5 0 0 1 4 7h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5v-9z"/></svg>
              <span>Manual</span>
              <span class="cam-mode-key">M</span>
            </button>
            <button class="cam-mode-btn" data-mode="turntable">
              <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>
              <span>Turntable</span>
              <span class="cam-mode-key">R</span>
            </button>
            <button class="cam-mode-btn" data-mode="cinematic">
              <svg viewBox="0 0 24 24"><rect x="2" y="7" width="15" height="10" rx="1"/><polygon points="22 7 17 12 22 17 22 7"/></svg>
              <span>Cinematic</span>
              <span class="cam-mode-key">C</span>
            </button>
            <button class="cam-mode-btn" data-mode="drift">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Drift</span>
              <span class="cam-mode-key">V</span>
            </button>
            <button class="cam-mode-btn" data-mode="bounce">
              <svg viewBox="0 0 24 24"><path d="M4 20 Q8 4 12 12 Q16 20 20 4"/></svg>
              <span>Bounce</span>
              <span class="cam-mode-key">B</span>
            </button>
          </div>
        </div>

        <div class="panel-section">
          <label class="panel-label">Animation Speed</label>
          <input type="range" class="camera-slider" id="animSpeedSlider"
                 min="0.1" max="3" step="0.1" value="1.0">
          <span class="slider-value" id="animSpeedValue">1.0&times;</span>
        </div>

        <div class="panel-section">
          <label class="panel-label">Field of View</label>
          <input type="range" class="camera-slider" id="fovSlider"
                 min="20" max="90" step="1" value="45">
          <span class="slider-value" id="fovValue">45&deg;</span>
        </div>

        <div class="panel-section">
          <label class="panel-label">Quick Actions</label>
          <div class="cam-action-buttons">
            <button class="cam-action-btn" id="fitCameraBtn">
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
              <span>Fit</span>
            </button>
            <button class="cam-action-btn" id="resetCameraBtn">
              <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              <span>Reset</span>
            </button>
            <button class="cam-action-btn" id="fullscreenBtn">
              <svg viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              <span>Fullscreen (F)</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.updateActiveMode('none');
  }

  setupEventListeners() {
    document.getElementById('btnCamera')?.addEventListener('click', () => this.toggle());
    document.getElementById('closeCameraPanel')?.addEventListener('click', () => this.close());

    EventBus.on('panel:close-others', (source) => {
      if (source !== 'camera' && this.isOpen) this.close();
    });

    // Mode buttons — use class-specific selector
    document.querySelectorAll('.cam-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        EventBus.emit('camera:mode', btn.dataset.mode);
      });
    });

    // Speed slider
    const animSpeedSlider = document.getElementById('animSpeedSlider');
    const animSpeedValue = document.getElementById('animSpeedValue');
    animSpeedSlider?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      animSpeedValue.textContent = value.toFixed(1) + '\u00d7';
      EventBus.emit('camera:setSpeed', value);
    });

    // FOV slider
    const fovSlider = document.getElementById('fovSlider');
    const fovValue = document.getElementById('fovValue');
    fovSlider?.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      fovValue.textContent = value + '\u00b0';
      EventBus.emit('camera:setFOV', value);
    });

    // Action buttons
    document.getElementById('fitCameraBtn')?.addEventListener('click', () => EventBus.emit('camera:fit'));
    document.getElementById('resetCameraBtn')?.addEventListener('click', () => EventBus.emit('camera:reset'));
    document.getElementById('fullscreenBtn')?.addEventListener('click', () => EventBus.emit('fullscreen:toggle'));

    // Mode change feedback
    EventBus.on('camera:mode:changed', (mode) => {
      this.currentMode = mode;
      this.updateActiveMode(mode);
    });
  }

  updateActiveMode(mode) {
    document.querySelectorAll('.cam-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    const panel = document.getElementById('cameraPanel');
    const toolstrip = document.querySelector('.toolstrip');

    if (this.isOpen) EventBus.emit('panel:close-others', 'camera');

    panel.classList.toggle('open', this.isOpen);
    document.getElementById('btnCamera')?.classList.toggle('active', this.isOpen);

    if (this.isOpen) {
      toolstrip?.classList.add('hidden');
    } else {
      toolstrip?.classList.remove('hidden');
    }
  }

  close() {
    this.isOpen = false;
    document.getElementById('cameraPanel')?.classList.remove('open');
    document.getElementById('btnCamera')?.classList.remove('active');
    document.querySelector('.toolstrip')?.classList.remove('hidden');
  }
}
