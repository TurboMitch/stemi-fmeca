/* 02 Inspectie: gestandaardiseerde tabel + ruwe data-import (CSV/XLSX/plakken) met kolommapping */
(() => {
const C = window.STEMI; const { $, $$, esc, num, eur, pct } = C;
// doelvelden + synoniemen voor auto-mapping
const FIELDS = [
  ['id','ID',['id','nr','nummer','regel','volgnr']],['object','Object / locatie',['object','gebouw','locatie object','complex','pand']],['element','Element',['element','bouwdeel','component','onderdeel']],['locatie','Exacte inspectielocatie',['locatie','plaats','positie','waar']],
  ['constatering','Technische constatering',['constatering','waarneming','bevinding','omschrijving gebrek','beschrijving']],['gebrek','NEN gebrek / gebreksoort',['gebrek','gebreksoort','defect']],['ernst','Ernst',['ernst','ernstklasse']],['intensiteit','Intensiteit',['intensiteit','stadium']],
  ['hoevTotaal','Totale hoeveelheid',['totaal','totale hoeveelheid','hoeveelheid element','aantal totaal','hoeveelheid']],['eenheid','Eenheid',['eenheid','unit','eenh']],['hoevGebrek','Hoeveelheid met gebrek',['met gebrek','hoeveelheid gebrek','aangetast','gebrek hoeveelheid']],['omvang','Omvang %',['omvang','omvang %','percentage','omvangsklasse %']],
  ['conditie','NEN 2767 conditie',['conditie','conditiescore','score','cs']],['ontwikkeling','Ontwikkeling / observatie',['ontwikkeling','observatie','opmerking ontwikkeling']],['ontwikkelingKlasse','Ontwikkeling (klasse)',['ontwikkeling klasse','ontwikkelingsklasse','trend','progressie','tempo','snelheid degradatie']],['inspecteerbaarheid','Inspecteerbaarheid',['inspecteerbaar','toegankelijk','zichtbaar']],['bewijs','Foto / bewijs',['foto','bewijs','referentie','afbeelding']],
  ['onderzoek','Aanvullend onderzoek?',['onderzoek','nader onderzoek','aanvullend']],['toelichting','Toelichting inspecteur',['toelichting','opmerking','notitie','remark']],['elementcode','Elementcode software',['elementcode','code element','nl-sfb','sfb','stabu']],['maatregel','Standaard maatregel',['maatregel','activiteit','handeling','actie']],
  ['kengetal','Kostenkengetal €/eenheid',['kengetal','prijs','eenheidsprijs','€/','tarief','kosten per']],['prijspeil','Prijspeil / bron',['prijspeil','bron','peildatum']],['omslagMaatregel','Omslag% maatregel',['omslag','omslagpercentage']],['nenCode','NEN gebrekcode',['gebrekcode','nen code','nencode','code gebrek','gebrek code']]
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

function parseText(text) {
  const wb = XLSX.read(text, {type:'string'}); const ws = wb.Sheets[wb.SheetNames[0]]; return XLSX.utils.sheet_to_json(ws, {header:1, defval:null});
}
function startImport(name, aoa) {
  const hi = aoa.findIndex(r => r && r.filter(x => x != null && x !== '').length >= 3); if (hi < 0) { alert('Geen tabel gevonden'); return; }
  const headers = aoa[hi].map(h => h == null ? '' : String(h)); const rows = aoa.slice(hi+1).filter(r => r && r.some(x => x != null && x !== ''));
  imp = { name, headers, rows, map: autoMap(headers), mode: 'append', ts: new Date().toISOString() }; render();
}
function applyImport() {
  const S = C.state; const map = imp.map; const startId = imp.mode === 'replace' ? 1 : Math.max(0, ...S.inspectie.map(x=>x.id)) + 1;
  const out = imp.rows.map((r, i) => { const o = { id: startId + i, _rawRef: { bestand: imp.name, rij: i+1, ts: imp.ts } }; for (const [k] of FIELDS) { if (map[k] == null) continue; const v = normValue(k, r[map[k]]); if (v != null && v !== '') o[k] = v; } if (map.id != null && num(r[map.id]) != null && imp.mode==='replace') o.id = num(r[map.id]); return o; });
  const ids = new Set(); out.forEach(o => { while (ids.has(o.id)) o.id += 1000; ids.add(o.id); });
  if (imp.mode === 'replace') { S.inspectie = out; S.specialist = []; S.besluiten = []; S.maatregelen = []; S.ai = {}; } else S.inspectie.push(...out);
  S.raw = S.raw || []; S.raw.push({ bestand: imp.name, ts: imp.ts, headers: imp.headers, rows: imp.rows.slice(0, 500), map, aantal: imp.rows.length, mode: imp.mode });
  C.audit({ veld:'inspectie.import', bron:'mens', nieuw:`${out.length} regels uit ${imp.name} (${imp.mode})` });
  const n = out.length; imp = null; C.save(); window.STEMI_UI.renderAll('inspectie'); C.toast(`${n} regels geïmporteerd`);
  if (C.cfg.autoAI && C.cfg.apiKey && confirm(`${n} regels geïmporteerd. Tab 03 nu door de AI laten invullen?`)) window.STEMI_UI.aiFillAll();
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
    imp.aiOpm = p.opmerkingen || []; render();
  } catch(e) { st.innerHTML = `<span class="warn">${esc(e.message)}</span>`; }
}

function render() {
  const el = $('#tab-inspectie'); const S = C.state;
  if (imp) return renderMapping(el);
  const cols = [['object','Object'],['element','Element'],['locatie','Locatie'],['constatering','Constatering','wrap'],['gebrek','NEN gebrek','wrap'],['ernst','Ernst','sel',C.ERNST],['intensiteit','Intensiteit','sel',C.INTENSITEIT],['hoevTotaal','Totaal','n'],['eenheid','Eenh.'],['hoevGebrek','Met gebrek','n'],['conditie','Conditie','n'],['ontwikkeling','Ontwikkeling / observatie','wrap'],['ontwikkelingKlasse','Ontwikkeling (klasse)','sel',C.ONTWIKKELING],['inspecteerbaarheid','Inspecteerbaar','sel',C.INSPECTEERBAAR],['onderzoek','Onderzoek?','sel',['','Ja','Nee']],['toelichting','Toelichting inspecteur','wrap'],['maatregel','Std. maatregel','wrap'],['kengetal','€/eenheid','n'],['omslagMaatregel','Omslag% maatregel','n'],['nenCode','NEN code']];
  el.innerHTML = `
    <h2>02 Inspectie NEN 2767</h2><p class="sub">Objectieve technische evidence per gebrek – dit is <b>data</b>: ruw aangeleverd (export onderhoudssoftware, inspectie-app, CSV) of gestandaardiseerd. <span class="tag">GEEL = inspecteur</span> <span class="tag">GROEN = berekend</span></p>
    <div class="card" style="margin-bottom:14px"><b>Data-dump inladen</b>
      <div class="toolbar"><label class="btn">Bestand (CSV / XLSX)<input type="file" id="rawFile" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls" hidden></label><button class="btn ghost" id="rawPaste">Plakken (tabel uit Excel/CSV)</button><button class="btn ghost" id="addInsp">+ Lege regel</button><span class="spacer"></span><span class="note">${S.raw?.length ? `${S.raw.length} import(s) bewaard voor herleidbaarheid` : 'Nog geen ruwe import'}</span></div>
      <textarea id="rawText" class="hidden" rows="6" style="width:100%" placeholder="Plak hier een tabel met kopregel (tab- of ;-gescheiden)…"></textarea><div id="rawTextBtns" class="hidden toolbar"><button class="btn" id="rawTextGo">Kolommen koppelen →</button></div>
    </div>
    <div class="tablewrap"><table><thead><tr><th>ID</th>${cols.map(c=>`<th class="${c[2]==='wrap'?'wrap':''}">${c[1]}</th>`).join('')}<th>Omvang</th><th>Kosten element</th><th>Kosten lokaal</th><th>Begrotingswijze</th><th>1e voorstel</th><th class="wrap">Bibliotheek</th><th>Bron</th><th></th></tr></thead><tbody>
    ${S.inspectie.map(insp => { const r = C.calc.rows.find(x=>x.id===insp.id) || {}; return `<tr><td>${insp.id}</td>${cols.map(c=>{const v=insp[c[0]]??''; if(c[2]==='sel') return `<td class="geel"><select data-insp="${insp.id}" data-k="${c[0]}"><option value=""></option>${c[3].map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('')}</select></td>`; if(c[2]==='wrap') return `<td class="geel"><textarea data-insp="${insp.id}" data-k="${c[0]}">${esc(v)}</textarea></td>`; return `<td class="geel"><input class="${c[2]==='n'?'n':''}" data-insp="${insp.id}" data-k="${c[0]}" value="${esc(v)}"></td>`;}).join('')}
      <td class="num groen">${pct(r.omvang)}</td><td class="num groen">${eur(r.kostenElement)}</td><td class="num groen">${eur(r.kostenLokaal)}</td><td class="groen">${r.begrotingswijze||''}</td><td class="num groen">${eur(r.eersteVoorstel)}</td><td class="wrap groen">${r.libE?`<b>${esc(r.libE.bouwdeel)}</b> · ${esc(r.libE.omschrijving)}`:(insp.nenCode?'<span class="warn">code onbekend</span>':'<span class="note">geen code</span>')}</td><td class="note">${insp._rawRef?`${esc(insp._rawRef.bestand)} r${insp._rawRef.rij}`:'handmatig/Excel'}</td><td><button class="btn ghost small" data-del="${insp.id}">✕</button></td></tr>`; }).join('')}
    </tbody></table></div>
    ${S.raw?.length ? `<details style="margin-top:10px"><summary>Ruwe imports (${S.raw.length})</summary>${S.raw.map(r=>`<div class="note">${esc(r.bestand)} · ${new Date(r.ts).toLocaleString('nl-NL')} · ${r.aantal} rijen · ${r.mode} · kolommen: ${esc(r.headers.join(' | '))}</div>`).join('')}</details>` : ''}`;
  $$('[data-insp]').forEach(i => i.onchange = () => { const insp=S.inspectie.find(x=>x.id===+i.dataset.insp); const k=i.dataset.k; const old=insp[k]; insp[k] = NUMF.includes(k) ? num(i.value) : i.value; C.audit({regel:insp.id, veld:'inspectie.'+k, oud:old, nieuw:insp[k], bron:'mens'}); C.save(); window.STEMI_UI.renderAll('inspectie'); });
  $('#addInsp').onclick = () => { const id = Math.max(0,...S.inspectie.map(x=>x.id))+1; S.inspectie.push({id, object: S.inspectie[0]?.object||'Object', element:'Nieuw element'}); C.save(); window.STEMI_UI.renderAll('inspectie'); };
  $$('[data-del]').forEach(b => b.onclick = () => { if(!confirm('Regel verwijderen?')) return; const id=+b.dataset.del; S.inspectie=S.inspectie.filter(x=>x.id!==id); S.specialist=S.specialist.filter(x=>x.id!==id); S.besluiten=S.besluiten.filter(x=>x.id!==id); S.maatregelen=S.maatregelen.filter(x=>x.regelId!==id); C.audit({regel:id, veld:'inspectie', nieuw:'verwijderd', bron:'mens'}); C.save(); window.STEMI_UI.renderAll('inspectie'); });
  $('#rawFile').onchange = e => { const f=e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload = ev => { try { const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array', raw:false}); const ws = wb.Sheets[wb.SheetNames.find(n=>/02|insp/i.test(n)) || wb.SheetNames[0]]; startImport(f.name, XLSX.utils.sheet_to_json(ws, {header:1, defval:null})); } catch(err) { alert('Kan bestand niet lezen: '+err.message); } }; rd.readAsArrayBuffer(f); e.target.value=''; };
  $('#rawPaste').onclick = () => { $('#rawText').classList.toggle('hidden'); $('#rawTextBtns').classList.toggle('hidden'); };
  $('#rawTextGo').onclick = () => { const t=$('#rawText').value; if(!t.trim()) return; startImport('geplakt-'+new Date().toISOString().slice(0,16), parseText(t)); };
}
function renderMapping(el) {
  el.innerHTML = `<h2>02 Inspectie – kolommen koppelen</h2><p class="sub">Bestand <b>${esc(imp.name)}</b> · ${imp.rows.length} rijen · ${imp.headers.length} kolommen. Automatische koppeling op kolomnaam; pas aan waar nodig. De ruwe rijen blijven bewaard (herleidbaarheid).</p>
    <div class="toolbar"><button class="btn ghost" id="aiMap">AI: koppeling voorstellen</button><span id="aiMapStatus" class="note"></span><span class="spacer"></span><label class="note"><input type="radio" name="impMode" value="append" ${imp.mode==='append'?'checked':''}> toevoegen</label><label class="note"><input type="radio" name="impMode" value="replace" ${imp.mode==='replace'?'checked':''}> vervangen (wist tab 03/besluiten)</label><button class="btn" id="impGo">Importeren</button><button class="btn ghost" id="impCancel">Annuleren</button></div>
    ${imp.aiOpm?.length?`<div class="card note">${imp.aiOpm.map(o=>`• ${esc(o)}`).join('<br>')}</div>`:''}
    <div class="grid two"><div class="card"><table class="mini"><thead><tr><th>Standaardveld</th><th>Bronkolom</th><th>Voorbeeld</th></tr></thead><tbody>
    ${FIELDS.map(([k,l])=>`<tr><td>${l}</td><td><select data-map="${k}"><option value="">— niet koppelen —</option>${imp.headers.map((h,i)=>`<option value="${i}" ${imp.map[k]===i?'selected':''}>${esc(h||('kolom '+(i+1)))}</option>`).join('')}</select></td><td class="note">${imp.map[k]!=null?esc(String(normValue(k, imp.rows[0]?.[imp.map[k]])??'')):''}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="card"><b>Ruwe data (eerste 8 rijen)</b><div class="tablewrap" style="margin-top:8px"><table><thead><tr>${imp.headers.map((h,i)=>`<th>${esc(h||('kolom '+(i+1)))}</th>`).join('')}</tr></thead><tbody>${imp.rows.slice(0,8).map(r=>`<tr>${imp.headers.map((_,i)=>`<td>${esc(r[i]??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>`;
  $$('[data-map]').forEach(s => s.onchange = () => { if (s.value==='') delete imp.map[s.dataset.map]; else imp.map[s.dataset.map] = +s.value; renderMapping(el); });
  $$('[name=impMode]').forEach(r => r.onchange = () => imp.mode = r.value);
  $('#impGo').onclick = applyImport; $('#impCancel').onclick = () => { imp=null; render(); };
  $('#aiMap').onclick = () => { if(!C.cfg.apiKey){ C.toast('Vul eerst een OpenRouter-sleutel in (Instellingen)'); return; } aiMap(); };
}
window.STEMI_UI = window.STEMI_UI || {}; window.STEMI_UI.renderInspectie = render;
})();
