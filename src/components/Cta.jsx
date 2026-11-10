import { useData } from "../context/DataContext";
import { track } from "../lib/analytics";
import useWhatsApp from "../lib/useWhatsApp";
import { SocialIcon } from "./SocialIcon";

// "Need something built? Let's make it happen." -> ["Need something built?", "Let's make it happen."]
const splitTitle = (s) => {
  const m = String(s || "").match(/^(.*?[?.!])\s+(.+)$/s);
  return m ? [m[1], m[2]] : [s, ""];
};

export default function Cta({ onSeeWork, dark = false }) {
  const { t } = useData();
  const wa = useWhatsApp();
  const tr = (k, d) => {
    const v = t(k);
    return !v || v === k ? d : v;
  };
  const open = () => {
    track("hire_open");
    window.dispatchEvent(new CustomEvent("open-hire"));
  };
  const openWa = () => window.dispatchEvent(new CustomEvent("open-whatsapp"));

  /* ---------- dark footer version (left aligned, like the reference) ---------- */
  if (dark) {
    const [a, b] = splitTitle(t("cta_title"));
    return (
      <div className="max-w-5xl text-left">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60 sm:text-xs">
          <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
          {tr("cta_eyebrow", tr("available", "Available for new work"))}
        </p>
        <h2 className="mt-5 text-[2.6rem] font-bold leading-[0.98] tracking-tight text-[#efeae3] sm:text-6xl md:text-8xl">
          {a}
          {b && <span className="block text-white/35">{b}</span>}
        </h2>
        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/60 md:text-base">{t("cta_body")}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={open}
            className="group flex h-12 items-center gap-4 rounded-full bg-[#ebe6de] pl-6 pr-1.5 text-sm font-medium text-[#1b1919] transition duration-300 hover:scale-105 active:scale-95"
          >
            {t("hire")}
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1b1919] text-white transition-transform duration-300 group-hover:translate-x-0.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </span>
          </button>
          {onSeeWork ? (
            <button
              type="button"
              onClick={onSeeWork}
              className="flex h-12 items-center rounded-full border border-white/20 px-6 text-sm font-medium text-white transition duration-300 hover:scale-105 hover:bg-white/10 active:scale-95"
            >
              {t("see_work")}
            </button>
          ) : (
            <a
              href="#projects"
              className="flex h-12 items-center rounded-full border border-white/20 px-6 text-sm font-medium text-white transition duration-300 hover:scale-105 hover:bg-white/10 active:scale-95"
            >
              {t("see_work")}
            </a>
          )}
          <button
            type="button"
            data-book-call
            className="flex h-12 items-center gap-2 rounded-full border border-white/20 px-6 text-sm font-medium text-white transition duration-300 hover:scale-105 hover:bg-white/10 active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 10h18" />
            </svg>
            {tr("book_call", "Book a 15-min call")}
          </button>
          {wa.number && (
            <button
              type="button"
              onClick={openWa}
              className="flex h-12 items-center gap-2 rounded-full border border-[#25D366]/50 px-6 text-sm font-medium text-[#6ee7a0] transition duration-300 hover:scale-105 hover:bg-[#25D366]/15 active:scale-95"
            >
              <SocialIcon k="whatsapp" size={16} />
              {tr("wa_label", "WhatsApp")}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ---------- default version (used inside a book's last page) ---------- */
  const hire =
    "group inline-flex items-center gap-3 rounded-full bg-btn px-8 py-4 text-sm font-semibold text-btn-ink shadow-[0_10px_30px_rgba(0,0,0,.18)] transition duration-300 hover:scale-105 active:scale-95";
  const work =
    "inline-flex items-center rounded-full border border-line bg-ink/5 px-8 py-4 text-sm font-semibold transition duration-300 hover:scale-105 hover:bg-ink/10 active:scale-95";
  return (
    <div className="mx-auto max-w-4xl text-center">
      <h2 className="text-4xl font-bold leading-tight md:text-7xl">{t("cta_title")}</h2>
      <p className="mx-auto mt-6 max-w-xl text-lg opacity-70">{t("cta_body")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button type="button" onClick={open} className={hire}>
          {t("hire")}
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </button>
        {onSeeWork ? (
          <button type="button" onClick={onSeeWork} className={work}>{t("see_work")}</button>
        ) : (
          <a href="#projects" className={work}>{t("see_work")}</a>
        )}
        <button type="button" data-book-call className={work}>
          {tr("book_call", "Book a 15-min call")}
        </button>
        {wa.number && (
          <button type="button" onClick={openWa} className={`${work} gap-2`}>
            <SocialIcon k="whatsapp" size={16} />
            {tr("wa_label", "WhatsApp")}
          </button>
        )}
      </div>
    </div>
  );
}