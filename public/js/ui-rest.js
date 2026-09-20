/* Overzicht, 04 Systeemmodel, Instellingen (OpenRouter, gebrekenbibliotheek, data), Uitleg (07/08), Excel-export */
(() => {
const C = window.STEMI; const { $, $$, esc, num, eur, pct, pill, ASP, ASP_SHORT } = C;

// ---------- Overzicht ----------
function matrix(R) {
  let h = '<div class="matrix"><div class="hdr">S\\O</div>' + Array.from({length:10},(_,i)=>`<div class="hdr">${i+1}</div>`).join('');
  for (let s=10;s>=1;s--) { h += `<div class="hdr">${s}</div>`; for (let o=1;o<=10;o++) { const ids=R.filter(r=>Math.round(r.Swaarde)===s&&r.O===o).map(r=>r.id); const risk=s*o; const col=risk>=50?'var(--p1)':risk>=30?'var(--p2)':risk>=15?'var(--p3)':'var(--p4)'; h+=`<div class="cell" style="background:${col};opacity:${ids.length?1:.18}">${ids.join(',')}</div>`; } }
  return h + '</div><p class="note">Cellen tonen regel-ID’s op afgeronde waarde-severity × O.</p>';
}
function renderOverzicht() {
  const R = C.calc.rows, cnt = p => R.filter(r => r.prio === p).length, S = C.state.settings;
  const aanvullen = R.filter(r => r.status !== 'Compleet').length, first5 = C.calc.perJaar.slice(0,5).reduce((a,b)=>a+b,0);
  const nAI = R.filter(r=>C.state.ai[r.id]).length;
  $('#tab-overzicht').innerHTML = `
    <h2>Overzicht · ${esc(window.STEMI_DB?.dossier?.naam||'')}</h2>${(C.state.project&&(C.state.project.klant||C.state.project.object))?`<p class="sub">${esc([C.state.project.klant, C.state.project.object, C.state.project.adres].filter(Boolean).join(' · '))} · status <b>${esc(C.state.project.status||'')}</b></p>`:''}<p class="sub">Instellingenprofiel <b>${esc(S.naam)}</b> ${S.wizardVoltooid?'<span class="tag">vastgelegd</span>':'<span class="warn">nog niet vastgelegd via de AM-wizard</span>'} · profiel <b>${esc(S.params.profiel)}</b> · start ${S.params.startjaar} · horizon ${S.params.horizon} jaar · O-referentie ${S.params.oRef} jaar</p>
    <div class="flow">${[['01','Eigenaar / AM','wizard: profielen → scorekaarten → parameters','paars','eigenaar'],['02','Inspectie','data-dump NEN 2767','geel','inspectie'],['03','Specialist','AI vult, verifieert, onderbouwt','oranje','specialist'],['04','Systeemmodel','rekenkern op instellingenprofiel','groen','systeem'],['05','MJOP','handelingen, momenten, cycli','groen','mjop']].map(([n,t,d,c,tab])=>`<button class="flowstep ${c}" data-go="${tab}"><b>${n} ${t}</b><span>${d}</span></button>`).join('<span class="arrow">→</span>')}</div>
    <div class="grid kpis" style="margin-top:14px">
      <div class="card kpi"><div class="lbl">FMECA-regels</div><div class="val">${R.length}</div><div class="hint">${aanvullen ? `<span class="warn">${aanvullen} onvolledig</span>` : 'alle compleet'} · ${nAI} door AI</div></div>
      <div class="card kpi"><div class="lbl">P1 / P2</div><div class="val">${cnt('P1')} / ${cnt('P2')}</div><div class="hint">direct / binnen 1 jaar</div></div>
      <div class="card kpi"><div class="lbl">Hoogste RPN (waarde)</div><div class="val">${Math.max(0,...R.map(r=>r.RPNwaarde??0))}</div><div class="hint">${esc(R.slice().sort((a,b)=>(b.RPNwaarde??0)-(a.RPNwaarde??0))[0]?.insp.element||'')}</div></div>
      <div class="card kpi"><div class="lbl">MJOP eerste 5 jaar</div><div class="val">${eur(first5)}</div><div class="hint">${eur(C.calc.totaal)} over ${S.params.horizon} jaar</div></div>
      <div class="card kpi"><div class="lbl">Overrides</div><div class="val">${R.filter(r=>r.safety).length} / ${R.filter(r=>r.compliance).length}</div><div class="hint">safety / compliance</div></div>
    </div>
    <div class="grid three" style="margin-top:14px">
      <div class="card"><h3 style="margin-top:0">MJOP-kosten per jaar (eerste 15 jaar)</h3>${window.STEMI_UI.barChart(C.calc.jaren.slice(0,15), C.calc.perJaar.slice(0,15))}</div>
      <div class="card"><h3 style="margin-top:0">Prioriteitsverdeling</h3><div class="bars">${C.PRIOS.map(p=>`<div class="bar"><span>${pill(p)}</span><div class="track"><div class="fill" style="width:${R.length?cnt(p)/R.length*100:0}%;background:var(--${p.toLowerCase()})"></div></div><span class="v">${cnt(p)}</span></div>`).join('')}</div></div>
      <div class="card"><h3 style="margin-top:0">Risicomatrix O × S (waarde)</h3>${matrix(R)}</div>
    </div>
    <h3>Prioriteitenlijst</h3>
    <div class="tablewrap"><table><thead><tr><th>ID</th><th>Element</th><th class="wrap">Faalwijze</th><th>Prio</th><th>Gedreven door</th><th>O</th><th>D</th><th>T jr</th><th>RPN tech</th><th>RPN waarde</th><th>Dominant waardeaspect</th><th>Uiterlijk</th><th>Kosten (horizon)</th><th>Herkomst</th></tr></thead><tbody>
    ${R.slice().sort((a,b)=>(a.prio||'P9').localeCompare(b.prio||'P9')||(b.RPNwaarde??0)-(a.RPNwaarde??0)).map(r=>`<tr><td>${r.id}</td><td>${esc(r.insp.element)}</td><td class="wrap">${esc(r.faalwijze)}</td><td>${pill(r.prio)}</td><td>${r.drivers.map(d=>`<span class="tag">${d}</span>`).join(' ')}</td><td class="num">${r.O??''}</td><td class="num">${r.D??''}</td><td class="num">${r.Tjaar??''}</td><td class="num">${r.RPNtech??''}</td><td class="num">${r.RPNwaarde==null?'':Math.round(r.RPNwaarde)}</td><td>${esc(r.domWaarde)}</td><td>${r.laatsteJaar??'—'}</td><td class="num">${eur(r.kostenHorizon)}</td><td><span class="tag">${esc(r.aiStatus)}</span></td></tr>`).join('')}
    </tbody></table></div>
    <p class="note" style="margin-top:10px">Let op: een regel met T = 0 (“reeds aanwezig”) krijgt volgens de beslisregels altijd tijdprioriteit P1, ook zonder waarde-impact. Pas dit desgewenst aan in de scorekaarten (stap 2 van de AM-wizard) of accepteer het risico als besluit.</p>`;
  $$('[data-go]').forEach(b => b.onclick = () => window.STEMI_UI.switchTab(b.dataset.go));
}

// ---------- 04 Systeemmodel ----------
function renderSysteem() {
  const S = C.state.settings, R = S.rules;
  $('#tab-systeem').innerHTML = `
    <h2>04 Systeemmodel</h2><p class="sub">De rekenkern: technisch risico blijft zichtbaar naast waardegestuurd risico; overrides en tijd bepalen de definitieve prioriteit. Alle grenswaarden komen uit het instellingenprofiel <b>${esc(S.naam)}</b> (AM-wizard stap 2).</p>
    <div class="tablewrap"><table><thead><tr><th>ID</th><th>Element</th><th>O</th><th>D</th><th>T</th>${ASP_SHORT.map(a=>`<th>E ${a}</th>`).join('')}${ASP_SHORT.map(a=>`<th>W ${a}</th>`).join('')}<th>S tech</th><th>RPN tech</th><th>S waarde</th><th>RPN waarde</th><th>Basis</th><th>Safety</th><th>Compl.</th><th>T-prio</th><th>NEN signaal</th><th>Definitief</th><th>Uiterlijk</th><th>Deadline</th><th>Dominant tech</th><th>Dominant waarde</th><th>Kosten</th><th>Bron</th><th>Status</th></tr></thead><tbody>
    ${C.calc.rows.map(r=>`<tr><td>${r.id}</td><td>${esc(r.insp.element)}</td><td class="num">${r.O??''}</td><td class="num">${r.D??''}</td><td class="num">${r.Tjaar??''}</td>${r.effect.map(e=>`<td class="num">${e}</td>`).join('')}${r.impact.map(e=>`<td class="num groen">${+e.toFixed(1)}</td>`).join('')}<td class="num">${r.Stech}</td><td class="num">${r.RPNtech??''}</td><td class="num">${+r.Swaarde.toFixed(1)}</td><td class="num"><b>${r.RPNwaarde==null?'':Math.round(r.RPNwaarde)}</b></td><td>${pill(r.basis)}</td><td>${pill(r.safety)}</td><td>${pill(r.compliance)}</td><td>${pill(r.tPrio)}</td><td class="wrap">${r.nenSignaal?'<span class="warn">Expliciete beoordeling</span>':''}</td><td>${pill(r.prio)}</td><td>${r.laatsteJaar??'—'}</td><td>${r.deadline??'—'}</td><td>${esc(r.domTech)}</td><td>${esc(r.domWaarde)}</td><td class="num">${eur(r.definitieveKosten)}</td><td>${r.kostenbron}</td><td>${r.status}</td></tr>`).join('')}
    </tbody></table></div>
    ${conditieHtml()}
    <h3>Actieve beslisregels</h3>
    <div class="grid two"><div class="card"><b>RPN waarde → basisprioriteit</b><br>${R.rpn.map(x=>`${x.prio} ≥ ${x.min}`).join(' · ')} · anders P5<br><br><b>Safety-override</b> (effect Veiligheid): ${R.safety.map(x=>`${x.prio} ≥ ${x.min}`).join(' · ')}<br><b>Compliance-override</b>: ${R.compliance.map(x=>`${x.prio} ≥ ${x.min}`).join(' · ')}</div>
    <div class="card"><b>T-prioriteit</b>: ${R.tPrio.map(x=>`${x.prio} ≤ ${x.max} jr`).join(' · ')} · anders P5<br><b>Definitief</b> = strengste van basis, safety, compliance, T.<br><b>Laatste acceptabele jaar</b>: ${C.PRIOS.map(p=>`${p} ${R.laatsteJaar[p]==null?'—':'+'+R.laatsteJaar[p]}`).join(' · ')}.<br><b>Technische deadline</b> = start + ⌈T⌉. <button class="btn ghost small" data-go="eigenaar">Aanpassen in wizard</button></div></div>`;
  $$('[data-go]').forEach(b => b.onclick = () => window.STEMI_UI.switchTab(b.dataset.go));
  const cn = $('#cpN'); if (cn) cn.onchange = e => { C.cfg.prognoseJaren = +e.target.value; C.saveCfg(); renderSysteem(); };
}

/** conditieprognose over de horizon: met de geplande handelingen versus niets doen */
function conditieHtml() {
  const n = C.cfg.prognoseJaren || 15;
  let pg; try { pg = C.conditiePrognose(); } catch (e) { return `<p class="note warn">Conditieprognose kon niet worden berekend: ${esc(e.message)}</p>`; }
  if (!pg.rijen.length) return '';
  const jaren = pg.jaren.slice(0, n), r1 = (a) => a.slice(0, n).map(v => Math.round(v * 10) / 10);
  const kleur = c => c >= 5.5 ? 'warn' : c >= 4.5 ? 'oranje' : c >= 3 ? '' : 'groen';
  const bron = C.calc.rows.reduce((a,r)=>{ const b=r.tInfo?.bron||'onbekend'; a[b]=(a[b]||0)+1; return a; },{});
  return `<h3 style="margin-top:18px">Conditieprognose ${jaren[0]}–${jaren[jaren.length-1]}</h3>
    <p class="note">NEN 2767-conditie per jaar${pg.gewogen?' (gewogen naar hoeveelheid)':''}: met de geplande handelingen tegenover niets doen. De conditie loopt naar 6 op het faalmoment T; een handeling zet de conditie terug (vervangen → 1, herstellen → 2, reinigen/conserveren → een stap beter) en daarna begint de degradatie opnieuw. T komt ${Object.entries(bron).map(([b,c])=>`${c}× uit ${({code:'een vaste regel per gebrekcode',model:'het restlevensduurmodel',onbekend:'niets (specialist bepaalt)'})[b]||b}`).join(', ')}.</p>
    <div class="toolbar"><label class="note">Toon <select id="cpN">${[10,15,20,30,40].map(x=>`<option ${x===n?'selected':''}>${x}</option>`).join('')}</select> jaar</label><span class="spacer"></span><span class="note">Gemiddelde conditie in ${jaren[jaren.length-1]}: <b>${Math.round(pg.gemMet[n-1]*10)/10}</b> met plan tegenover <b>${Math.round(pg.gemZonder[n-1]*10)/10}</b> zonder ingrijpen</span></div>
    <div class="card">${window.STEMI_UI.lineChart(jaren, [{naam:'Met de geplande handelingen', waarden:r1(pg.gemMet)}, {naam:'Zonder ingrijpen', waarden:r1(pg.gemZonder), stippel:true}])}</div>
    <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>ID</th><th>Element</th><th>Prio</th><th>Conditie nu</th><th>T (jr)</th><th>Levensduur</th><th>Curve</th>${jaren.map(j=>`<th>${j}</th>`).join('')}</tr></thead><tbody>
    ${pg.rijen.slice(0,120).map(x=>`<tr><td>${x.id}</td><td>${esc(x.element)}</td><td>${pill(x.prio)}</td><td class="num">${x.nu}</td><td class="num">${x.T==null?'—':Math.round(x.T*10)/10}</td><td class="num note">${x.L}</td><td class="note">${esc(x.vorm)}</td>${x.met.slice(0,n).map(c=>`<td class="num ${kleur(c)}">${Math.round(c*10)/10}</td>`).join('')}</tr>`).join('')}
    <tr><td colspan="7"><b>Gemiddeld met plan</b></td>${r1(pg.gemMet).map(c=>`<td class="num ${kleur(c)}"><b>${c}</b></td>`).join('')}</tr>
    <tr><td colspan="7" class="note">Gemiddeld zonder ingrijpen</td>${r1(pg.gemZonder).map(c=>`<td class="num note">${c}</td>`).join('')}</tr>
    <tr><td colspan="7" class="note">Aantal regels conditie ≥ 5 (met plan)</td>${pg.slechtMet.slice(0,n).map(v=>`<td class="num note">${v}</td>`).join('')}</tr>
    </tbody></table></div>${pg.rijen.length>120?`<p class="note">Eerste 120 van ${pg.rijen.length} regels.</p>`:''}`;
}

// ---------- Instellingen ----------
let libQ = '', modelQ = '';
function modelOptions(sel) {
  const list = window._models || C.MODELS.map(id=>({id,name:id}));
  const q = modelQ.trim().toLowerCase();
  const shown = list.filter(m => !q || (m.id+' '+(m.name||'')).toLowerCase().includes(q));
  if (sel && !shown.some(m=>m.id===sel)) shown.unshift(list.find(m=>m.id===sel) || {id:sel,name:sel});
  const price = m => m.prompt!=null ? ` · $${(+m.prompt*1e6).toFixed(2)}/${(+m.completion*1e6).toFixed(2)} per 1M` : '';
  return shown.slice(0,400).map(m=>`<option value="${esc(m.id)}" ${m.id===sel?'selected':''}>${esc(m.name||m.id)}${m.context?` · ${Math.round(m.context/1000)}k`:''}${price(m)}</option>`).join('');
}
async function fetchModels() {
  const out = $('#cfgModelsOut'); out.innerHTML = '<span class="spin"></span>ophalen…';
  try { const tok = await window.STEMI_DB.token(); const r = await fetch('/api/models', { headers: { ...(C.cfg.apiKey?{'x-openrouter-key':C.cfg.apiKey}:{}), Authorization: 'Bearer '+tok } }); const d = await r.json(); if (!r.ok) throw new Error(d.error||r.status); window._models = d.models; renderInstellingen(); }
  catch (e) { out.innerHTML = `<span class="warn">${esc(e.message)}</span>`; }
}
let gezondheid = null;
function gezondheidHtml() {
  if (!gezondheid || gezondheid.bezig) return '<p class="note">Gezondheid wordt opgehaald…</p>';
  if (gezondheid.fout) return `<p class="note warn">Gezondheidsoverzicht niet op te halen: ${esc(gezondheid.fout)}</p>`;
  const s = gezondheid.samenvatting || [];
  const totaal = s.reduce((a, x) => a + Number(x.aantal), 0);
  return `<details class="card ${totaal?'blok':''}" style="margin:10px 0">
    <summary><b>Gezondheid</b> <span class="${totaal?'warn':'note'}">– ${totaal ? `${totaal} fout(en) in de afgelopen 7 dagen` : 'geen fouten in de afgelopen 7 dagen'}</span></summary>
    ${s.length ? `<table class="mini" style="margin-top:6px"><thead><tr><th>Waar</th><th>Soort</th><th class="num">Aantal</th><th>Laatste</th><th>Melding</th></tr></thead><tbody>
      ${s.map(x=>`<tr><td>${esc(x.bron)}</td><td>${esc(x.soort||'')}</td><td class="num">${x.aantal}</td><td class="note">${new Date(x.laatste).toLocaleString('nl-NL')}</td><td class="note">${esc((x.voorbeeld||'').slice(0,120))}</td></tr>`).join('')}
    </tbody></table><div class="toolbar"><button class="btn ghost small" id="gzDetail">Laatste 25 fouten</button></div><div id="gzLijst"></div>` : '<p class="note">De app legt browserfouten, mislukte opslagacties en mislukte AI-runs vast in de database. Er is de afgelopen week niets vastgelegd.</p>'}
  </details>`;
}
async function haalGezondheid() {
  try { gezondheid = { samenvatting: await window.STEMI_DB.foutSamenvatting() }; }
  catch (e) { gezondheid = { fout: e.message }; }
  renderInstellingen();
}
let apiStatus = null;
function sleutelStatusHtml() {
  if (!apiStatus || apiStatus.bezig) return '<p class="note">AI-status wordt opgehaald…</p>';
  if (apiStatus.fout) return `<p class="note warn">AI-status onbekend: ${esc(apiStatus.fout)}</p>`;
  const b = apiStatus.tokensVandaag != null ? ` · vandaag ${apiStatus.tokensVandaag.toLocaleString('nl-NL')} van ${apiStatus.dagbudget.toLocaleString('nl-NL')} tokens gebruikt` : '';
  return apiStatus.sleutelOpServer
    ? `<p class="note"><b>Sleutel staat op de server</b> (env OPENROUTER_API_KEY) – de sleutel gaat niet via de browser${b}.</p>`
    : `<p class="note warn"><b>Geen serversleutel.</b> De AI werkt nu alleen met de sleutel die in déze browser is ingevuld; collega's kunnen de AI dan niet gebruiken. Zet OPENROUTER_API_KEY als env var op Vercel (Project → Settings → Environment Variables) en deploy opnieuw${b}.</p>`;
}
async function haalApiStatus() {
  try { const tok = await window.STEMI_DB.token(); const r = await fetch('/api/status', { headers: { Authorization: 'Bearer ' + tok } }); apiStatus = r.ok ? await r.json() : { fout: 'status ' + r.status }; }
  catch (e) { apiStatus = { fout: e.message }; }
  if ($('#tab-instellingen').classList.contains('active') || true) renderInstellingen();
}
function renderInstellingen() {
  if (!apiStatus) { apiStatus = { fout: null, bezig: true }; haalApiStatus(); }
  if (!gezondheid) { gezondheid = { bezig: true }; haalGezondheid(); }
  const S = C.state.settings, ov = S.libOverrides || {};
  const q = libQ.trim().toLowerCase(); const hits = q ? C.lib.filter(e => (e.code+' '+e.bouwdeel+' '+e.omschrijving+' '+e.faalwijze).toLowerCase().includes(q)).slice(0,60) : C.lib.filter(e=>ov[e.code]).slice(0,60);
  $('#tab-instellingen').innerHTML = `
    <h2>Instellingen</h2>
    <div class="grid two">
      <div class="card"><h3 style="margin-top:0">OpenRouter-agents</h3>
        ${sleutelStatusHtml()}${gezondheidHtml()}${window.STEMI_DB?.isAdmin ? `<div class="field"><label>OpenRouter API-sleutel <span class="note">(alleen beheerders; veiliger is de env-var <b>OPENROUTER_API_KEY</b> op Vercel — dan hoeft de sleutel niet via de browser)</span></label><input type="password" id="cfgKey" value="${esc(C.cfg.apiKey||'')}" placeholder="sk-or-v1-…"></div>` : `<p class="note">De API-sleutel wordt beheerd door een beheerder of staat als env-var op de server; je kunt de AI gewoon gebruiken.</p>`}
        <div class="toolbar"><button class="btn ghost" id="cfgModels">Alle modellen ophalen van OpenRouter</button><input id="modelQ" placeholder="filter (bijv. claude, gpt, gemini, free)" style="min-width:220px"><span id="cfgModelsOut" class="note">${window._models?`${window._models.length} modellen geladen`:'nog niet opgehaald'}</span></div>
        ${[['specialist','Agent tab 03 – analyse & verificatie per regel (zwaarste taak)'],['mapping','Agent kolommapping bij data-import'],['chat','Agent vragen/chat over de dataset']].map(([t,l])=>`<div class="field"><label>${l}</label><select data-model="${t}">${modelOptions(C.cfg.models?.[t]||C.cfg.model)}</select></div>`).join('')}
        <div class="field"><label>Standaardmodel (fallback)</label><select data-model="_default">${modelOptions(C.cfg.model)}</select></div>
        <div class="field"><label>Organisatiecontext voor de agents (beleid, gebruik van het object, aandachtspunten)</label><textarea id="cfgCtx" rows="4">${esc(C.cfg.context||'')}</textarea></div>
        <label class="note"><input type="checkbox" id="cfgAuto" ${C.cfg.autoAI?'checked':''}> na een data-import voorstellen om tab 03 direct door de AI te laten invullen</label><br><br>
        <button class="btn" id="cfgSave">Opslaan (gedeeld)</button> <button class="btn ghost" id="cfgTest">Verbinding testen</button> <span id="cfgTestOut" class="note"></span>
      </div>
      <div class="card"><h3 style="margin-top:0">Data & herleidbaarheid</h3>
        <p class="note">Alle invoer, AI-voorstellen, herkomst per veld en de wijzigingshistorie (${C.state.audit.length} regels) staan lokaal in deze browser. Exporteer regelmatig.</p>
        <button class="btn ghost" id="dlJson">Volledige dataset (JSON)</button> <label class="btn ghost">JSON laden<input type="file" id="upJson" accept=".json" hidden></label> <button class="btn ghost" id="dlAudit">Audittrail (CSV)</button>
        <h3>Instellingenprofiel</h3><p class="note">Rekenregels, scorekaarten, profielbibliotheek en parameters beheer je in de AM-wizard (tab 01). Huidig: <b>${esc(S.naam)}</b>.</p><button class="btn ghost" data-go="eigenaar">Naar de wizard</button>
      </div>
    </div>
    <h3>10 Gebrekenbibliotheek – standaardwaarden (NEN 2767-2:2025 + organisatie-eigen effectvoorstellen)</h3>
    <p class="note">${C.lib.length} gebrekcodes. Het effectprofiel (8 scores) en de faalwijze per code zijn de <b>default settings</b> die het systeem voorstelt als de specialist/AI niets invult. Overrides worden in het instellingenprofiel bewaard (${Object.keys(ov).length} actief).</p>
    <div class="toolbar"><input id="libQ" placeholder="Zoek op code, bouwdeel of omschrijving…" value="${esc(libQ)}" style="min-width:320px"><span class="note">${q?`${hits.length} treffers (max 60)`:'toont alleen codes met override; zoek om te bewerken'}</span></div>
    <div class="tablewrap"><table><thead><tr><th>Code</th><th>Bouwdeel</th><th>Klasse</th><th class="wrap">Omschrijving</th><th class="wrap">Faalwijze (voorstel)</th>${ASP_SHORT.map(a=>`<th>${a}</th>`).join('')}<th>Vertr.</th><th></th></tr></thead><tbody>
    ${hits.map(e => { const o = ov[e.code]; const eff = o?.effect || e.effect; return `<tr class="${o?'ovr':''}"><td>${e.code}</td><td>${esc(e.bouwdeel)}</td><td>${esc(e.ernst)}</td><td class="wrap">${esc(e.omschrijving)}</td><td class="wrap"><textarea data-libf="${e.code}">${esc(o?.faalwijze||e.faalwijze)}</textarea></td>${eff.map((v,i)=>`<td><input class="n" data-libe="${e.code}" data-i="${i}" value="${v}"></td>`).join('')}<td>${esc(e.vertrouwen)}</td><td>${o?`<button class="btn ghost small" data-libreset="${e.code}">reset</button>`:''}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  const gz = $('#gzDetail'); if (gz) gz.onclick = async () => { gz.disabled = true; try { const rows = await window.STEMI_DB.laatsteFouten(25);
    $('#gzLijst').innerHTML = `<div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>Tijd</th><th>Gebruiker</th><th>Project</th><th>Waar</th><th class="wrap">Melding</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="note">${new Date(r.ts).toLocaleString('nl-NL')}</td><td class="note">${esc(r.username||'')}</td><td class="note">${esc(r.dossier_naam||'')}</td><td>${esc(r.bron)}${r.soort?` · ${esc(r.soort)}`:''}</td><td class="wrap note">${esc((r.melding||'').slice(0,300))}</td></tr>`).join('')}</tbody></table></div>`;
  } catch (e) { $('#gzLijst').innerHTML = `<p class="note warn">${esc(e.message)}</p>`; } gz.disabled = false; };
  $('#cfgSave').onclick = () => { const kf=$('#cfgKey'); if (kf) C.cfg.apiKey=kf.value.trim(); C.cfg.models = C.cfg.models||{}; $$('[data-model]').forEach(s=>{ if (s.dataset.model==='_default') C.cfg.model = s.value; else C.cfg.models[s.dataset.model] = s.value; }); C.cfg.context=$('#cfgCtx').value; C.cfg.autoAI=$('#cfgAuto').checked; C.saveCfg(); C.toast('Opgeslagen en gedeeld'); window.STEMI_UI.renderAll('specialist'); };
  $('#cfgModels').onclick = fetchModels;
  $('#modelQ').value = modelQ; $('#modelQ').oninput = e => { modelQ = e.target.value; clearTimeout(window._mq); window._mq = setTimeout(() => { $$('[data-model]').forEach(s => { const cur = s.value; s.innerHTML = modelOptions(cur); }); }, 200); };
  $('#cfgTest').onclick = async () => { $('#cfgSave').click(); const out=$('#cfgTestOut'); out.innerHTML='<span class="spin"></span>testen…'; try { const r = await C.callAgent([{role:'user',content:'Antwoord met JSON {"ok":true}'}], true); out.textContent = 'OK – ' + (r.model||''); } catch(e) { out.innerHTML = `<span class="warn">${esc(e.message)}</span>`; } };
  $('#dlJson').onclick = () => download('stemi-fmeca-dataset.json', JSON.stringify(C.state,null,1), 'application/json');
  $('#upJson').onchange = e => { const f=e.target.files[0]; if(!f) return; f.text().then(t=>{ const st = JSON.parse(t); if(!st.inspectie) throw new Error('geen dataset'); C.state = st.versie===2 ? st : (window.STEMI.emptyState(), st); C.save(); window.STEMI_UI.renderAll(); C.toast('Dataset geladen'); }).catch(err=>alert('Ongeldig bestand: '+err.message)); };
  $('#dlAudit').onclick = () => { const rows=[['tijd','regel','veld','oud','nieuw','bron','model','opmerking']].concat(C.state.audit.map(a=>[a.ts,a.regel??'',a.veld??'',JSON.stringify(a.oud??''),JSON.stringify(a.nieuw??''),a.bron??'',a.model??'',a.opmerking??''])); download('stemi-audittrail.csv', rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';')).join('\n'), 'text/csv'); };
  $('#libQ').oninput = e => { libQ = e.target.value; clearTimeout(window._lq); window._lq = setTimeout(renderInstellingen, 250); };
  const setOv = (code, fn) => { S.libOverrides = S.libOverrides||{}; const base = C.libByCode[code]; const o = S.libOverrides[code] || { effect: base.effect.slice(), faalwijze: base.faalwijze }; fn(o); S.libOverrides[code] = o; C.audit({veld:'bibliotheek.'+code, bron:'mens', nieuw: JSON.stringify(o)}); C.save(); C.recompute(); };
  $$('[data-libe]').forEach(i => i.onchange = () => setOv(i.dataset.libe, o => { o.effect[+i.dataset.i] = Math.min(10,Math.max(0,num(i.value)??0)); }));
  $$('[data-libf]').forEach(i => i.onchange = () => setOv(i.dataset.libf, o => { o.faalwijze = i.value; }));
  $$('[data-libreset]').forEach(b => b.onclick = () => { delete S.libOverrides[b.dataset.libreset]; C.save(); C.recompute(); renderInstellingen(); });
  $$('[data-go]').forEach(b => b.onclick = () => window.STEMI_UI.switchTab(b.dataset.go));
}
function download(name, text, type) { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; a.click(); }

// ---------- Uitleg (00, 07, 08) ----------
function renderUitleg() {
  const W = C.seed.woordenlijst||[], Rl = C.seed.rollen||[];
  $('#tab-uitleg').innerHTML = `
    <h2>Uitleg</h2><p class="sub">Leeswijzer, rollen & inputmomenten (08) en woordenlijst (07).</p>
    <div class="card"><h3 style="margin-top:0">Leeswijzer</h3><p>NEN 2767 → FMECA → NEN 8026 waardekompas → risico & tijd → MJOP.</p>
    <ol><li><b>Eigenaar / assetmanager</b> (paars/blauw) – legt via de wizard het instellingenprofiel vast: profielbibliotheek (09), scorekaarten & beslisregels (06), objectparameters (01). Neemt later MJOP-besluiten.</li><li><b>NEN 2767-inspecteur</b> (geel) – levert objectieve technische evidence als data (ruw of gestandaardiseerd) in 02.</li><li><b>Technisch specialist / ME</b> (oranje) – in 03 vult de AI alle velden (faalwijze, O, D, T, effecten, maatregel, restrisico, kosten) op basis van 02 en de gebrekenbibliotheek; verifieert en overschrijft onderbouwd; de specialist controleert. Elke waarde heeft een herkomst en historie.</li><li><b>Systeemmodel</b> (groen, 04) – rekenkern op het instellingenprofiel: technisch én waardegestuurd risico, overrides, T-prioriteit, definitieve prioriteit.</li><li><b>Assetmanager-besluit</b> (blauw) – maatregel, jaar, budget, acceptatie restrisico.</li><li><b>MJOP</b> (groen, 05) – handelingen met moment, kosten en cyclus over de horizon, op prijspeil; indexering, btw, contante waarde en budgetsturing rekent het model erbij.</li><li><b>Scenario's</b> (07) – dezelfde onderhoudsbehoefte onder verschillende beleidskeuzes: kosten, wat er met het risico gebeurt en hoe de technische staat zich ontwikkelt.</li><li><b>Rapport</b> (06) – het volledige klantrapport, met per maatregel de onderbouwing en de herkomst van elke waarde.</li></ol><h3 style="margin-top:14px">Hoe het faalmoment T tot stand komt</h3><p class="note">T is de verwachte tijd tot functieverlies en bepaalt de technische deadline en de T-prioriteit. Er zijn drie bronnen, in deze volgorde: (1) een <b>vaste regel per gebrekcode</b> in het instellingenprofiel; (2) het <b>restlevensduurmodel</b>: T = levensduur van de bouwdeelcategorie × restfactor van de degradatiecurve ÷ ontwikkelsnelheid × ernstfactor × omvangfactor, begrensd op de resterende technische levensduur en op de horizon; (3) <b>de specialist</b>, die het voorstel overneemt of onderbouwd afwijkt. De degradatiegraad komt uit de NEN-intensiteit met de conditiescore als kruiscontrole: de verst gevorderde van de twee telt. Alle coëfficiënten staan in de wizard (stap 3), zodat de methodiek beleid van de organisatie blijft en geen vaste aanname van de software.</p><h3>Conditieprognose</h3><p class="note">De NEN 2767-conditie loopt van de huidige score naar 6 op het faalmoment T. Een handeling zet de conditie terug — vervangen naar 1, herstellen naar 2, reinigen of conserveren een stap — waarna de degradatie opnieuw begint over de levensduur van het bouwdeel. Tab 04 zet het geplande onderhoud tegenover niets doen; dat maakt zichtbaar wat uitstellen technisch betekent en niet alleen financieel.</p></div>
    <h3>08 Rollen, inputmomenten en verantwoordelijkheden</h3>
    <div class="tablewrap"><table><thead><tr><th>Fase</th><th class="wrap">Input / beslissing</th><th>Wie</th><th>Methodiek</th><th>Kleur</th><th>Output</th><th>Verantw.</th></tr></thead><tbody>${Rl.map(r=>`<tr><td>${esc(r.fase)}</td><td class="wrap">${esc(r.input)}</td><td>${esc(r.wie)}</td><td>${esc(r.methodiek)}</td><td>${esc(r.kleur)}</td><td>${esc(r.output)}</td><td>${esc(r.verantwoordelijkheid)}</td></tr>`).join('')}</tbody></table></div>
    <h3>07 Woordenlijst</h3>
    <div class="tablewrap"><table><thead><tr><th>Begrip</th><th class="wrap">Betekenis</th><th class="wrap">Toelichting binnen dit model</th><th>Rol</th></tr></thead><tbody>${W.map(w=>`<tr><td><b>${esc(w.begrip)}</b></td><td class="wrap">${esc(w.betekenis)}</td><td class="wrap">${esc(w.toelichting)}</td><td>${esc(w.rol)}</td></tr>`).join('')}</tbody></table></div>`;
}

// ---------- Excel-export ----------
function exportXlsx() {
  const wb = XLSX.utils.book_new(), R = C.calc.rows, S = C.state.settings;
  const s01 = [['Parameter','Waarde'],['Instellingenprofiel',S.naam],['Waardekompas profiel',S.params.profiel],['Startjaar',S.params.startjaar],['Horizon',S.params.horizon],['O-referentieperiode',S.params.oRef],['NEN signaal vanaf conditie',S.params.nenSignaal],['Default omslag',S.params.omslagDefault],['Prijspeil',S.params.prijspeil??S.params.startjaar],['Inflatie per jaar',S.params.inflatie],['Btw-percentage',S.params.btwPercentage],['Begroting',S.params.btwWeergave==='incl'?'inclusief btw':'exclusief btw'],['Discontovoet',S.params.discontovoet],['Budgetplafond per jaar',S.params.budgetplafond??''],[],['Aspect','Profiel','Minimum','Definitief','Factor'],...ASP.map((a,i)=>[a,(S.profielen[S.params.profiel]||[])[i],S.params.minimum[i],C.calc.bel[i],C.calc.fac[i]]),[],['ID','Maatregel/besluit','Gepland jaar','Status','Toelichting'],...C.state.besluiten.map(b=>[b.id,b.maatregel,b.jaar,b.status,b.toelichting])];
  const s02 = [['ID','Object','Element','Locatie','Constatering','NEN gebrek','Ernst','Intensiteit','Totaal','Eenheid','Met gebrek','Omvang %','Conditie','Ontwikkeling','Inspecteerbaarheid','Bewijs','Onderzoek','Toelichting','Elementcode','Std maatregel','Kengetal','Kosten element','Kosten lokaal','Omslag maatregel','Omslag effectief','Begrotingswijze','Eerste voorstel','NEN code','Bibliotheek omschrijving','Bron']];
  R.forEach(r=>{const i=r.insp; s02.push([r.id,i.object,i.element,i.locatie,i.constatering,i.gebrek,i.ernst,i.intensiteit,i.hoevTotaal,i.eenheid,i.hoevGebrek,r.omvang,i.conditie,i.ontwikkeling,i.inspecteerbaarheid,i.bewijs,i.onderzoek,i.toelichting,i.elementcode,i.maatregel,i.kengetal,r.kostenElement,r.kostenLokaal,i.omslagMaatregel,r.omslagEff,r.begrotingswijze,r.eersteVoorstel,i.nenCode,r.libE?.omschrijving||'',i._rawRef?`${i._rawRef.bestand} r${i._rawRef.rij}`:'']);});
  const s03 = [['ID','Element','Faalwijze','bron','O','bron','Onderbouwing O','D','bron','Onderbouwing D','T-klasse','T jaar','bron','Onderbouwing T',...ASP.map(a=>'Effect '+a),'bron effecten','Onderbouwing effecten','Maatregel','bron','Rest S','Rest O','Rest D','Rest toelichting','Kosten specialist','bron','Onderbouwing kosten','Definitieve kosten','Scope-override','Onderbouwing scope','Aanvullend onderzoek','AI-model','AI vertrouwen','AI onzekerheden']];
  R.forEach(r=>{const s=r.sp,p=s.prov||{},ai=C.state.ai[r.id]; const b=k=>p[k]?.bron||'sys'; s03.push([r.id,r.insp.element,r.faalwijze,b('faalwijze'),r.O,b('O'),s.onderbouwingO,r.D,b('D'),s.onderbouwingD,r.Tklasse,r.Tjaar,b('Tjaar'),s.onderbouwingT,...r.effect,b('effect'),s.onderbouwingEffect,s.maatregel,b('maatregel'),s.restS,s.restO,s.restD,s.restToelichting,s.kostenSpecialist,b('kostenSpecialist'),s.onderbouwingKosten,r.definitieveKosten,s.scopeOverride,s.onderbouwingScope,s.aanvullendOnderzoek,ai?._model||'',ai?.vertrouwen||'',(ai?.onzekerheden||[]).join('; ')]);});
  const s04 = [['ID','Element','O','D','T jaar',...ASP.map(a=>'Effect '+a),...ASP.map(a=>'Waarde-impact '+a),'S tech','RPN tech','S waarde','RPN waarde','Basisprio','Safety','Compliance','T-prio','NEN signaal','Definitieve prioriteit','Laatste acceptabele jaar','Technische deadline','Dominant tech','Dominant waarde','Kosten','Kostenbron','Status']];
  s04[0].splice(5, 0, 'T bron', 'T levensduur bouwdeel', 'T afleiding');
  R.forEach(r=>s04.push([r.id,r.insp.element,r.O,r.D,r.Tjaar,r.tInfo?.bron||'',r.tInfo?.L??'',r.tInfo?.uitleg||'',...r.effect,...r.impact,r.Stech,r.RPNtech,r.Swaarde,r.RPNwaarde,r.basis,r.safety,r.compliance,r.tPrio,r.nenSignaal,r.prio,r.laatsteJaar,r.deadline,r.domTech,r.domWaarde,r.definitieveKosten,r.kostenbron,r.status]));
  const s05 = [['ID','Element','Prioriteit','Laatste acceptabele jaar','Technische deadline','Handeling','Jaar','Kosten (prijspeil '+(S.params.prijspeil??S.params.startjaar)+')','Kosten geïndexeerd','Indexfactor','Cyclus','Tot',...C.calc.jaren]];
  R.forEach(r=>r.maatregelen.forEach(m=>s05.push([r.id,r.insp.element,r.prio,r.laatsteJaar,r.deadline,m.handeling,m.jaar,m.kosten,m.jaar!=null&&m.kosten!=null?m.kosten*(C.calc.idx[m.jaar]??C.indexFactor(m.jaar)):'',m.jaar!=null?Math.round((C.calc.idx[m.jaar]??C.indexFactor(m.jaar))*10000)/10000:'',m.cyclus,m.tot,...C.calc.jaren.map(j=>m.jaren.includes(j)?(m.kosten||0):0)])));
  s05.push(['','Totaal prijspeil','','','','','',C.calc.totaal,'','','','',...C.calc.perJaar]);
  s05.push(['','Totaal geïndexeerd','','','','','','',C.calc.totaalIndex,'','','',...C.calc.perJaarIndex]);
  s05.push(['','Totaal incl. btw','','','','','','','','','','',...C.calc.perJaarBtw]);
  s05.push(['','Contante waarde (NPV)','','','','','','','','','','',...C.calc.perJaarNpv]);
  let s07 = [['Conditieprognose kon niet worden berekend']];
  try { const pg = C.conditiePrognose();
    s07 = [['ID','Element','Prioriteit','Conditie nu','T (jaar)','Levensduur bouwdeel','Curve','Gewicht (hoeveelheid)','', ...C.calc.jaren],
      ...pg.rijen.map(x=>[x.id,x.element,x.prio,x.nu,x.T,x.L,x.vorm,x.gewicht,'met plan',...x.met]),
      ...pg.rijen.map(x=>[x.id,x.element,x.prio,x.nu,x.T,x.L,x.vorm,x.gewicht,'zonder ingrijpen',...x.zonder]),
      [], ['','Gemiddeld met plan','','','','','','','',...pg.gemMet.map(v=>Math.round(v*100)/100)],
      ['','Gemiddeld zonder ingrijpen','','','','','','','',...pg.gemZonder.map(v=>Math.round(v*100)/100)],
      ['','Regels conditie >= 5 met plan','','','','','','','',...pg.slechtMet]];
  } catch (e) { s07 = [['Conditieprognose kon niet worden berekend', e.message]]; }
  let s08 = [['Geen scenario\'s beschikbaar']];
  try { const res = window.STEMI_UI.evalueerAlle();
    s08 = [['Kerncijfer', ...res.map(r=>r.def.naam)],
      ['Aanpak', ...res.map(r=>(C.SCENARIO_STRATEGIE.find(x=>x[0]===r.def.strategie)||[])[1]||r.def.strategie)],
      ['Alleen prioriteiten', ...res.map(r=>(r.def.prios||[]).join(' ')||'alle')],
      ['Budgetplafond per jaar', ...res.map(r=>r.def.plafond??'')],
      ['Totaal prijspeil', ...res.map(r=>r.totaal)], ['Totaal geïndexeerd', ...res.map(r=>r.totaalIndex)],
      ['Contante waarde (NPV)', ...res.map(r=>r.totaalNpv)],
      ['Piekjaar', ...res.map(r=>r.piek.jaar)], ['Piekbedrag', ...res.map(r=>r.piek.bedrag)],
      ['Handelingen verschoven', ...res.map(r=>r.geschoven)],
      ['Voorbij laatste acceptabele jaar', ...res.map(r=>r.teLaat)], ['Voorbij technische deadline', ...res.map(r=>r.naDeadline)],
      ['Niet uitgevoerd (aantal)', ...res.map(r=>r.nietUitgevoerd.n)], ['Niet uitgevoerd (kosten)', ...res.map(r=>r.nietUitgevoerd.kosten)],
      ['Onbehandeld risico (som RPN)', ...res.map(r=>Math.round(r.nietUitgevoerd.rpn))],
      ['Gemiddelde conditie jaar 5', ...res.map(r=>Math.round(r.conditie.jaar5*100)/100)],
      ['Gemiddelde conditie jaar 15', ...res.map(r=>Math.round(r.conditie.jaar15*100)/100)],
      ['Gemiddelde conditie einde horizon', ...res.map(r=>Math.round(r.conditie.eind*100)/100)],
      ['Regels conditie >= 5 in jaar 15', ...res.map(r=>r.conditie.slecht15)],
      [], ['Omschrijving', ...res.map(r=>r.def.omschrijving||'')],
      [], ['Kosten per jaar (geïndexeerd)'], ['Jaar', ...res.map(r=>r.def.naam)],
      ...C.calc.jaren.map((j,i)=>[j, ...res.map(r=>r.perJaarIndex[i])])];
  } catch (e) { s08 = [['Scenario\'s konden niet worden berekend', e.message]]; }
  const s06 = [['Beslisregels (JSON)'],[JSON.stringify(S.rules)],[],['O-score','Classificatie','Omschrijving'],...S.scorekaarten.O.map(o=>[o.score,o.classificatie||o.kans,o.omschrijving||o.betekenis]),[],['D-score','Detecteerbaarheid','Criterium'],...S.scorekaarten.D.map(d=>[d.score,d.detect,d.criterium]),[],['S-score','Generiek',...ASP],...S.scorekaarten.S.map(s=>[s.score,s.generiek,...s.aspecten])];
  const s09 = [['Aspect',...Object.keys(S.profielen)],...ASP.map((a,i)=>[a,...Object.keys(S.profielen).map(p=>S.profielen[p][i])])];
  const sA = [['Tijd','Regel','Veld','Oud','Nieuw','Bron','Model','Opmerking'],...C.state.audit.map(a=>[a.ts,a.regel??'',a.veld??'',JSON.stringify(a.oud??''),JSON.stringify(a.nieuw??''),a.bron??'',a.model??'',a.opmerking??''])];
  [['01 Eigenaar-AM',s01],['02 Inspectie',s02],['03 Specialist',s03],['04 Systeemmodel',s04],['05 MJOP',s05],['06 Scorekaarten',s06],['07 Conditieprognose',s07],['08 Scenarios',s08],['09 Profielbibliotheek',s09],['Audittrail',sA]].forEach(([n,d])=>XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d), n));
  XLSX.writeFile(wb, `STEMI_FMECA_MJOP_${new Date().toISOString().slice(0,10)}.xlsx`);
}
window.STEMI_UI = window.STEMI_UI || {}; Object.assign(window.STEMI_UI, { renderOverzicht, renderSysteem, renderInstellingen, renderUitleg, exportXlsx });
})();
