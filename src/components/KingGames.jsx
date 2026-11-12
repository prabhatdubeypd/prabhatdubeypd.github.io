import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { supabase } from "../lib/supabase";
import { tx } from "../lib/i18n";
import { CW, CH, frontToDataUrl } from "./KingCard";
import { Checkers, HigherLower, WaterSort, SnakeGame } from "./MoreGames";
import { useSocial, readLink, clearLink, ResultScreen, ChallengeScreen, ChallengeChip, DailyCard, HubFooter, Leaderboard, fmtTime } from "./GameSocial";

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
    fire: "Fire", water: "Water", grass: "Grass", surge: "Surge", guard: "Guard",
    surgeHint: "Double damage and wins ties", guardHint: "Take half damage this round",
    pickElement: "Choose your element", tieRound: "Clash cancelled", youDefeated: "You were defeated",
    rival: "Rival", rivalCareless: "Careless rival", rivalNormal: "Normal rival", rivalSmart: "Smart rival",
    legend: "Fire beats Grass · Grass beats Water · Water beats Fire",
    yourTurn: "Your turn", rivalTurn: "Rival is thinking…", boxesWord: "boxes", boxHint: "Complete a box to go again",
    draw: "It's a draw", rivalWins: "Rival wins",
    pairsWord: "pairs", missesWord: "misses", pairs: "Pairs", missesLeft: "Misses left",
    memorizeCards: "Memorize the cards…", findPairs: "Find the pairs", outOfMisses: "Out of misses",
        higher: "Higher", lower: "Lower", streak: "Streak", inARow: "in a row", livesWord: "lives",
    sameRank: "Same rank! Drawing again", hlAsk: "Will the next card be higher or lower?", aceHigh: "Ace is high",
    undo: "Undo", restart: "Restart", waterHint: "Tap a tube, then tap where to pour",
    colorsWord: "colors", tubesWord: "tubes",
    snakeStart: "Swipe or press an arrow to start", coinsWord: "coins", wrapHint: "Edges wrap around",
    wallHint: "Walls are deadly", snakeOver: "Game over", mustJump: "You must capture",
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
        fire: "आग", water: "पानी", grass: "घास", surge: "सर्ज", guard: "गार्ड",
    surgeHint: "दोगुना नुकसान, बराबरी पर भी जीत", guardHint: "इस राउंड में आधा नुकसान",
    pickElement: "अपना तत्व चुनें", tieRound: "टक्कर बराबर", youDefeated: "आप हार गए",
    rival: "रिवाल", rivalCareless: "लापरवाह रिवाल", rivalNormal: "सामान्य रिवाल", rivalSmart: "चतुर रिवाल",
    legend: "आग > घास · घास > पानी · पानी > आग",
    yourTurn: "आपकी बारी", rivalTurn: "रिवाल सोच रहा है…", boxesWord: "बॉक्स", boxHint: "बॉक्स पूरा करें तो फिर चाल मिलेगी",
    draw: "बराबरी", rivalWins: "रिवाल जीता",
    pairsWord: "जोड़ियाँ", missesWord: "मिस", pairs: "जोड़ियाँ", missesLeft: "बचे मिस",
    memorizeCards: "कार्ड याद करें…", findPairs: "जोड़ियाँ ढूँढें", outOfMisses: "मिस खत्म",
        higher: "ऊँचा", lower: "नीचा", streak: "लगातार सही", inARow: "लगातार", livesWord: "जान",
    sameRank: "बराबर कार्ड! फिर से बाँटें", hlAsk: "अगला कार्ड ऊँचा होगा या नीचा?", aceHigh: "इक्का सबसे ऊँचा है",
    undo: "वापस", restart: "फिर से शुरू", waterHint: "ट्यूब चुनें, फिर जहाँ उडेलना है वहाँ टैप करें",
    colorsWord: "रंग", tubesWord: "ट्यूब",
    snakeStart: "शुरू करने के लिए स्वाइप करें या तीर दबाएँ", coinsWord: "सिक्के", wrapHint: "किनारे आपस में जुड़े हैं",
    wallHint: "दीवार से टकराना मना है", snakeOver: "गेम ओवर", mustJump: "आपको कैप्चर करना होगा",
        
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
    elements: {
    enabled: true, sort: 4,
    title: { en: "Element Duel", hi: "एलिमेंट ड्यूल" },
    desc: { en: "Fire, Water, Grass: outsmart the rival and drain its HP.", hi: "आग, पानी, घास: रिवाल को मात देकर उसका HP खत्म करें।" },
    levels: {
      easy: { hp: 10, aiHp: 8, dmg: 2, smart: 0.15 },
      medium: { hp: 10, aiHp: 10, dmg: 2, smart: 0.5 },
      hard: { hp: 10, aiHp: 12, dmg: 2, smart: 0.85 },
    },
  },
  dots: {
    enabled: true, sort: 5,
    title: { en: "Dots and Boxes", hi: "डॉट्स और बॉक्स" },
    desc: { en: "Draw lines, close boxes, and claim more than the rival.", hi: "लकीरें खींचें, बॉक्स बंद करें और रिवाल से ज़्यादा बॉक्स जीतें।" },
    levels: {
      easy: { rows: 3, cols: 3, ai: "careless" },
      medium: { rows: 4, cols: 4, ai: "normal" },
      hard: { rows: 5, cols: 5, ai: "smart" },
    },
  },
  memory: {
    enabled: true, sort: 6,
    title: { en: "Match the Pairs", hi: "जोड़ियाँ मिलाओ" },
    desc: { en: "Flip the cards and match every pair before you run out of misses.", hi: "कार्ड पलटें और मिस खत्म होने से पहले सारी जोड़ियाँ मिलाएँ।" },
    levels: {
      easy: { cols: 4, rows: 3, maxMisses: 0, previewMs: 2200 },
      medium: { cols: 4, rows: 4, maxMisses: 10, previewMs: 1800 },
      hard: { cols: 5, rows: 4, maxMisses: 8, previewMs: 1500 },
    },
  },

    checkers: {
    enabled: true, sort: 7,
    title: { en: "Checkers", hi: "चेकर्स" },
    desc: { en: "Jump the rival's pieces and crown your kings.", hi: "रिवाल के मोहरों पर कूदें और अपने किंग बनाएँ।" },
    levels: { easy: { depth: 1, mistakes: 0.4 }, medium: { depth: 3, mistakes: 0.1 }, hard: { depth: 5, mistakes: 0 } },
  },
  higherlower: {
    enabled: true, sort: 8,
    title: { en: "Higher or Lower", hi: "ऊँचा या नीचा" },
    desc: { en: "Guess the next card and build a streak.", hi: "अगला कार्ड पहचानें और लगातार सही जवाबों की लड़ी बनाएँ।" },
    levels: { easy: { target: 4, lives: 3, hint: true }, medium: { target: 6, lives: 2, hint: false }, hard: { target: 9, lives: 1, hint: false } },
  },
  watersort: {
    enabled: true, sort: 9,
    title: { en: "Water Sort", hi: "वॉटर सॉर्ट" },
    desc: { en: "Pour the colors until every tube holds one color.", hi: "रंग उडेलें जब तक हर ट्यूब में एक ही रंग न हो जाए।" },
    levels: { easy: { colors: 5, empty: 2 }, medium: { colors: 7, empty: 2 }, hard: { colors: 9, empty: 2 } },
  },
  snake: {
    enabled: true, sort: 10,
    title: { en: "Snake", hi: "स्नेक" },
    desc: { en: "Glide, eat the gold coins and grow without crashing.", hi: "सरकें, सोने के सिक्के खाएँ और टकराए बिना बढ़ें।" },
    levels: {
      easy: { cols: 10, rows: 10, speed: 210, target: 8, wrap: true, rocks: 0 },
      medium: { cols: 12, rows: 12, speed: 160, target: 14, wrap: false, rocks: 0 },
      hard: { cols: 14, rows: 14, speed: 120, target: 20, wrap: false, rocks: 8 },
    },
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
  if (game === "elements") {
    const s = num(lv.smart, 0.5, 0, 1);
    return `${num(lv.hp, 10, 3, 40)} HP · ${s < 0.3 ? T.rivalCareless : s < 0.7 ? T.rivalNormal : T.rivalSmart}`;
  }
  if (game === "dots") {
    const r = { careless: T.rivalCareless, normal: T.rivalNormal, smart: T.rivalSmart }[lv.ai] || T.rivalNormal;
    return `${num(lv.rows, 3, 2, 6)} × ${num(lv.cols, 3, 2, 6)} ${T.boxesWord} · ${r}`;
  }
  if (game === "memory") {
    const p = Math.floor((num(lv.cols, 4, 2, 6) * num(lv.rows, 3, 2, 6)) / 2);
    const m = num(lv.maxMisses, 0, 0, 99);
    return `${p} ${T.pairsWord}${m ? ` · ${m} ${T.missesWord}` : ""}`;
  }

    if (game === "checkers") {
    const d = num(lv.depth, 3, 1, 8);
    return `8 × 8 · ${d <= 1 ? T.rivalCareless : d <= 3 ? T.rivalNormal : T.rivalSmart}`;
  }
  if (game === "higherlower") return `${num(lv.target, 5, 2, 30)} ${T.inARow} · ${num(lv.lives, 2, 1, 9)} ${T.livesWord}`;
  if (game === "watersort") {
    const c = num(lv.colors, 5, 2, 10), e = num(lv.empty, 2, 1, 4);
    return `${c} ${T.colorsWord} · ${c + e} ${T.tubesWord}`;
  }
  if (game === "snake") {
    const ms = num(lv.speed, 200, 60, 500);
    const sp = ms >= 190 ? T.slow : ms >= 140 ? T.fast : T.veryFast;
    return `${num(lv.cols, 10, 6, 20)} × ${num(lv.rows, 10, 6, 20)} · ${num(lv.target, 8, 3, 60)} ${T.coinsWord} · ${sp}`;
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
            setTimeout(() => { if (alive.current) onWin({ moves: moves + 1, secs }); }, 1300);
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

/* a game that can be restarted without leaving the level */
function Retryable({ Game, ...props }) {
  const [run, setRun] = useState(0);
  return <Game key={run} {...props} again={() => setRun((r) => r + 1)} />;
}

/* =====================  GAME 4: ELEMENT DUEL  ===================== */
const ELS = ["fire", "water", "grass"];
const BEATS = { fire: "grass", grass: "water", water: "fire" };
const COUNTER = { fire: "water", grass: "fire", water: "grass" }; // what beats the key
const EL_COL = { fire: "#ff7a3d", water: "#4aa8ff", grass: "#58d068" };

function Glyph({ el }) {
  if (el === "fire")
    return (
      <g>
        <path d="M32 4 C35 17 49 23 49 39 C49 51 41 60 32 60 C23 60 15 51 15 39 C15 31 19 26 24 21 C24 29 28 33 31 30 C35 24 29 14 32 4 Z" fill="url(#kg-fire)" />
        <path d="M32 30 C34 38 40 41 40 48 C40 54 36 57 32 57 C28 57 24 54 24 48 C24 42 29 40 32 30 Z" fill="#ffe9a8" opacity=".85" />
      </g>
    );
  if (el === "water")
    return (
      <g>
        <path d="M32 4 C32 4 14 26 14 40 C14 51 22 60 32 60 C42 60 50 51 50 40 C50 26 32 4 32 4 Z" fill="url(#kg-water)" />
        <path d="M23 40 C23 46 27 51 32 52" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      </g>
    );
  return (
    <g>
      <path d="M8 56 C8 28 28 8 56 8 C56 38 36 56 8 56 Z" fill="url(#kg-grass)" />
      <path d="M10 54 L40 24" stroke="#0e3b1b" strokeWidth="2.2" strokeLinecap="round" opacity=".6" />
    </g>
  );
}

function Orb({ el, size = 80, hot, hidden }) {
  const col = hidden ? "#c9972f" : EL_COL[el];
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", position: "relative", display: "grid", placeItems: "center",
        background: "radial-gradient(circle at 34% 28%, rgba(255,255,255,.28), rgba(255,255,255,0) 46%), linear-gradient(150deg,#302a20,#0b0a08)",
        boxShadow: `inset 0 0 0 2px ${col}, inset 0 0 18px ${col}55, 0 0 ${hot ? 40 : 14}px ${col}${hot ? "cc" : "66"}, 0 12px 22px rgba(0,0,0,.5)`,
      }}
    >
      {hidden ? (
        <b className="font-serif" style={{ ...goldText, fontSize: size * 0.5 }}>?</b>
      ) : (
        <svg viewBox="0 0 64 64" width={size * 0.6} height={size * 0.6}><Glyph el={el} /></svg>
      )}
    </div>
  );
}

