import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { supabase } from "../lib/supabase";
import { tx } from "../lib/i18n";
import { CW, CH, frontToDataUrl } from "./KingCard";

const GOLD = "linear-gradient(180deg,#fff3bf 0%,#f0cb62 30%,#b8862b 58%,#f6dc8c 80%,#c9972f 100%)";
const goldText = { backgroundImage: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
const SPADE =
  "M50 4 C50 4 96 42 96 70 C96 88 80 98 66 90 C62 88 58 84 56 80 C57 96 62 106 72 116 L28 116 C38 106 43 96 44 80 C42 84 38 88 34 90 C20 98 4 88 4 70 C4 42 50 4 50 4 Z";
const LEVELS = ["easy", "medium", "hard"];
const STOP = new Error("stop");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v, d, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const chipStyle = { boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5)", background: "rgba(20,14,6,.55)" };

/* ---------- texts (English + Hindi) ---------- */
const TXT = {
  en: {
    brand: "Utility card · Game", hubTitle: "Win the King", hubSub: "Beat any game to unlock my card",
    chooseLevel: "Choose a level", easy: "Easy", medium: "Medium", hard: "Hard", back: "Back",
    moves: "Moves", time: "Time", peek: "Hold to peek", reshuffle: "Shuffle again", memorize: "Memorize the King…", yourMove: "Slide the pieces",
    round: "Round", remember: "Remember the King", watch: "Watch closely…", where: "Where is the King?",
    spades: "Find the King of Spades ♠", correct: "Correct!", faster: "Faster next round…", wrong: "Not this one",
    tryAgain: "Try again", changeLevel: "Change level",
    hit: "Hit", stand: "Stand", dealer: "Dealer", you: "You", dealAgain: "Deal again",
    youWin: "You win!", dealerBust: "Dealer busts!", dealerWins: "Dealer wins", bust: "You bust!", push: "Push: it's a tie",
    won: "You won!", wonSub: "The King is yours", openCard: "Open the card",
    gridWord: "grid", cardsWord: "cards", slow: "slow", fast: "fast", veryFast: "very fast", decoy: "decoy King",
    dealerCareless: "Careless dealer", dealerNormal: "Normal dealer", dealerSmart: "Smart dealer",
  },
  hi: {
    brand: "यूटिलिटी कार्ड · गेम", hubTitle: "किंग जीतो", hubSub: "कोई भी गेम जीतकर मेरा कार्ड खोलें",
    chooseLevel: "लेवल चुनें", easy: "आसान", medium: "मध्यम", hard: "कठिन", back: "वापस",
    moves: "चालें", time: "समय", peek: "देखने के लिए दबाए रखें", reshuffle: "फिर से मिलाएँ", memorize: "किंग को याद करें…", yourMove: "टुकड़े सरकाएँ",
    round: "राउंड", remember: "किंग को याद रखें", watch: "ध्यान से देखें…", where: "किंग कहाँ है?",
    spades: "हुकुम का किंग ढूँढें ♠", correct: "सही!", faster: "अगला राउंड तेज़ होगा…", wrong: "यह नहीं",
    tryAgain: "फिर कोशिश करें", changeLevel: "लेवल बदलें",
    hit: "कार्ड लें", stand: "रुकें", dealer: "डीलर", you: "आप", dealAgain: "फिर बाँटें",
    youWin: "आप जीते!", dealerBust: "डीलर बस्ट!", dealerWins: "डीलर जीता", bust: "आप बस्ट!", push: "बराबरी",
    won: "आप जीत गए!", wonSub: "किंग अब आपका है", openCard: "कार्ड खोलें",
    gridWord: "ग्रिड", cardsWord: "कार्ड", slow: "धीमा", fast: "तेज़", veryFast: "बहुत तेज़", decoy: "नकली किंग",
    dealerCareless: "लापरवाह डीलर", dealerNormal: "सामान्य डीलर", dealerSmart: "चतुर डीलर",
  },
};

/* ---------- defaults (Supabase table `games` overrides these) ---------- */
const DEFAULTS = {
  puzzle: {
    enabled: true, sort: 1,
    title: { en: "Sliding Puzzle", hi: "स्लाइडिंग पज़ल" },
    desc: { en: "Slide the pieces to rebuild the King.", hi: "टुकड़े सरकाकर किंग को पूरा करें।" },
    levels: { easy: { cols: 3, rows: 3, shuffle: 40 }, medium: { cols: 3, rows: 4, shuffle: 80 }, hard: { cols: 4, rows: 5, shuffle: 140 } },
  },
  find: {
    enabled: true, sort: 2,
    title: { en: "Find the King", hi: "किंग को ढूँढो" },
    desc: { en: "Follow the King through the shuffle.", hi: "शफ़ल में किंग पर नज़र रखें।" },
    levels: {
      easy: { cards: 3, swapMs: 560, swaps: 6, speedUp: 0.8, rounds: 3, revealMs: 1600 },
      medium: { cards: 4, swapMs: 400, swaps: 8, speedUp: 0.8, rounds: 3, revealMs: 1500 },
      hard: { cards: 5, swapMs: 280, swaps: 11, speedUp: 0.8, rounds: 3, revealMs: 1400, decoy: true },
    },
  },
  blackjack: {
    enabled: true, sort: 3,
    title: { en: "Beat the Dealer to 21", hi: "21 में डीलर को हराओ" },
    desc: { en: "Get closer to 21 than the dealer without going over.", hi: "बिना 21 पार किए डीलर से 21 के करीब पहुँचें।" },
    levels: { easy: { dealer: "careless" }, medium: { dealer: "normal" }, hard: { dealer: "smart" } },
  },
};

function mergeCfg(rows) {
  const out = JSON.parse(JSON.stringify(DEFAULTS));
  (rows || []).forEach((r) => {
    const d = out[r.key];
    if (!d) return;
    d.enabled = r.enabled !== false;
    if (r.sort != null) d.sort = r.sort;
    if (r.title_en) d.title = { en: r.title_en, hi: r.title_hi || r.title_en };
    if (r.desc_en) d.desc = { en: r.desc_en, hi: r.desc_hi || r.desc_en };
    const lv = r.levels && typeof r.levels === "object" ? r.levels : {};
    LEVELS.forEach((k) => { if (lv[k]) d.levels[k] = { ...d.levels[k], ...lv[k] }; });
  });
  return out;
}

function levelInfo(game, lv, T) {
  if (game === "puzzle") return `${num(lv.cols, 3, 2, 6)} × ${num(lv.rows, 3, 2, 6)} ${T.gridWord}`;
  if (game === "find") {
    const ms = num(lv.swapMs, 500, 120, 1500);
    const sp = ms >= 480 ? T.slow : ms >= 330 ? T.fast : T.veryFast;
    return `${num(lv.cards, 3, 3, 6)} ${T.cardsWord} · ${sp}${lv.decoy ? " · " + T.decoy : ""}`;
  }
  return { careless: T.dealerCareless, normal: T.dealerNormal, smart: T.dealerSmart }[lv.dealer] || T.dealerNormal;
}

const CSS = `
@keyframes kg-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes kg-sheen{0%{transform:translateX(-130%) skewX(-18deg)}60%,100%{transform:translateX(330%) skewX(-18deg)}}
@keyframes kg-dust{0%{transform:translateY(0) scale(.6);opacity:0}20%{opacity:.8}100%{transform:translateY(-150px) scale(1);opacity:0}}
.kg-float{animation:kg-float 5s ease-in-out infinite}
.kg-sheen{animation:kg-sheen 5.5s ease-in-out infinite}
.kg-dust{animation:kg-dust 8s ease-in infinite}
@media (prefers-reduced-motion: reduce){.kg-float,.kg-sheen,.kg-dust{animation:none}}
`;
const DUST = Array.from({ length: 16 }, () => ({
  left: 4 + Math.random() * 92, bottom: Math.random() * 40, size: 1.5 + Math.random() * 2.5,
  delay: -Math.random() * 8, dur: 6 + Math.random() * 5,
}));

function useWidth(ref, def = 320) {
  const [w, setW] = useState(def);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || def));
    ro.observe(el);
    setW(el.clientWidth || def);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return w;
}

