"use client";

import { useEffect, useState } from "react";

const SERVICE_WORKER_URL = "/sw.js";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const standaloneMatch = window.matchMedia("(display-mode: standalone)");
    const updateStandaloneState = () => {
      const isIosStandalone = "standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      setIsStandalone(standaloneMatch.matches || isIosStandalone);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    updateStandaloneState();

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneMatch.addEventListener("change", updateStandaloneState);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneMatch.removeEventListener("change", updateStandaloneState);
    };
  }, []);

  if (!installPrompt || isStandalone) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0c2432]/95 px-4 py-3 text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur">
        <div>
          <p className="text-sm font-semibold">Instalar aplicativo</p>
          <p className="text-xs text-white/70">Adicione o app na tela inicial para usar como aplicativo.</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-[#009c6c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#007a55]"
          onClick={async () => {
            await installPrompt.prompt();
            const choice = await installPrompt.userChoice;

            if (choice.outcome !== "accepted") {
              return;
            }

            setInstallPrompt(null);
          }}
        >
          Instalar
        </button>
      </div>
    </div>
  );
}
