import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/* =====================================================================
   8 BALL POOL  ·  src/components/Pool.jsx   (v2, app-style UI)
   Modes: vs Computer, Online (host/guest), Pass & Play  (same props as Chess.jsx)
   Controls like the real app:
     - drag on the table to aim (drag near the cue stick for fine aim)
     - pull the power bar down and release to shoot
     - tap the cue ball at the top right to set spin
     - tap the green menu button for sound / guide line / hint
   options (Supabase games.options): { cloth: "blue" | "green", callEight: true, sound: true }
   ===================================================================== */

/* ---------- table geometry (logical units, felt is 1000 x 500) ---------- */
const L = 1000, W = 500, R = 17;
const RAIL = 62;
const TW = L + RAIL * 2, TH = W + RAIL * 2;
const RET = 62; // ball return channel on the right
const TWC = TW + RET;
const POCKETS = [
  { x: -6, y: -6, r: 40 }, { x: L / 2, y: -13, r: 38 }, { x: L + 6, y: -6, r: 40 },
  { x: -6, y: W + 6, r: 40 }, { x: L / 2, y: W + 13, r: 38 }, { x: L + 6, y: W + 6, r: 40 },
];
const HEAD = L * 0.25;

/* ---------- physics ---------- */
const DT = 1 / 240;
const VMAX = 2500;
const FRIC = 330;
const ROLL = 0.18;
const E_BALL = 0.96;
const E_WALL = 0.8;
const STOP = 6;
const MAXPULL = 240; // how far the stick can be pulled back (logical units)

/* ---------- look ---------- */
const GOLD = "linear-gradient(180deg,#fff3bf 0%,#f0cb62 30%,#b8862b 58%,#f6dc8c 80%,#c9972f 100%)";
const THEMES = {
  blue: {
    felt: ["#52c0e0", "#2b92b8", "#176684", "#0b3d56"], cush: ["#2a98c2", "#135b7b"], nose: "rgba(200,245,255,.6)",
    rail: ["#a53428", "#7b2018", "#4f1009"], grain: "255,170,140", trim: "rgba(226,234,240,.6)",
    chrome: ["#f7fafc", "#a9b5bf", "#e2e9ef"], dot: "#ffffff", panel: ["#1e3558", "#0c1525"], mark: "rgba(255,255,255,.06)",
  },
  green: {
    felt: ["#22a06a", "#127049", "#0b5035", "#06301f"], cush: ["#0f6a45", "#073e29"], nose: "rgba(190,255,220,.4)",
    rail: ["#5f3a1b", "#3c200d", "#24130a"], grain: "255,220,170", trim: "rgba(240,203,98,.8)",
    chrome: ["#fff3bf", "#b8862b", "#f0cb62"], dot: "#f6dc8c", panel: ["#1d2a1f", "#0a100b"], mark: "rgba(240,203,98,.07)",
  },
};
const BCOL = ["#f4f1ea", "#f5c518", "#1e5bd6", "#e03131", "#6f2dbd", "#f2711c", "#1f8a4c", "#7a1f2b", "#15151a"];
const colOf = (id) => (id === 0 ? BCOL[0] : id === 8 ? BCOL[8] : BCOL[id > 8 ? id - 8 : id]);
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const grpOf = (id) => (id === 0 ? null : id === 8 ? "eight" : id < 8 ? "solid" : "stripe");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GROUP_IDS = { solid: [1, 2, 3, 4, 5, 6, 7], stripe: [9, 10, 11, 12, 13, 14, 15] };

const AID = {
  easy: { err: 6, miss: 0.3, cand: 1, delay: 900 },
  medium: { err: 2, miss: 0.08, cand: 14, delay: 800 },
  hard: { err: 0.5, miss: 0, cand: 36, delay: 700 },
};

/* ---------- texts ---------- */
const PT = {
  en: {
    open: "Table open", solids: "Solids", stripes: "Stripes",
    yourBreak: "Break the rack!", theirBreak: "{name} breaks", assigned: "{name} is {group}!", rerack: "8-ball on the break.\nRe-racking!",
    scratch: "Scratch!\nBall in hand", noHit: "No ball hit.\nBall in hand", wrongBall: "Wrong ball first.\nBall in hand",
    noRail: "No rail after contact.\nBall in hand", early8: "8-ball sunk too early", wrongPocket: "8-ball in the wrong pocket", clear: "Cleared the table",
    wins: "{name} wins!", callEight: "Tap a pocket for the 8-ball first", callHint: "Tap the pocket for the 8-ball",
    placeHint: "Drag the cue ball to place it", placeBreak: "Place the cue ball behind the line",
    tipAim: "Drag to aim · pull the cue stick back to power up, release to shoot",
    spinTitle: "Cue ball spin", follow: "Follow", draw: "Draw", tapClose: "Tap anywhere to close",
    mSound: "Sound", mGuide: "Guide line", mHint: "Show hint", on: "ON", off: "OFF",
  },
  hi: {
    open: "टेबल खुली", solids: "ठोस", stripes: "धारीदार",
    yourBreak: "रैक तोड़ो!", theirBreak: "{name} ब्रेक करेगा", assigned: "{name} {group} है!", rerack: "ब्रेक पर 8-बॉल गई।\nदोबारा सजाते हैं!",
    scratch: "स्क्रैच!\nबॉल हैंड में", noHit: "कोई बॉल नहीं लगी।\nबॉल हैंड में", wrongBall: "पहले गलत बॉल लगी।\nबॉल हैंड में",
    noRail: "छूने के बाद किनारा नहीं लगा।\nबॉल हैंड में", early8: "8-बॉल जल्दी चली गई", wrongPocket: "8-बॉल गलत पॉकेट में गई", clear: "टेबल साफ़ कर दी",
    wins: "{name} जीता!", callEight: "पहले 8-बॉल के लिए पॉकेट छुएँ", callHint: "8-बॉल के लिए पॉकेट छुएँ",
    placeHint: "सफ़ेद बॉल को खींचकर रखें", placeBreak: "सफ़ेद बॉल को लाइन के पीछे रखें",
    tipAim: "निशाने के लिए खींचें · पावर के लिए स्टिक को पीछे खींचें, छोड़ते ही शॉट",
    spinTitle: "सफ़ेद बॉल का स्पिन", follow: "फ़ॉलो", draw: "ड्रॉ", tapClose: "बंद करने के लिए कहीं भी छुएँ",
    mSound: "आवाज़", mGuide: "गाइड लाइन", mHint: "संकेत दिखाएँ", on: "चालू", off: "बंद",
  },
};

export const HOW = {
  en: [
    "Drag on the table to aim (dragging far from the ball gives finer aim). Tap the cue ball at the top right to set spin.",
    "Grab the cue stick and pull it back: the further you pull, the harder the shot. Release to shoot, or push it back to the ball to cancel.",
    "After the break, the first ball you legally sink decides your group: Solids (1 to 7) or Stripes (9 to 15). Sink one and you shoot again.",
    "Hit your own group first. A scratch, a wrong first hit, or no ball reaching a rail is a foul: your rival gets ball in hand. Clear your group, tap a pocket and sink the 8-ball there to win.",
  ],
  hi: [
    "निशाने के लिए टेबल पर खींचें (बॉल से दूर खींचने पर निशाना बारीक होता है)। स्पिन के लिए ऊपर दाईं सफ़ेद बॉल छुएँ।",
    "स्टिक को पकड़कर पीछे खींचें: जितना पीछे, उतनी ज़्यादा ताकत। छोड़ते ही शॉट लगेगा। रद्द करने के लिए स्टिक को वापस बॉल तक ले जाएँ।",
    "ब्रेक के बाद जो पहली बॉल सही तरह डालेंगे उससे आपका ग्रुप तय होगा: ठोस (1 से 7) या धारीदार (9 से 15)। बॉल डाली तो फिर आपकी बारी।",
    "पहले अपने ग्रुप की बॉल छुएँ। स्क्रैच, गलत पहली बॉल या किनारा न लगना फाउल है: रिवाल को बॉल हैंड मिलती है। ग्रुप खत्म करें, पॉकेट छुएँ और 8-बॉल उसी में डालकर जीतें।",
  ],
};

/* =====================  helpers  ===================== */
const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qnorm = (q) => { const m = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / m, q[1] / m, q[2] / m, q[3] / m]; };
const qmat = (q) => {
  const [w, x, y, z] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
};
const startQ = () => { const a = Math.random() * 6.283; return qmul([Math.cos(a / 2), 0, 0, Math.sin(a / 2)], [0.70711, 0, -0.70711, 0]); };
function rollQ(b, dx, dy, d) {
  const h = d / R / 2, s = Math.sin(h);
  b.q = qnorm(qmul([Math.cos(h), (-dy / d) * s, (dx / d) * s, 0], b.q));
}
const shuffle = (a) => { const d = a.slice(); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; };
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(ax + dx * t - px, ay + dy * t - py);
};
const angDiff = (a, b) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const angLerp = (a, b, t) => a + angDiff(a, b) * t;
function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

