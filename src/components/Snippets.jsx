import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { useSettings } from "../context/SettingsContext";
import { copyText, logEvent, useSiteSettings } from "../lib/siteExtras";

/* ---------- premium look ---------- */

const GOLD =
  "linear-gradient(180deg,#fff3bf 0%,#f0cb62 30%,#b8862b 58%,#f6dc8c 80%,#c9972f 100%)";

const PAGE_SIZE = 1;
const AUTO_SLIDE_MS = 5000;

/* ---------- translations ---------- */

const UI = {
  en: {
    all: "All",
    copy: "Copy",
    copied: "Copied!",
    more: "Show all",
    less: "Show less",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    auto: "Auto",
  },

  hi: {
    all: "सभी",
    copy: "कॉपी",
    copied: "कॉपी हो गया!",
    more: "पूरा दिखाएँ",
    less: "कम दिखाएँ",
    previous: "पिछला",
    next: "अगला",
    page: "पेज",
    of: "का",
    auto: "ऑटो",
  },
};

/* ---------- fallback snippets ---------- */

const DEFAULT_SNIPPETS = [
  {
    slug: "flutter-debounce",
    lang: "dart",
    title: {
      en: "Debounce a search field",
      hi: "सर्च बॉक्स में डिबाउंस",
    },
    note: {
      en: "Waits 400 ms after the last keystroke before calling your API. Cancel the timer in dispose.",
      hi: "आखिरी कीस्ट्रोक के 400 ms बाद ही API बुलाता है। dispose में टाइमर रद्द करना न भूलें।",
    },
    code: `import 'dart:async';

Timer? _debounce;

void onSearchChanged(String text) {
  _debounce?.cancel();
  _debounce = Timer(const Duration(milliseconds: 400), () {
    search(text);
  });
}

@override
void dispose() {
  _debounce?.cancel();
  super.dispose();
}`,
  },

  {
    slug: "react-use-debounce",
    lang: "js",
    title: {
      en: "useDebounce hook",
      hi: "useDebounce हुक",
    },
    note: {
      en: "Returns the value only after it stopped changing for 400 ms.",
      hi: "वैल्यू 400 ms तक न बदले तभी नई वैल्यू लौटाता है।",
    },
    code: `import { useEffect, useState } from "react";

export function useDebounce(value, delay = 400) {
  const [v, setV] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);

    return () => clearTimeout(t);
  }, [value, delay]);

  return v;
}`,
  },

  {
    slug: "supabase-rls-own-rows",
    lang: "sql",
    title: {
      en: "Supabase: users read only their own rows",
      hi: "Supabase: यूज़र सिर्फ़ अपनी पंक्तियाँ पढ़े",
    },
    note: {
      en: "Turn RLS on first, then add a policy. Without a policy nobody can read.",
      hi: "पहले RLS चालू करें, फिर policy जोड़ें। policy के बिना कोई नहीं पढ़ सकता।",
    },
    code: `alter table notes enable row level security;

create policy "read own notes"
on notes for select
using (auth.uid() = user_id);`,
  },

  {
    slug: "git-undo-commit",
    lang: "bash",
    title: {
      en: "Undo the last commit, keep the work",
      hi: "आखिरी कमिट हटाएँ, काम बचाएँ",
    },
    note: {
      en: "Only the commit goes away. Every change stays staged.",
      hi: "सिर्फ़ कमिट हटता है। सारे बदलाव बने रहते हैं।",
    },
    code: `git reset --soft HEAD~1`,
  },

  {
    slug: "css-fluid-type",
    lang: "css",
    title: {
      en: "Fluid heading size with clamp()",
      hi: "clamp() से अपने-आप बढ़ने वाला हेडिंग",
    },
    note: {
      en: "Scales smoothly from phone to desktop. No media queries.",
      hi: "फ़ोन से डेस्कटॉप तक अपने-आप बढ़ता है। media query की ज़रूरत नहीं।",
    },
    code: `h1 {
  font-size: clamp(2rem, 1.2rem + 3vw, 4rem);
  line-height: 1.1;
}`,
  },
];

/* ---------- syntax highlighting ---------- */

const C_JS = /\/\/.*|\/\*[\s\S]*?\*\//.source;

const STR =
  /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/.source;

const NUM = /\b\d+(?:\.\d+)?\b/.source;

