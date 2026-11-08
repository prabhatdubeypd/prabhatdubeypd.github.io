import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { supabase } from "../lib/supabase";

// keeps the browser tab title / description / theme colour in sync with Supabase (and the language)
export default function MetaSync() {
  const { lang, theme } = useSettings();
  const [m, setM] = useState(null);

  useEffect(() => {
    let off = false;
    supabase
      .from("site_meta")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => { if (!off && data) setM(data); })
      .catch(() => {});
    return () => { off = true; };
  }, []);

  useEffect(() => {
    if (!m) return;
    const title = (lang === "hi" && m.title_hi) || m.title_en;
    const desc = (lang === "hi" && m.description_hi) || m.description_en;
    if (title) document.title = title;
    if (desc) {
      let d = document.querySelector('meta[name="description"]');
      if (!d) {
        d = document.createElement("meta");
        d.setAttribute("name", "description");
        document.head.appendChild(d);
      }
      d.setAttribute("content", desc);
    }
    const color = theme === "dark" ? m.theme_color_dark : m.theme_color_light;
    if (color) {
      const tags = [...document.querySelectorAll('meta[name="theme-color"]')];
      const one = tags[0] || document.head.appendChild(Object.assign(document.createElement("meta"), { name: "theme-color" }));
      tags.slice(1).forEach((t) => t.remove());
      one.removeAttribute("media");
      one.setAttribute("content", color);
    }
  }, [m, lang, theme]);

  return null;
}