import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { useSettings } from "../context/SettingsContext";
import { openCal } from "../lib/cal";
import { track } from "../lib/analytics";

const GOLD = "linear-gradient(180deg,#fff3bf 0%,#f0cb62 30%,#b8862b 58%,#f6dc8c 80%,#c9972f 100%)";
const goldText = { backgroundImage: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
const PANEL = {
  background: "linear-gradient(160deg, rgba(48,42,32,.9), rgba(16,13,9,.95))",
  boxShadow: "inset 0 0 0 1px rgba(240,203,98,.45), 0 12px 26px rgba(0,0,0,.4)",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CSS = `
@keyframes lb-sheen{0%{transform:translateX(-160%) skewX(-20deg)}60%,100%{transform:translateX(560%) skewX(-20deg)}}
@keyframes lb-dust{0%{transform:translateY(0) scale(.6);opacity:0}20%{opacity:.8}100%{transform:translateY(-170px) scale(1);opacity:0}}
@keyframes lb-spin{to{transform:rotate(360deg)}}
@keyframes lb-pulse{0%,100%{opacity:.35}50%{opacity:.75}}
.lb-sheen{animation:lb-sheen 6s ease-in-out infinite}
.lb-dust{animation:lb-dust 8s ease-in infinite}
.lb-spin{animation:lb-spin 9s linear infinite}
.lb-pulse{animation:lb-pulse 1.4s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.lb-sheen,.lb-dust,.lb-spin,.lb-pulse{animation:none}}
`;

/* ---------- what shows if the Supabase tables are not created yet ---------- */
const DEFAULT_ROWS = [
  { id: "d1", slug: "hire", kind: "hire", style: "button", highlight: true, icon: "hire", sort: 1, label_en: "Hire me", label_hi: "मुझे हायर करें", sub_en: "Tell me about your project", sub_hi: "अपना प्रोजेक्ट बताइए" },
  { id: "d2", slug: "call", kind: "call", style: "button", icon: "call", sort: 2, label_en: "Book a 15-min call", label_hi: "15 मिनट की कॉल बुक करें", sub_en: "Pick a free slot", sub_hi: "खाली स्लॉट चुनें" },
  { id: "d3", slug: "portfolio", kind: "site", style: "button", icon: "site", sort: 3, url: "/", label_en: "See my full portfolio", label_hi: "मेरा पूरा पोर्टफोलियो", sub_en: "Books, story and more", sub_hi: "बुक्स, कहानी और बहुत कुछ" },
];

/* ---------- where the visitor came from ---------- */
function srcOf(u) {
  const p = (u.searchParams.get("src") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
  if (p) return p;
  try {
    const h = new URL(document.referrer).hostname.replace(/^www\./, "");
    if (/instagram|l\.instagram/.test(h)) return "instagram";
    if (/linkedin|lnkd/.test(h)) return "linkedin";
    if (/whatsapp|wa\.me/.test(h)) return "whatsapp";
    if (/t\.co|twitter|x\.com/.test(h)) return "x";
    if (h) return h.slice(0, 24);
  } catch { /* no referrer */ }
  return "direct";
}

/* /links  /hire  /call ... (the 404 page turns them into ?l=hire; in dev the path works directly) */
export function readRoute() {
  try {
    const u = new URL(window.location.href);
    let slug = (u.searchParams.get("l") || "").toLowerCase();
    if (!slug && u.searchParams.has("links")) slug = "links";
    if (!slug) {
      const seg = u.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
      if (/^[a-z0-9-]{1,32}$/.test(seg) && !/^index/.test(seg)) slug = seg;
    }
    if (slug === "bio") slug = "links";
    if (!/^[a-z0-9-]{1,32}$/.test(slug)) return null;
    return { slug, src: srcOf(u) };
  } catch { return null; }
}

const cleanUrl = () => {
  try { window.history.replaceState({}, "", "/" + window.location.hash); } catch { /* ignore */ }
};

/* counts one click (never throws, never blocks) */
const logClick = (o) =>
  supabase
    .from("link_clicks")
    .insert({
      slug: String(o.slug || "unknown").slice(0, 40),
      kind: o.kind ? String(o.kind).slice(0, 12) : null,
      via: o.via,
      src: String(o.src || "direct").slice(0, 24),
      device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop",
    })
    .then(() => {}, () => {});

/* ---------- icons ---------- */
const PATH = {
  hire: "M4 8h16v11H4z M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M4 13h16",
  call: "M3 6h18v15H3z M8 3v4 M16 3v4 M3 11h18",
  resume: "M7 3h8l4 4v14H7z M15 3v4h4 M10 13h6 M10 17h6",
  project: "M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3-5.6-3-5.6 3 1.2-6.3L3 9.6l6.3-.8z",
  site: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.5 2.7 2.5 15.3 0 18 M12 3c-2.5 2.7-2.5 15.3 0 18",
  mail: "M3 6h18v12H3z M3 7l9 6 9-6",
  whatsapp: "M20 12a8 8 0 0 1-11.9 7L4 20l1.1-4A8 8 0 1 1 20 12z M9.2 9c.4 2.4 2.4 4.4 4.8 4.8l1.1-1.1-1.7-.9-.9.7c-.7-.3-1.4-1-1.7-1.7l.7-.9-.9-1.7z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
};
function Icon({ k, size = 20 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24" };
  if (k === "instagram")
    return (
      <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".9" fill="currentColor" />
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
  return (
    <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATH[k] || PATH.link} />
    </svg>
  );
}

/* ---------- data: profile, page settings and the buttons ---------- */
function useBio() {
  const [d, setD] = useState({ ready: false, profile: null, page: null, rows: null });
  useEffect(() => {
    let dead = false;
    Promise.all([
      supabase.from("profile").select("*").limit(1),
      supabase.from("bio_page").select("*").eq("id", 1).maybeSingle(),
      supabase.from("bio_links").select("*"),
    ])
      .then(([p, pg, r]) => {
        if (dead) return;
        setD({ ready: true, profile: (p.data && p.data[0]) || null, page: pg.error ? null : pg.data || null, rows: r.error ? null : r.data });
      })
      .catch(() => { if (!dead) setD({ ready: true, profile: null, page: null, rows: null }); });
    return () => { dead = true; };
  }, []);
  return d;
}

/* =====================  THE BIO PAGE  ===================== */
export default function LinkBio({ route }) {
  const { lang, setLang } = useSettings();
  const reduce = useReducedMotion();
  const d = useBio();
  const hi = lang === "hi";
  const dust = useMemo(
    () => Array.from({ length: 14 }, () => ({
      left: 4 + Math.random() * 92, bottom: Math.random() * 40, size: 1.5 + Math.random() * 2.5,
      delay: -Math.random() * 8, dur: 6 + Math.random() * 5,
    })),
    []
  );

  const p = d.profile || {};
  const page = d.page || {};
  const name = (hi && p.name_hi) || p.name_en || "";
  const photo = page.photo_url || p.photo_url || "";
  const tagline = (hi && page.tagline_hi) || page.tagline_en || "";
  const status = (hi && page.status_hi) || page.status_en || (hi ? "फ्रीलांस काम के लिए उपलब्ध" : "Available for freelance work");
  const txt = (r, f) => (hi && r[`${f}_hi`]) || r[`${f}_en`] || "";

  const all = (d.rows && d.rows.length ? d.rows : DEFAULT_ROWS)
    .filter((r) => r.enabled !== false && (r.kind !== "url" || r.url))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const buttons = all.filter((r) => r.style !== "icon");
  const icons = all.filter((r) => r.style === "icon");

  // the page can be switched off from Supabase
  useEffect(() => { if (page.enabled === false) window.location.replace("/"); }, [page.enabled]);

  // count the page view once per visit, and tidy the address
  useEffect(() => {
    let seen = false;
    try { seen = !!sessionStorage.getItem("bio_view"); sessionStorage.setItem("bio_view", "1"); } catch { /* ignore */ }
    if (!seen) { logClick({ slug: "links", via: "view", src: route.src }); track("bio_view"); }
    try { window.history.replaceState({}, "", "/links" + (route.src && route.src !== "direct" ? `?src=${route.src}` : "")); } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (name) document.title = `${name} · Links`; }, [name]);

  // dark background behind the page, also while the phone over-scrolls
  useEffect(() => {
    const html = document.documentElement;
    const prev = [html.style.background, document.body.style.background];
    html.style.background = "#070504";
    document.body.style.background = "#070504";
    return () => { html.style.background = prev[0]; document.body.style.background = prev[1]; };
  }, []);

  const go = (r) => {
    logClick({ slug: r.slug || `id-${r.id}`, kind: r.kind, via: "bio", src: route.src });
    track("bio_click", { slug: r.slug || `id-${r.id}` });
    if (r.kind === "hire") window.dispatchEvent(new CustomEvent("open-hire"));
    else if (r.kind === "call") openCal();
    else if (r.kind === "site") setTimeout(() => { window.location.href = r.url || "/"; }, 250);
    else if (r.url) {
      if (/^https?:/i.test(r.url)) window.open(r.url, "_blank", "noopener,noreferrer");
      else setTimeout(() => { window.location.href = r.url; }, 150);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[40] overflow-y-auto text-[#efe8d6]"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #3a2e16 0%, #15110a 55%, #070504 100%)" }}
    >
      <style>{CSS}</style>

      {/* floating gold dust */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {dust.map((q, i) => (
          <span
            key={i} className="lb-dust absolute rounded-full"
            style={{ left: `${q.left}%`, bottom: `${q.bottom}%`, width: q.size, height: q.size, background: "#f6dc8c", boxShadow: "0 0 6px rgba(255,210,100,.9)", animationDelay: `${q.delay}s`, animationDuration: `${q.dur}s` }}
          />
        ))}
      </div>

      <button
        type="button" onClick={() => setLang(hi ? "en" : "hi")}
        className="fixed right-4 top-4 z-10 rounded-full px-3 py-1.5 text-xs font-semibold"
        style={{ boxShadow: "inset 0 0 0 1px rgba(240,203,98,.5)", background: "rgba(20,14,6,.65)" }}
      >
        {hi ? "EN" : "हिं"}
      </button>

      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col items-center px-5 pb-10 pt-14">
        {/* photo with a slowly turning gold ring */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 15 }}
          className="relative h-28 w-28"
        >
          <div
            className="lb-spin absolute -inset-[3px] rounded-full"
            style={{ background: "conic-gradient(from 0deg, #fff3bf, #b8862b, #f0cb62, #6e5220, #fff3bf)", filter: "drop-shadow(0 0 14px rgba(240,203,98,.45))" }}
          />
          <div className="absolute inset-0 overflow-hidden rounded-full" style={{ background: "#0a0806", boxShadow: "inset 0 0 0 3px #0a0806" }}>
            {d.ready && photo ? (
              <img src={photo} alt={name} width="112" height="112" draggable={false} className="h-full w-full object-cover object-top" style={{ padding: 3, borderRadius: "50%" }} />
            ) : d.ready ? (
              <div className="grid h-full w-full place-items-center font-serif text-4xl font-bold" style={goldText}>{(name || "P").slice(0, 1)}</div>
            ) : (
              <div className="lb-pulse h-full w-full" style={{ background: "rgba(240,203,98,.15)" }} />
            )}
          </div>
        </motion.div>

        {d.ready ? (
          <>
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-5 text-center font-serif text-[28px] font-bold leading-tight" style={goldText}>
              {name}
            </motion.h1>
            {tagline && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: 0.25 }} className="mt-1 text-center text-[13px]">
                {tagline}
              </motion.p>
            )}
            {page.show_status !== false && status && (
              <motion.p
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}
                className="mt-3 flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ boxShadow: "inset 0 0 0 1px rgba(240,203,98,.45)", background: "rgba(20,14,6,.6)", color: "#f0cb62" }}
              >
                <i className="h-2 w-2 animate-pulse rounded-full bg-green-400" style={{ boxShadow: "0 0 8px #4ade80" }} />
                {status}
              </motion.p>
            )}
          </>
        ) : (
          <div className="mt-5 flex flex-col items-center gap-2">
            <div className="lb-pulse h-8 w-48 rounded-lg" style={{ background: "rgba(240,203,98,.15)" }} />
            <div className="lb-pulse h-4 w-56 rounded" style={{ background: "rgba(240,203,98,.1)" }} />
          </div>
        )}

        {/* the big buttons */}
        <div className="mt-7 w-full space-y-3">
          {!d.ready
            ? [0, 1, 2].map((i) => <div key={i} className="lb-pulse h-[64px] w-full rounded-2xl" style={{ background: "rgba(240,203,98,.1)" }} />)
            : buttons.map((r, i) => (
                <motion.button
                  key={r.id} type="button" onClick={() => go(r)}
                  initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.07, type: "spring", stiffness: 160, damping: 18 }}
                  whileHover={reduce ? undefined : { y: -3, scale: 1.015 }} whileTap={{ scale: 0.97 }}
                  className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 text-left"
                  style={r.highlight ? { background: GOLD, color: "#3b2506", boxShadow: "0 14px 30px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.7)" } : PANEL}
                >
                  <span className="pointer-events-none absolute inset-0 overflow-hidden">
                    <i className="lb-sheen absolute -inset-y-6 w-1/3" style={{ left: 0, animationDelay: `${i * 0.8}s`, background: `linear-gradient(90deg, transparent, ${r.highlight ? "rgba(255,255,255,.5)" : "rgba(255,240,190,.16)"}, transparent)` }} />
                  </span>
                  <span
                    className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full"
                    style={r.highlight ? { background: "rgba(59,37,6,.14)", color: "#3b2506" } : { background: "rgba(240,203,98,.12)", color: "#f0cb62", boxShadow: "inset 0 0 0 1px rgba(240,203,98,.4)" }}
                  >
                    <Icon k={r.icon || (r.kind === "hire" ? "hire" : r.kind === "call" ? "call" : r.kind === "site" ? "site" : "link")} />
                  </span>
                  <span className="relative min-w-0 flex-1">
                    <b className="block truncate font-serif text-[16px] leading-tight">{txt(r, "label")}</b>
                    {txt(r, "sub") && <span className="mt-0.5 block truncate text-[11px] opacity-70">{txt(r, "sub")}</span>}
                  </span>
                  <span className="relative text-lg opacity-70">›</span>
                </motion.button>
              ))}
        </div>

        {/* social icons */}
        {d.ready && icons.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {icons.map((r, i) => (
              <motion.button
                key={r.id} type="button" onClick={() => go(r)} aria-label={txt(r, "label")} title={txt(r, "label")}
                initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55 + i * 0.06, type: "spring", stiffness: 200, damping: 14 }}
                whileHover={{ y: -4, scale: 1.1 }} whileTap={{ scale: 0.9 }}
                className="grid h-11 w-11 place-items-center rounded-full"
                style={{ ...PANEL, color: "#f0cb62" }}
              >
                <Icon k={r.icon || "link"} size={20} />
              </motion.button>
            ))}
          </div>
        )}

        <p className="mt-auto pt-10 text-center text-[10px] opacity-50">© {new Date().getFullYear()} {name}</p>
      </main>
    </div>
  );
}

