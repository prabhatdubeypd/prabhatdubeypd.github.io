import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { tx } from "../lib/i18n";
import useSocials from "../lib/useSocials";
import { MailIcon, SocialIcon } from "./SocialIcon";
import Cta from "./Cta";

import InstallApp from "./InstallApp";

const openBook = (id) => window.dispatchEvent(new CustomEvent("open-book", { detail: id }));
const fire = (name) => () => window.dispatchEvent(new CustomEvent(name));

function useLocalTime(lang) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now
    .toLocaleTimeString(lang === "hi" ? "hi-IN" : "en-GB", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s/g, "")
    .toLowerCase();
}

export default function Footer() {
  const { lang } = useSettings();
  const { profile, categories, t } = useData();
  const { links, resume } = useSocials();
  const time = useLocalTime(lang);
  const ref = useRef(null);

  // the footer slides up over the section above while it comes into view
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.55"] });
  const y = useTransform(scrollYProgress, [0, 1], [90, 0]);

  const tr = (k, d) => {
    const v = t(k);
    return !v || v === k ? d : v;
  };

  // GitHub / LinkedIn fall back to the profile table if not in card_items
  const all = [...links];
  if (!all.some((l) => l.key === "github") && profile?.github)
    all.push({ key: "github", label: { en: "GitHub", hi: "GitHub" }, url: profile.github });
  if (!all.some((l) => l.key === "linkedin") && profile?.linkedin)
    all.push({ key: "linkedin", label: { en: "LinkedIn", hi: "LinkedIn" }, url: profile.linkedin });

  const head = "mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50";
  const a = "text-white/70 hover:text-white hover:underline";
  const icon =
    "grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white transition duration-300 hover:-translate-y-1 hover:scale-110 hover:bg-white hover:text-black";

  return (
    <motion.footer
      ref={ref}
      id="contact"
      style={{ y }}
      className="relative z-10 -mt-10 scroll-mt-20 rounded-t-[2rem] bg-[#1b1919] px-6 pb-6 pt-16 text-[#efeae3] shadow-[0_-20px_50px_rgba(0,0,0,.18)] md:-mt-14 md:rounded-t-[2.75rem] md:pt-24"
    >
      <div className="mx-auto max-w-6xl">
        <Cta dark />

        <div className="mt-14 grid gap-8 border-t border-white/10 pt-8 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className={head}>{t("footer_work")}</p>
            <ul className="space-y-1.5">
              {categories.map((c) => (
                <li key={c.id}>
                  <a href="#projects" data-book={c.id} onClick={() => openBook(c.id)} className={a}>
                    {tx(c.name, lang)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className={head}>{t("footer_nav")}</p>
            <ul className="space-y-1.5">
              <li><a href="#home" className={a}>{t("home")}</a></li>
              <li><a href="#story" className={a}>{t("story")}</a></li>
              <li><a href="#contact" className={a}>{t("contact")}</a></li>
              <li>
                <button type="button" onClick={fire("open-privacy")} className={a}>
                  {tr("privacy", "Privacy Policy")}
                </button>
              </li>
              <li>
                <button type="button" onClick={fire("open-consent")} className={a}>
                  {tr("cookie_settings", "Cookie settings")}
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className={head}>{t("footer_connect")}</p>
            <div className="flex flex-wrap gap-2">
              <a href={`mailto:${profile.email}`} aria-label={tr("mail", "Email")} title={tr("mail", "Email")} className={icon}>
                <MailIcon />
              </a>
              {all.map((l) => {
                const name = tx(l.label, lang) || l.key;
                return (
                  <a key={l.key + l.url} href={l.url} target="_blank" rel="noreferrer" aria-label={name} title={name} className={icon}>
                    <SocialIcon k={l.key} label={name} />
                  </a>
                );
              })}
            </div>
            {resume && (
              <a
                href={resume}
                data-track="resume_download"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium text-white transition duration-300 hover:scale-105 hover:bg-white hover:text-black"
              >
                ⬇ {tr("resume", "Download résumé")}
              </a>
            )}

                        <InstallApp className="mt-3" />
          </div>

          <div>
            <p className={head}>{t("footer_status")}</p>
            <ul className="space-y-1.5 text-white/70">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> {t("available")}
              </li>
              <li>{t("remote")}</li>
              <li>{tx(profile.location, lang)}</li>
              <li className="font-mono text-xs text-white/60">{t("local_time")} · {time}</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-white/50">
          <p>© {new Date().getFullYear()} {tx(profile.name, lang)} · {t("rights")}</p>
          <a href="#home" className="hover:text-white hover:underline">↑ {t("back_top")}</a>
        </div>
      </div>
    </motion.footer>
  );
}