/* =====================  CARD PIECES  ===================== */
function CardBack({ r = 10 }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0, borderRadius: r, overflow: "hidden",
        background: "radial-gradient(120% 90% at 28% 8%, #302a20 0%, #15120e 52%, #060504 100%)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08), 0 8px 18px rgba(0,0,0,.5)",
      }}
    >
      <div
        style={{
          position: "absolute", inset: 0,
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(240,203,98,.13) 0 1px, transparent 1px 8px), repeating-linear-gradient(-45deg, rgba(240,203,98,.13) 0 1px, transparent 1px 8px)",
        }}
      />
      <div
        style={{
          position: "absolute", inset: "6%", borderRadius: r * 0.7,
          boxShadow: "inset 0 0 0 1.3px rgba(240,203,98,.8), inset 0 0 0 4px rgba(10,8,5,.9), inset 0 0 0 5px rgba(240,203,98,.35)",
        }}
      />
      <svg viewBox="0 0 100 120" style={{ position: "absolute", left: "50%", top: "50%", width: "34%", transform: "translate(-50%,-50%)", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.6))" }}>
        <path d={SPADE} fill="url(#kg-g)" />
      </svg>
    </div>
  );
}

function PlayingFace({ rank, suit, w }) {
  const red = suit === "♥" || suit === "♦";
  const col = red ? "#b3262e" : "#1b1919";
  const f = w * 0.26;
  const corner = (flip) => (
    <div
      style={{
        position: "absolute", [flip ? "right" : "left"]: w * 0.07, [flip ? "bottom" : "top"]: w * 0.05,
        transform: flip ? "rotate(180deg)" : undefined, textAlign: "center", lineHeight: 1,
        color: col, fontFamily: "Georgia, serif", fontWeight: 700,
      }}
    >
      <div style={{ fontSize: f }}>{rank}</div>
      <div style={{ fontSize: f * 0.85, marginTop: 1 }}>{suit}</div>
    </div>
  );
  return (
    <div
      style={{
        position: "absolute", inset: 0, borderRadius: w * 0.09, overflow: "hidden",
        background: "linear-gradient(150deg,#fffdf6,#efe5cd)",
        boxShadow: "inset 0 0 0 1px rgba(184,134,43,.55), 0 8px 18px rgba(0,0,0,.4)",
      }}
    >
      {corner(false)}
      {corner(true)}
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: col, fontSize: w * 0.62, lineHeight: 1, opacity: 0.92 }}>{suit}</div>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,0) 40%)" }} />
    </div>
  );
}

function KingFace({ art, w }) {
  if (!art) return <PlayingFace rank="K" suit="♠" w={w} />;
  return <img src={art} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: w * 0.09 }} />;
}

