import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { clearPrompt, getPrompt, isStandalone } from "../lib/pwa";
import { track } from "../lib/analytics";

export default function InstallApp({ className = "" }) {
  const { lang } = useSettings();
  const [can, setCan] = useState(() => !!getPrompt());
  const [ios] = useState(() => /iphone|ipad|ipod/i.test(navigator.userAgent));
  const [tip, setTip] = useState(false);
  const [done, setDone] = useState(() => isStandalone());

  useEffect(() => {
    const ready = () => setCan(!!getPrompt());
    const installed = () => setDone(true);
    window.addEventListener("pwa-ready", ready);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("pwa-ready", ready);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (done || (!can && !ios)) return null;

  const click = async () => {
    const p = getPrompt();
    if (p) {
      p.prompt();
      const r = await p.userChoice;
      track("pwa_install", { outcome: r.outcome });
      clearPrompt();
      setCan(false);
    } else {
      setTip((v) => !v); // iPhone: no install prompt exists, so show the steps
    }
  };

  const hi = lang === "hi";
  return (
    <div className={className}>
      <button
        type="button"
        onClick={click}
        className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium text-white transition duration-300 hover:scale-105 hover:bg-white hover:text-black"
      >
        <svg width="12" height="14" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="24" rx="3" />
          <path d="M12 9v8M8.5 14l3.5 3.5 3.5-3.5" />
        </svg>
        {hi ? "ऐप इंस्टॉल करें" : "Install app"}
      </button>
      {tip && (
        <p className="mt-2 max-w-[16rem] text-xs leading-relaxed text-white/60">
          {hi ? "Share आइकन दबाएँ, फिर “Add to Home Screen” चुनें।" : "Tap the Share icon, then “Add to Home Screen”."}
        </p>
      )}
    </div>
  );
}