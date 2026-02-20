import { EventBus } from '../utils/EventBus.js';

/**
 * Animation clip buttons at bottom-center + delete mode + cycle/shuffle
 */
export class AnimationBar {
  constructor(uiEl, animationManager, confirmDialog) {
    this.uiEl = uiEl;
    this.animationManager = animationManager;
    this.confirmDialog = confirmDialog;
    this.cycleMode = 'off'; // 'off' | 'cycle' | 'shuffle'
    this._onFinishBound = (e) => this._onAnimFinish(e);

    EventBus.on('animations:updated', () => this.rebuild());
    EventBus.on('animation:switched', (name) => this.highlightActive(name));
  }

  rebuild() {
    const { actions } = this.animationManager;
    this.uiEl.innerHTML = '';
    this._stopCycleMode();

    const names = Object.keys(actions);
    if (names.length === 0) {
      this.uiEl.style.display = 'none';
      return;
    }

    names.forEach((name) => {
      const btn = document.createElement('button');
      btn.dataset.anim = name;

      const label = document.createElement('span');
      label.textContent = name;
      btn.appendChild(label);

      const badge = document.createElement('span');
      badge.className = 'delete-badge';
      badge.textContent = '\u00d7';
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        this.confirmDialog.show(
          `Delete "${name}"?`, 'Delete', '',
          () => this.animationManager.deleteAnimation(name)
        );
      });
      btn.appendChild(badge);

      btn.addEventListener('click', () => {
        this._stopCycleMode();
        this.animationManager.switchAnimation(name);
      });
      this.uiEl.appendChild(btn);
    });

    // Cycle button (2+ anims)
    if (names.length >= 2) {
      const cycleBtn = document.createElement('button');
      cycleBtn.className = 'anim-mode-btn';
      cycleBtn.id = 'anim-cycle-btn';
      cycleBtn.title = 'Cycle all animations';
      cycleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
      cycleBtn.addEventListener('click', () => this._toggleCycle());
      this.uiEl.appendChild(cycleBtn);
    }

    // Shuffle button (4+ anims)
    if (names.length >= 4) {
      const shuffleBtn = document.createElement('button');
      shuffleBtn.className = 'anim-mode-btn';
      shuffleBtn.id = 'anim-shuffle-btn';
      shuffleBtn.title = 'Shuffle animations';
      shuffleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>';
      shuffleBtn.addEventListener('click', () => this._toggleShuffle());
      this.uiEl.appendChild(shuffleBtn);
    }

    this.uiEl.style.display = 'flex';

    // Highlight current active
    const activeClip = this.animationManager.activeAction?.getClip();
    if (activeClip) this.highlightActive(activeClip.name);
  }

  highlightActive(name) {
    this.uiEl.querySelectorAll('button[data-anim]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.anim === name);
    });
  }

  // ── Cycle / Shuffle ──

  _toggleCycle() {
    if (this.cycleMode === 'cycle') {
      this._stopCycleMode();
    } else {
      this._startCycleMode('cycle');
    }
  }

  _toggleShuffle() {
    if (this.cycleMode === 'shuffle') {
      this._stopCycleMode();
    } else {
      this._startCycleMode('shuffle');
    }
  }

  _startCycleMode(mode) {
    this._stopCycleMode();
    this.cycleMode = mode;

    const am = this.animationManager;
    const names = Object.keys(am.actions);
    if (names.length < 2) return;

    // Set all actions to play once (LoopOnce) so we get 'finished' events
    for (const action of Object.values(am.actions)) {
      action.clampWhenFinished = true;
      action.setLoop(THREE_LOOP_ONCE);
    }

    // Listen for animation finish
    am.mixer?.addEventListener('finished', this._onFinishBound);

    // Restart current anim in LoopOnce mode
    const current = am.activeAction?.getClip().name || names[0];
    am.activeAction?.stop();
    am.actions[current]?.reset().setLoop(THREE_LOOP_ONCE).play();
    am.activeAction = am.actions[current];

    // Update button states
    this._updateModeButtons();
  }

  _stopCycleMode() {
    if (this.cycleMode === 'off') return;
    this.cycleMode = 'off';

    const am = this.animationManager;
    am.mixer?.removeEventListener('finished', this._onFinishBound);

    // Restore all actions to default looping
    for (const action of Object.values(am.actions)) {
      action.clampWhenFinished = false;
      action.setLoop(THREE_LOOP_REPEAT);
    }

    // Restart current so it loops normally
    if (am.activeAction) {
      const name = am.activeAction.getClip().name;
      am.activeAction.stop();
      am.actions[name]?.reset().setLoop(THREE_LOOP_REPEAT).play();
      am.activeAction = am.actions[name];
    }

    this._updateModeButtons();
  }

  _onAnimFinish() {
    const am = this.animationManager;
    const names = Object.keys(am.actions);
    if (names.length < 2) return;

    const currentName = am.activeAction?.getClip().name;
    let nextName;

    if (this.cycleMode === 'shuffle') {
      // Pick random, avoiding current
      const others = names.filter(n => n !== currentName);
      nextName = others[Math.floor(Math.random() * others.length)];
    } else {
      // Sequential cycle
      const idx = names.indexOf(currentName);
      nextName = names[(idx + 1) % names.length];
    }

    am.activeAction?.stop();
    const next = am.actions[nextName];
    next.reset().setLoop(THREE_LOOP_ONCE).play();
    am.activeAction = next;
    EventBus.emit('animation:switched', nextName);
  }

  _updateModeButtons() {
    const cycleBtn = document.getElementById('anim-cycle-btn');
    const shuffleBtn = document.getElementById('anim-shuffle-btn');
    cycleBtn?.classList.toggle('active', this.cycleMode === 'cycle');
    shuffleBtn?.classList.toggle('active', this.cycleMode === 'shuffle');
  }
}

// THREE.js loop constants (avoid importing all of THREE just for these)
const THREE_LOOP_ONCE = 2200;
const THREE_LOOP_REPEAT = 2201;
