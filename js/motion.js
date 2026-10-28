// How a minifigure moves: from the director's timeline (js/direct.js), its pose and its printed face at any moment.
// A minifig has few joints — legs at the hip, arms at the shoulder, hands at the wrist, the head turning — so the
// rest is the whole figure: it rocks and bobs as it waddles, leans into a bow, hops, tips back to laugh. Turning is a
// real turn; standing, it cheats a little toward the camera. Faces change print; mouths open with the voice.
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (k) => k * k * (3 - 2 * k);
const noise = (t, s) => Math.sin(t * 1.3 + s * 10) * 0.5 + Math.sin(t * 2.1 + s * 3.7) * 0.3 + Math.sin(t * 3.7 + s * 7.1) * 0.2;
const hashT = (t, s) => { const v = Math.sin(t * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const env = (t, t0, t1, inn = 0.2, out = 0.25) => (t < t0 || t > t1 ? 0 : Math.min(ss(t0, t0 + inn, t), 1 - ss(t1 - out, t1, t)));

export function xAt(A, t) {
  let x = null;
  for (const s of A.segs) {
    if (t < s.t0) { if (x == null) x = s.x0; break; }
    if (t <= s.t1) { const k = (t - s.t0) / (s.t1 - s.t0), d = s.t1 - s.t0, acc = Math.min(0.25, d / 3) / d;
      const u = k < acc ? (k * k) / (2 * acc * (1 - acc)) : k > 1 - acc ? 1 - ((1 - k) * (1 - k)) / (2 * acc * (1 - acc)) : (k - acc / 2) / (1 - acc);
      return { x: lerp(s.x0, s.x1, u), seg: s, dist: Math.abs(s.x1 - s.x0) * u };
    }
    x = s.x1;
  }
  return { x: x ?? 4, seg: null };
}
export const visible = (A, t) => { let v = false; for (const [tt, on] of A.vis) { if (tt <= t) v = on; else break; } return v; };
export function facingAt(A, t) { let f = 1, prev = 1, tk = -9; for (const [tt, ff] of A.faceKeys) { if (tt > t) break; prev = f; f = ff; tk = tt; } return { f, prev, k: cl((t - tk) / 0.35) }; }
function sitAt(A, t) { let v = 0, seat = 0.48; for (const s of A.sits) { if (t < s.t0) break; seat = s.seat; v = t >= s.t1 ? s.to : lerp(s.from, s.to, ease((t - s.t0) / (s.t1 - s.t0))); } return { v, seat }; }
function emoAt(A, t) { let best = null, w = 0; for (const e of A.emos) { const k = env(t, e.t0, e.t1, 0.3, 0.5) * (e.k ?? 1); if (k > w) { w = k; best = e.emo; } } return [best, w]; }
function voiceAt(T, t) {
  if (!T || t < T.t0 || t > T.t1) return 0;
  if (T.env) { const i = (t - T.t0) * 30, a = T.env[Math.floor(i)] || 0, b = T.env[Math.floor(i) + 1] || 0; return lerp(a, b, i % 1); }
  const s = (t - T.t0) * 7.5; return cl(0.55 + 0.45 * Math.sin(s * Math.PI * 2 + T.seed * 9)) * (1 - ss(T.t1 - 0.15, T.t1, t));
}
const lookTarget = (A, t) => { let v = null; for (const [tt, w] of A.looks) { if (tt > t) break; v = w; } return v; };

// ---------------------------------------------------------------- the pose
export function poseAt(A, t, ctx) {
  const sd = A.seed, P = xAt(A, t), kid = A.B.kind === 'kid';
  const p = { x: P.x, z: A.z || 0, y: 0, yaw: 0, tilt: 0, roll: 0, hipL: 0, hipR: 0, armL: -0.15, armR: -0.15, outL: 0, outR: 0, wristL: 0, wristR: 0, head: 0 };
  const F = { blink: 0, look: [0, 0], brow: 0, browIn: 0, eyes: 1, happy: 0, blush: 0, mouth: { open: 0, wide: 0.4, round: 0, smile: 0.45 } };
  // ---- which way: a real turn over a third of a second; standing it cheats toward the camera
  const seg = P.seg, run = seg?.mode === 'run', moveW = seg ? Math.min(ss(seg.t0, seg.t0 + 0.2, t), 1 - ss(seg.t1 - 0.2, seg.t1, t)) : 0;
  const fa = facingAt(A, t), side = lerp(1.05, 1.5, moveW), yaw = (f) => f * side;
  p.yaw = fa.k < 1 ? lerp(yaw(fa.prev), yaw(fa.f), ease(fa.k)) : yaw(fa.f);
  // ---- the waddle: legs swing from the hip, the arms the other way, the figure bobs and rocks
  const stride = kid ? 0.34 : 0.48, ph = seg ? P.dist / stride : 0, sw = Math.sin(ph * Math.PI * 2) * moveW;
  p.hipL = sw * (run ? 0.9 : 0.55); p.hipR = -sw * (run ? 0.9 : 0.55); p.armL = -0.15 - sw * (run ? 0.9 : 0.5); p.armR = -0.15 + sw * (run ? 0.9 : 0.5);
  p.y = moveW * (run ? 0.06 : 0.025) * Math.abs(Math.sin(ph * Math.PI * 2)); p.roll = moveW * 0.06 * Math.sin(ph * Math.PI * 2); p.tilt = moveW * (run ? 0.18 : 0.04);
  p.yaw += moveW * 0.06 * Math.sin(ph * Math.PI * 2);
  // ---- standing: never quite still
  const still = 1 - moveW; p.roll += still * 0.012 * noise(t * 0.5, sd); p.tilt += still * 0.01 * noise(t * 0.4, sd + 1); p.head += 0.08 * noise(t * 0.45, sd + 2) * still;
  p.armL += still * 0.04 * noise(t * 0.5, sd + 3); p.armR += still * 0.04 * noise(t * 0.5, sd + 4);
  // ---- sitting: legs straight out in front, on the seat
  const S = sitAt(A, t); if (S.v > 0) { p.hipL = lerp(p.hipL, -Math.PI / 2, S.v); p.hipR = lerp(p.hipR, -Math.PI / 2, S.v); p.y = lerp(p.y, S.seat - (kid ? 0.33 : 0.48), S.v); if (kid) { p.hipL += 0.12 * Math.sin(t * 3 + sd * 5) * S.v; p.hipR += 0.12 * Math.sin(t * 3 + 2 + sd * 5) * S.v; } p.z = lerp(p.z, -0.45, S.v); p.yaw = lerp(p.yaw, 0.35 * Math.sign(p.yaw || 1), S.v); }
  // ---- blinking
  { const per = 3.4, k = Math.floor((t + sd * 7) / per), ph2 = (t + sd * 7) - k * per, at = 0.4 + hashT(k, sd) * 2.4, d = Math.abs(ph2 - at); F.blink = d < 0.08 ? 1 : 0; }
  // ---- feelings
  const [emo, ew] = emoAt(A, t); if (emo) feel(p, F, emo, ew, t);
  // ---- gestures
  for (const a of A.acts) { if (t < a.t0 - 0.05) break; if (t > a.t1 + 0.05) continue; gesture(p, F, a, t, A, ctx); }
  // ---- holding: the near hand forward, carrying it
  const holds = ctx.holding?.(A.id, t);
  if (holds && !A.acts.some((a) => t >= a.t0 && t <= a.t1 && ['reach', 'give', 'point', 'wave', 'cheer'].includes(a.kind))) { p.armR = lerp(p.armR, holds === 'cane' ? -0.5 : -0.9, 0.8 * (1 - moveW * 0.5)); p.wristR = holds === 'cane' ? 0 : 0.6; }
  // ---- speaking: the mouth with the voice, a hand that talks, a small rock on the stresses
  const T = A.talk.find((s) => t >= s.t0 - 0.05 && t <= s.t1 + 0.05);
  if (T) {
    const v = voiceAt(T, t), v2 = voiceAt(T, t - 0.12), w = env(t, T.t0, T.t1, 0.15, 0.2), vow = Math.floor((t - T.t0) * 6 + T.seed * 10) % 5;
    F.mouth.open = cl(v * 1.05); F.mouth.round = [0, 0, 0.8, 0.1, 0.9][vow] * (v > 0.25 ? 1 : 0.3); F.mouth.wide = [0.6, 0.9, 0.1, 0.75, 0.2][vow];
    p.tilt += (v - v2) * 0.06; p.head += w * 0.08 * Math.sin((t - T.t0) * 1.7 + T.seed * 5);
    const kind = Math.floor(T.seed * 5), gw = env(t, T.t0 + 0.2, T.t1 + 0.3, 0.4, 0.45) * still * (S.v > 0.5 ? 0.6 : 1);
    if (gw > 0 && !holds) { const beat = v * 0.3;
      if (kind === 0 || kind === 3) { p.armR = lerp(p.armR, -1.1 - beat, gw); p.wristR = lerp(p.wristR, 0.8, gw); p.outR = lerp(p.outR, 0.15, gw); }
      else if (kind === 1) { p.armR = lerp(p.armR, -0.9 - beat, gw); p.armL = lerp(p.armL, -0.9 - beat * 0.7, gw); p.outL = lerp(p.outL, 0.2, gw); p.outR = lerp(p.outR, 0.2, gw); }
      else if (kind === 2) { p.armR = lerp(p.armR, -1.5, gw); p.outR = lerp(p.outR, -0.25, gw); } }
    if (T.q) F.brow += w * 0.4;
  }
  // ---- where it looks: the head turns toward whoever it watches (a minifig's eyes are printed)
  const lk = lookTarget(A, t); if (lk) { const tg = ctx.where?.(lk, t); if (tg) { const dx = tg[0] - p.x, dz = (tg[2] ?? 0) - p.z, want = Math.atan2(dx, dz); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.head += cl(d, -0.9, 0.9) * 0.6; F.look = [cl(d, -1, 1) * 0.6, cl((tg[1] - 1.2) / 1.5, -1, 1)]; } else if (lk === 'up') { F.look = [0, 1]; p.tilt -= 0.12; } }
  return { p, F };
}

function feel(p, F, e, w, t) {
  const L = (o, k, v) => { o[k] = lerp(o[k] ?? 0, v, w); }, M = F.mouth;
  switch (e) {
    case 'happy': case 'excited': case 'proud': L(M, 'smile', 1); L(F, 'brow', 0.3); L(F, 'blush', 0.3); L(p, 'outL', 0.12); L(p, 'outR', 0.12); if (e === 'excited') { p.y += w * 0.04 * Math.abs(Math.sin(t * 8)); L(F, 'eyes', 1.15); } if (e === 'proud') { p.tilt -= 0.08 * w; } break;
    case 'laugh': L(M, 'smile', 1); L(M, 'open', 0.7); L(F, 'happy', 1); p.tilt -= 0.14 * w; p.y += w * 0.015 * Math.abs(Math.sin(t * 20)); L(F, 'blush', 0.6); break;
    case 'sad': L(M, 'smile', -0.8); L(F, 'browIn', -1); p.tilt += 0.1 * w; L(p, 'armL', 0.05); L(p, 'armR', 0.05); F.look = [0, -0.6]; break;
    case 'worried': L(M, 'smile', -0.3); L(F, 'browIn', -0.9); break;
    case 'angry': case 'shout': L(M, 'smile', -0.7); L(F, 'browIn', 1.2); L(F, 'brow', -0.4); p.tilt += 0.08 * w; L(p, 'armL', -0.6); L(p, 'armR', -0.6); if (e === 'shout') L(M, 'wide', 1); break;
    case 'surprised': L(F, 'eyes', 1.35); L(F, 'brow', 1.2); L(M, 'round', 1); L(M, 'smile', 0); p.tilt -= 0.1 * w; L(p, 'armL', -1.0); L(p, 'armR', -1.0); L(p, 'outL', 0.45); L(p, 'outR', 0.45); break;
    case 'scared': L(F, 'eyes', 1.25); L(F, 'brow', 0.9); L(F, 'browIn', -1); L(M, 'smile', -0.5); p.tilt -= 0.1 * w; L(p, 'armL', -1.6); L(p, 'armR', -1.6); p.roll += w * 0.01 * Math.sin(t * 40); break;
    case 'shy': L(M, 'smile', 0.4); L(F, 'blush', 1); F.look = [0.4, -0.6]; L(p, 'armR', -2.8); L(p, 'wristR', 1.2); p.tilt += 0.05 * w; break;
    case 'thinking': L(F, 'brow', 0.5); F.look = [0.4, 0.8]; L(p, 'armR', -2.0); L(p, 'outR', -0.35); L(p, 'wristR', 1.2); L(M, 'smile', 0); break;
    case 'calm': L(M, 'smile', 0.5); break;
  }
}

function gesture(p, F, a, t, A, ctx) {
  const k = (t - a.t0) / (a.t1 - a.t0), w = env(t, a.t0, a.t1, a.kind === 'nod' ? 0.1 : 0.22, 0.28) * (a.k ?? 1), M = F.mouth, L = (o, key, v) => { o[key] = lerp(o[key] ?? 0, v, w); };
  switch (a.kind) {
    case 'wave': L(p, 'armR', -2.8); L(p, 'outR', 0.25); p.wristR = lerp(p.wristR, 0.6 * Math.sin((t - a.t0) * 12), w); p.outR += w * 0.15 * Math.sin((t - a.t0) * 12); L(M, 'smile', 1); break;
    case 'nod': p.tilt += w * 0.16 * Math.max(0, Math.sin(k * Math.PI * 4)); break;
    case 'tilt': p.roll += w * 0.08; p.head += w * 0.25; break;
    case 'shake': p.head += w * 0.6 * Math.sin((t - a.t0) * 15); L(M, 'smile', -0.2); break;
    case 'bow': p.tilt += w * 0.55; break;
    case 'cheer': L(p, 'armL', -3.0); L(p, 'armR', -3.0); L(p, 'outL', 0.3); L(p, 'outR', 0.3); p.y += w * 0.12 * Math.abs(Math.sin(k * Math.PI * 3)); L(M, 'open', 0.8); L(M, 'smile', 1); L(F, 'happy', 1); break;
    case 'laugh': L(M, 'open', 0.7); L(M, 'smile', 1); L(F, 'happy', 1); p.tilt -= w * 0.15; p.y += w * 0.02 * Math.abs(Math.sin(t * 22)); L(p, 'armL', -0.6); L(p, 'armR', -0.6); break;
    case 'think': L(p, 'armR', -2.0); L(p, 'outR', -0.35); L(p, 'wristR', 1.2); F.look = [0.4, 0.9]; break;
    case 'cry': L(p, 'armL', -2.3); L(p, 'armR', -2.3); L(p, 'outL', -0.4); L(p, 'outR', -0.4); L(M, 'smile', -0.9); L(M, 'open', 0.4 + 0.2 * Math.sin(t * 9)); p.tilt += w * 0.12; break;
    case 'reach': L(p, 'armR', -3.05); L(p, 'outR', 0.05); p.y += w * 0.04; p.tilt -= w * 0.08; break;
    case 'give': L(p, 'armR', -1.45); L(p, 'wristR', 0.5); p.tilt += w * 0.06; break;
    case 'shrug': L(p, 'armL', -0.9); L(p, 'armR', -0.9); L(p, 'outL', 0.5); L(p, 'outR', 0.5); L(F, 'brow', 0.7); p.y += w * 0.02; break;
    case 'point': { const tg = ctx.where?.(a.at, t); L(p, 'armR', tg ? -1.4 - cl((tg[1] - 1.0) / 2.5, -0.5, 1.2) : -1.5); L(p, 'wristR', 0.0); break; }
    case 'jump': { const tt = t - a.t0, up = 0.22, air = 0.5, h = 0.5;
      if (tt < up) { p.tilt += 0.1 * ss(0, up, tt); p.y -= 0.03 * ss(0, up, tt); }
      else if (tt < up + air) { const u = (tt - up) / air; p.y = 4 * h * u * (1 - u); p.hipL = -0.5 * Math.sin(Math.PI * u); p.hipR = 0.5 * Math.sin(Math.PI * u); p.armL = -2.8; p.armR = -2.8; M.open = 0.5; F.eyes = 1.2; }
      else { const u = (tt - up - air) / Math.max(0.05, a.t1 - a.t0 - up - air); p.tilt += 0.08 * (1 - u); }
      break; }
  }
}
