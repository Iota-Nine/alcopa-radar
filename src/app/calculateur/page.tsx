"use client";

import { useMemo, useState } from "react";
import {
  estimateCarteGrise,
  FRAIS_ALCOPA_DEFAULT,
  computeNetMargin,
} from "@/lib/expert/carte-grise";
import type { VehicleData } from "@/types/vehicle";

export default function CalculateurPage() {
  const [prixAchat, setPrixAchat] = useState(5000);
  const [fraisAlcopa, setFraisAlcopa] = useState(FRAIS_ALCOPA_DEFAULT);
  const [reparations, setReparations] = useState(300);
  const [valeurMarche, setValeurMarche] = useState(7500);
  const [annee, setAnnee] = useState(2019);
  const [co2, setCo2] = useState(120);
  const [cylindree, setCylindree] = useState(1600);
  const [fuel, setFuel] = useState("ES");

  const cg = useMemo(() => {
    const vehicle: VehicleData = {
      url: "",
      title: "Calcul",
      brand: "X",
      model: "X",
      year: annee,
      co2,
      cylindree,
      fuel,
    };
    return estimateCarteGrise(vehicle);
  }, [annee, co2, cylindree, fuel]);

  const result = useMemo(() => {
    const benefice = computeNetMargin({
      estimationRevente: valeurMarche,
      purchasePrice: prixAchat,
      repairBudget: reparations,
      carteGrise: cg.total,
      fraisAlcopa,
    });
    const coutTotal = prixAchat + cg.total + fraisAlcopa + reparations;
    const margePct = coutTotal > 0 ? ((benefice / coutTotal) * 100).toFixed(1) : "0";
    return { coutTotal, benefice, margePct };
  }, [prixAchat, cg.total, fraisAlcopa, reparations, valeurMarche]);

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">Calculateur de bénéfice</h1>
      <p className="text-slate-400 text-sm mb-8">
        Marge nette · carte grise : (CV × 46,15 € Paris) + 11 € gestion + 2,76 € redevance.
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 mb-6">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Prix achat (enchère)</label>
          <input
            type="number"
            value={prixAchat}
            onChange={(e) => setPrixAchat(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">
            Valeur revente estimée (calibrage type LBC, pas le live)
          </label>
          <input
            type="number"
            value={valeurMarche}
            onChange={(e) => setValeurMarche(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Réparations estimées</label>
          <input
            type="number"
            value={reparations}
            onChange={(e) => setReparations(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Frais Alcopa</label>
          <input
            type="number"
            value={fraisAlcopa}
            onChange={(e) => setFraisAlcopa(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
          />
        </div>

        <div className="pt-4 border-t border-slate-800">
          <p className="text-sm font-medium text-slate-300 mb-3">Carte grise (calcul auto)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Année</label>
              <input
                type="number"
                value={annee}
                onChange={(e) => setAnnee(parseInt(e.target.value, 10) || 2015)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">CO₂ (g/km)</label>
              <input
                type="number"
                value={co2}
                onChange={(e) => setCo2(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cylindrée (cm³)</label>
              <input
                type="number"
                value={cylindree}
                onChange={(e) => setCylindree(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Énergie</label>
              <select
                value={fuel}
                onChange={(e) => setFuel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="ES">Essence</option>
                <option value="GO">Diesel</option>
                <option value="EE">Électrique</option>
                <option value="GH">Hybride</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Barème Paris (Île-de-France) — 46,15 €/CV partout.
          </p>
        </div>
      </div>

      <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-4 mb-6 text-sm">
        <p className="text-emerald-300 font-medium">
          Carte grise estimée : {cg.total.toLocaleString("fr-FR")} €
        </p>
        <p className="text-slate-400 text-xs mt-1 space-y-0.5">
          <span className="block">
            {cg.chevauxFiscaux} CV × {cg.prixCvRegion} € ={" "}
            {cg.taxeRegionale.toLocaleString("fr-FR")} €
          </span>
          <span className="block">
            + {cg.taxeGestion} € gestion + {cg.redevance} € redevance ={" "}
            <strong className="text-emerald-200">{cg.total.toLocaleString("fr-FR")} €</strong>
          </span>
          <span className="block text-slate-500">{cg.detail}</span>
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400">Coût total (achat + CG + frais + réparations)</span>
          <span className="font-bold text-white">
            {result.coutTotal.toLocaleString("fr-FR")} €
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-300 font-medium">Bénéfice net</span>
          <span
            className={`text-3xl font-bold ${
              result.benefice >= 1500
                ? "text-emerald-400"
                : result.benefice >= 500
                  ? "text-amber-400"
                  : "text-red-400"
            }`}
          >
            {result.benefice.toLocaleString("fr-FR")} €
          </span>
        </div>
        <p className="text-xs text-slate-500 text-right">Rentabilité {result.margePct} %</p>
      </div>
    </div>
  );
}
