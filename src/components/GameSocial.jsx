import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";

/* ---------- look ---------- */
const GOLD = "linear-gradient(180deg,#fff3bf 0%,#f0cb62 30%,#b8862b 58%,#f6dc8c 80%,#c9972f 100%)";
const goldText = { backgroundImage: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
const chipStyle = { boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5)", background: "rgba(20,14,6,.55)" };
const PANEL = {
  background: "linear-gradient(160deg, rgba(48,42,32,.92), rgba(16,13,9,.96))",
  boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4)",
};
const LEVELS = ["easy", "medium", "hard"];
const pad2 = (n) => String(n).padStart(2, "0");
export const fmtTime = (s) => `${Math.floor(s / 60)}:${pad2(Math.round(s) % 60)}`;
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ""));

/* ---------- defaults (Supabase table `game_settings` overrides these) ---------- */
const SET_DEF = {
  share: true,
  channels: "native,whatsapp,telegram,x,copy",
  share_image: true,
  deeplinks: true,
  link_delay_ms: 900,
  leaderboard: true,
  board_size: 10,
  ask_name: true,
  min_secs: 3,
  daily: true,
  daily_game: "",
  daily_level: "",
  auto_open_ms: 0,
  base_url: "",
  share_text_en: "I beat {game} ({level}) in {time}! Can you beat me?",
  share_text_hi: "मैंने {game} ({level}) {time} में जीता! क्या आप मुझे हरा सकते हैं?",
  invite_text_en: "Can you win my King of Spades card? Play the games here:",
  invite_text_hi: "क्या आप मेरा हुकुम का बादशाह कार्ड जीत सकते हैं? यहाँ गेम खेलें:",
};

/* ---------- texts ---------- */
const ST = {
  en: {
    challenge: "Challenge a friend", challengeSub: "Send your time. Let them try to beat it.",
    copy: "Copy link", copied: "Link copied!", copyFail: "Could not share. Try Copy link.", more: "Share…",
    image: "Share as image", imgSaved: "Image saved. Share it from your gallery.", making: "Making…",
    imgWon: "I won", imgBeat: "Can you beat me?",
    time: "Time", moves: "Moves", best: "Best",
    newBest: "New personal best!", firstWin: "First win!", wins: "wins",
    youBeat: "You beat {by} by {d}!", theyBeat: "{by} was {d} faster. Try again!", tied: "Dead heat with {by}!", friend: "your friend",
    lbTitle: "Leaderboard", lbEmpty: "No scores yet. Be the first!", yourName: "Your name",
    post: "Post my score", posting: "Posting…", posted: "Score posted!", rank: "Rank #{n}",
    postFail: "Could not post your score.", tooFast: "That time is not valid.", needName: "Enter a name first.", loading: "Loading…",
    chTitle: "{by} challenges you!", chBody: "{by} finished {game} ({level}) in {time}. Can you beat it?",
    accept: "Accept the challenge", other: "Pick another game", chip: "🎯 Beat {by}: {time}",
    daily: "Daily challenge", dailyDone: "Cleared today. Come back tomorrow!", dailyGo: "Play today's challenge",
    streak: "{n}-day streak", dailyCleared: "Daily challenge cleared",
    invite: "Invite a friend", invited: "Link copied!", playAgain: "Play again", levels: "Other levels",
  },
  hi: {
    challenge: "दोस्त को चुनौती दें", challengeSub: "अपना समय भेजें। देखें दोस्त हरा पाता है या नहीं।",
    copy: "लिंक कॉपी करें", copied: "लिंक कॉपी हो गया!", copyFail: "शेयर नहीं हो सका। लिंक कॉपी करें।", more: "शेयर…",
    image: "इमेज के रूप में शेयर करें", imgSaved: "इमेज सेव हो गई। गैलरी से शेयर करें।", making: "बन रही है…",
    imgWon: "मैं जीता", imgBeat: "क्या आप मुझे हरा सकते हैं?",
    time: "समय", moves: "चालें", best: "सर्वश्रेष्ठ",
    newBest: "नया निजी रिकॉर्ड!", firstWin: "पहली जीत!", wins: "जीत",
    youBeat: "आपने {by} को {d} से हराया!", theyBeat: "{by} {d} तेज़ था। फिर कोशिश करें!", tied: "{by} से बराबरी!", friend: "आपका दोस्त",
    lbTitle: "लीडरबोर्ड", lbEmpty: "अभी कोई स्कोर नहीं। पहले बनिए!", yourName: "आपका नाम",
    post: "मेरा स्कोर पोस्ट करें", posting: "पोस्ट हो रहा है…", posted: "स्कोर पोस्ट हो गया!", rank: "रैंक #{n}",
    postFail: "स्कोर पोस्ट नहीं हो सका।", tooFast: "यह समय मान्य नहीं है।", needName: "पहले नाम लिखें।", loading: "लोड हो रहा है…",
    chTitle: "{by} आपको चुनौती देता है!", chBody: "{by} ने {game} ({level}) {time} में पूरा किया। क्या आप हरा सकते हैं?",
    accept: "चुनौती स्वीकार करें", other: "दूसरा गेम चुनें", chip: "🎯 {by} का समय हराएँ: {time}",
    daily: "रोज़ की चुनौती", dailyDone: "आज पूरी हो गई। कल फिर आइए!", dailyGo: "आज की चुनौती खेलें",
    streak: "{n} दिन की लगातार जीत", dailyCleared: "रोज़ की चुनौती पूरी",
    invite: "दोस्त को बुलाएँ", invited: "लिंक कॉपी हो गया!", playAgain: "फिर खेलें", levels: "दूसरे लेवल",
  },
};

