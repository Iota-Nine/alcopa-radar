"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getTopDeals, rankDeals, countGoodDeals } from "@/lib/deals";
import { loadAllLbcPrices } from "@/lib/storage/lbc-price";
import {
  classifyUrl,
  clearAllScanCaches,
  getCachedListingPage,
  loadHistory,
  loadPageCaches,
  mergeByUrl,
  saveHistory,
  saveHistoryDebounced,
  savePageCaches,
  setCachedListingPage,
} from "@/lib/storage/scan-cache";
import { fetchJson } from "@/lib/fetch-json";
import { shouldAnalyzeListingPreview } from "@/lib/filters/listing-preview";
import { isParticulierVehicle, isProVehicleUrl } from "@/lib/filters/particulier";
import type { AlertConfig, ScoredVehicle, VehicleData } from "@/types/vehicle";

export interface RunScanOptions {
  /** Recharge toutes les pages Alcopa et ré-analyse chaque fiche */
  forceFull?: boolean;
}

const IS_VERCEL_CLIENT = process.env.NEXT_PUBLIC_DEPLOY_HOST === "vercel";

const ANALYZE_BATCH = IS_VERCEL_CLIENT ? 3 : 18;
const REFRESH_BATCH = IS_VERCEL_CLIENT ? 12 : 25;
const DETAIL_REFRESH_BATCH = IS_VERCEL_CLIENT ? 3 : 8;
const MAX_PARALLEL_BATCHES = IS_VERCEL_CLIENT ? 1 : 3;
const CT_ENRICH_TOP = IS_VERCEL_CLIENT ? 0 : 35;
const CT_ENRICH_BATCH = 5;
const MAX_PAGES_PER_SALE = 80;
const LIVE_PRICE_INTERVAL_MS = 45_000;
/** Redécouverte Alcopa (nouveaux lots, lots vendus retirés) */
const WATCH_DISCOVERY_MS = 3 * 60 * 1000;

export type ScanPhase =
  | "idle"
  | "discovering"
  | "analyzing"
  | "done"
  | "watching"
  | "error";

export interface ScanProgress {
  phase: ScanPhase;
  totalCatalog: number;
  pagesScanned: number;
  pagesSkipped: number;
  salesActive: number;
  salesScanned: number;
  analyzed: number;
  fromCache: number;
  priceRefreshed: number;
  newAnalyzed: number;
  failed: number;
  skippedPro: number;
  skippedBudget: number;
  goodDeals: number;
  statusMessage: string;
  error: string | null;
}

export type ScanFilters = Pick<
  AlertConfig,
  "priceFilterEnabled" | "budgetMin" | "budgetMax" | "particulierOnly"
>;

const DEFAULT_SCAN_FILTERS: ScanFilters = {
  priceFilterEnabled: false,
  budgetMin: 0,
  budgetMax: 999_999,
  particulierOnly: true,
};

