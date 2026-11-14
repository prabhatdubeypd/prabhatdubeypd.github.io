import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { GameArt } from "./KingGames";

/* ---------- what you can tune ---------- */
const W = 92; // banner width (px)
const WIRE = 20; // height of the triangle rope (px)
const TILE = 24; // size of the icon tile
const RING = TILE + 8; // size of the round timer ring around it
const SLIDE_MS = 2400; // how long each icon stays
const SKEY = "games-banner-closed";

// WHERE THE HOOK HANGS: it centres itself under the king card icon automatically
// (under the icon passed as anchorRef, or else under its own parent wrapper).
// HOOK_FROM_RIGHT is only the starting guess for the first frame, before it is measured.
const HOOK_FROM_RIGHT = 15;

/* ---------- physics (pendulum) ---------- */
const K = 8.5; // gravity / rope length: bigger = faster swing
const C = 0.55; // air friction: bigger = stops sooner
const WIND = 0.16; // tiny constant breeze so it never looks dead (0 = off)
const GRAB_K = 130; // how strongly your finger pulls the banner while dragging
const GRAB_C = 15; // damping of that pull (lower = more wobble)
const TASSEL_K = 42; // tassel stiffness
const TASSEL_C = 3.2; // tassel damping
const MAX_ANGLE = 1.3; // furthest you can pull it (radians, ~75deg)

/* ---------- which games may appear ---------- */
const KNOWN = ["chess", "ludo", "checkers", "watersort", "snake", "dots", "puzzle", "elements", "find", "higherlower", "blackjack", "memory"];
const NEEDS_CPU = ["chess", "ludo"]; // shown only when their `modes` contains cpu (same rule as the games window)
const hasCpu = (m) => /(^|,)\s*cpu\s*(,|$)/i.test(String(m || ""));
const FALLBACK = {
  title: { en: "Want to play a game?", hi: "गेम खेलना है?" },
  desc: { en: "Fun inside · tap an icon", hi: "मज़ा अंदर है · आइकन दबाएँ" },
};

const GOLD = "linear-gradient(180deg,#fff3bf 0%,#f0cb62 30%,#b8862b 58%,#f6dc8c 80%,#c9972f 100%)";
const EDGE = "linear-gradient(160deg,#fff3bf 0%,#d9a52e 35%,#8a6a14 62%,#f0cb62 100%)";
const BALL = "radial-gradient(circle at 35% 30%,#fffbe0,#e8c15a 45%,#8a6a14)";
const VELVET = "radial-gradient(120% 100% at 25% 0%,#4d2025 0%,#27110f 55%,#130807 100%)";
const goldText = { backgroundImage: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
// pennant: straight top, swallowtail bottom
const SHAPE = "polygon(0 0, 100% 0, 100% calc(100% - 8px), 50% 100%, 0 calc(100% - 8px))";
const RR = RING / 2 - 2;
const ART_BOX = RING - 8 - 4; // the icon is measured and shrunk to fit inside this square
const PIVOT_Y = 4.5; // y of the hook ring centre

const CSS = `
@keyframes gb-sheen{0%{transform:translateX(-160%) skewX(-20deg)}55%,100%{transform:translateX(560%) skewX(-20deg)}}
@keyframes gb-tw{0%,100%{opacity:0;transform:scale(.2) rotate(0deg)}50%{opacity:1;transform:scale(1) rotate(45deg)}}
@keyframes gb-glow{0%,100%{opacity:.35;transform:scale(.9)}50%{opacity:.8;transform:scale(1.15)}}
.gb-sheen{animation:gb-sheen 6.5s ease-in-out infinite}
.gb-tw{animation:gb-tw 3.2s ease-in-out infinite}
.gb-glow{animation:gb-glow 2.8s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.gb-sheen,.gb-tw,.gb-glow{animation:none}}
`;

const Star = ({ style, delay }) => (
  <svg
    className="gb-tw pointer-events-none absolute" width="6" height="6" viewBox="0 0 10 10"
    style={{ ...style, animationDelay: `${delay}s` }} aria-hidden="true"
  >
    <path d="M5 0 L6.2 3.8 L10 5 L6.2 6.2 L5 10 L3.8 6.2 L0 5 L3.8 3.8 Z" fill="#fff3bf" />
  </svg>
);

/* Measures the real size of the game icon, centres it, and scales it to fit the square. */
function FitArt({ kind, box }) {
  const ref = useRef(null);
  const [s, setS] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setS(w && h ? Math.min(box / w, box / h) : 0.35);
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); };
  }, [kind, box]);
  return (
    <div
      ref={ref}
      style={{
        position: "absolute", left: "50%", top: "50%", width: "max-content", height: "max-content",
        transform: `translate(-50%,-50%) scale(${s ?? 0.3})`, transformOrigin: "center",
        opacity: s == null ? 0 : 1, pointerEvents: "none",
      }}
    >
      <GameArt kind={kind} />
    </div>
  );
}

