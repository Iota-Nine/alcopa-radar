import { computeNetMargin, FRAIS_ALCOPA_DEFAULT } from "./carte-grise";
import { estimateMaxBid } from "./pricing";
import type { VehicleData } from "@/types/vehicle";

export type MargeBase = "enchere_actuelle" | "plafond";

export interface MarginBreakdown {
  repairBudget: number;
  prixMaxConseille: number;
  /** Marge réelle : au prix Alcopa actuel si connu, sinon au plafond */
  margePotentielle: number;
  /** Marge si achat exactement au plafond (~objectif 1 200 € — ne pas comparer entre voitures) */
  margeAuPlafond: number;
  margeCalculeeSur: MargeBase;
}

export function computeMarginBreakdown(
  vehicle: VehicleData,
  estimationRevente: number,
  repairBudget: number,
  carteGrise: number,
  fraisAlcopa = FRAIS_ALCOPA_DEFAULT,
  prixMaxConseille?: number
): MarginBreakdown {
  const max =
    prixMaxConseille ??
    estimateMaxBid(estimationRevente, repairBudget, 1200, carteGrise, fraisAlcopa);

  const common = {
    estimationRevente,
    repairBudget,
    carteGrise,
    fraisAlcopa,
  };

  const margeAuPlafond = computeNetMargin({
    ...common,
    purchasePrice: max,
  });

  const hasBid = vehicle.price !== undefined && vehicle.price > 0;
  if (hasBid) {
    return {
      repairBudget,
      prixMaxConseille: max,
      margePotentielle: computeNetMargin({
        ...common,
        purchasePrice: vehicle.price!,
      }),
      margeAuPlafond,
      margeCalculeeSur: "enchere_actuelle",
    };
  }

  return {
    repairBudget,
    prixMaxConseille: max,
    margePotentielle: margeAuPlafond,
    margeAuPlafond,
    margeCalculeeSur: "plafond",
  };
}