export function useAutoScan(
  maxDaysUntilAuction = 1,
  autoWatchEnabled = true,
  scanFilters: ScanFilters = DEFAULT_SCAN_FILTERS
) {
  const [progress, setProgress] = useState<ScanProgress>({
    phase: "idle",
    totalCatalog: 0,
    pagesScanned: 0,
    pagesSkipped: 0,
    salesActive: 0,
    salesScanned: 0,
    analyzed: 0,
    fromCache: 0,
    priceRefreshed: 0,
    newAnalyzed: 0,
    failed: 0,
    skippedPro: 0,
    skippedBudget: 0,
    goodDeals: 0,
    statusMessage: "",
    error: null,
  });
  const [results, setResults] = useState<ScoredVehicle[]>([]);
  const [topDeals, setTopDeals] = useState<ScoredVehicle[]>([]);
  const [latest, setLatest] = useState<ScoredVehicle[]>([]);
  const abortRef = useRef(false);
  const allResultsRef = useRef<ScoredVehicle[]>([]);
  const historyRef = useRef<Map<string, ScoredVehicle>>(new Map());
  const catalogUrlsRef = useRef<Set<string>>(new Set());
  const priceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchBusyRef = useRef(false);
  const liveTickRef = useRef(0);
  const statsRef = useRef({ fromCache: 0, priceRefreshed: 0, newAnalyzed: 0, failed: 0 });
  const scanFiltersRef = useRef(scanFilters);
  scanFiltersRef.current = scanFilters;

  useEffect(() => {
    const prior = loadHistory().filter((item) => isParticulierVehicle(item.vehicle));
    if (prior.length === 0) return;
    historyRef.current = new Map(prior.map((h) => [h.vehicle.url, h]));
    allResultsRef.current = [...prior];
    const lbcPrices = loadAllLbcPrices();
    const ranked = rankDeals(prior, lbcPrices);
    setResults(ranked);
    setTopDeals(getTopDeals(prior, 20, undefined, lbcPrices));
    setProgress((p) => ({
      ...p,
      analyzed: prior.length,
      goodDeals: countGoodDeals(prior, false, undefined, lbcPrices),
      statusMessage: `${prior.length} véhicule(s) en historique — « Scanner ventes imminentes » pour Alcopa.`,
    }));
  }, []);

  const commitResults = useCallback(
    (incoming: ScoredVehicle[], kind: "full" | "price" | "cache" = "full") => {
      const eligible = incoming.filter((item) => isParticulierVehicle(item.vehicle));
      if (eligible.length === 0) return;

      for (const item of eligible) {
        historyRef.current.set(item.vehicle.url, item);
        if (kind === "cache") statsRef.current.fromCache++;
        if (kind === "price") statsRef.current.priceRefreshed++;
        if (kind === "full") statsRef.current.newAnalyzed++;
      }

      allResultsRef.current = mergeByUrl(allResultsRef.current, eligible);
      const catalog = catalogUrlsRef.current;
      const visible =
        catalog.size > 0
          ? allResultsRef.current.filter((r) => catalog.has(r.vehicle.url))
          : allResultsRef.current;

      const lbcPrices = loadAllLbcPrices();
      const ranked = rankDeals(visible, lbcPrices);
      setResults(ranked);
      setTopDeals(getTopDeals(visible, 20, undefined, lbcPrices));
      setLatest(eligible.slice(-5).reverse());
      saveHistoryDebounced(allResultsRef.current);

      setProgress((p) => ({
        ...p,
        analyzed: visible.length,
        goodDeals: countGoodDeals(allResultsRef.current, false, undefined, lbcPrices),
        fromCache: statsRef.current.fromCache,
        priceRefreshed: statsRef.current.priceRefreshed,
        newAnalyzed: statsRef.current.newAnalyzed,
        failed: statsRef.current.failed,
        phase:
          p.phase === "discovering"
            ? "analyzing"
            : p.phase === "watching"
              ? "watching"
              : p.phase,
      }));
    },
    []
  );

  const stopAutonomousLoops = useCallback(() => {
    if (priceTimerRef.current) {
      clearInterval(priceTimerRef.current);
      priceTimerRef.current = null;
    }
    if (watchTimerRef.current) {
      clearInterval(watchTimerRef.current);
      watchTimerRef.current = null;
    }
    liveTickRef.current = 0;
  }, []);

  const runScan = useCallback(
    async (options?: RunScanOptions) => {
      const forceFull = options?.forceFull ?? false;
      abortRef.current = false;
      stopAutonomousLoops();
      statsRef.current = { fromCache: 0, priceRefreshed: 0, newAnalyzed: 0, failed: 0 };

      if (forceFull) clearAllScanCaches();

      const prior = loadHistory().filter((item) => isParticulierVehicle(item.vehicle));
      historyRef.current = new Map(prior.map((h) => [h.vehicle.url, h]));
      allResultsRef.current = [...prior];
      const initialLbc = loadAllLbcPrices();
      setResults(rankDeals(prior, initialLbc));
      setTopDeals(getTopDeals(prior, 20, undefined, initialLbc));
      setLatest([]);

      const seenUrls = new Set<string>();
      const urlSaleFees = new Map<string, boolean>();
      const toFullAnalyze: string[] = [];
      const toRefreshPrice: ScoredVehicle[] = [];
      let pumpFull = 0;
      let pumpRefresh = 0;
      let activeBatches = 0;
      const batchPromises = new Set<Promise<void>>();
      let pageCaches = forceFull ? {} : loadPageCaches();
      let pagesSkipped = 0;
      let pagesScanned = 0;
      let salesScanned = 0;
      let salesActive = 0;
      let skippedPro = 0;
      let skippedBudget = 0;

      const filterListingUrls = (
        urls: string[],
        previews?: Partial<VehicleData>[]
      ): string[] => {
        const previewByUrl = new Map(
          (previews ?? [])
            .filter((preview) => preview.url)
            .map((preview) => [preview.url!, preview])
        );
        const eligible: string[] = [];

        for (const url of urls) {
          if (isProVehicleUrl(url)) {
            skippedPro++;
            continue;
          }

          const preview = previewByUrl.get(url) ?? { url };
          const check = shouldAnalyzeListingPreview(preview, scanFiltersRef.current);
          if (!check.ok) {
            if (check.reason === "pro") skippedPro++;
            else if (check.reason === "budget") skippedBudget++;
            continue;
          }

          eligible.push(url);
        }

        return eligible;
      };

      const updateProgress = (partial: Partial<ScanProgress> & { statusMessage?: string }) => {
        setProgress((p) => ({
          ...p,
          ...partial,
          skippedPro,
          skippedBudget,
        }));
      };

      const analyzeBatch = async (urls: string[]) => {
        if (urls.length === 0 || abortRef.current) return;
        const saleFeesByUrl: Record<string, boolean> = {};
        for (const u of urls) {
          const fee = urlSaleFees.get(u);
          if (fee !== undefined) saleFeesByUrl[u] = fee;
        }
        try {
          const { ok, data } = await fetchJson<{ results?: ScoredVehicle[]; error?: string }>(
            "/api/catalog/analyze",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                urls,
                ...(Object.keys(saleFeesByUrl).length > 0 ? { saleFeesByUrl } : {}),
              }),
            },
            240_000
          );
          if (!ok) {
            statsRef.current.failed += urls.length;
            updateProgress({ failed: statsRef.current.failed });
            return;
          }
          const got = (data.results ?? []) as ScoredVehicle[];
          statsRef.current.failed += urls.length - got.length;
          updateProgress({ failed: statsRef.current.failed });
          commitResults(got, "full");
        } catch {
          statsRef.current.failed += urls.length;
          updateProgress({ failed: statsRef.current.failed });
        }
      };

      const refreshBatch = async (cached: ScoredVehicle[]) => {
        if (cached.length === 0 || abortRef.current) return;
        try {
          const { ok, data } = await fetchJson<{ results?: ScoredVehicle[] }>(
            "/api/catalog/refresh-prices",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cached }),
            },
            120_000
          );
          if (!ok) {
            statsRef.current.failed += cached.length;
            updateProgress({ failed: statsRef.current.failed });
            return;
          }
          const got = (data.results ?? []) as ScoredVehicle[];
          commitResults(got, "price");
        } catch {
          statsRef.current.failed += cached.length;
          updateProgress({ failed: statsRef.current.failed });
        }
      };

      const startPump = () => {
        while (activeBatches < MAX_PARALLEL_BATCHES) {
          if (abortRef.current) return;

          if (pumpFull < toFullAnalyze.length) {
            const batch = toFullAnalyze.slice(pumpFull, pumpFull + ANALYZE_BATCH);
            pumpFull += batch.length;
            if (batch.length === 0) break;
            activeBatches++;
            const job = analyzeBatch(batch).finally(() => {
              activeBatches--;
              batchPromises.delete(job);
              startPump();
            });
            batchPromises.add(job);
            continue;
          }

          if (pumpRefresh < toRefreshPrice.length) {
            const batch = toRefreshPrice.slice(pumpRefresh, pumpRefresh + REFRESH_BATCH);
            pumpRefresh += batch.length;
            if (batch.length === 0) break;
            activeBatches++;
            const job = refreshBatch(batch).finally(() => {
              activeBatches--;
              batchPromises.delete(job);
              startPump();
            });
            batchPromises.add(job);
            continue;
          }

          break;
        }
      };

      const resetAnalyzeQueues = () => {
        toFullAnalyze.length = 0;
        toRefreshPrice.length = 0;
        pumpFull = 0;
        pumpRefresh = 0;
      };

      const enqueueUrls = (urls: string[], treatAllAsFull: boolean) => {
        const cachedHits: ScoredVehicle[] = [];

        for (const url of urls) {
          const kind = treatAllAsFull ? "full" : classifyUrl(url, historyRef.current);
          if (kind === "full") {
            if (!toFullAnalyze.includes(url)) toFullAnalyze.push(url);
          } else if (kind === "price") {
            const hit = historyRef.current.get(url);
            if (hit && !toRefreshPrice.some((r) => r.vehicle.url === url)) {
              toRefreshPrice.push(hit);
            }
          } else {
            const hit = historyRef.current.get(url);
            if (hit) cachedHits.push(hit);
          }
        }

        if (cachedHits.length > 0) commitResults(cachedHits, "cache");
        if (toFullAnalyze.length > pumpFull || toRefreshPrice.length > pumpRefresh) {
          startPump();
        }
      };

      const buildStatus = (total: number, prefix?: string) => {
        const s = statsRef.current;
        const core = `${total} lots · ${s.newAnalyzed} nouveaux · ${s.priceRefreshed} prix · ${s.fromCache} cache`;
        return prefix ? `${prefix} · ${core}` : core;
      };

      const waitForAllAnalyses = async () => {
        while (
          pumpFull < toFullAnalyze.length ||
          pumpRefresh < toRefreshPrice.length ||
          activeBatches > 0
        ) {
          if (abortRef.current) return;
          startPump();
          if (batchPromises.size > 0) {
            await Promise.all([...batchPromises]);
          } else {
            await new Promise((r) => setTimeout(r, 150));
          }
        }
      };

      const runLivePriceRefresh = async () => {
        if (abortRef.current || catalogUrlsRef.current.size === 0) return;

        const stale: ScoredVehicle[] = [];
        const now = Date.now();
        for (const url of catalogUrlsRef.current) {
          const hit = historyRef.current.get(url);
          if (!hit) continue;
          if (now - new Date(hit.scannedAt).getTime() < 55_000) continue;
          const kind = classifyUrl(url, historyRef.current, now);
          if (kind !== "price") continue;
          stale.push(hit);
        }

        for (let i = 0; i < stale.length && !abortRef.current; i += REFRESH_BATCH) {
          await refreshBatch(stale.slice(i, i + REFRESH_BATCH));
        }
        if (!abortRef.current) {
          updateProgress({
            statusMessage: buildWatchStatus(),
          });
        }
      };

      const runLiveDetailRefresh = async () => {
        if (abortRef.current || catalogUrlsRef.current.size === 0) return;

        const needFull: { url: string; age: number }[] = [];
        const now = Date.now();
        for (const url of catalogUrlsRef.current) {
          if (classifyUrl(url, historyRef.current, now) !== "full") continue;
          const hit = historyRef.current.get(url);
          const age = hit
            ? now - new Date(hit.scannedAt).getTime()
            : Number.MAX_SAFE_INTEGER;
          needFull.push({ url, age });
        }
        needFull.sort((a, b) => b.age - a.age);
        const batch = needFull.slice(0, DETAIL_REFRESH_BATCH).map((x) => x.url);
        if (batch.length > 0) await analyzeBatch(batch);
      };

      const buildWatchStatus = () => {
        const n = catalogUrlsRef.current.size;
        return `Surveillance auto — ${n} lot(s) actifs · catalogue ~3 min · prix 45 s · fiches ~18 min`;
      };

      const enrichTopWithCt = async () => {
        const visible = allResultsRef.current.filter((item) =>
          catalogUrlsRef.current.has(item.vehicle.url)
        );
        const top = [...visible]
          .sort((a, b) => b.analysis.scoreGlobal - a.analysis.scoreGlobal)
          .slice(0, CT_ENRICH_TOP)
          .filter((item) => item.vehicle.ctUrl);
        if (top.length === 0 || abortRef.current) return;

        updateProgress({
          statusMessage: `Lecture CT PDF — Top ${top.length} véhicule(s)…`,
        });

        for (let i = 0; i < top.length; i += CT_ENRICH_BATCH) {
          if (abortRef.current) return;
          const urls = top.slice(i, i + CT_ENRICH_BATCH).map((item) => item.vehicle.url);
          const saleFeesByUrl: Record<string, boolean> = {};
          for (const u of urls) {
            const fee = urlSaleFees.get(u);
            if (fee !== undefined) saleFeesByUrl[u] = fee;
          }
          try {
            const { ok, data } = await fetchJson<{ results?: ScoredVehicle[] }>(
              "/api/catalog/analyze",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  urls,
                  skipCtPdf: false,
                  ...(Object.keys(saleFeesByUrl).length > 0 ? { saleFeesByUrl } : {}),
                }),
              },
              300_000
            );
            if (ok && data.results?.length) commitResults(data.results, "full");
          } catch {
            /* CT optionnel — ne bloque pas le scan */
          }
        }
      };

      const discoverFromSales = async (
        sales: { url: string }[],
        skipPageCache: boolean
      ) => {
        const freshCatalog = new Set<string>();
        pagesSkipped = 0;
        pagesScanned = 0;
        salesScanned = 0;

        for (const sale of sales) {
          if (abortRef.current) return freshCatalog;
          salesScanned++;

          for (let page = 1; page <= MAX_PAGES_PER_SALE; page++) {
            if (abortRef.current) return freshCatalog;

            const cached = skipPageCache
              ? null
              : getCachedListingPage(sale.url, page, pageCaches);
            let urls: string[];
            let hasNext: boolean;
            let pageFees: boolean | undefined;
            let pagePreviews: Partial<VehicleData>[] | undefined;

            if (cached) {
              urls = cached.urls;
              hasNext = cached.hasNext;
              pageFees = cached.feesIncluded;
              pagesSkipped++;
            } else {
              const { data } = await fetchJson<{
                urls?: string[];
                previews?: Partial<VehicleData>[];
                hasNext?: boolean;
                feesIncluded?: boolean;
                error?: string;
              }>(
                `/api/catalog/discover-page?saleUrl=${encodeURIComponent(sale.url)}&page=${page}&maxDays=${maxDaysUntilAuction}`,
                undefined,
                75_000
              );
              urls = data.urls ?? [];
              pagePreviews = data.previews;
              hasNext = Boolean(data.hasNext);
              pageFees =
                page === 1 && typeof data.feesIncluded === "boolean"
                  ? data.feesIncluded
                  : undefined;
              pageCaches = setCachedListingPage(
                sale.url,
                page,
                urls,
                hasNext,
                pageCaches,
                pageFees
              );
              savePageCaches(pageCaches);
            }

            const saleFees =
              pageFees ??
              getCachedListingPage(sale.url, 1, pageCaches, Date.now())?.feesIncluded;

            pagesScanned++;
            const eligible = filterListingUrls(urls, pagePreviews);
            for (const u of eligible) {
              freshCatalog.add(u);
              if (saleFees !== undefined) urlSaleFees.set(u, saleFees);
            }

            updateProgress({
              pagesScanned,
              pagesSkipped,
              salesScanned,
              salesActive: sales.length,
              totalCatalog: freshCatalog.size,
              statusMessage: skipPageCache
                ? `Surveillance · vente ${salesScanned}/${sales.length} · p.${page} · ${freshCatalog.size} lots`
                : `Vente ${salesScanned}/${sales.length} · p.${page}${cached ? " (cache)" : ""} · ${buildStatus(freshCatalog.size)}${skippedPro + skippedBudget > 0 ? ` · −${skippedPro + skippedBudget} filtrés` : ""}`,
            });

            if (!hasNext || urls.length === 0) break;
          }
        }

        return freshCatalog;
      };

      const applyCatalog = (freshCatalog: Set<string>, treatAllAsFull: boolean) => {
        catalogUrlsRef.current = freshCatalog;
        seenUrls.clear();
        for (const url of freshCatalog) seenUrls.add(url);
        resetAnalyzeQueues();
        enqueueUrls([...freshCatalog], treatAllAsFull);
        updateProgress({ totalCatalog: freshCatalog.size });
      };

      const startAutonomousWatch = (sales: { url: string }[]) => {
        if (!autoWatchEnabled || abortRef.current) return;

        priceTimerRef.current = setInterval(() => {
          liveTickRef.current += 1;
          void runLivePriceRefresh();
          if (liveTickRef.current % 2 === 0) void runLiveDetailRefresh();
        }, LIVE_PRICE_INTERVAL_MS);

        watchTimerRef.current = setInterval(() => {
          void (async () => {
            if (abortRef.current || watchBusyRef.current) return;
            watchBusyRef.current = true;
            try {
              updateProgress({
                phase: "discovering",
                statusMessage: "Surveillance — recherche de nouveaux lots Alcopa…",
              });

              const freshCatalog = await discoverFromSales(sales, true);
              if (abortRef.current || freshCatalog.size === 0) return;

              applyCatalog(freshCatalog, false);
              updateProgress({ phase: "analyzing" });
              await waitForAllAnalyses();

              if (!abortRef.current) {
                const visible = allResultsRef.current.filter((r) =>
                  catalogUrlsRef.current.has(r.vehicle.url)
                );
                updateProgress({
                  phase: "watching",
                  analyzed: visible.length,
                  pagesScanned,
                  pagesSkipped,
                  salesScanned,
                  statusMessage: buildWatchStatus(),
                });
              }
            } finally {
              watchBusyRef.current = false;
            }
          })();
        }, WATCH_DISCOVERY_MS);

        updateProgress({
          phase: "watching",
          statusMessage: buildWatchStatus(),
        });
      };

      catalogUrlsRef.current = new Set();

      setProgress({
        phase: "discovering",
        totalCatalog: prior.length,
        pagesScanned: 0,
        pagesSkipped: 0,
        salesActive: 0,
        salesScanned: 0,
        analyzed: prior.length,
        fromCache: 0,
        priceRefreshed: 0,
        newAnalyzed: 0,
        failed: 0,
        skippedPro: 0,
        skippedBudget: 0,
        goodDeals: countGoodDeals(prior, false, undefined, loadAllLbcPrices()),
        statusMessage: forceFull
          ? "Scan complet — relecture Alcopa + ré-analyse…"
          : `Historique ${prior.length} véh. — découverte automatique des ventes…`,
        error: null,
      });

      try {
        const { ok: salesOk, data: salesData } = await fetchJson<{
          sales?: { url: string }[];
          error?: string;
          blocked?: boolean;
          totalOnCalendar?: number;
        }>(`/api/catalog/sales?maxDays=${maxDaysUntilAuction}`, undefined, 45_000);

        if (salesData.error) {
          throw new Error(salesData.error);
        }
        if (!salesOk) {
          throw new Error("Calendrier Alcopa inaccessible — réessayez dans quelques minutes.");
        }

        const sales: { url: string }[] = salesData.sales ?? [];

        if (sales.length === 0) {
          if (salesData.blocked) {
            throw new Error(
              salesData.error ??
                "Alcopa bloque le scan depuis Vercel. Lancez l'app en local (npm run start) ou sur un VPS."
            );
          }
          throw new Error(
            salesData.error ??
              `Aucune vente Alcopa ne se termine dans les ${maxDaysUntilAuction} prochain(s) jour(s)${salesData.totalOnCalendar ? ` (${salesData.totalOnCalendar} vente(s) plus loin sur le calendrier)` : ""}.`
          );
        }

        salesActive = sales.length;
        updateProgress({ salesActive });

        const freshCatalog = await discoverFromSales(sales, false);
        if (freshCatalog.size > 0) {
          applyCatalog(freshCatalog, forceFull);
        }

        if (seenUrls.size === 0 && prior.length === 0) {
          throw new Error("Aucun véhicule trouvé dans les ventes imminentes.");
        }

        updateProgress({
          phase: "analyzing",
          totalCatalog: seenUrls.size,
          statusMessage: buildStatus(seenUrls.size),
        });

        await waitForAllAnalyses();

        if (!abortRef.current) {
          await enrichTopWithCt();
          saveHistory(allResultsRef.current);
        }

        if (!abortRef.current) {
          const visible = allResultsRef.current.filter((r) =>
            catalogUrlsRef.current.has(r.vehicle.url)
          );
          if (autoWatchEnabled) {
            startAutonomousWatch(sales);
            updateProgress({
              phase: "watching",
              analyzed: visible.length,
              statusMessage: buildWatchStatus(),
            });
          } else {
            priceTimerRef.current = setInterval(() => {
              liveTickRef.current += 1;
              void runLivePriceRefresh();
              if (liveTickRef.current % 2 === 0) void runLiveDetailRefresh();
            }, LIVE_PRICE_INTERVAL_MS);
            updateProgress({
              phase: "done",
              analyzed: visible.length,
              statusMessage: `Terminé — ${statsRef.current.newAnalyzed} nouveaux · prix toutes les 45 s (surveillance catalogue désactivée)`,
            });
          }
        }
      } catch (err) {
        stopAutonomousLoops();
        if (!abortRef.current) {
          updateProgress({
            phase: "error",
            error: err instanceof Error ? err.message : "Erreur inconnue",
          });
        }
      }
    },
    [autoWatchEnabled, commitResults, maxDaysUntilAuction, stopAutonomousLoops]
  );

  const cancelScan = useCallback(() => {
    abortRef.current = true;
    stopAutonomousLoops();
    setProgress((p) => ({
      ...p,
      phase: "idle",
      statusMessage: "Surveillance arrêtée",
    }));
  }, [stopAutonomousLoops]);

  useEffect(() => {
    const rerankWithLbc = () => {
      const lbcPrices = loadAllLbcPrices();
      const catalog = catalogUrlsRef.current;
      const visible =
        catalog.size > 0
          ? allResultsRef.current.filter((r) => catalog.has(r.vehicle.url))
          : allResultsRef.current;
      setResults(rankDeals(visible, lbcPrices));
      setTopDeals(getTopDeals(visible, 20, undefined, lbcPrices));
      setProgress((p) => ({
        ...p,
        goodDeals: countGoodDeals(allResultsRef.current, false, undefined, lbcPrices),
      }));
    };
    window.addEventListener("alcopa-lbc-prices-updated", rerankWithLbc);
    return () => window.removeEventListener("alcopa-lbc-prices-updated", rerankWithLbc);
  }, []);

  return { progress, results, topDeals, latest, runScan, cancelScan };
}
