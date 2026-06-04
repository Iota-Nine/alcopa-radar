"use client";

import { useCallback, useEffect, useState } from "react";
import { filterByBudget, matchesPriceRange } from "@/lib/filters";
import { HISTORY_KEY, loadHistory, mergeByUrl, saveHistory } from "./scan-cache";
import { applyManualLbcMargin, effectiveEstimatedMarge } from "@/lib/expert/repair-margin";
import { loadLbcPrice } from "@/lib/storage/lbc-price";
import type { AlertConfig, ScoredVehicle } from "@/types/vehicle";

export const BUDGET_SLIDER_MAX = 30_000;
export const BUDGET_SLIDER_STEP = 500;

function normalizeAlertConfig(raw: Partial<AlertConfig>): AlertConfig {
  const budgetMax = Math.min(
    BUDGET_SLIDER_MAX,
    Math.max(BUDGET_SLIDER_STEP, raw.budgetMax ?? 6000)
  );
  const budgetMin = Math.min(
    budgetMax,
    Math.max(0, raw.budgetMin ?? 0)
  );
  return {
    budgetMin,
    budgetMax,
    priceFilterEnabled: raw.priceFilterEnabled ?? true,
    maxDaysUntilAuction: raw.maxDaysUntilAuction ?? 1,
    autoWatchEnabled: raw.autoWatchEnabled ?? true,
    particulierOnly: raw.particulierOnly ?? true,
    brands: raw.brands ?? ["Audi", "BMW", "Mercedes", "Toyota"],
    scoreMinimum: raw.scoreMinimum ?? 8,
    enabled: raw.enabled ?? true,
  };
}

const ALERTS_KEY = "alcopa-scanner-alerts";

export function useScanHistory() {
  const [history, setHistory] = useState<ScoredVehicle[]>([]);

  const refreshHistory = useCallback(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    refreshHistory();
    const onUpdate = () => refreshHistory();
    window.addEventListener("alcopa-history-updated", onUpdate);
    window.addEventListener("focus", onUpdate);
    return () => {
      window.removeEventListener("alcopa-history-updated", onUpdate);
      window.removeEventListener("focus", onUpdate);
    };
  }, [refreshHistory]);

  const saveResults = (results: ScoredVehicle[]) => {
    setHistory((prev) => {
      const merged = mergeByUrl(prev, results);
      saveHistory(merged);
      return merged;
    });
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem("alcopa-scan-pages");
    setHistory([]);
  };

  return { history, saveResults, clearHistory, refreshHistory };
}

export function useAlertConfig() {
  const defaultConfig: AlertConfig = normalizeAlertConfig({});

  const [config, setConfig] = useState<AlertConfig>(defaultConfig);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ALERTS_KEY);
      if (raw) setConfig(normalizeAlertConfig(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  const updateConfig = (next: AlertConfig) => {
    setConfig(next);
    localStorage.setItem(ALERTS_KEY, JSON.stringify(next));
  };

  return { config, updateConfig };
}

export function matchAlerts(results: ScoredVehicle[], config: AlertConfig): ScoredVehicle[] {
  if (!config.enabled) return [];

  return results.filter(({ vehicle, analysis }) => {
    const brandMatch = config.brands.some(
      (b) => vehicle.brand.toLowerCase().includes(b.toLowerCase())
    );
    const priceOk = matchesPriceRange(
      { vehicle, analysis, scannedAt: "" },
      config.budgetMin,
      config.budgetMax
    );
    const scoreOk = analysis.scoreGlobal >= config.scoreMinimum;
    const verdictOk = analysis.verdict !== "ÉVITER";
    const lbc = loadLbcPrice(vehicle.url);
    const scored = { vehicle, analysis, scannedAt: "" };
    const marge =
      lbc !== null
        ? applyManualLbcMargin(scored, lbc).analysis.margeReelle ?? effectiveEstimatedMarge(scored)
        : effectiveEstimatedMarge(scored);
    const marginOk = marge >= 500;

    return brandMatch && priceOk && scoreOk && marginOk && verdictOk;
  });
}
