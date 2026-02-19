#!/usr/bin/env node
/**
 * Meshy GLB Detox Script
 *
 * Reads a Meshy split export (mesh GLB + animation GLB), merges ONLY the
 * animation data (no duplicate geometry), applies fixes, and writes a
 * single clean GLB.
 *
 * Usage:
 *   node tools/detox_glb.mjs <mesh.glb> <anims.glb> <output.glb>
 *   node tools/detox_glb.mjs <single.glb> <output.glb>
 */

import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';
import path from 'path';

// ── Config ────────────────────────────────────────────
const JUNK_CLIP_THRESHOLD = 0.05; // seconds

// ── Helpers ───────────────────────────────────────────
function cleanAnimName(name) {
    return name
        .replace(/^Armature\|/, '')
        .replace(/\|baselayer$/i, '')
        .trim();
}

function getAnimDuration(anim) {
    let maxTime = 0;
    for (const channel of anim.listChannels()) {
        const sampler = channel.getSampler();
        if (!sampler) continue;
        const input = sampler.getInput();
        if (!input) continue;
        const arr = input.getArray();
        if (arr && arr.length > 0) {
            maxTime = Math.max(maxTime, arr[arr.length - 1]);
        }
    }
    return maxTime;
}

/**
 * Build a name→node map for all nodes in a document.
 */
function buildNodeMap(doc) {
    const map = new Map();
    for (const node of doc.getRoot().listNodes()) {
        const name = node.getName();
        if (name) map.set(name, node);
    }
    return map;
}

/**
 * Copy animations from animDoc into meshDoc by:
 * 1. Copying each sampler's input/output accessors into meshDoc
 * 2. Creating new Animation + Channel + Sampler objects in meshDoc
 * 3. Remapping channel target nodes by matching node names
 */
function mergeAnimationsOnly(meshDoc, animDoc) {
    const meshNodeMap = buildNodeMap(meshDoc);
    const meshRoot = meshDoc.getRoot();
    const meshBuffer = meshRoot.listBuffers()[0];

    let merged = 0;
    let skippedChannels = 0;

    for (const srcAnim of animDoc.getRoot().listAnimations()) {
        const dstAnim = meshDoc.createAnimation(srcAnim.getName());

        for (const srcChannel of srcAnim.listChannels()) {
            const srcSampler = srcChannel.getSampler();
            const srcTargetNode = srcChannel.getTargetNode();
            const targetPath = srcChannel.getTargetPath();

            if (!srcSampler || !srcTargetNode) {
                skippedChannels++;
                continue;
            }

            // Find matching node in mesh doc by name
            const targetName = srcTargetNode.getName();
            const dstNode = meshNodeMap.get(targetName);
            if (!dstNode) {
                skippedChannels++;
                continue;
            }

            // Copy input accessor (timestamps)
            const srcInput = srcSampler.getInput();
            const dstInput = meshDoc.createAccessor()
                .setType(srcInput.getType())
                .setArray(srcInput.getArray().slice()) // copy data
                .setBuffer(meshBuffer);

            // Copy output accessor (keyframe values)
            const srcOutput = srcSampler.getOutput();
            const dstOutput = meshDoc.createAccessor()
                .setType(srcOutput.getType())
                .setArray(srcOutput.getArray().slice())
                .setBuffer(meshBuffer);

            // Create sampler
            const dstSampler = meshDoc.createAnimationSampler()
                .setInput(dstInput)
                .setOutput(dstOutput)
                .setInterpolation(srcSampler.getInterpolation());

            // Create channel
            const dstChannel = meshDoc.createAnimationChannel()
                .setSampler(dstSampler)
                .setTargetNode(dstNode)
                .setTargetPath(targetPath);

            dstAnim.addSampler(dstSampler);
            dstAnim.addChannel(dstChannel);
        }

        merged++;
    }

    return { merged, skippedChannels };
}

