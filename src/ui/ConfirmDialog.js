/**
 * Reusable confirm dialog
 */
export class ConfirmDialog {
  constructor() {
    this.overlay = document.getElementById('confirm-overlay');
    this.msgEl = document.getElementById('confirm-msg');
    this.btnConfirm = this.overlay.querySelector('.btn-confirm');
    this.btnCancel = this.overlay.querySelector('.btn-cancel');
    this.pendingAction = null;

    this.btnCancel.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
    this.btnConfirm.addEventListener('click', () => {
      if (this.pendingAction) this.pendingAction();
      this.hide();
    });
  }

  show(message, actionLabel, styleClass, onConfirm) {
    this.msgEl.textContent = message;
    this.btnConfirm.textContent = actionLabel;
    this.btnConfirm.className = 'btn-confirm' + (styleClass ? ` ${styleClass}` : '');
    this.pendingAction = onConfirm;
    this.overlay.classList.add('visible');
  }

  hide() {
    this.overlay.classList.remove('visible');
    this.pendingAction = null;
  }
}
