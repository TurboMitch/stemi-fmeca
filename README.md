# STEMI – Waardegestuurd FMECA → MJOP

Webapp (Vercel) met Supabase-backend en OpenRouter-agents.

- `public/` – single-page app (vanilla JS): `js/core.js` rekenkern & state, `js/db.js` Supabase, `js/ui-*.js` tabbladen
- `api/analyze.js` – OpenRouter-proxy (alleen ingelogde gebruikers), `api/models.js` – modellenlijst
- `public/data/` – voorbeelddata, scorekaarten, NEN 2767-2 gebrekenbibliotheek

Env (Vercel): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optioneel `OPENROUTER_API_KEY`.
Deploy: push naar `main` (Vercel git-integratie) of `vercel deploy --prod`.
