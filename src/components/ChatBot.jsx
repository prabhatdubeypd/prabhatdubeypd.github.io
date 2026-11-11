import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { supabase } from "../lib/supabase";
import { track } from "../lib/analytics";
import { openCal } from "../lib/cal";
import { scrollToRoom } from "./RoomScroll";

const GOLD = "linear-gradient(180deg,#fff3bf 0%,#f0cb62 30%,#b8862b 58%,#f6dc8c 80%,#c9972f 100%)";
const goldText = { backgroundImage: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
const TAG = /\[\[\s*([a-z]+)(?::([^\]]+?))?\s*\]\]/gi;

// splits "answer text [[hire]]" into the text and a list of action buttons
function parse(text) {
  const found = [];
  const clean = String(text || "")
    .replace(TAG, (_, k, v) => { found.push({ k: k.toLowerCase(), v: v ? v.trim() : "" }); return ""; })
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const seen = new Set();
  const actions = found.filter((a) => {
    const id = a.k + a.v;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, 3);
  return { text: clean, actions };
}

function Typed({ text, on, onTick }) {
  const [n, setN] = useState(on ? 0 : text.length);
  useEffect(() => {
    if (!on) return undefined;
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 2)), 18);
    return () => clearInterval(id);
  }, [on, text]);
  useEffect(() => { onTick?.(); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{text.slice(0, n)}</>;
}

export default function ChatBot() {
  const { lang } = useSettings();
  const { categories, features } = useData();
  const L = (en, hi) => (lang === "hi" ? hi : en);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false); // a book is open full screen
  const [msgs, setMsgs] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("bot_msgs")) || []; } catch { return []; }
  });
  const [fresh, setFresh] = useState(-1);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState({ loaded: false, off: false, rows: {} });
  const [tip, setTip] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const visitor = useMemo(() => {
    try {
      let v = localStorage.getItem("bot_vid");
      if (!v) {
        v = (window.crypto?.randomUUID?.() || String(Math.random()).slice(2)).slice(0, 40);
        localStorage.setItem("bot_vid", v);
      }
      return v;
    } catch { return "anon"; }
  }, []);

  // settings from Supabase (table bot_settings); if the table is missing the bot stays hidden
  useEffect(() => {
    let off = false;
    supabase.from("bot_settings").select("*").then(({ data, error }) => {
      if (off) return;
      if (error || !data) { setCfg({ loaded: true, off: true, rows: {} }); return; }
      const rows = {};
      data.forEach((r) => { rows[r.key] = r; });
      setCfg({ loaded: true, off: rows.enabled?.en === "false", rows });
    });
    return () => { off = true; };
  }, []);

  const S = (k) => {
    const r = cfg.rows[k];
    return r ? (lang === "hi" && r.hi ? r.hi : r.en) || "" : "";
  };
  const name = S("name") || L("Assistant", "असिस्टेंट");
  const greeting = S("greeting") || L("Hi! Ask me anything about this portfolio.", "नमस्ते! इस पोर्टफोलियो के बारे में कुछ भी पूछें।");
  const chips = (S("chips") || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 4);

  useEffect(() => { try { sessionStorage.setItem("bot_msgs", JSON.stringify(msgs.slice(-30))); } catch { /* ignore */ } }, [msgs]);

  useEffect(() => {
    const o = () => setOpen(true);
    const b = (e) => setHidden(e.detail != null);
    window.addEventListener("open-bot", o);
    window.addEventListener("book-active", b);
    return () => { window.removeEventListener("open-bot", o); window.removeEventListener("book-active", b); };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  // a small hint above the button, once per visit
  useEffect(() => {
    if (!cfg.loaded || cfg.off || msgs.length) return undefined;
    let seen = false;
    try { seen = !!sessionStorage.getItem("bot_tip"); } catch { /* ignore */ }
    if (seen) return undefined;
    const a = setTimeout(() => setTip(true), 7000);
    const b = setTimeout(() => { setTip(false); try { sessionStorage.setItem("bot_tip", "1"); } catch { /* ignore */ } }, 15000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [cfg.loaded, cfg.off]); // eslint-disable-line react-hooks/exhaustive-deps

  const toEnd = () => endRef.current?.scrollIntoView({ block: "end" });
  useEffect(() => { if (open) setTimeout(toEnd, 60); }, [msgs, busy, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 400); }, [open]);

  const send = async (text) => {
    const q = String(text || "").trim().slice(0, 500);
    if (!q || busy) return;
    const next = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    track("bot_message");
    try {
      const { data, error } = await supabase.functions.invoke("ask-bot", {
        body: { messages: next.slice(-8), lang, visitor },
      });
      if (error || !data?.reply) throw error || new Error("empty");
      setFresh(next.length);
      setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setFresh(next.length);
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: L(
            "Sorry, I couldn't answer that right now. You can message Prabhat directly and he will reply within a day. [[hire]]",
            "माफ़ कीजिए, अभी जवाब नहीं दे पाया। आप प्रभात को सीधे संदेश भेज सकते हैं, वे एक दिन में जवाब देंगे। [[hire]]"
          ),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const run = (a) => {
    track("bot_action", { action: a.k });
    setOpen(false);
    setTimeout(() => {
      if (a.k === "hire") window.dispatchEvent(new CustomEvent("open-hire"));
      else if (a.k === "book" && !a.v) openCal();
      else if (a.k === "work") scrollToRoom();
      else if (a.k === "story") document.getElementById("story")?.scrollIntoView({ behavior: "smooth" });
      else if (a.k === "privacy") window.dispatchEvent(new CustomEvent("open-privacy"));
      else if (a.k === "card") {
        const r = document.querySelector('[aria-label="Open card"]')?.getBoundingClientRect();
        window.dispatchEvent(
          new CustomEvent(features?.kingGames !== false ? "open-king-games" : "open-king-card", {
            detail: r ? { x: r.left + r.width / 2, y: r.bottom } : undefined,
          })
        );
      } else if (a.k === "book") {
        const c = (categories || []).find((x) => String(x.id) === String(a.v));
        if (c) window.dispatchEvent(new CustomEvent("open-book", { detail: c.id }));
      }
    }, 260);
  };

  const label = (a) => {
    if (a.k === "hire") return L("Hire me", "हायर करें");
    if (a.k === "book" && !a.v) return L("Book a 15-min call", "15 मिनट की कॉल बुक करें");
    if (a.k === "work") return L("See my work", "मेरा काम देखें");
    if (a.k === "story") return L("My story", "मेरी कहानी");
    if (a.k === "privacy") return L("Privacy policy", "गोपनीयता नीति");
    if (a.k === "card") return L("Play & win the card", "खेलें और कार्ड जीतें");
    if (a.k === "book") {
      const c = (categories || []).find((x) => String(x.id) === String(a.v));
      return c ? `${L("Open", "खोलें")}: ${lang === "hi" ? c.name?.hi || c.name?.en : c.name?.en}` : L("Open book", "बुक खोलें");
    }
    return a.k;
  };

  if (!cfg.loaded || cfg.off) return null;

  const bubble = "max-w-[86%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed";

  return (
    <>
      {/* the button */}
      <AnimatePresence>
        {!open && !hidden && (
          <motion.div key="fab" className="fixed bottom-4 left-4 z-[45]" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.6 }}>
            <AnimatePresence>
              {tip && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                  className="absolute bottom-[62px] left-0 whitespace-nowrap rounded-2xl px-3 py-2 text-xs font-medium text-[#efe8d6]"
                  style={{ background: "#15110a", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5), 0 10px 24px rgba(0,0,0,.35)" }}
                >
                  {L("Ask me anything 👋", "कुछ भी पूछें 👋")}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              type="button" aria-label={L("Open chat assistant", "चैट असिस्टेंट खोलें")}
              onClick={() => { setOpen(true); setTip(false); track("bot_open"); }}
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
              className="relative grid h-[52px] w-[52px] place-items-center rounded-full"
              style={{ background: GOLD, color: "#3b2506", boxShadow: "0 10px 26px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.7)" }}
            >
              <span className="absolute inset-0 animate-ping rounded-full opacity-20" style={{ background: "#f0cb62" }} />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
                <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth="2.6" />
              </svg>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel" role="dialog" aria-label={name}
            className="fixed inset-x-2 bottom-2 z-[55] flex flex-col overflow-hidden rounded-[26px] text-[#efe8d6] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[390px]"
            style={{
              height: "min(620px, calc(100dvh - 76px))", transformOrigin: "0% 100%",
              background: "radial-gradient(120% 80% at 20% 0%, #2c2415 0%, #14100a 55%, #070504 100%)",
              boxShadow: "0 0 0 1.5px rgba(240,203,98,.55), 0 30px 70px rgba(0,0,0,.6)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
            initial={{ opacity: 0, scale: 0.7, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 30 }}
            transition={{ type: "spring", stiffness: 190, damping: 20 }}
          >
            {/* header */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(240,203,98,.25)" }}>
              <div className="grid h-9 w-9 place-items-center rounded-full" style={{ background: GOLD, color: "#3b2506" }}>
                <svg width="16" height="18" viewBox="0 0 100 120"><path d="M50 4 C50 4 96 42 96 70 C96 88 80 98 66 90 C62 88 58 84 56 80 C57 96 62 106 72 116 L28 116 C38 106 43 96 44 80 C42 84 38 88 34 90 C20 98 4 88 4 70 C4 42 50 4 50 4 Z" fill="currentColor" /></svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-[16px] font-bold leading-tight" style={goldText}>{name}</p>
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] opacity-70">
                  <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" style={{ boxShadow: "0 0 6px #4ade80" }} />
                  {L("Online", "ऑनलाइन")}
                </p>
              </div>
              {msgs.length > 0 && (
                <button type="button" onClick={() => setMsgs([])} className="rounded-full px-2.5 py-1 text-[10px]" style={{ boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4)" }}>
                  {L("Clear", "साफ़ करें")}
                </button>
              )}
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-sm" style={{ boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4)" }}>✕</button>
            </div>

            {/* messages */}
            <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${bubble} mr-auto`} style={{ background: "rgba(48,42,32,.85)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.3)" }}>
                {greeting}
              </motion.div>

              {msgs.length === 0 && chips.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {chips.map((c, i) => (
                    <motion.button
                      key={c} type="button" onClick={() => send(c)}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }}
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      className="rounded-full px-3 py-1.5 text-[12px]" style={{ boxShadow: "inset 0 0 0 1px rgba(240,203,98,.55)", background: "rgba(240,203,98,.06)" }}
                    >
                      {c}
                    </motion.button>
                  ))}
                </div>
              )}

              {msgs.map((m, i) => {
                if (m.role === "user")
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`${bubble} ml-auto`} style={{ background: GOLD, color: "#3b2506", fontWeight: 500 }}>
                      {m.content}
                    </motion.div>
                  );
                const { text, actions } = parse(m.content);
                return (
                  <div key={i}>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${bubble} mr-auto`} style={{ background: "rgba(48,42,32,.85)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.3)" }}>
                      <Typed text={text} on={i === fresh} onTick={toEnd} />
                    </motion.div>
                    {actions.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i === fresh ? 0.5 : 0 }} className="mt-2 flex flex-wrap gap-2">
                        {actions.map((a) => (
                          <motion.button
                            key={a.k + a.v} type="button" onClick={() => run(a)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold"
                            style={{ background: GOLD, color: "#3b2506", boxShadow: "0 6px 16px rgba(0,0,0,.4)" }}
                          >
                            {label(a)} →
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                );
              })}

              {busy && (
                <div className={`${bubble} mr-auto flex items-center gap-1.5`} style={{ background: "rgba(48,42,32,.85)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.3)" }}>
                  {[0, 1, 2].map((d) => (
                    <motion.i key={d} className="block h-2 w-2 rounded-full" style={{ background: "#f0cb62" }} animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: d * 0.15 }} />
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* input */}
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="px-3 pb-2 pt-1">
              <div className="flex items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5" style={{ background: "rgba(0,0,0,.45)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4)" }}>
                <input
                  ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} enterKeyHint="send"
                  placeholder={L("Ask about my work, services, hiring…", "काम, सेवाओं, हायरिंग के बारे में पूछें…")}
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-[#efe8d6] outline-none placeholder:text-[#efe8d6]/40"
                />
                <motion.button
                  type="submit" disabled={busy || !input.trim()} whileTap={{ scale: 0.9 }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full disabled:opacity-40" style={{ background: GOLD, color: "#3b2506" }} aria-label="Send"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </motion.button>
              </div>
              <p className="mt-1.5 text-center text-[10px] opacity-50">
                {L("AI answers can be wrong. Please don't share private details.", "AI के जवाब गलत हो सकते हैं। निजी जानकारी साझा न करें।")}
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}