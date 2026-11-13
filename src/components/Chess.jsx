import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const CT = {
  en: {
    check: "Check!", mate: "Checkmate!", stale: "Stalemate: it's a draw", fifty: "50 moves without progress: draw",
    material: "Not enough pieces to win: draw", rep: "Same position three times: draw", promote: "Promote your pawn to…",
    notYours: "That is {name}'s piece", stuck: "This piece has no legal move", pickFirst: "Tap one of your pieces first",
    kingCheck: "Your king is in check! Move it or block the attack", leavesCheck: "That move would leave your king in check",
    badMove: "That piece cannot move there", wait: "Wait for {name} to move",
  },
  hi: {
    check: "शह!", mate: "शह और मात!", stale: "स्टेलमेट: बराबरी", fifty: "50 चालों में कोई प्रगति नहीं: बराबरी",
    material: "जीतने लायक मोहरे नहीं: बराबरी", rep: "वही स्थिति तीन बार: बराबरी", promote: "प्यादे को बदलें…",
    notYours: "यह {name} का मोहरा है", stuck: "इस मोहरे की कोई वैध चाल नहीं", pickFirst: "पहले अपना कोई मोहरा छुएँ",
    kingCheck: "आपके राजा पर शह है! उसे हटाएँ या हमला रोकें", leavesCheck: "इस चाल से आपका राजा शह में रहेगा",
    badMove: "यह मोहरा वहाँ नहीं जा सकता", wait: "{name} की चाल का इंतज़ार करें",
  },
};

export const HOW = {
  en: [
    "Tap a piece, then tap a highlighted square to move it. The side at the bottom of the first screen moves first.",
    "Pawns go forward and capture diagonally, knights jump in an L, bishops go diagonally, rooks straight, the queen both, the king one step.",
    "Special moves: castling, en passant, and promotion (a pawn reaching the far row becomes a queen, rook, bishop or knight).",
    "If your king is attacked it is Check and you must escape. No escape is Checkmate and you lose. A red note explains any illegal move.",
  ],
  hi: [
    "मोहरा छुएँ, फिर चमकता खाना छुएँ। पहली चाल नीचे वाला पक्ष चलता है।",
    "प्यादा आगे चलता है और तिरछा मारता है, घोड़ा L में कूदता है, ऊँट तिरछा, हाथी सीधा, वज़ीर दोनों, राजा एक कदम।",
    "खास चालें: कैसलिंग, एन पासां, और प्रमोशन (आखिरी पंक्ति पर प्यादा वज़ीर, हाथी, ऊँट या घोड़ा बनता है)।",
    "राजा पर हमला हो तो शह है और बचना ज़रूरी है। बचाव न हो तो मात और हार। गलत चाल पर लाल संदेश कारण बताता है।",
  ],
};

/* ---------------- board colours (change these if you want another theme) ---------------- */
const BOARD_LIGHT = "#e6d2a0";
const BOARD_DARK = "#6a4526";
const WOOD_LIGHT = "linear-gradient(145deg,#f1e1b6,#d3bb86)";
const WOOD_DARK = "linear-gradient(145deg,#7b5531,#51361e)";
const SEL_COLOR = "rgba(255,235,59,.55)";
const LAST_COLOR = "rgba(255,235,59,.38)";

/* ---------------- the chess rules ---------------- */
const FILES = "abcdefgh";
const sq = (r, c) => FILES[c] + (8 - r);
const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const OR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BACK = ["R", "N", "B", "Q", "K", "B", "N", "R"];
let PID = 1;

const initPieces = () => {
  const out = [];
  for (let c = 0; c < 8; c++) {
    out.push({ id: PID++, t: BACK[c], s: 2, r: 0, c });
    out.push({ id: PID++, t: "P", s: 2, r: 1, c });
    out.push({ id: PID++, t: "P", s: 1, r: 6, c });
    out.push({ id: PID++, t: BACK[c], s: 1, r: 7, c });
  }
  return out;
};
const gridOf = (pcs) => {
  const g = Array.from({ length: 8 }, () => Array(8).fill(null));
  pcs.forEach((p) => { g[p.r][p.c] = { t: p.t, s: p.s }; });
  return g;
};
// a short text that identifies a position (used to spot repeated positions)
const posKey = (b, turn, cast, ep) => {
  let s = "";
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = b[r][c]; s += p ? (p.s === 1 ? p.t : p.t.toLowerCase()) : "."; }
  return s + turn + (cast[1].k ? "K" : "") + (cast[1].q ? "Q" : "") + (cast[2].k ? "k" : "") + (cast[2].q ? "q" : "") + (ep ? `${ep[0]}${ep[1]}` : "");
};

function attacked(b, r, c, by) {
  const pr = by === 1 ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    if (inB(pr, c + dc)) { const p = b[pr][c + dc]; if (p && p.s === by && p.t === "P") return true; }
  }
  for (const [dr, dc] of KN) {
    const rr = r + dr, cc = c + dc;
    if (inB(rr, cc)) { const p = b[rr][cc]; if (p && p.s === by && p.t === "N") return true; }
  }
  for (const [dr, dc] of KG) {
    const rr = r + dr, cc = c + dc;
    if (inB(rr, cc)) { const p = b[rr][cc]; if (p && p.s === by && p.t === "K") return true; }
  }
  for (const [dr, dc] of DG) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) {
      const p = b[rr][cc];
      if (p) { if (p.s === by && (p.t === "B" || p.t === "Q")) return true; break; }
      rr += dr; cc += dc;
    }
  }
  for (const [dr, dc] of OR) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) {
      const p = b[rr][cc];
      if (p) { if (p.s === by && (p.t === "R" || p.t === "Q")) return true; break; }
      rr += dr; cc += dc;
    }
  }
  return false;
}

