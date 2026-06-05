import type { ScoredVehicle } from "@/types/vehicle";

export type VehicleCategoryFilter = "voiture" | "moto" | "both";

export type VehicleCategory = "voiture" | "moto" | "utilitaire" | "autre";

export function vehicleCategoryFromUrl(url: string): VehicleCategory {
  if (/\/voiture-occasion\//i.test(url)) return "voiture";
  if (/\/moto-occasion\//i.test(url)) return "moto";
  if (/\/(?:utilitaire|materiel)-occasion\//i.test(url)) return "utilitaire";
  return "autre";
}

export function isUtilitaireUrl(url: string): boolean {
  return vehicleCategoryFromUrl(url) === "utilitaire";
}

export function vehicleCategoryLabel(category: VehicleCategoryFilter): string {
  switch (category) {
    case "voiture":
      return "Voitures";
    case "moto":
      return "Motos";
    case "both":
      return "Voitures + motos";
  }
}

export function matchesVehicleCategory(
  url: string,
  filter: VehicleCategoryFilter = "voiture"
): boolean {
  const cat = vehicleCategoryFromUrl(url);
  if (filter === "both") return cat === "voiture" || cat === "moto";
  return cat === filter;
}

export function filterByVehicleCategory(
  items: ScoredVehicle[],
  filter: VehicleCategoryFilter = "voiture"
): ScoredVehicle[] {
  if (filter === "both") {
    return items.filter((item) => {
      const cat = vehicleCategoryFromUrl(item.vehicle.url);
      return cat === "voiture" || cat === "moto";
    });
  }
  return items.filter(
    (item) => vehicleCategoryFromUrl(item.vehicle.url) === filter
  );
}

export function countByVehicleCategory(items: ScoredVehicle[]): {
  voiture: number;
  moto: number;
  both: number;
} {
  let voiture = 0;
  let moto = 0;
  for (const item of items) {
    const cat = vehicleCategoryFromUrl(item.vehicle.url);
    if (cat === "voiture") voiture++;
    else if (cat === "moto") moto++;
  }
  return { voiture, moto, both: voiture + moto };
}