/* =====================  balls and rack  ===================== */
const mkBall = (id, x, y) => ({ id, x, y, vx: 0, vy: 0, on: true, sink: null, q: startQ(), px: x, py: y, cv: null, dirty: true });
function rackBalls() {
  const bs = [mkBall(0, HEAD, W / 2)];
  const arr = shuffle([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
  arr.splice(4, 0, 8);
  if (grpOf(arr[10]) === grpOf(arr[14])) {
    const j = arr.findIndex((id, i) => i !== 4 && i !== 10 && i !== 14 && id !== 8 && grpOf(id) !== grpOf(arr[14]));
    if (j >= 0) { const t = arr[14]; arr[14] = arr[j]; arr[j] = t; }
  }
  let n = 0;
  for (let r = 0; r < 5; r++) for (let k = 0; k <= r; k++) bs.push(mkBall(arr[n++], 750 + r * (R * 1.7321 + 0.4), W / 2 + (k - r / 2) * (2 * R + 0.4)));
  return bs;
}
const newGame = () => ({
  balls: rackBalls(), turn: 1, groups: { 1: null, 2: null }, phase: "aim", aim: 0, aimShow: 0, raim: 0, rp: 0,
  power: 0, spin: { x: 0, y: 0 }, hand: true, brk: true, call: null, over: false, winner: 0, shots: 0,
  sim: null, pending: null, anim: null, pendingEnd: null, ai: null, fx: [], drag: null, lastPA: 0, tray: [], trayY: {}, lre: 0,
});
function freeSpot(bs, x, y) {
  const ok = (px, py) => px >= R && px <= L - R && py >= R && py <= W - R && bs.every((b) => b.id === 0 || !b.on || Math.hypot(b.x - px, b.y - py) > 2 * R + 1);
  if (ok(x, y)) return { x, y };
  for (let r = 10; r < 420; r += 10) for (let a = 0; a < 6.28; a += 0.4) { const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (ok(px, py)) return { x: px, y: py }; }
  return { x, y };
}
function legalTargets(g, me) {
  const grp = g.groups[me];
  const on = g.balls.filter((b) => b.on && b.id > 0);
  if (!grp) return on.filter((b) => b.id !== 8);
  const own = on.filter((b) => grpOf(b.id) === grp);
  return own.length ? own : on.filter((b) => b.id === 8);
}

/* =====================  sounds (made in the browser, no files)  ===================== */
function makeSfx() {
  const s = { ctx: null, on: true, last: 0 };
  s.unlock = () => {
    try {
      if (!s.ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) s.ctx = new A(); }
      if (s.ctx && s.ctx.state === "suspended") s.ctx.resume();
    } catch { /* ignore */ }
  };
  s.tone = (f0, f1, dur, vol, type) => {
    const a = s.ctx;
    if (!a || !s.on) return;
    try {
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
      o.type = type || "sine";
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  };
  s.click = (v) => { const n = performance.now(); if (n - s.last < 25) return; s.last = n; s.tone(1500 + Math.min(900, v / 2), 800, 0.05, Math.min(0.32, 0.04 + v / 3800), "triangle"); };
  s.thud = (v) => s.tone(190, 80, 0.1, Math.min(0.35, 0.05 + v / 3000), "sine");
  s.drop = () => { s.tone(320, 70, 0.28, 0.28, "sine"); setTimeout(() => s.tone(140, 60, 0.18, 0.18, "sine"), 160); };
  s.hit = (p) => s.tone(900, 350, 0.06, 0.12 + p * 0.25, "square");
  return s;
}

/* =====================  physics step  ===================== */
function simStep(g, sfx) {
  const bs = g.balls, sim = g.sim, ev = sim.ev, sp = sim.spin;
  sp.y *= 0.999; // spin fades the longer the cue ball travels
  for (const b of bs) {
    if (!b.on) continue;
    const s0 = Math.hypot(b.vx, b.vy);
    if (s0 === 0) continue;
    b.x += b.vx * DT; b.y += b.vy * DT;
    const s1 = Math.max(0, s0 - FRIC * DT) * (1 - ROLL * DT);
    if (s1 < STOP) { b.vx = 0; b.vy = 0; } else { const k = s1 / s0; b.vx *= k; b.vy *= k; }
  }
  for (const b of bs) {
    if (!b.on) continue;
    for (let i = 0; i < 6; i++) {
      const pk = POCKETS[i], dx = b.x - pk.x, dy = b.y - pk.y;
      if (dx * dx + dy * dy < pk.r * pk.r) {
        b.on = false; b.vx = 0; b.vy = 0;
        b.sink = { t: 0, x0: b.x, y0: b.y, px: pk.x, py: pk.y, done: false };
        if (b.id === 0) ev.cueSunk = true; else { ev.sunk.push(b.id); if (b.id === 8) ev.eightPk = i; }
        g.fx.push({ x: pk.x, y: pk.y, t: 0 });
        sfx.drop();
        break;
      }
    }
  }
  for (const b of bs) {
    if (!b.on) continue;
    const isCue = b.id === 0;
    let sv = 0;
    // faster balls lose more energy on the cushion, and the rail scrubs a little speed off sideways
    const rest = (v) => E_WALL * (1 - Math.min(0.22, v / 14000));
    if (b.x < R) { b.x = R; if (b.vx < 0) { sv = -b.vx; b.vx = sv * rest(sv); b.vy *= 0.985; if (isCue && sp.x) { b.vy += sp.x * sv * 0.22; sp.x *= 0.6; } } }
    else if (b.x > L - R) { b.x = L - R; if (b.vx > 0) { sv = b.vx; b.vx = -sv * rest(sv); b.vy *= 0.985; if (isCue && sp.x) { b.vy -= sp.x * sv * 0.22; sp.x *= 0.6; } } }
    if (b.y < R) { b.y = R; if (b.vy < 0) { const v = -b.vy; sv = Math.max(sv, v); b.vy = v * rest(v); b.vx *= 0.985; if (isCue && sp.x) { b.vx -= sp.x * v * 0.22; sp.x *= 0.6; } } }
    else if (b.y > W - R) { b.y = W - R; if (b.vy > 0) { const v = b.vy; sv = Math.max(sv, v); b.vy = -v * rest(v); b.vx *= 0.985; if (isCue && sp.x) { b.vx += sp.x * v * 0.22; sp.x *= 0.6; } } }
    if (sv > 20) { if (ev.contact) ev.rail = true; sfx.thud(sv); }
  }
  for (let i = 0; i < bs.length; i++) {
    const a = bs[i];
    if (!a.on) continue;
    for (let j = i + 1; j < bs.length; j++) {
      const b = bs[j];
      if (!b.on) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 >= 4 * R * R || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = 2 * R - d;
      a.x -= (nx * ov) / 2; a.y -= (ny * ov) / 2; b.x += (nx * ov) / 2; b.y += (ny * ov) / 2;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv >= 0) continue;
      const cue = i === 0 ? a : null;
      const pvx = cue ? cue.vx : 0, pvy = cue ? cue.vy : 0;
      const J = (-(1 + E_BALL) * rv) / 2;
      a.vx -= J * nx; a.vy -= J * ny; b.vx += J * nx; b.vy += J * ny;
      if (cue && !ev.contact) {
        ev.contact = true; ev.first = b.id;
        if (sp.y) { cue.vx += pvx * sp.y * 0.38; cue.vy += pvy * sp.y * 0.38; sp.y = 0; }
      }
      sfx.click(-rv);
    }
  }
}

/* =====================  rules  ===================== */
function judge(g, sim, needCall) {
  const ev = sim.ev, me = g.turn, opp = me === 1 ? 2 : 1, grp = g.groups[me], sunk = ev.sunk, brk = g.brk;
  const ownLeft = sim.before.ownLeft;
  const res = { foul: false, reason: null, rerack: false, over: false, winner: 0, next: me, hand: false, groups: { ...g.groups }, cont: false, sunk, assigned: null };
  let foul = false, reason = null;
  if (ev.cueSunk) { foul = true; reason = "scratch"; }
  else if (!ev.contact) { foul = true; reason = "noHit"; }
  else if (!brk) {
    const f = ev.first;
    const legal = grp == null ? f !== 8 : ownLeft > 0 ? grpOf(f) === grp : f === 8;
    if (!legal) { foul = true; reason = "wrongBall"; }
  }
  if (!foul && sunk.length === 0 && !ev.rail) { foul = true; reason = "noRail"; }
  if (sunk.includes(8)) {
    if (brk) { res.rerack = true; res.next = ev.cueSunk ? opp : me; res.hand = true; return res; }
    const legal8 = grp != null && ownLeft === 0 && !foul && (!needCall || sim.call === ev.eightPk);
    res.over = true; res.winner = legal8 ? me : opp;
    res.reason = legal8 ? "clear" : grp == null || ownLeft > 0 ? "early8" : foul ? reason : "wrongPocket";
    res.foul = !legal8;
    return res;
  }
  if (brk) res.cont = sunk.length > 0 && !foul;
  else {
    if (grp == null && !foul && sunk.length) {
      const gp = grpOf(sunk[0]);
      res.groups[me] = gp; res.groups[opp] = gp === "solid" ? "stripe" : "solid"; res.assigned = gp;
    }
    res.cont = !foul && sunk.some((id) => grpOf(id) === res.groups[me]);
  }
  if (foul) { res.foul = true; res.reason = reason; res.next = opp; res.hand = true; res.cont = false; }
  else res.next = res.cont ? me : opp;
  return res;
}

/* =====================  the computer player  ===================== */
function evalShots(bs, cx, cy, targets) {
  let best = null;
  for (const t of targets) {
    for (let i = 0; i < 6; i++) {
      const pk = POCKETS[i];
      const ax = pk.x <= 0 ? pk.x + 14 : pk.x >= L ? pk.x - 14 : pk.x;
      const ay = pk.y <= 0 ? pk.y + 14 : pk.y >= W ? pk.y - 14 : pk.y;
      let dx = ax - t.x, dy = ay - t.y;
      const d2 = Math.hypot(dx, dy);
      if (d2 < 1) continue;
      dx /= d2; dy /= d2;
      const gx = t.x - dx * 2 * R, gy = t.y - dy * 2 * R;
      if (gx < R || gx > L - R || gy < R || gy > W - R) continue;
      const vx = gx - cx, vy = gy - cy, d1 = Math.hypot(vx, vy);
      if (d1 < 2) continue;
      const cos = (vx * dx + vy * dy) / d1;
      if (cos < 0.25) continue;
      let blocked = false;
      for (const o of bs) {
        if (o.id === 0 || !o.on || o.id === t.id) continue;
        if (segDist(o.x, o.y, cx, cy, gx, gy) < 2 * R - 1 || segDist(o.x, o.y, t.x, t.y, ax, ay) < 2 * R - 2) { blocked = true; break; }
      }
      if (blocked) continue;
      const score = cos * 100 - d1 * 0.04 - d2 * 0.06;
      if (!best || score > best.score) {
        const vt = (Math.sqrt(2 * FRIC * d2) * 1.12) / Math.max(0.35, cos);
        const v1 = Math.sqrt(vt * vt + 2 * FRIC * d1);
        best = { score, gx, gy, tid: t.id, pk: i, p: clamp((v1 * 1.12 + 140) / VMAX, 0.2, 0.92) };
      }
    }
  }
  return best;
}
function aiPlan(g, prm, exact, fixed) {
  const bs = g.balls, me = g.turn, cue = bs[0];
  if (g.brk) {
    const hx = HEAD, hy = W / 2 + (Math.random() - 0.5) * 50;
    return { a: Math.atan2(W / 2 - hy, 750 - hx) + (Math.random() - 0.5) * 0.02, p: 0.9 + Math.random() * 0.06, hand: { x: hx, y: hy }, call: null };
  }
  const targets = legalTargets(g, me);
  if (!targets.length) return { a: g.aim || 0, p: 0.4, hand: null, call: null };
  let pos = { x: cue.x, y: cue.y }, hand = null;
  if (g.hand && !fixed) {
    let bp = null, bsx = -1e9;
    const n = Math.max(1, prm.cand);
    for (let i = 0; i < n; i++) {
      const x = R + Math.random() * (L - 2 * R), y = R + Math.random() * (W - 2 * R);
      if (!bs.every((b) => b.id === 0 || !b.on || Math.hypot(b.x - x, b.y - y) > 2 * R + 3)) continue;
      const e = evalShots(bs, x, y, targets);
      const sc = e ? e.score : -50;
      if (sc > bsx) { bsx = sc; bp = { x, y }; }
    }
    pos = bp || freeSpot(bs, HEAD, W / 2); hand = pos;
  }
  const best = evalShots(bs, pos.x, pos.y, targets);
  let a, p, call = null;
  if (best) { a = Math.atan2(best.gy - pos.y, best.gx - pos.x); p = best.p; if (best.tid === 8) call = best.pk; }
  else {
    let tg = targets[0];
    for (const t of targets) if (Math.hypot(t.x - pos.x, t.y - pos.y) < Math.hypot(tg.x - pos.x, tg.y - pos.y)) tg = t;
    a = Math.atan2(tg.y - pos.y, tg.x - pos.x); p = 0.5;
    if (tg.id === 8) { let bi = 0; POCKETS.forEach((pk, i) => { if (Math.hypot(pk.x - tg.x, pk.y - tg.y) < Math.hypot(POCKETS[bi].x - tg.x, POCKETS[bi].y - tg.y)) bi = i; }); call = bi; }
  }
  if (!exact) {
    const miss = Math.random() < (Number.isFinite(Number(prm.miss)) ? Number(prm.miss) : 0.08);
    const err = Number.isFinite(Number(prm.err)) ? Number(prm.err) : 2;
    a += (Math.random() - 0.5) * 2 * (miss ? 0.35 : (err * Math.PI) / 180);
    p = clamp(p * (1 + (Math.random() - 0.5) * 0.12), 0.18, 1);
  }
  if (!Number.isFinite(a)) a = 0;
  if (!Number.isFinite(p)) p = 0.5;
  return { a, p, hand, call };
}

/* =====================  drawing: 3D rolling balls  ===================== */
function paintBall(b, px) {
  const size = Math.ceil(px * 2) + 2;
  if (!b.cv || b.cv.width !== size) {
    b.cv = document.createElement("canvas"); b.cv.width = size; b.cv.height = size;
    b.cx = b.cv.getContext("2d"); b.img = b.cx.createImageData(size, size);
  }
  const M = qmat(b.q), d = b.img.data, c = size / 2;
  const cue = b.id === 0, stripe = b.id > 8;
  const col = cue ? [246, 244, 238] : rgb(colOf(b.id));
  const lm = Math.hypot(-0.45, -0.55, 0.7), Lx = -0.45 / lm, Ly = -0.55 / lm, Lz = 0.7 / lm;
  const hx = Lx, hy = Ly, hz = Lz + 1, hm = Math.hypot(hx, hy, hz), Hx = hx / hm, Hy = hy / hm, Hz = hz / hm;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = (x + 0.5 - c) / px, ny = (y + 0.5 - c) / px, r2 = nx * nx + ny * ny;
      if (r2 > 1.1) { d[i + 3] = 0; continue; }
      const alpha = clamp((1 - Math.sqrt(r2)) * px + 0.5, 0, 1);
      const nz = Math.sqrt(Math.max(0, 1 - r2));
      const bx = M[0] * nx + M[3] * ny + M[6] * nz, bz = M[2] * nx + M[5] * ny + M[8] * nz;
      let cr = col[0], cg = col[1], cb = col[2];
      if (cue) { if (Math.abs(bx) > 0.975) { cr = 150; cg = 40; cb = 40; } }
      else {
        if (stripe && Math.abs(bz) > 0.5) { cr = 246; cg = 243; cb = 234; }
        if (Math.abs(bx) > 0.9) { cr = 250; cg = 248; cb = 240; }
      }
      const diff = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
      const kk = (0.36 + 0.74 * diff) * (0.78 + 0.22 * nz);
      const spec = Math.pow(Math.max(0, nx * Hx + ny * Hy + nz * Hz), 52) * 0.95;
      d[i] = Math.min(255, cr * kk + spec * 255); d[i + 1] = Math.min(255, cg * kk + spec * 255); d[i + 2] = Math.min(255, cb * kk + spec * 255);
      d[i + 3] = alpha * 255;
    }
  }
  b.cx.putImageData(b.img, 0, 0);
  b.dirty = false;
}