function pseudo(st, r, c) {
  const b = st.b, p = b[r][c], out = [];
  const add = (tr, tc, extra) => out.push({ fr: r, fc: c, tr, tc, ...extra });
  if (p.t === "P") {
    const d = p.s === 1 ? -1 : 1, start = p.s === 1 ? 6 : 1, lastRow = p.s === 1 ? 0 : 7;
    if (inB(r + d, c) && !b[r + d][c]) {
      add(r + d, c, r + d === lastRow ? { promo: true } : {});
      if (r === start && !b[r + 2 * d][c]) add(r + 2 * d, c, { dbl: true });
    }
    for (const dc of [-1, 1]) {
      const tr = r + d, tc = c + dc;
      if (!inB(tr, tc)) continue;
      const q = b[tr][tc];
      if (q && q.s !== p.s) add(tr, tc, { cap: true, ...(tr === lastRow ? { promo: true } : {}) });
      else if (!q && st.ep && st.ep[0] === tr && st.ep[1] === tc) add(tr, tc, { cap: true, ep: true });
    }
  } else if (p.t === "N" || p.t === "K") {
    for (const [dr, dc] of p.t === "N" ? KN : KG) {
      const tr = r + dr, tc = c + dc;
      if (!inB(tr, tc)) continue;
      const q = b[tr][tc];
      if (!q || q.s !== p.s) add(tr, tc, q ? { cap: true } : {});
    }
    if (p.t === "K" && c === 4 && r === (p.s === 1 ? 7 : 0)) {
      const opp = p.s === 1 ? 2 : 1, cs = st.cast[p.s];
      if (!attacked(b, r, 4, opp)) {
        if (cs.k && !b[r][5] && !b[r][6] && b[r][7] && b[r][7].t === "R" && b[r][7].s === p.s && !attacked(b, r, 5, opp) && !attacked(b, r, 6, opp)) add(r, 6, { castle: "k" });
        if (cs.q && !b[r][3] && !b[r][2] && !b[r][1] && b[r][0] && b[r][0].t === "R" && b[r][0].s === p.s && !attacked(b, r, 3, opp) && !attacked(b, r, 2, opp)) add(r, 2, { castle: "q" });
      }
    }
  } else {
    const dirs = p.t === "B" ? DG : p.t === "R" ? OR : [...DG, ...OR];
    for (const [dr, dc] of dirs) {
      let tr = r + dr, tc = c + dc;
      while (inB(tr, tc)) {
        const q = b[tr][tc];
        if (!q) add(tr, tc, {});
        else { if (q.s !== p.s) add(tr, tc, { cap: true }); break; }
        tr += dr; tc += dc;
      }
    }
  }
  return out;
}

function applyChess(st, m, pt) {
  const b = st.b.map((row) => row.slice());
  const p = b[m.fr][m.fc];
  b[m.fr][m.fc] = null;
  if (m.ep) b[m.fr][m.tc] = null;
  b[m.tr][m.tc] = m.promo ? { t: pt || "Q", s: p.s } : p;
  if (m.castle === "k") { b[m.tr][5] = b[m.tr][7]; b[m.tr][7] = null; }
  if (m.castle === "q") { b[m.tr][3] = b[m.tr][0]; b[m.tr][0] = null; }
  const cast = { 1: { ...st.cast[1] }, 2: { ...st.cast[2] } };
  if (p.t === "K") { cast[p.s].k = false; cast[p.s].q = false; }
  const home = p.s === 1 ? 7 : 0;
  if (p.t === "R" && m.fr === home) { if (m.fc === 0) cast[p.s].q = false; if (m.fc === 7) cast[p.s].k = false; }
  if (m.tr === 7 && m.tc === 0) cast[1].q = false;
  if (m.tr === 7 && m.tc === 7) cast[1].k = false;
  if (m.tr === 0 && m.tc === 0) cast[2].q = false;
  if (m.tr === 0 && m.tc === 7) cast[2].k = false;
  return { b, cast, ep: m.dbl ? [(m.fr + m.tr) / 2, m.fc] : null, half: p.t === "P" || m.cap ? 0 : (st.half || 0) + 1 };
}
function listApply(pcs, m, pt) {
  return pcs
    .filter((x) => !(x.r === m.tr && x.c === m.tc) && !(m.ep && x.r === m.fr && x.c === m.tc))
    .map((x) => {
      if (x.r === m.fr && x.c === m.fc) return { ...x, r: m.tr, c: m.tc, t: m.promo ? pt || "Q" : x.t };
      if (m.castle === "k" && x.r === m.tr && x.c === 7) return { ...x, c: 5 };
      if (m.castle === "q" && x.r === m.tr && x.c === 0) return { ...x, c: 3 };
      return x;
    });
}
const findKing = (b, s) => {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] && b[r][c].t === "K" && b[r][c].s === s) return [r, c];
  return null;
};
const inCheck = (st, s) => {
  const k = findKing(st.b, s);
  return !!k && attacked(st.b, k[0], k[1], s === 1 ? 2 : 1);
};
function legalFor(st, side) {
  const out = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = st.b[r][c];
      if (!p || p.s !== side) continue;
      for (const m of pseudo(st, r, c)) {
        const ns = applyChess(st, m, "Q");
        const k = findKing(ns.b, side);
        if (k && !attacked(ns.b, k[0], k[1], side === 1 ? 2 : 1)) out.push(m);
      }
    }
  return out;
}
function insufficient(b) {
  const rest = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] && b[r][c].t !== "K") rest.push(b[r][c].t);
  return rest.length === 0 || (rest.length === 1 && (rest[0] === "B" || rest[0] === "N"));
}

