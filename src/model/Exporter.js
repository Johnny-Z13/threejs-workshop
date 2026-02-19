import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

/**
 * GLB export logic
 */
export async function exportGLB(modelRef, animations, fileName) {
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(modelRef, {
    binary: true,
    trs: true,
    animations: animations,
  });
  const blob = new Blob([glb], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName || 'model'}_Clean.glb`;
  a.click();
  URL.revokeObjectURL(url);
}
