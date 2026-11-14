import { useEffect } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import Lenis from "lenis";
import { useSettings } from "../context/SettingsContext";
import { logEvent, useSiteSettings } from "../lib/siteExtras";

const NAV_OFFSET = 72; // height of your navbar, so a section lands just below it

const CSS = `
html.lenis,html.lenis body{height:auto}
.lenis.lenis-smooth{scroll-behavior:auto!important}
.lenis.lenis-smooth [data-lenis-prevent]{overscroll-behavior:contain}
.lenis.lenis-scrolling iframe{pointer-events:none}
html.kg-reveal [data-reveal]{opacity:0;transform:translate3d(0,28px,0);transition:opacity .9s cubic-bezier(.22,1,.36,1),transform .9s cubic-bezier(.22,1,.36,1);transition-delay:var(--rd,0s)}
html.kg-reveal [data-reveal="left"]{transform:translate3d(-36px,0,0)}
html.kg-reveal [data-reveal="right"]{transform:translate3d(36px,0,0)}
html.kg-reveal [data-reveal="zoom"]{transform:scale(.94)}
html.kg-reveal [data-reveal].is-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){html.kg-reveal [data-reveal]{opacity:1;transform:none;transition:none}}
`;

function toLabel(d) {
  if (d == null || d === false || d === "") return "";
  if (typeof d === "number") return d < 0 ? "" : String(d);
  if (typeof d === "object") {
    const v = d.title ?? d.slug ?? d.key ?? d.id ?? d.name ?? d.index ?? d.i;
    if (v && typeof v === "object") return String(v.en ?? v.hi ?? "").slice(0, 60);
    return v == null ? "" : String(v).slice(0, 60);
  }
  return String(d).slice(0, 60);
}

