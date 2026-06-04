"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { DealCard } from "@/components/DealCard";
import { MotorFuelFilterBar } from "@/components/MotorFuelFilter";
import { RankingRefreshBanner } from "@/components/RankingRefreshBanner";
import {
  countByMotorFuel,
  filterByMotorFuel,
  type MotorFuelFilter,
} from "@/lib/filters/motor-fuel";
import { filterForParticulier } from "@/lib/filters";
import { useAlertConfig, useScanHistory } from "@/lib/storage/client";

export default function ClassementPage() {
  const { history, clearHistory } = useScanHistory();
  const { config } = useAlertConfig();
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [motorFuel, setMotorFuel] = useState<MotorFuelFilter>("all");

  const ranked = useMemo(() => {
    const list = filterForParticulier([...history], config.particulierOnly !== false);
    return list.sort((a, b) => b.analysis.scoreGlobal - a.analysis.scoreGlobal);
  }, [history, config.particulierOnly]);

  const fuelCounts = useMemo(() => countByMotorFuel(ranked), [ranked]);

  const top10 = useMemo(
    () => filterByMotorFuel(ranked, motorFuel).slice(0, 10),
    [ranked, motorFuel]
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-7 h-7 text-yellow-400" />
            <h1 className="text-2xl font-bold text-white">Top 10</h1>
          </div>
          <p className="text-slate-400 text-sm max-w-xl">
            Classement par score. Cliquez <strong className="text-slate-300">Détails</strong>{" "}
            pour le résumé CT, les réparations (cases à cocher) et la marge recalculée — comme sur
            le radar.{" "}
            <Link href="/catalogue" className="text-violet-400 hover:underline">
              Catalogue
            </Link>{" "}
            pour tout l&apos;historique.
          </p>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            className="text-xs text-slate-500 hover:text-red-400 border border-slate-700 px-3 py-1.5 rounded-lg shrink-0"
          >
            Effacer l&apos;historique
          </button>
        )}
      </div>

      <RankingRefreshBanner label="Top 10" />

      {history.length > 0 && (
        <div className="mb-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <MotorFuelFilterBar
            value={motorFuel}
            onChange={setMotorFuel}
            counts={fuelCounts}
            compact
          />
        </div>
      )}

      {top10.length > 0 && (
        <button
          type="button"
          onClick={() =>
            setExpandedUrl((u) => (u === "__all__" ? null : "__all__"))
          }
          className="text-xs text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg mb-4"
        >
          {expandedUrl === "__all__" ? "Replier tout" : "Détails pour les 10"}
        </button>
      )}

      {top10.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <p className="text-slate-400 mb-4">
            {history.length === 0
              ? "Aucun véhicule scanné pour l'instant."
              : motorFuel !== "all"
                ? `Aucun véhicule en ${motorFuel === "diesel" ? "gazole" : "essence"} dans l'historique.`
                : "Aucun véhicule scanné pour l'instant."}
          </p>
          <Link href="/" className="text-blue-400 hover:underline">
            Ouvrir le radar →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {top10.map((item, i) => (
            <DealCard
              key={item.vehicle.url}
              rank={i + 1}
              item={item}
              expanded={
                expandedUrl === "__all__" || expandedUrl === item.vehicle.url
              }
              onToggle={() =>
                setExpandedUrl((u) =>
                  u === item.vehicle.url ? null : item.vehicle.url
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
