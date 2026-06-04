import { computeNetMargin, formatCarteGriseMarginLine, type CarteGriseEstimate } from "./carte-grise";

export interface MarginExplainInput {
  revente: number;
  enchere: number;
  repairBudget: number;
  carteGrise: number;
  fraisAlcopa: number;
  /** Si fourni, libellé détaillé (ex. exonération ≥10 ans). */
  carteGriseEstimate?: CarteGriseEstimate;
}

/** Lignes lisibles : pourquoi la marge ≠ revente − enchère. */
export function buildMarginExplainLines(
  input: MarginExplainInput,
  reventeLabel: string
): string[] {
  const { revente, enchere, repairBudget, carteGrise, fraisAlcopa, carteGriseEstimate } =
    input;
  if (revente <= 0 || enchere <= 0) return [];

  const marge = computeNetMargin({
    estimationRevente: revente,
    purchasePrice: enchere,
    repairBudget,
    carteGrise,
    fraisAlcopa,
  });

  const lines: string[] = [
    `${reventeLabel} ${revente.toLocaleString("fr-FR")} €`,
    `− Enchère ${enchere.toLocaleString("fr-FR")} €`,
  ];
  if (fraisAlcopa > 0) {
    lines.push(`− Frais Alcopa ${fraisAlcopa.toLocaleString("fr-FR")} €`);
  }
  if (repairBudget > 0) {
    lines.push(`− Réparations cochées ${repairBudget.toLocaleString("fr-FR")} €`);
  }
  if (carteGrise > 0) {
    lines.push(
      carteGriseEstimate
        ? formatCarteGriseMarginLine(carteGriseEstimate)
        : `− Carte grise ${carteGrise.toLocaleString("fr-FR")} €`
    );
  }
  lines.push(`= ${marge.toLocaleString("fr-FR")} € net`);

  return lines;
}
