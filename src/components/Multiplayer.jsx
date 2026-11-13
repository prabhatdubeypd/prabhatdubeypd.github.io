import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { supabase } from "../lib/supabase";
import { tx } from "../lib/i18n";
import { makeLink, fmtTime } from "./GameSocial";
import ChessGame, { HOW as CHESS_HOW } from "./Chess";
import LudoGame, { HOW as LUDO_HOW } from "./Ludo";

/* ---------- look ---------- */
const GOLD = "linear-gradient(180deg,#fff3bf 0%,#f0cb62 30%,#b8862b 58%,#f6dc8c 80%,#c9972f 100%)";
const goldText = { backgroundImage: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
const chipStyle = { boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5)", background: "rgba(20,14,6,.55)" };
const PANEL = {
  background: "linear-gradient(160deg, rgba(48,42,32,.92), rgba(16,13,9,.96))",
  boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4)",
};
const FRAME = {
  background: "linear-gradient(145deg,#3a3126,#14100c)",
  boxShadow: "0 0 0 1.5px rgba(240,203,98,.7), 0 26px 50px rgba(0,0,0,.55)",
};
const GC = "#f0cb62"; // gold = you (or player 1 on one phone)
const TC = "#4fd1c5"; // teal = the other player
const LEVELS = ["easy", "medium", "hard"];
const SEATC = [GC, TC, "#ff7a8a", "#8ab4ff"]; // seat colors (Ludo uses all 4)
// the ways each game can be played in "Play with a friend"
const MODES = {
  dots: ["duel", "pass"], memory: ["duel"], checkers: ["duel", "pass"],
  chess: ["duel", "pass", "cpu"], ludo: ["duel", "pass", "cpu"],
};
const LEVELED = { dots: true, memory: true }; // these use the level in online / pass too
const NULL_NET = { send() {}, sendU() {}, on: () => () => {} };
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ""));
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");

/* ---------- texts ---------- */
const MT = {
  en: {
    hubBtn: "Play with a friend", hubSub: "Invite someone and play live",
    title: "Play with a friend", pick: "Pick a game", duel: "Duel", race: "Race", pass: "Pass & Play",
    duelHint: "Take turns against each other", raceHint: "Both play at once. First to finish wins",
    passHint: "Two players take turns on this phone", howTo: "How do you want to play?",
    chooseLevel: "Choose a level", yourName: "Your name", create: "Create room", startNow: "Start playing",
    lobby: "Invite your friend", code: "Room code", copy: "Copy link", copied: "Link copied!", share: "Share invite",
    inviteText: "Play {game} with me live! Join my room:",
    waiting: "Waiting for your friend…", joined: "{name} joined!", start: "Start game",
    waitHost: "Waiting for {name} to start…", connecting: "Connecting…",
    invited: "{by} invited you to play", joinBtn: "Join the game",
    joinCodeTitle: "Got a room code?", joinCodeBtn: "Join room", badCode: "That code looks too short.",
    codeHint: "Type the 5-letter code your friend gave you",
    full: "This room is full.", gone: "Room not found. Ask your friend for a new code.",
    net: "Connection problem. Please try again.", left: "{name} left the room.",
    vs: "vs", you: "You", friend: "Friend", p1: "Player 1", p2: "Player 2",
    yourTurn: "Your turn", theirTurn: "{name}'s turn", yourTurnBig: "Your turn!", passTo: "Pass the phone to {name}",
    playing: "Playing", lastMove: "Last move",
    go: "GO!", racing: "{name} is playing…", wait: "Checking the result…",
    youWon: "You won!", youLost: "{name} won", draw: "It's a draw", wonSub: "The King is yours", lostSub: "So close. Want a rematch?",
    openCard: "Open the card", rematch: "Rematch", rematchWait: "Waiting for {name}…", rematchAsk: "{name} wants a rematch",
    leave: "Leave room", back: "Back", info: "How to play", close: "Close", retry: "Try again",
    reconnecting: "Reconnecting…", friendAway: "{name} lost connection. Waiting for them…",
    flip: "Flip board each turn", on: "ON", off: "OFF",
    drewLine: "drew a line", closedBox: "closed a box and goes again", foundPair: "found a pair", missedPair: "missed",
        online: "Online", cpu: "vs Computer", pN: "Player {n}", nPlayers: "{n} players", players: "Players", computer: "Computer",
    onlineHint: "Play live with friends. Share a link or a code", cpuHint: "Play against the computer",
    first: "Move first", second: "Move second", playAs: "You play",
    eloEasy: "≈ 500 rating · beginner", eloMed: "≈ 1100 rating · club player", eloHard: "1500+ rating · strong",
    botEasy: "Plays randomly", botMed: "Takes captures and good moves", botHard: "Plans ahead and avoids danger",
    emptySeat: "Waiting for a player…", startN: "Start with {n} players", need2: "Need at least 2 players to start",
    thinking: "Computer is thinking…", tookOver: "{name} left. A computer took over.", started: "This game already started.",
  },
  hi: {
    hubBtn: "दोस्त के साथ खेलें", hubSub: "किसी को बुलाएँ और साथ खेलें",
    title: "दोस्त के साथ खेलें", pick: "गेम चुनें", duel: "आमने-सामने", race: "रेस", pass: "पास करें & खेलें",
    duelHint: "बारी-बारी से खेलें", raceHint: "दोनों साथ खेलें। जो पहले पूरा करे वही जीते",
    passHint: "दो खिलाड़ी इसी फ़ोन पर बारी-बारी खेलें", howTo: "कैसे खेलना है?",
    chooseLevel: "लेवल चुनें", yourName: "आपका नाम", create: "रूम बनाएँ", startNow: "खेलना शुरू करें",
    lobby: "अपने दोस्त को बुलाएँ", code: "रूम कोड", copy: "लिंक कॉपी करें", copied: "लिंक कॉपी हो गया!", share: "न्योता भेजें",
    inviteText: "मेरे साथ {game} लाइव खेलें! मेरे रूम में जुड़ें:",
    waiting: "दोस्त का इंतज़ार…", joined: "{name} आ गया!", start: "गेम शुरू करें",
    waitHost: "{name} के शुरू करने का इंतज़ार…", connecting: "जुड़ रहा है…",
    invited: "{by} ने आपको खेलने बुलाया है", joinBtn: "गेम में जुड़ें",
    joinCodeTitle: "रूम कोड है?", joinCodeBtn: "रूम में जुड़ें", badCode: "कोड बहुत छोटा है।",
    codeHint: "दोस्त से मिला 5 अक्षरों का कोड डालें",
    full: "यह रूम भर चुका है।", gone: "रूम नहीं मिला। दोस्त से नया कोड माँगें।",
    net: "कनेक्शन में दिक्कत। फिर कोशिश करें।", left: "{name} रूम छोड़कर चला गया।",
    vs: "बनाम", you: "आप", friend: "दोस्त", p1: "खिलाड़ी 1", p2: "खिलाड़ी 2",
    yourTurn: "आपकी बारी", theirTurn: "{name} की बारी", yourTurnBig: "आपकी बारी!", passTo: "फ़ोन {name} को दें",
    playing: "खेल रहा है", lastMove: "आखिरी चाल",
    go: "शुरू!", racing: "{name} खेल रहा है…", wait: "नतीजा देखा जा रहा है…",
    youWon: "आप जीते!", youLost: "{name} जीता", draw: "बराबरी", wonSub: "किंग अब आपका है", lostSub: "बहुत करीब थे। फिर खेलें?",
    openCard: "कार्ड खोलें", rematch: "रीमैच", rematchWait: "{name} का इंतज़ार…", rematchAsk: "{name} रीमैच चाहता है",
    leave: "रूम छोड़ें", back: "वापस", info: "कैसे खेलें", close: "बंद करें", retry: "फिर कोशिश करें",
    reconnecting: "दोबारा जुड़ रहा है…", friendAway: "{name} का कनेक्शन टूट गया। इंतज़ार कर रहे हैं…",
    flip: "हर बारी बोर्ड पलटें", on: "चालू", off: "बंद",
    drewLine: "ने लकीर खींची", closedBox: "ने बॉक्स बंद किया और फिर खेलेगा", foundPair: "ने जोड़ी पाई", missedPair: "से चूक हुई",
        online: "ऑनलाइन", cpu: "कंप्यूटर के साथ", pN: "खिलाड़ी {n}", nPlayers: "{n} खिलाड़ी", players: "खिलाड़ी", computer: "कंप्यूटर",
    onlineHint: "दोस्तों के साथ लाइव खेलें। लिंक या कोड भेजें", cpuHint: "कंप्यूटर के खिलाफ खेलें",
    first: "पहली चाल", second: "दूसरी चाल", playAs: "आप खेलेंगे",
    eloEasy: "≈ 500 रेटिंग · शुरुआती", eloMed: "≈ 1100 रेटिंग · क्लब खिलाड़ी", eloHard: "1500+ रेटिंग · मज़बूत",
    botEasy: "अंदाज़े से चलता है", botMed: "पकड़ने वाली और अच्छी चालें चलता है", botHard: "आगे की सोचता है और खतरे से बचता है",
    emptySeat: "खिलाड़ी का इंतज़ार…", startN: "{n} खिलाड़ियों के साथ शुरू करें", need2: "शुरू करने के लिए कम से कम 2 खिलाड़ी चाहिए",
    thinking: "कंप्यूटर सोच रहा है…", tookOver: "{name} चला गया। अब कंप्यूटर खेलेगा।", started: "यह गेम पहले ही शुरू हो चुका है।",
  },
};

