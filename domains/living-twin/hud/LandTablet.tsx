/**
 * Context-aware land / moisture tablet overlay.
 * Presentation only. Never writes evidence.
 * React 19 + strict TypeScript.
 */

import React, { useMemo, useCallback } from "react";

export interface LandTabletProps {
  parcelId: string;
  moisture: number;
  nutrients: { n: number; p: number; k: number; om: number; ph: number };
  stress: { drought: number; weed: number; pest: number; disease: number };
  soilTexture: string;
  cropCode: string | null;
  onClose: () => void;
  /** optional repositioning support */
  className?: string;
}

function moistureColor(m: number): string {
  if (m >= 0.4) return "#22c55e";
  if (m >= 0.25) return "#eab308";
  return "#ef4444";
}

export const LandTablet: React.FC<LandTabletProps> = React.memo(
  ({
    parcelId,
    moisture,
    nutrients,
    stress,
    soilTexture,
    cropCode,
    onClose,
    className = "",
  }) => {
    const moisturePct = useMemo(() => Math.round(moisture * 100), [moisture]);
    const color = useMemo(() => moistureColor(moisture), [moisture]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      },
      [onClose]
    );

    return (
      <div
        role="dialog"
        aria-label={`Land status for parcel ${parcelId}`}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`fixed bottom-4 right-4 z-50 w-80 max-w-[90vw] rounded-xl border border-stone-700 bg-stone-900/95 p-4 text-stone-100 shadow-2xl backdrop-blur ${className}`}
      >
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide">
            Land Tablet · {parcelId}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-100"
            aria-label="Close land tablet"
          >
            Close
          </button>
        </header>

        <section className="mb-3">
          <div className="mb-1 flex justify-between text-xs">
            <span>Moisture</span>
            <span style={{ color }}>{moisturePct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-stone-800">
            <div
              className="h-full transition-all"
              style={{ width: `${moisturePct}%`, backgroundColor: color }}
            />
          </div>
          <p className="mt-1 text-[10px] text-stone-500">
            Texture: {soilTexture} · Crop: {cropCode ?? "none"}
          </p>
        </section>

        <section className="mb-3 grid grid-cols-5 gap-1 text-center text-[10px]">
          {(["n", "p", "k", "om", "ph"] as const).map((key) => (
            <div key={key} className="rounded bg-stone-800/80 py-1">
              <div className="font-medium uppercase text-stone-400">{key}</div>
              <div>
                {key === "ph"
                  ? nutrients.ph.toFixed(1)
                  : Math.round(nutrients[key] * 100)}
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-2 gap-2 text-[11px]">
          {Object.entries(stress).map(([k, v]) => (
            <div key={k} className="flex justify-between rounded bg-stone-800/60 px-2 py-1">
              <span className="capitalize text-stone-400">{k}</span>
              <span>{Math.round(v * 100)}%</span>
            </div>
          ))}
        </section>

        <footer className="mt-3 border-t border-stone-800 pt-2 text-[10px] text-stone-500">
          Scenario state only · Not regulatory evidence · Human authority final
        </footer>
      </div>
    );
  }
);

LandTablet.displayName = "LandTablet";
