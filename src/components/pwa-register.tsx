"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const PWA_INSTALLED_KEY = "pwa-installed";
const PWA_REMIND_AT_KEY = "pwa-install-remind-at";
const REMIND_LATER_MS = 24 * 60 * 60 * 1000;

export function PwaRegister() {
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [showInstallHint, setShowInstallHint] = useState(() => {
    if (typeof window === "undefined") return false;

    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      localStorage.getItem(PWA_INSTALLED_KEY) === "1";

    if (installed) return false;

    const remindAtRaw = localStorage.getItem(PWA_REMIND_AT_KEY);
    if (!remindAtRaw) return true;

    const remindAt = Number(remindAtRaw);
    if (!Number.isFinite(remindAt)) return true;

    return Date.now() >= remindAt;
  });
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  const isIos = useMemo(
    () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent),
    []
  );
  const installModeLabel = installPromptEvent
    ? "Mode install: langsung dari tombol ini"
    : isIos
      ? "Mode install: manual via Share > Add to Home Screen"
      : "Mode install: kemungkinan manual (menu browser)";

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerSw = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // no-op
      }
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      installPromptRef.current = promptEvent;
      setInstallPromptEvent(promptEvent);
    };

    const onInstalled = () => {
      setShowInstallHint(false);
      setInstallPromptEvent(null);
      installPromptRef.current = null;
      localStorage.setItem(PWA_INSTALLED_KEY, "1");
      localStorage.removeItem(PWA_REMIND_AT_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    registerSw();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    let promptEvent = installPromptRef.current ?? installPromptEvent;

    if (!promptEvent && !isIos) {
      promptEvent = await new Promise<BeforeInstallPromptEvent | null>((resolve) => {
        let settled = false;

        const fallbackTimer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          window.removeEventListener("beforeinstallprompt", onLatePrompt);
          resolve(null);
        }, 1500);

        const onLatePrompt = (event: Event) => {
          event.preventDefault();
          const lateEvent = event as BeforeInstallPromptEvent;
          installPromptRef.current = lateEvent;
          setInstallPromptEvent(lateEvent);
          if (settled) return;
          settled = true;
          window.clearTimeout(fallbackTimer);
          window.removeEventListener("beforeinstallprompt", onLatePrompt);
          resolve(lateEvent);
        };

        window.addEventListener("beforeinstallprompt", onLatePrompt, { once: true });
      });
    }

    if (!promptEvent) {
      if (isIos) {
        toast.message("Di Safari: tap Share lalu pilih Add to Home Screen.");
      } else {
        toast.message("Buka menu browser lalu pilih Install App / Add to Home Screen.");
      }
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setShowInstallHint(false);
    }
  };

  const handleRemindLater = () => {
    localStorage.setItem(PWA_REMIND_AT_KEY, String(Date.now() + REMIND_LATER_MS));
    setShowInstallHint(false);
  };

  if (!isHydrated || !showInstallHint) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-5 text-white shadow-2xl">
        <p className="text-base font-bold text-white">Install Aplikasi STIFIn</p>
        {installPromptEvent ? (
          <p className="mt-1 text-xs text-amber-50/95">
            Untuk akses cepat tanpa buka browser, pasang aplikasi ini ke perangkat Anda.
          </p>
        ) : isIos ? (
          <p className="mt-1 text-xs text-amber-50/95">
            Di Safari iPhone: ketuk tombol Share, lalu pilih Add to Home Screen.
          </p>
        ) : (
          <p className="mt-1 text-xs text-amber-50/95">
            Gunakan menu browser lalu pilih Install App / Add to Home Screen.
          </p>
        )}
        <div className="mt-2 inline-flex items-center rounded-full border border-white/40 bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-amber-50">
          {installModeLabel}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleRemindLater}
            className="rounded-md border border-white/40 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
          >
            Ingatkan Besok
          </button>
          <button
            type="button"
            onClick={handleInstall}
            className="rounded-md bg-slate-950/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-950"
          >
            Install Sekarang
          </button>
        </div>
      </div>
    </div>
  );
}