// ── Main ──────────────────────────────────────────────
async function main() {
    const args = process.argv.slice(2);

    let meshPath, animPath, outputPath;

    if (args.length === 3) {
        meshPath = args[0];
        animPath = args[1];
        outputPath = args[2];
    } else if (args.length === 2) {
        meshPath = args[0];
        animPath = null;
        outputPath = args[1];
    } else {
        console.error('Usage:');
        console.error('  node tools/detox_glb.mjs <mesh.glb> <anims.glb> <output.glb>');
        console.error('  node tools/detox_glb.mjs <single.glb> <output.glb>');
        process.exit(1);
    }

    if (!fs.existsSync(meshPath)) {
        console.error(`File not found: ${meshPath}`);
        process.exit(1);
    }
    if (animPath && !fs.existsSync(animPath)) {
        console.error(`File not found: ${animPath}`);
        process.exit(1);
    }

    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const report = [];

    // ── Load mesh document ─────────────────────────────
    console.log(`Loading mesh: ${path.basename(meshPath)}`);
    const doc = await io.read(meshPath);
    const root = doc.getRoot();

    // ── Merge animations from separate file ────────────
    if (animPath) {
        console.log(`Loading animations: ${path.basename(animPath)}`);
        const animDoc = await io.read(animPath);
        const animCount = animDoc.getRoot().listAnimations().length;

        if (animCount === 0) {
            console.warn('  No animations found in animation file');
        } else {
            const { merged, skippedChannels } = mergeAnimationsOnly(doc, animDoc);
            report.push(`Merged ${merged} animation(s) from ${path.basename(animPath)}`);
            if (skippedChannels > 0) {
                report.push(`  (${skippedChannels} channels skipped — no matching node)`);
            }
        }
    }

    // ── Detox: strip junk clips ────────────────────────
    const allAnims = root.listAnimations();
    console.log(`\nFound ${allAnims.length} animation(s):`);

    const removed = [];
    for (const anim of allAnims) {
        const dur = getAnimDuration(anim);
        const name = anim.getName();
        console.log(`  "${name}" — ${dur.toFixed(3)}s`);

        if (dur < JUNK_CLIP_THRESHOLD) {
            removed.push(name);
            anim.dispose();
        }
    }
    if (removed.length > 0) {
        report.push(`Removed ${removed.length} junk clip(s): ${removed.join(', ')}`);
    }

    // ── Detox: clean animation names ───────────────────
    let renamed = 0;
    for (const anim of root.listAnimations()) {
        const oldName = anim.getName();
        const newName = cleanAnimName(oldName);
        if (newName !== oldName && newName.length > 0) {
            anim.setName(newName);
            renamed++;
            console.log(`  Renamed: "${oldName}" → "${newName}"`);
        }
    }
    if (renamed > 0) {
        report.push(`Renamed ${renamed} clip(s)`);
    }

    // ── Detox: strip tangents ──────────────────────────
    // Meshy often exports garbage tangent data that causes spike/shard
    // artifacts during skeletal animation. Strip them and let the
    // runtime renderer derive tangents from the normal map.
    let tangentStrips = 0;
    for (const mesh of root.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const tangent = prim.getAttribute('TANGENT');
            if (tangent) {
                prim.setAttribute('TANGENT', null);
                tangentStrips++;
            }
        }
    }
    if (tangentStrips > 0) {
        report.push(`Stripped ${tangentStrips} tangent attribute(s)`);
    }

    // ── Detox: fix double-sided materials ──────────────
    let matFixes = 0;
    for (const mat of root.listMaterials()) {
        if (mat.getDoubleSided()) {
            mat.setDoubleSided(false);
            matFixes++;
        }
    }
    if (matFixes > 0) {
        report.push(`Fixed ${matFixes} double-sided material(s)`);
    }

    // NOTE: Scale normalization is left to the character viewer at runtime.
    // Meshy exports have complex node hierarchies (Armature at 0.01 with
    // bone positions in centimeter-space) that break if we naively replace
    // the root scale here. The viewer's normalizeModel() handles this
    // correctly by measuring world-space bounds.

    // ── Write output ───────────────────────────────────
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    await io.write(outputPath, doc);

    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // ── Summary ────────────────────────────────────────
    const finalAnims = root.listAnimations();
    const finalMeshes = root.listMeshes();
    let totalVerts = 0;
    for (const m of finalMeshes) {
        for (const p of m.listPrimitives()) {
            const pos = p.getAttribute('POSITION');
            if (pos) totalVerts += pos.getCount();
        }
    }

    console.log(`\n── Detox Report ──────────────────────`);
    report.forEach(r => console.log(`  ${r}`));
    console.log(`  Meshes: ${finalMeshes.length} (${totalVerts.toLocaleString()} verts)`);
    console.log(`  Materials: ${root.listMaterials().length}`);
    console.log(`  Scenes: ${root.listScenes().length}`);
    console.log(`  Animations: ${finalAnims.length}`);
    finalAnims.forEach(a => console.log(`    • ${a.getName()} (${getAnimDuration(a).toFixed(3)}s)`));
    console.log(`  Output: ${outputPath} (${sizeMB} MB)`);
    console.log(`──────────────────────────────────────\n`);
}

main().catch(err => {
    console.error('Detox failed:', err);
    process.exit(1);
});
