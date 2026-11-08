import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { tx } from "../lib/i18n";

const ease = [0.65, 0, 0.35, 1];
const face = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
const HEAD = 38; // top zone with the punched holes
const LINE = 34; // ruled line spacing
const NB_H = HEAD + LINE * 2 + 8; // notebook height
const COILS = 10;
const GOLD_PEN = "var(--c-accent)";
const REVEAL_R = 170; // radius of the colour circle around the cursor

// paper / leather grain, generated in code
const NOISE = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
)}")`;

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const f = () => setR(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return r;
}

/* ---------- Ink: the role writes itself, a pencil underline draws, the tagline fades in ---------- */
function Ink({ text, tagline, counter }) {
  return (
    <>
      <div className="absolute left-14 right-4" style={{ top: HEAD }}>
        <span className="relative inline-block max-w-full">
          <motion.span
            className="block truncate font-serif text-[26px] italic text-zinc-900 dark:text-zinc-100"
            style={{ lineHeight: `${LINE}px` }}
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: 0.9, delay: 0.25, ease: "easeOut" }}
          >
            {text}
          </motion.span>
          <svg className="absolute -bottom-px left-0 h-[6px] w-full" viewBox="0 0 100 6" preserveAspectRatio="none" fill="none">
            <motion.path
              d="M0 4 C 18 1, 32 5, 52 3 S 86 2, 100 3.5"
              style={{ stroke: GOLD_PEN }}
              strokeWidth="1.2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: 1.0, ease: "easeInOut" }}
            />
          </svg>
        </span>
      </div>

      {tagline && (
        <motion.p
          className="absolute left-14 right-24 truncate font-serif text-[13px] text-zinc-700 dark:text-zinc-300"
          style={{ top: HEAD + LINE, lineHeight: `${LINE}px` }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 0.75, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          {tagline}
        </motion.p>
      )}
      <p
        className="absolute right-5 font-mono text-[10px] tracking-[0.2em] text-zinc-500 dark:text-zinc-400"
        style={{ top: HEAD + LINE, lineHeight: `${LINE}px` }}
      >
        {counter}
      </p>
    </>
  );
}

