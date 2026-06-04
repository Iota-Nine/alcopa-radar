"use client";

import { formatMaxBid } from "@/lib/format";
import type { VehicleAnalysis, VehicleData } from "@/types/vehicle";
import { TrendingUp, Trophy, Gauge } from "lucide-react";

interface Props {
  vehicle: VehicleData;
  analysis: VehicleAnalysis;
  plafondIa: number;
  plafondUtilisateur?: number;
  /** Une seule cote — même valeur que la marge estimée (IA). */
  coteLbcAuto: number;
}

export function MarketInsights({
  vehicle,
  analysis,
  plafondIa,
  plafondUtilisateur,
  coteLbcAuto,
}: Props) {
  const liquidite = analysis.liquiditeScore ?? analysis.revente;
  const jours = analysis.joursReventeEstimes ?? 30;

  const enchere = vehicle.price;
  const roomIa =
    enchere !== undefined && enchere > 0 && plafondIa > enchere ? plafondIa - enchere : null;
  const roomUser =
    plafondUtilisateur &&
    enchere !== undefined &&
    enchere > 0 &&
    plafondUtilisateur > enchere
      ? plafondUtilisateur - enchere
      : null;

  return (
    <div className="grid sm:grid-cols-3 gap-2 mt-3">
      <div className="rounded-lg border border-violet-900/50 bg-violet-950/30 p-3">
        <div className="flex items-center gap-1.5 text-violet-300 text-[10px] uppercase font-semibold mb-1">
          <TrendingUp className="w-3 h-3" />
          Liquidité (estim.)
        </div>
        <p className="text-lg font-bold text-white">{liquidite}/10</p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Revente ~{jours} j · volume {analysis.volumeMarche ?? "—"}
        </p>
      </div>

      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-emerald-300 text-[10px] uppercase font-semibold">
          <Trophy className="w-3 h-3" />
          Plafonds d&apos;enchère
        </div>
        {enchere !== undefined && enchere > 0 && (
          <p className="text-xs text-slate-400">
            Enchère actuelle :{" "}
            <span className="text-white font-medium">
              {enchere.toLocaleString("fr-FR")} €
            </span>
          </p>
        )}
        <div>
          <p className="text-[10px] text-slate-500">Plafond IA (cote auto)</p>
          <p className="text-sm font-bold text-emerald-400">{formatMaxBid(plafondIa)}</p>
          {roomIa !== null && roomIa > 0 && (
            <p className="text-[10px] text-emerald-500/90">
              Marge de manœuvre +{roomIa.toLocaleString("fr-FR")} €
            </p>
          )}
        </div>
        {plafondUtilisateur !== undefined && plafondUtilisateur > 0 && (
          <div className="pt-1 border-t border-emerald-900/40">
            <p className="text-[10px] text-blue-400/90">Plafond utilisateur (votre LBC)</p>
            <p className="text-sm font-bold text-blue-300">
              {formatMaxBid(plafondUtilisateur)}
            </p>
            {roomUser !== null && roomUser > 0 && (
              <p className="text-[10px] text-blue-400/80">
                Marge de manœuvre +{roomUser.toLocaleString("fr-FR")} €
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold mb-1">
          <Gauge className="w-3 h-3" />
          LBC estimé (auto)
        </div>
        <p className="text-lg font-bold text-white">
          {coteLbcAuto > 0 ? `${coteLbcAuto.toLocaleString("fr-FR")} €` : "—"}
        </p>
        <p className="text-[10px] text-slate-600 mt-0.5">
          Utilisée pour marge & plafond IA — à confirmer sur LBC
        </p>
      </div>
    </div>
  );
}
