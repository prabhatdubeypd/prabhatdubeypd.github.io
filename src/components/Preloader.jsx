import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { tx } from "../lib/i18n";

export default function Preloader() {
  const { lang } = useSettings();
  const { profile, categories, features } = useData();
  const [show, setShow] = useState(features.preloader !== false);
  const [n, setN] = useState(2);

  const labels = [tx(profile.name, lang), ...categories.map((c) => tx(c.name, lang))];
  const visible = Math.min(labels.length, Math.floor((n / 100) * (labels.length + 1)));

  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => setN((v) => Math.min(v + 1, 100)), 28);
    return () => clearInterval(id);
  }, [show]);

  useEffect(() => {
    if (n < 100) return;
    const id = setTimeout(() => setShow(false), 600);
    return () => clearTimeout(id);
  }, [n]);

  useEffect(() => {
    document.body.style.overflow = show ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="preloader"
          className="fixed inset-0 z-[70] bg-zinc-950 text-white"
          exit={{ y: "-100%" }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="absolute left-8 top-8 text-sm tracking-widest opacity-60">{labels[0]}</div>

          {/* stacked cards */}
          <div className="absolute left-1/2 top-1/2 h-72 w-[min(80vw,360px)] -translate-x-1/2 -translate-y-1/2">
            {labels.map((label, k) => {
              const shown = k < visible;
              const isTop = k === visible - 1;
              return (
                <motion.div
                  key={k}
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: shown ? 1 : 0, y: shown ? k * 46 : 60, scale: shown ? 1 - (visible - 1 - k) * 0.03 : 0.95 }}
                  transition={{ type: "spring", stiffness: 140, damping: 18 }}
                  style={{ zIndex: k }}
                  className={`absolute inset-x-0 top-0 rounded-2xl border px-6 py-4 text-sm font-semibold ${
                    isTop ? "border-white bg-white text-black" : "border-white/10 bg-zinc-800 text-white/80"
                  }`}
                >
                  {label}
                </motion.div>
              );
            })}
          </div>

          <p className="absolute bottom-6 right-8 text-8xl font-bold tabular-nums md:text-9xl">
            {String(n).padStart(3, "0")}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}