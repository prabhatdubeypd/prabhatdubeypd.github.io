import { useEffect, useState } from "react";
import { supabase } from "./supabase";

let cache = null; // fetched once, shared by every component
let pending = null;

const clean = (raw) => {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  return d.length === 10 ? `91${d}` : d.replace(/^0+/, "");
};

function load() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = supabase
      .from("profile")
      .select("whatsapp, wa_intro")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => (cache = { number: clean(data?.whatsapp), intro: data?.wa_intro || "" }))
      .catch(() => (cache = { number: "", intro: "" }));
  }
  return pending;
}

export default function useWhatsApp() {
  const [s, setS] = useState(cache || { number: "", intro: "" });
  useEffect(() => {
    let off = false;
    load().then((v) => { if (!off) setS(v); });
    return () => { off = true; };
  }, []);
  return s;
}