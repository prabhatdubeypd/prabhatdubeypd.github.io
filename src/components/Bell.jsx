import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../context/DataContext";
import KingCard from "./KingCard";

const S = 1.4; // size of the pull-cord (bigger number = bigger)
const SW = 46; // scene width and height (in unscaled px)
const SH = 138;
const KX = 23; // centre of the brass plate (placed on the navbar slot)
const KY = 9;
const HX = 23; // where the cord's ring hangs in the eyelet (pivot)
const HY = 27;
const K = 48; // swing stiffness, side to side
const K2 = 52; // swing stiffness, toward / away (slightly different = elliptical swing)
const D = 0.9; // swing damping (settles in roughly 8 seconds)
const KE = 150; // spring stiffness of the cord's stretch (pull down and bounce back)
const DE = 5.5; // stretch damping (lower = bouncier)
const MAX = 0.8; // biggest swing (radians)
const MAXB = 0.55;
const MAX_PULL = 46; // longest the cord can stretch (unscaled px)
const PULL_TRIGGER = 14; // pull the handle down this far (and let go) to summon the card
const ROPE_Y0 = 30; // where the rope starts (just under the ring)
const ROPE_LEN = 80; // resting rope length
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* the wooden pear handle (symmetric around x = 23), drawn below the rope */
const PEAR_D =
  "M21.3 116 C21.3 120 16.2 122.6 16.2 128.6 C16.2 133.8 19.3 137.4 23 137.4 C26.7 137.4 29.8 133.8 29.8 128.6 C29.8 122.6 24.7 120 24.7 116 Z";

