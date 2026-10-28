// The places, built in bricks. Each set has what the director needs (seats: where to sit, places: where props can
// go, x across the stage 0..1 of its 8 units) and build(scene, tod) that lays the bricks and lights it.
import * as THREE from '../lib/three.module.min.js';
import { kit, P, BH, PH } from './bricks.js';

const SKY = { day: ['#7ec8f4', '#cfeefc'], evening: ['#5a5ab0', '#ffb08a'], night: ['#0a1430', '#2a3266'] };
function skyTexture(tod) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), [a, b] = SKY[tod] || SKY.day, gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const W = 8; // the stage, as the director lays it out

function tree(K, x, z, h, s = 1) { // a trunk of round bricks, a crown of stacked round plates and bricks in greens
  let y = 0; while (y < h) y = K.round(x, y, z, 2, 'brick', '#7a4a2a');
  const greens = ['#3a9a3a', '#2e8a34', '#4cae44'];
  for (const [dy, w, dx, dz] of [[0, 8, 0, 0], [BH, 10, 0, 0], [2 * BH, 10, 0, 0], [3 * BH, 8, 0, 0], [4 * BH, 6, 0, 0], [5 * BH, 4, 0, 0], [0.4, 6, -0.9 * s, 0.4], [0.5, 6, 0.9 * s, -0.3], [1.2, 5, 0.5 * s, 0.6]])
    K.round(x + dx, y + dy - BH, z + dz, w, 'brick', greens[(w + dy * 10) % 3 | 0]);
}
function bush(K, x, z, k = 1) { K.round(x, 0, z, 4, 'brick', '#3a9a3a'); K.round(x + 0.3 * k, BH, z, 3, 'brick', '#4cae44'); K.round(x - 0.35, 0, z + 0.2, 3, 'brick', '#2e8a34'); }
function house(K, x, z, w, color, roofC, tod) { // brick walls with two windows and a door, a stepped gable roof
  const n = 8, lit = tod === 'night' || tod === 'evening', d0 = Math.floor(w / 2) - 1;
  const isWin = (i, r) => r >= 3 && r <= 5 && (i === 2 || i === 3 || i === w - 4 || i === w - 3), isDoor = (i, r) => r <= 4 && (i === d0 || i === d0 + 1);
  K.wall(x, 0, z, w, n, color, (i, r) => isWin(i, r) || isDoor(i, r));
  for (const i0 of [2, w - 4]) for (let r = 3; r <= 5; r++) K.brick(x + (i0 + 1) * P, r * BH, z, 2, 1, 'brick', lit ? '#ffe08a' : '#9fd4f0', 0, lit ? 'glow' : 'trans');
  for (const i0 of [2, w - 4]) { K.brick(x + (i0 + 1) * P, 2 * BH + BH - PH, z + 0.12, 2, 1, 'tile', '#ffffff'); K.brick(x + (i0 + 1) * P, 6 * BH, z + 0.1, 2, 1, 'plate', '#ffffff'); } // sills
  for (let r = 0; r < 5; r++) K.brick(x + (d0 + 1) * P, r * BH, z - 0.02, 2, 1, 'brick', '#6a3a22'); // the door
  K.brick(x + (d0 + 1) * P, 5 * BH, z + 0.1, 4, 2, 'plate', roofC); // a little porch roof
  let y = n * BH; for (let k = 0, ww = w + 2; ww > 0; k++, ww -= 2) { K.brick(x + w * P / 2, y, z, ww, 1, 'brick', roofC); y += BH; } // the gable, stepping in
}
export const SETS = {
  park: {
    name: { zh: '公園', en: 'The park' },
    seats: [{ x: 0.24, h: 0.48 }, { x: 0.33, h: 0.48 }],
    places: { tree: [0.665, 2.55, 0.5], ground: [0.6, 0.06] },
    build(scene, tod) {
      scene.background = skyTexture(tod);
      const K = kit(scene);
      K.baseplate(4, -0.4, 80, 42, '#4caf4a');
      for (let x = -6; x < 14; x += 6 * P) K.brick(x, 0, 0.2, 6, 3, 'tile', '#e4cf9c'); // the path they walk on
      for (let x = -6; x < 14; x += 6 * P) K.brick(x, 0, 1.6, 6, 6, 'plate', '#4caf4a');
      tree(K, W * 0.665, -1.1, 1.6, 1.2);
      // the bench: two legs, a seat, a back
      const bx = W * 0.285, bz = -0.55;
      for (const dx of [-0.6, 0.6]) { K.brick(bx + dx, 0, bz, 1, 2, 'brick', '#5a5a62'); }
      K.brick(bx, BH, bz, 6, 2, 'plate', '#b8642e'); K.brick(bx - 0.6, BH + PH, bz - 0.3, 1, 1, 'brick', '#5a5a62'); K.brick(bx + 0.6, BH + PH, bz - 0.3, 1, 1, 'brick', '#5a5a62');
      K.brick(bx, BH * 2 + PH, bz - 0.3, 8, 1, 'plate', '#b8642e'); K.brick(bx, BH * 2 + PH * 2, bz - 0.3, 8, 1, 'tile', '#b8642e');
      // flowers, bushes, lamp posts
      const R = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
      for (let i = 0; i < 34; i++) { const x = -3 + R() * 14, z = -1.0 - R() * 3; if (Math.abs(x - W * 0.665) < 1.3 && z > -2) continue; K.round(x, 0, z, 1, 'plate', ['#ff5a7a', '#ffd23a', '#ffffff', '#a070ff', '#ff8a2a'][i % 5]); }
      bush(K, W * 0.05, -1.4); bush(K, W * 0.93, -1.6, -1); bush(K, W * 1.2, -2.4); bush(K, -1.4, -2.6);
      for (const lx of [W * 0.12, W * 0.86]) { let y = 0; for (let k = 0; k < 7; k++) y = K.round(lx, y, -0.9, 1, 'brick', '#3a3a44'); K.round(lx, y, -0.9, 2, 'brick', tod === 'day' ? '#f4f0d8' : '#ffe08a', tod === 'day' ? 'plastic' : 'glow'); }
      // the houses across the road behind
      K.baseplate(4, -6.6, 72, 6, '#9a9aa2');
      const cols = [['#f2d28a', '#b8362a'], ['#e8a898', '#4a5a8a'], ['#cfe0f0', '#b8362a'], ['#f0e6c8', '#3a7a4a']];
      for (let i = 0; i < 5; i++) house(K, -5 + i * 4.4, -6.0 - (i % 2) * 0.5, 12, cols[i % 4][0], cols[i % 4][1], tod);
      K.done();
      // light: the sun (or the moon), the sky's fill, a warm bounce
      const sunC = { day: '#fff4dc', evening: '#ffb070', night: '#8aa0ff' }[tod], sunI = { day: 3.0, evening: 2.2, night: 0.6 }[tod];
      const hemi = new THREE.HemisphereLight(tod === 'night' ? '#4a5a9a' : '#cfe8ff', '#5a7a3a', tod === 'night' ? 0.5 : 1.2); scene.add(hemi);
      const sun = new THREE.DirectionalLight(sunC, sunI); sun.position.set(tod === 'evening' ? -6 : 5, tod === 'evening' ? 3 : 9, 6); sun.target.position.set(4, 0, -1); scene.add(sun, sun.target);
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 7, bottom: -5, near: 0.5, far: 30 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01; sun.shadow.radius = 3;
      if (tod !== 'day') for (const lx of [W * 0.12, W * 0.86]) { const l = new THREE.PointLight('#ffcf7a', tod === 'night' ? 3 : 1.4, 6, 2); l.position.set(lx, 2.7, -0.9); scene.add(l); }
      scene.fog = new THREE.Fog(SKY[tod][1], 14, 32);
    },
  },
};
