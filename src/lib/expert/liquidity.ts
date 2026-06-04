import { getBrandResale, normalizeBrand } from "./models-database";
import type { VehicleData } from "@/types/vehicle";

function detectSegment(model: string, title: string): string {
  const t = `${model} ${title}`.toLowerCase();
  if (/3008|5008|kuga|tiguan|captur|duster|tucson|qashqai|aircross|cactus|suv/.test(t)) {
    return "suv";
  }
  if (/yaris|208|clio|polo|fiesta|corsa|108|aygo|fabia|citadine/.test(t)) {
    return "citadine";
  }
  return "compacte";
}

/** Indice liquidité + délai revente estimés (heuristique marché FR, pas données Alcopa live). */
export function estimateLiquidity(
  vehicle: VehicleData,
  scores: {
    revente: number;
    fiabilite: number;
    exportPotential: number;
    margePotentielle: number;
    estimationRevente: number;
  }
): {
  liquiditeScore: number;
  joursReventeEstimes: number;
  volumeMarche: "Faible" | "Moyen" | "Élevé";
  prixMarcheEstime: number;
} {
  const brand = normalizeBrand(vehicle.brand);
  const segment = detectSegment(vehicle.model, vehicle.title);
  let score =
    scores.revente * 0.55 + scores.fiabilite * 0.2 + scores.exportPotential * 0.1;

  const fastBrands = ["toyota", "peugeot", "renault", "dacia", "citroen", "volkswagen", "skoda"];
  if (fastBrands.includes(brand)) score += 1.1;
  if (["audi", "bmw", "mercedes"].includes(brand)) score += 0.3;

  if (segment === "suv") score += 0.9;
  if (segment === "citadine") score += 0.6;
  if (segment === "utilitaire") score -= 0.4;

  const km = vehicle.mileage ?? 150000;
  if (km > 200000) score -= 1.2;
  else if (km > 160000) score -= 0.5;

  const age = vehicle.year ? new Date().getFullYear() - vehicle.year : 10;
  if (age > 14) score -= 0.8;

  if (scores.margePotentielle > 2000) score += 0.4;

  const liquiditeScore = Math.round(Math.max(1, Math.min(10, score)) * 10) / 10;
  const joursReventeEstimes = Math.max(
    7,
    Math.round(52 - liquiditeScore * 4.2)
  );

  const volumeMarche: "Faible" | "Moyen" | "Élevé" =
    liquiditeScore >= 7.5 ? "Élevé" : liquiditeScore >= 5.5 ? "Moyen" : "Faible";

  const brandResale = getBrandResale(vehicle.brand);
  const prixMarcheEstime = Math.round(
    (scores.estimationRevente * (0.92 + brandResale * 0.02)) / 50
  ) * 50;

  return {
    liquiditeScore,
    joursReventeEstimes,
    volumeMarche,
    prixMarcheEstime,
  };
}
