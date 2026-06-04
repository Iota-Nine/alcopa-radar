import type { VehicleData } from "@/types/vehicle";

/** Lien recherche Leboncoin — le prix de revente est saisi manuellement par l’utilisateur. */
export function leboncoinSearchUrl(vehicle: VehicleData): string {
  const parts = [vehicle.brand, vehicle.model, vehicle.year?.toString()]
    .filter(Boolean)
    .join(" ")
    .trim();
  const q = encodeURIComponent(parts || vehicle.title);
  return `https://www.leboncoin.fr/recherche?category=2&text=${q}`;
}
