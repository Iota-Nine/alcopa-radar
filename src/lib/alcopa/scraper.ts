import * as cheerio from "cheerio";
import { extractCtNotesFromHtml } from "@/lib/expert/ct-analysis";
import type { VehicleDamage, VehicleData } from "@/types/vehicle";
import {
  extractSalesWithDeadline,
  extractVehicleLinksWithinDays,
  filterSalesByMaxDays,
  type AlcopaSaleDeadline,
} from "./auction-timing";
import {
  applySaleFeesFallback,
  parseSaleListingFees,
  parseVehiclePageFees,
} from "./alcopa-fees";
import { buildCtNotesFromDocumentText, fetchCtTextFromUrl, mergeCtNotes } from "./ct-document";
import { FETCH_HEADERS } from "./fetch-headers";
import {
  extractSaleUrls,
  extractVehicleLinks,
  hasNextListingPage,
  isCaptchaPage,
  isBlockedCalendarHtml,
  isValidSaleListingUrl,
  listingPageUrl,
  normalizeAlcopaUrl,
  parseListingCards,
  parseResultCount,
  resolveAlcopaUrl,
} from "./url-resolver";

export type { AlcopaSaleDeadline };

const BASE_URL = "https://www.alcopa-auction.fr";

const TABLE_LABELS: Record<string, string[]> = {
  marque: ["marque", "brand"],
  modele: ["modèle", "modele", "model"],
  finition: ["finition", "version", "trim"],
  energie: ["énergie", "energie", "energy"],
  km: ["kilométrage", "kilometrage", "mileage"],
  circulation: ["mise en circulation", "1ère mise", "premiere mise"],
  boite: ["boite de vitesse", "boîte de vitesse", "boite", "boîte", "gearbox"],
  lieu: ["lieu de stockage", "lieu", "site"],
};

export interface ScanOptions {
  /** 0 = pas de limite (scan complet de la liste) */
  maxVehicles?: number;
  maxPages?: number;
  concurrency?: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, options?: { soft?: boolean }): Promise<string> {
  const retries = options?.soft ? 1 : 3;
  let lastStatus = 0;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: FETCH_HEADERS,
        cache: "no-store",
        redirect: "follow",
      });
      lastStatus = res.status;

      if (res.ok) {
        const html = await res.text();
        if (isCaptchaPage(html)) {
          throw new Error(
            "Alcopa bloque l'accès (captcha). Réessayez dans quelques minutes."
          );
        }
        return html;
      }

      if ([405, 403, 429, 503].includes(res.status) && attempt < retries - 1) {
        await sleep(800 * (attempt + 1));
        continue;
      }

      if (options?.soft) return "";
      throw new Error(`Impossible de récupérer la page (${res.status})`);
    } catch (err) {
      if (options?.soft) return "";
      if (err instanceof Error && err.message.includes("captcha")) throw err;
      if (attempt < retries - 1) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  if (options?.soft) return "";
  throw new Error(`Impossible de récupérer la page (${lastStatus || "réseau"})`);
}

function parseTableValue($: cheerio.CheerioAPI, ...labels: string[]): string | undefined {
  let value: string | undefined;
  $("table tr").each((_, row) => {
    const th = $(row).find("th").first().text().trim().toLowerCase();
    if (labels.some((l) => th.includes(l.toLowerCase()))) {
      value = $(row).find("td").first().text().trim();
    }
  });
  return value;
}

function parseFromLabels($: cheerio.CheerioAPI, key: keyof typeof TABLE_LABELS): string | undefined {
  const fromTable = parseTableValue($, ...TABLE_LABELS[key]);
  if (fromTable) return fromTable;

  if (key !== "circulation") return undefined;

  const needles = TABLE_LABELS.circulation;
  let found: string | undefined;
  $("dt, th, label, span, p, li").each((_, el) => {
    if (found) return;
    const label = $(el).text().trim().toLowerCase();
    if (!needles.some((n) => label.includes(n))) return;
    const next = $(el).next("dd, td, span").first().text().trim();
    if (next) found = next;
  });
  return found;
}

function parseKm(text?: string): number | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/\s/g, "").replace(/km/gi, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? undefined : num;
}

