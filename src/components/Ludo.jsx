import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const LT = {
  en: {
    roll: "Tap the dice to roll", rolling: "Rolling…", pickToken: "Tap a glowing token to move it", noMove: "No move possible",
    waitRoll: "Wait for {name} to roll", waitMove: "Wait for {name} to move", rollFirst: "Roll the dice first",
    notYours: "That is {name}'s token", needSix: "You need a 6 to leave the base", alreadyHome: "That token is already home",
    tooFar: "That token cannot move {d} steps (you need an exact roll to reach home)",
    rolled: "rolled {d}", out: "left the base", captured: "captured a token!", home: "reached home!", nomove: "no move possible",
  },
  hi: {
    roll: "पासा फेंकने के लिए छुएँ", rolling: "पासा घूम रहा है…", pickToken: "चलाने के लिए चमकती गोटी छुएँ", noMove: "कोई चाल संभव नहीं",
    waitRoll: "{name} के पासा फेंकने का इंतज़ार करें", waitMove: "{name} की चाल का इंतज़ार करें", rollFirst: "पहले पासा फेंकें",
    notYours: "यह {name} की गोटी है", needSix: "बेस से निकलने के लिए 6 चाहिए", alreadyHome: "यह गोटी पहले ही घर पहुँच चुकी है",
    tooFar: "यह गोटी {d} कदम नहीं चल सकती (घर के लिए सटीक अंक चाहिए)",
    rolled: "ने {d} फेंका", out: "गोटी बेस से निकली", captured: "ने गोटी पकड़ी!", home: "गोटी घर पहुँची!", nomove: "कोई चाल संभव नहीं",
  },
};

export const HOW = {
  en: [
    "2 to 4 players race 4 tokens each around the board. Tap the dice on your turn.",
    "You need a 6 to bring a token out of the base. A 6, a capture, or reaching home gives you another roll.",
    "Landing on an enemy token sends it back to its base, unless it stands on a star or a start square.",
    "Enter your colored lane and reach the center with an exact roll. The first player to bring all 4 tokens home wins. Online, your own base is always shown top-left.",
  ],
  hi: [
    "2 से 4 खिलाड़ी 4-4 गोटियों से बोर्ड का चक्कर लगाते हैं। अपनी बारी पर पासा छुएँ।",
    "बेस से गोटी निकालने के लिए 6 चाहिए। 6, गोटी पकड़ना या घर पहुँचना, इनसे दोबारा पासा मिलता है।",
    "दुश्मन की गोटी पर उतरें तो वह बेस में लौट जाती है, पर तारे या स्टार्ट वाले खाने पर वह सुरक्षित है।",
    "अपनी रंगीन लेन में जाकर सटीक अंक से बीच में पहुँचें। जो पहले चारों गोटियाँ घर पहुँचाए वही जीतता है। ऑनलाइन में आपका अपना बेस हमेशा ऊपर-बाएँ दिखता है।",
  ],
};

/* ---------------- the board (52 ring squares, 4 corners) ---------------- */
const RING = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];
const STARTS = [0, 13, 26, 39]; // corners: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const LANE = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];
const BASEP = [
  [[1, 1], [1, 4], [4, 1], [4, 4]],
  [[1, 10], [1, 13], [4, 10], [4, 13]],
  [[10, 10], [10, 13], [13, 10], [13, 13]],
  [[10, 1], [10, 4], [13, 1], [13, 4]],
];
const FINP = [
  [[6.3, 6.45], [6.77, 6.45], [7.23, 6.45], [7.7, 6.45]],
  [[6.45, 6.3], [6.45, 6.77], [6.45, 7.23], [6.45, 7.7]],
  [[6.3, 8.55], [6.77, 8.55], [7.23, 8.55], [7.7, 8.55]],
  [[8.55, 6.3], [8.55, 6.77], [8.55, 7.23], [8.55, 7.7]],
];
const CORNERS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
const CORNER_XY = [[0, 0], [9, 0], [9, 9], [0, 9]];
const TRI = ["6,6 6,9 7.5,7.5", "6,6 9,6 7.5,7.5", "9,6 9,9 7.5,7.5", "6,9 9,9 7.5,7.5"];
// p = -1 in base, 0..50 on the ring (from your start), 51..55 your lane, 56 home
const posOf = (cr, p, i) => (p < 0 ? BASEP[cr][i] : p <= 50 ? RING[(STARTS[cr] + p) % 52] : p <= 55 ? LANE[cr][p - 51] : FINP[cr][i]);
const rot = (r, c, k) => (k === 0 ? [r, c] : k === 1 ? [14 - c, r] : k === 2 ? [14 - r, 14 - c] : [c, 14 - r]); // k quarter turns counter-clockwise
const movablesOf = (arr, d) => arr.map((p, i) => ((p === -1 && d === 6) || (p >= 0 && p < 56 && p + d <= 56) ? i : -1)).filter((i) => i >= 0);
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const TILT = 20;
// cube orientation [rotateX, rotateY] that brings each face to the front
const FACE = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] };
const CUBE_FACES = [
  [1, "translateZ(H)"], [6, "rotateY(180deg) translateZ(H)"], [3, "rotateY(90deg) translateZ(H)"],
  [4, "rotateY(-90deg) translateZ(H)"], [5, "rotateX(90deg) translateZ(H)"], [2, "rotateX(-90deg) translateZ(H)"],
];
// lighten (a > 0) or darken (a < 0) a #rrggbb colour
const mix = (hex, a) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const t = a < 0 ? 0 : 255, p = Math.abs(a);
  const f = (v) => Math.round(v + (t - v) * p);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

