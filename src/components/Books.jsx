import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { tx } from "../lib/i18n";
import BookReader from "./BookReader";

const shade = (hex, p = 55) => `color-mix(in srgb, ${hex} ${p}%, black)`;
const lighten = (hex, p = 85) => `color-mix(in srgb, ${hex} ${p}%, white)`;
// JS version (animatable): mixes a #rrggbb colour towards white
const mix = (hex, t) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v + (255 - v) * t);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

const ease = [0.65, 0, 0.35, 1]; // slow - fast - slow
const soft = [0.22, 1, 0.36, 1]; // smooth settle
const face = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];


const READER_BG = { light: "var(--c-bg)", dark: "var(--c-bg)" };

const PAPER = {
  light: { bg: "#faf6ea", text: "#27272a", body: "#3f3f46", fact: "#52525b", gutter: "linear-gradient(90deg,#e6dcc2,transparent 16%)" },
  dark: { bg: "#1c1915", text: "#efe8d6", body: "#d4ccb8", fact: "#a8a08c", gutter: "linear-gradient(90deg,#0b0a08,transparent 16%)" },
};

// leather grain, generated in code (no image files)
const NOISE = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
)}")`;

const GOLD = "linear-gradient(180deg,#fff3bf 0%,#f0cb62 30%,#b8862b 58%,#f6dc8c 80%,#c9972f 100%)";
const GILT_R = "repeating-linear-gradient(90deg,#f6dc8c 0 1.5px,#b8862b 1.5px 2.5px)";
const GILT_B = "repeating-linear-gradient(0deg,#f6dc8c 0 1.5px,#b8862b 1.5px 2.5px)";

const BW = 230, BH = 330; // cover size
const PW = 218, PH = 318; // title page size
const SLOT = 310; // width of one door slot
const ARCH_W = 270; // arch (door) width
const ARCH_H = 470; // arch (door) height = slot height
const OPEN_MS = 1250; // time the cover takes to open before the zoom starts

const splitQ = (q) => {
  const m = q.match(/^([\s\S]*?)\{([\s\S]+?)\}([\s\S]*)$/);
  return m ? [m[1], m[2], m[3]] : ["", q, ""];
};

// width of a scrollbar in this browser (the category page has one)
function sbWidth() {
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll";
  document.body.appendChild(d);
  const w = d.offsetWidth - d.clientWidth;
  d.remove();
  return w;
}

function useIsTouch() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(hover: none)");
    const f = () => setTouch(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return touch;
}

/* ---------- Keeps all books on ONE line by scaling the row to fit ---------- */
// `overlay(wrap)` is drawn on top of the row (in the same scaled space)
function FitRow({ n, overlay, children }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [m, setM] = useState({ s: 1, h: 0, avail: 0, wrap: false });

  useLayoutEffect(() => {
    const calc = () => {
      if (!outer.current || !inner.current) return;
      const avail = outer.current.clientWidth;
      if (avail < 640) {
        setM({ s: 1, h: 0, avail, wrap: true }); // small phones: wrap instead of tiny books
        return;
      }
      const total = SLOT * n;
      const s = Math.min(1, avail / total);
      setM({ s, h: inner.current.offsetHeight * s, avail, wrap: false });
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(outer.current);
    ro.observe(inner.current);
    return () => ro.disconnect();
  }, [n]);

  const total = SLOT * n;
  return (
    <div ref={outer} className="relative w-full" style={m.wrap ? undefined : { height: m.h || undefined }}>
      <div
        ref={inner}
        className={m.wrap ? "flex flex-wrap justify-center gap-y-12" : "relative flex flex-nowrap justify-center"}
        style={
          m.wrap
            ? undefined
            : {
                width: total,
                transform: `scale(${m.s})`,
                transformOrigin: "top left",
                marginLeft: Math.max(0, (m.avail - total * m.s) / 2),
              }
        }
      >
        {children}
        {overlay ? overlay(m.wrap) : null}
      </div>
    </div>
  );
}

/* ---------- "Click to enter" label that follows the cursor ---------- */
function CursorPill({ show, label }) {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 520, damping: 38, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 520, damping: 38, mass: 0.4 });

  useEffect(() => {
    const m = (e) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", m);
    return () => window.removeEventListener("mousemove", m);
  }, [x, y]);

  return (
    <motion.div className="pointer-events-none fixed left-0 top-0 z-[70]" style={{ x: sx, y: sy }}>
      <motion.div
               className="-translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black px-3 py-1 text-[10px] font-medium text-white shadow-[0_6px_16px_rgba(0,0,0,.4)] ring-1 ring-amber-300/40 dark:bg-white dark:text-black"
        initial={false}
        animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.6 }}
        transition={{ duration: 0.2, ease: soft }}
      >
        {label}
      </motion.div>
    </motion.div>
  );
}