function predictNext(h) {
  for (let k = Math.min(3, h.length - 1); k >= 1; k--) {
    const ctx = h.slice(-k).join();
    const cnt = {};
    for (let i = 0; i + k < h.length; i++) {
      if (h.slice(i, i + k).join() === ctx) cnt[h[i + k]] = (cnt[h[i + k]] || 0) + 1;
    }
    const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (best) return best[0];
  }
  if (!h.length) return null;
  const f = {};
  h.forEach((x) => { f[x] = (f[x] || 0) + 1; });
  return Object.entries(f).sort((a, b) => b[1] - a[1])[0][0];
}

function HpBar({ name, hp, max, en, hitKey }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  const col =
    pct > 55 ? "linear-gradient(90deg,#3fbf5a,#8ae27a)" : pct > 28 ? "linear-gradient(90deg,#d9a933,#f6dc8c)" : "linear-gradient(90deg,#d6403a,#ff8a6a)";
  return (
    <motion.div
      key={hitKey}
      initial={{ x: 0 }}
      animate={hitKey ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-2xl px-3 py-2"
      style={{ background: "linear-gradient(160deg, rgba(48,42,32,.92), rgba(16,13,9,.96))", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4)" }}
    >
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em]">
        <span style={{ color: "#c9972f" }}>{name}</span>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <i key={i} style={{ width: 8, height: 8, transform: "rotate(45deg)", background: i < en ? GOLD : "rgba(240,203,98,.2)", boxShadow: en >= 3 ? "0 0 8px rgba(240,203,98,.9)" : "none" }} />
          ))}
        </span>
        <b>{hp}/{max}</b>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,.5)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.25)" }}>
        <motion.div initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 90, damping: 18 }} style={{ height: "100%", background: col }} />
      </div>
    </motion.div>
  );
}

