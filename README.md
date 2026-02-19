# Three.js Workshop

A growing suite of [Three.js](https://threejs.org/) tools, viewers, and helpers — built to assist rapid, AI-powered development for creatives in the vibe coding community.

**By** johnny@z13labs.com | [@jvenmusic](https://x.com/jvenmusic)

> Forked from [chongdashu/threejs-capacitor-ios-game](https://github.com/chongdashu/threejs-capacitor-ios-game) — the companion repo for ["How I Vibe Code 3D Games With AI"](https://www.youtube.com/watch?v=fu7NZ3t3sLM). Thanks to **chongdashu** for the original project structure that got this started.

---

## Character Viewer

The first tool in the workshop. Part asset pipeline, part visual playground.

Load any GLB, clean up AI-generated junk (especially [Meshy.ai](https://www.meshy.ai/) exports), preview animations, then throw on post-process effects, dial in lighting, and save the whole look as a portable preset. It's how [ASCII ALIENS](https://x.com/jvenmusic) gets its look — the ASCII effect, camera moves, and lighting were all prototyped here before going into the game.

### Asset Pipeline

**Model Loading & Navigation**
- Open any GLB, or drag-and-drop (1 file = model, 2 files = Meshy mesh + anims split)
- Folder-style navigation to rapidly cycle through a model library
- Test model (Soldier.glb) loads on startup

**AI Asset Cleanup**
- **Fix Mats** — single-sided materials + kills broken alpha blend (fixes Z-fighting on skinned meshes)
- **Flip Normal Y** — toggles OpenGL/DirectX normal map format
- **Detox** — one-click Meshy cleanup: normalize scale to 1.8m, strip junk clips, clean `Armature|` prefixes, fix materials + alpha
- **Export GLB** — downloads a clean combined GLB with animations baked in

**Animation**
- **+ Anims** to merge a separate animation GLB (Meshy split export workflow)
- **Edit** mode to preview and delete individual clips

### Visualisation Tools

The right-side panels are where it gets creative. These are designed for artists and devs who want to see what their models look like under different rendering treatments — without writing shader code.

**Render Modes** (S key to open panel)
- 4 material modes that change how geometry is shaded:
  - **Cinematic** — enhanced PBR with environment mapping
  - **Matcap** — clay-like studio look, great for sculpt review
  - **Normals** — RGB normal visualisation for debugging
  - **Standard** — default Three.js PBR
- Materials are exclusive (radio buttons) — pick one at a time
- Keyboard: `1` Cinematic, `2` Matcap, `3` Normals. `,`/`.` to cycle

**Post-Process Effects** (stackable)
- 18 effects that layer on top of whatever material you're using:
  - **Stylised**: ASCII, Sketch, Cel Shading, Dithered, Pixelated, Game Boy, Halftone
  - **Atmosphere**: Bloom, Depth of Field, Film Grain, Vignette, Outline
  - **Glitch/Retro**: CRT, VHS, Glitch, Psychedelic, Vaporwave
  - **Technical**: Thermal, X-Ray
- Stack multiple effects — e.g. Bloom + Film Grain + CRT for a lo-fi broadcast look
- Each effect has its own parameter sliders (accordion UI when stacked)
- Performance budget system: effects have cost tiers (trivial/light/medium/heavy) and the UI blocks combinations that would tank your framerate
- Keyboard: `4`-`0` toggle effects on/off

**Lighting** (L key to open panel)
- Lighting presets: studio, 3-point, dramatic, rim, flat, and more
- Individual intensity sliders for key, fill, rim, ambient, and hemisphere lights
- Dial in exactly the mood you want, then save it as part of a preset

**Camera** (M key to open panel)
- Multiple camera modes: turntable, cinematic, drift, bounce
- Speed and FOV controls
- Fit-to-model framing (`F` key)
- Great for recording turntable videos or finding dramatic angles

**Presets**
- Save your entire visual setup: material + effect stack + lighting + camera
- One-click restore — flip between looks instantly
- **Export as JSON** — portable preset format you can take into any Three.js project
- **Import JSON** — paste a preset to restore a complete look
- Presets capture everything: which effects are active, all their parameter values, lighting intensities, camera mode and FOV

**Scene**
- Wireframe overlay toggle (`W`)
- 1m reference grid toggle (`G`)

### Meshy.ai Issues This Fixes

| Problem | Cause | Fix |
|---|---|---|
| Model way too big/small | Armature at 0.01 scale | Normalize to 1.8m using skinned mesh bounds |
| Triangles tearing during animation | `alphaMode: BLEND` on opaque characters | Switch to `alphaTest` with `depthWrite: true` |
| Double-sided rendering artifacts | `doubleSided: true` on everything | Force `FrontSide` |
| Junk animation clips | Pose artifacts (<0.05s) | Auto-remove short clips |
| Messy clip names | `Armature\|Walking\|baselayer` | Strip prefixes and suffixes |
| Inside-out normal maps | DirectX vs OpenGL green channel | Flip Normal Y button |
| Split mesh + animation files | Meshy exports separately | Merge via + Anims or detox script |

---

## CLI Tools

**Detox Script** (`tools/detox_glb.mjs`) — offline batch processing:

```bash
# Meshy split export (mesh + animations)
node tools/detox_glb.mjs models/inbox/mesh.glb models/inbox/anims.glb models/output/Clean.glb

# Single file
node tools/detox_glb.mjs models/inbox/model.glb models/output/Clean.glb
```

**GLB Inspector** (`tools/inspect_glb.mjs`) — dumps scene graph, meshes, materials, animations, skins:

```bash
node tools/inspect_glb.mjs models/some_model.glb
```

---

## Scale Convention

- **1 unit = 1 meter** (matches Blender and Unity)
- Grid: 1 square = 1 meter
- Human character target: 1.8m tall

---

## Setup

```bash
npm install        # gltf-transform for Node.js tools
npx http-server -p 8080
# Open http://localhost:8080
```

---

## Project Structure

```
index.html                  # Character viewer + visual tools
src/
  main.js                   # App entry point
  shaders/                  # Material + post-process shader system
    library/                # 22 shader definitions (4 material, 18 post-process)
    ShaderRegistry.js       # Central registry with cost budgeting
    RenderModeController.js # Material/effect orchestration
  postprocessing/           # EffectComposer pipeline + custom passes
  ui/                       # Panels: render, presets, lighting, camera
  utils/                    # EventBus, presets, keyboard shortcuts
styles/                     # CSS for all UI components
tools/
  detox_glb.mjs             # Node.js batch detox script
  inspect_glb.mjs           # GLB scene graph inspector
models/
  Soldier.glb               # Test model (included)
  inbox/                    # Drop raw exports here (gitignored)
```

---

## Credits

- [Three.js](https://threejs.org/) — the 3D engine powering everything
- [chongdashu](https://github.com/chongdashu) — original project and AI workflow inspiration
- Built with [Claude Code](https://claude.ai/claude-code)

## License

MIT