export default function GamesBanner({ lang, onPlay, anchorRef }) {
  const reduce = useReducedMotion();
  const [closed, setClosed] = useState(() => {
    try { return sessionStorage.getItem(SKEY) === "1"; } catch { return false; }
  });
  const [rows, setRows] = useState(null);
  const [idx, setIdx] = useState(0);
  const [hold, setHold] = useState(false); // finger or mouse on the banner: stop switching
  const [right, setRight] = useState(HOOK_FROM_RIGHT - W / 2);

  const boxRef = useRef(null); // outer box (drop-in, hover)
  const swingRef = useRef(null); // the part that swings
  const tasselRef = useRef(null);
  const ph = useRef({ a: 0, w: 0, f: 0, fv: 0, drag: false, pending: false, moved: false, target: 0, sx: 0, sy: 0, id: null });

  useEffect(() => {
    let dead = false;
    supabase.from("games").select("*")
      .then(({ data, error }) => { if (!dead && !error && data) setRows(data); })
      .catch(() => {});
    return () => { dead = true; };
  }, []);

  // only games that are switched on in Supabase, in your sort order
  const { list, banner } = useMemo(() => {
    const all = rows || [];
    const list = all
      .filter((r) => KNOWN.includes(r.key) && r.enabled !== false && (!NEEDS_CPU.includes(r.key) || hasCpu(r.modes)))
      .sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99));
    return { list, banner: all.find((r) => r.key === "_banner") };
  }, [rows]);

  const show = !closed && list.length > 0 && banner?.enabled !== false;

  useEffect(() => {
    if (closed || hold || list.length < 2) return undefined;
    const id = setInterval(() => setIdx((i) => i + 1), SLIDE_MS);
    return () => clearInterval(id);
  }, [closed, hold, list.length]);

  /* hang the hook exactly under the king card icon (when anchorRef is given) */
  useLayoutEffect(() => {
    if (!show) return undefined;
    const place = () => {
      const el = boxRef.current;
      if (!el || !el.offsetParent) return;
      const p = el.offsetParent.getBoundingClientRect();
      const a = anchorRef && anchorRef.current;
      // no ref given: hang from the middle of the parent (in your Navbar that is the card icon's own wrapper)
      const r = a ? a.getBoundingClientRect() : p;
      setRight(p.right - (r.left + r.width / 2) - W / 2);
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", place); };
  }, [show, anchorRef]);

  /* the pendulum: gravity + friction + a light breeze, a finger spring while dragging, and a tassel that lags behind */
  useEffect(() => {
    if (!show) return undefined;
    const p = ph.current;
    p.a = reduce ? 0 : -0.4; p.w = 0; p.f = 0; p.fv = 0; p.drag = false; p.pending = false;
    let raf;
    let last = performance.now();
    const start = last;
    let tt = 0;
    const apply = () => {
      if (swingRef.current) swingRef.current.style.transform = `rotate(${(p.a * 180) / Math.PI}deg)`;
      if (tasselRef.current) tasselRef.current.style.transform = `rotate(${(p.f * 180) / Math.PI}deg)`;
    };
    const tick = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      if (now - start < 600) { apply(); raf = requestAnimationFrame(tick); return; } // wait for the drop-in
      const steps = Math.max(1, Math.round(dt * 240));
      const h = dt / steps;
      for (let i = 0; i < steps; i += 1) {
        tt += h;
        let acc = -K * Math.sin(p.a) - C * p.w;
        if (!reduce) acc += WIND * Math.sin(tt * 0.9) + WIND * 0.5 * Math.sin(tt * 1.7 + 1);
        if (p.drag) acc += GRAB_K * (p.target - p.a) - GRAB_C * p.w;
        p.w += acc * h;
        p.a += p.w * h;
        if (p.a > MAX_ANGLE + 0.15) { p.a = MAX_ANGLE + 0.15; p.w *= -0.35; }
        if (p.a < -MAX_ANGLE - 0.15) { p.a = -MAX_ANGLE - 0.15; p.w *= -0.35; }
        let fa = -TASSEL_K * p.f - TASSEL_C * p.fv - 0.9 * acc;
        p.fv += fa * h;
        p.f += p.fv * h;
        if (p.f > 0.9) { p.f = 0.9; p.fv = 0; }
        if (p.f < -0.9) { p.f = -0.9; p.fv = 0; }
        fa = 0;
      }
      apply();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show, reduce]);

  /* grab and swing it with finger or mouse; let go and it swings on by itself */
  const aimAt = (e) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const k = r.width / W || 1;
    const dx = e.clientX - (r.left + (W / 2) * k);
    const dy = Math.max(e.clientY - (r.top + PIVOT_Y * k), 14);
    const t = Math.atan2(-dx, dy);
    ph.current.target = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, t));
  };
  const onDown = (e) => {
    const p = ph.current;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    p.pending = true; p.moved = false; p.sx = e.clientX; p.sy = e.clientY; p.id = e.pointerId;
  };
  const onMove = (e) => {
    const p = ph.current;
    if (p.pending && !p.drag) {
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 5) return;
      p.drag = true; p.moved = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      setHold(true);
    }
    if (p.drag) aimAt(e);
  };
  const onUp = (e) => {
    const p = ph.current;
    p.pending = false;
    if (p.drag) {
      p.drag = false;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      setTimeout(() => setHold(false), 800);
    }
  };

  const hi = lang === "hi";
  const pick = (en, h) => (hi ? h || en : en);
  const title = pick(banner?.title_en, banner?.title_hi) || (hi ? FALLBACK.title.hi : FALLBACK.title.en);
  const desc = (banner ? pick(banner.desc_en, banner.desc_hi) : hi ? FALLBACK.desc.hi : FALLBACK.desc.en) || "";

  const cur = list.length ? list[idx % list.length] : null;
  const curName = cur ? pick(cur.title_en, cur.title_hi) || cur.key : "";
  const HX = W / 2; // hook is in the middle, so the rope is an even triangle

  const close = (e) => {
    e.stopPropagation();
    setClosed(true);
    try { sessionStorage.setItem(SKEY, "1"); } catch { /* ignore */ }
  };

  const play = () => {
    if (ph.current.moved) { ph.current.moved = false; return; } // it was a drag, not a tap
    if (cur) onPlay(cur.key);
  };

  return (
    <>
      <style>{CSS}</style>
      <AnimatePresence>
        {show && (
          <motion.div
            ref={boxRef}
            className="absolute top-full z-40"
            style={{ width: W, right, transformOrigin: `${HX}px ${PIVOT_Y}px` }}
            initial={{ opacity: 0, y: -26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -26, transition: { duration: 0.25 } }}
            whileHover={reduce ? undefined : { scale: 1.04 }}
            transition={{
              opacity: { duration: 0.3 },
              y: { type: "spring", stiffness: 130, damping: 13, delay: 0.6 },
              scale: { type: "spring", stiffness: 300, damping: 20 },
            }}
            onPointerEnter={() => setHold(true)}
            onPointerLeave={() => { if (!ph.current.drag) setHold(false); }}
            onTouchStart={() => setHold(true)}
            onTouchEnd={() => setTimeout(() => setHold(false), 1500)}
          >
            {/* everything inside swings around the hook ring */}
            <div
              ref={swingRef}
              style={{ transformOrigin: `${HX}px ${PIVOT_Y}px`, touchAction: "none", willChange: "transform" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              {/* hook ring + rope: an even triangle, apex in the middle, base on the two rail ends */}
              <svg
                width={W} height={WIRE + 4} viewBox={`0 0 ${W} ${WIRE + 4}`}
                style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="gbMetal" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff3bf" /><stop offset=".5" stopColor="#d9a52e" /><stop offset="1" stopColor="#8a6a14" />
                  </linearGradient>
                </defs>
                <path d={`M${HX} 8 L5 ${WIRE}`} stroke="rgba(0,0,0,.4)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                <path d={`M${HX} 8 L${W - 5} ${WIRE}`} stroke="rgba(0,0,0,.4)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                <path d={`M${HX} 8 L5 ${WIRE}`} stroke="#e8c15a" strokeWidth=".8" fill="none" strokeLinecap="round" />
                <path d={`M${HX} 8 L${W - 5} ${WIRE}`} stroke="#e8c15a" strokeWidth=".8" fill="none" strokeLinecap="round" />
                <circle cx={HX} cy={PIVOT_Y} r="3.8" fill="none" stroke="url(#gbMetal)" strokeWidth="1.5" />
                <circle cx={HX} cy={PIVOT_Y} r="1.1" fill="#3a2e16" />
              </svg>

              <div style={{ paddingTop: WIRE }}>
                {/* brass rail with two gold ball finials */}
                <div style={{ position: "relative", height: 9 }}>
                  <i style={{ position: "absolute", left: 6, right: 6, top: 3.5, height: 2.2, borderRadius: 2, background: EDGE, boxShadow: "0 1px 2px rgba(0,0,0,.5)" }} />
                  {[0, 1].map((s) => (
                    <i
                      key={s}
                      style={{
                        position: "absolute", top: 0, [s ? "right" : "left"]: 0, width: 9, height: 9, borderRadius: "50%",
                        background: BALL, boxShadow: "0 1px 3px rgba(0,0,0,.55)",
                      }}
                    />
                  ))}
                </div>

                {/* the pennant, with its tassel hanging from the tip */}
                <div style={{ position: "relative", margin: "0 3px", filter: "drop-shadow(0 8px 10px rgba(0,0,0,.5))" }}>
                  <div style={{ clipPath: SHAPE, background: EDGE, padding: 1.5 }}>
                    <div className="relative overflow-hidden" style={{ clipPath: SHAPE, background: VELVET, padding: "6px 6px 12px" }}>
                      {/* velvet weave, gloss, slow sheen and sparkles */}
                      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(240,203,98,.06) 0 1px, transparent 1px 6px)" }} />
                      <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.1), transparent 40%)" }} />
                      <div className="gb-sheen pointer-events-none absolute bottom-0 left-0 top-0" style={{ width: "26%", background: "linear-gradient(90deg, transparent, rgba(255,240,190,.22), transparent)" }} />
                      <Star style={{ left: 4, top: 8 }} delay={0} />
                      <Star style={{ right: 6, top: 24 }} delay={1.4} />

                      {/* the whole banner is one button: tap it to play the game shown (drag it to swing it) */}
                      <button
                        type="button" onClick={play}
                        aria-label={curName} title={desc || curName}
                        className="relative block w-full rounded text-left outline-none focus-visible:ring-1 focus-visible:ring-amber-300/70"
                      >
                        <div className="flex items-center gap-1">
                          {/* icon tile inside a round timer ring */}
                          <div style={{ position: "relative", width: RING, height: RING, flexShrink: 0 }}>
                            <i
                              className="gb-glow pointer-events-none absolute"
                              style={{ inset: -2, borderRadius: "50%", background: "radial-gradient(circle, rgba(240,203,98,.55), transparent 68%)" }}
                            />
                            <svg
  width={RING}
  height={RING}
  viewBox={`0 0 ${RING} ${RING}`}
  style={{
    position: "absolute",
    inset: 0,
    transform: "rotate(-90deg)"
  }}
  aria-hidden="true"
>
  <circle
    cx={RING / 2}
    cy={RING / 2}
    r={RR}
    fill="none"
    stroke="rgba(240,203,98,.22)"
    strokeWidth="1.5"
  />
</svg>
                            {/* the square: clips the icon so it can never spill outside */}
                            <div
                              style={{
                                position: "absolute", inset: 4, borderRadius: 7, perspective: 260, overflow: "hidden",
                                background: "linear-gradient(145deg, rgba(240,203,98,.26), rgba(240,203,98,.05))",
                                boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5), 0 3px 6px rgba(0,0,0,.45)",
                              }}
                            >
                              <AnimatePresence mode="wait" initial={false}>
                                {cur && (
                                  <motion.div
                                    key={cur.key}
                                    className="absolute inset-0"
                                    style={{ backfaceVisibility: "hidden" }}
                                    initial={reduce ? { opacity: 0 } : { rotateY: 90, opacity: 0, scale: 0.8 }}
                                    animate={reduce ? { opacity: 1 } : { rotateY: 0, opacity: 1, scale: 1 }}
                                    exit={reduce ? { opacity: 0 } : { rotateY: -90, opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.28, ease: "easeOut" }}
                                  >
                                    <FitArt kind={cur.key} box={ART_BOX} />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          {/* title from the Supabase _banner row */}
                          <b className="min-w-0 flex-1 pr-2 font-serif leading-[1.15]" style={{ fontSize: 7.5, ...goldText }}>{title}</b>
                        </div>

                        {/* the game that is showing now */}
                        <div className="mt-1 text-center" style={{ borderTop: "1px solid rgba(240,203,98,.25)", paddingTop: 2, minHeight: 11 }}>
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                              key={cur ? cur.key : "none"}
                              className="block truncate uppercase"
                              style={{ fontSize: 6, letterSpacing: ".12em", color: "#f0cb62" }}
                              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                              transition={{ duration: 0.2 }}
                            >
                              {curName}
                            </motion.span>
                          </AnimatePresence>
                        </div>
                      </button>

                      <button
                        type="button" onClick={close} onPointerDown={(e) => e.stopPropagation()} aria-label="Close"
                        className="absolute grid place-items-center rounded-full text-[6px] leading-none text-[#efe8d6]"
                        style={{ right: 3, top: 3, width: 10, height: 10, background: "rgba(0,0,0,.55)", boxShadow: "0 0 0 1px rgba(240,203,98,.8)" }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* gold tassel at the tip: swings on its own spring, driven by the banner's movement */}
                  <div
                    ref={tasselRef}
                    className="pointer-events-none absolute"
                    style={{ left: "50%", bottom: -11, marginLeft: -5, width: 10, height: 16, transformOrigin: "50% 0%" }}
                  >
                    <svg width="10" height="16" viewBox="0 0 10 18" style={{ overflow: "visible" }} aria-hidden="true">
                      <path d="M5 0 V4" stroke="#e8c15a" strokeWidth="1" />
                      <rect x="3.5" y="3.4" width="3" height="3.4" rx=".9" fill="url(#gbMetal)" />
                      <circle cx="5" cy="8.4" r="2" fill="#e8c15a" />
                      {[1.2, 3.1, 5, 6.9, 8.8].map((x, i) => (
                        <path key={i} d={`M5 9.6 L${x} ${i % 2 ? 17.5 : 16.5}`} stroke="#e8c15a" strokeWidth=".9" strokeLinecap="round" fill="none" />
                      ))}
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}