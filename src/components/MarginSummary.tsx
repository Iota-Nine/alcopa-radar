"use client";

import { formatMarge, formatMaxBid, margeColorClass, plafondMarginHint } from "@/lib/format";
import type { MarginFields } from "@/lib/expert/repair-margin";

interface Props {
  estimated: MarginFields & { repairBudget: number };
  real: (MarginFields & { repairBudget: number }) | null;
  enchereActuelle?: number;
  compact?: boolean;
}

export function MarginSummary({ estimated, real, enchereActuelle, compact }: Props) {
  const hintIa = plafondMarginHint(
    estimated.margePotentielle,
    estimated.margeAuPlafond,
    estimated.prixMaxConseille,
    enchereActuelle,
    "plafond IA"
  );
  const hintUser =
    real &&
    plafondMarginHint(
      real.margePotentielle,
      real.margeAuPlafond,
      real.prixMaxConseille,
      enchereActuelle,
      "plafond utilisateur"
    );

  const titleClass = compact ? "text-[10px]" : "text-xs";
  const valueClass = compact ? "text-base" : "text-lg";

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-2.5">
          <p className={`${titleClass} text-slate-500`}>Marge estimée (IA)</p>
          <p className={`font-bold ${valueClass} ${margeColorClass(estimated.margePotentielle)}`}>
            {formatMarge(estimated.margePotentielle, { label: false })}
          </p>
          <p className={`${titleClass} text-slate-600 mt-0.5`}>
            Plafond IA {formatMaxBid(estimated.prixMaxConseille)}
          </p>
        </div>
        <div
          className={`rounded-lg border p-2.5 ${
            real
              ? "border-blue-800/60 bg-blue-950/20"
              : "border-slate-800 bg-slate-950/20"
          }`}
        >
          <p className={`${titleClass} text-slate-500`}>Marge réelle (votre LBC)</p>
          {real ? (
            <>
              <p
                className={`font-bold ${valueClass} ${margeColorClass(real.margePotentielle)}`}
              >
                {formatMarge(real.margePotentielle, { label: false })}
              </p>
              <p className={`${titleClass} text-blue-400/80 mt-0.5`}>
                Plafond utilisateur {formatMaxBid(real.prixMaxConseille)}
              </p>
            </>
          ) : (
            <p className={`font-semibold ${valueClass} text-slate-500`}>—</p>
          )}
        </div>
      </div>
      {hintIa && <p className={`${titleClass} text-slate-500`}>{hintIa}</p>}
      {hintUser && <p className={`${titleClass} text-blue-400/80`}>{hintUser}</p>}
    </div>
  );
}