/* ---------------- the computer player ---------------- */
function botPick(level, who, tok, cor, mv, d) {
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  if (mv.length === 1) return mv[0];
  const arr = tok[who];
  if (level === "easy") {
    const out = mv.filter((i) => arr[i] === -1);
    return out.length && Math.random() < 0.5 ? rnd(out) : rnd(mv);
  }
  const hard = level === "hard";
  const ring = (s, v) => (STARTS[cor[s]] + v) % 52;
  const threats = (idx) => {
    let n = 0;
    tok.forEach((a, s) => {
      if (s === who) return;
      a.forEach((v) => { if (v >= 0 && v <= 50) { const dist = (idx - ring(s, v) + 52) % 52; if (dist >= 1 && dist <= 6) n += 1; } });
    });
    return n;
  };
  let best = [], bs = -1e9;
  mv.forEach((i) => {
    const from = arr[i], to = from === -1 ? 0 : from + d;
    let sc = Math.random() * (hard ? 4 : 10) + d * (hard ? 0.8 : 0.5) + to * 0.05;
    if (from === -1) sc += hard ? 30 : 25;
    if (to === 56) sc += hard ? 50 : 40;
    else if (to > 50) sc += 15;
    if (to <= 50) {
      const idx = ring(who, to);
      const safe = SAFE.has(idx);
      let caps = 0;
      if (!safe) tok.forEach((a, s) => { if (s !== who) a.forEach((v) => { if (v >= 0 && v <= 50 && ring(s, v) === idx) caps += 1; }); });
      sc += caps * (hard ? 70 : 60) + (safe ? 12 : 0);
      if (hard && !safe) sc -= threats(idx) * 18;
    }
    if (hard && from >= 0 && from <= 50) {
      const cur = ring(who, from);
      if (!SAFE.has(cur) && threats(cur) > 0) sc += 22; // run away from danger
    }
    if (sc > bs) { bs = sc; best = [i]; } else if (sc === bs) best.push(i);
  });
  return rnd(best);
}

