import type { AlertConfig, ScoredVehicle } from "@/types/vehicle";
import {
  countParticulierEligible,
  filterForParticulier,
} from "@/lib/filters/particulier";

export { filterForParticulier, countParticulierEligible } from "@/lib/filters/particulier";
export type { ParticulierClassification } from "@/lib/filters/particulier";
export {
  classifyParticulierVehicle,
  isParticulierVehicle,
  isProVehicle,
  isNonDrivingVehicle,
} from "@/lib/filters/particulier";

/** Prix affiché Alcopa (mise à prix) ou estimation max si absent */
export function getListingPrice(item: ScoredVehicle): number | undefined {
  return item.vehicle.price ?? item.analysis.prixMaxConseille;
}

export function matchesPriceRange(
  item: ScoredVehicle,
  min: number,
  max: number
): boolean {
  const price = getListingPrice(item);
  if (price === undefined) return false;
  if (min > 0 && price < min) return false;
  if (max > 0 && price > max) return false;
  return true;
}

export function applyDisplayFilters(
  results: ScoredVehicle[],
  config: Pick<
    AlertConfig,
    "priceFilterEnabled" | "budgetMin" | "budgetMax" | "particulierOnly"
  >
): ScoredVehicle[] {
  let list = filterForParticulier(results, config.particulierOnly !== false);
  list = filterByBudget(list, config);
  return list;
}

export function filterByBudget(
  results: ScoredVehicle[],
  config: Pick<AlertConfig, "priceFilterEnabled" | "budgetMin" | "budgetMax">
): ScoredVehicle[] {
  if (!config.priceFilterEnabled) return results;
  return results.filter((item) =>
    matchesPriceRange(item, config.budgetMin, config.budgetMax)
  );
}
