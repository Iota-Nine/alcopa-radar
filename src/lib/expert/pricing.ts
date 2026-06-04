import { estimateCarteGrise, FRAIS_ALCOPA_DEFAULT } from "./carte-grise";
import { getBrandResale, getEngineProfile, normalizeBrand } from "./models-database";
import type { VehicleData } from "@/types/vehicle";

/** Prix médian Leboncoin pour un véhicule ~5 ans / ~80 000 km */
const SEGMENT_BASE: Record<string, number> = {
  citadine: 7500,
  compacte: 9500,
  berline: 12000,
  suv: 13000,
  utilitaire: 9000,
  break: 12500,
};

function detectSegment(model: string, title: string): string {
  const t = `${model} ${title}`.toLowerCase();
  if (/x[1-7]|q[3-8]|3008|5008|kuga|tiguan|captur|duster|tucson|sportage|qashqai|aircross|cactus/.test(t))
    return "suv";
  if (/avant|break|sw|tourer|estate|combi|sportback/.test(t)) return "break";
  if (/avensis|passat|mondeo|508|407|classe c|série 3|a4|a6|insignia|octavia|superb/.test(t))
    return "berline";
  if (/partner|berlingo|kangoo|transit|master|boxer|jumper|expert/.test(t)) return "utilitaire";
  if (/yaris|208|clio|polo|fiesta|corsa|108|aygo|fabia/.test(t)) return "citadine";
  return "compacte";
}

function yearDepreciation(year: number): number {
  const age = new Date().getFullYear() - year;
  if (age <= 3) return 1;
  if (age <= 5) return 0.88;
  if (age <= 8) return 0.75;
  if (age <= 10) return 0.62;
  if (age <= 13) return 0.55;
  if (age <= 16) return 0.44;
  return 0.36;
}

function mileageAdjustment(km: number): number {
  if (km < 50000) return 1.05;
  if (km < 80000) return 1;
  if (km < 120000) return 0.92;
  if (km < 160000) return 0.84;
  if (km < 200000) return 0.76;
  if (km < 250000) return 0.72;
  return 0.58;
}

function fuelAdjustment(fuel?: string, trim = ""): number {
  const text = `${fuel ?? ""} ${trim}`.toLowerCase();
  if (text.includes("ee") || text.includes("hybride") || text.includes("electrique") || text.includes("ev"))
    return 1.04;
  if (text.includes("essence") || text === "es" || text.includes("gpl")) return 1;
  if (
    text.includes("diesel") ||
    text === "go" ||
    text.includes("dci") ||
    text.includes("tdi") ||
    text.includes("hdi") ||
    text.includes("cdi")
  )
    return 0.94;
  return 1;
}

/** Plancher réaliste observé sur Leboncoin (véhicule roulant, état moyen) */
function marketFloor(brand: string, segment: string, year: number, km: number): number {
  const b = normalizeBrand(brand);
  const age = new Date().getFullYear() - year;
  const premium = ["audi", "bmw", "mercedes", "lexus", "volvo"].includes(b);
  const solid = ["toyota", "honda", "mazda", "volkswagen", "skoda"].includes(b);

  let floor = premium ? 4200 : solid ? 3000 : 2000;

  if (segment === "suv") floor += 800;
  if (segment === "berline" || segment === "break") floor += 400;

  if (age > 15) floor *= 0.85;
  if (km > 220000) floor *= 0.9;

  return Math.round(floor / 100) * 100;
}

export function estimateMarketValue(vehicle: VehicleData): number {
  const year = vehicle.year ?? new Date().getFullYear() - 8;
  const km = vehicle.mileage ?? 150000;
  const segment = detectSegment(vehicle.model, vehicle.title);
  const base = SEGMENT_BASE[segment] ?? 9500;
  const brandResale = getBrandResale(vehicle.brand);
  const profile = getEngineProfile(vehicle.brand, vehicle.model, vehicle.trim);

  const brandMultiplier = 0.85 + brandResale * 0.03;
  const profileMultiplier = 0.9 + profile.resale * 0.02;

  let value =
    base *
    yearDepreciation(year) *
    mileageAdjustment(km) *
    fuelAdjustment(vehicle.fuel, vehicle.trim ?? vehicle.title) *
    brandMultiplier *
    profileMultiplier;

  if (vehicle.hasWarranty) value *= 1.04;
  if (vehicle.batteryHealth && vehicle.batteryHealth >= 85) value *= 1.03;
  if (vehicle.batteryHealth && vehicle.batteryHealth < 70) value *= 0.88;

  const floor = marketFloor(vehicle.brand, segment, year, km);
  return Math.round(Math.max(floor, value) / 50) * 50;
}

export function estimateMaxBid(
  marketValue: number,
  repairBudget: number,
  targetMargin = 1200,
  carteGrise = 250,
  fees = FRAIS_ALCOPA_DEFAULT
): number {
  const max = marketValue - repairBudget - targetMargin - fees - carteGrise;
  return Math.max(0, Math.round(max / 50) * 50);
}

/** Max enchère avec carte grise auto selon le véhicule */
export function estimateMaxBidForVehicle(
  vehicle: VehicleData,
  marketValue: number,
  repairBudget: number,
  targetMargin = 1200
): number {
  const cg = estimateCarteGrise(vehicle);
  return estimateMaxBid(marketValue, repairBudget, targetMargin, cg.total);
}

/** Budget réparation réaliste pour le calcul de marge (pas la somme de tous les risques) */
export function estimateRealisticRepairBudget(
  certainMin: number,
  certainMax: number,
  riskMin: number,
  riskMax: number
): number {
  const certainMid = (certainMin + certainMax) / 2;
  const riskMid = (riskMin + riskMax) / 2;
  return Math.round(certainMid + riskMid * 0.35);
}
