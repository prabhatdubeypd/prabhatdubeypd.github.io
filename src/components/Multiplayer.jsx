import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { tx } from "../lib/i18n";
import { makeLink, fmtTime } from "./GameSocial";

/* ---------- look ---------- */
const GOLD = "linear-gradient(180deg,#fff3bf 0%,#f0cb62 30%,#b8862b 58%,#f6dc8c 80%,#c9972f 100%)";
const goldText = { backgroundImage: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
const chipStyle = { boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5)", background: "rgba(20,14,6,.55)" };
const PANEL = {
  background: "linear-gradient(160deg, rgba(48,42,32,.92), rgba(16,13,9,.96))",
  boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4)",
};
const LEVELS = ["easy", "medium", "hard"];
const DUELS = ["dots", "memory", "checkers"]; // played turn by turn on one shared board (online)
const PASS = ["dots", "checkers"]; // two players, one phone (Pass & Play)
const NULL_NET = { send() {}, on: () => () => {} };
/* which ways a game can be played with a friend */
const modesOf = (k) => ["race", ...(DUELS.includes(k) ? ["duel"] : []), ...(PASS.includes(k) ? ["pass"] : [])];
const defMode = (k) => (DUELS.includes(k) ? "duel" : "race");
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ""));
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");

/* ---------- texts ---------- */
const MT = {
  en: {
    hubBtn: "Play with a friend", hubSub: "Invite someone and play live",
    title: "Play with a friend", pick: "Pick a game", duel: "Duel", race: "Race",
    duelHint: "Take turns against each other", raceHint: "Both play at once. First to finish wins",
    chooseLevel: "Choose a level", yourName: "Your name", create: "Create room",
    lobby: "Invite your friend", code: "Room code", copy: "Copy link", copied: "Link copied!", share: "Share invite",
    inviteText: "Play {game} with me live! Join my room:",
    waiting: "Waiting for your friend…", joined: "{name} joined!", start: "Start game",
    waitHost: "Waiting for {name} to start…", connecting: "Connecting…",
    invited: "{by} invited you to play", joinBtn: "Join the game",
    full: "This room is full.", gone: "Room not found. Ask your friend for a new link.",
    net: "Connection problem. Please try again.", left: "{name} left the room.",
    vs: "vs", you: "You", friend: "Friend", yourTurn: "Your turn", theirTurn: "{name}'s turn",
    go: "GO!", racing: "{name} is playing…", wait: "Checking the result…",
    youWon: "You won!", youLost: "{name} won", draw: "It's a draw", wonSub: "The King is yours", lostSub: "So close. Want a rematch?",
    openCard: "Open the card", rematch: "Rematch", rematchWait: "Waiting for {name}…", rematchAsk: "{name} wants a rematch",
    leave: "Leave room", back: "Back",
    pass: "Pass & Play",
    howTo: "How do you want to play?",
    passHint: "Two players take turns on this phone",
    joinCodeTitle: "Got a room code?", joinCodeBtn: "Join room",
    badCode: "That code looks too short.", codeHint: "Type the 5-letter code your friend gave you",
    p1: "Player 1", p2: "Player 2", startNow: "Start playing",
  },
  hi: {
    hubBtn: "दोस्त के साथ खेलें", hubSub: "किसी को बुलाएँ और साथ खेलें",
    title: "दोस्त के साथ खेलें", pick: "गेम चुनें", duel: "आमने-सामने", race: "रेस",
    duelHint: "बारी-बारी से खेलें", raceHint: "दोनों साथ खेलें। जो पहले पूरा करे वही जीते",
    chooseLevel: "लेवल चुनें", yourName: "आपका नाम", create: "रूम बनाएँ",
    lobby: "अपने दोस्त को बुलाएँ", code: "रूम कोड", copy: "लिंक कॉपी करें", copied: "लिंक कॉपी हो गया!", share: "न्योता भेजें",
    inviteText: "मेरे साथ {game} लाइव खेलें! मेरे रूम में जुड़ें:",
    waiting: "दोस्त का इंतज़ार…", joined: "{name} आ गया!", start: "गेम शुरू करें",
    waitHost: "{name} के शुरू करने का इंतज़ार…", connecting: "जुड़ रहा है…",
    invited: "{by} ने आपको खेलने बुलाया है", joinBtn: "गेम में जुड़ें",
    full: "यह रूम भर चुका है।", gone: "रूम नहीं मिला। दोस्त से नया लिंक माँगें।",
    net: "कनेक्शन में दिक्कत। फिर कोशिश करें।", left: "{name} रूम छोड़कर चला गया।",
    vs: "बनाम", you: "आप", friend: "दोस्त", yourTurn: "आपकी बारी", theirTurn: "{name} की बारी",
    go: "शुरू!", racing: "{name} खेल रहा है…", wait: "नतीजा देखा जा रहा है…",
    youWon: "आप जीते!", youLost: "{name} जीता", draw: "बराबरी", wonSub: "किंग अब आपका है", lostSub: "बहुत करीब थे। फिर खेलें?",
    openCard: "कार्ड खोलें", rematch: "रीमैच", rematchWait: "{name} का इंतज़ार…", rematchAsk: "{name} रीमैच चाहता है",
    leave: "रूम छोड़ें", back: "वापस",
    pass: "पास करें & खेलें",
    howTo: "कैसे खेलना है?",
    passHint: "दो खिलाड़ी इसी फ़ोन पर बारी-बारी खेलें",
    joinCodeTitle: "रूम कोड है?", joinCodeBtn: "रूम में जुड़ें",
    badCode: "कोड बहुत छोटा है।", codeHint: "दोस्त से मिला 5 अक्षरों का कोड डालें",
    p1: "खिलाड़ी 1", p2: "खिलाड़ी 2", startNow: "खेलना शुरू करें",
  },
};

