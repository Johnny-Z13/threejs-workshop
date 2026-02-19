import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SceneSetup } from './core/SceneSetup.js';
import { Controls } from './core/Controls.js';
import { LightingController } from './core/Lighting.js';
import { ModelManager } from './model/ModelManager.js';
import { AnimationManager } from './model/AnimationManager.js';
import { parseGLB, loadGLBFromURL } from './model/ModelLoader.js';
import { Toast } from './ui/Toast.js';
import { ConfirmDialog } from './ui/ConfirmDialog.js';
import { AnimationBar } from './ui/AnimationBar.js';
import { Toolbar } from './ui/Toolbar.js';
import { CameraAnimator } from './camera/CameraAnimator.js';
import { CameraPanel } from './ui/CameraPanel.js';
import { LightingPanel } from './ui/LightingPanel.js';
import { PostProcessPipeline } from './postprocessing/PostProcessPipeline.js';
import { ShaderRegistry } from './shaders/ShaderRegistry.js';
import { RenderModeController } from './shaders/RenderModeController.js';
import { RenderPanel } from './ui/RenderPanel.js';
import { FolderNavigator } from './utils/FolderNavigator.js';
import { KeyboardShortcuts } from './utils/KeyboardShortcuts.js';
import { PresetManager } from './utils/PresetManager.js';
import { PresetsPanel } from './ui/PresetsPanel.js';
import { EventBus } from './utils/EventBus.js';

/**
 * Character Viewer — main application
 */
class App {
  constructor() {
    // Core
    this.sceneSetup = new SceneSetup();

    // Mount renderer into viewport container
    const viewport = document.getElementById('viewport');
    viewport.appendChild(this.sceneSetup.renderer.domElement);

    this.controls = new Controls(
      this.sceneSetup.camera,
      this.sceneSetup.renderer.domElement
    );

    this.lightingController = new LightingController(this.sceneSetup.lights);
    this.cameraAnimator = new CameraAnimator(this.sceneSetup.camera, this.controls);
    this.cameraPanel = new CameraPanel();
    this.lightingPanel = new LightingPanel(this.lightingController);

    // Post-processing
    this.postProcess = new PostProcessPipeline(
      this.sceneSetup.renderer,
      this.sceneSetup.scene,
      this.sceneSetup.camera
    );

    // Model + animation
    this.modelManager = new ModelManager(this.sceneSetup.scene);
    this.animationManager = new AnimationManager();

    // UI
    this.toast = new Toast(document.getElementById('toast'));
    this.confirmDialog = new ConfirmDialog();
    this.animationBar = new AnimationBar(
      document.getElementById('anim-bar'),
      this.animationManager,
      this.confirmDialog
    );
    this.toolbar = new Toolbar(this);
    this.folderNavigator = new FolderNavigator(this);
    this.renderPanel = new RenderPanel();

    // Initialize shader registry + render mode controller + Phase 6 features
    this.initShaders();

    // Keyboard shortcuts
    this.keyboardShortcuts = new KeyboardShortcuts();

    // Floor button
    document.getElementById('btnFloor')?.addEventListener('click', () => {
      EventBus.emit('floor:cycle');
    });

    // Background button
    document.getElementById('btnBgMode')?.addEventListener('click', () => {
      EventBus.emit('bg:cycle');
    });

    // Fullscreen toggle
    EventBus.on('fullscreen:toggle', () => this.toggleFullscreen());

    // Status mode display
    this._statusMaterial = 'Standard';
    this._statusEffectCount = 0;

    EventBus.on('shader:changed', (shaderId, shaderName) => {
      this._statusMaterial = shaderName || shaderId;
      this.updateStatusMode();
    });

    EventBus.on('material:changed', (shaderId, shaderName) => {
      this._statusMaterial = shaderName || shaderId;
      this.updateStatusMode();
    });

    EventBus.on('effects:changed', (effectIds) => {
      this._statusEffectCount = effectIds.length;
      this.updateStatusMode();
    });

    // FPS counter
    this.fpsFrames = 0;
    this.fpsTime = 0;

    // Events
    this.setupDragDrop();
    this.setupResize();
    this.setupAboutModal();
    this.startRenderLoop();

    // Initial size based on viewport
    this.handleResize();

    // Boot
    this.loadDefault();
  }

  async initShaders() {
    await ShaderRegistry.initialize();
    this.renderModeController = new RenderModeController(this.modelManager, this.postProcess);

    // Presets (depend on renderModeController being ready)
    this.presetManager = new PresetManager({
      renderModeController: this.renderModeController,
      renderPanel: this.renderPanel,
      lightingController: this.lightingController,
      cameraAnimator: this.cameraAnimator
    });
    this.presetsPanel = new PresetsPanel(this.presetManager);
  }

  // ── Load from file ──

  async loadFromFile(file) {
    this.clearAll();
    const name = file.name.replace(/\.glb$/i, '');
    try {
      const buffer = await file.arrayBuffer();
      const gltf = await parseGLB(buffer);
      this.setupModelAndAnims(gltf.scene, gltf.animations, name);
      this.toast.show(`Loaded ${name}`);
    } catch (err) {
      console.error('Failed to load GLB:', err);
      this.toast.show('Failed to load GLB');
    }
  }

  // ── Load default model ──

  async loadDefault() {
    try {
      const gltf = await loadGLBFromURL(CONFIG.DEFAULT_MODEL);
      this.setupModelAndAnims(gltf.scene, gltf.animations, 'Soldier');
    } catch (err) {
      console.error('Failed to load default model:', err);
    }
  }

  // ── Merge animations ──

