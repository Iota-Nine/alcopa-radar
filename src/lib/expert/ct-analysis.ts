import { repairSlug } from "./repair-margin";
import type { RepairEstimate, VehicleData } from "@/types/vehicle";

export interface CtAnalysisResult {
  notes: string;
  problems: string[];
  riskPenalty: number;
  majorCount: number;
  criticalCount: number;
  minorIgnored: number;
}

/** Anomalies mineures — jamais pénalisées */
const MINOR_MARKERS =
  /\b(mineur|mineure|mineurs|minor|défaillance\s*mineure|anomalie\s*mineure|niveau\s*1|1er\s*niveau|premier\s*niveau|remarque|observation|tolérance|usure\s*normale)\b/i;

/** Défauts critiques (contre-visite, immobilisation…) */
const CRITICAL_MARKERS =
  /\b(critique|défaillance\s*critique|anomalie\s*critique|contre[- ]?visite|contre\s*visite|immobilisation|interdiction\s*de\s*circuler|circulation\s*interdite|ne\s+pouvant\s+pas\s+circuler|défavorable\s+pour\s+défaillances\s*critiques)\b/i;

/** Défauts majeurs (procès-verbal CT ou texte Alcopa) */
const MAJOR_MARKERS =
  /\b(majeur|majeure|majeurs|défaillance\s*majeure|anomalie\s*majeure|défavorable\s+pour\s+défaillances\s*majeures|niveau\s*2|niveau\s*3|2ème\s*niveau|deuxième\s*niveau|2e\s*niveau|3e\s*niveau)\b/i;

function splitCtLines(text: string): string[] {
  return text
    .split(/\n|;|\||•|·|\/|(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
}

function isMinorLine(line: string): boolean {
  return MINOR_MARKERS.test(line);
}

/** Uniquement si le texte dit explicitement majeur ou critique (pas de déduction sur « frein », « fuite », etc.) */
function classifyCtLine(line: string): "minor" | "major" | "critical" | "ignore" {
  if (isMinorLine(line)) return "minor";
  if (CRITICAL_MARKERS.test(line)) return "critical";
  if (MAJOR_MARKERS.test(line)) return "major";
  return "ignore";
}

function lineToProblem(line: string): string {
  const cleaned = line.replace(/\s+/g, " ").slice(0, 120);
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function analyzeCtDefects(vehicle: VehicleData): CtAnalysisResult {
  const problems: string[] = [];
  let riskPenalty = 0;
  let majorCount = 0;
  let criticalCount = 0;
  let minorIgnored = 0;

  /** CT uniquement — pas les commentaires Alcopa (évite les faux positifs) */
  const raw = (vehicle.ctNotes ?? "").toLowerCase();

  if (!vehicle.ctUrl && !vehicle.ctNotes) {
    return {
      notes: "CT non consultable en ligne — vérifier le PDF Alcopa (mineurs non pris en compte).",
      problems: [],
      riskPenalty: 0,
      majorCount: 0,
      criticalCount: 0,
      minorIgnored: 0,
    };
  }

  if (!raw.trim()) {
    return {
      notes: vehicle.ctUrl
        ? "CT présent — contenu non lu (PDF/image illisible ou scan en cours)."
        : "CT non renseigné.",
      problems: vehicle.ctUrl
        ? ["CT non analysé (PDF/image) — ouvrir le document Alcopa avant d'enchérir"]
        : [],
      riskPenalty: vehicle.ctUrl ? 1.5 : 0,
      majorCount: 0,
      criticalCount: 0,
      minorIgnored: 0,
    };
  }

  const lines = splitCtLines(raw);
  const seen = new Set<string>();

  for (const line of lines) {
    const kind = classifyCtLine(line);
    if (kind === "minor") {
      minorIgnored++;
      continue;
    }
    if (kind === "ignore") continue;

    const label = kind === "critical" ? "CT critique" : "CT majeur";
    const problem = `${label} : ${lineToProblem(line)}`;
    if (seen.has(problem)) continue;
    seen.add(problem);
    problems.push(problem);

    if (kind === "critical") {
      criticalCount++;
      riskPenalty += 2;
    } else {
      majorCount++;
      riskPenalty += 1;
    }
  }

  const notes =
    criticalCount > 0
      ? `CT : ${criticalCount} critique(s)${majorCount > 0 ? `, ${majorCount} majeur(s)` : ""} — ${minorIgnored} mineur(s) ignoré(s).`
      : majorCount > 0
        ? `CT : ${majorCount} défaut(s) majeur(s)${minorIgnored > 0 ? ` · ${minorIgnored} mineur(s) ignoré(s)` : ""}.`
        : minorIgnored > 0
          ? `CT favorable — ${minorIgnored} anomalie(s) mineure(s) ignorée(s).`
          : "CT favorable — aucun défaut majeur ou critique.";

  return { notes, problems, riskPenalty, majorCount, criticalCount, minorIgnored };
}

/** Extrait uniquement les passages CT mentionnant majeur / critique / contre-visite */
export function extractCtNotesFromHtml(html: string): string | undefined {
  const inline = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const snippets: string[] = [];

  const pattern =
    /[^.]{0,40}\b(?:défaillance|anomalie)\s*(?:majeure|critique|majeur|critique)|défavorable\s+pour\s+défaillances\s*(?:majeures|critiques)|contre[- ]?visite|immobilisation|ne\s+pouvant\s+pas\s+circuler|niveau\s*[23]\b[^.]{0,80}/gi;

  for (const m of inline.matchAll(pattern)) {
    const text = m[0].trim();
    if (text.length > 8 && !/^contrôle\s*technique$/i.test(text)) {
      snippets.push(text);
    }
  }

  const unique = [...new Set(snippets)].slice(0, 6);
  return unique.length > 0 ? unique.join(" | ") : undefined;
}

/** Réparations chiffrées — uniquement défauts CT majeurs / critiques (comptés dans la marge). */
export function buildCtRepairEstimates(vehicle: VehicleData): RepairEstimate[] {
  const raw = vehicle.ctNotes ?? "";
  if (!raw.trim()) return [];

  const repairs: RepairEstimate[] = [];
  const lines = splitCtLines(raw);
  let idx = 0;

  for (const line of lines) {
    const kind = classifyCtLine(line);
    if (kind !== "major" && kind !== "critical") continue;

    const isCritical = kind === "critical";
    repairs.push({
      id: `ct-${idx++}-${repairSlug(line)}`,
      label: `${isCritical ? "CT critique" : "CT majeur"} : ${lineToProblem(line)}`,
      costMin: isCritical ? 900 : 450,
      costMax: isCritical ? 2800 : 1600,
      category: isCritical ? "ct_critique" : "ct_majeur",
      countsInMarginDefault: true,
    });
  }

  return repairs;
}