function parsePrice($: cheerio.CheerioAPI): number | undefined {
  const candidates = [
    $(".bg-prim h4").text(),
    $("[itemprop='price']").attr("content"),
    $(".card-footer strong").text(),
    $("h4.text-white").text(),
  ];
  for (const text of candidates) {
    if (!text) continue;
    const match = text.replace(/\s/g, "").match(/(\d{3,})/);
    if (match) return parseInt(match[1], 10);
  }
  return undefined;
}

function parseYearFromDate(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (parts) return parseInt(parts[3], 10);
  const yearOnly = dateStr.match(/\b(19|20)\d{2}\b/);
  return yearOnly ? parseInt(yearOnly[0], 10) : undefined;
}

function parseDamages($: cheerio.CheerioAPI): VehicleDamage[] {
  const damages: VehicleDamage[] = [];
  const el = $(".js-damage-proges[data-source]");
  if (!el.length) return damages;

  try {
    const raw = el.attr("data-source");
    if (!raw) return damages;
    const parsed = JSON.parse(raw) as Array<{
      damage?: { zone_label?: string; type_label?: string };
    }>;
    for (const item of parsed) {
      if (item.damage?.zone_label) {
        damages.push({
          zone: item.damage.zone_label,
          type: item.damage.type_label ?? "Inconnu",
          label: `${item.damage.zone_label} — ${item.damage.type_label ?? "?"}`,
        });
      }
    }
  } catch {
    /* ignore */
  }
  return damages;
}

function parseComments($: cheerio.CheerioAPI): string | undefined {
  let comments = "";
  $("h3").each((_, el) => {
    if ($(el).text().trim().toLowerCase() === "commentaires") {
      comments = $(el).next("p, div, .comment").text().trim();
    }
  });
  return comments || undefined;
}

function inferBrandModelFromUrl(url: string): { brand: string; model: string } {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p.includes("occasion"));
    if (idx >= 0 && parts[idx + 1]) {
      return {
        brand: decodeURIComponent(parts[idx + 1]).toUpperCase(),
        model: decodeURIComponent(parts[idx + 2] ?? "").split("-").slice(0, 2).join(" ").toUpperCase(),
      };
    }
  } catch {
    /* ignore */
  }
  return { brand: "", model: "" };
}