/* checkers: messages for illegal moves */
const CKT = {
  en: {
    notYours: "That is {name}'s piece", stuck: "This piece has no legal move",
    mustCapture: "You must capture! Pick a piece that can jump", pickFirst: "Tap one of your pieces first",
    darkOnly: "Pieces only move on the dark squares", badMove: "Move diagonally forward to a glowing square",
    wait: "Wait for {name} to move",
  },
  hi: {
    notYours: "यह {name} का मोहरा है", stuck: "इस मोहरे की कोई वैध चाल नहीं",
    mustCapture: "आपको कैप्चर करना ही होगा! कूद सकने वाला मोहरा चुनें", pickFirst: "पहले अपना कोई मोहरा छुएँ",
    darkOnly: "मोहरे सिर्फ़ गहरे खानों पर चलते हैं", badMove: "तिरछे आगे, चमकते खाने पर चलें",
    wait: "{name} की चाल का इंतज़ार करें",
  },
};

/* ⓘ rules, shown in the "How to play" window */
const HOW = {
  en: {
    dots: [
      "Take turns drawing one line between two dots.",
      "Close all 4 sides of a box to win it. You score and play again.",
      "Most boxes wins. A white pulse marks the last line drawn.",
    ],
    memory: ["Take turns flipping two cards.", "Found a pair? Keep it and play again.", "The player with the most pairs wins."],
    checkers: [
      "Gold moves first. Tap a piece, then a glowing square. Pieces move diagonally forward.",
      "Capturing is compulsory: jump over an enemy piece, and keep jumping if you can.",
      "Reach the far row to be crowned king (♛). Kings move both ways.",
      "Win by capturing or blocking every enemy piece. If you try an illegal move, a red note tells you why.",
    ],
    chess: CHESS_HOW.en,
    ludo: LUDO_HOW.en,
    race: ["You both play the same game at the same time.", "The first one to win takes the King. A tie within 0.6 s goes to the faster time."],
    rg: {
      puzzle: "Slide the pieces to rebuild the King card.",
      find: "Watch the cards shuffle, then pick the King.",
      blackjack: "Get closer to 21 than the dealer without going over.",
      elements: "Fire beats Grass, Grass beats Water, Water beats Fire. Drain the rival's HP.",
      higherlower: "Guess if the next card is higher or lower and build a streak.",
      watersort: "Pour colors until every tube holds one color.",
      snake: "Eat the coins. Don't hit walls or yourself.",
    },
  },
  hi: {
    dots: [
      "बारी-बारी से दो बिंदुओं के बीच एक लकीर खींचें।",
      "बॉक्स की चारों भुजाएँ पूरी करें तो वह आपका और आप फिर से खेलते हैं।",
      "सबसे ज़्यादा बॉक्स वाला जीतता है। सफ़ेद चमक आखिरी लकीर दिखाती है।",
    ],
    memory: ["बारी-बारी से दो कार्ड पलटें।", "जोड़ी मिली? वह आपकी और आप फिर खेलें।", "सबसे ज़्यादा जोड़ियाँ वाला जीतता है।"],
    checkers: [
      "सोनेहरा पहले चलता है। मोहरा छुएँ, फिर चमकता खाना। मोहरे तिरछे आगे चलते हैं।",
      "कैप्चर करना ज़रूरी है: दुश्मन के मोहरे पर कूदें, और हो सके तो लगातार कूदते रहें।",
      "आखिरी पंक्ति तक पहुँचें तो मोहरा किंग (♛) बनता है, जो दोनों तरफ़ चलता है।",
      "सारे दुश्मन मोहरे पकड़ें या रोक दें तो जीत। गलत चाल पर लाल संदेश कारण बताता है।",
    ],
    chess: CHESS_HOW.hi,
    ludo: LUDO_HOW.hi,
    race: ["आप दोनों एक ही गेम एक साथ खेलते हैं।", "जो पहले जीते वही किंग पाता है। 0.6 सेकंड के भीतर बराबरी हो तो तेज़ समय जीतता है।"],
    rg: {
      puzzle: "टुकड़े सरकाकर किंग कार्ड पूरा करें।",
      find: "कार्ड मिलते देखें, फिर किंग चुनें।",
      blackjack: "बिना 21 पार किए डीलर से 21 के करीब पहुँचें।",
      elements: "आग > घास > पानी > आग। रिवाल का HP खत्म करें।",
      higherlower: "अनुमान लगाएँ कि अगला कार्ड ऊँचा या नीचा है, और लगातार सही जवाब बनाएँ।",
      watersort: "रंग उडेलें जब तक हर ट्यूब में एक ही रंग न हो।",
      snake: "सिक्के खाएँ। दीवार या खुद से न टकराएँ।",
    },
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
   THE LIVE CONNECTION (Supabase Realtime, no table needed)
   - retries by itself when the connection drops
   - every game message is numbered, acknowledged and re-sent if lost
   - a friend whose connection blinks gets 20 seconds before "left"
   ===================================================================== */
const GRACE_MS = 20000;
const MAX_TRIES = 6;

function listPeers(ch, myId) {
  const out = [];
  Object.entries(ch.presenceState()).forEach(([k, arr]) => {
    if (k === myId) return;
    const m = arr && arr[0];
    if (m) out.push({ id: k, name: m.name || "", role: m.role || "", max: m.max || 2, t: m.t || 0 });
  });
  return out.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
}

/* A room for up to 4 players. Every sender numbers its messages, every receiver acknowledges them,
   anything not acknowledged is re-sent. Each friend is tracked separately. */
function useRoom() {
  const chRef = useRef(null);
  const hs = useRef(new Set());
  const idRef = useRef(Math.random().toString(36).slice(2, 10));
  const gen = useRef(0);
  const ctx = useRef({ code: "", meta: null, tries: 0, timer: 0 });
  const out = useRef({ n: 0, q: [], acked: {} });
  const inn = useRef({});
  const joined = useRef(false);
  const stateRef = useRef("idle");
  const peersRef = useRef([]);
  const seen = useRef({});
  const [peers, setPeers] = useState([]);
  const [state, setStateRaw] = useState("idle"); // idle | connecting | open | reconnecting | error
  const [away, setAway] = useState(false);
  const [lost, setLost] = useState([]); // friends who were gone longer than the grace time
  const setState = (s) => { stateRef.current = s; setStateRaw(s); };

  function raw(p) {
    const ch = chRef.current;
    if (!ch || !joined.current) return false;
    try { ch.send({ type: "broadcast", event: "m", payload: { ...p, from: idRef.current } }); return true; } catch { return false; }
  }
  function flush() { out.current.q.forEach((m) => raw({ k: "r", n: m.n, p: m.p })); }
  function prune() {
    const ps = peersRef.current;
    if (!ps.length) return;
    const min = Math.min(...ps.map((x) => out.current.acked[x.id] || 0));
    out.current.q = out.current.q.filter((m) => m.n > min);
  }
  function send(p) { const n = ++out.current.n; out.current.q.push({ n, p }); raw({ k: "r", n, p }); } // reliable
  function sendU(p) { raw({ k: "u", p }); } // fire and forget
  function deliver(p) { hs.current.forEach((h) => { try { h(p); } catch (e) { console.error(e); } }); }
  function onMsg(m) {
    if (!m || !m.from) return;
    if (m.k === "a") {
      if (m.to === idRef.current) { out.current.acked[m.from] = Math.max(out.current.acked[m.from] || 0, m.n); prune(); }
      return;
    }
    if (m.k === "u") { deliver({ ...m.p, from: m.from }); return; }
    if (m.k === "r") {
      const I = inn.current[m.from] || (inn.current[m.from] = { next: 1, buf: new Map() });
      if (m.n >= I.next) {
        I.buf.set(m.n, m.p);
        while (I.buf.has(I.next)) {
          const p = I.buf.get(I.next);
          I.buf.delete(I.next);
          I.next += 1;
          deliver({ ...p, from: m.from });
        }
      }
      raw({ k: "a", n: I.next - 1, to: m.from });
    }
  }
  function checkLost() {
    const now = Date.now();
    const ids = new Set(peersRef.current.map((p) => p.id));
    let aw = false;
    const gone = [];
    Object.keys(seen.current).forEach((id) => {
      if (ids.has(id)) { seen.current[id] = now; return; }
      aw = true;
      if (stateRef.current !== "open") { seen.current[id] = now; return; } // our own connection is down: do not blame the friend
      if (now - seen.current[id] > GRACE_MS) gone.push(id);
    });
    setAway(aw);
    setLost((old) => (old.length === gone.length && old.every((x, i) => x === gone[i]) ? old : gone));
  }
  function updatePeers(list) {
    peersRef.current = list;
    const now = Date.now();
    list.forEach((p) => { seen.current[p.id] = now; });
    setPeers(list);
    if (list.length) flush(); // a friend is here (again): re-send anything they missed
    checkLost();
  }
  function retry(my) {
    if (gen.current !== my) return;
    clearTimeout(ctx.current.timer);
    if (ctx.current.tries >= MAX_TRIES) { setState("error"); return; }
    setState("reconnecting");
    const wait = Math.min(8000, 1000 * 2 ** ctx.current.tries);
    ctx.current.tries += 1;
    ctx.current.timer = setTimeout(() => { if (gen.current === my) connect(); }, wait);
  }
  async function connect() {
    const my = ++gen.current;
    const { code, meta } = ctx.current;
    const old = chRef.current;
    chRef.current = null;
    joined.current = false;
    if (old) { try { await supabase.removeChannel(old); } catch { /* ignore */ } }
    if (gen.current !== my) return;
    const me = idRef.current;
    const ch = supabase.channel(`kg-${code}`, { config: { broadcast: { self: false }, presence: { key: me } } });
    ch.on("broadcast", { event: "m" }, ({ payload }) => { if (gen.current === my) onMsg(payload); });
    ch.on("presence", { event: "sync" }, () => { if (gen.current === my) updatePeers(listPeers(ch, me)); });
    ch.subscribe(async (s) => {
      if (gen.current !== my) return;
      if (s === "SUBSCRIBED") {
        clearTimeout(ctx.current.timer);
        ctx.current.tries = 0;
        joined.current = true;
        try { await ch.track(meta); } catch { /* ignore */ }
        if (gen.current !== my) return;
        setState("open");
        flush();
      } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
        joined.current = false;
        retry(my);
      }
    });
    chRef.current = ch;
  }
  function join(code, meta) {
    clearTimeout(ctx.current.timer);
    ctx.current = { code, meta, tries: 0, timer: 0 };
    out.current = { n: 0, q: [], acked: {} };
    inn.current = {};
    seen.current = {};
    peersRef.current = [];
    setPeers([]); setAway(false); setLost([]);
    setState("connecting");
    connect();
  }
  function leave() {
    gen.current += 1;
    clearTimeout(ctx.current.timer);
    ctx.current = { code: "", meta: null, tries: 0, timer: 0 };
    const ch = chRef.current;
    chRef.current = null;
    joined.current = false;
    if (ch) { try { supabase.removeChannel(ch); } catch { /* ignore */ } }
    seen.current = {};
    peersRef.current = [];
    setPeers([]); setAway(false); setLost([]);
    setState("idle");
  }
  function bye() { // tell the friends, then really leave
    sendU({ t: "bye" });
    const my = gen.current;
    setTimeout(() => { if (gen.current === my) leave(); }, 350);
  }
  function retryNow() { ctx.current.tries = 0; connect(); }
  const on = (fn) => { hs.current.add(fn); return () => { hs.current.delete(fn); }; };

  useEffect(() => {
    const resend = setInterval(() => { if (out.current.q.length) flush(); }, 1500);
    const lostT = setInterval(checkLost, 2000);
    const dog = setInterval(() => { // the socket can die silently on phones
      const ch = chRef.current;
      if (!ctx.current.code || !ch || stateRef.current !== "open") return;
      if (ch.state && ch.state !== "joined") { joined.current = false; retry(gen.current); }
    }, 4000);
    const wake = () => {
      if (!ctx.current.code || document.visibilityState === "hidden") return;
      const ch = chRef.current;
      if (!ch || (ch.state && ch.state !== "joined")) { ctx.current.tries = 0; connect(); } else flush();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      clearInterval(resend); clearInterval(lostT); clearInterval(dog);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      leave();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { join, leave, bye, retryNow, send, sendU, on, peers, state, away, lost, id: idRef.current };
}


/* ---------- small buttons used all over this file ---------- */
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

const InfoBtn = ({ onClick, S }) => (
  <button
    type="button" onClick={onClick} aria-label={S.info}
    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
    style={{ color: "#efe8d6", ...chipStyle }}
  >
    <span className="grid h-4 w-4 place-items-center rounded-full text-[10px]" style={{ background: GOLD, color: "#3b2506" }}>i</span>
    {S.info}
  </button>
);

  


function InfoModal({ open, onClose, title, lines, S }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true); // runs before the games window closes itself
    return () => window.removeEventListener("keydown", k, true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] grid place-items-center p-4 text-[#efe8d6]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 30, scale: 0.95, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            className="relative max-h-[85vh] w-full max-w-[420px] overflow-y-auto rounded-3xl p-5"
            style={{ background: "linear-gradient(160deg,#2a2217,#100d08)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.6), 0 30px 80px rgba(0,0,0,.6)" }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "#c9972f" }}>ⓘ {S.info}</p>
            <h3 className="mt-1 font-serif text-2xl font-bold" style={goldText}>{title}</h3>
            <ul className="mt-3 space-y-2.5 text-[13px] leading-snug">
              {lines.map((l, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="font-mono" style={{ color: "#e8c15a" }}>{i + 1}.</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 text-center"><Btn gold onClick={onClose}>{S.close}</Btn></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* who is playing right now: two cards, the active one glows, and a banner flashes at every turn change */
function Chip({ p, active, S }) {
  return (
    <motion.div
      animate={{ scale: active ? 1.03 : 0.97, opacity: active ? 1 : 0.6 }}
      transition={{ type: "spring", stiffness: 220, damping: 20 }}
      className="relative flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-2"
      style={{ ...PANEL, boxShadow: active ? `inset 0 0 0 2px ${p.color}, 0 0 24px ${p.color}66` : PANEL.boxShadow }}
    >
      {active && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-2xl" style={{ boxShadow: `0 0 0 2px ${p.color}` }}
          animate={{ opacity: [0.9, 0, 0.9], scale: [1, 1.07, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}
        />
      )}
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-serif text-lg font-bold"
        style={{ background: `radial-gradient(circle at 35% 30%, #fff, ${p.color} 55%, #00000055)`, color: "#1b1206" }}
      >
        {(p.name || "?").slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 text-left leading-tight">
        <span className="block truncate text-[12px] font-semibold" style={{ color: p.color }}>
          {p.name}{p.you ? ` · ${S.you}` : ""}
        </span>
        <span className="block h-3 font-mono text-[10px] uppercase tracking-[0.12em] opacity-75">
          {p.sub || (active ? `▶ ${S.playing}` : "")}
        </span>
      </span>
      <b className="font-serif text-2xl" style={{ color: p.color }}>{p.score}</b>
    </motion.div>
  );
}

function TurnBar({ players, turn, S, local, over }) {
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (turn < 0 || over) { setFlash(null); return undefined; }
    const p = players[turn];
    setFlash({ k: Math.random(), name: p.name, color: p.color, you: p.you });
    const t = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(t);
  }, [turn, over]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = turn >= 0 && !over ? players[turn] : null;
  return (
    <div className="relative mb-2 w-full">
            <div className="grid grid-cols-2 gap-2">
        {players.map((p, i) => <Chip key={i} p={p} active={turn === i && !over} S={S} />)}
      </div>
      <div className="mt-2 flex h-7 items-center justify-center">
        <AnimatePresence mode="wait">
          {cur && (
            <motion.p
              key={`${turn}-${cur.name}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-[13px] font-bold" style={{ color: cur.color }}
            >
              <motion.i
                className="h-2.5 w-2.5 rounded-full" style={{ background: cur.color, boxShadow: `0 0 10px ${cur.color}` }}
                animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
              />
              {cur.you ? S.yourTurn : fmt(S.theirTurn, { name: cur.name })}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.k} className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center"
            initial={{ opacity: 0, y: -14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}
          >
            <span
              className="rounded-full px-5 py-2 text-[13px] font-bold"
              style={{ background: flash.color, color: "#1b1206", boxShadow: `0 10px 30px ${flash.color}88` }}
            >
              {local ? fmt(S.passTo, { name: flash.name }) : flash.you ? S.yourTurnBig : fmt(S.theirTurn, { name: flash.name })}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LastLine({ S, name, color, children }) {
  return (
    <div className="mt-2 flex min-h-[30px] justify-center">
      <AnimatePresence mode="wait">
        {children ? (
          <motion.p
            key={String(children) + name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-[11px]" style={chipStyle}
          >
            <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
            <span className="opacity-70">{S.lastMove}:</span>
            <b className="truncate" style={{ color }}>{name}</b>
            <span className="truncate">{children}</span>
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Warn({ w }) {
  return (
    <div className="mb-2 flex min-h-[34px] justify-center">
      <AnimatePresence>
        {w && (
          <motion.p
            key={w.k} initial={{ opacity: 0, y: 8, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-full px-4 py-1.5 text-center text-[12px] font-semibold"
            style={{ background: "rgba(229,72,77,.18)", boxShadow: "inset 0 0 0 1px rgba(229,72,77,.75)", color: "#ffb4b4" }}
          >
            ⚠ {w.msg}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// red note + board shake for illegal moves
function useWarn() {
  const [w, setW] = useState(null);
  const t = useRef(0);
  const shake = useAnimation();
  const warn = (msg, cell) => {
    clearTimeout(t.current);
    setW({ msg, cell: cell || null, k: Math.random() });
    t.current = setTimeout(() => setW(null), 2400);
    try { shake.start({ x: [0, -7, 7, -5, 5, 0], transition: { duration: 0.4 } }); } catch { /* not mounted yet */ }
  };
  useEffect(() => () => clearTimeout(t.current), []);
  return [w, warn, shake];
}

const KIT = { TurnBar, LastLine, Warn, useWarn, GC, TC, FRAME, PANEL, chipStyle, GOLD, goldText, fmt };

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
   DOTS AND BOXES (online duel + pass & play)
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
  const R = ui.num(lc.rows, 3, 2, 6), C = ui.num(lc.cols, 3, 2, 6);
  const local = role === "local";
  const me = role === "host" ? 1 : role === "guest" ? 2 : 0;
  const G = useRef({ st: freshBoard(R, C), turn: 1, over: false, last: null });
  const [, bump] = useState(0);
  const re = () => bump((n) => n + 1);
  const [hov, setHov] = useState(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const colorOf = (w) => (local ? (w === 1 ? GC : TC) : w === me ? GC : TC);
  const nameOf = (w) => (w === 1 ? names.host : names.guest);

  const apply = (m, who) => {
    const g = G.current;
    if (g.over || g.turn !== who) return false;
    const arr = m.t === "h" ? g.st.H : g.st.V;
    if (!(m.i >= 0 && m.i < arr.length) || arr[m.i]) return false;
    const { ns, got } = applyMove(g.st, m, who, R, C);
    g.st = ns;
    g.last = { who, t: m.t, i: m.i, got };
    if (got === 0) g.turn = who === 1 ? 2 : 1; // a closed box means you go again
    if (ns.sp + ns.sa === R * C) {
      g.over = true;
      const w = ns.sp > ns.sa ? "host" : ns.sa > ns.sp ? "guest" : "draw";
      setTimeout(() => { if (alive.current) onFinish(w); }, 1300);
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
  const canPlayNow = !g.over && (local || g.turn === me);
  const turnColor = g.over ? GC : colorOf(g.turn);

  const edge = (t, i, x1, y1, x2, y2) => {
    const owner = (t === "h" ? st.H : st.V)[i];
    const isHov = hov && hov.t === t && hov.i === i && canPlayNow && !owner;
    const isLast = g.last && g.last.t === t && g.last.i === i;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    return (
      <g key={t + i}>
        {!owner && (
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isHov ? "rgba(240,203,98,.9)" : "rgba(240,203,98,.16)"} strokeWidth={isHov ? 6 : 3} strokeLinecap="round" />
        )}
        {isLast && (
          <>
            <motion.line
              x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth={12} strokeLinecap="round"
              animate={{ opacity: [0.85, 0.1, 0.85] }} transition={{ repeat: Infinity, duration: 1.3 }}
            />
            <motion.circle
              cx={mx} cy={my} fill="none" stroke={colorOf(owner)} strokeWidth={3}
              animate={{ r: [4, 24], opacity: [0.9, 0] }} transition={{ repeat: Infinity, duration: 1.3 }}
            />
          </>
        )}
        {owner ? (
          <motion.line
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25 }}
            x1={x1} y1={y1} x2={x2} y2={y2} stroke={colorOf(owner)} strokeWidth={6} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 5px ${colorOf(owner)}aa)` }}
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

  const order = local || me === 1 ? [1, 2] : [2, 1];
  const players = order.map((w) => ({ name: nameOf(w), color: colorOf(w), score: w === 1 ? st.sp : st.sa, you: !local && w === me }));

  return (
    <div className="flex w-full flex-col items-center">
      <div className="w-full max-w-[400px]">
        <TurnBar players={players} turn={g.over ? -1 : order.indexOf(g.turn)} S={S} local={local} over={g.over} />
      </div>
      <div style={{ perspective: 1100 }}>
        <motion.div
          initial={{ rotateX: 38, opacity: 0, y: 24 }} animate={{ rotateX: 12, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 16 }}
          style={{
            width: "min(92vw, 400px)", padding: 8, borderRadius: 20, background: "linear-gradient(145deg,#3a3126,#14100c)",
            boxShadow: `0 0 0 2px ${turnColor}, 0 0 34px ${turnColor}55, 0 26px 50px rgba(0,0,0,.55)`, transition: "box-shadow .4s",
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
                    <rect x={dx(c) + 9} y={dy(r) + 9} width={CELL - 18} height={CELL - 18} rx={10} fill={colorOf(o)} fillOpacity={0.22} stroke={colorOf(o)} strokeOpacity={0.6} />
                    <text x={dx(c) + CELL / 2} y={dy(r) + CELL / 2 + 9} textAnchor="middle" fontSize="26" fontFamily="Georgia, serif" fill={colorOf(o)}>
                      {(nameOf(o) || "?").slice(0, 1).toUpperCase()}
                    </text>
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
      {g.last ? (
        <LastLine S={S} name={nameOf(g.last.who)} color={colorOf(g.last.who)}>{g.last.got ? S.closedBox : S.drewLine}</LastLine>
      ) : <div className="min-h-[30px]" />}
    </div>
  );
}

/* =====================================================================
   MATCH THE PAIRS (online duel: same deck, take turns)
   ===================================================================== */
function MemoryDuel({ ui, lc, deck, role, names, net, onFinish, S }) {
  const { Flip, PlayingFace, MEM_CARDS, num, useWidth } = ui;
  const cols = num(lc.cols, 4, 2, 6);
  const previewMs = num(lc.previewMs, 1600, 0, 6000);
  const G = useRef({ up: [], done: [], owner: {}, turn: "host", score: { host: 0, guest: 0 }, lock: false, over: false, queue: [], last: null });
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
  const colorOf = (who) => (who === role ? GC : TC);

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
      const ok = deck[a] === deck[b];
      if (ok) { g.done.push(a, b); g.owner[a] = who; g.owner[b] = who; g.score[who] += 1; }
      else g.turn = who === "host" ? "guest" : "host";
      g.last = { who, ok };
      g.up = [];
      g.lock = false;
      if (g.done.length === deck.length) {
        g.over = true;
        const w2 = g.score.host > g.score.guest ? "host" : g.score.guest > g.score.host ? "guest" : "draw";
        setTimeout(() => { if (alive.current) onFinish(w2); }, 1100);
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
  const order = role === "host" ? ["host", "guest"] : ["guest", "host"];
  const players = order.map((who) => ({ name: names[who], color: colorOf(who), score: g.score[who], you: who === role }));

  return (
    <div className="w-full">
      <TurnBar players={players} turn={g.over || peek ? -1 : order.indexOf(g.turn)} S={S} local={false} over={g.over || peek} />
      <div ref={boxRef} className="w-full">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${w}px)`, gap, justifyContent: "center" }}>
          {deck.map((pid, i) => {
            const isDone = g.done.includes(i);
            const canTap = !peek && !g.lock && !g.over && g.turn === role && !isDone && !g.up.includes(i);
            const oc = colorOf(g.owner[i]);
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
                  style={{ cursor: canTap ? "pointer" : "default", borderRadius: w * 0.09, boxShadow: isDone ? `0 0 0 2px ${oc}, 0 0 22px ${oc}99` : undefined }}
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
      {g.last ? (
        <LastLine S={S} name={names[g.last.who]} color={colorOf(g.last.who)}>{g.last.ok ? S.foundPair : S.missedPair}</LastLine>
      ) : <div className="min-h-[30px]" />}
    </div>
  );
}


   
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
const ckName = ([r, c]) => "ABCDEFGH"[c] + (8 - r);

function CheckersGame({ ui, lang, S, role, names, net, onFinish }) {
  const K = CKT[lang] || CKT.en;
  const [w, warn, shake] = useWarn();
  const local = role === "local";
  const myP = role === "host" ? 1 : role === "guest" ? 2 : 0;
  const [pieces, setPieces] = useState(ckInit);
  const [turn, setTurn] = useState(1);
  const [sel, setSel] = useState(null);
  const [res, setRes] = useState(null);
  const [last, setLast] = useState(null);
  const [auto, setAuto] = useState(false);
  const alive = useRef(true);
  const np = useRef(0);
  const boxRef = useRef(null);
  const boxW = ui.useWidth(boxRef, 360);
  const netMove = useRef(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const flipped = local ? auto && turn === 2 : myP === 2; // the guest sees the board from their own side
  const colorOf = (p) => (local ? (p === 1 ? GC : TC) : p === myP ? GC : TC);
  const nameOf = (p) => (p === 1 ? names.host : names.guest);
  const size = Math.floor(Math.min(boxW, 400));
  const bd = size - 16;
  const cell = bd / 8;
  const grid = ckGrid(pieces);
  const moves = turn ? ckMoves(grid, turn) : [];
  const canAct = !res && turn !== 0 && (local || turn === myP);
  const selPiece = sel ? pieces.find((x) => x.id === sel) : null;
  const dests = selPiece && canAct ? moves.filter((m) => m.fr === selPiece.r && m.fc === selPiece.c) : [];
  const dkey = (m) => { const e = m.path[m.path.length - 1]; return `${e[0]}-${e[1]}`; };
  const destSet = new Set(dests.map(dkey));
  const mustJump = canAct && moves.length > 0 && moves[0].caps.length > 0;
  const X = (c) => (flipped ? 7 - c : c);
  const Y = (r) => (flipped ? 7 - r : r);

  const finish = (wn) => {
    setRes(wn); setTurn(0); setSel(null);
    setTimeout(() => { if (alive.current) onFinish(wn); }, 1300);
  };
  const doMove = (m, who, fromNet) => {
    const mover = pieces.find((x) => x.r === m.fr && x.c === m.fc);
    if (!mover) return;
    const cur0 = pieces.filter((x) => !m.caps.some(([r, c]) => x.r === r && x.c === c));
    const end = m.path[m.path.length - 1];
    const kinged = !mover.k && end[0] === (who === 1 ? 0 : 7);
    const cur = cur0.map((x) => (x.id === mover.id ? { ...x, r: end[0], c: end[1], k: x.k || kinged } : x));
    setPieces(cur); setSel(null);
    setLast({ who, path: [[m.fr, m.fc], ...m.path], caps: m.caps, king: kinged, k: Math.random() });
    if (!local && !fromNet) net.send({ t: "ck", m: { fr: m.fr, fc: m.fc, path: m.path, caps: m.caps } });
    np.current = m.caps.length || !mover.k ? 0 : np.current + 1;
    const opp = who === 1 ? 2 : 1;
    if (!ckMoves(ckGrid(cur), opp).length) { finish(who === 1 ? "host" : "guest"); return; }
    if (np.current >= 40) { finish("draw"); return; }
    setTurn(opp);
  };
  // the friend's move: only accepted if it really is a legal move for them right now
  netMove.current = (m) => {
    if (local || res || !m) return;
    const opp = myP === 1 ? 2 : 1;
    if (turn !== opp) return;
    const legal = ckMoves(ckGrid(pieces), opp).find((x) => x.fr === m.fr && x.fc === m.fc && JSON.stringify(x.path) === JSON.stringify(m.path));
    if (legal) doMove(legal, opp, true);
  };
  useEffect(() => net.on((msg) => { if (msg.t === "ck" && netMove.current) netMove.current(msg.m); }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const clickPiece = (pc) => {
    if (res || !turn) return;
    const key = `${pc.r}-${pc.c}`;
    if (!canAct) { warn(fmt(K.wait, { name: nameOf(myP === 1 ? 2 : 1) }), key); return; }
    if (pc.p !== turn) { warn(fmt(K.notYours, { name: nameOf(pc.p) }), key); return; }
    if (sel === pc.id) { setSel(null); return; }
    if (!moves.some((m) => m.fr === pc.r && m.fc === pc.c)) { warn(mustJump ? K.mustCapture : K.stuck, key); return; }
    setSel(pc.id);
  };
  const clickSquare = (r, c) => {
    if (res || !turn) return;
    const key = `${r}-${c}`;
    if (!canAct) { warn(fmt(K.wait, { name: nameOf(myP === 1 ? 2 : 1) }), key); return; }
    if (!selPiece) { warn(K.pickFirst, key); return; }
    if ((r + c) % 2 === 0) { warn(K.darkOnly, key); return; }
    const m = dests.find((x) => dkey(x) === key);
    if (m) { doMove(m, turn, false); return; }
    warn(mustJump ? K.mustCapture : K.badMove, key);
  };

  const n1 = pieces.filter((x) => x.p === 1).length;
  const n2 = pieces.filter((x) => x.p === 2).length;
  const order = local ? [1, 2] : [myP, myP === 1 ? 2 : 1];
  const players = order.map((p) => ({ name: nameOf(p), color: colorOf(p), score: p === 1 ? n1 : n2, you: !local && p === myP }));
  const turnColor = res || !turn ? GC : colorOf(turn);
  const trail = last ? last.path.map(([r, c]) => [X(c) + 0.5, Y(r) + 0.5]) : [];

  return (
    <div className="flex w-full flex-col items-center">
      <div className="w-full max-w-[400px]">
        <TurnBar players={players} turn={res ? -1 : order.indexOf(turn)} S={S} local={local} over={!!res} />
        {last ? (
          <LastLine S={S} name={nameOf(last.who)} color={colorOf(last.who)}>
            {`${ckName(last.path[0])} → ${ckName(last.path[last.path.length - 1])}${last.caps.length ? ` · ✕${last.caps.length}` : ""}${last.king ? " · ♛" : ""}`}
          </LastLine>
        ) : <div className="min-h-[30px]" />}
        <Warn w={w} />
      </div>

      <motion.div animate={shake} className="w-full">
        <div ref={boxRef} className="w-full">
          <div className="mx-auto" style={{ width: size, perspective: 1100 }}>
            <motion.div
              initial={{ rotateX: 46, opacity: 0, y: 24 }} animate={{ rotateX: 22, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 80, damping: 16 }}
              style={{
                ...FRAME, padding: 8, borderRadius: 20, transformOrigin: "50% 65%",
                boxShadow: `0 0 0 2px ${turnColor}, 0 0 34px ${turnColor}55, 0 26px 50px rgba(0,0,0,.55)`, transition: "box-shadow .4s",
              }}
            >
              <div style={{ position: "relative", width: bd, height: bd, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", width: "100%", height: "100%" }}>
                  {Array.from({ length: 64 }).map((_, i) => {
                    const r = flipped ? 7 - Math.floor(i / 8) : Math.floor(i / 8);
                    const c = flipped ? 7 - (i % 8) : i % 8;
                    const key = `${r}-${c}`;
                    const dark = (r + c) % 2 === 1;
                    const isDest = destSet.has(key);
                    const isEnd = last && (last.path[0].join("-") === key || last.path[last.path.length - 1].join("-") === key);
                    const bad = w && w.cell === key;
                    return (
                      <div
                        key={i} onClick={() => clickSquare(r, c)}
                        style={{
                          position: "relative", cursor: isDest ? "pointer" : "default",
                          background: dark ? "linear-gradient(145deg,#33281b,#1f170f)" : "linear-gradient(145deg,#e6d6ae,#cdbb8f)",
                          boxShadow: bad ? "inset 0 0 0 100px rgba(229,72,77,.45)" : isEnd ? `inset 0 0 0 100px ${colorOf(last.who)}33` : undefined,
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

                {last && (
                  <svg viewBox="0 0 8 8" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                    <motion.path
                      key={last.k} d={"M " + trail.map(([x, y]) => `${x} ${y}`).join(" L ")} fill="none"
                      stroke={colorOf(last.who)} strokeWidth="0.11" strokeLinecap="round" strokeLinejoin="round"
                      initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.9 }} transition={{ duration: 0.5 }}
                    />
                    <circle cx={trail[0][0]} cy={trail[0][1]} r="0.2" fill="none" stroke={colorOf(last.who)} strokeWidth="0.06" />
                    {last.caps.map(([r, c], i) => (
                      <text key={i} x={X(c) + 0.5} y={Y(r) + 0.72} textAnchor="middle" fontSize="0.6" fontWeight="700" fill={colorOf(last.who)} opacity="0.85">✕</text>
                    ))}
                  </svg>
                )}

                <AnimatePresence initial={false}>
                  {pieces.map((pc) => {
                    const isSel = sel === pc.id;
                    const gold = colorOf(pc.p) === GC;
                    return (
                      <motion.div
                        key={pc.id} initial={false}
                        animate={{ x: `${X(pc.c) * 100}%`, y: `${Y(pc.r) * 100}%`, scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0, rotate: 120 }}
                        transition={{ x: { type: "spring", stiffness: 240, damping: 24 }, y: { type: "spring", stiffness: 240, damping: 24 } }}
                        onClick={() => clickPiece(pc)}
                        style={{ position: "absolute", left: 0, top: 0, width: "12.5%", height: "12.5%", zIndex: isSel ? 5 : 1, cursor: canAct && pc.p === turn ? "pointer" : "default" }}
                      >
                        <motion.div
                          animate={{ y: isSel ? -cell * 0.14 : 0, scale: isSel ? 1.1 : 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          style={{
                            position: "absolute", inset: "10%", borderRadius: "50%", display: "grid", placeItems: "center",
                            background: gold
                              ? "radial-gradient(circle at 35% 30%, #fff3bf, #f0cb62 40%, #b8862b 82%)"
                              : "radial-gradient(circle at 35% 30%, #8ff5ea, #1fa9a0 45%, #0b4a52)",
                            boxShadow:
                              (gold
                                ? "0 1px 0 #8a6a14, 0 3px 0 #6a4e0c, 0 9px 12px rgba(0,0,0,.55)"
                                : "0 1px 0 #0c5a60, 0 3px 0 #083e44, 0 9px 12px rgba(0,0,0,.55)") + (isSel ? ", 0 0 26px rgba(240,203,98,.9)" : ""),
                          }}
                        >
                          <div style={{ position: "absolute", inset: "16%", borderRadius: "50%", boxShadow: gold ? "inset 0 0 2px 2px rgba(120,80,10,.45)" : "inset 0 0 2px 2px rgba(0,40,44,.55)" }} />
                          {pc.k && (
                            <span style={{ fontSize: cell * 0.42, lineHeight: 1, color: gold ? "#5a3d08" : "#d8fffb", transform: local && !flipped && pc.p === 2 ? "rotate(180deg)" : undefined }}>♛</span>
                          )}
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {local ? (
        <button
          type="button" onClick={() => setAuto((a) => !a)}
          className="mt-3 rounded-full px-4 py-1.5 text-[11px] font-semibold" style={{ color: "#efe8d6", ...chipStyle }}
        >
          ⟳ {S.flip}: {auto ? S.on : S.off}
        </button>
      ) : null}
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
const Opt = ({ on, onClick, children }) => (
  <motion.button
    type="button" onClick={onClick} whileTap={{ scale: 0.96 }}
    className="rounded-full px-4 py-2 text-[12px] font-semibold"
    style={on ? { background: GOLD, color: "#3b2506" } : { color: "#efe8d6", ...chipStyle }}
  >
    {children}
  </motion.button>
);
const modeLabel = (m, S) => (m === "duel" ? S.online : m === "pass" ? S.pass : S.cpu);

export default function MultiplayerFlow({ lang, T, cfg, soc, art, defaultName, ui, Icon, info, join, onOpenCard, onHub }) {
  const S = MT[lang] || MT.en;
  const st = soc.settings;
  const room = useRoom();
  const [view, setView] = useState(join ? "join" : "menu"); // menu|level|join|lobby|count|play|result
  const [pick, setPick] = useState({ game: null, level: "easy", mode: "duel", n: 2, side: 1 });
  const [role, setRole] = useState(null); // host | guest (online only)
  const [code, setCode] = useState("");
  const [codeIn, setCodeIn] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const [nm, setNm] = useState(defaultName || "");
  const [pn, setPn] = useState(["", "", ""]);
  const [game, setGame] = useState(null);
  const [level, setLevel] = useState("easy");
  const [mode, setMode] = useState(null); // duel (online) | pass | cpu
  const [lc, setLc] = useState({});
  const [deck, setDeck] = useState(null);
  const [seats, setSeats] = useState([]);
  const [side, setSide] = useState(1);
  const [count, setCount] = useState(3);
  const [res, setRes] = useState(null);
  const [runKey, setRunKey] = useState(0);
  const [reMe, setReMe] = useState(false);
  const [reN, setReN] = useState(0);
  const [floats, setFloats] = useState([]);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const myT = useRef(0);
  const hostId = useRef("");
  const reIds = useRef(new Set());
  const reMeRef = useRef(false);
  const lastM = useRef(null);
  const ref = useRef({});
  const F = useRef({});

  const online = mode === "duel";
  const local = mode === "pass";
  const cpu = mode === "cpu";
  const gRole = online ? role : local ? "local" : "cpu";
  const netFor = online ? room : NULL_NET;
  const hostPeer = room.peers.find((p) => p.role === "host") || null;
  if (hostPeer) hostId.current = hostPeer.id;
  const myName = nm.trim().slice(0, 20) || S.you;
  const mySeat = online ? seats.findIndex((s) => s.id === room.id) : cpu ? (game === "chess" ? side - 1 : 0) : -1;
  const seatNames = seats.map((s) => s.name);
  const names = { host: seatNames[0] || myName, guest: seatNames[1] || S.friend };
  const gameTitle = game && cfg[game] ? tx(cfg[game].title, lang) : "";
  const friendName = (room.peers[0] && room.peers[0].name) || S.friend;
  ref.current = { role, game, level, mode, view, cfg, ui, pick, seats, peers: room.peers, myId: room.id, myName };

  /* ----- actions ----- */
  const addFloat = (e) => {
    const id = Math.random();
    setFloats((f) => [...f, { id, e, x: 8 + Math.random() * 80 }]);
    setTimeout(() => setFloats((f) => f.filter((z) => z.id !== id)), 2300);
  };
  const sendEmo = (e) => { room.sendU({ t: "emo", e }); addFloat(e); };

  const begin = (m) => {
    lastM.current = m;
    reIds.current = new Set(); reMeRef.current = false; setReMe(false); setReN(0);
    setGame(m.game); setLevel(m.level || "easy"); setMode(m.mode); setLc(m.lc || {}); setDeck(m.deck || null);
    setSeats(m.seats || []); setSide(m.side || 1);
    setRes(null); setRunKey((x) => x + 1); setCount(3); setNote(""); setView("count");
  };
  const startPass = () => {
    const g = pick.game;
    const n = g === "ludo" ? pick.n : 2;
    const sl = Array.from({ length: n }, (_, i) => ({ name: (i === 0 ? nm : pn[i - 1]).trim().slice(0, 20) || fmt(S.pN, { n: i + 1 }) }));
    setRole(null); setErr("");
    begin({ game: g, level: pick.level, mode: "pass", lc: (cfg[g] && cfg[g].levels[pick.level]) || {}, seats: sl });
  };
  const startCpu = () => {
    const g = pick.game;
    let sl;
    if (g === "chess") sl = pick.side === 2 ? [{ name: S.computer, bot: true }, { name: myName }] : [{ name: myName }, { name: S.computer, bot: true }];
    else sl = [{ name: myName }, ...Array.from({ length: pick.n - 1 }, (_, i) => ({ name: pick.n > 2 ? `${S.computer} ${i + 1}` : S.computer, bot: true }))];
    setRole(null); setErr("");
    begin({ game: g, level: pick.level, mode: "cpu", lc: {}, seats: sl, side: pick.side });
  };
  const startOnline = () => {
    const g = pick.game;
    const c = makeCode();
    myT.current = Date.now();
    setErr(""); setRole("host"); setCode(c); setGame(g); setLevel(pick.level); setMode("duel"); setSeats([]);
    room.join(c, { name: nm.trim().slice(0, 20), role: "host", max: g === "ludo" ? pick.n : 2, t: myT.current });
    setView("lobby");
  };
  const hostStart = () => {
    const r = ref.current;
    const maxN = r.game === "ludo" ? r.pick.n : 2;
    const seatList = r.seats.length
      ? r.seats // rematch: same players
      : [{ id: r.myId, name: r.myName }, ...r.peers.filter((p) => p.role === "guest").slice(0, maxN - 1).map((p) => ({ id: p.id, name: p.name || S.friend }))];
    if (seatList.length < 2) return;
    const lcfg = (r.cfg[r.game] && r.cfg[r.game].levels[r.level]) || {};
    let dk = null;
    if (r.game === "memory") {
      const u = r.ui;
      const pairs = Math.min(u.MEM_CARDS.length, Math.floor((u.num(lcfg.cols, 4, 2, 6) * u.num(lcfg.rows, 3, 2, 6)) / 2));
      dk = u.shuffleArr(Array.from({ length: pairs * 2 }, (_, i) => i % pairs));
    }
    const m = { t: "start", game: r.game, level: r.level, mode: "duel", lc: lcfg, deck: dk, seats: seatList };
    room.send(m);
    begin(m);
  };
  const finish = (w) => { setRes({ w: w === "host" ? 0 : w === "guest" ? 1 : w }); setView("result"); };
  const restart = () => { if (lastM.current) begin(lastM.current); };
  const maybeRematch = () => {
    const r = ref.current;
    if (r.role !== "host" || !reMeRef.current) return;
    const humans = r.seats.filter((s) => s.id && s.id !== r.myId && !s.bot);
    if (humans.every((s) => reIds.current.has(s.id))) hostStart();
  };
  const wantRematch = () => {
    if (!online) { restart(); return; }
    reMeRef.current = true; setReMe(true);
    room.send({ t: "rematch" });
    maybeRematch();
  };
  const markBot = (id) => {
    const who = (ref.current.seats.find((s) => s.id === id) || {}).name || S.friend;
    setSeats((p) => p.map((s) => (s.id === id ? { ...s, bot: true } : s)));
    setNote(fmt(S.tookOver, { name: who }));
    setTimeout(() => setNote(""), 4000);
  };
  // a friend left (or lost the connection for too long)
  const peerGone = (id) => {
    const r = ref.current;
    if (r.mode !== "duel" || !r.role) return;
    if (r.view === "lobby") { if (r.role === "guest" && id === hostId.current) setErr("left"); return; }
    if (r.view !== "count" && r.view !== "play") return;
    const idx = r.seats.findIndex((s) => s.id === id);
    if (idx < 0 || r.seats[idx].bot) return;
    const multi = r.game === "ludo" && r.seats.length > 2;
    if (idx === 0 || !multi) { setErr("left"); return; } // the host left, or a 2-player game: it is over
    if (r.role === "host") { room.send({ t: "drop", id }); markBot(id); } // Ludo: a computer takes the seat
  };
  const leaveRoom = () => {
    if (online) room.bye(); else room.leave();
    if (hostId) hostId.current = "";
    setErr(""); setRole(null); setCode(""); setRes(null); setGame(null); setMode(null); setSeats([]);
    setCodeIn(""); setCodeErr(""); setShowInfo(false); setNote("");
    setPick({ game: null, level: "easy", mode: "duel", n: 2, side: 1 });
    setView("menu");
  };
  const joinByCode = () => {
    const c = codeIn.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (c.length < 4) { setCodeErr(S.badCode); return; }
    myT.current = Date.now();
    setCodeErr(""); setErr(""); setRole("guest"); setCode(c); setGame(null); setMode("duel"); setSeats([]);
    room.join(c, { name: nm.trim().slice(0, 20), role: "guest", t: myT.current });
    setView("lobby");
  };
  const doJoin = () => {
    myT.current = Date.now();
    setErr(""); setRole("guest"); setCode(join.room); setGame(join.g); setMode("duel"); setSeats([]);
    room.join(join.room, { name: nm.trim().slice(0, 20), role: "guest", t: myT.current });
    setView("lobby");
  };
  F.current = { begin, finish, hostStart, addFloat, setErr, peerGone, markBot, maybeRematch };

  /* ----- messages from friends ----- */
  useEffect(() => room.on((m) => {
    const r = ref.current;
    if (m.t === "start" && r.role === "guest") {
      if (hostId.current && m.from !== hostId.current) return;
      if (!Array.isArray(m.seats) || !m.seats.some((s) => s.id === r.myId)) { F.current.setErr("started"); return; }
      F.current.begin({ ...m, mode: "duel" });
    } else if (m.t === "drop" && m.from === hostId.current) F.current.markBot(m.id);
    else if (m.t === "emo" && typeof m.e === "string") F.current.addFloat(m.e.slice(0, 4));
    else if (m.t === "bye") F.current.peerGone(m.from);
    else if (m.t === "rematch") { reIds.current.add(m.from); setReN(reIds.current.size); F.current.maybeRematch(); }
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- timers and presence ----- */
  useEffect(() => {
    if (view !== "count") return undefined;
    const id = setTimeout(() => { if (count > 0) setCount(count - 1); else setView("play"); }, count === 0 ? 550 : 800);
    return () => clearTimeout(id);
  }, [view, count]);
  useEffect(() => { room.lost.forEach((id) => F.current.peerGone(id)); }, [room.lost]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (room.state === "error") setErr("net"); }, [room.state]);
  useEffect(() => { // too many guests: the later ones give up their place
    if (!online || role !== "guest" || view !== "lobby" || err) return;
    const h = room.peers.find((p) => p.role === "host");
    if (!h) return;
    const gs = [...room.peers.filter((p) => p.role === "guest"), { id: room.id, t: myT.current }].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
    if (gs.findIndex((p) => p.id === room.id) >= (h.max || 2) - 1) { setErr("full"); room.leave(); }
  }, [room.peers]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // connected, but no host appeared: the code or link is old
    if (!online || role !== "guest" || view !== "lobby" || err || room.state !== "open") return undefined;
    if (room.peers.some((p) => p.role === "host")) return undefined;
    const id = setTimeout(() => setErr("gone"), 12000);
    return () => clearTimeout(id);
  }, [role, view, room.peers, err, room.state]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- what to draw ----- */
  const list = Object.keys(cfg).filter((k) => cfg[k].enabled && MODES[k]).sort((a, b) => (cfg[a].sort ?? 0) - (cfg[b].sort ?? 0));
  const joinBad = view === "join" && !(join && cfg[join.g] && cfg[join.g].enabled);
  const inviteUrl = (() => {
    if (!code) return "";
    const base = makeLink(st, { play: "hub" }).split("?")[0];
    const q = new URLSearchParams({ room: code, g: game || "", lv: level || "" });
    if (nm.trim()) q.set("by", nm.trim().slice(0, 20));
    return `${base}?${q.toString()}`;
  })();
  const infoGame = view === "level" ? pick.game : game;
  const infoNode = infoGame && cfg[infoGame] ? (
    <InfoModal open={showInfo} onClose={() => setShowInfo(false)} S={S} title={tx(cfg[infoGame].title, lang)} lines={(HOW[lang] || HOW.en)[infoGame] || []} />
  ) : null;
  const title = (txt) => <h2 className="font-serif text-3xl font-bold" style={goldText}>{txt}</h2>;
  const inputCls = "mt-1 w-full rounded-xl px-3 py-2.5 text-base outline-none";
  const nameBox = (
    <label className="mt-5 block w-full text-left">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#c9972f" }}>{S.yourName}</span>
      <input value={nm} onChange={(e) => setNm(e.target.value.slice(0, 20))} maxLength={20} className={inputCls} style={{ ...PANEL, color: "#efe8d6" }} />
    </label>
  );
  const pill = online && role ? <ConnPill S={S} state={room.state} away={room.away} name={friendName} /> : null;

  if (err || joinBad) {
    const msg = joinBad ? S.gone : err === "left" ? fmt(S.left, { name: friendName }) : err === "full" ? S.full : err === "gone" ? S.gone : err === "started" ? S.started : S.net;
    return (
      <div className="mx-auto max-w-[420px] text-center">
        <p className="text-4xl">🔌</p>
        <p className="mt-3 text-base font-semibold">{msg}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {err === "net" && <Btn gold onClick={() => { setErr(""); room.retryNow(); }}>↻ {S.retry}</Btn>}
          <Btn gold={err !== "net"} onClick={joinBad ? onHub : leaveRoom}>← {S.back}</Btn>
        </div>
      </div>
    );
  }

  /* menu: only games that have Online, Pass & Play or vs Computer */
  if (view === "menu")
    return (
      <div className="mx-auto max-w-[480px]">
        <div className="text-center">{title(S.title)}<p className="mt-1 text-sm opacity-70">{S.pick}</p></div>
        <div className="mt-5 space-y-3">
          {list.map((k, i) => (
            <motion.button
              key={k} type="button"
              onClick={() => { setPick({ game: k, level: "easy", mode: MODES[k][0], n: k === "ludo" ? 4 : 2, side: 1 }); setView("level"); }}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i, type: "spring", stiffness: 160, damping: 18 }}
              whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }}
              className="flex w-full items-center gap-4 rounded-2xl p-4 text-left" style={{ ...PANEL, boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4), 0 10px 24px rgba(0,0,0,.4)" }}
            >
              <div className="grid h-14 w-16 shrink-0 place-items-center"><Icon kind={k} /></div>
              <div className="min-w-0 flex-1">
                <b className="block font-serif text-lg leading-tight" style={goldText}>{tx(cfg[k].title, lang)}</b>
                <span className="mt-1 block text-[12px] opacity-70">{tx(cfg[k].desc, lang)}</span>
              </div>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {MODES[k].map((m) => (
                  <span key={m} className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ background: GOLD, color: "#3b2506" }}>
                    {modeLabel(m, S)}
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
              className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-center font-mono text-xl tracking-[0.35em] outline-none" style={{ ...PANEL, color: "#efe8d6" }}
            />
            <Btn gold disabled={codeIn.length < 4} onClick={joinByCode}>{S.joinCodeBtn}</Btn>
          </div>
          {codeErr && <p className="mt-2 text-[11px]" style={{ color: "#ff8a8a" }}>{codeErr}</p>}
          <label className="mt-3 block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#c9972f" }}>{S.yourName}</span>
            <input value={nm} onChange={(e) => setNm(e.target.value.slice(0, 20))} maxLength={20} className={inputCls} style={{ ...PANEL, color: "#efe8d6" }} />
          </label>
        </div>
        <div className="mt-6 text-center"><Btn onClick={onHub}>← {S.back}</Btn></div>
      </div>
    );

  /* how to play: mode, players, level, side, names */
  if (view === "level" && pick.game && cfg[pick.game]) {
    const gk = pick.game, md = pick.mode, isLudo = gk === "ludo";
    const n = isLudo ? pick.n : 2;
    const leveled = md === "cpu" || !!LEVELED[gk];
    const lvs = md === "cpu" ? LEVELS : LEVELS.filter((l) => cfg[gk].levels[l] && cfg[gk].levels[l].enabled !== false);
    const lvInfo = (lv) =>
      md === "cpu"
        ? gk === "chess" ? (lv === "easy" ? S.eloEasy : lv === "medium" ? S.eloMed : S.eloHard) : lv === "easy" ? S.botEasy : lv === "medium" ? S.botMed : S.botHard
        : info(gk, lv);
    const go = md === "pass" ? startPass : md === "cpu" ? startCpu : startOnline;
    return (
      <div className="mx-auto max-w-[420px]">
        {infoNode}
        <div className="flex justify-end"><InfoBtn onClick={() => setShowInfo(true)} S={S} /></div>
        <div className="text-center">
          <div className="mx-auto grid h-16 w-20 place-items-center"><Icon kind={gk} /></div>
          <div className="mt-2">{title(tx(cfg[gk].title, lang))}</div>
        </div>

        <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "#c9972f" }}>{S.howTo}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {MODES[gk].map((m) => <Opt key={m} on={md === m} onClick={() => setPick({ ...pick, mode: m })}>{modeLabel(m, S)}</Opt>)}
        </div>
        <p className="mt-1.5 text-center text-[11px] opacity-70">{md === "pass" ? S.passHint : md === "cpu" ? S.cpuHint : S.onlineHint}</p>

        {isLudo && (
          <>
            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "#c9972f" }}>{S.players}</p>
            <div className="mt-2 flex justify-center gap-2">
              {[2, 3, 4].map((x) => <Opt key={x} on={pick.n === x} onClick={() => setPick({ ...pick, n: x })}>{fmt(S.nPlayers, { n: x })}</Opt>)}
            </div>
          </>
        )}

        {gk === "chess" && md === "cpu" && (
          <>
            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "#c9972f" }}>{S.playAs}</p>
            <div className="mt-2 flex justify-center gap-2">
              <Opt on={pick.side === 1} onClick={() => setPick({ ...pick, side: 1 })}>{S.first}</Opt>
              <Opt on={pick.side === 2} onClick={() => setPick({ ...pick, side: 2 })}>{S.second}</Opt>
            </div>
          </>
        )}

        {leveled && (
          <>
            <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "#c9972f" }}>{S.chooseLevel}</p>
            <div className="mt-2 space-y-3">
              {lvs.map((lv, i) => (
                <motion.button
                  key={lv} type="button" onClick={() => setPick({ ...pick, level: lv })}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} whileTap={{ scale: 0.98 }}
                  className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left"
                  style={{ ...PANEL, boxShadow: pick.level === lv ? "inset 0 0 0 2px #f0cb62, 0 0 24px rgba(240,203,98,.4)" : PANEL.boxShadow }}
                >
                  <span>
                    <b className="block font-serif text-xl" style={goldText}>{T[lv]}</b>
                    <span className="mt-0.5 block text-[12px] opacity-70">{lvInfo(lv)}</span>
                  </span>
                  {pick.level === lv && <span style={{ color: "#f0cb62" }}>✓</span>}
                </motion.button>
              ))}
            </div>
          </>
        )}

        {md === "pass"
          ? Array.from({ length: n }).map((_, i) => (
              <label key={i} className="mt-3 block w-full text-left">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: SEATC[i] }}>{fmt(S.pN, { n: i + 1 })}</span>
                <input
                  value={i === 0 ? nm : pn[i - 1]}
                  onChange={(e) => (i === 0 ? setNm(e.target.value.slice(0, 20)) : setPn((a) => a.map((x, j) => (j === i - 1 ? e.target.value.slice(0, 20) : x))))}
                  maxLength={20} className={inputCls} style={{ ...PANEL, color: "#efe8d6" }}
                />
              </label>
            ))
          : nameBox}

        <div className="mt-5 flex justify-center gap-2">
          <Btn onClick={() => setView("menu")}>← {S.back}</Btn>
          <Btn gold onClick={go}>{md === "duel" ? S.create : S.startNow} →</Btn>
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
        <p className="mt-2 text-sm opacity-80">{tx(cfg[join.g].title, lang)}</p>
        {nameBox}
        <div className="mt-5 flex justify-center gap-2">
          <Btn onClick={onHub}>← {S.back}</Btn>
          <Btn gold onClick={doJoin}>{S.joinBtn} →</Btn>
        </div>
      </div>
    );

  /* lobby: shows every seat */
  if (view === "lobby") {
    const hostP = role === "host" ? { id: room.id, name: myName } : hostPeer;
    const gs = [...room.peers.filter((p) => p.role === "guest"), ...(role === "guest" ? [{ id: room.id, name: myName, t: myT.current }] : [])]
      .sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
    const members = [hostP, ...gs].filter(Boolean);
    const cap = role === "host" ? (game === "ludo" ? pick.n : 2) : (hostPeer && hostPeer.max) || 2;
    return (
      <div className="mx-auto max-w-[440px] text-center">
        {pill}
        {title(S.lobby)}
        {gameTitle ? <p className="mt-1 text-sm opacity-70">{gameTitle}</p> : null}
        {role === "host" && (
          <div className="mt-5 rounded-2xl p-4" style={PANEL}>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "#c9972f" }}>{S.code}</p>
            <b className="mt-1 block font-mono text-4xl tracking-[0.35em]" style={goldText}>{code}</b>
            <p className="mt-1 text-[11px] opacity-70">{S.codeHint}</p>
            <InviteBar S={S} url={inviteUrl} text={fmt(S.inviteText, { game: gameTitle })} />
          </div>
        )}
        <div className="mt-4 space-y-2">
          {Array.from({ length: cap }).map((_, i) => {
            const mb = members[i];
            return (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2 text-left" style={PANEL}>
                <span className="grid h-8 w-8 place-items-center rounded-full font-serif font-bold" style={{ background: mb ? SEATC[i] : "rgba(255,255,255,.08)", color: "#1b1206" }}>
                  {mb ? (mb.name || "?").slice(0, 1).toUpperCase() : i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {mb ? `${mb.name || S.friend}${mb.id === room.id ? ` · ${S.you}` : ""}` : <i className="opacity-60">{S.emptySeat}</i>}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-5 min-h-[60px]">
          {room.state === "connecting" ? (
            <p className="opacity-70">{S.connecting}</p>
          ) : role === "host" ? (
            members.length >= 2 ? (
              <Btn gold onClick={hostStart}>{fmt(S.startN, { n: members.length })} →</Btn>
            ) : (
              <motion.p animate={{ opacity: [0.45, 1, 0.45] }} transition={{ repeat: Infinity, duration: 1.6 }}>{S.waiting}</motion.p>
            )
          ) : (
            <motion.p animate={{ opacity: [0.45, 1, 0.45] }} transition={{ repeat: Infinity, duration: 1.6 }}>
              {hostPeer ? fmt(S.waitHost, { name: hostPeer.name || S.friend }) : S.connecting}
            </motion.p>
          )}
        </div>
        <div className="mt-3"><Btn onClick={leaveRoom}>{S.leave}</Btn></div>
      </div>
    );
  }

  /* 3 - 2 - 1 */
  if (view === "count")
    return (
      <div className="grid min-h-[300px] place-items-center text-center">
        <div>
          {pill}
          <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: "#c9972f" }}>{seatNames.join(` ${S.vs} `)}</p>
          <motion.b
            key={count} initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14 }}
            className="mt-3 block font-serif text-8xl font-bold" style={goldText}
          >
            {count > 0 ? count : S.go}
          </motion.b>
        </div>
      </div>
    );

  /* result */
  if (view === "result" && res) {
    const hSeat = online ? mySeat : cpu ? (game === "chess" ? side - 1 : 0) : -1;
    const draw = res.w === "draw";
    const won = !draw && res.w === hSeat;
    const canOpen = local || won || (!!st.mp_loser_opens && !draw);
    const winner = draw ? "" : seatNames[res.w] || S.friend;
    const headline = draw ? S.draw : local ? fmt(S.youLost, { name: winner }) : won ? S.youWon : fmt(S.youLost, { name: winner });
    const reName = (() => { const id = [...reIds.current][0]; const s = seats.find((x) => x.id === id); return s ? s.name : S.friend; })();
    return (
      <div className="relative mx-auto max-w-[420px] text-center">
        {pill}
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
          <Btn gold={!canOpen} disabled={online && reMe} onClick={wantRematch}>
            {online && reMe ? fmt(S.rematchWait, { name: friendName }) : online && reN > 0 ? fmt(S.rematchAsk, { name: reName }) : S.rematch}
          </Btn>
          <Btn onClick={leaveRoom}>{online ? S.leave : S.back}</Btn>
        </div>
        {online && <Reactions onEmo={sendEmo} floats={floats} />}
      </div>
    );
  }

  /* play */
  const fin = (w) => F.current.finish(w);
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      {infoNode}
      {pill}
      <AnimatePresence>
        {note && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-2 rounded-full px-3 py-1.5 text-center text-[11px] font-semibold" style={{ ...chipStyle, color: "#f6dc8c" }}>
            🤖 {note}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#c9972f" }}>
          {gameTitle}{cpu ? ` · ${T[level]}` : ""}
        </span>
        <InfoBtn onClick={() => setShowInfo(true)} S={S} />
      </div>

      {game === "dots" && <DotsDuel key={runKey} ui={ui} lc={lc} role={gRole} names={names} net={netFor} S={S} onFinish={fin} />}
      {game === "memory" && deck && <MemoryDuel key={runKey} ui={ui} lc={lc} deck={deck} role={gRole} names={names} net={netFor} S={S} onFinish={fin} />}
      {game === "checkers" && <CheckersGame key={runKey} ui={ui} lang={lang} S={S} role={gRole} names={names} net={netFor} onFinish={fin} />}
      {game === "chess" && <ChessGame key={runKey} kit={KIT} ui={ui} lang={lang} S={S} role={gRole} names={names} level={level} side={side} net={netFor} onFinish={fin} />}
      {game === "ludo" && <LudoGame key={runKey} kit={KIT} ui={ui} lang={lang} S={S} role={gRole} seats={seats} mySeat={mySeat} level={level} net={netFor} onFinish={fin} />}

      {online && <Reactions onEmo={sendEmo} floats={floats} />}
    </div>
  );
}

/* "Reconnecting…" / "friend lost connection" pill */
function ConnPill({ S, state, away, name }) {
  const text = state === "reconnecting" ? S.reconnecting : away ? fmt(S.friendAway, { name }) : "";
  return (
    <div className="mb-2 flex min-h-[26px] justify-center">
      <AnimatePresence>
        {text && (
          <motion.p
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{ background: "rgba(240,203,98,.14)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.6)", color: "#f6dc8c" }}
          >
            <motion.i animate={{ opacity: [1, 0.25, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="h-2 w-2 rounded-full" style={{ background: "#f0cb62" }} />
            {text}
          </motion.p>
        )}
      </AnimatePresence>
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
            key={f.id} className="absolute text-4xl" style={{ left: `${f.x}%`, bottom: 0 }}
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