/* ---------- Gold emblem drawn in code ---------- */
function Emblem({ type }) {
  const s = { fill: "none", stroke: "url(#goldStroke)", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <svg width="36" height="36" viewBox="0 0 32 32">
      <defs>
        <linearGradient id="goldStroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3bf" />
          <stop offset=".5" stopColor="#d9a93a" />
          <stop offset="1" stopColor="#f6dc8c" />
        </linearGradient>
      </defs>
      {type === "code" && (
        <g {...s}><path d="M11 9 L4 16 L11 23" /><path d="M21 9 L28 16 L21 23" /><path d="M18 7 L14 25" /></g>
      )}
      {type === "phone" && (
        <g {...s}><rect x="9" y="3" width="14" height="26" rx="3" /><path d="M14 25 H18" /></g>
      )}
      {type === "pen" && (
        <g {...s}><path d="M6 26 L8 19 L21 6 L26 11 L13 24 Z" /><path d="M18 9 L23 14" /></g>
      )}
      {type === "ball" && (
        <g {...s}>
          <circle cx="16" cy="16" r="12" />
          <path d="M16 9 L21 13 L19 19 H13 L11 13 Z" />
          <path d="M16 4 V9 M21 13 L27 11 M19 19 L23 25 M13 19 L9 25 M11 13 L5 11" />
        </g>
      )}
      {!["code", "phone", "pen", "ball"].includes(type) && (
        <path {...s} d="M16 5 L19 13 L27 13 L21 18 L23 26 L16 21 L9 26 L11 18 L5 13 L13 13 Z" />
      )}
    </svg>
  );
}

