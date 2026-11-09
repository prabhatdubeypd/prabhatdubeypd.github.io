import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { supabase } from "../lib/supabase";
import { tx } from "../lib/i18n";
import { track } from "../lib/analytics";

const EMPTY = { name: "", email: "", message: "", topic: "", budget: "", deadline: "", hp: "" };

// value saved in the database (English) + labels shown to the visitor
const BUDGETS = [
  { v: "Under ₹25k", en: "Under ₹25k", hi: "₹25 हज़ार से कम" },
  { v: "₹25k to ₹75k", en: "₹25k to ₹75k", hi: "₹25 से 75 हज़ार" },
  { v: "₹75k+", en: "₹75k+", hi: "₹75 हज़ार+" },
  { v: "Not sure", en: "Not sure", hi: "पता नहीं" },
];
const DEADLINES = [
  { v: "ASAP", en: "ASAP", hi: "जल्द से जल्द" },
  { v: "Within a month", en: "Within a month", hi: "एक महीने में" },
  { v: "1 to 3 months", en: "1 to 3 months", hi: "1 से 3 महीने" },
  { v: "Flexible", en: "Flexible", hi: "लचीला" },
];

export default function HireModal() {
  const { lang } = useSettings();
  const { profile, categories, t } = useData();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [bad, setBad] = useState(false);
  const [f, setF] = useState(EMPTY);
  const firstRef = useRef(null);

  const tr = (k, d) => {
    const v = t(k);
    return !v || v === k ? d : v;
  };
  const L = (en, hi) => (lang === "hi" ? hi : en);

  // any "Hire me" button opens this
  useEffect(() => {
    const h = () => {
      setStatus("idle");
      setBad(false);
      setOpen(true);
    };
    window.addEventListener("open-hire", h);
    return () => window.removeEventListener("open-hire", h);
  }, []);

  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = setTimeout(() => firstRef.current?.focus(), 350);
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
      clearTimeout(id);
    };
  }, [open]);

  const opts = [
    ...(categories || []).map((c) => ({ id: c.id, label: tx(c.name, lang), en: c.name?.en || c.name?.hi || c.id })),
    { id: "other", label: tr("hire_other", "Something else"), en: "Something else" },
  ];
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const pick = (k, v) => setF((s) => ({ ...s, [k]: s[k] === v ? "" : v }));

  const submit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;
    const name = f.name.trim();
    const email = f.email.trim();
    const message = f.message.trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || message.length < 5) {
      setBad(true);
      return;
    }
    setBad(false);
    if (f.hp) { setStatus("done"); return; } // a bot filled the hidden field
    let last = 0;
    try { last = Number(localStorage.getItem("hire_last") || 0); } catch { /* ignore */ }
    if (Date.now() - last < 30000) { setStatus("error"); return; }
    setStatus("sending");
    const { error } = await supabase.from("inquiries").insert({
      name,
      email,
      topic: f.topic || null,
      budget: f.budget || null,
      deadline: f.deadline || null,
      message,
      lang,
    });
    if (error) { setStatus("error"); track("hire_error"); return; }
    track("hire_submit", { topic: f.topic || "none", budget: f.budget || "none", deadline: f.deadline || "none" });
    try { localStorage.setItem("hire_last", String(Date.now())); } catch { /* ignore */ }
    setStatus("done");
    setF(EMPTY);
  };

  const mailto = `mailto:${profile?.email || ""}?subject=${encodeURIComponent("Project enquiry")}&body=${encodeURIComponent(
    `${f.message}\n\n— ${f.name} ${f.email}`
  )}`;

  const input =
    "w-full rounded-xl border border-line bg-ink/5 px-4 py-3 text-sm outline-none transition placeholder:opacity-50 focus:border-accent";
  const label = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] opacity-60";
  const chip = (on) =>
    `rounded-full border px-3.5 py-1.5 text-xs transition ${on ? "border-transparent bg-btn text-btn-ink" : "border-line hover:bg-ink/5"}`;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="hire"
          className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <motion.div
            className="relative my-6 w-full max-w-lg rounded-3xl border border-line bg-bg p-6 text-ink shadow-[0_40px_100px_rgba(0,0,0,.4)] md:p-8"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
          >
            <button
              type="button"
              aria-label={tr("hire_close", "Close")}
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-line text-sm transition hover:bg-ink/10"
            >
              ✕
            </button>

            {status === "done" ? (
              <div className="py-8 text-center">
                <motion.svg
                  width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                >
                  <circle cx="32" cy="32" r="29" stroke="var(--c-accent)" strokeWidth="3" />
                  <motion.path
                    d="M19 33 L28 42 L46 23"
                    stroke="var(--c-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  />
                </motion.svg>
                <h3 className="mt-5 font-serif text-3xl font-bold">{tr("hire_thanks_title", L("Message sent", "संदेश भेज दिया"))}</h3>
                <p className="mx-auto mt-3 max-w-sm text-sm opacity-70">
                  {tr("hire_thanks_body", L("Got it! I'll reply to your email within a day.", "मिल गया! मैं एक दिन के भीतर आपके ईमेल पर जवाब दूँगा।"))}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-7 rounded-full bg-btn px-7 py-3 text-sm font-semibold text-btn-ink transition hover:scale-105"
                >
                  {tr("hire_close", "Close")}
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <h3 className="pr-10 font-serif text-3xl font-bold leading-tight">{tr("hire_title", "Let's build something together")}</h3>
                <p className="mt-2 text-sm opacity-70">{tr("hire_sub", "Tell me what you need and I'll get back to you.")}</p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label}>{tr("hire_name", "Your name")}</label>
                    <input ref={firstRef} className={input} value={f.name} onChange={set("name")} maxLength={120} autoComplete="name" />
                  </div>
                  <div>
                    <label className={label}>{tr("hire_email", "Your email")}</label>
                    <input className={input} type="email" value={f.email} onChange={set("email")} maxLength={200} autoComplete="email" />
                  </div>
                </div>

                <div className="mt-4">
                  <label className={label}>{tr("hire_topic", "What do you need?")}</label>
                  <div className="flex flex-wrap gap-2">
                    {opts.map((o) => (
                      <button type="button" key={o.id} onClick={() => pick("topic", o.en)} className={chip(f.topic === o.en)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label}>{tr("hire_budget", L("Budget", "बजट"))}</label>
                    <div className="flex flex-wrap gap-2">
                      {BUDGETS.map((o) => (
                        <button type="button" key={o.v} onClick={() => pick("budget", o.v)} className={chip(f.budget === o.v)}>
                          {L(o.en, o.hi)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={label}>{tr("hire_deadline", L("Deadline", "समय सीमा"))}</label>
                    <div className="flex flex-wrap gap-2">
                      {DEADLINES.map((o) => (
                        <button type="button" key={o.v} onClick={() => pick("deadline", o.v)} className={chip(f.deadline === o.v)}>
                          {L(o.en, o.hi)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className={label}>{tr("hire_message", "Tell me about your project")}</label>
                  <textarea className={`${input} resize-none`} rows={4} value={f.message} onChange={set("message")} maxLength={3000} />
                </div>

                {/* hidden field: only bots fill this */}
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={f.hp}
                  onChange={set("hp")}
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                />

                {bad && <p className="mt-3 text-sm text-red-500">{tr("hire_invalid", "Please add your name, a valid email and a short message.")}</p>}
                {status === "error" && (
                  <p className="mt-3 text-sm text-red-500">
                    {tr("hire_error", "Could not send right now.")}{" "}
                    <a href={mailto} className="font-semibold underline">
                      {tr("hire_email_instead", "Email me instead")}
                    </a>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="mt-6 w-full rounded-full bg-btn px-7 py-3.5 text-sm font-semibold text-btn-ink shadow-[0_10px_30px_rgba(0,0,0,.18)] transition duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                >
                  {status === "sending" ? tr("hire_sending", "Sending…") : `${tr("hire_send", "Send message")} →`}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}