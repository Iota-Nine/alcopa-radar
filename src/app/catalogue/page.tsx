"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { List, Search } from "lucide-react";
import { DealCard } from "@/components/DealCard";
import { MotorFuelFilterBar } from "@/components/MotorFuelFilter";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { rankDeals } from "@/lib/deals";
import {
  countByMotorFuel,
  filterByMotorFuel,
  type MotorFuelFilter,
  vehicleFuelDisplayLabel,
} from "@/lib/filters/motor-fuel";
import { filterByBudget, filterByVehicleCategory, filterForParticulier } from "@/lib/filters";
import { searchCatalog } from "@/lib/search/catalog-search";
import { useLbcPriceStore } from "@/hooks/useLbcPriceStore";
import { useAlertConfig, useScanHistory } from "@/lib/storage/client";
import type { ScoredVehicle, Verdict } from "@/types/vehicle";

type SortKey = "recent" | "score" | "marge" | "title";

export default function CataloguePage() {
  const { history, refreshHistory } = useScanHistory();
  const { config } = useAlertConfig();
  const lbcPrices = useLbcPriceStore();
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "ALL">("ALL");
  const [onlyBudget, setOnlyBudget] = useState(false);
  const [motorFuel, setMotorFuel] = useState<MotorFuelFilter>("all");
  const debouncedSearch = useDebouncedValue(search.trim(), 280);

  const preFuelList = useMemo(() => {
    let list = filterForParticulier([...history], config.particulierOnly !== false);
    list = filterByVehicleCategory(list, config.vehicleCategory ?? "voiture");
    if (onlyBudget) list = filterByBudget(list, config);
    if (debouncedSearch) list = searchCatalog(list, debouncedSearch);
    if (verdictFilter !== "ALL") {
      list = list.filter((item) => item.analysis.verdict === verdictFilter);
    }

    switch (sort) {
      case "score":
        list.sort((a, b) => b.analysis.scoreGlobal - a.analysis.scoreGlobal);
        break;
      case "marge":
        list = rankDeals(list, lbcPrices);
        break;
      case "title":
        list.sort((a, b) => a.vehicle.title.localeCompare(b.vehicle.title, "fr"));
        break;
      case "recent":
      default:
        list.sort(
          (a, b) =>
            new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
        );
        break;
    }
    return list;
  }, [history, onlyBudget, config, debouncedSearch, verdictFilter, sort, lbcPrices]);

  const fuelCounts = useMemo(() => countByMotorFuel(preFuelList), [preFuelList]);

  const vehicles = useMemo(
    () => filterByMotorFuel(preFuelList, motorFuel),
    [preFuelList, motorFuel]
  );

  const isExpanded = (url: string) => expandAll || expandedUrl === url;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <List className="w-7 h-7 text-violet-400" />
            <h1 className="text-2xl font-bold text-white">Catalogue scanné</h1>
          </div>
          <button
            type="button"
            onClick={() => refreshHistory()}
            className="text-xs text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg"
          >
            Actualiser
          </button>
        </div>
        <p className="text-slate-400 text-sm max-w-xl">
          Tous les véhicules lus par le radar : CT, moteur, réparations, marge et liens Alcopa.
          La liste se remplit automatiquement pendant le scan.
        </p>
      </div>

      <div className="mb-6 p-4 glass-panel rounded-2xl space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher marque, modèle, CT, défauts, lieu…"
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-colors"
          />
        </div>
        {search.trim() !== debouncedSearch && (
          <p className="text-xs text-slate-500 pulse-soft">Recherche en cours…</p>
        )}

        <div className="flex flex-wrap gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
          >
            <option value="recent">Plus récents</option>
            <option value="score">Meilleur score</option>
            <option value="marge">Meilleure marge</option>
            <option value="title">Titre A → Z</option>
          </select>

          <select
            value={verdictFilter}
            onChange={(e) => setVerdictFilter(e.target.value as Verdict | "ALL")}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
          >
            <option value="ALL">Tous les verdicts</option>
            <option value="ACHETER">ACHETER</option>
            <option value="SURVEILLER">SURVEILLER</option>
            <option value="ÉVITER">ÉVITER</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setExpandAll((v) => !v);
              setExpandedUrl(null);
            }}
            className="text-sm px-3 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            {expandAll ? "Replier tout" : "Détails pour tous"}
          </button>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyBudget}
            onChange={(e) => setOnlyBudget(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-slate-300">
            Limiter à mon budget (≤ {config.budgetMax.toLocaleString("fr-FR")} €)
          </span>
        </label>

        <MotorFuelFilterBar
          value={motorFuel}
          onChange={setMotorFuel}
          counts={fuelCounts}
          compact
        />
      </div>

      {vehicles.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <p className="text-slate-400 mb-2">
            {history.length === 0
              ? "Aucun véhicule scanné pour l'instant."
              : "Aucun véhicule ne correspond à vos filtres."}
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Lancez le radar sur l&apos;accueil — chaque fiche analysée apparaît ici avec le CT et
            les détails.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500"
          >
            Ouvrir le radar
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500 mb-4">
            <span className="text-violet-400 font-semibold">{vehicles.length}</span>
            {vehicles.length > 1 ? " véhicules" : " véhicule"}
            {history.length !== vehicles.length && (
              <span className="text-slate-600">
                {" "}
                (sur {history.length} en mémoire)
              </span>
            )}
          </p>
          <div className="space-y-3">
            {vehicles.map((item, i) => {
              const fuel = vehicleFuelDisplayLabel(item.vehicle);
              return (
                <div key={item.vehicle.url}>
                  <p className="text-[11px] text-slate-600 mb-1 px-1">
                    Scanné le{" "}
                    {new Date(item.scannedAt).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    {item.vehicle.price
                      ? ` · ${item.vehicle.price.toLocaleString("fr-FR")} €`
                      : ""}
                    {fuel !== "—" ? ` · ${fuel}` : ""}
                    {item.vehicle.gearbox ? ` · ${item.vehicle.gearbox}` : ""}
                  </p>
                  <DealCard
                    rank={i + 1}
                    item={item}
                    expanded={isExpanded(item.vehicle.url)}
                    onToggle={() => {
                      if (expandAll) setExpandAll(false);
                      setExpandedUrl((u) =>
                        u === item.vehicle.url ? null : item.vehicle.url
                      );
                    }}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
