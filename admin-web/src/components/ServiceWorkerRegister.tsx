"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // A service worker registered from an earlier session can pin the
      // browser to a stale JS/CSS bundle indefinitely under `next dev` —
      // dev chunk URLs aren't content-hashed the way production builds
      // are, so sw.js's cache-first policy for /_next/static/ never
      // re-fetches. Clean up any prior registration so local dev always
      // reflects the current source.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability/offline support is a progressive enhancement —
      // never block the app if registration fails.
    });
  }, []);

  return null;
}