function ArenaOrb({ side, el, hidden, pose, badge, hot }) {
  const sign = side === "p" ? 1 : -1;
  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -38, marginTop: -38, perspective: 600 }}>
      <motion.div
        initial={{ y: sign * 130, opacity: 0, scale: 0.6 }}
        animate={pose.animate} transition={pose.tr}
        style={{ position: "relative" }}
      >
        <motion.div key={hidden ? "q" : el} initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ duration: 0.35 }}>
          <Orb el={el || "fire"} size={76} hidden={hidden} hot={hot} />
        </motion.div>
        {badge && (
          <span
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ top: side === "p" ? 84 : -24, background: GOLD, color: "#3b2506" }}
          >
            {badge}
          </span>
        )}
      </motion.div>
    </div>
  );
}

function Elements({ cfg, T, onWin, onExit, again }) {
  const maxP = num(cfg.hp, 10, 3, 40);
  const maxA = num(cfg.aiHp, maxP, 3, 60);
  const dmg = num(cfg.dmg, 2, 1, 10);
  const smart = num(cfg.smart, 0.5, 0, 1);
  const [pHp, setPHp] = useState(maxP);
  const [aHp, setAHp] = useState(maxA);
  const [pEn, setPEn] = useState(0);
  const [aEn, setAEn] = useState(0);
  const [special, setSpecial] = useState(null); // null | surge | guard
  const [phase, setPhase] = useState("pick"); // pick | clash | won | lost
  const [stage, setStage] = useState("idle"); // idle | in | reveal | hit
  const [pEl, setPEl] = useState(null);
  const [aEl, setAEl] = useState(null);
  const [fx, setFx] = useState({ win: null, ps: false, as: false, pg: false, ag: false, amount: 0 });
  const [pHit, setPHit] = useState(0);
  const [aHit, setAHit] = useState(0);
  const [round, setRound] = useState(1);
  const hist = useRef([]);
  const token = useRef(0);
  useEffect(() => () => { token.current += 1; }, []);

  const play = async (el) => {
    if (phase !== "pick") return;
    const my = token.current;
    const nap = async (ms) => { await sleep(ms); if (token.current !== my) throw STOP; };
    const rnd = (n) => Math.floor(Math.random() * n);
    const ps = special === "surge" && pEn >= 3;
    const pg = special === "guard" && pEn >= 2;

    // the rival studies your last moves (up to 3) and counters the one it expects
    const pred = predictNext(hist.current);
    const ael = pred && Math.random() < smart ? COUNTER[pred] : ELS[rnd(3)];
    let as = false, ag = false;
    if (aEn >= 3 && Math.random() < 0.35 + smart * 0.5) as = true;
    else if (aEn >= 2 && aHp <= dmg * 2 && Math.random() < smart) ag = true;
    hist.current = [...hist.current, el];

    let win = "tie";
    if (el === ael) { if (ps && !as) win = "p"; else if (as && !ps) win = "a"; }
    else win = BEATS[el] === ael ? "p" : "a";
    let amount = 0;
    if (win !== "tie") {
      const surged = win === "p" ? ps : as;
      const guarded = win === "p" ? ag : pg;
      amount = dmg * (surged ? 2 : 1);
      if (guarded) amount = Math.ceil(amount / 2);
    }
    const nPEn = Math.min(3, pEn - (ps ? 3 : pg ? 2 : 0) + 1);
    const nAEn = Math.min(3, aEn - (as ? 3 : ag ? 2 : 0) + 1);
    const nAHp = win === "p" ? Math.max(0, aHp - amount) : aHp;
    const nPHp = win === "a" ? Math.max(0, pHp - amount) : pHp;

    try {
      setPhase("clash"); setSpecial(null); setPEl(el); setAEl(null);
      setFx({ win: null, ps, as: false, pg, ag: false, amount: 0 });
      setStage("in");
      await nap(520);
      setAEl(ael);
      setFx({ win: null, ps, as, pg, ag, amount: 0 });
      setStage("reveal");
      await nap(750);
      setStage("hit");
      setFx({ win, ps, as, pg, ag, amount });
      await nap(450);
      setPHp(nPHp); setAHp(nAHp); setPEn(nPEn); setAEn(nAEn);
      if (win === "p") setAHit((h) => h + 1);
      if (win === "a") setPHit((h) => h + 1);
      await nap(1200);
      if (nAHp <= 0) { setPhase("won"); await nap(900); onWin(); return; }
      if (nPHp <= 0) { setPhase("lost"); return; }
      setStage("idle"); setPEl(null); setAEl(null); setRound((r) => r + 1); setPhase("pick");
    } catch (e) {
      if (e !== STOP) console.error(e);
    }
  };

  const pose = (side) => {
    const sign = side === "p" ? 1 : -1;
    if (stage === "idle") return { animate: { y: sign * 130, x: 0, opacity: 0, scale: 0.6, rotateY: 0, rotateZ: 0 }, tr: { duration: 0.35 } };
    if (stage === "in" || stage === "reveal")
      return { animate: { y: sign * 64, x: 0, opacity: 1, scale: stage === "reveal" ? 1.06 : 1, rotateY: 0, rotateZ: 0 }, tr: { type: "spring", stiffness: 130, damping: 15 } };
    if (fx.win === "tie") return { animate: { y: sign * 24, x: 0, opacity: 1, scale: 1, rotateY: 360, rotateZ: 0 }, tr: { duration: 0.6 } };
    if (fx.win === side)
      return { animate: { y: [sign * 64, sign * 8, sign * 8], x: 0, opacity: 1, scale: [1, 1.4, 1.2], rotateY: 360, rotateZ: 0 }, tr: { duration: 0.7, times: [0, 0.5, 1] } };
    return {
      animate: { y: [sign * 64, sign * 8, sign * 8], x: [0, 0, -sign * 70], opacity: [1, 1, 0.2], scale: [1, 1.1, 0.7], rotateY: 0, rotateZ: [0, 0, -sign * 40] },
      tr: { duration: 0.8, times: [0, 0.45, 1] },
    };
  };

  let status = T.pickElement;
  if (phase === "clash") {
    if (stage === "in") status = "…";
    else if (stage === "reveal") status = `${T[pEl]} vs ${T[aEl]}`;
    else status = fx.win === "tie" ? T.tieRound : fx.win === "p" ? `${T.you}: −${fx.amount}` : `${T.rival}: −${fx.amount}`;
  }
  if (phase === "won") status = T.youWin;
  if (phase === "lost") status = T.youDefeated;

  const spec = (id, icon, label, cost) => {
    const ok = phase === "pick" && (id === "surge" ? pEn >= 3 : pEn >= 2);
    const on = special === id;
    return (
      <motion.button
        key={id} type="button" disabled={!ok} onClick={() => setSpecial(on ? null : id)}
        whileTap={ok ? { scale: 0.95 } : undefined}
        className="rounded-full px-4 py-2 text-[11px] font-semibold"
        style={on ? { background: GOLD, color: "#3b2506", boxShadow: "0 0 20px rgba(240,203,98,.7)" } : { color: "#efe8d6", ...chipStyle, opacity: ok ? 1 : 0.4 }}
      >
        {icon} {label} · {cost}
      </motion.button>
    );
  };

  return (
    <div className="w-full">
      <HpBar name={T.rival} hp={aHp} max={maxA} en={aEn} hitKey={aHit} />

      <div className="relative mx-auto my-1" style={{ height: 210 }}>
        <ArenaOrb side="a" el={aEl} hidden={!aEl} pose={pose("a")} badge={fx.as ? `⚡ ${T.surge}` : fx.ag ? `🛡 ${T.guard}` : null} hot={stage === "hit" && fx.win === "a"} />
        <ArenaOrb side="p" el={pEl} pose={pose("p")} badge={fx.ps ? `⚡ ${T.surge}` : fx.pg ? `🛡 ${T.guard}` : null} hot={stage === "hit" && fx.win === "p"} />
        {stage === "hit" && (
          <motion.div
            key={`burst${round}`} initial={{ scale: 0.2, opacity: 0.95 }} animate={{ scale: 3.4, opacity: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}
            style={{ position: "absolute", left: "50%", top: "50%", width: 80, height: 80, marginLeft: -40, marginTop: -40, borderRadius: "50%", border: "3px solid #f6dc8c", boxShadow: "0 0 30px rgba(240,203,98,.9)", pointerEvents: "none" }}
          />
        )}
      </div>

      <HpBar name={T.you} hp={pHp} max={maxP} en={pEn} hitKey={pHit} />

      <p className="mt-3 min-h-[24px] text-center font-serif text-lg font-bold" style={goldText}>{status}</p>

      {phase === "lost" ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Pill gold onClick={again}>{T.tryAgain}</Pill>
          <Pill onClick={onExit}>{T.changeLevel}</Pill>
        </div>
      ) : (
        <>
          <div className="mt-2 flex justify-center gap-2">
            {spec("surge", "⚡", T.surge, 3)}
            {spec("guard", "🛡", T.guard, 2)}
          </div>
          <p className="mt-1.5 h-4 text-center text-[11px] opacity-70">
            {special === "surge" ? T.surgeHint : special === "guard" ? T.guardHint : ""}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ELS.map((el) => (
              <motion.button
                key={el} type="button" disabled={phase !== "pick"} onClick={() => play(el)}
                whileHover={phase === "pick" ? { y: -6, scale: 1.04 } : undefined} whileTap={phase === "pick" ? { scale: 0.95 } : undefined}
                className="flex flex-col items-center gap-1.5 rounded-2xl py-3"
                style={{ background: "linear-gradient(160deg, rgba(48,42,32,.92), rgba(16,13,9,.96))", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4)", opacity: phase === "pick" ? 1 : 0.5 }}
              >
                <Orb el={el} size={58} />
                <span className="text-[11px] font-semibold">{T[el]}</span>
              </motion.button>
            ))}
          </div>
          <p className="mt-3 text-center text-[10.5px] opacity-60">{T.legend}</p>
        </>
      )}
    </div>
  );
}

