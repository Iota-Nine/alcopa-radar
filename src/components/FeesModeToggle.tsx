"use client";

import { feesModeBadgeClass, feesModeLabel } from "@/lib/alcopa/alcopa-fees";

interface Props {
  value: boolean;
  onChange: (feesIncluded: boolean) => void;
  detected?: boolean;
  compact?: boolean;
}

export function FeesModeToggle({ value, onChange, detected, compact }: Props) {
  const labelClass = compact ? "text-[10px]" : "text-xs";

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <p className={`${labelClass} text-slate-500 font-medium`}>Frais Alcopa (enchère)</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(true);
          }}
          className={`px-2.5 py-1 rounded-lg border text-left transition-colors ${
            value
              ? "border-emerald-600 bg-emerald-950/50 text-emerald-300"
              : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600"
          } ${compact ? "text-[10px]" : "text-xs"}`}
        >
          Frais inclus
          <span className="block text-slate-500 font-normal">0 € en sus</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(false);
          }}
          className={`px-2.5 py-1 rounded-lg border text-left transition-colors ${
            !value
              ? "border-amber-600 bg-amber-950/40 text-amber-200"
              : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600"
          } ${compact ? "text-[10px]" : "text-xs"}`}
        >
          Frais en sus
          <span className="block text-slate-500 font-normal">+350 €</span>
        </button>
      </div>
      {detected !== undefined && detected !== value && (
        <p className={`${labelClass} text-slate-600`}>
          Détecté sur Alcopa : {feesModeLabel(detected)} — votre choix prime pour la marge.
        </p>
      )}
      {detected === undefined && (
        <p className={`${labelClass} text-slate-600`}>
          Non détecté sur la fiche — choisissez selon la vente.
        </p>
      )}
    </div>
  );
}