const LANGS = {
  js: {
    c: C_JS,
    kw: "const|let|var|function|return|if|else|for|while|import|from|export|default|async|await|new|class|try|catch|throw|true|false|null|undefined|typeof|of|in",
  },

  dart: {
    c: C_JS,
    kw: "import|final|const|var|void|class|extends|return|async|await|if|else|for|new|true|false|null|late|required|override|super|static|Future|String|int|bool|double|Timer|Duration",
  },

  css: {
    c: /\/\*[\s\S]*?\*\//.source,
    kw: "",
  },

  sql: {
    c: /--.*/.source,
    kw: "select|from|where|create|alter|table|policy|on|for|using|with|check|insert|into|values|update|set|delete|enable|row|level|security|and|or|not|null|as|join|left|group|by|order|limit|primary|key|references|having|over|partition|rank|dense_rank|sum|count|filter|exists|conflict|do|json",
    ci: true,
  },

  bash: {
    c: /#.*/.source,
    kw: "git|npm|npx|cd|echo|export|sudo|rm|mv|cp|grep|find|sort|head|tail|history|lsof|kill|watch|env|df|du",
  },

  html: {
    c: /<!--[\s\S]*?-->/.source,
    kw: "",
  },
};

const ALIAS = {
  javascript: "js",
  jsx: "js",
  ts: "js",
  tsx: "js",
  typescript: "js",
  react: "js",
  flutter: "dart",
  shell: "bash",
  sh: "bash",
  postgres: "sql",
  pg: "sql",
};

const COLOR = {
  c: "#8c8372",
  s: "#a3d9a5",
  n: "#f2a98a",
  k: "#f0cb62",
};

function tokens(code, lang) {
  const key = ALIAS[lang] || lang;
  const l = LANGS[key] ? key : "js";
  const L = LANGS[l];

  const re = new RegExp(
    `(${L.c})|(${STR})|(${NUM})` +
      (L.kw ? `|\\b(${L.kw})\\b` : ""),
    L.ci ? "gi" : "g"
  );

  const out = [];
  let last = 0;
  let m;

  while ((m = re.exec(code))) {
    if (m.index > last) {
      out.push([null, code.slice(last, m.index)]);
    }

    out.push([
      m[1] != null
        ? "c"
        : m[2] != null
        ? "s"
        : m[3] != null
        ? "n"
        : "k",
      m[0],
    ]);

    last = m.index + m[0].length;

    if (m[0].length === 0) {
      re.lastIndex += 1;
    }
  }

  if (last < code.length) {
    out.push([null, code.slice(last)]);
  }

  return out;
}

/* ---------- icons ---------- */

const CopyIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 13l4 4L19 7" />
  </svg>
);

const ArrowLeft = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
);

const ArrowRight = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="M12 5l7 7-7 7" />
  </svg>
);

/* ---------- individual snippet card ---------- */