/* ---------- invite links:  ?room=ABCDE&g=dots&lv=easy&by=Rahul ---------- */
export function readRoomLink() {
  try {
    const q = new URLSearchParams(window.location.search);
    const room = (q.get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (!room) return null;
    return {
      room,
      g: (q.get("g") || "").slice(0, 24),
      lv: (q.get("lv") || "").slice(0, 10),
      by: (q.get("by") || "").replace(/[<>]/g, "").slice(0, 20),
    };
  } catch { return null; }
}
export function clearRoomLink() {
  try {
    const u = new URL(window.location.href);
    ["room", "g", "lv", "by"].forEach((k) => u.searchParams.delete(k));
    window.history.replaceState({}, "", u.pathname + (u.search || "") + u.hash);
  } catch { /* ignore */ }
}

/* =====================================================================
   THE LIVE CONNECTION: a Supabase Realtime channel (no table needed)
   ===================================================================== */
function listPeers(ch, myId) {
  const out = [];
  const st = ch.presenceState();
  Object.entries(st).forEach(([k, arr]) => {
    if (k === myId) return;
    const m = arr && arr[0];
    if (m) out.push({ id: k, name: m.name || "", role: m.role || "" });
  });
  return out;
}
function useRoom() {
  const chRef = useRef(null);
  const hs = useRef(new Set());
  const idRef = useRef(Math.random().toString(36).slice(2, 10));
  const [peers, setPeers] = useState([]);
  const [state, setState] = useState("idle"); // idle | connecting | open | error

  const leave = () => {
    if (chRef.current) {
      try { supabase.removeChannel(chRef.current); } catch { /* ignore */ }
      chRef.current = null;
    }
    setPeers([]);
    setState("idle");
  };
  const join = (code, meta) => {
    leave();
    setState("connecting");
    const me = idRef.current;
    const ch = supabase.channel(`kg-${code}`, { config: { broadcast: { self: false }, presence: { key: me } } });
    ch.on("broadcast", { event: "m" }, ({ payload }) => hs.current.forEach((h) => h(payload)));
    ch.on("presence", { event: "sync" }, () => setPeers(listPeers(ch, me)));
    ch.subscribe(async (s) => {
      if (s === "SUBSCRIBED") {
        try { await ch.track(meta); } catch { /* ignore */ }
        setState("open");
      } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setState("error");
    });
    chRef.current = ch;
  };
  const send = (p) => {
    try { chRef.current?.send({ type: "broadcast", event: "m", payload: { ...p, from: idRef.current } }); } catch { /* ignore */ }
  };
  const on = (fn) => { hs.current.add(fn); return () => { hs.current.delete(fn); }; };
  useEffect(() => () => leave(), []); // eslint-disable-line react-hooks/exhaustive-deps
  return { join, leave, send, on, peers, state, id: idRef.current };
}

/* ---------- small pieces ---------- */
const Btn = ({ children, onClick, gold, disabled }) => (
  <motion.button
    type="button" onClick={onClick} disabled={disabled}
    whileHover={disabled ? undefined : { scale: 1.05 }} whileTap={disabled ? undefined : { scale: 0.96 }}
    className="rounded-full px-5 py-2.5 text-[12px] font-semibold"
    style={gold
      ? { background: GOLD, color: "#3b2506", boxShadow: "0 6px 16px rgba(0,0,0,.45)", opacity: disabled ? 0.5 : 1 }
      : { color: "#efe8d6", ...chipStyle, opacity: disabled ? 0.5 : 1 }}
  >
    {children}
  </motion.button>
);

function InviteBar({ S, url, text }) {
  const [note, setNote] = useState("");
  const flash = (m) => { setNote(m); setTimeout(() => setNote(""), 2400); };
  const copy = async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch { /* try the old way */ }
    if (!ok) {
      try {
        const a = document.createElement("textarea");
        a.value = url; a.style.position = "fixed"; a.style.opacity = "0";
        document.body.appendChild(a); a.select();
        ok = document.execCommand("copy");
        a.remove();
      } catch { ok = false; }
    }
    flash(ok ? S.copied : url);
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: "King of Spades", text, url }); } catch { /* cancelled */ } }
    else copy();
  };
  const wa = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
  return (
    <div className="mt-4">
      <div className="break-all rounded-xl px-3 py-2 text-left font-mono text-[11px] opacity-80" style={chipStyle}>{url}</div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Btn gold onClick={share}>↗ {S.share}</Btn>
        <Btn onClick={wa}>WhatsApp</Btn>
        <Btn onClick={copy}>🔗 {S.copy}</Btn>
      </div>
      <p className="mt-2 min-h-[16px] text-[11px]" style={{ color: "#e8c15a" }}>{note}</p>
    </div>
  );
}

/* =====================================================================
   DUEL 1: DOTS AND BOXES (both players see the same board, turn by turn)
   ===================================================================== */
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

