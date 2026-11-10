import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { supabase } from "../lib/supabase";
import { tx } from "../lib/i18n";

export const CW = 320; // card size
export const CH = 450;
const CX = CW / 2; // centre of the medallion
const CY = 238;
const GOLD = "linear-gradient(180deg,#fff3bf 0%,#f0cb62 30%,#b8862b 58%,#f6dc8c 80%,#c9972f 100%)";
const goldText = { backgroundImage: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
const FACE = {
  position: "absolute", inset: 0, borderRadius: 22, overflow: "hidden",
  backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)",
};

const SPADE =
  "M50 4 C50 4 96 42 96 70 C96 88 80 98 66 90 C62 88 58 84 56 80 C57 96 62 106 72 116 L28 116 C38 106 43 96 44 80 C42 84 38 88 34 90 C20 98 4 88 4 70 C4 42 50 4 50 4 Z";
const LEAF = "M0 0 C4.2 -4 4.4 -12 0 -17 C-4.4 -12 -4.2 -4 0 0 Z";

// chamfered (cut-corner) frame path
const chamfer = (i, c) =>
  `M${i + c} ${i} H${CW - i - c} L${CW - i} ${i + c} V${CH - i - c} L${CW - i - c} ${CH - i} H${i + c} L${i} ${CH - i - c} V${i + c} Z`;

// laurel wreath: leaves along an arc (left branch; the right one is a mirror)
const arcPt = (deg, R) => [CX + R * Math.cos((deg * Math.PI) / 180), CY + R * Math.sin((deg * Math.PI) / 180)];
const STEM = `M${arcPt(100, 80)} A80 80 0 0 1 ${arcPt(250, 80)}`;
const WREATH = Array.from({ length: 11 }, (_, k) => {
  const deg = 104 + (138 * k) / 10;
  const [x, y] = arcPt(deg, 80);
  return { x, y, a: deg + 180 };
});

// gold dust floating up inside the card
const DUST = Array.from({ length: 14 }, () => ({
  left: 8 + Math.random() * 84,
  bottom: 6 + Math.random() * 50,
  size: 1.5 + Math.random() * 2.5,
  delay: -Math.random() * 7,
  dur: 5 + Math.random() * 5,
}));

const nameFs = (nameU) => Math.max(8.5, Math.min(12.5, 150 / (nameU.length * 0.92)));

/* ---------- fallback content (only used until / unless your Supabase tables answer) ---------- */
const DEFAULT_CARD = {
  rank: "K",
  eyebrow: "Utility card",
  frontTitle: "KING · OF · SPADES",
  bio: "Full Stack Developer building websites, Android apps and clean interfaces. Two products shipped end to end.",
  stats: [
    { value: "2", label: "Live products" },
    { value: "3", label: "Disciplines" },
    { value: "2026", label: "KIIT grad" },
  ],
  shipped: [
    { name: "Dobify", note: "Google Play" },
    { name: "Edormy", note: "Live" },
  ],
  skills: ["Flutter", "Dart", "Kotlin", "Java", "Supabase", "PostgreSQL", "Figma", "CSS"],
  journey: [
    { label: "Intern", text: "Leoworks Pvt Ltd" },
    { label: "Study", text: "B.Tech, KIIT" },
  ],
  primary: { label: "Hire me" },
  secondary: { label: "See my work", href: "#projects" },
};

// { en, hi } from the *_en / *_hi columns of a row
const bi = (r, f) => (r ? { en: r[`${f}_en`] ?? "", hi: r[`${f}_hi`] || r[`${f}_en`] || "" } : null);

const CSS = `
@keyframes kc-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes kc-sheen{0%{transform:translateX(-130%) skewX(-18deg)}55%,100%{transform:translateX(330%) skewX(-18deg)}}
@keyframes kc-spin{to{transform:rotate(360deg)}}
@keyframes kc-dust{0%{transform:translateY(0) scale(.6);opacity:0}20%{opacity:.85}100%{transform:translateY(-130px) scale(1);opacity:0}}
.kc-floatwrap{animation:kc-float 5s ease-in-out 1.6s infinite}
.kc-sheen{animation:kc-sheen 5.2s ease-in-out infinite}
.kc-rays{animation:kc-spin 90s linear infinite}
.kc-bezel{transform-origin:${CX}px ${CY}px;animation:kc-spin 60s linear infinite}
.kc-dust{animation:kc-dust 7s ease-in infinite}
@media (prefers-reduced-motion: reduce){.kc-floatwrap,.kc-sheen,.kc-rays,.kc-bezel,.kc-dust{animation:none}}
`;

