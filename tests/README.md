# Regressietests

Playwright-test die de kritieke paden controleert: importvalidatie (dubbele kolomkoppeling,
tekstkolom op getalveld), koppeltabel met kengetallen, de plausibiliteitscontrole op AI-output,
herkansing bij OpenRouter-creditfouten, en de rekenkern.

Gebruikt een tijdelijk project in Supabase met de naam `__test …` (wordt niet automatisch verwijderd;
opruimen met `delete from dossiers where naam like '\_\_test%'`).

```bash
cd public && python3 -m http.server 8123 &   # app lokaal serveren
node tests/regressie.js                       # tests uitvoeren
```
