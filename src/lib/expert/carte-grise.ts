import type { VehicleData } from "@/types/vehicle";

/** Barème Paris / Île-de-France — taxe régionale €/CV (changement de titulaire, VP). */
export const PARIS_CV_RATE = 46.15;
export const PARIS_REGION_LABEL = "Paris (Île-de-France)";

export const TAXE_GESTION = 11;
export const REDEVANCE_ACHEMINEMENT = 2.76;

export interface CarteGriseEstimate {
  chevauxFiscaux: number;
  /** CV × prix CV région (0 si exonération ≥10 ans). */
  taxeRegionale: number;
  taxeGestion: number;
  redevance: number;
  malusEcologique: number;
  total: number;
  regionLabel: string;
  prixCvRegion: number;
  exemptRegionale: boolean;
  detail: string;
}

function isElectric(fuel?: string, trim = ""): boolean {
  const t = `${fuel ?? ""} ${trim}`.toLowerCase();
  return (
    t.includes("electr") ||
    t.includes("électr") ||
    t === "ee" ||
    t.includes("ev") ||
    t.includes("bev")
  );
}

function isHybridRechargeable(fuel?: string, trim = ""): boolean {
  const t = `${fuel ?? ""} ${trim}`.toLowerCase();
  return t.includes("hybride rechargeable") || t.includes("phev") || /plug/i.test(t);
}

/** Estime la puissance kW à partir de la cylindrée si non fournie */
export function estimatePowerKw(cylindreeCc?: number, fuel?: string): number | undefined {
  if (!cylindreeCc || cylindreeCc < 600) return undefined;
  const t = (fuel ?? "").toLowerCase();
  const factor = t.includes("diesel") || t === "go" ? 0.045 : 0.05;
  return Math.round(cylindreeCc * factor);
}

/** CO₂ estimé (g/km) si absent — ordre de grandeur pour le barème fiscal */
function estimateCo2Gkm(powerKw: number, fuel?: string): number {
  const t = (fuel ?? "").toLowerCase();
  if (isElectric(fuel)) return 0;
  if (t.includes("diesel") || t === "go") return Math.round(110 + powerKw * 2.2);
  if (isHybridRechargeable(fuel)) return Math.round(45 + powerKw * 0.8);
  return Math.round(130 + powerKw * 2.5);
}

/**
 * Chevaux fiscaux — formule officielle :
 * CV = (CO₂/45) + (Puissance_kW/40)^1,6
 */
export function estimateChevauxFiscaux(input: {
  co2Gkm?: number;
  powerKw?: number;
  cylindreeCc?: number;
  fuel?: string;
  trim?: string;
}): number {
  if (isElectric(input.fuel, input.trim ?? "")) {
    return Math.max(1, Math.round(((input.powerKw ?? 100) / 40) ** 1.6));
  }

  let powerKw = input.powerKw ?? estimatePowerKw(input.cylindreeCc, input.fuel);
  if (!powerKw && input.cylindreeCc) {
    powerKw = Math.max(40, Math.round(input.cylindreeCc / 20));
  }
  if (!powerKw) return 6;

  const co2 = input.co2Gkm ?? estimateCo2Gkm(powerKw, input.fuel);
  const cv = co2 / 45 + (powerKw / 40) ** 1.6;
  return Math.max(1, Math.round(cv));
}

const EXONERATION_AGE_YEARS = 10;

/** Année pour affichage / CV — priorité à la date de mise en circulation Alcopa. */
export function parseYearForCarteGrise(
  firstRegistration?: string,
  fallback?: number
): number {
  const raw = firstRegistration?.trim();
  if (raw) {
    const dmy = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmy) return parseInt(dmy[3], 10);
    const my = raw.match(/(\d{2})\/(\d{4})/);
    if (my) return parseInt(my[2], 10);
    const y = raw.match(/(\d{4})/);
    if (y) return parseInt(y[1], 10);
  }
  if (fallback && fallback >= 1980 && fallback <= new Date().getFullYear() + 1) {
    return fallback;
  }
  return new Date().getFullYear() - 8;
}

/** Assure `vehicle.year` pour l’exonération ≥10 ans (historique souvent sans année persistée). */
export function vehicleForCarteGrise(vehicle: VehicleData): VehicleData {
  const year = parseYearForCarteGrise(vehicle.firstRegistration, vehicle.year);
  if (vehicle.year === year) return vehicle;
  return { ...vehicle, year };
}

/**
 * Date de 1ʳᵉ immatriculation (champ Alcopa uniquement).
 * On n’utilise pas vehicle.year seul : l’historique Top 10 l’avait souvent sans MEC → 14 € à tort.
 */
export function parseFirstRegistrationDate(vehicle: VehicleData): Date | undefined {
  const raw = vehicle.firstRegistration?.trim();
  if (!raw) return undefined;

  const dmy = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);

  const my = raw.match(/(\d{2})\/(\d{4})/);
  if (my) return new Date(+my[2], +my[1] - 1, 1);

  const yOnly = raw.match(/\b(19|20)\d{2}\b/);
  if (yOnly) return new Date(parseInt(yOnly[0], 10), 11, 31);

  return undefined;
}

