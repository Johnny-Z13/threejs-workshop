/**
 * Toast notification system
 */
export class Toast {
  constructor(el) {
    this.el = el;
    this.timer = null;
  }

  show(msg, durationMs = 2500) {
    this.el.textContent = msg;
    this.el.classList.add('visible');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.el.classList.remove('visible'), durationMs);
  }
}
