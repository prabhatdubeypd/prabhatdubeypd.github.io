const GA = import.meta.env.VITE_GA_ID;
const CLARITY = import.meta.env.VITE_CLARITY_ID;
const KEY = "consent_v1";

let ready = false;
let clarityOn = false;

export const getConsent = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};

export function track(name, params = {}) {
  if (ready && window.gtag) window.gtag("event", name, params);
}

const pageView = () =>
  track("page_view", {
    page_location: location.href,
    page_path: location.pathname + location.hash,
    page_title: document.title,
  });

function loadClarity() {
  if (!CLARITY || clarityOn) return;
  clarityOn = true;
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY);
}

function applyConsent(v) {
  const granted = v === "granted";
  if (window.gtag) {
    window.gtag("consent", "update", { analytics_storage: granted ? "granted" : "denied" });
  }
  if (granted) loadClarity();
}

export function setConsent(v) {
  try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
  applyConsent(v);
  if (v === "granted") {
    track("page_view", {
      page_location: location.href,
      page_path: location.pathname + location.hash,
      page_title: document.title,
    });
  }
}

export function initAnalytics() {
  if (ready) return;

  if (GA) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA}`;
    document.head.appendChild(s);

    window.gtag("js", new Date());
    window.gtag("config", GA, { send_page_view: false });
    ready = true;

    pageView();
    window.addEventListener("hashchange", pageView);

    document.addEventListener("click", (e) => {
      const el = e.target.closest("a,button");
      if (!el) return;
      if (el.dataset.track) track(el.dataset.track);
      if (el.tagName === "A" && el.href) {
        if (el.href.startsWith("mailto:")) track("click_email");
        else if (el.origin && el.origin !== location.origin)
          track("click_outbound", { url: el.href, label: el.getAttribute("aria-label") || el.textContent.trim() });
      }
    });

    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && en.target.id && !seen.has(en.target.id)) {
          seen.add(en.target.id);
          track("section_view", { section: en.target.id });
        }
      });
    }, { threshold: 0.4 });
    setTimeout(() => document.querySelectorAll("section[id],footer[id]").forEach((n) => io.observe(n)), 1500);
  }

  // restore a previous choice
  const saved = getConsent();
  if (saved) applyConsent(saved);
}