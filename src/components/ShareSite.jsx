import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { tx } from "../lib/i18n";
import { track } from "../lib/analytics";

/* ---------- what you can tune ---------- */
const LIVE_URL = "https://prabhatdubeypd.github.io/"; // links made while testing on localhost use this address, so the QR works on a phone
const START_DELAY = 1800; // wait this long after the page opens before jumping to a shared section (lets the preloader finish)
const FAB_BOTTOM = 96; // distance of the share button from the bottom
const FAB_SIDE = "right"; // "left" or "right"
const FAB_AFTER = 240; // the button appears after scrolling this many pixels
const PARAM = "go";

/* ---------- texts ---------- */
const ST = {
  en: {
    share: "Share", title: "Share this site", pick: "What do you want to share?", here: "you are here",
    link: "Link", copy: "Copy", copied: "Link copied!", fail: "Could not do that. Try Copy.",
    via: "Send it", native: "Share…", whatsapp: "WhatsApp", telegram: "Telegram", x: "X", email: "Email",
    qr: "QR code", scan: "Scan to open", save: "Save QR image", saved: "QR image saved", send: "Share QR image", making: "Making…",
    close: "Close", scanTo: "Scan to open", point: "Point your camera here", subject: "Have a look",
        allApps: "All apps…", facebook: "Facebook", instagram: "Instagram",
    igCopied: "Link copied. Paste it in Instagram (story, bio or message).",
  },
  hi: {
    share: "शेयर", title: "यह साइट शेयर करें", pick: "क्या शेयर करना है?", here: "आप यहाँ हैं",
    link: "लिंक", copy: "कॉपी", copied: "लिंक कॉपी हो गया!", fail: "नहीं हो सका। कॉपी दबाएँ।",
    via: "भेजें", native: "शेयर…", whatsapp: "WhatsApp", telegram: "Telegram", x: "X", email: "ईमेल",
    qr: "QR कोड", scan: "खोलने के लिए स्कैन करें", save: "QR इमेज सेव करें", saved: "QR इमेज सेव हो गई", send: "QR इमेज शेयर करें", making: "बन रही है…",
    close: "बंद करें", scanTo: "खोलने के लिए स्कैन करें", point: "अपना कैमरा यहाँ दिखाएँ", subject: "यह देखिए",
        allApps: "सभी ऐप…", facebook: "Facebook", instagram: "Instagram",
    igCopied: "लिंक कॉपी हो गया। Instagram में (स्टोरी, बायो या मैसेज में) पेस्ट करें।",
  },
};
const SEC = {
  home: { en: "Home", hi: "होम", icon: "🏠" },
  story: { en: "My story", hi: "मेरी कहानी", icon: "📖" },
  projects: { en: "My work", hi: "मेरा काम", icon: "📚" },
  games: { en: "Games", hi: "गेम", icon: "🎮" },
  card: { en: "King card", hi: "किंग कार्ड", icon: "♠️" },
  hire: { en: "Hire me", hi: "मुझे हायर करें", icon: "💼" },
  contact: { en: "Contact", hi: "संपर्क", icon: "✉️" },
};

