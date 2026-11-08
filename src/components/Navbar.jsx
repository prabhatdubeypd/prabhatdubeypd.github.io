import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { tx } from "../lib/i18n";
import Bell from "./Bell";

function useClock(lang, enabled) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  const locale = lang === "hi" ? "hi-IN" : "en-GB";
  const time = now
    .toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s/g, "")
    .toLowerCase();
  const date = now
    .toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
    .replace(/(\d{4})$/, ", $1");
  return { time, date };
}

const SECTION_IDS = ["home", "projects", "story", "contact"];

/* which page section is on screen right now (follows the scroll) */
function useActiveSection() {
  const [section, setSection] = useState("home");
  useEffect(() => {
    const calc = () => {
      const line = window.innerHeight * 0.35; // a section counts once its top passes this line
      let cur = "home";
      let last = null;
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        last = id;
        if (el.getBoundingClientRect().top <= line) cur = id;
      }
      // at the very bottom of the page, the last section is the active one
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && last) cur = last;
      setSection(cur);
    };
    calc();
    window.addEventListener("scroll", calc, { passive: true });
    window.addEventListener("resize", calc);
    return () => {
      window.removeEventListener("scroll", calc);
      window.removeEventListener("resize", calc);
    };
  }, []);
  return section;
}

/* which book is open (Books.jsx tells us with the "book-active" event) */
function useOpenBook() {
  const [id, setId] = useState(null);
  useEffect(() => {
    const h = (e) => setId(e.detail ?? null);
    window.addEventListener("book-active", h);
    return () => window.removeEventListener("book-active", h);
  }, []);
  return [id, setId];
}

const openBookEvent = (id) => window.dispatchEvent(new CustomEvent("open-book", { detail: id }));

export default function Navbar() {
  const { lang, setLang, theme, setTheme } = useSettings();
  const { categories, features, t } = useData();
  const [menu, setMenu] = useState(false);
  const showClock = features.liveClock !== false;
  const { time, date } = useClock(lang, showClock);
  const section = useActiveSection();
  const [openBook, setOpenBook] = useOpenBook();

  const btn =
    "rounded-full border border-current/20 px-2.5 py-0.5 text-xs transition hover:bg-ink/10";
  const link = "relative whitespace-nowrap py-1 text-[13px] opacity-70 transition hover:opacity-100";

  const items = [
    { key: "sec:home", label: t("home"), href: "#home" },
    ...categories.map((c) => ({ key: `book:${c.id}`, label: tx(c.name, lang), href: "#projects", book: c.id })),
    { key: "sec:story", label: t("story"), href: "#story" },
    { key: "sec:contact", label: t("contact"), href: "#contact" },
  ];

  // an open book wins over the scroll position
  const activeKey = openBook != null ? `book:${openBook}` : `sec:${section}`;

  const go = (it) => {
    if (it.book) {
      setOpenBook(it.book); // underline moves right away
      openBookEvent(it.book);
    }
    setMenu(false);
  };

  return (
    <header className="fixed top-0 z-30 w-full border-b border-line bg-nav backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
        <nav className="hidden items-center gap-5 xl:flex">
          {items.map((it) => {
            const active = it.key === activeKey;
            return (
              <a
                key={it.key}
                href={it.href}
                data-book={it.book}
                onClick={() => go(it)}
                className={`${link} ${active ? "!opacity-100" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {it.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-current"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {showClock && (
            <div className="mr-1 hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-current/20 px-3 py-1 text-[11px] xl:flex">
              <span className="opacity-60">{t("local_time")}</span>
              <b className="font-semibold">{time}</b>
              <span className="opacity-40">•</span>
              <span className="opacity-70">{date}</span>
            </div>
          )}
          <button onClick={() => setLang(lang === "en" ? "hi" : "en")} className={btn}>
            {lang === "en" ? "हिं" : "EN"}
          </button>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className={btn}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* bell: pushed 32px to the right on wide screens (change xl:translate-x-8 to move it more or less) */}
          <div className="shrink-0 xl:translate-x-8">
            <Bell />
          </div>

          <button onClick={() => setMenu((m) => !m)} className={`${btn} xl:hidden`} aria-label="Menu">
            {menu ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {menu && (
        <nav className="border-t border-line bg-bg px-6 py-4 xl:hidden">
          <ul className="space-y-3 text-sm">
            {items.map((it) => (
              <li key={it.key}>
                <a
                  href={it.href}
                  data-book={it.book}
                  onClick={() => go(it)}
                  className={`block ${it.key === activeKey ? "font-medium underline decoration-2 underline-offset-4" : ""}`}
                >
                  {it.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}