// a card that flips in 3D (starts face down, springs over when `up` becomes true)
function Flip({ up, w, h, front, r = 10, delay = 0 }) {
  const face = { position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", borderRadius: r };
  return (
    <div style={{ width: w, height: h, perspective: 900 }}>
      <motion.div
        style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d" }}
        initial={{ rotateY: 180 }}
        animate={{ rotateY: up ? 0 : 180 }}
        transition={{ type: "spring", stiffness: 110, damping: 15, delay }}
      >
        <div style={face}>{front}</div>
        <div style={{ ...face, transform: "rotateY(180deg)" }}><CardBack r={r} /></div>
      </motion.div>
    </div>
  );
}

const Dots = ({ n }) => (
  <span className="flex gap-1.5">
    {[0, 1, 2].map((i) => (
      <i key={i} style={{ width: 8, height: 8, transform: "rotate(45deg)", background: i < n ? GOLD : "rgba(240,203,98,.2)" }} />
    ))}
  </span>
);

const Pill = ({ children, onClick, gold, disabled }) => (
  <motion.button
    type="button" onClick={onClick} disabled={disabled}
    whileHover={disabled ? undefined : { scale: 1.05 }} whileTap={disabled ? undefined : { scale: 0.96 }}
    className="rounded-full px-5 py-2.5 text-[12px] font-semibold"
    style={gold ? { background: GOLD, color: "#3b2506", boxShadow: "0 6px 16px rgba(0,0,0,.45)", opacity: disabled ? 0.5 : 1 } : { color: "#efe8d6", ...chipStyle, opacity: disabled ? 0.5 : 1 }}
  >
    {children}
  </motion.button>
);

/* =====================  GAME 1: SLIDING PUZZLE  ===================== */
const isSolved = (o) => o.every((v, i) => v === (i < o.length - 1 ? i : null));

function scramble(cols, rows, n) {
  const total = cols * rows;
  const o = Array.from({ length: total }, (_, i) => (i < total - 1 ? i : null));
  let b = total - 1;
  let prev = -1;
  const nb = (c) => {
    const r = Math.floor(c / cols), k = c % cols, a = [];
    if (r > 0) a.push(c - cols);
    if (r < rows - 1) a.push(c + cols);
    if (k > 0) a.push(c - 1);
    if (k < cols - 1) a.push(c + 1);
    return a;
  };
  let i = 0;
  while (i < n || isSolved(o)) {
    const opts = nb(b).filter((c) => c !== prev);
    const c = opts[Math.floor(Math.random() * opts.length)];
    o[b] = o[c]; o[c] = null; prev = b; b = c; i++;
  }
  return o;
}

function Puzzle({ cfg, art, T, onWin }) {
  const cols = num(cfg.cols, 3, 2, 6), rows = num(cfg.rows, 3, 2, 6), shuffleN = num(cfg.shuffle, 40, 4, 400);
  const total = cols * rows;
  const solved = Array.from({ length: total }, (_, i) => (i < total - 1 ? i : null));
  const [order, setOrder] = useState(solved);
  const [phase, setPhase] = useState("show"); // show | play | won
  const [moves, setMoves] = useState(0);
  const [secs, setSecs] = useState(0);
  const [peek, setPeek] = useState(false);
  const [run, setRun] = useState(0);
  const alive = useRef(true);
  const latest = useRef({});
  latest.current = { order, phase };

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // show the finished King, then scatter the pieces
  useEffect(() => {
    setOrder(Array.from({ length: total }, (_, i) => (i < total - 1 ? i : null)));
    setPhase("show"); setMoves(0); setSecs(0);
    const t = setTimeout(() => { setOrder(scramble(cols, rows, shuffleN)); setPhase("play"); }, 1400);
    return () => clearTimeout(t);
  }, [run, cols, rows, shuffleN, total]);

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const slide = (cell) => {
    const { order: o, phase: ph } = latest.current;
    if (ph !== "play") return;
    const b = o.indexOf(null);
    if (cell === b) return;
    const cr = Math.floor(cell / cols), cc = cell % cols, br = Math.floor(b / cols), bc = b % cols;
    if (cr !== br && cc !== bc) return;
    const step = cr === br ? (cell > b ? 1 : -1) : cell > b ? cols : -cols;
    const next = o.slice();
    let k = b;
    while (k !== cell) { next[k] = next[k + step]; k += step; }
    next[cell] = null;
    setOrder(next);
    setMoves((m) => m + 1);
    if (isSolved(next)) {
      setPhase("won");
      setTimeout(() => { if (alive.current) onWin(); }, 1300);
    }
  };
  const slideRef = useRef(slide);
  slideRef.current = slide;

  // arrow keys on desktop
  useEffect(() => {
    const k = (e) => {
      const m = { ArrowLeft: 1, ArrowRight: -1, ArrowUp: cols, ArrowDown: -cols }[e.key];
      if (!m) return;
      const b = latest.current.order.indexOf(null);
      const cell = b + m;
      if (cell < 0 || cell >= total) return;
      if (Math.abs(m) === 1 && Math.floor(cell / cols) !== Math.floor(b / cols)) return;
      e.preventDefault();
      slideRef.current(cell);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [cols, total]);

  const pos = [];
  order.forEach((id, cell) => { if (id !== null) pos[id] = cell; });
  const tw = 100 / cols, th = 100 / rows;
  const mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="flex w-full flex-col items-center">
      <p className="mb-3 h-5 text-center text-sm font-medium">{phase === "show" ? T.memorize : T.yourMove}</p>

      <motion.div
        initial={{ opacity: 0, rotateX: 28, y: 20 }} animate={{ opacity: 1, rotateX: 0, y: 0 }}
        transition={{ type: "spring", stiffness: 90, damping: 16 }}
        style={{ perspective: 1000, transformStyle: "preserve-3d" }}
      >
        <div
          style={{
            padding: 8, borderRadius: 20, background: "linear-gradient(145deg,#3a3126,#14100c)",
            boxShadow: "0 0 0 1.5px rgba(240,203,98,.7), 0 26px 50px rgba(0,0,0,.55)",
          }}
        >
          <div
            style={{
              position: "relative", overflow: "hidden", borderRadius: 12, background: "#0b0a08",
              width: "max(160px, min(86vw, 340px, calc((100dvh - 330px) * 0.702)))", aspectRatio: `${CW} / ${CH}`,
            }}
          >
            {Array.from({ length: total }, (_, id) => {
              const last = id === total - 1;
              const cell = last ? total - 1 : pos[id];
              const col = cell % cols, row = Math.floor(cell / cols);
              const bx = cols > 1 ? ((id % cols) / (cols - 1)) * 100 : 0;
              const by = rows > 1 ? (Math.floor(id / cols) / (rows - 1)) * 100 : 0;
              const hidden = last && phase === "play";
              return (
                <motion.div
                  key={id} initial={false}
                  animate={{ x: `${col * 100}%`, y: `${row * 100}%`, opacity: hidden ? 0 : 1 }}
                  transition={{ x: { type: "spring", stiffness: 330, damping: 32 }, y: { type: "spring", stiffness: 330, damping: 32 }, opacity: { duration: 0.5 } }}
                  onClick={() => { if (!last) slide(cell); }}
                  style={{ position: "absolute", left: 0, top: 0, width: `${tw}%`, height: `${th}%`, cursor: phase === "play" && !last ? "pointer" : "default", pointerEvents: hidden ? "none" : "auto" }}
                >
                  <div
                    style={{
                      width: "100%", height: "100%", borderRadius: 4,
                      backgroundImage: art ? `url("${art}")` : "linear-gradient(145deg,#302a20,#15120e)",
                      backgroundSize: `${cols * 100}% ${rows * 100}%`, backgroundPosition: `${bx}% ${by}%`,
                      boxShadow: "inset 0 0 0 1px rgba(255,235,170,.35), inset 0 0 0 2px rgba(0,0,0,.45)" + (last && phase === "won" ? ", 0 0 30px rgba(240,203,98,.9)" : ""),
                      display: "grid", placeItems: "center", color: "#e8c15a", fontFamily: "Georgia, serif", fontSize: 18,
                    }}
                  >
                    {!art && !last ? id + 1 : null}
                  </div>
                </motion.div>
              );
            })}
            {art && (
              <motion.img
                src={art} alt="" draggable={false} initial={false} animate={{ opacity: peek ? 1 : 0 }} transition={{ duration: 0.2 }}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
              />
            )}
          </div>
        </div>
      </motion.div>

      <div className="mt-4 flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.2em]">
        <span style={{ color: "#c9972f" }}>{T.moves} <b className="ml-1 text-[#efe8d6]">{moves}</b></span>
        <span style={{ color: "#c9972f" }}>{T.time} <b className="ml-1 text-[#efe8d6]">{mm}:{ss}</b></span>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button
          type="button" className="rounded-full px-4 py-2 text-[11px] font-semibold"
          style={{ color: "#efe8d6", ...chipStyle, touchAction: "none", userSelect: "none" }}
          onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} onPointerCancel={() => setPeek(false)}
        >
          👁 {T.peek}
        </button>
        <Pill onClick={() => setRun((r) => r + 1)}>{T.reshuffle}</Pill>
      </div>
    </div>
  );
}

/* =====================  GAME 2: FIND THE KING  ===================== */
const OTHERS = [
  { rank: "Q", suit: "♥" }, { rank: "J", suit: "♦" }, { rank: "10", suit: "♣" }, { rank: "A", suit: "♦" }, { rank: "9", suit: "♠" },
];

function FCard({ id, x0, w, h, topPad, up, front, canPick, glow, onPick, reg }) {
  const ctl = useAnimation();
  useEffect(() => { reg(id, ctl); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.div animate={ctl} initial={{ x: x0, y: 0 }} style={{ position: "absolute", left: 0, top: topPad, width: w, height: h }}>
      <motion.div
        whileHover={canPick ? { y: -10, scale: 1.04 } : undefined} whileTap={canPick ? { scale: 0.97 } : undefined}
        onClick={() => onPick(id)}
        style={{ cursor: canPick ? "pointer" : "default", borderRadius: w * 0.09, boxShadow: glow ? "0 0 0 2px #f0cb62, 0 0 30px rgba(240,203,98,.85)" : undefined }}
      >
        <Flip up={up} w={w} h={h} front={front} r={w * 0.09} />
      </motion.div>
    </motion.div>
  );
}

function Find({ cfg, art, T, onWin, onExit }) {
  const n = num(cfg.cards, 3, 3, 6), swapMs = num(cfg.swapMs, 500, 120, 1500), swaps = num(cfg.swaps, 6, 2, 30);
  const speedUp = num(cfg.speedUp, 0.8, 0.4, 1), rounds = num(cfg.rounds, 3, 1, 6), revealMs = num(cfg.revealMs, 1600, 600, 5000);
  const decoy = !!cfg.decoy;
  const boxRef = useRef(null);
  const boxW = useWidth(boxRef, 320);
  const gap = 10;
  const w = Math.max(44, Math.min(116, (boxW - gap * (n - 1)) / n));
  const h = Math.round(w * 1.42);
  const topPad = Math.round(h * 0.32);
  const totalW = n * w + (n - 1) * gap;

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState("reveal");
  const [up, setUp] = useState(() => Array(n).fill(false));
  const [faces, setFaces] = useState([]);
  const [kingId, setKingId] = useState(0);
  const [run, setRun] = useState(0);
  const ctrls = useRef([]);
  const occ = useRef(Array.from({ length: n }, (_, i) => i));
  const phaseRef = useRef("reveal");
  const pickRef = useRef(null);
  const geo = useRef({ w, gap });
  geo.current = { w, gap };
  const go = (p) => { phaseRef.current = p; setPhase(p); };

  // keep card positions right when the screen size changes
  useEffect(() => {
    ctrls.current.forEach((c, id) => { if (c) c.set({ x: occ.current.indexOf(id) * (w + gap) }); });
  }, [w]); // eslint-disable-line react-hooks/exhaustive-deps

  const swap = async (a, b, dur) => {
    const { w: cw, gap: g } = geo.current;
    const ca = occ.current[a], cb = occ.current[b];
    const A = ctrls.current[ca], B = ctrls.current[cb];
    const xa = a * (cw + g), xb = b * (cw + g);
    const lift = cw * 1.42 * 0.3, dir = xb > xa ? 1 : -1;
    const arc = ["easeOut", "easeIn"];
    A.set({ zIndex: 3 }); B.set({ zIndex: 2 });
    await Promise.all([
      A.start({
        x: [xa, xb], y: [0, -lift, 0], scale: [1, 1.12, 1], rotateZ: [0, -7 * dir, 0], rotateX: [0, -12, 0],
        transition: { x: { duration: dur, ease: "easeInOut" }, y: { duration: dur, ease: arc }, scale: { duration: dur, ease: arc }, rotateZ: { duration: dur, ease: arc }, rotateX: { duration: dur, ease: arc } },
      }),
      B.start({
        x: [xb, xa], y: [0, lift * 0.55, 0], scale: [1, 0.92, 1], rotateZ: [0, 7 * dir, 0], rotateX: [0, 10, 0],
        transition: { x: { duration: dur, ease: "easeInOut" }, y: { duration: dur, ease: arc }, scale: { duration: dur, ease: arc }, rotateZ: { duration: dur, ease: arc }, rotateX: { duration: dur, ease: arc } },
      }),
    ]);
    A.set({ zIndex: 1 }); B.set({ zIndex: 1 });
    occ.current[a] = cb; occ.current[b] = ca;
  };

  useEffect(() => {
    let dead = false;
    const wait = async (ms) => { await sleep(ms); if (dead) throw STOP; };
    const rand = (m) => Math.floor(Math.random() * m);
    (async () => {
      try {
        for (let r = 1; r <= rounds; r++) {
          setRound(r);
          const { w: cw, gap: g } = geo.current;
          const king = rand(n);
          const pool = OTHERS.slice().sort(() => Math.random() - 0.5);
          const others = (decoy ? [{ rank: "K", suit: "♣" }] : []).concat(pool).slice(0, n - 1).sort(() => Math.random() - 0.5);
          let oi = 0;
          setFaces(Array.from({ length: n }, (_, i) => (i === king ? { king: true } : others[oi++])));
          setKingId(king);
          occ.current = Array.from({ length: n }, (_, i) => i);
          ctrls.current.forEach((c, i) => c && c.set({ x: i * (cw + g), y: 0, scale: 1, rotateZ: 0, rotateX: 0, zIndex: 1 }));
          setUp(Array(n).fill(false));
          go("reveal");
          await wait(700);
          setUp(Array(n).fill(true));
          await wait(revealMs + 700);
          setUp(Array(n).fill(false));
          await wait(900);
          go("shuffle");
          const dur = Math.max(0.12, (swapMs / 1000) * Math.pow(speedUp, r - 1));
          let last = [-1, -1];
          for (let i = 0; i < swaps; i++) {
            let a, b;
            do { a = rand(n); b = rand(n); } while (a === b || (a === last[0] && b === last[1]) || (a === last[1] && b === last[0]));
            last = [a, b];
            await swap(a, b, dur);
            if (dead) throw STOP;
          }
          await wait(250);
          go("pick");
          const chosen = await new Promise((res) => { pickRef.current = res; });
          if (dead) throw STOP;
          if (chosen === king) {
            go("ok");
            setUp((p) => p.map((v, i) => i === chosen));
            await wait(550);
            setUp(Array(n).fill(true));
            await wait(1000);
            if (r < rounds) {
              go("next");
              await wait(900);
              setUp(Array(n).fill(false));
              await wait(700);
            } else {
              go("won");
              await wait(900);
              onWin();
              return;
            }
          } else {
            go("bad");
            setUp((p) => p.map((v, i) => i === chosen));
            await wait(550);
            setUp(Array(n).fill(true));
            return;
          }
        }
      } catch (e) {
        if (e !== STOP) console.error(e);
      }
    })();
    return () => { dead = true; };
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (id) => {
    if (phaseRef.current !== "pick") return;
    phaseRef.current = "picked";
    pickRef.current?.(id);
  };

  const status = {
    reveal: T.remember, shuffle: T.watch, pick: decoy ? `${T.where} · ${T.spades}` : T.where,
    ok: T.correct, next: T.faster, won: T.correct, bad: T.wrong, picked: "",
  }[phase];

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.25em]" style={{ color: "#c9972f" }}>{T.round} {round}/{rounds}</span>
        <span className="flex gap-1">
          {Array.from({ length: rounds }).map((_, i) => (
            <i key={i} style={{ width: 18, height: 4, borderRadius: 2, background: i < round ? GOLD : "rgba(240,203,98,.2)" }} />
          ))}
        </span>
      </div>
      <p className="mb-1 min-h-[40px] text-center text-sm font-medium">{status}</p>

      <div ref={boxRef} className="w-full">
        <div style={{ position: "relative", width: totalW, height: h + topPad + Math.round(h * 0.25), margin: "0 auto", perspective: 900 }}>
          {Array.from({ length: n }).map((_, id) => {
            const f = faces[id];
            const front = !f ? <PlayingFace rank="?" suit="♠" w={w} /> : f.king ? <KingFace art={art} w={w} /> : <PlayingFace rank={f.rank} suit={f.suit} w={w} />;
            return (
              <FCard
                key={id} id={id} x0={id * (w + gap)} w={w} h={h} topPad={topPad}
                up={!!up[id]} front={front} canPick={phase === "pick"}
                glow={(phase === "ok" || phase === "next" || phase === "won") && id === kingId}
                onPick={onPick} reg={(i, c) => { ctrls.current[i] = c; }}
              />
            );
          })}
        </div>
      </div>

      {phase === "bad" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex flex-wrap justify-center gap-2">
          <Pill gold onClick={() => setRun((r) => r + 1)}>{T.tryAgain}</Pill>
          <Pill onClick={onExit}>{T.changeLevel}</Pill>
        </motion.div>
      )}
    </div>
  );
}

/* =====================  GAME 3: BLACKJACK  ===================== */
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];
const makeDeck = () => {
  const d = [];
  let id = 0;
  SUITS.forEach((s) => RANKS.forEach((r) => d.push({ id: id++, rank: r, suit: s })));
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
};
const cardVal = (r) => (r === "A" ? 11 : ["K", "Q", "J"].includes(r) ? 10 : Number(r));
function handTotal(hand) {
  let t = 0, aces = 0;
  hand.forEach((c) => { t += cardVal(c.rank); if (c.rank === "A") aces++; });
  while (t > 21 && aces) { t -= 10; aces--; }
  return t;
}
function dealerHits(hand, pt, mode) {
  const dt = handTotal(hand);
  if (mode === "careless") return dt <= 11 ? true : dt <= 16 ? Math.random() < 0.5 : false;
  if (mode === "smart") return dt > pt ? false : dt === pt ? dt <= 16 : true; // knows your total and plays to beat it
  return dt < 17;
}

