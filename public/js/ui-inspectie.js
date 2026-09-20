/* 02 Inspectie: gestandaardiseerde tabel + ruwe data-import (CSV/XLSX/plakken) met kolommapping */
(() => {
const C = window.STEMI; const { $, $$, esc, num, eur, pct } = C;
// doelvelden + synoniemen voor auto-mapping
const FIELDS = [
  ['id','ID',['id','nr','nummer','regel','volgnr']],['object','Object / locatie',['object','gebouw','locatie object','complex','complexid','pand','objectnaam']],['element','Element',['element','elementnaam','component','onderdeel','elementomschrijving']],['bouwdeel','Bouwdeel / rubriek',['bouwdeel','bouwdeelomschrijving','rubriek','hoofdgroep','categorie']],['locatie','Exacte inspectielocatie',['locatie','plaats','positie','waar']],
  ['constatering','Technische constatering',['constatering','waarneming','bevinding','omschrijving gebrek','gebrekomschrijving','beschrijving']],['gebrek','NEN gebrek / gebreksoort',['gebrek','gebreksoort','defect']],['ernst','Ernst',['ernst','ernstklasse']],['intensiteit','Intensiteit',['intensiteit','stadium']],
  ['hoevTotaal','Totale hoeveelheid',['totaal','totale hoeveelheid','hoeveelheid element','aantal totaal','hoeveelheid','hvh','aantal','qty']],['eenheid','Eenheid',['eenheid','unit','eenh']],['hoevGebrek','Hoeveelheid met gebrek',['met gebrek','hoeveelheid gebrek','aangetast','gebrek hoeveelheid']],['omvang','Omvang %',['omvang','omvang %','percentage','omvangsklasse %']],
  ['conditie','NEN 2767 conditie',['conditie','conditiescore','score','cs','cv','conditiewaarde']],['ontwikkeling','Ontwikkeling / observatie',['ontwikkeling','observatie','opmerking ontwikkeling']],['ontwikkelingKlasse','Ontwikkeling (klasse)',['ontwikkeling klasse','ontwikkelingsklasse','trend','progressie','tempo','snelheid degradatie']],['inspecteerbaarheid','Inspecteerbaarheid',['inspecteerbaar','toegankelijk','zichtbaar']],['bewijs','Foto / bewijs',['foto','bewijs','referentie','afbeelding']],
  ['onderzoek','Aanvullend onderzoek?',['onderzoek','nader onderzoek','aanvullend']],['toelichting','Toelichting inspecteur',['toelichting','opmerking','notitie','remark']],['elementcode','Elementcode software',['elementcode','code element','nl-sfb','sfb','stabu']],['maatregel','Standaard maatregel',['maatregel','activiteit','handeling','actie']],
  ['kengetal','Kostenkengetal €/eenheid',['kengetal','prijs','eenheidsprijs','€/','tarief','kosten per']],['prijspeil','Prijspeil / bron',['prijspeil','bron','peildatum']],['omslagMaatregel','Omslag% maatregel',['omslag','omslagpercentage']],['nenCode','NEN gebrekcode',['gebrekcode','nen code','nencode','code gebrek','gebrek code','bibliotheekcode']],
  ['rVeiligheid','Risico: veiligheid (NEN 2767)',['veiligheid','veiligheidsrisico']],['rGebruik','Risico: gebruik (NEN 2767)',['gebruik','gebruiksrisico']],['rBeleving','Risico: beleving (NEN 2767)',['beleving','esthetiek']],['rVervolgschade','Risico: vervolgschade (NEN 2767)',['vervolgschade','gevolgschade']],['rKlachten','Risico: klachtenonderhoud (NEN 2767)',['klachtenonderhoud','klachten']],['elementId','Element-ID software',['elementid','element id','guid']]
];
const NUMF = ['hoevTotaal','hoevGebrek','conditie','kengetal','omslagMaatregel','omvang','id'];
const norm = s => String(s??'').toLowerCase().replace(/[^a-z0-9€%]+/g,' ').trim();
function autoMap(headers) {
  // globale greedy toewijzing: beste (veld, kolom)-paren eerst, elke kolom/veld hooguit één keer
  const pairs = [];
  for (const [k,label,syn] of FIELDS) {
    const cands = [label, k, ...syn].map(norm);
    headers.forEach((h,i) => { const hn = norm(h); if (!hn) return; let sc = 0; for (const c of cands) { if (hn === c) sc = Math.max(sc, 3); else if (hn.includes(c) || c.includes(hn)) sc = Math.max(sc, 1 + Math.min(hn.length,c.length)/Math.max(hn.length,c.length)); } if (sc >= 1.5) pairs.push([sc, k, i]); });
  }
  pairs.sort((a,b) => b[0]-a[0]);
  const map = {}, used = new Set();
  for (const [,k,i] of pairs) { if (map[k] != null || used.has(i)) continue; map[k] = i; used.add(i); }
  return map;
}
function normValue(k, v) {
  if (v == null) return null; if (typeof v === 'string') v = v.trim();
  if (NUMF.includes(k)) { if (typeof v === 'string') { let s = v.replace('%','').replace(/\./g,'').replace(',','.'); if (k==='omvang' && String(v).includes('%')) return num(s)/100; return num(s); } return num(v); }
  if (k==='ernst') { const m = {ernstig:'Ernstig',serieus:'Serieus',gering:'Gering',e:'Ernstig',s:'Serieus',g:'Gering'}; return m[norm(v)] || v; }
  if (k==='intensiteit') { const n = norm(v); if (n.startsWith('begin')) return 'Beginstadium'; if (n.startsWith('gevord')) return 'Gevorderd'; if (n.startsWith('eind')) return 'Eindstadium'; if (n.includes('waarneem') || n.startsWith('duidelijk')) return 'Duidelijk waarneembaar'; return v; }
  if (k==='ontwikkelingKlasse') { const n = norm(v); if (n.startsWith('stab')||n.includes('geen')) return 'Stabiel'; if (n.startsWith('lang')||n.includes('traag')) return 'Langzaam'; if (n.startsWith('prog')||n.includes('toenem')) return 'Progressief'; if (n.startsWith('snel')||n.includes('actief')||n.includes('acuut')) return 'Snel / actief'; return v; }
  if (k==='inspecteerbaarheid') { const n = norm(v); if (n.startsWith('vol')||n==='ja'||n==='goed') return 'Volledig'; if (n.startsWith('deel')||n.startsWith('ged')) return 'Deels'; if (n.startsWith('niet')||n==='nee'||n.startsWith('slecht')) return 'Niet'; return v; }
  if (k==='onderzoek') { const n = norm(v); return n==='ja'||n==='y'||n==='yes'||n==='1'||n==='true' ? 'Ja' : (n==='nee'||n==='n'||n==='no'||n==='0'||n==='false' ? 'Nee' : v); }
  if (k==='nenCode') return String(v).toUpperCase().replace(/\s+/g,'');
  return v;
}
let imp = null; // {name, headers, rows, map}
let lk = null;  // koppeltabel {name, headers, rows, map, key}
let queue = []; // bestanden die na de huidige stap volgen (bijv. koppeltabel na inspectie-import)

function parseText(text) {
  const wb = XLSX.read(text, {type:'string'}); const ws = wb.Sheets[wb.SheetNames[0]]; return XLSX.utils.sheet_to_json(ws, {header:1, defval:null});
}
function startImport(name, aoa) {
  const hi = aoa.findIndex(r => r && r.filter(x => x != null && x !== '').length >= 3); if (hi < 0) { alert('Geen tabel gevonden'); return; }
  const headers = aoa[hi].map(h => h == null ? '' : String(h)); const rows = aoa.slice(hi+1).filter(r => r && r.some(x => x != null && x !== ''));
  imp = { name, headers, rows, map: autoMap(headers), mode: 'append', ts: new Date().toISOString() };
  const P = window.STEMI_PREP; const prof = P.vindProfiel(headers, C.state.settings.importProfielen); if (prof) P.pasProfielToe(imp, prof.p);
  imp.rules = P.detectRules(imp); if (prof) for (const r of imp.rules) { const pr = prof.p.rules.find(x => x.id === r.id); if (pr) r.aan = pr.aan; }
  render();
}
/** herkent of een tabel inspectiedata (gebreken) of een koppeltabel (kengetallen per code) is */
function soortVan(headers) {
  const h = headers.map(x => norm(x)); const heeft = re => h.some(x => re.test(x));
  const kosten = heeft(/vervang|herstel|reinig|kengetal|eenheidsprijs|tarief|prijs/); const gebrek = heeft(/gebrek|constatering|conditie|intensiteit|omvang|ernst|cv$/);
  if (gebrek) return 'inspectie'; if (kosten) return 'koppeltabel'; return h.length >= 5 ? 'inspectie' : 'koppeltabel';
}
function volgende() { const q = queue.shift(); if (!q) return; if (q.soort === 'inspectie') startImport(q.name, q.aoa); else startLookup(q.name, q.aoa); }
function startLookup(name, aoa) {
  const hi = aoa.findIndex(r => r && r.filter(x => x != null && x !== '').length >= 2); if (hi < 0) { alert('Geen tabel gevonden'); return; }
  const headers = aoa[hi].map(h => h == null ? '' : String(h)); const rows = aoa.slice(hi+1).filter(r => r && r.some(x => x != null && x !== ''));
  const P = window.STEMI_PREP; lk = { name, headers, rows, map: P.autoMapLookup(headers), key: 'elementcode', overschrijf: false, ts: new Date().toISOString() };
  const prof = C.state.settings.koppelProfielen?.[name.replace(/\.[^.]+$/,'')]; if (prof) { const m = {}; for (const k in prof.map) { const i = headers.findIndex(h => h === prof.map[k]); if (i >= 0) m[k] = i; } if (m._key != null) { lk.map = m; lk.key = prof.key; lk.profielToegepast = true; } }
  render();
}
function applyLookup() {
  const S = C.state; const P = window.STEMI_PREP; if (lk.map._key == null) { C.toast('Kies de sleutelkolom in de koppeltabel'); return; }
  const stat = P.applyLookup(S.inspectie, lk, { key: lk.key, overschrijf: lk.overschrijf });
  S.raw = S.raw || []; S.raw.push({ bestand: lk.name, ts: lk.ts, headers: lk.headers, rows: lk.rows.slice(0, 50), map: lk.map, aantal: lk.rows.length, mode: 'koppeltabel', sleutel: lk.key, stat });
  S.settings.koppelProfielen = S.settings.koppelProfielen || {}; const byName = {}; for (const k in lk.map) byName[k] = lk.headers[lk.map[k]]; S.settings.koppelProfielen[lk.name.replace(/\.[^.]+$/,'')] = { map: byName, key: lk.key, ts: lk.ts };
  C.audit({ veld:'inspectie.koppeltabel', bron:'mens', nieuw:`${lk.name}: ${stat.gematcht}/${S.inspectie.length} regels gekoppeld op ${lk.key}; ${stat.zonderKengetal} zonder kengetal > 0; niet gevonden: ${stat.nietGevonden.length}` });
  lk = null; C.save(); window.STEMI_UI.renderAll('inspectie'); if (queue.length) setTimeout(volgende, 300);
  C.toast(`Koppeltabel toegepast: ${stat.gematcht}/${S.inspectie.length} regels gekoppeld${stat.nietGevonden.length?`, ${stat.nietGevonden.length} sleutel(s) niet gevonden`:''}${stat.zonderKengetal?`, ${stat.zonderKengetal} zonder bruikbaar kengetal`:''}`, 8000);
}
function applyImport() {
  const V = window.STEMI_PREP.valideerMapping(imp);
  if (V.blokkades.length) { C.toast('Importeren geblokkeerd: ' + V.blokkades[0].tekst, 9000); renderMapping($('#tab-inspectie')); return; }
  const S = C.state; const map = imp.map; const startId = imp.mode === 'replace' ? 1 : Math.max(0, ...S.inspectie.map(x=>x.id)) + 1;
  const P = window.STEMI_PREP; const ctx = { projectNaam: [S.project?.object, S.project?.klant].filter(Boolean).join(' – ') || window.STEMI_DB?.dossier?.naam || 'Object' };
  const extraOn = imp.rules.some(r => r.id === 'extra' && r.aan); const usedCols = new Set(Object.values(map));
  const out = imp.rows.map((r, i) => { const o = { id: startId + i, _rawRef: { bestand: imp.name, rij: i+1, ts: imp.ts } }; for (const [k] of FIELDS) { if (map[k] == null) continue; const v = normValue(k, r[map[k]]); if (v != null && v !== '') o[k] = v; } if (map.id != null && num(r[map.id]) != null && imp.mode==='replace') o.id = num(r[map.id]);
    if (extraOn) { const ex = {}; imp.headers.forEach((h, ci) => { if (h && !usedCols.has(ci) && r[ci] != null && r[ci] !== '') ex[h] = r[ci]; }); if (Object.keys(ex).length) o.extra = ex; }
    return P.applyRules(o, imp.rules, ctx); });
  S.settings.importProfielen = S.settings.importProfielen || {}; const prof = P.profielVan(imp); S.settings.importProfielen[prof.naam] = prof;
  const ids = new Set(); out.forEach(o => { while (ids.has(o.id)) o.id += 1000; ids.add(o.id); });
  if (imp.mode === 'replace') { S.inspectie = out; S.specialist = []; S.besluiten = []; S.maatregelen = []; S.ai = {}; } else S.inspectie.push(...out);
  S.raw = S.raw || []; S.raw.push({ bestand: imp.name, ts: imp.ts, headers: imp.headers, rows: imp.rows.slice(0, 200), map, rules: imp.rules.map(r=>({id:r.id,aan:r.aan})), profiel: prof.naam, aantal: imp.rows.length, mode: imp.mode });
  C.audit({ veld:'inspectie.import', bron:'mens', nieuw:`${out.length} regels uit ${imp.name} (${imp.mode}); voorbewerking: ${imp.rules.filter(r=>r.aan&&!r.info).map(r=>r.id).join(', ')||'geen'}` });
  const n = out.length; imp = null; C.save(); window.STEMI_UI.renderAll('inspectie'); C.toast(`${n} regels geïmporteerd`);
  if (queue.length) { volgende(); return; }
  if (C.cfg.autoAI && confirm(`${n} regels geïmporteerd. Tab 03 nu door de AI laten invullen?`)) window.STEMI_UI.aiFillAll();
}
async function aiMap() {
  const st = $('#aiMapStatus'); st.innerHTML = '<span class="spin"></span>agent kijkt naar de kolommen…';
  try {
    const sample = imp.rows.slice(0,3);
    const msgs = [{role:'system',content:'Je koppelt kolommen uit een ruwe NEN 2767-inspectie-export aan standaardvelden. Antwoord met één JSON-object {"map":{"<standaardveld>":<kolomindex of null>}, "opmerkingen":[...]} . Kolomindex is 0-gebaseerd. Gebruik elke kolom hooguit één keer.'},
      {role:'user',content:`Standaardvelden: ${JSON.stringify(FIELDS.map(([k,l])=>({veld:k,omschrijving:l})))}\nKolomkoppen: ${JSON.stringify(imp.headers)}\nVoorbeeldrijen: ${JSON.stringify(sample)}`}];
    const d = await C.callAgent(msgs, true, {taak:'mapping'}); const p = C.parseJSON(d.content);
    if (window.STEMI_DB) window.STEMI_DB.logAiRun({ taak:'mapping', model:d.model, input:{headers:imp.headers}, output:p, usage:d.usage });
    if (p.map) { for (const k in p.map) if (p.map[k] != null && FIELDS.some(f=>f[0]===k)) imp.map[k] = +p.map[k]; }
    imp.aiOpm = p.opmerkingen || []; const keep = Object.fromEntries(imp.rules.map(r=>[r.id,r.aan])); imp.rules = window.STEMI_PREP.detectRules(imp); imp.rules.forEach(r => { if (keep[r.id] != null) r.aan = keep[r.id]; }); render();
  } catch(e) { st.innerHTML = `<span class="warn">${esc(e.message)}</span>`; }
}

function qualityHtml(S) {
  const q = window.STEMI_PREP.quality(S.inspectie); const bar = it => `<td>${it.label}</td><td class="num">${it.ok}/${it.n}</td><td><div class="qbar"><div style="width:${Math.round(it.pct*100)}%" class="${it.pct>=0.9?'ok':it.pct>=0.5?'mid':'low'}"></div></div></td><td class="note">${it.rol}</td>`;
  const onb = Object.entries(q.onbekend).filter(([,v])=>v.length);
  const kritiek = q.items.filter(i=>i.pct<0.5 && /verplicht|nodig/.test(i.rol));
  return `<details class="card ${kritiek.length?'blok':''}" style="margin:0 0 12px" ${q.items.some(i=>i.pct<0.9)?'open':''}><summary><b>Datakwaliteit</b> ${kritiek.length?`<span class="warn">– ${kritiek.length} veld(en) vrijwel leeg die de rekenkern nodig heeft: ${esc(kritiek.map(i=>i.label).join(', '))}</span>`:`<span class="note">– ${q.items.filter(i=>i.pct>=0.9).length}/${q.items.length} velden ≥ 90% gevuld${q.onzeker?` · ${q.onzeker} bibliotheekkoppeling(en) onzeker`:''}</span>`}</summary>
    <table class="mini" style="margin-top:6px"><tbody>${q.items.map(it=>`<tr>${bar(it)}</tr>`).join('')}</tbody></table>
    ${onb.length?`<p class="note warn">Niet-herkende waarden: ${onb.map(([k,v])=>`${k}: ${esc(v.join(', '))}`).join(' · ')}</p>`:''}
    <p class="note">Lege velden blokkeren niets: het O-/D-voorstel meldt welke input ontbreekt en de AI vult aan met lager vertrouwen. Aanvullen kan in deze tabel of via een nieuwe import (toevoegen).</p></details>`;
}
function render() {
  const el = $('#tab-inspectie'); const S = C.state;
  if (imp) return renderMapping(el);
  if (lk) return renderLookup(el);
  const cols = [['object','Object'],['bouwdeel','Bouwdeel'],['element','Element'],['locatie','Locatie'],['constatering','Constatering','wrap'],['gebrek','NEN gebrek','wrap'],['gebreksoort','Gebreksoort'],['ernst','Ernst','sel',C.ERNST],['intensiteit','Intensiteit','sel',C.INTENSITEIT],['hoevTotaal','Totaal','n'],['eenheid','Eenh.'],['hoevGebrek','Met gebrek','n'],['conditie','Conditie','n'],['ontwikkeling','Ontwikkeling / observatie','wrap'],['ontwikkelingKlasse','Ontwikkeling (klasse)','sel',C.ONTWIKKELING],['inspecteerbaarheid','Inspecteerbaar','sel',C.INSPECTEERBAAR],['onderzoek','Onderzoek?','sel',['','Ja','Nee']],['toelichting','Toelichting inspecteur','wrap'],['maatregel','Std. maatregel','wrap'],['kengetal','€/eenheid','n'],['kengetalInfo','Kengetal bron','info'],['omslagMaatregel','Omslag% maatregel','n'],['nenCode','NEN code']];
  el.innerHTML = `
    <h2>02 Inspectie NEN 2767</h2><p class="sub">Objectieve technische evidence per gebrek – dit is <b>data</b>: ruw aangeleverd (export onderhoudssoftware, inspectie-app, CSV) of gestandaardiseerd. <span class="tag">GEEL = inspecteur</span> <span class="tag">GROEN = berekend</span></p>
    <div class="card" style="margin-bottom:14px"><b>Data-dump inladen</b>
      <div class="toolbar"><label class="btn" title="Eén of meer bestanden tegelijk: inspectie-export én kostentabel worden automatisch herkend">Bestand(en) (CSV / XLSX)<input type="file" id="rawFile" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls" multiple hidden></label><button class="btn ghost" id="rawPaste">Plakken (tabel uit Excel/CSV)</button><label class="btn ghost" title="Tweede bestand koppelen op elementcode/NEN-code: kengetallen, maatregelen, prijspeil">Koppeltabel (kengetallen)<input type="file" id="lkFile" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls" hidden></label><button class="btn ghost" id="addInsp">+ Lege regel</button><span class="spacer"></span><span class="note">${S.raw?.length ? `${S.raw.length} import(s) bewaard voor herleidbaarheid` : 'Nog geen ruwe import'}</span></div>
      <textarea id="rawText" class="hidden" rows="6" style="width:100%" placeholder="Plak hier een tabel met kopregel (tab- of ;-gescheiden)…"></textarea><div id="rawTextBtns" class="hidden toolbar"><button class="btn" id="rawTextGo">Kolommen koppelen →</button></div>
    </div>
    ${S.inspectie.length ? qualityHtml(S) : ''}
    <div class="tablewrap"><table><thead><tr><th>ID</th>${cols.map(c=>`<th class="${c[2]==='wrap'?'wrap':''}">${c[1]}</th>`).join('')}<th>Omvang</th><th>Kosten element</th><th>Kosten lokaal</th><th>Begrotingswijze</th><th>1e voorstel</th><th class="wrap">Bibliotheek</th><th>Bron</th><th></th></tr></thead><tbody>
    ${S.inspectie.map(insp => { const r = C.calc.rows.find(x=>x.id===insp.id) || {}; return `<tr><td>${insp.id}</td>${cols.map(c=>{const v=insp[c[0]]??''; if(c[2]==='info') return `<td class="note" style="max-width:220px">${insp.kengetallen?`${esc(insp.kengetallen.keuze||'')}<br>V ${insp.kengetallen.vervangen??'–'} · H ${insp.kengetallen.herstellen??'–'} · R ${insp.kengetallen.reinigen??'–'} <span title="${esc(insp.kengetallen.bron||'')} r${insp.kengetallen.rij||''}">(${esc((insp.kengetallen.bron||'').replace(/\.[^.]+$/,''))})</span>`:(insp.kengetalBron?esc(insp.kengetalBron):'')}</td>`; if(c[2]==='sel') return `<td class="geel"><select data-insp="${insp.id}" data-k="${c[0]}"><option value=""></option>${c[3].map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('')}</select></td>`; if(c[2]==='wrap') return `<td class="geel"><textarea data-insp="${insp.id}" data-k="${c[0]}">${esc(v)}</textarea></td>`; return `<td class="geel"><input class="${c[2]==='n'?'n':''}" data-insp="${insp.id}" data-k="${c[0]}" value="${esc(v)}"></td>`;}).join('')}
      <td class="num groen">${pct(r.omvang)}</td><td class="num groen">${eur(r.kostenElement)}</td><td class="num groen">${eur(r.kostenLokaal)}</td><td class="groen">${r.begrotingswijze||''}</td><td class="num groen">${eur(r.eersteVoorstel)}</td><td class="wrap groen">${r.libE?`<b>${esc(r.libE.bouwdeel)}</b> · ${esc(r.libE.omschrijving)}${insp.nenMatch?` <span class="tag" title="score ${insp.nenMatch.score} · ${esc(insp.nenMatch.kandidaten?.[0]?.reden||'')}">match ${esc(insp.nenMatch.zeker)}</span>`:''}`:(insp.nenCode?'<span class="warn">code onbekend</span>':(insp.nenMatch?`<span class="warn">geen zekere match</span><div class="note">kandidaten: ${insp.nenMatch.kandidaten.map(k=>`<a href="#" data-pick="${insp.id}|${k.code}" title="${esc(k.omschrijving)} (${k.score})">${k.code}</a>`).join(', ')}</div>`:'<span class="note">geen code</span>'))}</td><td class="note">${insp._rawRef?`${esc(insp._rawRef.bestand)} r${insp._rawRef.rij}`:'handmatig/Excel'}</td><td><button class="btn ghost small" data-del="${insp.id}">✕</button></td></tr>`; }).join('')}
    </tbody></table></div>
    ${S.raw?.length ? `<details style="margin-top:10px"><summary>Ruwe imports (${S.raw.length})</summary>${S.raw.map(r=>`<div class="note">${esc(r.bestand)} · ${new Date(r.ts).toLocaleString('nl-NL')} · ${r.aantal} rijen · ${r.mode}${r.profiel?` · profiel ${esc(r.profiel)}`:''}${r.rules?` · voorbewerking: ${esc(r.rules.filter(x=>x.aan).map(x=>x.id).join(', ')||'geen')}`:''} · kolommen: ${esc(r.headers.join(' | '))}</div>`).join('')}</details>` : ''}`;
  $$('[data-insp]').forEach(i => i.onchange = () => { const insp=S.inspectie.find(x=>x.id===+i.dataset.insp); const k=i.dataset.k; const old=insp[k]; insp[k] = NUMF.includes(k) ? num(i.value) : i.value; C.audit({regel:insp.id, veld:'inspectie.'+k, oud:old, nieuw:insp[k], bron:'mens'}); C.save(); window.STEMI_UI.renderAll('inspectie'); });
  $('#addInsp').onclick = () => { const id = Math.max(0,...S.inspectie.map(x=>x.id))+1; S.inspectie.push({id, object: S.inspectie[0]?.object||'Object', element:'Nieuw element'}); C.save(); window.STEMI_UI.renderAll('inspectie'); };
  $$('[data-pick]').forEach(a => a.onclick = e => { e.preventDefault(); const [id, code] = a.dataset.pick.split('|'); const insp = S.inspectie.find(x=>x.id===+id); C.audit({regel:insp.id, veld:'inspectie.nenCode', oud:insp.nenCode, nieuw:code, bron:'mens'}); insp.nenCode = code; C.save(); window.STEMI_UI.renderAll('inspectie'); });
  $$('[data-del]').forEach(b => b.onclick = () => { if(!confirm('Regel verwijderen?')) return; const id=+b.dataset.del; S.inspectie=S.inspectie.filter(x=>x.id!==id); S.specialist=S.specialist.filter(x=>x.id!==id); S.besluiten=S.besluiten.filter(x=>x.id!==id); S.maatregelen=S.maatregelen.filter(x=>x.regelId!==id); C.audit({regel:id, veld:'inspectie', nieuw:'verwijderd', bron:'mens'}); C.save(); window.STEMI_UI.renderAll('inspectie'); });
  $('#rawFile').onchange = async e => { const files=[...e.target.files]; e.target.value=''; if(!files.length) return;
    const lees = f => new Promise((res, rej) => { const rd=new FileReader(); rd.onload = ev => { try { const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array', raw:false}); const sheets = wb.SheetNames.map(n => ({ n, aoa: XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, defval:null}) })).filter(x => x.aoa.length > 1); res({ name: f.name, sheets }); } catch(err) { rej(err); } }; rd.onerror = rej; rd.readAsArrayBuffer(f); });
    try {
      const gelezen = await Promise.all(files.map(lees)); const items = [];
      for (const g of gelezen) for (const sh of g.sheets) { const hdr = (sh.aoa.find(r => r && r.filter(x => x != null && x !== '').length >= 2) || []).map(h => String(h ?? '')); items.push({ name: g.sheets.length > 1 ? `${g.name} [${sh.n}]` : g.name, aoa: sh.aoa, soort: soortVan(hdr) }); }
      const insp = items.filter(i => i.soort === 'inspectie'), kop = items.filter(i => i.soort === 'koppeltabel');
      if (!insp.length && !kop.length) { alert('Geen herkenbare tabel gevonden'); return; }
      queue = [...insp.slice(1), ...kop];
      if (insp.length) { startImport(insp[0].name, insp[0].aoa); if (queue.length) C.toast(`${insp[0].name} eerst; daarna volgt ${queue.map(q=>q.name).join(', ')}`, 6000); }
      else { if (!S.inspectie.length) { C.toast('Alleen een kostentabel gevonden; laad eerst (of tegelijk) de inspectiedata'); queue = []; return; } startLookup(kop[0].name, kop[0].aoa); queue = kop.slice(1); }
    } catch(err) { alert('Kan bestand niet lezen: ' + err.message); }
  };
  $('#lkFile').onchange = e => { const f=e.target.files[0]; if(!f) return; if (!S.inspectie.length) { C.toast('Laad eerst de inspectiedata; de koppeltabel wordt daarop toegepast'); e.target.value=''; return; } const rd=new FileReader(); rd.onload = ev => { try { const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array', raw:false}); const ws = wb.Sheets[wb.SheetNames.find(n=>/kost|kengetal|prijs/i.test(n)) || wb.SheetNames[0]]; startLookup(f.name, XLSX.utils.sheet_to_json(ws, {header:1, defval:null})); } catch(err) { alert('Kan bestand niet lezen: '+err.message); } }; rd.readAsArrayBuffer(f); e.target.value=''; };
  $('#rawPaste').onclick = () => { $('#rawText').classList.toggle('hidden'); $('#rawTextBtns').classList.toggle('hidden'); };
  $('#rawTextGo').onclick = () => { const t=$('#rawText').value; if(!t.trim()) return; startImport('geplakt-'+new Date().toISOString().slice(0,16), parseText(t)); };
}
function renderMapping(el) {
  const V = window.STEMI_PREP.valideerMapping(imp);
  el.innerHTML = `<h2>02 Inspectie – kolommen koppelen</h2><p class="sub">Bestand <b>${esc(imp.name)}</b> · ${imp.rows.length} rijen · ${imp.headers.length} kolommen. Automatische koppeling op kolomnaam; pas aan waar nodig. De ruwe rijen blijven bewaard (herleidbaarheid).</p>
    <div class="toolbar"><button class="btn ghost" id="aiMap">AI: koppeling voorstellen</button><span id="aiMapStatus" class="note"></span><span class="spacer"></span><label class="note"><input type="radio" name="impMode" value="append" ${imp.mode==='append'?'checked':''}> toevoegen</label><label class="note"><input type="radio" name="impMode" value="replace" ${imp.mode==='replace'?'checked':''}> vervangen (wist tab 03/besluiten)</label><button class="btn" id="impGo" ${V.blokkades.length?'disabled title="los eerst de blokkerende punten op"':''}>Importeren</button><button class="btn ghost" id="impCancel">Annuleren</button></div>
    ${V.blokkades.length?`<div class="card blok"><b class="warn">Importeren geblokkeerd – ${V.blokkades.length} punt(en) moeten eerst opgelost worden</b><ul>${V.blokkades.map(b=>`<li>${esc(b.tekst)}</li>`).join('')}</ul></div>`:''}
    ${V.waarschuwingen.length?`<details class="card" ${V.blokkades.length?'':'open'}><summary><b>${V.waarschuwingen.length} waarschuwing(en)</b> <span class="note">– importeren mag, maar controleer dit eerst</span></summary><ul class="note">${V.waarschuwingen.map(w=>`<li>${esc(w.tekst)}</li>`).join('')}</ul></details>`:''}
    ${!V.blokkades.length&&!V.waarschuwingen.length?`<div class="card note">Kolomkoppeling gecontroleerd: geen dubbele koppelingen, alle getalvelden bevatten getallen, verplichte en belangrijke velden zijn gekoppeld.</div>`:''}
    ${queue.length?`<div class="card note">Na deze import volgt automatisch: ${esc(queue.map(q=>q.name).join(', '))}.</div>`:''}
    ${imp.profielToegepast?`<div class="card note">Importprofiel <b>${esc(imp.profielNaam)}</b> herkend en toegepast (kolommen + voorbewerkingsregels van een eerdere import).</div>`:''}
    ${imp.aiOpm?.length?`<div class="card note">${imp.aiOpm.map(o=>`• ${esc(o)}`).join('<br>')}</div>`:''}
    <div class="card" style="margin-bottom:12px"><b>Voorbewerking</b> <span class="note">– automatisch gedetecteerd; regels worden bij het importeren toegepast en als importprofiel “${esc(imp.profielNaam||imp.name.replace(/\.[^.]+$/,''))}” bewaard voor de volgende export van dezelfde software</span>
      ${imp.rules.length?`<table class="mini" style="margin-top:6px"><tbody>${imp.rules.map(r=>`<tr><td style="width:24px">${r.info?'ℹ':`<input type="checkbox" data-rule="${r.id}" ${r.aan?'checked':''}>`}</td><td><b>${esc(r.titel)}</b><div class="note">${esc(r.uitleg)}</div></td></tr>`).join('')}</tbody></table>`:'<p class="note">Geen bijzonderheden gevonden; de data past direct op de standaardvelden.</p>'}
    </div>
    <div class="grid two"><div class="card"><table class="mini"><thead><tr><th>Standaardveld</th><th>Bronkolom</th><th>Voorbeeld</th></tr></thead><tbody>
    ${FIELDS.map(([k,l])=>{ const fout = V.blokkades.some(b=>b.velden.includes(k)); const waarsch = V.waarschuwingen.some(w=>w.veld===k); return `<tr class="${fout?'blokrij':waarsch?'waarschrij':''}"><td>${l}${fout?' <span class="warn">✕</span>':waarsch?' <span class="warn">!</span>':''}</td><td><select data-map="${k}"><option value="">— niet koppelen —</option>${imp.headers.map((h,i)=>`<option value="${i}" ${imp.map[k]===i?'selected':''}>${esc(h||('kolom '+(i+1)))}</option>`).join('')}</select></td><td class="note">${imp.map[k]!=null?esc(String(normValue(k, imp.rows[0]?.[imp.map[k]])??'')):''}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="card"><b>Ruwe data (eerste 8 rijen)</b><div class="tablewrap" style="margin-top:8px"><table><thead><tr>${imp.headers.map((h,i)=>`<th>${esc(h||('kolom '+(i+1)))}</th>`).join('')}</tr></thead><tbody>${imp.rows.slice(0,8).map(r=>`<tr>${imp.headers.map((_,i)=>`<td>${esc(r[i]??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>`;
  $$('[data-map]').forEach(s => s.onchange = () => { if (s.value==='') delete imp.map[s.dataset.map]; else imp.map[s.dataset.map] = +s.value; const keep = Object.fromEntries(imp.rules.map(r=>[r.id,r.aan])); imp.rules = window.STEMI_PREP.detectRules(imp); imp.rules.forEach(r => { if (keep[r.id] != null) r.aan = keep[r.id]; }); renderMapping(el); });
  $$('[data-rule]').forEach(c => c.onchange = () => { const r = imp.rules.find(x => x.id === c.dataset.rule); if (r) r.aan = c.checked; });
  $$('[name=impMode]').forEach(r => r.onchange = () => imp.mode = r.value);
  $('#impGo').onclick = applyImport; $('#impCancel').onclick = () => { imp=null; queue=[]; render(); };
  $('#aiMap').onclick = () => aiMap();
}
function renderLookup(el) {
  const P = window.STEMI_PREP; const S = C.state; const keyVals = new Set(S.inspectie.map(r => String(r[lk.key] ?? '').trim().toUpperCase()).filter(Boolean));
  const lkKeys = lk.map._key != null ? new Set(lk.rows.map(r => String(r[lk.map._key] ?? '').trim().toUpperCase())) : new Set(); const hit = [...keyVals].filter(k => lkKeys.has(k)).length;
  el.innerHTML = `<h2>02 Inspectie – koppeltabel toepassen</h2><p class="sub">Bestand <b>${esc(lk.name)}</b> · ${lk.rows.length} rijen · ${lk.headers.length} kolommen. De kolommen worden per regel gekoppeld aan de inspectiedata op een sleutel (bijv. elementcode). Kengetallen vervangen/herstellen/reinigen worden alle drie bewaard; per gebrek wordt het passende kengetal gekozen op ernst, gebreksoort en intensiteit – de specialist/AI kan daarvan afwijken.</p>
    <div class="toolbar"><label class="note">Sleutel in inspectiedata <select id="lkKey">${P.LOOKUP_KEYS.map(([k,l])=>`<option value="${k}" ${lk.key===k?'selected':''}>${l}</option>`).join('')}</select></label>
      <label class="note">Sleutelkolom in koppeltabel <select id="lkKeyCol"><option value="">—</option>${lk.headers.map((h,i)=>`<option value="${i}" ${lk.map._key===i?'selected':''}>${esc(h||('kolom '+(i+1)))}</option>`).join('')}</select></label>
      <span class="tag">${hit} van ${keyVals.size} sleutels gevonden</span><label class="note"><input type="checkbox" id="lkOv" ${lk.overschrijf?'checked':''}> bestaande kengetallen/maatregelen overschrijven</label><span class="spacer"></span><button class="btn" id="lkGo">Toepassen</button><button class="btn ghost" id="lkCancel">Annuleren</button></div>
    ${lk.profielToegepast?`<div class="card note">Koppelprofiel herkend en toegepast.</div>`:''}
    ${hit < keyVals.size ? `<div class="card note warn">Niet gevonden in de koppeltabel: ${esc([...keyVals].filter(k=>!lkKeys.has(k)).slice(0,30).join(', '))}${keyVals.size-hit>30?' …':''}</div>`:''}
    <div class="grid two"><div class="card"><table class="mini"><thead><tr><th>Doelveld</th><th>Bronkolom</th><th>Voorbeeld</th></tr></thead><tbody>
    ${P.LOOKUP_FIELDS.map(([k,l])=>`<tr><td>${l}</td><td><select data-lkmap="${k}"><option value="">— niet koppelen —</option>${lk.headers.map((h,i)=>`<option value="${i}" ${lk.map[k]===i?'selected':''}>${esc(h||('kolom '+(i+1)))}</option>`).join('')}</select></td><td class="note">${lk.map[k]!=null?esc(String(lk.rows[0]?.[lk.map[k]]??'')):''}</td></tr>`).join('')}
    </tbody></table><p class="note">Bedragen: gebruik de kolommen <b>exclusief btw</b> (de rekenkern rekent excl.); incl-kolommen worden standaard genegeerd.</p></div>
    <div class="card"><b>Koppeltabel (eerste 8 rijen)</b><div class="tablewrap" style="margin-top:8px"><table><thead><tr>${lk.headers.map((h,i)=>`<th>${esc(h||('kolom '+(i+1)))}</th>`).join('')}</tr></thead><tbody>${lk.rows.slice(0,8).map(r=>`<tr>${lk.headers.map((_,i)=>`<td>${esc(r[i]??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>`;
  $('#lkKey').onchange = e => { lk.key = e.target.value; renderLookup(el); }; $('#lkKeyCol').onchange = e => { if (e.target.value==='') delete lk.map._key; else lk.map._key = +e.target.value; renderLookup(el); };
  $$('[data-lkmap]').forEach(s => s.onchange = () => { if (s.value==='') delete lk.map[s.dataset.lkmap]; else lk.map[s.dataset.lkmap] = +s.value; renderLookup(el); });
  $('#lkOv').onchange = e => lk.overschrijf = e.target.checked; $('#lkGo').onclick = applyLookup; $('#lkCancel').onclick = () => { lk = null; queue = []; render(); };
}
window.STEMI_UI = window.STEMI_UI || {}; window.STEMI_UI.renderInspectie = render;
})();
