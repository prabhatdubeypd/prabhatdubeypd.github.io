import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, Environment } from "@react-three/drei";
import * as THREE from "three";

const LT = {
  en: {
    roll: "Tap the dice to roll", rolling: "Rolling…", pickToken: "Tap a glowing token to move it", noMove: "No move possible",
    waitRoll: "Wait for {name} to roll", waitMove: "Wait for {name} to move", rollFirst: "Roll the dice first",
    notYours: "That is {name}'s token", needSix: "You need a 6 to leave the base", alreadyHome: "That token is already home",
    tooFar: "That token cannot move {d} steps (you need an exact roll to reach home)",
    rolled: "rolled {d}", out: "left the base", captured: "captured a token!", home: "reached home!", nomove: "no move possible",
    chooseColor: "Choose your color", chooseSub: "Your tokens start in this corner", pickColorFirst: "Choose your color to start",
    names: ["Green", "Yellow", "Blue", "Red"],
  },
  hi: {
    roll: "पासा फेंकने के लिए छुएँ", rolling: "पासा घूम रहा है…", pickToken: "चलाने के लिए चमकती गोटी छुएँ", noMove: "कोई चाल संभव नहीं",
    waitRoll: "{name} के पासा फेंकने का इंतज़ार करें", waitMove: "{name} की चाल का इंतज़ार करें", rollFirst: "पहले पासा फेंकें",
    notYours: "यह {name} की गोटी है", needSix: "बेस से निकलने के लिए 6 चाहिए", alreadyHome: "यह गोटी पहले ही घर पहुँच चुकी है",
    tooFar: "यह गोटी {d} कदम नहीं चल सकती (घर के लिए सटीक अंक चाहिए)",
    rolled: "ने {d} फेंका", out: "गोटी बेस से निकली", captured: "ने गोटी पकड़ी!", home: "गोटी घर पहुँची!", nomove: "कोई चाल संभव नहीं",
    chooseColor: "अपना रंग चुनें", chooseSub: "आपकी गोटियाँ इसी कोने से शुरू होंगी", pickColorFirst: "शुरू करने के लिए रंग चुनें",
    names: ["हरा", "पीला", "नीला", "लाल"],
  },
};

export const HOW = {
  en: [
    "2 to 4 players race 4 tokens each around the board. Tap the dice on your turn.",
    "You need a 6 to bring a token out of the base. A 6, a capture, or reaching home gives you another roll.",
    "Landing on an enemy token sends it back to its base, unless it stands on a star or a start square.",
    "Tap a glowing token (or its landing marker) to move it. Enter your colored lane and reach the center with an exact roll. The first player to bring all 4 tokens home wins. Your own base is always shown at the bottom-left of your screen.",
  ],
  hi: [
    "2 से 4 खिलाड़ी 4-4 गोटियों से बोर्ड का चक्कर लगाते हैं। अपनी बारी पर पासा छुएँ।",
    "बेस से गोटी निकालने के लिए 6 चाहिए। 6, गोटी पकड़ना या घर पहुँचना, इनसे दोबारा पासा मिलता है।",
    "दुश्मन की गोटी पर उतरें तो वह बेस में लौट जाती है, पर तारे या स्टार्ट वाले खाने पर वह सुरक्षित है।",
    "चमकती गोटी (या उसका लैंडिंग निशान) छुएँ और वह चल पड़ेगी। अपनी रंगीन लेन में जाकर सटीक अंक से बीच में पहुँचें। जो पहले चारों गोटियाँ घर पहुँचाए वही जीतता है। आपका अपना बेस हमेशा आपकी स्क्रीन के नीचे-बाएँ दिखता है।",
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
const CORNER_XY = [[0, 0], [9, 0], [9, 9], [0, 9]];
const TRI = ["6,6 6,9 7.5,7.5", "6,6 9,6 7.5,7.5", "9,6 9,9 7.5,7.5", "6,9 9,9 7.5,7.5"];
// the colour of each corner, like Ludo King: green top-left, yellow top-right, blue bottom-right, red bottom-left
const CC = ["#1fa04a", "#f7c600", "#1e9be9", "#e0302c"];
// little arrows pointing into each colour's lane: [row, col, glyph]
const ARROWS = [[7, 0, "→"], [0, 7, "↓"], [7, 14, "←"], [14, 7, "↑"]];
// p = -1 in base, 0..50 on the ring (from your start), 51..55 your lane, 56 home
const posOf = (cr, p, i) => (p < 0 ? BASEP[cr][i] : p <= 50 ? RING[(STARTS[cr] + p) % 52] : p <= 55 ? LANE[cr][p - 51] : FINP[cr][i]);
const rot = (r, c, k) => (k === 0 ? [r, c] : k === 1 ? [14 - c, r] : k === 2 ? [14 - r, 14 - c] : [c, 14 - r]); // k quarter turns counter-clockwise
const movablesOf = (arr, d) => arr.map((p, i) => ((p === -1 && d === 6) || (p >= 0 && p < 56 && p + d <= 56) ? i : -1)).filter((i) => i >= 0);
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
// which corner a seat gets: seat "me" gets the chosen corner, the others follow clockwise (2 players sit opposite)
const cornerOf = (s, base, me, n) => {
  const rel = (s - me + n) % n;
  return (base + (n === 2 ? rel * 2 : rel)) % 4;
};
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


/* ============================================================
   PREMIUM 3D LUDO DICE
============================================================ */

const DICE_FACE_ROTATIONS = {
  1: [0, 0, 0],
  2: [0, -Math.PI / 2, 0],
  3: [Math.PI / 2, 0, 0],
  4: [-Math.PI / 2, 0, 0],
  5: [0, Math.PI / 2, 0],
  6: [0, Math.PI, 0],
};

const DICE_PIPS = {
  1: [[0, 0]],
  2: [[-0.32, 0.32], [0.32, -0.32]],
  3: [[-0.32, 0.32], [0, 0], [0.32, -0.32]],
  4: [[-0.32, 0.32], [0.32, 0.32], [-0.32, -0.32], [0.32, -0.32]],
  5: [[-0.32, 0.32], [0.32, 0.32], [0, 0], [-0.32, -0.32], [0.32, -0.32]],
  6: [[-0.32, 0.35], [0.32, 0.35], [-0.32, 0], [0.32, 0], [-0.32, -0.35], [0.32, -0.35]],
};

/* Individual premium pip */
function DicePip({ position }) {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[0.085, 32, 32]} />
      <meshPhysicalMaterial
        color="#11151d"
        roughness={0.28}
        metalness={0.04}
        clearcoat={0.65}
        clearcoatRoughness={0.18}
      />
    </mesh>
  );
}