export async function scrapeVehiclePage(
  url: string,
  options?: { skipCtPdf?: boolean }
): Promise<VehicleData> {
  const normalized = normalizeAlcopaUrl(url);
  const html = await fetchHtml(normalized);
  const $ = cheerio.load(html);

  const fromUrl = inferBrandModelFromUrl(normalized);
  const brand = parseFromLabels($, "marque") ?? fromUrl.brand;
  const model = parseFromLabels($, "modele") ?? fromUrl.model;
  const trim = parseFromLabels($, "finition") ?? "";
  const title =
    $("h1[itemprop='name']").first().text().trim() ||
    $("h1").first().text().trim() ||
    `${brand} ${model}`.trim();

  const lotMatch = $("h3.h4, h3").text().match(/Lot\s*n[°o]?\s*(\d+)/i);
  const ctLink = $('a[href*="/getDocument/ct/"]').first().attr("href");
  const ctImageFromGallery = $('img[src*="controle"], img[src*="CT_"], img[alt*="contrôle"], img[alt*="Controle"]')
    .first()
    .attr("src");

  const photos: string[] = [];
  $('a[data-gallery="pictures"] img, img[itemprop="image"]').each((_, el) => {
    const src = $(el).attr("src");
    if (src && !photos.includes(src)) photos.push(src);
  });

  const batteryFromBadge = $("span, a")
    .filter((_, el) => /certificat batterie|batterie/i.test($(el).text()))
    .text()
    .match(/(\d+)\s*%/);
  const batteryHealth = batteryFromBadge ? parseInt(batteryFromBadge[1], 10) : undefined;

  const firstReg = parseFromLabels($, "circulation");
  const mileage = parseKm(parseFromLabels($, "km"));
  const co2Raw = parseTableValue($, "co2", "co₂", "émissions");
  const co2 = co2Raw ? parseInt(co2Raw.replace(/\D/g, ""), 10) : undefined;
  const cylRaw = parseTableValue($, "cylindrée", "cylindree", "cylindrée moteur");
  const cylindree = cylRaw ? parseInt(cylRaw.replace(/\D/g, ""), 10) : undefined;
  const powerRaw = parseTableValue($, "puissance", "power");
  const powerKw = powerRaw
    ? parseInt(powerRaw.replace(/[^\d]/g, ""), 10) / (powerRaw.toLowerCase().includes("ch") ? 1.36 : 1)
    : undefined;

  const vehicleType = parseTableValue($, "type") ?? "";
  const bodyType = parseTableValue($, "carrosserie") ?? "";
  const comments = parseComments($);

  const ctLinkResolved = ctLink
    ? ctLink.startsWith("http")
      ? ctLink
      : `${BASE_URL}${ctLink}`
    : ctImageFromGallery
      ? ctImageFromGallery.startsWith("http")
        ? ctImageFromGallery
        : `${BASE_URL}${ctImageFromGallery}`
      : undefined;

  let ctNotes = extractCtNotesFromHtml(html);
  if (ctLinkResolved && !options?.skipCtPdf) {
    const docText = await fetchCtTextFromUrl(ctLinkResolved, normalized);
    if (docText) {
      const fromDocument = buildCtNotesFromDocumentText(docText);
      ctNotes = mergeCtNotes(ctNotes, fromDocument);
    }
  }

  return {
    url: normalized,
    title: title || `${brand} ${model}`.trim(),
    brand: brand || "INCONNU",
    model: model || title,
    trim,
    lotNumber: lotMatch?.[1],
    price: parsePrice($),
    mileage,
    year: parseYearFromDate(firstReg),
    firstRegistration: firstReg,
    fuel: parseFromLabels($, "energie"),
    gearbox: parseFromLabels($, "boite"),
    location: parseFromLabels($, "lieu"),
    co2: co2 && !isNaN(co2) ? co2 : undefined,
    cylindree: cylindree && !isNaN(cylindree) ? cylindree : undefined,
    powerKw: powerKw && !isNaN(powerKw) ? Math.round(powerKw) : undefined,
    comments: comments || undefined,
    vehicleType: vehicleType.trim() || undefined,
    bodyType: bodyType.trim() || undefined,
    ctUrl: ctLinkResolved,
    ctNotes,
    hasWarranty: html.includes("Garantie") && html.includes("fa-circle-check"),
    batteryHealth,
    damages: parseDamages($),
    photos: photos.slice(0, 12),
    feesIncluded: parseVehiclePageFees(html),
  };
}

async function mapPool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;

  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function scrapeListing(
  listingUrl: string,
  options: ScanOptions = {}
): Promise<{ vehicles: VehicleData[]; totalFound: number; pagesScanned: number }> {
  const maxVehicles = options.maxVehicles ?? 0;
  const maxPages = options.maxPages ?? 200;
  const concurrency = options.concurrency ?? 6;

  const allLinks: string[] = [];
  const seen = new Set<string>();
  let pagesScanned = 0;
  let totalFound: number | undefined;
  let saleFeesIncluded: boolean | undefined;

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = listingPageUrl(listingUrl, page);
    const html = await fetchHtml(pageUrl);
    pagesScanned++;

    if (page === 1) {
      saleFeesIncluded = parseSaleListingFees(html);
    }

    if (totalFound === undefined) {
      totalFound = parseResultCount(html);
    }

    const links = extractVehicleLinks(html);
    let newOnPage = 0;
    for (const link of links) {
      if (!seen.has(link)) {
        seen.add(link);
        allLinks.push(link);
        newOnPage++;
      }
    }

    if (maxVehicles > 0 && allLinks.length >= maxVehicles) break;
    if (links.length === 0) break;
    if (newOnPage === 0 && page > 1) break;
    if (!hasNextListingPage(html, page)) break;
  }

  const toFetch = maxVehicles > 0 ? allLinks.slice(0, maxVehicles) : allLinks;

  const vehicles: VehicleData[] = [];
  const batches = await mapPool(
    toFetch,
    async (vUrl) => {
      try {
        return await scrapeVehiclePage(vUrl);
      } catch {
        return null;
      }
    },
    concurrency
  );

  for (const v of batches) {
    if (v) vehicles.push(applySaleFeesFallback(v, saleFeesIncluded));
  }

  return {
    vehicles,
    totalFound: totalFound ?? allLinks.length,
    pagesScanned,
  };
}

