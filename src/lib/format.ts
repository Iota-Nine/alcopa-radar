/** Affiche une marge avec le bon signe (+ gain, − perte). */
export function formatMarge(
  marge: number | null | undefined,
  opts?: { label?: boolean; empty?: string }
): string {
  if (marge === null || marge === undefined) {
    return opts?.empty ?? "—";
  }
  const amount =
    marge > 0
      ? `+${marge.toLocaleString("fr-FR")} €`
      : marge < 0
        ? `${marge.toLocaleString("fr-FR")} €`
        : "0 €";
  return opts?.label !== false ? `Marge ${amount}` : amount;
}

export function margeColorClass(marge: number | null | undefined): string {
  if (marge === null || marge === undefined) return "text-slate-500";
  if (marge < 0) return "text-red-400";
  if (marge >= 1000) return "text-emerald-400";
  return "text-amber-400";
}

export function displayMarge(
  marge: number,
  hasLbcPrice: boolean
): number | null {
  return hasLbcPrice ? marge : null;
}

export function formatMaxBid(prixMax: number): string {
  if (!prixMax || prixMax <= 0) return "—";
  return `${prixMax.toLocaleString("fr-FR")} €`;
}

/** Ligne secondaire — marge si l’enchère atteint ce plafond (IA ou utilisateur, jamais mélangés). */
export function plafondMarginHint(
  margePotentielle: number,
  margeAuPlafond: number | undefined,
  prixMaxConseille: number,
  enchereActuelle?: number,
  plafondLabel = "plafond"
): string | null {
  if (margeAuPlafond === undefined || !prixMaxConseille) return null;
  if (!enchereActuelle || enchereActuelle <= 0) return null;
  if (enchereActuelle > prixMaxConseille) return null;
  if (enchereActuelle >= prixMaxConseille - 50) return null;
  if (margePotentielle <= margeAuPlafond + 100) return null;
  return `Si enchère monte au ${plafondLabel} (${formatMaxBid(prixMaxConseille)}) : ${formatMarge(margeAuPlafond, { label: false })}`;
}
