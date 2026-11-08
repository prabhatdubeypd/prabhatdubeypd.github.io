import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../context/DataContext";
import KingCard from "./KingCard";

const S = 1.4; // size of the bell (bigger number = bigger bell)
const SW = 46; // scene width and height (in unscaled px)
const SH = 138;
const KX = 23; // centre of the brass plate (placed on the navbar slot)
const KY = 9;
const HX = 23; // where the bell's ring hangs in the eyelet (pivot)
const HY = 27;
const K = 48; // spring stiffness, side to side
const K2 = 52; // spring stiffness, toward / away (slightly different = elliptical swing)
const D = 0.9; // damping (settles in roughly 8 seconds)
const MAX = 0.8; // biggest swing (radians)
const MAXB = 0.55;
const SPEED_FULL = 1.6; // cursor speed (px per ms) that counts as a "full speed" flick
const FORCE_SOUND = true; // true = bell always has sound (ignores bellSound = false in your data)
const VOLUME = 0.05; // MASTER VOLUME of the bell: 0.05 = very quiet, 0.1 = soft, 0.2 = medium, 1 = loud
const SAME_PITCH = false; // true = the bell always rings the same note, false = pitch follows your speed
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- soft, sweet chime made in code ---------- */
let audio = null;
let bus = null;
let current = null; // the ring that is sounding right now (only one at a time)

// notes of a C major pentatonic scale: every ring is in tune, like a wind chime
const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

function getAudio() {
  try {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      // everything goes through: soft low-pass -> gentle compressor -> master volume
      const lp = audio.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3800;
      lp.Q.value = 0.4;
      const comp = audio.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      const out = audio.createGain();
      out.gain.value = VOLUME;
      lp.connect(comp);
      comp.connect(out);
      out.connect(audio.destination);

      // light, warm reverb for a smooth tail
      const len = Math.floor(audio.sampleRate * 1.8);
      const ir = audio.createBuffer(2, len, audio.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      const conv = audio.createConvolver();
      conv.buffer = ir;
      const damp = audio.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 2600;
      const wet = audio.createGain();
      wet.gain.value = 0.3;
      lp.connect(conv);
      conv.connect(damp);
      damp.connect(wet);
      wet.connect(comp);

      bus = lp;
    }
    return audio;
  } catch {
    return null;
  }
}

// browsers only allow sound after the first click / tap / key press on the page
function unlockAudio() {
  const a = getAudio();
  if (a && a.state !== "running") a.resume().catch(() => {});
}

/* one soft strike. strength 0..1: a gentle touch = low, quiet note; a fast flick = higher, fuller note.
   Only ONE ring sounds at a time: a new ring smoothly fades the previous one out. */
function ring(strength, retried = false) {
  const a = getAudio();
  if (!a) return;
  if (a.state !== "running") {
    // audio still locked: unlock it, then play this ring once
    if (!retried)
      a.resume()
        .then(() => { if (a.state === "running") ring(strength, true); })
        .catch(() => {});
    return;
  }
  const v = clamp(strength, 0, 1);
  const t0 = a.currentTime;

  // fade the previous ring out quickly and smoothly, so two sounds never overlap
  if (current) {
    try {
      current.gain.cancelScheduledValues(t0);
      current.gain.setValueAtTime(Math.max(current.gain.value, 0.0001), t0);
      current.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    } catch {
      /* already finished */
    }
  }

  const f0 = SAME_PITCH ? NOTES[3] : NOTES[clamp(Math.round(v * 5), 0, NOTES.length - 1)]; // faster = higher note
  const peak = 0.16 + 0.3 * Math.pow(v, 1.2); // level before the master volume
  const dur = 1.3 + 1.5 * v; // how long it rings

  // smooth fade-in (no click), then a long natural fade-out
  const master = a.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(peak, t0 + 0.014);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  master.connect(bus);
  current = master;

  // warm tone: strong base note, a slightly detuned twin (gentle shimmer), soft overtones
  const partials = [
    [1, 1, 1],
    [1.004, 0.55, 1],
    [2, 0.28, 0.55],
    [3, 0.1, 0.35],
    [4.01, 0.04, 0.2],
  ];
  partials.forEach(([m, g, life]) => {
    const o = a.createOscillator();
    const gg = a.createGain();
    o.type = "sine";
    o.frequency.value = f0 * m;
    gg.gain.setValueAtTime(g, t0);
    gg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * life);
    o.connect(gg);
    gg.connect(master);
    o.start(t0);
    o.stop(t0 + dur * life + 0.05);
  });
}

