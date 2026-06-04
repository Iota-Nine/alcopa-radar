import type { VehicleData } from "@/types/vehicle";

const BASE = "https://www.alcopa-auction.fr";

/** Fiche produit Alcopa : se termine par un ID numérique */
const VEHICLE_PATH =
  /^\/(?:voiture-occasion|utilitaire-occasion|moto-occasion|vehicule-occasion|materiel-occasion)\/[^/]+\/[^/]+-\d{5,}\/?$/i;

const SALE_PATH =
  /^\/(?:vente-encheres-en-ligne|online-auction)\/\d+/i;

const ROOM_SALE_PATH = /^\/(?:salle-de-vente-encheres|auction-room)\/[a-z0-9-]+\/\d+/i;

const BRAND_SLUGS: Record<string, string> = {
  audi: "AUDI",
  bmw: "BMW",
  mercedes: "MERCEDES",
  "mercedes-benz": "MERCEDES",
  toyota: "TOYOTA",
  volkswagen: "VOLKSWAGEN",
  peugeot: "PEUGEOT",
  renault: "RENAULT",
  citroen: "CITROEN",
  ford: "FORD",
  opel: "OPEL",
  nissan: "NISSAN",
  hyundai: "HYUNDAI",
  kia: "KIA",
  seat: "SEAT",
  skoda: "SKODA",
  volvo: "VOLVO",
  fiat: "FIAT",
  dacia: "DACIA",
  honda: "HONDA",
  mazda: "MAZDA",
  mini: "MINI",
  porsche: "PORSCHE",
  jaguar: "JAGUAR",
  land: "LAND",
  "land-rover": "LAND ROVER",
  lexus: "LEXUS",
  suzuki: "SUZUKI",
  mitsubishi: "MITSUBISHI",
  lancia: "LANCIA",
};

const CATEGORY_PAGES: Record<string, string> = {
  "/vehicules-de-tourisme": `${BASE}/recherche?categories%5B%5D=VP`,
  "/vehicules-utilitaires": `${BASE}/recherche?categories%5B%5D=VU`,
  "/vehicules-hs": `${BASE}/recherche?categories%5B%5D=HS`,
  "/materiels": `${BASE}/recherche?categories%5B%5D=MAT`,
  "/voitures-de-collection": `${BASE}/recherche?categories%5B%5D=COL`,
};

export type ResolvedUrl =
  | { kind: "vehicle"; url: string }
  | { kind: "listing"; url: string };

export function isCaptchaPage(html: string): boolean {
  return (
    html.includes("Human Verification") ||
    html.includes("captcha-container") ||
    html.includes("AwsWafIntegration") ||
    html.includes("challenge-container") ||
    html.includes("cf-browser-verification")
  );
}

/** Page Alcopa sans calendrier (blocage cloud, WAF, HTML vide). */
export function isBlockedCalendarHtml(html: string): boolean {
  if (isCaptchaPage(html)) return true;
  const hasSales = /vente-encheres-en-ligne|online-auction|salle-de-vente-encheres/i.test(html);
  if (!hasSales && html.length < 80_000) return true;
  return false;
}

export function normalizeAlcopaUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith("http")) {
    url = url.startsWith("/") ? `${BASE}${url}` : `${BASE}/${url}`;
  }
  const parsed = new URL(url);
  if (!parsed.hostname.includes("alcopa-auction")) {
    throw new Error("URL Alcopa invalide");
  }
  parsed.hash = "";
  return parsed.toString();
}

function frPath(url: string): string {
  const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
  return path.replace(/^\/(en|es|de|ro|pl|ru|rs|pt|lt|hu|ua|it)(\/|$)/, "/");
}

function modelFamilyFromSlug(slug: string): string {
  const clean = slug.trim().toLowerCase();
  if (/^[a-z]\d+[a-z]?$/i.test(clean)) return clean.toUpperCase();
  if (/^\d+$/.test(clean)) return clean;
  return clean
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ")
    .toUpperCase();
}