/* ---------- links ---------- */
const baseUrl = () => {
  try {
    const h = window.location.hostname;
    const local = h === "localhost" || h === "127.0.0.1" || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h);
    const b = local ? LIVE_URL : `${window.location.origin}${window.location.pathname}`;
    return b.replace(/[?#].*$/, "");
  } catch { return LIVE_URL; }
};
const linkFor = (target) =>
  target === "home" ? baseUrl() : `${baseUrl()}?${PARAM}=${target.split(":").map(encodeURIComponent).join(":")}`;

const readTarget = () => {
  try {
    const q = new URLSearchParams(window.location.search).get(PARAM);
    if (q) return q.slice(0, 80);
    const h = window.location.hash.replace("#", "");
    if (["home", "story", "projects", "contact"].includes(h)) return h; // old style links
  } catch { /* ignore */ }
  return null;
};
const cleanUrl = () => {
  try {
    const u = new URL(window.location.href);
    u.searchParams.delete(PARAM);
    window.history.replaceState({}, "", u.pathname + (u.search || "") + u.hash);
  } catch { /* ignore */ }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- drawing helpers ---------- */
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Devanagari', sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function rr4(ctx, x, y, w, h, r) {
  const [a, b, c, d] = r;
  ctx.beginPath();
  ctx.moveTo(x + a, y);
  ctx.lineTo(x + w - b, y);
  ctx.arcTo(x + w, y, x + w, y + b, b);
  ctx.lineTo(x + w, y + h - c);
  ctx.arcTo(x + w, y + h, x + w - c, y + h, c);
  ctx.lineTo(x + d, y + h);
  ctx.arcTo(x, y + h, x, y + h - d, d);
  ctx.lineTo(x, y + a);
  ctx.arcTo(x, y, x + a, y, a);
  ctx.closePath();
}
const rr = (ctx, x, y, w, h, r) => rr4(ctx, x, y, w, h, [r, r, r, r]);

function fit(c, text, maxW, size, weight, fam) {
  let s = size;
  c.font = `${weight} ${s}px ${fam}`;
  while (c.measureText(text).width > maxW && s > 20) { s -= 2; c.font = `${weight} ${s}px ${fam}`; }
  return s;
}

// a rounded, scannable QR: dark modules on cream, a gold spade badge in the middle (error correction H)
function paintQr(ctx, px, QR, text) {
  const q = QR.create(text, { errorCorrectionLevel: "H" });
  const n = q.modules.size;
  const quiet = 3;
  const m = px / (n + quiet * 2);
  const FG = "#1b1206", BG = "#fff8e6";
  const isFinder = (r, c) => (r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8);
  const mid = n / 2;
  const badgeR = n * 0.11;
  const dark = (r, c) =>
    r >= 0 && c >= 0 && r < n && c < n && !!q.modules.get(r, c) && !isFinder(r, c) && Math.hypot(c + 0.5 - mid, r + 0.5 - mid) >= badgeR + 1.2;

  ctx.clearRect(0, 0, px, px);
  ctx.fillStyle = BG;
  rr(ctx, 0, 0, px, px, m * 1.8);
  ctx.fill();

  ctx.fillStyle = FG;
  const R = m * 0.46;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!dark(r, c)) continue;
      const up = dark(r - 1, c), dn = dark(r + 1, c), lf = dark(r, c - 1), rt = dark(r, c + 1);
      rr4(ctx, (c + quiet) * m, (r + quiet) * m, m + 0.4, m + 0.4, [!up && !lf ? R : 0, !up && !rt ? R : 0, !dn && !rt ? R : 0, !dn && !lf ? R : 0]);
      ctx.fill();
    }
  }
  const finder = (r0, c0) => {
    const x = (c0 + quiet) * m, y = (r0 + quiet) * m;
    ctx.fillStyle = FG; rr(ctx, x, y, 7 * m, 7 * m, 2.2 * m); ctx.fill();
    ctx.fillStyle = BG; rr(ctx, x + m, y + m, 5 * m, 5 * m, 1.5 * m); ctx.fill();
    ctx.fillStyle = FG; rr(ctx, x + 2 * m, y + 2 * m, 3 * m, 3 * m, m); ctx.fill();
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);

  // the badge in the middle
  const cx = px / 2, cy = px / 2, br = badgeR * m;
  const g = ctx.createLinearGradient(cx, cy - br, cx, cy + br);
  g.addColorStop(0, "#fff3bf"); g.addColorStop(0.5, "#f0cb62"); g.addColorStop(1, "#b8862b");
  ctx.fillStyle = FG; ctx.beginPath(); ctx.arc(cx, cy, br, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = g; ctx.lineWidth = m * 0.4; ctx.beginPath(); ctx.arc(cx, cy, br - m * 0.5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = g; ctx.font = `700 ${br * 1.25}px ${SERIF}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("♠", cx, cy + br * 0.06);
}

// the poster people can post or print
async function makePoster(QR, { url, label, owner, S }) {
  const W = 1080, H = 1350;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  const bg = x.createRadialGradient(W / 2, 0, 60, W / 2, H * 0.4, H);
  bg.addColorStop(0, "#3a2e16"); bg.addColorStop(0.55, "#15110a"); bg.addColorStop(1, "#070504");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.lineWidth = 6; x.strokeStyle = "#c9972f"; rr(x, 36, 36, W - 72, H - 72, 34); x.stroke();
  x.lineWidth = 2; x.strokeStyle = "rgba(240,203,98,.35)"; rr(x, 56, 56, W - 112, H - 112, 24); x.stroke();
  const gold = (y0, y1) => {
    const q = x.createLinearGradient(0, y0, 0, y1);
    q.addColorStop(0, "#fff3bf"); q.addColorStop(0.35, "#f0cb62"); q.addColorStop(0.7, "#b8862b"); q.addColorStop(1, "#f6dc8c");
    return q;
  };
  x.textAlign = "center"; x.textBaseline = "alphabetic";
  x.fillStyle = "#c9972f"; x.font = `600 30px ${MONO}`;
  x.fillText(String(S.scanTo).toUpperCase(), W / 2, 170);
  fit(x, label, W - 200, 86, 700, SERIF);
  x.fillStyle = gold(200, 300); x.fillText(label, W / 2, 290);

  const qs = 700;
  const qc = document.createElement("canvas");
  qc.width = qs; qc.height = qs;
  paintQr(qc.getContext("2d"), qs, QR, url);
  x.save();
  x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 50; x.shadowOffsetY = 24;
  x.fillStyle = "#fff8e6"; rr(x, (W - qs) / 2, 350, qs, qs, 40); x.fill();
  x.restore();
  x.drawImage(qc, (W - qs) / 2, 350);

  x.fillStyle = "#efe8d6"; fit(x, S.point, W - 200, 46, 700, SERIF);
  x.fillText(S.point, W / 2, 1160);
  if (owner) { x.fillStyle = "#e8c15a"; x.font = `500 34px ${SANS}`; x.fillText(owner, W / 2, 1215); }
  let host = url;
  try { host = new URL(url).host; } catch { /* keep url */ }
  x.fillStyle = "#c9972f"; x.font = `500 28px ${MONO}`; x.fillText(host, W / 2, 1268);

  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
}

function saveBlob(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

/* =====================================================================
   THE COMPONENT: share button + share window + opening of shared links
   ===================================================================== */
export default function ShareSite() {
  const { lang } = useSettings();
  const { profile, categories, t, features } = useData();
  const S = ST[lang] || ST.en;
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("home");
  const [here, setHere] = useState("home");
  const [QR, setQR] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const cvRef = useRef(null);
  const bookRef = useRef(null);
  const catRef = useRef([]);
  catRef.current = categories || [];

  const tr = (k, d) => {
    const v = t(k);
    return !v || v === k ? d : v;
  };
  const L = (o) => (lang === "hi" ? o.hi : o.en);
  const items = [
    { id: "home", label: tr("home", L(SEC.home)), icon: SEC.home.icon },
    { id: "story", label: tr("story", L(SEC.story)), icon: SEC.story.icon },
    { id: "projects", label: L(SEC.projects), icon: SEC.projects.icon },
    ...catRef.current.map((c) => ({ id: `book:${c.id}`, label: tx(c.name, lang), icon: "📕" })),
    { id: "games", label: L(SEC.games), icon: SEC.games.icon },
    { id: "card", label: L(SEC.card), icon: SEC.card.icon },
    { id: "hire", label: L(SEC.hire), icon: SEC.hire.icon },
    { id: "contact", label: tr("contact", L(SEC.contact)), icon: SEC.contact.icon },
  ];
  const labelOf = (id) => (items.find((i) => i.id === id) || {}).label || id;
  const url = linkFor(target);
  const label = labelOf(target);
  const owner = tx(profile?.name, lang) || "";
  const text = `${owner ? `${owner} · ` : ""}${label}`;
  const canNative = typeof navigator !== "undefined" && !!navigator.share;
  const flash = (m) => { setNote(m); setTimeout(() => setNote(""), 2600); };

  // which part of the site is on screen right now
  const currentSection = () => {
    if (bookRef.current != null) return `book:${bookRef.current}`;
    const vh = window.innerHeight;
    let cur = "home";
    ["story", "projects", "contact"].forEach((id) => {
      const e = document.getElementById(id);
      if (e && e.getBoundingClientRect().top <= vh * 0.45) cur = id;
    });
    return cur;
  };

  /* ----- events, scroll ----- */
  useEffect(() => {
    const onOpen = (e) => {
      const c = currentSection();
      setHere(c);
      setTarget((e.detail && e.detail.target) || c);
      setNote("");
      setOpen(true);
      track("share_open");
    };
    const onBook = (e) => { bookRef.current = e.detail == null ? null : e.detail; };
    const onScroll = () => setScrolled(window.scrollY > FAB_AFTER);
    window.addEventListener("open-share", onOpen);
    window.addEventListener("book-active", onBook);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("open-share", onOpen);
      window.removeEventListener("book-active", onBook);
      window.removeEventListener("scroll", onScroll);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    window.addEventListener("keydown", k, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k, true); document.body.style.overflow = prev; };
  }, [open]);

  // the QR library is loaded only when the window is first opened
  useEffect(() => {
    if (!open || QR) return;
    import("qrcode").then((m) => setQR(m.default && m.default.create ? m.default : m)).catch(() => {});
  }, [open, QR]);

  useEffect(() => {
    if (!open || !QR || !cvRef.current) return;
    try { paintQr(cvRef.current.getContext("2d"), 720, QR, url); } catch { /* ignore */ }
  }, [open, QR, url]);

  /* ----- opening a shared link ----- */
  useEffect(() => {
    const first = readTarget();
    if (!first) return undefined;
    let dead = false;
    const el = (id) => document.getElementById(id);
    const waitFor = async (id) => {
      for (let i = 0; i < 50 && !dead; i++) { if (el(id)) return el(id); await wait(250); }
      return null;
    };
    (async () => {
      await wait(START_DELAY);
      if (dead) return;
      cleanUrl();
      const tg = first;
      if (tg === "home") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      if (tg === "story" || tg === "contact") {
        const e = await waitFor(tg);
        if (e && !dead) { await wait(500); e.scrollIntoView({ behavior: "smooth", block: "start" }); }
        return;
      }
      if (tg === "projects") {
        await waitFor("projects");
        await wait(500);
        if (!dead) window.dispatchEvent(new CustomEvent("go-room"));
        return;
      }
      if (tg.startsWith("book:")) {
        const id = tg.slice(5);
        for (let i = 0; i < 50 && !dead && !catRef.current.length; i++) await wait(250); // wait for your data
        await waitFor("projects");
        if (dead) return;
        const cat = catRef.current.find((c) => String(c.id) === id);
        const room = el("projects");
        if (room) room.scrollIntoView({ behavior: "auto", block: "start" });
        await wait(600);
        if (dead) return;
        window.dispatchEvent(cat ? new CustomEvent("open-book", { detail: cat.id }) : new CustomEvent("go-room"));
        return;
      }
      const mid = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      if (tg === "games") window.dispatchEvent(new CustomEvent("open-king-games", { detail: mid }));
      else if (tg === "hire") window.dispatchEvent(new CustomEvent("open-hire"));
      else if (tg === "card") window.dispatchEvent(new CustomEvent("open-king-card", { detail: mid }));
    })();
    return () => { dead = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- actions ----- */
  const copy = async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch { /* try the old way */ }
    if (!ok) {
      try {
        const a = document.createElement("textarea");
        a.value = url; a.style.position = "fixed"; a.style.opacity = "0";
        document.body.appendChild(a); a.select();
        ok = document.execCommand("copy");
        a.remove();
      } catch { ok = false; }
    }
    flash(ok ? S.copied : S.fail);
    if (ok) track("share_copy", { target });
  };
  const nativeShare = async () => {
    try { await navigator.share({ title: label, text, url }); track("share_native", { target }); } catch { /* cancelled */ }
  };
  const go = (href, via) => { window.open(href, "_blank", "noopener,noreferrer"); track("share_via", { via, target }); };
  const poster = async () => {
    const lib = QR || (await import("qrcode")).default;
    return makePoster(lib, { url, label, owner, S });
  };
  const savePng = async () => {
    if (busy) return;
    setBusy(true);
    try { saveBlob(await poster(), `qr-${target.replace(/[^a-z0-9]+/gi, "-")}.png`); flash(S.saved); track("share_qr_save", { target }); }
    catch { flash(S.fail); }
    setBusy(false);
  };
  const sendPng = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await poster();
      const file = new File([blob], "qr.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: label, text: `${text} ${url}` });
      else { saveBlob(blob, "qr.png"); flash(S.saved); }
    } catch (e) { if (e && e.name !== "AbortError") flash(S.fail); }
    setBusy(false);
  };

    const facebook = () => go(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "facebook");
  const instagram = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // phones: send the QR poster through the share sheet, then pick Instagram there
      const probe = new File(["x"], "a.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [probe] })) {
        const blob = await poster();
        const file = new File([blob], "qr.png", { type: "image/png" });
        await navigator.share({ files: [file], title: label, text: `${text} ${url}` });
        track("share_via", { via: "instagram", target });
      } else {
        // computers: Instagram has no link-sharing address, so copy the link and open Instagram
        await copy();
        flash(S.igCopied);
        window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
        track("share_via", { via: "instagram", target });
      }
    } catch (e) { if (e && e.name !== "AbortError") flash(S.fail); }
    setBusy(false);
  };
  const dot = (c) => <i className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: c }} />;

  const chip = (on) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${on ? "border-transparent bg-btn text-btn-ink" : "border-line hover:bg-ink/5"}`;
  const act = "rounded-full border border-line px-3.5 py-2 text-xs font-medium transition hover:bg-ink/10 active:scale-95";
  const fab = features && features.shareSite === false ? false : true;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <AnimatePresence>
        {fab && scrolled && !open && (
          <motion.button
            key="fab" type="button" aria-label={S.share} title={S.share}
            onClick={() => window.dispatchEvent(new CustomEvent("open-share"))}
            initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.4 }}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
            className="fixed z-[44] grid h-11 w-11 place-items-center rounded-full bg-btn text-btn-ink shadow-[0_10px_28px_rgba(0,0,0,.3)]"
            style={{ bottom: FAB_BOTTOM, [FAB_SIDE]: 12 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="share" role="dialog" aria-modal="true" aria-label={S.title} data-share-modal
            className="fixed inset-0 z-[85] grid place-items-center overflow-y-auto p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
          >
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

            <motion.div
              className="relative my-6 w-full max-w-md rounded-3xl border border-line bg-bg p-5 text-ink shadow-[0_40px_100px_rgba(0,0,0,.45)] md:p-6"
              initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            >
              <button
                type="button" aria-label={S.close} onClick={() => setOpen(false)}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-line text-sm transition hover:bg-ink/10"
              >
                ✕
              </button>

              <h3 className="pr-10 font-serif text-2xl font-bold leading-tight">{S.title}</h3>
              <p className="mt-1 text-xs opacity-65">{S.pick}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {items.map((it) => (
                  <button key={it.id} type="button" onClick={() => setTarget(it.id)} className={chip(target === it.id)}>
                    <span>{it.icon}</span>
                    {it.label}
                    {it.id === here && <i className="ml-0.5 h-1.5 w-1.5 rounded-full bg-accent" title={S.here} />}
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.2em] opacity-60">{S.link}</label>
              <div className="mt-1.5 flex items-stretch gap-2">
                <input
                  readOnly value={url} onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 rounded-xl border border-line bg-ink/5 px-3 py-2.5 text-xs outline-none"
                />
                <button type="button" onClick={copy} className="rounded-xl bg-btn px-4 text-xs font-semibold text-btn-ink transition active:scale-95">{S.copy}</button>
              </div>

               <div className="mt-4 flex flex-wrap gap-2">
                {canNative && (
                  <button type="button" onClick={nativeShare} className="rounded-full bg-btn px-4 py-2 text-xs font-semibold text-btn-ink transition active:scale-95">
                    ↗ {S.allApps}
                  </button>
                )}  
                <button type="button" onClick={instagram} disabled={busy} className={`${act} disabled:opacity-60`}>{dot("#E1306C")}{S.instagram}</button>
                <button type="button" onClick={facebook} className={act}>{dot("#1877F2")}{S.facebook}</button>
                <button type="button" onClick={() => go(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "whatsapp")} className={act}>{dot("#25D366")}{S.whatsapp}</button>
                <button type="button" onClick={() => go(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "telegram")} className={act}>{dot("#27A7E7")}{S.telegram}</button>
                <button type="button" onClick={() => go(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "x")} className={act}>{S.x}</button>
                <button type="button" onClick={() => go(`mailto:?subject=${encodeURIComponent(`${S.subject}: ${label}`)}&body=${encodeURIComponent(`${text}\n${url}`)}`, "email")} className={act}>{S.email}</button>
              </div>

              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] opacity-60">{S.qr}</p>
              <div className="mt-2 flex flex-col items-center rounded-2xl border border-line bg-ink/5 p-4">
                <div className="rounded-2xl p-1" style={{ background: "#fff8e6", boxShadow: "0 12px 30px rgba(0,0,0,.25)" }}>
                  <canvas ref={cvRef} width={720} height={720} style={{ width: 208, height: 208, display: "block", borderRadius: 14 }} />
                </div>
                {!QR && <p className="mt-2 text-xs opacity-60">…</p>}
                <p className="mt-3 text-center text-xs font-semibold">{S.scan}: {label}</p>
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={savePng} disabled={busy} className={`${act} disabled:opacity-60`}>⬇ {busy ? S.making : S.save}</button>
                {canNative && <button type="button" onClick={sendPng} disabled={busy} className={`${act} disabled:opacity-60`}>🖼 {S.send}</button>}
              </div>

              <p className="mt-3 min-h-[16px] text-center text-xs font-semibold text-accent">{note}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}