/* ---------------- a real 3D dice: it tumbles and lands on the rolled face ---------------- */
function Die3D({ v, n, rolling, color, onClick, disabled, size = 68 }) {
  const [fx, fy] = FACE[v] || FACE[1];
  const rx = fx + 720 * n, ry = fy + 1080 * n; // always spins forward, ends on the right face
  const H = `${size / 2}px`;
  return (
    <div onClick={onClick} style={{ position: "relative", width: size, height: size, cursor: disabled ? "default" : "pointer", flexShrink: 0 }}>
      <motion.div
        animate={{ opacity: disabled ? 0.18 : [0.35, 0.9, 0.35], scale: disabled ? 1 : [1, 1.08, 1] }}
        transition={disabled ? { duration: 0.3 } : { repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
        style={{ position: "absolute", inset: -9, borderRadius: size * 0.34, boxShadow: `0 0 0 2px ${color}, 0 0 30px ${color}` }}
      />
      <motion.div
        animate={rolling ? { y: [0, -44 - (n % 2) * 0.01, 0], scale: [1, 1.22, 1] } : { y: 0, scale: 1 }}
        transition={{ duration: rolling ? 0.9 : 0.25, ease: "easeInOut" }}
        whileHover={!disabled && !rolling ? { scale: 1.07 } : undefined} whileTap={!disabled ? { scale: 0.93 } : undefined}
        style={{ width: size, height: size, perspective: 520 }}
      >
        <motion.div
          initial={false}
          animate={{ rotateX: rx, rotateY: ry }}
          transition={{ duration: 0.9, ease: [0.15, 0.7, 0.25, 1] }}
          style={{ position: "relative", width: size, height: size, transformStyle: "preserve-3d" }}
        >
          {CUBE_FACES.map(([val, tf]) => (
            <div
              key={val}
              style={{
                position: "absolute", inset: 0, transform: tf.replace(/H/g, H), backfaceVisibility: "hidden",
                borderRadius: size * 0.2, padding: size * 0.15, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "repeat(3,1fr)",
                background: "linear-gradient(145deg,#fffdf6,#e6d9b8)",
                boxShadow: "inset 0 0 0 1px rgba(120,90,30,.25), inset 0 -5px 8px rgba(0,0,0,.14), inset 0 4px 6px rgba(255,255,255,.8)",
              }}
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} style={{ display: "grid", placeItems: "center" }}>
                  {PIPS[val].includes(i) && (
                    <i style={{ width: size * 0.18, height: size * 0.18, borderRadius: "50%", background: val === 1 ? "radial-gradient(circle at 35% 30%, #ff7a6a, #b3261e)" : "radial-gradient(circle at 35% 30%, #4a4545, #121010)", boxShadow: "inset 0 -2px 2px rgba(0,0,0,.4), 0 1px 0 rgba(255,255,255,.6)" }} />
                  )}
                </span>
              ))}
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ---------------- gradients for the board and the pawns ---------------- */
function LudoDefs({ cols }) {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        {cols.map((c, s) => (
          <g key={s}>
            <radialGradient id={`lh${s}`} cx=".36" cy=".3" r=".8">
              <stop offset="0" stopColor="#fff" /><stop offset=".3" stopColor={mix(c, 0.35)} /><stop offset=".7" stopColor={c} /><stop offset="1" stopColor={mix(c, -0.45)} />
            </radialGradient>
            <linearGradient id={`lb${s}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={mix(c, 0.45)} /><stop offset=".4" stopColor={c} /><stop offset="1" stopColor={mix(c, -0.5)} />
            </linearGradient>
          </g>
        ))}
      </defs>
    </svg>
  );
}
function Pawn({ s, color }) {
  const edge = mix(color, -0.6);
  return (
    <svg viewBox="0 0 60 90" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
      <ellipse cx="30" cy="80" rx="22" ry="7.5" fill={`url(#lb${s})`} stroke={edge} strokeWidth="1.6" />
      <path d="M15 80 Q20 57 25 46 H35 Q40 57 45 80 Z" fill={`url(#lb${s})`} stroke={edge} strokeWidth="1.6" strokeLinejoin="round" />
      <ellipse cx="30" cy="47" rx="11.5" ry="4.2" fill={`url(#lb${s})`} stroke={edge} strokeWidth="1.6" />
      <circle cx="30" cy="30" r="16" fill={`url(#lh${s})`} stroke={edge} strokeWidth="1.6" />
      <ellipse cx="24" cy="23" rx="5.5" ry="3.6" fill="#fff" opacity=".6" transform="rotate(-28 24 23)" />
    </svg>
  );
}

/* seats: [{ id?, name, bot? }]  (2 to 4).  mySeat: your index online / vs computer, -1 on one phone */
export default function LudoGame({ kit, ui, lang, S, role, seats, mySeat, level, net, onFinish }) {
  const { TurnBar, LastLine, Warn, useWarn, GC, TC, FRAME, fmt } = kit;
  const L = LT[lang] || LT.en;
  const COLS = [GC, TC, "#ff7a8a", "#8ab4ff"];
  const [wn, warn, shake] = useWarn();
  const n = seats.length;
  const local = role === "local";
  const cpu = role === "cpu";
  const online = role === "host" || role === "guest";
  const amHost = role === "host";
  const cor = CORNERS[n] || CORNERS[2];
  const G = useRef({ tok: Array.from({ length: n }, () => [-1, -1, -1, -1]), turn: 0, phase: "roll", dice: 0, movable: [], over: false, msg: "", last: null, rollN: 0, hop: null, hn: 0, fx: [], fid: 0 });
  const [, bump] = useState(0);
  const re = () => bump((x) => x + 1);
  const alive = useRef(true);
  const pend = useRef([]);
  const seatsRef = useRef(seats);
  const fn = useRef({});
  const boxRef = useRef(null);
  const boxW = ui.useWidth(boxRef, 360);
  seatsRef.current = seats;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const nap = async (ms) => { await ui.sleep(ms); if (!alive.current) throw ui.STOP; };
  const run = async (f) => { try { await f(); } catch (e) { if (e !== ui.STOP) console.error(e); } };

  const isBot = (s) => !!(seatsRef.current[s] && seatsRef.current[s].bot);
  const iDrive = (s) => isBot(s) && (cpu || amHost); // who plays for a computer seat
  const mine = (s) => local || (s === mySeat && !isBot(s));
  const nameOf = (s) => (seatsRef.current[s] ? seatsRef.current[s].name : "");

  // a short burst on a square (capture, reaching home)
  const addFx = (pos, color) => {
    const g = G.current;
    const id = ++g.fid;
    g.fx = [...g.fx, { id, pos, color }];
    re();
    setTimeout(() => { if (!alive.current) return; G.current.fx = G.current.fx.filter((f) => f.id !== id); re(); }, 950);
  };

  /* ----- the game flow (runs the same on every phone) ----- */
  const endTurn = (extra) => {
    const g = G.current;
    if (!extra) g.turn = (g.turn + 1) % n;
    g.phase = "roll"; g.movable = []; g.msg = "";
    re();
    fn.current.drain();
  };
  const doRoll = (d, fromNet) => run(async () => {
    const g = G.current;
    if (g.phase !== "roll" || g.over) return;
    g.phase = "rolling"; g.dice = d; g.msg = ""; g.rollN += 1; re();
    if (online && !fromNet) net.send({ t: "ld", d });
    await nap(900);
    const who = g.turn;
    const mv = movablesOf(g.tok[who], d);
    g.movable = mv;
    g.last = { who, d, out: false, cap: 0, home: false };
    if (!mv.length) { g.phase = "pass"; g.msg = "nomove"; re(); await nap(1200); endTurn(false); return; }
    if (mv.length === 1) { g.phase = "auto"; re(); await nap(450); await playMove(mv[0]); return; }
    g.phase = "move"; re();
    fn.current.drain();
  });
  const playMove = (i) => run(async () => {
    const g = G.current;
    const who = g.turn, d = g.dice;
    if (g.over) return;
    g.phase = "anim"; g.movable = []; re();
    const from = g.tok[who][i];
    const steps = from === -1 ? 1 : d;
    let p = from;
    for (let k = 0; k < steps; k++) {
      p = p === -1 ? 0 : p + 1;
      const pp = p;
      g.tok = g.tok.map((a, s) => (s === who ? a.map((v, j) => (j === i ? pp : v)) : a));
      g.hop = { s: who, i, n: ++g.hn };
      re();
      await nap(200);
    }
    g.hop = null;
    let cap = 0;
    if (p <= 50) {
      const idx = (STARTS[cor[who]] + p) % 52;
      if (!SAFE.has(idx)) {
        g.tok = g.tok.map((a, s) =>
          s === who ? a : a.map((v) => {
            if (v >= 0 && v <= 50 && (STARTS[cor[s]] + v) % 52 === idx) { cap += 1; return -1; }
            return v;
          }));
      }
      if (cap) addFx(RING[idx], COLS[who]);
    }
    const home = p === 56;
    if (home) addFx([7.5, 7.5], COLS[who]);
    g.last = { who, d, out: from === -1, cap, home };
    re();
    if (cap) await nap(650);
    if (g.tok[who].every((v) => v === 56)) {
      g.over = true; g.phase = "over"; re();
      await nap(1400);
      onFinish(who);
      return;
    }
    endTurn(d === 6 || cap > 0 || home); // a 6, a capture or reaching home gives another roll
  });
  // messages from friends wait here until this phone is ready for them (and only the right sender is accepted)
  fn.current.drain = () => {
    const g = G.current;
    const q = pend.current;
    if (!q.length || g.over || !online) return;
    const seat = seatsRef.current[g.turn];
    if (!seat) return;
    const hostIdv = seatsRef.current[0] && seatsRef.current[0].id;
    const idx = q.findIndex((m) => {
      const fromOk = seat.id === m.from || (seat.bot && m.from === hostIdv);
      return fromOk && ((m.t === "ld" && g.phase === "roll") || (m.t === "lm" && g.phase === "move"));
    });
    if (idx < 0) return;
    const m = q.splice(idx, 1)[0];
    if (m.t === "ld") {
      const d = Math.floor(Number(m.d));
      doRoll(d >= 1 && d <= 6 ? d : 1, true);
    } else if (g.movable.includes(Number(m.i))) playMove(Number(m.i));
  };
  useEffect(() => net.on((m) => {
    if (m.t === "ld" || m.t === "lm") { pend.current.push(m); fn.current.drain(); }
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const g = G.current;
  const rolling = g.phase === "rolling";

  // a computer seat plays by itself (in a game with friends only the host drives it)
  const driving = !g.over && iDrive(g.turn);
  useEffect(() => {
    if (!driving) return undefined;
    let t = 0;
    if (g.phase === "roll") t = setTimeout(() => doRoll(1 + Math.floor(Math.random() * 6), false), 750);
    else if (g.phase === "move") {
      t = setTimeout(() => {
        const gg = G.current;
        if (gg.phase !== "move") return;
        const i = botPick(cpu ? level : "medium", gg.turn, gg.tok, cor, gg.movable, gg.dice);
        if (online) net.send({ t: "lm", i });
        playMove(i);
      }, 850);
    }
    return () => clearTimeout(t);
  }, [g.turn, g.phase, driving]); // eslint-disable-line react-hooks/exhaustive-deps

  const canRoll = !g.over && g.phase === "roll" && mine(g.turn);
  const canPick = g.phase === "move" && mine(g.turn);

  const tapDice = () => {
    if (g.over) return;
    if (g.phase === "roll") {
      if (!mine(g.turn)) { warn(fmt(L.waitRoll, { name: nameOf(g.turn) })); return; }
      doRoll(1 + Math.floor(Math.random() * 6), false);
    } else if (g.phase === "move") warn(canPick ? L.pickToken : fmt(L.waitMove, { name: nameOf(g.turn) }));
  };
  const tapToken = (s, i) => {
    if (g.over) return;
    if (g.phase === "roll") { warn(mine(g.turn) ? L.rollFirst : fmt(L.waitRoll, { name: nameOf(g.turn) })); return; }
    if (g.phase !== "move") return;
    if (!mine(g.turn)) { warn(fmt(L.waitMove, { name: nameOf(g.turn) })); return; }
    if (s !== g.turn) { warn(fmt(L.notYours, { name: nameOf(s) })); return; }
    if (!g.movable.includes(i)) {
      const p = g.tok[s][i];
      warn(p === -1 ? L.needSix : p === 56 ? L.alreadyHome : fmt(L.tooFar, { d: g.dice }));
      return;
    }
    if (online) net.send({ t: "lm", i });
    playMove(i);
  };

  /* ----- drawing ----- */
  const k = online && mySeat >= 0 ? cor[mySeat] : 0; // your own corner is turned to the top-left
  const PADF = 12;
  const size = Math.floor(Math.min(boxW, 440));
  const bd = size - PADF * 2;
  const cell = bd / 15;
  const seatAt = {};
  cor.forEach((c, s) => { seatAt[c] = s; });
  const yard = (c) => (seatAt[c] !== undefined ? `url(#ly${seatAt[c]})` : "url(#lgray)");

  const list = [];
  g.tok.forEach((arr, s) => arr.forEach((p, i) => list.push({ s, i, p, pos: posOf(cor[s], p, i) })));
  const groups = {};
  list.forEach((t) => { t.key = `${t.pos[0].toFixed(2)}-${t.pos[1].toFixed(2)}`; (groups[t.key] = groups[t.key] || []).push(t); });
  list.forEach((t) => {
    const grp = groups[t.key];
    const off = grp.length > 1 ? (grp.indexOf(t) - (grp.length - 1) / 2) * 0.26 : 0;
    const [rr, cc] = rot(t.pos[0], t.pos[1], k);
    t.row = rr; t.col = cc + off; t.shrink = grp.length > 1 ? 0.84 : 1;
  });

  const players = seats.map((s, i) => ({
    name: s.name, color: COLS[i], score: g.tok[i].filter((p) => p === 56).length, you: i === mySeat && !local, sub: s.bot ? "🤖" : undefined,
  }));
  const turnColor = g.over ? GC : COLS[g.turn];
  const shown = g.dice || 1;
  const status = g.over ? ""
    : g.phase === "roll" ? (canRoll ? L.roll : fmt(S.racing, { name: nameOf(g.turn) }))
    : g.phase === "rolling" ? L.rolling
    : g.phase === "move" ? (canPick ? L.pickToken : fmt(S.racing, { name: nameOf(g.turn) }))
    : g.phase === "pass" ? L.noMove : "";
  const lastTxt = g.last
    ? [fmt(L.rolled, { d: g.last.d }), g.msg === "nomove" ? L.nomove : "", g.last.out ? L.out : "", g.last.cap ? L.captured : "", g.last.home ? L.home : ""].filter(Boolean).join(" · ")
    : "";
  const startCorner = { 0: 0, 13: 1, 26: 2, 39: 3 };
  // where each movable token would land: tappable markers
  const ghosts = canPick
    ? g.movable.map((i) => {
        const from = g.tok[g.turn][i];
        const to = from === -1 ? 0 : from + g.dice;
        const [rr, cc] = rot(...posOf(cor[g.turn], to, i), k);
        return { i, row: rr, col: cc };
      })
    : [];
  const cellPct = 100 / 15;

  return (
    <div className="flex w-full flex-col items-center">
      <LudoDefs cols={COLS} />
      <div className="w-full max-w-[440px]">
        <TurnBar players={players} turn={g.over ? -1 : g.turn} S={S} local={local} over={g.over} />
        {g.last ? <LastLine S={S} name={nameOf(g.last.who)} color={COLS[g.last.who]}>{lastTxt}</LastLine> : <div className="min-h-[30px]" />}
        <Warn w={wn} />
      </div>

      <motion.div animate={shake} className="w-full">
        <div ref={boxRef} className="w-full">
          <div className="relative mx-auto" style={{ width: size, perspective: 1300, marginTop: Math.round(cell * 0.4) }}>
            <div style={{ position: "absolute", left: "5%", right: "5%", bottom: -20, height: 40, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(0,0,0,.6), transparent 70%)", filter: "blur(8px)", pointerEvents: "none" }} />
            <motion.div
              initial={{ rotateX: 46, opacity: 0, y: 30 }} animate={{ rotateX: TILT, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 70, damping: 15 }}
              style={{
                ...FRAME, position: "relative", boxSizing: "border-box", width: size, padding: PADF, borderRadius: 22, transformOrigin: "50% 62%", transformStyle: "preserve-3d",
                background: "linear-gradient(145deg,#6a4b2c 0%,#33230f 48%,#563c22 100%)",
                boxShadow: `0 0 0 2px ${turnColor}, 0 0 38px ${turnColor}55, 0 2px 0 #3d2a14, 0 4px 0 #33230f, 0 6px 0 #2a1c0b, 0 8px 0 #211608, 0 10px 0 #181005, 0 26px 44px rgba(0,0,0,.6)`,
                transition: "box-shadow .45s",
              }}
            >
              <div style={{ position: "absolute", inset: PADF - 5, borderRadius: 12, boxShadow: "0 0 0 1px rgba(240,203,98,.6)", pointerEvents: "none" }} />
              <div style={{ position: "relative", width: bd, height: bd, transformStyle: "preserve-3d" }}>
                {/* the flat board */}
                <div style={{ position: "absolute", inset: 0, borderRadius: 8, overflow: "hidden", boxShadow: "inset 0 0 16px rgba(0,0,0,.6)" }}>
                  <svg viewBox="0 0 15 15" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                    <defs>
                      <linearGradient id="lcell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fffaea" /><stop offset="1" stopColor="#dfcf9f" /></linearGradient>
                      <linearGradient id="lgray" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4d4434" /><stop offset="1" stopColor="#2a2419" /></linearGradient>
                      <radialGradient id="lwell" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#070503" /><stop offset=".72" stopColor="#1a130a" /><stop offset="1" stopColor="#40321d" /></radialGradient>
                      <radialGradient id="lgem" cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#fff" /><stop offset=".5" stopColor="#ffe28a" /><stop offset="1" stopColor="#b8862b" /></radialGradient>
                      {COLS.map((c, s) => (
                        <linearGradient key={s} id={`ly${s}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={mix(c, 0.3)} /><stop offset="1" stopColor={mix(c, -0.3)} /></linearGradient>
                      ))}
                    </defs>
                    <rect width="15" height="15" fill="#17110a" />
                    <g transform={k ? `rotate(${-90 * k} 7.5 7.5)` : undefined}>
                      {[0, 1, 2, 3].map((c) => (
                        <g key={`q${c}`}>
                          <rect x={CORNER_XY[c][0] + 0.04} y={CORNER_XY[c][1] + 0.04} width="5.92" height="5.92" rx=".6" fill={yard(c)} stroke="rgba(0,0,0,.45)" strokeWidth=".05" />
                          <rect x={CORNER_XY[c][0] + 0.75} y={CORNER_XY[c][1] + 0.75} width="4.5" height="4.5" rx=".7" fill="#120d07" fillOpacity=".62" stroke="rgba(255,255,255,.18)" strokeWidth=".04" />
                          {BASEP[c].map(([r, cc], i) => (
                            <g key={i}>
                              <circle cx={cc + 0.5} cy={r + 0.5} r=".62" fill="url(#lwell)" stroke={seatAt[c] !== undefined ? mix(COLS[seatAt[c]], 0.1) : "#5a4d38"} strokeWidth=".07" />
                            </g>
                          ))}
                        </g>
                      ))}
                      {RING.map(([r, c], i) => {
                        const sc = startCorner[i];
                        const own = sc !== undefined && seatAt[sc] !== undefined;
                        return (
                          <g key={i}>
                            <rect x={c + 0.05} y={r + 0.05} width=".9" height=".9" rx=".16" fill={own ? `url(#ly${seatAt[sc]})` : "url(#lcell)"} stroke="rgba(70,45,10,.4)" strokeWidth=".03" />
                            {SAFE.has(i) && <text x={c + 0.5} y={r + 0.76} textAnchor="middle" fontSize=".7" fill={own ? "#fff6d0" : "#b8862b"}>★</text>}
                          </g>
                        );
                      })}
                      {[0, 1, 2, 3].map((c) => seatAt[c] !== undefined && LANE[c].map(([r, cc], i) => (
                        <rect key={`l${c}${i}`} x={cc + 0.05} y={r + 0.05} width=".9" height=".9" rx=".16" fill={`url(#ly${seatAt[c]})`} stroke="rgba(0,0,0,.35)" strokeWidth=".03" />
                      )))}
                      {[0, 1, 2, 3].map((c) => <polygon key={`t${c}`} points={TRI[c]} fill={yard(c)} stroke="rgba(0,0,0,.4)" strokeWidth=".05" strokeLinejoin="round" />)}
                      <circle cx="7.5" cy="7.5" r=".46" fill="url(#lgem)" stroke="#8a6a14" strokeWidth=".05" />
                      {!g.over && (
                        <motion.rect
                          key={`act${g.turn}`}
                          x={CORNER_XY[cor[g.turn]][0] + 0.04} y={CORNER_XY[cor[g.turn]][1] + 0.04} width="5.92" height="5.92" rx=".6"
                          fill={COLS[g.turn]} stroke={COLS[g.turn]} strokeWidth=".14"
                          initial={{ fillOpacity: 0.05, strokeOpacity: 0.4 }}
                          animate={{ fillOpacity: [0.05, 0.28, 0.05], strokeOpacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                          style={{ pointerEvents: "none" }}
                        />
                      )}
                    </g>
                  </svg>
                </div>

                {/* the pawns stand upright on the board */}
                <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: "translateZ(1px)" }}>
                  {list.map((t) => {
                    const pick = canPick && t.s === g.turn && g.movable.includes(t.i);
                    const c = COLS[t.s];
                    const fin = t.p === 56;
                    const hop = g.hop && g.hop.s === t.s && g.hop.i === t.i ? g.hop.n : 0;
                    const sc = (fin ? 0.62 : 1) * t.shrink;
                    return (
                      <motion.div
                        key={`${t.s}-${t.i}`} initial={false}
                        animate={{ x: `${t.col * 100}%`, y: `${t.row * 100}%` }}
                        transition={{ x: { type: "spring", stiffness: 330, damping: 28 }, y: { type: "spring", stiffness: 330, damping: 28 } }}
                        onClick={() => tapToken(t.s, t.i)}
                        style={{ position: "absolute", left: 0, top: 0, width: `${cellPct}%`, height: `${cellPct}%`, transformStyle: "preserve-3d", cursor: pick ? "pointer" : "default" }}
                      >
                        <div style={{ position: "absolute", left: "16%", right: "16%", bottom: "6%", height: "28%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(0,0,0,.65), transparent 72%)", pointerEvents: "none", transform: `scale(${sc})` }} />
                        <div style={{ position: "absolute", left: "6%", width: "88%", height: "132%", bottom: "9%", transformOrigin: "50% 100%", transform: `rotateX(${-TILT}deg) scale(${sc})`, pointerEvents: "none" }}>
                          <motion.div
                            animate={pick ? { y: [0, -cell * 0.18, 0] } : hop ? { y: [0, -cell * 0.6 - (hop % 2) * 0.02, 0] } : { y: 0 }}
                            transition={pick ? { repeat: Infinity, duration: 0.9, ease: "easeInOut" } : hop ? { duration: 0.2, ease: "easeOut" } : { duration: 0.2 }}
                            style={{ width: "100%", height: "100%", transformOrigin: "50% 100%", filter: pick ? `drop-shadow(0 0 9px ${c}) drop-shadow(0 0 3px #fff)` : "drop-shadow(0 2px 2px rgba(0,0,0,.5))" }}
                          >
                            <Pawn s={t.s} color={c} />
                          </motion.div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* captures and arrivals */}
                <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: "translateZ(2px)", pointerEvents: "none" }}>
                  {g.fx.map((f) => {
                    const [rr, cc] = rot(f.pos[0], f.pos[1], k);
                    return (
                      <div key={f.id} style={{ position: "absolute", left: `${cc * cellPct}%`, top: `${rr * cellPct}%`, width: `${cellPct}%`, height: `${cellPct}%` }}>
                        <motion.div
                          initial={{ scale: 0.3, opacity: 0.95 }} animate={{ scale: 2.8, opacity: 0 }} transition={{ duration: 0.75, ease: "easeOut" }}
                          style={{ position: "absolute", inset: "8%", borderRadius: "50%", boxShadow: `0 0 0 3px ${f.color}, 0 0 18px ${f.color}` }}
                        />
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((a) => (
                          <motion.i
                            key={a}
                            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                            animate={{ x: Math.cos((a * Math.PI) / 4) * cell * 1.1, y: Math.sin((a * Math.PI) / 4) * cell * 1.1, opacity: 0, scale: 0.3 }}
                            transition={{ duration: 0.75, ease: "easeOut" }}
                            style={{ position: "absolute", left: "42%", top: "42%", width: "16%", height: "16%", borderRadius: "50%", background: f.color, boxShadow: `0 0 8px ${f.color}` }}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* where the glowing tokens can land: tap a marker or the token */}
                <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: "translateZ(3px)" }}>
                  {ghosts.map((m) => (
                    <div
                      key={m.i} onClick={() => tapToken(g.turn, m.i)}
                      style={{ position: "absolute", left: `${m.col * cellPct}%`, top: `${m.row * cellPct}%`, width: `${cellPct}%`, height: `${cellPct}%`, cursor: "pointer" }}
                    >
                      <motion.div
                        animate={{ scale: [0.82, 1.08, 0.82], opacity: [0.65, 1, 0.65] }} transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                        style={{ position: "absolute", inset: "14%", borderRadius: "50%", background: `radial-gradient(circle, ${COLS[g.turn]}55, transparent 70%)`, boxShadow: `inset 0 0 0 2.5px ${COLS[g.turn]}, 0 0 14px ${COLS[g.turn]}` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="mt-7 flex items-center gap-5">
        <Die3D v={shown} n={g.rollN} rolling={rolling} color={turnColor} disabled={!canRoll} onClick={tapDice} />
        <p className="max-w-[210px] text-[13px] font-semibold leading-snug" style={{ color: turnColor }}>{status}</p>
      </div>
    </div>
  );
}