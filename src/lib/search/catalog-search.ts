import type { ScoredVehicle } from "@/types/vehicle";

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHaystack(item: ScoredVehicle): string {
  const v = item.vehicle;
  return [
    v.title,
    v.brand,
    v.model,
    v.trim,
    v.fuel,
    v.gearbox,
    v.location,
    v.lotNumber,
    v.vehicleType,
    v.bodyType,
    v.comments,
    v.ctNotes,
    item.analysis.verdict,
    item.analysis.ctAnalysis,
    item.analysis.engineNotes,
    ...item.analysis.problemes,
    ...item.analysis.repairEstimates.map((r) => r.label),
  ]
    .filter(Boolean)
    .join(" ");
}

function tokenizeQuery(query: string): string[] {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean);
}

/** Recherche multi-mots avec score (marque, modèle, CT, défauts…). */
export function searchCatalog(
  items: ScoredVehicle[],
  query: string
): ScoredVehicle[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return items;

  const scored: { item: ScoredVehicle; score: number }[] = [];

  for (const item of items) {
    const hay = normalizeSearchText(buildHaystack(item));

    let score = 0;
    for (const token of tokens) {
      if (!hay.includes(token)) {
        score = 0;
        break;
      }
      const brand = normalizeSearchText(item.vehicle.brand ?? "");
      const model = normalizeSearchText(item.vehicle.model ?? "");
      if (brand.startsWith(token) || model.startsWith(token)) score += 4;
      else if (brand.includes(token) || model.includes(token)) score += 3;
      else score += token.length >= 4 ? 2 : 1;
    }

    if (score > 0) scored.push({ item, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.item.analysis.scoreGlobal - a.item.analysis.scoreGlobal
  );

  return scored.map((entry) => entry.item);
}

export function highlightSearchMatch(text: string, query: string): boolean {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return true;
  const hay = normalizeSearchText(text);
  return tokens.every((t) => hay.includes(t));
}