function DotsDuel({ ui, lc, role, names, net, onFinish, S }) {
  const num = ui.num;
  const R = num(lc.rows, 3, 2, 6), C = num(lc.cols, 3, 2, 6);
  const local = role === "local";
  const me = role === "host" ? 1 : role === "guest" ? 2 : 0;
  const G = useRef({ st: freshBoard(R, C), turn: 1, over: false });
  const [, bump] = useState(0);
  const re = () => bump((n) => n + 1);
  const [hov, setHov] = useState(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const apply = (m, who) => {
    const g = G.current;
    if (g.over || g.turn !== who) return false;
    const arr = m.t === "h" ? g.st.H : g.st.V;
    if (!(m.i >= 0 && m.i < arr.length) || arr[m.i]) return false;
    const { ns, got } = applyMove(g.st, m, who, R, C);
    g.st = ns;
    if (got === 0) g.turn = who === 1 ? 2 : 1; // a closed box means you go again
    if (ns.sp + ns.sa === R * C) {
      g.over = true;
      const w = ns.sp > ns.sa ? "host" : ns.sa > ns.sp ? "guest" : "draw";
      setTimeout(() => { if (alive.current) onFinish(w); }, 1100);
    }
    re();
    return true;
  };
  const place = (m) => {
    if (local) { apply(m, G.current.turn); return; }
    if (G.current.turn !== me) return;
    if (apply(m, me)) net.send({ t: "edge", e: m });
  };
  useEffect(() => net.on((msg) => {
    if (msg.t === "edge" && msg.e) apply({ t: msg.e.t === "v" ? "v" : "h", i: Number(msg.e.i) }, me === 1 ? 2 : 1);
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const g = G.current;
  const st = g.st;
  const CELL = 70, PAD = 26;
  const VW = C * CELL + PAD * 2, VH = R * CELL + PAD * 2;
  const dx = (c) => PAD + c * CELL, dy = (r) => PAD + r * CELL;
  const col = (w) => (w === 1 ? "#f0cb62" : "#4fd1c5");
  const canPlayNow = !g.over && (local || g.turn === me);

  const edge = (t, i, x1, y1, x2, y2) => {
    const owner = (t === "h" ? st.H : st.V)[i];
    const isHov = hov && hov.t === t && hov.i === i && canPlayNow && !owner;
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
        {canPlayNow && !owner && (
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

  const msg = g.over
    ? ""
    : local
    ? fmt(S.theirTurn, { name: g.turn === 1 ? names.host : names.guest })
    : g.turn === me ? S.yourTurn : fmt(S.theirTurn, { name: me === 1 ? names.guest : names.host });

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-3 flex w-full max-w-[400px] items-center justify-between rounded-2xl px-4 py-2.5" style={PANEL}>
        <div className="min-w-0 text-center">
          <p className="max-w-[90px] truncate font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "#f0cb62" }}>{names.host}</p>
          <b className="font-serif text-2xl" style={{ color: "#f0cb62" }}>{st.sp}</b>
        </div>
        <motion.p key={msg} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="px-2 text-center text-[12px] font-semibold">{msg}</motion.p>
        <div className="min-w-0 text-center">
          <p className="max-w-[90px] truncate font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "#4fd1c5" }}>{names.guest}</p>
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
    </div>
  );
}

/* =====================================================================
   DUEL 2: MATCH THE PAIRS (same deck for both, take turns flipping)
   ===================================================================== */
function MemoryDuel({ ui, lc, deck, role, names, net, onFinish, S }) {
  const { Flip, PlayingFace, MEM_CARDS, num, useWidth } = ui;
  const cols = num(lc.cols, 4, 2, 6);
  const previewMs = num(lc.previewMs, 1600, 0, 6000);
  const G = useRef({ up: [], done: [], owner: {}, turn: "host", score: { host: 0, guest: 0 }, lock: false, over: false, queue: [] });
  const [, bump] = useState(0);
  const re = () => bump((n) => n + 1);
  const [peek, setPeek] = useState(previewMs > 0);
  const peekRef = useRef(previewMs > 0);
  const alive = useRef(true);
  const boxRef = useRef(null);
  const boxW = useWidth(boxRef, 340);
  const gap = 8;
  const w = Math.max(44, Math.min(92, Math.floor((boxW - gap * (cols - 1)) / cols)));
  const h = Math.round(w * 1.4);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!previewMs) return undefined;
    const id = setTimeout(() => { peekRef.current = false; setPeek(false); }, previewMs + 700);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flip = (i, who) => {
    const g = G.current;
    if (g.over || g.lock || peekRef.current || g.turn !== who) return false;
    if (!(i >= 0 && i < deck.length) || g.done.includes(i) || g.up.includes(i)) return false;
    g.up.push(i);
    re();
    if (g.up.length === 2) resolve(who);
    return true;
  };
  const resolve = (who) => {
    const g = G.current;
    g.lock = true;
    re();
    setTimeout(() => {
      if (!alive.current) return;
      const [a, b] = g.up;
      if (deck[a] === deck[b]) {
        g.done.push(a, b); g.owner[a] = who; g.owner[b] = who; g.score[who] += 1;
      } else g.turn = who === "host" ? "guest" : "host";
      g.up = [];
      g.lock = false;
      if (g.done.length === deck.length) {
        g.over = true;
        const w2 = g.score.host > g.score.guest ? "host" : g.score.guest > g.score.host ? "guest" : "draw";
        setTimeout(() => { if (alive.current) onFinish(w2); }, 900);
      } else {
        while (g.queue.length && !g.lock) { const [qi, qw] = g.queue.shift(); flip(qi, qw); }
      }
      re();
    }, 800);
  };
  const tap = (i) => {
    const g = G.current;
    if (role !== g.turn || g.lock || peekRef.current) return;
    if (flip(i, role)) net.send({ t: "flip", i });
  };
  useEffect(() => net.on((msg) => {
    if (msg.t !== "flip") return;
    const who = role === "host" ? "guest" : "host";
    if (G.current.lock) G.current.queue.push([Number(msg.i), who]);
    else flip(Number(msg.i), who);
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const g = G.current;
  const other = role === "host" ? names.guest : names.host;
  const msg = g.over ? "" : peek ? "…" : g.turn === role ? S.yourTurn : fmt(S.theirTurn, { name: other });
  const ownerCol = (i) => (g.owner[i] === "host" ? "#f0cb62" : "#4fd1c5");

  return (
    <div className="w-full">
      <div className="mb-3 flex w-full items-center justify-between rounded-2xl px-4 py-2.5" style={PANEL}>
        <div className="min-w-0 text-center">
          <p className="max-w-[90px] truncate font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "#f0cb62" }}>{names.host}</p>
          <b className="font-serif text-2xl" style={{ color: "#f0cb62" }}>{g.score.host}</b>
        </div>
        <motion.p key={msg} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="px-2 text-center text-[12px] font-semibold">{msg}</motion.p>
        <div className="min-w-0 text-center">
          <p className="max-w-[90px] truncate font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "#4fd1c5" }}>{names.guest}</p>
          <b className="font-serif text-2xl" style={{ color: "#4fd1c5" }}>{g.score.guest}</b>
        </div>
      </div>
      <div ref={boxRef} className="w-full">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${w}px)`, gap, justifyContent: "center" }}>
          {deck.map((pid, i) => {
            const isDone = g.done.includes(i);
            const canTap = !peek && !g.lock && !g.over && g.turn === role && !isDone && !g.up.includes(i);
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
                    boxShadow: isDone ? `0 0 0 2px ${ownerCol(i)}, 0 0 22px ${ownerCol(i)}99` : undefined,
                  }}
                >
                  <Flip
                    up={peek || g.up.includes(i) || isDone} w={w} h={h} r={w * 0.09}
                    front={<PlayingFace rank={MEM_CARDS[pid][0]} suit={MEM_CARDS[pid][1]} w={w} />}
                  />
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   PASS & PLAY: CHECKERS (two players, one phone — no AI, no network)
   ===================================================================== */
const CK_DIRS = { k: [[-1, -1], [-1, 1], [1, -1], [1, 1]], 1: [[-1, -1], [-1, 1]], 2: [[1, -1], [1, 1]] };
let CKN = 1;
const ckInit = () => {
  const list = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r < 3) list.push({ id: CKN++, r, c, p: 2, k: false });
      else if (r > 4) list.push({ id: CKN++, r, c, p: 1, k: false });
    }
  return list;
};
const ckGrid = (list) => {
  const g = Array.from({ length: 8 }, () => Array(8).fill(null));
  list.forEach((p) => { g[p.r][p.c] = { p: p.p, k: p.k }; });
  return g;
};
function ckChains(g, r, c, pc, caps, path, out) {
  const dirs = pc.k ? CK_DIRS.k : CK_DIRS[pc.p];
  let any = false;
  for (const [dr, dc] of dirs) {
    const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
    if (tr < 0 || tr > 7 || tc < 0 || tc > 7) continue;
    const mid = g[mr][mc];
    if (!mid || mid.p === pc.p || g[tr][tc] || caps.some(([x, y]) => x === mr && y === mc)) continue;
    any = true;
    const crowned = !pc.k && tr === (pc.p === 1 ? 0 : 7);
    const ncaps = [...caps, [mr, mc]];
    const npath = [...path, [tr, tc]];
    if (crowned) out.push({ path: npath, caps: ncaps }); // a new king ends the turn
    else ckChains(g, tr, tc, pc, ncaps, npath, out);
  }
  if (!any && caps.length) out.push({ path, caps });
}
function ckMoves(g, side) {
  const jumps = [], steps = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const pc = g[r][c];
      if (!pc || pc.p !== side) continue;
      g[r][c] = null;
      const out = [];
      ckChains(g, r, c, pc, [], [], out);
      g[r][c] = pc;
      out.forEach((o) => jumps.push({ fr: r, fc: c, ...o }));
      for (const [dr, dc] of pc.k ? CK_DIRS.k : CK_DIRS[pc.p]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !g[nr][nc]) steps.push({ fr: r, fc: c, path: [[nr, nc]], caps: [] });
      }
    }
  return jumps.length ? jumps : steps; // capturing is mandatory
}

function CheckersGame({ ui, T, S, role, names, net, onFinish }) {
  const { useWidth } = ui;
  const local = role === "local";
  const me = role === "host" ? 1 : role === "guest" ? 2 : 0; // host = gold (bottom), guest = teal (top)
  const [pieces, setPieces] = useState(ckInit);
  const [turn, setTurn] = useState(1);
  const [sel, setSel] = useState(null);
  const [res, setRes] = useState(null);
  const [last, setLast] = useState(null);
  const alive = useRef(true);
  const boxRef = useRef(null);
  const boxW = useWidth(boxRef, 360);
  const netMove = useRef(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const size = Math.floor(Math.min(boxW, 400));
  const bd = size - 16;
  const cell = bd / 8;
  const grid = ckGrid(pieces);
  const moves = turn ? ckMoves(grid, turn) : [];
  const canAct = local || turn === me; // online: only on your own turn
  const selPiece = sel ? pieces.find((x) => x.id === sel) : null;
  const dests = selPiece && turn && canAct ? moves.filter((m) => m.fr === selPiece.r && m.fc === selPiece.c) : [];
  const dkey = (m) => { const e = m.path[m.path.length - 1]; return `${e[0]}-${e[1]}`; };
  const destSet = new Set(dests.map(dkey));
  const mustJump = canAct && moves.length > 0 && moves[0].caps.length > 0;

  const finish = (w) => {
    setRes(w); setTurn(0); setSel(null);
    setTimeout(() => { if (alive.current) onFinish(w); }, 1200);
  };

  const doMove = (m, who, fromNet) => {
    const mover = pieces.find((x) => x.r === m.fr && x.c === m.fc);
    if (!mover) return;
    let cur = pieces.filter((x) => !m.caps.some(([r, c]) => x.r === r && x.c === c));
    const end = m.path[m.path.length - 1];
    cur = cur.map((x) => (x.id === mover.id ? { ...x, r: end[0], c: end[1] } : x));
    if (!mover.k && end[0] === (who === 1 ? 0 : 7)) cur = cur.map((x) => (x.id === mover.id ? { ...x, k: true } : x));
    setPieces(cur);
    setLast({ from: [m.fr, m.fc], to: end });
    setSel(null);
    if (!local && !fromNet) net.send({ t: "ck", m: { fr: m.fr, fc: m.fc, path: m.path, caps: m.caps } });
    const opp = who === 1 ? 2 : 1;
    if (!ckMoves(ckGrid(cur), opp).length) { finish(who === 1 ? "host" : "guest"); return; }
    setTurn(opp);
  };

  // the friend's move: only accepted if it is really a legal move for them right now
  netMove.current = (m) => {
    if (local || res || !m) return;
    const opp = me === 1 ? 2 : 1;
    if (turn !== opp) return;
    const legal = ckMoves(ckGrid(pieces), opp).find(
      (x) => x.fr === m.fr && x.fc === m.fc && JSON.stringify(x.path) === JSON.stringify(m.path)
    );
    if (legal) doMove(legal, opp, true);
  };
  useEffect(() => net.on((msg) => { if (msg.t === "ck") netMove.current && netMove.current(msg.m); }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const clickPiece = (pc) => {
    if (!turn || res || !canAct || pc.p !== turn) return;
    if (sel === pc.id) { setSel(null); return; }
    if (moves.some((m) => m.fr === pc.r && m.fc === pc.c)) setSel(pc.id);
  };
  const clickSquare = (r, c) => {
    if (!turn || res || !canAct || !selPiece) return;
    const m = dests.find((x) => dkey(x) === `${r}-${c}`);
    if (m) doMove(m, turn, false);
  };

  const n1 = pieces.filter((x) => x.p === 1).length;
  const n2 = pieces.filter((x) => x.p === 2).length;
  const status =
    res === "draw" ? S.draw
    : res ? (local || res !== role ? fmt(S.youLost, { name: names[res] }) : S.youWon)
    : local ? fmt(S.theirTurn, { name: turn === 1 ? names.host : names.guest })
    : turn === me ? S.yourTurn : fmt(S.theirTurn, { name: me === 1 ? names.guest : names.host });

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-3 flex w-full max-w-[400px] items-center justify-between rounded-2xl px-4 py-2.5" style={PANEL}>
        <div className="min-w-0 text-center">
          <p className="max-w-[92px] truncate font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "#f0cb62" }}>{names.host}</p>
          <b className="font-serif text-2xl" style={{ color: "#f0cb62" }}>{n1}</b>
        </div>
        <motion.p key={status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="px-2 text-center text-[12px] font-semibold">{status}</motion.p>
        <div className="min-w-0 text-center">
          <p className="max-w-[92px] truncate font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "#4fd1c5" }}>{names.guest}</p>
          <b className="font-serif text-2xl" style={{ color: "#4fd1c5" }}>{n2}</b>
        </div>
      </div>

      <div ref={boxRef} className="w-full">
        <div className="mx-auto" style={{ width: size, perspective: 1100 }}>
          <motion.div
            initial={{ rotateX: 46, opacity: 0, y: 24 }} animate={{ rotateX: 22, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 80, damping: 16 }}
            style={{
              background: "linear-gradient(145deg,#3a3126,#14100c)",
              boxShadow: "0 0 0 1.5px rgba(240,203,98,.7), 0 26px 50px rgba(0,0,0,.55)",
              padding: 8, borderRadius: 20, transformOrigin: "50% 65%",
            }}
          >
            <div style={{ position: "relative", width: bd, height: bd, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", width: "100%", height: "100%" }}>
                {Array.from({ length: 64 }).map((_, i) => {
                  const r = Math.floor(i / 8), c = i % 8;
                  const dark = (r + c) % 2 === 1;
                  const isDest = destSet.has(`${r}-${c}`);
                  const isLast = last && ((last.from[0] === r && last.from[1] === c) || (last.to[0] === r && last.to[1] === c));
                  return (
                    <div
                      key={i} onClick={() => clickSquare(r, c)}
                      style={{
                        position: "relative", cursor: isDest ? "pointer" : "default",
                        background: dark ? "linear-gradient(145deg,#33281b,#1f170f)" : "linear-gradient(145deg,#e6d6ae,#cdbb8f)",
                        boxShadow: isLast ? "inset 0 0 0 100px rgba(240,203,98,.16)" : undefined,
                      }}
                    >
                      {isDest && (
                        <motion.span
                          animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.2 }}
                          style={{ position: "absolute", left: "34%", top: "34%", width: "32%", height: "32%", borderRadius: "50%", background: "radial-gradient(circle, #fff3bf, #f0cb62)", boxShadow: "0 0 14px rgba(240,203,98,.95)" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <AnimatePresence initial={false}>
                {pieces.map((pc) => {
                  const isSel = sel === pc.id;
                  const mine = pc.p === 1;
                  return (
                    <motion.div
                      key={pc.id}
                      initial={false}
                      animate={{ x: `${pc.c * 100}%`, y: `${pc.r * 100}%`, scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ x: { type: "spring", stiffness: 240, damping: 24 }, y: { type: "spring", stiffness: 240, damping: 24 } }}
                      onClick={() => clickPiece(pc)}
                      style={{ position: "absolute", left: 0, top: 0, width: "12.5%", height: "12.5%", zIndex: isSel ? 5 : 1, cursor: canAct && pc.p === turn && !res ? "pointer" : "default" }}
                    >
                      <motion.div
                        animate={{ y: isSel ? -cell * 0.14 : 0, scale: isSel ? 1.1 : 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        style={{
                          position: "absolute", inset: "10%", borderRadius: "50%", display: "grid", placeItems: "center",
                          background: mine
                            ? "radial-gradient(circle at 35% 30%, #fff3bf, #f0cb62 40%, #b8862b 82%)"
                            : "radial-gradient(circle at 35% 30%, #8ff5ea, #1fa9a0 45%, #0b4a52)",
                          boxShadow:
                            (mine
                              ? "0 1px 0 #8a6a14, 0 3px 0 #6a4e0c, 0 9px 12px rgba(0,0,0,.55)"
                              : "0 1px 0 #0c5a60, 0 3px 0 #083e44, 0 9px 12px rgba(0,0,0,.55)") +
                            (isSel ? ", 0 0 26px rgba(240,203,98,.9)" : ""),
                        }}
                      >
                        <div style={{ position: "absolute", inset: "16%", borderRadius: "50%", boxShadow: mine ? "inset 0 0 0 2px rgba(120,80,10,.45)" : "inset 0 0 0 2px rgba(0,40,44,.55)" }} />
                        {pc.k && <span style={{ fontSize: cell * 0.42, lineHeight: 1, color: mine ? "#5a3d08" : "#d8fffb" }}>♛</span>}
                      </motion.div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] opacity-65">{mustJump && !res ? T.mustJump : local ? S.passHint : ""}</p>
    </div>
  );
}

/* =====================  HUB BUTTON  ===================== */
export function MpHubButton({ lang, onClick }) {
  const S = MT[lang] || MT.en;
  return (
    <motion.button
      type="button" onClick={onClick}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
      className="mx-auto mt-3 flex w-full max-w-[460px] items-center gap-3 rounded-2xl px-4 py-3 text-left"
      style={{ ...PANEL, boxShadow: "inset 0 0 0 1px rgba(240,203,98,.6), 0 12px 26px rgba(0,0,0,.4)" }}
    >
      <span className="text-2xl">👥</span>
      <span className="min-w-0 flex-1">
        <b className="block font-serif text-[15px] leading-tight" style={goldText}>{S.hubBtn}</b>
        <span className="block text-[11px] opacity-70">{S.hubSub}</span>
      </span>
      <span style={{ color: "#e8c15a" }}>›</span>
    </motion.button>
  );
}

/* =====================================================================
   THE WHOLE FLOW: menu -> level -> lobby -> countdown -> play -> result
   ===================================================================== */
export default function MultiplayerFlow({ lang, T, cfg, soc, art, defaultName, ui, Icon, info, join, renderGame, onOpenCard, onHub }) {
  const S = MT[lang] || MT.en;
  const st = soc.settings;
  const room = useRoom();
  const [view, setView] = useState(join ? "join" : "menu"); // menu|level|join|lobby|count|play|wait|result
  const [pick, setPick] = useState({ game: null, level: null, mode: "race" });
  const [role, setRole] = useState(null); // host | guest
  const [code, setCode] = useState("");
  const [codeIn, setCodeIn] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const [nm, setNm] = useState(defaultName || "");
  const [nm2, setNm2] = useState("");
  const [game, setGame] = useState(null);
  const [level, setLevel] = useState(null);
  const [mode, setMode] = useState(null); // race | dots | memory | pass-dots | pass-checkers
  const [lc, setLc] = useState({});
  const [deck, setDeck] = useState(null);
  const [count, setCount] = useState(3);
  const [res, setRes] = useState(null);
  const [runKey, setRunKey] = useState(0);
  const [re, setRe] = useState({ me: false, peer: false });
  const [floats, setFloats] = useState([]);
  const [err, setErr] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const firstRef = useRef(null);
  const hadPeer = useRef(false);
  const lastPeer = useRef("");
  const ref = useRef({});
  const F = useRef({});

  const local = String(mode || "").startsWith("pass");
  const peerRole = role === "host" ? "guest" : "host";
  const peer = room.peers.find((p) => p.role === peerRole) || null;
  if (peer && peer.name) lastPeer.current = peer.name;
  const peerName = (peer && peer.name) || lastPeer.current || S.friend;
  const myName = nm.trim().slice(0, 20) || S.you;
  const friendName = nm2.trim().slice(0, 20) || S.friend;
  const gameTitle = game && cfg[game] ? tx(cfg[game].title, lang) : "";
  const names = local
    ? { host: myName, guest: friendName }
    : { host: role === "host" ? myName : peerName, guest: role === "guest" ? myName : peerName };
  ref.current = { role, game, level, mode, view, re, cfg, ui, pick };

  /* ----- actions ----- */
  const addFloat = (e) => {
    const id = Math.random();
    setFloats((f) => [...f, { id, e, x: 8 + Math.random() * 80 }]);
    setTimeout(() => setFloats((f) => f.filter((z) => z.id !== id)), 2300);
  };
  const sendEmo = (e) => { room.send({ t: "emo", e }); addFloat(e); };

  const begin = (m) => {
    if (firstRef.current) clearTimeout(firstRef.current.timer);
    firstRef.current = null;
    setGame(m.game); setLevel(m.level); setMode(m.mode); setLc(m.lc || {}); setDeck(m.deck || null);
    setRes(null); setRe({ me: false, peer: false }); setRunKey((k) => k + 1);
    setCount(3); setView("count");
  };
  // two players, one phone: no room, no network
  const beginLocal = (g, lv) => {
    hadPeer.current = false;
    setRole("host"); setCode(""); setErr(""); setCodeErr("");
    begin({ game: g, level: lv, mode: g === "checkers" ? "pass-checkers" : "pass-dots", lc: (cfg[g] && cfg[g].levels[lv]) || {} });
  };
  const hostStart = (g, lv, mdIn) => {
    const c = ref.current.cfg;
    const u = ref.current.ui;
    const lcfg = (c[g] && c[g].levels[lv]) || {};
    const pm = (ref.current.pick && ref.current.pick.mode) || "race";
    const md = mdIn || (pm === "duel" ? (g === "memory" ? "memory" : g === "checkers" ? "checkers" : "dots") : "race");
    let dk = null;
    if (md === "memory") {
      const pairs = Math.min(u.MEM_CARDS.length, Math.floor((u.num(lcfg.cols, 4, 2, 6) * u.num(lcfg.rows, 3, 2, 6)) / 2));
      dk = u.shuffleArr(Array.from({ length: pairs * 2 }, (_, i) => i % pairs));
    }
    const m = { t: "start", game: g, level: lv, mode: md, lc: lcfg, deck: dk };
    room.send(m);
    begin(m);
  };
  const finish = (winner) => {
    if (firstRef.current) clearTimeout(firstRef.current.timer);
    firstRef.current = null;
    setRes({ winner });
    setView("result");
  };
  // the host decides a race: first to finish wins, a finish within 0.6 s is decided by the faster time
  const conclude = (winner) => { room.send({ t: "result", winner }); finish(winner); };
  const hostDone = (who, secs) => {
    const f = firstRef.current;
    if (!f) {
      firstRef.current = { who, secs, timer: setTimeout(() => conclude(who), 600) };
      return;
    }
    if (f.who === who) return;
    clearTimeout(f.timer);
    conclude(secs < f.secs ? who : secs > f.secs ? f.who : "host");
  };
  const onLocalWin = () => {
    const r = ref.current;
    if (r.view !== "play" || r.mode !== "race") return;
    const secs = Math.max(1, Math.round((performance.now() - startedAt.current) / 1000));
    setView("wait");
    if (r.role === "host") F.current.hostDone("host", secs);
    else room.send({ t: "done", secs });
  };
  const leaveRoom = () => {
    room.send({ t: "bye" });
    hadPeer.current = false;
    lastPeer.current = "";
    room.leave();
    if (firstRef.current) clearTimeout(firstRef.current.timer);
    firstRef.current = null;
    setErr(""); setRole(null); setCode(""); setRes(null); setGame(null); setMode(null);
    setCodeIn(""); setCodeErr("");
    setPick({ game: null, level: null, mode: "race" });
    setView("menu");
  };
  const create = () => {
    if (!pick.game || !pick.level) return;
    if (pick.mode === "pass") { beginLocal(pick.game, pick.level); return; }
    const c = makeCode();
    hadPeer.current = false;
    setErr(""); setRole("host"); setCode(c); setGame(pick.game); setLevel(pick.level);
    room.join(c, { name: nm.trim().slice(0, 20), role: "host" });
    setView("lobby");
  };
  const joinByCode = () => {
    const c = codeIn.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (c.length < 4) { setCodeErr(S.badCode); return; }
    setCodeErr(""); hadPeer.current = false; setErr("");
    setRole("guest"); setCode(c); setGame(null); setLevel(null);
    room.join(c, { name: nm.trim().slice(0, 20), role: "guest" });
    setView("lobby");
  };
  const doJoin = () => {
    const lv = LEVELS.includes(join.lv) ? join.lv : "easy";
    hadPeer.current = false;
    setErr(""); setRole("guest"); setCode(join.room); setGame(join.g); setLevel(lv);
    room.join(join.room, { name: nm.trim().slice(0, 20), role: "guest" });
    setView("lobby");
  };
  const wantRematch = () => {
    if (local) { beginLocal(game, level); return; }
    setRe((x) => ({ ...x, me: true }));
    room.send({ t: "rematch" });
    if (role === "host" && re.peer) hostStart(game, level, mode);
  };
  F.current = { begin, finish, hostDone, hostStart, addFloat, setErr, beginLocal };

  /* ----- messages from the friend ----- */
  useEffect(() => room.on((m) => {
    const r = ref.current;
    if (m.t === "start" && r.role === "guest") F.current.begin(m);
    else if (m.t === "result" && r.role === "guest") F.current.finish(m.winner);
    else if (m.t === "done" && r.role === "host") F.current.hostDone("guest", Number(m.secs) || 1);
    else if (m.t === "emo" && typeof m.e === "string") F.current.addFloat(m.e.slice(0, 4));
    else if (m.t === "bye") F.current.setErr("left");
    else if (m.t === "rematch") {
      setRe((x) => ({ ...x, peer: true }));
      if (r.role === "host" && r.re.me) F.current.hostStart(r.game, r.level, r.mode);
    }
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (firstRef.current) clearTimeout(firstRef.current.timer); }, []);

  /* ----- timers and presence ----- */
  useEffect(() => {
    if (view !== "count") return undefined;
    const id = setTimeout(() => {
      if (count > 0) setCount(count - 1);
      else { startedAt.current = performance.now(); setElapsed(0); setView("play"); }
    }, count === 0 ? 550 : 800);
    return () => clearTimeout(id);
  }, [view, count]);
  useEffect(() => {
    if (view !== "play") return undefined;
    const id = setInterval(() => setElapsed(Math.round((performance.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [view]);
  useEffect(() => {
    if (local) return;
    if (room.peers.length > 0) hadPeer.current = true;
    else if (hadPeer.current && role && !err && !["menu", "level", "join"].includes(view)) setErr("left");
  }, [room.peers.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (room.state === "error") setErr("net"); }, [room.state]);
  useEffect(() => { // a second guest that arrived later gives up its place
    if (local || role !== "guest" || view !== "lobby" || err) return;
    if (room.peers.some((p) => p.role === "guest" && p.id < room.id)) {
      hadPeer.current = false;
      setErr("full");
      room.leave();
    }
  }, [room.peers]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // no host appeared: the code or link is old
    if (local || role !== "guest" || view !== "lobby" || err) return undefined;
    if (room.peers.some((p) => p.role === "host")) return undefined;
    const id = setTimeout(() => setErr("gone"), 9000);
    return () => clearTimeout(id);
  }, [role, view, room.peers, err]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // the host did not answer after a finish
    if (view !== "wait" || role !== "guest") return undefined;
    const id = setTimeout(() => setErr("net"), 7000);
    return () => clearTimeout(id);
  }, [view, role]);

  /* ----- what to draw ----- */
  const list = Object.keys(cfg)
  .filter((k) => cfg[k].enabled)
  .filter((k) => DUELS.includes(k) && PASS.includes(k))
  .filter((k) => LEVELS.some(
    (l) => cfg[k].levels[l] && cfg[k].levels[l].enabled !== false
  ))
  .sort((a, b) => (cfg[a].sort ?? 0) - (cfg[b].sort ?? 0));
  const lvlsOf = (k) => (cfg[k] ? LEVELS.filter((l) => cfg[k].levels[l] && cfg[k].levels[l].enabled !== false) : []);
  const hintOf = (k) => (DUELS.includes(k) ? S.duelHint : PASS.includes(k) ? S.passHint : S.raceHint);
  const joinBad = view === "join" && !(join && cfg[join.g] && cfg[join.g].enabled);
  const inviteUrl = (() => {
    if (!code) return "";
    const base = makeLink(st, { play: "hub" }).split("?")[0];
    const q = new URLSearchParams({ room: code, g: game || "", lv: level || "" });
    if (nm.trim()) q.set("by", nm.trim().slice(0, 20));
    return `${base}?${q.toString()}`;
  })();
  const title = (txt) => <h2 className="font-serif text-3xl font-bold" style={goldText}>{txt}</h2>;
  const nameBox = (
    <label className="mt-5 block w-full text-left">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#c9972f" }}>{S.yourName}</span>
      <input
        value={nm} onChange={(e) => setNm(e.target.value.slice(0, 20))} maxLength={20}
        className="mt-1 w-full rounded-xl px-3 py-2.5 text-base outline-none" style={{ ...PANEL, color: "#efe8d6" }}
      />
    </label>
  );
  const twoNames = (
    <>
      <label className="mt-5 block w-full text-left">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#f0cb62" }}>{S.p1}</span>
        <input
          value={nm} onChange={(e) => setNm(e.target.value.slice(0, 20))} maxLength={20}
          className="mt-1 w-full rounded-xl px-3 py-2.5 text-base outline-none" style={{ ...PANEL, color: "#efe8d6" }}
        />
      </label>
      <label className="mt-3 block w-full text-left">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#4fd1c5" }}>{S.p2}</span>
        <input
          value={nm2} onChange={(e) => setNm2(e.target.value.slice(0, 20))} maxLength={20}
          className="mt-1 w-full rounded-xl px-3 py-2.5 text-base outline-none" style={{ ...PANEL, color: "#efe8d6" }}
        />
      </label>
    </>
  );

  if (err || joinBad) {
    const msg = joinBad ? S.gone : err === "left" ? fmt(S.left, { name: peerName }) : err === "full" ? S.full : err === "gone" ? S.gone : S.net;
    return (
      <div className="mx-auto max-w-[420px] text-center">
        <p className="text-4xl">🔌</p>
        <p className="mt-3 text-base font-semibold">{msg}</p>
        <div className="mt-5"><Btn gold onClick={joinBad ? onHub : leaveRoom}>← {S.back}</Btn></div>
      </div>
    );
  }

  /* menu: every game that can be played with a friend + join by code */
  if (view === "menu")
    return (
      <div className="mx-auto max-w-[480px]">
        <div className="text-center">
          {title(S.title)}
          <p className="mt-1 text-sm opacity-70">{S.pick}</p>
        </div>
        <div className="mt-5 space-y-3">
          {list.map((k, i) => (
            <motion.button
              key={k} type="button" onClick={() => { setPick({ game: k, level: null, mode: defMode(k) }); setView("level"); }}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i, type: "spring", stiffness: 160, damping: 18 }}
              whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }}
              className="flex w-full items-center gap-4 rounded-2xl p-4 text-left" style={{ ...PANEL, boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4), 0 10px 24px rgba(0,0,0,.4)" }}
            >
              <div className="grid h-14 w-16 shrink-0 place-items-center"><Icon kind={k} /></div>
              <div className="min-w-0 flex-1">
                <b className="block font-serif text-lg leading-tight" style={goldText}>{tx(cfg[k].title, lang)}</b>
                <span className="mt-1 block text-[12px] opacity-70">{hintOf(k)}</span>
              </div>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {modesOf(k).map((m) => (
                  <span
                    key={m}
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={m === "race" ? { color: "#efe8d6", ...chipStyle } : { background: GOLD, color: "#3b2506" }}
                  >
                    {m === "race" ? S.race : m === "duel" ? S.duel : S.pass}
                  </span>
                ))}
              </span>
            </motion.button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl p-4" style={PANEL}>
          <b className="font-serif text-base" style={goldText}>{S.joinCodeTitle}</b>
          <p className="mt-0.5 text-[11px] opacity-70">{S.codeHint}</p>
          <div className="mt-2 flex items-stretch gap-2">
            <input
              value={codeIn}
              onChange={(e) => { setCodeIn(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5)); setCodeErr(""); }}
              placeholder="ABCDE" maxLength={5} autoCapitalize="characters" autoComplete="off" spellCheck={false}
              className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-center font-mono text-xl tracking-[0.35em] outline-none"
              style={{ ...PANEL, color: "#efe8d6" }}
            />
            <Btn gold disabled={codeIn.length < 4} onClick={joinByCode}>{S.joinCodeBtn}</Btn>
          </div>
          {codeErr && <p className="mt-2 text-[11px]" style={{ color: "#ff8a8a" }}>{codeErr}</p>}
          <label className="mt-3 block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#c9972f" }}>{S.yourName}</span>
            <input
              value={nm} onChange={(e) => setNm(e.target.value.slice(0, 20))} maxLength={20}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-base outline-none" style={{ ...PANEL, color: "#efe8d6" }}
            />
          </label>
        </div>

        <div className="mt-6 text-center"><Btn onClick={onHub}>← {S.back}</Btn></div>
      </div>
    );

  /* level + how to play + name(s) */
  if (view === "level" && pick.game && cfg[pick.game]) {
    const gk = pick.game;
    const ms = modesOf(gk);
    return (
      <div className="mx-auto max-w-[420px]">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-20 place-items-center"><Icon kind={gk} /></div>
          <div className="mt-2">{title(tx(cfg[gk].title, lang))}</div>
          <p className="mt-1 text-sm opacity-70">{S.chooseLevel}</p>
        </div>
        <div className="mt-5 space-y-3">
          {lvlsOf(gk).map((lv, i) => (
            <motion.button
              key={lv} type="button" onClick={() => setPick({ ...pick, level: lv })}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left"
              style={{ ...PANEL, boxShadow: pick.level === lv ? "inset 0 0 0 2px #f0cb62, 0 0 24px rgba(240,203,98,.4)" : PANEL.boxShadow }}
            >
              <span>
                <b className="block font-serif text-xl" style={goldText}>{T[lv]}</b>
                <span className="mt-0.5 block text-[12px] opacity-70">{info(gk, lv)}</span>
              </span>
              {pick.level === lv && <span style={{ color: "#f0cb62" }}>✓</span>}
            </motion.button>
          ))}
        </div>

        <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "#c9972f" }}>{S.howTo}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {ms.map((m) => (
            <motion.button
              key={m} type="button" onClick={() => setPick({ ...pick, mode: m })}
              whileTap={{ scale: 0.96 }}
              className="rounded-full px-4 py-2 text-[12px] font-semibold"
              style={pick.mode === m ? { background: GOLD, color: "#3b2506" } : { color: "#efe8d6", ...chipStyle }}
            >
              {m === "race" ? S.race : m === "duel" ? S.duel : S.pass}
            </motion.button>
          ))}
        </div>
        <p className="mt-1.5 text-center text-[11px] opacity-70">
          {pick.mode === "pass" ? S.passHint : pick.mode === "duel" ? S.duelHint : S.raceHint}
        </p>

        {pick.mode === "pass" ? twoNames : nameBox}

        <div className="mt-5 flex justify-center gap-2">
          <Btn onClick={() => setView("menu")}>← {S.back}</Btn>
          <Btn gold disabled={!pick.level} onClick={create}>
            {pick.mode === "pass" ? S.startNow : S.create} →
          </Btn>
        </div>
      </div>
    );
  }

  /* a friend opened the invite link */
  if (view === "join" && join)
    return (
      <div className="mx-auto max-w-[420px] text-center">
        {art && <img src={art} alt="" draggable={false} className="kg-float mx-auto" style={{ height: 130, filter: "drop-shadow(0 18px 24px rgba(0,0,0,.6))" }} />}
        <div className="mt-4">{title(fmt(S.invited, { by: join.by || S.friend }))}</div>
        <p className="mt-2 text-sm opacity-80">{tx(cfg[join.g].title, lang)} · {T[LEVELS.includes(join.lv) ? join.lv : "easy"]}</p>
        {nameBox}
        <div className="mt-5 flex justify-center gap-2">
          <Btn onClick={onHub}>← {S.back}</Btn>
          <Btn gold onClick={doJoin}>{S.joinBtn} →</Btn>
        </div>
      </div>
    );

  /* lobby */
  if (view === "lobby") {
    const guest = room.peers.find((p) => p.role === "guest");
    const host = room.peers.find((p) => p.role === "host");
    const sub = [gameTitle, level ? T[level] : ""].filter(Boolean).join(" · ");
    return (
      <div className="mx-auto max-w-[440px] text-center">
        {title(S.lobby)}
        {sub ? <p className="mt-1 text-sm opacity-70">{sub}</p> : null}
        {role === "host" && (
          <div className="mt-5 rounded-2xl p-4" style={PANEL}>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "#c9972f" }}>{S.code}</p>
            <b className="mt-1 block font-mono text-4xl tracking-[0.35em]" style={goldText}>{code}</b>
            <p className="mt-1 text-[11px] opacity-70">{S.codeHint}</p>
            <InviteBar S={S} url={inviteUrl} text={fmt(S.inviteText, { game: gameTitle })} />
          </div>
        )}
        <div className="mt-5 min-h-[70px]">
          {room.state === "connecting" ? (
            <p className="opacity-70">{S.connecting}</p>
          ) : role === "host" ? (
            guest ? (
              <>
                <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-semibold" style={{ color: "#e8c15a" }}>
                  ✓ {fmt(S.joined, { name: guest.name || S.friend })}
                </motion.p>
                <div className="mt-3"><Btn gold onClick={() => hostStart(game, level)}>{S.start} →</Btn></div>
              </>
            ) : (
              <motion.p animate={{ opacity: [0.45, 1, 0.45] }} transition={{ repeat: Infinity, duration: 1.6 }}>{S.waiting}</motion.p>
            )
          ) : (
            <motion.p animate={{ opacity: [0.45, 1, 0.45] }} transition={{ repeat: Infinity, duration: 1.6 }}>
              {host ? fmt(S.waitHost, { name: host.name || S.friend }) : S.connecting}
            </motion.p>
          )}
        </div>
        <div className="mt-4"><Btn onClick={leaveRoom}>{S.leave}</Btn></div>
      </div>
    );
  }

  /* 3 - 2 - 1 */
  if (view === "count")
    return (
      <div className="grid min-h-[300px] place-items-center text-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: "#c9972f" }}>
            {names.host} {S.vs} {names.guest}
          </p>
          <motion.b
            key={count} initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14 }}
            className="mt-3 block font-serif text-8xl font-bold" style={goldText}
          >
            {count > 0 ? count : S.go}
          </motion.b>
        </div>
      </div>
    );

  /* the checking screen after a race finish */
  if (view === "wait")
    return (
      <div className="grid min-h-[260px] place-items-center text-center">
        <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2 }} className="font-serif text-2xl font-bold" style={goldText}>
          {S.wait}
        </motion.p>
      </div>
    );

  /* result */
  if (view === "result" && res) {
    const draw = res.winner === "draw";
    const won = res.winner === role;
    const canOpen = local || won || (!!st.mp_loser_opens && !draw);
    const headline = draw
      ? S.draw
      : local
      ? fmt(S.youLost, { name: names[res.winner] || S.friend })
      : won ? S.youWon : fmt(S.youLost, { name: peerName });
    return (
      <div className="relative mx-auto max-w-[420px] text-center">
        {art && (
          <motion.img
            src={art} alt="" draggable={false} className="kg-float mx-auto"
            initial={{ scale: 0.3, rotateY: 540, opacity: 0 }} animate={{ scale: 1, rotateY: 0, opacity: canOpen ? 1 : 0.55 }}
            transition={{ type: "spring", stiffness: 60, damping: 13 }}
            style={{ height: 150, filter: "drop-shadow(0 18px 24px rgba(0,0,0,.6))" }}
          />
        )}
        <div className="mt-4">{title(headline)}</div>
        {!draw && !local && <p className="mt-1 text-sm opacity-75">{won ? S.wonSub : S.lostSub}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {canOpen && <Btn gold onClick={onOpenCard}>{S.openCard} →</Btn>}
          {local ? (
            <Btn gold={!canOpen} onClick={() => beginLocal(game, level)}>{S.rematch}</Btn>
          ) : (
            <Btn gold={!canOpen} disabled={re.me} onClick={wantRematch}>
              {re.me ? fmt(S.rematchWait, { name: peerName }) : re.peer ? fmt(S.rematchAsk, { name: peerName }) : S.rematch}
            </Btn>
          )}
          <Btn onClick={leaveRoom}>{S.leave}</Btn>
        </div>
        {!local && <Reactions onEmo={sendEmo} floats={floats} />}
      </div>
    );
  }

  /* play */
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="mb-3 flex items-center justify-between rounded-2xl px-3 py-2 text-[12px]" style={PANEL}>
        <span className="max-w-[110px] truncate font-semibold" style={{ color: "#f0cb62" }}>{names.host}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#c9972f" }}>
          {S.vs}{mode === "race" ? ` · ${fmtTime(elapsed)}` : ""}
        </span>
        <span className="max-w-[110px] truncate font-semibold" style={{ color: "#4fd1c5" }}>{names.guest}</span>
      </div>
      {mode === "race" && <p className="mb-3 text-center text-[11px] opacity-70">{fmt(S.racing, { name: peerName })}</p>}

      {mode === "race" && game && renderGame(game, level, lc, onLocalWin, leaveRoom, runKey)}
      {mode === "dots" && (
        <DotsDuel key={runKey} ui={ui} lc={lc} role={role} names={names} net={room} S={S} onFinish={(w) => F.current.finish(w)} />
      )}
      {mode === "memory" && deck && (
        <MemoryDuel key={runKey} ui={ui} lc={lc} deck={deck} role={role} names={names} net={room} S={S} onFinish={(w) => F.current.finish(w)} />
      )}
      {mode === "checkers" && (
        <CheckersGame key={runKey} ui={ui} T={T} S={S} role={role} names={names} net={room} onFinish={(w) => F.current.finish(w)} />
      )}
      {mode === "pass-dots" && (
        <DotsDuel key={runKey} ui={ui} lc={lc} role="local" names={names} net={NULL_NET} S={S} onFinish={(w) => finish(w)} />
      )}
      {mode === "pass-checkers" && (
        <CheckersGame key={runKey} ui={ui} T={T} S={S} role="local" names={names} net={NULL_NET} onFinish={(w) => finish(w)} />
      )}

      {!local && <Reactions onEmo={sendEmo} floats={floats} />}
    </div>
  );
}

function Reactions({ onEmo, floats }) {
  return (
    <>
      <div className="mt-5 flex justify-center gap-2">
        {["👏", "😮", "😂", "🔥"].map((e) => (
          <motion.button
            key={e} type="button" onClick={() => onEmo(e)} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
            className="grid h-10 w-10 place-items-center rounded-full text-lg" style={chipStyle}
          >
            {e}
          </motion.button>
        ))}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-[60] h-0">
        {floats.map((f) => (
          <motion.span
            key={f.id} className="absolute text-4xl"
            style={{ left: `${f.x}%`, bottom: 0 }}
            initial={{ y: 0, opacity: 0, scale: 0.5 }} animate={{ y: -220, opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1, 1] }}
            transition={{ duration: 2.2, ease: "easeOut" }}
          >
            {f.e}
          </motion.span>
        ))}
      </div>
    </>
  );
}