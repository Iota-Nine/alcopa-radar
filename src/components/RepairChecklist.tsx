"use client";

import { useMemo } from "react";
import {
  computeRepairBudget,
  normalizeRepairEstimates,
  repairCategoryLabel,
  repairMidCost,
} from "@/lib/expert/repair-margin";
import type { RepairEstimate } from "@/types/vehicle";

interface Props {
  repairs: RepairEstimate[];
  includedIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
}

export function RepairChecklist({ repairs, includedIds, onToggle }: Props) {
  const normalized = useMemo(() => normalizeRepairEstimates(repairs), [repairs]);

  if (normalized.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Aucune réparation chiffrée — marge basée sur le CT uniquement (aucun défaut majeur /
        critique).
      </p>
    );
  }

  const marginBudget = computeRepairBudget(normalized, includedIds);

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">
        Cochez ce que vous prévoyez de faire. Par défaut :{" "}
        <span className="text-violet-300">CT majeur / critique seulement</span> — peinture, risques
        modèle et mineurs sont hors marge.
      </p>
      <ul className="space-y-1.5">
        {normalized.map((r) => {
          const checked = includedIds.has(r.id);
          const mid = repairMidCost(r);
          return (
            <li
              key={r.id}
              className={`flex items-start gap-2 text-xs rounded-lg px-2 py-1.5 ${
                checked ? "bg-violet-950/40 border border-violet-900/50" : "bg-slate-950/50"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggle(r.id, e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 rounded shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <span className="text-slate-300">{r.label}</span>
                <span className="text-slate-600 ml-1">
                  ({r.costMin.toLocaleString("fr-FR")}–{r.costMax.toLocaleString("fr-FR")} €
                  {checked ? ` · ~${mid.toLocaleString("fr-FR")} € retenu` : ""})
                </span>
                <span className="block text-[10px] text-slate-600 mt-0.5">
                  {repairCategoryLabel(r.category)}
                  {!r.countsInMarginDefault && " · hors marge par défaut"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-400">
        Budget réparations retenu :{" "}
        <span className="text-violet-300 font-semibold">
          {marginBudget.toLocaleString("fr-FR")} €
        </span>
      </p>
    </div>
  );
}