/* =====================  drawing: the table (cached)  ===================== */
function buildTable(k, th) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(TWC * k); cv.height = Math.round(TH * k);
  const c = cv.getContext("2d");
  c.scale(k, k);
  const rnd = Math.random, cu = 26;
  // wooden rail
  rr(c, 0, 0, TW, TH, 38);
  const wg = c.createLinearGradient(0, 0, 0, TH); wg.addColorStop(0, th.rail[0]); wg.addColorStop(0.5, th.rail[1]); wg.addColorStop(1, th.rail[2]);
  c.fillStyle = wg; c.fill();
  c.save(); rr(c, 0, 0, TW, TH, 38); c.clip();
  for (let i = 0; i < 170; i++) {
    const y = rnd() * TH;
    c.strokeStyle = `rgba(${rnd() > 0.5 ? th.grain : "0,0,0"},${0.03 + rnd() * 0.05})`; c.lineWidth = 0.6 + rnd() * 1.6;
    c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(TW * 0.3, y + (rnd() - 0.5) * 10, TW * 0.6, y + (rnd() - 0.5) * 10, TW, y + (rnd() - 0.5) * 8); c.stroke();
  }
  const sh = c.createLinearGradient(0, 0, 0, TH); sh.addColorStop(0, "rgba(255,255,255,.14)"); sh.addColorStop(0.3, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,.25)");
  c.fillStyle = sh; c.fillRect(0, 0, TW, TH);
  c.restore();
  rr(c, 8, 8, TW - 16, TH - 16, 32); c.strokeStyle = th.trim; c.lineWidth = 1.6; c.stroke();
  rr(c, 14, 14, TW - 28, TH - 28, 27); c.strokeStyle = "rgba(0,0,0,.5)"; c.lineWidth = 3; c.stroke();
  // base under the cushions
  rr(c, RAIL - cu, RAIL - cu, L + cu * 2, W + cu * 2, 8); c.fillStyle = th.cush[1]; c.fill();
  // felt
  c.save(); c.translate(RAIL, RAIL); c.beginPath(); c.rect(0, 0, L, W); c.clip();
  const fg = c.createRadialGradient(L / 2, W / 2, 20, L / 2, W / 2, L * 0.62);
  fg.addColorStop(0, th.felt[0]); fg.addColorStop(0.35, th.felt[1]); fg.addColorStop(0.75, th.felt[2]); fg.addColorStop(1, th.felt[3]);
  c.fillStyle = fg; c.fillRect(0, 0, L, W);
  for (let i = 0; i < 3600; i++) { c.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${rnd() * 0.04})` : `rgba(0,0,0,${rnd() * 0.05})`; c.fillRect(rnd() * L, rnd() * W, 1.5, 1.5); }
  c.strokeStyle = "rgba(255,255,255,.26)"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(HEAD, 0); c.lineTo(HEAD, W); c.stroke();
  c.fillStyle = "rgba(255,255,255,.32)"; c.beginPath(); c.arc(HEAD, W / 2, 3.2, 0, 7); c.fill(); c.beginPath(); c.arc(750, W / 2, 3.2, 0, 7); c.fill();
  c.font = "bold 190px Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = th.mark; c.fillText("♠", L / 2 + 40, W / 2 + 8);
  c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = 24; c.strokeRect(0, 0, L, W);
  c.restore();
  // cushions (trapezoids, narrower at the felt)
  c.save(); c.translate(RAIL, RAIL);
  const poly = (pts, g0, g1, noseA, noseB) => {
    const gr = c.createLinearGradient(g0[0], g0[1], g1[0], g1[1]); gr.addColorStop(0, th.cush[1]); gr.addColorStop(1, th.cush[0]);
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath();
    c.fillStyle = gr; c.fill(); c.strokeStyle = "rgba(0,0,0,.4)"; c.lineWidth = 1.5; c.stroke();
    c.beginPath(); c.moveTo(noseA[0], noseA[1]); c.lineTo(noseB[0], noseB[1]); c.strokeStyle = th.nose; c.lineWidth = 2.4; c.lineCap = "round"; c.stroke();
  };
  [[46, L / 2 - 44], [L / 2 + 44, L - 46]].forEach(([a, b]) => {
    poly([[a, 0], [b, 0], [b + cu * 0.9, -cu], [a - cu * 0.9, -cu]], [0, -cu], [0, 0], [a, 0], [b, 0]);
    poly([[a, W], [b, W], [b + cu * 0.9, W + cu], [a - cu * 0.9, W + cu]], [0, W + cu], [0, W], [a, W], [b, W]);
  });
  poly([[0, 46], [0, W - 46], [-cu, W - 46 + cu * 0.9], [-cu, 46 - cu * 0.9]], [-cu, 0], [0, 0], [0, 46], [0, W - 46]);
  poly([[L, 46], [L, W - 46], [L + cu, W - 46 + cu * 0.9], [L + cu, 46 - cu * 0.9]], [L + cu, 0], [L, 0], [L, 46], [L, W - 46]);
  c.restore();
  // sight dots
  const dot = (x, y) => { c.beginPath(); c.arc(x, y, 4.5, 0, 7); c.fillStyle = th.dot; c.fill(); c.strokeStyle = "rgba(0,0,0,.4)"; c.lineWidth = 1; c.stroke(); };
  [1, 2, 3, 5, 6, 7].forEach((i) => { dot(RAIL + (L * i) / 8, 19); dot(RAIL + (L * i) / 8, TH - 19); });
  [1, 2, 3].forEach((i) => { dot(19, RAIL + (W * i) / 4); dot(TW - 19, RAIL + (W * i) / 4); });
  // pockets with chrome plates
  for (const pk of POCKETS) {
    const x = RAIL + pk.x, y = RAIL + pk.y, vr = pk.r * 0.82;
    const cg = c.createLinearGradient(x - vr, y - vr, x + vr, y + vr); cg.addColorStop(0, th.chrome[0]); cg.addColorStop(0.5, th.chrome[1]); cg.addColorStop(1, th.chrome[2]);
    c.beginPath(); c.arc(x, y, vr + 9, 0, 7); c.fillStyle = cg; c.fill();
    c.beginPath(); c.arc(x, y, vr + 9, 0, 7); c.strokeStyle = "rgba(0,0,0,.45)"; c.lineWidth = 1.5; c.stroke();
    const hg = c.createRadialGradient(x, y, 2, x, y, vr);
    hg.addColorStop(0, "#000"); hg.addColorStop(0.7, "#10060a"); hg.addColorStop(1, "#3a0d12");
    c.beginPath(); c.arc(x, y, vr, 0, 7); c.fillStyle = hg; c.fill();
  }
  // ball return channel
  const cx0 = TW + 8, cw = 40, cy0 = 46, ch = TH - cy0 - 22;
  c.fillStyle = "rgba(0,0,0,.35)"; rr(c, cx0 + 4, cy0 + 6, cw, ch, 20); c.fill();
  rr(c, cx0, cy0, cw, ch, 20);
  const chg = c.createLinearGradient(cx0, 0, cx0 + cw, 0); chg.addColorStop(0, th.chrome[1]); chg.addColorStop(0.5, th.chrome[0]); chg.addColorStop(1, th.chrome[1]);
  c.fillStyle = chg; c.fill();
  rr(c, cx0 + 5, cy0 + 5, cw - 10, ch - 10, 15);
  const ig = c.createLinearGradient(cx0, 0, cx0 + cw, 0); ig.addColorStop(0, "#05080c"); ig.addColorStop(0.5, "#1a2331"); ig.addColorStop(1, "#05080c");
  c.fillStyle = ig; c.fill();
  c.strokeStyle = "rgba(255,255,255,.1)"; c.lineWidth = 1;
  for (let y = cy0 + 20; y < cy0 + ch - 10; y += 28) { c.beginPath(); c.moveTo(cx0 + 8, y); c.lineTo(cx0 + cw - 8, y); c.stroke(); }
  rr(c, TW - 10, cy0 + 10, cx0 + 12 - (TW - 10), 12, 5); c.fillStyle = chg; c.fill();
  return cv;
}

/* =====================  small UI pieces  ===================== */
function MiniBall({ id, size = 20 }) {
  const col = colOf(id), stripe = id > 8;
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%", display: "inline-grid", placeItems: "center", flexShrink: 0,
        background: stripe ? `linear-gradient(180deg,#f6f2e8 0 24%,${col} 24% 76%,#f6f2e8 76%)` : col,
        boxShadow: "inset -2px -3px 5px rgba(0,0,0,.5), inset 2px 2px 3px rgba(255,255,255,.45), 0 1px 3px rgba(0,0,0,.6)",
      }}
    >
      <i style={{ width: size * 0.5, height: size * 0.5, borderRadius: "50%", background: "#faf8f0", display: "grid", placeItems: "center", fontStyle: "normal", fontSize: Math.max(5, size * 0.35), fontWeight: 800, color: "#111" }}>{id}</i>
    </span>
  );
}

  const EmptySlot = ({ size = 20 }) => <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "radial-gradient(circle at 50% 40%,#1a1d24,#07080b)", boxShadow: "inset 0 2px 4px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.08)" }} />;