/* ---------------- the computer player ----------------
   easy   ≈ 500 : looks only at the next move, often misses captures and hangs pieces
   medium ≈ 1100: sees one reply ahead and all simple captures, still misses deeper tactics and slips now and then
   hard   ≈ 1500+: iterative deepening (up to 8 plies, 1.5 s), check extensions, killer moves, late move
                   reductions, a real evaluation (pawn structure, king safety, passed pawns, rook files,
                   bishop pair, endgame king) and it knows how to drive the enemy king to the edge
   These numbers are approximate: strength was tuned by search depth and deliberate mistakes. */
const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const PST = {
  P: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  N: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  B: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  R: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  Q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  K: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  KE: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50],
};
const PASSB = [0, 8, 15, 30, 55, 90];
const TIME = new Error("time");
const PF1 = new Int8Array(8);
const PF2 = new Int8Array(8);
const cdist = (r, c) => Math.max(3 - r, r - 4) + Math.max(3 - c, c - 4);

// positive = good for gold / white (side 1)
function evalW(b) {
  let s = 0, m1 = 0, m2 = 0, b1 = 0, b2 = 0, k1r = 7, k1c = 4, k2r = 0, k2c = 4;
  PF1.fill(0); PF2.fill(0);
  const pw = [], rk = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      const w = p.s === 1, i = (w ? r : 7 - r) * 8 + c;
      let v = VAL[p.t];
      if (p.t === "P") { v += PST.P[i]; (w ? PF1 : PF2)[c]++; pw.push(r, c, p.s); }
      else if (p.t === "N") { v += PST.N[i]; if (w) m1 += 320; else m2 += 320; }
      else if (p.t === "B") { v += PST.B[i]; if (w) { m1 += 330; b1++; } else { m2 += 330; b2++; } }
      else if (p.t === "R") { v += PST.R[i]; rk.push(r, c, p.s); if (w) m1 += 500; else m2 += 500; }
      else if (p.t === "Q") { v += PST.Q[i]; if (w) m1 += 900; else m2 += 900; }
      else { if (w) { k1r = r; k1c = c; } else { k2r = r; k2c = c; } continue; }
      s += w ? v : -v;
    }
  const eg = m1 + m2 <= 2800;
  const K = eg ? PST.KE : PST.K;
  s += K[k1r * 8 + k1c] - K[(7 - k2r) * 8 + k2c];
  if (b1 > 1) s += 28;
  if (b2 > 1) s -= 28;
  for (let i = 0; i < pw.length; i += 3) {
    const r = pw[i], c = pw[i + 1], sd = pw[i + 2], own = sd === 1 ? PF1 : PF2;
    let passed = true;
    const iso = !((c > 0 && own[c - 1]) || (c < 7 && own[c + 1]));
    for (let j = 0; j < pw.length; j += 3) {
      if (pw[j + 2] === sd) continue;
      if (Math.abs(pw[j + 1] - c) <= 1 && (sd === 1 ? pw[j] < r : pw[j] > r)) { passed = false; break; }
    }
    let v = iso ? -12 : 0;
    if (passed) v += PASSB[sd === 1 ? 6 - r : r - 1] * (eg ? 1.6 : 1);
    s += sd === 1 ? v : -v;
  }
  for (let c = 0; c < 8; c++) {
    if (PF1[c] > 1) s -= 10 * (PF1[c] - 1);
    if (PF2[c] > 1) s += 10 * (PF2[c] - 1);
  }
  for (let i = 0; i < rk.length; i += 3) {
    const c = rk[i + 1], sd = rk[i + 2], own = sd === 1 ? PF1 : PF2, en = sd === 1 ? PF2 : PF1;
    const v = own[c] ? 0 : en[c] ? 10 : 22;
    s += sd === 1 ? v : -v;
  }
  if (!eg) { // pawn shield in front of a castled king
    if (k1r >= 6) { let sh = 0; for (let dc = -1; dc <= 1; dc++) { const c = k1c + dc; if (c < 0 || c > 7) continue; for (let dr = 1; dr <= 2; dr++) { const p = b[k1r - dr] && b[k1r - dr][c]; if (p && p.t === "P" && p.s === 1) { sh++; break; } } } s += sh * 9; }
    if (k2r <= 1) { let sh = 0; for (let dc = -1; dc <= 1; dc++) { const c = k2c + dc; if (c < 0 || c > 7) continue; for (let dr = 1; dr <= 2; dr++) { const p = b[k2r + dr] && b[k2r + dr][c]; if (p && p.t === "P" && p.s === 2) { sh++; break; } } } s -= sh * 9; }
  } else { // when far ahead in an endgame: push the lone king to the edge and bring your king close
    const dist = Math.abs(k1r - k2r) + Math.abs(k1c - k2c);
    if (s > 250) s += 8 * cdist(k2r, k2c) + 4 * (14 - dist);
    else if (s < -250) s -= 8 * cdist(k1r, k1c) + 4 * (14 - dist);
  }
  return s;
}

