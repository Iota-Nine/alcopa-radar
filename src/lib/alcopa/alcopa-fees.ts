import * as cheerio from "cheerio";
import { FRAIS_ALCOPA_DEFAULT } from "@/lib/expert/carte-grise";
import type { VehicleData } from "@/types/vehicle";

const RE_INCLUS = /\bfrais\s+inclus\b/i;
const RE_SUS = /\bfrais\s+en\s+sus\b/i;

/** Détecte FI / FS dans un texte court (pas toute la page calendrier). */
export function detectFeesIncludedFromText(text: string): boolean | undefined {
  if (!text?.trim()) return undefined;
  const inclus = (text.match(new RegExp(RE_INCLUS.source, "gi")) ?? []).length;
  const sus = (text.match(new RegExp(RE_SUS.source, "gi")) ?? []).length;
  if (inclus > 0 && sus === 0) return true;
  if (sus > 0 && inclus === 0) return false;
  if (inclus > sus) return true;
  if (sus > inclus) return false;
  return undefined;
}

function extractVehicleDetailChunk(html: string): string {
  const markers = ['Lot n°', "Lot n\u00b0", 'itemprop="name"', "Mise à prix", "js-damage-proges"];
  let start = -1;
  for (const m of markers) {
    const i = html.indexOf(m);
    if (i >= 0 && (start < 0 || i < start)) start = i;
  }
  if (start < 0) start = 0;
  let end = html.indexOf("Commentaires", start);
  if (end < 0) end = html.indexOf("calendrier-des-ventes", start);
  if (end < 0) end = start + 32000;
  return html.slice(start, Math.min(end, start + 40000));
}

/** Fiche véhicule Alcopa — zone prix / lot uniquement. */
export function parseVehiclePageFees(html: string): boolean | undefined {
  const $ = cheerio.load(html);
  const zoneTexts: string[] = [];

  $(".card-footer").each((_, el) => {
    zoneTexts.push($(el).text());
  });

  $(".bg-prim").each((_, el) => {
    const block = $(el).closest(".card, .col-lg-4, .col-md-4, section");
    if (block.length) zoneTexts.push(block.first().text().slice(0, 2500));
  });

  $("h3, h4").each((_, el) => {
    if (/lot\s*n/i.test($(el).text())) {
      zoneTexts.push($(el).parent().text().slice(0, 2500));
    }
  });

  for (const text of zoneTexts) {
    const hit = detectFeesIncludedFromText(text);
    if (hit !== undefined) return hit;
  }

  return detectFeesIncludedFromText(extractVehicleDetailChunk(html));
}

/** Page listing d'une vente (en-tête avant la grille de lots). */
export function parseSaleListingFees(html: string): boolean | undefined {
  const cut =
    html.search(/\/voiture-occasion\/|\/utilitaire-occasion\/|id="listeLot"|class="listeLot"/i) ??
    -1;
  const head =
    cut > 600 ? html.slice(0, Math.min(cut, 35000)) : html.slice(0, 25000);

  const $ = cheerio.load(head);
  let inclus = 0;
  let sus = 0;
  $("small").each((_, el) => {
    const t = $(el).text().trim().toLowerCase();
    if (t.includes("frais inclus")) inclus++;
    if (t.includes("frais en sus")) sus++;
  });
  if (inclus > 0 && sus === 0) return true;
  if (sus > 0 && inclus === 0) return false;

  return detectFeesIncludedFromText(head);
}

export function resolveAlcopaFeesEuro(feesIncluded: boolean): number {
  return feesIncluded ? 0 : FRAIS_ALCOPA_DEFAULT;
}

/** Choix utilisateur prioritaire, sinon détection Alcopa, sinon en sus par prudence. */
export function resolveFeesIncluded(
  detected?: boolean,
  userChoice?: boolean | null
): boolean {
  if (userChoice !== undefined && userChoice !== null) return userChoice;
  if (detected !== undefined) return detected;
  return false;
}

export function effectiveFeesEuro(
  vehicle: Pick<VehicleData, "feesIncluded">,
  userChoice?: boolean | null
): number {
  return resolveAlcopaFeesEuro(resolveFeesIncluded(vehicle.feesIncluded, userChoice));
}

export function feesModeLabel(feesIncluded?: boolean): string {
  if (feesIncluded === true) return "Frais inclus";
  if (feesIncluded === false) return "Frais en sus";
  return "Non détecté";
}

export function feesModeBadgeClass(feesIncluded?: boolean): string {
  if (feesIncluded === true) return "text-emerald-400 bg-emerald-950/50 border-emerald-800";
  if (feesIncluded === false) return "text-amber-300 bg-amber-950/40 border-amber-800";
  return "text-slate-500 bg-slate-900 border-slate-700";
}

/** Hérite le mode FI/FS de la vente si la fiche ne l’affiche pas. */
export function applySaleFeesFallback(
  vehicle: VehicleData,
  saleFeesIncluded?: boolean
): VehicleData {
  if (vehicle.feesIncluded !== undefined || saleFeesIncluded === undefined) {
    return vehicle;
  }
  return { ...vehicle, feesIncluded: saleFeesIncluded };
}

export function formatAlcopaFeesDetail(
  feesIncluded: boolean | undefined,
  fraisEuro: number
): string {
  if (feesIncluded === true) {
    return `Frais Alcopa inclus dans l’enchère (0 € en sus)`;
  }
  if (feesIncluded === false) {
    return `Frais Alcopa en sus : ${fraisEuro.toLocaleString("fr-FR")} €`;
  }
  return `Frais Alcopa : ${fraisEuro.toLocaleString("fr-FR")} € (mode non détecté — pas de majoration)`;
}
