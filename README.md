# Three.js Workshop

A personal Three.js workbench for viewing, fixing, and exporting GLB character models — with a focus on cleaning up **Meshy.ai** exports.

> **Remix credit:** This project is forked from [chongdashu/threejs-capacitor-ios-game](https://github.com/chongdashu/threejs-capacitor-ios-game) — the companion repo for the YouTube build ["How I Vibe Code 3D Games With AI"](https://www.youtube.com/watch?v=fu7NZ3t3sLM). Thanks to **chongdashu** for the original skills, prompts, and project structure that got this started.

---

## What this does

**Character Viewer** (`character_viewer.html`) — the main tool:

- Loads with a test model (Soldier.glb) on startup
- **Open** any GLB to view it normalized on a 1m grid
- **+ Anims** to merge a separate animation GLB (Meshy split export workflow)
- **Edit** mode to preview and delete individual animation clips
- **Fix Mats** — single-sided materials + kills broken alpha blend (fixes Z-fighting tears on skinned meshes)
- **Flip Normal Y** — toggles OpenGL/DirectX normal map format
- **Detox** — one-click Meshy cleanup: normalize scale to 1.8m, strip junk clips, clean `Armature|` name prefixes, fix materials + alpha
- **Export GLB** — downloads a clean combined GLB with surviving animations baked in
- Drag-and-drop support (1 file = model, 2 files = Meshy mesh + anims split)

**Node.js Detox Script** (`tools/detox_glb.mjs`) — offline batch processing:

```bash
# Meshy split export (mesh + animations)
node tools/detox_glb.mjs models/inbox/mesh.glb models/inbox/anims.glb models/output/Clean.glb

# Single file
node tools/detox_glb.mjs models/inbox/model.glb models/output/Clean.glb
```

Merges animations, strips junk clips, cleans names, fixes materials, strips corrupt tangents.

**GLB Inspector** (`tools/inspect_glb.mjs`) — dumps scene graph, meshes, materials, animations, skins:

```bash
node tools/inspect_glb.mjs models/some_model.glb
```

## Meshy.ai issues this fixes

| Problem | Cause | Fix |
|---|---|---|
| Model way too big/small | Armature at 0.01 scale, verts in arbitrary units | `Box3.setFromObject` for skinned mesh bounds, normalize to 1.8m |
| Triangles tearing during animation | `alphaMode: BLEND` on opaque characters (no depth write) | Switch to `alphaTest` with `depthWrite: true` |
| Double-sided rendering artifacts | `doubleSided: true` set on everything | Force `FrontSide` |
| Junk animation clips | `Armature\|clip0\|baselayer` pose artifacts (<0.05s) | Auto-remove short clips |
| Messy clip names | `Armature\|Walking\|baselayer` | Strip `Armature\|` prefix and `\|baselayer` suffix |
| Wrinkly/inside-out normal maps | DirectX vs OpenGL green channel | Flip Normal Y button |
| Split mesh + animation files | Meshy exports skeleton and anims separately | Merge via + Anims button or detox script |

## Scale convention

- **1 unit = 1 meter** (matches Blender and Unity)
- Grid: 1 square = 1 meter
- Human character target: 1.8m tall
- Normalized by height (Y axis) using skinned mesh bounds

## Project structure

```
character_viewer.html       # Main viewer/detox tool
tools/
  detox_glb.mjs             # Node.js batch detox script
  inspect_glb.mjs           # GLB scene graph inspector
models/
  Soldier.glb               # Test model (included)
  inbox/                    # Drop raw Meshy exports here (gitignored)
.claude/skills/             # AI agent skills (Three.js builder)
prompts/                    # AI prompts from the original project
public/assets/              # Animation metadata index
```

## Setup

```bash
npm install        # gltf-transform for Node.js tools
# Serve locally:
npx http-server -p 8080
# Open http://localhost:8080/character_viewer.html
```

## Original project resources

From the upstream repo — still included and useful:

- **Agent Skills** for Claude Code / Codex CLI — Three.js scene building, GLTF loading
- **AI Prompts** used in the original YouTube video for character/scene generation
- **Animation index** (`assets_index.json`) — metadata contract for GLB animation clips

## License

MIT