export default function Bell() {
  const { features } = useData();
  const slotRef = useRef(null);
  const pendRef = useRef(null);
  const ropeRef = useRef(null);
  const handleRef = useRef(null);
  const st = useRef({
    a: 0, w: 0, b: 0, v: 0, e: 0, u: 0,
    raf: 0, prev: 0,
    lx: null, ly: null, lt: null, kick: null,
    summonAt: 0, drag: null,
  });
  const [pos, setPos] = useState(null);
  const enabled = features.bell !== false;

  // find where the slot is in the navbar, and hang the cord exactly there
  useLayoutEffect(() => {
    if (!enabled) return;
    const calc = () => {
      const r = slotRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ left: r.left + r.width / 2 - KX * S, top: r.top + r.height / 2 - KY * S });
    };
    calc();
    window.addEventListener("resize", calc);
    const ro = new ResizeObserver(calc);
    if (slotRef.current?.parentElement) ro.observe(slotRef.current.parentElement);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("resize", calc);
      ro.disconnect();
    };
  }, [enabled]);

  // physics: a 3D pendulum (two damped springs) + a stretchy cord (a third spring, for pulling)
  useEffect(() => {
    if (!enabled) return;
    const s = st.current;
    const paint = () => {
      if (pendRef.current)
        pendRef.current.style.transform = `rotateZ(${s.a.toFixed(4)}rad) rotateX(${s.b.toFixed(4)}rad) rotateY(${(s.a * 0.5).toFixed(4)}rad)`;
      if (ropeRef.current) ropeRef.current.setAttribute("height", (ROPE_LEN + s.e).toFixed(2));
      if (handleRef.current) handleRef.current.setAttribute("transform", `translate(0 ${s.e.toFixed(2)})`);
    };
    const step = (now) => {
      const dt = Math.min(0.032, (now - s.prev) / 1000);
      s.prev = now;

      if (s.drag) {
        // finger / cursor is holding the handle: it controls the angle and the stretch directly
        paint();
        s.raf = requestAnimationFrame(step);
        return;
      }

      s.w += (-K * s.a - D * s.w) * dt;
      s.a += s.w * dt;
      s.v += (-K2 * s.b - D * s.v) * dt;
      s.b += s.v * dt;
      s.u += (-KE * s.e - DE * s.u) * dt;
      s.e += s.u * dt;
      if (Math.abs(s.a) > MAX) { s.a = Math.sign(s.a) * MAX; s.w *= -0.4; }
      if (Math.abs(s.b) > MAXB) { s.b = Math.sign(s.b) * MAXB; s.v *= -0.4; }
      if (s.e > MAX_PULL) { s.e = MAX_PULL; s.u *= -0.3; }
      if (s.e < -6) { s.e = -6; s.u *= -0.3; }

      paint();
      const still =
        Math.abs(s.a) < 0.0005 && Math.abs(s.w) < 0.005 &&
        Math.abs(s.b) < 0.0005 && Math.abs(s.v) < 0.005 &&
        Math.abs(s.e) < 0.02 && Math.abs(s.u) < 0.05;
      if (still) {
        s.a = s.w = s.b = s.v = s.e = s.u = 0;
        paint();
        s.raf = 0;
        return;
      }
      s.raf = requestAnimationFrame(step);
    };
    s.kick = () => {
      if (!s.raf) {
        s.prev = performance.now();
        s.raf = requestAnimationFrame(step);
      }
    };
    return () => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [enabled, pos === null]);

  if (!enabled) return null;

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const push = (dw, dv = 0) => {
    const s = st.current;
    if (reduced()) return;
    s.w = clamp(s.w + dw, -8, 8);
    s.v = clamp(s.v + dv + dw * 0.25, -8, 8); // a sideways push also gives a little forward motion
    s.kick?.();
  };

  // the King of Spades comes out from the handle
  const summon = () => {
    const s = st.current;
    const t = performance.now();
    if (t - s.summonAt < 1200 || !pos) return;
    s.summonAt = t;
    window.dispatchEvent(
      new CustomEvent("open-king-card", { detail: { x: pos.left + HX * S, y: pos.top + 132 * S } })
    );
  };

  const onDown = (e) => {
    const s = st.current;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    s.drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, side: e.clientX };
    s.w = s.u = s.v = 0;
    s.kick?.();
  };

  const onMove = (e) => {
    const s = st.current;

    if (s.drag) {
      const dx = e.clientX - s.drag.x;
      const dy = e.clientY - s.drag.y;
      s.drag.moved = Math.max(s.drag.moved, Math.hypot(dx, dy));
      // pulling down stretches the cord (with a rubber-band feel); pushing up barely moves it
      const down = Math.max(0, dy) / S;
      const stretch = down > 0 ? MAX_PULL * (1 - Math.exp(-down / MAX_PULL)) : (dy / S) * 0.15;
      s.e = clamp(stretch, -4, MAX_PULL);
      // dragging sideways swings the whole cord
      s.a = clamp(-dx / (S * 90), -MAX, MAX);
      s.b = clamp(-(dy > 0 ? 0 : dy) / (S * 400), -MAXB, MAXB);
      s.kick?.();
      return;
    }

    // hover: moving the cursor over the cord gives it a gentle push
    const now = performance.now();
    const dx = e.movementX ?? e.clientX - (s.lx ?? e.clientX);
    const dy = e.movementY ?? e.clientY - (s.ly ?? e.clientY);
    s.lx = e.clientX;
    s.ly = e.clientY;
    s.lt = now;
    push(clamp(-dx * 0.05, -0.9, 0.9), clamp(dy * 0.04, -0.7, 0.7));
  };

  const finish = (e, cancelled) => {
    const s = st.current;
    const d = s.drag;
    if (!d) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const pulled = s.e >= PULL_TRIGGER;
    const tap = d.moved < 6 && performance.now() - d.t < 600;
    s.drag = null;

    if (tap && !cancelled) {
      // a tap: the handle bobs down and swings, and the card comes out
      if (!reduced()) {
        const r = e.currentTarget.getBoundingClientRect();
        s.w = clamp(s.w + (e.clientX > r.left + r.width / 2 ? 3 : -3), -8, 8);
        s.u = 22;
      }
      summon();
    } else if (pulled && !cancelled) {
      // a real pull: let go and it springs back up, and the card comes out
      s.w = clamp(s.w + s.a * -4, -8, 8);
      summon();
    }
    s.kick?.();
  };

  const onLeave = () => {
    const s = st.current;
    if (s.drag) return; // pointer capture keeps the drag alive
    s.lx = null;
    s.ly = null;
    s.lt = null;
  };

  const soft = { filter: "drop-shadow(0 4px 3px rgba(0,0,0,.28))" };
  const svgBase = { position: "absolute", left: 0, top: 0, overflow: "visible", ...soft };

  const cord = pos && (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", left: pos.left, top: pos.top, width: SW * S, height: SH * S,
        zIndex: 45, // above the page and the navbar (the card backdrop sits just below, the card just above)
        pointerEvents: "none", perspective: 900, perspectiveOrigin: `${KX * S}px ${KY * S}px`,
      }}
    >
      <div
        style={{
          position: "absolute", left: 0, top: 0, width: SW, height: SH, transformOrigin: "0 0",
          transform: `scale3d(${S},${S},${S})`, transformStyle: "preserve-3d",
        }}
      >
        {/* ---- fixed: brass plate, screw, neck and eyelet ---- */}
        <svg width={SW} height="40" viewBox={`0 0 ${SW} 40`} style={svgBase}>
          <defs>
            <linearGradient id="bf-gold" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#8a5f12" />
              <stop offset=".28" stopColor="#f3d36b" />
              <stop offset=".5" stopColor="#fff2b0" />
              <stop offset=".72" stopColor="#d9a933" />
              <stop offset="1" stopColor="#7a520f" />
            </linearGradient>
            <radialGradient id="bf-rose" cx=".36" cy=".3" r=".8">
              <stop offset="0" stopColor="#fff3bf" />
              <stop offset=".45" stopColor="#e6bb4a" />
              <stop offset=".85" stopColor="#a67410" />
              <stop offset="1" stopColor="#6b4709" />
            </radialGradient>
          </defs>
          {/* round brass plate */}
          <circle cx="23" cy="9" r="8" fill="url(#bf-rose)" stroke="rgba(60,35,0,.55)" strokeWidth=".6" />
          <circle cx="23" cy="9" r="5.8" fill="none" stroke="rgba(255,245,200,.55)" strokeWidth=".5" />
          <circle cx="23" cy="9" r="2.1" fill="#8a5f12" stroke="rgba(40,20,0,.6)" strokeWidth=".4" />
          <path d="M21.6 9 H24.4" stroke="#3b2506" strokeWidth=".6" strokeLinecap="round" />
          <ellipse cx="19.8" cy="5.4" rx="3" ry="1.3" fill="#fff" opacity=".35" />
          {/* neck */}
          <rect x="21.7" y="16.4" width="2.6" height="3.8" fill="url(#bf-gold)" stroke="rgba(60,35,0,.5)" strokeWidth=".35" />
          {/* closed ring (eyelet) the cord hangs from */}
          <circle cx="23" cy="23.4" r="4.4" fill="none" stroke="rgba(0,0,0,.32)" strokeWidth="2.6" />
          <circle cx="23" cy="23.4" r="4.4" fill="none" stroke="url(#bf-gold)" strokeWidth="1.7" />
        </svg>

        {/* ---- swinging: ring, braided rope, ferrule, wooden handle (pivots in the eyelet) ---- */}
        <div
          ref={pendRef}
          style={{
            position: "absolute", left: 0, top: 0, width: 0, height: 0,
            transformOrigin: `${HX}px ${HY}px`,
          }}
        >
          <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} style={svgBase}>
            <defs>
              <linearGradient id="bl-gold" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#8a5f12" />
                <stop offset=".28" stopColor="#f3d36b" />
                <stop offset=".5" stopColor="#fff2b0" />
                <stop offset=".72" stopColor="#d9a933" />
                <stop offset="1" stopColor="#7a520f" />
              </linearGradient>
              {/* braided rope: twisted diagonal strands */}
              <pattern id="rp-braid" width="2.8" height="2.4" patternUnits="userSpaceOnUse">
                <rect width="2.8" height="2.4" fill="#d6c8a6" />
                <path d="M0 2.4 L2.8 0" stroke="#8d7a52" strokeWidth=".7" />
                <path d="M-1.4 1.2 L1.4 -1.2" stroke="#8d7a52" strokeWidth=".7" />
                <path d="M1.4 3.6 L4.2 1.2" stroke="#8d7a52" strokeWidth=".7" />
                <path d="M0 0 L2.8 2.4" stroke="rgba(255,255,255,.35)" strokeWidth=".35" />
              </pattern>
              <linearGradient id="rp-round" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="rgba(40,25,5,.45)" />
                <stop offset=".35" stopColor="rgba(255,255,255,.3)" />
                <stop offset=".6" stopColor="rgba(0,0,0,0)" />
                <stop offset="1" stopColor="rgba(40,25,5,.5)" />
              </linearGradient>
              <linearGradient id="bl-wood-h" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#3f2209" />
                <stop offset=".3" stopColor="#a8683a" />
                <stop offset=".5" stopColor="#c98a55" />
                <stop offset=".75" stopColor="#8a4f24" />
                <stop offset="1" stopColor="#3a1f08" />
              </linearGradient>
              <clipPath id="bl-pear-clip">
                <path d={PEAR_D} />
              </clipPath>
            </defs>

            {/* ring linked through the eyelet */}
            <ellipse cx={HX} cy="31.6" rx="2.5" ry="5.7" fill="none" stroke="rgba(0,0,0,.32)" strokeWidth="2.4" />
            <ellipse cx={HX} cy="31.6" rx="2.5" ry="5.7" fill="none" stroke="url(#bl-gold)" strokeWidth="1.6" />

            {/* braided rope: its height changes while you pull (set by the physics loop) */}
            <rect ref={ropeRef} x={HX - 1.4} y={ROPE_Y0 + 4} width="2.8" height={ROPE_LEN} fill="url(#rp-braid)" />
            <rect x={HX - 1.4} y={ROPE_Y0 + 4} width="2.8" height="400" fill="none" />

            {/* handle group: slides down when the cord stretches */}
            <g ref={handleRef}>
              {/* rope shading, drawn only over the visible rope length via the handle offset */}
              {/* brass ferrule */}
              <rect x="20.4" y={ROPE_Y0 + 4 + ROPE_LEN - 1} width="5.2" height="5.6" rx=".9" fill="url(#bl-gold)" stroke="rgba(60,35,0,.55)" strokeWidth=".4" />
              <rect x="20.9" y={ROPE_Y0 + 4 + ROPE_LEN + 1.4} width="4.2" height=".7" fill="rgba(60,35,0,.35)" />
              <ellipse cx={HX} cy={ROPE_Y0 + 4 + ROPE_LEN + 4.6} rx="2.6" ry=".8" fill="#b8862b" />

              {/* wooden pear handle */}
              <path d={PEAR_D} fill="url(#bl-wood-h)" />
              <g clipPath="url(#bl-pear-clip)">
                {/* wood grain */}
                <path d="M19.6 116 C18 124 18.4 131 20.2 137" stroke="rgba(60,30,8,.45)" strokeWidth=".45" fill="none" />
                <path d="M21.6 116 C20.6 124 20.8 131 21.8 137" stroke="rgba(60,30,8,.4)" strokeWidth=".4" fill="none" />
                <path d="M24.4 116 C25.4 124 25.2 131 24.2 137" stroke="rgba(60,30,8,.4)" strokeWidth=".4" fill="none" />
                <path d="M26.6 116 C28 124 27.6 131 25.8 137" stroke="rgba(60,30,8,.45)" strokeWidth=".45" fill="none" />
                {/* soft light on the left, shadow under the belly */}
                <ellipse cx="19.8" cy="126" rx="1.4" ry="5" fill="#fff" opacity=".28" />
                <rect x="14" y="132" width="18" height="6" fill="rgba(30,12,0,.25)" />
              </g>
              <path d={PEAR_D} fill="none" stroke="rgba(40,18,0,.55)" strokeWidth=".5" strokeLinejoin="round" />
            </g>
          </svg>

          {/* round shading over the visible rope (kept short; the stretching rope reads fine without it) */}
          <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
            <rect x={HX - 1.4} y={ROPE_Y0 + 4} width="2.8" height={ROPE_LEN} fill="url(#rp-round)" />
          </svg>

          {/* touch area for the rope and handle (swings with it). Tall enough to follow a stretched cord. */}
          <div
            onPointerMove={onMove}
            onPointerLeave={onLeave}
            onPointerDown={onDown}
            onPointerUp={(e) => finish(e, false)}
            onPointerCancel={(e) => finish(e, true)}
            style={{
              position: "absolute", left: 6, top: 33, width: 34, height: 112,
              pointerEvents: "auto", cursor: "grab", touchAction: "none",
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* keeps the space in the navbar; the cord itself lives in its own top layer */}
      <div ref={slotRef} className="ml-2 h-7 w-[34px] shrink-0" aria-hidden="true" />
      {cord && createPortal(cord, document.body)}
      {/* the King of Spades overlay (listens for the cord) */}
      <KingCard />
    </>
  );
}