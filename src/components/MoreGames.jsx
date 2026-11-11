import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";

/* shared look */
const PANEL = {
  background: "linear-gradient(160deg, rgba(48,42,32,.92), rgba(16,13,9,.96))",
  boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4)",
};
const FRAME = {
  background: "linear-gradient(145deg,#3a3126,#14100c)",
  boxShadow: "0 0 0 1.5px rgba(240,203,98,.7), 0 26px 50px rgba(0,0,0,.55)",
};
let UID = 1;
const nid = () => UID++;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const shuffle = (a) => {
  const d = a.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
};
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* =====================================================================
   HIGHER OR LOWER
   ===================================================================== */
const HL_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const HL_SUITS = ["♠", "♥", "♦", "♣"];
const hlVal = (r) => HL_RANKS.indexOf(r);
const hlDeck = () => shuffle(HL_SUITS.flatMap((s) => HL_RANKS.map((r) => ({ id: nid(), rank: r, suit: s }))));

export function HigherLower({ ui, cfg, T, onWin, onExit, again }) {
  const { Flip, PlayingFace, Pill, goldText, GOLD, useWidth, num, sleep, STOP } = ui;
  const target = num(cfg.target, 5, 2, 30);
  const maxLives = num(cfg.lives, 2, 1, 9);
  const hint = !!cfg.hint;

  const [init] = useState(() => {
    const d = hlDeck();
    return { trail: [d.pop(), d.pop()], deck: d };
  });
  const deck = useRef(init.deck);
  const [trail, setTrail] = useState(init.trail);
  const [cur, setCur] = useState(0); // index of the card on the table
  const [shown, setShown] = useState(false); // is the next card face up?
  const [phase, setPhase] = useState("ask"); // ask | busy | won | lost
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(maxLives);
  const [msg, setMsg] = useState({ t: "", k: "" });
  const [glow, setGlow] = useState(null);
  const token = useRef(0);
  const boxRef = useRef(null);
  const boxW = useWidth(boxRef, 340);
  useEffect(() => () => { token.current += 1; }, []);

  const cw = Math.round(clamp(boxW * 0.27, 62, 104));
  const ch = Math.round(cw * 1.42);
  const STEP = Math.round(cw * 1.22);
  const centre = (boxW - 16) / 2;

  const draw = () => {
    if (!deck.current.length) deck.current = hlDeck();
    return deck.current.pop();
  };

  const guess = async (dir) => {
    if (phase !== "ask") return;
    const my = token.current;
    const nap = async (ms) => {
      await sleep(ms);
      if (token.current !== my) throw STOP;
    };
    const a = hlVal(trail[cur].rank);
    const b = hlVal(trail[cur + 1].rank);
    const out = a === b ? "tie" : b > a === (dir === "higher") ? "ok" : "bad";
    const advance = () => {
      const nc = draw();
      setGlow(null);
      setMsg({ t: "", k: "" });
      setShown(false);
      setCur((c) => c + 1);
      setTrail((t) => [...t, nc]);
      setPhase("ask");
    };
    try {
      setPhase("busy");
      setMsg({ t: "", k: "" });
      await nap(120);
      setShown(true);
      await nap(950);
      setGlow({ i: cur + 1, k: out });
      if (out === "tie") {
        setMsg({ t: T.sameRank, k: "tie" });
        await nap(1000);
        advance();
        return;
      }
      if (out === "ok") {
        const s = streak + 1;
        setStreak(s);
        setMsg({ t: T.correct, k: "ok" });
        if (s >= target) {
          setPhase("won");
          await nap(1100);
          onWin();
          return;
        }
        await nap(800);
        advance();
        return;
      }
      const l = lives - 1;
      setLives(l);
      setStreak(0);
      setMsg({ t: T.wrong, k: "bad" });
      if (l <= 0) {
        setPhase("lost");
        return;
      }
      await nap(1000);
      advance();
    } catch (e) {
      if (e !== STOP) console.error(e);
    }
  };

  // odds for the easy level
  const a0 = hlVal(trail[cur].rank);
  const unseen = deck.current.concat(trail[cur + 1] ? [trail[cur + 1]] : []);
  const pct = (f) => (unseen.length ? Math.round((unseen.filter(f).length / unseen.length) * 100) : 0);
  const hi = pct((c) => hlVal(c.rank) > a0);
  const lo = pct((c) => hlVal(c.rank) < a0);
  const canGuess = phase === "ask";

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-4 rounded-2xl px-4 py-2.5" style={PANEL}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#c9972f" }}>
            <span>{T.streak}</span>
            <b className="text-[#efe8d6]">{streak}/{target}</b>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,.5)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.25)" }}>
            <motion.div
              initial={false}
              animate={{ width: `${(streak / target) * 100}%` }}
              transition={{ type: "spring", stiffness: 90, damping: 16 }}
              style={{ height: "100%", background: GOLD }}
            />
          </div>
        </div>
        <div className="flex gap-1" aria-label={T.livesWord}>
          {Array.from({ length: maxLives }).map((_, i) => (
            <span
              key={i}
              style={{ fontSize: 20, color: i < lives ? "#f0cb62" : "rgba(240,203,98,.2)", textShadow: i < lives ? "0 0 8px rgba(240,203,98,.8)" : "none" }}
            >
              ♠
            </span>
          ))}
        </div>
      </div>

      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-[28px] px-2 pb-4 pt-5"
        style={{
          background: "radial-gradient(ellipse at 50% 35%, #174232 0%, #0d241b 58%, #07120d 100%)",
          boxShadow: "0 0 0 1.5px rgba(240,203,98,.7), inset 0 0 0 5px rgba(7,18,13,.9), inset 0 0 0 6px rgba(240,203,98,.3), 0 24px 50px rgba(0,0,0,.55)",
        }}
      >
        <div style={{ perspective: 1100 }}>
          <div style={{ position: "relative", height: ch + 46, transformStyle: "preserve-3d" }}>
            <motion.div
              style={{ position: "absolute", left: 0, top: 24, transformStyle: "preserve-3d" }}
              initial={false}
              animate={{ x: centre - cw / 2 - cur * STEP }}
              transition={{ type: "spring", stiffness: 110, damping: 18 }}
            >
              {trail.map((c, i) => {
                const d = i - cur;
                if (d < -3 || d > 1) return null;
                const isUp = d <= 0 || (d === 1 && shown);
                const st =
                  d === 0
                    ? { opacity: 1, scale: 1.1, y: -8, rotateY: 0, z: 50 }
                    : d > 0
                    ? { opacity: 1, scale: 0.94, y: 8, rotateY: -12, z: 0 }
                    : { opacity: Math.max(0.12, 0.62 - (-d - 1) * 0.22), scale: 0.84 - (-d - 1) * 0.05, y: 14, rotateY: 14, z: -20 };
                const g = glow && glow.i === i ? glow.k : null;
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: -50, scale: 0.7, rotateY: -30 }}
                    animate={st}
                    transition={{ type: "spring", stiffness: 130, damping: 17 }}
                    style={{ position: "absolute", left: i * STEP, top: 0, width: cw, height: ch, transformStyle: "preserve-3d" }}
                  >
                    <motion.div
                      animate={g === "bad" ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }}
                      transition={{ duration: 0.45 }}
                      style={{
                        width: "100%", height: "100%", borderRadius: cw * 0.09,
                        boxShadow:
                          g === "ok" ? "0 0 0 2px #f0cb62, 0 0 34px rgba(240,203,98,.9)"
                          : g === "bad" ? "0 0 0 2px #e5484d, 0 0 30px rgba(229,72,77,.8)"
                          : g === "tie" ? "0 0 0 2px #9ab4c8" : undefined,
                      }}
                    >
                      <Flip up={isUp} w={cw} h={ch} r={cw * 0.09} front={<PlayingFace rank={c.rank} suit={c.suit} w={cw} />} />
                    </motion.div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>

        <div className="flex h-8 items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={msg.t || "ask"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="font-serif text-lg font-bold"
              style={msg.k === "bad" ? { color: "#ff8a8a" } : msg.k === "tie" ? { color: "#bcd" } : goldText}
            >
              {msg.t || (phase === "lost" ? T.wrong : phase === "won" ? T.youWin : T.hlAsk)}
            </motion.p>
          </AnimatePresence>
        </div>
        <p className="text-center text-[10.5px] opacity-60">{T.aceHigh}</p>
      </div>

      {phase === "lost" ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Pill gold onClick={again}>{T.tryAgain}</Pill>
          <Pill onClick={onExit}>{T.changeLevel}</Pill>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <motion.button
            type="button" disabled={!canGuess} onClick={() => guess("higher")}
            whileHover={canGuess ? { y: -4, scale: 1.03 } : undefined} whileTap={canGuess ? { scale: 0.96 } : undefined}
            className="rounded-2xl py-3.5 font-serif text-lg font-bold"
            style={{ background: GOLD, color: "#3b2506", boxShadow: "0 10px 24px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.7)", opacity: canGuess ? 1 : 0.5 }}
          >
            ▲ {T.higher}
            {hint && <small className="ml-1.5 font-sans text-[11px] font-semibold opacity-70">{hi}%</small>}
          </motion.button>
          <motion.button
            type="button" disabled={!canGuess} onClick={() => guess("lower")}
            whileHover={canGuess ? { y: -4, scale: 1.03 } : undefined} whileTap={canGuess ? { scale: 0.96 } : undefined}
            className="rounded-2xl py-3.5 font-serif text-lg font-bold text-[#efe8d6]"
            style={{ ...PANEL, boxShadow: "inset 0 0 0 1px rgba(240,203,98,.55), 0 10px 24px rgba(0,0,0,.45)", opacity: canGuess ? 1 : 0.5 }}
          >
            ▼ {T.lower}
            {hint && <small className="ml-1.5 font-sans text-[11px] font-semibold opacity-60">{lo}%</small>}
          </motion.button>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   WATER SORT
   ===================================================================== */
const WS_COLORS = ["#ff3b5c", "#ffb020", "#3bd16f", "#2f8bff", "#a64dff", "#18d3d1", "#ff6a2a", "#f06fd6", "#b8e12a", "#ffe14a"];
const wsLay = (i) => {
  const c = WS_COLORS[i];
  return `linear-gradient(90deg, color-mix(in srgb, ${c} 66%, black), ${c} 28%, color-mix(in srgb, ${c} 68%, white) 52%, ${c} 74%, color-mix(in srgb, ${c} 64%, black))`;
};
const wsRun = (t) => {
  let n = 0;
  for (let i = t.length - 1; i >= 0 && t[i].c === t[t.length - 1].c; i--) n++;
  return n;
};
const wsCan = (tubes, a, b, cap) => {
  if (a === b) return false;
  const A = tubes[a], B = tubes[b];
  if (!A.length || B.length >= cap) return false;
  if (B.length && B[B.length - 1].c !== A[A.length - 1].c) return false;
  return true;
};
const wsUnits = (tubes, a, b, cap) => Math.min(wsRun(tubes[a]), cap - tubes[b].length);
const wsApply = (tubes, a, b, cap) => {
  const n = wsUnits(tubes, a, b, cap);
  const nt = tubes.map((t) => t.slice());
  const moved = nt[a].splice(nt[a].length - n, n);
  nt[b].push(...moved);
  return nt;
};
const wsUniformFull = (t, cap) => t.length === cap && t.every((u) => u.c === t[0].c);
const wsSolved = (tubes, cap) => tubes.every((t) => t.length === 0 || wsUniformFull(t, cap));

function wsSolvable(start, cap, limit = 25000) {
  const seen = new Set();
  let nodes = 0;
  const key = (t) => t.map((x) => x.map((u) => u.c).join("")).sort().join("|");
  const dfs = (t, depth) => {
    if (wsSolved(t, cap)) return true;
    if (depth > 90 || ++nodes > limit) return false;
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    for (let a = 0; a < t.length; a++) {
      for (let b = 0; b < t.length; b++) {
        if (!wsCan(t, a, b, cap)) continue;
        const A = t[a];
        if (!t[b].length && A.every((u) => u.c === A[0].c)) continue; // a pure stack into an empty tube changes nothing
        if (dfs(wsApply(t, a, b, cap), depth + 1)) return true;
      }
    }
    return false;
  };
  return dfs(start, 0);
}

function wsGenerate(nc, ne, cap) {
  let best = null;
  for (let attempt = 0; attempt < 14; attempt++) {
    const units = shuffle(Array.from({ length: nc * cap }, (_, i) => ({ id: nid(), c: Math.floor(i / cap) })));
    const tubes = Array.from({ length: nc + ne }, (_, i) => (i < nc ? units.slice(i * cap, (i + 1) * cap) : []));
    best = tubes;
    if (tubes.some((t) => wsUniformFull(t, cap))) continue;
    if (wsSolvable(tubes, cap)) return tubes;
  }
  return best;
}

function WTube({ id, layers, w, h, LH, sel, done, onTap, reg, elRef }) {
  const ctl = useAnimation();
  useEffect(() => { reg(id, ctl); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rim = 12;
  return (
    <motion.div
      ref={elRef} animate={ctl} initial={{ x: 0, y: 0, rotate: 0 }}
      onClick={() => onTap(id)}
      style={{ position: "relative", width: w, height: h + rim, cursor: "pointer" }}
    >
      <motion.div
        animate={{ y: sel ? -16 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}
        style={{ position: "absolute", inset: 0 }}
      >
        <div style={{ position: "absolute", left: w * 0.1, right: w * 0.1, bottom: -6, height: 10, borderRadius: "50%", background: "rgba(0,0,0,.45)", filter: "blur(5px)" }} />
        {/* glass body */}
        <div
          style={{
            position: "absolute", left: 0, right: 0, top: rim, bottom: 0, overflow: "hidden",
            borderRadius: `${w * 0.14}px ${w * 0.14}px ${w / 2}px ${w / 2}px`,
            background: "linear-gradient(90deg, rgba(255,255,255,.14), rgba(255,255,255,.04) 38%, rgba(255,255,255,.04) 62%, rgba(255,255,255,.16))",
            boxShadow: `inset 0 0 0 1.5px rgba(190,240,240,.6), inset 0 -10px 14px rgba(0,0,0,.28)${sel ? ", 0 0 26px rgba(240,203,98,.7)" : ""}${done ? ", 0 0 26px rgba(240,203,98,.9)" : ""}`,
          }}
        >
          <div style={{ position: "absolute", left: 3, right: 3, bottom: 3, display: "flex", flexDirection: "column-reverse" }}>
            <AnimatePresence initial={false}>
              {layers.map((u) => (
                <motion.div
                  key={u.id}
                  initial={{ height: 0 }} animate={{ height: LH }} exit={{ height: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  style={{ background: wsLay(u.c), flexShrink: 0, boxShadow: "inset 0 2px 0 rgba(255,255,255,.32), inset 0 -2px 0 rgba(0,0,0,.18)" }}
                />
              ))}
            </AnimatePresence>
          </div>
          <div style={{ position: "absolute", left: w * 0.16, top: "6%", bottom: "14%", width: Math.max(3, w * 0.1), borderRadius: 99, background: "linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,0))" }} />
        </div>
        {/* gold rim */}
        <div
          style={{
            position: "absolute", left: -3, right: -3, top: rim - 7, height: 13, borderRadius: "50%",
            border: "2px solid rgba(240,203,98,.9)", boxShadow: "0 2px 4px rgba(0,0,0,.35)",
            background: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,.25), rgba(255,255,255,.05))",
          }}
        />
      </motion.div>
    </motion.div>
  );
}

export function WaterSort({ ui, cfg, T, onWin, onExit, again }) {
  const { Pill, goldText, GOLD, useWidth, num, sleep, STOP } = ui;
  const nc = num(cfg.colors, 5, 2, 10);
  const ne = num(cfg.empty, 2, 1, 4);
  const cap = 4;
  const [init] = useState(() => wsGenerate(nc, ne, cap));
  const start = useRef(init);
  const [tubes, setTubes] = useState(init);
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState(0);
  const [hist, setHist] = useState([]);
  const [stream, setStream] = useState(null);
  const [won, setWon] = useState(false);
  const els = useRef([]);
  const ctls = useRef([]);
  const boardRef = useRef(null);
  const boxRef = useRef(null);
  const token = useRef(0);
  const boxW = useWidth(boxRef, 340);
  useEffect(() => () => { token.current += 1; }, []);

  const n = tubes.length;
  const perRow = n <= 6 ? n : Math.ceil(n / 2);
  const gap = 14;
  const w = clamp(Math.floor((boxW - gap * (perRow - 1)) / perRow), 30, 54);
  const LH = Math.round(w * 0.66);
  const h = cap * LH + 10;
  const idx = Array.from({ length: n }, (_, i) => i);
  const rowsArr = n <= 6 ? [idx] : [idx.slice(0, perRow), idx.slice(perRow)];

  const pour = async (a, b) => {
    const my = token.current;
    const nap = async (ms) => {
      await sleep(ms);
      if (token.current !== my) throw STOP;
    };
    setBusy(true);
    setSel(null);
    try {
      setHist((hh) => [...hh, tubes]);
      const units = wsUnits(tubes, a, b, cap);
      const color = tubes[a][tubes[a].length - 1].c;
      const next = wsApply(tubes, a, b, cap);
      const ra = els.current[a].getBoundingClientRect();
      const rb = els.current[b].getBoundingClientRect();
      const bd = boardRef.current.getBoundingClientRect();
      const s = rb.left > ra.left ? 1 : -1;
      const th = (62 * Math.PI) / 180;
      const half = ra.height / 2;
      const mx = s * half * Math.sin(th);
      const my2 = -half * Math.cos(th);
      const tx = rb.left + rb.width / 2 - s * w * 0.12;
      const ty = rb.top - 2;
      const dx = tx - mx - (ra.left + ra.width / 2);
      const dy = ty - my2 - (ra.top + ra.height / 2);
      const ca = ctls.current[a];
      ca.set({ zIndex: 30 });
      await ca.start({ x: dx, y: dy, rotate: s * 62, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } });
      const surface = rb.bottom - ((tubes[b].length + units) * LH + 3);
      setStream({ k: Date.now(), x: tx - bd.left, y: ty - bd.top, h: Math.max(16, surface - ty), c: color });
      ca.start({ rotate: s * 74, transition: { duration: 0.5 } });
      await nap(160);
      setTubes(next);
      setMoves((m) => m + 1);
      await nap(380 + units * 110);
      setStream(null);
      await nap(120);
      await ca.start({ x: 0, y: 0, rotate: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } });
      ca.set({ zIndex: 1 });
      setBusy(false);
      if (wsSolved(next, cap)) {
        setWon(true);
        await nap(1100);
        onWin();
      }
    } catch (e) {
      if (e !== STOP) console.error(e);
    }
  };

  const tap = (i) => {
    if (busy || won) return;
    if (sel === null) {
      if (tubes[i].length) setSel(i);
      return;
    }
    if (sel === i) { setSel(null); return; }
    if (wsCan(tubes, sel, i, cap)) { pour(sel, i); return; }
    ctls.current[sel]?.start({ rotate: [0, -5, 5, -3, 3, 0], transition: { duration: 0.4 } });
    setSel(tubes[i].length ? i : null);
  };

  const undo = () => {
    if (busy || won || !hist.length) return;
    setTubes(hist[hist.length - 1]);
    setHist((hh) => hh.slice(0, -1));
    setMoves((m) => Math.max(0, m - 1));
    setSel(null);
  };
  const restart = () => {
    if (busy || won) return;
    setTubes(start.current);
    setHist([]);
    setMoves(0);
    setSel(null);
  };

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.2em]">
        <span style={{ color: "#c9972f" }}>{T.moves} <b className="ml-1 text-[#efe8d6]">{moves}</b></span>
        <span className="font-serif text-base font-bold normal-case tracking-normal" style={goldText}>{won ? T.youWin : ""}</span>
      </div>

      <div ref={boxRef} className="w-full" style={{ perspective: 900 }}>
        <motion.div
          initial={{ opacity: 0, y: 24, rotateX: 24 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 16 }}
          className="rounded-[28px] px-3 pb-6 pt-8"
          style={{ background: "radial-gradient(ellipse at 50% 20%, #241d12 0%, #0f0c08 70%)", boxShadow: "0 0 0 1.5px rgba(240,203,98,.6), 0 24px 50px rgba(0,0,0,.55)" }}
        >
          <div ref={boardRef} style={{ position: "relative" }}>
            {rowsArr.map((row, ri) => (
              <div key={ri} style={{ display: "flex", justifyContent: "center", gap, marginTop: ri ? 30 : 0 }}>
                {row.map((i) => (
                  <WTube
                    key={i} id={i} layers={tubes[i]} w={w} h={h} LH={LH}
                    sel={sel === i} done={wsUniformFull(tubes[i], cap)} onTap={tap}
                    reg={(k, c) => { ctls.current[k] = c; }}
                    elRef={(el) => { els.current[i] = el; }}
                  />
                ))}
              </div>
            ))}
            <AnimatePresence>
              {stream && (
                <motion.div
                  key={stream.k}
                  initial={{ scaleY: 0, opacity: 0.9 }} animate={{ scaleY: 1, opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    position: "absolute", left: stream.x - 3, top: stream.y, width: 6, height: stream.h,
                    transformOrigin: "top", borderRadius: 3, background: wsLay(stream.c),
                    boxShadow: `0 0 12px ${WS_COLORS[stream.c]}`, zIndex: 40, pointerEvents: "none",
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <p className="mt-3 text-center text-[11px] opacity-65">{T.waterHint}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Pill onClick={undo} disabled={busy || won || !hist.length}>↶ {T.undo}</Pill>
        <Pill onClick={restart} disabled={busy || won}>{T.restart}</Pill>
        <Pill gold onClick={again}>{T.reshuffle}</Pill>
      </div>
    </div>
  );
}

/* =====================================================================
   SNAKE (canvas, smooth gliding)
   ===================================================================== */
export function SnakeGame({ ui, cfg, T, onWin, onExit, again }) {
  const { Pill, GOLD, goldText, num } = ui;
  const cols = num(cfg.cols, 10, 6, 20);
  const rows = num(cfg.rows, 10, 6, 20);
  const baseMs = num(cfg.speed, 200, 60, 500);
  const target = num(cfg.target, 8, 3, 60);
  const wrap = !!cfg.wrap;
  const rockN = num(cfg.rocks, 0, 0, 30);
  const CELL = 44;
  const cvRef = useRef(null);
  const apiRef = useRef({});
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [res, setRes] = useState(null);
  const touch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return undefined;
    const ctx = cv.getContext("2d");
    const W = cols * CELL;
    const H = rows * CELL;
    const rnd = (k) => Math.floor(Math.random() * k);
    const lerp = (a, b, t) => a + (b - a) * t;
    let alive = true, running = false, over = false, raf = 0, last = 0, flash = 0, flashCol = "214,64,58";
    let coins = 0, tickMs = baseMs;
    const hx = Math.floor(cols / 2), hy = Math.floor(rows / 2);
    let snake = [{ x: hx, y: hy }, { x: hx - 1, y: hy }, { x: hx - 2, y: hy }];
    let prev = snake.map((s) => ({ ...s }));
    let dir = { x: 1, y: 0 };
    const queue = [];
    const parts = [];
    const rocks = [];
    let guard = 0;
    while (rocks.length < rockN && guard++ < 500) {
      const x = rnd(cols), y = rnd(rows);
      const nearStart = Math.abs(y - hy) <= 1 && x >= hx - 3 && x <= hx + 5;
      if (nearStart || rocks.some((r) => r.x === x && r.y === y)) continue;
      rocks.push({ x, y });
    }
    const free = (x, y) => !snake.some((s) => s.x === x && s.y === y) && !rocks.some((r) => r.x === x && r.y === y);
    const spawn = () => {
      let c, g = 0;
      do { c = { x: rnd(cols), y: rnd(rows) }; } while (!free(c.x, c.y) && g++ < 800);
      return c;
    };
    let coin = spawn();

    /* the static board, drawn once */
    const bg = document.createElement("canvas");
    bg.width = W; bg.height = H;
    const b = bg.getContext("2d");
    const grad = b.createRadialGradient(W / 2, H * 0.4, W * 0.1, W / 2, H / 2, W * 0.75);
    grad.addColorStop(0, "#221d12"); grad.addColorStop(1, "#0a0806");
    b.fillStyle = grad; b.fillRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if ((x + y) % 2 === 0) { b.fillStyle = "rgba(240,203,98,.05)"; b.fillRect(x * CELL, y * CELL, CELL, CELL); }
    }
    b.strokeStyle = "rgba(240,203,98,.06)"; b.lineWidth = 1;
    for (let x = 0; x <= cols; x++) { b.beginPath(); b.moveTo(x * CELL, 0); b.lineTo(x * CELL, H); b.stroke(); }
    for (let y = 0; y <= rows; y++) { b.beginPath(); b.moveTo(0, y * CELL); b.lineTo(W, y * CELL); b.stroke(); }
    b.lineWidth = 4;
    if (wrap) b.setLineDash([8, 10]);
    b.strokeStyle = wrap ? "rgba(240,203,98,.4)" : "rgba(240,203,98,.8)";
    b.strokeRect(2, 2, W - 4, H - 4);
    b.setLineDash([]);
    rocks.forEach((r) => {
      const x = r.x * CELL, y = r.y * CELL;
      b.save();
      b.shadowColor = "rgba(0,0,0,.6)"; b.shadowBlur = 8; b.shadowOffsetY = 4;
      const g = b.createLinearGradient(x, y, x + CELL, y + CELL);
      g.addColorStop(0, "#7a6d58"); g.addColorStop(1, "#2b241a");
      b.fillStyle = g;
      rrect(b, x + 5, y + 5, CELL - 10, CELL - 10, 11);
      b.fill();
      b.restore();
      b.fillStyle = "rgba(255,255,255,.2)";
      b.beginPath(); b.ellipse(x + CELL * 0.38, y + CELL * 0.34, CELL * 0.15, CELL * 0.09, -0.5, 0, Math.PI * 2); b.fill();
    });

    const burst = (x, y) => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
        const sp = 1.5 + Math.random() * 2.6;
        parts.push({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
      }
    };

    const finish = (won) => {
      over = true; running = false;
      flash = 1; flashCol = won ? "240,203,98" : "214,64,58";
      setRes(won ? "win" : "lose");
      if (won) setTimeout(() => { if (alive) onWin(); }, 1300);
    };

    const step = () => {
      if (queue.length) dir = queue.shift();
      let nx = snake[0].x + dir.x, ny = snake[0].y + dir.y;
      if (wrap) { nx = (nx + cols) % cols; ny = (ny + rows) % rows; }
      else if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) { finish(false); return; }
      const eat = nx === coin.x && ny === coin.y;
      const body = eat ? snake : snake.slice(0, -1);
      if (body.some((s) => s.x === nx && s.y === ny) || rocks.some((r) => r.x === nx && r.y === ny)) { finish(false); return; }
      prev = snake.map((s) => ({ ...s }));
      snake = [{ x: nx, y: ny }, ...snake];
      if (!eat) snake.pop();
      else {
        coins++;
        setScore(coins);
        burst(nx, ny);
        if (coins >= target) { finish(true); return; }
        coin = spawn();
        tickMs = Math.max(60, baseMs * Math.pow(0.985, coins));
      }
    };

    const startRun = () => {
      if (running || over) return;
      running = true;
      last = performance.now();
      setStarted(true);
    };
    const turn = (dx, dy) => {
      if (over) return;
      const ref = queue.length ? queue[queue.length - 1] : dir;
      if (dx === -ref.x && dy === -ref.y) return; // no U-turns
      if (dx === ref.x && dy === ref.y) { startRun(); return; }
      if (queue.length < 2) queue.push({ x: dx, y: dy });
      startRun();
    };
    apiRef.current.turn = turn;

    const keyMap = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
    const onKey = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const m = keyMap[k];
      if (!m) return;
      e.preventDefault();
      turn(m[0], m[1]);
    };
    window.addEventListener("keydown", onKey);

    const drawCoin = (now) => {
      const cx = (coin.x + 0.5) * CELL, cy = (coin.y + 0.5) * CELL + Math.sin(now / 260) * 2;
      const wv = Math.abs(Math.cos(now / 380));
      const r = CELL * 0.3;
      ctx.save();
      ctx.shadowColor = "rgba(255,210,90,.9)"; ctx.shadowBlur = 14;
      const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      g.addColorStop(0, "#fff3bf"); g.addColorStop(0.5, "#f0cb62"); g.addColorStop(1, "#b8862b");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(2.5, r * wv), r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(120,80,10,.7)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1.5, r * 0.62 * wv), r * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };

    const draw = (now) => {
      const t = running ? Math.min(1, (now - last) / tickMs) : 1;
      ctx.drawImage(bg, 0, 0);
      drawCoin(now);
      const pts = snake.map((s, i) => {
        const p = prev[Math.min(i, prev.length - 1)];
        const jump = Math.abs(s.x - p.x) > 1.5 || Math.abs(s.y - p.y) > 1.5;
        const x = jump ? s.x : lerp(p.x, s.x, t);
        const y = jump ? s.y : lerp(p.y, s.y, t);
        return { x: (x + 0.5) * CELL, y: (y + 0.5) * CELL };
      });
      const tube = (lw, style, ox = 0, oy = 0) => {
        ctx.lineWidth = lw; ctx.strokeStyle = style; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        pts.forEach((p, i) => {
          const brk = i > 0 && (Math.abs(p.x - pts[i - 1].x) > CELL * 1.5 || Math.abs(p.y - pts[i - 1].y) > CELL * 1.5);
          if (i === 0 || brk) ctx.moveTo(p.x + ox, p.y + oy); else ctx.lineTo(p.x + ox, p.y + oy);
        });
        ctx.stroke();
      };
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 7;
      tube(CELL * 0.76, "#0d3a2a");
      ctx.restore();
      tube(CELL * 0.62, "#2fae7d");
      tube(CELL * 0.4, "#4ed19a", -1.5, -2);
      tube(CELL * 0.14, "rgba(255,255,255,.35)", -3, -4);
      ctx.fillStyle = "rgba(0,0,0,.16)";
      for (let i = 2; i < pts.length; i += 2) { ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, CELL * 0.1, 0, Math.PI * 2); ctx.fill(); }
      // head
      const hd = pts[0];
      const hg = ctx.createRadialGradient(hd.x - 5, hd.y - 6, 2, hd.x, hd.y, CELL * 0.46);
      hg.addColorStop(0, "#fff3bf"); hg.addColorStop(0.55, "#f0cb62"); hg.addColorStop(1, "#b8862b");
      ctx.save();
      ctx.shadowColor = "rgba(240,203,98,.7)"; ctx.shadowBlur = 14;
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(hd.x, hd.y, CELL * 0.43, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      const px = -dir.y, py = dir.x;
      if (running && Math.floor(now / 260) % 3 === 0 && !over) {
        ctx.strokeStyle = "#e5484d"; ctx.lineWidth = 2; ctx.lineCap = "round";
        const tx = hd.x + dir.x * CELL * 0.62, ty = hd.y + dir.y * CELL * 0.62;
        ctx.beginPath(); ctx.moveTo(hd.x + dir.x * CELL * 0.42, hd.y + dir.y * CELL * 0.42); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + dir.x * 5 + px * 4, ty + dir.y * 5 + py * 4); ctx.moveTo(tx, ty); ctx.lineTo(tx + dir.x * 5 - px * 4, ty + dir.y * 5 - py * 4); ctx.stroke();
      }
      [-1, 1].forEach((sg) => {
        const ex = hd.x + dir.x * CELL * 0.12 + px * sg * CELL * 0.17;
        const ey = hd.y + dir.y * CELL * 0.12 + py * sg * CELL * 0.17;
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, CELL * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#14100c"; ctx.beginPath(); ctx.arc(ex + dir.x * 2, ey + dir.y * 2, CELL * 0.05, 0, Math.PI * 2); ctx.fill();
      });
      // sparks
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.03;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(246,220,140,${p.life})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 * p.life + 0.5, 0, Math.PI * 2); ctx.fill();
      }
      if (flash > 0.02) {
        ctx.fillStyle = `rgba(${flashCol},${flash * 0.35})`;
        ctx.fillRect(0, 0, W, H);
        flash *= 0.94;
      }
    };

    const loop = (now) => {
      if (!alive) return;
      if (running) {
        if (now - last > tickMs * 3) last = now - tickMs; // tab was hidden: do not skip ahead
        while (running && now - last >= tickMs) { last += tickMs; step(); }
      }
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // swipe on phones
  const sw = useRef(null);
  const onTS = (e) => { const t = e.touches[0]; sw.current = { x: t.clientX, y: t.clientY }; };
  const onTE = (e) => {
    const s = sw.current;
    sw.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) apiRef.current.turn?.(dx > 0 ? 1 : -1, 0);
    else apiRef.current.turn?.(0, dy > 0 ? 1 : -1);
  };

  const pad = (label, dx, dy, cls) => (
    <button
      type="button" onClick={() => apiRef.current.turn?.(dx, dy)} aria-label={label}
      className={`grid h-12 w-12 place-items-center rounded-2xl text-lg ${cls}`}
      style={{ ...PANEL, boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5), 0 6px 14px rgba(0,0,0,.4)", touchAction: "manipulation" }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-3 flex w-full max-w-[420px] items-center gap-4 rounded-2xl px-4 py-2.5" style={PANEL}>
        <div className="flex-1">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#c9972f" }}>
            <span>🪙 {T.coinsWord}</span>
            <b className="text-[#efe8d6]">{score}/{target}</b>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,.5)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.25)" }}>
            <motion.div initial={false} animate={{ width: `${(score / target) * 100}%` }} transition={{ type: "spring", stiffness: 90, damping: 16 }} style={{ height: "100%", background: GOLD }} />
          </div>
        </div>
      </div>

      <div style={{ perspective: 1100 }}>
        <motion.div
          initial={{ rotateX: 36, opacity: 0, y: 24 }}
          animate={res === "lose" ? { rotateX: 10, opacity: 1, y: 0, x: [0, -10, 10, -8, 8, 0] } : { rotateX: 10, opacity: 1, y: 0, x: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 16 }}
          style={{ ...FRAME, position: "relative", width: "min(92vw, 420px)", padding: 8, borderRadius: 20 }}
        >
          <div
            style={{ position: "relative", borderRadius: 12, overflow: "hidden", touchAction: "none" }}
            onTouchStart={onTS} onTouchEnd={onTE}
          >
            <canvas ref={cvRef} width={cols * CELL} height={rows * CELL} style={{ width: "100%", display: "block" }} />
            <AnimatePresence>
              {!started && !res && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4"
                >
                  <motion.p
                    animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}
                    className="rounded-full px-4 py-2 text-center text-[12px] font-semibold"
                    style={{ background: "rgba(10,8,5,.78)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5)" }}
                  >
                    {T.snakeStart}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <p className="mt-3 text-center text-[11px] opacity-65">{wrap ? T.wrapHint : T.wallHint}</p>

      {touch && !res && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <span />{pad("▲", 0, -1, "")}<span />
          {pad("◀", -1, 0, "")}<span />{pad("▶", 1, 0, "")}
          <span />{pad("▼", 0, 1, "")}<span />
        </div>
      )}

      {res === "lose" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-center">
          <p className="font-serif text-2xl font-bold" style={goldText}>{T.snakeOver}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Pill gold onClick={again}>{T.tryAgain}</Pill>
            <Pill onClick={onExit}>{T.changeLevel}</Pill>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* =====================================================================
   CHECKERS (English draughts, mandatory captures, kings, minimax rival)
   ===================================================================== */
const CK_DIRS = { k: [[-1, -1], [-1, 1], [1, -1], [1, 1]], 1: [[-1, -1], [-1, 1]], 2: [[1, -1], [1, 1]] };
const ckInit = () => {
  const list = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 !== 1) continue;
    if (r < 3) list.push({ id: nid(), r, c, p: 2, k: false });
    else if (r > 4) list.push({ id: nid(), r, c, p: 1, k: false });
  }
  return list;
};
const ckGrid = (list) => {
  const g = Array.from({ length: 8 }, () => Array(8).fill(null));
  list.forEach((p) => { g[p.r][p.c] = { p: p.p, k: p.k }; });
  return g;
};
function ckChains(g, r, c, pc, caps, path, out) {
  const dirs = pc.k ? CK_DIRS.k : CK_DIRS[pc.p];
  let any = false;
  for (const [dr, dc] of dirs) {
    const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
    if (tr < 0 || tr > 7 || tc < 0 || tc > 7) continue;
    const mid = g[mr][mc];
    if (!mid || mid.p === pc.p || g[tr][tc] || caps.some(([x, y]) => x === mr && y === mc)) continue;
    any = true;
    const crowned = !pc.k && tr === (pc.p === 1 ? 0 : 7);
    const ncaps = [...caps, [mr, mc]];
    const npath = [...path, [tr, tc]];
    if (crowned) out.push({ path: npath, caps: ncaps }); // a new king ends the turn
    else ckChains(g, tr, tc, pc, ncaps, npath, out);
  }
  if (!any && caps.length) out.push({ path, caps });
}
function ckMoves(g, side) {
  const jumps = [], steps = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const pc = g[r][c];
    if (!pc || pc.p !== side) continue;
    g[r][c] = null; // the moving piece leaves its square while it jumps
    const out = [];
    ckChains(g, r, c, pc, [], [], out);
    g[r][c] = pc;
    out.forEach((o) => jumps.push({ fr: r, fc: c, ...o }));
    for (const [dr, dc] of pc.k ? CK_DIRS.k : CK_DIRS[pc.p]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !g[nr][nc]) steps.push({ fr: r, fc: c, path: [[nr, nc]], caps: [] });
    }
  }
  return jumps.length ? jumps : steps; // capturing is mandatory
}
function ckApply(g, m) {
  const n = g.map((row) => row.slice());
  const pc = n[m.fr][m.fc];
  n[m.fr][m.fc] = null;
  m.caps.forEach(([r, c]) => { n[r][c] = null; });
  const [tr, tc] = m.path[m.path.length - 1];
  n[tr][tc] = !pc.k && tr === (pc.p === 1 ? 0 : 7) ? { p: pc.p, k: true } : pc;
  return n;
}
function ckEval(g) {
  let s = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const pc = g[r][c];
    if (!pc) continue;
    let v = pc.k ? 175 : 100;
    if (!pc.k) {
      v += (pc.p === 2 ? r : 7 - r) * 4;
      if ((pc.p === 2 && r === 0) || (pc.p === 1 && r === 7)) v += 8;
    }
    if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 3;
    s += pc.p === 2 ? v : -v;
  }
  return s;
}
function ckSearch(g, side, depth, alpha, beta, ext) {
  const ms = ckMoves(g, side);
  if (!ms.length) return side === 2 ? -10000 - depth : 10000 + depth;
  if (depth <= 0) {
    if (ms[0].caps.length && ext < 3) { depth = 1; ext += 1; } // keep looking while captures are pending
    else return ckEval(g);
  }
  if (side === 2) {
    let best = -Infinity;
    for (const m of ms) {
      const v = ckSearch(ckApply(g, m), 1, depth - 1, alpha, beta, ext);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of ms) {
    const v = ckSearch(ckApply(g, m), 2, depth - 1, alpha, beta, ext);
    if (v < best) best = v;
    if (best < beta) beta = best;
    if (beta <= alpha) break;
  }
  return best;
}
function ckBest(g, ms, depth, mistakes) {
  if (ms.length === 1) return ms[0];
  if (Math.random() < mistakes) return ms[Math.floor(Math.random() * ms.length)];
  let best = -Infinity, pick = [];
  ms.forEach((m) => {
    const v = ckSearch(ckApply(g, m), 1, depth - 1, -Infinity, Infinity, 0);
    if (v > best) { best = v; pick = [m]; } else if (v === best) pick.push(m);
  });
  return pick[Math.floor(Math.random() * pick.length)];
}

export function Checkers({ ui, cfg, T, onWin, onExit, again }) {
  const { Pill, goldText, useWidth, num, sleep, STOP } = ui;
  const depth = num(cfg.depth, 3, 1, 8);
  const mistakes = num(cfg.mistakes, 0.1, 0, 1);
  const [pieces, setPieces] = useState(ckInit);
  const [turn, setTurn] = useState("p"); // p | a | over
  const [sel, setSel] = useState(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(null);
  const [last, setLast] = useState(null);
  const [msg, setMsg] = useState("");
  const np = useRef(0);
  const token = useRef(0);
  const boxRef = useRef(null);
  const boxW = useWidth(boxRef, 340);
  useEffect(() => () => { token.current += 1; }, []);

  const size = Math.floor(Math.min(boxW, 420));
  const bd = size - 16;
  const cell = bd / 8;

  const grid = ckGrid(pieces);
  const pm = turn === "p" ? ckMoves(grid, 1) : [];
  const mustJump = pm.length > 0 && pm[0].caps.length > 0;
  const selPiece = pieces.find((x) => x.id === sel) || null;
  const dests = selPiece ? pm.filter((m) => m.fr === selPiece.r && m.fc === selPiece.c) : [];
  const destKey = (m) => {
    const e = m.path[m.path.length - 1];
    return `${e[0]}-${e[1]}`;
  };
  const destSet = new Set(dests.map(destKey));

  const finish = (r) => {
    setRes(r);
    setTurn("over");
    setBusy(false);
    setMoving(null);
    if (r === "win") {
      const my = token.current;
      setTimeout(() => { if (token.current === my) onWin(); }, 1300);
    }
  };

  const play = async (mv, who, base) => {
    const my = token.current;
    const nap = async (ms) => {
      await sleep(ms);
      if (token.current !== my) throw STOP;
    };
    try {
      setBusy(true);
      setSel(null);
      setMsg("");
      const mover = base.find((x) => x.r === mv.fr && x.c === mv.fc);
      const pid = mover.id;
      setMoving(pid);
      let cur = base;
      for (let h = 0; h < mv.path.length; h++) {
        const [r, c] = mv.path[h];
        const cap = mv.caps[h];
        cur = cur
          .filter((x) => !(cap && x.r === cap[0] && x.c === cap[1]))
          .map((x) => (x.id === pid ? { ...x, r, c } : x));
        setPieces(cur);
        await nap(mv.path.length > 1 && h < mv.path.length - 1 ? 400 : 320);
      }
      const end = mv.path[mv.path.length - 1];
      if (!mover.k && end[0] === (who === 1 ? 0 : 7)) {
        cur = cur.map((x) => (x.id === pid ? { ...x, k: true } : x));
        setPieces(cur);
        await nap(350);
      }
      setMoving(null);
      setLast({ from: [mv.fr, mv.fc], to: end });
      if (mv.caps.length || !mover.k) np.current = 0;
      else np.current += 1;
      const opp = who === 1 ? 2 : 1;
      if (!ckMoves(ckGrid(cur), opp).length) { finish(who === 1 ? "win" : "lose"); return; }
      if (np.current >= 40) { finish("draw"); return; }
      setBusy(false);
      if (who === 1) { setTurn("a"); aiMove(cur); } else setTurn("p");
    } catch (e) {
      if (e !== STOP) console.error(e);
    }
  };

  const aiMove = async (cur) => {
    const my = token.current;
    await sleep(600);
    if (token.current !== my) return;
    const g = ckGrid(cur);
    const ms = ckMoves(g, 2);
    if (!ms.length) { finish("win"); return; }
    play(ckBest(g, ms, depth, mistakes), 2, cur);
  };

  const clickPiece = (pc) => {
    if (turn !== "p" || busy || res || pc.p !== 1) return;
    if (sel === pc.id) { setSel(null); return; }
    if (pm.some((m) => m.fr === pc.r && m.fc === pc.c)) { setSel(pc.id); setMsg(""); }
    else setMsg(mustJump ? T.mustJump : "");
  };
  const clickSquare = (r, c) => {
    if (turn !== "p" || busy || res || !selPiece) return;
    const mv = dests.find((m) => destKey(m) === `${r}-${c}`);
    if (mv) play(mv, 1, pieces);
  };

  const mine = pieces.filter((x) => x.p === 1).length;
  const theirs = pieces.filter((x) => x.p === 2).length;
  const status =
    res === "win" ? T.youWin : res === "lose" ? T.rivalWins : res === "draw" ? T.draw
    : turn === "a" ? T.rivalTurn : msg || (mustJump ? T.mustJump : T.yourTurn);

  const stackGold = "0 1px 0 #8a6a14, 0 2px 0 #7a5c10, 0 3px 0 #6a4e0c, 0 4px 0 #5a4009, 0 9px 12px rgba(0,0,0,.55)";
  const stackTeal = "0 1px 0 #0c5a60, 0 2px 0 #0a4c52, 0 3px 0 #083e44, 0 4px 0 #063036, 0 9px 12px rgba(0,0,0,.55)";

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-3 flex w-full max-w-[420px] items-center justify-between rounded-2xl px-4 py-2.5" style={PANEL}>
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#f0cb62" }}>{T.you}</p>
          <b className="font-serif text-2xl" style={{ color: "#f0cb62" }}>{mine}</b>
        </div>
        <motion.p key={status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="px-2 text-center text-[12px] font-semibold">
          {status}
        </motion.p>
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#4fd1c5" }}>{T.rival}</p>
          <b className="font-serif text-2xl" style={{ color: "#4fd1c5" }}>{theirs}</b>
        </div>
      </div>

      <div ref={boxRef} className="w-full">
        <div className="mx-auto" style={{ width: size, perspective: 1100 }}>
          <motion.div
            initial={{ rotateX: 46, opacity: 0, y: 24 }} animate={{ rotateX: 22, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 80, damping: 16 }}
            style={{ ...FRAME, padding: 8, borderRadius: 20, transformOrigin: "50% 65%" }}
          >
            <div style={{ position: "relative", width: bd, height: bd, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", width: "100%", height: "100%" }}>
                {Array.from({ length: 64 }).map((_, i) => {
                  const r = Math.floor(i / 8), c = i % 8;
                  const dark = (r + c) % 2 === 1;
                  const isDest = destSet.has(`${r}-${c}`);
                  const isLast = last && ((last.from[0] === r && last.from[1] === c) || (last.to[0] === r && last.to[1] === c));
                  return (
                    <div
                      key={i} onClick={() => clickSquare(r, c)}
                      style={{
                        position: "relative", cursor: isDest ? "pointer" : "default",
                        background: dark ? "linear-gradient(145deg,#33281b,#1f170f)" : "linear-gradient(145deg,#e6d6ae,#cdbb8f)",
                        boxShadow: isLast ? "inset 0 0 0 100px rgba(240,203,98,.16)" : undefined,
                      }}
                    >
                      {isDest && (
                        <motion.span
                          animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.2 }}
                          style={{ position: "absolute", left: "34%", top: "34%", width: "32%", height: "32%", borderRadius: "50%", background: "radial-gradient(circle, #fff3bf, #f0cb62)", boxShadow: "0 0 14px rgba(240,203,98,.95)" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <AnimatePresence>
                {pieces.map((pc) => {
                  const isSel = sel === pc.id;
                  const gold = pc.p === 1;
                  return (
                    <motion.div
                      key={pc.id}
                      initial={{ x: `${pc.c * 100}%`, y: `${pc.r * 100}%`, scale: 0.4, opacity: 0 }}
                      animate={{ x: `${pc.c * 100}%`, y: `${pc.r * 100}%`, scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0, rotate: 120 }}
                      transition={{ x: { type: "spring", stiffness: 240, damping: 24 }, y: { type: "spring", stiffness: 240, damping: 24 }, scale: { duration: 0.3 } }}
                      onClick={() => clickPiece(pc)}
                      style={{ position: "absolute", left: 0, top: 0, width: "12.5%", height: "12.5%", cursor: gold && turn === "p" && !busy ? "pointer" : "default", zIndex: moving === pc.id ? 6 : isSel ? 5 : 1 }}
                    >
                      <motion.div
                        animate={{ y: isSel ? -cell * 0.14 : 0, scale: isSel ? 1.1 : 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        style={{
                          position: "absolute", inset: "10%", borderRadius: "50%", display: "grid", placeItems: "center",
                          background: gold
                            ? "radial-gradient(circle at 35% 30%, #fff3bf, #f0cb62 40%, #b8862b 82%)"
                            : "radial-gradient(circle at 35% 30%, #8ff5ea, #1fa9a0 45%, #0b4a52)",
                          boxShadow: `${gold ? stackGold : stackTeal}${isSel ? ", 0 0 26px rgba(240,203,98,.9)" : ""}`,
                        }}
                      >
                        <div style={{ position: "absolute", inset: "16%", borderRadius: "50%", boxShadow: gold ? "inset 0 0 0 2px rgba(120,80,10,.45)" : "inset 0 0 0 2px rgba(0,40,44,.55)" }} />
                        {pc.k && (
                          <span style={{ fontSize: cell * 0.42, lineHeight: 1, color: gold ? "#5a3d08" : "#d8fffb", textShadow: "0 1px 0 rgba(255,255,255,.35)" }}>♛</span>
                        )}
                      </motion.div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {(res === "lose" || res === "draw") && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex flex-wrap justify-center gap-2">
          <Pill gold onClick={again}>{T.tryAgain}</Pill>
          <Pill onClick={onExit}>{T.changeLevel}</Pill>
        </motion.div>
      )}
      {!res && <p className="mt-3 text-center text-[11px] opacity-65">{T.mustJump}: ✓</p>}
    </div>
  );
}