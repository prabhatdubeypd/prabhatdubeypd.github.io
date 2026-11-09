import { track } from "./analytics";

const LINK = import.meta.env.VITE_CAL_LINK; // e.g. "prabhatdubey/15min"
let ready = false;

// loads Cal.com's script only when someone actually wants to book
function load() {
  if (ready) return;
  ready = true;
  (function (C, A, L) {
    const p = function (a, ar) { a.q.push(ar); };
    const d = C.document;
    C.Cal = C.Cal || function () {
      const cal = C.Cal;
      const ar = arguments;
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = cal.q || [];
        d.head.appendChild(d.createElement("script")).src = A;
        cal.loaded = true;
      }
      if (ar[0] === L) {
        const api = function () { p(api, arguments); };
        const namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === "string") {
          cal.ns[namespace] = cal.ns[namespace] || api;
          p(cal.ns[namespace], ar);
          p(cal, ["initNamespace", namespace]);
        } else p(cal, ar);
        return;
      }
      p(cal, ar);
    };
  })(window, "https://app.cal.com/embed/embed.js", "init");
  window.Cal("init", { origin: "https://app.cal.com" });
}

export function openCal() {
  if (!LINK) {
    console.warn("VITE_CAL_LINK is not set");
    return;
  }
  load();
  const dark = document.documentElement.classList.contains("dark");
  window.Cal("ui", {
    theme: dark ? "dark" : "light",
    hideEventTypeDetails: false,
    layout: "month_view",
    cssVarsPerTheme: {
      light: { "cal-brand": "#18181b" },
      dark: { "cal-brand": "#e8c15a" },
    },
  });
  window.Cal("modal", { calLink: LINK, config: { layout: "month_view", theme: dark ? "dark" : "light" } });
  track("book_call_open");
}

// any element with data-book-call opens the booking popup
export function initCal() {
  document.addEventListener("click", (e) => {
    const el = e.target?.closest?.("[data-book-call]");
    if (!el) return;
    e.preventDefault();
    openCal();
  });
}