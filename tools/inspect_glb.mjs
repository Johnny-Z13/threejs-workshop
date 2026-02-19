#!/usr/bin/env node
/**
 * Quick GLB inspector — prints scenes, nodes, meshes, materials, animations, buffers
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import path from 'path';

const filePath = process.argv[2];
if (!filePath) { console.error('Usage: node tools/inspect_glb.mjs <file.glb>'); process.exit(1); }

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(filePath);
const root = doc.getRoot();

console.log(`\n── ${path.basename(filePath)} ──────────────────`);

// Scenes & nodes
const scenes = root.listScenes();
console.log(`\nScenes: ${scenes.length}`);
for (const scene of scenes) {
    console.log(`  Scene: "${scene.getName()}" — ${scene.listChildren().length} root children`);
    for (const child of scene.listChildren()) {
        printNode(child, '    ');
    }
}

function printNode(node, indent) {
    const t = node.getTranslation();
    const s = node.getScale();
    const mesh = node.getMesh();
    const skin = node.getSkin();
    const kids = node.listChildren();
    let desc = `Node "${node.getName()}"`;
    if (mesh) desc += ` [mesh: ${mesh.listPrimitives().length} prims]`;
    if (skin) desc += ` [skinned]`;
    desc += ` scale=[${s.map(v=>v.toFixed(3))}] pos=[${t.map(v=>v.toFixed(3))}]`;
    desc += ` children=${kids.length}`;
    console.log(`${indent}${desc}`);
    // Only recurse first 3 levels
    if (indent.length < 16) {
        for (const kid of kids) printNode(kid, indent + '  ');
    } else if (kids.length > 0) {
        console.log(`${indent}  ... (${kids.length} more children)`);
    }
}

// Meshes
const meshes = root.listMeshes();
let totalVerts = 0;
console.log(`\nMeshes: ${meshes.length}`);
for (const mesh of meshes) {
    const prims = mesh.listPrimitives();
    let verts = 0;
    for (const p of prims) {
        const pos = p.getAttribute('POSITION');
        if (pos) verts += pos.getCount();
    }
    totalVerts += verts;
    console.log(`  "${mesh.getName()}" — ${prims.length} primitives, ${verts.toLocaleString()} verts`);
}
console.log(`  Total: ${totalVerts.toLocaleString()} verts`);

// Materials
const mats = root.listMaterials();
console.log(`\nMaterials: ${mats.length}`);
for (const mat of mats) {
    console.log(`  "${mat.getName()}" doubleSided=${mat.getDoubleSided()} alpha=${mat.getAlphaMode()}`);
}

// Animations
const anims = root.listAnimations();
console.log(`\nAnimations: ${anims.length}`);
for (const anim of anims) {
    const channels = anim.listChannels();
    let maxT = 0;
    for (const ch of channels) {
        const sampler = ch.getSampler();
        if (!sampler) continue;
        const input = sampler.getInput();
        if (!input) continue;
        const arr = input.getArray();
        if (arr && arr.length > 0) maxT = Math.max(maxT, arr[arr.length - 1]);
    }
    console.log(`  "${anim.getName()}" — ${channels.length} channels, ${maxT.toFixed(3)}s`);
}

// Buffers
const buffers = root.listBuffers();
console.log(`\nBuffers: ${buffers.length}`);
for (const buf of buffers) {
    const uri = buf.getURI();
    console.log(`  "${buf.getName() || '(unnamed)'}" uri=${uri || '(embedded)'}`);
}

// Skins
const skins = root.listSkins();
console.log(`\nSkins: ${skins.length}`);
for (const skin of skins) {
    console.log(`  "${skin.getName()}" joints=${skin.listJoints().length}`);
}

console.log('');
