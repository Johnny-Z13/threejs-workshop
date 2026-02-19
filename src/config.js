/**
 * Global configuration and constants
 */

export const CONFIG = {
  // Model display
  MODEL_SIZE: 1.8,          // target height in meters
  DEFAULT_MODEL: './models/Soldier.glb',

  // Renderer settings
  TONE_MAPPING_EXPOSURE: 1.2,
  MAX_PIXEL_RATIO: 2,
  SHADOW_MAP_SIZE: 2048,

  // Camera settings
  CAMERA_FOV: 45,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 100,

  // ASCII shader settings
  ASCII_CHARS: ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  ASCII_CELL_W: 8,
  ASCII_CELL_H: 14,

  // Grid settings
  GRID_SIZE: 20,
  GRID_DIVISIONS: 20,

  // Animation settings
  FPS_UPDATE_INTERVAL: 500,
};

export const COLORS = {
  bgPrimary: 0x1a1a2e,
  bgSecondary: 0x222226,
  bgTertiary: 0x2a2a2f,
  accent: 0x4a9eff,
  ground: 0x222233,
  gridMain: 0x333355,
  gridSub: 0x252540,
  fog: 0x1a1a2e,
};

export const LIGHTING = {
  ambient: { color: 0x8899bb, intensity: 0.6 },
  key: { color: 0xffeedd, intensity: 2.0, position: [3, 6, 4] },
  fill: { color: 0x88bbff, intensity: 0.5, position: [-3, 2, -2] },
  rim: { color: 0xffffff, intensity: 0.3, position: [0, 3, -5] },
  hemi: { skyColor: 0x606070, groundColor: 0x202025, intensity: 0.5 },
};
