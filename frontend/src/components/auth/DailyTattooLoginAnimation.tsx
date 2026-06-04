"use client";

import { useCallback, useEffect, useState } from "react";

import { TattooLoginIllustration } from "@/components/auth/TattooLoginIllustration";

const LAST_SEEN_KEY = "sessaoink:login-animation:last-seen-date";
const PENDING_UNTIL_KEY = "sessaoink:login-animation:pending-until";

/** Duração exata da coreografia (2,6s). Sincronizada com globals.css. */
const ANIMATION_DURATION_MS = 2600;

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function safeStorageGet(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage bloqueado: a regra não será persistida nesse navegador.
  }
}

function safeStorageRemove(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Storage bloqueado: nada a remover.
  }
}

function shouldRespectReducedMotion() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

/** Dispositivos low-end recebem o resultado final estático (sem coreografia). */
function isLowEndDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  return cores < 4 || memory < 4;
}

function isPreviewModeEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);

  return (
    process.env.NODE_ENV !== "production" &&
    params.get("previewAnimation") === "1"
  );
}

export function DailyTattooLoginAnimation() {
  const [shouldRender, setShouldRender] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const finishAnimation = useCallback((isPreview: boolean) => {
    setShouldRender(false);

    if (!isPreview && typeof window !== "undefined") {
      safeStorageRemove(window.sessionStorage, PENDING_UNTIL_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const preview = isPreviewModeEnabled();
    setPreviewMode(preview);

    const today = getLocalDateKey();
    const now = Date.now();

    // Reduced-motion ou dispositivo fraco: pula a coreografia e mostra o
    // formulário final imediatamente (apenas registra que já foi visto hoje).
    if ((shouldRespectReducedMotion() || isLowEndDevice()) && !preview) {
      safeStorageSet(window.localStorage, LAST_SEEN_KEY, today);
      return;
    }

    const pendingUntilRaw = safeStorageGet(
      window.sessionStorage,
      PENDING_UNTIL_KEY,
    );

    const pendingUntil = Number(pendingUntilRaw ?? "0");
    const lastSeenDate = safeStorageGet(window.localStorage, LAST_SEEN_KEY);

    let mustShowAnimation = preview;
    let visibleForMs = ANIMATION_DURATION_MS;

    if (!mustShowAnimation && pendingUntil > now) {
      mustShowAnimation = true;
      visibleForMs = Math.max(800, pendingUntil - now);
    }

    if (!mustShowAnimation && lastSeenDate !== today) {
      const newPendingUntil = now + ANIMATION_DURATION_MS;

      safeStorageSet(window.localStorage, LAST_SEEN_KEY, today);
      safeStorageSet(
        window.sessionStorage,
        PENDING_UNTIL_KEY,
        String(newPendingUntil),
      );

      mustShowAnimation = true;
      visibleForMs = ANIMATION_DURATION_MS;
    }

    if (!mustShowAnimation) {
      return;
    }

    setShouldRender(true);

    const timeoutId = window.setTimeout(() => {
      finishAnimation(preview);
    }, visibleForMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [finishAnimation]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="tattoo-login-once" aria-hidden="true">
      <TattooLoginIllustration />

      <button
        type="button"
        className="tattoo-skip-button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => finishAnimation(previewMode)}
      >
        Pular →
      </button>
    </div>
  );
}
