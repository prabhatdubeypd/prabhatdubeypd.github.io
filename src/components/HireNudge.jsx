import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useData } from "../context/DataContext";
import useWhatsApp from "../lib/useWhatsApp";
import { SocialIcon } from "./SocialIcon";
import { track } from "../lib/analytics";

// TESTING: add ?nudge=1 to the address (for example localhost:5173/?nudge=1): no waiting, no limits
const TEST = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("nudge") === "1";

const START_DELAY = TEST ? 2500 : 14000; // wait this long after the page opens before the first banner
const BANNER_MS = 5000; // how long the banner stays
const BANNER_MAX = TEST ? 999 : 2; // banners per visit
const GAP = TEST ? 0 : 60000; // minimum time between two banners
const AFTER_BOOK_MS = 2200; // after a book closes, wait for its closing animation, then show the form
const MODAL_MAX = TEST ? 999 : 2; // automatic form pop-ups per visit
const MODAL_GAP = TEST ? 0 : 120000; // minimum time between two pop-ups
const MIN_IN_BOOK = TEST ? 0 : 4000; // no pop-up if the visitor left the book straight away
const BOTTOM = 16; // distance from the bottom. Raise it if the banner overlaps your cookie banner.

const num = (k) => {
  try { return Number(sessionStorage.getItem(k) || 0); } catch { return 0; }
};
const bump = (k) => {
  try { sessionStorage.setItem(k, String(num(k) + 1)); } catch { /* ignore */ }
};
const silenced = () => {
  if (TEST) return false;
  try {
    const off = Number(localStorage.getItem("nudge_off") || 0) > Date.now(); // "don't show again"
    const hired = Date.now() - Number(localStorage.getItem("hire_last") || 0) < 7 * 864e5; // sent a message lately
    return off || hired;
  } catch { return false; }
};

// true when the visitor is not on the books and nothing else is open
function eligible(inBook) {
  if (inBook) return false;
  if (document.hidden) return false;
  if (document.querySelector('[role="dialog"], [data-hire-modal]')) return false;
  const vh = window.innerHeight;
  const sec = document.getElementById("projects");
  if (sec) {
    const r = sec.getBoundingClientRect();
    if (r.top < vh * 0.8 && r.bottom > vh * 0.2) return false;
  }
  const foot = document.getElementById("contact");
  if (foot && foot.getBoundingClientRect().top < vh * 0.85) return false;
  return true;
}

