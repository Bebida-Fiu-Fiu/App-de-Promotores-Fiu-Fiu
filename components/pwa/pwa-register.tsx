"use client";

import { useEffect } from "react";

const SERVICE_WORKER_URL = "/sw.js";

export function PwaRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
          scope: "/",
        });
      } catch (error) {
        console.error("Falha ao registrar o service worker do PWA.", error);
      }
    };

    void register();
  }, []);

  return null;
}
