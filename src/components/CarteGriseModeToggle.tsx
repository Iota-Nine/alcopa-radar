"use client";

import {
  carteGriseMarginBadgeClass,
  carteGriseMarginLabel,
} from "@/lib/expert/carte-grise";

interface Props {
  value: boolean;
  onChange: (includeInMargin: boolean) => void;
  estimatedEuro: number;
  compact?: boolean;
}

export function CarteGriseModeToggle({
  value,
  onChange,
  estimatedEuro,
  compact,
}: Props) {
  const labelClass = compact ? "text-[10px]" : "text-xs";

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <p className={`${labelClass} text-slate-500 font-medium`}>Carte grise (marge)</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(true);
          }}
          className={`px-2.5 py-1 rounded-lg border text-left transition-colors ${
            value
              ? "border-sky-600 bg-sky-950/40 text-sky-200"
              : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600"
          } ${compact ? "text-[10px]" : "text-xs"}`}
        >
          Avec CG
          <span className="block text-slate-500 font-normal">
            −{estimatedEuro.toLocaleString("fr-FR")} €
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(false);
          }}
          className={`px-2.5 py-1 rounded-lg border text-left transition-colors ${
            !value
              ? "border-violet-600 bg-violet-950/40 text-violet-200"
              : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600"
          } ${compact ? "text-[10px]" : "text-xs"}`}
        >
          Sans CG
          <span className="block text-slate-500 font-normal">0 € dans la marge</span>
        </button>
      </div>
      <p className={`${labelClass} text-slate-600`}>
        Estimation Paris : {estimatedEuro.toLocaleString("fr-FR")} € —{" "}
        {value
          ? "déduite de la marge et du plafond."
          : "non comptée (marge plus optimiste)."}
      </p>
    </div>
  );
}

export function CarteGriseMarginBadge({
  includeInMargin,
  compact,
}: {
  includeInMargin: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={`${compact ? "text-[10px]" : "text-xs"} px-2 py-0.5 rounded border ${carteGriseMarginBadgeClass(includeInMargin)}`}
    >
      {carteGriseMarginLabel(includeInMargin)}
    </span>
  );
}
