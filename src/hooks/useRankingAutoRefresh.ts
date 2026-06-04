"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatNextRefreshIn,
  readLastRankingRefreshAt,
  RANKING_REFRESH_STATUS_EVENT,
  runRankingHistoryRefresh,
  subscribeRankingAutoRefresh,
  type RankingRefreshStatus,
} from "@/lib/history-ranking-refresh";
import { loadHistory } from "@/lib/storage/scan-cache";
import { useScanHistory } from "@/lib/storage/client";

export function useRankingAutoRefresh(enabled = true) {
  const { saveResults } = useScanHistory();
  const saveRef = useRef(saveResults);
  saveRef.current = saveResults;

  const [status, setStatus] = useState<RankingRefreshStatus>(() => ({
    phase: "idle",
    lastAt: readLastRankingRefreshAt(),
    done: 0,
    total: 0,
    message: "",
  }));

  useEffect(() => {
    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<RankingRefreshStatus>).detail;
      if (detail) setStatus(detail);
    };
    window.addEventListener(RANKING_REFRESH_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(RANKING_REFRESH_STATUS_EVENT, onStatus);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    return subscribeRankingAutoRefresh((items) => saveRef.current(items));
  }, [enabled]);

  const runRefresh = useCallback(async () => {
    const items = loadHistory();
    if (items.length === 0) return;
    await runRankingHistoryRefresh(items, saveResults);
  }, [saveResults]);

  const nextLabel = formatNextRefreshIn(status.lastAt);

  return {
    status,
    nextLabel,
    runRefresh,
    isRunning: status.phase === "running",
  };
}