function Avatar({ name, color, active, size = 40 }) {
  return (
    <motion.div
      animate={active ? { boxShadow: [`0 0 0 3px ${color}, 0 0 8px ${color}`, `0 0 0 3px ${color}, 0 0 22px ${color}`, `0 0 0 3px ${color}, 0 0 8px ${color}`] } : { boxShadow: "0 0 0 2px rgba(255,255,255,.22)" }}
      transition={active ? { repeat: Infinity, duration: 1.5 } : { duration: 0.3 }}
      style={{ width: size, height: size, borderRadius: size * 0.27, position: "relative", flexShrink: 0, background: "linear-gradient(160deg,#79ccff,#2f86de)", overflow: "hidden", opacity: active ? 1 : 0.8 }}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
        <circle cx="20" cy="15" r="7.5" fill="#0d4aa0" /><path d="M5 40 C6 28 12 24 20 24 C28 24 34 28 35 40 Z" fill="#0d4aa0" />
      </svg>
      <span style={{ position: "absolute", right: 1, bottom: 1, width: size * 0.4, height: size * 0.4, borderRadius: "50%", display: "grid", placeItems: "center", background: GOLD, color: "#3b2506", fontSize: size * 0.225, fontWeight: 800 }}>
        {(name || "?").slice(0, 1).toUpperCase()}
      </span>
    </motion.div>
  );
}
const RackIcon = ({ size = 38 }) => (
  <div style={{ width: size, height: size, borderRadius: 10, flexShrink: 0, background: "linear-gradient(160deg,#20242d,#0b0d12)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)", display: "grid", placeItems: "center" }}>
    <svg viewBox="0 0 38 38" width={size * 0.79} height={size * 0.79} aria-hidden="true">
      <circle cx="14" cy="16" r="7" fill="#f2711c" /><circle cx="25" cy="15" r="7" fill="#e03131" /><circle cx="18" cy="26" r="7" fill="#1f8a4c" />
      <circle cx="12" cy="13.5" r="2" fill="rgba(255,255,255,.55)" /><circle cx="23" cy="12.5" r="2" fill="rgba(255,255,255,.55)" /><circle cx="16" cy="23.5" r="2" fill="rgba(255,255,255,.55)" />
    </svg>
  </div>
);
function SpinBall({ spin, onClick, enabled, size = 42 }) {
  const o = size * 0.31, d = Math.round(size * 0.21);
  return (
    <motion.button
      type="button" onClick={onClick} whileTap={{ scale: 0.92 }} aria-label="Spin"
      style={{ width: size, height: size, borderRadius: "50%", position: "relative", flexShrink: 0, opacity: enabled ? 1 : 0.55, background: "radial-gradient(circle at 35% 30%,#fff,#dcd6c6 65%,#8f8878)", boxShadow: "0 0 0 2px rgba(255,255,255,.35), 0 4px 10px rgba(0,0,0,.55)" }}
    >
      <i style={{ position: "absolute", left: `calc(50% + ${spin.x * o}px - ${d / 2}px)`, top: `calc(50% - ${spin.y * o}px - ${d / 2}px)`, width: d, height: d, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#ff8a8a,#c4161e)" }} />
    </motion.button>
  );
}
function MenuItem({ label, value, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-[12px] font-semibold" style={{ color: "#efe8d6" }}>
      <span>{label}</span>
      {value != null && <span style={{ color: value ? "#6df08a" : "#9aa0a6" }}>{value}</span>}
    </button>
  );
}
function SpinBig({ spin, onChange, onClose, T }) {
  const ref = useRef(null);
  const set = (e) => {
    const r = ref.current.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy), k = m > 0.85 ? 0.85 / m : 1;
    onChange({ x: dx * k, y: -dy * k });
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 z-30 grid place-items-center" style={{ background: "rgba(5,8,14,.84)", borderRadius: 18 }}>
      <div onClick={(e) => e.stopPropagation()} className="text-center">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: "#f0cb62" }}>{T.spinTitle}</p>
        <p className="text-[11px] font-semibold opacity-80">▲ {T.follow}</p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-[11px] opacity-60">◀</span>
          <motion.div
            ref={ref} initial={{ scale: 0.8 }} animate={{ scale: 1 }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(e); }} onPointerMove={(e) => { if (e.buttons) set(e); }} onDoubleClick={() => onChange({ x: 0, y: 0 })}
            style={{ width: 190, height: 190, borderRadius: "50%", position: "relative", touchAction: "none", cursor: "pointer", background: "radial-gradient(circle at 35% 30%,#fff,#dcd6c6 65%,#8f8878)", boxShadow: "0 0 0 3px rgba(240,203,98,.8), 0 18px 40px rgba(0,0,0,.6)" }}
          >
            <i style={{ position: "absolute", left: "50%", top: 10, bottom: 10, width: 1, background: "rgba(0,0,0,.2)" }} />
            <i style={{ position: "absolute", top: "50%", left: 10, right: 10, height: 1, background: "rgba(0,0,0,.2)" }} />
            <i style={{ position: "absolute", left: `calc(50% + ${spin.x * 82}px - 14px)`, top: `calc(50% - ${spin.y * 82}px - 14px)`, width: 28, height: 28, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#ff9a9a,#c4161e)", boxShadow: "0 3px 8px rgba(0,0,0,.6)" }} />
          </motion.div>
          <span className="text-[11px] opacity-60">▶</span>
        </div>
        <p className="mt-1 text-[11px] font-semibold opacity-80">▼ {T.draw}</p>
        <p className="mt-4 text-[10px] opacity-50">{T.tapClose}</p>
      </div>
    </motion.div>
  );
}

/* =====================================================================
   THE GAME
   ===================================================================== */
