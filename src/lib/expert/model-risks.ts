import {
  filterKnownIssuesForMotor,
  getEngineProfile,
  getBrandResale,
} from "./models-database";
import {
  getMotorisationKind,
  isDieselFuel,
  motorisationAdvice,
  motorisationLabel,
} from "./motorisation";
import { normalizeRepairEstimates, repairSlug } from "./repair-margin";
import type { RepairCategory, RepairEstimate, VehicleData } from "@/types/vehicle";

function makeRepair(
  label: string,
  category: RepairCategory,
  costMin: number,
  costMax: number,
  countsInMarginDefault: boolean
): RepairEstimate {
  return {
    id: `${category}-${repairSlug(label)}`,
    label,
    category,
    costMin,
    costMax,
    countsInMarginDefault,
  };
}

function isAutomatic(gearbox?: string, trim = ""): boolean {
  const text = `${gearbox ?? ""} ${trim}`.toLowerCase();
  return (
    text.includes("auto") ||
    text.includes("edc") ||
    text.includes("dsg") ||
    text.includes("s-tronic") ||
    text.includes("eat") ||
    text.includes("cvt") ||
    text.includes("powershift")
  );
}

export interface ModelRiskResult {
  repairs: RepairEstimate[];
  problemes: string[];
  motorLabel: string;
  motorAdvice: string;
}

/** Risques modèle + lignes associées (selon motorisation du véhicule passé). */
export function buildModelRiskRepairs(vehicle: VehicleData): ModelRiskResult {
  const km = vehicle.mileage ?? 150000;
  const trim = vehicle.trim ?? vehicle.title ?? "";
  const profile = getEngineProfile(vehicle.brand, vehicle.model, trim);
  const motorKind = getMotorisationKind(vehicle.fuel, trim);
  const motorLabel = motorisationLabel(motorKind);
  const modelIssues = filterKnownIssuesForMotor(
    profile.knownIssues,
    motorKind,
    vehicle.fuel,
    trim
  );

  const problemes: string[] = [];
  const riskRepairs: RepairEstimate[] = [];

  for (const issue of modelIssues) {
    if (!issue.kmThreshold || km >= issue.kmThreshold * 0.85) {
      problemes.push(`${issue.issue} (risque modèle — hors marge)`);
      riskRepairs.push(
        makeRepair(issue.issue, "risque_modele", issue.costMin, issue.costMax, false)
      );
    }
  }

  if (isDieselFuel(vehicle.fuel, trim)) {
    if (km > 100000) {
      problemes.push("Diesel à fort km — surveillance FAP, EGR et turbo");
      if (!riskRepairs.some((r) => r.label.toLowerCase().includes("fap"))) {
        riskRepairs.push(
          makeRepair("Entretien FAP/EGR préventif", "risque_modele", 300, 1200, false)
        );
      }
    }
  }

  if (isAutomatic(vehicle.gearbox, trim)) {
    const autoIssue = riskRepairs.find(
      (r) =>
        r.label.toLowerCase().includes("boîte") ||
        r.label.toLowerCase().includes("dsg")
    );
    if (!autoIssue && km > 100000) {
      problemes.push("Boîte automatique — contrôle huile/calages recommandé");
      riskRepairs.push(
        makeRepair("Diagnostic boîte automatique", "risque_modele", 150, 800, false)
      );
    }
  }

  return {
    repairs: normalizeRepairEstimates(riskRepairs),
    problemes,
    motorLabel,
    motorAdvice: motorisationAdvice(motorKind),
  };
}
