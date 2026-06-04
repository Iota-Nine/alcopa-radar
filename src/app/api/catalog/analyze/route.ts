import { NextResponse } from "next/server";
import { analyzeVehicleUrls } from "@/lib/alcopa/scraper";
import { vehicleForCarteGrise } from "@/lib/expert/carte-grise";
import { analyzeVehicle } from "@/lib/expert/engine";
import type { ScoredVehicle } from "@/types/vehicle";

export const maxDuration = 300;

const MAX_BATCH = 20;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const urls = body.urls as string[];
    const saleFeesByUrl = body.saleFeesByUrl as Record<string, boolean> | undefined;

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "Liste d'URLs requise" }, { status: 400 });
    }

    if (urls.length > MAX_BATCH) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BATCH} véhicules par lot` },
        { status: 400 }
      );
    }

    const skipCtPdf = body.skipCtPdf !== false;

    const vehicles = await analyzeVehicleUrls(urls, 6, saleFeesByUrl, {
      skipCtPdf,
    });
    const results: ScoredVehicle[] = vehicles.map((raw) => {
      const vehicle = vehicleForCarteGrise(raw);
      return {
        vehicle,
        analysis: analyzeVehicle(vehicle),
        scannedAt: new Date().toISOString(),
      };
    });

    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur analyse";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
