"use client";

import { effectiveEstimatedMarge, effectiveMarginForRanking } from "@/lib/expert/repair-margin";
import { formatMarge } from "@/lib/format";
import { getListingPrice } from "@/lib/filters";
import { useLbcPriceStore } from "@/hooks/useLbcPriceStore";
import type { ScoredVehicle } from "@/types/vehicle";

const VERDICT_DOT = {
  ACHETER: "bg-emerald-500",
  SURVEILLER: "bg-amber-500",
  ÉVITER: "bg-red-500",
};

interface Props {
  items: ScoredVehicle[];
  title?: string;
  compact?: boolean;
}

export function LiveFeed({ items, title = "En direct", compact }: Props) {
  const lbcPrices = useLbcPriceStore();
  if (items.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-slate-400 mb-2 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
        {title}
      </h2>
      <div className={`space-y-2 ${compact ? "" : ""}`}>
        {items.map((item, i) => {
          const marge = effectiveMarginForRanking(item, lbcPrices);
          return (
          <div
            key={`${item.vehicle.url}-${i}`}
            className="live-item flex items-center gap-3 bg-slate-900/80 border border-slate-700/80 rounded-lg px-3 py-2.5"
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${VERDICT_DOT[item.analysis.verdict]}`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{item.vehicle.title}</p>
              <p className="text-xs text-slate-500">
                {getListingPrice(item)?.toLocaleString("fr-FR") ?? "—"} € · score{" "}
                {item.analysis.scoreGlobal} · marge est.{" "}
                {formatMarge(effectiveEstimatedMarge(item), { label: false })}
                {lbcPrices[item.vehicle.url] ? (
                  <>
                    {" "}
                    · réelle {formatMarge(marge, { label: false })}
                  </>
                ) : null}
              </p>
            </div>
            <span className="text-xs font-medium text-slate-400 shrink-0">
              {item.analysis.verdict}
            </span>
            <a
              href={item.vehicle.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline shrink-0"
            >
              →
            </a>
          </div>
          );
        })}
      </div>
    </section>
  );
}
