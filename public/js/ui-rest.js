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
      <div class="card"><h3 style="margin-top:0">MJOP-kosten per jaar (eerste 15 jaar)</h3>${window.STEMI_UI.barChart(C.calc.jaren.slice(0,15), C.calc.perJaar.slice(0,15), {h:360})}</div>
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
const KAP = 250;   // langere tabellen tekenen we niet in één keer: dat maakt een groot project onbruikbaar
const kapAlles = {};
function kapHtml(sleutel, totaal, getoond) {
  if (totaal <= KAP) return '';
  return `<p class="note" style="margin-top:8px">${getoond} van ${totaal} regels getoond. <button class="btn ghost small" data-kap="${sleutel}">${kapAlles[sleutel] ? `alleen de eerste ${KAP} tonen` : `alle ${totaal} tonen (kan traag zijn)`}</button></p>`;
}
const systeemRijen = () => kapAlles.sys ? C.calc.rows : C.calc.rows.slice(0, KAP);

function renderSysteem() {
  const S = C.state.settings, R = S.rules;
  $('#tab-systeem').innerHTML = `
    <h2>04 Systeemmodel</h2><p class="sub">De rekenkern: technisch risico blijft zichtbaar naast waardegestuurd risico; overrides en tijd bepalen de definitieve prioriteit. Alle grenswaarden komen uit het instellingenprofiel <b>${esc(S.naam)}</b> (AM-wizard stap 2).</p>
    <div class="tablewrap"><table><thead><tr><th>ID</th><th>Element</th><th>O</th><th>D</th><th>T</th>${ASP_SHORT.map(a=>`<th>E ${a}</th>`).join('')}${ASP_SHORT.map(a=>`<th>W ${a}</th>`).join('')}<th>S tech</th><th>RPN tech</th><th>S waarde</th><th>RPN waarde</th><th>Basis</th><th>Safety</th><th>Compl.</th><th>T-prio</th><th>NEN signaal</th><th>Definitief</th><th>Uiterlijk</th><th>Deadline</th><th>Dominant tech</th><th>Dominant waarde</th><th>Kosten</th><th>Bron</th><th>Status</th></tr></thead><tbody>
    ${systeemRijen().map(r=>`<tr><td>${r.id}</td><td>${esc(r.insp.element)}</td><td class="num">${r.O??''}</td><td class="num">${r.D??''}</td><td class="num">${r.Tjaar??''}</td>${r.effect.map(e=>`<td class="num">${e}</td>`).join('')}${r.impact.map(e=>`<td class="num groen">${+e.toFixed(1)}</td>`).join('')}<td class="num">${r.Stech}</td><td class="num">${r.RPNtech??''}</td><td class="num">${+r.Swaarde.toFixed(1)}</td><td class="num"><b>${r.RPNwaarde==null?'':Math.round(r.RPNwaarde)}</b></td><td>${pill(r.basis)}</td><td>${pill(r.safety)}</td><td>${pill(r.compliance)}</td><td>${pill(r.tPrio)}</td><td class="wrap">${r.nenSignaal?'<span class="warn">Expliciete beoordeling</span>':''}</td><td>${pill(r.prio)}</td><td>${r.laatsteJaar??'—'}</td><td>${r.deadline??'—'}</td><td>${esc(r.domTech)}</td><td>${esc(r.domWaarde)}</td><td class="num">${eur(r.definitieveKosten)}</td><td>${r.kostenbron}</td><td>${r.status}</td></tr>`).join('')}
    </tbody></table></div>
    ${kapHtml('sys', C.calc.rows.length, systeemRijen().length)}
    ${conditieHtml()}
    <h3>Actieve beslisregels</h3>
    <div class="grid two"><div class="card"><b>RPN waarde → basisprioriteit</b><br>${R.rpn.map(x=>`${x.prio} ≥ ${x.min}`).join(' · ')} · anders P5<br><br><b>Safety-override</b> (effect Veiligheid): ${R.safety.map(x=>`${x.prio} ≥ ${x.min}`).join(' · ')}<br><b>Compliance-override</b>: ${R.compliance.map(x=>`${x.prio} ≥ ${x.min}`).join(' · ')}</div>
    <div class="card"><b>T-prioriteit</b>: ${R.tPrio.map(x=>`${x.prio} ≤ ${x.max} jr`).join(' · ')} · anders P5<br><b>Definitief</b> = strengste van basis, safety, compliance, T.<br><b>Laatste acceptabele jaar</b>: ${C.PRIOS.map(p=>`${p} ${R.laatsteJaar[p]==null?'—':'+'+R.laatsteJaar[p]}`).join(' · ')}.<br><b>Technische deadline</b> = start + ⌈T⌉. <button class="btn ghost small" data-go="eigenaar">Aanpassen in wizard</button></div></div>`;
  $$('[data-go]').forEach(b => b.onclick = () => window.STEMI_UI.switchTab(b.dataset.go));
  $$('[data-kap]').forEach(b => b.onclick = () => { kapAlles[b.dataset.kap] = !kapAlles[b.dataset.kap]; renderSysteem(); });
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
    <div class="card">${window.STEMI_UI.lineChart(jaren, [{naam:'Met de geplande handelingen', waarden:r1(pg.gemMet)}, {naam:'Zonder ingrijpen', waarden:r1(pg.gemZonder), stippel:true}], {w:1600, h:240})}</div>
    <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>ID</th><th>Element</th><th>Prio</th><th>Conditie nu</th><th>T (jr)</th><th>Levensduur</th><th>Curve</th>${jaren.map(j=>`<th>${j}</th>`).join('')}</tr></thead><tbody>
    ${pg.rijen.slice(0,120).map(x=>`<tr><td>${x.id}</td><td>${esc(x.element)}</td><td>${pill(x.prio)}</td><td class="num">${x.nu}</td><td class="num">${x.T==null?'—':Math.round(x.T*10)/10}</td><td class="num note">${x.L}</td><td class="note">${esc(x.vorm)}</td>${x.met.slice(0,n).map(c=>`<td class="num ${kleur(c)}">${Math.round(c*10)/10}</td>`).join('')}</tr>`).join('')}
    <tr><td colspan="7"><b>Gemiddeld met plan</b></td>${r1(pg.gemMet).map(c=>`<td class="num ${kleur(c)}"><b>${c}</b></td>`).join('')}</tr>
    <tr><td colspan="7" class="note">Gemiddeld zonder ingrijpen</td>${r1(pg.gemZonder).map(c=>`<td class="num note">${c}</td>`).join('')}</tr>
    <tr><td colspan="7" class="note">Aantal regels conditie ≥ 5 (met plan)</td>${pg.slechtMet.slice(0,n).map(v=>`<td class="num note">${v}</td>`).join('')}</tr>
    </tbody></table></div>${pg.rijen.length>120?`<p class="note">Eerste 120 van ${pg.rijen.length} regels.</p>`:''}`;
}

// ---------- Instellingen ----------
let libQ = '', modelQ = '', gebruikersLijst = null;
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
/** gebruikers en hun rol; alleen zichtbaar voor beheerders */
function gebruikersHtml() {
  if (!window.STEMI_DB?.isAdmin) return '';
  if (!gebruikersLijst) { gebruikersLijst = []; window.STEMI_DB.alleGebruikers().then(g => { gebruikersLijst = g; renderInstellingen(); }).catch(e => console.warn(e)); return '<div class="card"><h3 style="margin-top:0">Gebruikers</h3><p class="note">ophalen…</p></div>'; }
  return `<div class="card"><h3 style="margin-top:0">Gebruikers en rollen (${gebruikersLijst.length})</h3>
    <p class="note">Een <b>beheerder</b> ziet en beheert alle projecten, de API-sleutel, de foutmeldingen en de back-ups. Een <b>gebruiker</b> ziet alleen de projecten waar hij lid van is; welke rol hij daar heeft (eigenaar, redacteur of lezer) regel je per project in de Projecten-tab.</p>
    <table class="mini"><tbody>${gebruikersLijst.map(g => `<tr><td><b>${esc(g.display_name || g.username)}</b><div class="note">${esc(g.username)}</div></td>
      <td><select data-grol="${g.id}" ${g.id === window.STEMI_DB.user?.id ? 'disabled title="je eigen rol kun je hier niet wijzigen"' : ''}>${['user','admin'].map(r => `<option value="${r}" ${r === g.role ? 'selected' : ''}>${r === 'admin' ? 'beheerder' : 'gebruiker'}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>
    <p class="note">Nieuwe accounts maakt een beheerder aan in Supabase (Authentication → Users, e-mail <code>naam@stemi.local</code>); daarna zijn ze hier en per project toe te wijzen.</p></div>`;
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
      ${gebruikersHtml()}
      <div class="card"><h3 style="margin-top:0">Data & herleidbaarheid</h3>
        <p class="note">Alle invoer, AI-voorstellen, herkomst per veld en de wijzigingshistorie (${C.state.audit.length} regels) staan lokaal in deze browser. Exporteer regelmatig.</p>
        <button class="btn ghost" id="dlJson">Volledige dataset (JSON)</button> <label class="btn ghost">JSON laden<input type="file" id="upJson" accept=".json" hidden></label> <button class="btn ghost" id="dlAudit">Audittrail (CSV)</button>
        <h3>Instellingenprofiel</h3><p class="note">Rekenregels, scorekaarten, profielbibliotheek en parameters beheer je in de AM-wizard (tab 01). Huidig: <b>${esc(S.naam)}</b>.</p><button class="btn ghost" data-go="eigenaar">Naar de wizard</button>
        <h3>Klantsjabloon</h3>
        <p class="note">Alles wat je voor een volgende klant wilt hergebruiken in één bestand: het instellingenprofiel met scorekaarten en beslisregels, de T-regels en levensduren per bouwdeel, de import- en koppelprofielen van je Excel-exports, de bibliotheekoverrides, de huisstijl van het rapport en de AI-context. Geen projectdata. Bij een nieuw project kies je dit bestand als startpunt.</p>
        <p class="note">Dit sjabloon bevat nu: ${Object.keys(S.importProfielen||{}).length} importprofiel(en), ${Object.keys(S.koppelProfielen||{}).length} koppelprofiel(en), ${Object.keys(S.libOverrides||{}).length} bibliotheekoverride(s), ${Object.keys(S.rules?.tRegels?.levensduur||{}).length} bouwdelen met levensduur.</p>
        <button class="btn ghost" id="sjabDown">Klantsjabloon downloaden</button> <label class="btn ghost">Sjabloon toepassen<input type="file" id="sjabUp" accept=".json" hidden></label>
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
  $('#cfgSave').onclick = () => { const kf=$('#cfgKey'); if (kf) C.cfg.apiKey=kf.value.trim(); C.cfg.models = C.cfg.models||{}; $$('[data-model]').forEach(s=>{ if (s.dataset.model==='_default') C.cfg.model = s.value; else C.cfg.models[s.dataset.model] = s.value; }); C.cfg.context=$('#cfgCtx').value; C.cfg.autoAI=$('#cfgAuto').checked; C.saveCfg(true); C.toast('Opgeslagen en gedeeld'); window.STEMI_UI.renderAll('specialist'); };
  $$('[data-grol]').forEach(sel => sel.onchange = async () => {
    const naam = gebruikersLijst.find(g => g.id === sel.dataset.grol)?.username || '';
    if (!confirm(`Rol van ${naam} wijzigen naar ${sel.value === 'admin' ? 'beheerder (ziet alle projecten)' : 'gebruiker (alleen eigen projecten)'}?`)) { renderInstellingen(); return; }
    try { await window.STEMI_DB.zetGebruikersRol(sel.dataset.grol, sel.value); gebruikersLijst = await window.STEMI_DB.alleGebruikers(); C.toast('Rol gewijzigd'); renderInstellingen(); }
    catch (e) { C.toast('Mislukt: ' + e.message, 7000); renderInstellingen(); }
  });
  $('#cfgModels').onclick = fetchModels;
  $('#modelQ').value = modelQ; $('#modelQ').oninput = e => { modelQ = e.target.value; clearTimeout(window._mq); window._mq = setTimeout(() => { $$('[data-model]').forEach(s => { const cur = s.value; s.innerHTML = modelOptions(cur); }); }, 200); };
  $('#cfgTest').onclick = async () => { $('#cfgSave').click(); const out=$('#cfgTestOut'); out.innerHTML='<span class="spin"></span>testen…'; try { const r = await C.callAgent([{role:'user',content:'Antwoord met JSON {"ok":true}'}], true); out.textContent = 'OK – ' + (r.model||''); } catch(e) { out.innerHTML = `<span class="warn">${esc(e.message)}</span>`; } };
  $('#sjabDown').onclick = () => { const sj = C.sjabloonVan(); download(`stemi-klantsjabloon-${(sj.naam||'profiel').replace(/\W+/g,'_')}.json`, JSON.stringify(sj, null, 1), 'application/json'); };
  $('#sjabUp').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => {
      const sj = JSON.parse(t);
      if (!confirm(`Sjabloon "${sj.naam || '?'}" van ${(sj.gemaakt||'').slice(0,10)} toepassen op dit project?\n\nHet instellingenprofiel, de T-regels, de import- en koppelprofielen, de huisstijl en de AI-context worden overschreven. De inspectiedata en de specialistbeoordeling blijven ongemoeid.`)) return;
      C.pasSjabloonToe(sj); window.STEMI_UI.renderAll(); C.toast('Klantsjabloon toegepast', 5000);
    }).catch(err => alert('Ongeldig sjabloon: ' + err.message)); };
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
    <h2>Handleiding &amp; uitleg</h2><p class="sub">Van inspectiebestand naar onderbouwd MJOP, in de volgorde waarin je het doet. Onderaan staan de rollen, de begrippenlijst en de veelgestelde vragen.</p>
    <div class="toolbar"><button class="btn ghost" id="uitPrint">Handleiding printen</button><span class="note">Nieuw bij STEMI? Werk stap 0 t/m 7 één keer door met het voorbeeldproject; dat duurt een half uur en daarna weet je hoe het model denkt.</span></div>

    <div class="card"><h3 style="margin-top:0">In één alinea</h3>
      <p>Een NEN 2767-inspectie zegt wat er kapot is. Dit model zet daar drie dingen bij: <b>wat het betekent</b> als het faalt (effect per waardeaspect, gewogen met het waardekompas van de eigenaar), <b>hoe waarschijnlijk en hoe zichtbaar</b> dat is (O en D), en <b>wanneer</b> het gebeurt (T, uit de restlevensduur). Daaruit rolt een prioriteit, een uiterste uitvoeringsjaar en een bedrag — en dat wordt het MJOP. Elke waarde houdt bij waar hij vandaan komt, dus je kunt bij elk bedrag in het rapport terug naar de inspecteur, de specialist, het AI-voorstel of de systeemregel die hem heeft veroorzaakt.</p></div>

    <h3>Stap 0 · Project aanmaken</h3>
    <div class="card"><p>Projecten-tab → <b>Nieuw project</b>. Kies een startpunt:</p>
      <ul><li><b>Klantsjabloon</b> — je hebt al eens een klant ingericht en dat bestand in Instellingen gedownload: alle instellingen, import- en koppelprofielen, T-regels en huisstijl komen mee. Snelste route.</li>
      <li><b>Instellingenprofiel kopiëren</b> van een bestaand project — zelfde idee, maar vanuit een project in de app.</li>
      <li><b>Leeg</b> — dan doorloop je de wizard helemaal.</li>
      <li><b>Voorbeelddata</b> — om te leren hoe het werkt zonder klantdata aan te raken.</li></ul>
      <p class="note">Je wordt eigenaar van het project. Wie er nog bij mag regel je onder <b>Leden…</b>: redacteur mag invullen en wijzigen, lezer kijkt alleen mee. Wie geen lid is, ziet het project helemaal niet — ook zijn audittrail en AI-runs niet.</p></div>

    <h3>Stap 1 · Kaders vastleggen (tab 01, de assetmanager)</h3>
    <div class="card"><p>Vijf stappen in de wizard. Dit is <b>beleid</b>, geen techniek: het bepaalt hoe het model weegt.</p>
      <ol><li><b>Profielbibliotheek</b> — de waardeaspecten en per objecttype hoe zwaar ze wegen. Voeg eigen aspecten toe als je die nodig hebt; alle afhankelijke tabellen groeien mee.</li>
      <li><b>Scorekaarten en beslisregels</b> — wat O 1 t/m 10 betekent, wat D betekent, en bij welke RPN-waarde iets P1 wordt. Ook de overrides: een effect van 9 op veiligheid is altijd P1, ongeacht de rekensom.</li>
      <li><b>T-bepaling en conditie</b> — levensduur en degradatiecurve per bouwdeelcategorie, en wat een handeling met de conditie doet. Let op de melding welke bouwdeelnamen uit jouw project nog niet in de levensduurtabel staan.</li>
      <li><b>Objectparameters</b> — startjaar, horizon, omslagpercentage, en de financiële kant: prijspeil, inflatie, btw, discontovoet, budgetplafond.</li>
      <li><b>Samenvatting</b> — nalezen en vastleggen.</li></ol>
      <p class="note">Doe dit vóór de import. Alles wat je hier zet, rekent daarna automatisch door in tab 03, 04, 05 en het rapport.</p></div>

    <h3>Stap 2 · Inspectiedata importeren (tab 02)</h3>
    <div class="card"><p>Sleep het inspectiebestand én de kostentabel er in één keer in — het model herkent zelf welk bestand wat is. Daarna het mappingscherm:</p>
      <ul><li><b>Rode blokkades</b> moet je oplossen: dezelfde kolom aan twee velden gekoppeld, tekst op een getalveld, of een verplicht veld leeg. Precies hier ging het bij de eerste echte klantexport mis (een eenheidkolom als hoeveelheid), met een MJOP van € 23 miljoen als gevolg.</li>
      <li><b>Automatische regels</b> zetten omvangpercentages om naar hoeveelheden, leiden de NEN-intensiteit en de gebrekklasse af uit de gebrekcode, en zoeken de bijbehorende bibliotheekcode. Onzekere matches krijg je als aanklikbare kandidaten.</li>
      <li><b>Koppeltabel</b> met kengetallen wordt op elementcode gematcht; per gebrek kiest het model vervangen, herstellen of reinigen.</li>
      <li><b>Datakwaliteitskaart</b> bovenaan zegt welke velden slecht gevuld zijn — en of er tekst in staat die op een instructie aan de AI lijkt.</li></ul>
      <p class="note">Het importprofiel wordt onder de bestandsnaam bewaard, dus de volgende export van dezelfde klant mapt zichzelf.</p></div>

    <h3>Stap 3 · Laten beoordelen en controleren (tab 03)</h3>
    <div class="card"><p><b>AI: alle regels invullen &amp; verifiëren</b> laat de agent per regel faalwijze, O, D, T, de acht effectscores, de maatregel, het restrisico en de kosten voorstellen — elk met onderbouwing. Wat je daarna doet is het eigenlijke werk:</p>
      <ul><li>Het <b>i-icoon</b> bij elk oranje veld toont de volledige herkomst: welke inspectievelden eraan ten grondslag liggen, welk systeemvoorstel eruit kwam, wat de AI ervan maakte en met welke onderbouwing, en wie het daarna heeft gewijzigd.</li>
      <li><b>Geweigerde waarden</b> — de controle laat onmogelijke scores en bedragen zonder controleerbare basis niet door. Die staan in de drawer per regel.</li>
      <li><b>Gesignaleerde waarden</b> — wél overgenomen, maar ze wijken af van het systeemvoorstel. Vooral bij T: wijkt de AI meer dan een factor 4 van het restlevensduurmodel af zonder technische reden, dan moet je ernaar kijken.</li>
      <li><b>Filter en paginering</b> — zoek op element of code, filter op prioriteit, status, herkomst of "alleen met signaal". Met een filter actief kun je de AI ook op alleen die selectie laten lopen.</li>
      <li><b>Referentieset bijwerken</b> — regels waarvan jij O, D en T zelf hebt vastgesteld, worden de maatstaf waaraan de AI-kwaliteit gemeten wordt.</li></ul>
      <p class="note">Een AI-voorstel is een voorstel. De specialist blijft verantwoordelijk; het model maakt alleen zichtbaar waarop hij zijn oordeel baseert.</p></div>

    <h3>Stap 4 · Het risicobeeld lezen (tab 04)</h3>
    <div class="card"><p>Hier rekent het systeem, je vult niets in. Per regel zie je het technische risico náást het waardegestuurde, welke regel de prioriteit bepaalde (RPN, veiligheid, compliance of tijd), het uiterste jaar en de technische deadline. Onderaan de <b>conditieprognose</b>: hoe de NEN-conditie zich ontwikkelt met jouw plan tegenover niets doen. Dat is het antwoord op "wat gebeurt er als we het een paar jaar laten liggen" in techniek in plaats van in geld.</p></div>

    <h3>Stap 5 · Plannen en op budget sturen (tab 05)</h3>
    <div class="card"><p>Per element één of meer <b>handelingen</b>, elk met jaar, kosten en eventueel een cyclus. Kosten voer je in op prijspeil; geïndexeerd, inclusief btw en contant rekent het model erbij — schakel met de weergavekeuze.</p>
      <p><b>Budgetsturing</b>: vul een plafond per jaar in en je krijgt een voorstel welke handelingen schuiven. Het laagste risico schuift eerst, cyclische handelingen blijven staan, en per verschuiving staat erbij of die voorbij het laatste acceptabele jaar of voorbij de technische deadline komt. Jaren die niet binnen het plafond te krijgen zijn, worden gemeld in plaats van stil weggerekend. Toepassen legt elke verschuiving in de audittrail vast.</p></div>

    <h3>Stap 6 · Scenario's vergelijken (tab 07)</h3>
    <div class="card"><p>Dezelfde onderhoudsbehoefte onder verschillende beleidskeuzes: welke prioriteiten je uitvoert, wanneer, en binnen welk plafond. Naast elkaar staan de kosten in drie weergaven, het piekjaar, hoeveel werk te laat komt, wat je bewust laat liggen met het risico dat daarbij hoort, en het conditiebeeld. Dit is het gesprek met de eigenaar: niet "het kost dit", maar "deze keuze kost dat en levert dit risico op".</p></div>

    <h3>Stap 7 · Rapport (tab 06)</h3>
    <div class="card"><p>Eén knop en het volledige klantrapport staat er: managementsamenvatting met kerncijfers en de belangrijkste bevindingen, uitgangspunten, risicobeeld, meerjarenplanning, conditieprognose, scenariovergelijking, onderbouwing per maatregel met herkomst, en bijlagen met de audittrail. <b>Printen</b> geeft een PDF (A4 staand, achtergrondkleuren aanzetten), en er is een download als Word om zelf tekst toe te voegen. De huisstijl — organisatie, logo, accentkleur, voettekst — staat in dezelfde tab.</p></div>

    <h3>Onderhoud van het model zelf</h3>
    <div class="card"><div class="grid two">
      <div><p><b>AI-kwaliteit</b> — leg een referentieset van 30 tot 50 handmatig beoordeelde regels vast en laat modellen die opnieuw beoordelen. Je ziet per veld de afwijking en, belangrijker, hoe vaak het model op dezelfde prioriteit uitkomt. Met kosten per regel, zodat je een duurder model kunt afwegen tegen een betere uitkomst.</p>
      <p><b>Gezondheid</b> (Instellingen) — fouten per soort over de laatste zeven dagen. Kijk hier na een AI-ronde.</p></div>
      <div><p><b>Back-ups</b> — elke nacht automatisch, 30 dagen bewaard, per project terug te zetten via Projecten → Back-ups. Herstellen maakt eerst een back-up van de huidige toestand.</p>
      <p><b>Prullenbak</b> — een verwijderd project houdt alle historie en is terug te zetten. Definitief wissen kan alleen de eigenaar, met bevestiging van de naam.</p></div></div></div>

    <h3>Veelgestelde vragen</h3>
    <div class="card"><table class="mini"><tbody>
      <tr><td><b>De AI vult een bedrag niet in.</b></td><td>Dan is er geen controleerbare basis (hoeveelheid × kengetal) of het bedrag lag buiten de bandbreedte. Vul het kengetal aan in tab 02 of zet het bedrag zelf met een onderbouwing.</td></tr>
      <tr><td><b>Een regel heeft geen T.</b></td><td>Het restlevensduurmodel heeft minstens een intensiteit of een conditiescore nodig, plus een bouwdeel met levensduur. De wizard (stap 3) meldt welke bouwdeelnamen nog ontbreken.</td></tr>
      <tr><td><b>Het MJOP-totaal en de jaarverdeling lopen uiteen.</b></td><td>Regels zonder jaar vallen buiten de planning. Filter in tab 03 op "nog aanvullen" om te zien welke.</td></tr>
      <tr><td><b>Een AI-ronde faalt halverwege.</b></td><td>Meestal credits of een overbelast model. De app probeert automatisch opnieuw; daarna staat er een knop "Mislukte regels opnieuw".</td></tr>
      <tr><td><b>Ik zie een project niet meer.</b></td><td>Of je bent geen lid meer, of het staat in de prullenbak. Een beheerder ziet alles.</td></tr>
      <tr><td><b>Kan de klant meekijken?</b></td><td>Ja: voeg hem als <b>lezer</b> toe aan één project. Hij ziet dan alleen dat project — nu nog wel alle tabbladen daarvan, inclusief de AI-onderbouwing.</td></tr>
      <tr><td><b>Werkt het op een telefoon?</b></td><td>Lezen en lichte correcties gaan; de tabellen schuiven horizontaal met vaste koppen en een vaste eerste kolom. Een volledige inspectie invoeren op een telefoon is het niet — daarvoor is een eigen invoerapp of een koppeling met inspectiesoftware de logische volgende stap.</td></tr>
    </tbody></table></div>

    <h3>Rollen, inputmomenten en verantwoordelijkheden (08)</h3>
    <div class="tablewrap"><table><thead><tr><th>Fase</th><th class="wrap">Input / beslissing</th><th>Wie</th><th>Methodiek</th><th>Kleur</th><th>Output</th><th>Verantw.</th></tr></thead><tbody>${Rl.map(r=>`<tr><td>${esc(r.fase)}</td><td class="wrap">${esc(r.input)}</td><td>${esc(r.wie)}</td><td>${esc(r.methodiek)}</td><td>${esc(r.kleur)}</td><td>${esc(r.output)}</td><td>${esc(r.verantwoordelijkheid)}</td></tr>`).join('')}</tbody></table></div>

    <h3>Begrippenlijst (07)</h3>
    <div class="tablewrap"><table><thead><tr><th>Begrip</th><th class="wrap">Betekenis</th><th class="wrap">Toelichting binnen dit model</th><th>Rol</th></tr></thead><tbody>${W.map(w=>`<tr><td><b>${esc(w.begrip)}</b></td><td class="wrap">${esc(w.betekenis)}</td><td class="wrap">${esc(w.toelichting)}</td><td>${esc(w.rol)}</td></tr>`).join('')}
      <tr><td><b>Prijspeil</b></td><td class="wrap">jaar waarin de kengetallen zijn uitgedrukt</td><td class="wrap">kosten voer je hierop in; indexering naar het uitvoeringsjaar doet het model</td><td>AM</td></tr>
      <tr><td><b>Contante waarde (NPV)</b></td><td class="wrap">toekomstige uitgaven teruggerekend naar nu</td><td class="wrap">met de discontovoet uit tab 01; maakt uitstellen financieel vergelijkbaar</td><td>AM</td></tr>
      <tr><td><b>Restlevensduur</b></td><td class="wrap">resterende technische levensduur van een bouwdeel</td><td class="wrap">basis voor T: levensduur × restfactor van de degradatiecurve</td><td>Specialist</td></tr>
      <tr><td><b>Referentieset</b></td><td class="wrap">door mensen vastgestelde waarden als maatstaf</td><td class="wrap">waaraan de AI-kwaliteit per model wordt gemeten</td><td>Specialist</td></tr>
    </tbody></table></div>`;
  $('#uitPrint').onclick = () => {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><title>STEMI – handleiding</title>
      <style>@page{size:A4 portrait;margin:18mm 14mm}body{font:10pt/1.45 "Segoe UI",Arial,sans-serif;color:#1b1f23}
      h2{font-size:18pt;color:#12776a}h3{font-size:12pt;color:#12776a;border-bottom:1px solid #12776a;padding-bottom:2px;margin-top:1.4em;page-break-after:avoid}
      .card{border:1px solid #d5dbe0;border-radius:6px;padding:8px 10px;margin:.4em 0;page-break-inside:avoid}
      table{border-collapse:collapse;width:100%;font-size:8.5pt;margin:.4em 0}th,td{border:1px solid #d5dbe0;padding:3px 5px;text-align:left;vertical-align:top}th{background:#f1f4f6}
      .note{font-size:8pt;color:#5d6a75}.toolbar,button{display:none}.sub{color:#4a5560}.grid.two{display:block}</style></head>
      <body>${$('#tab-uitleg').innerHTML}</body></html>`);
    w.document.close(); setTimeout(() => w.print(), 300);
  };
  $$('[data-go]', $('#tab-uitleg')).forEach(b => b.onclick = () => window.STEMI_UI.switchTab(b.dataset.go));
}

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
