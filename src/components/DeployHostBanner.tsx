"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Cloud, Server } from "lucide-react";

interface HealthPayload {
  ok: boolean;
  host: string;
  salesCount: number;
  alcopaError: string | null;
  hint: string | null;
}

export function DeployHostBanner() {
  const isVercelBuild = process.env.NEXT_PUBLIC_DEPLOY_HOST === "vercel";
  const [health, setHealth] = useState<HealthPayload | null>(null);

  useEffect(() => {
    if (!isVercelBuild) return;
    void fetch("/api/health")
      .then((r) => r.json())
      .then((data: HealthPayload) => setHealth(data))
      .catch(() =>
        setHealth({
          ok: false,
          host: "vercel",
          salesCount: 0,
          alcopaError: "Impossible de contacter l’API.",
          hint: null,
        })
      );
  }, [isVercelBuild]);

  if (!isVercelBuild) return null;

  const alcopaBlocked = health && !health.ok;

  return (
    <div className="mb-6 space-y-3">
      <div className="glass-panel rounded-xl p-4 border-amber-700/40">
        <div className="flex gap-3">
          <Cloud className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-200 mb-1">Mode Vercel — scan limité</p>
            <p className="text-slate-400 leading-relaxed">
              Les fonctions cloud ont un timeout court (~10 s en gratuit, 60 s max en Pro).
              Le scan masse complet et l’OCR CT ne tournent pas comme en local. Préférez{" "}
              <strong className="text-slate-300">Analyser un lien</strong> ou lancez{" "}
              <code className="text-xs bg-slate-800 px-1 rounded">npm run start</code> sur votre PC
              pour l’équipe.
            </p>
          </div>
        </div>
      </div>

      {alcopaBlocked && (
        <div className="glass-panel rounded-xl p-4 border-red-800/50">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-300 mb-1">Alcopa inaccessible depuis Vercel</p>
              <p className="text-slate-400">
                {health?.alcopaError ??
                  "Alcopa bloque souvent les IP des hébergeurs cloud (captcha). Le radar ne peut pas scanner depuis ce déploiement."}
              </p>
              <p className="text-slate-500 mt-2 flex items-center gap-1.5">
                <Server className="w-4 h-4" />
                Solution : utiliser l’app en local ou sur un VPS (Railway, Render, votre PC).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