function Hand({ cards, cw, ch, hideSecond }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: ch + 10 }}>
      {cards.map((c, i) => (
        <motion.div
          key={c.id}
          initial={{ x: 170, y: -150, rotateZ: 26, opacity: 0, scale: 0.7 }}
          animate={{ x: 0, y: 0, rotateZ: (i - (cards.length - 1) / 2) * 3, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 150, damping: 17 }}
          style={{ marginLeft: i ? -cw * 0.5 : 0, zIndex: i }}
        >
          <Flip up={!(hideSecond && i === 1)} w={cw} h={ch} r={cw * 0.09} front={<PlayingFace rank={c.rank} suit={c.suit} w={cw} />} />
        </motion.div>
      ))}
    </div>
  );
}

function Blackjack({ cfg, T, onWin, onExit }) {
  const mode = ["careless", "normal", "smart"].includes(cfg.dealer) ? cfg.dealer : "normal";
  const boxRef = useRef(null);
  const boxW = useWidth(boxRef, 340);
  const cw = Math.round(Math.min(88, Math.max(54, (boxW - 40) / 5.2)));
  const ch = Math.round(cw * 1.42);
  const [player, setPlayer] = useState([]);
  const [dealer, setDealer] = useState([]);
  const [hole, setHole] = useState(true);
  const [phase, setPhase] = useState("dealing"); // dealing | player | busy | done
  const [result, setResult] = useState(null);
  const deck = useRef([]);
  const P = useRef([]);
  const D = useRef([]);
  const token = useRef(0);
  const naps = () => {
    const my = token.current;
    return async (ms) => { await sleep(ms); if (token.current !== my) throw STOP; };
  };
  const end = (r, why) => {
    setResult({ r, why });
    setPhase("done");
    if (r === "win") { const my = token.current; setTimeout(() => { if (token.current === my) onWin(); }, 1400); }
  };

  const deal = async () => {
    const nap = naps();
    deck.current = makeDeck();
    P.current = []; D.current = [];
    setResult(null); setHole(true); setPlayer([]); setDealer([]); setPhase("dealing");
    await nap(300);
    P.current = [deck.current.pop()]; setPlayer(P.current); await nap(450);
    D.current = [deck.current.pop()]; setDealer(D.current); await nap(450);
    P.current = [...P.current, deck.current.pop()]; setPlayer(P.current); await nap(450);
    D.current = [...D.current, deck.current.pop()]; setDealer(D.current); await nap(500);
    const pn = handTotal(P.current) === 21, dn = handTotal(D.current) === 21;
    if (pn || dn) {
      setHole(false);
      await nap(800);
      if (pn && dn) end("push");
      else if (pn) end("win", "natural");
      else end("lose");
      return;
    }
    setPhase("player");
  };

  const hit = async () => {
    if (phase !== "player") return;
    const nap = naps();
    setPhase("busy");
    P.current = [...P.current, deck.current.pop()];
    setPlayer(P.current);
    await nap(500);
    const t = handTotal(P.current);
    if (t > 21) { setHole(false); await nap(600); end("lose", "bust"); }
    else if (t === 21) stand(true);
    else setPhase("player");
  };

  const stand = async (force) => {
    if (phase !== "player" && !force) return;
    const nap = naps();
    setPhase("busy");
    setHole(false);
    await nap(800);
    const pt = handTotal(P.current);
    while (handTotal(D.current) <= 21 && dealerHits(D.current, pt, mode)) {
      D.current = [...D.current, deck.current.pop()];
      setDealer(D.current);
      await nap(800);
    }
    const dt = handTotal(D.current);
    if (dt > 21) end("win", "dealerBust");
    else if (dt > pt) end("lose");
    else if (dt < pt) end("win");
    else end("push");
  };

  useEffect(() => {
    deal().catch(() => {});
    return () => { token.current += 1; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const label = (text, total) => (
    <div className="my-1 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "#c9972f" }}>
      {text}
      {total != null && (
        <b className="rounded-full px-2 py-0.5 text-[11px] tracking-normal text-[#efe8d6]" style={{ boxShadow: "inset 0 0 0 1px rgba(240,203,98,.45)" }}>{total}</b>
      )}
    </div>
  );
  const dealerShown = hole ? (dealer[0] ? cardVal(dealer[0].rank) : null) : dealer.length ? handTotal(dealer) : null;
  const msg = result
    ? result.r === "win" ? (result.why === "dealerBust" ? T.dealerBust : T.youWin)
    : result.r === "push" ? T.push : result.why === "bust" ? T.bust : T.dealerWins
    : "";

  return (
    <div className="w-full">
      <div
        ref={boxRef} className="relative overflow-hidden rounded-[28px] px-3 py-4 sm:px-6"
        style={{
          background: "radial-gradient(ellipse at 50% 35%, #174232 0%, #0d241b 58%, #07120d 100%)",
          boxShadow: "0 0 0 1.5px rgba(240,203,98,.7), inset 0 0 0 5px rgba(7,18,13,.9), inset 0 0 0 6px rgba(240,203,98,.3), 0 24px 50px rgba(0,0,0,.55)",
        }}
      >
        {label(T.dealer, dealerShown)}
        <Hand cards={dealer} cw={cw} ch={ch} hideSecond={hole} />

        <div className="flex h-10 items-center justify-center">
          <AnimatePresence mode="wait">
            {msg && (
              <motion.p
                key={msg} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="font-serif text-2xl font-bold" style={goldText}
              >
                {msg}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {label(T.you, player.length ? handTotal(player) : null)}
        <Hand cards={player} cw={cw} ch={ch} />

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {phase !== "done" ? (
            <>
              <Pill gold disabled={phase !== "player"} onClick={hit}>{T.hit}</Pill>
              <Pill disabled={phase !== "player"} onClick={() => stand()}>{T.stand}</Pill>
            </>
          ) : result?.r !== "win" ? (
            <>
              <Pill gold onClick={() => deal().catch(() => {})}>{T.dealAgain}</Pill>
              <Pill onClick={onExit}>{T.changeLevel}</Pill>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* =====================  HUB ART  ===================== */
function GameArt({ kind }) {
  if (kind === "puzzle")
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 3, width: 52, height: 52 }}>
        {Array.from({ length: 9 }).map((_, i) => (i === 8 ? <span key={i} /> : <span key={i} style={{ borderRadius: 4, background: GOLD, opacity: 0.5 + (i % 3) * 0.18 }} />))}
      </div>
    );
  if (kind === "find")
    return (
      <div style={{ position: "relative", width: 62, height: 52 }}>
        {[-14, 0, 14].map((r, i) => (
          <div key={i} style={{ position: "absolute", left: 14 + i * 12, top: 4, width: 26, height: 38, transform: `rotate(${r}deg)`, transformOrigin: "50% 100%" }}>
            <CardBack r={5} />
          </div>
        ))}
      </div>
    );
  return (
    <div className="font-serif text-[34px] font-bold leading-none" style={goldText}>21</div>
  );
}

function WinScreen({ art, T, onOpen }) {
  return (
    <div className="relative mx-auto flex w-full flex-col items-center text-center">
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <motion.span
            key={i} className="pointer-events-none absolute left-1/2 top-1/3 text-[18px]" style={{ color: "#f6dc8c", textShadow: "0 0 10px rgba(255,200,90,.9)" }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 0 }} animate={{ x: Math.cos(a) * 150, y: Math.sin(a) * 150, scale: [0, 1, 0], opacity: [0, 1, 0] }}
            transition={{ delay: 0.2 + (i % 4) * 0.05, duration: 1.1, ease: "easeOut" }}
          >
            ✦
          </motion.span>
        );
      })}
      {art && (
        <motion.img
          src={art} alt="" draggable={false} className="kg-float"
          initial={{ scale: 0.3, rotateY: 540, opacity: 0 }} animate={{ scale: 1, rotateY: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 60, damping: 13 }}
          style={{ width: "min(46vw, 210px)", filter: "drop-shadow(0 24px 30px rgba(0,0,0,.6))" }}
        />
      )}
      <h2 className="mt-5 font-serif text-4xl font-bold" style={goldText}>{T.won}</h2>
      <p className="mt-1 text-sm opacity-75">{T.wonSub}</p>
      <div className="mt-5"><Pill gold onClick={onOpen}>{T.openCard} →</Pill></div>
    </div>
  );
}

/* =====================  THE OVERLAY  ===================== */
export default function KingGames() {
  const { lang } = useSettings();
  const { profile } = useData();
  const T = TXT[lang] || TXT.en;
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [step, setStep] = useState("hub"); // hub | level | play | win
  const [game, setGame] = useState(null);
  const [level, setLevel] = useState("easy");
  const [cfg, setCfg] = useState(DEFAULTS);
  const [cardRow, setCardRow] = useState(null);
  const [art, setArt] = useState(null);
  const originRef = useRef(origin);
  const winTimer = useRef(null);
  const loaded = useRef(false);
  originRef.current = origin;

  useEffect(() => {
    const h = (e) => {
      const o = e.detail || { x: window.innerWidth - 60, y: 60 };
      setOrigin(o); setStep("hub"); setGame(null); setOpen(true);
      if (!loaded.current) {
        loaded.current = true;
        Promise.all([supabase.from("games").select("*"), supabase.from("card").select("*").eq("id", 1).maybeSingle()])
          .then(([g, c]) => {
            if (!g.error && g.data?.length) setCfg(mergeCfg(g.data));
            if (!c.error && c.data) setCardRow(c.data);
          })
          .catch(() => {});
      }
    };
    window.addEventListener("open-king-games", h);
    return () => window.removeEventListener("open-king-games", h);
  }, []);

  // the card front, drawn once, used by the puzzle and the King face
  useEffect(() => {
    if (!open) return;
    const name = tx(profile?.name, lang) || "Prabhat Dubey";
    const initials = cardRow?.initials || name.split(/\s+/).filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase() || "PD";
    const ft = (cardRow && (lang === "hi" ? cardRow.front_title_hi || cardRow.front_title_en : cardRow.front_title_en)) || "KING · OF · SPADES";
    try { setArt(frontToDataUrl({ rank: cardRow?.rank || "K", initials, name, nameU: name.toUpperCase(), frontTitle: ft })); } catch { setArt(null); }
  }, [open, lang, cardRow, profile]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const k = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", k); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { clearTimeout(winTimer.current); setOpen(false); };
  const openCard = () => {
    clearTimeout(winTimer.current);
    setOpen(false);
    setTimeout(() => window.dispatchEvent(new CustomEvent("open-king-card", { detail: originRef.current })), 450);
  };
  const win = () => { setStep("win"); clearTimeout(winTimer.current); winTimer.current = setTimeout(openCard, 2600); };
  const back = () => { if (step === "play") setStep("level"); else if (step === "level") setStep("hub"); else close(); };

  if (typeof document === "undefined") return null;

  const games = Object.keys(cfg).filter((k) => cfg[k].enabled).sort((a, b) => cfg[a].sort - cfg[b].sort);
  const R = Math.hypot(window.innerWidth, window.innerHeight) + 120;
  const c0 = `circle(0px at ${origin.x}px ${origin.y}px)`;
  const c1 = `circle(${R}px at ${origin.x}px ${origin.y}px)`;
  const g = game ? cfg[game] : null;
  const lvCfg = g ? g.levels[level] || {} : {};

  return createPortal(
    <>
      <style>{CSS}</style>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="kg-g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff3bf" /><stop offset=".3" stopColor="#f0cb62" /><stop offset=".6" stopColor="#b8862b" />
            <stop offset=".82" stopColor="#f6dc8c" /><stop offset="1" stopColor="#c9972f" />
          </linearGradient>
        </defs>
      </svg>

      <AnimatePresence>
        {open && (
          <motion.div
            key="kg" role="dialog" aria-modal="true" aria-label="King games"
            className="fixed inset-0 z-[50] overflow-y-auto text-[#efe8d6]"
            style={{ background: "radial-gradient(ellipse at 50% 0%, #3a2e16 0%, #15110a 55%, #070504 100%)" }}
            initial={{ clipPath: c0 }} animate={{ clipPath: c1 }} exit={{ clipPath: c0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* floating gold dust */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
              {DUST.map((p, i) => (
                <span key={i} className="kg-dust absolute rounded-full" style={{ left: `${p.left}%`, bottom: `${p.bottom}%`, width: p.size, height: p.size, background: "#f6dc8c", boxShadow: "0 0 6px rgba(255,210,100,.9)", animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
              ))}
            </div>

            <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[640px] flex-col px-4 pb-8 pt-4">
              <div className="flex items-center justify-between">
                <button type="button" onClick={back} className={`rounded-full px-3 py-1.5 text-xs ${step === "hub" ? "invisible" : ""}`} style={chipStyle}>← {T.back}</button>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "#c9972f" }}>{T.brand}</p>
                <button type="button" aria-label="Close" onClick={close} className="grid h-8 w-8 place-items-center rounded-full text-sm" style={chipStyle}>✕</button>
              </div>

              <div className="flex flex-1 items-center py-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step} className="w-full"
                    initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {step === "hub" && (
                      <div>
                        <div className="text-center">
                          {art && (
                            <img src={art} alt="" draggable={false} className="kg-float mx-auto mb-4 h-32 w-auto sm:h-40" style={{ filter: "drop-shadow(0 18px 22px rgba(0,0,0,.6))", transform: "rotate(-4deg)" }} />
                          )}
                          <h2 className="font-serif text-4xl font-bold sm:text-5xl" style={goldText}>{T.hubTitle}</h2>
                          <p className="mt-2 text-sm opacity-70">{T.hubSub}</p>
                        </div>
                        <div className="mt-6 grid gap-3 sm:grid-cols-3">
                          {games.map((k, i) => (
                            <motion.button
                              key={k} type="button" onClick={() => { setGame(k); setStep("level"); }}
                              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 + i * 0.09, type: "spring", stiffness: 150, damping: 18 }}
                              whileHover={{ y: -6, scale: 1.02 }} whileTap={{ scale: 0.98 }}
                              className="relative flex items-center gap-4 overflow-hidden rounded-2xl p-4 text-left sm:flex-col sm:items-start sm:gap-3"
                              style={{ background: "linear-gradient(160deg, rgba(48,42,32,.92), rgba(16,13,9,.96))", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4), 0 14px 30px rgba(0,0,0,.45)" }}
                            >
                              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                                <div className="kg-sheen absolute -inset-y-6 w-1/3" style={{ left: 0, background: "linear-gradient(90deg, transparent, rgba(255,240,190,.16), transparent)" }} />
                              </div>
                              <div className="grid h-14 w-16 shrink-0 place-items-center"><GameArt kind={k} /></div>
                              <div className="min-w-0">
                                <b className="block font-serif text-lg leading-tight" style={goldText}>{tx(cfg[k].title, lang)}</b>
                                <span className="mt-1 block text-[12px] leading-snug opacity-70">{tx(cfg[k].desc, lang)}</span>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    {step === "level" && g && (
                      <div className="mx-auto max-w-[420px]">
                        <div className="text-center">
                          <div className="mx-auto grid h-16 w-20 place-items-center"><GameArt kind={game} /></div>
                          <h2 className="mt-2 font-serif text-3xl font-bold" style={goldText}>{tx(g.title, lang)}</h2>
                          <p className="mt-1 text-sm opacity-70">{T.chooseLevel}</p>
                        </div>
                        <div className="mt-5 space-y-3">
                          {LEVELS.filter((lv) => g.levels[lv] && g.levels[lv].enabled !== false).map((lv, i) => (
                            <motion.button
                              key={lv} type="button" onClick={() => { setLevel(lv); setStep("play"); }}
                              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i, type: "spring", stiffness: 160, damping: 18 }}
                              whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }}
                              className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left"
                              style={{ background: "linear-gradient(160deg, rgba(48,42,32,.92), rgba(16,13,9,.96))", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4), 0 10px 24px rgba(0,0,0,.4)" }}
                            >
                              <span>
                                <b className="block font-serif text-xl" style={goldText}>{T[lv]}</b>
                                <span className="mt-0.5 block text-[12px] opacity-70">{levelInfo(game, g.levels[lv], T)}</span>
                              </span>
                              <Dots n={i + 1} />
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    {step === "play" && g && (
                      <div className="mx-auto w-full max-w-[520px]">
                        <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "#c9972f" }}>{tx(g.title, lang)} · {T[level]}</p>
                        {game === "puzzle" && <Puzzle key={level} cfg={lvCfg} art={art} T={T} onWin={win} />}
                        {game === "find" && <Find key={level} cfg={lvCfg} art={art} T={T} onWin={win} onExit={() => setStep("level")} />}
                        {game === "blackjack" && <Blackjack key={level} cfg={lvCfg} T={T} onWin={win} onExit={() => setStep("level")} />}
                      </div>
                    )}

                    {step === "win" && <WinScreen art={art} T={T} onOpen={openCard} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}