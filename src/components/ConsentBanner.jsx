import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useData } from "../context/DataContext";
import { getConsent, setConsent } from "../lib/analytics";

export default function ConsentBanner() {
  const { t } = useData();
  const [show, setShow] = useState(false);

  const tr = (k, d) => {
    const v = t(k);
    return !v || v === k ? d : v;
  };

  useEffect(() => {
    if (!getConsent()) {
      const id = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(id);
    }
  }, []);

  useEffect(() => {
    const h = () => setShow(true);
    window.addEventListener("open-consent", h);
    return () => window.removeEventListener("open-consent", h);
  }, []);

  const choose = (v) => { setConsent(v); setShow(false); };
  const btn = "rounded-full px-5 py-2 text-xs font-semibold transition hover:scale-105 active:scale-95";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-xl rounded-2xl border border-line bg-bg p-4 text-ink shadow-[0_20px_60px_rgba(0,0,0,.3)] md:p-5"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          role="dialog" aria-label="Cookie consent"
        >
          <p className="text-sm opacity-80">
            {tr("cookie_text", "I use analytics cookies to understand how this site is used. Nothing is sold or shared.")}{" "}
            <button
              type="button" className="font-semibold underline"
              onClick={() => window.dispatchEvent(new CustomEvent("open-privacy"))}
            >
              {tr("privacy", "Privacy Policy")}
            </button>
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => choose("granted")} className={`${btn} bg-btn text-btn-ink`}>
              {tr("cookie_accept", "Accept")}
            </button>
            <button type="button" onClick={() => choose("denied")} className={`${btn} border border-line hover:bg-ink/5`}>
              {tr("cookie_decline", "Decline")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}