export default function HireNudge() {
  const { features, t } = useData();
  const wa = useWhatsApp();
  const [show, setShow] = useState(false);
  const shownRef = useRef(false);
  const hoverRef = useRef(false);
  const hideTimer = useRef(0);
  const fRef = useRef(features);
  fRef.current = features;
  const st = useRef({ t0: Date.now(), inBook: false, enteredAt: 0, lastNudge: 0, lastModal: 0 });

  const tr = (k, d) => {
    const v = t(k);
    return !v || v === k ? d : v;
  };

  const set = (v) => {
    shownRef.current = v;
    setShow(v);
  };
  const hide = () => {
    clearTimeout(hideTimer.current);
    set(false);
  };
  const schedule = (ms) => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (hoverRef.current) schedule(800); // the mouse is on it: stay a little longer
      else set(false);
    }, ms);
  };

  // 1) the 5-second banner while the visitor is not on the books
  useEffect(() => {
    const id = setInterval(() => {
      const s = st.current;
      const now = Date.now();
      if (fRef.current.hireBanner === false || silenced()) return;
      const ok = eligible(s.inBook);
      if (shownRef.current) {
        if (!ok) hide();
        return;
      }
      if (!ok || now - s.t0 < START_DELAY || now - s.lastNudge < GAP || num("nudge_b") >= BANNER_MAX) return;
      s.lastNudge = now;
      bump("nudge_b");
      set(true);
      track("hire_banner_show");
      schedule(BANNER_MS);
    }, 1000);
    return () => {
      clearInterval(id);
      clearTimeout(hideTimer.current);
    };
  }, []);

  // 2) the hire form pops up after a book is closed
  useEffect(() => {
    let timer = 0;
    const h = (e) => {
      const id = e.detail ?? null;
      const s = st.current;
      clearTimeout(timer);
      if (id != null) {
        if (!s.inBook) s.enteredAt = Date.now();
        s.inBook = true;
        return;
      }
      if (!s.inBook) return; // wasn't inside a book
      s.inBook = false;
      timer = setTimeout(() => {
        const now = Date.now();
        if (fRef.current.hireAfterBook === false || silenced()) return;
        if (now - s.enteredAt < MIN_IN_BOOK) return;
        if (num("nudge_m") >= MODAL_MAX || now - s.lastModal < MODAL_GAP) return;
        if (document.querySelector('[role="dialog"], [data-hire-modal]')) return;
        s.lastModal = now;
        s.lastNudge = now;
        bump("nudge_m");
        hide();
        track("hire_auto_open");
        window.dispatchEvent(new CustomEvent("open-hire", { detail: { auto: true } }));
      }, AFTER_BOOK_MS);
    };
    window.addEventListener("book-active", h);
    return () => {
      window.removeEventListener("book-active", h);
      clearTimeout(timer);
    };
  }, []);

  // hide the banner as soon as a form opens
  useEffect(() => {
    const h = () => hide();
    window.addEventListener("open-hire", h);
    window.addEventListener("open-whatsapp", h);
    return () => {
      window.removeEventListener("open-hire", h);
      window.removeEventListener("open-whatsapp", h);
    };
  }, []);

  const closeForNow = () => {
    hide();
    try { sessionStorage.setItem("nudge_b", String(BANNER_MAX)); } catch { /* ignore */ }
  };

  return (
    <>
      <style>{`@keyframes nudge-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>
      <AnimatePresence>
        {show && (
          <motion.div
            key="nudge"
            role="status"
            className="pointer-events-none fixed inset-x-0 z-[55] flex justify-center px-3"
            style={{ bottom: BOTTOM }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <div
              onMouseEnter={() => { hoverRef.current = true; }}
              onMouseLeave={() => { hoverRef.current = false; }}
              className="pointer-events-auto relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-bg/95 p-3.5 pr-10 text-ink shadow-[0_20px_60px_rgba(0,0,0,.25)] backdrop-blur sm:flex sm:items-center sm:gap-4 sm:p-4 sm:pr-12"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{tr("nudge_title", "Got a project in mind?")}</p>
                <p className="mt-0.5 text-xs opacity-70">{tr("nudge_sub", "I'm open to new work. Let's talk.")}</p>
              </div>

              <div className="mt-3 flex items-center gap-2 sm:mt-0">
                <button
                  type="button"
                  onClick={() => {
                    track("hire_banner_click");
                    hide();
                    window.dispatchEvent(new CustomEvent("open-hire"));
                  }}
                  className="rounded-full bg-btn px-4 py-2 text-xs font-semibold text-btn-ink transition duration-300 hover:scale-105 active:scale-95"
                >
                  {t("hire")} →
                </button>
                {wa.number && (
                  <button
                    type="button"
                    onClick={() => {
                      track("whatsapp_banner_click");
                      hide();
                      window.dispatchEvent(new CustomEvent("open-whatsapp"));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-xs font-semibold text-[#052e16] transition duration-300 hover:scale-105 active:scale-95"
                  >
                    <SocialIcon k="whatsapp" size={14} />
                    {tr("wa_label", "WhatsApp")}
                  </button>
                )}
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={closeForNow}
                className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full text-xs opacity-60 transition hover:bg-ink/10 hover:opacity-100"
              >
                ✕
              </button>

              {/* time left */}
              <span
                className="absolute bottom-0 left-0 h-[3px] w-full origin-left bg-accent"
                style={{ animation: `nudge-bar ${BANNER_MS}ms linear forwards` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}