/** Liste des ventes actives depuis le calendrier (rapide, ~2 s). */
export async function fetchActiveSales(): Promise<string[]> {
  const result = await fetchActiveSalesWithDeadline(999);
  return result.sales.map((s) => s.url);
}

export interface SalesFetchResult {
  sales: AlcopaSaleDeadline[];
  totalOnCalendar: number;
  blocked: boolean;
  error?: string;
}

/** Ventes dont l'enchère se termine dans au plus `maxDays` (ex. 1 = sous 24 h). */
export async function fetchActiveSalesWithDeadline(
  maxDays = 1
): Promise<SalesFetchResult> {
  const sources = [
    `${BASE_URL}/calendrier-des-ventes`,
    `${BASE_URL}/calendrier-des-ventes/`,
  ];

  let lastError: string | undefined;
  let bestTotal = 0;

  for (const src of sources) {
    try {
      const html = await fetchHtml(src);
      if (isBlockedCalendarHtml(html)) {
        lastError =
          "Alcopa bloque l'accès depuis ce serveur (IP cloud / captcha). Le scan ne fonctionne pas sur Vercel — lancez l'app en local.";
        continue;
      }

      const all = extractSalesWithDeadline(html);
      bestTotal = Math.max(bestTotal, all.length);

      if (all.length === 0) {
        lastError = "Calendrier Alcopa lu mais aucune vente détectée.";
        continue;
      }

      const filtered = filterSalesByMaxDays(all, maxDays);
      if (filtered.length > 0) {
        return { sales: filtered, totalOnCalendar: all.length, blocked: false };
      }

      lastError = `Aucune vente ne se termine dans les ${maxDays} prochain(s) jour(s) (${all.length} vente(s) au calendrier). Élargissez le filtre « jours max ».`;
    } catch (err) {
      lastError =
        err instanceof Error
          ? err.message
          : "Impossible de charger le calendrier Alcopa.";
    }
  }

  return {
    sales: [],
    totalOnCalendar: bestTotal,
    blocked: Boolean(
      lastError?.includes("bloque") ||
        lastError?.includes("captcha") ||
        (bestTotal === 0 && lastError)
    ),
    error: lastError,
  };
}

/** Une page de lots pour une vente donnée. */
export async function discoverSalePage(
  saleUrl: string,
  page: number,
  maxDaysUntilAuction = 1
): Promise<{
  urls: string[];
  hasNext: boolean;
  feesIncluded?: boolean;
  previews: Partial<VehicleData>[];
}> {
  if (!isValidSaleListingUrl(saleUrl)) {
    return { urls: [], hasNext: false, previews: [] };
  }

  const html = await fetchHtml(listingPageUrl(saleUrl, page), { soft: true });
  if (!html) return { urls: [], hasNext: false, previews: [] };

  const urls =
    maxDaysUntilAuction < 999
      ? extractVehicleLinksWithinDays(html, maxDaysUntilAuction)
      : extractVehicleLinks(html);
  const feesIncluded = page === 1 ? parseSaleListingFees(html) : undefined;
  const previews = parseListingCards(html);
  return {
    urls,
    hasNext: hasNextListingPage(html, page) && urls.length > 0,
    feesIncluded,
    previews,
  };
}

/** Fallback : catalogue global via /recherche (si calendrier bloqué). */
export async function discoverRecherchePage(page: number): Promise<{
  urls: string[];
  hasNext: boolean;
  totalFound?: number;
}> {
  const html = await fetchHtml(listingPageUrl(`${BASE_URL}/recherche`, page), {
    soft: true,
  });
  if (!html) return { urls: [], hasNext: false };

  const urls = extractVehicleLinks(html);
  return {
    urls,
    hasNext: hasNextListingPage(html, page) && urls.length > 0,
    totalFound: parseResultCount(html),
  };
}