/* =====================  GAME 5: DOTS AND BOXES  ===================== */
const freshBoard = (R, C) => ({ H: Array((R + 1) * C).fill(0), V: Array(R * (C + 1)).fill(0), B: Array(R * C).fill(0), sp: 0, sa: 0 });

function adjBoxes(m, R, C) {
  if (m.t === "h") {
    const r = Math.floor(m.i / C), c = m.i % C;
    return [[r - 1, c], [r, c]].filter(([a]) => a >= 0 && a < R);
  }
  const r = Math.floor(m.i / (C + 1)), c = m.i % (C + 1);
  return [[r, c - 1], [r, c]].filter(([, b]) => b >= 0 && b < C);
}
const sidesOf = (s, r, c, C) =>
  (s.H[r * C + c] ? 1 : 0) + (s.H[(r + 1) * C + c] ? 1 : 0) + (s.V[r * (C + 1) + c] ? 1 : 0) + (s.V[r * (C + 1) + c + 1] ? 1 : 0);

function applyMove(s, m, who, R, C) {
  const ns = { H: s.H.slice(), V: s.V.slice(), B: s.B.slice(), sp: s.sp, sa: s.sa };
  (m.t === "h" ? ns.H : ns.V)[m.i] = who;
  let got = 0;
  adjBoxes(m, R, C).forEach(([r, c]) => {
    if (ns.B[r * C + c] === 0 && sidesOf(ns, r, c, C) === 4) { ns.B[r * C + c] = who; got++; }
  });
  if (who === 1) ns.sp += got; else ns.sa += got;
  return { ns, got };
}
function freeMoves(s) {
  const out = [];
  s.H.forEach((v, i) => { if (!v) out.push({ t: "h", i }); });
  s.V.forEach((v, i) => { if (!v) out.push({ t: "v", i }); });
  return out;
}
const completes = (s, m, R, C) => adjBoxes(m, R, C).filter(([r, c]) => s.B[r * C + c] === 0 && sidesOf(s, r, c, C) === 3).length;
const givesBox = (s, m, R, C) => adjBoxes(m, R, C).some(([r, c]) => s.B[r * C + c] === 0 && sidesOf(s, r, c, C) === 2);

// how many boxes the opponent could grab right after this move
function grabCount(s, m, R, C) {
  let { ns } = applyMove(s, m, 2, R, C);
  let total = 0;
  for (;;) {
    const f = freeMoves(ns).find((x) => completes(ns, x, R, C) > 0);
    if (!f) break;
    const r = applyMove(ns, f, 1, R, C);
    ns = r.ns; total += r.got;
  }
  return total;
}

