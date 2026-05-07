# VIVO (Next.js full-stack) — MVP

Fonctionnalités livrées :

- Landing page (design moderne “glass”)
- Questionnaire candidature (save en DB)
- Mini-dashboard admin (stats + table + export CSV)
- Simulateur de revenus (save optionnel des simulations)

## 1) Installer

```bash
npm i
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

> Par défaut on utilise SQLite. Pour prod, basculez sur Postgres (Vercel/Neon/Supabase…).

## 2) Où changer les règles de calcul ?

`lib/calc.ts`

Règle actuelle (selon le doc client) :
- base = CA * 85%
- si CA > 4000 → déduction 12%
- si 2000 <= CA <= 4000 → déduction 14%
- si 0 <= CA < 2000 → déduction 16%

## 3) API

- POST `/api/leads` : créer une candidature
- GET `/api/leads` : lister
- GET `/api/leads/export` : CSV
- POST `/api/simulations` : créer une simulation

## 4) Améliorations rapides (roadmap)
- Auth /admin (NextAuth, Clerk, simple key, etc.)
- Questionnaire multi-steps + scoring
- Email automatique (Resend) + CRM (HubSpot)
- Version multilingue

## Deploy
- Vercel production deployment is configured for the `main` branch.
