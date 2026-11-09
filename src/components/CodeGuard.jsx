import { useEffect, useState } from "react";
import { useData } from "../context/DataContext";

const isField = (el) => !!el?.closest?.("input, textarea, select, [contenteditable='true']");

export default function CodeGuard() {
  const { features, t } = useData();
  const on = features.codeGuard !== false;
  const strict = features.codeGuardStrict === true;
  const [hidden, setHidden] = useState(false);

  // right-click, shortcuts, image dragging
  useEffect(() => {
    if (!on) return;
    const ctx = (e) => {
      if (!isField(e.target)) e.preventDefault();
    };
    const key = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const blocked =
        e.key === "F12" ||
        (mod && e.shiftKey && ["KeyI", "KeyJ", "KeyC", "KeyK"].includes(e.code)) || // Ctrl+Shift+I/J/C/K
        (e.metaKey && e.altKey && ["KeyI", "KeyJ", "KeyC", "KeyU"].includes(e.code)) || // Mac: Cmd+Option+I/J/C/U
        (e.ctrlKey && e.code === "KeyU") || // view source
        (mod && e.code === "KeyS"); // save page
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const drag = (e) => {
      if (e.target?.tagName === "IMG") e.preventDefault();
    };
    document.addEventListener("contextmenu", ctx);
    document.addEventListener("keydown", key, true);
    document.addEventListener("dragstart", drag);
    return () => {
      document.removeEventListener("contextmenu", ctx);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("dragstart", drag);
    };
  }, [on]);

  // strict mode: guess from the window size whether DevTools is docked open (desktop only)
  useEffect(() => {
    if (!on || !strict || window.matchMedia("(pointer: coarse)").matches) return;
    const check = () => {
      const wide = window.outerWidth - window.innerWidth > 280;
      const tall = window.outerHeight - window.innerHeight > 280;
      setHidden(wide || tall);
    };
    check();
    const id = setInterval(check, 1000);
    window.addEventListener("resize", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", check);
      setHidden(false);
    };
  }, [on, strict]);

  if (!on || !strict || !hidden) return null;
  const v = t("guard_msg");
  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-bg p-8 text-center text-ink">
      <p className="max-w-sm font-serif text-2xl font-bold">
        {!v || v === "guard_msg" ? "Please close the developer tools to view this site." : v}
      </p>
    </div>
  );
}