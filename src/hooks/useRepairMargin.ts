"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  effectiveFeesEuro,
  resolveFeesIncluded,
} from "@/lib/alcopa/alcopa-fees";
import {
  effectiveCarteGriseForMargin,
  estimateCarteGrise,
} from "@/lib/expert/carte-grise";
import {
  defaultIncludedRepairIds,
  normalizeRepairEstimates,
  recalculateDualMargins,
} from "@/lib/expert/repair-margin";
import { useLbcPrice } from "@/hooks/useLbcPriceStore";
import {
  loadCarteGriseInMarginChoice,
  resolveCarteGriseInMargin,
  saveCarteGriseInMarginChoice,
} from "@/lib/storage/cg-selection";
import { loadFeesChoice, saveFeesChoice } from "@/lib/storage/fees-selection";
import { loadRepairSelection, saveRepairSelection } from "@/lib/storage/repair-selection";
import type { VehicleAnalysis, VehicleData } from "@/types/vehicle";

export function useRepairMargin(vehicle: VehicleData, analysis: VehicleAnalysis) {
  const { lbcPrice, setLbcPrice, commitLbcPrice, hydrated: lbcHydrated } =
    useLbcPrice(vehicle.url);

  const detectedFees = vehicle.feesIncluded;

  const [feesIncluded, setFeesIncludedState] = useState(false);
  const [carteGriseInMargin, setCarteGriseInMarginState] = useState(true);

  const repairs = useMemo(
    () => normalizeRepairEstimates(analysis.repairEstimates),
    [analysis.repairEstimates]
  );

  const defaultIncluded = useMemo(
    () => defaultIncludedRepairIds(repairs),
    [repairs]
  );

  const [includedIds, setIncludedIds] = useState<Set<string>>(defaultIncluded);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const cached = loadRepairSelection(vehicle.url);
    if (cached !== null) {
      const valid = new Set(repairs.map((r) => r.id));
      setIncludedIds(new Set(cached.filter((id) => valid.has(id))));
    } else {
      setIncludedIds(defaultIncluded);
    }
    setHydrated(true);
  }, [vehicle.url, defaultIncluded, repairs]);

  useEffect(() => {
    const syncFees = () => {
      const cached = loadFeesChoice(vehicle.url);
      setFeesIncludedState(resolveFeesIncluded(detectedFees, cached));
    };
    syncFees();
    window.addEventListener("alcopa-fees-picks-updated", syncFees);
    return () => window.removeEventListener("alcopa-fees-picks-updated", syncFees);
  }, [vehicle.url, detectedFees]);

  useEffect(() => {
    const syncCg = () => {
      setCarteGriseInMarginState(
        resolveCarteGriseInMargin(loadCarteGriseInMarginChoice(vehicle.url))
      );
    };
    syncCg();
    window.addEventListener("alcopa-cg-picks-updated", syncCg);
    return () => window.removeEventListener("alcopa-cg-picks-updated", syncCg);
  }, [vehicle.url]);

  useEffect(() => {
    if (!hydrated) return;
    saveRepairSelection(vehicle.url, includedIds);
  }, [vehicle.url, includedIds, hydrated]);

  const setFeesIncluded = useCallback(
    (included: boolean) => {
      saveFeesChoice(vehicle.url, included);
      setFeesIncludedState(included);
    },
    [vehicle.url]
  );

  const fraisAlcopa = effectiveFeesEuro(vehicle, feesIncluded);

  const setCarteGriseInMargin = useCallback(
    (include: boolean) => {
      saveCarteGriseInMarginChoice(vehicle.url, include);
      setCarteGriseInMarginState(include);
    },
    [vehicle.url]
  );

  const carteGriseEstimate = useMemo(() => estimateCarteGrise(vehicle), [vehicle]);
  const carteGrise = carteGriseEstimate.total;
  const carteGriseEffective = effectiveCarteGriseForMargin(carteGrise, carteGriseInMargin);

  const feesCustomized =
    detectedFees !== undefined && feesIncluded !== detectedFees;

  const { repairBudget, estimated, real } = useMemo(
    () =>
      recalculateDualMargins(
        vehicle,
        analysis,
        includedIds,
        lbcPrice,
        fraisAlcopa,
        carteGriseEffective
      ),
    [vehicle, analysis, includedIds, lbcPrice, fraisAlcopa, carteGriseEffective]
  );

  const adjustedEst = useMemo(
    () => ({ ...estimated, repairBudget }),
    [estimated, repairBudget]
  );

  const adjustedReal = useMemo(
    () => (real ? { ...real, repairBudget } : null),
    [real, repairBudget]
  );

  const hasLbcPrice = lbcPrice !== null && lbcPrice > 0;

  const plafondRef =
    hasLbcPrice && adjustedReal ? adjustedReal.prixMaxConseille : adjustedEst.prixMaxConseille;

  const enchereAuDessusDuMax =
    vehicle.price !== undefined &&
    vehicle.price > 0 &&
    plafondRef > 0 &&
    vehicle.price > plafondRef;

  const enchereSousMax =
    vehicle.price !== undefined &&
    vehicle.price > 0 &&
    plafondRef > vehicle.price;

  const marginCustomized =
    repairBudget !== analysis.repairBudget ||
    estimated.margePotentielle !== analysis.margePotentielle ||
    fraisAlcopa !== (analysis.fraisAlcopa ?? 0) ||
    !carteGriseInMargin ||
    includedIds.size !== defaultIncluded.size ||
    [...includedIds].some((id) => !defaultIncluded.has(id)) ||
    [...defaultIncluded].some((id) => !includedIds.has(id));

  const toggleRepair = useCallback((id: string, checked: boolean) => {
    setIncludedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const resetRepairs = useCallback(() => {
    setIncludedIds(new Set(defaultIncluded));
  }, [defaultIncluded]);

  return {
    repairs,
    includedIds,
    adjustedEst,
    adjustedReal,
    enchereAuDessusDuMax,
    enchereSousMax,
    marginCustomized,
    toggleRepair,
    resetRepairs,
    hydrated,
    lbcPrice,
    setLbcPrice,
    commitLbcPrice,
    hasLbcPrice,
    lbcHydrated,
    feesIncluded,
    setFeesIncluded,
    detectedFees,
    feesCustomized,
    fraisAlcopa,
    carteGrise,
    carteGriseEffective,
    carteGriseEstimate,
    carteGriseInMargin,
    setCarteGriseInMargin,
  };
}
