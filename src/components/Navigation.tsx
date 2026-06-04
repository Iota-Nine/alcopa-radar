"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Calculator, List, Radar, Sparkles, TrendingUp, Trophy } from "lucide-react";

const NAV = [
  { href: "/", label: "Radar", icon: Radar },
  { href: "/catalogue", label: "Catalogue", icon: List },
  { href: "/potentiel", label: "Potentiel", icon: TrendingUp },
  { href: "/bonnes-affaires", label: "Affaires", icon: Sparkles },
  { href: "/classement", label: "Top 10", icon: Trophy },
  { href: "/alertes", label: "Alertes", icon: Bell },
  { href: "/calculateur", label: "Calc.", icon: Calculator },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 glass-panel">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-900/30 group-hover:scale-105 transition-transform">
            <Radar className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white leading-tight tracking-tight">Alcopa Radar</p>
            <p className="text-[11px] text-slate-400">Équipe · bonnes affaires auto</p>
          </div>
        </Link>

        <nav className="flex gap-1 overflow-x-auto nav-scroll max-w-[min(100%,42rem)]">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-all ${
                  active
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/80"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
