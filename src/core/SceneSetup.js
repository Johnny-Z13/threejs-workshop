import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { CONFIG, COLORS, LIGHTING } from '../config.js';
import { EventBus } from '../utils/EventBus.js';

/**
 * Scene, camera, renderer, ground, grid, and floor mode management
 */
export class SceneSetup {
  static FLOOR_MODES = ['studio', 'maya', 'none', 'white'];
  static BG_MODES = ['studio', 'black', 'hdri', 'white'];

  constructor() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.bgPrimary);
    this.scene.fog = new THREE.Fog(COLORS.fog, 8, 25);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.CAMERA_FOV,
      innerWidth / innerHeight,
      CONFIG.CAMERA_NEAR,
      CONFIG.CAMERA_FAR
    );
    this.camera.position.set(0, 1.0, 3);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, CONFIG.MAX_PIXEL_RATIO));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = CONFIG.TONE_MAPPING_EXPOSURE;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lights
    this.lights = this.createLights();

    // Floor elements
    this.ground = this.createGround();
    this.grid = this.createGrid();
    this.mayaGrid = this.createMayaGrid();
    this.whiteFloor = this.createWhiteFloor();

    // Floor mode state
    this.floorModeIndex = 0;
    this.applyFloorMode('studio');

    // Background mode state
    this.bgModeIndex = 0;
    this.hdriTexture = null;
    this.hdriLoading = false;

    // Events
    EventBus.on('floor:cycle', () => this.cycleFloorMode());
    EventBus.on('floor:set', (mode) => this.setFloorMode(mode));
    EventBus.on('toggle:grid', () => this.cycleFloorMode()); // remap old grid toggle
    EventBus.on('bg:cycle', () => this.cycleBgMode());
    EventBus.on('bg:set', (mode) => this.setBgMode(mode));
  }

  createLights() {
    const ambient = new THREE.AmbientLight(LIGHTING.ambient.color, LIGHTING.ambient.intensity);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(LIGHTING.key.color, LIGHTING.key.intensity);
    key.position.set(...LIGHTING.key.position);
    key.castShadow = true;
    key.shadow.mapSize.width = CONFIG.SHADOW_MAP_SIZE;
    key.shadow.mapSize.height = CONFIG.SHADOW_MAP_SIZE;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.001;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(LIGHTING.fill.color, LIGHTING.fill.intensity);
    fill.position.set(...LIGHTING.fill.position);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(LIGHTING.rim.color, LIGHTING.rim.intensity);
    rim.position.set(...LIGHTING.rim.position);
    this.scene.add(rim);

    // Hemisphere light (needed for Natural lighting preset)
    const hemi = new THREE.HemisphereLight(
      LIGHTING.hemi.skyColor,
      LIGHTING.hemi.groundColor,
      LIGHTING.hemi.intensity
    );
    this.scene.add(hemi);

    return { key, fill, rim, ambient, hemi };
  }

  createGround() {
    const geo = new THREE.CircleGeometry(6, 64);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.ground,
      roughness: 0.9,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  createGrid() {
    const grid = new THREE.GridHelper(
      CONFIG.GRID_SIZE,
      CONFIG.GRID_DIVISIONS,
      COLORS.gridMain,
      COLORS.gridSub
    );
    grid.position.y = 0.001;
    this.scene.add(grid);
    return grid;
  }

  createMayaGrid() {
    // Maya-style: lighter gray, finer subdivisions, no ground plane
    const grid = new THREE.GridHelper(20, 40, 0x555555, 0x3a3a3a);
    grid.position.y = 0.001;
    grid.visible = false;
    this.scene.add(grid);
    return grid;
  }

  createWhiteFloor() {
    const geo = new THREE.PlaneGeometry(30, 30);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.8,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.visible = false;
    this.scene.add(mesh);
    return mesh;
  }

  cycleFloorMode() {
    this.floorModeIndex = (this.floorModeIndex + 1) % SceneSetup.FLOOR_MODES.length;
    const mode = SceneSetup.FLOOR_MODES[this.floorModeIndex];
    this.applyFloorMode(mode);
    EventBus.emit('floor:changed', mode);
  }

  applyFloorMode(mode) {
    // Hide everything first
    this.ground.visible = false;
    this.grid.visible = false;
    this.mayaGrid.visible = false;
    this.whiteFloor.visible = false;

    switch (mode) {
      case 'studio':
        this.ground.visible = true;
        this.grid.visible = true;
        break;
      case 'maya':
        this.mayaGrid.visible = true;
        break;
      case 'none':
        // everything hidden
        break;
      case 'white':
        this.whiteFloor.visible = true;
        break;
    }
  }

  setFloorMode(mode) {
    const idx = SceneSetup.FLOOR_MODES.indexOf(mode);
    if (idx === -1) return;
    this.floorModeIndex = idx;
    this.applyFloorMode(mode);
    EventBus.emit('floor:changed', mode);
  }

  // ── Background mode ──

  cycleBgMode() {
    this.bgModeIndex = (this.bgModeIndex + 1) % SceneSetup.BG_MODES.length;
    const mode = SceneSetup.BG_MODES[this.bgModeIndex];
    this.applyBgMode(mode);
    EventBus.emit('bg:changed', mode);
  }

  setBgMode(mode) {
    const idx = SceneSetup.BG_MODES.indexOf(mode);
    if (idx === -1) return;
    this.bgModeIndex = idx;
    this.applyBgMode(mode);
    EventBus.emit('bg:changed', mode);
  }

  applyBgMode(mode) {
    switch (mode) {
      case 'studio':
        this.scene.background = new THREE.Color(COLORS.bgPrimary);
        this.scene.environment = null;
        this.scene.fog = new THREE.Fog(COLORS.fog, 8, 25);
        break;
      case 'black':
        this.scene.background = new THREE.Color(0x000000);
        this.scene.environment = null;
        this.scene.fog = null;
        break;
      case 'hdri':
        this.scene.fog = null;
        this.loadHDRI();
        break;
      case 'white':
        this.scene.background = new THREE.Color(0xffffff);
        this.scene.environment = null;
        this.scene.fog = null;
        break;
    }
  }

  loadHDRI() {
    // Already loaded — apply immediately
    if (this.hdriTexture) {
      this.scene.background = this.hdriTexture;
      this.scene.environment = this.hdriTexture;
      return;
    }
    // Already loading — wait for callback
    if (this.hdriLoading) return;

    this.hdriLoading = true;
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    new RGBELoader()
      .load('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_1k.hdr', (texture) => {
        this.hdriTexture = pmremGenerator.fromEquirectangular(texture).texture;
        texture.dispose();
        pmremGenerator.dispose();
        this.hdriLoading = false;

        // Only apply if still in HDRI mode
        if (SceneSetup.BG_MODES[this.bgModeIndex] === 'hdri') {
          this.scene.background = this.hdriTexture;
          this.scene.environment = this.hdriTexture;
        }
      });
  }

  appendTo(container) {
    container.appendChild(this.renderer.domElement);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
