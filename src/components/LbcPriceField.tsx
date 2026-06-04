"use client";

import { leboncoinSearchUrl } from "@/lib/leboncoin";
import type { VehicleData } from "@/types/vehicle";
import { ExternalLink } from "lucide-react";

interface Props {
  vehicle: VehicleData;
  value: number | null;
  onChange: (price: number | null) => void;
  onCommit?: () => void;
  compact?: boolean;
}

export function LbcPriceField({ vehicle, value, onChange, onCommit, compact }: Props) {
  const display = value !== null && value > 0 ? String(value) : "";

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <a
        href={leboncoinSearchUrl(vehicle)}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-blue-400 hover:underline ${
          compact ? "text-[10px]" : "text-xs"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        Voir des annonces sur Leboncoin
        <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
      <label className="block">
        <span className={`text-slate-500 ${compact ? "text-[10px]" : "text-xs"}`}>
          Prix de revente LBC (vous)
        </span>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            placeholder="ex. 12500"
            value={display}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (!raw) {
                onChange(null);
                return;
              }
              const n = parseInt(raw, 10);
              onChange(Number.isFinite(n) && n > 0 ? n : null);
            }}
            onBlur={() => onCommit?.()}
            onClick={(e) => e.stopPropagation()}
            className={`w-full rounded-lg border border-slate-700 bg-slate-950 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none ${
              compact ? "px-2 py-1 text-sm" : "px-3 py-2 text-base"
            }`}
          />
          <span className="text-slate-500 text-sm shrink-0">€</span>
        </div>
      </label>
      {!value && (
        <p className={`text-slate-600 ${compact ? "text-[10px]" : "text-xs"}`}>
          Saisissez le prix vu sur LBC pour calculer la marge.
        </p>
      )}
    </div>
  );
}
