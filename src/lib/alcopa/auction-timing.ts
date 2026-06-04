const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AlcopaSaleDeadline {
  url: string;
  endTs: number;
  hoursLeft: number;
}

export function hoursUntilAuctionEnd(endTs: number, nowMs = Date.now()): number {
  return (endTs * 1000 - nowMs) / (1000 * 60 * 60);
}

/** Enchère encore ouverte et fin dans au plus `maxDays` (24 h × maxDays). */
export function isAuctionEndingWithinDays(
  endTs: number,
  maxDays: number,
  nowMs = Date.now()
): boolean {
  const msLeft = endTs * 1000 - nowMs;
  if (msLeft <= 0) return false;
  return msLeft <= maxDays * MS_PER_DAY;
}

function normalizeSaleHref(href: string, baseUrl: string): string | null {
  const path = href.split("#")[0].split("?")[0];
  const full = path.startsWith("http") ? path : `${baseUrl}${path}`;
  try {
    const u = new URL(full);
    if (u.hostname.includes(".es")) return null;
    if (u.pathname.includes("/acceder-au-vente")) return null;
    const isSale =
      /\/vente-encheres-en-ligne\/\d+/i.test(u.pathname) ||
      /\/online-auction\/\d+/i.test(u.pathname) ||
      /\/salle-de-vente-encheres\/[^/]+\/\d+/i.test(u.pathname) ||
      /\/auction-room\/[^/]+\/\d+/i.test(u.pathname) ||
      /\/salle-de-vente-encheres\/multisite\/\d+/i.test(u.pathname);
    if (!isSale) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const SALE_HREF =
  /href="([^"]*(?:vente-encheres-en-ligne|online-auction|salle-de-vente-encheres|auction-room)[^"]*)"/gi;

const VEHICLE_PATH =
  /\/(?:voiture|utilitaire|moto|vehicule|materiel)-occasion\/[a-z0-9-]+\/[a-z0-9-]+-\d{5,}/i;

function nearestEndTs(html: string, index: number, window = 2800): number | undefined {
  const chunk = html.slice(Math.max(0, index - 400), index + window);
  const matches = [...chunk.matchAll(/data-ts="(\d{9,11})"/g)];
  if (matches.length === 0) return undefined;
  return parseInt(matches[0][1], 10);
}

/** Ventes du calendrier avec date de fin d'enchère (attribut data-ts). */
export function extractSalesWithDeadline(
  html: string,
  baseUrl = "https://www.alcopa-auction.fr"
): AlcopaSaleDeadline[] {
  const byUrl = new Map<string, AlcopaSaleDeadline>();

  let match: RegExpExecArray | null;
  while ((match = SALE_HREF.exec(html)) !== null) {
    const url = normalizeSaleHref(match[1], baseUrl);
    if (!url) continue;

    const endTs = nearestEndTs(html, match.index);
    if (!endTs) continue;

    const hoursLeft = hoursUntilAuctionEnd(endTs);
    const existing = byUrl.get(url);
    if (!existing || endTs < existing.endTs) {
      byUrl.set(url, { url, endTs, hoursLeft });
    }
  }

  return [...byUrl.values()];
}

export function filterSalesByMaxDays(
  sales: AlcopaSaleDeadline[],
  maxDays: number,
  nowMs = Date.now()
): AlcopaSaleDeadline[] {
  return sales.filter((s) => isAuctionEndingWithinDays(s.endTs, maxDays, nowMs));
}

const VEHICLE_PATTERNS = [
  /\/voiture-occasion\/[a-z0-9-]+\/[a-z0-9-]+-\d{5,}/gi,
  /\/utilitaire-occasion\/[a-z0-9-]+\/[a-z0-9-]+-\d{5,}/gi,
  /\/moto-occasion\/[a-z0-9-]+\/[a-z0-9-]+-\d{5,}/gi,
  /\/vehicule-occasion\/[a-z0-9-]+\/[a-z0-9-]+-\d{5,}/gi,
  /\/materiel-occasion\/[a-z0-9-]+\/[a-z0-9-]+-\d{5,}/gi,
];

/** Liens fiches dont le compte à rebours est ≤ maxDays (ignore les ventes J+5). */
export function extractVehicleLinksWithinDays(
  html: string,
  maxDays: number,
  baseUrl = "https://www.alcopa-auction.fr",
  nowMs = Date.now()
): string[] {
  const links = new Set<string>();

  for (const pattern of VEHICLE_PATTERNS) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
      const path = m[0].split("?")[0];
      if (!VEHICLE_PATH.test(path)) continue;

      const endTs = nearestEndTs(html, m.index);
      if (endTs !== undefined && !isAuctionEndingWithinDays(endTs, maxDays, nowMs)) {
        continue;
      }
      if (endTs === undefined && maxDays < 999) {
        continue;
      }

      const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
      links.add(url);
    }
  }

  return [...links];
}