export default function SiteExtras() {
  const { lang } = useSettings();
  const s = useSiteSettings();
  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.3 });

  /* ---- who is visiting: owner flag + one "visit" per tab ---- */
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("owner") === "1") localStorage.setItem("kg_owner", "1"); // open yoursite.com/?owner=1 once on each of your devices
      if (q.get("owner") === "0") localStorage.removeItem("kg_owner");
      if (!sessionStorage.getItem("kg_visit")) {
        sessionStorage.setItem("kg_visit", "1");
        let src = "direct";
        if (document.referrer) {
          const h = new URL(document.referrer).hostname.replace(/^www\./, "");
          if (h && h !== window.location.hostname.replace(/^www\./, "")) src = h;
        }
        logEvent("visit", src);
      }
    } catch { /* ignore */ }
  }, []);

  /* ---- Hire clicks and opened books (they listen to events your site already sends) ---- */
  useEffect(() => {
    let lastHire = 0;
    let lastBook = { k: "", t: 0 };
    const onHire = () => {
      const n = Date.now();
      if (n - lastHire < 3000) return;
      lastHire = n;
      logEvent("hire");
    };
    const onBook = (e) => {
      const k = toLabel(e.detail);
      if (!k) return;
      const n = Date.now();
      if (k === lastBook.k && n - lastBook.t < 8000) return;
      lastBook = { k, t: n };
      logEvent("book", k);
    };
    window.addEventListener("open-hire", onHire);
    window.addEventListener("book-active", onBook);
    return () => {
      window.removeEventListener("open-hire", onHire);
      window.removeEventListener("book-active", onBook);
    };
  }, []);

  /* ---- inertia scrolling (mouse and trackpad only) ---- */
  useEffect(() => {
    if (!s.smooth_on) return undefined;
    // phones and tablets keep their own native momentum: your sticky book scroller depends on it
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let lenis = null;
    let raf = 0;
    const loop = (t) => { if (lenis) lenis.raf(t); raf = requestAnimationFrame(loop); };
    const start = () => {
      if (lenis) return;
      lenis = new Lenis({
        duration: Number(s.smooth_duration) || 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        // popups with their own scrolling keep normal wheel behaviour
        prevent: (n) => !!(n.closest && n.closest('[role="dialog"], [aria-modal="true"], [data-lenis-prevent]')),
      });
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (!lenis) return;
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenis = null;
    };
    // when your code locks the page (open book, games room, hire form) smooth scrolling steps aside completely
    const locked = () => getComputedStyle(document.body).overflowY === "hidden" || getComputedStyle(document.documentElement).overflowY === "hidden";
    const sync = () => (locked() ? stop() : start());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });

    // #links glide to their section (add data-no-smooth to any #link that should NOT scroll)
    const onClick = (e) => {
      if (!lenis || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.hasAttribute("data-no-smooth")) return;
      let id = "";
      try { id = decodeURIComponent(a.getAttribute("href").slice(1)); } catch { return; }
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -NAV_OFFSET, duration: 1.4 });
    };
    // for buttons that are not #links: window.dispatchEvent(new CustomEvent("kg-scroll", { detail: "projects" }))
    const onGo = (e) => {
      const el = document.getElementById(String(e.detail || ""));
      if (!el) return;
      if (lenis) lenis.scrollTo(el, { offset: -NAV_OFFSET, duration: 1.4 });
      else el.scrollIntoView({ behavior: "smooth" });
    };
    document.addEventListener("click", onClick);
    window.addEventListener("kg-scroll", onGo);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("kg-scroll", onGo);
      mo.disconnect();
      stop();
    };
  }, [s.smooth_on, s.smooth_duration]);

  /* ---- sections that fade in as you reach them: add data-reveal to an element ---- */
  useEffect(() => {
    if (!s.reveal_on || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const root = document.documentElement;
    root.classList.add("kg-reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } }),
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );
    const scan = () => {
      document.querySelectorAll("[data-reveal]:not([data-rv])").forEach((el) => {
        el.setAttribute("data-rv", "1");
        const d = el.getAttribute("data-reveal-delay");
        if (d) el.style.setProperty("--rd", `${d}s`);
        io.observe(el);
      });
    };
    scan();
    let t = 0;
    const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 120); });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearTimeout(t); mo.disconnect(); io.disconnect();
      root.classList.remove("kg-reveal");
      document.querySelectorAll("[data-rv]").forEach((el) => { el.removeAttribute("data-rv"); el.classList.remove("is-in"); });
    };
  }, [s.reveal_on]);

  /* ---- the tab title tricks ---- */
  useEffect(() => {
    if (!s.tab_on) return undefined;
    const pick = (en, hi) => String(lang === "hi" ? hi || en || "" : en || hi || "");
    const aways = pick(s.tab_away_en, s.tab_away_hi).split("|").map((x) => x.trim()).filter(Boolean);
    const back = pick(s.tab_back_en, s.tab_back_hi).trim();
    if (!aways.length) return undefined;
    let base = document.title;
    let timer = 0;
    let backT = 0;
    let i = 0;
    const onVis = () => {
      clearInterval(timer);
      clearTimeout(backT);
      if (document.hidden) {
        base = document.title;
        i = 0;
        document.title = aways[0];
        if (aways.length > 1) timer = setInterval(() => { i = (i + 1) % aways.length; document.title = aways[i]; }, 2600);
      } else if (back) {
        document.title = back;
        backT = setTimeout(() => { document.title = base; }, 1700);
      } else document.title = base;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(timer);
      clearTimeout(backT);
      if (aways.includes(document.title) || document.title === back) document.title = base;
    };
  }, [lang, s.tab_on, s.tab_away_en, s.tab_away_hi, s.tab_back_en, s.tab_back_hi]);

  return (
    <>
      <style>{CSS}</style>
      {s.progress_on && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed left-0 right-0 top-0 z-[49] h-[2px] origin-left"
          style={{ scaleX: bar, background: "linear-gradient(90deg,#b8862b,#f6dc8c,#b8862b)" }}
        />
      )}
    </>
  );
}