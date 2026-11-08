import { useData } from "../context/DataContext";

export default function Cta({ onSeeWork }) {
  const { t } = useData();
  const hire =
    "group inline-flex items-center gap-3 rounded-full bg-btn px-8 py-4 text-sm font-semibold text-btn-ink shadow-[0_10px_30px_rgba(0,0,0,.18)] transition duration-300 hover:scale-105 active:scale-95";
  const work =
    "inline-flex items-center rounded-full border border-line bg-ink/5 px-8 py-4 text-sm font-semibold transition duration-300 hover:scale-105 hover:bg-ink/10 active:scale-95";
  return (
    <div className="mx-auto max-w-4xl text-center">
      <h2 className="text-4xl font-bold leading-tight md:text-7xl">{t("cta_title")}</h2>
      <p className="mx-auto mt-6 max-w-xl text-lg opacity-70">{t("cta_body")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-hire"))}
          className={hire}
        >
          {t("hire")}
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </button>

        {onSeeWork ? (
          // inside a book's last page: go back to the books
          <button type="button" onClick={onSeeWork} className={work}>
            {t("see_work")}
          </button>
        ) : (
          // in the footer: glide to the room of books and stop there
          <a href="#projects" className={work}>
            {t("see_work")}
          </a>
        )}
      </div>
    </div>
  );
}