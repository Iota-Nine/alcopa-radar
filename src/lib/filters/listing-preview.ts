import type { AlertConfig, ScoredVehicle, VehicleData } from "@/types/vehicle";
import { isProVehicle } from "@/lib/filters/particulier";
import { isUtilitaireUrl, matchesVehicleCategory } from "@/lib/filters/vehicle-category";

export type ListingSkipReason = "pro" | "budget";

export function shouldAnalyzeListingPreview(
  preview: Partial<VehicleData>,
  config: Pick<
    AlertConfig,
    | "priceFilterEnabled"
    | "budgetMin"
    | "budgetMax"
    | "particulierOnly"
    | "vehicleCategory"
  >
): { ok: boolean; reason?: ListingSkipReason } {
  const url = preview.url ?? "";
  if (!url) return { ok: false, reason: "pro" };

  if (isUtilitaireUrl(url)) return { ok: false, reason: "pro" };

  const category = config.vehicleCategory ?? "voiture";
  if (!matchesVehicleCategory(url, category)) {
    return { ok: false, reason: "pro" };
  }

  if (config.particulierOnly !== false) {
    const stub: VehicleData = {
      url,
      title: preview.title ?? preview.model ?? "",
      brand: preview.brand ?? "",
      model: preview.model ?? "",
      trim: preview.trim,
      fuel: preview.fuel,
    };
    if (isProVehicle(stub)) return { ok: false, reason: "pro" };
  }

  if (config.priceFilterEnabled && preview.price !== undefined && preview.price > 0) {
    if (config.budgetMin > 0 && preview.price < config.budgetMin) {
      return { ok: false, reason: "budget" };
    }
    if (config.budgetMax > 0 && preview.price > config.budgetMax) {
      return { ok: false, reason: "budget" };
    }
  }

  return { ok: true };
}
