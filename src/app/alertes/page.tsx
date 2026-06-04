"use client";

import { useState } from "react";
import { BudgetFilter } from "@/components/BudgetFilter";
import { useAlertConfig, useScanHistory, matchAlerts } from "@/lib/storage/client";

const ALL_BRANDS = [
  "Audi",
  "BMW",
  "Mercedes",
  "Toyota",
  "Volkswagen",
  "Peugeot",
  "Renault",
  "Ford",
  "Citroën",
  "Opel",
];

export default function AlertesPage() {
  const { config, updateConfig } = useAlertConfig();
  const { history } = useScanHistory();
  const [brands, setBrands] = useState<string[]>(config.brands);

  const matches = matchAlerts(history, { ...config, brands });

  const toggleBrand = (brand: string) => {
    const next = brands.includes(brand)
      ? brands.filter((b) => b !== brand)
      : [...brands, brand];
    setBrands(next);
    updateConfig({ ...config, brands: next });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">Alertes</h1>
      <p className="text-slate-400 text-sm mb-8">
        Définissez vos critères. Les véhicules scannés correspondants apparaissent ici et sur le
        scanner.
      </p>

      <BudgetFilter config={config} onChange={updateConfig} />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 mb-8">
        <div>
          <label className="block text-sm text-slate-400 mb-2">Score minimum (/10)</label>
          <input
            type="number"
            min={1}
            max={10}
            step={0.1}
            value={config.scoreMinimum}
            onChange={(e) =>
              updateConfig({ ...config, scoreMinimum: parseFloat(e.target.value) || 0 })
            }
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Marques</label>
          <div className="flex flex-wrap gap-2">
            {ALL_BRANDS.map((brand) => (
              <button
                key={brand}
                type="button"
                onClick={() => toggleBrand(brand)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  brands.includes(brand)
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => updateConfig({ ...config, enabled: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-slate-300">Alertes activées</span>
        </label>
      </div>

      <h2 className="text-lg font-semibold mb-4">
        Affaires correspondantes ({matches.length})
      </h2>

      {matches.length === 0 ? (
        <p className="text-slate-500 text-sm">
          Aucune affaire dans l&apos;historique ne correspond à vos critères.
        </p>
      ) : (
        <div className="space-y-3">
          {matches.map(({ vehicle, analysis }) => (
            <div
              key={vehicle.url}
              className="bg-emerald-950/30 border border-emerald-800 rounded-xl p-4"
            >
              <p className="font-semibold text-white">{vehicle.title}</p>
              <div className="grid sm:grid-cols-3 gap-2 mt-2 text-sm">
                <p className="text-slate-400">
                  Prix :{" "}
                  <span className="text-white">
                    {vehicle.price?.toLocaleString("fr-FR") ?? "—"} €
                  </span>
                </p>
                <p className="text-slate-400">
                  Max conseillé :{" "}
                  <span className="text-emerald-400">
                    {analysis.prixMaxConseille.toLocaleString("fr-FR")} €
                  </span>
                </p>
                <p className="text-slate-400">
                  Score : <span className="text-blue-400">{analysis.scoreGlobal}/10</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