function Card({ sn, pick, S }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const long = sn.code.split("\n").length > 11;

  const toks = useMemo(
    () => tokens(sn.code, sn.lang),
    [sn.code, sn.lang]
  );

  const copy = async () => {
    if (!(await copyText(sn.code))) return;

    setCopied(true);
    logEvent("snippet_copy", sn.slug);

    setTimeout(() => {
      setCopied(false);
    }, 1800);
  };

  return (
    <motion.article
      layout
      whileHover={{
        y: -5,
        scale: 1.008,
      }}
      transition={{
        type: "spring",
        stiffness: 280,
        damping: 22,
      }}
      className="group relative mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-[18px] text-[#efe8d6] sm:rounded-[22px]"
      style={{
        background:
          "linear-gradient(145deg, rgba(31,24,15,.98) 0%, rgba(14,10,7,.99) 100%)",
        boxShadow:
          "0 0 0 1px rgba(240,203,98,.30), 0 24px 60px -28px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.035)",
      }}
    >
      {/* premium gold edge */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: GOLD }}
      />

      {/* subtle glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "#f0cb62" }}
      />

      <header className="relative flex items-start justify-between gap-2.5 px-3.5 pb-2.5 pt-3.5 sm:gap-3 sm:px-6 sm:pb-3 sm:pt-5">
        <div className="min-w-0">
          <span
            className="inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{
              color: "#f0cb62",
              background: "rgba(240,203,98,.055)",
              boxShadow:
                "inset 0 0 0 1px rgba(240,203,98,.42)",
            }}
          >
            {sn.lang}
          </span>

          <h3 className="mt-2 font-serif text-[15px] font-bold leading-snug sm:mt-2.5 sm:text-[18px]">
            {pick(sn.title)}
          </h3>
        </div>

        <motion.button
          type="button"
          onClick={copy}
          whileTap={{ scale: 0.93 }}
          aria-label={`${S.copy}: ${pick(sn.title)}`}
          className="flex shrink-0 items-center rounded-full px-2.5 py-1.5 text-[10px] font-semibold sm:px-3 sm:text-[11px]"
          style={
            copied
              ? {
                  background: GOLD,
                  color: "#3b2506",
                }
              : {
                  color: "#efe8d6",
                  background: "rgba(20,14,6,.65)",
                  boxShadow:
                    "inset 0 0 0 1px rgba(240,203,98,.45)",
                }
          }
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? "copied" : "copy"}
              initial={{
                opacity: 0,
                y: 5,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -5,
              }}
              transition={{
                duration: 0.15,
              }}
              className="flex items-center gap-1.5"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? S.copied : S.copy}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </header>

      {/* code */}
      <div
        className="relative mx-3 ml-4 overflow-hidden rounded-[12px] sm:mx-5 sm:ml-6 sm:rounded-[15px]"
        style={{
          background: "rgba(0,0,0,.43)",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,.055)",
        }}
      >
        <pre
          className="m-0 p-3 font-mono text-[10px] leading-[1.55] sm:p-4 sm:text-[12px] sm:leading-[1.65]"
          style={{
            maxHeight:
              open || !long ? "none" : "min(148px, 32vh)",
            overflowX: "auto",
            overflowY: "hidden",
            tabSize: 2,
          }}
        >
          <code>
            {toks.map(([k, t], i) =>
              k ? (
                <span
                  key={i}
                  style={{
                    color: COLOR[k],
                    fontStyle:
                      k === "c"
                        ? "italic"
                        : undefined,
                  }}
                >
                  {t}
                </span>
              ) : (
                <span key={i}>{t}</span>
              )
            )}
          </code>
        </pre>

        {long && !open && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
            style={{
              background:
                "linear-gradient(to bottom, transparent, #0d0a07)",
            }}
          />
        )}
      </div>

      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mx-4 ml-5 mt-1.5 self-start text-[10px] font-semibold transition-opacity hover:opacity-70 sm:mx-5 sm:ml-6 sm:text-[11px]"
          style={{ color: "#f0cb62" }}
        >
          {open ? S.less : S.more}
        </button>
      )}

      {/* note */}
      <p className="mt-0 px-4 pb-3.5 pt-2.5 text-[11px] leading-relaxed opacity-70 sm:mt-auto sm:px-6 sm:pb-5 sm:pt-3 sm:text-[12px]">
        {pick(sn.note)}
      </p>

      <span className="sr-only" aria-live="polite">
        {copied ? S.copied : ""}
      </span>
    </motion.article>
  );
}

/* ---------- normalize Supabase rows ---------- */

const norm = (r) => ({
  slug: r.slug || String(r.id),

  lang: String(r.lang || "js").toLowerCase(),

  title: {
    en: r.title_en || "",
    hi: r.title_hi || r.title_en || "",
  },

  note: {
    en: r.note_en || "",
    hi: r.note_hi || r.note_en || "",
  },

  code: String(r.code || ""),
});

/* ---------- main component ---------- */

