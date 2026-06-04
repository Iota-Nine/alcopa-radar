import { NextResponse } from "next/server";
import { fetchActiveSalesWithDeadline } from "@/lib/alcopa/scraper";

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const maxDays = parseInt(
      new URL(request.url).searchParams.get("maxDays") ?? "1",
      10
    );
    const sales = await fetchActiveSalesWithDeadline(
      Number.isFinite(maxDays) && maxDays > 0 ? maxDays : 1
    );
    return NextResponse.json({
      sales,
      count: sales.length,
      maxDays: Number.isFinite(maxDays) && maxDays > 0 ? maxDays : 1,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de charger le calendrier Alcopa";
    return NextResponse.json({ sales: [], count: 0, maxDays: 1, error: message });
  }
}
