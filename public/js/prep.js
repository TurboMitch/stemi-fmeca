/* Voorbewerking van ruwe inspectiedata (NEN 2767-exports uit onderhoudssoftware) → standaardvelden van tab 02.
   Regels worden automatisch gedetecteerd, zijn per import aan/uit te zetten en worden als importprofiel bewaard (herhaalbaar per klant/software). */
window.STEMI_PREP = (() => {
const C = window.STEMI; const { num } = C;
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
const STOP = new Set(['van','dan','een','het','der','des','met','aan','bij','als','niet','maar','ouder','intensiteit']);
const tokens = s => norm(s).replace(/(\d)[,.](\d)/g,'$1_$2').split(' ').filter(t => (t.length > 2 || /^\d/.test(t)) && !STOP.has(t));
const isGuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v ?? '').trim());

/** NEN 2767 gebrekcode-prefix: 1e letter ernst (E/S/G), 2e letter gebreksoort */
const ERNST_L = { E: 'Ernstig', S: 'Serieus', G: 'Gering' };
const SOORT_L = { C: 'Constructief', M: 'Materiaal', B: 'Basiskwaliteit', W: 'Werking', V: 'Veroudering', O: 'Onderhoud / verzorging', A: 'Afwerking', Z: 'Veiligheid', R: 'Wet- en regelgeving' };
const PREFIX_RE = /^\s*([ESG])([CMBWVOAZR])\b[\s:\-–]*/i;
/** NEN 2767 intensiteit laag/midden/hoog → organisatie-eigen klassen */
const INT_NEN = { laag: 'Beginstadium', midden: 'Duidelijk waarneembaar', hoog: 'Gevorderd', gemiddeld: 'Duidelijk waarneembaar', eindstadium: 'Eindstadium' };
/** Veelvoorkomende rubrieken uit onderhoudssoftware → bouwdelen in de gebrekenbibliotheek (NL-SfB-achtig) */
const BOUWDEEL_ALIAS = [
  [/schilderwerk|beschermlaag|coating|lak/, 'Beschermlagen'], [/gevel|buitenwand|metselwerk|voegwerk/, 'Buitenwanden'], [/binnenwand|scheidingswand/, 'Binnenwanden'],
  [/kozijn|raam|deur(?!dranger)|pui/, 'Buitenwand- en binnenwandopeningen'], [/dak(bedekking|afwerking)|goot|hemelwater|dakrand|boeiboord/, 'Dakafwerkingen'], [/dak/, 'Daken'],
  [/balkon|galerij|trap|vloer|helling|bordes/, 'Vloeren, trappen, hellingen'], [/vloerafwerking|tegel/, 'Vloerafwerkingen, trap- en hellingafwerkingen'], [/plafond/, 'Plafondafwerkingen'],
  [/fundering/, 'Funderingsconstructies'], [/draagconstructie|constructie beton|staalconstructie|lateien/, 'Hoofddraagconstructie'], [/terrein|bestrating|erfscheiding|hek|verharding|tuin/, 'Terrein, opstallen, erfscheidingen, verhardingen'],
  [/schoorsteen|rookgas|ventilatie/, 'Rookgasafvoeren en ventilatievoorzieningen stookruimte'], [/cv|ketel|stook|verwarming|klimaat|warmte/, 'Stooktoestellen voor warmteopwekking'], [/leiding|riool|afvoer|water/, 'Leidingnetten'],
  [/sanitair|toilet|douche|badkamer/, 'Sanitaire voorzieningen'], [/keuken/, 'Keukenvoorzieningen'], [/elektra|elektrisch|groepenkast|verdeel|bekabeling|communicatie/, 'Licht- en krachtinstallaties'], [/verlichting|armatu/, 'Verlichtingsarmaturen'],
  [/noodverlichting/, 'Noodverlichting en -installaties'], [/brandmeld|inbraak|beveiliging|alarm/, 'Brandmeld- en inbraakinstallaties'], [/toegang|intercom|deurdranger|automatische deur/, 'Elektrisch bedienbare deuren e.d.'], [/lift/, 'Liftinstallaties met schacht'], [/zonne|pv|energieopwek/, 'Noodstroom- en energieopwekkingsinstallaties']
];
function bouwdeelVan(...teksten) {
  const t = teksten.filter(Boolean).join(' ').toLowerCase(); const hits = [];
  for (const [re, bd] of BOUWDEEL_ALIAS) if (re.test(t)) hits.push(bd);
  return hits;
}

