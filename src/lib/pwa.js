let saved = null;

export const getPrompt = () => saved;
export const clearPrompt = () => { saved = null; };
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

export function initPwa() {
  // Chrome fires this early, so catch it here and keep it for the Install button
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    saved = e;
    window.dispatchEvent(new Event("pwa-ready"));
  });
  window.addEventListener("appinstalled", () => { saved = null; });

  // the service worker only runs on the live site (not in npm run dev)
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    });
  }
}