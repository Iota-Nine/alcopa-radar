export interface VehicleDamage {
  zone: string;
  type: string;
  label: string;
}

export interface VehicleData {
  id?: string;
  url: string;
  title: string;
  brand: string;
  model: string;
  trim?: string;
  lotNumber?: string;
  price?: number;
  mileage?: number;
  year?: number;
  firstRegistration?: string;
  fuel?: string;
  gearbox?: string;
  location?: string;
  /** CO₂ g/km (fiche Alcopa) */
  co2?: number;
  /** Cylindrée cm³ */
  cylindree?: number;
  /** Puissance kW si connue */
  powerKw?: number;
  /** Type Alcopa (ex. TOURISME, UTILITAIRE) */
  vehicleType?: string;
  /** Carrosserie (ex. VP, VU) */
  bodyType?: string;
  comments?: string;
  ctUrl?: string;
  ctNotes?: string;
  hasWarranty?: boolean;
  batteryHealth?: number;
  damages?: VehicleDamage[];
  photos?: string[];
  feesIncluded?: boolean;
}

export type RiskLevel = "Faible" | "Moyen" | "Elevé";
export type Verdict = "ACHETER" | "SURVEILLER" | "ÉVITER";

export type RepairCategory =
  | "ct_critique"
  | "ct_majeur"
  | "risque_modele"
  | "esthetique"
  | "commentaire";

export interface RepairEstimate {
  id: string;
  label: string;
  costMin: number;
  costMax: number;
  category: RepairCategory;
  /** Inclus dans marge / max enchère par défaut (uniquement CT majeur & critique) */
  countsInMarginDefault: boolean;
}

export interface VehicleAnalysis {
  scoreGlobal: number;
  risk: RiskLevel;
  fiabilite: number;
  revente: number;
  exportPotential: number;
  prixMaxConseille: number;
  /** Cote revente LBC calculée (heuristique, pas un scrape LBC). */
  estimationRevente: number;
  /** Marge nette au prix actuel, basée sur estimationRevente. */
  margePotentielle: number;
  /** Marge au prix LBC saisi (rempli côté client si présent). */
  margeReelle?: number;
  prixMaxConseilleReel?: number;
  reventeLbcManuelle?: number;
  /** Marge si achat au plafond d'enchère conseillé (~1 200 € cible — indicatif) */
  margeAuPlafond?: number;
  /** Sur quoi repose margePotentielle */
  margeCalculeeSur?: "enchere_actuelle" | "plafond";
  liquiditeScore?: number;
  joursReventeEstimes?: number;
  volumeMarche?: "Faible" | "Moyen" | "Élevé";
  prixMarcheEstime?: number;
  /** Carte grise estimée (barème type ANTS / service-public) */
  carteGriseEstimee?: number;
  chevauxFiscaux?: number;
  fraisAlcopa?: number;
  repairEstimates: RepairEstimate[];
  totalRepairMin: number;
  totalRepairMax: number;
  repairBudget: number;
  problemes: string[];
  verdict: Verdict;
  engineNotes: string;
  ctAnalysis: string;
}

export interface ScoredVehicle {
  vehicle: VehicleData;
  analysis: VehicleAnalysis;
  scannedAt: string;
}

import type { VehicleCategoryFilter } from "@/lib/filters/vehicle-category";

export type { VehicleCategoryFilter };

export interface AlertConfig {
  /** Prix minimum (mise à prix Alcopa), 0 = pas de plancher */
  budgetMin: number;
  /** Budget / prix max — n'afficher que les véhicules en dessous */
  budgetMax: number;
  /** Appliquer le filtre prix sur le radar et les listes */
  priceFilterEnabled: boolean;
  /** Scanner uniquement les ventes dont l'enchère finit dans N jour(s) (1 = sous 24 h) */
  maxDaysUntilAuction: number;
  /** Surveillance continue : nouveaux lots, prix et fiches sans clic */
  autoWatchEnabled: boolean;
  /** Exclure utilitaires / pro et non roulants */
  particulierOnly: boolean;
  /** Voitures, motos, ou les deux (scan + listes) */
  vehicleCategory: VehicleCategoryFilter;
  brands: string[];
  scoreMinimum: number;
  enabled: boolean;
}

export interface ProfitInput {
  prixAchat: number;
  carteGrise: number;
  fraisAlcopa: number;
  reparations: number;
  valeurMarche: number;
}