const sameMove = (a, m) => !!a && a.fr === m.fr && a.fc === m.fc && a.tr === m.tr && a.tc === m.tc;
function ordScore(st, m, ctx, ply) {
  if (m.cap) return 20000 + 10 * (m.ep ? 100 : VAL[st.b[m.tr][m.tc].t]) - VAL[st.b[m.fr][m.fc].t] / 10 + (m.promo ? 800 : 0);
  if (m.promo) return 19000;
  const k = ctx.kill[ply];
  if (k) { if (sameMove(k[0], m)) return 9000; if (sameMove(k[1], m)) return 8900; }
  return ctx.hist ? ctx.hist[(m.fr * 8 + m.fc) * 64 + m.tr * 8 + m.tc] : 0;
}
function pseudoAll(st, side, capsOnly) {
  const out = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = st.b[r][c];
      if (!p || p.s !== side) continue;
      for (const m of pseudo(st, r, c)) if (!capsOnly || m.cap || m.promo) out.push(m);
    }
  return out;
}
// the position after a move, or null if the move leaves your own king in check
function legalAfter(st, m, side) {
  const ns = applyChess(st, m, "Q");
  const k = findKing(ns.b, side);
  return k && !attacked(ns.b, k[0], k[1], side === 1 ? 2 : 1) ? ns : null;
}

