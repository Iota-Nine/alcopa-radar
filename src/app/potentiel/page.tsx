"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { DealCard } from "@/components/DealCard";
import { MotorFuelFilterBar } from "@/components/MotorFuelFilter";
import { getProfitableDeals } from "@/lib/deals";
import {
  countByMotorFuel,
  filterByMotorFuel,
  type MotorFuelFilter,
} from "@/lib/filters/motor-fuel";
import { filterByBudget } from "@/lib/filters";
import { useAlertConfig, useScanHistory } from "@/lib/storage/client";

export default function PotentielPage() {
  const { history, refreshHistory } = useScanHistory();
  const { config } = useAlertConfig();
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [onlyBudget, setOnlyBudget] = useState(false);
  const [motorFuel, setMotorFuel] = useState<MotorFuelFilter>("all");

  const allProfitable = useMemo(
    () => getProfitableDeals(history, { applyBudget: false }),
    [history]
  );

  const budgetDeals = useMemo(
    () =>
      onlyBudget
        ? getProfitableDeals(history, { applyBudget: true, config })
        : allProfitable,
    [history, onlyBudget, config, allProfitable]
  );

  const fuelCounts = useMemo(() => countByMotorFuel(budgetDeals), [budgetDeals]);

  const deals = useMemo(
    () => filterByMotorFuel(budgetDeals, motorFuel),
    [budgetDeals, motorFuel]
  );

  const inBudgetCount = useMemo(
    () => filterByBudget(allProfitable, config).length,
    [allProfitable, config]
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Potentiel</h1>
          </div>
          <button
            type="button"
            onClick={() => refreshHistory()}
            className="text-xs text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg"
          >
            Actualiser
          </button>
        </div>
        <p className="text-slate-400 text-sm max-w-xl">
          Marge nette <strong className="text-emerald-400">positive</strong> (estimée ou réelle si
          prix LBC saisi) — enchère, CG, frais et réparations cochées.
        </p>
      </div>

      <div className="mb-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <MotorFuelFilterBar
          value={motorFuel}
          onChange={setMotorFuel}
          counts={fuelCounts}
          compact
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer mb-6 p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <input
          type="checkbox"
          checked={onlyBudget}
          onChange={(e) => setOnlyBudget(e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm text-slate-300">
          Limiter à mon budget (≤ {config.budgetMax.toLocaleString("fr-FR")} €)
          {!onlyBudget && allProfitable.length > 0 && (
            <span className="text-slate-500">
              {" "}
              — {inBudgetCount}/{allProfitable.length} dans le budget
            </span>
          )}
        </span>
      </label>

      {deals.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <p className="text-slate-400 mb-2">Aucun véhicule avec bénéfice estimé.</p>
          <p className="text-slate-500 text-sm mb-6">
            Lancez un scan sur le radar pour détecter les lots rentables.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500"
          >
            Ouvrir le radar
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500 mb-4">
            <span className="text-cyan-400 font-semibold">{deals.length}</span> véhicule
            {deals.length > 1 ? "s" : ""} avec bénéfice estimé
            <span className="text-slate-600"> · triés par marge décroissante</span>
          </p>
          <div className="space-y-3">
            {deals.map((item, i) => (
              <DealCard
                key={item.vehicle.url}
                rank={i + 1}
                item={item}
                expanded={expandedUrl === item.vehicle.url}
                onToggle={() =>
                  setExpandedUrl((u) => (u === item.vehicle.url ? null : item.vehicle.url))
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
