export interface BrowserCapabilities {
  webgpu: boolean;
  webgl2: boolean;
  offscreenCanvas: boolean;
  sharedArrayBuffer: boolean;
  serviceWorker: boolean;
}

export function detectCapabilities(): BrowserCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { webgpu: false, webgl2: false, offscreenCanvas: false, sharedArrayBuffer: false, serviceWorker: false };
  }
  return {
    webgpu: "gpu" in navigator,
    webgl2: (() => {
      try {
        const c = document.createElement("canvas");
        return !!c.getContext("webgl2");
      } catch {
        return false;
      }
    })(),
    offscreenCanvas: typeof OffscreenCanvas !== "undefined",
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    serviceWorker: "serviceWorker" in navigator,
  };
}

export function isSecureContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext === true;
}

export function setPreference(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(`tsm.pref.${key}`, value);
}

export function getPreference(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(`tsm.pref.${key}`);
}

export const BROWSER_PACKAGE_VERSION = "1.0.0" as const;
