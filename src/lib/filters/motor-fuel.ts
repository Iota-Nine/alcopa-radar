import {
  getMotorisationKind,
  isDieselFuel,
  type MotorisationKind,
} from "@/lib/expert/motorisation";
import type { ScoredVehicle, VehicleData } from "@/types/vehicle";

export type MotorFuelFilter = "all" | "essence" | "diesel";

export function vehicleMotorFuelKind(vehicle: VehicleData): MotorisationKind {
  return getMotorisationKind(vehicle.fuel, vehicle.trim ?? vehicle.title ?? "");
}

/** Essence ou gazole pour le filtre liste (hybrides rattachés au thermique). */
export function vehicleThermicFuelFilter(
  vehicle: VehicleData
): "essence" | "diesel" | null {
  const kind = vehicleMotorFuelKind(vehicle);
  const trim = vehicle.trim ?? vehicle.title ?? "";

  if (kind === "diesel") return "diesel";
  if (kind === "essence") return "essence";
  if (kind === "hybride" || kind === "hybride_rechargeable") {
    return isDieselFuel(vehicle.fuel, trim) ? "diesel" : "essence";
  }
  return null;
}

export function motorFuelFilterLabel(filter: MotorFuelFilter): string {
  switch (filter) {
    case "essence":
      return "Essence";
    case "diesel":
      return "Gazole";
    default:
      return "Tous";
  }
}

export function vehicleFuelDisplayLabel(vehicle: VehicleData): string {
  const kind = vehicleMotorFuelKind(vehicle);
  switch (kind) {
    case "diesel":
      return "Gazole";
    case "essence":
      return "Essence";
    case "electrique":
      return "Électrique";
    case "hybride_rechargeable":
      return "Hybride rechargeable";
    case "hybride":
      return "Hybride";
    default:
      return vehicle.fuel?.trim() || "—";
  }
}

export function filterByMotorFuel(
  items: ScoredVehicle[],
  filter: MotorFuelFilter
): ScoredVehicle[] {
  if (filter === "all") return items;
  return items.filter((item) => vehicleThermicFuelFilter(item.vehicle) === filter);
}

export function countByMotorFuel(items: ScoredVehicle[]): {
  all: number;
  essence: number;
  diesel: number;
} {
  let essence = 0;
  let diesel = 0;
  for (const item of items) {
    const f = vehicleThermicFuelFilter(item.vehicle);
    if (f === "essence") essence++;
    else if (f === "diesel") diesel++;
  }
  return { all: items.length, essence, diesel };
}
