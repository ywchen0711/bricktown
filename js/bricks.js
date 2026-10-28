// Building in bricks: every piece is a rounded block with studs on top, in stud units (8 mm: 0.3 world units across,
// a brick 0.36 high, a plate 0.12), gathered into instanced batches by shape so a whole town draws quickly.
//   const K = kit(scene); K.brick(x, y, z, w, d, 'brick'|'plate'|'tile', colour); K.round(...); K.slope(...); K.done()
import * as THREE from '../lib/three.module.min.js';
import { mergeGeometries } from '../lib/addons/BufferGeometryUtils.js';
import { rbox } from './minifig.js';

export const P = 0.3, BH = 0.36, PH = 0.12; // a stud's pitch, a brick's height, a plate's
const STUD_R = 0.09, STUD_H = 0.052;
const studGeo = (() => { const g = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 18); g.translate(0, STUD_H / 2, 0); return g; })();
function blockGeo(w, d, h, studs, round = false) {
  const parts = [];
  if (round) { const g = new THREE.CylinderGeometry(w * P / 2 - 0.006, w * P / 2 - 0.006, h - 0.004, 28); g.translate(0, h / 2, 0); parts.push(g); }
  else { const g = rbox(w * P - 0.008, h - 0.004, d * P - 0.008, 0.018); g.translate(0, h / 2, 0); parts.push(g); }
  if (studs) for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) { if (round && (w > 1) && Math.hypot(i - (w - 1) / 2, j - (d - 1) / 2) > w / 2 - 0.4) continue; const s = studGeo.clone(); s.translate((i - (w - 1) / 2) * P, h, (j - (d - 1) / 2) * P); parts.push(s); }
  const m = mergeGeometries(parts.map((g) => g.toNonIndexed ? g.toNonIndexed() : g), false); m.computeVertexNormals(); return m;
}
function slopeGeo(w, d, h) { // a slope brick: the back half a brick high, falling to the front
  const s = new THREE.Shape(); const D = d * P - 0.008, H = h - 0.004; s.moveTo(-D / 2, 0); s.lineTo(D / 2, 0); s.lineTo(D / 2, H * 0.18); s.lineTo(-D / 2 + Math.min(D * 0.35, 0.12), H); s.lineTo(-D / 2, H); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w * P - 0.008, bevelEnabled: false }); g.translate(0, 0, -(w * P - 0.008) / 2); g.rotateY(-Math.PI / 2); g.computeVertexNormals(); return g;
}

export function kit(scene, { shadows = true } = {}) {
  const batches = new Map(); // shape key -> { geo, items: [[matrix, colour]] , mat }
  const mats = { plastic: new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.25 }), trans: new THREE.MeshPhysicalMaterial({ roughness: 0.05, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1 }), glow: new THREE.MeshBasicMaterial({}) };
  const add = (key, make, x, y, z, rotY, color, mat = 'plastic') => {
    const k = key + '|' + mat; if (!batches.has(k)) batches.set(k, { geo: make(), items: [], mat });
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(1, 1, 1));
    batches.get(k).items.push([m, new THREE.Color(color)]);
  };
  const H = { brick: BH, plate: PH, tile: PH, tall: BH * 3 };
  const K = {
    // a rectangular piece, w studs along x and d along z (turned a quarter if rot), its bottom at y
    brick(x, y, z, w, d, kind = 'brick', color = '#c81e1e', rot = 0, mat) { const h = H[kind] || BH, studs = kind !== 'tile'; add(`b${w}x${d}x${h}${studs}`, () => blockGeo(w, d, h, studs), x, y, z, rot, color, mat); return y + h; },
    round(x, y, z, w, kind = 'brick', color = '#2a8a3a', mat) { const h = H[kind] || BH; add(`r${w}x${h}`, () => blockGeo(w, w, h, kind !== 'tile', true), x, y, z, 0, color, mat); return y + h; },
    slope(x, y, z, w, d, color = '#b02a2a', rot = 0) { add(`s${w}x${d}`, () => slopeGeo(w, d, BH), x, y, z, rot, color); return y + BH; },
    // a whole wall of bricks w studs long, n bricks high, running along x (staggered like real bricklaying)
    wall(x0, y0, z, w, n, color, holes = () => false) {
      for (let r = 0; r < n; r++) {
        let run = 0; const off = r % 2 ? 2 : 0;
        const flush = (end) => { if (run > 0) K.brick(x0 + (end - run / 2) * P, y0 + r * BH, z, run, 1, 'brick', color); run = 0; };
        for (let i = 0; i < w; i++) { if (holes(i, r)) { flush(i); continue; } if ((i + off) % 4 === 0) flush(i); run++; }
        flush(w);
      }
    },
    // a baseplate: a flat plate covered in studs, nx by nz studs, centred
    baseplate(x, z, nx, nz, color) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(nx * P, 0.04, nz * P), new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.3 })); g.position.set(x, -0.02, z); g.receiveShadow = true; scene.add(g);
      const n = nx * nz, im = new THREE.InstancedMesh(studGeo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.4 }), n); let k = 0;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) im.setMatrixAt(k++, new THREE.Matrix4().makeTranslation(x + (i - (nx - 1) / 2) * P, 0, z + (j - (nz - 1) / 2) * P));
      im.receiveShadow = true; scene.add(im); return im;
    },
    done() {
      const out = [];
      for (const b of batches.values()) {
        const mat = b.mat === 'trans' ? mats.trans : b.mat === 'glow' ? mats.glow : mats.plastic, im = new THREE.InstancedMesh(b.geo, mat, b.items.length);
        b.items.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); });
        im.castShadow = shadows && b.mat !== 'trans'; im.receiveShadow = true; scene.add(im); out.push(im);
      }
      return out;
    },
  };
  return K;
}
