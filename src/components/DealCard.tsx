"use client";

import { memo } from "react";
import { formatMaxBid } from "@/lib/format";
import { feesModeBadgeClass, feesModeLabel } from "@/lib/alcopa/alcopa-fees";
import { CarteGriseMarginBadge, CarteGriseModeToggle } from "@/components/CarteGriseModeToggle";
import { FeesModeToggle } from "@/components/FeesModeToggle";
import { vehicleFuelDisplayLabel } from "@/lib/filters/motor-fuel";
import { resolveEstimatedRevente } from "@/lib/expert/repair-margin";
import { useRepairMargin } from "@/hooks/useRepairMargin";
import { LbcPriceField } from "@/components/LbcPriceField";
import { MarginSummary } from "@/components/MarginSummary";
import { MarketInsights } from "@/components/MarketInsights";
import { VehicleDetailPanel } from "@/components/VehicleDetailPanel";
import type { ScoredVehicle } from "@/types/vehicle";

const VERDICT_STYLE = {
  ACHETER: "bg-emerald-950/60 border-emerald-600 text-emerald-300",
  SURVEILLER: "bg-amber-950/60 border-amber-600 text-amber-300",
  ÉVITER: "bg-red-950/60 border-red-700 text-red-300",
};

interface Props {
  rank: number;
  item: ScoredVehicle;
  expanded?: boolean;
  onToggle?: () => void;
}

export const DealCard = memo(function DealCard({ rank, item, expanded, onToggle }: Props) {
  const { vehicle, analysis } = item;
  const {
    repairs,
    includedIds,
    adjustedEst,
    adjustedReal,
    enchereAuDessusDuMax,
    enchereSousMax,
    marginCustomized,
    toggleRepair,
    resetRepairs,
    lbcPrice,
    setLbcPrice,
    commitLbcPrice,
    hasLbcPrice,
    feesIncluded,
    setFeesIncluded,
    detectedFees,
    fraisAlcopa,
    carteGrise,
    carteGriseInMargin,
    setCarteGriseInMargin,
  } = useRepairMargin(vehicle, analysis);

  const fuelLabel = vehicleFuelDisplayLabel(vehicle);

  const lbcEstime = resolveEstimatedRevente(analysis);

  const enchere = vehicle.price ?? 0;
  const auDessusPlafondIa =
    enchere > 0 && adjustedEst.prixMaxConseille > 0 && enchere > adjustedEst.prixMaxConseille;
  const auDessusPlafondUser =
    hasLbcPrice &&
    adjustedReal &&
    enchere > 0 &&
    adjustedReal.prixMaxConseille > 0 &&
    enchere > adjustedReal.prixMaxConseille;

  const medal =
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        rank <= 3 ? "border-blue-600/50 bg-slate-900" : "border-slate-800 bg-slate-900/60"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="text-2xl font-bold w-10 shrink-0">{medal}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white truncate">{vehicle.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {vehicle.mileage?.toLocaleString("fr-FR") ?? "?"} km
            {vehicle.year ? ` · ${vehicle.year}` : ""}
            {fuelLabel !== "—" ? ` · ${fuelLabel}` : ""}
            {vehicle.location ? ` · ${vehicle.location}` : ""}
            {vehicle.price !== undefined && vehicle.price > 0 && (
              <>
                {" "}
                ·{" "}
                <span className={enchereAuDessusDuMax ? "text-red-400" : "text-slate-400"}>
                  Enchère {vehicle.price.toLocaleString("fr-FR")} €
                </span>
              </>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-blue-400">{analysis.scoreGlobal}</p>
          <p className="text-xs text-slate-500">/10</p>
        </div>
      </div>

      {(auDessusPlafondIa || auDessusPlafondUser) && (
        <div className="mt-2 text-xs text-amber-400/95 bg-amber-950/40 border border-amber-900/50 rounded-lg px-3 py-2 space-y-1">
          {auDessusPlafondIa && (
            <p>
              Enchère au-dessus du <strong>plafond IA</strong> (
              {formatMaxBid(adjustedEst.prixMaxConseille)}).
            </p>
          )}
          {auDessusPlafondUser && adjustedReal && (
            <p>
              Enchère au-dessus du <strong>plafond utilisateur</strong> (
              {formatMaxBid(adjustedReal.prixMaxConseille)}).
            </p>
          )}
        </div>
      )}

      <MarketInsights
        vehicle={vehicle}
        analysis={analysis}
        plafondIa={adjustedEst.prixMaxConseille}
        plafondUtilisateur={
          hasLbcPrice && adjustedReal ? adjustedReal.prixMaxConseille : undefined
        }
        coteLbcAuto={lbcEstime}
      />

      <div className="mt-3 space-y-3 text-sm">
        <FeesModeToggle
          value={feesIncluded}
          onChange={setFeesIncluded}
          detected={detectedFees}
          compact
        />
        <CarteGriseModeToggle
          value={carteGriseInMargin}
          onChange={setCarteGriseInMargin}
          estimatedEuro={carteGrise}
          compact
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
        <div>
          <LbcPriceField
            vehicle={vehicle}
            value={lbcPrice}
            onChange={setLbcPrice}
            onCommit={commitLbcPrice}
            compact
          />
        </div>
        <div>
          <MarginSummary
            estimated={adjustedEst}
            real={adjustedReal}
            enchereActuelle={vehicle.price}
            compact
          />
          {marginCustomized && (
            <p className="text-[10px] text-violet-400 mt-1">selon vos options</p>
          )}
          {enchereSousMax &&
            (hasLbcPrice && adjustedReal
              ? adjustedReal.margePotentielle
              : adjustedEst.margePotentielle) > 500 && (
              <p className="text-[10px] text-emerald-500/90 mt-0.5">Enchère sous le plafond</p>
            )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span
          className={`text-xs px-2 py-1 rounded border font-medium ${VERDICT_STYLE[analysis.verdict]}`}
        >
          {analysis.verdict}
        </span>
        <span className="text-xs text-slate-500">Risque {analysis.risk}</span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded border ${feesModeBadgeClass(feesIncluded)}`}
        >
          {feesModeLabel(feesIncluded)}
        </span>
        <CarteGriseMarginBadge includeInMargin={carteGriseInMargin} compact />
        <a
          href={vehicle.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-blue-400 hover:underline"
        >
          Voir sur Alcopa →
        </a>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="text-xs text-slate-400 hover:text-white"
          >
            {expanded ? "Masquer" : "Détails"}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <VehicleDetailPanel
            analysis={analysis}
            feesIncluded={feesIncluded}
            repairs={repairs}
            includedIds={includedIds}
            onToggleRepair={toggleRepair}
            onResetRepairs={resetRepairs}
          />
        </div>
      )}
    </div>
  );
});
