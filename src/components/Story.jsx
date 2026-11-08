import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { tx } from "../lib/i18n";

const NAV = 72; // height of your navbar in px (change if your navbar is taller or shorter)
const BLOBS = ["#f3d27a", "#b9d9a0", "#f1b8b8", "#b8c8ee", "#f3c9a0"]; // soft colour that changes per step

// "line one\nline two" -> ["line one", "line two"] (also removes a leading "-" or "•")
const bullets = (s) =>
  String(s || "")
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-–•]\s*/, "").trim())
    .filter(Boolean);

export default function Story() {
  const { lang } = useSettings();
  const { timeline, t } = useData();
  const items = timeline || [];
  const n = items.length;

  const [idx, setIdx] = useState(0);
  const [fy, setFy] = useState(480); // y position (px from top of screen) where the dot sits
  const itemRefs = useRef([]);
  const panelRef = useRef(null);

  const tr = (k, d) => {
    const v = t(k);
    return !v || v === k ? d : v;
  };

  // which step is closest to the focus line (dot) while scrolling
  useEffect(() => {
    if (!n) return;
    let raf = 0;
    const calc = () => {
      raf = 0;
      const md = window.matchMedia("(min-width: 768px)").matches;
      const top = md ? NAV : NAV + (panelRef.current?.offsetHeight || 0);
           const focus = top + (window.innerHeight - top) * (md ? 0.4 : 0.5);
      setFy((p) => (Math.abs(p - focus) > 0.5 ? focus : p));
      let best = 0;
      let bestD = Infinity;
      itemRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - focus);
        if (d < bestD) { bestD = d; best = i; }
      });
      setIdx(best);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(calc); };
    calc();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [n]);

  if (!n) return null;

  const cur = items[Math.min(idx, n - 1)];
  const pad = (v) => String(v).padStart(2, "0");
  const progress = ((idx + 1) / n) * 100;

  return (
    <section
      id="story"
           className="relative ml-[calc(50%-50vw)] mt-6 w-screen scroll-mt-20"
    >
      {/* soft colour glow that changes as you move through the story */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-40 -top-20 h-[620px] w-[620px] rounded-full blur-3xl"
          animate={{ backgroundColor: BLOBS[idx % BLOBS.length], opacity: 0.35 }}
          transition={{ duration: 0.9 }}
        />
        <motion.div
          className="absolute -bottom-40 -right-40 h-[620px] w-[620px] rounded-full blur-3xl"
          animate={{ backgroundColor: BLOBS[(idx + 3) % BLOBS.length], opacity: 0.3 }}
          transition={{ duration: 0.9 }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 md:grid md:grid-cols-[1fr_1.1fr] md:gap-16">
        {/* ---------- left: heading, big year, counter (sticky) ---------- */}
        <div
          ref={panelRef}
          className="sticky z-10 -mx-6 border-b border-line bg-bg/95 px-6 py-4 backdrop-blur md:mx-0 md:flex md:h-[calc(100svh-72px)] md:flex-col md:justify-start md:pt-16 md:self-start md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
          style={{ top: NAV }}
        >
          <p className="hidden items-center gap-2 text-xs font-medium opacity-70 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {tr("story", "My story")}
          </p>
          <h2 className="text-2xl font-bold leading-tight md:mt-3 md:text-5xl">
            {tr("story_title", "Let's go back in time.")}
          </h2>

          <div className="relative h-[4.2rem] overflow-hidden md:h-[10.5rem]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={cur.year}
                className="absolute left-0 top-0 text-[4rem] font-extrabold leading-none tracking-tight md:text-[9.5rem]"
                initial={{ y: "70%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-70%", opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                {cur.year}
              </motion.p>
            </AnimatePresence>
          </div>

          <p className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70 md:mt-4 md:text-xs">
            {cur.range}
          </p>

          <div className="mt-2 flex items-center gap-3 md:mt-5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span className="font-mono text-sm font-semibold">{pad(idx + 1)}</span>
            <span className="font-mono text-sm opacity-50">/ {pad(n)}</span>
            <span className="relative ml-1 h-px w-24 bg-current/20 md:w-44">
              <motion.span
                className="absolute inset-y-[-1px] left-0 h-[2px] bg-current"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </span>
          </div>
        </div>

        {/* ---------- right: vertical line, dot, steps ---------- */}
        <div className="relative pl-12 md:pl-10">
          {/* the line, with a dot that stays on the focus line while the steps scroll past */}
          <div className="pointer-events-none absolute inset-y-0 left-6 w-px bg-current/20 md:left-0">
            <div className="sticky top-0 h-[100svh]">
              <motion.span
                className="absolute left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-8 ring-ink/10"
                style={{ top: fy }}
              />
            </div>
          </div>

                    <div className="py-[12vh] md:py-[20vh]">
            {items.map((it, i) => {
              const on = i === idx;
              const list = bullets(tx(it.desc, lang));
              return (
                <div
                  key={it.id ?? i}
                  ref={(el) => { itemRefs.current[i] = el; }}
                  className="py-14 transition-[opacity,color] duration-500 md:py-20"
                  style={{ opacity: on ? 1 : 0.4 }}
                >
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">
                    {it.range}
                  </p>
                  <h3 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">{tx(it.title, lang)}</h3>
                  {it.org && <p className="mt-2 text-lg opacity-80">{it.org}</p>}
                  <ul className="mt-4 space-y-3">
                    {list.map((b, k) => (
                      <li key={k} className="flex gap-3 text-[15px] leading-relaxed opacity-80">
                        <span className="opacity-50">–</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}