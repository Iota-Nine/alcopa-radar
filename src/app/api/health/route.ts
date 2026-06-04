import { NextResponse } from "next/server";
import { fetchActiveSalesWithDeadline } from "@/lib/alcopa/scraper";
import { isVercel } from "@/lib/runtime/deploy-env";

export const maxDuration = 25;

export async function GET() {
  const started = Date.now();
  let alcopaOk = false;
  let salesCount = 0;
  let alcopaError: string | null = null;

  try {
    const sales = await fetchActiveSalesWithDeadline(1);
    salesCount = sales.length;
    alcopaOk = sales.length > 0;
    if (!alcopaOk) {
      alcopaError =
        "Calendrier Alcopa vide ou inaccessible (captcha / blocage IP cloud fréquent sur Vercel).";
    }
  } catch (err) {
    alcopaError = err instanceof Error ? err.message : "Erreur Alcopa";
  }

  return NextResponse.json({
    ok: alcopaOk,
    host: isVercel() ? "vercel" : "local",
    salesCount,
    alcopaError,
    latencyMs: Date.now() - started,
    hint: isVercel()
      ? "Sur Vercel, le scan masse est limité. Utilisez « Analyser un lien » ou lancez l’app en local pour le radar complet."
      : null,
  });
}
