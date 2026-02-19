import { EventBus } from '../utils/EventBus.js';
import { detoxModel, fixMaterials, flipNormals } from '../model/DetoxPipeline.js';
import { exportGLB } from '../model/Exporter.js';
import { parseGLB } from '../model/ModelLoader.js';
import { CONFIG } from '../config.js';

/**
 * Toolbar button wiring — Open, +Anims, Edit, Fix Mats, Flip Normals, Detox, Export
 */
export class Toolbar {
  constructor(app) {
    this.app = app;
    this.fileInput = document.getElementById('file-input');
    this.animFileInput = document.getElementById('anim-file-input');
    this.wireButtonEvents();
  }

  wireButtonEvents() {
    const { app } = this;
    const mm = app.modelManager;
    const am = app.animationManager;
    const toast = app.toast;
    const confirm = app.confirmDialog;

    // Set Folder
    document.getElementById('btn-set-folder')?.addEventListener('click', () => {
      app.folderNavigator?.pickFolder();
    });

    // Open
    document.getElementById('btn-open').addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files.length > 0) {
        app.loadFromFile(this.fileInput.files[0]);
        this.fileInput.value = '';
      }
    });

    // + Anims
    const btnAddAnims = document.getElementById('btn-add-anims');
    btnAddAnims.addEventListener('click', () => {
      if (!mm.modelRef) { toast.show('Load a model first'); return; }
      this.animFileInput.click();
    });
    this.animFileInput.addEventListener('change', () => {
      if (this.animFileInput.files.length > 0) {
        app.mergeAnimsFromFile(this.animFileInput.files[0]);
        this.animFileInput.value = '';
      }
    });

    // Edit (delete mode toggle)
    const btnEdit = document.getElementById('btn-edit');
    btnEdit.addEventListener('click', () => {
      document.body.classList.toggle('delete-mode');
      btnEdit.classList.toggle('active');
      btnEdit.textContent = document.body.classList.contains('delete-mode') ? '\u2702 DONE' : '\u2702 EDIT';
    });

    // Fix Materials
    document.getElementById('btn-fix-mats').addEventListener('click', () => {
      if (!mm.modelRef) { toast.show('Load a model first'); return; }
      const { sideFixes, alphaFixes } = fixMaterials(mm.modelRef);
      const msgs = [];
      if (sideFixes > 0) msgs.push(`${sideFixes} \u2192 single-sided`);
      if (alphaFixes > 0) msgs.push(`${alphaFixes} \u2192 alpha test`);
      toast.show(msgs.length > 0 ? `Fixed: ${msgs.join(', ')}` : 'Materials already clean');
    });

    // Flip Normal Y
    document.getElementById('btn-flip-normals').addEventListener('click', () => {
      if (!mm.modelRef) { toast.show('Load a model first'); return; }
      const flipped = flipNormals(mm.modelRef);
      toast.show(flipped > 0 ? `Flipped normal map Y on ${flipped} material${flipped > 1 ? 's' : ''}` : 'No normal maps found');
    });

    // Detox
    document.getElementById('btn-detox').addEventListener('click', () => {
      if (!mm.modelRef) { toast.show('Load a model first'); return; }
      confirm.show(
        'Run Meshy Detox?\nNormalize scale, remove junk clips, clean names, fix materials.',
        'Detox', 'detox',
        () => {
          const report = detoxModel(
            mm.modelRef, am.allAnimations, am.actions, am.mixer, CONFIG.MODEL_SIZE
          );
          // Rebuild animation UI
          const activeClipName = am.activeAction?.getClip().name;
          EventBus.emit('animations:updated', am.allAnimations, am.actions);
          if (!am.activeAction || !am.actions[activeClipName]) {
            const remaining = Object.keys(am.actions);
            if (remaining.length > 0) am.switchAnimation(remaining[0]);
          }
          app.updateInfo();
          toast.show(`Detox: ${report.join(' \u00b7 ')}`, 4000);
        }
      );
    });

    // Export
    const btnExport = document.getElementById('btn-export');
    btnExport.addEventListener('click', async () => {
      if (!mm.modelRef) return;
      btnExport.textContent = 'Exporting...';
      btnExport.style.pointerEvents = 'none';
      try {
        await exportGLB(mm.modelRef, am.allAnimations, mm.loadedFileName);
        toast.show('Exported!');
      } catch (err) {
        console.error('Export failed:', err);
        toast.show('Export failed \u2014 see console');
      }
      btnExport.textContent = 'Export GLB';
      btnExport.style.pointerEvents = '';
    });
  }
}