/* =====================================================================
   DOWNLOAD: draws both sides of the card on a canvas and saves a PNG
   ===================================================================== */
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const goldGrad = (ctx, y0, y1) => {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, "#fff3bf");
  g.addColorStop(0.3, "#f0cb62");
  g.addColorStop(0.6, "#b8862b");
  g.addColorStop(0.82, "#f6dc8c");
  g.addColorStop(1, "#c9972f");
  return g;
};
const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
// text with letter spacing (works in every browser)
const spaced = (ctx, text, x, y, gap, align = "center") => {
  const chars = [...String(text)];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(chars.length - 1, 0);
  let cx = align === "center" ? x - total / 2 : x;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + gap;
  });
};
const wrapText = (ctx, text, maxW, maxLines) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((w) => {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  });
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = `${cut[maxLines - 1].replace(/\s+\S*$/, "")}…`;
    return cut;
  }
  return lines;
};
const fitText = (ctx, text, maxW) => {
  let s = String(text || "");
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
};
const shortUrl = (u) => String(u || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
const loadImg = (src) =>
  new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

function paintBase(ctx, rays) {
  const W = CW, H = CH;
  ctx.save();
  rr(ctx, 0, 0, W, H, 22);
  ctx.clip();
  let g = ctx.createRadialGradient(W * 0.28, H * 0.08, 0, W * 0.28, H * 0.08, W * 1.25);
  g.addColorStop(0, "#302a20");
  g.addColorStop(0.52, "#15120e");
  g.addColorStop(1, "#060504");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.022)";
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  if (rays) {
    g = ctx.createRadialGradient(CX, CY, 47, CX, CY, 177);
    g.addColorStop(0, "rgba(240,203,98,.13)");
    g.addColorStop(1, "rgba(240,203,98,0)");
    ctx.fillStyle = g;
    for (let a = 0; a < 360; a += 9) {
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.arc(CX, CY, 260, (a * Math.PI) / 180, ((a + 2) * Math.PI) / 180);
      ctx.closePath();
      ctx.fill();
    }
  }
    if (rays) {
    g = ctx.createRadialGradient(W / 2, H * 0.52, 112, W / 2, H * 0.52, 295);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,.6)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function paintFrame(ctx) {
  const W = CW, H = CH;
  ctx.save();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = goldGrad(ctx, 0, H);
  ctx.stroke(new Path2D(chamfer(11, 18)));
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(240,203,98,.38)";
  ctx.stroke(new Path2D(chamfer(19, 12)));
  ctx.fillStyle = goldGrad(ctx, 0, H);
  [[20, 20], [W - 20, 20], [20, H - 20], [W - 20, H - 20]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.moveTo(x, y - 4.5);
    ctx.lineTo(x + 4.5, y);
    ctx.lineTo(x, y + 4.5);
    ctx.lineTo(x - 4.5, y);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

function drawFront(ctx, o) {
  const W = CW, H = CH;
  paintBase(ctx, true);
  paintFrame(ctx);
  ctx.textBaseline = "alphabetic";

  // corner indexes (rank + spade)
  const index = (cx, cy, rot) => {
    ctx.save();
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(Math.PI);
    ctx.font = `700 40px ${SERIF}`;
    ctx.textAlign = "center";
    ctx.fillStyle = goldGrad(ctx, -36, -4);
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 2;
    ctx.fillText(o.rank, 0, -4.5);
    ctx.shadowColor = "transparent";
    ctx.translate(-11.5, 9.5);
    ctx.scale(0.23, 0.23);
    ctx.fillStyle = goldGrad(ctx, 0, 120);
    ctx.fill(new Path2D(SPADE));
    ctx.restore();
  };
  index(42.5, 62.5, false);
  index(W - 42.5, H - 62.5, true);

  // medallion: disc + rings
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 6;
  let g = ctx.createRadialGradient(CX, CY - 19, 0, CX, CY - 19, 133);
  g.addColorStop(0, "rgba(72,58,26,.95)");
  g.addColorStop(1, "rgba(10,8,5,.95)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(CX, CY, 95, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = goldGrad(ctx, CY - 108, CY + 108);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(CX, CY, 108, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([1.1, 5.8]);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(240,203,98,.8)";
  ctx.beginPath();
  ctx.arc(CX, CY, 101, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = goldGrad(ctx, CY - 94, CY + 94);
  ctx.beginPath();
  ctx.arc(CX, CY, 94, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // laurel wreath (left branch + mirrored right branch)
  const leaf = new Path2D(LEAF);
  const laurel = () => {
    ctx.strokeStyle = goldGrad(ctx, CY - 80, CY + 80);
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(CX, CY, 80, (100 * Math.PI) / 180, (250 * Math.PI) / 180, false);
    ctx.stroke();
    WREATH.forEach((l) =>
      [38, -38].forEach((off) => {
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(((l.a + off) * Math.PI) / 180);
        ctx.fillStyle = goldGrad(ctx, -17, 0);
        ctx.fill(leaf);
        ctx.strokeStyle = "rgba(70,40,0,.55)";
        ctx.lineWidth = 0.5;
        ctx.stroke(leaf);
        ctx.restore();
      })
    );
  };
  laurel();
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  laurel();
  ctx.restore();

  // the spade with embossed initials
  ctx.save();
  ctx.translate(CX - 67.5, CY - 77);
  ctx.scale(1.35, 1.35);
  const sp = new Path2D(SPADE);
  ctx.fillStyle = goldGrad(ctx, 4, 116);
  ctx.fill(sp);
  ctx.strokeStyle = "#5a3d08";
  ctx.lineWidth = 0.6;
  ctx.stroke(sp);
  g = ctx.createLinearGradient(4, 4, 96, 116);
  g.addColorStop(0, "rgba(255,255,255,.38)");
  g.addColorStop(0.5, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(60,30,0,.4)");
  ctx.fillStyle = g;
  ctx.fill(sp);
  ctx.save();
  ctx.translate(32, 38);
  ctx.rotate((28 * Math.PI) / 180);
  ctx.fillStyle = "rgba(255,255,255,.3)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = `700 21px ${SERIF}`;
  ctx.fillStyle = "rgba(255,240,190,.55)";
  ctx.fillText(o.initials, 50.7, 70.8);
  ctx.fillStyle = "#4a3008";
  ctx.fillText(o.initials, 50, 70);
  ctx.restore();

  // ribbon banner with the name
  ctx.save();
  ctx.fillStyle = "#9a6b13";
  ctx.strokeStyle = "rgba(60,35,0,.6)";
  ctx.lineWidth = 0.6;
  const poly = (pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  poly([[62, CY + 72], [92, CY + 72], [92, CY + 100], [62, CY + 100], [72, CY + 86]]);
  poly([[268, CY + 72], [238, CY + 72], [238, CY + 100], [268, CY + 100], [258, CY + 86]]);
  ctx.fillStyle = goldGrad(ctx, CY + 66, CY + 94);
  ctx.lineWidth = 0.7;
  ctx.fillRect(88, CY + 66, 154, 28);
  ctx.strokeRect(88, CY + 66, 154, 28);
  ctx.fillStyle = "#3b2506";
  ctx.font = `700 ${nameFs(o.nameU)}px ${SERIF}`;
  spaced(ctx, o.nameU, CX, CY + 84, 2.2);
  ctx.restore();

  // divider + title
  ctx.save();
  ctx.strokeStyle = "rgba(240,203,98,.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(70, 388);
  ctx.lineTo(148, 388);
  ctx.moveTo(182, 388);
  ctx.lineTo(260, 388);
  ctx.stroke();
  ctx.fillStyle = goldGrad(ctx, 382, 394);
  ctx.beginPath();
  ctx.moveTo(165, 382);
  ctx.lineTo(171, 388);
  ctx.lineTo(165, 394);
  ctx.lineTo(159, 388);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d9a933";
  ctx.font = `9.5px ${MONO}`;
  spaced(ctx, o.frontTitle, CX, 416, 5);
  ctx.restore();

  // edge
  ctx.save();
  rr(ctx, 0.5, 0.5, W - 1, H - 1, 22);
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawBack(ctx, o) {
  const W = CW, H = CH, L = 28, R = W - 28, CWd = R - L;
  paintBase(ctx, false);
  paintFrame(ctx);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const hasImg = !!o.cutImg;
  const textW = hasImg ? CWd - 100 : CWd;

  // header text
  ctx.font = `9px ${MONO}`;
  ctx.fillStyle = "#c9972f";
  spaced(ctx, `${o.eyebrow} · ${o.rank}♠`.toUpperCase(), L, L + 9, 2.8, "left");
  let fs = 22;
  ctx.font = `700 ${fs}px ${SERIF}`;
  while (ctx.measureText(o.name).width > textW && fs > 13) {
    fs -= 1;
    ctx.font = `700 ${fs}px ${SERIF}`;
  }
  ctx.fillStyle = goldGrad(ctx, L + 14, L + 40);
  ctx.textAlign = "left";
  ctx.fillText(o.name, L, L + 38);
  if (o.roleLine) {
    ctx.font = `10.5px ${SANS}`;
    ctx.fillStyle = "rgba(239,232,214,.75)";
    ctx.fillText(fitText(ctx, o.roleLine, textW), L, L + 54);
  }
  ctx.fillStyle = "#4ade80";
  ctx.beginPath();
  ctx.arc(L + 3, L + 68, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `8.5px ${SANS}`;
  ctx.fillStyle = "#e8c15a";
  spaced(ctx, String(o.status).toUpperCase(), L + 10, L + 71, 1.2, "left");
  const sw = [...String(o.status).toUpperCase()].reduce((a, c) => a + ctx.measureText(c).width + 1.2, 0);
  ctx.font = `9.5px ${MONO}`;
  ctx.fillStyle = "rgba(239,232,214,.8)";
  ctx.fillText(`· ${o.time}`, L + 10 + sw + 4, L + 71);

  // colour cutout
  if (hasImg) {
    const bx = R + 2 - 94, by = L, bw = 94, bh = 100;
    
    const s = Math.min(bw / o.cutImg.width, bh / o.cutImg.height);
    const w = o.cutImg.width * s, h = o.cutImg.height * s;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(o.cutImg, bx + (bw - w) / 2, by + bh - h, w, h);
    ctx.restore();
  }

  let y = L + 100;
  // divider
  y += 8;
  const dg = ctx.createLinearGradient(L, 0, R, 0);
  dg.addColorStop(0, "rgba(240,203,98,.7)");
  dg.addColorStop(1, "rgba(240,203,98,0)");
  ctx.fillStyle = dg;
  ctx.fillRect(L, y, CWd, 1);
  y += 9;

  // bio
  ctx.font = `11px ${SANS}`;
  ctx.fillStyle = "rgba(239,232,214,.8)";
  ctx.textAlign = "left";
  const bio = wrapText(ctx, o.bio, CWd, 3);
  bio.forEach((ln, i) => ctx.fillText(ln, L, y + 12 + i * 16));
  y += bio.length * 16;

  // stats
  if (o.stats.length) {
    y += 10;
    const n = o.stats.length, gap = 8, bw = (CWd - gap * (n - 1)) / n, bh = 42;
    o.stats.forEach((s, i) => {
      const x = L + i * (bw + gap);
      rr(ctx, x, y, bw, bh, 8);
      ctx.fillStyle = "rgba(240,203,98,.07)";
      ctx.fill();
      ctx.strokeStyle = "rgba(240,203,98,.22)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.font = `700 18px ${SERIF}`;
      ctx.fillStyle = goldGrad(ctx, y + 6, y + 26);
      ctx.fillText(fitText(ctx, s.value, bw - 8), x + bw / 2, y + 23);
      ctx.font = `8.5px ${SANS}`;
      ctx.fillStyle = "rgba(239,232,214,.7)";
      spaced(ctx, fitText(ctx, String(s.label).toUpperCase(), bw - 6), x + bw / 2, y + 36, 1.2);
    });
    ctx.textAlign = "left";
    y += bh;
  }

  // shipped
  if (o.shipped.length) {
    y += 10;
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = "#c9972f";
    spaced(ctx, String(o.shippedLabel).toUpperCase(), L, y + 9, 2.7, "left");
    y += 16;
    o.shipped.slice(0, 2).forEach((p) => {
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(L + 3, y + 8, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `11px ${SANS}`;
      ctx.fillStyle = "#efe8d6";
      ctx.textAlign = "left";
      ctx.fillText(fitText(ctx, p.name, CWd - 110), L + 12, y + 12);
      ctx.fillStyle = "rgba(239,232,214,.6)";
      ctx.textAlign = "right";
      ctx.fillText(fitText(ctx, p.note || "", 96), R, y + 12);
      ctx.textAlign = "left";
      y += 21;
    });
  }

  // skills
  if (o.skills.length) {
    y += 8;
    ctx.font = `9.5px ${SANS}`;
    let x = L, rowY = y;
    o.skills.slice(0, 8).forEach((s) => {
      const w = ctx.measureText(s).width + 16;
      if (x + w > R) {
        x = L;
        rowY += 20;
      }
      rr(ctx, x, rowY, w, 17, 8.5);
      ctx.strokeStyle = "rgba(240,203,98,.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#efe8d6";
      ctx.textAlign = "left";
      ctx.fillText(s, x + 8, rowY + 12);
      x += w + 4;
    });
    y = rowY + 17;
  }

  // journey
  if (o.journey.length) {
    y += 8;
    o.journey.slice(0, 2).forEach((j) => {
      ctx.font = `8.5px ${MONO}`;
      ctx.fillStyle = "#c9972f";
      const label = String(j.label || "").toUpperCase();
      spaced(ctx, label, L, y + 11, 1.7, "left");
      const lw = [...label].reduce((a, c) => a + ctx.measureText(c).width + 1.7, 0) + 6;
      ctx.font = `10.5px ${SANS}`;
      ctx.fillStyle = "#efe8d6";
      ctx.textAlign = "left";
      ctx.fillText(fitText(ctx, j.text, CWd - lw), L + lw, y + 11);
      y += 15;
    });
  }

  // contact lines at the bottom (email + links as text, since a PNG can't be clicked)
  const contact = [o.email, ...o.links.map((l) => shortUrl(l.url))].filter(Boolean).join("  ·  ");
  if (contact) {
    ctx.font = `9px ${MONO}`;
    ctx.textAlign = "left";
    const lines = wrapText(ctx, contact, CWd, 3);
    const top = H - 28 - lines.length * 13 - 2;
    ctx.fillStyle = dg;
    ctx.fillRect(L, top - 7, CWd, 1);
    ctx.fillStyle = "#e8c15a";
    lines.forEach((ln, i) => ctx.fillText(ln, L, top + 9 + i * 13));
  }

  ctx.save();
  rr(ctx, 0.5, 0.5, W - 1, H - 1, 22);
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// the card front as an image (used by the games)
export function frontToDataUrl(o, scale = 2) {
  const cv = document.createElement("canvas");
  cv.width = CW * scale;
  cv.height = CH * scale;
  const ctx = cv.getContext("2d");
  ctx.scale(scale, scale);
  drawFront(ctx, o);
  return cv.toDataURL("image/png");
}

// front + back side by side on a dark background -> PNG
function buildPng(o) {
  const SC = 3, PAD = 56;
  const cv = document.createElement("canvas");
  const tw = CW * 2 + PAD * 3, th = CH + PAD * 2;
  cv.width = tw * SC;
  cv.height = th * SC;
  const ctx = cv.getContext("2d");
  ctx.scale(SC, SC);
  const bg = ctx.createLinearGradient(0, 0, 0, th);
  bg.addColorStop(0, "#1c1610");
  bg.addColorStop(1, "#070605");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, tw, th);

  [drawFront, drawBack].forEach((fn, i) => {
    const x = PAD + i * (CW + PAD);
    ctx.save();
    ctx.translate(x, PAD);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.65)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 14;
    rr(ctx, 0, 0, CW, CH, 22);
    ctx.fillStyle = "#0b0a08";
    ctx.fill();
    ctx.restore();
    fn(ctx, o);
    ctx.restore();
  });
  return new Promise((res, rej) => {
    try {
      cv.toBlob((b) => (b ? res(b) : rej(new Error("png failed"))), "image/png");
    } catch (e) {
      rej(e);
    }
  });
}

const makeVcf = ({ name, email, role, urls }) => {
  const parts = name.split(/\s+/).filter(Boolean);
  const last = parts.length > 1 ? parts.pop() : "";
  const first = parts.join(" ");
  const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(name)}`,
    role ? `TITLE:${esc(role)}` : "",
    email ? `EMAIL;TYPE=INTERNET:${esc(email)}` : "",
    ...urls.map((u) => `URL:${u}`),
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");
};

/* local time, refreshed while the card is open */
function useLiveTime(active, lang) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, [active]);
  return now
    .toLocaleTimeString(lang === "hi" ? "hi-IN" : "en-GB", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s/g, "")
    .toLowerCase();
}

/* ---------- social icons ---------- */
function SocialIcon({ k, label }) {
  const p = { width: 14, height: 14, viewBox: "0 0 24 24" };
  if (k === "instagram")
    return (
      <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" />
      </svg>
    );
  if (k === "github")
    return (
      <svg {...p} fill="currentColor">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    );
  if (k === "linkedin")
    return (
      <svg {...p} fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  return <span className="text-[9px] font-bold uppercase">{String(label || k || "?").slice(0, 2)}</span>;
}

/* ---------- shared card shell: brushed metal, rays, cut-corner gold frame, sheen, foil, glare ---------- */
function CardBase({ fx, back, flip, rays, children }) {
  return (
    <div
      style={{
        ...FACE,
        transform: flip ? "rotateY(180deg)" : undefined,
        background: "radial-gradient(120% 90% at 28% 8%, #302a20 0%, #15120e 52%, #060504 100%)",
      }}
    >
      {/* brushed metal lines */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,.022) 0 1px, transparent 1px 3px)" }}
      />
      {/* slow sunburst */}
      {rays && (
        <div
          className="kc-rays absolute"
          style={{
            left: CX - 260, top: CY - 260, width: 520, height: 520,
            backgroundImage: "repeating-conic-gradient(from 0deg, rgba(240,203,98,.11) 0deg 2deg, transparent 2deg 9deg)",
            WebkitMaskImage: "radial-gradient(circle, #000 18%, transparent 68%)",
            maskImage: "radial-gradient(circle, #000 18%, transparent 68%)",
          }}
        />
      )}
      {/* dark edge vignette (front only: on the back it made the middle look lit) */}
      {!back && (
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 52%, transparent 0 38%, rgba(0,0,0,.6) 100%)" }}
        />
      )}
      {/* gold frame with cut corners */}
      <svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`} className="pointer-events-none absolute inset-0">
        <path d={chamfer(11, 18)} fill="none" stroke="url(#kc-g)" strokeWidth="1.8" />
        <path d={chamfer(19, 12)} fill="none" stroke="rgba(240,203,98,.38)" strokeWidth="1" />
        {[[20, 20], [CW - 20, 20], [20, CH - 20], [CW - 20, CH - 20]].map(([x, y], i) => (
          <path key={i} d={`M${x} ${y - 4.5} L${x + 4.5} ${y} L${x} ${y + 4.5} L${x - 4.5} ${y} Z`} fill="url(#kc-g)" />
        ))}
      </svg>
      {children}
      {/* foil sheen sweep */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="kc-sheen absolute -inset-y-6 w-[34%]"
          style={{ left: 0, background: "linear-gradient(90deg, transparent, rgba(255,240,190,.28), transparent)" }}
        />
      </div>
     
    </div>
  );
}

function Index({ style, rank }) {
  return (
    <div className="absolute flex flex-col items-center leading-none" style={style}>
      <span className="font-serif text-[40px] font-bold" style={{ ...goldText, filter: "drop-shadow(0 2px 2px rgba(0,0,0,.6))" }}>
        {rank}
      </span>
      <svg width="23" height="27" viewBox="0 0 100 120" className="mt-1.5">
        <path d={SPADE} fill="url(#kc-g)" />
      </svg>
    </div>
  );
}

/* ---------- FRONT: King of Spades (no crown) ---------- */
function Front({ fx, initials, name, time, liveLabel, rank, frontTitle }) {
  const nameU = name.toUpperCase();
  const fs = nameFs(nameU);
  return (
    <CardBase fx={fx} rays>
      {DUST.map((p, i) => (
        <span
          key={i}
          className="kc-dust pointer-events-none absolute rounded-full"
          style={{
            left: `${p.left}%`, bottom: `${p.bottom}%`, width: p.size, height: p.size,
            background: "#f6dc8c", boxShadow: "0 0 6px rgba(255,210,100,.9)",
            animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
          }}
        />
      ))}

      <Index rank={rank} style={{ left: 28, top: 26 }} />
      <Index rank={rank} style={{ right: 28, bottom: 26, transform: "rotate(180deg)" }} />

      {/* live pill */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-[5px] font-mono text-[8.5px] uppercase tracking-[0.2em]"
        style={{ top: 30, color: "#e8c15a", background: "rgba(240,203,98,.07)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.35)" }}
      >
        <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" style={{ boxShadow: "0 0 6px #4ade80" }} />
        {liveLabel} {time}
      </div>

      <svg
        width={CW}
        height={CH}
        viewBox={`0 0 ${CW} ${CH}`}
        className="pointer-events-none absolute inset-0"
        style={{ overflow: "visible" }}
      >
        <g style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,.55))" }}>
          {/* dark disc + rings (the bezel ticks turn slowly) */}
          <circle cx={CX} cy={CY} r="95" fill="url(#kc-disc)" />
          <circle cx={CX} cy={CY} r="108" fill="none" stroke="url(#kc-g)" strokeWidth="1.4" />
          <g className="kc-bezel">
            <circle cx={CX} cy={CY} r="101" fill="none" stroke="rgba(240,203,98,.8)" strokeWidth="5" strokeDasharray="1.1 5.8" />
          </g>
          <circle cx={CX} cy={CY} r="94" fill="none" stroke="url(#kc-g)" strokeWidth="1" />

          {/* laurel wreath */}
          {[false, true].map((mirror) => (
            <g key={String(mirror)} transform={mirror ? `translate(${CW} 0) scale(-1 1)` : undefined}>
              <path d={STEM} fill="none" stroke="url(#kc-g)" strokeWidth="1.6" strokeLinecap="round" />
              {WREATH.map((l, i) => (
                <g key={i} transform={`translate(${l.x} ${l.y})`}>
                  {[38, -38].map((off) => (
                    <path
                      key={off}
                      d={LEAF}
                      transform={`rotate(${l.a + off})`}
                      fill="url(#kc-g)"
                      stroke="rgba(70,40,0,.55)"
                      strokeWidth=".5"
                    />
                  ))}
                </g>
              ))}
            </g>
          ))}

          {/* the spade: bevelled gold with embossed initials */}
          <g transform={`translate(${CX - 67.5} ${CY - 77}) scale(1.35)`}>
            <path d={SPADE} fill="url(#kc-g)" stroke="#5a3d08" strokeWidth=".6" />
            <path d={SPADE} fill="url(#kc-shade)" />
            <path
              d={SPADE}
              fill="none"
              stroke="rgba(70,40,0,.5)"
              strokeWidth=".7"
              transform="translate(50 60) scale(.8) translate(-50 -60)"
            />
            <ellipse cx="32" cy="38" rx="8" ry="13" fill="#fff" opacity=".3" transform="rotate(28 32 38)" />
            <text x="50.7" y="70.8" textAnchor="middle" fontFamily="Georgia, serif" fontSize="21" fontWeight="700" fill="rgba(255,240,190,.55)">
              {initials}
            </text>
            <text x="50" y="70" textAnchor="middle" fontFamily="Georgia, serif" fontSize="21" fontWeight="700" fill="#4a3008">
              {initials}
            </text>
          </g>

          {/* ribbon banner with your name */}
          <path
            d={`M62 ${CY + 72} L92 ${CY + 72} L92 ${CY + 100} L62 ${CY + 100} L72 ${CY + 86} Z`}
            fill="#9a6b13" stroke="rgba(60,35,0,.6)" strokeWidth=".6"
          />
          <path
            d={`M268 ${CY + 72} L238 ${CY + 72} L238 ${CY + 100} L268 ${CY + 100} L258 ${CY + 86} Z`}
            fill="#9a6b13" stroke="rgba(60,35,0,.6)" strokeWidth=".6"
          />
          <path d={`M88 ${CY + 66} H242 V${CY + 94} H88 Z`} fill="url(#kc-g)" stroke="rgba(60,35,0,.6)" strokeWidth=".7" />
          <text
            x={CX} y={CY + 84} textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700"
            fontSize={fs} letterSpacing="2.2" fill="#3b2506"
          >
            {nameU}
          </text>
        </g>

        {/* divider + title */}
        <path d="M70 388 H148 M182 388 H260" stroke="rgba(240,203,98,.5)" strokeWidth="1" />
        <path d="M165 382 L171 388 L165 394 L159 388 Z" fill="url(#kc-g)" />
        <text
          x={CX} y="416" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="9.5"
          letterSpacing="5" fill="#d9a933"
        >
          {frontTitle}
        </text>
      </svg>
    </CardBase>
  );
}

/* ---------- BACK: your data, colour cutout, links ---------- */
function Back({ fx, d, name, roleLine, email, onLink, status, time, cutout, links, shippedLabel }) {
  const stats = d.stats || [];
  const shipped = (d.shipped || []).slice(0, 2);
  const skills = (d.skills || []).slice(0, 8);
  const journey = (d.journey || []).slice(0, 2);
  const shown = (links || []).slice(0, 4);
  return (
    <CardBase fx={fx} back flip>
      <div className="absolute flex flex-col overflow-hidden" style={{ inset: 28, color: "#efe8d6" }}>
        {/* header: text on the left, colour cutout on the right */}
        <div className="relative" style={{ minHeight: 92 }}>
          <div className="min-w-0" style={{ paddingRight: cutout ? 100 : 0 }}>
            <p className="font-mono text-[9px] uppercase tracking-[0.32em]" style={{ color: "#c9972f" }}>
              {d.eyebrow} · {d.rank}♠
            </p>
            <h3 className="mt-1 truncate font-serif text-[22px] font-bold leading-tight" style={goldText}>
              {name}
            </h3>
            {roleLine && <p className="mt-0.5 truncate text-[10.5px] opacity-75">{roleLine}</p>}
            <p className="mt-1.5 flex items-center gap-1.5 text-[8.5px] uppercase tracking-[0.14em]" style={{ color: "#e8c15a" }}>
              <i className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-400" style={{ boxShadow: "0 0 6px #4ade80" }} />
              {status}
              <span className="font-mono normal-case tracking-normal opacity-80">· {time}</span>
            </p>
          </div>
          {cutout && (
            <div className="pointer-events-none absolute" style={{ right: -2, top: 0, width: 94, height: 100 }}>
              
              <img
                src={cutout}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full select-none object-contain object-bottom"
                style={{ filter: "drop-shadow(0 6px 8px rgba(0,0,0,.55))" }}
              />
            </div>
          )}
        </div>

        <div className="my-2 h-px" style={{ background: "linear-gradient(90deg, rgba(240,203,98,.7), transparent)" }} />

        <p className="line-clamp-3 text-[11px] leading-[1.45] opacity-80">{d.bio}</p>

        {stats.length > 0 && (
          <div className="mt-2.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
            {stats.map((s, i) => (
              <div
                key={i}
                className="rounded-lg px-2 py-1.5 text-center"
                style={{ background: "rgba(240,203,98,.07)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.22)" }}
              >
                <b className="block truncate font-serif text-[18px] leading-none" style={goldText}>{s.value}</b>
                <span className="mt-1 block truncate text-[8.5px] uppercase tracking-[0.14em] opacity-70">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {shipped.length > 0 && (
          <>
            <p className="mt-2.5 font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: "#c9972f" }}>{shippedLabel}</p>
            <ul className="mt-1 space-y-1">
              {shipped.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" style={{ boxShadow: "0 0 6px #4ade80" }} />
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="shrink-0 opacity-60">{p.note}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {skills.map((s, i) => (
              <span
                key={i}
                className="rounded-full px-2 py-[2px] text-[9.5px]"
                style={{ boxShadow: "inset 0 0 0 1px rgba(240,203,98,.35)" }}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {journey.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[10.5px]">
            {journey.map((j, i) => (
              <li key={i} className="truncate">
                <span className="mr-1.5 font-mono text-[8.5px] uppercase tracking-[0.2em]" style={{ color: "#c9972f" }}>
                  {j.label}
                </span>
                {j.text}
              </li>
            ))}
          </ul>
        )}

        {/* buttons + social icons */}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                   <a
            href={d.primary?.href || "#hire"}
            onClick={(e) => {
              e.stopPropagation();
              if (!d.primary?.href) {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent("open-hire"));
              }
            }}
            className="rounded-full px-3.5 py-1.5 text-[10.5px] font-semibold"
            style={{ background: GOLD, color: "#3b2506", boxShadow: "0 4px 12px rgba(0,0,0,.4)" }}
          >
            {d.primary?.label || "Hire me"} →
          </a>
          <a
            href={d.secondary?.href || "#projects"}
            onClick={(e) => { e.stopPropagation(); onLink(); }}
            className="rounded-full px-3.5 py-1.5 text-[10.5px] font-medium"
            style={{ boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5)" }}
          >
            {d.secondary?.label || "See my work"}
          </a>
          {shown.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5">
              {shown.map((l) => (
                <a
                  key={l.key + l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={l.label}
                  title={l.label}
                  onClick={(e) => e.stopPropagation()}
                  className="grid h-[26px] w-[26px] place-items-center rounded-full"
                  style={{ color: "#e8c15a", background: "rgba(240,203,98,.06)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.45)" }}
                >
                  <SocialIcon k={l.key} label={l.label} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </CardBase>
  );
}

/* ---------- the overlay: backdrop, entrance from the bell, tilt, flip, exit back into the bell ---------- */
export default function KingCard() {
  const { lang } = useSettings();
  const { profile, roles, categories, projects, t } = useData();
  const [open, setOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [landed, setLanded] = useState(false);
  const [fit, setFit] = useState(1);
  const [start, setStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const [burst, setBurst] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState(null); // { main, items } from Supabase
  const openRef = useRef(false);
  const enabledRef = useRef(true);
  const cardRef = useRef(null);
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const time = useLiveTime(open, lang);

  // load the card from the two Supabase tables
  useEffect(() => {
    let off = false;
    Promise.all([
      supabase.from("card").select("*").eq("id", 1).maybeSingle(),
      supabase.from("card_items").select("*"),
    ])
      .then(([a, b]) => {
        if (off || a.error || b.error) return;
        setRows({
          main: a.data || null,
          items: (b.data || []).filter((x) => x.visible !== false).sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0)),
        });
      })
      .catch(() => {});
    return () => { off = true; };
  }, []);

  // pointer tilt, glare and rainbow foil
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 140, damping: 16 });
  const sy = useSpring(py, { stiffness: 140, damping: 16 });
  const rY = useTransform(sx, [0, 1], [-14, 14]);
  const rX = useTransform(sy, [0, 1], [12, -12]);
  const gx = useTransform(sx, (v) => v * 100);
  const gy = useTransform(sy, (v) => v * 100);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,.34), rgba(255,255,255,0) 58%)`;
  const h0 = useTransform(sx, (v) => v * 100 - 45);
  const h1 = useTransform(sx, (v) => v * 100 - 18);
  const h2 = useTransform(sx, (v) => v * 100 + 4);
  const h3 = useTransform(sx, (v) => v * 100 + 26);
  const h4 = useTransform(sx, (v) => v * 100 + 55);
  const holo = useMotionTemplate`linear-gradient(115deg, rgba(255,90,160,0) ${h0}%, rgba(255,215,90,.22) ${h1}%, rgba(90,255,215,.16) ${h2}%, rgba(140,100,255,.2) ${h3}%, rgba(255,90,160,0) ${h4}%)`;
  const fx = { glare, holo };

  // the bell tells us where its mouth is
  useEffect(() => {
    const h = (e) => {
      if (openRef.current || !enabledRef.current) return;
      const w = window.innerWidth;
      const hh = window.innerHeight;
      const f = Math.min(1, (w - 32) / CW, (hh - 190) / CH);
      const o = e.detail || { x: w - 60, y: 60 };
      setFit(f);
      setStart({ x: (o.x - w / 2) / f, y: (o.y - hh / 2) / f, ox: o.x, oy: o.y });
      setFlipped(false);
      setLanded(false);
      setBurst((b) => b + 1);
      openRef.current = true;
      setOpen(true);
    };
    window.addEventListener("open-king-card", h);
    return () => window.removeEventListener("open-king-card", h);
  }, []);

  const close = () => {
    openRef.current = false;
    setOpen(false);
    px.set(0.5);
    py.set(0.5);
  };

  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const onMove = (e) => {
    if (!landed || reduce) return;
    const b = cardRef.current?.getBoundingClientRect();
    if (!b) return;
    px.set((e.clientX - b.left) / b.width);
    py.set((e.clientY - b.top) / b.height);
  };
  const onLeave = () => { px.set(0.5); py.set(0.5); };

  // sparks that burst when the card lands
  const sparks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 150 + Math.random() * 150;
        return {
          x: Math.cos(a) * dist, y: Math.sin(a) * dist * 0.9, s: 0.6 + Math.random() * 0.9,
          dl: 1.15 + Math.random() * 0.25, du: 0.9 + Math.random() * 0.6,
        };
      }),
    [burst]
  );

  /* ---------- DYNAMIC DATA: Supabase tables `card` + `card_items` (fallbacks only if they are missing) ---------- */
  const main = rows?.main || null;
  const items = rows?.items || [];
  const fromDb = !!main;
  enabledRef.current = !(main && main.visible === false);
  const of = (kind) => items.filter((x) => x.kind === kind);
  const S = (r, f) => tx(bi(r, f), lang);
  const tr = (k, def) => {
    const v = t(k);
    return !v || v === k ? def : v;
  };

  const catName = (id) => tx((categories || []).find((c) => c.id === id)?.name, lang);
  const autoShipped = (projects || [])
    .map((p) => ({ name: tx(p.title ?? p.name, lang), note: catName(p.categories?.[0]) }))
    .filter((p) => p.name)
    .slice(0, 2);
  const autoStats = [];
  if (projects?.length) autoStats.push({ value: String(projects.length), label: "Projects" });
  if (categories?.length) autoStats.push({ value: String(categories.length), label: "Disciplines" });
  if (roles?.length) autoStats.push({ value: String(roles.length), label: "Roles" });

  const d = fromDb
    ? {
        rank: main.rank || "K",
        eyebrow: S(main, "eyebrow") || DEFAULT_CARD.eyebrow,
        bio: S(main, "bio") || tx(profile?.bio, lang) || DEFAULT_CARD.bio,
        stats: of("stat").map((x) => ({ value: S(x, "text"), label: S(x, "label") })),
        shipped: of("shipped").map((x) => ({ name: S(x, "text"), note: S(x, "note") })),
        skills: of("skill").map((x) => S(x, "text")).filter(Boolean),
        journey: of("journey").map((x) => ({ label: S(x, "label"), text: S(x, "text") })),
        primary: { label: S(main, "primary_label") || DEFAULT_CARD.primary.label, href: main.primary_url || null },
        secondary: { label: S(main, "secondary_label") || DEFAULT_CARD.secondary.label, href: main.secondary_url || "#projects" },
      }
    : {
        ...DEFAULT_CARD,
        bio: tx(profile?.bio, lang) || DEFAULT_CARD.bio,
        stats: autoStats.length >= 2 ? autoStats : DEFAULT_CARD.stats,
        shipped: autoShipped.length ? autoShipped : DEFAULT_CARD.shipped,
      };
  const frontTitle = (fromDb && S(main, "front_title")) || DEFAULT_CARD.frontTitle;

  const name = tx(profile?.name, lang) || "Prabhat Dubey";
  const roleLine =
    (fromDb && S(main, "title")) ||
    (roles || []).map((r) => tx(r.label, lang)).filter(Boolean).join(" · ") ||
    "";
  const initials =
    (fromDb && main.initials) ||
    name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() ||
    "PD";
  const cutout = (fromDb && main.cutout_url) || profile?.photo || null;
    const status = (fromDb && S(main, "status")) || t("available");
  const liveLabel = t("local_time");

  // social links: from card_items (kind = link); GitHub / LinkedIn fall back to the profile table
  const links = of("link")
    .map((x) => ({ key: String(x.label_en || "").trim().toLowerCase(), label: S(x, "label") || x.label_en, url: x.url }))
    .filter((l) => l.url);
  if (!links.some((l) => l.key === "github") && profile?.github) links.push({ key: "github", label: "GitHub", url: profile.github });
  if (!links.some((l) => l.key === "linkedin") && profile?.linkedin) links.push({ key: "linkedin", label: "LinkedIn", url: profile.linkedin });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "card";

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const cutImg = await loadImg(cutout);
      const o = {
        rank: d.rank, initials, name, nameU: name.toUpperCase(), frontTitle,
        eyebrow: d.eyebrow, roleLine, status, time, bio: d.bio,
        stats: d.stats, shipped: d.shipped, skills: d.skills, journey: d.journey,
        links, email: profile?.email || "", shippedLabel: tr("card_shipped", "Shipped"),
      };
      let blob;
      try {
        blob = await buildPng({ ...o, cutImg });
      } catch {
        blob = await buildPng({ ...o, cutImg: null }); // photo could not be read: save without it
      }
      if (blob) saveBlob(blob, `${slug}-card.png`);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const saveContact = () => {
    const vcf = makeVcf({ name, email: profile?.email, role: roleLine, urls: links.map((l) => l.url) });
    saveBlob(new Blob([vcf], { type: "text/vcard" }), `${slug}.vcf`);
  };

  if (typeof document === "undefined") return null;

  const pill = "rounded-full px-4 py-2 text-[11px] font-semibold";

  return createPortal(
    <>
      <style>{CSS}</style>
      {/* shared gradients used by the card artwork */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="kc-g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff3bf" />
            <stop offset=".3" stopColor="#f0cb62" />
            <stop offset=".6" stopColor="#b8862b" />
            <stop offset=".82" stopColor="#f6dc8c" />
            <stop offset="1" stopColor="#c9972f" />
          </linearGradient>
          <linearGradient id="kc-shade" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,.38)" />
            <stop offset=".5" stopColor="rgba(255,255,255,0)" />
            <stop offset="1" stopColor="rgba(60,30,0,.4)" />
          </linearGradient>
          <radialGradient id="kc-disc" cx=".5" cy=".4" r=".7">
            <stop offset="0" stopColor="rgba(72,58,26,.95)" />
            <stop offset="1" stopColor="rgba(10,8,5,.95)" />
          </radialGradient>
        </defs>
      </svg>

      <AnimatePresence onExitComplete={() => { setFlipped(false); setLanded(false); }}>
        {open && (
          <motion.div
            key="bd"
            className="fixed inset-0 z-[40]"
            style={{
              background: "radial-gradient(ellipse at 50% 45%, rgba(20,14,6,.45), rgba(6,4,2,.72))",
              backdropFilter: "blur(7px)",
              WebkitBackdropFilter: "blur(7px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={close}
          />
        )}

        {open && (
          <motion.div
            key="stage"
            className="pointer-events-none fixed inset-0 z-[60]"
            role="dialog"
            aria-modal="true"
            aria-label="Utility card"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: [1, 1, 0], transition: { duration: 0.7, times: [0, 0.85, 1] } }}
          >
            {/* gold burst at the mouth of the bell */}
            <motion.div
              className="pointer-events-none absolute rounded-full"
              style={{
                left: start.ox - 40, top: start.oy - 40, width: 80, height: 80,
                background: "radial-gradient(circle, rgba(255,226,130,.95), rgba(255,200,90,.35) 45%, transparent 70%)",
              }}
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: [0.2, 2.6], opacity: [0, 1, 0] }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />

            {/* slow gold halo behind the card */}
            {!reduce && (
              <motion.div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] rounded-full"
                style={{
                  marginLeft: -360, marginTop: -360,
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, rgba(240,203,98,.28) 30deg, transparent 70deg, transparent 180deg, rgba(240,203,98,.2) 215deg, transparent 260deg)",
                  WebkitMaskImage: "radial-gradient(circle, #000 12%, transparent 66%)",
                  maskImage: "radial-gradient(circle, #000 12%, transparent 66%)",
                }}
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: landed ? 1 : 0, rotate: 360 }}
                transition={{ opacity: { duration: 0.8 }, rotate: { duration: 22, repeat: Infinity, ease: "linear" } }}
              />
            )}

            {/* sparks */}
            {!reduce &&
              sparks.map((p, i) => (
                <motion.span
                  key={`${burst}-${i}`}
                  className="pointer-events-none absolute left-1/2 top-1/2 text-[18px]"
                  style={{ color: "#f6dc8c", textShadow: "0 0 10px rgba(255,200,90,.9)" }}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                  animate={{ x: p.x, y: p.y, scale: [0, p.s, 0], opacity: [0, 1, 0] }}
                  transition={{ delay: p.dl, duration: p.du, ease: "easeOut" }}
                >
                  ✦
                </motion.span>
              ))}

            {/* card area (scaled down on small screens) */}
            <div
              className="absolute"
              style={{
                left: "50%", top: "50%", width: CW, height: CH, marginLeft: -CW / 2, marginTop: -CH / 2,
                transform: `scale(${fit})`, perspective: 1500,
              }}
            >
              <div className="kc-floatwrap" style={{ width: "100%", height: "100%", transformStyle: "preserve-3d" }}>
                <motion.div
                  ref={cardRef}
                  className="pointer-events-auto relative cursor-pointer"
                  style={{ width: CW, height: CH, transformStyle: "preserve-3d" }}
                  initial={
                    reduce
                      ? { opacity: 0, scale: 0.96 }
                      : { x: start.x, y: start.y, scale: 0.08, opacity: 0, rotateZ: 35, rotateY: 720, rotateX: 35 }
                  }
                  animate={
                    reduce
                      ? { opacity: 1, scale: 1 }
                      : {
                          // pops out of the bell, drops, swoops across, overshoots, then settles
                          x: [start.x, start.x - 20, -50, 0],
                          y: [start.y, start.y + 140, 36, 0],
                          scale: [0.08, 0.55, 1.14, 1],
                          rotateZ: [35, 18, -9, 0],
                          rotateY: [720, 400, 40, 0],
                          rotateX: [35, 20, -8, 0],
                          opacity: [0, 1, 1, 1],
                        }
                  }
                  transition={
                    reduce
                      ? { duration: 0.3 }
                      : {
                          duration: 1.5,
                          times: [0, 0.22, 0.7, 1],
                          ease: ["easeOut", "easeInOut", [0.22, 1, 0.36, 1]],
                        }
                  }
                  exit={
                    reduce
                      ? { opacity: 0 }
                      : {
                          x: start.x, y: start.y, scale: 0.08, opacity: 0, rotateZ: -25, rotateY: -360, rotateX: 20,
                          transition: { duration: 0.6, ease: [0.5, 0, 0.75, 0] },
                        }
                  }
                  onAnimationComplete={() => { if (openRef.current) setLanded(true); }}
                  onPointerMove={onMove}
                  onPointerLeave={onLeave}
                  onClick={() => { if (landed) setFlipped((f) => !f); }}
                >
                  {/* soft shadow under the card */}
                  <motion.div
                    className="pointer-events-none absolute"
                    style={{ left: 26, right: 26, bottom: -30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,.6)", filter: "blur(16px)" }}
                    initial={false}
                    animate={{ opacity: landed ? 1 : 0 }}
                  />

                  {/* tilt that follows the pointer */}
                  <motion.div style={{ width: "100%", height: "100%", rotateX: rX, rotateY: rY, transformStyle: "preserve-3d" }}>
                    {/* the flip */}
                    <motion.div
                      style={{ width: "100%", height: "100%", transformStyle: "preserve-3d" }}
                      initial={false}
                      animate={{ rotateY: flipped ? 180 : 0 }}
                      transition={{ type: "spring", stiffness: 85, damping: 13, mass: 1 }}
                    >
                      <Front
                        fx={fx}
                        initials={initials}
                        name={name}
                        time={time}
                        liveLabel={liveLabel}
                        rank={d.rank}
                        frontTitle={frontTitle}
                      />
                      <Back
                        fx={fx}
                        d={d}
                        name={name}
                        roleLine={roleLine}
                        email={profile?.email}
                        onLink={close}
                        status={status}
                        time={time}
                        cutout={cutout}
                        links={links}
                        shippedLabel={tr("card_shipped", "Shipped")}
                      />
                    </motion.div>
                  </motion.div>

                  {/* close button */}
                  <motion.button
                    type="button"
                    aria-label="Close"
                    className="absolute grid h-9 w-9 place-items-center rounded-full text-[15px] font-bold"
                    style={{
                      right: -12, top: -12, z: 60, background: GOLD, color: "#3b2506",
                      boxShadow: "0 6px 16px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.7)",
                    }}
                    initial={false}
                    animate={{ opacity: landed ? 1 : 0, scale: landed ? 1 : 0.6 }}
                    onClick={(e) => { e.stopPropagation(); close(); }}
                  >
                    ✕
                  </motion.button>

                  {/* download + save contact */}
                  <motion.div
                    className="absolute left-0 right-0 flex justify-center gap-2"
                    style={{ bottom: -56, pointerEvents: landed ? "auto" : "none" }}
                    initial={false}
                    animate={{ opacity: landed ? 1 : 0, y: landed ? 0 : 8 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); download(); }}
                      disabled={busy}
                      className={pill}
                      style={{ background: GOLD, color: "#3b2506", boxShadow: "0 6px 16px rgba(0,0,0,.45)", opacity: busy ? 0.7 : 1 }}
                    >
                      ⬇ {busy ? "…" : tr("card_download", "Download card")}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); saveContact(); }}
                      className={pill}
                      style={{ color: "#efe8d6", background: "rgba(20,14,6,.55)", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5)" }}
                    >
                      {tr("card_save", "Save contact")}
                    </button>
                  </motion.div>

                  {/* hint */}
                  <motion.p
                    className="pointer-events-none absolute left-0 right-0 text-center font-mono text-[10px] uppercase tracking-[0.3em]"
                    style={{ bottom: -92, color: "rgba(255,255,255,.75)" }}
                    initial={false}
                    animate={{ opacity: landed ? 1 : 0 }}
                  >
                    {flipped ? tr("card_tap_back", "Tap to flip back") : tr("card_tap", "Tap the card")} · {tr("card_esc", "Esc to close")}
                  </motion.p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}