/** Parcourt le calendrier Alcopa + toutes les ventes actives (contourne le captcha /recherche). */
export async function discoverCatalogUrls(
  options: Pick<ScanOptions, "maxPages"> = {}
): Promise<{
  urls: string[];
  totalFound: number;
  pagesScanned: number;
  salesScanned: number;
}> {
  const maxPagesPerSale = options.maxPages ?? 50;
  const allLinks: string[] = [];
  const seen = new Set<string>();

  const calendarHtml = await fetchHtml(`${BASE_URL}/calendrier-des-ventes`);
  const saleUrls = extractSaleUrls(calendarHtml);

  if (saleUrls.length === 0) {
    throw new Error("Aucune vente trouvée sur le calendrier Alcopa.");
  }

  let pagesScanned = 1;
  let salesScanned = 0;

  for (const saleUrl of saleUrls) {
    salesScanned++;

    for (let page = 1; page <= maxPagesPerSale; page++) {
      let html: string;
      try {
        html = await fetchHtml(listingPageUrl(saleUrl, page));
      } catch {
        break;
      }
      pagesScanned++;

      const links = extractVehicleLinks(html);
      if (links.length === 0) break;

      for (const link of links) {
        if (!seen.has(link)) {
          seen.add(link);
          allLinks.push(link);
        }
      }

      if (!hasNextListingPage(html, page)) break;
    }
  }

  if (allLinks.length === 0) {
    throw new Error(
      "Aucun véhicule détecté dans les ventes actives. Réessayez dans quelques minutes."
    );
  }

  return {
    urls: allLinks,
    totalFound: allLinks.length,
    pagesScanned,
    salesScanned,
  };
}

/** Lecture rapide de la mise à prix sur la fiche (sans tout re-parser). */
export async function scrapeVehiclePrices(
  urls: string[],
  concurrency = 14
): Promise<Map<string, number | undefined>> {
  const out = new Map<string, number | undefined>();
  await mapPool(
    urls,
    async (vUrl) => {
      try {
        const normalized = normalizeAlcopaUrl(vUrl);
        const html = await fetchHtml(normalized, { soft: true });
        if (!html) {
          out.set(vUrl, undefined);
          return;
        }
        const $ = cheerio.load(html);
        out.set(vUrl, parsePrice($));
      } catch {
        out.set(vUrl, undefined);
      }
    },
    concurrency
  );
  return out;
}

export async function analyzeVehicleUrls(
  urls: string[],
  concurrency = 8,
  saleFeesByUrl?: Record<string, boolean>,
  options?: { skipCtPdf?: boolean }
): Promise<VehicleData[]> {
  const batches = await mapPool(
    urls,
    async (vUrl) => {
      try {
        return await scrapeVehiclePage(vUrl, options);
      } catch {
        return null;
      }
    },
    concurrency
  );
  return batches
    .filter((v): v is VehicleData => v !== null)
    .map((v) => applySaleFeesFallback(v, saleFeesByUrl?.[v.url]));
}

export async function scanAlcopaUrl(
  input: string,
  options: ScanOptions = {}
): Promise<{ vehicles: VehicleData[]; totalFound?: number; pagesScanned?: number }> {
  const resolved = resolveAlcopaUrl(input);

  if (resolved.kind === "vehicle") {
    return { vehicles: [await scrapeVehiclePage(resolved.url)], totalFound: 1, pagesScanned: 1 };
  }

  if (
    resolved.url.includes("/recherche") ||
    resolved.url.includes("/search") ||
    resolved.url.includes("/calendrier-des-ventes")
  ) {
    const discovered = await discoverCatalogUrls(options);
    const max = options.maxVehicles ?? 0;
    const urls = max > 0 ? discovered.urls.slice(0, max) : discovered.urls;
    const vehicles = await analyzeVehicleUrls(urls, options.concurrency ?? 10);
    return {
      vehicles,
      totalFound: discovered.totalFound,
      pagesScanned: discovered.pagesScanned,
    };
  }

  const result = await scrapeListing(resolved.url, options);
  return {
    vehicles: result.vehicles,
    totalFound: result.totalFound,
    pagesScanned: result.pagesScanned,
  };
}

export { resolveAlcopaUrl, normalizeAlcopaUrl, extractVehicleLinks } from "./url-resolver";
