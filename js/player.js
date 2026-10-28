// The player: a series and an episode, laid out by the director, filmed in bricks: each place built once, the cast
// as minifigures, a camera that frames each shot (an establishing shot of the place, wide while people move, two-shots
// from alternating sides, singles over the listener's shoulder, close-ups), a shallow depth of field like a macro
// lens, subtitles, the voices and the score. Drag the picture to look round the scene yourself while it plays. ?s=neighbours&ep=ep1 (&t=12 to start at a moment, &fps=12 to animate
// on twos like stop-motion).
import * as THREE from '../lib/three.module.min.js';
import { EffectComposer } from '../lib/addons/EffectComposer.js';
import { RenderPass } from '../lib/addons/RenderPass.js';
import { BokehPass } from '../lib/addons/BokehPass.js';
import { OutputPass } from '../lib/addons/OutputPass.js';
import { parseScript } from './script.js';
import { direct, STAGE_W } from './direct.js';
import { poseAt, xAt, visible, facingAt } from './motion.js';
import { makeFig, plastic } from './minifig.js';
import { SETS } from './sets.js';
import { loadVoices, renderScore, makePlayer, audioCtx } from './audio.js';

const $ = (id) => document.getElementById(id), q = new URLSearchParams(location.search);
const SID = q.get('s') || 'neighbours', FPS = +(q.get('fps') || 0);
let lang = q.get('lang') === 'en' ? 'en' : 'zh';
const { SERIES } = await import(`../series/${SID}/series.js?v=1`);
const cast = SERIES.cast;

// ---------------------------------------------------------------- the renderer
const R = new THREE.WebGLRenderer({ canvas: $('cv'), antialias: true, preserveDrawingBuffer: true });
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0; R.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.05, 80);
let comp = null, bokeh = null;
const scenes = {}; // set|tod -> THREE.Scene, built once
function sceneFor(sc) { const k = sc.set + '|' + sc.tod; if (!scenes[k]) { const s = new THREE.Scene(); (SETS[sc.set] || SETS.park).build(s, sc.tod); scenes[k] = s; } return scenes[k]; }
function resize() { const r = $('frame').getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); R.setPixelRatio(d); R.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); if (comp) { comp.setPixelRatio(d); comp.setSize(r.width, r.height); } }
new ResizeObserver(resize).observe($('frame'));

let T = null, EP = null, player = null, playing = false, t0Wall = 0, tStart = 0, tNow = +(q.get('t') || 0);
const figs = {}, ghosts = {}, props = {};

// ---------------------------------------------------------------- the start screen
function startScreen() {
  $('st').textContent = SERIES.titleBricks?.[lang] || SERIES.title[lang]; $('blurb').textContent = SERIES.blurb[lang];
  $('eps').innerHTML = SERIES.episodes.map((e, i) => `<button data-ep="${e.id}">${lang === 'zh' ? `第${'一二三四五六七八九十'[i] || i + 1}集` : `Episode ${i + 1}`}<b>${e[lang]}</b></button>`).join('');
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-ep]'); if (b) loadEpisode(b.dataset.ep, true); });