/* =====================  SHORT LINKS: /hire /call /resume ...  =====================
   Looks the slug up, counts the click, then either sends the visitor on (url / site),
   or opens the normal site and runs the action (hire / call). */
async function lookup(slug) {
  try {
    const q = supabase.from("bio_links").select("*").eq("slug", slug).eq("enabled", true).limit(1);
    const r = await Promise.race([q.then((x) => x), sleep(4000).then(() => null)]);
    return r && r.data && r.data[0] ? r.data[0] : null;
  } catch { return null; }
}

export function LinkGate({ route, done }) {
  useEffect(() => {
    let dead = false;
    (async () => {
      const row = await lookup(route.slug);
      if (dead) return;
      if (!row) { cleanUrl(); done(); return; }
      await Promise.race([logClick({ slug: row.slug, kind: row.kind, via: "short", src: route.src }), sleep(800)]);
      if (dead) return;
      track("short_link", { slug: row.slug });
      if (row.kind === "hire" || row.kind === "call") {
        window.__bioAction = { kind: row.kind };
        cleanUrl();
        done();
      } else if (row.url) {
        if (/^https?:|^\//i.test(row.url)) window.location.replace(row.url);
        else { window.location.href = row.url; setTimeout(() => { if (!dead) { cleanUrl(); done(); } }, 700); } // mailto: etc.
      } else { cleanUrl(); done(); }
    })();
    return () => { dead = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 grid place-items-center" style={{ background: "radial-gradient(ellipse at 50% 0%, #3a2e16 0%, #15110a 55%, #070504 100%)" }}>
      <div className="text-center">
        <motion.div
          className="mx-auto h-10 w-10 rounded-full" style={{ border: "3px solid rgba(240,203,98,.25)", borderTopColor: "#f0cb62" }}
          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: "#c9972f" }}>Opening…</p>
      </div>
    </div>
  );
}

/* runs the action that a short link asked for, once the site is on screen */
export function LinkAction() {
  useEffect(() => {
    const a = window.__bioAction;
    if (!a) return undefined;
    window.__bioAction = null;
    const t = setTimeout(() => {
      if (a.kind === "hire") window.dispatchEvent(new CustomEvent("open-hire"));
      else if (a.kind === "call") openCal();
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  return null;
}