/** Âge réel en années (décimal) depuis la 1ʳᵉ immatriculation. */
export function yearsSinceFirstRegistration(vehicle: VehicleData): number | undefined {
  const start = parseFirstRegistrationDate(vehicle);
  if (!start || Number.isNaN(start.getTime())) return undefined;
  const ms = Date.now() - start.getTime();
  if (ms < 0) return 0;
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Exonération taxe régionale (véhicule de plus de 10 ans).
 * Uniquement si la MEC Alcopa est connue (JJ/MM/AAAA ou MM/AAAA).
 */
export function isCarteGriseRegionaleExempt(vehicle: VehicleData): boolean {
  if (!vehicle.firstRegistration?.trim()) return false;
  const years = yearsSinceFirstRegistration(vehicle);
  if (years === undefined) return false;
  return years > EXONERATION_AGE_YEARS;
}

function roundEuro(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Carte grise = (CV fiscaux × prix CV Paris) + frais de gestion + redevance d’acheminement.
 * Barème Paris (Île-de-France) partout. ≥10 ans : part régionale à 0.
 */
export function estimateCarteGrise(vehicle: VehicleData): CarteGriseEstimate {
  const v = vehicleForCarteGrise(vehicle);

  const chevauxFiscaux = estimateChevauxFiscaux({
    co2Gkm: v.co2,
    powerKw: v.powerKw,
    cylindreeCc: v.cylindree,
    fuel: v.fuel,
    trim: v.trim,
  });

  const exemptRegionale = isCarteGriseRegionaleExempt(v);
  const ageYears = yearsSinceFirstRegistration(v);
  const taxeRegionale = exemptRegionale
    ? 0
    : roundEuro(chevauxFiscaux * PARIS_CV_RATE);

  const malusEcologique = 0;
  const total = roundEuro(
    taxeRegionale + TAXE_GESTION + REDEVANCE_ACHEMINEMENT + malusEcologique
  );

  const ageLabel =
    ageYears !== undefined ? `${Math.floor(ageYears)} ans` : "âge inconnu";

  const detail = exemptRegionale
    ? `${chevauxFiscaux} CV · ${ageLabel} · exon. régionale (MEC connue) · ${TAXE_GESTION} € + ${REDEVANCE_ACHEMINEMENT} €`
    : !v.firstRegistration?.trim() && v.year
      ? `${chevauxFiscaux} CV × ${PARIS_CV_RATE} € + ${TAXE_GESTION} € + ${REDEVANCE_ACHEMINEMENT} € (MEC absente du cache — barème plein)`
      : `${chevauxFiscaux} CV × ${PARIS_CV_RATE} € + ${TAXE_GESTION} € + ${REDEVANCE_ACHEMINEMENT} € (${PARIS_REGION_LABEL})`;

  return {
    chevauxFiscaux,
    taxeRegionale,
    taxeGestion: TAXE_GESTION,
    redevance: REDEVANCE_ACHEMINEMENT,
    malusEcologique,
    total: Math.round(total),
    regionLabel: PARIS_REGION_LABEL,
    prixCvRegion: PARIS_CV_RATE,
    exemptRegionale,
    detail,
  };
}

export const FRAIS_ALCOPA_DEFAULT = 350;

/** Montant CG utilisé pour les marges (recalcul live, pas l’historique scan). */
export function carteGriseEuroForVehicle(vehicle: VehicleData): number {
  return estimateCarteGrise(vehicle).total;
}

export function effectiveCarteGriseForMargin(
  estimatedEuro: number,
  includeInMargin: boolean
): number {
  return includeInMargin ? estimatedEuro : 0;
}

export function carteGriseMarginLabel(includeInMargin: boolean): string {
  return includeInMargin ? "CG dans marge" : "Sans CG";
}

export function carteGriseMarginBadgeClass(includeInMargin: boolean): string {
  return includeInMargin
    ? "text-sky-300 bg-sky-950/50 border-sky-800"
    : "text-violet-300 bg-violet-950/40 border-violet-800";
}

/** Ligne du détail marge. */
export function formatCarteGriseMarginLine(estimate: CarteGriseEstimate): string {
  const amount = estimate.total.toLocaleString("fr-FR");
  if (estimate.exemptRegionale) {
    return `− Carte grise ${amount} € (≥10 ans, Paris : exon. régionale)`;
  }
  return `− Carte grise ${amount} € (${estimate.chevauxFiscaux} CV × ${estimate.prixCvRegion} €, Paris)`;
}

export function computeNetMargin(input: {
  estimationRevente: number;
  purchasePrice: number;
  repairBudget: number;
  carteGrise: number;
  fraisAlcopa?: number;
}): number {
  const frais = input.fraisAlcopa ?? FRAIS_ALCOPA_DEFAULT;
  return Math.round(
    input.estimationRevente -
      input.purchasePrice -
      input.repairBudget -
      input.carteGrise -
      frais
  );
}