function aiPick(s, mode, R, C) {
  const moves = freeMoves(s);
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const take = moves.filter((m) => completes(s, m, R, C) > 0);
  if (take.length && !(mode === "careless" && Math.random() < 0.3)) return rnd(take);
  const safe = moves.filter((m) => !givesBox(s, m, R, C));
  if (mode === "careless") return Math.random() < 0.55 && safe.length ? rnd(safe) : rnd(moves);
  if (safe.length) return rnd(safe);
  if (mode === "smart") {
    let best = Infinity, pick = [];
    moves.forEach((m) => {
      const g = grabCount(s, m, R, C);
      if (g < best) { best = g; pick = [m]; } else if (g === best) pick.push(m);
    });
    return rnd(pick);
  }
  return rnd(moves);
}

function DotsGame({ cfg, T, onWin, onExit, again }) {
  const R = num(cfg.rows, 3, 2, 6), C = num(cfg.cols, 3, 2, 6);
  const mode = ["careless", "normal", "smart"].includes(cfg.ai) ? cfg.ai : "normal";
  const [st, setSt] = useState(() => freshBoard(R, C));
  const [turn, setTurn] = useState("p");
  const [res, setRes] = useState(null);
  const [hov, setHov] = useState(null);
  const token = useRef(0);
  useEffect(() => () => { token.current += 1; }, []);

  const CELL = 70, PAD = 26;
  const VW = C * CELL + PAD * 2, VH = R * CELL + PAD * 2;
  const dx = (c) => PAD + c * CELL, dy = (r) => PAD + r * CELL;
  const col = (w) => (w === 1 ? "#f0cb62" : "#4fd1c5");

  // the game ends when every box is taken
  useEffect(() => {
    if (st.sp + st.sa !== R * C) return;
    const r = st.sp > st.sa ? "win" : st.sp < st.sa ? "lose" : "draw";
    setRes(r); setTurn("over");
    if (r === "win") {
      const my = token.current;
      const id = setTimeout(() => { if (token.current === my) onWin(); }, 1500);
      return () => clearTimeout(id);
    }
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAI = async (s0) => {
    const my = token.current;
    const nap = async (ms) => { await sleep(ms); if (token.current !== my) throw STOP; };
    try {
      await nap(700);
      let s = s0;
      for (;;) {
        if (!freeMoves(s).length) break;
        const m = aiPick(s, mode, R, C);
        const { ns, got } = applyMove(s, m, 2, R, C);
        s = ns; setSt(ns);
        if (got === 0) { setTurn("p"); break; }
        await nap(800); // it closed a box, so it moves again
      }
    } catch (e) {
      if (e !== STOP) console.error(e);
    }
  };

  const place = (m) => {
    if (turn !== "p" || res) return;
    const { ns, got } = applyMove(st, m, 1, R, C);
    setSt(ns); setHov(null);
    if (got === 0 && freeMoves(ns).length) { setTurn("a"); runAI(ns); }
  };

  const edge = (t, i, x1, y1, x2, y2) => {
    const owner = (t === "h" ? st.H : st.V)[i];
    const isHov = hov && hov.t === t && hov.i === i && turn === "p" && !owner;
    const canPlay = turn === "p" && !owner && !res;
    return (
      <g key={t + i}>
        {!owner && (
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isHov ? "rgba(240,203,98,.9)" : "rgba(240,203,98,.16)"} strokeWidth={isHov ? 6 : 3} strokeLinecap="round" />
        )}
        {owner ? (
          <motion.line
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25 }}
            x1={x1} y1={y1} x2={x2} y2={y2} stroke={col(owner)} strokeWidth={6} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 5px ${col(owner)}aa)` }}
          />
        ) : null}
        {canPlay && (
          <line
            x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={28} strokeLinecap="round" style={{ cursor: "pointer" }}
            onPointerEnter={() => setHov({ t, i })} onPointerLeave={() => setHov(null)} onClick={() => place({ t, i })}
          />
        )}
      </g>
    );
  };

  const edges = [];
  for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) edges.push(edge("h", r * C + c, dx(c), dy(r), dx(c + 1), dy(r)));
  for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) edges.push(edge("v", r * (C + 1) + c, dx(c), dy(r), dx(c), dy(r + 1)));

  const msg = res === "win" ? T.youWin : res === "lose" ? T.rivalWins : res === "draw" ? T.draw : turn === "p" ? T.yourTurn : T.rivalTurn;

  return (
    <div className="flex w-full flex-col items-center">
      <div
        className="mb-3 flex w-full max-w-[400px] items-center justify-between rounded-2xl px-4 py-2.5"
        style={{ background: "linear-gradient(160deg, rgba(48,42,32,.92), rgba(16,13,9,.96))", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4)" }}
      >
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#f0cb62" }}>{T.you}</p>
          <b className="font-serif text-2xl" style={{ color: "#f0cb62" }}>{st.sp}</b>
        </div>
        <motion.p key={msg} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="px-2 text-center text-[12px] font-semibold">{msg}</motion.p>
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#4fd1c5" }}>{T.rival}</p>
          <b className="font-serif text-2xl" style={{ color: "#4fd1c5" }}>{st.sa}</b>
        </div>
      </div>

      <div style={{ perspective: 1100 }}>
        <motion.div
          initial={{ rotateX: 38, opacity: 0, y: 24 }} animate={{ rotateX: 12, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 16 }}
          style={{
            width: "min(92vw, 400px)", padding: 8, borderRadius: 20, background: "linear-gradient(145deg,#3a3126,#14100c)",
            boxShadow: "0 0 0 1.5px rgba(240,203,98,.7), 0 26px 50px rgba(0,0,0,.55)",
          }}
        >
          <div style={{ borderRadius: 12, background: "radial-gradient(ellipse at 50% 30%, #1c1810, #0b0a08)", overflow: "hidden" }}>
            <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{ display: "block" }}>
              {st.B.map((o, k) => {
                if (!o) return null;
                const r = Math.floor(k / C), c = k % C;
                return (
                  <motion.g
                    key={"b" + k} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 220, damping: 16 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  >
                    <rect x={dx(c) + 9} y={dy(r) + 9} width={CELL - 18} height={CELL - 18} rx={10} fill={col(o)} fillOpacity={0.22} stroke={col(o)} strokeOpacity={0.6} />
                    <text x={dx(c) + CELL / 2} y={dy(r) + CELL / 2 + 9} textAnchor="middle" fontSize="26" fontFamily="Georgia, serif" fill={col(o)}>{o === 1 ? "♠" : "◆"}</text>
                  </motion.g>
                );
              })}
              {edges}
              {Array.from({ length: (R + 1) * (C + 1) }).map((_, k) => (
                <circle key={k} cx={dx(k % (C + 1))} cy={dy(Math.floor(k / (C + 1)))} r={5.5} fill="url(#kg-g)" />
              ))}
            </svg>
          </div>
        </motion.div>
      </div>

      <p className="mt-4 text-center text-[11px] opacity-65">{T.boxHint}</p>
      {(res === "lose" || res === "draw") && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex flex-wrap justify-center gap-2">
          <Pill gold onClick={again}>{T.tryAgain}</Pill>
          <Pill onClick={onExit}>{T.changeLevel}</Pill>
        </motion.div>
      )}
    </div>
  );
}

/* =====================  GAME 6: MATCH THE PAIRS  ===================== */
const MEM_CARDS = [["A", "♠"], ["K", "♥"], ["Q", "♦"], ["J", "♣"], ["10", "♥"], ["9", "♠"], ["8", "♦"], ["7", "♣"], ["6", "♥"], ["5", "♠"], ["4", "♦"], ["3", "♣"]];
const shuffleArr = (a) => {
  const d = a.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
};

function Memory({ cfg, T, onWin, onExit, again }) {
  const cols = num(cfg.cols, 4, 2, 6), rows = num(cfg.rows, 3, 2, 6);
  const pairs = Math.min(MEM_CARDS.length, Math.floor((cols * rows) / 2));
  const maxMisses = num(cfg.maxMisses, 0, 0, 99);
  const previewMs = num(cfg.previewMs, 1600, 0, 6000);
  const [deck] = useState(() => shuffleArr(Array.from({ length: pairs * 2 }, (_, i) => ({ k: i % pairs }))));
  const [up, setUp] = useState([]);
  const [done, setDone] = useState([]);
  const [moves, setMoves] = useState(0);
  const [misses, setMisses] = useState(0);
  const [peek, setPeek] = useState(previewMs > 0);
  const [res, setRes] = useState(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const boxRef = useRef(null);
  const boxW = useWidth(boxRef, 340);
  const gap = 8;
  const w = Math.max(44, Math.min(96, Math.floor((boxW - gap * (cols - 1)) / cols)));
  const h = Math.round(w * 1.4);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!previewMs) return;
    const id = setTimeout(() => setPeek(false), previewMs + 700);
    return () => clearTimeout(id);
  }, [previewMs]);

  const tap = (i) => {
    if (peek || lock.current || res) return;
    if (done.includes(i) || up.includes(i)) return;
    const nu = [...up, i];
    setUp(nu);
    if (nu.length < 2) return;
    lock.current = true;
    setMoves((m) => m + 1);
    const [a, b] = nu;
    setTimeout(() => {
      if (!alive.current) return;
      if (deck[a].k === deck[b].k) {
        const nd = [...done, a, b];
        setDone(nd);
        if (nd.length === pairs * 2) {
          setRes("win");
          setTimeout(() => { if (alive.current) onWin({ moves: moves + 1 }); }, 1100);
        }
      } else {
        const nm = misses + 1;
        setMisses(nm);
        if (maxMisses && nm >= maxMisses) setRes("lose");
      }
      setUp([]);
      lock.current = false;
    }, 750);
  };

  const left = maxMisses ? Math.max(0, maxMisses - misses) : null;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em]">
        <span style={{ color: "#c9972f" }}>{T.pairs} <b className="ml-1 text-[#efe8d6]">{done.length / 2}/{pairs}</b></span>
        <span style={{ color: "#c9972f" }}>{T.moves} <b className="ml-1 text-[#efe8d6]">{moves}</b></span>
        {left !== null && (
          <span className="flex items-center gap-1" style={{ color: "#c9972f" }}>
            {T.missesLeft}
            <b className="ml-1 text-[#efe8d6]">{left}</b>
          </span>
        )}
      </div>
      <p className="mb-3 h-5 text-center text-sm font-medium">
        {res === "win" ? T.youWin : res === "lose" ? T.outOfMisses : peek ? T.memorizeCards : T.findPairs}
      </p>

      <div ref={boxRef} className="w-full">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${w}px)`, gap, justifyContent: "center" }}>
          {deck.map((c, i) => {
            const isDone = done.includes(i);
            const canTap = !peek && !lock.current && !res && !isDone && !up.includes(i);
            return (
              <motion.div
                key={i} style={{ perspective: 700 }}
                initial={{ opacity: 0, y: 28, rotateX: 50 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 120, damping: 16 }}
              >
                <motion.div
                  whileHover={canTap ? { y: -5 } : undefined} whileTap={canTap ? { scale: 0.95 } : undefined}
                  animate={isDone ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                  onClick={() => tap(i)}
                  style={{
                    cursor: canTap ? "pointer" : "default", borderRadius: w * 0.09,
                    boxShadow: isDone ? "0 0 0 2px #f0cb62, 0 0 22px rgba(240,203,98,.7)" : undefined,
                  }}
                >
                  <Flip
                    up={peek || up.includes(i) || isDone} w={w} h={h} r={w * 0.09}
                    front={<PlayingFace rank={MEM_CARDS[c.k][0]} suit={MEM_CARDS[c.k][1]} w={w} />}
                  />
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {res === "lose" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex flex-wrap justify-center gap-2">
          <Pill gold onClick={again}>{T.tryAgain}</Pill>
          <Pill onClick={onExit}>{T.changeLevel}</Pill>
        </motion.div>
      )}
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
  if (kind === "elements")
    return (
      <div style={{ display: "flex", gap: 3 }}>
        {["fire", "water", "grass"].map((e) => (
          <svg key={e} viewBox="0 0 64 64" width="18" height="18"><Glyph el={e} /></svg>
        ))}
      </div>
    );
  if (kind === "dots")
    return (
      <svg width="52" height="52" viewBox="0 0 52 52">
        <rect x="8" y="8" width="18" height="18" fill="#f0cb62" fillOpacity=".25" />
        <path d="M8 8 H26 V26 H8 Z M26 8 H44 M26 26 H44" fill="none" stroke="#f0cb62" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {[8, 26, 44].flatMap((x) => [8, 26, 44].map((y) => <circle key={x + "-" + y} cx={x} cy={y} r="3.4" fill="#f6dc8c" />))}
      </svg>
    );
  if (kind === "memory")
    return (
      <div style={{ position: "relative", width: 62, height: 52 }}>
        {[-12, 12].map((r, i) => (
          <div key={i} style={{ position: "absolute", left: 14 + i * 14, top: 4, width: 26, height: 38, transform: `rotate(${r}deg)`, transformOrigin: "50% 100%" }}>
            {i ? <CardBack r={5} /> : <PlayingFace rank="K" suit="♥" w={26} />}
          </div>
        ))}
      </div>
    );

      if (kind === "checkers")
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", width: 52, height: 52, borderRadius: 6, overflow: "hidden", boxShadow: "0 0 0 1.5px rgba(240,203,98,.6)" }}>
        {Array.from({ length: 16 }).map((_, i) => {
          const dark = (Math.floor(i / 4) + (i % 4)) % 2 === 1;
          return (
            <span key={i} style={{ background: dark ? "#2a2118" : "#d9c9a3", display: "grid", placeItems: "center" }}>
              {dark && (i < 4 || i > 11) && <i style={{ width: 9, height: 9, borderRadius: "50%", background: i < 4 ? "#2fc4b8" : "#f0cb62" }} />}
            </span>
          );
        })}
      </div>
    );
  if (kind === "higherlower")
    return (
      <div style={{ position: "relative", width: 62, height: 52 }}>
        {[[-10, "K", "♠"], [10, "3", "♥"]].map(([r, rk, su], i) => (
          <div key={i} style={{ position: "absolute", left: 12 + i * 14, top: 4, width: 26, height: 38, transform: `rotate(${r}deg)`, transformOrigin: "50% 100%" }}>
            <PlayingFace rank={rk} suit={su} w={26} />
          </div>
        ))}
        <b style={{ ...goldText, position: "absolute", right: 0, top: 0, fontSize: 14 }}>▲</b>
        <b style={{ ...goldText, position: "absolute", right: 0, bottom: 0, fontSize: 14 }}>▼</b>
      </div>
    );
  if (kind === "watersort")
    return (
      <div style={{ display: "flex", gap: 5 }}>
        {[["#ff3b5c", "#3bd16f"], ["#2f8bff", "#ffb020"], ["#a64dff", "#18d3d1"]].map((cs, i) => (
          <div key={i} style={{ width: 14, height: 48, borderRadius: "3px 3px 8px 8px", overflow: "hidden", display: "flex", flexDirection: "column-reverse", boxShadow: "inset 0 0 0 1.5px rgba(200,240,240,.6)" }}>
            {cs.map((c, j) => <span key={j} style={{ height: "28%", background: c }} />)}
          </div>
        ))}
      </div>
    );
  if (kind === "snake")
    return (
      <svg width="56" height="52" viewBox="0 0 56 52">
        <path d="M6 40 H28 V16 H44" fill="none" stroke="#0d3a2a" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 40 H28 V16 H44" fill="none" stroke="#2fae7d" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 40 H28 V16 H44" fill="none" stroke="#4ed19a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="46" cy="16" r="5" fill="#f0cb62" />
        <circle cx="50" cy="44" r="4" fill="#f6dc8c" />
      </svg>
    );

  return <div className="font-serif text-[34px] font-bold leading-none" style={goldText}>21</div>;
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

const UI = { Pill, goldText, GOLD, chipStyle, Flip, PlayingFace, CardBack, sleep, STOP, num, useWidth };
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
  const [result, setResult] = useState(null); // the score of the game that was just won
  const [link, setLink] = useState(null); // a challenge that came from a shared link
  const soc = useSocial(cfg); // sharing, challenge links, leaderboard, daily challenge, personal bests
  const originRef = useRef(origin);
  const winTimer = useRef(null);
  const loadP = useRef(null);
  const startAt = useRef(0);
  const stepRef = useRef("hub");
  originRef.current = origin;
  stepRef.current = step;

  // loads the games table, the card and the social settings (once)
  const ensure = () => {
    if (!loadP.current) {
      loadP.current = Promise.all([
        supabase.from("games").select("*"),
        supabase.from("card").select("*").eq("id", 1).maybeSingle(),
        soc.load(),
      ])
        .then(([g, c]) => {
          let merged = DEFAULTS;
          if (!g.error && g.data?.length) { merged = mergeCfg(g.data); setCfg(merged); }
          if (!c.error && c.data) setCardRow(c.data);
          return merged;
        })
        .catch(() => DEFAULTS);
    }
    return loadP.current;
  };

  // the navbar button
  useEffect(() => {
    const h = (e) => {
      const o = e.detail || { x: window.innerWidth - 60, y: 60 };
      setOrigin(o); setStep("hub"); setGame(null); setResult(null); setLink(null); setOpen(true);
      ensure();
    };
    window.addEventListener("open-king-games", h);
    return () => window.removeEventListener("open-king-games", h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // a shared link:  ?play=snake&lv=hard&t=47&by=Rahul   (or ?play=hub)
  useEffect(() => {
    const lk = readLink();
    if (!lk) return undefined;
    let dead = false;
    (async () => {
      const merged = await ensure();
      const st = await soc.load();
      if (dead || st.deeplinks === false) return;
      const key = lk.play;
      if (key !== "hub" && !(merged[key] && merged[key].enabled)) return;
      await sleep(Number(st.link_delay_ms) || 900);
      if (dead) return;
      clearLink();
      setOrigin({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      setResult(null);
      if (key === "hub") { setGame(null); setLink(null); setStep("hub"); }
      else {
        const lv = LEVELS.includes(lk.lv) && merged[key].levels[lk.lv] && merged[key].levels[lk.lv].enabled !== false ? lk.lv : "easy";
        setGame(key); setLevel(lv);
        if (lk.t) { setLink({ ...lk, play: key, lv }); setStep("challenge"); }
        else { setLink(null); setStep("level"); }
      }
      setOpen(true);
    })();
    return () => { dead = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // leaderboard of the game whose levels are on screen
  useEffect(() => {
    if (open && step === "level" && game && soc.settings.leaderboard) soc.loadBoard(game);
  }, [open, step, game, soc.settings.leaderboard]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // starts a game and the stopwatch
  const beginPlay = (k, lv) => {
    setGame(k); setLevel(lv); setResult(null);
    startAt.current = performance.now();
    setStep("play");
  };
  // a game reports its win here. `stats` may carry { secs, moves }
  const win = (stats = {}) => {
    if (stepRef.current !== "play") return;
    const secs =
      typeof stats.secs === "number" && stats.secs > 0
        ? stats.secs
        : Math.max(1, Math.round((performance.now() - startAt.current) / 1000));
    setResult(soc.record({ game, level, secs, moves: stats.moves, link }));
    setStep("win");
    clearTimeout(winTimer.current);
    const auto = Number(soc.settings.auto_open_ms) || 0;
    if (auto > 0) winTimer.current = setTimeout(openCard, auto);
  };
  const back = () => {
    if (step === "play" || step === "win") setStep("level");
    else if (step === "level" || step === "challenge") setStep("hub");
    else close();
  };

  if (typeof document === "undefined") return null;

  const games = Object.keys(cfg).filter((k) => cfg[k].enabled).sort((a, b) => cfg[a].sort - cfg[b].sort);
  const R = Math.hypot(window.innerWidth, window.innerHeight) + 120;
  const c0 = `circle(0px at ${origin.x}px ${origin.y}px)`;
  const c1 = `circle(${R}px at ${origin.x}px ${origin.y}px)`;
  const g = game ? cfg[game] : null;
  const lvCfg = g ? g.levels[level] || {} : {};
  const openLevels = g ? LEVELS.filter((lv) => g.levels[lv] && g.levels[lv].enabled !== false) : [];
    // fastest time you have on any level of a game
  const bestAny = (k) => {
    let m = null;
    LEVELS.forEach((l) => { const b = soc.bestOf(k, l); if (b && (m === null || b.secs < m)) m = b.secs; });
    return m;
  };

  return createPortal(
    <>
      <style>{CSS}</style>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="kg-g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff3bf" /><stop offset=".3" stopColor="#f0cb62" /><stop offset=".6" stopColor="#b8862b" />
            <stop offset=".82" stopColor="#f6dc8c" /><stop offset="1" stopColor="#c9972f" />
          </linearGradient>
                    <linearGradient id="kg-fire" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ffd36b" /><stop offset=".5" stopColor="#ff7a3d" /><stop offset="1" stopColor="#d6361f" />
          </linearGradient>
          <linearGradient id="kg-water" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#bfe6ff" /><stop offset=".5" stopColor="#4aa8ff" /><stop offset="1" stopColor="#1d5fc2" />
          </linearGradient>
          <linearGradient id="kg-grass" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor="#1f8a3a" /><stop offset=".5" stopColor="#58d068" /><stop offset="1" stopColor="#c8f59a" />
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

                        <DailyCard lang={lang} soc={soc} titleOf={(k) => tx(cfg[k].title, lang)} lvLabel={(l) => T[l]} onPlay={beginPlay} />

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
                            
                              {bestAny(k) !== null && (
                             <span className="mt-1 block text-[11px] font-semibold" style={{ color: "#e8c15a" }}>★ {fmtTime(bestAny(k))}</span>
                                )}
                              </div>
                            </motion.button>
                          ))}
                        </div>

                        <HubFooter lang={lang} soc={soc} />
                      </div>
                    )}

                    {step === "challenge" && link && cfg[link.play] && (
                      <ChallengeScreen
                        lang={lang} link={link} art={art}
                        gameTitle={tx(cfg[link.play].title, lang)} levelLabel={T[link.lv]}
                        onAccept={() => beginPlay(link.play, link.lv)} onOther={() => setStep("hub")}
                      />
                    )}

                    {step === "level" && g && (
                      <div className="mx-auto max-w-[420px]">
                        <div className="text-center">
                          <div className="mx-auto grid h-16 w-20 place-items-center"><GameArt kind={game} /></div>
                          <h2 className="mt-2 font-serif text-3xl font-bold" style={goldText}>{tx(g.title, lang)}</h2>
                          <p className="mt-1 text-sm opacity-70">{T.chooseLevel}</p>
                        </div>
                        <div className="mt-5 space-y-3">
                          {openLevels.map((lv, i) => {
                            const b = soc.bestOf(game, lv);
                            return (
                              <motion.button
                                key={lv} type="button" onClick={() => beginPlay(game, lv)}
                                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i, type: "spring", stiffness: 160, damping: 18 }}
                                whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }}
                                className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left"
                                style={{ background: "linear-gradient(160deg, rgba(48,42,32,.92), rgba(16,13,9,.96))", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4), 0 10px 24px rgba(0,0,0,.4)" }}
                              >
                                <span>
                                  <b className="block font-serif text-xl" style={goldText}>{T[lv]}</b>
                                  <span className="mt-0.5 block text-[12px] opacity-70">{levelInfo(game, g.levels[lv], T)}</span>
                                  {b && <span className="mt-1 block text-[11px] font-semibold" style={{ color: "#e8c15a" }}>★ {fmtTime(b.secs)}</span>}
                                </span>
                                <Dots n={i + 1} />
                              </motion.button>
                            );
                          })}
                        </div>
                        {soc.settings.leaderboard && (
                          <Leaderboard lang={lang} rows={soc.boards[game]} levels={openLevels} size={soc.settings.board_size} lvLabel={(l) => T[l]} />
                        )}
                      </div>
                    )}

                    {step === "play" && g && (
                      <div className="mx-auto w-full max-w-[520px]">
                        <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "#c9972f" }}>{tx(g.title, lang)} · {T[level]}</p>
                        {link && link.t > 0 && link.play === game && link.lv === level && <ChallengeChip lang={lang} link={link} />}
                        {game === "puzzle" && <Puzzle key={level} cfg={lvCfg} art={art} T={T} onWin={win} />}
                        {game === "find" && <Find key={level} cfg={lvCfg} art={art} T={T} onWin={win} onExit={() => setStep("level")} />}
                        {game === "blackjack" && <Blackjack key={level} cfg={lvCfg} T={T} onWin={win} onExit={() => setStep("level")} />}
                        {game === "elements" && <Retryable Game={Elements} key={level} cfg={lvCfg} T={T} onWin={win} onExit={() => setStep("level")} />}
                        {game === "dots" && <Retryable Game={DotsGame} key={level} cfg={lvCfg} T={T} onWin={win} onExit={() => setStep("level")} />}
                        {game === "memory" && <Retryable Game={Memory} key={level} cfg={lvCfg} T={T} onWin={win} onExit={() => setStep("level")} />}

                        {game === "checkers" && <Retryable Game={Checkers} ui={UI} key={level} cfg={lvCfg} T={T} onWin={win} onExit={() => setStep("level")} />}
                        {game === "higherlower" && <Retryable Game={HigherLower} ui={UI} key={level} cfg={lvCfg} T={T} onWin={win} onExit={() => setStep("level")} />}
                        {game === "watersort" && <Retryable Game={WaterSort} ui={UI} key={level} cfg={lvCfg} T={T} onWin={win} onExit={() => setStep("level")} />}
                        {game === "snake" && <Retryable Game={SnakeGame} ui={UI} key={level} cfg={lvCfg} T={T} onWin={win} onExit={() => setStep("level")} />}
                      </div>
                    )}

                    {step === "win" && result && cfg[result.game] && (
                      <ResultScreen
                        lang={lang} T={T} art={art} res={result} soc={soc}
                        gameTitle={tx(cfg[result.game].title, lang)} levelLabel={T[result.level]} lvLabel={(l) => T[l]}
                        levels={LEVELS.filter((lv) => cfg[result.game].levels[lv] && cfg[result.game].levels[lv].enabled !== false)}
                        onOpen={openCard}
                        onReplay={() => beginPlay(result.game, result.level)}
                        onLevels={() => setStep("level")}
                      />
                    )}
                    {step === "win" && !result && <WinScreen art={art} T={T} onOpen={openCard} />}

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