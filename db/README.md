# Database: schema, rechten en migraties

De database is Supabase-project `stemi-fmeca` (ref `opwdcaxcypbsbqkuxbxx`, eu-central-1).

## Waar de schemahistorie staat

Alle wijzigingen zijn als migratie toegepast en staan in Supabase zelf:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Exporteren naar bestanden kan met de Supabase CLI: `supabase link --project-ref opwdcaxcypbsbqkuxbxx`
en daarna `supabase db pull`. Dat zet de volledige historie in `supabase/migrations/`.

Toegepast tot nu toe:

| Datum | Migratie | Wat |
|---|---|---|
| 18-9-2026 | `stemi_schema` | profiles, dossiers, audit_log, ai_runs |
| 18-9-2026 | `app_settings` | gedeelde instellingen, API-sleutel gescheiden |
| 18-9-2026 | `dossiers_meta` | meta-kolom voor de projectenlijst |
| 20-9-2026 | `security_hardening_p1e` | RLS-policies, admin-rol, sleutel alleen voor beheerders |
| 20-9-2026 | `functierechten_dichtzetten` | execute-rechten voor `anon` ingetrokken |
| 20-9-2026 | `monitoring_en_backups` | app_errors, dossier_backups, `dagelijkse_backup()`, pg_cron 02:00 UTC |
| 20-9-2026 | `backup_functie_fix` | CTE-fout in de back-upfunctie |
| 20-9-2026 | `herstel_functie` | `herstel_dossier()` met back-up vóór herstel |
| 20-9-2026 | `projectlidmaatschap_rollen_prullenbak_ai_tabel` | maand 4: dossier_leden, RLS per project, prullenbak, portefeuille, dossier_ai |
| 20-9-2026 | `beheerder_beheert_rollen_van_gebruikers` | beheerder mag rollen wijzigen, niemand promoveert zichzelf |
| 20-9-2026 | `functierechten_nieuwe_helpers_dichtzetten` | EXECUTE op de nieuwe functies ingetrokken bij PUBLIC/anon |

## Rechtenmodel (sinds maand 4)

Toegang loopt **per project** via `dossier_leden (dossier_id, user_id, rol)`. De rollen:

- **eigenaar** – beheert leden, mag het project naar de prullenbak doen, terugzetten, definitief verwijderen en herstellen uit een back-up;
- **redacteur** – mag alles invullen en wijzigen;
- **lezer** – mag alleen lezen.

Daarnaast heeft `profiles.role = 'admin'` (beheerder van STEMI) altijd toegang tot alles, beheert de
API-sleutel, de foutmeldingen en de back-ups.

De policies gebruiken vier `security definer`-functies, zodat ze niet zelf door RLS heen hoeven
(en er dus geen recursie op `dossier_leden` ontstaat):

```
dossier_rol(p_dossier)  -> 'eigenaar' | 'redacteur' | 'lezer' | null   (beheerder: altijd 'eigenaar')
mag_lezen(p_dossier)    -> rol is not null
mag_schrijven(p_dossier)-> rol in ('eigenaar','redacteur')
mag_beheren(p_dossier)  -> rol = 'eigenaar'
```

Wat dat afschermt: `dossiers`, `dossier_leden`, `dossier_ai`, `audit_log`, `ai_runs` en
`dossier_backups` zijn alleen zichtbaar voor leden van het betreffende project. `app_errors` is
zichtbaar voor de eigen gebruiker en voor beheerders. Wie een project aanmaakt wordt er via de
trigger `dossier_eigenaar` automatisch eigenaar van.

Let op bij het aanmaken van nieuwe functies: Postgres geeft `EXECUTE` standaard aan `PUBLIC`, en
`anon` erft dat. `revoke ... from anon` haalt die grant *niet* weg — dat moet
`revoke all on function ... from public, anon`. De databaselinter ving dit; sindsdien staat het dicht.
De waarschuwing dat `authenticated` de vier hulpfuncties en `is_admin()` / `herstel_dossier()` mag
uitvoeren blijft staan en is bedoeld: de policies roepen ze aan, en ze verklappen niets meer dan de
eigen rol van de aanroeper.

**Bij de invoering is bestaande toegang behouden:** elke bestaande gebruiker is lid geworden van elk
bestaand project (de aanmaker als eigenaar, de rest als redacteur). De scheiding geldt dus vanaf de
invoering; bestaande projecten moeten desgewenst handmatig worden ingeperkt in de Projecten-tab.

## Prullenbak

`dossiers.verwijderd_op` / `verwijderd_door`. Verwijderen zet die kolommen; het project verdwijnt uit
de lijst maar houdt alle historie. De nachtelijke back-up slaat verwijderde projecten over.
Definitief verwijderen (echte `delete`) mag alleen de eigenaar of een beheerder en neemt via cascade
de audittrail, AI-runs, AI-voorstellen, leden en back-ups mee.

## AI-voorstellen buiten de projectstate

De AI-voorstellen per regel stonden in `dossiers.state->'ai'` en gingen bij elke opslagronde mee over
de lijn. Ze staan nu in `dossier_ai (dossier_id, regel, data)`. Voor het Roffa-project daalde de
projectstate daarmee van 2.300 kB naar 1.355 kB JSON (59%), samen met een kortere audittrail in de
state (100 in plaats van 300 regels; de volledige trail staat in `audit_log`).

De volledige AI-uitvoer inclusief de prompt blijft daarnaast onveranderd in `ai_runs` staan, dus
`herkeurAlles()` en de herleidbaarheid werken ongewijzigd. Let op: een back-up van vóór deze
wijziging bevat de AI-voorstellen nog wél, een nieuwe back-up niet meer.

## Handige controles

```sql
-- wie kan bij welk project?
select d.naam, p.username, l.rol from dossier_leden l
  join dossiers d on d.id = l.dossier_id join profiles p on p.id = l.user_id order by d.naam, l.rol;

-- RLS testen zonder iets te wijzigen: doe het in een transactie met rollback,
-- set local role authenticated; set local request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';

-- omvang van de projectstate
select naam, pg_size_pretty(length(state::text)::bigint) from dossiers order by 2 desc;
```

## Audit 24 september 2026

- **`herstel_dossier` was door iedere ingelogde gebruiker uit te voeren.** `mag_beheren()` gaf voor een niet-lid `NULL`
  in plaats van `false`; in een RLS-policy telt `NULL` als geweigerd, maar in een plpgsql-`IF` telt `NOT NULL` als
  "niet waar", waardoor de controle werd overgeslagen. Alle `mag_*`-functies geven nu altijd `true`/`false` en de
  controle in `herstel_dossier` staat in een `coalesce(..., false)`. Getest in een teruggedraaide transactie: een
  niet-lid en een redacteur krijgen nu de foutmelding.
- `TRUNCATE`, `REFERENCES` en `TRIGGER` zijn ingetrokken voor `anon` en `authenticated` (RLS geldt niet voor TRUNCATE).
- Ongebruikte tabel `instellingsprofielen` (policy `ALL … true`) verwijderd.
- Nieuwe tabel `ai_gebruik`: de API-proxy schrijft per aanroep het tokenverbruik weg; het dagbudget telt alléén deze
  tabel (voorheen `ai_runs`, dat de browser vulde en dus te omzeilen was). Een gebruiker mag alleen eigen rijen lezen en
  toevoegen; bijwerken en verwijderen kan niemand via de API.
- `handle_new_user()` heeft nu `pg_temp` in het zoekpad.
