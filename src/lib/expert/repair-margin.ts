import { effectiveFeesEuro } from "@/lib/alcopa/alcopa-fees";
import { loadFeesChoice } from "@/lib/storage/fees-selection";
import { carteGriseEuroForVehicle } from "./carte-grise";
import { computeMarginBreakdown } from "./margin-calc";
import type { RepairEstimate, ScoredVehicle, VehicleAnalysis, VehicleData } from "@/types/vehicle";

function feesForVehicle(vehicle: VehicleData): number {
  const choice = typeof window !== "undefined" ? loadFeesChoice(vehicle.url) : null;
  return effectiveFeesEuro(vehicle, choice);
}

export function repairMidCost(r: RepairEstimate): number {
  return Math.round((r.costMin + r.costMax) / 2);
}

export function repairSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function normalizeRepairEstimates(
  repairs: RepairEstimate[],
  fallbackPrefix = "r"
): RepairEstimate[] {
  return repairs.map((r, i) => {
    const category =
      r.category ??
      (r.label.toLowerCase().includes("ct critique")
        ? "ct_critique"
        : r.label.toLowerCase().includes("ct majeur")
          ? "ct_majeur"
          : r.label.toLowerCase().includes("peinture") ||
              r.label.toLowerCase().includes("carrosserie")
            ? "esthetique"
            : "risque_modele");
    return {
      ...r,
      id: r.id ?? `${fallbackPrefix}-${i}-${repairSlug(r.label)}`,
      category,
      countsInMarginDefault:
        r.countsInMarginDefault ?? (category === "ct_critique" || category === "ct_majeur"),
    };
  });
}

export function defaultIncludedRepairIds(repairs: RepairEstimate[]): Set<string> {
  return new Set(
    normalizeRepairEstimates(repairs)
      .filter((r) => r.countsInMarginDefault)
      .map((r) => r.id)
  );
}

export function computeRepairBudget(
  repairs: RepairEstimate[],
  includedIds: Set<string>
): number {
  return normalizeRepairEstimates(repairs)
    .filter((r) => includedIds.has(r.id))
    .reduce((sum, r) => sum + repairMidCost(r), 0);
}

export type MarginFields = Pick<
  VehicleAnalysis,
  "margePotentielle" | "margeAuPlafond" | "margeCalculeeSur" | "prixMaxConseille"
>;

/**
 * Cote LBC unique pour l’affichage et la marge IA.
 * (prixMarcheEstime = variante liquidité — ne pas l’afficher en double.)
 */
export function resolveEstimatedRevente(analysis: VehicleAnalysis): number {
  if (analysis.estimationRevente > 0) return analysis.estimationRevente;
  if (analysis.prixMarcheEstime && analysis.prixMarcheEstime > 0) {
    return analysis.prixMarcheEstime;
  }
  return 0;
}

function marginFromRevente(
  vehicle: VehicleData,
  analysis: VehicleAnalysis,
  repairBudget: number,
  revente: number,
  fraisAlcopa: number,
  carteGrise = carteGriseEuroForVehicle(vehicle)
): MarginFields {
  const breakdown = computeMarginBreakdown(
    vehicle,
    revente,
    repairBudget,
    carteGrise,
    fraisAlcopa
  );
  return {
    prixMaxConseille: breakdown.prixMaxConseille,
    margePotentielle: breakdown.margePotentielle,
    margeAuPlafond: breakdown.margeAuPlafond,
    margeCalculeeSur: breakdown.margeCalculeeSur,
  };
}

export function recalculateMarginFields(
  vehicle: VehicleData,
  analysis: VehicleAnalysis,
  includedIds: Set<string>,
  reventeLbc: number
): MarginFields & { repairBudget: number } {
  const repairs = normalizeRepairEstimates(analysis.repairEstimates);
  const repairBudget = computeRepairBudget(repairs, includedIds);
  const frais = analysis.fraisAlcopa ?? 350;
  return { repairBudget, ...marginFromRevente(vehicle, analysis, repairBudget, reventeLbc, frais) };
}

