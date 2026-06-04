import { NextResponse } from "next/server";
import { discoverCatalogUrls } from "@/lib/alcopa/scraper";

export const maxDuration = 300;

export async function GET() {
  try {
    const { urls, totalFound, pagesScanned, salesScanned } = await discoverCatalogUrls();
    return NextResponse.json({
      urls,
      totalFound,
      pagesScanned,
      salesScanned,
      count: urls.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur découverte catalogue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