/* Individual face */
function DiceFace({ number, position, rotation }) {
  return (
    <group position={position} rotation={rotation}>
      {DICE_PIPS[number].map(([x, y], i) => (
        <DicePip
          key={`${number}-${i}`}
          position={[x, y, 0.012]}
        />
      ))}
    </group>
  );
}

/* Physical dice cube */
function RealDice({ value, rolling }) {
  const ref = useRef(null);
  const elapsed = useRef(0);
  const start = useRef([0, 0, 0]);
  const finished = useRef(true);

  const duration = 0.82;

  useEffect(() => {
    if (!rolling || !ref.current) return;

    elapsed.current = 0;
    finished.current = false;

    start.current = [
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    ];

    ref.current.rotation.set(...start.current);
    ref.current.position.set(0, 0, 0);
    ref.current.scale.set(1, 1, 1);
  }, [rolling, value]);

  useFrame((_, delta) => {
    if (!ref.current || finished.current || !rolling) return;

    elapsed.current += Math.min(delta, 0.05);

    const t = Math.min(elapsed.current / duration, 1);

    // Smooth cubic easing
    const ease = t * t * (3 - 2 * t);

    const target = DICE_FACE_ROTATIONS[value] || DICE_FACE_ROTATIONS[1];

    // Several complete physical rotations, followed by an exact landing
    const turns = [
      Math.PI * 6,
      -Math.PI * 8,
      Math.PI * 4,
    ];

    ref.current.rotation.set(
      start.current[0] + (target[0] + turns[0] - start.current[0]) * ease,
      start.current[1] + (target[1] + turns[1] - start.current[1]) * ease,
      start.current[2] + (target[2] + turns[2] - start.current[2]) * ease
    );

    // Natural jumping and landing
    const bounce = Math.sin(t * Math.PI);
    ref.current.position.y = bounce * 0.36;

    // Very subtle landing compression
    const squash = 1 - bounce * 0.045;
    ref.current.scale.set(squash, 1 + bounce * 0.06, squash);

    if (t >= 1) {
      // Exact final orientation: result faces the player
      ref.current.rotation.set(...target);
      ref.current.position.set(0, 0, 0);
      ref.current.scale.set(1, 1, 1);
      finished.current = true;
    }
  });

  return (
    <group ref={ref}>
      <RoundedBox
        args={[1.65, 1.65, 1.65]}
        radius={0.19}
        smoothness={8}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.22}
          metalness={0.015}
          clearcoat={1}
          clearcoatRoughness={0.08}
          reflectivity={0.85}
        />
      </RoundedBox>

      {/* Front: 1 */}
      <DiceFace number={1} position={[0, 0, 0.831]} rotation={[0, 0, 0]} />

      {/* Back: 6 */}
      <DiceFace number={6} position={[0, 0, -0.831]} rotation={[0, Math.PI, 0]} />

      {/* Right: 2 */}
      <DiceFace number={2} position={[0.831, 0, 0]} rotation={[0, Math.PI / 2, 0]} />

      {/* Left: 5 */}
      <DiceFace number={5} position={[-0.831, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />

      {/* Top: 3 */}
      <DiceFace number={3} position={[0, 0.831, 0]} rotation={[-Math.PI / 2, 0, 0]} />

      {/* Bottom: 4 */}
      <DiceFace number={4} position={[0, -0.831, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

/* 3D lighting and camera */
function DiceScene({ value, rolling }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.2], fov: 30 }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      shadows
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.85} />

      <directionalLight
        position={[3, 5, 5]}
        intensity={3}
        castShadow
      />

      <directionalLight position={[-4, 2, 3]} intensity={1.8} />
      <pointLight position={[0, 4, 2]} intensity={1.5} />
      <pointLight position={[0, -3, 3]} intensity={0.5} />

      <Environment preset="studio" />

      <RealDice value={value} rolling={rolling} />
    </Canvas>
  );
}

/* Premium dice component */
function Die({
  v,
  rolling,
  color,
  onClick,
  disabled,
  size = 76,
}) {
  return (
    <motion.div
      whileTap={!disabled ? { scale: 0.94 } : {}}
      onClick={onClick}
      style={{
        position: "relative",
        width: size + 38,
        height: size + 38,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        cursor: disabled ? "default" : "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Outer glow */}
      <motion.div
        animate={
          rolling
            ? { opacity: [0.35, 0.9, 0.35], scale: [0.92, 1.12, 0.92] }
            : disabled
              ? { opacity: 0.15, scale: 1 }
              : { opacity: [0.35, 0.7, 0.35], scale: [0.96, 1.05, 0.96] }
        }
        transition={{
          duration: rolling ? 0.45 : 1.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          position: "absolute",
          width: size + 16,
          height: size + 16,
          borderRadius: 26,
          border: `2px solid ${color}`,
          boxShadow: `0 0 16px ${color}88, 0 0 36px ${color}55`,
        }}
      />

      {/* Elevated dice pedestal */}
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          zIndex: 2,
          borderRadius: 21,
          background: "linear-gradient(145deg,#233653,#0c1426)",
          border: "1px solid rgba(255,255,255,.22)",
          boxShadow: `
            0 7px 0 #080e19,
            0 12px 22px rgba(0,0,0,.48),
            inset 0 1px 0 rgba(255,255,255,.2),
            0 0 20px ${color}44
          `,
        }}
      >
        <DiceScene value={v} rolling={rolling} />
      </div>

      {/* Rolling indicator */}
      <AnimatePresence>
        {rolling && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            style={{
              position: "absolute",
              bottom: -15,
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 2,
              color: "#fff",
              textShadow: `0 0 8px ${color}`,
              whiteSpace: "nowrap",
            }}
          >
            ROLLING
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


/* ---------------- the token: a map-pin like in Ludo King ---------------- */
function LudoDefs({ cols }) {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        {cols.map((c, s) => (
          <g key={s}>
            <radialGradient id={`lh${s}`} cx=".36" cy=".3" r=".8">
              <stop offset="0" stopColor={mix(c, 0.55)} /><stop offset=".45" stopColor={c} /><stop offset="1" stopColor={mix(c, -0.35)} />
            </radialGradient>
            <linearGradient id={`lb${s}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={mix(c, 0.35)} /><stop offset=".5" stopColor={c} /><stop offset="1" stopColor={mix(c, -0.4)} />
            </linearGradient>
          </g>
        ))}
      </defs>
    </svg>
  );
}
function Pin({ s, color }) {
  const edge = mix(color, -0.65);

  const body =
    "M30 76 C27 66 6 47 6 27 A24 24 0 0 1 54 27 C54 47 33 66 30 76 Z";

  return (
    <svg
      viewBox="0 0 60 80"
      width="100%"
      height="100%"
      style={{
        display: "block",
        overflow: "visible",
        filter: "drop-shadow(0 2px 2px rgba(0,0,0,.38))",
      }}
    >
      {/* deep outer edge */}
      <path
        d={body}
        fill="none"
        stroke="rgba(0,0,0,.45)"
        strokeWidth="8"
        strokeLinejoin="round"
      />

      {/* main body */}
      <path
        d={body}
        fill={`url(#lb${s})`}
        stroke="#ffffff"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />

      {/* inner glossy ring */}
      <circle
        cx="30"
        cy="27"
        r="14"
        fill="rgba(255,255,255,.22)"
        stroke="#ffffff"
        strokeOpacity=".72"
        strokeWidth="1.2"
      />

      {/* center */}
      <circle
        cx="30"
        cy="27"
        r="9"
        fill={`url(#lh${s})`}
      />

      {/* glossy reflection */}
      <ellipse
        cx="25"
        cy="14"
        rx="7"
        ry="3.4"
        fill="#ffffff"
        opacity=".6"
        transform="rotate(-25 25 14)"
      />

      {/* tiny secondary reflection */}
      <circle
        cx="36"
        cy="33"
        r="2.2"
        fill="#ffffff"
        opacity=".18"
      />
    </svg>
  );
}

/* seats: [{ id?, name, bot? }]  (2 to 4).  mySeat: your index online / vs computer, -1 on one phone */
export default function LudoGame({ kit, ui, lang, S, role, seats, mySeat, level, net, onFinish }) {
  const { TurnBar, LastLine, Warn, useWarn, GC, fmt } = kit;
  const L = LT[lang] || LT.en;
  const [wn, warn, shake] = useWarn();
  const n = seats.length;
  const local = role === "local";
  const cpu = role === "cpu";
  const online = role === "host" || role === "guest";
  const amHost = role === "host";

  // colour: vs computer and on one phone you choose it; online it follows the seat order (everyone must agree)
  const [base, setBase] = useState(local || cpu ? null : 3);
  const ready = base !== null;
  const me = cpu ? Math.max(0, mySeat) : 0;
  const cor = Array.from({ length: n }, (_, s) => cornerOf(s, ready ? base : 3, me, n));
  const COLS = cor.map((c) => CC[c]);

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
    await nap(1000);
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
  const driving = ready && !g.over && iDrive(g.turn);
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

  const canRoll = ready && !g.over && g.phase === "roll" && mine(g.turn);
  const canPick = ready && g.phase === "move" && mine(g.turn);

  const tapDice = () => {
    if (g.over) return;
    if (!ready) { warn(L.pickColorFirst); return; }
    if (g.phase === "roll") {
      if (!mine(g.turn)) { warn(fmt(L.waitRoll, { name: nameOf(g.turn) })); return; }
      doRoll(1 + Math.floor(Math.random() * 6), false);
    } else if (g.phase === "move") warn(canPick ? L.pickToken : fmt(L.waitMove, { name: nameOf(g.turn) }));
  };
  const tapToken = (s, i) => {
    if (g.over || !ready) return;
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
  const viewSeat = online ? Math.max(0, mySeat) : cpu ? me : 0;
  const k = (cor[viewSeat] + 1) % 4; // turns the board so YOUR corner is at the bottom-left
  const PADF = 8;
  const size = Math.floor(Math.min(boxW, 440));
  const bd = size - PADF * 2;
  const cell = bd / 15;
  const seatAt = {};
  cor.forEach((c, s) => { seatAt[c] = s; });
  const cellPct = 100 / 15;

  const list = [];
  g.tok.forEach((arr, s) => arr.forEach((p, i) => list.push({ s, i, p, pos: posOf(cor[s], p, i) })));
  const groups = {};
  list.forEach((t) => { t.key = `${t.pos[0].toFixed(2)}-${t.pos[1].toFixed(2)}`; (groups[t.key] = groups[t.key] || []).push(t); });
  list.forEach((t) => {
    const grp = groups[t.key];
    const off = grp.length > 1 ? (grp.indexOf(t) - (grp.length - 1) / 2) * 0.28 : 0;
    const [rr, cc] = rot(t.pos[0], t.pos[1], k);
    t.row = rr; t.col = cc + off; t.shrink = grp.length > 1 ? 0.82 : 1;
  });
  list.sort((a, b) => a.row - b.row);

  const players = seats.map((s, i) => ({
    name: s.name, color: COLS[i], score: g.tok[i].filter((p) => p === 56).length, you: i === mySeat && !local, sub: s.bot ? "🤖" : undefined,
  }));
  const turnColor = g.over ? GC : COLS[g.turn];
  const shown = g.dice || 1;
  const status = !ready ? L.pickColorFirst
    : g.over ? ""
    : g.phase === "roll" ? (canRoll ? L.roll : fmt(S.racing, { name: nameOf(g.turn) }))
    : g.phase === "rolling" ? L.rolling
    : g.phase === "move" ? (canPick ? L.pickToken : fmt(S.racing, { name: nameOf(g.turn) }))
    : g.phase === "pass" ? L.noMove : "";
  const lastTxt = g.last
    ? [fmt(L.rolled, { d: g.last.d }), g.msg === "nomove" ? L.nomove : "", g.last.out ? L.out : "", g.last.cap ? L.captured : "", g.last.home ? L.home : ""].filter(Boolean).join(" · ")
    : "";
  const startCorner = { 0: 0, 13: 1, 26: 2, 39: 3 };
  // where each movable token would land: tappable markers (tap the token or its marker)
  const ghosts = canPick
    ? g.movable.map((i) => {
        const from = g.tok[g.turn][i];
        const to = from === -1 ? 0 : from + g.dice;
        const [rr, cc] = rot(...posOf(cor[g.turn], to, i), k);
        return { i, row: rr, col: cc, home: to === 56 };
      })
    : [];

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
          <div className="relative mx-auto" style={{ width: size, height: size, marginTop: 6 }}>
            <div
              style={{
  position: "absolute",
  inset: 0,
  boxSizing: "border-box",
  padding: PADF,
  borderRadius: 20,

  background: `
    linear-gradient(
      145deg,
      #243f72 0%,
      #101b35 42%,
      #07101f 100%
    )
  `,

  border: "1px solid rgba(255,255,255,.16)",

  boxShadow: `
    0 0 0 1px rgba(255,255,255,.08),
    0 0 0 2px ${turnColor}66,
    0 0 32px ${turnColor}44,
    0 16px 38px rgba(0,0,0,.58),
    inset 0 1px 0 rgba(255,255,255,.18)
  `,

  transition: "box-shadow .45s ease",
}}
            >
              <div style={{
  position: "relative",
  width: bd,
  height: bd,
  borderRadius: 10,
  overflow: "hidden",
  background:
    "linear-gradient(145deg,#ffffff,#e9ecf1)",
  boxShadow: `
    inset 0 0 0 1px rgba(255,255,255,.9),
    inset 0 0 18px rgba(0,0,0,.08),
    0 2px 8px rgba(0,0,0,.28)
  `,
}}>
                {/* the flat board */}
                <svg
  viewBox="0 0 15 15"
  style={{
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  }}
>
  <defs>

    {/* premium board background */}
    <linearGradient id="boardWhite" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#ffffff" />
      <stop offset="55%" stopColor="#f7f8fa" />
      <stop offset="100%" stopColor="#e7e9ed" />
    </linearGradient>

    {/* colored yard gradients */}
    {[0, 1, 2, 3].map((c) => (
      <linearGradient
        key={`yardGrad${c}`}
        id={`yardGrad${c}`}
        x1="0"
        y1="0"
        x2="1"
        y2="1"
      >
        <stop offset="0%" stopColor={mix(CC[c], 0.22)} />
        <stop offset="45%" stopColor={CC[c]} />
        <stop offset="100%" stopColor={mix(CC[c], -0.22)} />
      </linearGradient>
    ))}

    {/* lane gradients */}
    {[0, 1, 2, 3].map((c) => (
      <linearGradient
        key={`laneGrad${c}`}
        id={`laneGrad${c}`}
        x1="0"
        y1="0"
        x2="1"
        y2="1"
      >
        <stop offset="0%" stopColor={mix(CC[c], 0.18)} />
        <stop offset="100%" stopColor={mix(CC[c], -0.15)} />
      </linearGradient>
    ))}

    {/* tile shadow */}
    <filter
      id="tileShadow"
      x="-30%"
      y="-30%"
      width="160%"
      height="160%"
    >
      <feDropShadow
        dx="0"
        dy=".045"
        stdDeviation=".055"
        floodColor="#000000"
        floodOpacity=".22"
      />
    </filter>

    {/* yard shadow */}
    <filter
      id="yardShadow"
      x="-20%"
      y="-20%"
      width="140%"
      height="140%"
    >
      <feDropShadow
        dx="0"
        dy=".08"
        stdDeviation=".08"
        floodColor="#000000"
        floodOpacity=".28"
      />
    </filter>

    {/* subtle inner shine */}
    <linearGradient id="glassShine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ffffff" stopOpacity=".42" />
      <stop offset="35%" stopColor="#ffffff" stopOpacity=".08" />
      <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
    </linearGradient>

  </defs>

  <rect
    width="15"
    height="15"
    rx=".35"
    fill="url(#boardWhite)"
  />

  <g transform={k ? `rotate(${-90 * k} 7.5 7.5)` : undefined}>

    {/* =========================
        FOUR PREMIUM YARDS
       ========================= */}

    {[0, 1, 2, 3].map((c) => (
      <g key={`q${c}`}>

        {/* main colored area */}
        <rect
          x={CORNER_XY[c][0]}
          y={CORNER_XY[c][1]}
          width="6"
          height="6"
          fill={`url(#yardGrad${c})`}
        />

        {/* inner white home panel */}
        <rect
          x={CORNER_XY[c][0] + 0.72}
          y={CORNER_XY[c][1] + 0.72}
          width="4.56"
          height="4.56"
          rx=".5"
          fill="rgba(255,255,255,.96)"
          stroke="rgba(255,255,255,.9)"
          strokeWidth=".06"
          filter="url(#yardShadow)"
        />

        {/* glass highlight */}
        <rect
          x={CORNER_XY[c][0] + 0.82}
          y={CORNER_XY[c][1] + 0.82}
          width="4.36"
          height="1.2"
          rx=".3"
          fill="url(#glassShine)"
          pointerEvents="none"
        />

        {/* token bases */}
        {BASEP[c].map(([r, cc], i) => (
          <g key={i}>
            {/* outer ring */}
            <circle
              cx={cc + 0.5}
              cy={r + 0.5}
              r=".72"
              fill={mix(CC[c], -0.12)}
              opacity=".95"
            />

            {/* inner glossy base */}
            <circle
              cx={cc + 0.5}
              cy={r + 0.5}
              r=".62"
              fill={`url(#yardGrad${c})`}
              stroke="#ffffff"
              strokeOpacity=".55"
              strokeWidth=".055"
            />

            {/* base shine */}
            <ellipse
              cx={cc + 0.32}
              cy={r + 0.27}
              rx=".23"
              ry=".12"
              fill="#ffffff"
              opacity=".32"
              transform={`rotate(-25 ${cc + 0.32} ${r + 0.27})`}
            />
          </g>
        ))}
      </g>
    ))}

    {/* =========================
        OUTER RING
       ========================= */}

    {RING.map(([r, c], i) => {
      const sc = startCorner[i];
      const bg = sc !== undefined ? CC[sc] : "#ffffff";

      return (
        <g key={i}>

          <rect
            x={c}
            y={r}
            width="1"
            height="1"
            fill={
              sc !== undefined
                ? `url(#yardGrad${sc})`
                : "url(#boardWhite)"
            }
            stroke="rgba(30,35,45,.28)"
            strokeWidth=".035"
            filter="url(#tileShadow)"
          />

          {/* subtle tile highlight */}
          <path
            d={`M ${c + .06} ${r + .08} H ${c + .94}`}
            stroke="#ffffff"
            strokeOpacity=".48"
            strokeWidth=".035"
          />

          {SAFE.has(i) && (
            <text
              x={c + 0.5}
              y={r + 0.74}
              textAnchor="middle"
              fontSize=".72"
              fontWeight="700"
              fill={sc !== undefined ? "#fff" : "#8b929c"}
              opacity=".95"
              transform={
                k
                  ? `rotate(${90 * k} ${c + 0.5} ${r + 0.5})`
                  : undefined
              }
            >
              ★
            </text>
          )}
        </g>
      );
    })}

    {/* =========================
        HOME LANES
       ========================= */}

    {[0, 1, 2, 3].map((c) =>
      LANE[c].map(([r, cc], i) => (
        <g key={`l${c}${i}`}>
          <rect
            x={cc}
            y={r}
            width="1"
            height="1"
            fill={`url(#laneGrad${c})`}
            stroke="rgba(30,35,45,.28)"
            strokeWidth=".035"
            filter="url(#tileShadow)"
          />

          <path
            d={`M ${cc + .08} ${r + .08} H ${cc + .92}`}
            stroke="#ffffff"
            strokeOpacity=".38"
            strokeWidth=".035"
          />
        </g>
      ))
    )}

    {/* =========================
        DIRECTION ARROWS
       ========================= */}

    {ARROWS.map(([r, c, ch], i) => (
      <text
        key={`a${i}`}
        x={c + 0.5}
        y={r + 0.74}
        textAnchor="middle"
        fontSize=".7"
        fontWeight="800"
        fill={CC[i]}
        opacity=".95"
        transform={
          k
            ? `rotate(${90 * k} ${c + 0.5} ${r + 0.5})`
            : undefined
        }
      >
        {ch}
      </text>
    ))}

    {/* =========================
        PREMIUM CENTER
       ========================= */}

    {[0, 1, 2, 3].map((c) => (
      <polygon
        key={`t${c}`}
        points={TRI[c]}
        fill={`url(#laneGrad${c})`}
        stroke="rgba(255,255,255,.7)"
        strokeWidth=".055"
        strokeLinejoin="round"
        filter="url(#tileShadow)"
      />
    ))}

    {/* center highlight */}
    <circle
      cx="7.5"
      cy="7.5"
      r=".13"
      fill="#ffffff"
      opacity=".7"
    />

    {/* =========================
        ACTIVE PLAYER GLOW
       ========================= */}

    {ready && !g.over && (
      <motion.rect
        key={`act${g.turn}`}
        x={CORNER_XY[cor[g.turn]][0] + 0.9}
        y={CORNER_XY[cor[g.turn]][1] + 0.9}
        width="4.2"
        height="4.2"
        rx=".5"
        fill="#fff"
        stroke={COLS[g.turn]}
        strokeWidth=".12"
        initial={{
          fillOpacity: 0,
          strokeOpacity: 0.25,
        }}
        animate={{
          fillOpacity: [0, 0.16, 0],
          strokeOpacity: [0.3, 1, 0.3],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: "easeInOut",
        }}
        style={{
          pointerEvents: "none",
        }}
      />
    )}

  </g>
</svg>

                {/* where the glowing tokens can land: tap the marker or the token */}
                <div style={{ position: "absolute", inset: 0 }}>
                  {ghosts.map((m) => (
                    <div
                      key={m.i} onClick={() => tapToken(g.turn, m.i)}
                      style={{ position: "absolute", left: `${m.col * cellPct}%`, top: `${m.row * cellPct}%`, width: `${cellPct}%`, height: `${cellPct}%`, cursor: "pointer", zIndex: 4 }}
                    >
                      <motion.div
                        animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                        style={{ position: "absolute", inset: "10%", borderRadius: "50%", background: `${COLS[g.turn]}66`, boxShadow: `inset 0 0 0 3px ${COLS[g.turn]}, 0 0 12px ${COLS[g.turn]}, 0 0 0 1.5px #fff` }}
                      />
                    </div>
                  ))}
                </div>

                {/* the tokens */}
                <div style={{ position: "absolute", inset: 0 }}>
                  {list.map((t) => {
                    const pick = canPick && t.s === g.turn && g.movable.includes(t.i);
                    const c = COLS[t.s];
                    const fin = t.p === 56;
                    const hop = g.hop && g.hop.s === t.s && g.hop.i === t.i ? g.hop.n : 0;
                    const sc = (fin ? 0.7 : 1) * t.shrink;
                    return (
                      <motion.div
                        key={`${t.s}-${t.i}`} initial={false}
                        animate={{ x: `${t.col * 100}%`, y: `${t.row * 100}%` }}
                        transition={{ x: { type: "spring", stiffness: 340, damping: 30 }, y: { type: "spring", stiffness: 340, damping: 30 } }}
                        onClick={() => tapToken(t.s, t.i)}
                        style={{ position: "absolute", left: 0, top: 0, width: `${cellPct}%`, height: `${cellPct}%`, cursor: pick ? "pointer" : "default", zIndex: pick ? 6 : hop ? 7 : 3 }}
                      >
                        <div style={{ position: "absolute", left: "14%", right: "14%", bottom: "6%", height: "22%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(0,0,0,.5), transparent 72%)", transform: `scale(${sc})`, pointerEvents: "none" }} />
                        <div style={{ position: "absolute", left: "8%", width: "84%", height: "118%", bottom: "12%", transformOrigin: "50% 100%", transform: `scale(${sc})` }}>
                          <motion.div
                            animate={pick ? { y: [0, -cell * 0.16, 0] } : hop ? { y: [0, -cell * 0.5 - (hop % 2) * 0.02, 0] } : { y: 0 }}
                            transition={pick ? { repeat: Infinity, duration: 0.85, ease: "easeInOut" } : hop ? { duration: 0.2, ease: "easeOut" } : { duration: 0.2 }}
                            style={{ width: "100%", height: "100%", transformOrigin: "50% 100%", filter: pick ? `drop-shadow(0 0 7px ${c}) drop-shadow(0 0 2px #fff)` : "drop-shadow(0 1px 1.5px rgba(0,0,0,.5))" }}
                          >
                            <Pin s={t.s} color={c} />
                          </motion.div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* captures and arrivals */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 8 }}>
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
              </div>
            </div>

            {/* choose your colour */}
            <AnimatePresence>
              {!ready && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 grid place-items-center" style={{ background: "rgba(8,14,34,.82)", borderRadius: 14 }}
                >
                  <motion.div
                    initial={{ scale: 0.88, y: 12 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 18 }}
                    className="rounded-2xl p-4 text-center" style={kit.PANEL}
                  >
                    <p className="text-[15px] font-bold">{L.chooseColor}</p>
                    <p className="mt-0.5 text-[11px] opacity-75">{L.chooseSub}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {[3, 0, 1, 2].map((c) => (
                        <motion.button
                          key={c} type="button" onClick={() => setBase(c)} whileHover={{ y: -3, scale: 1.04 }} whileTap={{ scale: 0.94 }}
                          className="flex items-center gap-2 rounded-xl px-3 py-2"
                          style={{ background: "rgba(255,255,255,.08)", boxShadow: `inset 0 0 0 2px ${CC[c]}` }}
                        >
                          <span style={{ width: 28, height: 36, display: "block" }}><Pin s={c} color={CC[c]} /></span>
                          <span className="text-[13px] font-semibold">{L.names[c]}</span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

     
{/* PREMIUM PLAYER + DICE CONTROL PANEL */}
<div
  className="mt-7 w-full max-w-[440px] rounded-[24px] p-[1px]"
  style={{
    background: `linear-gradient(135deg,${turnColor},#f4d477,#ffffff22,${turnColor})`,
    boxShadow: `0 12px 35px rgba(0,0,0,.38), 0 0 22px ${turnColor}22`,
  }}
>
  <div
    className="relative flex items-center justify-between gap-2 overflow-hidden rounded-[23px] px-3 py-4"
    style={{
      background: "linear-gradient(145deg,#183b72 0%,#102953 48%,#091a37 100%)",
    }}
  >
    {/* Background shine */}
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background: "linear-gradient(115deg,rgba(255,255,255,.09),transparent 40%,rgba(255,255,255,.025))",
      }}
    />

    {/* PLAYER INFORMATION */}
    <div className="relative flex min-w-0 flex-1 items-center gap-2">
      {ready && (
        <>
          <div
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(145deg,#ffffff20,#ffffff08)",
              border: `1px solid ${turnColor}99`,
              boxShadow: `0 0 15px ${turnColor}33`,
            }}
          >
            <div className="h-8 w-6">
              <Pin
                s={g.over ? 0 : g.turn}
                color={g.over ? COLS[0] : COLS[g.turn]}
              />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p
                className="truncate text-[13px] font-black text-white"
              >
                {g.over ? "GAME OVER" : nameOf(g.turn)}
              </p>

              {!local && mine(g.turn) && (
                <span
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-black tracking-wider"
                  style={{
                    background: "#f5cf70",
                    color: "#182744",
                  }}
                >
                  YOU
                </span>
              )}
            </div>

            <div
              className="mt-1 flex items-center gap-1.5 text-[9px] font-bold tracking-[1.2px]"
              style={{ color: "#f4d477" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: turnColor,
                  boxShadow: `0 0 8px ${turnColor}`,
                }}
              />
              {local
                ? "PLAYER TURN"
                : mine(g.turn)
                  ? "YOUR TURN"
                  : "OPPONENT TURN"}
            </div>

            <p className="mt-1 truncate text-[10px] text-blue-100/65">
              {g.over ? "Congratulations!" : rolling ? "Dice is rolling..." : status}
            </p>
          </div>
        </>
      )}
    </div>

    {/* CENTER DICE */}
    <div
      className="relative flex shrink-0 flex-col items-center justify-center"
      style={{ minWidth: 106 }}
    >
      <div
        className="mb-1 text-[9px] font-black tracking-[2px]"
        style={{ color: "#f5d783" }}
      >
        {rolling ? "ROLLING" : "YOUR DICE"}
      </div>

      <Die
        v={shown}
        rolling={rolling}
        color={turnColor}
        disabled={!canRoll}
        onClick={tapDice}
        size={70}
      />

      <p
        className="mt-2 text-[9px] font-semibold"
        style={{ color: "#ffffff99" }}
      >
        {rolling ? "Good luck!" : canRoll ? "TAP TO ROLL" : "LUDO"}
      </p>
    </div>

    {/* RIGHT SIDE: DICE RESULT */}
    <div className="relative flex min-w-0 flex-1 flex-col items-end">
      <div
        className="rounded-xl px-3 py-2 text-center"
        style={{
          background: "rgba(255,255,255,.07)",
          border: "1px solid rgba(255,255,255,.12)",
        }}
      >
        <p className="text-[8px] font-bold tracking-widest text-blue-100/70">
          LAST ROLL
        </p>

        <p
          className="mt-1 text-2xl font-black"
          style={{
            color: "#ffdf85",
            textShadow: "0 0 12px rgba(255,205,90,.3)",
          }}
        >
          {g.dice || "—"}
        </p>
      </div>

      <p className="mt-2 text-right text-[9px] font-semibold text-blue-100/70">
        {g.phase === "move"
          ? "Move your token"
          : g.phase === "rolling"
            ? "Rolling..."
            : g.phase === "pass"
              ? "No move"
              : "Ready"}
      </p>
    </div>
  </div>
</div>
</div>
  );
}