function qs(st, side, alpha, beta, ctx, qd) {
  if ((++ctx.nodes & 255) === 0 && Date.now() > ctx.stop) throw TIME;
  const stand = (side === 1 ? 1 : -1) * evalW(st.b) + (ctx.jit ? (Math.random() - 0.5) * ctx.jit : 0);
  if (qd >= ctx.qmax || stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const opp = side === 1 ? 2 : 1;
  const ms = pseudoAll(st, side, true);
  for (const m of ms) m.o = ordScore(st, m, ctx, 0);
  ms.sort((a, b) => b.o - a.o);
  for (const m of ms) {
    if (!m.promo && stand + (m.ep ? 100 : VAL[st.b[m.tr][m.tc].t]) + 200 < alpha) continue; // hopeless capture
    const ns = legalAfter(st, m, side);
    if (!ns) continue;
    const v = -qs(ns, opp, -beta, -alpha, ctx, qd + 1);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}
function nega(st, side, depth, alpha, beta, ctx, ply) {
  if ((++ctx.nodes & 255) === 0 && Date.now() > ctx.stop) throw TIME;
  const opp = side === 1 ? 2 : 1;
  const chk = inCheck(st, side);
  if (chk && ctx.ext && ply < 16) depth += 1; // never stop searching while in check
  if (depth <= 0) return qs(st, side, alpha, beta, ctx, 0);
  const ms = pseudoAll(st, side, false);
  for (const m of ms) m.o = ordScore(st, m, ctx, ply);
  ms.sort((a, b) => b.o - a.o);
  let best = -Infinity, legal = 0, idx = 0;
  for (const m of ms) {
    const ns = legalAfter(st, m, side);
    if (!ns) continue;
    legal++;
    let v;
    if (ctx.lmr && idx >= 4 && depth >= 3 && !m.cap && !m.promo && !chk) { // late quiet moves: look less deep first
      v = -nega(ns, opp, depth - 2, -alpha - 1, -alpha, ctx, ply + 1);
      if (v > alpha) v = -nega(ns, opp, depth - 1, -beta, -alpha, ctx, ply + 1);
    } else v = -nega(ns, opp, depth - 1, -beta, -alpha, ctx, ply + 1);
    idx++;
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) {
      if (!m.cap) {
        const kk = ctx.kill[ply] || (ctx.kill[ply] = [null, null]);
        if (!sameMove(kk[0], m)) { kk[1] = kk[0]; kk[0] = m; }
        if (ctx.hist) { const i = (m.fr * 8 + m.fc) * 64 + m.tr * 8 + m.tc; ctx.hist[i] = Math.min(8000, ctx.hist[i] + depth * depth); }
      }
      break;
    }
  }
  if (!legal) return chk ? -30000 + ply : 0;
  return best;
}

const isStart = (b) => {
  for (let c = 0; c < 8; c++) {
    const a = b[7][c], p = b[6][c], q = b[1][c], d = b[0][c];
    if (!a || a.s !== 1 || a.t !== BACK[c] || !p || p.s !== 1 || p.t !== "P" || !q || q.s !== 2 || q.t !== "P" || !d || d.s !== 2 || d.t !== BACK[c]) return false;
  }
  return true;
};

export function chessMove(st, side, level, hist, opts) {
  const ms = legalFor(st, side);
  if (ms.length < 2) return ms[0] || null;
  const opp = side === 1 ? 2 : 1;
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const sg = side === 1 ? 1 : -1;
  const o = opts || {};

  // a first move that real players choose (e4, d4, Nf3 or c4); easy mode plays more randomly
  if (side === 1 && level !== "easy" && isStart(st.b)) {
    const bk = ms.filter((m) => (m.fr === 6 && m.fc === 4 && m.tr === 4) || (m.fr === 6 && m.fc === 3 && m.tr === 4) || (m.fr === 7 && m.fc === 6 && m.tc === 5) || (m.fr === 6 && m.fc === 2 && m.tr === 4));
    if (bk.length) return rnd(bk);
  }

  // repeating a position: a draw if it would be the 3rd time, a small minus if it would be the 2nd (and you are doing well)
  const repAdj = (m, v) => {
    if (!hist || !hist.length) return v;
    const ns = applyChess(st, m, "Q");
    const key = posKey(ns.b, opp, ns.cast, ns.ep);
    let n = 0;
    for (const k of hist) if (k === key) n++;
    if (n >= 2) return 0;
    if (n === 1 && v > 60) return v - 40;
    return v;
  };

  if (level === "easy") {
    // ≈ 500: wants to win material but only sees the very next move
    const mates = ms.filter((m) => { const ns = applyChess(st, m, "Q"); return inCheck(ns, opp) && !legalFor(ns, opp).length; });
    if (mates.length && Math.random() < 0.55) return rnd(mates);
    if (Math.random() < 0.12) return rnd(ms); // sometimes a pure random move
    const base = sg * evalW(st.b);
    let bm = ms[0], bv = -Infinity;
    for (const m of ms) {
      const v = sg * evalW(applyChess(st, m, "Q").b) - base + Math.random() * 420;
      if (v > bv) { bv = v; bm = m; }
    }
    return bm;
  }

  if (level === "medium") {
    // ≈ 1100: two plies plus captures, no check extensions, and a slip now and then
    const ctx = { nodes: 0, stop: Date.now() + (o.ms || 1200), ext: false, lmr: false, qmax: 3, hist: null, kill: [], jit: 0 };
    const scored = [];
    try {
      for (const m of ms) {
        const v = -nega(applyChess(st, m, "Q"), opp, 1, -Infinity, Infinity, ctx, 1);
        scored.push({ m, v: repAdj(m, v) + Math.random() * 22 });
      }
    } catch (e) { if (e !== TIME) throw e; return rnd(ms); }
    scored.sort((a, b) => b.v - a.v);
    if (Math.random() < 0.13) return rnd(scored.slice(0, Math.min(4, scored.length)).filter((x) => x.v >= scored[0].v - 220)).m;
    return scored[0].m;
  }

  // hard ≈ 1500+: iterative deepening
  const ctx = { nodes: 0, stop: Date.now() + (o.ms || 1500), ext: true, lmr: true, qmax: 6, hist: new Int32Array(4096), kill: [], jit: 3 };
  let order = ms.slice();
  order.forEach((m) => { m.o = ordScore(st, m, ctx, 0); });
  order.sort((a, b) => b.o - a.o);
  let done = null;
  try {
    for (let d = 1; d <= (o.depth || 8); d++) {
      const res = [];
      let alpha = -Infinity;
      for (const m of order) {
        const v = -nega(applyChess(st, m, "Q"), opp, d - 1, -Infinity, -alpha, ctx, 1);
        res.push({ m, v });
        if (v > alpha) alpha = v;
      }
      res.sort((a, b) => b.v - a.v);
      done = res;
      order = res.map((x) => x.m);
      if (res[0].v > 29000) break; // forced mate found
    }
  } catch (e) { if (e !== TIME) throw e; }
  if (!done) return order[0];
  const top = done.slice(0, 4).map((x) => ({ m: x.m, v: repAdj(x.m, x.v) }));
  top.sort((a, b) => b.v - a.v);
  return top[0].m;
}

/* ---------------- the pieces: flat 2D cartoon style (like chess.com), gold and black ---------------- */
const OUTLINE = { gold: "#3d2a05", black: "#000" };
const FOOT = "M23 92 Q23 83 34 81 H66 Q77 83 77 92 Z";
const NECK = "M31 81 Q32 75 38 74 H62 Q68 75 69 81 Z";
const circ = (cx, cy, r) => `M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
function Shape({ d, g, ol, sw = 2.4 }) {
  return (
    <>
      <path d={d} fill={`url(#${g})`} stroke={ol} strokeWidth={sw} strokeLinejoin="round" />
      <path d={d} fill="url(#kgS)" />
    </>
  );
}
function PieceArt({ t, gold }) {
  const g = gold ? "kgG" : "kgK";
  const ol = gold ? OUTLINE.gold : OUTLINE.black;
  const hl = gold ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.35)";
  const S = (d, sw) => <Shape d={d} g={g} ol={ol} sw={sw} />;
  if (t === "P")
    return (
      <>
        {S(FOOT)}{S(NECK)}
        {S("M40 75 C42 64 45 56 45 49 H55 C55 56 58 64 60 75 Z")}
        {S("M35 49 Q35 43 50 43 Q65 43 65 49 Q65 55 50 55 Q35 55 35 49 Z")}
        {S(circ(50, 31, 12))}
        <path d="M44 27 Q46 23 51 23" fill="none" stroke={hl} strokeWidth="2.4" strokeLinecap="round" />
      </>
    );
  if (t === "R")
    return (
      <>
        {S(FOOT)}{S(NECK)}
        {S("M37 75 L40 46 H60 L63 75 Z")}
        {S("M32 46 H68 V39 H32 Z")}
        {S("M33 39 L34 20 H43 V27 H47 V20 H53 V27 H57 V20 H66 L67 39 Z")}
        <path d="M40 72 L42 50" fill="none" stroke={hl} strokeWidth="2.4" strokeLinecap="round" />
      </>
    );
  if (t === "N")
    return (
      <>
        {S(FOOT)}{S(NECK)}
        {S("M33 75 C31 63 35 53 43 46 C45 44 44 42 42 41 C38 39 33 42 29 46 L26 42 C28 33 37 23 45 21 L46 13 L53 19 C67 20 74 33 73 48 C72 60 67 67 67 75 Z")}
        <circle cx="52" cy="31" r="2.6" fill={ol} />
        <path d="M33 44 C34 50 38 52 41 51" fill="none" stroke={ol} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M58 22 C64 28 66 38 64 46" fill="none" stroke={hl} strokeWidth="2.6" strokeLinecap="round" />
      </>
    );
  if (t === "B")
    return (
      <>
        {S(FOOT)}{S(NECK)}
        {S("M40 75 C42 65 44 58 44 52 H56 C56 58 58 65 60 75 Z")}
        {S("M35 52 Q35 47 50 47 Q65 47 65 52 Q65 57 50 57 Q35 57 35 52 Z")}
        {S("M50 15 C61 25 67 35 62 44 C60 48 57 49 56 49 H44 C43 49 40 48 38 44 C33 35 39 25 50 15 Z")}
        <path d="M55 25 L46 37" stroke={ol} strokeWidth="2.6" strokeLinecap="round" />
        {S(circ(50, 13, 4.2), 1.8)}
      </>
    );
  if (t === "Q")
    return (
      <>
        {S(FOOT)}{S(NECK)}
        {S("M36 75 L40 47 H60 L64 75 Z")}
        {S("M33 47 H67 V41 H33 Z")}
        {S("M27 28 L34 42 H66 L73 28 L66 36 L61 19 L55 34 L50 15 L45 34 L39 19 L34 36 Z")}
        {S(circ(27, 27, 3.4), 1.6)}{S(circ(39, 18, 3.4), 1.6)}{S(circ(50, 13, 3.6), 1.6)}{S(circ(61, 18, 3.4), 1.6)}{S(circ(73, 27, 3.4), 1.6)}
      </>
    );
  return (
    <>
      {S(FOOT)}{S(NECK)}
      {S("M36 75 L40 47 H60 L64 75 Z")}
      {S("M33 47 H67 V41 H33 Z")}
      {S("M35 41 C32 31 39 24 50 24 C61 24 68 31 65 41 Z")}
      {S("M47 6 H53 V12 H59 V18 H53 V24 H47 V18 H41 V12 H47 Z", 1.8)}
    </>
  );
}
function PieceSvg({ t, gold }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
      <PieceArt t={t} gold={gold} />
    </svg>
  );
}
function ChessDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="kgG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff1b0" /><stop offset=".35" stopColor="#f6cf55" /><stop offset=".7" stopColor="#d9a52e" /><stop offset="1" stopColor="#9a6c14" />
        </linearGradient>
        <linearGradient id="kgK" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6b6b6b" /><stop offset=".35" stopColor="#424242" /><stop offset=".7" stopColor="#262626" /><stop offset="1" stopColor="#101010" />
        </linearGradient>
        <linearGradient id="kgS" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ---------------- the game ---------------- */