export default function PoolGame({ kit, ui, lang, S, role, names, level, net, onFinish, lc, opt: optIn }) {
  const opt = optIn || {};
  const { Warn, useWarn, GC, TC, fmt } = kit;
  const T = PT[lang] || PT.en;
  const th = THEMES[opt.cloth] || THEMES.blue;
  const [wn, warn, shake] = useWarn();
  const local = role === "local", cpu = role === "cpu", online = role === "host" || role === "guest";
  const myP = role === "host" ? 1 : role === "guest" ? 2 : cpu ? 1 : 0;
  const aiP = cpu ? 2 : 0;
  const needCallOpt = opt.callEight !== false;
  const prm = { ...(AID[level] || AID.medium), ...(lc || {}) };

  const [, bump] = useState(0);
  const re = () => bump((n) => n + 1);
  const [toast, setToast] = useState(null);
  const [snd, setSnd] = useState(opt.sound !== false);
  const [guide, setGuide] = useState(true);
  const [menu, setMenu] = useState(false);
  const [spinOpen, setSpinOpen] = useState(false);
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const G = useRef(null);
  if (!G.current) G.current = newGame();
  const g = G.current;
  const sfxRef = useRef(null);
  if (!sfxRef.current) sfxRef.current = makeSfx();
  sfxRef.current.on = snd;
  const cvRef = useRef(null), tbl = useRef(null), boxRef = useRef(null), view = useRef({ s: 0.4, vert: false, dpr: 1 });
  const fn = useRef({}), guideRef = useRef(true);
  guideRef.current = guide;
  const alive = useRef(true), tt = useRef(0), lastAim = useRef(0), endT = useRef(0);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const boxW = ui.useWidth(boxRef, 360);

  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(tt.current); clearTimeout(endT.current); }; }, []);
  useEffect(() => {
    const h = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", h); window.addEventListener("orientationchange", h);
    return () => { window.removeEventListener("resize", h); window.removeEventListener("orientationchange", h); };
  }, []);

    const [topOff, setTopOff] = useState(240); // how far down the page the table starts
  useEffect(() => {
    const m = () => { const el = boxRef.current; if (el) setTopOff(el.getBoundingClientRect().top + window.scrollY); };
    m();
    const t = setTimeout(m, 300);
    return () => clearTimeout(t);
  }, [vp.w, vp.h]);

  /* ----- layout: vertical table on tall phones so the balls stay big ----- */
  const cw = Math.min(boxW, 520);
  const sH = cw / TWC;
    const sV = Math.min(cw / TH, Math.max(300, vp.h - topOff - 16) / TWC);
  const phone = vp.w < 700;
  const vert = phone ? vp.h >= vp.w : vp.h > vp.w * 1.2 && sV > sH * 1.1;
  const s = vert ? sV : sH;
  const sw = vert ? TH * s : TWC * s, sh = vert ? TWC * s : TH * s;
  const pad = Math.round(clamp(((vp.w - sw) / 2 - 8) / s, 0, 260)); // free space around the table (logical units) where the stick can be drawn
  view.current = { s, vert, dpr: Math.min(2.5, window.devicePixelRatio || 1), pad };

  const nameOf = (p) => (p === 1 ? names.host : names.guest);
  const colorOf = (p) => (p === 1 ? GC : TC);
  const canActNow = () => { const x = G.current; return !x.over && x.phase === "aim" && !x.ai && (local || x.turn === myP) && !(cpu && x.turn === aiP); };
  const canAct = canActNow();
  const eightPhase = (x) => { const gp = x.groups[x.turn]; return needCallOpt && !!gp && !x.balls.some((b) => b.on && grpOf(b.id) === gp); };

  const showToast = (text, color, big) => {
    setToast({ text, color: color || "#fff", big: !!big, k: Math.random() });
    clearTimeout(tt.current);
    tt.current = setTimeout(() => setToast(null), big ? 2600 : 2000);
  };
  useEffect(() => { showToast(myP === 1 || local ? T.yourBreak : fmt(T.theirBreak, { name: nameOf(1) }), "#fff", true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendAim = () => {
    if (!online) return;
    const n = performance.now();
    if (n - lastAim.current < 60) return;
    lastAim.current = n;
    const x = G.current;
    net.sendU({ t: "pl_aim", a: x.aim, p: x.power, x: x.balls[0].x, y: x.balls[0].y, call: x.call });
  };
  const autoAim = (x) => {
    const tg = legalTargets(x, x.turn), cue = x.balls[0];
    if (!tg.length) return;
    let b = tg[0];
    for (const t of tg) if (Math.hypot(t.x - cue.x, t.y - cue.y) < Math.hypot(b.x - cue.x, b.y - cue.y)) b = t;
    x.aim = Math.atan2(b.y - cue.y, b.x - cue.x); x.aimShow = x.aim;
  };

  /* ----- finishing a shot ----- */
  const announce = (i, prevTurn) => {
    let lines = [], color = "#fff", big = true;
    if (i.over) { lines.push(fmt(T.wins, { name: nameOf(i.winner) })); if (i.reason && T[i.reason]) lines.push(T[i.reason]); color = "#f6dc8c"; }
    else if (i.rerack) lines.push(T.rerack);
    else if (i.foul && T[i.reason]) { lines.push(T[i.reason]); color = "#ff9a9a"; }
    else if (i.assigned) lines.push(fmt(T.assigned, { name: nameOf(i.who), group: T[i.assigned === "solid" ? "solids" : "stripes"] }));
    else big = false;
    const x = G.current;
    if (!i.over && local && x.turn !== prevTurn) lines.push(fmt(S.passTo, { name: nameOf(x.turn) }));
    else if (!i.over && !big && x.turn !== prevTurn && (online || cpu) && x.turn === myP) lines.push(S.yourTurnBig);
    if (!lines.length) return;
    showToast(lines.join("\n"), color, big);
  };
  const finishTurnState = (info, prevTurn) => {
    const x = G.current;
    x.sim = null; x.call = null; x.ai = null; x.drag = null; x.power = 0;
    const cue = x.balls[0];
    if (!cue.on) {
      const sp = freeSpot(x.balls, HEAD, W / 2);
      cue.on = true; cue.sink = null; cue.x = sp.x; cue.y = sp.y; cue.px = sp.x; cue.py = sp.y; cue.vx = 0; cue.vy = 0; cue.dirty = true;
    }
                if (info.over) {
      x.over = true; x.winner = info.winner; x.phase = "over";
      const wn2 = info.winner === 1 ? "host" : "guest";
      clearTimeout(endT.current);
      endT.current = setTimeout(() => {
        if (!alive.current || x.finished) return;
        x.finished = true;
        try { onFinishRef.current(wn2); } catch (err) { console.error("pool onFinish", err); }
      }, 1800);
    } else { x.phase = "aim"; autoAim(x); }
    announce(info, prevTurn);
    re();
  };
  const endShot = () => {
    const x = G.current, sim = x.sim;
    if (sim.mine) {
      const me = x.turn;
      const res = judge(x, sim, needCallOpt);
      if (res.rerack) { x.balls = rackBalls(); x.tray = []; x.trayY = {}; x.brk = true; x.hand = true; x.turn = res.next; }
      else { x.groups = res.groups; x.turn = res.next; x.hand = res.hand; x.brk = false; }
      const info = { who: me, ids: res.sunk, foul: res.foul, reason: res.reason, rerack: res.rerack, over: res.over, winner: res.winner, assigned: res.assigned };
      finishTurnState(info, me);
      if (online) net.send({ t: "pl_end", b: x.balls.map((b) => [Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, b.on ? 1 : 0]), turn: x.turn, groups: x.groups, hand: x.hand, brk: x.brk, info });
    } else if (x.pendingEnd) { applySnap(x.pendingEnd); x.pendingEnd = null; }
    else { x.phase = "wait"; re(); }
  };
  const applySnap = (m) => {
    const x = G.current;
    if (!m || !Array.isArray(m.b) || m.b.length !== 16 || !m.info) return;
    const prev = x.turn;
    if (m.info.rerack) { x.balls = rackBalls(); x.tray = []; x.trayY = {}; }
    else m.b.forEach((r, i) => {
      const b = x.balls[i];
      b.x = Number(r[0]) || 0; b.y = Number(r[1]) || 0; b.px = b.x; b.py = b.y; b.vx = 0; b.vy = 0; b.on = !!r[2];
      b.sink = b.on ? null : { t: 1, done: true, x0: b.x, y0: b.y, px: b.x, py: b.y }; b.dirty = true;
      if (!b.on && b.id > 0 && !x.tray.includes(b.id)) x.tray.push(b.id);
    });
    x.groups = m.groups && typeof m.groups === "object" ? { 1: m.groups[1] || null, 2: m.groups[2] || null } : x.groups;
    x.turn = m.turn === 2 ? 2 : 1; x.hand = !!m.hand; x.brk = !!m.brk;
    finishTurnState({ ...m.info, who: m.info.who === 2 ? 2 : 1 }, prev);
  };

  /* ----- taking a shot ----- */
  const launch = (P, mine) => {
    const x = G.current;
    if (x.phase !== "aim" || x.over || !Number.isFinite(P.a)) return;
    const cue = x.balls[0];
    if (Number.isFinite(P.cx) && Number.isFinite(P.cy)) { cue.x = clamp(P.cx, R, x.brk ? HEAD : L - R); cue.y = clamp(P.cy, R, W - R); cue.px = cue.x; cue.py = cue.y; }
    const p = clamp(Number(P.p) || 0.05, 0.03, 1);
    x.aim = P.a; x.power = p; x.spin = { x: clamp(Number(P.sx) || 0, -1, 1), y: clamp(Number(P.sy) || 0, -1, 1) };
    x.call = P.call == null ? null : Number(P.call);
    x.hand = false; x.ai = null; x.drag = null; x.shots += 1;
    x.pending = { a: P.a, p, sx: x.spin.x, sy: x.spin.y, call: x.call, mine };
    x.anim = { t0: performance.now() }; x.phase = "strike";
    if (online && mine) net.send({ t: "pl_shot", a: P.a, p, sx: x.spin.x, sy: x.spin.y, cx: cue.x, cy: cue.y, call: x.call });
    setMenu(false); setSpinOpen(false);
    re();
  };
  const fire = () => {
    const x = G.current, P = x.pending, cue = x.balls[0];
    const v = VMAX * P.p;
    cue.vx = Math.cos(P.a) * v; cue.vy = Math.sin(P.a) * v;
    const gp = x.groups[x.turn];
    const own = gp ? x.balls.filter((b) => b.on && grpOf(b.id) === gp).length : null;
    x.sim = { acc: 0, mine: P.mine, call: P.call, spin: { x: P.sx, y: P.sy }, before: { ownLeft: own }, ev: { first: null, sunk: [], cueSunk: false, rail: false, contact: false, eightPk: -1 } };
    x.phase = "roll";
    sfxRef.current.hit(P.p);
    re();
  };
  const shoot = () => {
    const x = G.current;
    if (!canActNow()) return;
    if (x.power < 0.07) { x.power = 0; re(); return; }
    if (eightPhase(x) && x.call == null) { warn(T.callEight); x.power = 0; re(); return; }
    const cue = x.balls[0];
    launch({ a: x.aim, p: x.power, sx: x.spin.x, sy: x.spin.y, cx: cue.x, cy: cue.y, call: x.call }, true);
  };
  const getHint = () => {
    const x = G.current;
    if (!canActNow()) return;
    const plan = aiPlan(x, prm, true, true);
    x.aim = plan.a; x.call = plan.call; setMenu(false); re();
  };

  /* ----- messages from the friend ----- */
  fn.current.onNet = (m) => {
    const x = G.current;
    if (!online || !m) return;
    if (m.t === "pl_shot") {
      if (x.turn === myP) return;
      launch({ a: Number(m.a), p: Number(m.p), sx: Number(m.sx), sy: Number(m.sy), cx: Number(m.cx), cy: Number(m.cy), call: m.call }, false);
    } else if (m.t === "pl_aim") {
      if (x.turn !== myP && x.phase === "aim") {
        if (Number.isFinite(Number(m.a))) x.raim = Number(m.a);
        x.rp = clamp(Number(m.p) || 0, 0, 1);
        if (x.hand && Number.isFinite(Number(m.x)) && Number.isFinite(Number(m.y))) {
          const c = x.balls[0]; c.x = clamp(Number(m.x), R, x.brk ? HEAD : L - R); c.y = clamp(Number(m.y), R, W - R); c.px = c.x; c.py = c.y;
        }
        x.call = m.call == null ? null : Number(m.call);
      }
    } else if (m.t === "pl_end") {
      if (x.phase === "wait") applySnap(m); else x.pendingEnd = m;
    }
  };
  useEffect(() => net.on((m) => fn.current.onNet(m)), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- frame loop: update ----- */
  fn.current.update = (now, dt) => {
    const x = G.current;
    x.fx = x.fx.filter((f) => (f.t += dt * 1.7) < 1);
    for (const b of x.balls) {
      if (b.sink && !b.sink.done) {
        b.sink.t += dt / 0.33;
        if (b.sink.t >= 1) { b.sink.t = 1; b.sink.done = true; if (b.id > 0 && !x.tray.includes(b.id)) x.tray.push(b.id); }
      }
    }
    x.tray.forEach((id, i) => {
      const target = TH - 22 - 18 - i * 28;
      if (x.trayY[id] == null) x.trayY[id] = 52;
      x.trayY[id] += (target - x.trayY[id]) * Math.min(1, dt * 5);
    });
    if (x.phase === "strike") {
      if ((now - x.anim.t0) / 140 >= 1) fire();
    } else if (x.phase === "roll") {
      const sm = x.sim; sm.acc += dt; sm.t = (sm.t || 0) + dt;
      if (sm.t > 28) x.balls.forEach((b) => { b.vx = 0; b.vy = 0; }); // safety: a shot can never run forever
      let n = 0;
      while (sm.acc >= DT && n < 40) { simStep(x, sfxRef.current); sm.acc -= DT; n++; }
      for (const b of x.balls) {
        if (!b.on) continue;
        const dx = b.x - b.px, dy = b.y - b.py, d = Math.hypot(dx, dy);
        if (d > 0.02) { rollQ(b, dx, dy, d); b.dirty = true; }
        b.px = b.x; b.py = b.y;
      }
      const moving = x.balls.some((b) => b.on && (b.vx || b.vy));
      const sinking = x.balls.some((b) => b.sink && !b.sink.done);
      if (!moving && !sinking) endShot();
    } else if (x.phase === "aim" && !x.over) {
      if (online && x.turn !== myP) x.aimShow = angLerp(x.aimShow, x.raim, 0.3);
      if (cpu && x.turn === aiP) {
        if (!x.ai) x.ai = { stage: "think", t0: now };
        const ai = x.ai;
        if (ai.stage === "think" && now - ai.t0 > prm.delay) {
          try { ai.plan = aiPlan(x, prm, false, false); } catch (err) { console.error("pool ai", err); ai.plan = { a: x.aim, p: 0.5, hand: null, call: null }; }
          if (ai.plan.hand) { const c = x.balls[0]; c.x = ai.plan.hand.x; c.y = ai.plan.hand.y; c.px = c.x; c.py = c.y; x.hand = false; }
          x.call = ai.plan.call; ai.stage = "turn"; ai.t0 = now; ai.a0 = x.aim;
        } else if (ai.stage === "turn") {
          const t = Math.min(1, (now - ai.t0) / 850), e = t * t * (3 - 2 * t);
          x.aim = angLerp(ai.a0, ai.plan.a, e); x.power = ai.plan.p * e;
          if (t >= 1) { const c = x.balls[0], pl = ai.plan; x.ai = null; launch({ a: pl.a, p: pl.p, sx: 0, sy: 0, cx: c.x, cy: c.y, call: pl.call }, true); }
        }
      }
      if (((x.ai && x.ai.stage === "turn") || (online && x.turn !== myP)) && now - x.lre > 70) { x.lre = now; re(); }
    }
  };

  /* ----- frame loop: draw ----- */
  fn.current.draw = (now) => {
    const cv = cvRef.current;
    if (!cv) return;
    const x = G.current, v = view.current, k = v.s * v.dpr, pd = v.pad || 0;
    const pw = Math.round((TWC + 2 * pd) * k), ph = Math.round((TH + 2 * pd) * k);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; tbl.current = null; x.balls.forEach((b) => { b.cv = null; }); }
    if (!tbl.current || tbl.current.k !== k) tbl.current = { k, cv: buildTable(k, th) };
    const c = cv.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, pw, ph); c.drawImage(tbl.current.cv, pd * k, pd * k);
    // ball return
    c.setTransform(k, 0, 0, k, pd * k, pd * k);
    x.tray.forEach((id) => {
      const b = x.balls.find((z) => z.id === id);
      if (!b) return;
      if (!b.cv || b.dirty) paintBall(b, R * k);
      const ty = x.trayY[id] == null ? 52 : x.trayY[id], tx = TW + 28;
      c.drawImage(b.cv, tx - 13, ty - 13, 26, 26);
      c.fillStyle = "#faf8f0"; c.beginPath(); c.arc(tx, ty, 6, 0, 7); c.fill();
      c.fillStyle = "#111"; c.font = "800 8px ui-sans-serif, system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(id), tx, ty + 0.5);
    });
    c.setTransform(k, 0, 0, k, (RAIL + pd) * k, (RAIL + pd) * k);
    const cue = x.balls[0];
    const mineNow = canActNow();
    const remoteTurn = online && x.turn !== myP;
    const pos = (b) => {
      if (!b.sink) return { x: b.x, y: b.y, sc: 1, al: 1 };
      const t = b.sink.t, e = t * t;
      return { x: b.sink.x0 + (b.sink.px - b.sink.x0) * e, y: b.sink.y0 + (b.sink.py - b.sink.y0) * e, sc: 1 - 0.55 * e, al: 1 - t * 0.92 };
    };
    const visible = x.balls.filter((b) => b.on || (b.sink && !b.sink.done));

    if (x.hand && x.phase === "aim") {
      if (x.brk) { c.fillStyle = "rgba(255,255,255,.06)"; c.fillRect(0, 0, HEAD, W); }
      const pulse = 0.5 + 0.5 * Math.sin(now / 220);
      c.strokeStyle = `rgba(255,255,255,${0.5 + pulse * 0.5})`; c.lineWidth = 2.5; c.beginPath(); c.arc(cue.x, cue.y, R + 6 + pulse * 4, 0, 7); c.stroke();
    }
    for (const b of visible) {
      const p = pos(b);
      const sg = c.createRadialGradient(p.x + 3, p.y + 5, 2, p.x + 3, p.y + 5, R * 1.25);
      sg.addColorStop(0, `rgba(0,0,0,${0.5 * p.al})`); sg.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = sg; c.beginPath(); c.arc(p.x + 3, p.y + 5, R * 1.25, 0, 7); c.fill();
    }
    const showCall = (mineNow && eightPhase(x)) || (x.call != null && x.phase !== "over");
    if (showCall) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 260);
      POCKETS.forEach((pk, i) => {
        const on = x.call === i;
        c.beginPath(); c.arc(pk.x, pk.y, pk.r * 0.9 + pulse * 3, 0, 7);
        c.strokeStyle = on ? "#fff" : `rgba(255,255,255,${0.35 + pulse * 0.3})`; c.lineWidth = on ? 4 : 2.2; c.stroke();
        if (on) { c.fillStyle = "rgba(255,255,255,.25)"; c.fill(); }
      });
    }
    // aim guide
    const showAim = (x.phase === "aim" && !x.over && (mineNow || remoteTurn || (cpu && x.turn === aiP && x.ai && x.ai.stage === "turn"))) || x.phase === "strike";
    const aimA = x.phase === "aim" && remoteTurn ? x.aimShow : x.aim;
    if (showAim && cue.on && (guideRef.current || !mineNow)) {
      const alpha = mineNow || x.phase === "strike" ? 1 : 0.6;
      const dx = Math.cos(aimA), dy = Math.sin(aimA);
      const lim = (p, d, lo, hi) => (d > 1e-9 ? (hi - p) / d : d < -1e-9 ? (lo - p) / d : 1e9);
      const tx = lim(cue.x, dx, R, L - R), ty = lim(cue.y, dy, R, W - R);
      let best = { t: Math.min(tx, ty), type: "wall", nx: tx < ty ? (dx > 0 ? -1 : 1) : 0, ny: tx < ty ? 0 : dy > 0 ? -1 : 1 };
      for (const b of x.balls) {
        if (b.id === 0 || !b.on) continue;
        const fx = b.x - cue.x, fy = b.y - cue.y, proj = fx * dx + fy * dy;
        if (proj <= 0) continue;
        const perp2 = fx * fx + fy * fy - proj * proj;
        if (perp2 >= 4 * R * R) continue;
        const t = proj - Math.sqrt(4 * R * R - perp2);
        if (t < best.t) best = { t, type: "ball", b };
      }
      const hx = cue.x + dx * best.t, hy = cue.y + dy * best.t;
      const illegal = best.type === "ball" && !x.brk && !legalTargets(x, x.turn).some((z) => z.id === best.b.id);
      c.save(); c.globalAlpha = alpha; c.lineCap = "round";
      c.strokeStyle = "rgba(255,255,255,.92)"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cue.x + dx * R, cue.y + dy * R); c.lineTo(hx, hy); c.stroke();
      c.beginPath(); c.arc(hx, hy, R, 0, 7); c.strokeStyle = illegal ? "#ff3b3b" : "rgba(255,255,255,.95)"; c.lineWidth = illegal ? 3 : 2; c.stroke();
      if (illegal) { c.beginPath(); c.moveTo(hx - R * 0.7, hy - R * 0.7); c.lineTo(hx + R * 0.7, hy + R * 0.7); c.stroke(); }
      if (best.type === "ball") {
        const nx = (best.b.x - hx) / (2 * R), ny = (best.b.y - hy) / (2 * R);
        c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(best.b.x, best.b.y); c.lineTo(best.b.x + nx * 70, best.b.y + ny * 70); c.stroke();
        const dn = dx * nx + dy * ny;
        let tvx = dx - dn * nx, tvy = dy - dn * ny; const tm = Math.hypot(tvx, tvy);
        if (tm > 0.05) { tvx /= tm; tvy /= tm; const ln = 20 + 44 * tm; c.strokeStyle = "rgba(255,255,255,.6)"; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + tvx * ln, hy + tvy * ln); c.stroke(); }
      }
      c.restore();
    }
    // balls with numbers
    for (const b of visible) {
      if (!b.cv || b.dirty) paintBall(b, R * k);
      const p = pos(b), sz = (b.cv.width / k) * p.sc;
      c.globalAlpha = p.al;
      c.drawImage(b.cv, p.x - sz / 2, p.y - sz / 2, sz, sz);
      if (b.id > 0 && !b.sink) {
        const M = qmat(b.q);
        for (const sg of [1, -1]) {
          const sx = M[0] * sg, sy = M[3] * sg, sz2 = M[6] * sg;
          if (sz2 > 0.3) {
            c.fillStyle = "rgba(20,20,20,.95)"; c.font = `800 ${R * 0.62 * (0.6 + 0.4 * sz2)}px ui-sans-serif, system-ui, sans-serif`;
            c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(b.id), p.x + sx * R, p.y + sy * R + 0.5);
          }
        }
      }
      c.globalAlpha = 1;
    }
    if (x.hand && x.phase === "aim" && cue.on && mineNow) { c.font = "26px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("✋", cue.x + 26, cue.y - 26); }
    // cue stick
    if (showAim && cue.on) {
      let pull;
      if (x.phase === "strike") { const t = clamp((now - x.anim.t0) / 140, 0, 1), st = x.pending.p * MAXPULL; pull = st - (st + 4) * t * t; }
      else pull = (x.phase === "aim" && remoteTurn ? x.rp : x.power) * MAXPULL;
      const g0 = R + 5 + pull;
      const ddx = -Math.cos(aimA), ddy = -Math.sin(aimA);
      const tX = ddx > 1e-9 ? (TWC - RAIL + pd - cue.x) / ddx : ddx < -1e-9 ? (-RAIL - pd - cue.x) / ddx : 1e9;
      const tY = ddy > 1e-9 ? (TH - RAIL + pd - cue.y) / ddy : ddy < -1e-9 ? (-RAIL - pd - cue.y) / ddy : 1e9;
      const len = clamp(Math.min(tX, tY) - g0 - 3, 40, 640);
      c.save(); c.translate(cue.x, cue.y); c.rotate(aimA);
      c.save(); c.translate(5, 9); c.fillStyle = "rgba(0,0,0,.28)";
      c.beginPath(); c.moveTo(-g0, -2.6); c.lineTo(-g0 - len, -7.5); c.lineTo(-g0 - len, 7.5); c.lineTo(-g0, 2.6); c.closePath(); c.fill(); c.restore();
      const sg = c.createLinearGradient(-g0, 0, -g0 - len, 0);
      sg.addColorStop(0, "#5aa6ff"); sg.addColorStop(0.012, "#5aa6ff"); sg.addColorStop(0.014, "#f4efe2"); sg.addColorStop(0.04, "#f4efe2");
      sg.addColorStop(0.045, "#f3dfb2"); sg.addColorStop(0.55, "#c98f45"); sg.addColorStop(0.56, "#1c120b"); sg.addColorStop(0.64, "#1c120b");
      sg.addColorStop(0.645, "#f0cb62"); sg.addColorStop(0.665, "#f0cb62"); sg.addColorStop(0.67, "#2a1a10"); sg.addColorStop(1, "#0e0905");
      c.fillStyle = sg;
      c.beginPath(); c.moveTo(-g0, -2.6); c.lineTo(-g0 - len, -7.5); c.lineTo(-g0 - len, 7.5); c.lineTo(-g0, 2.6); c.closePath(); c.fill();
      c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-g0, -1.4); c.lineTo(-g0 - len, -4.2); c.stroke();
      // power trail: centred on the stick axis, running from the ball edge to the stick tip
      if (x.phase !== "strike" && pull > 4) {
        const p01 = clamp(pull / MAXPULL, 0, 1), o = R + 2, end = g0 - 1;
        const mg = c.createLinearGradient(-o, 0, -o - MAXPULL, 0);
        mg.addColorStop(0, "#3fe06a"); mg.addColorStop(0.55, "#f0cb62"); mg.addColorStop(1, "#ff4d4d");
        c.lineCap = "butt";
        c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 6; c.beginPath(); c.moveTo(-o, 0); c.lineTo(-end, 0); c.stroke();
        c.strokeStyle = mg; c.lineWidth = 3.6; c.beginPath(); c.moveTo(-o, 0); c.lineTo(-end, 0); c.stroke();
        c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 1.4;
        for (let i = 1; i <= 4; i++) {
          const d = o + (MAXPULL * i) / 4;
          if (d < end - 3) { c.beginPath(); c.moveTo(-d, -8); c.lineTo(-d, 8); c.stroke(); }
        }
        if (p01 >= 0.98) { c.strokeStyle = "rgba(255,90,90,.9)"; c.lineWidth = 2; c.beginPath(); c.arc(-end, 0, 9, 0, 7); c.stroke(); }
      }
      c.restore();
    }
    for (const f of x.fx) {
      c.strokeStyle = `rgba(255,255,255,${1 - f.t})`; c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y, 24 + f.t * 56, 0, 7); c.stroke();
    }
  };

  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      try { fn.current.update(now, dt); } catch (err) { console.error("pool update", err); }
      try { fn.current.draw(now); } catch (err) { console.error("pool draw", err); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ----- touch / mouse on the table ----- */
  const toWorld = (e) => {
    const r = cvRef.current.getBoundingClientRect();
    const pd = view.current.pad || 0, fw = TWC + 2 * pd, fh = TH + 2 * pd;
    if (view.current.vert) return { x: ((e.clientY - r.top) / r.height) * fw - pd - RAIL, y: ((r.right - e.clientX) / r.width) * fh - pd - RAIL };
    return { x: ((e.clientX - r.left) / r.width) * fw - pd - RAIL, y: ((e.clientY - r.top) / r.height) * fh - pd - RAIL };
  };
  const setAimFrom = (w) => {
    const x = G.current, cue = x.balls[0];
    if (Math.hypot(w.x - cue.x, w.y - cue.y) < 12) return;
    x.aim = Math.atan2(w.y - cue.y, w.x - cue.x); sendAim();
  };
  const moveCue = (w) => {
    const x = G.current, cue = x.balls[0];
    const nx = clamp(w.x, R, x.brk ? HEAD : L - R), ny = clamp(w.y, R, W - R);
    if (x.balls.some((b) => b.id !== 0 && b.on && Math.hypot(b.x - nx, b.y - ny) < 2 * R + 1)) return;
    cue.x = nx; cue.y = ny; cue.px = nx; cue.py = ny; sendAim();
  };
    const turnTo = (w) => {
    const x = G.current, cue = x.balls[0];
    if (Math.hypot(w.x - cue.x, w.y - cue.y) < 20) return;
    x.aim = Math.atan2(cue.y - w.y, cue.x - w.x); sendAim(); // the stick follows your finger
  };
  const onDown = (e) => {
    sfxRef.current.unlock();
    setMenu(false);
    if (!canActNow()) return;
    const x = G.current, w = toWorld(e), cue = x.balls[0];
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (eightPhase(x)) {
      let bi = -1, bd = 70;
      POCKETS.forEach((pk, i) => { const d = Math.hypot(pk.x - w.x, pk.y - w.y); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) { x.call = bi; sendAim(); re(); return; }
    }
    if (x.hand && Math.hypot(w.x - cue.x, w.y - cue.y) < R * 2.6) { x.drag = "cue"; return; }
    // touching the stick: drag it sideways to rotate, drag it straight back to power up
    const bx = Math.cos(x.aim + Math.PI), by = Math.sin(x.aim + Math.PI);
    const rx = w.x - cue.x, ry = w.y - cue.y, along = rx * bx + ry * by, perp = Math.abs(rx * -by + ry * bx);
    const thr = clamp(30 / view.current.s, 45, 130);
    if (along > R + 2 && along < 720 && perp < thr) { x.drag = "stick"; x.sx0 = w.x; x.sy0 = w.y; x.pullA0 = along; x.pull0 = x.power * MAXPULL; return; }
    x.drag = "aim"; setAimFrom(w);
  };
  const onMove = (e) => {
    if (!canActNow()) return;
    const x = G.current, w = toWorld(e);
    if (x.drag === "stick") { // decide from the first movement: along the stick = power, sideways = rotate
      const dx = w.x - x.sx0, dy = w.y - x.sy0;
      if (Math.hypot(dx, dy) < 8) return;
      const bx = Math.cos(x.aim + Math.PI), by = Math.sin(x.aim + Math.PI);
      const da = Math.abs(dx * bx + dy * by), dp = Math.abs(dx * -by + dy * bx);
      x.drag = da > dp * 1.5 ? "pull" : "turn";
    }
    if (x.drag === "cue") moveCue(w);
    else if (x.drag === "aim") setAimFrom(w);
    else if (x.drag === "turn") turnTo(w);
    else if (x.drag === "pull") {
      const cue = x.balls[0], bx = Math.cos(x.aim + Math.PI), by = Math.sin(x.aim + Math.PI);
      const along = (w.x - cue.x) * bx + (w.y - cue.y) * by;
      x.power = clamp((x.pull0 + (along - x.pullA0)) / MAXPULL, 0, 1); sendAim(); re();
    } else if (e.pointerType === "mouse") setAimFrom(w);
  };
  const onUp = () => { const x = G.current, d = x.drag; x.drag = null; if (d === "pull") shoot(); };
  const onCancel = () => { const x = G.current; if (x.drag === "pull") { x.power = 0; re(); } x.drag = null; };

  const nudge = (d) => { if (!canActNow()) return; G.current.aim += d; sendAim(); };
  fn.current.keys = (e) => {
    if (!canActNow()) return;
    if (e.key === "ArrowLeft") { nudge(e.shiftKey ? -0.002 : -0.01); e.preventDefault(); }
    else if (e.key === "ArrowRight") { nudge(e.shiftKey ? 0.002 : 0.01); e.preventDefault(); }
    else if (e.key === "ArrowUp") { G.current.power = clamp(G.current.power - 0.05, 0, 1); re(); e.preventDefault(); }
    else if (e.key === "ArrowDown") { G.current.power = clamp(G.current.power + 0.05, 0, 1); re(); e.preventDefault(); }
    else if (e.key === " " || e.key === "Enter") { shoot(); e.preventDefault(); }
  };
  useEffect(() => {
    const h = (e) => fn.current.keys(e);
    const wheel = (e) => { if (!canActNow()) return; e.preventDefault(); nudge(e.deltaY > 0 ? 0.004 : -0.004); };
    window.addEventListener("keydown", h);
    const cv = cvRef.current;
    if (cv) cv.addEventListener("wheel", wheel, { passive: false });
    return () => { window.removeEventListener("keydown", h); if (cv) cv.removeEventListener("wheel", wheel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- what to show ----- */
  const order = local ? [1, 2] : [myP, myP === 1 ? 2 : 1];
  const potted = (p) => (g.groups[p] ? g.balls.filter((b) => !b.on && grpOf(b.id) === g.groups[p]).length : 0);
    const bsz = phone ? 17 : 20;
  const slots = (p) => {
    const gp = g.groups[p];
    if (!gp) return Array.from({ length: 7 }, (_, i) => <EmptySlot key={i} size={bsz} />);
    const ids = GROUP_IDS[gp];
    const left = ids.filter((id) => g.balls.find((b) => b.id === id).on);
    return ids.map((id, i) => (left.includes(id) ? <MiniBall key={id} id={id} size={bsz} /> : i === 6 && !left.length ? <MiniBall key="8" id={8} size={bsz} /> : <EmptySlot key={id} size={bsz} />));
  };
  const nameTag = (p, right) => (
    <div className={`min-w-0 flex-1 ${right ? "text-right" : "text-left"}`}>
      <span className="inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5" style={{ background: "rgba(0,0,0,.5)" }}>
        {!phone && <span style={{ color: "#f0cb62", fontSize: 10 }}>★</span>}
        <b className="min-w-0 truncate" style={{ fontSize: phone ? 10 : 11, color: g.turn === p && !g.over ? colorOf(p) : "#efe8d6" }}>{nameOf(p)}</b>
        <span className="shrink-0 text-[9px] opacity-60">{potted(p)}</span>
      </span>
    </div>
  );
  const hintText = canAct && g.shots === 0 && !g.hand ? T.tipAim : canAct ? (g.hand ? (g.brk ? T.placeBreak : T.placeHint) : eightPhase(g) ? T.callHint : "") : "";

  return (
    <div className="flex w-full flex-col items-center">
            {/* ---------- header bar, like the app ---------- */}
      <div
        className="relative w-full max-w-[520px] rounded-2xl px-2 pb-2 pt-2"
        style={{ zIndex: 20, background: "linear-gradient(180deg,#5b606d,#383c47)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12), 0 8px 20px rgba(0,0,0,.45)", backgroundImage: "radial-gradient(rgba(0,0,0,.28) 1px, transparent 1.4px), linear-gradient(180deg,#5b606d,#383c47)", backgroundSize: "4px 4px, 100% 100%" }}
      >
        <div className="flex items-center gap-1">
          <motion.button
            type="button" whileTap={{ scale: 0.92 }} onClick={() => setMenu((m) => !m)} aria-label="Menu"
            className="grid shrink-0 place-items-center" style={{ width: phone ? 30 : 36, height: phone ? 30 : 36, borderRadius: 10, background: "linear-gradient(180deg,#46e062,#139028)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,.4), 0 3px 8px rgba(0,0,0,.5)" }}
          >
            <span className="block w-4 space-y-[3px]">{[0, 1, 2].map((i) => <i key={i} className="block h-[2.5px] rounded bg-white" />)}</span>
          </motion.button>
          {nameTag(order[0], false)}
          <Avatar size={phone ? 32 : 40} name={nameOf(order[0])} color={colorOf(order[0])} active={g.turn === order[0] && !g.over} />
          <RackIcon size={phone ? 30 : 38} />
          <Avatar size={phone ? 32 : 40} name={nameOf(order[1])} color={colorOf(order[1])} active={g.turn === order[1] && !g.over} />
          {nameTag(order[1], true)}
          <SpinBall size={phone ? 34 : 42} spin={g.spin} enabled={canAct} onClick={() => { if (canAct) setSpinOpen(true); }} />
        </div>
        <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <div className="flex min-w-0 items-center gap-[3px] overflow-x-auto rounded-full px-1.5 py-1" style={{ background: "rgba(0,0,0,.3)", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}>{slots(order[0])}</div>
          <div className="flex min-w-0 items-center gap-[3px] overflow-x-auto rounded-full px-1.5 py-1" style={{ background: "rgba(0,0,0,.3)", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}>{slots(order[1])}</div>
        </div>
        <AnimatePresence>
          {menu && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}
              className="absolute left-2 top-[44px] z-30 w-[190px] rounded-xl p-1.5" style={{ background: "linear-gradient(160deg,#1f2530,#0b0e14)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5), 0 18px 40px rgba(0,0,0,.6)" }}
            >
              <MenuItem label={`🔊 ${T.mSound}`} value={snd ? T.on : T.off} onClick={() => { sfxRef.current.unlock(); setSnd((v) => !v); }} />
              <MenuItem label={`📏 ${T.mGuide}`} value={guide ? T.on : T.off} onClick={() => setGuide((v) => !v)} />
              {cpu && <MenuItem label={`💡 ${T.mHint}`} onClick={getHint} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

            <div className="mb-1 flex min-h-[30px] w-full max-w-[520px] justify-center">
        {g.over ? (
          <motion.p initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="rounded-full px-4 py-1 text-[13px] font-bold" style={{ background: GC, color: "#3b2506" }}>
            {fmt(T.wins, { name: nameOf(g.winner) })}
          </motion.p>
        ) : <Warn w={wn} />}
      </div>

      {/* ---------- table + power bar ---------- */}
      <div ref={boxRef} className="w-full">
        <motion.div animate={shake} className="mx-auto" style={{ width: sw }}>
          <div
            className="relative"
            style={{ width: sw, height: sh, borderRadius: 18, touchAction: "none", background: `radial-gradient(ellipse at 50% 30%, ${th.panel[0]}, ${th.panel[1]})`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08), inset 0 0 40px rgba(0,0,0,.6)" }}
          >
            <canvas
              ref={cvRef}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
              style={{ position: "absolute", left: vert ? 0 : -pad * s, top: -pad * s, width: (TWC + 2 * pad) * s, height: (TH + 2 * pad) * s, transformOrigin: "0 0", transform: vert ? `translate(${sw + pad * s}px,0) rotate(90deg)` : "none", touchAction: "none", cursor: canAct ? "crosshair" : "default" }}
            />
            <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-3">
              <AnimatePresence mode="wait">
                {hintText && (
                  <motion.p key={hintText} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-full px-3 py-1 text-center text-[11px] font-bold" style={{ color: "#fff", background: "rgba(0,0,0,.45)", textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>
                    {hintText}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-6">
              <AnimatePresence mode="wait">
                {toast && (
                  <motion.p
                    key={toast.k} initial={{ opacity: 0, scale: 0.7, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 220, damping: 16 }}
                    className="text-center font-extrabold leading-tight"
                    style={{ whiteSpace: "pre-line", fontSize: toast.big ? "clamp(20px,6vw,34px)" : 14, color: toast.color, textShadow: "0 2px 0 rgba(0,0,0,.55), 0 0 14px rgba(0,0,0,.55), 0 0 2px #000", WebkitTextStroke: toast.big ? "1px rgba(0,0,0,.35)" : undefined }}
                  >
                    {toast.text}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {spinOpen && <SpinBig spin={g.spin} T={T} onChange={(v) => { g.spin = v; re(); }} onClose={() => setSpinOpen(false)} />}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}