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
    <h3>Actieve beslisregels</h3>
    <div class="grid two"><div class="card"><b>RPN waarde → basisprioriteit</b><br>${R.rpn.map(x=>`${x.prio} ≥ ${x.min}`).join(' · ')} · anders P5<br><br><b>Safety-override</b> (effect Veiligheid): ${R.safety.map(x=>`${x.prio} ≥ ${x.min}`).join(' · ')}<br><b>Compliance-override</b>: ${R.compliance.map(x=>`${x.prio} ≥ ${x.min}`).join(' · ')}</div>
    <div class="card"><b>T-prioriteit</b>: ${R.tPrio.map(x=>`${x.prio} ≤ ${x.max} jr`).join(' · ')} · anders P5<br><b>Definitief</b> = strengste van basis, safety, compliance, T.<br><b>Laatste acceptabele jaar</b>: ${C.PRIOS.map(p=>`${p} ${R.laatsteJaar[p]==null?'—':'+'+R.laatsteJaar[p]}`).join(' · ')}.<br><b>Technische deadline</b> = start + ⌈T⌉. <button class="btn ghost small" data-go="eigenaar">Aanpassen in wizard</button></div></div>`;
  $$('[data-go]').forEach(b => b.onclick = () => window.STEMI_UI.switchTab(b.dataset.go));
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
function renderInstellingen() {
  const S = C.state.settings, ov = S.libOverrides || {};
  const q = libQ.trim().toLowerCase(); const hits = q ? C.lib.filter(e => (e.code+' '+e.bouwdeel+' '+e.omschrijving+' '+e.faalwijze).toLowerCase().includes(q)).slice(0,60) : C.lib.filter(e=>ov[e.code]).slice(0,60);
  $('#tab-instellingen').innerHTML = `
    <h2>Instellingen</h2>
    <div class="grid two">
      <div class="card"><h3 style="margin-top:0">OpenRouter-agents</h3>
        <div class="field"><label>API-sleutel (gedeeld met alle gebruikers via Supabase; alternatief: env OPENROUTER_API_KEY op Vercel)</label><input type="password" id="cfgKey" value="${esc(C.cfg.apiKey||'')}" placeholder="sk-or-v1-…"></div>
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
  $('#cfgSave').onclick = () => { C.cfg.apiKey=$('#cfgKey').value.trim(); C.cfg.models = C.cfg.models||{}; $$('[data-model]').forEach(s=>{ if (s.dataset.model==='_default') C.cfg.model = s.value; else C.cfg.models[s.dataset.model] = s.value; }); C.cfg.context=$('#cfgCtx').value; C.cfg.autoAI=$('#cfgAuto').checked; C.saveCfg(); C.toast('Opgeslagen en gedeeld'); window.STEMI_UI.renderAll('specialist'); };
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
    <ol><li><b>Eigenaar / assetmanager</b> (paars/blauw) – legt via de wizard het instellingenprofiel vast: profielbibliotheek (09), scorekaarten & beslisregels (06), objectparameters (01). Neemt later MJOP-besluiten.</li><li><b>NEN 2767-inspecteur</b> (geel) – levert objectieve technische evidence als data (ruw of gestandaardiseerd) in 02.</li><li><b>Technisch specialist / ME</b> (oranje) – in 03 vult de AI alle velden (faalwijze, O, D, T, effecten, maatregel, restrisico, kosten) op basis van 02 en de gebrekenbibliotheek; verifieert en overschrijft onderbouwd; de specialist controleert. Elke waarde heeft een herkomst en historie.</li><li><b>Systeemmodel</b> (groen, 04) – rekenkern op het instellingenprofiel: technisch én waardegestuurd risico, overrides, T-prioriteit, definitieve prioriteit.</li><li><b>Assetmanager-besluit</b> (blauw) – maatregel, jaar, budget, acceptatie restrisico.</li><li><b>MJOP</b> (groen, 05) – handelingen met moment, kosten en cyclus over de horizon.</li></ol></div>
    <h3>08 Rollen, inputmomenten en verantwoordelijkheden</h3>
    <div class="tablewrap"><table><thead><tr><th>Fase</th><th class="wrap">Input / beslissing</th><th>Wie</th><th>Methodiek</th><th>Kleur</th><th>Output</th><th>Verantw.</th></tr></thead><tbody>${Rl.map(r=>`<tr><td>${esc(r.fase)}</td><td class="wrap">${esc(r.input)}</td><td>${esc(r.wie)}</td><td>${esc(r.methodiek)}</td><td>${esc(r.kleur)}</td><td>${esc(r.output)}</td><td>${esc(r.verantwoordelijkheid)}</td></tr>`).join('')}</tbody></table></div>
    <h3>07 Woordenlijst</h3>
    <div class="tablewrap"><table><thead><tr><th>Begrip</th><th class="wrap">Betekenis</th><th class="wrap">Toelichting binnen dit model</th><th>Rol</th></tr></thead><tbody>${W.map(w=>`<tr><td><b>${esc(w.begrip)}</b></td><td class="wrap">${esc(w.betekenis)}</td><td class="wrap">${esc(w.toelichting)}</td><td>${esc(w.rol)}</td></tr>`).join('')}</tbody></table></div>`;
}

// ---------- Excel-export ----------
function exportXlsx() {
  const wb = XLSX.utils.book_new(), R = C.calc.rows, S = C.state.settings;
  const s01 = [['Parameter','Waarde'],['Instellingenprofiel',S.naam],['Waardekompas profiel',S.params.profiel],['Startjaar',S.params.startjaar],['Horizon',S.params.horizon],['O-referentieperiode',S.params.oRef],['NEN signaal vanaf conditie',S.params.nenSignaal],['Default omslag',S.params.omslagDefault],[],['Aspect','Profiel','Minimum','Definitief','Factor'],...ASP.map((a,i)=>[a,(S.profielen[S.params.profiel]||[])[i],S.params.minimum[i],C.calc.bel[i],C.calc.fac[i]]),[],['ID','Maatregel/besluit','Gepland jaar','Status','Toelichting'],...C.state.besluiten.map(b=>[b.id,b.maatregel,b.jaar,b.status,b.toelichting])];
  const s02 = [['ID','Object','Element','Locatie','Constatering','NEN gebrek','Ernst','Intensiteit','Totaal','Eenheid','Met gebrek','Omvang %','Conditie','Ontwikkeling','Inspecteerbaarheid','Bewijs','Onderzoek','Toelichting','Elementcode','Std maatregel','Kengetal','Kosten element','Kosten lokaal','Omslag maatregel','Omslag effectief','Begrotingswijze','Eerste voorstel','NEN code','Bibliotheek omschrijving','Bron']];
  R.forEach(r=>{const i=r.insp; s02.push([r.id,i.object,i.element,i.locatie,i.constatering,i.gebrek,i.ernst,i.intensiteit,i.hoevTotaal,i.eenheid,i.hoevGebrek,r.omvang,i.conditie,i.ontwikkeling,i.inspecteerbaarheid,i.bewijs,i.onderzoek,i.toelichting,i.elementcode,i.maatregel,i.kengetal,r.kostenElement,r.kostenLokaal,i.omslagMaatregel,r.omslagEff,r.begrotingswijze,r.eersteVoorstel,i.nenCode,r.libE?.omschrijving||'',i._rawRef?`${i._rawRef.bestand} r${i._rawRef.rij}`:'']);});
  const s03 = [['ID','Element','Faalwijze','bron','O','bron','Onderbouwing O','D','bron','Onderbouwing D','T-klasse','T jaar','bron','Onderbouwing T',...ASP.map(a=>'Effect '+a),'bron effecten','Onderbouwing effecten','Maatregel','bron','Rest S','Rest O','Rest D','Rest toelichting','Kosten specialist','bron','Onderbouwing kosten','Definitieve kosten','Scope-override','Onderbouwing scope','Aanvullend onderzoek','AI-model','AI vertrouwen','AI onzekerheden']];
  R.forEach(r=>{const s=r.sp,p=s.prov||{},ai=C.state.ai[r.id]; const b=k=>p[k]?.bron||'sys'; s03.push([r.id,r.insp.element,r.faalwijze,b('faalwijze'),r.O,b('O'),s.onderbouwingO,r.D,b('D'),s.onderbouwingD,r.Tklasse,r.Tjaar,b('Tjaar'),s.onderbouwingT,...r.effect,b('effect'),s.onderbouwingEffect,s.maatregel,b('maatregel'),s.restS,s.restO,s.restD,s.restToelichting,s.kostenSpecialist,b('kostenSpecialist'),s.onderbouwingKosten,r.definitieveKosten,s.scopeOverride,s.onderbouwingScope,s.aanvullendOnderzoek,ai?._model||'',ai?.vertrouwen||'',(ai?.onzekerheden||[]).join('; ')]);});
  const s04 = [['ID','Element','O','D','T jaar',...ASP.map(a=>'Effect '+a),...ASP.map(a=>'Waarde-impact '+a),'S tech','RPN tech','S waarde','RPN waarde','Basisprio','Safety','Compliance','T-prio','NEN signaal','Definitieve prioriteit','Laatste acceptabele jaar','Technische deadline','Dominant tech','Dominant waarde','Kosten','Kostenbron','Status']];
  R.forEach(r=>s04.push([r.id,r.insp.element,r.O,r.D,r.Tjaar,...r.effect,...r.impact,r.Stech,r.RPNtech,r.Swaarde,r.RPNwaarde,r.basis,r.safety,r.compliance,r.tPrio,r.nenSignaal,r.prio,r.laatsteJaar,r.deadline,r.domTech,r.domWaarde,r.definitieveKosten,r.kostenbron,r.status]));
  const s05 = [['ID','Element','Prioriteit','Laatste acceptabele jaar','Technische deadline','Handeling','Jaar','Kosten','Cyclus','Tot',...C.calc.jaren]];
  R.forEach(r=>r.maatregelen.forEach(m=>s05.push([r.id,r.insp.element,r.prio,r.laatsteJaar,r.deadline,m.handeling,m.jaar,m.kosten,m.cyclus,m.tot,...C.calc.jaren.map(j=>m.jaren.includes(j)?(m.kosten||0):0)])));
  s05.push(['','Totaal','','','','','',C.calc.totaal,'','',...C.calc.perJaar]);
  const s06 = [['Beslisregels (JSON)'],[JSON.stringify(S.rules)],[],['O-score','Classificatie','Omschrijving'],...S.scorekaarten.O.map(o=>[o.score,o.classificatie||o.kans,o.omschrijving||o.betekenis]),[],['D-score','Detecteerbaarheid','Criterium'],...S.scorekaarten.D.map(d=>[d.score,d.detect,d.criterium]),[],['S-score','Generiek',...ASP],...S.scorekaarten.S.map(s=>[s.score,s.generiek,...s.aspecten])];
  const s09 = [['Aspect',...Object.keys(S.profielen)],...ASP.map((a,i)=>[a,...Object.keys(S.profielen).map(p=>S.profielen[p][i])])];
  const sA = [['Tijd','Regel','Veld','Oud','Nieuw','Bron','Model','Opmerking'],...C.state.audit.map(a=>[a.ts,a.regel??'',a.veld??'',JSON.stringify(a.oud??''),JSON.stringify(a.nieuw??''),a.bron??'',a.model??'',a.opmerking??''])];
  [['01 Eigenaar-AM',s01],['02 Inspectie',s02],['03 Specialist',s03],['04 Systeemmodel',s04],['05 MJOP',s05],['06 Scorekaarten',s06],['09 Profielbibliotheek',s09],['Audittrail',sA]].forEach(([n,d])=>XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d), n));
  XLSX.writeFile(wb, `STEMI_FMECA_MJOP_${new Date().toISOString().slice(0,10)}.xlsx`);
}
window.STEMI_UI = window.STEMI_UI || {}; Object.assign(window.STEMI_UI, { renderOverzicht, renderSysteem, renderInstellingen, renderUitleg, exportXlsx });
})();