export default function ChessGame({ kit, ui, lang, S, role, names, level, side, net, onFinish }) {
  const { TurnBar, LastLine, Warn, useWarn, GC, TC, fmt } = kit;
  const K = CT[lang] || CT.en;
  const [wn, warn, shake] = useWarn();
  const local = role === "local";
  const cpu = role === "cpu";
  const online = role === "host" || role === "guest";
  const myP = role === "host" ? 1 : role === "guest" ? 2 : cpu ? (side === 2 ? 2 : 1) : 0;
  const aiP = cpu ? (myP === 1 ? 2 : 1) : 0;
  const [pcs, setPcs] = useState(initPieces);
  const [meta, setMeta] = useState({ cast: { 1: { k: true, q: true }, 2: { k: true, q: true } }, ep: null, half: 0 });
  const [turn, setTurn] = useState(1);
  const [sel, setSel] = useState(null);
  const [res, setRes] = useState(null);
  const [why, setWhy] = useState("");
  const [last, setLast] = useState(null);
  const [ask, setAsk] = useState(null);
  const [auto, setAuto] = useState(false);
  const [think, setThink] = useState(false);
  const alive = useRef(true);
  const fn = useRef({});
  const hist = useRef(null);
  const boxRef = useRef(null);
  const boxW = ui.useWidth(boxRef, 360);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const flipped = local ? auto && turn === 2 : myP === 2;
  const colorOf = (s) => (local ? (s === 1 ? GC : TC) : s === myP ? GC : TC);
  const nameOf = (s) => (s === 1 ? names.host : names.guest);
  const size = Math.floor(Math.min(boxW, 460));
  const cell = size / 8;
  const X = (c) => (flipped ? 7 - c : c);
  const Y = (r) => (flipped ? 7 - r : r);

  const grid = gridOf(pcs);
  if (!hist.current) hist.current = [posKey(grid, 1, meta.cast, meta.ep)];
  const S0 = { b: grid, cast: meta.cast, ep: meta.ep, half: meta.half };
  const moves = turn ? legalFor(S0, turn) : [];
  const checked = turn ? inCheck(S0, turn) : false;
  const canAct = !res && turn !== 0 && !ask && (local || turn === myP);
  const destMap = {};
  if (sel && canAct) moves.filter((m) => m.fr === sel[0] && m.fc === sel[1]).forEach((m) => { destMap[`${m.tr}-${m.tc}`] = m; });

  const finish = (wnr) => {
    setRes(wnr); setTurn(0); setSel(null);
    setTimeout(() => { if (alive.current) onFinish(wnr); }, 1800);
  };
  const doMove = (m, who, fromNet, pt) => {
    const mover = grid[m.fr][m.fc];
    const moverId = (pcs.find((x) => x.r === m.fr && x.c === m.fc) || {}).id;
    const ns = applyChess(S0, m, pt);
    setPcs(listApply(pcs, m, pt));
    setMeta({ cast: ns.cast, ep: ns.ep, half: ns.half });
    setSel(null); setAsk(null);
    const opp = who === 1 ? 2 : 1;
    const s1 = { b: ns.b, cast: ns.cast, ep: ns.ep };
    const oppMoves = legalFor(s1, opp);
    const chk = inCheck(s1, opp);
    setLast({ who, m, id: moverId, piece: mover.t, pt: m.promo ? pt || "Q" : null, chk: chk && oppMoves.length > 0, k: Math.random() });
    if (online && !fromNet) net.send({ t: "ch", m: { fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc, pt: pt || null } });
    if (!oppMoves.length) { setWhy(chk ? "mate" : "stale"); finish(chk ? (who === 1 ? "host" : "guest") : "draw"); return; }
    if (ns.half >= 100) { setWhy("fifty"); finish("draw"); return; }
    if (insufficient(ns.b)) { setWhy("material"); finish("draw"); return; }
    const key = posKey(ns.b, opp, ns.cast, ns.ep);
    hist.current.push(key);
    if (hist.current.filter((x) => x === key).length >= 3) { setWhy("rep"); finish("draw"); return; }
    setTurn(opp);
  };
  // the friend's move is only accepted if it really is legal for them right now
  fn.current.net = (m) => {
    if (!online || res || !m) return;
    const opp = myP === 1 ? 2 : 1;
    if (turn !== opp) return;
    const lm = moves.find((x) => x.fr === m.fr && x.fc === m.fc && x.tr === m.tr && x.tc === m.tc);
    if (lm) doMove(lm, opp, true, ["Q", "R", "B", "N"].includes(m.pt) ? m.pt : "Q");
  };
  useEffect(() => net.on((msg) => { if (msg.t === "ch") fn.current.net(msg.m); }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // the computer's move
  fn.current.ai = () => {
    const m = chessMove(S0, aiP, level, hist.current);
    if (m) doMove(m, aiP, true, "Q");
  };
  useEffect(() => {
    if (!cpu || res || turn !== aiP) return undefined;
    setThink(true);
    const t = setTimeout(() => { if (alive.current) fn.current.ai(); }, 650);
    return () => { clearTimeout(t); setThink(false); };
  }, [turn, res]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTap = (r, c) => {
    if (res || !turn || ask) return;
    const key = `${r}-${c}`;
    const at = grid[r][c];
    if (!canAct) { warn(fmt(K.wait, { name: nameOf(myP === 1 ? 2 : 1) }), key); return; }
    if (sel) {
      const m = destMap[key];
      if (m) { if (m.promo) setAsk(m); else doMove(m, turn, false); return; }
    }
    if (at && at.s === turn) {
      if (sel && sel[0] === r && sel[1] === c) { setSel(null); return; }
      if (!moves.some((m) => m.fr === r && m.fc === c)) { warn(checked ? K.kingCheck : K.stuck, key); return; }
      setSel([r, c]);
      return;
    }
    if (!sel) { warn(at ? fmt(K.notYours, { name: nameOf(at.s) }) : K.pickFirst, key); return; }
    const reachable = pseudo(S0, sel[0], sel[1]).some((m) => m.tr === r && m.tc === c);
    warn(reachable ? K.leavesCheck : K.badMove, key);
  };

  const count = (s) => 16 - pcs.filter((p) => p.s !== s).length;
  const order = local ? [1, 2] : [myP, myP === 1 ? 2 : 1];
  const players = order.map((s) => ({
    name: nameOf(s), color: colorOf(s), score: count(s), you: !local && s === myP,
    sub: cpu && s === aiP && think ? S.thinking : undefined,
  }));
  const turnColor = res || !turn ? GC : colorOf(turn);
  const kingSq = checked ? findKing(grid, turn) : null;
  const GLY = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
  const lastTxt = last
    ? `${GLY[last.piece]}︎ ${sq(last.m.fr, last.m.fc)} → ${sq(last.m.tr, last.m.tc)}${last.m.cap ? " ✕" : ""}${last.m.castle ? (last.m.castle === "k" ? " · O-O" : " · O-O-O") : ""}${last.pt ? ` · ${GLY[last.pt]}︎` : ""}${last.chk ? " +" : ""}`
    : "";
  const lab = Math.max(9, Math.round(cell * 0.2));

  return (
    <div className="flex w-full flex-col items-center">
      <ChessDefs />
      <div className="w-full max-w-[460px]">
        <TurnBar players={players} turn={res ? -1 : order.indexOf(turn)} S={S} local={local} over={!!res} />
        {last ? <LastLine S={S} name={nameOf(last.who)} color={colorOf(last.who)}>{lastTxt}</LastLine> : <div className="min-h-[30px]" />}
        <div className="mb-1 flex min-h-[30px] justify-center">
          <AnimatePresence mode="wait">
            {res ? (
              <motion.p key="end" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="rounded-full px-4 py-1 text-[13px] font-bold" style={{ background: GC, color: "#3b2506" }}>
                {K[why] || ""}
              </motion.p>
            ) : checked ? (
              <motion.p key="chk" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="rounded-full px-4 py-1 text-[13px] font-bold" style={{ background: "rgba(229,72,77,.22)", color: "#ffb4b4", boxShadow: "inset 0 0 0 1px rgba(229,72,77,.8)" }}>
                {K.check}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
        <Warn w={wn} />
      </div>

      <motion.div animate={shake} className="w-full">
        <div ref={boxRef} className="w-full">
          <div className="relative mx-auto" style={{ width: size, height: size, marginTop: 6 }}>
            {/* the flat 2D board */}
            <div
              style={{
                position: "absolute", inset: 0, borderRadius: 8, overflow: "hidden",
                boxShadow: `0 0 0 2px ${turnColor}, 0 0 26px ${turnColor}55, 0 10px 28px rgba(0,0,0,.5)`,
                transition: "box-shadow .4s",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gridTemplateRows: "repeat(8, 1fr)", width: "100%", height: "100%" }}>
                {Array.from({ length: 64 }).map((_, i) => {
                  const vr = Math.floor(i / 8), vc = i % 8; // position on screen
                  const r = flipped ? 7 - vr : vr;
                  const c = flipped ? 7 - vc : vc;
                  const key = `${r}-${c}`;
                  const dark = (r + c) % 2 === 1;
                  const dest = destMap[key];
                  const isSel = sel && sel[0] === r && sel[1] === c;
                  const isLast = last && ((last.m.fr === r && last.m.fc === c) || (last.m.tr === r && last.m.tc === c));
                  const bad = wn && wn.cell === key;
                  const kc = kingSq && kingSq[0] === r && kingSq[1] === c;
                  const tint = bad ? "rgba(229,72,77,.6)" : kc ? "radial-gradient(circle, rgba(255,60,60,.95) 0%, rgba(229,72,77,.35) 65%, transparent 80%)" : isSel ? SEL_COLOR : isLast ? LAST_COLOR : null;
                  const txt = dark ? BOARD_LIGHT : BOARD_DARK;
                  return (
                    <div
                      key={i} onClick={() => onTap(r, c)}
                     style={{ position: "relative", background: dark ? WOOD_DARK : WOOD_LIGHT, boxShadow: dark ? "inset 0 0 0 .5px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.07)" : "inset 0 0 0 .5px rgba(90,60,20,.25), inset 0 1px 0 rgba(255,255,255,.5)", cursor: canAct ? "pointer" : "default", userSelect: "none", WebkitTapHighlightColor: "transparent" }}
                    >
                      {tint && <div style={{ position: "absolute", inset: 0, background: tint, pointerEvents: "none" }} />}
                      {vc === 0 && (
                        <span style={{ position: "absolute", top: 2, left: 3, fontSize: lab, lineHeight: 1, fontWeight: 700, color: txt, pointerEvents: "none" }}>{8 - r}</span>
                      )}
                      {vr === 7 && (
                        <span style={{ position: "absolute", bottom: 2, right: 3, fontSize: lab, lineHeight: 1, fontWeight: 700, color: txt, pointerEvents: "none" }}>{FILES[c]}</span>
                      )}
                      {dest && (
                        dest.cap ? (
                          <motion.span
                            initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: "inset 0 0 0 4px rgba(240,203,98,.9)", pointerEvents: "none" }}
                          />
                        ) : (
                          <motion.span
                            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            style={{ position: "absolute", left: "34%", top: "34%", width: "32%", height: "32%", borderRadius: "50%", background: "rgba(240,203,98,.9)", pointerEvents: "none" }}
                          />
                        )
                      )}
                    </div>
                  );
                })}
              </div>

              {/* pieces: they never catch clicks, so every tap goes straight to the square under them */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <AnimatePresence initial={false}>
                  {pcs.map((pc) => {
                    const isSel = sel && sel[0] === pc.r && sel[1] === pc.c;
                    const gold = colorOf(pc.s) === GC;
                    return (
                      <motion.div
                        key={pc.id} initial={false}
                        animate={{ x: `${X(pc.c) * 100}%`, y: `${Y(pc.r) * 100}%`, opacity: 1 }}
                        exit={{ scale: 0.3, opacity: 0 }}
                        transition={{ x: { type: "spring", stiffness: 320, damping: 30 }, y: { type: "spring", stiffness: 320, damping: 30 }, opacity: { duration: 0.2 }, scale: { duration: 0.25 } }}
                        style={{ position: "absolute", left: 0, top: 0, width: "12.5%", height: "12.5%", pointerEvents: "none", zIndex: isSel ? 3 : 2 }}
                      >
                        <motion.div
                          animate={{ scale: isSel ? 1.12 : 1, y: isSel ? -cell * 0.06 : 0 }}
                          transition={{ type: "spring", stiffness: 340, damping: 22 }}
                          style={{ width: "100%", height: "100%", padding: "3%", boxSizing: "border-box", filter: isSel ? "drop-shadow(0 4px 5px rgba(0,0,0,.45))" : "drop-shadow(0 1px 1px rgba(0,0,0,.35))" }}
                        >
                          <PieceSvg t={pc.t} gold={gold} />
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* capture burst */}
              <AnimatePresence>
                {last && last.m.cap && (
                  <motion.span
                    key={`cb${last.k}`}
                    initial={{ scale: 0.3, opacity: 0.9 }} animate={{ scale: 1.8, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: "easeOut" }}
                    style={{ position: "absolute", left: X(last.m.tc) * cell, top: Y(last.m.tr) * cell, width: cell, height: cell, borderRadius: "50%", boxShadow: "inset 0 0 0 3px #ff6b6b", pointerEvents: "none", zIndex: 4 }}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* pawn promotion */}
            <AnimatePresence>
              {ask && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAsk(null)}
                  className="absolute inset-0 z-20 grid place-items-center" style={{ background: "rgba(10,8,5,.72)", borderRadius: 8 }}
                >
                  <motion.div
                    initial={{ scale: 0.85, y: 14 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 18 }}
                    onClick={(e) => e.stopPropagation()} className="rounded-2xl p-3 text-center" style={kit.PANEL}
                  >
                    <p className="text-[12px] font-semibold">{K.promote}</p>
                    <div className="mt-2 flex gap-2">
                      {["Q", "R", "B", "N"].map((t) => (
                        <motion.button
                          key={t} type="button" onClick={() => doMove(ask, turn, false, t)} whileHover={{ y: -4, scale: 1.06 }} whileTap={{ scale: 0.93 }}
                          className="grid h-14 w-14 place-items-center rounded-xl"
                          style={{ background: "rgba(255,255,255,.1)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5)" }}
                        >
                          <span style={{ width: 44, height: 44, display: "block" }}><PieceSvg t={t} gold={colorOf(turn) === GC} /></span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {local && (
        <button
          type="button" onClick={() => setAuto((a) => !a)}
          className="mt-5 rounded-full px-4 py-1.5 text-[11px] font-semibold" style={{ color: "#efe8d6", ...kit.chipStyle }}
        >
          ⟳ {S.flip}: {auto ? S.on : S.off}
        </button>
      )}
    </div>
  );
}