/* ---------- personal progress (kept on the player's own device) ---------- */
const PKEY = "kg_prog_v1";
const EMPTY = () => ({ best: {}, wins: 0, streak: { last: "", n: 0 }, daily: { date: "" }, nick: "" });
const readProg = () => {
  try {
    const p = JSON.parse(localStorage.getItem(PKEY));
    return p && typeof p === "object" ? { ...EMPTY(), ...p } : EMPTY();
  } catch { return EMPTY(); }
};
const writeProg = (p) => { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch { /* private mode */ } };

const dkey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => dkey(new Date());
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dkey(d); };
const dayIndex = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); };

/* which game + level is today's challenge (rotates every day, or fixed by game_settings) */
export function dailyPick(cfg, st) {
  const keys = Object.keys(cfg).filter((k) => cfg[k] && cfg[k].enabled).sort((a, b) => (cfg[a].sort ?? 0) - (cfg[b].sort ?? 0));
  if (!keys.length) return null;
  const day = dayIndex();
  const game = st.daily_game && keys.includes(st.daily_game) ? st.daily_game : keys[day % keys.length];
  const lvls = LEVELS.filter((l) => cfg[game].levels[l] && cfg[game].levels[l].enabled !== false);
  if (!lvls.length) return null;
  const level = st.daily_level && lvls.includes(st.daily_level) ? st.daily_level : lvls[Math.floor(day / keys.length) % lvls.length];
  return { game, level };
}

