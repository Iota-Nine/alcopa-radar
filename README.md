# Alcopa Radar

Détection **automatique** de toutes les bonnes affaires sur [Alcopa Auction](https://www.alcopa-auction.fr) — sans coller d'URL.

## Comment ça marche

1. Ouvre l'app → le **radar démarre tout seul**
2. Inventaire complet du catalogue Alcopa (`/recherche`, pagination auto)
3. Analyse expert de chaque véhicule (mécanique, CT, marge, revente)
4. Affichage en direct du **Top affaires**

## Lancer

```bash
npm install
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

## Fonctionnalités

- **Radar auto** — scan complet du catalogue sans URL
- **Top affaires** — classement par score + marge
- **Top 10 historique** — `/classement`
- **Alertes** — budget, marques, score min — `/alertes`
- **Calculateur marge** — `/calculateur`

## Durée du scan

~4000 véhicules ≈ **10–20 minutes** (découverte + analyse par lots). Les meilleures affaires apparaissent progressivement pendant le scan.
