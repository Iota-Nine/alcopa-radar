import { NextResponse } from "next/server";
import { fetchActiveSalesWithDeadline } from "@/lib/alcopa/scraper";
import { isVercel } from "@/lib/runtime/deploy-env";

export const maxDuration = 25;

export async function GET() {
  const started = Date.now();
  const result = await fetchActiveSalesWithDeadline(2);

  return NextResponse.json({
    ok: result.sales.length > 0,
    host: isVercel() ? "vercel" : "local",
    salesCount: result.sales.length,
    totalOnCalendar: result.totalOnCalendar,
    blocked: result.blocked,
    alcopaError: result.error ?? null,
    latencyMs: Date.now() - started,
    hint: result.blocked
      ? "Alcopa bloque les IP cloud (Vercel). Utilisez npm run start sur votre PC pour le scan complet."
      : result.sales.length === 0
        ? "Élargissez le filtre « jours max » ou réessayez plus tard."
        : null,
  });
}