function buildSearchUrl(params: Record<string, string | string[]>): string {
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    const values = Array.isArray(val) ? val : [val];
    for (const v of values) q.append(key, v);
  }
  return `${BASE}/recherche?${q.toString()}`;
}

export function resolveAlcopaUrl(input: string): ResolvedUrl {
  const normalized = normalizeAlcopaUrl(input);
  const path = frPath(normalized);

  if (VEHICLE_PATH.test(path)) {
    return { kind: "vehicle", url: normalized };
  }

  if (path.includes("/recherche") || path.includes("/search")) {
    return { kind: "listing", url: normalized };
  }

  for (const [prefix, listingUrl] of Object.entries(CATEGORY_PAGES)) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return { kind: "listing", url: listingUrl };
    }
  }

  const brandModel = path.match(/^\/occasion-([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/i);
  if (brandModel) {
    const brandKey = brandModel[1].toLowerCase();
    const brand = BRAND_SLUGS[brandKey] ?? brandKey.toUpperCase();
    const params: Record<string, string | string[]> = { "brands[]": brand };
    if (brandModel[2]) {
      params["model_families[]"] = modelFamilyFromSlug(brandModel[2]);
    }
    return { kind: "listing", url: buildSearchUrl(params) };
  }

  if (
    SALE_PATH.test(path) ||
    ROOM_SALE_PATH.test(path) ||
    path.includes("/acceder-au-vente-encheres/")
  ) {
    return { kind: "listing", url: normalized };
  }

  if (path.includes("/calendrier-des-ventes")) {
    return { kind: "listing", url: `${BASE}/calendrier-des-ventes` };
  }

  if (path === "/" || path === "") {
    return { kind: "listing", url: `${BASE}/calendrier-des-ventes` };
  }

  if (
    path.includes("/vente-encheres-en-ligne/") ||
    path.includes("/online-auction/") ||
    path.includes("/salle-de-vente-encheres/") ||
    path.includes("/auction-room/")
  ) {
    return { kind: "listing", url: normalized };
  }

  if (path.includes("/salle-de-vente-web") || path.includes("/vehicules-")) {
    return { kind: "listing", url: `${BASE}/calendrier-des-ventes` };
  }

  if (/-\d{5,}$/.test(path) && path.split("/").length >= 3) {
    return { kind: "vehicle", url: normalized };
  }

  return { kind: "listing", url: normalized };
}

export function listingPageUrl(baseUrl: string, page: number): string {
  const url = new URL(baseUrl);
  if (page > 1) {
    url.searchParams.set("page", String(page));
  }
  return url.toString();
}

/** URL de vente valide = contient un identifiant numérique de vente */
export function isValidSaleListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("alcopa-auction.fr")) return false;
    if (u.hostname.includes(".es")) return false;
    if (u.pathname.includes("/acceder-au-vente")) return false;
    return (
      /\/vente-encheres-en-ligne\/\d+/i.test(u.pathname) ||
      /\/online-auction\/\d+/i.test(u.pathname) ||
      /\/salle-de-vente-encheres\/[^/]+\/\d+/i.test(u.pathname) ||
      /\/auction-room\/[^/]+\/\d+/i.test(u.pathname) ||
      /\/salle-de-vente-encheres\/multisite\/\d+/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

/** Extrait les liens fiches véhicules depuis une page HTML Alcopa */
export function extractVehicleLinks(html: string, baseUrl = BASE): string[] {
  const links = new Set<string>();
  const patterns = [
    /\/voiture-occasion\/[a-z0-9-]+\/[a-z0-9-]+-\d{5,}/gi,
    /\/utilitaire-occasion\/[a-z0-9-]+\/[a-z0-9-]+-\d{5,}/gi,
    /\/moto-occasion\/[a-z0-9-]+\/[a-z0-9-]+-\d{5,}/gi,
    /\/vehicule-occasion\/[a-z0-9-]+\/[a-z0-9-]+-\d{5,}/gi,
    /\/materiel-occasion\/[a-z0-9-]+\/[a-z0-9-]+-\d{5,}/gi,
  ];

  for (const pattern of patterns) {
    for (const m of html.match(pattern) ?? []) {
      links.add(m.startsWith("http") ? m.split("?")[0] : `${baseUrl}${m.split("?")[0]}`);
    }
  }

  return [...links];
}

/** Extrait les URLs de ventes depuis le calendrier ou une page salle */
export function extractSaleUrls(html: string, baseUrl = BASE): string[] {
  const sales = new Set<string>();
  const patterns = [
    /\/vente-encheres-en-ligne\/\d+/gi,
    /\/online-auction\/\d+/gi,
    /\/salle-de-vente-encheres\/[a-z0-9-]+\/\d+/gi,
    /\/auction-room\/[a-z0-9-]+\/\d+/gi,
    /\/salle-de-vente-encheres\/multisite\/\d+/gi,
  ];

  for (const pattern of patterns) {
    for (const m of html.match(pattern) ?? []) {
      const raw = m.split("#")[0];
      const full = raw.startsWith("http") ? raw : `${baseUrl}${raw}`;
      if (!isValidSaleListingUrl(full)) continue;
      try {
        sales.add(new URL(full).toString());
      } catch {
        sales.add(full);
      }
    }
  }

  return [...sales];
}

export function hasNextListingPage(html: string, currentPage: number): boolean {
  const nextExplicit = new RegExp(`name="page"[^>]*value="${currentPage + 1}"`, "i");
  if (nextExplicit.test(html)) return true;
  return /name="page"[^>]*value="\d+"[^>]*>\s*suivant/i.test(html);
}

export function parseResultCount(html: string): number | undefined {
  const match = html.match(/class="nb_items"[^>]*>\s*(\d[\d\s]*)/i);
  if (!match) return undefined;
  return parseInt(match[1].replace(/\s/g, ""), 10);
}

function parseListingCardPrice(chunk: string): number | undefined {
  const match = chunk.match(/Mise à prix\s*:[\s\S]{0,140}?(\d[\d\s]{1,12})\s*&euro;/i);
  if (!match) return undefined;
  const value = parseInt(match[1].replace(/\s/g, ""), 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Données légères extraites d'une carte listing (sans fetch fiche) */
export function parseListingCards(html: string, baseUrl = BASE): Partial<VehicleData>[] {
  const cards: Partial<VehicleData>[] = [];
  const linkPattern =
    /href="(\/(?:voiture|utilitaire|moto|vehicule|materiel)-occasion\/[^"]+)"/gi;
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const path = match[1].split("?")[0];
    const url = `${baseUrl}${path}`;
    if (seen.has(url)) continue;
    seen.add(url);

    const slug = path.split("/");
    const brand = (slug[2] ?? "").toUpperCase();
    const titlePart = slug[3]?.replace(/-\d+$/, "").replace(/-/g, " ").toUpperCase() ?? "";

    const chunk = html.slice(match.index, match.index + 2800);
    const kmMatch = chunk.match(/([\d\s]{2,9})\s*km/i);
    const yearMatch = chunk.match(/1ère mise\s*:\s*(\d{4})/i);
    const fuelMatch = chunk.match(/>\s*(GO|ES|EE|EL|GH|GL)[<\s]/i);
    const lotMatch = chunk.match(/Lot n°\s*<strong>\s*(\d+)/i);
    const locationMatch = chunk.match(/fa-location-crosshairs[^>]*><\/i>\s*([^<]+)/i);

    cards.push({
      url,
      brand,
      model: titlePart,
      title: `${brand} ${titlePart}`.trim(),
      lotNumber: lotMatch?.[1],
      location: locationMatch?.[1]?.trim(),
      price: parseListingCardPrice(chunk),
      mileage: kmMatch ? parseInt(kmMatch[1].replace(/\s/g, ""), 10) : undefined,
      year: yearMatch ? parseInt(yearMatch[1], 10) : undefined,
      fuel: fuelMatch?.[1],
    });
  }

  return cards;
}
