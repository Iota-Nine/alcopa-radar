import { NextResponse } from "next/server";
import { fetchActiveSalesWithDeadline } from "@/lib/alcopa/scraper";
import { isVercel } from "@/lib/runtime/deploy-env";

export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const maxDays = parseInt(
      new URL(request.url).searchParams.get("maxDays") ?? "1",
      10
    );
    const days = Number.isFinite(maxDays) && maxDays > 0 ? maxDays : 1;
    const result = await fetchActiveSalesWithDeadline(days);

    if (result.sales.length === 0 && result.error) {
      return NextResponse.json({
        sales: [],
        count: 0,
        maxDays: days,
        totalOnCalendar: result.totalOnCalendar,
        blocked: result.blocked,
        host: isVercel() ? "vercel" : "local",
        error: result.error,
      });
    }

    return NextResponse.json({
      sales: result.sales,
      count: result.sales.length,
      maxDays: days,
      totalOnCalendar: result.totalOnCalendar,
      blocked: false,
      host: isVercel() ? "vercel" : "local",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de charger le calendrier Alcopa";
    return NextResponse.json({
      sales: [],
      count: 0,
      maxDays: 1,
      blocked: true,
      error: message,
    });
  }
}
