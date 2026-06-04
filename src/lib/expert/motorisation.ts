/** Type de motorisation pour filtrer les risques modèle. */
export type MotorisationKind =
  | "diesel"
  | "essence"
  | "hybride"
  | "hybride_rechargeable"
  | "electrique";

export type IssueMotorTag = "diesel" | "essence" | "any";

function fuelText(fuel?: string, trim = ""): string {
  return `${fuel ?? ""} ${trim}`.toLowerCase();
}

export function isDieselFuel(fuel?: string, trim = ""): boolean {
  const text = fuelText(fuel, trim);
  return (
    text.includes("diesel") ||
    text.includes("dci") ||
    text.includes("tdi") ||
    text.includes("hdi") ||
    text.includes("cdi") ||
    text === "go" ||
    /\bd[\s-]?4d\b/i.test(text)
  );
}

export function isElectricFuel(fuel?: string, trim = ""): boolean {
  const text = fuelText(fuel, trim);
  return (
    text.includes("électr") ||
    text.includes("electr") ||
    text === "el" ||
    text === "ee" ||
    text.includes("bev") ||
    (text.includes("ev") && !text.includes("rev"))
  );
}

export function isHybridFuel(fuel?: string, trim = ""): boolean {
  const text = fuelText(fuel, trim);
  if (isElectricFuel(fuel, trim)) return false;
  return (
    text.includes("hybride") ||
    text.includes("hybrid") ||
    text === "gh" ||
    text === "gl" ||
    text.includes("phev") ||
    text.includes("plug-in")
  );
}

/** Libellé affiché — priorité au champ Énergie Alcopa (ES, GO, …). */
export function getMotorisationKind(fuel?: string, trim = ""): MotorisationKind {
  const energie = (fuel ?? "").trim();
  if (energie) {
    const code = energie.toLowerCase();
    if (code === "es" || code.includes("essence") || code.includes("gpl")) return "essence";
    if (isElectricFuel(energie, "")) return "electrique";
    if (code.includes("hybride rechargeable") || code.includes("phev")) {
      return "hybride_rechargeable";
    }
    if (isHybridFuel(energie, "")) return "hybride";
    if (isDieselFuel(energie, "")) return "diesel";
  }

  const hint = fuelText("", trim);
  if (hint.includes("hybride rechargeable") || hint.includes("phev")) {
    return "hybride_rechargeable";
  }
  if (isHybridFuel("", trim)) return "hybride";
  if (isDieselFuel("", trim)) return "diesel";
  if (isElectricFuel("", trim)) return "electrique";
  return "essence";
}

export function motorisationLabel(kind: MotorisationKind): string {
  switch (kind) {
    case "diesel":
      return "diesel";
    case "electrique":
      return "électrique";
    case "hybride_rechargeable":
      return "hybride rechargeable";
    case "hybride":
      return "hybride";
    default:
      return "essence";
  }
}

export function motorisationAdvice(kind: MotorisationKind): string {
  switch (kind) {
    case "diesel":
      return "attention aux systèmes antipollution (FAP/EGR).";
    case "electrique":
      return "batterie et autonomie à vérifier.";
    case "hybride_rechargeable":
    case "hybride":
      return "batterie traction et entretien spécifique à prévoir.";
    default:
      return "entretien classique essence, sans FAP diesel.";
  }
}

/** Hybride diesel (ex. TDI hybride) → risques diesel ; hybride essence → risques essence. */
export function usesDieselModelRisks(kind: MotorisationKind, fuel?: string, trim = ""): boolean {
  if (kind === "diesel") return true;
  if (kind === "hybride" || kind === "hybride_rechargeable") {
    return isDieselFuel(fuel, trim);
  }
  return false;
}

export function usesEssenceModelRisks(kind: MotorisationKind, fuel?: string, trim = ""): boolean {
  if (kind === "essence") return true;
  if (kind === "hybride" || kind === "hybride_rechargeable") {
    return !isDieselFuel(fuel, trim);
  }
  return false;
}
