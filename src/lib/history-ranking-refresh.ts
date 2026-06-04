import { getGoodDeals, getProfitableDeals } from "@/lib/deals";
import type { ScoredVehicle } from "@/types/vehicle";

/** Mise à jour auto des pages Bonnes affaires & Top 10 */
export const RANKING_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

const ANALYZE_BATCH = 15;
/** Pool élargi autour du Top 10 pour un classement stable */
const TOP_BY_SCORE = 60;
const MAX_VEHICLES_PER_RUN = 120;

export const RANKING_REFRESH_LAST_KEY = "alcopa-ranking-refresh-at";
export const RANKING_REFRESH_STATUS_EVENT = "alcopa-ranking-refresh-status";

export type RankingRefreshPhase = "idle" | "running" | "done" | "error";

export interface RankingRefreshStatus {
  phase: RankingRefreshPhase;
  lastAt: number | null;
  done: number;
  total: number;
  message: string;
}

/** Véhicules à ré-analyser : Top scores + bonnes affaires + potentiel rentable. */
export function selectVehiclesForRankingRefresh(
  history: ScoredVehicle[]
): ScoredVehicle[] {
  if (history.length === 0) return [];

  const map = new Map<string, ScoredVehicle>();

  const byScore = [...history].sort(
    (a, b) => b.analysis.scoreGlobal - a.analysis.scoreGlobal
  );
  for (const item of byScore.slice(0, TOP_BY_SCORE)) {
    map.set(item.vehicle.url, item);
  }

  for (const item of getGoodDeals(history, { applyBudget: false })) {
    map.set(item.vehicle.url, item);
  }

  for (const item of getProfitableDeals(history)) {
    map.set(item.vehicle.url, item);
    if (map.size >= MAX_VEHICLES_PER_RUN) break;
  }

  return [...map.values()].slice(0, MAX_VEHICLES_PER_RUN);
}

function emitStatus(status: RankingRefreshStatus): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(RANKING_REFRESH_STATUS_EVENT, { detail: status })
  );
}

export function readLastRankingRefreshAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RANKING_REFRESH_LAST_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastRankingRefreshAt(ts: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RANKING_REFRESH_LAST_KEY, String(ts));
}

let refreshInFlight: Promise<RankingRefreshStatus> | null = null;

type SaveResultsFn = (items: ScoredVehicle[]) => void;

let schedulerSubscribers = 0;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let schedulerInitial: ReturnType<typeof setTimeout> | null = null;
let schedulerSave: SaveResultsFn | null = null;

const SCHEDULER_INITIAL_MS = 4_000;

function stopRankingScheduler(): void {
  if (schedulerInitial) {
    clearTimeout(schedulerInitial);
    schedulerInitial = null;
  }
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

function tickRankingScheduler(): void {
  if (!schedulerSave || typeof window === "undefined") return;
  void import("@/lib/storage/scan-cache").then(({ loadHistory }) => {
    const items = loadHistory();
    if (items.length === 0) return;
    void runRankingHistoryRefresh(items, schedulerSave!);
  });
}

/** Un seul timer partagé (Bonnes affaires + Top 10). */
export function subscribeRankingAutoRefresh(saveResults: SaveResultsFn): () => void {
  schedulerSubscribers += 1;
  schedulerSave = saveResults;

  if (schedulerSubscribers === 1) {
    schedulerInitial = setTimeout(tickRankingScheduler, SCHEDULER_INITIAL_MS);
    schedulerTimer = setInterval(tickRankingScheduler, RANKING_REFRESH_INTERVAL_MS);
  }

  return () => {
    schedulerSubscribers = Math.max(0, schedulerSubscribers - 1);
    if (schedulerSubscribers === 0) {
      stopRankingScheduler();
      schedulerSave = null;
    }
  };
}

/**
 * Re-scrape + analyse complète (prix, CT, marge, CG, risques moteur).
 * Une seule exécution à la fois (partagée entre Bonnes affaires et Top 10).
 */
export async function runRankingHistoryRefresh(
  history: ScoredVehicle[],
  saveResults: (items: ScoredVehicle[]) => void
): Promise<RankingRefreshStatus> {
  if (refreshInFlight) return refreshInFlight;

  const targets = selectVehiclesForRankingRefresh(history);
  if (targets.length === 0) {
    const idle: RankingRefreshStatus = {
      phase: "idle",
      lastAt: readLastRankingRefreshAt(),
      done: 0,
      total: 0,
      message: "Aucun véhicule en historique",
    };
    emitStatus(idle);
    return idle;
  }

  const urls = targets.map((t) => t.vehicle.url);

  refreshInFlight = (async () => {
    let done = 0;
    const running: RankingRefreshStatus = {
      phase: "running",
      lastAt: readLastRankingRefreshAt(),
      done: 0,
      total: urls.length,
      message: `Mise à jour 0/${urls.length} fiches…`,
    };
    emitStatus(running);

    try {
      for (let i = 0; i < urls.length; i += ANALYZE_BATCH) {
        const batch = urls.slice(i, i + ANALYZE_BATCH);
        const res = await fetch("/api/catalog/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: batch }),
        });
        const data = (await res.json()) as {
          results?: ScoredVehicle[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Erreur analyse");
        }
        if (data.results?.length) {
          saveResults(data.results);
        }
        done = Math.min(i + batch.length, urls.length);
        const progress: RankingRefreshStatus = {
          phase: "running",
          lastAt: readLastRankingRefreshAt(),
          done,
          total: urls.length,
          message: `Mise à jour ${done}/${urls.length} fiches…`,
        };
        emitStatus(progress);
      }

      const now = Date.now();
      writeLastRankingRefreshAt(now);
      const doneStatus: RankingRefreshStatus = {
        phase: "done",
        lastAt: now,
        done: urls.length,
        total: urls.length,
        message: `${urls.length} fiche(s) mises à jour`,
      };
      emitStatus(doneStatus);
      return doneStatus;
    } catch (e) {
      const err: RankingRefreshStatus = {
        phase: "error",
        lastAt: readLastRankingRefreshAt(),
        done,
        total: urls.length,
        message: e instanceof Error ? e.message : "Échec mise à jour",
      };
      emitStatus(err);
      return err;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function formatNextRefreshIn(lastAt: number | null, now = Date.now()): string {
  if (!lastAt) return "prochaine mise à jour sous 30 min";
  const next = lastAt + RANKING_REFRESH_INTERVAL_MS;
  const ms = next - now;
  if (ms <= 0) return "mise à jour imminente";
  const min = Math.ceil(ms / 60_000);
  return `prochaine dans ${min} min`;
}
