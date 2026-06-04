"use client";

import { formatAlcopaFeesDetail } from "@/lib/alcopa/alcopa-fees";
import { normalizeRepairEstimates } from "@/lib/expert/repair-margin";
import { RepairChecklist } from "@/components/RepairChecklist";
import type { VehicleAnalysis } from "@/types/vehicle";

function buildDetailLines(
  analysis: VehicleAnalysis,
  feesIncluded?: boolean
): { text: string; warn?: boolean }[] {
  const lines: { text: string; warn?: boolean }[] = [];

  for (const p of analysis.problemes) {
    lines.push({ text: p, warn: true });
  }

  if (analysis.ctAnalysis) {
    lines.push({ text: analysis.ctAnalysis });
  }

  if (analysis.engineNotes) {
    lines.push({ text: analysis.engineNotes });
  }

  lines.push({
    text: formatAlcopaFeesDetail(feesIncluded, analysis.fraisAlcopa ?? 0),
  });

  if (
    analysis.problemes.length === 0 &&
    normalizeRepairEstimates(analysis.repairEstimates).every(
      (r) => !r.countsInMarginDefault
    )
  ) {
    lines.unshift({
      text: "Aucun défaut CT majeur/critique — marge sans réparation mécanique (risques modèle affichés à titre informatif).",
    });
  }

  return lines;
}

interface Props {
  analysis: VehicleAnalysis;
  feesIncluded?: boolean;
  repairs: ReturnType<typeof normalizeRepairEstimates>;
  includedIds: Set<string>;
  onToggleRepair: (id: string, checked: boolean) => void;
  onResetRepairs?: () => void;
}

export function VehicleDetailPanel({
  analysis,
  feesIncluded,
  repairs,
  includedIds,
  onToggleRepair,
  onResetRepairs,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Réparations & CT
        </p>
        {onResetRepairs && (
          <button
            type="button"
            onClick={onResetRepairs}
            className="text-[11px] text-slate-500 hover:text-white border border-slate-700 px-2 py-0.5 rounded"
          >
            Réinitialiser les cases
          </button>
        )}
      </div>
      <RepairChecklist
        repairs={repairs}
        includedIds={includedIds}
        onToggle={onToggleRepair}
      />
      <ul className="space-y-2 pt-1">
        {buildDetailLines(analysis, feesIncluded).map((line, i) => (
          <li
            key={`${line.text.slice(0, 40)}-${i}`}
            className="text-xs text-slate-400 flex gap-2"
          >
            <span
              className={line.warn ? "text-amber-400 shrink-0" : "text-slate-600 shrink-0"}
            >
              •
            </span>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
