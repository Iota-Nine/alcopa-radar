"use client";

import {
  motorFuelFilterLabel,
  type MotorFuelFilter,
} from "@/lib/filters/motor-fuel";

interface Props {
  value: MotorFuelFilter;
  onChange: (value: MotorFuelFilter) => void;
  counts?: { all: number; essence: number; diesel: number };
  compact?: boolean;
}

export function MotorFuelFilterBar({ value, onChange, counts, compact }: Props) {
  const options: MotorFuelFilter[] = ["all", "essence", "diesel"];
  const btnClass = compact ? "text-xs px-2.5 py-1" : "text-sm px-3 py-1.5";

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <p className={`${compact ? "text-[10px]" : "text-xs"} text-slate-500 font-medium`}>
        Motorisation
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt;
          const count =
            opt === "all"
              ? counts?.all
              : opt === "essence"
                ? counts?.essence
                : counts?.diesel;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`rounded-lg border font-medium transition-colors ${btnClass} ${
                active
                  ? opt === "diesel"
                    ? "border-amber-600 bg-amber-950/40 text-amber-200"
                    : opt === "essence"
                      ? "border-emerald-600 bg-emerald-950/50 text-emerald-200"
                      : "border-slate-500 bg-slate-800 text-white"
                  : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600"
              }`}
            >
              {motorFuelFilterLabel(opt)}
              {counts !== undefined && count !== undefined && (
                <span className="ml-1 text-slate-500 font-normal">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
