import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/* every one of these can be changed in the `site_settings` table (a row cell left empty uses the value here) */
export const SITE_DEFAULTS = {
  smooth_on: true, smooth_duration: 1.1, progress_on: true, reveal_on: true,
  tab_on: true,
  tab_away_en: "Come back, I have more to show 👋|Psst… you left something unseen 👀",
  tab_away_hi: "वापस आइए, अभी बहुत कुछ दिखाना है 👋|अरे… कुछ देखना रह गया 👀",
  tab_back_en: "Welcome back ✨",
  tab_back_hi: "फिर स्वागत है ✨",
  snippets_on: true,
  snippets_title_en: "Snippet shelf",
  snippets_title_hi: "स्निपेट शेल्फ़",
  snippets_sub_en: "Small pieces of code I reach for all the time. Copy and use.",
  snippets_sub_hi: "छोटे कोड जो मैं अक्सर इस्तेमाल करता हूँ। कॉपी करें और अपनाएँ।",
};

let cache = null;
let pending = null;
export function loadSiteSettings() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = supabase
      .from("site_settings").select("*").eq("id", 1).maybeSingle()
      .then(({ data, error }) => {
        const s = { ...SITE_DEFAULTS };
        if (!error && data) for (const k of Object.keys(SITE_DEFAULTS)) if (data[k] != null) s[k] = data[k];
        cache = s;
        return s;
      })
      .catch(() => { cache = SITE_DEFAULTS; return SITE_DEFAULTS; });
  }
  return pending;
}
export function useSiteSettings() {
  const [s, setS] = useState(cache || SITE_DEFAULTS);
  useEffect(() => {
    let off = false;
    loadSiteSettings().then((v) => { if (!off) setS(v); });
    return () => { off = true; };
  }, []);
  return s;
}

/* ---------- anonymous event log (no cookies, no IP: a random per-tab id and nothing else) ---------- */
const sid = () => {
  try {
    let v = sessionStorage.getItem("kg_sid");
    if (!v) { v = Math.random().toString(36).slice(2, 14); sessionStorage.setItem("kg_sid", v); }
    return v;
  } catch { return "na"; }
};
export function logEvent(name, label) {
  try {
    if (typeof window === "undefined" || navigator.webdriver) return;
    if (localStorage.getItem("kg_owner") === "1") return; // your own visits (see ?owner=1 below)
    const local = /^(localhost|127\.|192\.168\.)/.test(window.location.hostname);
    if (local && localStorage.getItem("kg_debug") !== "1") return; // so testing does not fill the numbers
    supabase
      .from("site_events")
      .insert({ name: String(name).slice(0, 40), label: label == null ? null : String(label).slice(0, 80), session: sid() })
      .then(() => {}, () => {});
  } catch { /* never break the site for a statistic */ }
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    try {
      const a = document.createElement("textarea");
      a.value = t; a.style.position = "fixed"; a.style.opacity = "0";
      document.body.appendChild(a); a.select();
      const ok = document.execCommand("copy");
      a.remove();
      return ok;
    } catch { return false; }
  }
}