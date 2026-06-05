"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Link2, Radar, RefreshCw, Search, Square } from "lucide-react";
import { AnalysisResult } from "@/components/AnalysisResult";
import { BudgetFilter } from "@/components/BudgetFilter";
import { DeployHostBanner } from "@/components/DeployHostBanner";
import { DealCard } from "@/components/DealCard";
import { LiveFeed } from "@/components/LiveFeed";
import { getGoodDeals, getLiveRanking } from "@/lib/deals";
import Link from "next/link";
import { applyDisplayFilters } from "@/lib/filters";
import { useAutoScan } from "@/hooks/useAutoScan";
import { useLbcPriceStore } from "@/hooks/useLbcPriceStore";
import { normalizeAlcopaUrl } from "@/lib/alcopa/url-resolver";
import { useAlertConfig, useScanHistory } from "@/lib/storage/client";
import type { ScoredVehicle } from "@/types/vehicle";

export default function RadarPage() {
  const { config, updateConfig } = useAlertConfig();
  const { progress, results, latest, runScan, cancelScan } = useAutoScan(
    config.maxDaysUntilAuction,
    config.autoWatchEnabled,
    {
      priceFilterEnabled: config.priceFilterEnabled,
      budgetMin: config.budgetMin,
      budgetMax: config.budgetMax,
      particulierOnly: config.particulierOnly,
      vehicleCategory: config.vehicleCategory,
    }
  );
  const { saveResults } = useScanHistory();
  const lbcPrices = useLbcPriceStore();
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlList, setUrlList] = useState<ScoredVehicle[]>([]);

  // Scan marché : uniquement sur clic (évite chargement infini au démarrage)

  const isRunning =
    progress.phase === "discovering" || progress.phase === "analyzing";
  const isWatching = progress.phase === "watching" || progress.phase === "done";
  const pct =
    progress.totalCatalog > 0 && progress.analyzed > 0
      ? Math.round((progress.analyzed / progress.totalCatalog) * 100)
      : progress.analyzed > 0
        ? Math.min(95, Math.round(progress.analyzed / 5))
        : progress.totalCatalog > 0
          ? 12
          : progress.phase === "discovering"
            ? 4
            : 0;

  const filteredResults = useMemo(
    () => applyDisplayFilters(results, config),
    [results, config]
  );
  const filteredLatest = useMemo(
    () => applyDisplayFilters(latest, config),
    [latest, config]
  );
  const liveRanking = useMemo(
    () => getLiveRanking(filteredResults, 12),
    [filteredResults]
  );
  const filteredTopDeals = useMemo(
    () =>
      getGoodDeals(filteredResults, { applyBudget: config.priceFilterEnabled, config }, lbcPrices).slice(
        0,
        5
      ),
    [filteredResults, config, lbcPrices]
  );
  const showRanking = liveRanking.length > 0;
  const showTopAffaires = filteredTopDeals.length > 0;

  const handleUrlScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = urlInput.trim();
    if (!raw) return;

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeAlcopaUrl(raw);
    } catch {
      setUrlError(
        "Lien non reconnu. Utilisez une fiche véhicule Alcopa (avec https:// ou sans)."
      );
      return;
    }

    setUrlLoading(true);
    setUrlError(null);
    setUrlList([]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 240_000);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");

      const list: ScoredVehicle[] = data.results ?? [];
      if (list.length === 0) {
        throw new Error("Aucun véhicule analysé sur cette page.");
      }
      setUrlList(list);
      saveResults(list);
      setUrlInput(normalizedUrl);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setUrlError("Délai dépassé (4 min). Essayez une fiche véhicule seule, pas une grande liste.");
      } else {
        setUrlError(err instanceof Error ? err.message : "Erreur");
      }
    } finally {
      clearTimeout(timeout);
      setUrlLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <DeployHostBanner />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Radar className="w-7 h-7 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Alcopa Radar</h1>
          </div>
          <p className="text-slate-400 text-sm max-w-lg">
            Découverte des ventes imminentes (≤ {config.maxDaysUntilAuction} jour
            {config.maxDaysUntilAuction > 1 ? "s" : ""}), analyse progressive. Utilisez{" "}
            <strong className="text-slate-300">Scanner ventes imminentes</strong> pour tout
            recharger depuis Alcopa.
          </p>
          {progress.phase === "idle" && !isRunning && (
            <p className="text-slate-500 text-xs mt-2">
              Cliquez sur <strong className="text-slate-400">Scanner ventes imminentes</strong> pour
              lancer le marché Alcopa (plusieurs minutes).
            </p>
          )}
          {isWatching && !isRunning && (
            <p className="text-emerald-400/90 text-xs mt-2 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Surveillance Alcopa active
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {isRunning ? (
            <button
              type="button"
              onClick={cancelScan}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm"
            >
              <Square className="w-4 h-4" />
              Arrêter
            </button>
          ) : (
            <button
              type="button"
              onClick={() => runScan({ forceFull: true })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Scanner ventes imminentes
            </button>
          )}
        </div>
      </div>

      <BudgetFilter
        config={config}
        onChange={updateConfig}
        matchedCount={filteredResults.length}
        totalCount={results.length}
      />

      <div className="mb-8 glass-panel rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-white text-sm">Scanner un lien (optionnel)</h2>
        </div>
        <form onSubmit={handleUrlScan} className="flex gap-2" noValidate>
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="www.alcopa-auction.fr/voiture-occasion/... ou lien complet"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={urlLoading || !urlInput.trim()}
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shrink-0"
          >
            {urlLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Analyser
          </button>
        </form>
        {urlLoading && (
          <p className="text-slate-400 text-sm mt-3">
            Lecture Alcopa en cours… (fiche : ~10 s · grande liste : plusieurs minutes)
          </p>
        )}
        {urlError && <p className="text-red-400 text-sm mt-3">{urlError}</p>}
        {urlList.length > 0 && (
          <div className="mt-4 border-t border-slate-800 pt-4 space-y-4">
            <p className="text-xs text-slate-500">
              {urlList.length} véhicule{urlList.length > 1 ? "s" : ""} — cases réparations /
              CT mémorisées par fiche
            </p>
            {urlList.length === 1 ? (
              <AnalysisResult item={urlList[0]} />
            ) : (
              <div className="space-y-3">
                {urlList.map((item, i) => (
                  <DealCard
                    key={item.vehicle.url}
                    rank={i + 1}
                    item={item}
                    expanded
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {(isRunning ||
        progress.phase === "done" ||
        progress.phase === "watching" ||
        progress.phase === "error") && (
        <div className="mb-6 glass-panel rounded-2xl p-5">
          <p className="text-sm text-slate-300 mb-2">{progress.statusMessage}</p>
          <div className="h-2.5 bg-slate-800/80 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isRunning ? "progress-shimmer" : "bg-blue-500"
              }`}
              style={{ width: `${Math.max(pct, isRunning ? 3 : 100)}%` }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 text-center text-sm">
            <div>
              <p className="text-lg font-bold text-white">{progress.salesActive || "—"}</p>
              <p className="text-xs text-slate-500">Ventes ≤ J+{config.maxDaysUntilAuction}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">
                {progress.totalCatalog.toLocaleString("fr-FR")}
              </p>
              <p className="text-xs text-slate-500">Lots trouvés</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">
                {progress.pagesScanned}
                {progress.pagesSkipped > 0 && (
                  <span className="text-sm text-slate-500"> ({progress.pagesSkipped} cache)</span>
                )}
              </p>
              <p className="text-xs text-slate-500">Pages listing</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-400">{progress.newAnalyzed}</p>
              <p className="text-xs text-slate-500">Nouveaux</p>
            </div>
            <div>
              <p className="text-lg font-bold text-cyan-400">{progress.priceRefreshed}</p>
              <p className="text-xs text-slate-500">Prix MAJ</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-400">{progress.fromCache}</p>
              <p className="text-xs text-slate-500">Historique</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-400">
                {progress.analyzed.toLocaleString("fr-FR")}
              </p>
              <p className="text-xs text-slate-500">Au classement</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-400">{progress.failed}</p>
              <p className="text-xs text-slate-500">Échecs</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-400">{progress.goodDeals}</p>
              <p className="text-xs text-slate-500">Bonnes affaires</p>
            </div>
            {(progress.skippedPro > 0 || progress.skippedBudget > 0) && (
              <div className="col-span-2 sm:col-span-4 lg:col-span-5 text-xs text-slate-500 pt-1 border-t border-slate-800/80 mt-1">
                Pré-filtrés listing :{" "}
                {progress.skippedPro > 0 && (
                  <span className="text-slate-400">{progress.skippedPro} pro/utilitaire</span>
                )}
                {progress.skippedPro > 0 && progress.skippedBudget > 0 && " · "}
                {progress.skippedBudget > 0 && (
                  <span className="text-slate-400">{progress.skippedBudget} hors budget</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {progress.error && (
        <div className="mb-6 p-4 bg-red-950/50 border border-red-800 rounded-xl text-red-300 text-sm">
          {progress.error}
        </div>
      )}

      {/* Flux en direct — dès les premières analyses */}
      {isRunning && filteredLatest.length > 0 && (
        <LiveFeed items={filteredLatest} title="Derniers véhicules dans votre budget" />
      )}

      {isRunning &&
        config.priceFilterEnabled &&
        latest.length > 0 &&
        filteredLatest.length === 0 && (
          <p className="mb-6 text-sm text-slate-500">
            Analyses en cours — aucun véhicule sous {config.budgetMax.toLocaleString("fr-FR")} €
            pour l&apos;instant.
          </p>
        )}

      {isRunning && !showRanking && progress.totalCatalog > 0 && progress.analyzed === 0 && (
        <div className="mb-6 p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2 text-blue-400" />
          {progress.totalCatalog} véhicule(s) détecté(s) — première analyse en cours…
        </div>
      )}

      {/* Classement live — tous les scores, pas seulement « bonnes affaires » */}
      {showRanking && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-white mb-1">
            {isRunning ? "Classement en direct" : "Classement"}
            <span className="text-sm font-normal text-slate-500 ml-2">
              ({filteredResults.length}
              {config.priceFilterEnabled && results.length !== filteredResults.length
                ? ` / ${results.length}`
                : ""}{" "}
              véhicule{filteredResults.length > 1 ? "s" : ""})
            </span>
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            {config.priceFilterEnabled
              ? `Mise à prix entre ${config.budgetMin > 0 ? `${config.budgetMin.toLocaleString("fr-FR")} € et ` : ""}${config.budgetMax.toLocaleString("fr-FR")} € max.`
              : "Mis à jour après chaque lot analysé."}
          </p>
          <div className="space-y-2">
            {liveRanking.map((item, i) => (
              <DealCard
                key={item.vehicle.url}
                rank={i + 1}
                item={item}
                expanded={expandedUrl === item.vehicle.url}
                onToggle={() =>
                  setExpandedUrl((u) => (u === item.vehicle.url ? null : item.vehicle.url))
                }
              />
            ))}
          </div>
        </section>
      )}

      {showTopAffaires && (
        <section className="mb-10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-emerald-400">Bonnes affaires</h2>
              <p className="text-xs text-slate-500">
                Marge nette ≥ 600 € · bénéfice direct estimé
              </p>
            </div>
            <Link
              href="/bonnes-affaires"
              className="text-sm text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
            >
              Voir tout →
            </Link>
          </div>
          <div className="space-y-3">
            {filteredTopDeals.map((item, i) => (
              <DealCard
                key={`deal-${item.vehicle.url}`}
                rank={i + 1}
                item={item}
                expanded={expandedUrl === item.vehicle.url}
                onToggle={() =>
                  setExpandedUrl((u) => (u === item.vehicle.url ? null : item.vehicle.url))
                }
              />
            ))}
          </div>
        </section>
      )}

      {progress.phase === "done" && !showRanking && (
        <p className="text-center text-slate-500 py-8">
          {results.length > 0 && config.priceFilterEnabled
            ? `Aucun véhicule dans votre budget (${config.budgetMin > 0 ? `${config.budgetMin.toLocaleString("fr-FR")}–` : ""}${config.budgetMax.toLocaleString("fr-FR")} €). Désactivez le filtre ou élargissez la fourchette.`
            : "Aucun résultat sur ce scan."}
        </p>
      )}
    </div>
  );
}
