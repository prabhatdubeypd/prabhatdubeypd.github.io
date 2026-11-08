import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSettings } from "./SettingsContext";
import { tx } from "../lib/i18n";

const DataContext = createContext(null);

// turns title_en / title_hi columns into { en, hi }
const bi = (r, f) => ({ en: r[`${f}_en`] ?? "", hi: r[`${f}_hi`] || r[`${f}_en`] || "" });
const ordered = (rows) =>
  rows.filter((r) => r.visible !== false).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

// resolves when an image has loaded (or failed, or took too long)
const preload = (src) =>
  new Promise((res) => {
    if (!src) return res();
    const i = new Image();
    i.onload = i.onerror = res;
    i.src = src;
    setTimeout(res, 5000);
  });

export function DataProvider({ children }) {
  const { lang, theme } = useSettings();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [progress, setProgress] = useState(0); // 0..100, real loading progress

  // theme colours from Supabase -> CSS variables
  const [colors, setColors] = useState([]);
  useEffect(() => {
    supabase.from("theme_colors").select("*").then(({ data }) => {
      if (data) setColors(data);
    });
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    colors.forEach((c) => root.style.setProperty(`--c-${c.key}`, theme === "dark" ? c.dark : c.light));
  }, [colors, theme]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const names = ["profile", "features", "ui_strings", "roles", "categories", "projects", "timeline"];
      let done = 0;
      // each finished table adds a share of the first 70%
      const results = await Promise.all(
        names.map((n) =>
          supabase.from(n).select("*").then((r) => {
            done += 1;
            if (!cancelled) setProgress(Math.round((done / names.length) * 70));
            return r;
          })
        )
      );
      const failed = results.find((r) => r.error);
      if (failed) {
        if (!cancelled) setState({ loading: false, error: failed.error.message, data: null });
        return;
      }
      const [profile, features, ui, roles, categories, projects, timeline] = results.map((r) => r.data);
      const p = profile[0] || {};
      const data = {
        profile: { name: bi(p, "name"), email: p.email, location: bi(p, "location"), photo: p.photo_url, github: p.github_url, linkedin: p.linkedin_url },
        features: Object.fromEntries(features.map((f) => [f.key, f.enabled])),
        ui: Object.fromEntries(ui.map((s) => [s.key, { en: s.en, hi: s.hi }])),
        roles: ordered(roles).map((r) => ({ id: r.id, label: bi(r, "label"), tagline: bi(r, "tagline"), image: r.image_url })),
        categories: ordered(categories).map((c) => ({
          id: c.id, color: c.color, emblem: c.emblem, cover: c.cover_url,
          name: bi(c, "name"), desc: bi(c, "desc"),
          question: bi(c, "question"), answer: bi(c, "answer"),
          facts: { en: c.facts_en || [], hi: c.facts_hi?.length ? c.facts_hi : c.facts_en || [] },
        })),
        projects: ordered(projects).map((x) => ({
          id: x.id, categories: x.categories || [], platforms: x.platforms || [], device: x.device, status: x.status, url: x.url,
          image: x.image_url, video: x.video_url, tags: x.tags || [],
          title: bi(x, "title"), desc: bi(x, "desc"),
        })),
        timeline: ordered(timeline).map((x) => ({
          id: x.id, year: x.year, org: x.org, range: x.date_range,
          title: bi(x, "title"), desc: bi(x, "desc"),
        })),
      };
      if (cancelled) return;
      setState({ loading: false, error: null, data });

      // last 30%: the real images (portrait, role photos, book covers)
      const imgs = [...new Set([data.profile.photo, ...data.roles.map((r) => r.image), ...data.categories.map((c) => c.cover)].filter(Boolean))];
      if (!imgs.length) { setProgress(100); return; }
      let got = 0;
      imgs.forEach((src) =>
        preload(src).then(() => {
          got += 1;
          if (!cancelled) setProgress(70 + Math.round((got / imgs.length) * 30));
        })
      );
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const features = state.data?.features;
  useEffect(() => {
    if (features) {
      document.documentElement.style.scrollBehavior = features.smoothScroll ? "smooth" : "auto";
    }
  }, [features]);

  const t = (key) => (state.data?.ui[key] ? tx(state.data.ui[key], lang) : key);

  return (
    <DataContext.Provider value={{ loading: state.loading, error: state.error, progress, ...(state.data || {}), t }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);