import * as THREE from 'three';

/**
 * Geometry sanitization — fixes corrupt tangents, bad normals,
 * and degenerate triangles from Meshy.ai and other exporters.
 */
export function sanitizeGeometry(model) {
  let strippedTangents = 0;
  let recomputedNormals = 0;

  model.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const geo = child.geometry;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((m, i) => {
      console.log(`[sanitize] ${child.name} mat[${i}]: type=${m.type} side=${m.side} alphaMode=${m.alphaMode ?? m.transparent ? 'BLEND' : 'OPAQUE'} normalMap=${!!m.normalMap} map=${!!m.map}`);
    });

    const attrs = Object.keys(geo.attributes);
    console.log(`[sanitize] ${child.name} geo: ${geo.attributes.position.count} verts, attrs=[${attrs.join(',')}], skinned=${child.isSkinnedMesh}`);

    // 1. Strip tangents — let Three.js derive from normal maps
    if (geo.hasAttribute('tangent')) {
      geo.deleteAttribute('tangent');
      strippedTangents++;
    }

    // 2. Recompute normals if broken (NaN or zero-length)
    if (geo.hasAttribute('normal')) {
      const arr = geo.getAttribute('normal').array;
      let bad = 0;
      for (let i = 0; i < arr.length; i += 3) {
        const len = Math.sqrt(arr[i] * arr[i] + arr[i + 1] * arr[i + 1] + arr[i + 2] * arr[i + 2]);
        if (isNaN(len) || len < 0.001) bad++;
      }
      if (bad > 0) {
        geo.computeVertexNormals();
        recomputedNormals++;
        console.log(`[sanitize] ${child.name}: recomputed normals (${bad} bad of ${arr.length / 3})`);
      }
    } else {
      geo.computeVertexNormals();
      recomputedNormals++;
    }

    // 3. Flag materials for shader recompile
    mats.forEach(m => { m.needsUpdate = true; });
  });

  const report = [];
  if (strippedTangents > 0) report.push(`stripped ${strippedTangents} tangent attr`);
  if (recomputedNormals > 0) report.push(`recomputed ${recomputedNormals} normals`);
  if (report.length > 0) console.log(`[sanitize] ${report.join(', ')}`);
  return report;
}

/**
 * Model normalization — scale to target height, ground at Y=0.
 * Uses Box3.setFromObject which correctly handles SkinnedMesh.
 */
export function normalizeModel(model, targetSize) {
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return model;

  const size = box.getSize(new THREE.Vector3());
  const height = size.y || Math.max(size.x, size.y, size.z);
  const scale = targetSize / height;

  console.log(`[normalize] measured height=${height.toFixed(4)}, scale=${scale.toFixed(4)}`);

  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(model);
  model.position.y = -scaledBox.min.y;
  return model;
}

/**
 * Full Meshy Detox pipeline:
 *  1. Sanitize geometry (strip tangents, fix normals)
 *  2. Normalize scale + grounding
 *  3. Remove junk animation clips (<0.05s)
 *  4. Clean clip names (strip "Armature|" prefix)
 *  5. Fix materials (single-sided, alpha blend → alpha test)
 */
export function detoxModel(modelRef, allAnimations, actions, mixer, targetSize) {
  const report = [];

  // 1. Sanitize geometry
  const geoReport = sanitizeGeometry(modelRef);
  if (geoReport.length > 0) report.push(...geoReport);

  // 2. Re-normalize scale + grounding
  normalizeModel(modelRef, targetSize);
  report.push(`Normalized to ${targetSize}m`);

  // 3. Strip junk animation clips
  const junkThreshold = 0.05;
  const junkClips = allAnimations.filter(c => c.duration < junkThreshold);
  if (junkClips.length > 0) {
    junkClips.forEach(clip => {
      if (actions[clip.name]) {
        actions[clip.name].stop();
        mixer.uncacheAction(actions[clip.name].getClip());
        mixer.uncacheClip(actions[clip.name].getClip());
        delete actions[clip.name];
      }
      const idx = allAnimations.indexOf(clip);
      if (idx !== -1) allAnimations.splice(idx, 1);
    });
    report.push(`Removed ${junkClips.length} junk clip${junkClips.length > 1 ? 's' : ''} (<${junkThreshold}s)`);
  }

  // 4. Clean up clip names
  let renamed = 0;
  allAnimations.forEach(clip => {
    const clean = clip.name
      .replace(/^Armature\|/, '')
      .replace(/\|baselayer$/i, '')
      .trim();
    if (clean && clean !== clip.name) {
      if (actions[clip.name]) {
        actions[clean] = actions[clip.name];
        delete actions[clip.name];
      }
      clip.name = clean;
      renamed++;
    }
  });
  if (renamed > 0) {
    report.push(`Renamed ${renamed} clip${renamed > 1 ? 's' : ''}`);
  }

  // 5. Fix materials
  let matFixes = 0;
  let alphaFixes = 0;
  modelRef.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => {
        if (m.side === THREE.DoubleSide) {
          m.side = THREE.FrontSide;
          matFixes++;
        }
        if (m.transparent) {
          m.transparent = false;
          m.alphaTest = 0.5;
          m.depthWrite = true;
          m.needsUpdate = true;
          alphaFixes++;
        }
      });
    }
  });
  if (matFixes > 0) {
    report.push(`Fixed ${matFixes} double-sided material${matFixes > 1 ? 's' : ''}`);
  }
  if (alphaFixes > 0) {
    report.push(`Fixed ${alphaFixes} alpha blend → alpha test`);
  }

  return report;
}

/**
 * Fix materials only (single-sided + kill bad alpha blend)
 */
export function fixMaterials(modelRef) {
  let sideFixes = 0, alphaFixes = 0;
  modelRef.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => {
        if (m.side === THREE.DoubleSide) {
          m.side = THREE.FrontSide;
          sideFixes++;
        }
        if (m.transparent) {
          m.transparent = false;
          m.alphaTest = 0.5;
          m.depthWrite = true;
          alphaFixes++;
        }
        m.needsUpdate = true;
      });
    }
  });
  return { sideFixes, alphaFixes };
}

/**
 * Flip normal map Y channel (OpenGL ↔ DirectX)
 */
export function flipNormals(modelRef) {
  let flipped = 0;
  modelRef.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach(m => {
      if (!m.normalMap) return;
      const tex = m.normalMap;
      tex.repeat.y = tex.repeat.y > 0 ? -tex.repeat.y : Math.abs(tex.repeat.y);
      tex.offset.y = tex.repeat.y < 0 ? 1 : 0;
      tex.needsUpdate = true;
      m.needsUpdate = true;
      flipped++;
    });
  });
  return flipped;
}
