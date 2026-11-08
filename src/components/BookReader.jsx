import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useData } from "../context/DataContext";
import { tx } from "../lib/i18n";
import Cta from "./Cta";

/* true on screens from 768px up (desktop layout) */
function useDesktop() {
  const [d, setD] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const f = () => setD(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return d;
}

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

/* ---------- Premium 3D device frames ---------- */
const GLARE = "linear-gradient(115deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 100%)";
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// edge colours of the device body, from the front to the back (gives the real thickness)
const MON_EDGE = ["#141416", "#18181a", "#1f1f22", "#2b2b2f", "#45454a", "#6a6865", "#8d8a85", "#a7a49f"];
const PHONE_EDGE = ["#cfccc6", "#bfbcb6", "#aeaba5", "#9d9a94", "#8d8a85", "#7d7a75", "#6f6c68", "#5f5c58"];

/* Leans toward the pointer (mouse or finger) with a springy motion, then settles back.
   baseY / baseX = the resting angle, range = how far it follows the pointer. */
function Tilt({ baseY, baseX = 3, range = 9, className = "", floor, children }) {
  const ref = useRef(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 130, damping: 17 });
  const sy = useSpring(my, { stiffness: 130, damping: 17 });
  const rY = useTransform(sx, [0, 1], [baseY - range, baseY + range]);
  const rX = useTransform(sy, [0, 1], [baseX + range * 0.7, baseX - range * 0.7]);
  const gx = useTransform(sx, (v) => v * 100);
  const gy = useTransform(sy, (v) => v * 100);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,.34), rgba(255,255,255,0) 58%)`;

  const move = (e) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const b = ref.current?.getBoundingClientRect();
    if (!b || !b.width) return;
    mx.set(clamp01((e.clientX - b.left) / b.width));
    my.set(clamp01((e.clientY - b.top) / b.height));
  };
  const reset = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ perspective: 1400, touchAction: "pan-y" }}
      onPointerMove={move}
      onPointerDown={move}
      onPointerLeave={reset}
      onPointerUp={reset}
      onPointerCancel={reset}
    >
      <motion.div style={{ rotateX: rX, rotateY: rY, transformStyle: "preserve-3d" }}>{children(glare)}</motion.div>
      {floor}
    </div>
  );
}

function Device({ type, flip, children }) {
  const side = flip ? 1 : -1; // tilts toward the text

  /* plain screen, no frame */
  if (type === "none") {
    return (
      <Tilt
        baseY={side * 8}
        baseX={2}
        range={7}
        className="w-full max-w-[340px] md:max-w-[560px]"
        floor={<div className="pointer-events-none absolute -bottom-6 left-[8%] right-[8%] h-6 rounded-[50%] bg-black/25 blur-xl" />}
      >
        {(glare) => (
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-black/10">
            {children}
            <motion.div className="pointer-events-none absolute inset-0" style={{ background: glare, mixBlendMode: "screen" }} />
          </div>
        )}
      </Tilt>
    );
  }

  /* premium 3D phone: titanium frame with real thickness, side buttons, dynamic island */
  if (type === "phone") {
    return (
      <Tilt
        baseY={side * 14}
        baseX={3}
        range={10}
        floor={<div className="pointer-events-none absolute -bottom-5 left-[10%] right-[10%] h-5 rounded-[50%] bg-black/30 blur-xl" />}
      >
        {(glare) => (
          <div
            className="relative h-[270px] w-[134px] md:h-[440px] md:w-[216px]"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* body thickness: layers behind the front, so the side edge shows when it turns */}
            {PHONE_EDGE.map((c, k) => (
              <div
                key={k}
                className="absolute inset-0 rounded-[30px] md:rounded-[42px]"
                style={{ background: c, transform: `translateZ(${-(k + 1) * 1.3}px)` }}
              />
            ))}

            {/* side buttons, in the middle of the thickness */}
            <span className="absolute -left-[3px] top-[18%] h-6 w-[3px] rounded-l bg-zinc-500" style={{ transform: "translateZ(-5px)" }} />
            <span className="absolute -left-[3px] top-[30%] h-10 w-[3px] rounded-l bg-zinc-500" style={{ transform: "translateZ(-5px)" }} />
            <span className="absolute -left-[3px] top-[44%] h-10 w-[3px] rounded-l bg-zinc-500" style={{ transform: "translateZ(-5px)" }} />
            <span className="absolute -right-[3px] top-[30%] h-14 w-[3px] rounded-r bg-zinc-500" style={{ transform: "translateZ(-5px)" }} />

            {/* front: titanium frame + glass */}
            <div
              className="relative h-full w-full rounded-[30px] p-[3px] shadow-[0_30px_60px_-10px_rgba(0,0,0,.55)] md:rounded-[42px]"
              style={{
                background: "linear-gradient(145deg,#d9d6d0,#8d8a85 35%,#c9c6c0 60%,#6f6c68)",
                transform: "translateZ(0.5px)",
              }}
            >
              <div className="h-full w-full rounded-[27px] bg-black p-[5px] md:rounded-[39px] md:p-[7px]">
                <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-black md:rounded-[33px]">
                  {children}
                  {/* dynamic island */}
                  <div className="absolute left-1/2 top-[7px] z-10 h-[14px] w-[46px] -translate-x-1/2 rounded-full bg-black md:top-[10px] md:h-[22px] md:w-[72px]" />
                  {/* glass glare */}
                  <div className="pointer-events-none absolute inset-0" style={{ background: GLARE }} />
                  <motion.div className="pointer-events-none absolute inset-0" style={{ background: glare, mixBlendMode: "screen" }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </Tilt>
    );
  }

  /* premium 3D monitor: thin black bezel, thick body, aluminium neck and flat oval base */
  return (
    <Tilt
      baseY={side * 12}
      baseX={3}
      range={9}
      className="w-full max-w-[340px] md:max-w-[560px]"
      floor={<div className="pointer-events-none absolute -bottom-5 left-[12%] right-[12%] h-6 rounded-[50%] bg-black/25 blur-xl" />}
    >
      {(glare) => (
        <>
          <div className="relative" style={{ transformStyle: "preserve-3d" }}>
            {/* body thickness */}
            {MON_EDGE.map((c, k) => (
              <div
                key={k}
                className="absolute inset-0 rounded-[16px] md:rounded-[22px]"
                style={{ background: c, transform: `translateZ(${-(k + 1) * 1.8}px)` }}
              />
            ))}
            {/* front: bezel + screen */}
            <div
              className="relative rounded-[16px] bg-[#0b0b0c] p-[6px] shadow-[0_24px_50px_-12px_rgba(0,0,0,.5)] ring-1 ring-white/10 md:rounded-[22px] md:p-[9px]"
              style={{ transform: "translateZ(0.5px)" }}
            >
              <div className="relative aspect-video overflow-hidden rounded-[10px] bg-black md:rounded-[14px]">
                {children}
                <div className="pointer-events-none absolute inset-0" style={{ background: GLARE }} />
                <motion.div className="pointer-events-none absolute inset-0" style={{ background: glare, mixBlendMode: "screen" }} />
              </div>
            </div>
          </div>

          {/* aluminium neck: tucked behind the screen */}
          <div
            className="mx-auto -mt-1 h-10 w-[21%] md:h-[60px]"
            style={{
              transform: "translateZ(-14px)",
              background:
                "linear-gradient(180deg, rgba(0,0,0,.4), rgba(0,0,0,0) 40%), linear-gradient(90deg,#8c8984,#e8e5df 38%,#d3d0ca 62%,#86837e)",
              clipPath: "polygon(14% 0,86% 0,100% 100%,0 100%)",
            }}
          />
          {/* flat oval base with a visible thick edge */}
          <div className="relative mx-auto -mt-[3px] h-[10px] w-[46%] md:h-[16px]" style={{ transform: "translateZ(-10px)" }}>
            <div className="absolute inset-x-0 bottom-[-3px] top-[3px] rounded-[50%] bg-[#76736e]" />
            <div className="absolute inset-0 rounded-[50%]" style={{ background: "linear-gradient(180deg,#f2f0eb,#bdbab4)" }} />
          </div>
        </>
      )}
    </Tilt>
  );
}

/* ---------- One project card: device on one side, text on the other ---------- */
function ProjectCard({ p, i, c, lang, t, active, muted }) {
  const title = tx(p.title, lang);
  const flip = i % 2 === 1; // odd slides: device on the right
  return (
    <div className={`flex h-full flex-col items-center justify-center gap-5 md:flex-row md:gap-12 ${flip ? "md:flex-row-reverse" : ""}`}>
      {/* device (first in the markup: top on phones, left on desktop) */}
      <div className="flex w-full shrink-0 justify-center md:w-1/2">
        <Device type={p.device || "monitor"} flip={flip}>
          <Media p={p} title={title} active={active} muted={muted} t={t} />
        </Device>
      </div>

      {/* text */}
      <div className="w-full md:w-1/2">
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.3em] opacity-70 md:text-xs">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
          {tx(c.name, lang)}
          {p.status === "live" && <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] text-white">{t("live")}</span>}
        </p>
        <h2 className="mt-2 text-2xl font-bold leading-tight md:mt-4 md:text-6xl">{title}</h2>
        <p className="mt-2 line-clamp-3 max-w-md text-sm opacity-70 md:mt-4 md:line-clamp-4 md:text-lg">{tx(p.desc, lang)}</p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] md:mt-4 md:gap-2 md:text-xs">
          {[...p.platforms, ...p.tags].slice(0, 5).map((x, k) => (
            <span key={x + k} className="rounded-full border border-current/20 px-2.5 py-0.5 md:px-3 md:py-1">{x}</span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 md:mt-5">
          {p.url && (
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-full bg-btn px-5 py-2.5 text-sm font-semibold text-btn-ink md:px-6 md:py-3"
            >
              {t("visit")} ↗
            </a>
          )}
          {p.video && (
            <p className="flex items-center gap-2 text-xs opacity-60">
              <span className="h-2 w-2 rounded-full bg-green-600" /> {t("screen_recording")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide wrapper ----------
   desktop: sticky stacking, each slide comes up over the one before (as before)
   phones : a plain list, each card only as tall as its text, small gap between cards */
function StackCard({ i, n, progress, children }) {
  const desktop = useDesktop();
  const end = 1 - (n - 1 - i) * 0 ; // keeps the same scale curve
  const from = i / Math.max(n - 1, 1);
  const depth = n - 1 - i; // how many slides will come over this one
  const scale = useTransform(progress, [from, end], [1, Math.max(0.78, 1 - depth * 0.045)]);
  const rotateX = useTransform(progress, [from, end], [0, depth ? 3 : 0]);
  const dim = useTransform(progress, [from, end], [0, Math.min(0.35, depth * 0.1)]);
  return (
    <div
      className={desktop ? "sticky top-0 flex h-screen items-center justify-center px-4" : "px-3 pb-4"}
      style={desktop ? { perspective: 1400 } : undefined}
    >
      <motion.div
        style={desktop ? { scale, rotateX, top: `calc(3vh + ${i * 22}px)`, transformOrigin: "top center" } : undefined}
        className="relative mx-auto h-auto w-full max-w-6xl overflow-hidden rounded-[2rem] bg-surface p-5 shadow-[0_30px_80px_rgba(0,0,0,.22)] md:h-[72vh] md:min-h-[460px] md:rounded-[2.5rem] md:p-12"
      >
        {children}
        {/* darkens when covered by the next slide (desktop only) */}
        {desktop && <motion.div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: dim }} />}
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
    "rounded-full border border-current/20 bg-white/85 shadow backdrop-blur hover:bg-white dark:bg-zinc-900/85 dark:hover:bg-zinc-900";

  return (
    <motion.div
      className="fixed inset-0 z-20 bg-bg text-ink"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: anim ? 0.5 : 0 }}
    >
      <div ref={rootRef} className="relative h-full overflow-y-auto">
        <section className="mx-auto max-w-6xl px-6 pb-8 pt-32">
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

        {/* md:-mt-[14vh] pulls the first slide up closer to the chips (bigger number = smaller gap) */}
        <div ref={stackRef} className="md:-mt-[14vh]">
          {list.map((p, i) => (
            <StackCard key={p.id} i={i} n={n} progress={scrollYProgress}>
              <ProjectCard p={p} i={i} c={c} lang={lang} t={t} active={active === i} muted={muted} />
            </StackCard>
          ))}
        </div>

        {/* dark contact card: starts right under the last slide (no overlap) */}
        <section className="relative z-10 mt-6 rounded-t-[2rem] bg-[#1b1919] px-6 pb-28 pt-20 text-[#efeae3] shadow-[0_-20px_50px_rgba(0,0,0,.25)] md:mt-0 md:rounded-t-[2.75rem] md:pb-32 md:pt-28">
          <div className="mx-auto max-w-6xl">
            <Cta dark onSeeWork={onClose} />
          </div>
        </section>
      </div>

      <button onClick={onClose} className={`${pill} fixed bottom-4 left-4 z-30 px-3 py-1.5 text-xs md:bottom-6 md:left-6`}>
        ← {t("back_books")}
      </button>
      <div className="fixed bottom-4 right-4 z-30 flex gap-1.5 md:bottom-6 md:right-6">
        <button onClick={() => setMuted((m) => !m)} className={`${pill} px-2.5 py-1.5 text-xs`}>{muted ? "🔇" : "🔊"}</button>
        <button onClick={() => rootRef.current?.scrollTo({ top: 0, behavior: "smooth" })} className={`${pill} px-2.5 py-1.5 text-xs`}>↑</button>
      </div>
    </motion.div>
  );
}