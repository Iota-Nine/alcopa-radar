import {
  applyManualLbcMargin,
  effectiveEstimatedMarge,
  effectiveMarginForRanking,
} from "@/lib/expert/repair-margin";
import { filterByBudget, filterForParticulier } from "@/lib/filters";
import type { AlertConfig, ScoredVehicle, Verdict } from "@/types/vehicle";

export const CATALOG_URL = "https://www.alcopa-auction.fr/recherche";

/** Marge nette minimale pour une « bonne affaire » */
export const MIN_PROFIT_MARGIN = 500;

export function isGoodDeal(score: number, verdict: Verdict, marge: number): boolean {
  if (verdict === "ÉVITER") return false;
  if (marge < MIN_PROFIT_MARGIN) return false;

  if (verdict === "ACHETER") return true;

  if (verdict === "SURVEILLER") {
    if (marge >= 1200) return true;
    if (marge >= MIN_PROFIT_MARGIN && score >= 6) return true;
  }

  return false;
}

function withManualMargins(
  results: ScoredVehicle[],
  lbcPrices?: Record<string, number>
): ScoredVehicle[] {
  if (!lbcPrices || Object.keys(lbcPrices).length === 0) return results;
  return results.map((item) => {
    const p = lbcPrices[item.vehicle.url];
    return p && p > 0 ? applyManualLbcMargin(item, p) : item;
  });
}

export function rankDeals(
  results: ScoredVehicle[],
  lbcPrices?: Record<string, number>
): ScoredVehicle[] {
  const enriched = withManualMargins(results, lbcPrices);
  return [...enriched].sort((a, b) => {
    const ma = effectiveMarginForRanking(a, lbcPrices);
    const mb = effectiveMarginForRanking(b, lbcPrices);
    const marginDiff = mb - ma;
    if (Math.abs(marginDiff) > 200) return marginDiff;
    const scoreDiff = b.analysis.scoreGlobal - a.analysis.scoreGlobal;
    if (Math.abs(scoreDiff) > 0.3) return scoreDiff;
    return marginDiff;
  });
}

export interface GoodDealsOptions {
  applyBudget?: boolean;
  config?: Pick<
    AlertConfig,
    "priceFilterEnabled" | "budgetMin" | "budgetMax" | "particulierOnly"
  >;
}

type DealsFilterOptions =
  | GoodDealsOptions
  | Pick<AlertConfig, "priceFilterEnabled" | "budgetMin" | "budgetMax" | "particulierOnly">;

function isAlertConfigSlice(
  o: DealsFilterOptions
): o is Pick<
  AlertConfig,
  "priceFilterEnabled" | "budgetMin" | "budgetMax" | "particulierOnly"
> {
  return "priceFilterEnabled" in o && !("applyBudget" in o);
}

function resolveDealsFilter(options?: DealsFilterOptions): {
  applyBudget: boolean;
  config?: GoodDealsOptions["config"];
} {
  if (!options) return { applyBudget: false };

  if (isAlertConfigSlice(options)) {
    return {
      applyBudget: Boolean(options.priceFilterEnabled),
      config: options,
    };
  }

  return {
    applyBudget: options.applyBudget ?? false,
    config: options.config,
  };
}

function applyDealsFilter(
  results: ScoredVehicle[],
  options?: DealsFilterOptions
): ScoredVehicle[] {
  const { applyBudget, config } = resolveDealsFilter(options);
  let list = results;
  if (config?.particulierOnly !== false) {
    list = filterForParticulier(list);
  }
  if (applyBudget && config) return filterByBudget(list, config);
  return list;
}

/** Toutes les bonnes affaires — filtre sur marge **estimée** (le prix LBC saisi ne retire pas un lot). */
export function getGoodDeals(
  results: ScoredVehicle[],
  options?: DealsFilterOptions,
  lbcPrices?: Record<string, number>
): ScoredVehicle[] {
  const pool = applyDealsFilter(results, options);
  return rankDeals(
    pool.filter(({ analysis, vehicle }) => {
      const item = { vehicle, analysis, scannedAt: "" };
      return isGoodDeal(
        analysis.scoreGlobal,
        analysis.verdict,
        effectiveEstimatedMarge(item)
      );
    }),
    lbcPrices
  );
}

export function getTopDeals(
  results: ScoredVehicle[],
  limit = 10,
  config?: Pick<
    AlertConfig,
    "priceFilterEnabled" | "budgetMin" | "budgetMax" | "particulierOnly"
  >,
  lbcPrices?: Record<string, number>
): ScoredVehicle[] {
  return getGoodDeals(
    results,
    {
      applyBudget: config?.priceFilterEnabled ?? false,
      config,
    },
    lbcPrices
  ).slice(0, limit);
}

/** Meilleurs scores en cours de scan (tous véhicules). */
export function getLiveRanking(results: ScoredVehicle[], limit = 15): ScoredVehicle[] {
  return [...results]
    .sort((a, b) => b.analysis.scoreGlobal - a.analysis.scoreGlobal)
    .slice(0, limit);
}

export function countGoodDeals(
  results: ScoredVehicle[],
  applyBudget = false,
  config?: Pick<
    AlertConfig,
    "priceFilterEnabled" | "budgetMin" | "budgetMax" | "particulierOnly"
  >,
  lbcPrices?: Record<string, number>
): number {
  return getGoodDeals(results, { applyBudget, config }, lbcPrices).length;
}

/** Véhicules avec marge estimée > 0 — onglet Potentiel (prix LBC manuel = affichage seulement). */
export function getProfitableDeals(
  results: ScoredVehicle[],
  options?: DealsFilterOptions,
  lbcPrices?: Record<string, number>
): ScoredVehicle[] {
  const pool = applyDealsFilter(results, options);
  return rankDeals(
    pool.filter(({ vehicle, analysis }) => {
      const marge = effectiveEstimatedMarge({ vehicle, analysis, scannedAt: "" });
      return Number.isFinite(marge) && marge > 0;
    }),
    lbcPrices
  );
}

export function countProfitableDeals(
  results: ScoredVehicle[],
  lbcPrices?: Record<string, number>
): number {
  return getProfitableDeals(results, undefined, lbcPrices).length;
}