/* ---------- deep links:  ?play=snake&lv=hard&t=47&m=30&by=Rahul ---------- */
export function makeLink(st, o) {
  let base = String(st.base_url || "").trim();
  if (!base) base = `${window.location.origin}${window.location.pathname}`;
  base = base.replace(/[?#].*$/, "");
  const q = new URLSearchParams();
  q.set("play", o.play);
  if (o.lv) q.set("lv", o.lv);
  if (o.t) q.set("t", String(o.t));
  if (o.m) q.set("m", String(o.m));
  if (o.by) q.set("by", o.by);
  return `${base}?${q.toString()}`;
}
export function readLink() {
  try {
    const q = new URLSearchParams(window.location.search);
    const play = q.get("play");
    if (!play) return null;
    const t = Number(q.get("t")), m = Number(q.get("m"));
    return {
      play: play.slice(0, 24),
      lv: (q.get("lv") || "").slice(0, 10),
      t: Number.isFinite(t) && t > 0 && t < 86400 ? Math.round(t) : 0,
      m: Number.isFinite(m) && m > 0 && m < 100000 ? Math.round(m) : 0,
      by: (q.get("by") || "").replace(/[<>]/g, "").slice(0, 20),
    };
  } catch { return null; }
}
export function clearLink() {
  try {
    const u = new URL(window.location.href);
    ["play", "lv", "t", "m", "by"].forEach((k) => u.searchParams.delete(k));
    window.history.replaceState({}, "", u.pathname + (u.search || "") + u.hash);
  } catch { /* ignore */ }
}

/* ---------- sharing ---------- */
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    try {
      const a = document.createElement("textarea");
      a.value = t; a.style.position = "fixed"; a.style.opacity = "0";
      document.body.appendChild(a); a.select();
      const ok = document.execCommand("copy");
      a.remove();
      return ok;
    } catch { return false; }
  }
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function openShare(c, text, url) {
  const full = `${text} ${url}`;
  const href =
    c === "whatsapp" ? `https://wa.me/?text=${encodeURIComponent(full)}`
    : c === "telegram" ? `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
    : c === "x" ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    : null;
  if (href) window.open(href, "_blank", "noopener,noreferrer");
}

/* ---------- the score image (a PNG the player can post anywhere) ---------- */
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Devanagari', sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const loadImg = (src) =>
  new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
function rrPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function fitFont(c, text, maxW, size, weight, fam) {
  let s = size;
  c.font = `${weight} ${s}px ${fam}`;
  while (c.measureText(text).width > maxW && s > 18) { s -= 2; c.font = `${weight} ${s}px ${fam}`; }
  return s;
}
async function drawScore({ art, game, level, time, moves, name, url, S }, withArt) {
  const W = 1080, H = 1350;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  const bg = x.createRadialGradient(W / 2, 0, 60, W / 2, H * 0.4, H);
  bg.addColorStop(0, "#3a2e16"); bg.addColorStop(0.55, "#15110a"); bg.addColorStop(1, "#070504");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.lineWidth = 6; x.strokeStyle = "#c9972f"; rrPath(x, 36, 36, W - 72, H - 72, 34); x.stroke();
  x.lineWidth = 2; x.strokeStyle = "rgba(240,203,98,.35)"; rrPath(x, 56, 56, W - 112, H - 112, 24); x.stroke();
  const gold = (y0, y1) => {
    const q = x.createLinearGradient(0, y0, 0, y1);
    q.addColorStop(0, "#fff3bf"); q.addColorStop(0.35, "#f0cb62"); q.addColorStop(0.7, "#b8862b"); q.addColorStop(1, "#f6dc8c");
    return q;
  };
  x.textAlign = "center"; x.textBaseline = "alphabetic";

  if (withArt) {
    const img = await loadImg(art);
    if (img) {
      const w = 330, h = 470;
      x.save(); x.translate(W / 2, 330); x.rotate(-0.05);
      x.shadowColor = "rgba(0,0,0,.65)"; x.shadowBlur = 40; x.shadowOffsetY = 22;
      x.drawImage(img, -w / 2, -h / 2, w, h);
      x.restore();
    }
  }

  x.fillStyle = "#c9972f"; x.font = `600 30px ${MONO}`;
  x.fillText(String(S.imgWon).toUpperCase(), W / 2, 650);
  fitFont(x, game, W - 200, 76, 700, SERIF);
  x.fillStyle = gold(680, 750); x.fillText(game, W / 2, 745);

  const lv = String(level).toUpperCase();
  x.font = `600 30px ${MONO}`;
  const pw = x.measureText(lv).width + 70;
  x.strokeStyle = "rgba(240,203,98,.7)"; x.lineWidth = 2; rrPath(x, W / 2 - pw / 2, 780, pw, 54, 27); x.stroke();
  x.fillStyle = "#e8c15a"; x.fillText(lv, W / 2, 818);

  x.fillStyle = "rgba(239,232,214,.7)"; x.font = `600 28px ${MONO}`;
  x.fillText(String(S.time).toUpperCase(), W / 2, 895);
  x.fillStyle = gold(910, 1060); x.font = `700 190px ${SERIF}`;
  x.fillText(time, W / 2, 1055);
  if (moves) {
    x.fillStyle = "rgba(239,232,214,.8)"; x.font = `500 34px ${SANS}`;
    x.fillText(`${moves} ${S.moves}`, W / 2, 1110);
  }
  x.fillStyle = "#efe8d6"; fitFont(x, S.imgBeat, W - 200, 52, 700, SERIF);
  x.fillText(S.imgBeat, W / 2, 1180);
  if (name) { x.fillStyle = "#e8c15a"; x.font = `500 34px ${SANS}`; x.fillText(`— ${name}`, W / 2, 1226); }
  let host = url;
  try { host = new URL(url).host; } catch { /* keep url */ }
  x.fillStyle = "#c9972f"; x.font = `500 28px ${MONO}`; x.fillText(host, W / 2, 1272);

  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
}
async function makeScoreImage(o) {
  try { return await drawScore(o, true); } catch { return drawScore(o, false); }
}

/* ---------- leaderboard queries ---------- */
async function fetchBoard(game) {
  try {
    const { data, error } = await supabase
      .from("game_scores")
      .select("id,name,level,secs,moves,created_at")
      .eq("game", game).eq("hidden", false)
      .order("secs", { ascending: true })
      .limit(300);
    return error ? null : data || [];
  } catch { return null; }
}
async function rankOf(game, level, secs) {
  try {
    const { count, error } = await supabase
      .from("game_scores")
      .select("id", { count: "exact", head: true })
      .eq("game", game).eq("level", level).eq("hidden", false).lt("secs", secs);
    return error || count == null ? null : count + 1;
  } catch { return null; }
}

/* =====================================================================
   THE HOOK: settings, personal bests, daily challenge, leaderboard
   ===================================================================== */
export function useSocial(cfg) {
  const [settings, setSettings] = useState(SET_DEF);
  const [prog, setProg] = useState(readProg);
  const [boards, setBoards] = useState({});
  const loadP = useRef(null);
  const cfgRef = useRef(cfg);
  const setRef = useRef(settings);
  cfgRef.current = cfg;
  setRef.current = settings;

  const updateProg = (fn) => {
    const p = readProg();
    const n = fn(p) || p;
    writeProg(n);
    setProg(n);
    return n;
  };

  // reads the single row of `game_settings` once
  const load = () => {
    if (!loadP.current) {
      loadP.current = supabase
        .from("game_settings").select("*").eq("id", 1).maybeSingle()
        .then(({ data, error }) => {
          const s = { ...SET_DEF };
          if (error) s.leaderboard = false; // tables are not created yet
          else if (data) for (const k of Object.keys(SET_DEF)) if (data[k] != null) s[k] = data[k];
          setSettings(s);
          return s;
        })
        .catch(() => SET_DEF);
    }
    return loadP.current;
  };

  const loadBoard = async (game, force) => {
    if (!force && Array.isArray(boards[game])) return boards[game];
    const rows = await fetchBoard(game);
    setBoards((b) => ({ ...b, [game]: rows === null ? false : rows }));
    return rows || [];
  };

  // called when a game is won: saves the best, the streak, and compares with a challenge
  const record = ({ game, level, secs, moves, link }) => {
    const key = `${game}:${level}`;
    let out = null;
    updateProg((p) => {
      const prev = p.best[key] || null;
      const best = !prev || secs < prev.secs;
      if (best) p.best[key] = { secs, moves: moves || null, at: Date.now() };
      p.wins = (p.wins || 0) + 1;
      let vs = null;
      if (link && link.t && link.play === game && link.lv === level) vs = { by: link.by || "", secs: link.t, diff: secs - link.t };
      let dl = null;
      const d = setRef.current.daily ? dailyPick(cfgRef.current, setRef.current) : null;
      if (d && d.game === game && d.level === level && p.daily.date !== today()) {
        p.daily = { date: today() };
        p.streak = { last: today(), n: p.streak.last === yesterday() ? p.streak.n + 1 : 1 };
        dl = { streak: p.streak.n };
      }
      out = { game, level, secs, moves: moves || null, best, prevBest: prev ? prev.secs : null, wins: p.wins, vs, daily: dl };
      return p;
    });
    return out;
  };

  const submit = async (res, name) => {
    const clean = String(name || "").replace(/[<>]/g, "").trim().slice(0, 20);
    if (!clean) return { ok: false, err: "name" };
    if (res.secs < (Number(setRef.current.min_secs) || 0)) return { ok: false, err: "fast" };
    try {
      const { error } = await supabase.from("game_scores").insert({
        game: res.game, level: res.level, name: clean, secs: res.secs, moves: res.moves || null,
      });
      if (error) return { ok: false, err: "db" };
    } catch { return { ok: false, err: "db" }; }
    updateProg((p) => { p.nick = clean; return p; });
    const rank = await rankOf(res.game, res.level, res.secs);
    await loadBoard(res.game, true);
    return { ok: true, rank, name: clean };
  };

  const daily = settings.daily ? dailyPick(cfg, settings) : null;
  const streak = prog.streak.last === today() || prog.streak.last === yesterday() ? prog.streak.n : 0;

  return {
    settings, load, prog, nick: prog.nick,
    bestOf: (game, level) => prog.best[`${game}:${level}`] || null,
    record, submit, boards, loadBoard,
    daily, dailyDone: prog.daily.date === today(), streak,
  };
}

/* =====================  UI PIECES  ===================== */
const Btn = ({ children, onClick, gold, disabled }) => (
  <motion.button
    type="button" onClick={onClick} disabled={disabled}
    whileHover={disabled ? undefined : { scale: 1.05 }} whileTap={disabled ? undefined : { scale: 0.96 }}
    className="rounded-full px-5 py-2.5 text-[12px] font-semibold"
    style={gold
      ? { background: GOLD, color: "#3b2506", boxShadow: "0 6px 16px rgba(0,0,0,.45)", opacity: disabled ? 0.6 : 1 }
      : { color: "#efe8d6", ...chipStyle, opacity: disabled ? 0.6 : 1 }}
  >
    {children}
  </motion.button>
);
const Badge = ({ children }) => (
  <motion.span
    initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
    transition={{ type: "spring", stiffness: 200, damping: 14 }}
    className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: GOLD, color: "#3b2506" }}
  >
    {children}
  </motion.span>
);
const Stat = ({ label, value }) => (
  <div className="rounded-xl px-2 py-2.5 text-center" style={PANEL}>
    <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "#c9972f" }}>{label}</p>
    <b className="mt-1 block font-serif text-xl" style={goldText}>{value}</b>
  </div>
);

const CH_LABEL = { whatsapp: "WhatsApp", telegram: "Telegram", x: "X" };

function ShareBar({ S, st, text, url, title, makeImage }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const flash = (m) => { setNote(m); setTimeout(() => setNote(""), 2400); };
  const list = String(st.channels || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const canNative = typeof navigator !== "undefined" && !!navigator.share;

  const go = async (c) => {
    if (c === "copy") { flash((await copyText(url)) ? S.copied : S.copyFail); return; }
    if (c === "native") {
      try { await navigator.share({ title, text, url }); } catch (e) { if (e && e.name !== "AbortError") flash(S.copyFail); }
      return;
    }
    openShare(c, text, url);
  };
  const img = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await makeImage();
      const file = new File([blob], "king-score.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text: `${text} ${url}` });
      } else {
        saveBlob(blob, "king-score.png");
        flash(S.imgSaved);
      }
    } catch (e) { if (e && e.name !== "AbortError") flash(S.copyFail); }
    setBusy(false);
  };

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2">
        {list.map((c) => {
          if (c === "native" && !canNative) return null;
          const label = c === "copy" ? `🔗 ${S.copy}` : c === "native" ? `↗ ${S.more}` : CH_LABEL[c] || c;
          return (
            <motion.button
              key={c} type="button" onClick={() => go(c)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="rounded-full px-4 py-2 text-[12px] font-semibold"
              style={c === "native" ? { background: GOLD, color: "#3b2506" } : { color: "#efe8d6", ...chipStyle }}
            >
              {label}
            </motion.button>
          );
        })}
        {st.share_image && (
          <motion.button
            type="button" onClick={img} disabled={busy} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="rounded-full px-4 py-2 text-[12px] font-semibold" style={{ color: "#efe8d6", ...chipStyle, opacity: busy ? 0.6 : 1 }}
          >
            🖼 {busy ? S.making : S.image}
          </motion.button>
        )}
      </div>
      <p className="mt-2 min-h-[16px] text-center text-[11px]" style={{ color: "#e8c15a" }}>{note}</p>
    </div>
  );
}

/* ---------- leaderboard list (tabs for the levels) ---------- */
export function Leaderboard({ lang, rows, levels, initial, me, size, lvLabel }) {
  const S = ST[lang] || ST.en;
  const [lv, setLv] = useState(initial && levels.includes(initial) ? initial : levels[0]);
  if (rows === false || !levels.length) return null;
  const list = rows ? rows.filter((r) => r.level === lv).slice(0, Number(size) || 10) : null;
  return (
    <div className="mt-5 w-full rounded-2xl p-3 text-left" style={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="font-serif text-base" style={goldText}>🏆 {S.lbTitle}</b>
        <div className="flex gap-1">
          {levels.map((l) => (
            <button
              key={l} type="button" onClick={() => setLv(l)}
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={l === lv ? { background: GOLD, color: "#3b2506" } : { color: "#efe8d6", ...chipStyle }}
            >
              {lvLabel(l)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2">
        {list === null ? (
          <p className="py-3 text-center text-[12px] opacity-60">{S.loading}</p>
        ) : list.length === 0 ? (
          <p className="py-3 text-center text-[12px] opacity-60">{S.lbEmpty}</p>
        ) : (
          <ul className="space-y-1">
            {list.map((r, i) => {
              const mine = me && r.name === me.name && r.secs === me.secs && r.level === me.level;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px]"
                  style={mine ? { background: "rgba(240,203,98,.16)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5)" } : undefined}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-6 text-center">{["🥇", "🥈", "🥉"][i] || i + 1}</span>
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="shrink-0 font-mono" style={{ color: "#e8c15a" }}>
                    {fmtTime(r.secs)}
                    {r.moves ? <i className="ml-1.5 not-italic opacity-60">· {r.moves}</i> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* =====================  RESULT SCREEN (replaces the old win screen)  ===================== */
export function ResultScreen({ lang, T, art, res, gameTitle, levelLabel, lvLabel, levels, soc, onOpen, onReplay, onLevels }) {
  const S = ST[lang] || ST.en;
  const st = soc.settings;
  const [name, setName] = useState(soc.nick || "");
  const [phase, setPhase] = useState("ask"); // ask | busy | done
  const [rank, setRank] = useState(null);
  const [posted, setPosted] = useState("");
  const [err, setErr] = useState("");

  const who = (st.ask_name ? name : soc.nick || "").trim().slice(0, 20);
  const url = makeLink(st, { play: res.game, lv: res.level, t: res.secs, m: res.moves || 0, by: who });
  const text = fmt(st[`share_text_${lang}`] || st.share_text_en, {
    game: gameTitle, level: levelLabel, time: fmtTime(res.secs), moves: res.moves || "", name: who,
  });
  const bestNow = Math.min(res.secs, res.prevBest ?? res.secs);

  useEffect(() => { if (st.leaderboard) soc.loadBoard(res.game, true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async () => {
    if (phase === "busy") return;
    const nm = (st.ask_name ? name : soc.nick || "Player").trim();
    if (!nm) { setErr(S.needName); return; }
    setPhase("busy"); setErr("");
    const r = await soc.submit(res, nm);
    if (r.ok) { setRank(r.rank); setPosted(r.name); setPhase("done"); }
    else { setPhase("ask"); setErr(r.err === "fast" ? S.tooFast : r.err === "name" ? S.needName : S.postFail); }
  };

  const by = res.vs ? res.vs.by || S.friend : "";

  return (
    <div className="relative mx-auto flex w-full max-w-[460px] flex-col items-center text-center">
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <motion.span
            key={i} className="pointer-events-none absolute left-1/2 top-[70px] text-[18px]"
            style={{ color: "#f6dc8c", textShadow: "0 0 10px rgba(255,200,90,.9)" }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
            animate={{ x: Math.cos(a) * 150, y: Math.sin(a) * 110, scale: [0, 1, 0], opacity: [0, 1, 0] }}
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
          style={{ height: 120, filter: "drop-shadow(0 18px 24px rgba(0,0,0,.6))" }}
        />
      )}
      <h2 className="mt-4 font-serif text-4xl font-bold" style={goldText}>{T.won}</h2>
      <p className="mt-1 text-sm opacity-75">{T.wonSub}</p>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {res.best && <Badge>★ {res.prevBest ? S.newBest : S.firstWin}</Badge>}
        {res.daily && <Badge>🔥 {S.dailyCleared} · {fmt(S.streak, { n: res.daily.streak })}</Badge>}
        {rank && <Badge>🏆 {fmt(S.rank, { n: rank })}</Badge>}
      </div>

      <div className="mt-4 grid w-full grid-cols-3 gap-2">
        <Stat label={S.time} value={fmtTime(res.secs)} />
        <Stat label={S.moves} value={res.moves || "–"} />
        <Stat label={S.best} value={fmtTime(bestNow)} />
      </div>

      {res.vs && (
        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="mt-3 rounded-full px-4 py-1.5 text-[12px] font-semibold"
          style={res.vs.diff < 0 ? { background: GOLD, color: "#3b2506" } : { color: "#efe8d6", ...chipStyle }}
        >
          {res.vs.diff < 0
            ? fmt(S.youBeat, { by, d: `${Math.abs(res.vs.diff)}s` })
            : res.vs.diff > 0
            ? fmt(S.theyBeat, { by, d: `${res.vs.diff}s` })
            : fmt(S.tied, { by })}
        </motion.p>
      )}

      <div className="mt-5"><Btn gold onClick={onOpen}>{T.openCard} →</Btn></div>

      {st.ask_name && (st.share || st.leaderboard) && (
        <label className="mt-6 block w-full text-left">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#c9972f" }}>{S.yourName}</span>
          <input
            value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} maxLength={20}
            className="mt-1 w-full rounded-xl px-3 py-2.5 text-base outline-none" style={{ ...PANEL, color: "#efe8d6" }}
          />
        </label>
      )}

      {st.share && (
        <div className="mt-4 w-full rounded-2xl p-4" style={PANEL}>
          <b className="font-serif text-lg" style={goldText}>{S.challenge}</b>
          <p className="mt-1 text-[12px] opacity-70">{S.challengeSub}</p>
          <div className="mt-3">
            <ShareBar
              S={S} st={st} text={text} url={url} title={gameTitle}
              makeImage={() => makeScoreImage({ art, game: gameTitle, level: levelLabel, time: fmtTime(res.secs), moves: res.moves, name: who, url, S })}
            />
          </div>
        </div>
      )}

      {st.leaderboard && (
        <div className="mt-4 w-full">
          {phase !== "done" ? (
            <Btn gold onClick={post} disabled={phase === "busy"}>{phase === "busy" ? S.posting : S.post}</Btn>
          ) : (
            <p className="font-semibold" style={{ color: "#e8c15a" }}>✓ {S.posted}</p>
          )}
          {err && <p className="mt-2 text-[12px]" style={{ color: "#ff8a8a" }}>{err}</p>}
          <Leaderboard
            lang={lang} rows={soc.boards[res.game]} levels={levels} initial={res.level} size={st.board_size} lvLabel={lvLabel}
            me={phase === "done" ? { name: posted, secs: res.secs, level: res.level } : null}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Btn onClick={onReplay}>↻ {S.playAgain}</Btn>
        <Btn onClick={onLevels}>{S.levels}</Btn>
      </div>
    </div>
  );
}

/* =====================  CHALLENGE SCREEN (a friend opened your link)  ===================== */
export function ChallengeScreen({ lang, link, art, gameTitle, levelLabel, onAccept, onOther }) {
  const S = ST[lang] || ST.en;
  const by = link.by || S.friend;
  return (
    <div className="mx-auto max-w-[440px] text-center">
      {art && (
        <motion.img
          src={art} alt="" draggable={false} className="kg-float mx-auto"
          initial={{ scale: 0.4, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: -4, opacity: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 14 }}
          style={{ height: 150, filter: "drop-shadow(0 18px 24px rgba(0,0,0,.6))" }}
        />
      )}
      <h2 className="mt-4 font-serif text-3xl font-bold" style={goldText}>{fmt(S.chTitle, { by })}</h2>
      <p className="mt-2 text-sm opacity-80">
        {fmt(S.chBody, { by, game: gameTitle, level: levelLabel, time: fmtTime(link.t) })}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Btn gold onClick={onAccept}>{S.accept} →</Btn>
        <Btn onClick={onOther}>{S.other}</Btn>
      </div>
    </div>
  );
}

// small line shown above the game while a challenge is active
export function ChallengeChip({ lang, link }) {
  const S = ST[lang] || ST.en;
  return (
    <p className="mb-3 text-center text-[11px] font-semibold" style={{ color: "#e8c15a" }}>
      {fmt(S.chip, { by: link.by || S.friend, time: fmtTime(link.t) })}
    </p>
  );
}

/* =====================  DAILY CHALLENGE + HUB FOOTER  ===================== */
export function DailyCard({ lang, soc, titleOf, lvLabel, onPlay }) {
  const S = ST[lang] || ST.en;
  const d = soc.daily;
  if (!d) return null;
  const done = soc.dailyDone;
  return (
    <motion.button
      type="button" onClick={() => onPlay(d.game, d.level)}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
      className="mx-auto mt-5 flex w-full max-w-[460px] items-center gap-3 rounded-2xl px-4 py-3 text-left"
      style={{ ...PANEL, boxShadow: "inset 0 0 0 1px rgba(240,203,98,.6), 0 12px 26px rgba(0,0,0,.4)" }}
    >
      <span className="text-2xl">{done ? "✅" : "🔥"}</span>
      <span className="min-w-0 flex-1">
        <b className="block font-serif text-[15px] leading-tight" style={goldText}>
          {S.daily} · {titleOf(d.game)} · {lvLabel(d.level)}
        </b>
        <span className="block text-[11px] opacity-70">{done ? S.dailyDone : S.dailyGo}</span>
      </span>
      {soc.streak > 0 && (
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: GOLD, color: "#3b2506" }}>
          {fmt(S.streak, { n: soc.streak })}
        </span>
      )}
    </motion.button>
  );
}

export function HubFooter({ lang, soc }) {
  const S = ST[lang] || ST.en;
  const st = soc.settings;
  const [note, setNote] = useState("");
  if (!st.share) return null;
  const url = makeLink(st, { play: "hub" });
  const text = st[`invite_text_${lang}`] || st.invite_text_en;
  const go = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "King of Spades", text, url }); } catch { /* cancelled */ }
      return;
    }
    const ok = await copyText(url);
    setNote(ok ? S.invited : S.copyFail);
    setTimeout(() => setNote(""), 2400);
  };
  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      {soc.prog.wins > 0 && <p className="text-[11px] opacity-70">🏅 {soc.prog.wins} {S.wins}</p>}
      <Btn onClick={go}>🔗 {S.invite}</Btn>
      <p className="min-h-[16px] text-[11px]" style={{ color: "#e8c15a" }}>{note}</p>
    </div>
  );
}