import { NextResponse } from "next/server";
import { scrapeVehiclePrices } from "@/lib/alcopa/scraper";
import { vehicleForCarteGrise } from "@/lib/expert/carte-grise";
import { analyzeVehicle } from "@/lib/expert/engine";
import type { ScoredVehicle, VehicleData } from "@/types/vehicle";

export const maxDuration = 120;

const MAX_BATCH = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cached = (body.cached ?? []) as ScoredVehicle[];

    if (!Array.isArray(cached) || cached.length === 0) {
      return NextResponse.json({ error: "cached requis" }, { status: 400 });
    }

    if (cached.length > MAX_BATCH) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BATCH} véhicules par lot` },
        { status: 400 }
      );
    }

    const urls = cached.map((c) => c.vehicle.url);
    const prices = await scrapeVehiclePrices(urls, 14);

    const results: ScoredVehicle[] = [];
    for (const item of cached) {
      const newPrice = prices.get(item.vehicle.url);
      const vehicle: VehicleData = vehicleForCarteGrise({
        ...item.vehicle,
        price:
          newPrice !== undefined && newPrice > 0 ? newPrice : item.vehicle.price,
      });
      const priceChanged =
        newPrice !== undefined &&
        newPrice > 0 &&
        newPrice !== item.vehicle.price;

      results.push({
        vehicle,
        analysis: priceChanged ? analyzeVehicle(vehicle) : item.analysis,
        scannedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur prix";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
