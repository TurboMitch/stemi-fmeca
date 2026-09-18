/* Assetmanager-wizard: 09 profielbibliotheek → 06 scorekaarten & beslisregels → 01 AM-parameters → samenvatting */
(() => {
const C = window.STEMI; const { $, $$, esc, num, ASP, pill } = C;
let step = 0;
const STEPS = ['1 · Profielbibliotheek (09)','2 · Scorekaarten & beslisregels (06)','3 · Eigenaar / AM-parameters (01)','4 · Samenvatting'];

function render() {
  const el = $('#tab-eigenaar'); const S = C.state.settings;
  el.innerHTML = `
    <h2>01 Eigenaar / Assetmanager – wizard</h2>
    <p class="sub">Beleidsmatige kaders in de volgorde profielbibliotheek → scorekaarten → objectparameters. Samen vormen ze het <b>instellingenprofiel</b> “${esc(S.naam)}”. <span class="tag">PAARS/BLAUW</span></p>
    <div class="steps">${STEPS.map((s,i)=>`<button class="step ${i===step?'active':''} ${i<step?'done':''}" data-step="${i}">${s}</button>`).join('')}</div>
    <div id="wizBody"></div>
    <div class="toolbar" style="margin-top:14px"><button class="btn ghost" id="wizPrev" ${step===0?'disabled':''}>← Vorige</button><span class="spacer"></span>${step<3?'<button class="btn" id="wizNext">Volgende →</button>':'<button class="btn" id="wizDone">Profiel vastleggen</button>'}</div>
    <h3>MJOP-besluiten per FMECA-regel</h3><p class="note">Vul pas in nadat het systeemmodel prioriteit en technische deadline heeft bepaald. Meerdere handelingen per element regel je in 05 MJOP.</p>
    <div class="tablewrap"><table><thead><tr><th>ID</th><th>Element</th><th>Systeemprio</th><th>Uiterlijk</th><th>Techn. deadline</th><th class="wrap">Voorgestelde maatregel (specialist)</th><th class="wrap">Maatregel / besluit (AM)</th><th>Gepland jaar</th><th>Kosten</th><th>Status</th><th class="wrap">Toelichting / acceptatie</th></tr></thead><tbody>
    ${C.calc.rows.map(r=>`<tr><td>${r.id}</td><td>${esc(r.insp.element)}</td><td>${pill(r.prio)}</td><td>${r.laatsteJaar??'—'}</td><td>${r.deadline??'—'}</td><td class="wrap">${esc(r.sp.maatregel||'')}</td><td class="blauw"><textarea data-bes="${r.id}" data-k="maatregel">${esc(r.bes.maatregel||'')}</textarea></td><td class="blauw"><input class="n" data-bes="${r.id}" data-k="jaar" value="${esc(r.bes.jaar??'')}" placeholder="${r.laatsteJaar??''}"></td><td class="num">${C.eur(r.definitieveKosten)}</td><td class="blauw"><select data-bes="${r.id}" data-k="status">${['','Voorgesteld','Goedgekeurd','Uitgesteld','Risico geaccepteerd','Afgewezen'].map(s=>`<option ${s===(r.bes.status||'')?'selected':''}>${s}</option>`).join('')}</select></td><td class="blauw"><textarea data-bes="${r.id}" data-k="toelichting">${esc(r.bes.toelichting||'')}</textarea></td></tr>`).join('')}
    </tbody></table></div>`;
  [renderProfielen, renderScorekaarten, renderParams, renderSamenvatting][step]($('#wizBody'));
  $$('.step').forEach(b => b.onclick = () => { step = +b.dataset.step; render(); });
  const prev=$('#wizPrev'); if(prev) prev.onclick = () => { step--; render(); };
  const next=$('#wizNext'); if(next) next.onclick = () => { step++; render(); };
  const done=$('#wizDone'); if(done) done.onclick = () => { S.wizardVoltooid = true; C.audit({veld:'instellingenprofiel', bron:'mens', nieuw:S.naam, opmerking:'Wizard vastgelegd'}); C.save(); C.toast('Instellingenprofiel vastgelegd'); step=0; window.STEMI_UI.renderAll(); };
  $$('[data-bes]').forEach(i => i.onchange = () => { const id=+i.dataset.bes; let b=C.state.besluiten.find(x=>x.id===id); if(!b){b={id};C.state.besluiten.push(b);} b[i.dataset.k] = i.dataset.k==='jaar' ? num(i.value) : i.value; C.audit({regel:id, veld:'besluit.'+i.dataset.k, nieuw:i.value, bron:'mens'}); C.save(); window.STEMI_UI.renderAll('eigenaar'); });
}

function renderProfielen(el) {
  const S = C.state.settings, names = Object.keys(S.profielen);
  el.innerHTML = `<div class="card"><h3 style="margin-top:0">Profielbibliotheek – NEN 8026 waardekompassen</h3>
    <p class="note">Organisatie-eigen beleidswaarden per gebouwtype (0 = niet relevant, 5 = randvoorwaardelijk). Geen voorgeschreven NEN-waarden. Kies in stap 3 welk profiel voor dit object geldt.</p>
    <div class="tablewrap"><table><thead><tr><th>Aspect</th>${names.map(p=>`<th>${esc(p)} <button class="btn ghost small" data-delprof="${esc(p)}" title="verwijderen">✕</button></th>`).join('')}</tr></thead><tbody>
    ${ASP.map((a,i)=>`<tr><td>${a}</td>${names.map(p=>`<td><input class="n" data-prof="${esc(p)}" data-i="${i}" value="${esc(S.profielen[p][i])}"></td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
    <div class="toolbar"><input id="newProf" placeholder="Nieuw profiel (bijv. Zorg)"><button class="btn ghost" id="addProf">+ Profiel toevoegen</button></div></div>`;
  $$('[data-prof]').forEach(i => i.onchange = () => { S.profielen[i.dataset.prof][+i.dataset.i] = Math.min(5,Math.max(0,num(i.value)??0)); C.save(); C.recompute(); });
  $('#addProf').onclick = () => { const n=$('#newProf').value.trim(); if(!n||S.profielen[n]) return; S.profielen[n]=[5,5,3,3,3,3,3,3]; C.save(); render(); };
  $$('[data-delprof]').forEach(b => b.onclick = () => { if(names.length<=1) return; if(!confirm('Profiel verwijderen?')) return; delete S.profielen[b.dataset.delprof]; if(S.params.profiel===b.dataset.delprof) S.params.profiel=Object.keys(S.profielen)[0]; C.save(); render(); });
}

function renderScorekaarten(el) {
  const S = C.state.settings, R = S.rules, K = S.scorekaarten;
  const thr = (name, list, key, label) => `<div class="card"><b>${label}</b><table class="mini"><thead><tr><th>${key==='max'?'t.e.m.':'vanaf'}</th><th>Prioriteit</th></tr></thead><tbody>${list.map((x,i)=>`<tr><td><input class="n" data-rule="${name}" data-i="${i}" data-k="${key}" value="${x[key]}"></td><td><select data-rule="${name}" data-i="${i}" data-k="prio">${C.PRIOS.map(p=>`<option ${p===x.prio?'selected':''}>${p}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`;
  el.innerHTML = `
    <p class="note">Het beleidsmatige hart van het model. Alles hieronder is organisatie-eigen en wordt opgeslagen in het instellingenprofiel.</p>
    <div class="grid two">
      <div class="card"><h3 style="margin-top:0">O-score (kans binnen ${S.params.oRef} jaar)</h3><table class="mini"><thead><tr><th>Score</th><th>Kansband</th><th>Betekenis</th></tr></thead><tbody>${K.O.map((o,i)=>`<tr><td>${o.score}</td><td><input data-sk="O" data-i="${i}" data-k="kans" value="${esc(o.kans)}"></td><td><input data-sk="O" data-i="${i}" data-k="betekenis" value="${esc(o.betekenis)}"></td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h3 style="margin-top:0">D-score (detecteerbaarheid; hoger = slechter)</h3><table class="mini"><thead><tr><th>Score</th><th>Detecteerbaarheid</th><th>Praktisch criterium</th></tr></thead><tbody>${K.D.map((d,i)=>`<tr><td>${d.score}</td><td><input data-sk="D" data-i="${i}" data-k="detect" value="${esc(d.detect)}"></td><td><input data-sk="D" data-i="${i}" data-k="criterium" value="${esc(d.criterium)}"></td></tr>`).join('')}</tbody></table></div>
    </div>
    <h3>Beslisregels prioritering</h3>
    <div class="grid four">
      ${thr('rpn',R.rpn,'min','RPN waarde → basisprioriteit (rest = P5)')}
      ${thr('safety',R.safety,'min','Safety-override (effect Veiligheid)')}
      ${thr('compliance',R.compliance,'min','Compliance-override (effect Compliance)')}
      ${thr('tPrio',R.tPrio,'max','T-prioriteit (jaar tot functieverlies; rest = P5)')}
    </div>
    <div class="grid three" style="margin-top:14px">
      <div class="card"><b>Laatste acceptabele jaar (offset t.o.v. startjaar)</b><table class="mini"><tbody>${C.PRIOS.map(p=>`<tr><td>${pill(p)}</td><td><input class="n" data-lj="${p}" value="${R.laatsteJaar[p]??''}" placeholder="—"></td></tr>`).join('')}</tbody></table></div>
      <div class="card"><b>Systeemvoorstel O</b><table class="mini"><tbody><tr><td>Basis</td><td><input class="n" data-ov="basis" value="${R.oVoorstel.basis}"></td></tr>${Object.keys(R.oVoorstel.intensiteit).map(k=>`<tr><td>+ ${k}</td><td><input class="n" data-ovi="${k}" value="${R.oVoorstel.intensiteit[k]}"></td></tr>`).join('')}${R.oVoorstel.omvang.map((o,i)=>`<tr><td>+ bij omvang ≥ <input class="n" data-ovo="${i}" data-k="min" value="${o.min}"></td><td><input class="n" data-ovo="${i}" data-k="add" value="${o.add}"></td></tr>`).join('')}<tr><td>+ bij conditie ≥ <input class="n" data-ov="conditieVanaf" value="${R.oVoorstel.conditieVanaf}"></td><td><input class="n" data-ov="conditieAdd" value="${R.oVoorstel.conditieAdd}"></td></tr></tbody></table></div>
      <div class="card"><b>Systeemvoorstel D (inspecteerbaarheid)</b><table class="mini"><tbody>${Object.keys(R.dVoorstel).map(k=>`<tr><td>${k}</td><td><input class="n" data-dv="${k}" value="${R.dVoorstel[k]}"></td></tr>`).join('')}</tbody></table>
        <b style="display:block;margin-top:10px">T-klassen (jaar)</b><table class="mini"><tbody>${R.tKlassen.map((t,i)=>`<tr><td>${esc(t.klasse)}</td><td><input class="n" data-tk="${i}" value="${t.jaar}"></td></tr>`).join('')}</tbody></table></div>
    </div>
    <h3>S = effectscores per waardeaspect (0–10)</h3>
    <p class="note">${esc(K.sUitleg||'')}</p>
    <div class="tablewrap"><table><thead><tr><th>Score</th><th>Generiek</th>${ASP.map(a=>`<th class="wrap">${a}</th>`).join('')}</tr></thead><tbody>${K.S.map((s,i)=>`<tr><td>${s.score}</td><td><input data-sk="S" data-i="${i}" data-k="generiek" value="${esc(s.generiek)}"></td>${ASP.map((a,j)=>`<td class="wrap"><textarea data-sks="${i}" data-j="${j}">${esc(s.aspecten[j])}</textarea></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <details style="margin-top:10px"><summary>Methodische waarschuwing & beoordelingsregels</summary><pre class="pre">${esc(K.methodischeWaarschuwing||'')}\n\n${esc(K.beoordelingsregels||'')}</pre></details>
    <div class="toolbar" style="margin-top:8px"><button class="btn ghost" id="rulesReset">Beslisregels terug naar Excel-standaard</button></div>`;
  const rerender = () => { C.save(); C.recompute(); };
  $$('[data-sk]').forEach(i => i.onchange = () => { K[i.dataset.sk][+i.dataset.i][i.dataset.k] = i.value; rerender(); });
  $$('[data-sks]').forEach(i => i.onchange = () => { K.S[+i.dataset.sks].aspecten[+i.dataset.j] = i.value; rerender(); });
  $$('[data-rule]').forEach(i => i.onchange = () => { const r=R[i.dataset.rule][+i.dataset.i]; r[i.dataset.k] = i.dataset.k==='prio' ? i.value : num(i.value); rerender(); });
  $$('[data-lj]').forEach(i => i.onchange = () => { R.laatsteJaar[i.dataset.lj] = num(i.value); rerender(); });
  $$('[data-ov]').forEach(i => i.onchange = () => { R.oVoorstel[i.dataset.ov] = num(i.value)??0; rerender(); });
  $$('[data-ovi]').forEach(i => i.onchange = () => { R.oVoorstel.intensiteit[i.dataset.ovi] = num(i.value)??0; rerender(); });
  $$('[data-ovo]').forEach(i => i.onchange = () => { R.oVoorstel.omvang[+i.dataset.ovo][i.dataset.k] = num(i.value)??0; rerender(); });
  $$('[data-dv]').forEach(i => i.onchange = () => { R.dVoorstel[i.dataset.dv] = num(i.value)??8; rerender(); });
  $$('[data-tk]').forEach(i => i.onchange = () => { R.tKlassen[+i.dataset.tk].jaar = num(i.value); rerender(); });
  $('#rulesReset').onclick = () => { if(confirm('Beslisregels en systeemvoorstellen terugzetten naar de Excel-standaard?')) { S.rules = C.defaultRules(); S.scorekaarten = C.clone(C.seed.scorekaarten); rerender(); render(); } };
}

function renderParams(el) {
  const S = C.state.settings, P = S.params, bel = C.belangen(), prof = S.profielen[P.profiel] || [];
  el.innerHTML = `<div class="grid two">
    <div class="card"><h3 style="margin-top:0">Objectparameters (in te vullen door AM)</h3>
      ${[['naam','Naam instellingenprofiel','text',S.naam],['profiel','Waardekompas profiel (B6)','select'],['startjaar','Startjaar MJOP (B7)'],['horizon','MJOP horizon in jaar (B8)'],['oRef','O-referentieperiode in jaar (B9) – organisatiekeuze'],['nenSignaal','NEN technisch signaal vanaf conditie (B10)'],['omslagDefault','Default omslagpercentage integraal uitvoeren 0–1 (B13)']].map(([k,l,t,v])=>`<div class="field"><label>${l}</label>${t==='select'?`<select data-param="${k}">${Object.keys(S.profielen).map(p=>`<option ${p===P.profiel?'selected':''}>${p}</option>`).join('')}</select>`:`<input data-param="${k}" value="${esc(t==='text'?v:P[k])}">`}</div>`).join('')}
    </div>
    <div class="card"><h3 style="margin-top:0">Waardekompas voor dit object</h3>
      <div class="tablewrap"><table><thead><tr><th>Aspect</th><th>Uit profiel</th><th>Minimum (AM)</th><th>Definitief</th><th>Factor</th></tr></thead><tbody>
      ${ASP.map((a,i)=>`<tr><td>${a}</td><td class="num groen">${prof[i]??''}</td><td><input class="n" data-min="${i}" value="${esc(P.minimum[i])}"></td><td class="num"><b>${bel[i]}</b></td><td class="num">${bel[i]/5}</td></tr>`).join('')}
      </tbody></table></div><p class="note">Definitief belang = max(profielwaarde, minimum). Waardefactor = belang / 5. Veiligheid en compliance staan standaard op minimum 5 (randvoorwaardelijk).</p>
    </div></div>`;
  $$('[data-param]').forEach(i => i.onchange = () => { const k=i.dataset.param; if (k==='naam') S.naam=i.value; else P[k] = k==='profiel' ? i.value : (num(i.value) ?? i.value); C.audit({veld:'param.'+k, nieuw:i.value, bron:'mens'}); C.save(); C.recompute(); renderParams(el); });
  $$('[data-min]').forEach(i => i.onchange = () => { P.minimum[+i.dataset.min] = num(i.value) ?? 0; C.save(); C.recompute(); renderParams(el); });
}

function renderSamenvatting(el) {
  const S = C.state.settings, bel = C.belangen();
  el.innerHTML = `<div class="grid two"><div class="card"><h3 style="margin-top:0">Profiel “${esc(S.naam)}”</h3>
    <table class="mini"><tbody><tr><td>Waardekompas</td><td><b>${esc(S.params.profiel)}</b></td></tr><tr><td>Start / horizon</td><td>${S.params.startjaar} / ${S.params.horizon} jaar</td></tr><tr><td>O-referentieperiode</td><td>${S.params.oRef} jaar</td></tr><tr><td>NEN-signaal vanaf</td><td>conditie ${S.params.nenSignaal}</td></tr><tr><td>Omslag integraal</td><td>${C.pct(S.params.omslagDefault)}</td></tr><tr><td>Belang per aspect</td><td>${ASP.map((a,i)=>`${C.ASP_SHORT[i]} ${bel[i]}`).join(' · ')}</td></tr><tr><td>RPN-grenzen</td><td>${S.rules.rpn.map(x=>`${x.prio} ≥ ${x.min}`).join(' · ')}</td></tr><tr><td>Overrides</td><td>Safety ${S.rules.safety.map(x=>`${x.prio}≥${x.min}`).join(', ')} · Compliance ${S.rules.compliance.map(x=>`${x.prio}≥${x.min}`).join(', ')}</td></tr></tbody></table>
    <p class="note">Status: ${S.wizardVoltooid ? '<b>vastgelegd</b>' : '<span class="warn">nog niet vastgelegd</span>'}. Het profiel wordt bij elke berekening gebruikt en gaat mee in JSON-export.</p></div>
    <div class="card"><h3 style="margin-top:0">Profiel exporteren / importeren</h3><p class="note">Zo hergebruik je beleid over meerdere objecten of portefeuilles.</p><button class="btn ghost" id="profExport">Profiel downloaden (JSON)</button> <label class="btn ghost">Profiel laden<input type="file" id="profImport" accept=".json" hidden></label></div></div>`;
  $('#profExport').onclick = () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'})); a.download=`stemi-profiel-${S.naam.replace(/\W+/g,'_')}.json`; a.click(); };
  $('#profImport').onchange = e => { const f=e.target.files[0]; if(!f) return; f.text().then(t=>{ const p=JSON.parse(t); if(!p.rules||!p.params) throw new Error('geen profiel'); C.state.settings = p; C.audit({veld:'instellingenprofiel', bron:'mens', nieuw:p.naam, opmerking:'Profiel geïmporteerd'}); C.save(); window.STEMI_UI.renderAll(); C.toast('Profiel geladen'); }).catch(err=>alert('Ongeldig profiel: '+err.message)); };
}

window.STEMI_UI = window.STEMI_UI || {}; window.STEMI_UI.renderEigenaar = render;
})();
