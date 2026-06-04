"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadAllLbcPrices, loadLbcPrice, saveLbcPrice } from "@/lib/storage/lbc-price";

const SAVE_DEBOUNCE_MS = 600;

export function useLbcPriceStore() {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    setPrices(loadAllLbcPrices());
    const sync = () => setPrices(loadAllLbcPrices());
    window.addEventListener("alcopa-lbc-prices-updated", sync);
    return () => window.removeEventListener("alcopa-lbc-prices-updated", sync);
  }, []);

  return prices;
}

export function useLbcPrice(vehicleUrl: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPrice(loadLbcPrice(vehicleUrl));
    setHydrated(true);
  }, [vehicleUrl]);

  useEffect(() => {
    const sync = () => setPrice(loadLbcPrice(vehicleUrl));
    window.addEventListener("alcopa-lbc-prices-updated", sync);
    return () => window.removeEventListener("alcopa-lbc-prices-updated", sync);
  }, [vehicleUrl]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  const setLbcPrice = useCallback(
    (next: number | null) => {
      setPrice(next);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveLbcPrice(vehicleUrl, next);
        saveTimerRef.current = null;
      }, SAVE_DEBOUNCE_MS);
    },
    [vehicleUrl]
  );

  const commitLbcPrice = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveLbcPrice(vehicleUrl, price);
  }, [vehicleUrl, price]);

  return { lbcPrice: price, setLbcPrice, commitLbcPrice, hydrated };
}
