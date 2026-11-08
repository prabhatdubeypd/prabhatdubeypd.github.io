import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSettings } from "./SettingsContext";
import { tx } from "../lib/i18n";

const DataContext = createContext(null);

// turns title_en / title_hi columns into { en, hi }
const bi = (r, f) => ({ en: r[`${f}_en`] ?? "", hi: r[`${f}_hi`] || r[`${f}_en`] || "" });
const ordered = (rows) =>
  rows.filter((r) => r.visible !== false).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

export function DataProvider({ children }) {
    const { lang, theme } = useSettings();
  const [state, setState] = useState({ loading: true, error: null, data: null });

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
      const results = await Promise.all(names.map((n) => supabase.from(n).select("*")));
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
  id: c.id, color: c.color, emblem: c.emblem,
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
      if (!cancelled) setState({ loading: false, error: null, data });
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
    <DataContext.Provider value={{ loading: state.loading, error: state.error, ...(state.data || {}), t }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);