export default function Snippets() {
  const { lang } = useSettings();
  const st = useSiteSettings();

  const S = UI[lang] || UI.en;

  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("all");

  /*
   * page:
   * 0 = first page
   * 1 = second page
   * etc.
   */
  const [page, setPage] = useState(0);

  /*
   * Used to make the slide direction feel natural.
   */
  const [direction, setDirection] = useState(1);

  const reduceMotion = useReducedMotion();

  /* ---------- load snippets ---------- */

  useEffect(() => {
    let off = false;

    supabase
      .from("snippets")
      .select("*")
      .eq("visible", true)
      .order("sort", { ascending: true })
      .then(
        ({ data, error }) => {
          if (!off) {
            setRows(
              !error && data && data.length
                ? data
                : false
            );
          }
        },
        () => {
          if (!off) setRows(false);
        }
      );

    return () => {
      off = true;
    };
  }, []);

  /* ---------- normalize list ---------- */

  const list = useMemo(
    () =>
      Array.isArray(rows)
        ? rows.map(norm).filter((x) => x.code)
        : DEFAULT_SNIPPETS,
    [rows]
  );

  /* ---------- available languages ---------- */

  const langs = useMemo(
    () => [...new Set(list.map((x) => x.lang))],
    [list]
  );

  /* ---------- filtered snippets ---------- */

  const filtered = useMemo(
    () =>
      filter === "all"
        ? list
        : list.filter((x) => x.lang === filter),
    [list, filter]
  );

  /* ---------- pagination ---------- */

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  /*
   * If changing the language filter makes the
   * current page invalid, bring the user back
   * to the first valid page.
   */
  useEffect(() => {
    setPage((current) =>
      Math.min(current, totalPages - 1)
    );
  }, [totalPages]);

  const start = page * PAGE_SIZE;

  const shown = filtered.slice(
    start,
    start + PAGE_SIZE
  );

  /* ---------- language switch ---------- */

  const changeFilter = (nextFilter) => {
    if (nextFilter === filter) return;

    setDirection(
      nextFilter === "all"
        ? -1
        : 1
    );

    setFilter(nextFilter);
    setPage(0);
  };

  /* ---------- next page ---------- */

  const nextPage = () => {
    setDirection(1);

    setPage((current) =>
      current >= totalPages - 1
        ? 0
        : current + 1
    );
  };

  /* ---------- previous page ---------- */

  const previousPage = () => {
    setDirection(-1);

    setPage((current) =>
      current <= 0
        ? totalPages - 1
        : current - 1
    );
  };

  /* ---------- specific page ---------- */

  const goToPage = (index) => {
    setDirection(
      index > page ? 1 : -1
    );

    setPage(index);
  };

  /* ---------- AUTO SLIDE ---------- */

  useEffect(() => {
    /*
     * If there is only one page, there is nothing
     * to automatically slide through.
     */
    if (totalPages <= 1) return;

    /*
     * Every 5 seconds:
     *
     * 1 → 2
     * 2 → 3
     * 3 → 4
     * ...
     * last → 1
     */
    const timer = setInterval(() => {
      setDirection(1);

      setPage((current) =>
        current >= totalPages - 1
          ? 0
          : current + 1
      );
    }, AUTO_SLIDE_MS);

    return () => clearInterval(timer);
  }, [totalPages, filter]);

  /* ---------- pick language ---------- */

  const pick = (o) =>
    (lang === "hi"
      ? o.hi || o.en
      : o.en) || "";

  /* ---------- hidden section ---------- */

  if (!st.snippets_on) return null;

  const title =
    lang === "hi"
      ? st.snippets_title_hi ||
        st.snippets_title_en
      : st.snippets_title_en;

  const sub =
    lang === "hi"
      ? st.snippets_sub_hi ||
        st.snippets_sub_en
      : st.snippets_sub_en;

  /* ---------- SEO structured data ---------- */

  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",

    itemListElement: list.map((sn, i) => ({
      "@type": "ListItem",
      position: i + 1,

      item: {
        "@type": "SoftwareSourceCode",
        name: pick(sn.title),
        programmingLanguage: sn.lang,
        text: sn.code,
      },
    })),
  };

  return (
    <section
      id="snippets"
      className="relative mx-auto max-w-6xl px-3 py-12 sm:px-5 sm:py-28"
    >
      {/* SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(ld).replace(
            /</g,
            "\\u003c"
          ),
        }}
      />

      {/* ---------- heading ---------- */}

      <div
        data-reveal
        className="max-w-2xl"
      >
        <p
          className="font-mono text-[11px] uppercase tracking-[0.3em]"
          style={{ color: "#b8862b" }}
        >
          {"// snippets"}
        </p>

        <h2 className="mt-2.5 font-serif text-3xl font-bold leading-tight sm:mt-3 sm:text-5xl">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-relaxed opacity-70 sm:mt-3 sm:text-base">
          {sub}
        </p>
      </div>

      {/* ---------- language filters ---------- */}

      {langs.length > 1 && (
        <div
          data-reveal
          data-reveal-delay="0.1"
          className="mt-5 flex flex-wrap gap-1.5 sm:mt-7 sm:gap-2"
        >
          {["all", ...langs].map((l) => (
            <motion.button
              key={l}
              type="button"
              onClick={() =>
                changeFilter(l)
              }
              whileTap={{
                scale: 0.95,
              }}
              className="rounded-full px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-all sm:px-4 sm:text-[11px] sm:tracking-[0.14em]"
              style={
                filter === l
                  ? {
                      background: GOLD,
                      color: "#3b2506",
                      boxShadow:
                        "0 8px 24px -12px rgba(240,203,98,.7)",
                    }
                  : {
                      color: "inherit",
                      background:
                        "rgba(20,14,6,.25)",
                      boxShadow:
                        "inset 0 0 0 1px rgba(184,134,43,.55)",
                    }
              }
            >
              {l === "all"
                ? S.all
                : l}
            </motion.button>
          ))}
        </div>
      )}

      {/* ---------- main premium snippets panel ---------- */}

      <div
        className="relative mx-auto mt-5 max-w-3xl overflow-hidden rounded-[20px] p-2 sm:mt-8 sm:rounded-[28px] sm:p-4"
        style={{
          background:
            "linear-gradient(145deg, rgba(24,18,11,.82), rgba(8,6,4,.94))",
          boxShadow:
            "0 0 0 1px rgba(240,203,98,.13), 0 30px 80px -40px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.025)",
        }}
      >
        {/* subtle top highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[10%] right-[10%] top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(240,203,98,.7), transparent)",
          }}
        />

        {/* ---------- cards ---------- */}

        <div className="relative">
          <AnimatePresence
            mode="wait"
            initial={false}
            custom={direction}
          >
            <motion.div
              key={`${filter}-${page}`}
              custom={direction}
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      x:
                        direction > 0
                          ? 55
                          : -55,
                    }
              }
              animate={{
                opacity: 1,
                x: 0,
              }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      x:
                        direction > 0
                          ? -55
                          : 55,
                    }
              }
              transition={{
                duration:
                  reduceMotion
                    ? 0.15
                    : 0.38,
                ease: [
                  0.22,
                  1,
                  0.36,
                  1,
                ],
              }}
              className="mx-auto w-full max-w-2xl"
            >
              {shown.map((sn) => (
                <Card
                  key={sn.slug}
                  sn={sn}
                  pick={pick}
                  S={S}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ---------- pagination ---------- */}

        {totalPages > 1 && (
          <div className="relative mt-3 flex items-center justify-between gap-1.5 border-t border-white/[0.06] pt-3 sm:mt-5 sm:gap-4 sm:pt-5">
            {/* previous */}
            <motion.button
              type="button"
              onClick={previousPage}
              whileHover={{
                x: -2,
              }}
              whileTap={{
                scale: 0.94,
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2 text-[10px] font-semibold sm:gap-2 sm:px-4 sm:text-[11px]"
              style={{
                color: "#efe8d6",
                background:
                  "rgba(20,14,6,.6)",
                boxShadow:
                  "inset 0 0 0 1px rgba(240,203,98,.28)",
              }}
              aria-label={S.previous}
            >
              <ArrowLeft />
              <span>
                <span className="hidden sm:inline">{S.previous}</span>
              </span>
            </motion.button>

            {/* page numbers */}
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden sm:flex-none sm:gap-1.5">
              {Array.from(
                {
                  length: Math.min(totalPages, 5),
                },
                (_, i) =>
                  Math.max(
                    0,
                    Math.min(page - 2, totalPages - 5)
                  ) + i
              ).map((i) => {
                const active =
                  i === page;

                return (
                  <motion.button
                    key={i}
                    type="button"
                    onClick={() =>
                      goToPage(i)
                    }
                    whileTap={{
                      scale: 0.9,
                    }}
                    className="relative flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 font-mono text-[9px] font-bold sm:h-8 sm:min-w-8 sm:px-2 sm:text-[10px]"
                    style={
                      active
                        ? {
                            background: GOLD,
                            color: "#3b2506",
                            boxShadow:
                              "0 8px 24px -12px rgba(240,203,98,.8)",
                          }
                        : {
                            color: "#bfb6a5",
                            background:
                              "rgba(255,255,255,.025)",
                            boxShadow:
                              "inset 0 0 0 1px rgba(255,255,255,.08)",
                          }
                    }
                    aria-label={`${S.page} ${
                      i + 1
                    }`}
                    aria-current={
                      active
                        ? "page"
                        : undefined
                    }
                  >
                    {i + 1}
                  </motion.button>
                );
              })}
            </div>

            {/* next */}
            <motion.button
              type="button"
              onClick={nextPage}
              whileHover={{
                x: 2,
              }}
              whileTap={{
                scale: 0.94,
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2 text-[10px] font-semibold sm:gap-2 sm:px-4 sm:text-[11px]"
              style={{
                color: "#3b2506",
                background: GOLD,
                boxShadow:
                  "0 10px 28px -16px rgba(240,203,98,.8)",
              }}
              aria-label={S.next}
            >
              <span>
                <span className="hidden sm:inline">{S.next}</span>
              </span>
              <ArrowRight />
            </motion.button>
          </div>
        )}

        {/* ---------- auto-slide indicator ---------- */}

        {totalPages > 1 && (
          <div className="mt-2 flex items-center justify-center gap-2 sm:mt-3">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  "#f0cb62",
                boxShadow:
                  "0 0 10px rgba(240,203,98,.7)",
              }}
            />

            <span className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-35">
              {S.auto} · 5s
            </span>

            <span className="text-[9px] opacity-25">
              {page + 1} {S.of}{" "}
              {totalPages}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}