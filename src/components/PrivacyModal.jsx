import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { supabase } from "../lib/supabase";
import { track } from "../lib/analytics";

// tiny renderer: "## " heading, "- " list, blank line = paragraph
function Body({ text }) {
  return text.split(/\n{2,}/).map((blk, i) => {
    const lines = blk.split("\n");
    return lines.map((l, j) => {
      if (l.startsWith("## "))
        return <h4 key={`${i}-${j}`} className="mt-6 text-sm font-semibold uppercase tracking-[0.15em]">{l.slice(3)}</h4>;
      return null;
    }).concat(
      (() => {
        const rest = lines.filter((l) => !l.startsWith("## "));
        if (!rest.length) return [];
        if (rest.every((l) => l.startsWith("- ")))
          return [<ul key={`u${i}`} className="mt-2 list-disc space-y-1 pl-5 text-sm opacity-80">{rest.map((l, k) => <li key={k}>{l.slice(2)}</li>)}</ul>];
        return [<p key={`p${i}`} className="mt-2 text-sm leading-relaxed opacity-80">{rest.join(" ")}</p>];
      })()
    );
  });
}

export default function PrivacyModal() {
  const { lang } = useSettings();
  const { t } = useData();
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const h = () => { setOpen(true); track("privacy_open"); };
    window.addEventListener("open-privacy", h);
    return () => window.removeEventListener("open-privacy", h);
  }, []);

  useEffect(() => {
    if (!open || doc) return;
    supabase.from("policies").select("*").eq("key", "privacy").single().then(({ data, error }) => {
      if (error || !data) setFailed(true);
      else setDoc(data);
    });
  }, [open, doc]);

  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open]);

  const pick = (en, hi) => (lang === "hi" && hi ? hi : en);
  const close = (() => { const v = t("hire_close"); return !v || v === "hire_close" ? "Close" : v; })();

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          role="dialog" aria-modal="true"
        >
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.div
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl border border-line bg-bg p-6 text-ink shadow-[0_40px_100px_rgba(0,0,0,.4)] md:p-8"
            initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
          >
            <button
              type="button" aria-label={close} onClick={() => setOpen(false)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-line text-sm transition hover:bg-ink/10"
            >✕</button>

            {failed && <p className="text-sm opacity-70">Could not load the policy right now.</p>}
            {!doc && !failed && <p className="text-sm opacity-60">Loading…</p>}
            {doc && (
              <>
                <h3 className="pr-10 font-serif text-3xl font-bold">{pick(doc.title_en, doc.title_hi)}</h3>
                <p className="mt-1 text-xs opacity-60">
                  Last updated · {new Date(doc.updated_at).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <div className="mt-2 overflow-y-auto pr-2">
                  <Body text={pick(doc.body_en, doc.body_hi)} />
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}