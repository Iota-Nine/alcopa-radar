"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRankingAutoRefresh } from "@/hooks/useRankingAutoRefresh";

interface Props {
  label?: string;
}

export function RankingRefreshBanner({ label = "Classement & bonnes affaires" }: Props) {
  const { status, nextLabel, runRefresh, isRunning } = useRankingAutoRefresh(true);

  const lastLabel =
    status.lastAt != null
      ? `Dernière MAJ ${new Date(status.lastAt).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "Première MAJ automatique sous peu";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 border border-slate-800 rounded-lg px-3 py-2 bg-slate-900/60">
      {isRunning ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5 text-slate-600 shrink-0" />
      )}
      <span className="text-slate-400">
        {label} — MAJ auto toutes les 30 min (prix, CT, marge, CG)
      </span>
      <span className="text-slate-600">·</span>
      <span>{lastLabel}</span>
      <span className="text-slate-600">·</span>
      <span>{isRunning ? status.message : nextLabel}</span>
      <button
        type="button"
        disabled={isRunning}
        onClick={() => void runRefresh()}
        className="ml-auto text-sky-400 hover:text-sky-300 disabled:opacity-40"
      >
        Mettre à jour maintenant
      </button>
    </div>
  );
}
