import { NextResponse } from "next/server";
import { discoverSalePage } from "@/lib/alcopa/scraper";

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saleUrl = searchParams.get("saleUrl");
    const page = parseInt(searchParams.get("page") ?? "1", 10);

    if (!saleUrl?.includes("alcopa-auction")) {
      return NextResponse.json({ error: "saleUrl requis" }, { status: 400 });
    }

    if (!saleUrl.includes("alcopa-auction.fr")) {
      return NextResponse.json({ error: "URL invalide" }, { status: 400 });
    }

    const maxDays = parseInt(searchParams.get("maxDays") ?? "1", 10);
    const { urls, hasNext, feesIncluded, previews } = await discoverSalePage(
      saleUrl,
      page,
      Number.isFinite(maxDays) && maxDays > 0 ? maxDays : 1
    );
    return NextResponse.json({
      urls,
      hasNext,
      feesIncluded,
      previews,
      page,
      count: urls.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur page vente";
    return NextResponse.json({ urls: [], hasNext: false, error: message });
  }
}