  async mergeAnimsFromFile(file) {
    if (!this.modelManager.modelRef) {
      this.toast.show('Load a model first');
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const gltf = await parseGLB(buffer);
      const newClips = gltf.animations;
      if (newClips.length === 0) {
        this.toast.show('No animations found in that file');
        return;
      }
      this.animationManager.mergeAnimations(newClips);
      this.animationManager.setupAnimations(this.modelManager.modelRef, this.animationManager.allAnimations);
      this.updateInfo();
      this.toast.show(`Merged ${newClips.length} animation${newClips.length > 1 ? 's' : ''}`);
    } catch (err) {
      console.error('Failed to merge animations:', err);
      this.toast.show('Failed to load animation file');
    }
  }

  // ── Setup ──

  setupModelAndAnims(model, animations, name) {
    this.modelManager.setupModel(model, name);
    this.animationManager.setupAnimations(model, animations);
    this.postProcess.setModel(model);
    this.updateInfo();
  }

  clearAll() {
    this.animationManager.dispose();
    this.modelManager.clearModel();
    const animBar = document.getElementById('anim-bar');
    animBar.innerHTML = '';
    animBar.style.display = 'none';
    document.body.classList.remove('delete-mode');
    const btnEdit = document.getElementById('btn-edit');
    btnEdit.classList.remove('active');
    btnEdit.textContent = '\u2702 EDIT';
    this.updateInfo();
  }

  updateInfo() {
    const info = this.modelManager.getInfo();
    const fileNameEl = document.getElementById('fileName');
    const hudTris = document.getElementById('hudTris');
    const hudVerts = document.getElementById('hudVerts');
    const hudMeshes = document.getElementById('hudMeshes');
    const statusDims = document.getElementById('statusDims');

    if (!info) {
      fileNameEl.textContent = 'No file loaded';
      hudTris.textContent = '--';
      hudVerts.textContent = '--';
      hudMeshes.textContent = '--';
      statusDims.textContent = '--';
      return;
    }

    info.animCount = this.animationManager.allAnimations.length;
    fileNameEl.textContent = `${info.name}.glb`;
    hudMeshes.textContent = info.meshCount;
    hudVerts.textContent = info.vertCount.toLocaleString();
    // Estimate triangles (most meshes are indexed triangles)
    let triCount = 0;
    this.modelManager.modelRef.traverse((child) => {
      if (child.isMesh) {
        const geo = child.geometry;
        if (geo.index) {
          triCount += geo.index.count / 3;
        } else {
          triCount += geo.attributes.position.count / 3;
        }
      }
    });
    hudTris.textContent = Math.round(triCount).toLocaleString();
    statusDims.textContent = `${info.meshCount} meshes · ${info.vertCount.toLocaleString()} verts · ${info.animCount} anims`;
  }

  updateStatusMode() {
    const el = document.getElementById('statusMode');
    if (!el) return;
    let text = this._statusMaterial;
    if (this._statusEffectCount > 0) {
      text += ` + ${this._statusEffectCount} fx`;
    }
    el.textContent = text;
  }

  // ── Drag & drop with overlay ──

  setupDragDrop() {
    let dragCounter = 0;
    const dropOverlay = document.getElementById('dropOverlay');

    document.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      dropOverlay.classList.add('active');
    });

    document.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) dropOverlay.classList.remove('active');
    });

    document.addEventListener('dragover', (e) => e.preventDefault());

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      dropOverlay.classList.remove('active');

      const files = Array.from(e.dataTransfer.files).filter(f =>
        f.name.toLowerCase().endsWith('.glb')
      );
      if (files.length === 1) {
        this.loadFromFile(files[0]);
      } else if (files.length === 2) {
        this.loadFromFile(files[0]).then(() => this.mergeAnimsFromFile(files[1]));
      }
    });
  }

  // ── About Modal ──

  setupAboutModal() {
    const overlay = document.getElementById('aboutOverlay');
    const btnAbout = document.getElementById('btnAbout');
    const btnClose = document.getElementById('aboutClose');

    btnAbout?.addEventListener('click', () => overlay.classList.add('active'));
    btnClose?.addEventListener('click', () => overlay.classList.remove('active'));
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  }

  // ── Fullscreen ──

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      document.body.classList.add('fullscreen-mode');
    } else {
      document.exitFullscreen();
    }
    // Sync class on exit via Escape or browser chrome
    document.addEventListener('fullscreenchange', () => {
      document.body.classList.toggle('fullscreen-mode', !!document.fullscreenElement);
      this.handleResize();
    }, { once: true });
  }

  // ── Resize ──

  handleResize() {
    const viewport = document.getElementById('viewport');
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    this.sceneSetup.resize(w, h);
    this.postProcess.setSize(w, h);
  }

  setupResize() {
    addEventListener('resize', () => this.handleResize());
  }

  // ── Render loop ──

  startRenderLoop() {
    const { renderer, scene, camera } = this.sceneSetup;
    const fpsEl = document.getElementById('statusFps');

    renderer.setAnimationLoop((time) => {
      const delta = this.animationManager.update();
      this.cameraAnimator.update(delta);
      this.controls.update();

      // Post-processing renders via composer when active, otherwise standard render
      if (!this.postProcess.render(delta)) {
        renderer.render(scene, camera);
      }

      // FPS counter
      this.fpsFrames++;
      this.fpsTime += delta;
      if (this.fpsTime >= 0.5) {
        const fps = Math.round(this.fpsFrames / this.fpsTime);
        fpsEl.textContent = `${fps} fps`;
        this.fpsFrames = 0;
        this.fpsTime = 0;
      }
    });
  }
}

// ── Boot ──
const app = new App();
