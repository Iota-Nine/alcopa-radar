import { NextResponse } from "next/server";
import { scanAlcopaUrl } from "@/lib/alcopa/scraper";
import { normalizeAlcopaUrl } from "@/lib/alcopa/url-resolver";
import { vehicleForCarteGrise } from "@/lib/expert/carte-grise";
import { analyzeVehicle } from "@/lib/expert/engine";
import type { ScoredVehicle } from "@/types/vehicle";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    const maxVehicles = body.maxVehicles as number | undefined;

    if (!rawUrl) {
      return NextResponse.json(
        { error: "Collez une URL Alcopa (fiche véhicule ou page de vente)." },
        { status: 400 }
      );
    }

    let url: string;
    try {
      url = normalizeAlcopaUrl(rawUrl);
    } catch {
      return NextResponse.json(
        {
          error:
            "URL Alcopa invalide. Ex. : https://www.alcopa-auction.fr/voiture-occasion/marque/modele-123456",
        },
        { status: 400 }
      );
    }

    const scan = await scanAlcopaUrl(url, {
      maxVehicles: maxVehicles && maxVehicles > 0 ? maxVehicles : 0,
    });

    if (scan.vehicles.length === 0) {
      return NextResponse.json(
        {
          error:
            "Aucun véhicule trouvé sur cette page. Essayez une fiche véhicule ou une page /recherche avec des lots actifs.",
          totalFound: scan.totalFound ?? 0,
          pagesScanned: scan.pagesScanned ?? 0,
        },
        { status: 404 }
      );
    }

    const results: ScoredVehicle[] = scan.vehicles.map((raw) => {
      const vehicle = vehicleForCarteGrise(raw);
      return {
        vehicle,
        analysis: analyzeVehicle(vehicle),
        scannedAt: new Date().toISOString(),
      };
    });

    results.sort((a, b) => b.analysis.scoreGlobal - a.analysis.scoreGlobal);

    return NextResponse.json({
      results,
      count: results.length,
      totalFound: scan.totalFound,
      pagesScanned: scan.pagesScanned,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur lors du scan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