// outline of the bell (symmetric around x = 23)
const BELL_D =
  "M20.8 98.4 C20 103 18.2 108 15.4 113 C13.5 116.5 11.6 120 10.5 124.5 Q10.2 126.2 12 126.6 Q23 129.6 34 126.6 Q35.8 126.2 35.5 124.5 C34.4 120 32.5 116.5 30.6 113 C27.8 108 26 103 25.2 98.4 Z";
const RIM_D =
  "M10.4 123.7 Q23 126.8 35.6 123.7 L35.5 124.5 Q35.8 126.2 34 126.6 Q23 129.6 12 126.6 Q10.2 126.2 10.5 124.5 Z";

/* a shaded 3D ball with a little highlight */
function Sphere({ cx, cy, r, fill }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${fill})`} stroke="rgba(70,40,0,.5)" strokeWidth=".45" />
      <ellipse cx={cx - r * 0.32} cy={cy - r * 0.42} rx={r * 0.34} ry={r * 0.2} fill="#fff" opacity=".7" />
    </g>
  );
}

export default function Bell() {
  const { features } = useData();
  const slotRef = useRef(null);
  const pendRef = useRef(null);
  const st = useRef({
    a: 0, w: 0, b: 0, v: 0, raf: 0, prev: 0, ringAt: 0,
    lx: null, ly: null, lt: null, kick: null, sound: true,
    summonAt: 0, hits: [],
  });
  const [pos, setPos] = useState(null);
  const enabled = features.bell !== false;
  const sound = FORCE_SOUND || features.bellSound !== false;
  st.current.sound = sound;

  // unlock the sound on the first click / tap / key press anywhere on the page
  useEffect(() => {
    if (!enabled) return;
    const events = ["pointerdown", "pointerup", "keydown", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, unlockAudio, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, unlockAudio));
  }, [enabled]);

  // find where the slot is in the navbar, and hang the bell exactly there
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

  // rate limit: a hard hit can repeat quickly, a soft one cannot. Returns true if it rang.
  const tryRing = (strength, minGap) => {
    const s = st.current;
    const t = performance.now();
    if (t - s.ringAt < minGap) return false;
    s.ringAt = t;
    if (s.sound) ring(strength);
    return true;
  };

  // 3D pendulum physics: two damped springs (side to side + toward / away). Motion only, no extra sound.
  useEffect(() => {
    if (!enabled) return;
    const s = st.current;
    const paint = () => {
      if (pendRef.current)
        pendRef.current.style.transform = `rotateZ(${s.a.toFixed(4)}rad) rotateX(${s.b.toFixed(4)}rad) rotateY(${(s.a * 0.5).toFixed(4)}rad)`;
    };
    const step = (now) => {
      const dt = Math.min(0.032, (now - s.prev) / 1000);
      s.prev = now;
      s.w += (-K * s.a - D * s.w) * dt;
      s.a += s.w * dt;
      s.v += (-K2 * s.b - D * s.v) * dt;
      s.b += s.v * dt;
      if (Math.abs(s.a) > MAX) { s.a = Math.sign(s.a) * MAX; s.w *= -0.4; }
      if (Math.abs(s.b) > MAXB) { s.b = Math.sign(s.b) * MAXB; s.v *= -0.4; }

      paint();
      const still =
        Math.abs(s.a) < 0.0005 && Math.abs(s.w) < 0.005 && Math.abs(s.b) < 0.0005 && Math.abs(s.v) < 0.005;
      if (still) {
        s.a = s.w = s.b = s.v = 0;
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

  const push = (dw, dv = 0) => {
    const s = st.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    s.w = clamp(s.w + dw, -8, 8);
    s.v = clamp(s.v + dv + dw * 0.25, -8, 8); // a sideways push also gives a little forward motion
    s.kick?.();
  };

  // the King of Spades comes out of the mouth of the bell
  const summon = () => {
    const s = st.current;
    const t = performance.now();
    if (t - s.summonAt < 1200 || !pos) return;
    s.summonAt = t;
    window.dispatchEvent(
      new CustomEvent("open-king-card", { detail: { x: pos.left + HX * S, y: pos.top + 126 * S } })
    );
  };

  const onMove = (e) => {
    const s = st.current;
    const now = performance.now();
    const dx = e.movementX ?? e.clientX - (s.lx ?? e.clientX);
    const dy = e.movementY ?? e.clientY - (s.ly ?? e.clientY);
    const dt = Math.max(4, now - (s.lt ?? now - 16));
    s.lx = e.clientX;
    s.ly = e.clientY;
    s.lt = now;

    // moving right pushes the bell right; moving up / down pushes it back / forward
    push(clamp(-dx * 0.05, -0.9, 0.9), clamp(dy * 0.04, -0.7, 0.7));

    // sound follows the speed of your cursor over the bell
    const speed = Math.hypot(dx, dy) / dt; // px per ms
    if (speed > 0.06) {
      const v = clamp(speed / SPEED_FULL, 0, 1);
      // faster = higher note and fuller sound, and the rings come a little quicker
      const rang = tryRing(0.3 + 0.7 * v, 230 - 130 * v);
      // wave it hard: 5 strong rings within about a second brings out the card
      if (rang && v >= 0.6) {
        s.hits = s.hits.filter((h) => now - h < 1100);
        s.hits.push(now);
        if (s.hits.length >= 5) {
          s.hits = [];
          summon();
        }
      }
    }
  };
  const onLeave = () => {
    const s = st.current;
    s.lx = null;
    s.ly = null;
    s.lt = null;
  };
  const onDown = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    push(e.clientX > r.left + r.width / 2 ? 3 : -3); // a tap pushes it away from your finger
    unlockAudio();
    tryRing(1, 0); // a tap is the fullest ring
    summon(); // ...and it brings out the card
  };

  const soft = { filter: "drop-shadow(0 4px 3px rgba(0,0,0,.28))" };
  const svgBase = { position: "absolute", left: 0, top: 0, overflow: "visible", ...soft };

  const bell = pos && (
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
          {/* closed ring (eyelet) the bell hangs from */}
          <circle cx="23" cy="23.4" r="4.4" fill="none" stroke="rgba(0,0,0,.32)" strokeWidth="2.6" />
          <circle cx="23" cy="23.4" r="4.4" fill="none" stroke="url(#bf-gold)" strokeWidth="1.7" />
        </svg>

        {/* ---- swinging: ring, beads, cord, bell (pivots in the eyelet) ---- */}
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
              <linearGradient id="bl-cord" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#8f620a" />
                <stop offset=".5" stopColor="#ffd75a" />
                <stop offset="1" stopColor="#8f620a" />
              </linearGradient>
              <radialGradient id="bl-goldball" cx=".35" cy=".3" r=".78">
                <stop offset="0" stopColor="#fff6c8" />
                <stop offset=".35" stopColor="#f0c94e" />
                <stop offset=".75" stopColor="#b8862b" />
                <stop offset="1" stopColor="#6e4a0c" />
              </radialGradient>
              <radialGradient id="bl-yel" cx=".35" cy=".3" r=".78">
                <stop offset="0" stopColor="#fffbe0" />
                <stop offset=".35" stopColor="#ffd84a" />
                <stop offset=".75" stopColor="#e0a512" />
                <stop offset="1" stopColor="#8d5f05" />
              </radialGradient>
              <radialGradient id="bl-wood" cx=".35" cy=".3" r=".78">
                <stop offset="0" stopColor="#f5cf9c" />
                <stop offset=".4" stopColor="#d79a5a" />
                <stop offset=".8" stopColor="#9a5f2a" />
                <stop offset="1" stopColor="#5a3414" />
              </radialGradient>
              <linearGradient id="bl-ceramic" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#b9c7d1" />
                <stop offset=".25" stopColor="#eef3f6" />
                <stop offset=".45" stopColor="#ffffff" />
                <stop offset=".7" stopColor="#e1e9ee" />
                <stop offset="1" stopColor="#a7b6c1" />
              </linearGradient>
              <linearGradient id="bl-blue" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#123760" />
                <stop offset=".45" stopColor="#4d8fd6" />
                <stop offset="1" stopColor="#123760" />
              </linearGradient>
              {/* round look: dark edges, bright stripe left of centre */}
              <linearGradient id="bl-round" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="rgba(10,30,60,.40)" />
                <stop offset=".22" stopColor="rgba(10,30,60,.08)" />
                <stop offset=".4" stopColor="rgba(255,255,255,.55)" />
                <stop offset=".52" stopColor="rgba(255,255,255,0)" />
                <stop offset=".76" stopColor="rgba(10,30,60,.12)" />
                <stop offset="1" stopColor="rgba(10,30,60,.46)" />
              </linearGradient>
              <linearGradient id="bl-depth" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="rgba(255,255,255,.18)" />
                <stop offset="1" stopColor="rgba(40,70,100,.2)" />
              </linearGradient>
              <pattern id="bl-floral" width="7" height="8" patternUnits="userSpaceOnUse" x="9">
                <circle cx="3.5" cy="4" r="1.15" fill="#e8b923" />
                <circle cx="3.5" cy="4" r=".45" fill="#b3560c" />
                <ellipse cx="1.4" cy="4.6" rx="1.2" ry=".55" fill="#4f8a2a" transform="rotate(-25 1.4 4.6)" />
                <ellipse cx="5.6" cy="4.6" rx="1.2" ry=".55" fill="#4f8a2a" transform="rotate(25 5.6 4.6)" />
                <circle cx="0" cy="2" r=".5" fill="#2f6fb5" />
                <circle cx="7" cy="2" r=".5" fill="#2f6fb5" />
              </pattern>
              <filter id="bl-blur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation=".45" />
              </filter>
              <clipPath id="bl-clip">
                <path d={BELL_D} />
              </clipPath>
            </defs>

            {/* ring linked through the eyelet */}
            <ellipse cx={HX} cy="31.6" rx="2.5" ry="5.7" fill="none" stroke="rgba(0,0,0,.32)" strokeWidth="2.4" />
            <ellipse cx={HX} cy="31.6" rx="2.5" ry="5.7" fill="none" stroke="url(#bl-gold)" strokeWidth="1.6" />

            {/* cord pieces */}
            <rect x="22.25" y="37" width="1.5" height="5" fill="url(#bl-cord)" />
            <rect x="22.25" y="47" width="1.5" height="5.5" fill="url(#bl-cord)" />
            <rect x="22.25" y="60" width="1.5" height="5" fill="url(#bl-cord)" />
            <rect x="22.25" y="91" width="1.5" height="4.5" fill="url(#bl-cord)" />

            {/* beads */}
            <Sphere cx={HX} cy="44.5" r="3.1" fill="bl-goldball" />
            <Sphere cx={HX} cy="56.6" r="4.4" fill="bl-wood" />
            {[0, 1, 2, 3, 4].map((k) => (
              <Sphere key={k} cx={HX + (k % 2 ? 0.6 : -0.6)} cy={67.6 + k * 5.4} r="3.1" fill="bl-yel" />
            ))}

            {/* clapper (peeks out under the lip) */}
            <Sphere cx={HX} cy="128.4" r="2.6" fill="bl-wood" />

            {/* ceramic bell */}
            <path d={BELL_D} fill="url(#bl-ceramic)" />
            <g clipPath="url(#bl-clip)">
              {/* floral band */}
              <rect x="8" y="110.8" width="30" height=".8" fill="#d9a933" />
              <rect x="8" y="111.8" width="30" height="8" fill="url(#bl-floral)" />
              <rect x="8" y="119.9" width="30" height=".8" fill="#d9a933" />
              {/* blue rim */}
              <path d={RIM_D} fill="url(#bl-blue)" />
              {/* soft shading for depth and the round, lit look */}
              <rect x="8" y="96" width="30" height="36" fill="url(#bl-depth)" />
              <rect x="8" y="96" width="30" height="36" fill="url(#bl-round)" />
              {/* glossy streak */}
              <path
                d="M19 101 C17 108 15 113 13.4 119"
                stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none" opacity=".75" filter="url(#bl-blur)"
              />
            </g>
            <path d={BELL_D} fill="none" stroke="rgba(20,40,70,.45)" strokeWidth=".6" strokeLinejoin="round" />

            {/* gold cap on top of the bell */}
            <rect x="21" y="94.4" width="4" height="5.4" rx=".8" fill="url(#bl-gold)" stroke="rgba(60,35,0,.5)" strokeWidth=".4" />
            <ellipse cx={HX} cy="94.4" rx="2" ry=".7" fill="#fff0a8" stroke="rgba(60,35,0,.4)" strokeWidth=".3" />
          </svg>

          {/* touch area for the cord and bell (swings with it) */}
          <div
            onPointerMove={onMove}
            onPointerLeave={onLeave}
            onPointerDown={onDown}
            style={{ position: "absolute", left: 8, top: 33, width: 30, height: 100, pointerEvents: "auto", cursor: "pointer" }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* keeps the space in the navbar; the bell itself lives in its own top layer */}
      <div ref={slotRef} className="ml-2 h-7 w-[34px] shrink-0" aria-hidden="true" />
      {bell && createPortal(bell, document.body)}
      {/* the King of Spades overlay (listens for the bell) */}
      <KingCard />
    </>
  );
}