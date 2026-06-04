"use client";

import { formatMaxBid } from "@/lib/format";
import { feesModeBadgeClass, feesModeLabel, formatAlcopaFeesDetail } from "@/lib/alcopa/alcopa-fees";
import { CarteGriseModeToggle } from "@/components/CarteGriseModeToggle";
import { FeesModeToggle } from "@/components/FeesModeToggle";
import { vehicleFuelDisplayLabel } from "@/lib/filters/motor-fuel";
import { resolveEstimatedRevente } from "@/lib/expert/repair-margin";
import { useRepairMargin } from "@/hooks/useRepairMargin";
import { LbcPriceField } from "@/components/LbcPriceField";
import { MarginSummary } from "@/components/MarginSummary";
import { MarketInsights } from "@/components/MarketInsights";
import { VehicleDetailPanel } from "@/components/VehicleDetailPanel";
import type { ScoredVehicle, Verdict } from "@/types/vehicle";
import { AlertTriangle, CheckCircle, Eye } from "lucide-react";

const VERDICT_STYLE: Record<
  Verdict,
  { bg: string; border: string; icon: typeof CheckCircle; label: string }
> = {
  ACHETER: {
    bg: "bg-emerald-950/50",
    border: "border-emerald-600",
    icon: CheckCircle,
    label: "ACHETER",
  },
  SURVEILLER: {
    bg: "bg-amber-950/50",
    border: "border-amber-500",
    icon: Eye,
    label: "SURVEILLER",
  },
  ÉVITER: {
    bg: "bg-red-950/50",
    border: "border-red-600",
    icon: AlertTriangle,
    label: "ÉVITER",
  },
};

const RISK_COLOR = {
  Faible: "text-emerald-400",
  Moyen: "text-amber-400",
  Elevé: "text-red-400",
};

interface Props {
  item: ScoredVehicle;
}

export function AnalysisResult({ item }: Props) {
  const { vehicle, analysis } = item;
  const style = VERDICT_STYLE[analysis.verdict];
  const Icon = style.icon;

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
    carteGriseEstimate,
    carteGriseInMargin,
    setCarteGriseInMargin,
  } = useRepairMargin(vehicle, analysis);

  const fuelLabel = vehicleFuelDisplayLabel(vehicle);

  const lbcEstime = resolveEstimatedRevente(analysis);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">{vehicle.title}</h2>
          <span className="flex flex-wrap gap-1 mt-1">
            <span
              className={`text-[10px] px-2 py-0.5 rounded border ${feesModeBadgeClass(feesIncluded)}`}
            >
              {feesModeLabel(feesIncluded)}
            </span>
            {fuelLabel !== "—" && (
              <span className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-400">
                {fuelLabel}
              </span>
            )}
          </span>
          {vehicle.price !== undefined && vehicle.price > 0 && (
            <p className="text-slate-400 mt-1">
              Enchère actuelle :{" "}
              <span
                className={
                  enchereAuDessusDuMax ? "text-red-400 font-semibold" : "text-white font-semibold"
                }
              >
                {vehicle.price.toLocaleString("fr-FR")} €
              </span>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-blue-400">{analysis.scoreGlobal}/10</p>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Score global</p>
        </div>
      </div>

      {enchereAuDessusDuMax && (
        <div className="text-xs text-amber-400/95 bg-amber-950/40 border border-amber-900/50 rounded-lg px-3 py-2 space-y-1">
          {vehicle.price &&
            adjustedEst.prixMaxConseille > 0 &&
            vehicle.price > adjustedEst.prixMaxConseille && (
              <p>
                Enchère au-dessus du <strong>plafond IA</strong> (
                {formatMaxBid(adjustedEst.prixMaxConseille)}).
              </p>
            )}
          {hasLbcPrice &&
            adjustedReal &&
            vehicle.price &&
            vehicle.price > adjustedReal.prixMaxConseille && (
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

      <div className={`rounded-xl border-2 p-4 ${style.bg} ${style.border}`}>
        <div className="flex items-center gap-2">
          <Icon className="w-6 h-6" />
          <span className="text-lg font-bold">Verdict : {style.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Risque", value: analysis.risk, color: RISK_COLOR[analysis.risk] },
          { label: "Fiabilité", value: `${analysis.fiabilite}/10` },
          { label: "Revente", value: `${analysis.revente}/10` },
          { label: "Export", value: `${analysis.exportPotential}/10` },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900 rounded-lg p-3 border border-slate-800">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`font-bold text-lg ${color ?? "text-white"}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 space-y-4">
        <FeesModeToggle
          value={feesIncluded}
          onChange={setFeesIncluded}
          detected={detectedFees}
        />
        <CarteGriseModeToggle
          value={carteGriseInMargin}
          onChange={setCarteGriseInMargin}
          estimatedEuro={carteGrise}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
          <LbcPriceField
            vehicle={vehicle}
            value={lbcPrice}
            onChange={setLbcPrice}
            onCommit={commitLbcPrice}
          />
          <p className="text-[10px] text-slate-600 mt-3">
            Cote IA (en haut) :{" "}
            {lbcEstime > 0 ? `${lbcEstime.toLocaleString("fr-FR")} €` : "—"} · Plafond IA{" "}
            {formatMaxBid(adjustedEst.prixMaxConseille)}
          </p>
        </div>
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
          <MarginSummary
            estimated={adjustedEst}
            real={adjustedReal}
            enchereActuelle={vehicle.price}
          />
          {marginCustomized && (
            <p className="text-[10px] text-violet-400 mt-2">selon vos options</p>
          )}
          <p className="text-xs text-slate-600 mt-2">
            CG{" "}
            {carteGriseInMargin
              ? `${carteGrise.toLocaleString("fr-FR")} € comptée`
              : `0 € (hors marge, estim. ${carteGrise.toLocaleString("fr-FR")} €)`}{" "}
            · {carteGriseEstimate.detail} ·{" "}
            {formatAlcopaFeesDetail(feesIncluded, fraisAlcopa)} · répar.{" "}
            {adjustedEst.repairBudget.toLocaleString("fr-FR")} €
          </p>
          {enchereSousMax &&
            (hasLbcPrice && adjustedReal
              ? adjustedReal.margePotentielle
              : adjustedEst.margePotentielle) > 500 && (
              <p className="text-xs text-emerald-400/90 mt-1">Enchère sous le plafond conseillé</p>
            )}
        </div>
      </div>

      <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
        <VehicleDetailPanel
          analysis={analysis}
          feesIncluded={feesIncluded}
          repairs={repairs}
          includedIds={includedIds}
          onToggleRepair={toggleRepair}
          onResetRepairs={resetRepairs}
        />
      </div>

      <a
        href={vehicle.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm text-blue-400 hover:underline"
      >
        Ouvrir la fiche Alcopa →
      </a>
    </div>
  );
}
