import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// social links (card_items, kind = link) + résumé url (profile.resume_url)
export default function useSocials() {
  const [state, setState] = useState({ links: [], resume: "" });
  useEffect(() => {
    let off = false;
    Promise.all([
      supabase.from("card_items").select("*").eq("kind", "link"),
      supabase.from("profile").select("resume_url").eq("id", 1).maybeSingle(),
    ])
      .then(([a, b]) => {
        if (off) return;
        const links = (a.data || [])
          .filter((x) => x.visible !== false && x.url)
          .sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0))
          .map((x) => ({
            key: String(x.label_en || "").trim().toLowerCase(),
            label: { en: x.label_en || "", hi: x.label_hi || x.label_en || "" },
            url: x.url,
          }));
        setState({ links, resume: b.data?.resume_url || "" });
      })
      .catch(() => {});
    return () => { off = true; };
  }, []);
  return state;
}