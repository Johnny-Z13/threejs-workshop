import { EventBus } from '../utils/EventBus.js';

/**
 * Animation clip buttons at bottom-center + delete mode
 */
export class AnimationBar {
  constructor(uiEl, animationManager, confirmDialog) {
    this.uiEl = uiEl;
    this.animationManager = animationManager;
    this.confirmDialog = confirmDialog;

    EventBus.on('animations:updated', () => this.rebuild());
    EventBus.on('animation:switched', (name) => this.highlightActive(name));
  }

  rebuild() {
    const { actions } = this.animationManager;
    this.uiEl.innerHTML = '';

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

      btn.addEventListener('click', () => this.animationManager.switchAnimation(name));
      this.uiEl.appendChild(btn);
    });

    this.uiEl.style.display = 'flex';

    // Highlight current active
    const activeClip = this.animationManager.activeAction?.getClip();
    if (activeClip) this.highlightActive(activeClip.name);
  }

  highlightActive(name) {
    this.uiEl.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.anim === name);
    });
  }
}
