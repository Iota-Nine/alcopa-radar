import { getBrandResale, getEngineProfile } from "./models-database";
import { getMotorisationKind } from "./motorisation";
import { buildModelRiskRepairs } from "./model-risks";
import { classifyParticulierVehicle } from "@/lib/filters/particulier";
import { effectiveFeesEuro } from "@/lib/alcopa/alcopa-fees";
import {
  estimateCarteGrise,
  FRAIS_ALCOPA_DEFAULT,
  parseYearForCarteGrise,
  vehicleForCarteGrise,
} from "./carte-grise";
import { estimateMarketValue } from "./pricing";
import { analyzeCtDefects, buildCtRepairEstimates } from "./ct-analysis";
import { estimateLiquidity } from "./liquidity";
import { computeMarginBreakdown } from "./margin-calc";
import {
  computeRepairBudget,
  defaultIncludedRepairIds,
  normalizeRepairEstimates,
  repairSlug,
} from "./repair-margin";
import type {
  RepairCategory,
  RepairEstimate,
  RiskLevel,
  VehicleAnalysis,
  VehicleData,
  Verdict,
} from "@/types/vehicle";

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

function estimateBodyworkRepairs(vehicle: VehicleData): RepairEstimate[] {
  if (!vehicle.damages?.length) return [];

  const estimates: RepairEstimate[] = [];
  const tpZones = new Set(
    vehicle.damages
      .filter((d) => d.type.includes("Tôlerie") || d.type === "TP")
      .map((d) => d.zone)
  );
  const paintZones = new Set(
    vehicle.damages
      .filter((d) => d.type === "Peinture" || d.type === "P")
      .map((d) => d.zone)
  );

  if (tpZones.size > 0) {
    estimates.push(
      makeRepair(
        `Carrosserie (${tpZones.size} zone(s) tôlerie/peinture)`,
        "esthetique",
        tpZones.size * 250,
        tpZones.size * 600,
        false
      )
    );
  }
  if (paintZones.size > 0) {
    estimates.push(
      makeRepair(
        `Peinture jantes/retouches (${paintZones.size})`,
        "esthetique",
        paintZones.size * 80,
        paintZones.size * 200,
        false
      )
    );
  }
  return estimates;
}

function computeVerdict(
  score: number,
  marge: number,
  risk: RiskLevel,
  currentPrice?: number,
  maxBid?: number
): Verdict {
  if (score >= 7.5 && marge >= 1000 && risk !== "Elevé") return "ACHETER";
  if (score < 5 || marge < 300 || risk === "Elevé") return "ÉVITER";
  if (currentPrice && maxBid && maxBid > 0 && currentPrice > maxBid + 500) return "ÉVITER";
  return "SURVEILLER";
}