/** Bibliotheekcode zoeken: code-prefix (ernst+soort) + bouwdeel + tekstovereenkomst met de gebrekomschrijving. Geeft {code, score, kandidaten, reden}. */
function matchLib(row) {
  const lib = C.lib; if (!lib?.length) return null;
  const prefix = row.gebrekPrefix || (row.ernst ? Object.keys(ERNST_L).find(k => ERNST_L[k] === row.ernst) : '');
  const tt = new Set([...tokens(row.gebrek), ...tokens(row.constatering)]);
  const bds = bouwdeelVan(row.bouwdeel, row.element, row.elementcode?.startsWith?.('N') ? '' : '');
  const scored = [];
  for (const e of lib) {
    let s = 0, why = [];
    const ep = e.code.slice(3, 5);
    if (prefix) { if (prefix.length === 2 && ep === prefix.toUpperCase()) { s += 0.45; why.push('gebrekcode ' + ep); } else if (ep[0] === prefix[0].toUpperCase()) { s += 0.15; why.push('ernst ' + ep[0]); } else continue; }
    if (bds.length) { if (bds.includes(e.bouwdeel)) { s += 0.3; why.push('bouwdeel ' + e.bouwdeel); } else s -= 0.1; }
    const et = [...new Set(tokens(e.omschrijving))]; const ov = et.filter(t => tt.has(t)).length; if (et.length) { const f = ov / Math.max(et.length, 1) * 0.6 + ov / Math.max(tt.size, 1) * 0.4; s += 0.5 * f; if (norm(e.omschrijving).split(':')[0].trim() === norm(row.gebrek||row.constatering)) s += 0.2; const rn = (norm(row.gebrek||row.constatering).match(/\d+([,.]\d+)?/)||[])[0], en = (norm(e.omschrijving).match(/\d+([,.]\d+)?/)||[])[0]; if (rn && en) { if (rn === en) { s += 0.1; why.push('eerste getal ' + rn); } else s -= 0.05; } if (ov) why.push(`${ov} woord(en): ${et.filter(t => tt.has(t)).slice(0, 3).join(', ')}`); }
    scored.push([s, e, why]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const top = scored[0]; if (!top) return null;
  const kandidaten = scored.slice(0, 5).map(([s, e, why]) => ({ code: e.code, score: +s.toFixed(2), bouwdeel: e.bouwdeel, omschrijving: e.omschrijving, reden: why.join(' · ') }));
  return { code: top[0] >= 0.5 ? top[1].code : null, score: +top[0].toFixed(2), kandidaten, zeker: top[0] >= 0.9 ? 'hoog' : top[0] >= 0.5 ? 'middel' : 'laag' };
}

/** detecteert welke voorbewerkingsregels op deze import van toepassing zijn */
function detectRules(imp) {
  const { headers, rows, map } = imp; const col = k => map[k] != null ? rows.map(r => r[map[k]]) : null; const rules = [];
  const vals = k => (col(k) || []).filter(v => v != null && v !== '');
  // 1. omvang als percentage → hoeveelheid met gebrek
  const om = vals('omvang'); if (map.omvang != null && map.hoevGebrek == null && map.hoevTotaal != null) { const asPct = om.some(v => num(String(v).replace('%', '')) > 1); rules.push({ id: 'omvangPct', aan: true, titel: 'Hoeveelheid met gebrek afleiden uit omvang', uitleg: `Kolom “${headers[map.omvang]}” is een omvang${asPct ? ' in procenten' : ' (fractie)'}; hoeveelheid met gebrek = totaal × omvang. Nodig voor omslag/kosten en het O-voorstel.`, asPct }); }
  // 2. intensiteit laag/midden/hoog
  const iv = vals('intensiteit').map(v => norm(v)); if (iv.length && iv.some(v => INT_NEN[v])) rules.push({ id: 'intNen', aan: true, titel: 'Intensiteit NEN 2767 (laag/midden/hoog) vertalen', uitleg: 'laag → Beginstadium, midden → Duidelijk waarneembaar, hoog → Gevorderd (organisatie-eigen O-bepalingsregels). Eindstadium kan de specialist zelf zetten.' });
  // 3. gebrekcode-prefix in omschrijving
  const gv = [...vals('gebrek'), ...vals('constatering')]; const nPref = gv.filter(v => PREFIX_RE.test(String(v))).length; if (nPref >= Math.max(3, gv.length * 0.3)) rules.push({ id: 'prefix', aan: true, titel: 'Ernst en gebreksoort afleiden uit de NEN-gebrekcode (EC, SM, GV …)', uitleg: `${nPref} van ${gv.length} gebrekomschrijvingen beginnen met een NEN 2767-code. 1e letter = ernst (E/S/G), 2e letter = gebreksoort. De code wordt uit de tekst gehaald en apart bewaard.` });
  // 4. gebrek ← constatering als gebrek niet gekoppeld
  if (map.gebrek == null && map.constatering != null) rules.push({ id: 'gebrekUitConst', aan: true, titel: 'Gebrek overnemen uit de constatering', uitleg: 'Er is geen aparte gebrek-kolom; de constatering wordt ook als NEN-gebrek gebruikt (de AI kan dit verfijnen).' });
  // 5. object = GUID
  const ov = vals('object'); if (ov.length && ov.filter(isGuid).length > ov.length * 0.8) rules.push({ id: 'objectGuid', aan: true, titel: 'Object-ID (GUID) vervangen door projectnaam', uitleg: 'De objectkolom bevat alleen technische ID’s; de ID wordt bewaard als referentie en het object krijgt de naam van het project.' });
  // 6. bibliotheekcode zoeken
  if (map.nenCode == null) rules.push({ id: 'libMatch', aan: true, titel: 'Gebrekenbibliotheek koppelen (NEN-gebrekcode zoeken)', uitleg: 'Er is geen bibliotheekcode in de data. Per regel wordt de best passende code gezocht op gebrekcode + bouwdeel + omschrijving; alleen bij voldoende zekerheid wordt hij ingevuld, anders blijven kandidaten staan voor AI/specialist.' });
  // 7. risicoaspecten NEN 2767
  const rk = ['rVeiligheid', 'rGebruik', 'rBeleving', 'rVervolgschade', 'rKlachten'].filter(k => map[k] != null); if (rk.length) rules.push({ id: 'risico', aan: true, titel: 'NEN 2767-risicoaspecten van de inspecteur bewaren', uitleg: `${rk.length} risicokolommen (veiligheid, gebruik, beleving, vervolgschade, klachten) worden bewaard en aan de AI meegegeven als hint voor de effectscores.` });
  // 8. extra kolommen
  const usedCols = new Set(Object.values(map)); const extra = headers.map((h, i) => [h, i]).filter(([h, i]) => h && !usedCols.has(i)); if (extra.length) rules.push({ id: 'extra', aan: true, titel: `Niet-gekoppelde kolommen bewaren (${extra.length})`, uitleg: extra.map(x => x[0]).join(', ') + ' – blijven per regel beschikbaar voor herleidbaarheid en voor de AI.' });
  // 9. ontbrekende velden
  const ontbreekt = ['ontwikkelingKlasse', 'inspecteerbaarheid', 'locatie', 'toelichting'].filter(k => map[k] == null); if (ontbreekt.length) rules.push({ id: 'ontbreekt', aan: true, info: true, titel: 'Ontbrekende velden: ' + ontbreekt.join(', '), uitleg: 'Deze velden zitten niet in de export. Ze blijven leeg; het O-voorstel meldt dat en de AI/specialist vult ze in met lager vertrouwen. Aanvullen kan later in tab 02.' });
  return rules;
}

/** past de regels toe op één gestandaardiseerde regel (na kolommapping/normalisatie) */
function applyRules(o, rules, ctx) {
  const on = id => rules.find(r => r.id === id && r.aan);
  if (on('prefix')) { for (const k of ['gebrek', 'constatering']) { const m = o[k] && String(o[k]).match(PREFIX_RE); if (m) { const p = (m[1] + m[2]).toUpperCase(); o.gebrekPrefix = p; if (!o.ernst) o.ernst = ERNST_L[p[0]]; o.gebreksoort = SOORT_L[p[1]] || p[1]; o[k] = String(o[k]).replace(PREFIX_RE, '').trim(); } } }
  if (on('gebrekUitConst') && !o.gebrek && o.constatering) o.gebrek = o.constatering;
  if (on('intNen') && o.intensiteit) { const v = INT_NEN[norm(o.intensiteit)]; if (v) o.intensiteit = v; }
  const r1 = on('omvangPct'); if (r1 && o.omvang != null && o.hoevGebrek == null && o.hoevTotaal != null) { let f = num(o.omvang); if (f == null) f = 0; if (f > 1) f = f / 100; o.hoevGebrek = Math.round(o.hoevTotaal * f * 100) / 100; o.omvangBron = 'afgeleid uit omvang%'; }
  if (on('objectGuid') && isGuid(o.object)) { o.objectId = o.object; o.object = ctx.projectNaam || 'Object'; }
  if (on('risico')) { const r = {}; for (const [k, l] of [['rVeiligheid', 'veiligheid'], ['rGebruik', 'gebruik'], ['rBeleving', 'beleving'], ['rVervolgschade', 'vervolgschade'], ['rKlachten', 'klachtenonderhoud']]) if (o[k]) { r[l] = o[k]; delete o[k]; } if (Object.keys(r).length) o.risico = r; }
  else for (const k of ['rVeiligheid', 'rGebruik', 'rBeleving', 'rVervolgschade', 'rKlachten']) delete o[k];
  if (on('libMatch') && !o.nenCode) { const m = matchLib(o); if (m) { if (m.code) o.nenCode = m.code; o.nenMatch = { score: m.score, zeker: m.zeker, kandidaten: m.kandidaten.slice(0, 3) }; } }
  return o;
}

/** datakwaliteit van de inspectieset: vulling per veld dat de rekenkern/AI nodig heeft */
function quality(inspectie) {
  const n = inspectie.length || 1; const f = (k, test) => inspectie.filter(r => test ? test(r) : (r[k] != null && r[k] !== '')).length;
  const items = [
    ['element', 'Element', f('element'), 'verplicht'], ['constatering', 'Constatering', f('constatering'), 'verplicht'], ['ernst', 'Ernst', f('ernst'), 'nodig voor T-voorstel'], ['intensiteit', 'Intensiteit', f('intensiteit', r => C.INTENSITEIT.includes(r.intensiteit)), 'nodig voor O-voorstel'],
    ['hoevTotaal', 'Hoeveelheid totaal', f('hoevTotaal'), 'nodig voor kosten'], ['hoevGebrek', 'Hoeveelheid met gebrek', f('hoevGebrek'), 'nodig voor omvang/O'], ['conditie', 'NEN-conditie', f('conditie'), 'informatief'],
    ['ontwikkelingKlasse', 'Ontwikkelingsklasse', f('ontwikkelingKlasse', r => C.ONTWIKKELING.includes(r.ontwikkelingKlasse)), 'nodig voor O-voorstel'], ['inspecteerbaarheid', 'Inspecteerbaarheid', f('inspecteerbaarheid', r => C.INSPECTEERBAAR.includes(r.inspecteerbaarheid)), 'nodig voor D-voorstel'],
    ['nenCode', 'Bibliotheekcode gevonden', f('nenCode', r => !!C.libEntry(r.nenCode)), 'nodig voor faalwijze/effect-voorstel'], ['kengetal', 'Kostenkengetal', f('kengetal'), 'nodig voor 1e kostenvoorstel']
  ].map(([k, label, ok, rol]) => ({ k, label, ok, n: inspectie.length, pct: ok / n, rol }));
  const onzeker = inspectie.filter(r => r.nenMatch && r.nenMatch.zeker !== 'hoog').length;
  const onbekend = { intensiteit: [...new Set(inspectie.map(r => r.intensiteit).filter(v => v && !C.INTENSITEIT.includes(v)))], ernst: [...new Set(inspectie.map(r => r.ernst).filter(v => v && !C.ERNST.includes(v)))], inspecteerbaarheid: [...new Set(inspectie.map(r => r.inspecteerbaarheid).filter(v => v && !C.INSPECTEERBAAR.includes(v)))] };
  return { items, onzeker, onbekend };
}

/** importprofielen: mapping op kolomnaam + regels, herbruikbaar voor de volgende export van dezelfde software */
function profielVan(imp) { const byName = {}; for (const k in imp.map) byName[k] = imp.headers[imp.map[k]]; return { naam: imp.profielNaam || imp.name.replace(/\.[^.]+$/, ''), headers: imp.headers.slice(), map: byName, rules: imp.rules.map(r => ({ id: r.id, aan: r.aan })), ts: new Date().toISOString() }; }
function vindProfiel(headers, profielen) {
  let best = null; for (const p of Object.values(profielen || {})) { const set = new Set(p.headers.map(norm)); const hit = headers.filter(h => set.has(norm(h))).length / Math.max(headers.length, p.headers.length); if (hit >= 0.8 && (!best || hit > best.hit)) best = { p, hit }; } return best;
}
function pasProfielToe(imp, p) { const map = {}; for (const k in p.map) { const i = imp.headers.findIndex(h => norm(h) === norm(p.map[k])); if (i >= 0) map[k] = i; } imp.map = map; imp.profielNaam = p.naam; imp.profielToegepast = true; }

return { detectRules, applyRules, matchLib, quality, profielVan, vindProfiel, pasProfielToe, PREFIX_RE, isGuid };
})();