/* ---------- Title page: "What is X?" + answer + facts (theme aware) ---------- */
// stage: rest | color (phrase coloured) | fly (phrase picked up) | land (phrase back on the page)
function TitlePage({ c, lang, dark, stage = "rest", phraseRef }) {
  const P = dark ? PAPER.dark : PAPER.light;
  const hotColor = dark ? mix(c.color, 0.4) : c.color;
  const q = tx(c.question, lang) || `{${tx(c.name, lang)}}`;
  const [pre, phrase, post] = splitQ(q);
  const answer = tx(c.answer, lang) || tx(c.desc, lang);
  const facts = (tx(c.facts, lang) || []).slice(0, 3);
  const hot = stage === "color" || stage === "land";
  const gone = stage === "fly";
  const restOpacity = gone ? 0 : hot ? 0.45 : 1;
  const glue = post.trim().length <= 2; // keep "?" stuck to the phrase

  const phraseEl = (
    <motion.span
      ref={phraseRef}
      initial={false}
      className="inline-block whitespace-nowrap"
      style={{
        lineHeight: 1,
        backgroundImage: "linear-gradient(currentColor,currentColor)",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "0 100%",
      }}
      animate={{
        color: hot ? hotColor : P.text,
        backgroundSize: hot ? "100% 2px" : "0% 2px",
        opacity: gone ? 0 : 1,
      }}
      transition={{ default: { duration: 0.7, ease: soft }, opacity: { duration: 0 } }}
    >
      {phrase}
    </motion.span>
  );
  const postEl = (
    <motion.span initial={false} animate={{ opacity: restOpacity }} transition={{ duration: 0.4 }}>
      {post}
    </motion.span>
  );

  return (
    <div
      className="relative flex h-full w-full flex-col justify-center px-5 py-5 font-serif"
      style={{ color: P.text, background: P.bg }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: P.gutter }} />
      <h4 className="relative text-[18px] font-bold leading-[1.2]">
        <motion.span initial={false} animate={{ opacity: restOpacity }} transition={{ duration: 0.4 }}>
          {pre}
        </motion.span>
        {glue ? (
          <span className="whitespace-nowrap">
            {phraseEl}
            {postEl}
          </span>
        ) : (
          <>
            {phraseEl}
            {postEl}
          </>
        )}
      </h4>

      <motion.div className="relative" initial={false} animate={{ opacity: restOpacity }} transition={{ duration: 0.4 }}>
        <div className="my-3 h-px w-10" style={{ background: dark ? hotColor : c.color }} />
        <p className="line-clamp-5 text-[10.5px] leading-snug" style={{ color: P.body }}>{answer}</p>
        <ul className="mt-3 space-y-1.5">
          {facts.map((f, i) => (
            <li key={i} className="flex gap-1.5 text-[9.5px] leading-snug" style={{ color: P.fact }}>
              <span style={{ color: "#b8862b" }}>◆</span>
              <span className="line-clamp-2">{f}</span>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}

/* ---------- Premium cover (front) ---------- */
function CoverFront({ c, title, byline, numeral, open }) {
  const dark = shade(c.color, 45);
  // auto-fit the title so the longest word always stays inside the frame
  const longest = Math.max(...title.split(/\s+/).map((w) => [...w].length), 1);
  const fit = Math.max(15, Math.min(23, 132 / (longest * 0.6)));
  const corner = (v, h) => ({
    position: "absolute", width: 16, height: 16, [v]: 11, [h]: h === "left" ? 37 : 11,
    [v === "top" ? "borderTop" : "borderBottom"]: "2px solid #e8c15a",
    [h === "left" ? "borderLeft" : "borderRight"]: "2px solid #e8c15a",
  });
  const cap = (clip, pos) => ({
    position: "absolute", width: 30, height: 30, background: GOLD, clipPath: clip, opacity: 0.95, ...pos,
  });
  const ornament = (
    <div className="flex items-center gap-2">
      <span className="h-px w-7" style={{ background: GOLD }} />
      <span className="h-1.5 w-1.5 rotate-45" style={{ background: GOLD }} />
      <span className="h-px w-7" style={{ background: GOLD }} />
    </div>
  );
  return (
    <div
      style={{
        position: "absolute", inset: 0, ...face, overflow: "hidden", borderRadius: "4px 10px 10px 4px",
        background: `linear-gradient(145deg, ${lighten(c.color)}, ${c.color} 45%, ${dark})`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1), inset 0 -18px 30px rgba(0,0,0,.45), inset 0 2px 0 rgba(255,255,255,.12), 0 12px 28px rgba(0,0,0,.4)",
      }}
    >
      <div className="absolute inset-0" style={{ backgroundImage: NOISE, mixBlendMode: "multiply", opacity: 0.9 }} />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 28% 16%, rgba(255,255,255,.28), transparent 55%)" }}
      />
      {/* rounded spine + hinge groove */}
      <div
        className="absolute inset-y-0 left-0"
        style={{ width: 38, background: "linear-gradient(90deg, rgba(0,0,0,.55) 0, rgba(255,255,255,.2) 26%, rgba(0,0,0,.18) 58%, transparent)" }}
      />
      <div className="absolute inset-y-0" style={{ left: 34, width: 3, background: "linear-gradient(90deg, rgba(0,0,0,.45), rgba(255,255,255,.18))" }} />

      {/* stitching + double gold frame */}
      <div className="absolute rounded-[6px]" style={{ inset: 8, left: 44, border: "1.5px dashed rgba(240,203,98,.5)" }} />
      <div className="absolute rounded-[5px]" style={{ inset: 17, left: 52, border: "1.5px solid rgba(240,203,98,.85)" }} />
      <div className="absolute rounded-[3px]" style={{ inset: 22, left: 57, border: "1px solid rgba(240,203,98,.4)" }} />
      <span style={corner("top", "left")} />
      <span style={corner("top", "right")} />
      <span style={corner("bottom", "left")} />
      <span style={corner("bottom", "right")} />

      {/* brass corner caps */}
      <span style={cap("polygon(0 0,100% 0,100% 100%)", { top: 0, right: 0 })} />
      <span style={cap("polygon(100% 0,100% 100%,0 100%)", { bottom: 0, right: 0 })} />
      <span style={cap("polygon(0 0,0 100%,100% 100%)", { bottom: 0, left: 0 })} />

      {/* title block: centred inside the gold frame */}
      <div
        className="absolute flex flex-col items-center justify-center text-center"
        style={{ top: 0, bottom: 0, left: 52, right: 17, padding: "0 10px" }}
      >
        <Emblem type={c.emblem} />
        <div className="mt-3">{ornament}</div>
        <h3
          className="mt-3 font-serif font-bold"
          style={{
            fontSize: fit, lineHeight: 1.15, textWrap: "balance", maxWidth: "100%",
            backgroundImage: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text",
            color: "transparent", filter: "drop-shadow(0 1px 0 rgba(0,0,0,.65))",
          }}
        >
          {title}
        </h3>
        <div className="mt-3">{ornament}</div>
        <p className="mt-4 font-serif text-[9px] uppercase tracking-[0.4em]" style={{ color: "#e8c15a" }}>
          {byline}
        </p>
        <p className="mt-1.5 font-serif text-[11px] tracking-[0.3em]" style={{ color: "#c9972f" }}>
          {numeral}
        </p>
      </div>

      {/* foil sheen sweep */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -bottom-4 -top-4 w-1/3"
          style={{ left: 0, skewX: -20, background: "linear-gradient(90deg,transparent,rgba(255,243,191,.42),transparent)" }}
          animate={{ x: open ? "420%" : "-150%" }}
          transition={{ duration: 1.2, ease: soft }}
        />
      </div>
    </div>
  );
}

/* ---------- One book inside its arched door frame ---------- */
// open    = the cursor is on this book (lit, cover ajar)
// anyOpen = some book is open (the others fade)
// opening = it was clicked: cover swings fully open, then the zoom starts
function ShelfBook({ c, index, lang, dark, open, anyOpen, opening, anim, hover, byline, pageRef, onClick, onOpen, onLeave }) {
  const title = tx(c.name, lang);
  const dk = shade(c.color, 45);
  const tilt = open && hover && !opening;
  const numeral = ROMAN[index - 1] || index;
  const hotColor = dark ? mix(c.color, 0.4) : c.color;
  const faded = anyOpen && !open;

  // pointer-follow 3D tilt
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 110, damping: 15 });
  const sy = useSpring(my, { stiffness: 110, damping: 15 });
  const rotY = useTransform(sx, [-0.5, 0.5], [-6, 6]);
  const rotX = useTransform(sy, [-0.5, 0.5], [5, -5]);
  const move = (e) => {
    if (!tilt) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const leave = () => {
    mx.set(0);
    my.set(0);
    onLeave();
  };

  const nicheBg = dark
    ? "linear-gradient(180deg,#0a0807 0%,#15110d 100%)"
    : "linear-gradient(180deg,#d2cbbf 0%,#e8e2d8 100%)";
  const frame = dark
    ? "0 0 0 9px #1b1712, 0 0 0 10px rgba(240,203,98,.35), 0 26px 50px -12px rgba(0,0,0,.75)"
    : "0 0 0 9px #f8f4ec, 0 0 0 10px rgba(0,0,0,.07), 0 26px 50px -12px rgba(60,40,20,.3)";
  const settle = anim ? { type: "spring", stiffness: 110, damping: 18 } : { duration: 0 };

  return (
    // the WHOLE slot is the click target
    <div
      className="relative shrink-0"
      style={{ width: SLOT, height: ARCH_H, cursor: "none", zIndex: open ? 5 : 1 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={onOpen}
      onMouseLeave={leave}
    >
      {/* spotlight on the focused door */}
      <motion.div
        className="pointer-events-none absolute"
        style={{
          left: -190, right: -190, top: -70, bottom: -30,
          background: dark
            ? "radial-gradient(ellipse at 50% 38%, rgba(255,205,130,.26), transparent 62%)"
            : "radial-gradient(ellipse at 50% 38%, rgba(255,255,255,.95), transparent 62%)",
        }}
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      />

      <div className={`absolute inset-0 transition-all duration-700 ${faded ? "opacity-30 blur-[2px]" : ""}`}>
        {/* arched door frame */}
        <div
          className="pointer-events-none absolute bottom-0 overflow-hidden"
          style={{
            left: (SLOT - ARCH_W) / 2, width: ARCH_W, height: ARCH_H,
            borderRadius: `${ARCH_W / 2}px ${ARCH_W / 2}px 0 0`, background: nicheBg, boxShadow: frame,
          }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: `radial-gradient(ellipse at 50% 22%, ${hotColor}66, transparent 62%)` }}
            initial={false}
            animate={{ opacity: open ? 1 : 0 }}
            transition={{ duration: 0.8 }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-24"
            style={{ background: "linear-gradient(0deg, rgba(0,0,0,.3), transparent)" }}
          />
        </div>

        {/* the book (slides right a little while the cover swings open) */}
        <motion.div
          className="absolute"
          style={{ left: (SLOT - BW - 10) / 2, bottom: 24, width: BW + 10, height: BH + 6 }}
          initial={false}
          animate={{ x: opening ? 30 : 0 }}
          transition={anim ? { duration: 1.1, ease: soft } : { duration: 0 }}
          onMouseMove={move}
        >
          <motion.div
            className="pointer-events-none absolute -inset-8 rounded-[2.5rem] blur-3xl"
            style={{ background: c.color }}
            initial={false}
            animate={{ opacity: open ? 0.3 : 0.04 }}
            transition={{ duration: 0.7 }}
          />
          {/* contact shadow on the floor */}
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-black/60 blur-md"
            style={{ bottom: -10, width: BW - 10, height: 16 }}
          />

          <button
            type="button"
            onFocus={onOpen}
            onBlur={onLeave}
            aria-label={title}
            aria-expanded={open}
            className="relative z-10 block outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            style={{ width: "100%", height: "100%", cursor: "none" }}
          >
            <div style={{ perspective: 1300, width: "100%", height: "100%" }}>
              {/* resting pose: slightly turned; faces you when focused */}
              <motion.div
                style={{ width: "100%", height: "100%", transformStyle: "preserve-3d" }}
                initial={false}
                animate={{ rotateY: open ? 0 : -12 }}
                transition={settle}
              >
                <motion.div style={{ width: "100%", height: "100%", transformStyle: "preserve-3d", rotateX: rotX, rotateY: rotY }}>
                  <motion.div
                    style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d" }}
                    animate={{ scale: tilt ? 1.03 : 1, y: tilt ? -6 : 0 }}
                    transition={anim ? { type: "spring", stiffness: 70, damping: 15 } : { duration: 0 }}
                  >
                    {/* gilded page edges */}
                    <div
                      style={{
                        position: "absolute", left: BW - 4, top: 8, width: 10, height: BH - 8, background: GILT_R,
                        borderRadius: "0 3px 3px 0", boxShadow: "2px 3px 6px rgba(0,0,0,.35)",
                      }}
                    />
                    <div
                      style={{ position: "absolute", left: 8, top: BH - 4, width: BW - 8, height: 8, background: GILT_B, borderRadius: "0 0 3px 3px" }}
                    />

                    {/* first page: What is X? */}
                    <div
                      ref={pageRef}
                      style={{
                        position: "absolute", left: 0, top: 6, width: PW, height: PH,
                        borderRadius: "0 3px 3px 0", overflow: "hidden", textAlign: "left",
                      }}
                    >
                      <TitlePage c={c} lang={lang} dark={dark} />
                    </div>

                    {/* ribbon bookmark */}
                    <div
                      style={{
                        position: "absolute", left: BW * 0.64, top: BH - 26, width: 16, height: 74,
                        background: "linear-gradient(90deg,#7f1d1d,#dc2626 45%,#991b1b)",
                        clipPath: "polygon(0 0,100% 0,100% 100%,50% 84%,0 100%)",
                        filter: "drop-shadow(0 3px 2px rgba(0,0,0,.4))",
                      }}
                    />

                    {/* the cover: closed at rest, ajar on hover, fully open when clicked */}
                    <motion.div
                      style={{
                        position: "absolute", left: 0, top: 0, width: BW, height: BH,
                        transformStyle: "preserve-3d", originX: 0, originY: 0.5, z: 2,
                      }}
                      animate={{ rotateY: opening ? -112 : open ? -30 : 0 }}
                      transition={anim ? { duration: 1.1, ease: soft } : { duration: 0 }}
                    >
                      <CoverFront c={c} title={title} byline={byline} numeral={numeral} open={open} />
                      {/* inside of the cover */}
                      <div
                        style={{
                          position: "absolute", inset: 0, transform: "rotateY(180deg)", ...face, borderRadius: "10px 4px 4px 10px",
                          background: `linear-gradient(90deg, ${dk}, ${shade(c.color, 70)})`,
                        }}
                      >
                        <div className="absolute inset-3 rounded border border-amber-200/20" />
                      </div>
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>
            </div>
          </button>
        </motion.div>
      </div>
    </div>
  );
}

/* ---------- Text beside the open door (title, intro, checklist) ---------- */
function InfoPanel({ c, index, lang, dark, byline, wrap, touch, label, onEnter }) {
  const title = tx(c.name, lang);
  const answer = tx(c.answer, lang) || tx(c.desc, lang);
  const facts = (tx(c.facts, lang) || []).slice(0, 4);
  const hotColor = dark ? mix(c.color, 0.4) : c.color;
  const numeral = ROMAN[index - 1] || index;
  const ink = dark ? "#efe8d6" : "#1c1917";
  const i0 = index - 1;
  // sits to the right of the open door; for the last two doors it moves to the left
  const left = i0 <= 1 ? (i0 + 1) * SLOT + 10 : (i0 - 2) * SLOT + 40;

  const style = wrap
    ? { flexBasis: "100%", padding: "0 24px", color: ink }
    : { position: "absolute", left, top: 56, width: 2 * SLOT - 60, zIndex: 20, color: ink };

  return (
    <motion.div
      style={style}
      className="pointer-events-none"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: soft }}
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: "#a07a2a" }}>
        {numeral} · {byline}
      </p>
      <h3 className="mt-2 font-serif text-[40px] font-bold leading-[1.05] md:text-[46px]">{title}</h3>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed opacity-70">{answer}</p>
      <ul className="mt-5 space-y-2.5">
        {facts.map((f, i) => (
          <li key={i} className="flex items-start gap-3 text-[15px] leading-snug">
            <span
              className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: hotColor }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={dark ? "#0b0907" : "#fff"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 6.5 L5 9 L9.5 3.5" />
              </svg>
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {touch && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEnter();
          }}
          className="pointer-events-auto mt-6 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white ring-1 ring-amber-300/40 dark:bg-white dark:text-black"
        >
          {label} <span aria-hidden>→</span>
        </button>
      )}
    </motion.div>
  );
}

