import type { ScoredVehicle, VehicleData } from "@/types/vehicle";

export interface ParticulierClassification {
  isPro: boolean;
  isNonDriving: boolean;
  reasons: string[];
}

const PRO_URL =
  /\/(?:utilitaire-occasion|materiel-occasion)\//i;

const PRO_TYPE =
  /\b(utilitaire|utilitaires|vul|fourgon|fourgonnette|camion|camionnette|engin|materiel|d[eé]riv[eé]\s*vp|n1|n2|pl\b|semi-remorque|remorque)\b/i;

const PRO_BODY = /\b(vu|ctte|cam|pickup|pick-up|benne|plateau|fourgon)\b/i;

const PRO_TEXT =
  /\b(taxi|vtc|uber|bolt|chauffeur|chauffeurs|location\s+(?:longue|professionnelle)|flotte\s+pro|véhicule\s+de\s+(?:société|entreprise)|vehicule\s+de\s+(?:societe|entreprise)|société\s+de\s+(?:location|transport)|ex\s*taxi|ancien\s*taxi|dépanneuse|depanneuse|ambulance|auto[- ]?école|auto[- ]?ecole)\b/i;

const NON_ROULANT =
  /\b(non[\s-]?roulant|ne\s+(?:roule|roule\s+pas|démarre|demarre|tourne|avance|part\s+pas)|en\s+panne|moteur\s+hs|bo[iî]te\s+hs|transmission\s+hs|épave|epave|réforme|reforme|accident\s+(?:lourd|important|structurel)|choc\s+(?:important|structurel|avant|arri[eè]re)|immobilis|interdiction\s+de\s+circuler|ne\s+pouvant\s+pas\s+circuler|véhicule\s+(?:de\s+)?d[eé]pannage|pour\s+pi[eè]ces|pour\s+piece|sans\s+moteur|sans\s+bo[iî]te)\b/i;

function vehicleTextBlob(vehicle: VehicleData): string {
  const typeFromComments = vehicle.comments?.match(/Type:\s*([^|]+)/i)?.[1]?.trim();
  return [
    vehicle.url,
    vehicle.title,
    vehicle.trim,
    vehicle.brand,
    vehicle.model,
    vehicle.vehicleType ?? typeFromComments,
    vehicle.bodyType,
    vehicle.comments,
    vehicle.ctNotes,
    vehicle.fuel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isProVehicleUrl(url: string): boolean {
  return PRO_URL.test(url);
}

/** Véhicule pro / utilitaire — hors cible particulier. */
export function isProVehicle(vehicle: VehicleData): boolean {
  if (isProVehicleUrl(vehicle.url)) return true;

  const blob = vehicleTextBlob(vehicle);
  const type = (vehicle.vehicleType ?? "").toLowerCase();
  const body = (vehicle.bodyType ?? "").toLowerCase();

  if (type && !/\btourisme\b/i.test(type) && PRO_TYPE.test(type)) return true;
  if (type.includes("utilitaire")) return true;
  if (body && PRO_BODY.test(body)) return true;
  if (PRO_TYPE.test(blob) || PRO_TEXT.test(blob)) return true;

  return false;
}

/** Véhicule non roulant ou trop endommagé pour un particulier. */
export function isNonDrivingVehicle(vehicle: VehicleData): boolean {
  return NON_ROULANT.test(vehicleTextBlob(vehicle));
}

export function classifyParticulierVehicle(vehicle: VehicleData): ParticulierClassification {
  const reasons: string[] = [];
  const isPro = isProVehicle(vehicle);
  const isNonDriving = isNonDrivingVehicle(vehicle);

  if (isProVehicleUrl(vehicle.url)) reasons.push("fiche utilitaire / matériel");
  else if (vehicle.vehicleType?.toLowerCase().includes("utilitaire")) {
    reasons.push(`type ${vehicle.vehicleType}`);
  } else if (vehicle.bodyType && PRO_BODY.test(vehicle.bodyType)) {
    reasons.push(`carrosserie ${vehicle.bodyType}`);
  } else if (isPro && PRO_TEXT.test(vehicleTextBlob(vehicle))) {
    reasons.push("usage pro (taxi, VTC, location…)");
  } else if (isPro) {
    reasons.push("véhicule utilitaire / pro");
  }

  if (isNonDriving) {
    const blob = vehicleTextBlob(vehicle);
    if (/\bnon[\s-]?roulant\b/.test(blob)) reasons.push("non roulant");
    else if (/\bne\s+(?:roule|démarre|demarre)\b/.test(blob)) reasons.push("ne roule pas / ne démarre pas");
    else if (/\ben\s+panne\b/.test(blob)) reasons.push("en panne");
    else if (/\bimmobilis|circulation\s+interdite\b/.test(blob)) reasons.push("immobilisation CT");
    else reasons.push("état non roulant signalé");
  }

  return { isPro, isNonDriving, reasons: [...new Set(reasons)] };
}

/** Lot adapté à un achat particulier (tourisme roulant). */
export function isParticulierVehicle(vehicle: VehicleData): boolean {
  const c = classifyParticulierVehicle(vehicle);
  return !c.isPro && !c.isNonDriving;
}

export function filterForParticulier(
  items: ScoredVehicle[],
  enabled = true
): ScoredVehicle[] {
  if (!enabled) return items;
  return items.filter((item) => isParticulierVehicle(item.vehicle));
}

export function countParticulierEligible(items: ScoredVehicle[]): number {
  return items.filter((item) => isParticulierVehicle(item.vehicle)).length;
}

export function particulierFilterLabel(enabled: boolean): string {
  return enabled ? "Particulier (tourisme roulant)" : "Tous véhicules";
}
