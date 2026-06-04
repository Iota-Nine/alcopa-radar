import { vehicleForCarteGrise } from "@/lib/expert/carte-grise";
import type { ScoredVehicle } from "@/types/vehicle";

/** Historique : année manquante sur le JSON → CG fausse au Top 10 si non corrigée. */
export function enrichScoredVehicleForCarteGrise(item: ScoredVehicle): ScoredVehicle {
  const vehicle = vehicleForCarteGrise(item.vehicle);
  if (vehicle === item.vehicle) return item;
  return { ...item, vehicle };
}

export const HISTORY_KEY = "alcopa-scanner-history";
export const PAGES_KEY = "alcopa-scan-pages";

/** Ne pas re-télécharger une page listing Alcopa avant ce délai */
export const PAGE_CACHE_TTL_MS = 8 * 60 * 1000;
/** Mise à jour légère du prix (sans re-scraper toute la fiche) */
export const PRICE_REFRESH_MS = 2 * 60 * 1000;
/** Ré-analyse complète de la fiche (CT, défauts, estimation) */
export const FULL_ANALYZE_MS = 18 * 60 * 1000;

export interface ListingPageCache {
  urls: string[];
  fetchedAt: number;
  hasNext: boolean;
  /** Frais inclus sur la vente (page 1) — hérité par les lots si fiche ambiguë */
  feesIncluded?: boolean;
}

export function loadHistory(): ScoredVehicle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const items = raw ? (JSON.parse(raw) as ScoredVehicle[]) : [];
    return items.map(enrichScoredVehicleForCarteGrise);
  } catch {
    return [];
  }
}

export function historyMap(items: ScoredVehicle[]): Map<string, ScoredVehicle> {
  return new Map(items.map((item) => [item.vehicle.url, item]));
}

export function saveHistory(items: ScoredVehicle[]): void {
  if (typeof window === "undefined") return;
  const ranked = [...items]
    .map(enrichScoredVehicleForCarteGrise)
    .sort((a, b) => b.analysis.scoreGlobal - a.analysis.scoreGlobal);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(ranked.slice(0, 1500)));
  window.dispatchEvent(new CustomEvent("alcopa-history-updated"));
}

let historySaveTimer: ReturnType<typeof setTimeout> | null = null;

/** Évite les écritures localStorage à chaque lot analysé pendant un scan massif. */
export function saveHistoryDebounced(items: ScoredVehicle[], delayMs = 750): void {
  if (typeof window === "undefined") return;
  if (historySaveTimer) clearTimeout(historySaveTimer);
  historySaveTimer = setTimeout(() => {
    saveHistory(items);
    historySaveTimer = null;
  }, delayMs);
}

export function mergeByUrl(
  current: ScoredVehicle[],
  incoming: ScoredVehicle[]
): ScoredVehicle[] {
  const map = historyMap(current);
  for (const item of incoming) {
    map.set(item.vehicle.url, enrichScoredVehicleForCarteGrise(item));
  }
  return [...map.values()];
}

export function ageMs(scannedAt: string): number {
  return Date.now() - new Date(scannedAt).getTime();
}

export type ScanQueueKind = "full" | "price" | "cache";

export function classifyUrl(
  url: string,
  cache: Map<string, ScoredVehicle>,
  now = Date.now()
): ScanQueueKind {
  const hit = cache.get(url);
  if (!hit) return "full";
  const age = now - new Date(hit.scannedAt).getTime();
  if (age >= FULL_ANALYZE_MS) return "full";
  if (age >= PRICE_REFRESH_MS) return "price";
  return "cache";
}

export function loadPageCaches(): Record<string, ListingPageCache> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PAGES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ListingPageCache>) : {};
  } catch {
    return {};
  }
}

export function getCachedListingPage(
  saleUrl: string,
  page: number,
  caches: Record<string, ListingPageCache>,
  now = Date.now()
): ListingPageCache | null {
  const key = `${saleUrl}|${page}`;
  const entry = caches[key];
  if (!entry) return null;
  if (now - entry.fetchedAt > PAGE_CACHE_TTL_MS) return null;
  return entry;
}

export function setCachedListingPage(
  saleUrl: string,
  page: number,
  urls: string[],
  hasNext: boolean,
  caches: Record<string, ListingPageCache>,
  feesIncluded?: boolean
): Record<string, ListingPageCache> {
  const key = `${saleUrl}|${page}`;
  const prev = caches[key];
  return {
    ...caches,
    [key]: {
      urls,
      hasNext,
      fetchedAt: Date.now(),
      feesIncluded: feesIncluded ?? prev?.feesIncluded,
    },
  };
}

/** Vide les caches listing pour forcer une relecture complète Alcopa */
export function clearAllScanCaches(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PAGES_KEY);
}

export function savePageCaches(caches: Record<string, ListingPageCache>): void {
  if (typeof window === "undefined") return;
  const entries = Object.entries(caches);
  const trimmed = Object.fromEntries(entries.slice(-400));
  localStorage.setItem(PAGES_KEY, JSON.stringify(trimmed));
}
