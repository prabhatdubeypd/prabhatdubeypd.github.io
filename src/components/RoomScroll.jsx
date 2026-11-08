import { useEffect } from "react";

const NAV = 56; // navbar height

// scrolls so the whole room of books is fitted in the screen below the navbar
export function scrollToRoom() {
  const el = document.getElementById("room") || document.getElementById("projects");
  if (!el) return;
  const r = el.getBoundingClientRect();
  const avail = window.innerHeight - NAV;
  const y = window.scrollY + r.top;
  const top = r.height >= avail ? y - NAV : y - NAV - (avail - r.height) / 2;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  try { history.replaceState(null, "", "#projects"); } catch { /* ignore */ }
}

// every plain "#projects" link (See my work, Scroll to explore ...) stops at the room
export default function RoomScroll() {
  useEffect(() => {
    const h = (e) => {
      const a = e.target?.closest?.('a[href="#projects"]');
      if (!a || a.dataset.book) return; // links that open a book are handled by the books
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      scrollToRoom();
    };
    document.addEventListener("click", h, true);
    return () => document.removeEventListener("click", h, true);
  }, []);
  return null;
}