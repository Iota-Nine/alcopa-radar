"use client";

import { Car, Bike } from "lucide-react";
import {
  vehicleCategoryLabel,
  type VehicleCategoryFilter,
} from "@/lib/filters/vehicle-category";

interface Props {
  value: VehicleCategoryFilter;
  onChange: (value: VehicleCategoryFilter) => void;
  counts?: { voiture: number; moto: number; both: number };
}

const OPTIONS: VehicleCategoryFilter[] = ["voiture", "moto", "both"];

export function VehicleCategoryFilterBar({ value, onChange, counts }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-medium">Catégorie à scanner / afficher</p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const active = value === opt;
          const count =
            opt === "voiture"
              ? counts?.voiture
              : opt === "moto"
                ? counts?.moto
                : counts?.both;
          const Icon = opt === "moto" ? Bike : Car;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`flex items-center gap-1.5 rounded-lg border font-medium text-sm px-3 py-1.5 transition-colors ${
                active
                  ? opt === "moto"
                    ? "border-orange-600 bg-orange-950/40 text-orange-200"
                    : opt === "both"
                      ? "border-violet-600 bg-violet-950/40 text-violet-200"
                      : "border-blue-600 bg-blue-950/40 text-blue-200"
                  : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {vehicleCategoryLabel(opt)}
              {counts !== undefined && count !== undefined && (
                <span className="text-slate-500 font-normal">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
