# STEMI – Waardegestuurd FMECA → MJOP

Webapp (Vercel) met Supabase-backend en OpenRouter-agents.

- `public/` – single-page app (vanilla JS): `js/core.js` rekenkern & state, `js/db.js` Supabase,
  `js/prep.js` voorbewerking/validatie van ruwe inspectiedata, `js/ui-*.js` tabbladen
- `api/analyze.js` – OpenRouter-proxy (ingelogde gebruikers, modelallowlist, tokenplafond, dagbudget),
  `api/status.js` – of de serversleutel er is + tokengebruik, `api/models.js` – modellenlijst
- `public/data/` – voorbeelddata, scorekaarten, NEN 2767-2 gebrekenbibliotheek
- `tests/` – Playwright-regressietests (importvalidatie, guardrails, retry, rekenkern)

## Env (Vercel)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY` (aanbevolen: zonder deze env-var werkt
de AI alleen met een sleutel die per browser is ingevuld), optioneel `AI_DAGBUDGET_TOKENS`.

## Tests

```bash
cd public && python3 -m http.server 8123 &
node tests/regressie.js
```

Tests gebruiken een tijdelijk project `__test …` in Supabase. Opruimen:
`delete from dossiers where naam like '\_\_test%'`.

## Deploy

Push naar `main` (Vercel git-integratie) of `vercel deploy --prod`.