export function analyzeVehicle(vehicle: VehicleData): VehicleAnalysis {
  const km = vehicle.mileage ?? 150000;
  const vehicleNorm = vehicleForCarteGrise(vehicle);
  const year = vehicleNorm.year ?? parseYearForCarteGrise(vehicle.firstRegistration, vehicle.year);
  const profile = getEngineProfile(vehicle.brand, vehicle.model, vehicle.trim ?? vehicle.title);
  const brandResale = getBrandResale(vehicle.brand);
  const aestheticRepairs: RepairEstimate[] = [...estimateBodyworkRepairs(vehicle)];
  const extraRepairs: RepairEstimate[] = [];
  const problemes: string[] = [];

  const modelRisk = buildModelRiskRepairs(vehicle);
  const riskRepairs = modelRisk.repairs;
  problemes.push(...modelRisk.problemes);

  const audience = classifyParticulierVehicle(vehicle);
  if (audience.isPro) {
    problemes.push(`Véhicule pro / utilitaire — ${audience.reasons.join(" · ")}`);
  }
  if (audience.isNonDriving) {
    problemes.push(`Non roulant — ${audience.reasons.join(" · ")}`);
  }

  let reliability = profile.reliability;
  let revente = (profile.resale + brandResale) / 2;
  let exportPotential = profile.export;

  if (km > 200000) {
    problemes.push(`Kilométrage élevé (${km.toLocaleString("fr-FR")} km) — usure mécanique accélérée`);
    reliability -= 1.5;
    revente -= 1;
  } else if (km > 150000) {
    problemes.push(`Kilométrage important (${km.toLocaleString("fr-FR")} km)`);
    reliability -= 0.8;
    revente -= 0.5;
  }

  const age = new Date().getFullYear() - year;
  if (age > 12) {
    problemes.push(`Véhicule ancien (${year}) — pièces et revente plus difficiles`);
    revente -= 0.8;
  }

  if (getMotorisationKind(vehicle.fuel, vehicle.trim ?? vehicle.title) === "diesel") {
    revente -= 0.5;
    exportPotential += 0.5;
  }

  const ctResult = analyzeCtDefects(vehicle);
  const ctRepairs = buildCtRepairEstimates(vehicle);
  problemes.push(...ctResult.problems);

  if (vehicle.comments) {
    const c = vehicle.comments.toLowerCase();
    if (c.includes("bruit") || c.includes("claquement")) {
      problemes.push("Bruit mécanique signalé dans les commentaires Alcopa");
      reliability -= 0.5;
    }
    if (c.includes("voyant") || c.includes("moteur")) {
      problemes.push("Voyant moteur / défaut signalé");
      reliability -= 1;
      extraRepairs.push(
        makeRepair("Diagnostic électronique", "commentaire", 80, 400, false)
      );
    }
    if (c.includes("accident") || c.includes(" choc")) {
      problemes.push("Historique accident/choc mentionné");
      revente -= 1.5;
    }
  }

  if (vehicle.batteryHealth !== undefined && vehicle.batteryHealth < 75) {
    problemes.push(`Batterie hybride/électrique faible (${vehicle.batteryHealth}%)`);
    riskRepairs.push(
      makeRepair("Batterie traction", "risque_modele", 2000, 8000, false)
    );
    reliability -= 2;
    revente -= 1.5;
  }

  const dedupe = (items: RepairEstimate[]) =>
    items.filter((r, i, arr) => arr.findIndex((x) => x.label === r.label) === i);

  const repairEstimates = normalizeRepairEstimates(
    dedupe([...ctRepairs, ...aestheticRepairs, ...riskRepairs, ...extraRepairs])
  );
  const marginIds = defaultIncludedRepairIds(repairEstimates);
  const repairBudget = computeRepairBudget(repairEstimates, marginIds);

  const totalRepairMin = repairEstimates.reduce((s, r) => s + r.costMin, 0);
  const totalRepairMax = repairEstimates.reduce((s, r) => s + r.costMax, 0);
  const ctRepairMax = ctRepairs.reduce((s, r) => s + r.costMax, 0);

  const estimationRevente = estimateMarketValue({ ...vehicleNorm, year });
  const carteGrise = estimateCarteGrise(vehicleNorm);
  const fraisAlcopa = effectiveFeesEuro(vehicle);
  const margins = computeMarginBreakdown(
    { ...vehicleNorm, year },
    estimationRevente,
    repairBudget,
    carteGrise.total,
    fraisAlcopa
  );
  const { prixMaxConseille, margePotentielle, margeAuPlafond, margeCalculeeSur } = margins;

  let riskScore = ctResult.riskPenalty;
  if (km > 200000) riskScore += 2;
  if (reliability < 6) riskScore += 1.5;
  if (ctRepairMax > 2500) riskScore += 2;
  if (margePotentielle < 500) riskScore += 1.5;

  if (ctResult.criticalCount > 0) riskScore += 3;
  if (ctResult.majorCount > 0) riskScore += 1;

  const risk: RiskLevel = riskScore >= 4 ? "Elevé" : riskScore >= 2 ? "Moyen" : "Faible";

  reliability = Math.max(1, Math.min(10, reliability));
  revente = Math.max(1, Math.min(10, revente));
  exportPotential = Math.max(1, Math.min(10, exportPotential));

  if (ctResult.criticalCount > 0) {
    reliability = Math.min(reliability, 4);
    revente = Math.min(revente, 4);
  } else if (ctResult.majorCount > 0) {
    reliability = Math.min(reliability, 5.5);
    revente = Math.min(revente, 5);
  }

  const marginScore = Math.min(10, Math.max(0, margePotentielle / 300));
  let scoreGlobal = Math.round(
    ((reliability + revente + marginScore + (10 - riskScore * 1.5)) / 4) * 10
  ) / 10;
  if (ctResult.criticalCount > 0) scoreGlobal = Math.min(scoreGlobal, 3.5);
  else if (ctResult.majorCount >= 2) scoreGlobal = Math.min(scoreGlobal, 5);
  else if (ctResult.majorCount > 0) scoreGlobal = Math.min(scoreGlobal, 6.5);

  const clampedScore = Math.max(1, Math.min(10, scoreGlobal));

  let verdict = computeVerdict(
    clampedScore,
    margePotentielle,
    risk,
    vehicle.price,
    prixMaxConseille
  );
  if (ctResult.criticalCount > 0) verdict = "ÉVITER";
  else if (ctResult.majorCount > 0 && risk === "Elevé") verdict = "ÉVITER";
  else if (audience.isNonDriving || audience.isPro) verdict = "ÉVITER";

  const engineNotes = `Moteur ${vehicle.brand} ${vehicle.model} : fiabilité ${reliability.toFixed(1)}/10. Motorisation ${modelRisk.motorLabel} — ${modelRisk.motorAdvice}`;

  const liquidity = estimateLiquidity(
    { ...vehicleNorm, year },
    {
      revente,
      fiabilite: reliability,
      exportPotential,
      margePotentielle,
      estimationRevente,
    }
  );

  return {
    scoreGlobal: clampedScore,
    risk,
    fiabilite: Math.round(reliability * 10) / 10,
    revente: Math.round(revente * 10) / 10,
    exportPotential: Math.round(exportPotential * 10) / 10,
    prixMaxConseille,
    estimationRevente,
    margePotentielle,
    margeAuPlafond,
    margeCalculeeSur,
    liquiditeScore: liquidity.liquiditeScore,
    joursReventeEstimes: liquidity.joursReventeEstimes,
    volumeMarche: liquidity.volumeMarche,
    prixMarcheEstime: liquidity.prixMarcheEstime,
    carteGriseEstimee: carteGrise.total,
    chevauxFiscaux: carteGrise.chevauxFiscaux,
    fraisAlcopa,
    repairEstimates,
    totalRepairMin,
    totalRepairMax,
    repairBudget,
    problemes: [...new Set(problemes)],
    verdict,
    engineNotes,
    ctAnalysis: `${ctResult.notes} · CG estimée ${carteGrise.total} € (${carteGrise.detail}).`,
  };
}

export function formatAnalysisReport(
  vehicle: VehicleData,
  analysis: VehicleAnalysis
): string {
  return `SCORE GLOBAL : ${analysis.scoreGlobal}/10

RISQUE :
${analysis.risk}

FIABILITÉ :
${analysis.fiabilite}/10

REVENTE :
${analysis.revente}/10

PRIX MAX CONSEILLÉ :
${analysis.prixMaxConseille.toLocaleString("fr-FR")} €

ESTIMATION REVENTE (LBC estim.) :
${analysis.estimationRevente.toLocaleString("fr-FR")} €

MARGE ESTIMÉE :
${analysis.margePotentielle.toLocaleString("fr-FR")} €

PROBLÈMES IDENTIFIÉS :
${analysis.problemes.map((p) => `- ${p}`).join("\n")}

VERDICT :
${analysis.verdict}`;
}
