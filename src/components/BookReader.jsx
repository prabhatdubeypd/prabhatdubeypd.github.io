import { useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { useData } from "../context/DataContext";
import { tx } from "../lib/i18n";
import Cta from "./Cta";

/* ---------- Media inside the device ---------- */
function DeviceVideo({ src, poster, active, muted }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = muted;
    if (active) v.play().catch(() => {});
    else v.pause();
  }, [active, muted]);
  return (
    <video
      ref={ref}
      src={src}
      poster={poster || undefined}
      loop
      muted
      playsInline
      preload="metadata"
      className="h-full w-full object-cover"
    />
  );
}

function Media({ p, title, active, muted, t }) {
  if (p.video) return <DeviceVideo src={p.video} poster={p.image} active={active} muted={muted} />;
  if (p.image) return <img src={p.image} alt={title} className="h-full w-full object-cover" />;
  return (
    <div className="grid h-full place-items-center bg-gradient-to-br from-zinc-800 to-zinc-950 text-center text-xs text-white/60">
      <div>
        <div className="text-5xl font-bold text-white/20">{title.charAt(0)}</div>
        <p className="mt-2">{t("no_video")}</p>
      </div>
    </div>
  );
}

/* ---------- Device frames ---------- */
function Device({ type, flip, children }) {
  const tilt = { transform: `perspective(1400px) rotateY(${flip ? 6 : -6}deg) rotateX(2deg)` };

  if (type === "none") {
    return (
      <div className="w-full max-w-[300px] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10 md:max-w-[520px]" style={tilt}>
        <div className="aspect-video bg-black">{children}</div>
      </div>
    );
  }

  if (type === "phone") {
    return (
      <div
        className="relative h-[300px] w-[148px] rounded-[30px] bg-zinc-900 p-[7px] shadow-2xl ring-1 ring-white/10 md:h-[430px] md:w-[210px] md:rounded-[38px] md:p-[9px]"
        style={tilt}
      >
        <div className="absolute left-1/2 top-[11px] z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-black md:top-[15px] md:h-5 md:w-20" />
        <div className="h-full w-full overflow-hidden rounded-[24px] bg-black md:rounded-[30px]">{children}</div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[300px] md:max-w-[520px]" style={tilt}>
      <div className="rounded-[14px] bg-zinc-900 p-[7px] shadow-2xl ring-1 ring-white/10 md:rounded-[18px] md:p-[10px]">
        <div className="aspect-video overflow-hidden rounded-[8px] bg-black md:rounded-[10px]">{children}</div>
      </div>
      <div className="mx-auto h-6 w-20 bg-gradient-to-b from-zinc-400 to-zinc-300 md:h-8 md:w-24" />
      <div className="mx-auto h-2 w-36 rounded-full bg-zinc-400 md:w-48" />
    </div>
  );
}

/* ---------- One project card ---------- */
function ProjectCard({ p, i, c, lang, t, active, muted }) {
  const title = tx(p.title, lang);
  const flip = i % 2 === 1;
  return (
    <div className={`flex h-full flex-col items-center justify-between gap-6 md:flex-row md:gap-10 ${flip ? "md:flex-row-reverse" : ""}`}>
      <div className="w-full md:w-1/2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] opacity-70">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
          {tx(c.name, lang)}
          {p.status === "live" && <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] text-white">{t("live")}</span>}
        </p>
        <h2 className="mt-3 text-3xl font-bold leading-tight md:mt-4 md:text-6xl">{title}</h2>
        <p className="mt-3 line-clamp-4 max-w-md opacity-70 md:mt-4 md:text-lg">{tx(p.desc, lang)}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {[...p.platforms, ...p.tags].map((x, k) => (
            <span key={x + k} className="rounded-full border border-current/20 px-3 py-1">{x}</span>
          ))}
        </div>
        {p.url && (
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-block rounded-full bg-btn px-6 py-3 text-sm font-semibold text-btn-ink"
          >
            {t("visit")} ↗
          </a>
        )}
        {p.video && (
          <p className="mt-4 flex items-center gap-2 text-xs opacity-60">
            <span className="h-2 w-2 rounded-full bg-green-600" /> {t("screen_recording")}
          </p>
        )}
      </div>
      <div className="flex w-full justify-center md:w-1/2">
        <Device type={p.device || "monitor"} flip={flip}>
          <Media p={p} title={title} active={active} muted={muted} t={t} />
        </Device>
      </div>
    </div>
  );
}

/* ---------- Sticky stacking wrapper ---------- */
function StackCard({ i, n, progress, children }) {
  const scale = useTransform(progress, [i / Math.max(n - 1, 1), 1], [1, 1 - (n - 1 - i) * 0.04]);
  return (
    <div className="sticky top-0 flex h-screen items-center justify-center px-4">
      <motion.div
        style={{ scale, top: `calc(3vh + ${i * 22}px)` }}
        className="relative h-[72vh] min-h-[460px] w-full max-w-6xl origin-top overflow-hidden rounded-[2.5rem] bg-surface p-6 shadow-[0_30px_80px_rgba(0,0,0,.18)] md:p-12"
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ---------- Category page ---------- */
export default function BookReader({ c, index, list, lang, start, anim, onClose }) {
  const { t } = useData();
  const rootRef = useRef(null);
  const stackRef = useRef(null);
  const n = list.length;
  const [active, setActive] = useState(Math.max(0, start - 1));
  const [muted, setMuted] = useState(true);

  const { scrollYProgress } = useScroll({
    container: rootRef,
    target: stackRef,
    offset: ["start start", "end end"],
  });
  useMotionValueEvent(scrollYProgress, "change", (p) =>
    setActive(Math.min(Math.max(n - 1, 0), Math.max(0, Math.round(p * Math.max(n - 1, 0)))))
  );

  // jump to the chosen project
  useEffect(() => {
    if (start > 0 && rootRef.current && stackRef.current) {
      rootRef.current.scrollTop = stackRef.current.offsetTop + (start - 1) * window.innerHeight;
    }
  }, [start]);

  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const pill =
    "rounded-full border border-current/20 bg-white/85 px-4 py-2 text-sm shadow backdrop-blur hover:bg-white dark:bg-zinc-900/85 dark:hover:bg-zinc-900";

  return (
    <motion.div
      className="fixed inset-0 z-20 bg-bg text-ink"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: anim ? 0.5 : 0 }}
    >
      <div ref={rootRef} className="relative h-full overflow-y-auto">
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-32">
          <h1
            className="font-serif text-5xl font-bold leading-none md:text-[8rem]"
            style={{ "--cat": c.color, "--cat-light": `color-mix(in srgb, ${c.color} 60%, white)` }}
          >
            <span className="inline-block text-[var(--cat)] dark:text-[var(--cat-light)]">{tx(c.name, lang)}</span>
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 0.7, y: 0 }}
            transition={{ delay: 0.45, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 max-w-2xl text-lg md:text-xl"
          >
            {tx(c.desc, lang)}
          </motion.p>
          <ul className="mt-6 flex flex-wrap gap-2 text-sm">
            {(tx(c.facts, lang) || []).map((f, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 + i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-full border border-current/20 px-4 py-1.5"
              >
                {f}
              </motion.li>
            ))}
          </ul>
        </section>

        <div ref={stackRef}>
          {list.map((p, i) => (
            <StackCard key={p.id} i={i} n={n} progress={scrollYProgress}>
              <ProjectCard p={p} i={i} c={c} lang={lang} t={t} active={active === i} muted={muted} />
            </StackCard>
          ))}
        </div>

        <section className="px-6 py-32">
          <Cta onSeeWork={onClose} />
        </section>
      </div>

      <button onClick={onClose} className={`${pill} fixed bottom-6 left-6 z-30`}>
        ← {t("back_books")}
      </button>
      <div className="fixed bottom-6 right-6 z-30 flex gap-2">
        <button onClick={() => setMuted((m) => !m)} className={pill}>{muted ? "🔇" : "🔊"}</button>
        <button onClick={() => rootRef.current?.scrollTo({ top: 0, behavior: "smooth" })} className={pill}>↑</button>
      </div>
    </motion.div>
  );
}