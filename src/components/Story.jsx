import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { tx } from "../lib/i18n";

function StoryCard({ x, lang }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-60">{x.range}</p>
      <h3 className="mt-3 text-2xl font-bold md:text-3xl">{tx(x.title, lang)}</h3>
      <p className="mt-1 opacity-70">{x.org}</p>
      <p className="mt-4 leading-relaxed opacity-80">{tx(x.desc, lang)}</p>
    </>
  );
}

export default function Story() {
  const { lang } = useSettings();
  const { timeline, features, t } = useData();
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const n = timeline.length;
  const anim = features.storyAnimation !== false;

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (p) =>
    setIdx(Math.min(n - 1, Math.max(0, Math.floor(p * n))))
  );

  if (n === 0) return null;
  const cur = timeline[idx];

  return (
    <section id="story" className="scroll-mt-20 pt-20">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-60">{t("story_sub")}</p>
      <h2 className="mt-3 text-4xl font-bold md:text-6xl">{t("story_title")}</h2>

      <div ref={ref} style={{ height: anim ? `${n * 80}vh` : "auto" }} className={anim ? "" : "mt-12"}>
        {anim ? (
          <div className="sticky top-0 flex h-screen items-center overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.span
                key={cur.year}
                initial={{ y: "40%", opacity: 0 }}
                animate={{ y: 0, opacity: 0.1 }}
                exit={{ y: "-40%", opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="pointer-events-none absolute inset-0 grid place-items-center text-[32vw] font-bold leading-none"
              >
                {cur.year}
              </motion.span>
            </AnimatePresence>

            <div className="relative mx-auto w-full max-w-xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={cur.id}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                  transition={{ duration: 0.4 }}
                  className="rounded-3xl bg-white p-8 shadow-xl dark:bg-zinc-900"
                >
                  <StoryCard x={cur} lang={lang} />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 flex-col gap-3 text-sm tabular-nums md:flex">
              {timeline.map((x, k) => (
                <span key={x.id} className={k === idx ? "font-bold" : "opacity-30"}>{x.year}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {timeline.map((x) => (
              <div key={x.id} className="rounded-3xl bg-white p-8 shadow dark:bg-zinc-900">
                <p className="text-5xl font-bold opacity-20">{x.year}</p>
                <StoryCard x={x} lang={lang} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}