"use client";

import { SlidersHorizontal } from "lucide-react";
import { BUDGET_SLIDER_MAX, BUDGET_SLIDER_STEP } from "@/lib/storage/client";
import type { AlertConfig } from "@/types/vehicle";

interface Props {
  config: AlertConfig;
  onChange: (config: AlertConfig) => void;
  matchedCount?: number;
  totalCount?: number;
}

function clampBudget(min: number, max: number): { budgetMin: number; budgetMax: number } {
  let budgetMax = Math.min(BUDGET_SLIDER_MAX, Math.max(BUDGET_SLIDER_STEP, max));
  let budgetMin = Math.max(0, Math.min(budgetMax, min));
  if (budgetMin > budgetMax) budgetMin = budgetMax;
  return { budgetMin, budgetMax };
}

function formatEuro(n: number): string {
  return n.toLocaleString("fr-FR") + " €";
}

export function BudgetFilter({ config, onChange, matchedCount, totalCount }: Props) {
  const setRange = (min: number, max: number) => {
    onChange({ ...config, ...clampBudget(min, max) });
  };

  const sliderDisabled = !config.priceFilterEnabled;

  return (
    <div className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-white text-sm">Mon budget</h2>
        </div>
        {matchedCount !== undefined && totalCount !== undefined && config.priceFilterEnabled && (
          <p className="text-xs text-slate-500">
            <span className="text-blue-400 font-medium">{matchedCount}</span>
            {" / "}
            {totalCount} véhicule{totalCount > 1 ? "s" : ""} dans votre budget
          </p>
        )}
      </div>

      <label className="flex items-center gap-3 cursor-pointer mb-4">
        <input
          type="checkbox"
          checked={config.particulierOnly !== false}
          onChange={(e) =>
            onChange({ ...config, particulierOnly: e.target.checked })
          }
          className="w-4 h-4 rounded"
        />
        <span className="text-sm text-slate-300">
          Particulier uniquement — tourisme roulant (sans utilitaire / pro / non roulant)
        </span>
      </label>

      <label className="flex items-center gap-3 cursor-pointer mb-4">
        <input
          type="checkbox"
          checked={config.priceFilterEnabled}
          onChange={(e) => onChange({ ...config, priceFilterEnabled: e.target.checked })}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm text-slate-300">
          Afficher uniquement les véhicules dans ma fourchette de prix
        </span>
      </label>

      <div
        className={`space-y-6 transition-opacity ${
          config.priceFilterEnabled ? "opacity-100" : "opacity-40 pointer-events-none"
        }`}
      >
        <div>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <label className="text-xs text-slate-500">Budget max (mise à prix Alcopa)</label>
            <span className="text-lg font-bold text-blue-400 tabular-nums">
              {formatEuro(config.budgetMax)}
            </span>
          </div>
          <input
            type="range"
            min={BUDGET_SLIDER_STEP}
            max={BUDGET_SLIDER_MAX}
            step={BUDGET_SLIDER_STEP}
            value={config.budgetMax}
            disabled={sliderDisabled}
            onChange={(e) =>
              setRange(config.budgetMin, parseInt(e.target.value, 10))
            }
            className="w-full h-2 rounded-full appearance-none bg-slate-800 accent-blue-500 cursor-pointer disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>{formatEuro(BUDGET_SLIDER_STEP)}</span>
            <span>{formatEuro(BUDGET_SLIDER_MAX)}</span>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <label className="text-xs text-slate-500">Prix minimum (optionnel)</label>
            <span className="text-sm font-semibold text-slate-300 tabular-nums">
              {formatEuro(config.budgetMin)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={config.budgetMax}
            step={BUDGET_SLIDER_STEP}
            value={config.budgetMin}
            disabled={sliderDisabled}
            onChange={(e) =>
              setRange(parseInt(e.target.value, 10), config.budgetMax)
            }
            className="w-full h-2 rounded-full appearance-none bg-slate-800 accent-slate-400 cursor-pointer disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-400"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>0 €</span>
            <span>{formatEuro(config.budgetMax)}</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-slate-600 mb-1">Saisie précise min</label>
            <input
              type="number"
              min={0}
              max={config.budgetMax}
              step={BUDGET_SLIDER_STEP}
              value={config.budgetMin}
              onChange={(e) =>
                setRange(parseInt(e.target.value, 10) || 0, config.budgetMax)
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-600 mb-1">Saisie précise max</label>
            <input
              type="number"
              min={BUDGET_SLIDER_STEP}
              max={BUDGET_SLIDER_MAX}
              step={BUDGET_SLIDER_STEP}
              value={config.budgetMax}
              onChange={(e) =>
                setRange(config.budgetMin, parseInt(e.target.value, 10) || BUDGET_SLIDER_STEP)
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
        </div>
      </div>

      {config.priceFilterEnabled && config.budgetMax > 0 && (
        <p className="text-xs text-slate-500 mt-3">
          Mise à prix Alcopa entre{" "}
          {config.budgetMin > 0
            ? `${formatEuro(config.budgetMin)} et `
            : ""}
          {formatEuro(config.budgetMax)} maximum.
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-slate-800">
        <label className="block text-xs text-slate-500 mb-1.5">
          Enchères — scanner seulement si la vente finit dans…
        </label>
        <select
          value={config.maxDaysUntilAuction}
          onChange={(e) =>
            onChange({
              ...config,
              maxDaysUntilAuction: parseInt(e.target.value, 10) || 1,
            })
          }
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm"
        >
          <option value={1}>1 jour ou moins (pas J+5)</option>
          <option value={2}>2 jours max</option>
          <option value={3}>3 jours max</option>
        </select>
        <p className="text-xs text-slate-500 mt-2">
          Le radar lit le calendrier Alcopa et ignore les ventes qui se terminent dans plusieurs
          jours.
        </p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer mt-4">
        <input
          type="checkbox"
          checked={config.autoWatchEnabled}
          onChange={(e) =>
            onChange({ ...config, autoWatchEnabled: e.target.checked })
          }
          className="w-4 h-4 rounded"
        />
        <span className="text-sm text-slate-300">
          Surveillance autonome (nouveaux lots ~3 min, prix 45 s, fiches ~18 min)
        </span>
      </label>
      <p className="text-xs text-slate-500 mt-2 ml-7">
        Fonctionne tant que cette page reste ouverte. Les lots vendus disparaissent du radar ;
        les nouveaux sont analysés sans clic.
      </p>
    </div>
  );
}
