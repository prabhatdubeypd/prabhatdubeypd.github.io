import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { tx } from "../lib/i18n";

// one colour per pill (background, text). Add or change as you like.
const PALETTE = [
  { bg: "linear-gradient(180deg,#26221f,#171513)", fg: "#d9d3ca" }, // charcoal
  { bg: "linear-gradient(180deg,#27406a,#1b2d4a)", fg: "#d4dcea" }, // blue
  { bg: "linear-gradient(180deg,#5a4352,#41303b)", fg: "#e6dbe0" }, // plum
  { bg: "linear-gradient(180deg,#8fa086,#74866c)", fg: "#f1f4ec" }, // sage
  { bg: "linear-gradient(180deg,#c2622f,#9c4a22)", fg: "#fbeadd" }, // orange
  { bg: "linear-gradient(180deg,#d3c1c1,#b9a2a2)", fg: "#3b2f2f" }, // rose
];
const FALLBACK = ["Prabhat Dubey", "Web Development", "App Development", "UI/UX Design", "Beyond the Code"];
const KEY = "pre_labels_";

export default function Preloader() {
  const { lang } = useSettings();
  const { profile, categories, features, progress } = useData();
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false); // true = pills split left / right
  const [n, setN] = useState(0);
  const [small, setSmall] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const f = () => setSmall(window.innerWidth < 640);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  // names: from the database when it has loaded, else the ones saved last visit, else defaults
  const live = profile && categories ? [tx(profile.name, lang), ...categories.map((c) => tx(c.name, lang))] : null;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(KEY + lang)); } catch { /* ignore */ }
  const labels = live || (Array.isArray(cached) && cached.length ? cached : FALLBACK);
  const liveKey = live ? live.join("|") : "";
  useEffect(() => {
    if (!live) return;
    try { localStorage.setItem(KEY + lang, JSON.stringify(live)); } catch { /* ignore */ }
  }, [liveKey, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // the number glides toward the REAL loading progress
  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => {
      setN((v) => {
        if (v >= progress) return v;
        return Math.min(progress, v + Math.max(1, Math.ceil((progress - v) / 8)));
      });
    }, 24);
    return () => clearInterval(id);
  }, [show, progress]);

  // 100 reached: pills split left / right, then the screen lifts away
  useEffect(() => {
    if (n < 100) return;
    const a = setTimeout(() => setLeaving(true), 250);
    const b = setTimeout(() => setShow(false), 700);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [n]);

  // preloader switched off in the database
  useEffect(() => {
    if (features && features.preloader === false) setShow(false);
  }, [features]);

  useEffect(() => {
    document.body.style.overflow = show ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [show]);

  // compact sizes: each pill is only a little taller than the band you can see
  const STEP = small ? 34 : 40; // distance between pills (= visible band)
  const PILL_H = STEP + (small ? 12 : 14); // last pill: just a little extra
  const LINE = small ? 18 : 20; // text line height
  const PAD_TOP = Math.round((STEP - LINE) / 2); // centres the text in the visible band
  const stackH = (labels.length - 1) * STEP + PILL_H;
  const visible = Math.max(1, Math.ceil((n / 100) * labels.length));

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="preloader"
          className="fixed inset-0 z-[70] overflow-hidden bg-[#0a0908] text-white"
          exit={{ y: "-100%" }}
          transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
        >
          {/* soft warm glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 15% 70%, rgba(120,70,30,.28), transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(60,50,45,.35), transparent 50%)",
            }}
          />

          {/* stacked coloured pills */}
          <div
            className="absolute left-1/2 top-[42%] w-[min(58vw,270px)] -translate-x-1/2 -translate-y-1/2"
            style={{ height: stackH }}
          >
            {labels.map((label, k) => {
              const p = PALETTE[k % PALETTE.length];
              const shown = k < visible;
              const dir = k % 2 === 0 ? -1 : 1; // even pills leave to the left, odd to the right
              return (
                <motion.div
                  key={k}
                  initial={{ opacity: 0, x: 0, y: k * STEP + 40 }}
                  animate={
                    leaving
                      ? { opacity: 0, x: dir * 420, y: k * STEP }
                      : { opacity: shown ? 1 : 0, x: 0, y: shown ? k * STEP : k * STEP + 40 }
                  }
                  transition={
                    leaving
                      ? { duration: 0.4, ease: [0.5, 0, 0.75, 0], delay: k * 0.03 }
                      : { type: "spring", stiffness: 140, damping: 20 }
                  }
                  style={{
                    zIndex: k,
                    height: PILL_H,
                    paddingTop: PAD_TOP,
                    lineHeight: `${LINE}px`,
                    background: p.bg,
                    color: p.fg,
                    boxShadow: "0 -5px 14px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.12)",
                  }}
                  className="absolute inset-x-0 top-0 truncate rounded-full px-5 text-[13px] font-medium sm:px-6 sm:text-sm"
                >
                  {label}
                </motion.div>
              );
            })}
          </div>

          {/* bottom: caption + real counter + progress line */}
          <motion.div
            className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 px-6 pb-8 md:px-10"
            animate={{ opacity: leaving ? 0 : 1 }}
            transition={{ duration: 0.25 }}
          >
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60 sm:text-xs">Opening up the work</p>
              <p className="mt-2 text-5xl font-bold leading-none tabular-nums md:text-7xl">{n}</p>
            </div>
            <div className="mb-2 h-px w-24 bg-white/15 md:w-56">
              <div
                className="h-[2px] -translate-y-[0.5px]"
                style={{ width: `${n}%`, background: "linear-gradient(90deg,#8a6a2a,#f3d36b)" }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}