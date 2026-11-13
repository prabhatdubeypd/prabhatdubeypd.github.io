import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { GameArt } from "./KingGames";

// order used when a game has no row in Supabase (chess/ludo are multiplayer-only so skipped)
const KEYS = ["elements", "find", "checkers", "watersort", "snake", "dots", "puzzle", "higherlower", "blackjack", "memory"];
const FALLBACK = { en: "Want to play?", hi: "गेम खेलें?" };
const SKEY = "games-banner-closed";
const SLIDE_MS = 2200; // how long each icon stays before sliding
const GOLD = "linear-gradient(180deg,#fff3bf 0%,#f0cb62 30%,#b8862b 58%,#f6dc8c 80%,#c9972f 100%)";

export default function GamesBanner({ lang, onPlay }) {
  const [closed, setClosed] = useState(() => {
    try { return sessionStorage.getItem(SKEY) === "1"; } catch { return false; }
  });
  const [rows, setRows] = useState(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let dead = false;
    supabase.from("games").select("*")
      .then(({ data, error }) => { if (!dead && !error && data) setRows(data); })
      .catch(() => {});
    return () => { dead = true; };
  }, []);

  const { list, banner } = useMemo(() => {
    const by = {};
    (rows || []).forEach((r) => { by[r.key] = r; });
    const sortOf = (k) => (by[k]?.sort != null ? by[k].sort : KEYS.indexOf(k) + 1);
    const list = KEYS.filter((k) => !by[k] || by[k].enabled !== false).sort((a, b) => sortOf(a) - sortOf(b));
    return { list, banner: by._banner };
  }, [rows]);

  useEffect(() => {
    if (closed || list.length < 2) return undefined;
    const id = setInterval(() => setIdx((i) => i + 1), SLIDE_MS);
    return () => clearInterval(id);
  }, [closed, list.length]);

  const show = !closed && list.length > 0 && banner?.enabled !== false;
  const current = list.length ? list[idx % list.length] : null;
  const title = (lang === "hi" ? banner?.title_hi : banner?.title_en) || banner?.title_en || FALLBACK[lang] || FALLBACK.en;

  const close = (e) => {
    e.stopPropagation();
    setClosed(true);
    try { sessionStorage.setItem(SKEY, "1"); } catch { /* ignore */ }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute right-0 top-full z-40"
          style={{ width: "max-content", transformOrigin: "90% 0" }}
          initial={{ opacity: 0, y: -24, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: [0, 2, -1.4, 1, 0] }}
          exit={{ opacity: 0, y: -24, transition: { duration: 0.25 } }}
          transition={{
            opacity: { duration: 0.3 },
            y: { type: "spring", stiffness: 140, damping: 14, delay: 0.6 },
            rotate: { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.4 },
          }}
        >
          {/* one thin string from the card icon */}
          <div className="relative h-2.5">
            <i className="absolute top-0 h-full w-px" style={{ right: 14, background: "#c9972f" }} />
          </div>

          <div className="relative">
            <div
              className="flex items-center gap-1.5 rounded-full py-[3px] pl-[3px] pr-3 text-[#efe8d6]"
              style={{
                background: "linear-gradient(160deg, #3a2e16, #15110a)",
                boxShadow: "0 0 0 1px rgba(240,203,98,.7), 0 6px 14px rgba(0,0,0,.4)",
              }}
            >
              {/* the icon: slides out left, next one slides in from the right */}
              <div className="relative h-[26px] w-[26px] shrink-0 overflow-hidden rounded-full" style={{ background: "rgba(240,203,98,.12)" }}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.button
                    key={current}
                    type="button" onClick={() => onPlay(current)} aria-label={current}
                    className="absolute inset-0"
                    initial={{ x: 22, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -22, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%) scale(.42)" }}>
                      <GameArt kind={current} />
                    </div>
                  </motion.button>
                </AnimatePresence>
              </div>

              <b
                className="whitespace-nowrap font-serif text-[10.5px] leading-none"
                style={{ backgroundImage: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
              >
                {title}
              </b>
            </div>

            {/* tiny X badge on the corner, so it never crowds the text */}
            <button
              type="button" onClick={close} aria-label="Close"
              className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full text-[7px] leading-none text-[#efe8d6]"
              style={{ background: "#15110a", boxShadow: "0 0 0 1px rgba(240,203,98,.8)" }}
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}