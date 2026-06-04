import { NextResponse } from "next/server";
import { analyzeVehicleUrls } from "@/lib/alcopa/scraper";
import { vehicleForCarteGrise } from "@/lib/expert/carte-grise";
import { analyzeVehicle } from "@/lib/expert/engine";
import {
  analyzeBatchSize,
  analyzeConcurrency,
  isVercel,
  skipCtOnServer,
} from "@/lib/runtime/deploy-env";
import type { ScoredVehicle } from "@/types/vehicle";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const urls = body.urls as string[];
    const saleFeesByUrl = body.saleFeesByUrl as Record<string, boolean> | undefined;
    const maxBatch = analyzeBatchSize();

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "Liste d'URLs requise" }, { status: 400 });
    }

    if (urls.length > maxBatch) {
      return NextResponse.json(
        { error: `Maximum ${maxBatch} véhicules par lot${isVercel() ? " (mode Vercel)" : ""}` },
        { status: 400 }
      );
    }

    const skipCtPdf = skipCtOnServer() ? true : body.skipCtPdf !== false;

    const vehicles = await analyzeVehicleUrls(urls, analyzeConcurrency(), saleFeesByUrl, {
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