async function loadEpisode(id, autoplay) {
  $('start').classList.add('loading'); $('loading').hidden = false;
  const text = await (await fetch(`series/${SID}/episodes/${id}.txt?v=${Date.now() % 1e5}`)).text();
  EP = parseScript(text);
  const vj = await fetch(`series/${SID}/audio/${id}.json?v=${Date.now() % 1e5}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const vmap = {}; for (const l of vj?.lines || []) vmap[l.i] = { dur: l.dur, env: l.env, file: l.file };
  T = direct(EP, cast, vmap); window.TL = T;
  // each actor a figure (and a stand-in, posed off-screen to find where its hand was at other moments); a row each, a little apart
  Object.values(T.actors).forEach((A, i) => { A.z = [0.0, 0.3, -0.25, 0.45][i % 4]; figs[A.id] = makeFig(A.spec); ghosts[A.id] = makeFig(A.spec); });
  for (const id of Object.keys(T.items)) props[id] = makeProp(id);
  for (const sc of T.scenes) sceneFor(sc);
  let voices = {}; try { voices = await loadVoices(T, `series/${SID}/audio/`); } catch (e) { voices = {}; }
  let score = null; try { score = await renderScore(T); } catch (e) { console.warn('no score', e); }
  player = makePlayer(T, voices, score);
  comp = new EffectComposer(R); comp.addPass(new RenderPass(scenes[T.scenes[0].set + '|' + T.scenes[0].tod], camera));
  bokeh = new BokehPass(scenes[T.scenes[0].set + '|' + T.scenes[0].tod], camera, { focus: 4, aperture: 0.004, maxblur: 0.008 }); comp.addPass(bokeh); comp.addPass(new OutputPass());
  resize();
  $('start').hidden = true; $('ui').hidden = false; $('loading').hidden = true; $('eptitle').textContent = EP.title[lang] || '';
  const hn = $('hint'); hn.hidden = false; hn.style.opacity = 1; setTimeout(() => { hn.style.opacity = 0; }, 6000);
  if (autoplay) play(tNow);
  window.DONE = true;
}

// ---------------------------------------------------------------- props, in bricks
function makeProp(id) {
  const g = new THREE.Group(), m = (geo, c) => { const o = new THREE.Mesh(geo, plastic(c)); o.castShadow = true; g.add(o); return o; };
  if (id === 'kite') { const sh = new THREE.Shape(); sh.moveTo(0, 0.36); sh.lineTo(0.24, 0); sh.lineTo(0, -0.3); sh.lineTo(-0.24, 0); sh.closePath(); const k = m(new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01 }), '#ff4a4a'); k.position.z = -0.02;
    const s2 = new THREE.Shape(); s2.moveTo(0, 0.36); s2.lineTo(0.24, 0); s2.lineTo(0, 0); s2.closePath(); m(new THREE.ExtrudeGeometry(s2, { depth: 0.05, bevelEnabled: false }), '#3a9aff').position.z = -0.025;
    for (let i = 0; i < 4; i++) { const b = m(new THREE.BoxGeometry(0.09, 0.05, 0.05), '#ffd23a'); b.position.set(0, -0.36 - i * 0.12, 0); b.userData.tail = i; } }
  else if (id === 'cane') { const c = m(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 12), '#8a5a34'); c.position.y = -0.4; const h = m(new THREE.TorusGeometry(0.07, 0.03, 8, 16, Math.PI), '#8a5a34'); h.position.set(-0.07, 0.075, 0); }
  else if (id === 'cookies') { for (let i = 0; i < 3; i++) { const c = m(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16), '#c88a4a'); c.position.y = i * 0.045; } }
  else m(new THREE.SphereGeometry(0.12, 16, 12), '#ff7a3a');
  return g;
}

// ---------------------------------------------------------------- where things are
const posed = new Map();
function poseOf(A, t) { const k = A.id + ':' + t.toFixed(3); if (!posed.has(k)) { if (posed.size > 300) posed.clear(); posed.set(k, poseAt(A, t, CTX)); } return posed.get(k); }
function handOf(id, t) { // the world position of the right hand at a moment (a stand-in is posed for it)
  const A = T.actors[id]; if (!A) return null; const G = ghosts[id], { p } = poseOf(A, t); G.pose(p); G.root.updateMatrixWorld(true);
  const v = G.hands[0].getWorldPosition(new THREE.Vector3()), sh = G.arms[0].getWorldPosition(new THREE.Vector3()); return { x: v.x, y: v.y, z: v.z, sh, f: facingAt(A, t).f };
}
function itemAt(I, t) {
  let cur = null;
  const target = (to, tt) => {
    if (to.who) { const h = handOf(to.who, tt); return h ? { x: h.x, y: h.y, z: h.z, held: to.who, hand: h } : null; }
    if (to.fly) { const h = handOf(to.fly, tt); if (!h) return null; return { x: h.x + h.f * 2.0 + Math.sin(tt * 0.9) * 0.25, y: 3.2 + Math.sin(tt * 1.3) * 0.18, z: -0.6, rot: Math.sin(tt * 1.1) * 0.25, string: h }; }
    if (to.at) return { x: to.at[0] ?? null, y: to.at[1], z: to.at[1] > 1 ? -0.55 : 0.2, rot: to.rot || 0 };
    return null;
  };
  for (let i = 0; i < I.keys.length; i++) {
    const k = I.keys[i]; if (k.t > t) break;
    const from = cur ? { ...cur } : null, end = target(k.to, t) || cur; if (end && end.x == null && from) end.x = from.x;
    if (from && k.dur && t < k.t + k.dur) { const st = evalBefore(I, k.t), u = (t - k.t) / k.dur, e = k.fall ? u * u : ease(u);
      cur = { x: st.x + (end.x - st.x) * e, y: st.y + (end.y - st.y) * e + Math.sin(Math.PI * u) * (k.fall ? 0.15 : k.arc || 0.3), z: (st.z ?? 0) + ((end.z ?? 0) - (st.z ?? 0)) * e, rot: (k.fall ? u * 4 : u * 1.2) + (end.rot || 0) * e, moving: true }; }
    else cur = end;
  }
  return cur;
}
const ease = (u) => u * u * (3 - 2 * u);
function evalBefore(I, tt) { return itemAt({ ...I, keys: I.keys.filter((k) => k.t < tt) }, tt) || { x: STAGE_W / 2, y: 1, z: 0, rot: 0 }; }
function roughItem(I, t) { let at = null; for (const k of I.keys) { if (k.t > t) break; const to = k.to; if (to.who) { const A = T.actors[to.who]; at = [xAt(A, t).x, 0.7, A.z || 0]; } else if (to.fly) { const A = T.actors[to.fly]; at = [xAt(A, t).x + 2 * facingAt(A, t).f, 3.2, -0.6]; } else if (to.at) at = [to.at[0] ?? at?.[0] ?? STAGE_W / 2, to.at[1], to.at[1] > 1 ? -0.55 : 0.2]; } return at; }
const CTX = {
  holding: (id, t) => { for (const I of Object.values(T.items)) { let h = null; for (const k of I.keys) { if (k.t > t) break; h = k.to.who || null; } if (h === id) return I.id; } return null; },
  where: (what, t) => { if (what == null) return null; const A = T.actors[what]; if (A) return [xAt(A, t).x, A.B.H * 0.85, A.z || 0]; if (T.items[what]) return roughItem(T.items[what], t); if (!isNaN(+what)) return [+what * STAGE_W, 1, 0]; return null; },
};

// ---------------------------------------------------------------- the camera
const sceneAt = (t) => { let s = T.scenes[0]; for (const x of T.scenes) if (t >= x.t0) s = x; return s; };
const shotAt = (t) => { let s = T.shots[0], n = 0; for (const x of T.shots) { if (t >= x.t0) { s = x; n++; } } return [s, n]; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function frameOf(s, n, t) {
  const A = (id) => T.actors[id], at = (a) => V(xAt(a, t).x, 0, a.z || 0), here = Object.values(T.actors).filter((a) => visible(a, t) && Math.abs(xAt(a, t).x - STAGE_W / 2) < STAGE_W);
  if (s.kind === 'est') return { pos: V(STAGE_W / 2 + 0.4, 3.2, 10.5), look: V(STAGE_W / 2, 1.0, -1.2), fov: 38 };
  if (s.kind === 'wide') { const xs = (s.ids.length ? s.ids.map(A) : here).filter((a) => a && visible(a, t)).map((a) => xAt(a, t).x); if (!xs.length) return frameOf({ kind: 'est' }, n, t); const c = (Math.min(...xs) + Math.max(...xs)) / 2, span = Math.max(...xs) - Math.min(...xs), d = Math.max(5.2, span * 1.15 + 3.6); return { pos: V(c + 0.3, 1.4 + d * 0.16, d), look: V(c, 0.75, 0), fov: 36 }; }
  const S = A(s.who) || A(s.ids[0]); if (!S) return frameOf({ kind: 'est' }, n, t);
  const L = A(s.ids.find((id) => id !== s.who) || null), sp = at(S), H = S.B.H, head = V(sp.x, H * 0.86 + poseOf(S, t).p.y, sp.z);
  const sp0 = poseOf(S, t).p, faceDir = Math.sign(Math.sin((sp0.yaw || 0) + (sp0.head || 0))) || facingAt(S, t).f; // where the face points
  const sideOf = s.kind === 'close' || !L ? faceDir : Math.sign(xAt(L, t).x - sp.x) || 1;
  if (s.kind === 'two' && L) { const lp = at(L), mid = sp.clone().add(lp).multiplyScalar(0.5), span = Math.abs(lp.x - sp.x), d = Math.max(3.0, span * 1.5 + 2.2), a = (n % 2 ? 0.32 : -0.32); return { pos: V(mid.x + Math.sin(a) * d, 1.05 + d * 0.06, Math.cos(a) * d + mid.z), look: V(mid.x, 0.9, mid.z), fov: 34 }; }
  if (s.kind === 'close') return { pos: V(sp.x + sideOf * 0.6, head.y + 0.08, sp.z + 1.9), look: head.clone().add(V(sideOf * 0.05, -0.1, 0)), fov: 30, focus: true };
  // a single: over the listener's shoulder, or three-quarter on if no one listens
  if (L) { const lp = at(L), lh = L.B.H * 0.82; return { pos: V(lp.x + sideOf * 0.6, lh + 0.12, lp.z + 1.6), look: head.clone().add(V(-sideOf * 0.1, -0.22, 0)), fov: 34 }; }
  return { pos: V(sp.x + sideOf * 1.1, head.y + 0.1, sp.z + 2.6), look: head.clone().add(V(0, -0.15, 0)), fov: 32 };
}
function camAt(t) {
  const [s, n] = shotAt(t), a = Math.max(s.t0, t - 0.7), k = 6, pos = V(0, 0, 0), look = V(0, 0, 0); let fov = 0;
  for (let i = 0; i < k; i++) { const tt = a + (t - a) * (i / (k - 1)), f = frameOf(s, n, tt); pos.add(f.pos); look.add(f.look); fov += f.fov; }
  pos.divideScalar(k); look.divideScalar(k); fov /= k;
  const push = Math.min(1, (t - s.t0) / 5) * 0.04; pos.lerp(look, push); // a slow push in through the shot
  return { pos, look, fov };
}

// ---------------------------------------------------------------- the viewer's own camera
// Drag to turn round the scene while it plays, wheel or pinch to come closer, double-click (or C) to give the camera
// back to the director. It circles the middle of whoever is on stage, and follows them as they move.
const free = { on: false, yaw: 0, pitch: 0.25, dist: 6, fov: 36, target: null, ptrs: new Map(), pinch: 0, last: 0 };
function middleOf(t) { const xs = Object.values(T.actors).filter((a) => visible(a, t)).map((a) => V(xAt(a, t).x, 0.85, a.z || 0)); if (!xs.length) return V(STAGE_W / 2, 1, 0); return xs.reduce((m, v) => m.add(v), V(0, 0, 0)).divideScalar(xs.length); }
function takeCam() { if (free.on) return; const off = camera.position.clone().sub(free.look || middleOf(tNow)); free.target = (free.look || middleOf(tNow)).clone(); free.dist = Math.max(1.5, off.length()); free.yaw = Math.atan2(off.x, off.z); free.pitch = Math.asin(Math.max(-0.99, Math.min(0.99, off.y / free.dist))); free.fov = camera.fov; free.on = true; $('cam').hidden = false; }
const ray = new THREE.Raycaster(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), hidden = [];
function unhide() { for (const [im, id, m] of hidden) { im.setMatrixAt(id, m); im.instanceMatrix.needsUpdate = true; } hidden.length = 0; }
const figOf = (o) => { for (; o; o = o.parent) if (o.userData.fig || Object.values(figs).some((F) => F.root === o) || Object.values(props).includes(o)) return true; return false; };
function giveBack() { unhide(); free.on = false; $('cam').hidden = true; }
function freeCam(c, t) {
  free.look = c.look;
  if (!free.on) return c;
  const now = performance.now(), dt = Math.min(0.1, (now - (free.last || now)) / 1000); free.last = now;
  free.target.lerp(middleOf(t), 1 - Math.exp(-dt * 2.5)); // follow the people, gently
  const cp = Math.cos(free.pitch), pos = free.target.clone().add(V(Math.sin(free.yaw) * cp, Math.sin(free.pitch), Math.cos(free.yaw) * cp).multiplyScalar(free.dist));
  pos.y = Math.max(0.15, pos.y); // never under the baseplate
  // bricks between the lens and the people are lifted out for the moment (a window cut through a tree or a wall);
  // anything else in the way, the camera comes in front of
  unhide(); const scene = sceneFor(sceneAt(t)), list = scene.children.filter((o) => !figOf(o));
  for (const [ox, oy] of [[0, 0], [0, 0.5], [0, -0.6], [0.35, 0], [-0.35, 0]]) {
    const aim = free.target.clone().add(V(ox * Math.cos(free.yaw), oy, -ox * Math.sin(free.yaw))), dir = pos.clone().sub(aim), len = dir.length(); dir.normalize(); ray.set(aim, dir); ray.far = len;
    for (const h of ray.intersectObjects(list, true)) {
      if (h.instanceId != null && h.object.isInstancedMesh) { const m = new THREE.Matrix4(); h.object.getMatrixAt(h.instanceId, m); hidden.push([h.object, h.instanceId, m]); h.object.setMatrixAt(h.instanceId, ZERO); h.object.instanceMatrix.needsUpdate = true; }
      else if (ox === 0 && oy === 0 && h.distance > 0.4) { pos.copy(aim).addScaledVector(dir, Math.max(1.0, h.distance - 0.25)); break; }
    }
  }
  return { pos, look: free.target.clone(), fov: free.fov };
}
{
  const el = $('frame'), ok = (e) => !e.target.closest('#ui, #start, button, input');
  el.addEventListener('pointerdown', (e) => { if (!T || !ok(e)) return; free.ptrs.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId); takeCam(); if (free.ptrs.size === 2) { const [a, b] = [...free.ptrs.values()]; free.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  el.addEventListener('pointermove', (e) => {
    const p = free.ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1]; free.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (free.ptrs.size === 1) { free.yaw -= dx * 0.008; free.pitch = Math.max(-0.05, Math.min(1.4, free.pitch + dy * 0.006)); }
    else if (free.ptrs.size === 2) { const [a, b] = [...free.ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (free.pinch) free.dist = Math.max(1.2, Math.min(24, free.dist * free.pinch / d)); free.pinch = d; }
  });
  const up = (e) => { free.ptrs.delete(e.pointerId); free.pinch = 0; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => { if (!T || !ok(e) || $('ui').hidden) return; e.preventDefault(); takeCam(); free.dist = Math.max(1.2, Math.min(24, free.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  el.addEventListener('dblclick', (e) => { if (ok(e)) giveBack(); });
}

// ---------------------------------------------------------------- one moment
function draw(t) {
  posed.clear();
  const ta = FPS ? Math.floor(t * FPS) / FPS : t, sc = sceneAt(t), scene = sceneFor(sc);
  // the cast: posed, printed, put in this place (or out of it)
  for (const A of Object.values(T.actors)) {
    const F = figs[A.id]; if (!visible(A, ta) || t < sc.t0) { if (F.root.parent) F.root.parent.remove(F.root); continue; }
    if (F.root.parent !== scene) scene.add(F.root);
    const { p, F: face } = poseOf(A, ta); F.pose(p); F.face(face);
  }
  // the props: in a hand, flying, in the tree, on the ground
  for (const [id, I] of Object.entries(T.items)) {
    const g = props[id], s = itemAt(I, ta); if (!s || s.x == null || t < sc.t0) { if (g.parent) g.parent.remove(g); continue; }
    if (g.parent !== scene) scene.add(g);
    g.position.set(s.x, s.y, s.z ?? 0); g.rotation.set(0, 0, 0);
    if (id === 'cane' && s.hand) { const dir = V(s.hand.x - s.hand.sh.x, s.hand.y - s.hand.sh.y, s.hand.z - s.hand.sh.z).normalize(), up = dir.y > 0.3; g.quaternion.setFromUnitVectors(V(0, -1, 0), up ? dir : V(0, -1, 0)); if (up) g.position.addScaledVector(dir, 0.75); }
    else if (id === 'kite') { g.rotation.set(0, s.held ? facingAt(T.actors[s.held], ta).f * 0.6 : 0, -(s.rot || 0)); if (s.held) g.position.y += 0.15; g.children.forEach((c) => { if (c.userData.tail != null) c.position.x = Math.sin(t * 6 + c.userData.tail) * 0.04 * (c.userData.tail + 1); }); }
    else g.rotation.z = -(s.rot || 0);
    // the kite's string
    let str = scene.getObjectByName('string-' + id);
    if (s.string) { if (!str) { str = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff' })); str.name = 'string-' + id; scene.add(str); } const a = V(s.string.x, s.string.y, s.string.z), b = V(s.x, s.y - 0.3, s.z), m = a.clone().lerp(b, 0.5).add(V(0, -0.4, 0)); str.geometry.setFromPoints(new THREE.QuadraticBezierCurve3(a, m, b).getPoints(24)); str.visible = true; } else if (str) str.visible = false;
  }
  // the camera, and the lens focused on whoever the shot is about
  const c = freeCam(camAt(t), t); camera.position.copy(c.pos); camera.lookAt(c.look); camera.fov = c.fov; camera.updateProjectionMatrix();
  comp.passes[0].scene = scene; bokeh.scene = scene; bokeh.uniforms.focus.value = c.pos.distanceTo(c.look);
  bokeh.uniforms.aperture.value = 0.0045 * Math.min(1.6, 3 / Math.max(1.2, c.pos.distanceTo(c.look)));
  comp.render();
  // fades, subtitles, the title
  const fade = Math.max(1 - (t - sc.t0) / 0.7, 1 - ((sc.t1 ?? T.len) - t) / 0.8, 0); $('fade').style.opacity = Math.min(1, fade);
  const L = T.lines.find((l) => t >= l.t0 - 0.05 && t <= l.t1 + 0.25), txt = L ? (lang === 'en' ? L.en || L.zh : L.zh) : '';
  if ($('sub').dataset.t !== txt) { $('sub').dataset.t = txt; $('sub').innerHTML = txt ? `<b style="color:${cast[L.who]?.colors?.top || '#ffe0a0'}">${cast[L.who]?.name?.[lang] || ''}</b>${txt}` : ''; }
  const ti = $('title'), show = t < 4.2 && EP; ti.style.opacity = show ? Math.min(1, (t - 0.3) * 2, (4.2 - t) * 2) : 0; if (show && ti.dataset.l !== lang) { ti.dataset.l = lang; ti.innerHTML = `<small>${SERIES.titleBricks?.[lang] || SERIES.title[lang]}</small>${EP.title[lang]}`; }
}

// ---------------------------------------------------------------- playing
function play(t = tNow) { audioCtx().resume(); tStart = t; t0Wall = player.start(t); playing = true; $('pp').textContent = '❚❚'; }
function pause() { if (player) player.stop(); playing = false; $('pp').textContent = '▶'; }
function seek(t) { tNow = Math.max(0, Math.min(T.len, t)); if (playing) play(tNow); }
$('pp').onclick = () => (playing ? pause() : play(tNow >= T.len - 0.1 ? 0 : tNow));
$('bar').oninput = (e) => seek(+e.target.value * T.len);
$('lang').onclick = () => { lang = lang === 'zh' ? 'en' : 'zh'; $('lang').textContent = lang === 'zh' ? 'EN' : '中'; if (EP) $('eptitle').textContent = EP.title[lang]; startScreen(); };
$('fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : $('frame').requestFullscreen());
$('home').onclick = () => { pause(); giveBack(); $('ui').hidden = true; $('start').hidden = false; $('start').classList.remove('loading'); };
document.addEventListener('keydown', (e) => { if (!T || $('ui').hidden) return; if (e.code === 'KeyC') (free.on ? giveBack() : takeCam()); if (e.code === 'Space') { e.preventDefault(); $('pp').click(); } if (e.code === 'ArrowRight') seek(tNow + 5); if (e.code === 'ArrowLeft') seek(tNow - 5); });
function loop() {
  if (T && comp) { if (playing) { tNow = tStart + (player.ctx.currentTime - t0Wall); if (tNow >= T.len) { tNow = T.len; pause(); } } draw(tNow); $('bar').value = tNow / T.len; $('time').textContent = `${fmt(tNow)} / ${fmt(T.len)}`; }
  requestAnimationFrame(loop);
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
startScreen(); requestAnimationFrame(loop);
window.APP = { frame: (t) => { tNow = t; draw(t); }, get T() { return T; }, free, takeCam, giveBack };
$('cam').onclick = giveBack;
if (q.get('ep')) loadEpisode(q.get('ep'), false); else window.DONE = true;
