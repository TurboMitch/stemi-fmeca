/* Assetmanager-wizard: 09 profielbibliotheek → 06 scorekaarten & beslisregels → T-bepaling & conditie → 01 AM-parameters → samenvatting */
(() => {
const C = window.STEMI; const { $, $$, esc, num, ASP, pill } = C;
let step = 0, tQ = '';
const STEPS = ['1 · Profielbibliotheek (09)','2 · Scorekaarten & beslisregels (06)','3 · T-bepaling & conditie','4 · Eigenaar / AM-parameters (01)','5 · Samenvatting'];

function render() {
  const el = $('#tab-eigenaar'); const S = C.state.settings;
  el.innerHTML = `
    <h2>01 Eigenaar / Assetmanager – wizard</h2>
    <p class="sub">Beleidsmatige kaders in de volgorde profielbibliotheek → scorekaarten → objectparameters. Samen vormen ze het <b>instellingenprofiel</b> “${esc(S.naam)}”. <span class="tag">PAARS/BLAUW</span></p>
    <div class="steps">${STEPS.map((s,i)=>`<button class="step ${i===step?'active':''} ${i<step?'done':''}" data-step="${i}">${s}</button>`).join('')}</div>
    <div id="wizBody"></div>
    <div class="toolbar" style="margin-top:14px"><button class="btn ghost" id="wizPrev" ${step===0?'disabled':''}>← Vorige</button><span class="spacer"></span>${step<4?'<button class="btn" id="wizNext">Volgende →</button>':'<button class="btn" id="wizDone">Profiel vastleggen</button>'}</div>
    <h3>MJOP-besluiten per FMECA-regel</h3><p class="note">Vul pas in nadat het systeemmodel prioriteit en technische deadline heeft bepaald. Meerdere handelingen per element regel je in 05 MJOP.</p>
    <div class="tablewrap"><table><thead><tr><th>ID</th><th>Element</th><th>Systeemprio</th><th>Uiterlijk</th><th>Techn. deadline</th><th class="wrap">Voorgestelde maatregel (specialist)</th><th class="wrap">Maatregel / besluit (AM)</th><th>Gepland jaar</th><th>Kosten</th><th>Status</th><th class="wrap">Toelichting / acceptatie</th></tr></thead><tbody>
    ${C.calc.rows.map(r=>`<tr><td>${r.id}</td><td>${esc(r.insp.element)}</td><td>${pill(r.prio)}</td><td>${r.laatsteJaar??'—'}</td><td>${r.deadline??'—'}</td><td class="wrap">${esc(r.sp.maatregel||'')}</td><td class="blauw"><textarea data-bes="${r.id}" data-k="maatregel">${esc(r.bes.maatregel||'')}</textarea></td><td class="blauw"><input class="n" data-bes="${r.id}" data-k="jaar" value="${esc(r.bes.jaar??'')}" placeholder="${r.laatsteJaar??''}"></td><td class="num">${C.eur(r.definitieveKosten)}</td><td class="blauw"><select data-bes="${r.id}" data-k="status">${['','Voorgesteld','Goedgekeurd','Uitgesteld','Risico geaccepteerd','Afgewezen'].map(s=>`<option ${s===(r.bes.status||'')?'selected':''}>${s}</option>`).join('')}</select></td><td class="blauw"><textarea data-bes="${r.id}" data-k="toelichting">${esc(r.bes.toelichting||'')}</textarea></td></tr>`).join('')}
    </tbody></table></div>`;
  [renderProfielen, renderScorekaarten, renderTregels, renderParams, renderSamenvatting][step]($('#wizBody'));
  $$('.step').forEach(b => b.onclick = () => { step = +b.dataset.step; render(); });
  const prev=$('#wizPrev'); if(prev) prev.onclick = () => { step--; render(); };
  const next=$('#wizNext'); if(next) next.onclick = () => { step++; render(); };
  const done=$('#wizDone'); if(done) done.onclick = () => { S.wizardVoltooid = true; C.audit({veld:'instellingenprofiel', bron:'mens', nieuw:S.naam, opmerking:'Wizard vastgelegd'}); C.save(); C.toast('Instellingenprofiel vastgelegd'); step=0; window.STEMI_UI.renderAll(); };
  $$('[data-bes]').forEach(i => i.onchange = () => { const id=+i.dataset.bes; let b=C.state.besluiten.find(x=>x.id===id); if(!b){b={id};C.state.besluiten.push(b);} b[i.dataset.k] = i.dataset.k==='jaar' ? num(i.value) : i.value; C.audit({regel:id, veld:'besluit.'+i.dataset.k, nieuw:i.value, bron:'mens'}); C.save(); window.STEMI_UI.renderAll('eigenaar'); });
}

function renderProfielen(el) {
  const S = C.state.settings, names = Object.keys(S.profielen), K = S.scorekaarten;
  el.innerHTML = `<div class="card"><h3 style="margin-top:0">Waardeaspecten (organisatie-specifiek)</h3>
    <p class="note">Standaard de acht aspecten uit NEN 8026; voeg organisatie-eigen aspecten toe of pas namen en omschrijvingen aan. Effectscores, waardekompas en scorekaarten groeien automatisch mee. De gebrekenbibliotheek levert alleen effectvoorstellen voor de acht standaardaspecten; extra aspecten start je op 0.</p>
    <div class="tablewrap"><table class="mini"><thead><tr><th>#</th><th>Naam</th><th>Kort</th><th class="wrap">Omschrijving / wat valt eronder</th><th>Rol in beslisregels</th><th></th></tr></thead><tbody>
    ${S.aspecten.map((a,i)=>`<tr><td>${i+1}</td><td><input data-asp="${i}" data-k="naam" value="${esc(a.naam)}"></td><td><input class="n" style="width:70px" data-asp="${i}" data-k="kort" value="${esc(a.kort||'')}"></td><td class="wrap"><input data-asp="${i}" data-k="omschrijving" value="${esc(a.omschrijving||'')}"></td><td>${a.naam===S.rules.safetyAspect?'<span class="tag">safety-override</span>':''}${a.naam===S.rules.complianceAspect?'<span class="tag">compliance-override</span>':''}</td><td><button class="btn ghost small" data-delasp="${i}" title="verwijderen">✕</button></td></tr>`).join('')}
    </tbody></table></div>
    <div class="toolbar"><input id="newAspNaam" placeholder="Nieuw aspect (bijv. Reputatie, Circulariteit)"><input id="newAspKort" class="n" style="width:80px" placeholder="kort"><input id="newAspOms" placeholder="omschrijving" style="min-width:260px"><button class="btn ghost" id="addAsp">+ Aspect toevoegen</button></div>
    <div class="grid two" style="margin-top:8px"><div class="field"><label>Aspect dat de safety-override stuurt</label><select data-ruleasp="safetyAspect">${S.aspecten.map(a=>`<option ${a.naam===S.rules.safetyAspect?'selected':''}>${esc(a.naam)}</option>`).join('')}</select></div><div class="field"><label>Aspect dat de compliance-override stuurt</label><select data-ruleasp="complianceAspect">${S.aspecten.map(a=>`<option ${a.naam===S.rules.complianceAspect?'selected':''}>${esc(a.naam)}</option>`).join('')}</select></div></div>
    </div>
    <div class="card" style="margin-top:14px"><h3 style="margin-top:0">Profielbibliotheek – NEN 8026 waardekompassen</h3>
    <p class="note">Organisatie-eigen beleidswaarden per gebouwtype. Geen voorgeschreven NEN-waarden. Kies in stap 3 welk profiel voor dit object geldt.</p>
    <div class="tablewrap"><table><thead><tr><th>Aspect</th>${names.map(p=>`<th>${esc(p)} <button class="btn ghost small" data-delprof="${esc(p)}" title="verwijderen">✕</button></th>`).join('')}</tr></thead><tbody>
    ${ASP.map((a,i)=>`<tr><td>${esc(a)}</td>${names.map(p=>`<td><input class="n" data-prof="${esc(p)}" data-i="${i}" value="${esc(S.profielen[p][i])}"></td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
    <div class="toolbar"><input id="newProf" placeholder="Nieuw profiel (bijv. Zorg)"><button class="btn ghost" id="addProf">+ Profiel toevoegen</button></div>
    <h3>Betekenis van de belangscores 0–5 (overschrijfbaar)</h3>
    <table class="mini"><tbody>${(K.belangSchaal||[]).map((b,i)=>`<tr><td style="width:40px"><b>${b.score}</b></td><td><input data-bs="${i}" value="${esc(b.omschrijving)}"></td></tr>`).join('')}</tbody></table>
    <p class="note">Waardefactor = belang / 5. Belang 5 is randvoorwaardelijk; de AM kan in stap 3 per object minimumwaarden opleggen.</p></div>`;
  const rerender = () => { C.save(); C.recompute(); };
  $$('[data-prof]').forEach(i => i.onchange = () => { S.profielen[i.dataset.prof][+i.dataset.i] = Math.min(5,Math.max(0,num(i.value)??0)); rerender(); });
  $('#addProf').onclick = () => { const n=$('#newProf').value.trim(); if(!n||S.profielen[n]) return; S.profielen[n]=ASP.map(()=>3); C.save(); render(); };
  $$('[data-delprof]').forEach(b => b.onclick = () => { if(names.length<=1) return; if(!confirm('Profiel verwijderen?')) return; delete S.profielen[b.dataset.delprof]; if(S.params.profiel===b.dataset.delprof) S.params.profiel=Object.keys(S.profielen)[0]; C.save(); render(); });
  $$('[data-asp]').forEach(i => i.onchange = () => { const a=S.aspecten[+i.dataset.asp]; const k=i.dataset.k; if (k==='naam') { const old=a.naam; if(!i.value.trim()) return; if (S.rules.safetyAspect===old) S.rules.safetyAspect=i.value.trim(); if (S.rules.complianceAspect===old) S.rules.complianceAspect=i.value.trim(); } a[k]=i.value.trim(); C.syncAspects(); C.audit({veld:'aspect.'+k, nieuw:a[k], bron:'mens'}); rerender(); window.STEMI_UI.renderAll(); });
  $('#addAsp').onclick = () => { const n=$('#newAspNaam').value.trim(); if(!n) return; if (C.addAspect(n, $('#newAspKort').value.trim(), $('#newAspOms').value.trim())) { C.audit({veld:'aspect', nieuw:'toegevoegd: '+n, bron:'mens'}); rerender(); window.STEMI_UI.renderAll(); } else C.toast('Aspect bestaat al'); };
  $$('[data-delasp]').forEach(b => b.onclick = () => { const i=+b.dataset.delasp; const a=S.aspecten[i]; if(!confirm(`Aspect “${a.naam}” verwijderen? Effectscores voor dit aspect gaan verloren.`)) return; if (C.removeAspect(i)) { C.audit({veld:'aspect', nieuw:'verwijderd: '+a.naam, bron:'mens'}); rerender(); window.STEMI_UI.renderAll(); } });
  $$('[data-ruleasp]').forEach(sel => sel.onchange = () => { S.rules[sel.dataset.ruleasp] = sel.value; rerender(); window.STEMI_UI.renderAll(); });
  $$('[data-bs]').forEach(i => i.onchange = () => { K.belangSchaal[+i.dataset.bs].omschrijving = i.value; rerender(); });
}

function renderScorekaarten(el) {
  const S = C.state.settings, R = S.rules, K = S.scorekaarten, OV = R.oVoorstel;
  const thr = (name, list, key, label) => `<div class="card"><b>${label}</b><table class="mini"><thead><tr><th>${key==='max'?'t.e.m.':'vanaf'}</th><th>Prioriteit</th></tr></thead><tbody>${list.map((x,i)=>`<tr><td><input class="n" data-rule="${name}" data-i="${i}" data-k="${key}" value="${x[key]}"></td><td><select data-rule="${name}" data-i="${i}" data-k="prio">${C.PRIOS.map(p=>`<option ${p===x.prio?'selected':''}>${p}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`;
  const vb = (() => { const ex = { intensiteit:'Gevorderd', ontwikkelingKlasse:'Progressief' }; const r = C.systeemvoorstelO(ex, 0.35, true); return r.uitleg; })();
  el.innerHTML = `
    <p class="note">Het beleidsmatige hart van het model: <b>organisatie-eigen FMECA-scorecriteria</b>. Eén tabel definieert wat een score betekent (de scorekaart), een aparte tabel bepaalt transparant het automatische systeemvoorstel (de bepalingsregels). De technisch specialist blijft verantwoordelijk voor de definitieve beoordeling. Alles hieronder is overschrijfbaar en wordt in het instellingenprofiel bewaard.</p>
    <div class="card"><h3 style="margin-top:0">O-scorekaart – Occurrence</h3>
      <div class="field"><label>Definitie</label><textarea data-kdef="Odefinitie" rows="3">${esc(K.Odefinitie||'')}</textarea></div>
      <table class="mini"><thead><tr><th style="width:60px">O-score</th><th style="width:200px">Classificatie</th><th>Omschrijving / beoordelingscriterium</th></tr></thead><tbody>${K.O.map((o,i)=>`<tr><td><b>${o.score}</b></td><td><input data-sk="O" data-i="${i}" data-k="classificatie" value="${esc(o.classificatie||'')}"></td><td><input data-sk="O" data-i="${i}" data-k="omschrijving" value="${esc(o.omschrijving||'')}"></td></tr>`).join('')}</tbody></table>
    </div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3 style="margin-top:0">O-bepalingsregels (automatisch systeemvoorstel)</h3>
        <p class="note">O-systeemvoorstel = MIN(10; basis + intensiteit + omvang + ontwikkeling). De NEN-conditiescore telt niet mee (intensiteit en omvang zitten al in de conditiebepaling; anders dubbeltelling).</p>
        <table class="mini"><thead><tr><th>Parameter inspectie</th><th>Waarde</th><th style="width:90px">Bijdrage O</th></tr></thead><tbody>
        <tr><td>Basiswaarde</td><td>Relevant gebrek aanwezig</td><td><input class="n" data-ov="basis" value="${OV.basis}"></td></tr>
        ${C.INTENSITEIT.map((k,i)=>`<tr><td>${i===0?'Intensiteit':''}</td><td>${k}</td><td><input class="n" data-ovi="${esc(k)}" value="${OV.intensiteit[k]??0}"></td></tr>`).join('')}
        <tr><td>Omvang</td><td>&lt; ${pctOf(OV.omvang,1)}</td><td>+0</td></tr>
        ${OV.omvang.slice().sort((a,b)=>a.min-b.min).map((o,i)=>`<tr><td></td><td>≥ <input class="n" style="width:60px" data-ovo="${OV.omvang.indexOf(o)}" data-k="min" value="${o.min}"> (fractie)</td><td><input class="n" data-ovo="${OV.omvang.indexOf(o)}" data-k="add" value="${o.add}"></td></tr>`).join('')}
        ${C.ONTWIKKELING.map((k,i)=>`<tr><td>${i===0?'Ontwikkeling':''}</td><td>${k}</td><td><input class="n" data-ovw="${esc(k)}" value="${(OV.ontwikkeling||{})[k]??0}"></td></tr>`).join('')}
        <tr><td>NEN-conditie (optioneel)</td><td>vanaf conditie <input class="n" data-ov="conditieVanaf" value="${OV.conditieVanaf??''}" placeholder="uit"></td><td><input class="n" data-ov="conditieAdd" value="${OV.conditieAdd??0}"></td></tr>
        </tbody></table>
        <p class="note"><b>Voorbeeld:</b> ${esc(vb)}</p>
      </div>
      <div class="card"><h3 style="margin-top:0">D-scorekaart – Detectability</h3>
        <div class="field"><label>Definitie</label><textarea data-kdef="Ddefinitie" rows="2">${esc(K.Ddefinitie||'')}</textarea></div>
        <table class="mini"><thead><tr><th style="width:40px">D</th><th style="width:150px">Detecteerbaarheid</th><th>Praktische betekenis</th></tr></thead><tbody>${K.D.map((d,i)=>`<tr><td><b>${d.score}</b></td><td><input data-sk="D" data-i="${i}" data-k="detect" value="${esc(d.detect)}"></td><td><input data-sk="D" data-i="${i}" data-k="criterium" value="${esc(d.criterium)}"></td></tr>`).join('')}</tbody></table>
        <b style="display:block;margin-top:10px">D-bepalingsregels (systeemvoorstel uit inspecteerbaarheid)</b>
        <table class="mini"><thead><tr><th>Inspecteerbaarheid</th><th style="width:70px">D</th><th>Betekenis</th></tr></thead><tbody>${C.INSPECTEERBAAR.map(k=>`<tr><td>${k}</td><td><input class="n" data-dv="${k}" value="${R.dVoorstel[k]}"></td><td class="note">${esc(C.dKlasse(R.dVoorstel[k]))}</td></tr>`).join('')}</tbody></table>
      </div>
    </div>
    <h3>Beslisregels prioritering</h3>
    <div class="grid four">
      ${thr('rpn',R.rpn,'min','RPN waarde → basisprioriteit (rest = P5)')}
      ${thr('safety',R.safety,'min',`Safety-override (effect ${esc(R.safetyAspect)})`)}
      ${thr('compliance',R.compliance,'min',`Compliance-override (effect ${esc(R.complianceAspect)})`)}
      ${thr('tPrio',R.tPrio,'max','T-prioriteit (jaar tot functieverlies; rest = P5)')}
    </div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><b>Laatste acceptabele jaar (offset t.o.v. startjaar)</b><table class="mini"><tbody>${C.PRIOS.map(p=>`<tr><td>${pill(p)}</td><td><input class="n" data-lj="${p}" value="${R.laatsteJaar[p]??''}" placeholder="—"></td></tr>`).join('')}</tbody></table></div>
      <div class="card"><b>T-klassen (verwachte tijd tot functieverlies, jaar)</b><table class="mini"><tbody>${R.tKlassen.map((t,i)=>`<tr><td>${esc(t.klasse)}</td><td><input class="n" data-tk="${i}" value="${t.jaar}"></td></tr>`).join('')}</tbody></table><p class="note">Een faalwijze die al is opgetreden hoort in T = “Reeds aanwezig”, niet in O = 10.</p></div>
    </div>
    <h3>S = effectscores per waardeaspect (0–10)</h3>
    <p class="note">${esc(K.sUitleg||'')}</p>
    <div class="tablewrap"><table><thead><tr><th>Score</th><th>Generiek</th>${ASP.map(a=>`<th class="wrap">${esc(a)}</th>`).join('')}</tr></thead><tbody>${K.S.map((s,i)=>`<tr><td>${s.score}</td><td><input data-sk="S" data-i="${i}" data-k="generiek" value="${esc(s.generiek)}"></td>${ASP.map((a,j)=>`<td class="wrap"><textarea data-sks="${i}" data-j="${j}">${esc(s.aspecten[j]||'')}</textarea></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <details style="margin-top:10px"><summary>Methodische waarschuwing & beoordelingsregels</summary><pre class="pre">${esc(K.methodischeWaarschuwing||'')}\n\n${esc(K.beoordelingsregels||'')}</pre></details>
    <div class="toolbar" style="margin-top:8px"><button class="btn ghost" id="rulesReset">Scorecriteria en beslisregels terug naar standaard</button></div>`;
  const rerender = () => { C.save(); C.recompute(); };
  $$('[data-kdef]').forEach(i => i.onchange = () => { K[i.dataset.kdef] = i.value; rerender(); });
  $$('[data-sk]').forEach(i => i.onchange = () => { K[i.dataset.sk][+i.dataset.i][i.dataset.k] = i.value; rerender(); });
  $$('[data-sks]').forEach(i => i.onchange = () => { K.S[+i.dataset.sks].aspecten[+i.dataset.j] = i.value; rerender(); });
  $$('[data-rule]').forEach(i => i.onchange = () => { const r=R[i.dataset.rule][+i.dataset.i]; r[i.dataset.k] = i.dataset.k==='prio' ? i.value : num(i.value); rerender(); });
  $$('[data-lj]').forEach(i => i.onchange = () => { R.laatsteJaar[i.dataset.lj] = num(i.value); rerender(); });
  $$('[data-ov]').forEach(i => i.onchange = () => { OV[i.dataset.ov] = i.dataset.ov==='conditieVanaf' ? num(i.value) : (num(i.value)??0); rerender(); renderScorekaarten(el); });
  $$('[data-ovi]').forEach(i => i.onchange = () => { OV.intensiteit[i.dataset.ovi] = num(i.value)??0; rerender(); renderScorekaarten(el); });
  $$('[data-ovw]').forEach(i => i.onchange = () => { OV.ontwikkeling = OV.ontwikkeling||{}; OV.ontwikkeling[i.dataset.ovw] = num(i.value)??0; rerender(); renderScorekaarten(el); });
  $$('[data-ovo]').forEach(i => i.onchange = () => { OV.omvang[+i.dataset.ovo][i.dataset.k] = num(i.value)??0; rerender(); renderScorekaarten(el); });
  $$('[data-dv]').forEach(i => i.onchange = () => { R.dVoorstel[i.dataset.dv] = num(i.value)??8; rerender(); renderScorekaarten(el); });
  $$('[data-tk]').forEach(i => i.onchange = () => { R.tKlassen[+i.dataset.tk].jaar = num(i.value); rerender(); });
  $('#rulesReset').onclick = () => { if(confirm('Scorecriteria, bepalingsregels en beslisregels terugzetten naar de standaard?')) { const keep = { safetyAspect: S.rules.safetyAspect, complianceAspect: S.rules.complianceAspect }; S.rules = Object.assign(C.defaultRules(), keep); const sk = C.clone(C.seed.scorekaarten); sk.S.forEach(s => { while (s.aspecten.length < ASP.length) s.aspecten.push(''); }); S.scorekaarten = sk; rerender(); render(); } };
}
/** Stap 3: T-bepaling uit restlevensduur per bouwdeelcategorie, plus de aannames voor de conditieprognose */
function renderTregels(el) {
  const S = C.state.settings, R = S.rules, T = R.tRegels, rows = C.calc.rows;
  // welke bouwdeelcategorieen komen in dit project voor, en staan die in de levensduurtabel?
  const gebruikt = {}; rows.forEach(r => { const b = r.libE?.bouwdeel || r.insp.bouwdeel || ''; if (b) gebruikt[b] = (gebruikt[b]||0)+1; });
  const namen = Object.keys(gebruikt).sort((a,b)=>gebruikt[b]-gebruikt[a]);
  const zonder = namen.filter(n => C.num(T.levensduur[n]) == null);
  const bronnen = rows.reduce((a,r)=>{ a[r.tInfo?.bron||'onbekend'] = (a[r.tInfo?.bron||'onbekend']||0)+1; return a; }, {});
  const q = (tQ||'').trim().toLowerCase();
  const alle = Object.keys(T.levensduur).sort();
  const lijst = q ? alle.filter(n => n.toLowerCase().includes(q)) : namen;
  const curveOpt = v => ['lineair','progressief','degressief'].map(c=>`<option ${c===v?'selected':''}>${c}</option>`).join('');
  el.innerHTML = `<div class="card"><h3 style="margin-top:0">Faalmoment T uit restlevensduur</h3>
    <p class="note">T is de verwachte tijd tot functieverlies. Tot nu kwam T alleen uit vaste regels per gebrekcode (${Object.keys(R.tPerCode).length} codes), waardoor de specialist of de AI het voor alle andere regels zelf moest bepalen. Nu rekent het model:
    <b>T = levensduur bouwdeel × restfactor(degradatiegraad) ÷ ontwikkelsnelheid × ernstfactor × omvangfactor</b>, begrensd op de resterende technische levensduur en op de horizon. Een vaste regel per gebrekcode gaat altijd voor.</p>
    <label class="note"><input type="checkbox" data-tr="actief" ${T.actief?'checked':''}> T-model gebruiken (uit = alleen vaste regels per gebrekcode)</label>
    <div class="grid two" style="margin-top:10px">
      <div><b>Degradatiegraad per NEN-intensiteit</b><table class="mini"><tbody>${C.INTENSITEIT.map(k=>`<tr><td>${k}</td><td><input class="n" data-trif="${k}" value="${T.intensiteitFractie[k]??''}"></td></tr>`).join('')}</tbody></table>
        <label class="note"><input type="checkbox" data-tr="gebruikConditie" ${T.gebruikConditie?'checked':''}> conditiescore als kruiscontrole (de verst gevorderde van intensiteit en conditie telt)</label>
        <table class="mini" style="margin-top:6px"><thead><tr><th>Conditie</th>${[1,2,3,4,5,6].map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody><tr><td class="note">degradatiegraad</td>${[1,2,3,4,5,6].map(c=>`<td><input class="n" style="width:56px" data-trcf="${c}" value="${T.conditieFractie[c]??''}"></td>`).join('')}</tr></tbody></table></div>
      <div><b>Ontwikkelsnelheid (deler)</b><table class="mini"><tbody>${C.ONTWIKKELING.map(k=>`<tr><td>${k}</td><td><input class="n" data-trov="${k}" value="${T.ontwikkelingSnelheid[k]??''}"></td></tr>`).join('')}</tbody></table>
        <b>Ernstfactor</b><table class="mini"><tbody>${C.ERNST.map(k=>`<tr><td>${k}</td><td><input class="n" data-tref="${k}" value="${T.ernstFactor[k]??''}"></td></tr>`).join('')}</tbody></table>
        <b>Omvangfactor</b><table class="mini"><tbody>${T.omvangFactor.map((x,i)=>`<tr><td class="note">omvang ≥</td><td><input class="n" style="width:56px" data-trof="${i}" data-k="min" value="${x.min}"></td><td class="note">factor</td><td><input class="n" style="width:56px" data-trof="${i}" data-k="factor" value="${x.factor}"></td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="grid two" style="margin-top:6px">
      <div class="field"><label>Standaard levensduur als het bouwdeel onbekend is (jaar)</label><input data-tr="levensduurDefault" value="${esc(T.levensduurDefault??'')}"></div>
      <div class="field"><label>Standaard degradatiecurve</label><select data-tr="curveDefault">${curveOpt(T.curveDefault)}</select></div>
    </div>
    <p class="note">Curve: <b>lineair</b> restfactor 1−d · <b>progressief</b> (1−d)² – schade versnelt, typisch voor afwerkingen en beschermlagen · <b>degressief</b> √(1−d) – schade vertraagt, typisch voor constructies.</p>
    <p class="note">In dit project: ${Object.entries(bronnen).map(([b,n])=>`${n}× ${({code:'vaste regel per gebrekcode',model:'restlevensduurmodel',onbekend:'geen T (specialist bepaalt)'})[b]||b}`).join(' · ')}.</p>
    ${zonder.length?`<p class="warn">${zonder.length} bouwdeelnaam${zonder.length>1?'en':''} uit dit project staat nog niet in de levensduurtabel: ${zonder.map(n=>`<b>${esc(n)}</b> (${gebruikt[n]}×)`).join(', ')}. Die regels rekenen met de standaard van ${T.levensduurDefault} jaar; vul hieronder een eigen levensduur in.</p>`:'<p class="note">Alle bouwdeelnamen uit dit project staan in de levensduurtabel.</p>'}
  </div>
  <div class="card"><h3 style="margin-top:0">Levensduur en curve per bouwdeel</h3>
    <div class="toolbar"><input id="tQ" placeholder="Zoek of voeg een bouwdeelnaam toe…" value="${esc(tQ)}" style="min-width:320px"><span class="note">${q?`${lijst.length} van ${alle.length}`:`${namen.length} namen uit dit project; zoek om de volledige lijst van ${alle.length} te zien`}</span>${q && !alle.includes(tQ.trim())?`<button class="btn ghost small" id="tAdd">“${esc(tQ.trim())}” toevoegen</button>`:''}</div>
    <div class="tablewrap"><table><thead><tr><th>Bouwdeel</th><th>In dit project</th><th>Levensduur (jr)</th><th>Curve</th><th class="wrap">T bij intensiteit Gevorderd, ontwikkeling onbekend</th></tr></thead><tbody>
    ${lijst.slice(0,80).map(n=>{ const L=C.num(T.levensduur[n]), v=T.curve[n]||T.curveDefault;
      const voorb = C.bepaalT({bouwdeel:n, intensiteit:'Gevorderd'}, {bouwdeel:n});
      return `<tr class="${zonder.includes(n)?'ovr':''}"><td>${esc(n)}</td><td class="num note">${gebruikt[n]||''}</td><td><input class="n" data-trl="${esc(n)}" value="${L??''}" placeholder="${esc(T.levensduurDefault)}"></td><td><select data-trc="${esc(n)}"><option value="">standaard (${T.curveDefault})</option>${['lineair','progressief','degressief'].map(c=>`<option ${c===T.curve[n]?'selected':''}>${c}</option>`).join('')}</select></td><td class="note">${voorb.jaar==null?'—':`${voorb.jaar} jr → ${esc(voorb.klasse)}`}</td></tr>`;}).join('')}
    </tbody></table></div>
  </div>
  <div class="card"><h3 style="margin-top:0">Conditieprognose: effect van een handeling</h3>
    <p class="note">Voor de conditieprognose (tab 04) telt wat een handeling met de NEN-conditie doet. Vervangen zet de conditie terug naar 1, herstellen naar 2, reinigen of conserveren verbetert een stap. Daarna begint de degradatie opnieuw vanuit die conditie, over de levensduur van het bouwdeel.</p>
    <table class="mini"><tbody>
      <tr><td>Vervangen / renoveren → conditie</td><td><input class="n" data-trh="vervangen" value="${T.herstelNiveau?.vervangen??1}"></td></tr>
      <tr><td>Herstellen / repareren → conditie</td><td><input class="n" data-trh="herstellen" value="${T.herstelNiveau?.herstellen??2}"></td></tr>
      <tr><td>Reinigen / conserveren → stappen beter (negatief getal)</td><td><input class="n" data-trh="reinigen" value="${T.herstelNiveau?.reinigen??-1}"></td></tr>
    </tbody></table>
    <button class="btn ghost" data-go="systeem">Naar de conditieprognose</button>
  </div>`;
  const herteken = () => { C.save(); C.recompute(); renderTregels(el); };
  $$('[data-tr]').forEach(i => i.onchange = () => { const k=i.dataset.tr; T[k] = i.type==='checkbox' ? i.checked : (k==='levensduurDefault' ? (C.numNL(i.value) ?? 30) : (C.numNL(i.value) ?? i.value)); C.audit({veld:'tRegels.'+k, nieuw:T[k], bron:'mens'}); herteken(); });
  $$('[data-trif]').forEach(i => i.onchange = () => { T.intensiteitFractie[i.dataset.trif] = num(i.value) ?? 0; herteken(); });
  $$('[data-trov]').forEach(i => i.onchange = () => { T.ontwikkelingSnelheid[i.dataset.trov] = num(i.value) ?? 1; herteken(); });
  $$('[data-tref]').forEach(i => i.onchange = () => { T.ernstFactor[i.dataset.tref] = num(i.value) ?? 1; herteken(); });
  $$('[data-trcf]').forEach(i => i.onchange = () => { T.conditieFractie[i.dataset.trcf] = num(i.value) ?? 0; herteken(); });
  $$('[data-trof]').forEach(i => i.onchange = () => { T.omvangFactor[+i.dataset.trof][i.dataset.k] = num(i.value) ?? 1; herteken(); });
  $$('[data-trl]').forEach(i => i.onchange = () => { const n=i.dataset.trl, v=num(i.value); if (v==null) delete T.levensduur[n]; else T.levensduur[n]=v; C.audit({veld:'tRegels.levensduur.'+n, nieuw:v, bron:'mens'}); herteken(); });
  $$('[data-trc]').forEach(i => i.onchange = () => { const n=i.dataset.trc; if (!i.value) delete T.curve[n]; else T.curve[n]=i.value; herteken(); });
  $$('[data-trh]').forEach(i => i.onchange = () => { T.herstelNiveau = T.herstelNiveau||{}; T.herstelNiveau[i.dataset.trh] = num(i.value) ?? 1; herteken(); });
  $('#tQ').oninput = e => { tQ = e.target.value; clearTimeout(window._tq); window._tq = setTimeout(() => renderTregels(el), 250); };
  const ad = $('#tAdd'); if (ad) ad.onclick = () => { T.levensduur[tQ.trim()] = T.levensduurDefault; C.audit({veld:'tRegels.levensduur.'+tQ.trim(), nieuw:T.levensduurDefault, bron:'mens', opmerking:'bouwdeel toegevoegd'}); herteken(); };
  $$('[data-go]').forEach(b => b.onclick = () => window.STEMI_UI.switchTab(b.dataset.go));
}

function pctOf(list, dflt) { const m = Math.min(...list.map(x=>x.min)); return isFinite(m) ? Math.round(m*100)+'%' : dflt; }

function renderParams(el) {
  const S = C.state.settings, P = S.params, bel = C.belangen(), prof = S.profielen[P.profiel] || [];
  el.innerHTML = `<div class="grid two">
    <div class="card"><h3 style="margin-top:0">Objectparameters (in te vullen door AM)</h3>
      ${[['naam','Naam instellingenprofiel','text',S.naam],['profiel','Waardekompas profiel (B6)','select'],['startjaar','Startjaar MJOP (B7)'],['horizon','MJOP horizon in jaar (B8)'],['oRef','O-referentieperiode in jaar (B9) – organisatiekeuze'],['nenSignaal','NEN technisch signaal vanaf conditie (B10)'],['omslagDefault','Default omslagpercentage integraal uitvoeren 0–1 (B13)']].map(([k,l,t,v])=>`<div class="field"><label>${l}</label>${t==='select'?`<select data-param="${k}">${Object.keys(S.profielen).map(p=>`<option ${p===P.profiel?'selected':''}>${esc(p)}</option>`).join('')}</select>`:`<input data-param="${k}" value="${esc(t==='text'?v:P[k])}">`}</div>`).join('')}
    </div>
    <div class="card"><h3 style="margin-top:0">Financiele parameters (prijspeil, indexering, btw, rendement)</h3>
      <p class="note">Kengetallen en maatregelkosten voer je in op het <b>prijspeil</b>. Het model rekent daarna zelf naar het uitvoeringsjaar (indexering), naar btw en naar contante waarde.</p>
      <div class="grid two">
        <div class="field"><label>Prijspeil kengetallen (jaartal)</label><input data-fin="prijspeil" value="${esc(P.prijspeil??P.startjaar)}"></div>
        <div class="field"><label>Inflatie / bouwkostenstijging per jaar (0–1)</label><input data-fin="inflatie" value="${esc(P.inflatie??'')}"></div>
        <div class="field"><label>Btw-percentage</label><input data-fin="btwPercentage" value="${esc(P.btwPercentage??'')}"></div>
        <div class="field"><label>Begroting vastleggen</label><select data-fin="btwWeergave"><option value="excl" ${P.btwWeergave!=='incl'?'selected':''}>exclusief btw</option><option value="incl" ${P.btwWeergave==='incl'?'selected':''}>inclusief btw</option></select></div>
        <div class="field"><label>Discontovoet voor contante waarde (0–1)</label><input data-fin="discontovoet" value="${esc(P.discontovoet??'')}"></div>
        <div class="field"><label>Budgetplafond per jaar (leeg = geen plafond)</label><input data-fin="budgetplafond" value="${esc(P.budgetplafond??'')}"></div>
      </div>
      <p class="note">Voorbeeld met deze instellingen: &euro;100.000 op prijspeil ${P.prijspeil??P.startjaar} kost in ${(num(P.prijspeil)??num(P.startjaar))+10} <b>${C.eur(100000*C.indexFactor((num(P.prijspeil)??num(P.startjaar))+10))}</b> (geindexeerd)${P.btwWeergave==='incl'?'':`, ${C.eur(100000*C.indexFactor((num(P.prijspeil)??num(P.startjaar))+10)*C.btwFactor())} inclusief btw`} en heeft een contante waarde van <b>${C.eur(100000*C.indexFactor((num(P.prijspeil)??num(P.startjaar))+10)*C.npvFactor((num(P.prijspeil)??num(P.startjaar))+10))}</b>.</p>
      <details><summary class="note">Afwijkende inflatie per jaar (bijv. bekende aannemersindex voor de eerste jaren)</summary>
        <div class="tablewrap" style="margin-top:8px"><table><thead><tr>${C.calc.jaren.slice(0,10).map(j=>`<th>${j}</th>`).join('')}</tr></thead><tbody><tr>${C.calc.jaren.slice(0,10).map(j=>`<td><input class="n" data-infl="${j}" style="width:64px" value="${P.inflatiePerJaar?.[j]??''}" placeholder="${P.inflatie??''}"></td>`).join('')}</tr></tbody></table></div>
        <p class="note">Leeg = de algemene voet. De factor is samengesteld: per jaar wordt de dan geldende voet gebruikt.</p></details>
    </div>
    <div class="card"><h3 style="margin-top:0">Waardekompas voor dit object</h3>
      <div class="tablewrap"><table><thead><tr><th>Aspect</th><th>Uit profiel</th><th>Minimum (AM)</th><th>Definitief</th><th>Factor</th></tr></thead><tbody>
      ${ASP.map((a,i)=>`<tr><td>${esc(a)}</td><td class="num groen">${prof[i]??''}</td><td><input class="n" data-min="${i}" value="${esc(P.minimum[i])}"></td><td class="num"><b>${bel[i]}</b></td><td class="num">${bel[i]/5}</td></tr>`).join('')}
      </tbody></table></div><p class="note">Definitief belang = max(profielwaarde, minimum). Waardefactor = belang / 5. Veiligheid en compliance staan standaard op minimum 5 (randvoorwaardelijk).</p>
    </div></div>`;
  $$('[data-param]').forEach(i => i.onchange = () => { const k=i.dataset.param; if (k==='naam') S.naam=i.value; else if (k==='profiel') P[k] = i.value; else { const v = C.numNL(i.value); if (v == null) { C.toast('Voer een getal in'); renderParams(el); return; } P[k] = k==='horizon' ? Math.min(100, Math.max(1, Math.round(v))) : v; } C.audit({veld:'param.'+k, nieuw:i.value, bron:'mens'}); C.save(); C.recompute(); renderParams(el); });
  $$('[data-min]').forEach(i => i.onchange = () => { P.minimum[+i.dataset.min] = num(i.value) ?? 0; C.save(); C.recompute(); renderParams(el); });
  $$('[data-fin]').forEach(i => i.onchange = () => { const k = i.dataset.fin; const oud = P[k]; P[k] = k === 'btwWeergave' ? i.value : num(i.value); C.audit({veld:'param.'+k, oud, nieuw:P[k], bron:'mens'}); C.save(); C.recompute(); renderParams(el); window.STEMI_UI.renderMjop(); });
  $$('[data-infl]').forEach(i => i.onchange = () => { P.inflatiePerJaar = P.inflatiePerJaar || {}; const v = num(i.value); if (v == null) delete P.inflatiePerJaar[i.dataset.infl]; else P.inflatiePerJaar[i.dataset.infl] = v; C.audit({veld:'param.inflatie.'+i.dataset.infl, nieuw:v, bron:'mens'}); C.save(); C.recompute(); renderParams(el); window.STEMI_UI.renderMjop(); });
}

function renderSamenvatting(el) {
  const S = C.state.settings, bel = C.belangen();
  el.innerHTML = `<div class="grid two"><div class="card"><h3 style="margin-top:0">Profiel “${esc(S.naam)}”</h3>
    <table class="mini"><tbody><tr><td>Waardekompas</td><td><b>${esc(S.params.profiel)}</b></td></tr><tr><td>Start / horizon</td><td>${S.params.startjaar} / ${S.params.horizon} jaar</td></tr><tr><td>O-referentieperiode</td><td>${S.params.oRef} jaar</td></tr><tr><td>NEN-signaal vanaf</td><td>conditie ${S.params.nenSignaal}</td></tr><tr><td>Omslag integraal</td><td>${C.pct(S.params.omslagDefault)}</td></tr><tr><td>Prijspeil / inflatie</td><td>${S.params.prijspeil??S.params.startjaar} · ${C.pct1(S.params.inflatie)} per jaar</td></tr><tr><td>Btw / discontovoet</td><td>${S.params.btwPercentage??0}% (${S.params.btwWeergave==='incl'?'incl.':'excl.'}) · ${C.pct1(S.params.discontovoet)}</td></tr><tr><td>Budgetplafond</td><td>${S.params.budgetplafond?C.eur(S.params.budgetplafond)+' per jaar':'geen'}</td></tr><tr><td>Belang per aspect</td><td>${ASP.map((a,i)=>`${C.ASP_SHORT[i]} ${bel[i]}`).join(' · ')}</td></tr><tr><td>RPN-grenzen</td><td>${S.rules.rpn.map(x=>`${x.prio} ≥ ${x.min}`).join(' · ')}</td></tr><tr><td>Overrides</td><td>Safety ${S.rules.safety.map(x=>`${x.prio}≥${x.min}`).join(', ')} · Compliance ${S.rules.compliance.map(x=>`${x.prio}≥${x.min}`).join(', ')}</td></tr></tbody></table>
    <p class="note">Status: ${S.wizardVoltooid ? '<b>vastgelegd</b>' : '<span class="warn">nog niet vastgelegd</span>'}. Het profiel wordt bij elke berekening gebruikt en gaat mee in JSON-export.</p></div>
    <div class="card"><h3 style="margin-top:0">Profiel exporteren / importeren</h3><p class="note">Zo hergebruik je beleid over meerdere objecten of portefeuilles.</p><button class="btn ghost" id="profExport">Profiel downloaden (JSON)</button> <label class="btn ghost">Profiel laden<input type="file" id="profImport" accept=".json" hidden></label></div></div>`;
  $('#profExport').onclick = () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'})); a.download=`stemi-profiel-${S.naam.replace(/\W+/g,'_')}.json`; a.click(); };
  $('#profImport').onchange = e => { const f=e.target.files[0]; if(!f) return; f.text().then(t=>{ const p=JSON.parse(t); if(!p.rules||!p.params) throw new Error('geen profiel'); C.state.settings = C.clone(p); C.setState(C.state); C.audit({veld:'instellingenprofiel', bron:'mens', nieuw:p.naam, opmerking:'Profiel geïmporteerd'}); C.save(); window.STEMI_UI.renderAll(); C.toast('Profiel geladen'); }).catch(err=>alert('Ongeldig profiel: '+err.message)); };
}

window.STEMI_UI = window.STEMI_UI || {}; window.STEMI_UI.renderEigenaar = render;
})();
