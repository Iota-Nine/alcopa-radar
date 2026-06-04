import { NextResponse } from "next/server";
import { discoverRecherchePage } from "@/lib/alcopa/scraper";

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const page = parseInt(new URL(request.url).searchParams.get("page") ?? "1", 10);
    const result = await discoverRecherchePage(page);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur recherche";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