export interface DualMarginResult {
  repairBudget: number;
  estimated: MarginFields;
  real: MarginFields | null;
}

/** Marge estimée (cote auto) + marge réelle (prix LBC saisi). */
export function recalculateDualMargins(
  vehicle: VehicleData,
  analysis: VehicleAnalysis,
  includedIds: Set<string>,
  manualLbc?: number | null,
  fraisAlcopa?: number,
  carteGrise?: number
): DualMarginResult {
  const repairs = normalizeRepairEstimates(analysis.repairEstimates);
  const repairBudget = computeRepairBudget(repairs, includedIds);
  const frais = fraisAlcopa ?? analysis.fraisAlcopa ?? 350;
  const cg = carteGrise ?? carteGriseEuroForVehicle(vehicle);
  const estRevente = resolveEstimatedRevente(analysis);
  const estimated =
    estRevente > 0
      ? marginFromRevente(vehicle, analysis, repairBudget, estRevente, frais, cg)
      : {
          prixMaxConseille: 0,
          margePotentielle: 0,
          margeAuPlafond: 0,
          margeCalculeeSur: "enchere_actuelle" as const,
        };

  const real =
    manualLbc !== undefined && manualLbc !== null && manualLbc > 0
      ? marginFromRevente(vehicle, analysis, repairBudget, manualLbc, frais, cg)
      : null;

  return { repairBudget, estimated, real };
}

/** Enrichit l'analyse avec la marge réelle sans écraser l'estimation. */
export function applyManualLbcMargin(
  item: ScoredVehicle,
  reventeLbc: number
): ScoredVehicle {
  const includedIds = defaultIncludedRepairIds(item.analysis.repairEstimates);
  const frais = feesForVehicle(item.vehicle);
  const { real } = recalculateDualMargins(
    item.vehicle,
    item.analysis,
    includedIds,
    reventeLbc,
    frais
  );
  if (!real) return item;
  return {
    ...item,
    analysis: {
      ...item.analysis,
      reventeLbcManuelle: reventeLbc,
      margeReelle: real.margePotentielle,
      prixMaxConseilleReel: real.prixMaxConseille,
    },
  };
}

/** Marge estimée effective (recalcule si l’historique a margePotentielle à 0). */
export function effectiveEstimatedMarge(item: ScoredVehicle): number {
  const includedIds = defaultIncludedRepairIds(item.analysis.repairEstimates);
  const frais = feesForVehicle(item.vehicle);
  const marge = recalculateDualMargins(
    item.vehicle,
    item.analysis,
    includedIds,
    undefined,
    frais
  ).estimated.margePotentielle;
  if (marge !== 0) return marge;
  if (item.analysis.margePotentielle > 0) return item.analysis.margePotentielle;
  return marge;
}

export function effectiveMarginForRanking(
  item: ScoredVehicle,
  lbcPrices?: Record<string, number>
): number {
  const manual = lbcPrices?.[item.vehicle.url];
  if (manual && manual > 0) {
    return applyManualLbcMargin(item, manual).analysis.margeReelle ?? effectiveEstimatedMarge(item);
  }
  return effectiveEstimatedMarge(item);
}

export function repairCategoryLabel(category: RepairEstimate["category"]): string {
  switch (category) {
    case "ct_critique":
      return "CT critique";
    case "ct_majeur":
      return "CT majeur";
    case "esthetique":
      return "Esthétique";
    case "commentaire":
      return "Commentaire Alcopa";
    default:
      return "Risque modèle";
  }
}

export function applyAdjustedMargins(
  item: ScoredVehicle,
  includedIds: Set<string>
): ScoredVehicle {
  const { repairBudget, estimated } = recalculateDualMargins(
    item.vehicle,
    item.analysis,
    includedIds
  );
  return {
    ...item,
    analysis: { ...item.analysis, ...estimated, repairBudget },
  };
}