/* ---------- One sheet of paper ---------- */
function Paper({ back, children }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden rounded-[6px] ${
        back ? "bg-[#efe9db] dark:bg-[#1f1c17]" : "bg-[#fbf7ec] dark:bg-[#26231e]"
      }`}
      style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,.05)" }}
    >
      {/* paper grain */}
      <div className="absolute inset-0 opacity-[.35] mix-blend-multiply dark:opacity-25" style={{ backgroundImage: NOISE }} />
      {/* gutter shadow under the coils */}
      <div className="absolute inset-x-0 top-0 h-[28px] bg-gradient-to-b from-black/15 to-transparent" />
      {/* ruled lines */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: HEAD,
          backgroundImage: `repeating-linear-gradient(transparent 0 ${LINE - 1}px, rgba(70,130,230,.24) ${LINE - 1}px ${LINE}px)`,
        }}
      />
      {/* margin line */}
      {!back && <div className="absolute bottom-0 left-10 top-0 w-px bg-red-400/40" />}
      {/* punched holes (line up with the coils) */}
      <div className="absolute inset-x-0 top-[11px] flex justify-around px-6">
        {Array.from({ length: COILS }).map((_, k) => (
          <span
            key={k}
            className="h-[7px] w-[11px] rounded-full bg-black/25 shadow-[inset_0_1px_2px_rgba(0,0,0,.5)] dark:bg-black/60"
          />
        ))}
      </div>
      {back && (
        <div className="absolute inset-0 grid place-items-center">
          <span style={{ color: GOLD_PEN }} className="text-sm opacity-40">◆</span>
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------- The 3D notebook with the page-turn ---------- */
function Notebook({ label, tagline, counter, flipping, idKey, onFlipped, onClick }) {
  return (
    <div className="relative mt-9 max-w-sm" style={{ perspective: 1400 }}>
      {/* soft shadow under the notebook */}
      <div className="pointer-events-none absolute -bottom-7 left-6 right-2 h-6 rounded-[50%] bg-black/30 blur-lg" />

      <div
        className="relative cursor-pointer"
        style={{
          height: NB_H,
          transformStyle: "preserve-3d",
          transform: "rotateX(12deg) rotateY(-9deg) rotateZ(-1deg)",
        }}
        onClick={onClick}
      >
        {/* leather cover with gold stitching + corner caps */}
        <div
          className="absolute overflow-hidden rounded-[10px]"
          style={{
            left: -12, right: -12, top: -4, bottom: -14, transform: "translateZ(-6px)",
            background: "linear-gradient(145deg,var(--c-leather-a),var(--c-leather-b))",
            boxShadow: "0 20px 34px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.08)",
          }}
        >
          <div className="absolute inset-0 opacity-90 mix-blend-multiply" style={{ backgroundImage: NOISE }} />
          <div className="absolute rounded-[7px]" style={{ inset: 5, border: "1.5px dashed rgba(240,203,98,.5)" }} />
          <span
            className="absolute bottom-0 left-0 h-[22px] w-[22px]"
            style={{ background: "linear-gradient(180deg,#fff3bf,#c9972f)", clipPath: "polygon(0 0,0 100%,100% 100%)" }}
          />
          <span
            className="absolute bottom-0 right-0 h-[22px] w-[22px]"
            style={{ background: "linear-gradient(180deg,#fff3bf,#c9972f)", clipPath: "polygon(100% 0,100% 100%,0 100%)" }}
          />
        </div>

        {/* ribbon bookmark hanging from the bottom */}
        <div
          className="absolute"
          style={{
            left: "62%", bottom: -34, width: 11, height: 36, transform: "translateZ(-3px)",
            background: "linear-gradient(90deg,#7f1d1d,#dc2626 45%,#991b1b)",
            clipPath: "polygon(0 0,100% 0,100% 100%,50% 82%,0 100%)",
            filter: "drop-shadow(0 3px 2px rgba(0,0,0,.4))",
          }}
        />

        {/* page stack thickness */}
        <div
          className="absolute inset-x-[5px] bottom-[-5px] top-[5px] rounded-[6px] bg-[#e9e2d0] dark:bg-[#2c2923]"
          style={{ transform: "translateZ(-2px)" }}
        />
        <div
          className="absolute inset-x-[2px] bottom-[-2px] top-[2px] rounded-[6px] bg-[#f1ead9] dark:bg-[#34312a]"
          style={{ transform: "translateZ(-1px)" }}
        />

        {/* the next page, waiting underneath (blank until the ink writes it) */}
        <div className="absolute inset-0">
          <Paper />
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[6px] bg-gradient-to-b from-black/45 to-transparent"
            initial={false}
            animate={{ opacity: flipping ? 0 : 0.35 }}
            transition={{ duration: flipping ? 1 : 0.2, ease: "easeIn" }}
          />
        </div>

        {/* the top page: peels up and over the spiral */}
        <motion.div
          key={idKey}
          style={{ position: "absolute", inset: 0, originX: 0.5, originY: 0, transformStyle: "preserve-3d", z: 1 }}
          initial={false}
          animate={flipping ? { rotateX: 140, opacity: [1, 1, 0] } : { rotateX: 0, opacity: 1 }}
          transition={
            flipping
              ? { rotateX: { duration: 1.1, ease }, opacity: { duration: 1.1, times: [0, 0.6, 1], ease: "linear" } }
              : { duration: 0 }
          }
          onAnimationComplete={() => {
            if (flipping) onFlipped();
          }}
        >
          <div style={{ position: "absolute", inset: 0, ...face }}>
            <Paper>
              <Ink text={label} tagline={tagline} counter={counter} />
              {/* shadow falling across the page as it lifts */}
              <motion.div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 to-transparent"
                initial={false}
                animate={{ opacity: flipping ? [0, 0.35, 0.7] : 0 }}
                transition={{ duration: 1.1, times: [0, 0.5, 1], ease: "linear" }}
              />
            </Paper>
          </div>
          <div style={{ position: "absolute", inset: 0, transform: "rotateX(180deg)", ...face }}>
            <Paper back />
          </div>
        </motion.div>

        {/* glare sweeping across the pad while the page turns */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[6px]"
          style={{ transform: "translateZ(14px)" }}
        >
          <motion.div
            className="absolute -inset-y-4 w-1/3"
            style={{ left: 0, skewX: -18, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent)" }}
            initial={false}
            animate={{ x: flipping ? "420%" : "-150%" }}
            transition={flipping ? { duration: 1.2, ease: "easeInOut" } : { duration: 0 }}
          />
        </div>

        {/* brass spiral coils, standing in front of the paper */}
        <div
          className="pointer-events-none absolute inset-x-0 -top-3 flex justify-around px-6"
          style={{ transform: "translateZ(18px)" }}
        >
          {Array.from({ length: COILS }).map((_, k) => (
            <span
              key={k}
              className="block h-[34px] w-[11px] rounded-full"
              style={{
                background: "linear-gradient(90deg,#8a6a2a,#f6dc8c 38%,#c9972f 66%,#6e5220)",
                boxShadow: "0 4px 6px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.5)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Cutout portrait: black & white, colour follows the cursor ---------- */
// The photo is keyed by its own URL (not by the role), so it never blinks when
// the notebook turns a page. It only cross-fades when the picture really changes.
// On desktop it takes the full height of its column (md:h-full), so it always
// fits the screen and stands on the line above the bottom strip.
function Portrait({ src, name, reveal }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const r = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 28, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 260, damping: 28, mass: 0.5 });
  const sr = useSpring(r, { stiffness: 180, damping: 22 });
  const rad = useTransform(sr, (v) => Math.max(v, 1));
  const mask = useMotionTemplate`radial-gradient(circle ${rad}px at ${sx}px ${sy}px, #000 0%, #000 52%, transparent 100%)`;

  const place = (e) => {
    if (!ref.current) return null;
    const b = ref.current.getBoundingClientRect();
    return { px: e.clientX - b.left, py: e.clientY - b.top };
  };
  const onEnter = (e) => {
    const p = place(e);
    if (!p) return;
    x.set(p.px);
    y.set(p.py);
    // start the circle right under the cursor instead of flying in from a corner
    if (sx.jump) { sx.jump(p.px); sy.jump(p.py); }
    r.set(REVEAL_R);
  };
  const onMove = (e) => {
    const p = place(e);
    if (!p) return;
    x.set(p.px);
    y.set(p.py);
  };
  const onLeave = () => r.set(0);

  return (
    <div
      ref={ref}
      className="relative h-[430px] touch-pan-y md:h-full"
      onPointerEnter={reveal ? onEnter : undefined}
      onPointerMove={reveal ? onMove : undefined}
      onPointerLeave={reveal ? onLeave : undefined}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={src || "none"}
          className="relative h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {src ? (
            <>
              {/* base: black & white (full colour if the hover effect is switched off) */}
              <img
                src={src}
                alt={name}
                draggable={false}
                className="block h-full w-auto max-w-none select-none object-contain object-bottom"
                style={{
                  filter: reveal
                    ? "grayscale(1) contrast(1.06) drop-shadow(0 18px 24px rgba(0,0,0,.22))"
                    : "drop-shadow(0 18px 24px rgba(0,0,0,.22))",
                }}
              />
              {/* colour layer, only visible inside the circle around the cursor */}
              {reveal && (
                <motion.img
                  src={src}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain object-bottom"
                  style={{ WebkitMaskImage: mask, maskImage: mask }}
                />
              )}
            </>
          ) : (
            <div className="grid h-full w-64 place-items-end pb-10 text-8xl font-bold opacity-20">{name.charAt(0)}</div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function Hero() {
  const { lang } = useSettings();
  const { profile, roles, features, t } = useData();
  const [i, setI] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const reduce = useReducedMotion();

  const cycle = features.notebookCycle !== false;
  const hover = features.hoverEffects !== false;
  const simple = reduce || features.pageFlip === false; // no 3D turn, just switch
  const n = roles.length;
  const next = n ? (i + 1) % n : 0;

  // every few seconds: turn the page (or just switch)
  useEffect(() => {
    if (!cycle || n < 2 || flipping) return;
    const id = setTimeout(() => {
      if (simple) setI(next);
      else setFlipping(true);
    }, 3600); // gives the ink time to finish writing first
    return () => clearTimeout(id);
  }, [cycle, n, flipping, i, simple, next]);

  const flipNow = () => {
    if (cycle && n > 1 && !flipping && !simple) setFlipping(true);
  };
  const done = () => {
    setI(next);
    setFlipping(false);
  };

  const cur = n ? roles[cycle ? i % n : 0] : null;
  const role = n ? roles[cycle ? (flipping ? next : i) % n : 0] : null; // portrait follows the turn
  const photo = role?.image || profile.photo;
  const name = tx(profile.name, lang);
  const zoom = hover ? { scale: 1.08 } : undefined; // buttons grow a little on hover
  const press = hover ? { scale: 0.97 } : undefined;
  const spring = { type: "spring", stiffness: 320, damping: 20 };
  const idx = cycle && n ? i % n : 0;
  const counter = `${String(idx + 1).padStart(2, "0")} / ${String(Math.max(n, 1)).padStart(2, "0")}`;

  return (
    // md:h-[calc(100svh-8rem)] = the whole hero (footer line + footer row included) fits one screen.
    // Bigger rem number = smaller section, smaller number = taller section.
    <section id="home" className="-mt-8 flex min-h-[85vh] flex-col md:h-[calc(100svh-8rem)] md:min-h-[600px]">
      {/* photo side is wider than the text side; the row is capped to the section height */}
      <div className="grid min-h-0 flex-1 gap-6 pt-0 md:grid-cols-[1fr_1.25fr] md:grid-rows-[minmax(0,1fr)] md:gap-8">
        {/* text side starts at the top */}
        <div className="flex min-h-0 flex-col justify-start pb-6 md:pt-0">
          <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] opacity-70">
            <span className="text-base leading-none">*</span>
            {t("independent")}
          </p>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            {t("hello")} {name}.
          </h1>
          <p className="mt-2 text-lg opacity-70">{t("iam")}</p>

          {/* 3D spiral notebook with page turn */}
          <Notebook
            label={tx(cur?.label, lang)}
            tagline={tx(cur?.tagline, lang)}
            counter={counter}
            flipping={flipping}
            idKey={`${i}-${lang}`}
            onFlipped={done}
            onClick={flipNow}
          />

          {/* buttons */}
          <div className="mt-10 flex items-center gap-3">
                        <motion.a
              href="#hire"
              onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("open-hire")); }}
              whileHover={zoom}
              whileTap={press}
              transition={spring}
              className="group flex h-11 items-center gap-4 rounded-full bg-btn pl-5 pr-1.5 text-sm font-medium text-btn-ink shadow-[0_6px_16px_rgba(0,0,0,.18)]"
            >
              {t("hire")}
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-full bg-btn-ink text-btn transition-transform duration-300 group-hover:translate-x-0.5"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </span>
            </motion.a>
            <motion.a
              href="#projects"
              whileHover={zoom}
              whileTap={press}
              transition={spring}
              className="flex h-11 items-center rounded-full bg-ink/5 px-5 text-sm font-medium ring-1 ring-line"
            >
              {t("see_work")}
            </motion.a>
          </div>
        </div>

        {/* Cutout portrait: fills its column height and stands on the line above the bottom strip */}
        <div className="relative flex min-h-0 items-end justify-center">
          <div className="relative md:h-full">
            <Portrait src={photo} name={name} reveal={hover} />

            
          </div>
        </div>
      </div>

      {/* bottom strip: left / centre / right, thin line above (the portrait stands on this line) */}
      <div className="grid shrink-0 grid-cols-1 gap-2 border-t border-line pb-1 pt-4 text-[10px] font-medium uppercase tracking-[0.18em] text-ink/60 sm:grid-cols-3">
        <span className="flex items-center gap-2 sm:justify-self-start">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-500 shadow-[0_0_6px_#22c55e]" />
          {t("available")}
        </span>
        <span className="sm:justify-self-center">{t("remote")}</span>
        <a href="#projects" className="transition hover:opacity-70 sm:justify-self-end">
          {t("scroll_explore")} ↓
        </a>
      </div>
    </section>
  );
}