/* ---------- Pick up the phrase, fly it to the category heading, paste it there ---------- */
function ZoomPage({ rect, dir, c, lang, dark, onDone }) {
  const phraseRef = useRef(null); // the phrase on the book page
  const tgtRef = useRef(null); // the heading at its final place
  const doneRef = useRef(false);
  const stageRef = useRef(dir === "in" ? "rest" : "fly");
  const [stage, setStageState] = useState(stageRef.current);
  const [geo, setGeo] = useState(null);
  const sb = useMemo(sbWidth, []);
  const setStage = (s) => {
    stageRef.current = s;
    setStageState(s);
  };

  // measure: where the phrase is now, and where the heading will be
  useLayoutEffect(() => {
    const sr = phraseRef.current?.getClientRects()?.[0];
    const tr = tgtRef.current?.getBoundingClientRect();
    if (!sr || !tr || !tr.width) setGeo({ ok: false });
    else setGeo({ ok: true, dx: sr.left - tr.left, dy: sr.top - tr.top, k: sr.width / tr.width });
  }, []);

  useEffect(() => {
    if (!geo) return;
    if (!geo.ok) {
      if (!doneRef.current) { doneRef.current = true; onDone(); }
      return;
    }
    if (dir === "in") {
      setStage("color"); // 1) colour the phrase, dim the site
      const id = setTimeout(() => setStage("fly"), 1000); // 2) pick it up and fly
      return () => clearTimeout(id);
    }
  }, [geo, dir]);

  const bg = READER_BG[dark ? "dark" : "light"];
  const hotColor = dark ? mix(c.color, 0.4) : c.color;
  const flying = stage === "fly";
  const fIn = dir === "in";

  const ident = { x: 0, y: 0, scale: 1 };
  const srcT = geo?.ok ? { x: geo.dx, y: geo.dy, scale: geo.k } : ident;
  const glowOn = `0 0 34px ${hotColor}`;
  const glowOff = `0 0 0px ${hotColor}`;
  const fInitial = fIn ? { ...srcT, textShadow: glowOn } : { ...ident, textShadow: glowOff };
  const fAnimate = fIn
    ? flying ? { ...ident, textShadow: glowOff } : { ...srcT, textShadow: glowOn }
    : { ...srcT, textShadow: glowOn };
  const fTransition = fIn ? (flying ? { duration: 1.35, ease } : { duration: 0 }) : { duration: 1.2, ease };

  const left0 = rect.cx - PW / 2;
  const top0 = rect.cy - PH / 2;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[60]"
      initial={{ opacity: fIn ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* the site fades into the page background (theme aware) */}
      <motion.div
        className="absolute inset-0"
        style={{ background: bg }}
        initial={{ opacity: fIn ? 0 : 1 }}
        animate={{ opacity: fIn ? (flying ? 1 : stage === "color" ? 0.55 : 0) : 0 }}
        transition={
          fIn
            ? flying ? { duration: 1, delay: 0.15, ease: soft } : { duration: 0.8, ease: soft }
            : { duration: 1, delay: 0.25, ease: soft }
        }
      />

      {/* colour bloom around the phrase */}
      <motion.div
        className="absolute rounded-full"
        style={{
          left: rect.cx - 230, top: rect.cy - 230, width: 460, height: 460,
          background: `radial-gradient(circle, ${hotColor} 0%, transparent 65%)`,
        }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={
          fIn && stage === "color" ? { opacity: 0.4, scale: 1.1 }
          : fIn && flying ? { opacity: 0, scale: 1.8 }
          : { opacity: 0, scale: 0.4 }
        }
        transition={{ duration: 0.9, ease: soft }}
      />

      {/* the book page (identical to the one on the shelf) */}
      <motion.div
        className="overflow-hidden"
        style={{
          position: "fixed", left: left0, top: top0, width: PW, height: PH, borderRadius: 3,
          boxShadow: "0 24px 70px rgba(0,0,0,.45)",
        }}
        initial={{ opacity: fIn ? 1 : 0, scale: rect.s0 }}
        animate={
          fIn && flying ? { opacity: 0, scale: rect.s0 * 1.08 } : { opacity: 1, scale: rect.s0 }
        }
        transition={
          fIn ? { duration: flying ? 0.8 : 0, ease: soft } : { duration: 0.9, delay: 0.3, ease: soft }
        }
      >
        <TitlePage c={c} lang={lang} dark={dark} stage={stage} phraseRef={phraseRef} />
      </motion.div>

      {/* the picked-up phrase: lives exactly where the category heading will be */}
      <div
        className="pointer-events-none fixed left-0 top-0 h-full"
        style={{ width: `calc(100% - ${sb}px)`, opacity: flying ? 1 : 0 }}
      >
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-32">
          <h1 className="font-serif text-5xl font-bold leading-none md:text-[8rem]">
            <motion.span
              key={geo?.ok ? "go" : "measure"}
              ref={tgtRef}
              className="inline-block"
              style={{ originX: 0, originY: 0, color: hotColor }}
              initial={fInitial}
              animate={fAnimate}
              transition={fTransition}
              onAnimationComplete={() => {
                if (!geo?.ok || doneRef.current) return;
                if (fIn) {
                  if (stageRef.current === "fly") {
                    doneRef.current = true;
                    onDone(); // pasted on the heading -> show the category page
                  }
                } else {
                  doneRef.current = true; // flew back into the book
                  setStage("land");
                  setTimeout(() => setStage("rest"), 350);
                  setTimeout(onDone, 800);
                }
              }}
            >
              {tx(c.name, lang)}
            </motion.span>
          </h1>
        </section>
      </div>
    </motion.div>
  );
}

/* ---------- The 3D wall: a real CSS-3D room (back wall, side walls, ceiling, floor ledge) ---------- */
const PERSP = 1100; // camera distance

function Wall({ dark, parallax, onClick, children }) {
  const outerRef = useRef(null);
  const stageRef = useRef(null);
  const target = useRef({ x: 50, y: 50 });
  const cur = useRef({ x: 50, y: 50 });
  const raf = useRef(0);
  const [g, setG] = useState({ W: 1200, off: 0, I: 24, L: 120, ET: 110, EB: 64 });

  // size everything from the real page width (no 100vw, so no sideways scrollbar)
  useLayoutEffect(() => {
    const calc = () => {
      const W = document.documentElement.clientWidth;
      const parent = outerRef.current?.parentElement;
      const off = parent ? parent.getBoundingClientRect().left : 0;
      const I = Math.max(24, Math.min((W - 1260) / 2, W * 0.14)); // how far the side walls are inset
      const a = W / 2 - I;
      const L = Math.max(80, PERSP * (1 - a / (W / 2)) * 1.15); // how far the room comes forward
      setG({ W, off, I, L, ET: W < 640 ? 70 : 120, EB: W < 640 ? 44 : 70 });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // camera parallax: smoothly move the vanishing point with the mouse
  const tick = () => {
    const c = cur.current;
    const t = target.current;
    c.x += (t.x - c.x) * 0.08;
    c.y += (t.y - c.y) * 0.08;
    if (stageRef.current) stageRef.current.style.perspectiveOrigin = `${c.x}% ${c.y}%`;
    if (Math.abs(t.x - c.x) > 0.05 || Math.abs(t.y - c.y) > 0.05) raf.current = requestAnimationFrame(tick);
    else raf.current = 0;
  };
  const kick = () => {
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const C = dark
    ? {
        fill: "#0a0806",
        back: "linear-gradient(180deg,#16130f 0%,#0d0b09 100%)",
        vignette: "radial-gradient(ellipse at 50% 42%, transparent 50%, rgba(0,0,0,.55))",
        sideL: "linear-gradient(90deg,#1d1812,#040302)",
        sideR: "linear-gradient(270deg,#1d1812,#040302)",
        ceil: "linear-gradient(180deg,#221c15,#060504)",
        ceilGlow: "radial-gradient(ellipse at 50% 55%, rgba(255,196,110,.26), transparent 70%)",
        panel: "rgba(255,255,255,.035)",
        wainscot: "#2e2820",
        floor: "linear-gradient(0deg,#4a331a,#1b1209)",
        plank: "rgba(0,0,0,.45)",
        seam: "rgba(0,0,0,.22)",
        pool: "radial-gradient(ellipse at 50% 100%, rgba(255,196,110,.22), transparent 65%)",
        skirt: "linear-gradient(180deg,#2e2820,#171310)",
        skirtLine: "1px solid rgba(240,203,98,.3)",
        crown: "linear-gradient(180deg,#3a3126,#1b1611)",
        plinth: "linear-gradient(180deg,#352c20,#14100c)",
        plinthTop: "1px solid rgba(240,203,98,.35)",
      }
    : {
        fill: "#cfc7b8",
        back: "linear-gradient(180deg,#ece7e0 0%,#ddd6cb 100%)",
        vignette: "radial-gradient(ellipse at 50% 42%, transparent 55%, rgba(80,60,30,.16))",
        sideL: "linear-gradient(90deg,#dcd5c9,#a79e8c)",
        sideR: "linear-gradient(270deg,#dcd5c9,#a79e8c)",
        ceil: "linear-gradient(180deg,#f8f5ee,#cdc5b5)",
        ceilGlow: "radial-gradient(ellipse at 50% 55%, rgba(255,255,255,.95), transparent 70%)",
        panel: "rgba(0,0,0,.05)",
        wainscot: "#f3eee4",
        floor: "linear-gradient(0deg,#ecc9b3,#c9a089)",
        plank: "rgba(120,70,40,.3)",
        seam: "rgba(120,70,40,.12)",
        pool: "radial-gradient(ellipse at 50% 100%, rgba(255,255,255,.7), transparent 65%)",
        skirt: "linear-gradient(180deg,#faf6ee,#e4ddd0)",
        skirtLine: "1px solid rgba(0,0,0,.1)",
        crown: "linear-gradient(180deg,#ffffff,#e2dacb)",
        plinth: "linear-gradient(180deg,#f8f4ec,#ddd5c8)",
        plinthTop: "1px solid rgba(0,0,0,.1)",
      };

  const plane = "pointer-events-none absolute";

  return (
    <div
         ref={outerRef}
      id="room"
      className="relative overflow-hidden"
      style={{
        width: g.W,
        marginLeft: -g.off,
        marginTop: 40,
        paddingTop: g.ET,
        background: C.fill,
        WebkitMaskImage: "linear-gradient(180deg, transparent 0, #000 34px)",
        maskImage: "linear-gradient(180deg, transparent 0, #000 34px)",
      }}
            onMouseMove={(e) => {
        if (!parallax) return;
        const r = e.currentTarget.getBoundingClientRect();
        target.current = {
          x: 50 + ((e.clientX - r.left) / r.width - 0.5) * 36,
          y: 50 + ((e.clientY - r.top) / r.height - 0.5) * 28,
        };
        kick();
      }}
      onMouseLeave={() => {
        target.current = { x: 50, y: 50 };
        kick();
      }}
      onClick={onClick}
    >
      <div ref={stageRef} className="relative" style={{ perspective: PERSP, marginBottom: g.EB }}>
        <div className="relative" style={{ transformStyle: "preserve-3d" }}>
          {/* back wall */}
          <div className={`${plane} inset-y-0`} style={{ left: g.I, right: g.I, background: C.back }} />
          <div className={`${plane} inset-y-0`} style={{ left: g.I, right: g.I, background: C.vignette }} />

          {/* left wall */}
          <div
            className={`${plane} bottom-0 top-0`}
            style={{
              left: g.I, width: g.L, transformOrigin: "0% 50%", transform: "rotateY(-90deg)",
              background: `linear-gradient(0deg, ${C.wainscot} 0 22px, transparent 22px), repeating-linear-gradient(90deg, ${C.panel} 0 2px, transparent 2px 120px), ${C.sideL}`,
            }}
          />
          {/* right wall */}
          <div
            className={`${plane} bottom-0 top-0`}
            style={{
              right: g.I, width: g.L, transformOrigin: "100% 50%", transform: "rotateY(90deg)",
              background: `linear-gradient(0deg, ${C.wainscot} 0 22px, transparent 22px), repeating-linear-gradient(270deg, ${C.panel} 0 2px, transparent 2px 120px), ${C.sideR}`,
            }}
          />
          {/* ceiling with beams */}
          <div
            className={`${plane} top-0`}
            style={{
              left: g.I, right: g.I, height: g.L, transformOrigin: "50% 0%", transform: "rotateX(90deg)",
              background: `${C.ceilGlow}, repeating-linear-gradient(90deg, ${C.panel} 0 3px, transparent 3px 170px), repeating-linear-gradient(180deg, ${C.panel} 0 3px, transparent 3px 130px), ${C.ceil}`,
            }}
          />
          {/* floor ledge with planks */}
          <div
            className={`${plane} bottom-0`}
            style={{
              left: g.I, right: g.I, height: g.L, transformOrigin: "50% 100%", transform: "rotateX(-90deg)",
              background: `linear-gradient(0deg, rgba(0,0,0,.38), transparent 30%), ${C.pool}, repeating-linear-gradient(90deg, ${C.plank} 0 2px, transparent 2px 110px), repeating-linear-gradient(0deg, ${C.seam} 0 1px, transparent 1px 80px), ${C.floor}`,
            }}
          />

          {/* crown molding where ceiling meets the back wall */}
          <div
            className={`${plane} top-0`}
            style={{ left: g.I, right: g.I, height: 8, background: C.crown, boxShadow: "0 3px 8px rgba(0,0,0,.25)" }}
          />

          {/* the doors + books (on the back wall) */}
          <div className="relative" style={{ marginLeft: g.I, marginRight: g.I }}>
            <div className="relative px-3 pt-16 md:px-8">{children}</div>
            {/* skirting board */}
            <div
              className="relative z-[6]"
              style={{ height: 22, background: C.skirt, borderTop: C.skirtLine, boxShadow: "0 6px 14px rgba(0,0,0,.28)" }}
            />
          </div>
        </div>
      </div>

      {/* front edge of the ledge */}
      <div
        className="relative z-20"
        style={{ height: 24, background: C.plinth, borderTop: C.plinthTop, boxShadow: "0 -10px 24px rgba(0,0,0,.22)" }}
      />
    </div>
  );
}

/* ---------- Section ---------- */
export default function Books() {
  const { lang, theme } = useSettings();
  const { profile, categories, projects, features, t } = useData();
  const dark = theme === "dark";
  const touch = useIsTouch();
  const [focusId, setFocusId] = useState(null); // the book the cursor is on (null = plain row of books)
  const [activeId, setActiveId] = useState(null); // book we entered
  const [openingId, setOpeningId] = useState(null); // book whose cover is swinging fully open
  const [phase, setPhase] = useState("idle"); // idle | opening | zoomIn | inside | zoomOut
  const [rect, setRect] = useState(null);
  const pageRefs = useRef({});
  const openTimer = useRef(null);

  const anim = features.bookAnimation !== false;
  const hover = features.hoverEffects !== false;
  const byline = tx(profile.name, lang).split(" ")[0].toUpperCase();

  const listFor = (id) => projects.filter((p) => p.categories.includes(id));
  const active = categories.find((c) => c.id === activeId);
  const activeIndex = categories.findIndex((c) => c.id === activeId) + 1;
  const activeList = active ? listFor(active.id) : [];

  const cur = categories.find((c) => c.id === focusId);
  const curIndex = categories.findIndex((c) => c.id === focusId) + 1;

  useEffect(() => {
    // page can still scroll while the cover opens; it locks once the zoom starts
    document.body.style.overflow = phase === "idle" || phase === "opening" ? "" : "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [phase]);

    // tell the navbar which book is open, so it can underline that book's name
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("book-active", { detail: phase === "inside" ? activeId : null })
    );
  }, [phase, activeId]);

  const enter = (id) => {
    if (phase !== "idle") return;
    setFocusId(id);
    setActiveId(id);
    if (!anim) {
      setRect(null);
      setPhase("inside");
      return;
    }
    // 1) cover swings fully open  2) then measure the page and start the zoom
    setOpeningId(id);
    setPhase("opening");
    clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => {
      const el = pageRefs.current[id];
      if (!el) {
        setRect(null);
        setPhase("inside");
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ cx: r.left + r.width / 2, cy: r.top + r.height / 2, s0: r.width / PW });
      setPhase("zoomIn");
    }, OPEN_MS);
  };

  const onBookClick = (id) => {
    if (phase !== "idle") return;
    if (touch && focusId !== id) { setFocusId(id); return; } // phones: 1st tap opens the book
    enter(id); // 2nd tap / click enters
  };
  // hover opens a book; leaving it brings back the plain row of books
  const onOpen = (id) => { if (phase === "idle" && !touch) setFocusId(id); };
  const onLeave = (id) => { if (phase === "idle" && !touch) setFocusId((f) => (f === id ? null : f)); };

  const closeNow = () => {
    clearTimeout(openTimer.current);
    setPhase("idle");
    setOpeningId(null);
    setFocusId(null);
  };
  const back = () => {
    if (rect && anim) setPhase("zoomOut");
    else closeNow();
  };

  // navbar / footer links open a book directly
  useEffect(() => {
    const h = (e) => {
      clearTimeout(openTimer.current);
      setActiveId(e.detail);
      setFocusId(e.detail);
      setOpeningId(null);
      setRect(null);
      setPhase("inside");
    };
    window.addEventListener("open-book", h);
    return () => window.removeEventListener("open-book", h);
  }, []);

  // Home / My Story / Contact links leave the category page
  useEffect(() => {
    const h = () => {
      if (window.location.hash !== "#projects") closeNow();
    };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  return (
    <section id="projects" className="scroll-mt-20 pb-4 pt-20">
      <div className="text-center">
        <p className="flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] opacity-70">
          <span className="h-px w-10 bg-current opacity-50" />
          {t("books_eyebrow")}
          <span className="h-px w-10 bg-current opacity-50" />
        </p>
        <h2 className="mx-auto mt-4 max-w-4xl font-serif text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          {t("books_title")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl opacity-70">{t("books_sub")}</p>
      </div>

                 <Wall
        dark={dark}
        parallax={features.wallParallax === true}
        onClick={() => { if (touch && phase === "idle") setFocusId(null); }}
      >
        <FitRow
          n={categories.length}
          overlay={(wrap) => (
            <AnimatePresence mode="wait">
              {cur && (
                <InfoPanel
                  key={cur.id}
                  c={cur}
                  index={curIndex}
                  lang={lang}
                  dark={dark}
                  byline={byline}
                  wrap={wrap}
                  touch={touch}
                  label={t("click_to_enter")}
                  onEnter={() => enter(cur.id)}
                />
              )}
            </AnimatePresence>
          )}
        >
          {categories.map((c, i) => (
            <ShelfBook
              key={c.id}
              c={c}
              index={i + 1}
              lang={lang}
              dark={dark}
              open={focusId === c.id}
              anyOpen={!!focusId}
              opening={openingId === c.id}
              anim={anim}
              hover={hover}
              byline={byline}
              pageRef={(el) => { pageRefs.current[c.id] = el; }}
              onClick={() => onBookClick(c.id)}
              onOpen={() => onOpen(c.id)}
              onLeave={() => onLeave(c.id)}
            />
          ))}
        </FitRow>
      </Wall>

      {/* cursor-following label: only while the cursor is on a book (desktop) */}
      {!touch && <CursorPill show={!!focusId && phase === "idle"} label={t("click_to_enter")} />}

      <AnimatePresence>
        {(phase === "zoomIn" || phase === "zoomOut") && rect && active && (
          <ZoomPage
            key={phase}
            rect={rect}
            dir={phase === "zoomIn" ? "in" : "out"}
            c={active}
            lang={lang}
            dark={dark}
            onDone={() => {
              if (phase === "zoomIn") setPhase("inside");
              else closeNow();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "inside" && active && (
          <BookReader
            key={active.id}
            c={active}
            index={activeIndex}
            list={activeList}
            lang={lang}
            start={0}
            anim={anim}
            onClose={back}
          />
        )}
      </AnimatePresence>
    </section>
  );
}