/* 03 Technisch specialist – de AI-laag: vult, verifieert en overschrijft met onderbouwing en herleidbaarheid */
(() => {
const C = window.STEMI; const { $, $$, esc, num, eur, pct, ASP, ASP_SHORT } = C;
let chatHistory = [];
const AI_FIELDS = [['faalwijze','Faalwijze'],['O','O'],['onderbouwingO','Onderbouwing O'],['D','D'],['onderbouwingD','Onderbouwing D'],['Tklasse','T-klasse'],['Tjaar','T jaar'],['onderbouwingT','Onderbouwing T'],['effect','Effecten (8)'],['onderbouwingEffect','Onderbouwing effecten'],['maatregel','Maatregel'],['restS','Rest S'],['restO','Rest O'],['restD','Rest D'],['restToelichting','Restrisico toelichting'],['kostenSpecialist','Kosten specialist'],['onderbouwingKosten','Onderbouwing kosten'],['scopeOverride','Scope-override'],['onderbouwingScope','Onderbouwing scope'],['aanvullendOnderzoek','Aanvullend onderzoek']];
const BRON = { systeem:['Systeem','sys'], excel:['Excel','xl'], ai:['AI','ai'], mens:['Mens','mens'] };
const tklassen = () => C.state.settings.rules.tKlassen.map(t=>t.klasse);

function systemPrompt() {
  const S = C.state.settings, K = S.scorekaarten, R = S.rules;
  return `Je bent een ervaren technisch specialist / maintenance engineer (FMECA, NEN 2767, NEN 8026) die tabblad 03 van een waardegestuurd FMECA-MJOP-model voor bestaand vastgoed invult. Je werkt in het Nederlands, nuchter, en ALLES wat je invult is onderbouwd en herleidbaar naar de inspectiedata, de gebrekenbibliotheek en de scorekaarten. Waar de data onvoldoende is, zeg je dat expliciet en houd je het systeemvoorstel aan met lager vertrouwen.

METHODIEK (organisatie-eigen beleid, instellingenprofiel "${S.naam}")
- O (occurrence) = kans dat de faalwijze optreedt binnen de O-referentieperiode van ${S.params.oRef} jaar. Schaal 1–10:
${K.O.map(o=>`  ${o.score}: ${o.kans} – ${o.betekenis}`).join('\n')}
  Het systeem geeft een startvoorstel O uit intensiteit/omvang/conditie. NEN 2767-conditie wordt NOOIT rechtstreeks naar O geconverteerd; jij beoordeelt ontwikkeling, belasting en gebruikscontext.
- D (detectability) = mate waarin aankomend functieverlies tijdig detecteerbaar is; hoger = slechter. Schaal 1–10:
${K.D.map(d=>`  ${d.score}: ${d.detect} – ${d.criterium}`).join('\n')}
- T = verwachte tijd tot functieverlies. Klassen: ${R.tKlassen.map(t=>`"${t.klasse}" (≈${t.jaar} jr)`).join('; ')}. Tjaar is een getal in jaren (0 = reeds aanwezig).
- Effect S per waardeaspect (0–10), ONGEWOGEN: stel dat de faalwijze daadwerkelijk optreedt, hoe groot is dan het gevolg? Vermeng dit niet met kans. Het waardekompas van de eigenaar wordt pas in het systeemmodel toegepast, dus scoor technisch-objectief. Aspecten in vaste volgorde: ${ASP.join(', ')}.
Schaaldefinities per aspect:
${K.S.map(s=>`  ${s.score} ${s.generiek}: ${ASP.map((a,i)=>`${a}: ${s.aspecten[i]}`).join(' | ')}`).join('\n')}
${K.beoordelingsregels || ''}
- Maatregel: concreet en uitvoerbaar; benoem integraal (hele element) of lokaal (alleen gebrek) en waarom.
- Restrisico S/O/D: scores ná uitvoering van de maatregel.
- Kosten: beoordeel het eerste kostenvoorstel (hoeveelheid × kengetal) op realisme (bereikbaarheid, steigers, voorbereiding, veiligheidsmaatregelen, onderzoek). Geef alleen een overschrijving als je die kunt onderbouwen; anders null.
- Verificatie: als er al waarden van een specialist of uit Excel staan, controleer die expliciet: bevestig of wijk af, met reden.
${C.cfg.context ? '\nORGANISATIECONTEXT\n' + C.cfg.context : ''}

ANTWOORD ALTIJD MET ÉÉN JSON-OBJECT met exact deze sleutels:
{"faalwijze": string, "O": int 1-10, "onderbouwingO": string, "D": int 1-10, "onderbouwingD": string, "Tklasse": één van ${JSON.stringify(R.tKlassen.map(t=>t.klasse))}, "Tjaar": number, "onderbouwingT": string, "effect": [8 ints 0-10 in volgorde ${ASP.join(', ')}], "onderbouwingEffect": string (kort per aspect dat >0 scoort, met verwijzing naar de schaaldefinitie), "maatregel": string, "restS": int, "restO": int, "restD": int, "restToelichting": string, "kostenSpecialist": number|null, "onderbouwingKosten": string, "scopeOverride": "Integraal uitvoeren"|"Lokaal uitvoeren"|null, "onderbouwingScope": string, "aanvullendOnderzoek": string, "verificatie": [{"veld": string, "huidig": any, "oordeel": "bevestigd"|"aangepast"|"n.v.t.", "reden": string}], "gebruikteBronnen": [strings: welke inspectievelden/bibliotheekvelden doorslaggevend waren], "onzekerheden": [strings], "vertrouwen": "Laag"|"Middel"|"Hoog"}`;
}
function rowContext(r) {
  const i = r.insp;
  return { id: r.id, object: i.object, element: i.element, locatie: i.locatie, technischeConstatering: i.constatering, nenGebrek: i.gebrek, ernst: i.ernst, intensiteit: i.intensiteit,
    hoeveelheidTotaal: i.hoevTotaal, eenheid: i.eenheid, hoeveelheidMetGebrek: i.hoevGebrek, omvangGebrek: pct(r.omvang), nenConditie: i.conditie, ontwikkeling: i.ontwikkeling,
    inspecteerbaarheid: i.inspecteerbaarheid, bewijs: i.bewijs, aanvullendOnderzoekNodig: i.onderzoek, toelichtingInspecteur: i.toelichting,
    nenCode: i.nenCode, bibliotheek: r.libE ? { bouwdeel: r.libE.bouwdeel, classificatie: r.libE.ernst, gebreksoort: r.libE.gebreksoort, omschrijving: r.libE.omschrijving, faalwijzeVoorstel: r.libE.faalwijze, effectVoorstel: r.libE.effect, vertrouwen: r.libE.vertrouwen } : null,
    systeemvoorstel: { O: r.oSys, D: r.dSys, Dtekst: r.dSys ? C.voorstelDtekst(i.inspecteerbaarheid) : null, Tklasse: r.tKlSys, Tjaar: r.tJaarSys, opmerkingT: r.tTxtSys },
    huidigeWaarden: Object.fromEntries(AI_FIELDS.map(([k]) => [k, r.sp[k]]).filter(([,v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length))),
    herkomstHuidigeWaarden: Object.fromEntries(Object.entries(r.sp.prov||{}).map(([k,p])=>[k,p.bron])),
    kosten: { standaardMaatregelSoftware: i.maatregel, kengetalPerEenheid: i.kengetal, kostenVolledigElement: r.kostenElement, kostenLokaalGebrek: r.kostenLokaal, eersteKostenvoorstel: r.eersteVoorstel, automatischeBegrotingswijze: r.begrotingswijze, omslagpercentage: r.omslagEff },
    resultaatHuidig: { RPNtech: r.RPNtech, RPNwaarde: r.RPNwaarde, prioriteit: r.prio } };
}
async function analyzeRow(id, extra='') {
  const r = C.calc.rows.find(x=>x.id===id);
  const msgs = [{role:'system',content:systemPrompt()},{role:'user',content:`Interpreteer deze FMECA-regel en vul tabblad 03 volledig in.${extra?'\nExtra instructie: '+extra:''}\n\n${JSON.stringify(rowContext(r),null,1)}`}];
  const ctx = rowContext(r); const d = await C.callAgent(msgs, true, {taak:'specialist'}); const p = C.parseJSON(d.content);
  C.state.ai[id] = { ...p, _model: d.model, _ts: new Date().toISOString(), _usage: d.usage, _input: ctx }; C.save();
  if (window.STEMI_DB) window.STEMI_DB.logAiRun({ regel:id, taak:'specialist', model:d.model, input:{ system: msgs[0].content, context: ctx, extra }, output:p, usage:d.usage });
  return p;
}
/** past AI-voorstel toe; menselijke velden blijven staan tenzij overschrijf=true */
function applyAI(id, keys, overschrijf=false) {
  const ai = C.state.ai[id]; if (!ai) return 0; const sp = C.getSp(id); let n=0;
  for (const k of keys) { if (ai[k] === undefined) continue; const prov = sp.prov[k]; if (prov?.bron === 'mens' && !overschrijf) continue;
    C.setSp(id, k, ai[k], 'ai', { model: ai._model, ref: ai._ts, onderbouwing: (k==='O'?ai.onderbouwingO: k==='D'?ai.onderbouwingD: k==='Tjaar'||k==='Tklasse'?ai.onderbouwingT: k==='effect'?ai.onderbouwingEffect: k==='kostenSpecialist'?ai.onderbouwingKosten: k==='maatregel'?ai.restToelichting: undefined) }); n++; }
  if (keys.includes('O')) sp.bronO = `AI (${ai._model}) o.b.v. inspectiedata + bibliotheek; gecontroleerd door specialist: nee`;
  C.save(); return n;
}
async function aiFillAll(opts={}) {
  if (!C.cfg.apiKey) { window.STEMI_UI.switchTab('instellingen'); C.toast('Vul eerst een OpenRouter-sleutel in'); return; }
  const rows = C.calc.rows.filter(r => opts.alleenNieuw ? !C.state.ai[r.id] : true); if (!rows.length) { C.toast('Niets te doen'); return; }
  const btn = $('#aiAll'); let n=0, fails=0; if (btn) btn.disabled = true;
  for (const r of rows) { if (btn) btn.innerHTML = `<span class="spin"></span>${++n}/${rows.length} – regel ${r.id}`; try { await analyzeRow(r.id); applyAI(r.id, AI_FIELDS.map(f=>f[0]), !!opts.overschrijf); C.recompute(); } catch(e) { fails++; C.audit({regel:r.id, veld:'ai', nieuw:'mislukt: '+e.message, bron:'ai'}); } }
  C.save(); window.STEMI_UI.renderAll('specialist'); C.toast(`AI heeft ${rows.length-fails} regel(s) ingevuld${fails?`, ${fails} mislukt`:''}`);
}

function provBadge(sp, k) { const p = (sp.prov||{})[k]; if (!p) return '<span class="prov sys" title="systeemvoorstel (leeg veld)">sys</span>'; const b = BRON[p.bron]||[p.bron,p.bron]; return `<span class="prov ${b[1]}" title="${esc(p.bron)} · ${new Date(p.ts).toLocaleString('nl-NL')}${p.model?' · '+esc(p.model):''}">${b[0]}</span>`; }

function render() {
  const el = $('#tab-specialist'); const R = C.calc.rows; const nAI = R.filter(r=>C.state.ai[r.id]).length; const nMens = R.filter(r=>Object.values(r.sp.prov||{}).some(p=>p.bron==='mens')).length;
  el.innerHTML = `
    <h2>03 Technisch specialist / ME <span class="ai-badge">AI-laag</span></h2><p class="sub">De AI vult op basis van tab 02 en de gebrekenbibliotheek álle velden in, verifieert bestaande waarden en overschrijft waar nodig – altijd met onderbouwing. De specialist controleert en corrigeert; elke waarde heeft een herkomst. <span class="prov sys">sys</span> systeemvoorstel · <span class="prov ai">AI</span> · <span class="prov mens">Mens</span> · <span class="prov xl">Excel</span></p>
    <div class="toolbar">
      <button class="btn" id="aiAll">${C.cfg.apiKey?'':'🔒 '}AI: alle regels invullen &amp; verifiëren</button>
      <button class="btn ghost" id="aiNew">Alleen nieuwe regels</button>
      <label class="note"><input type="checkbox" id="aiOverschrijf"> menselijke invoer mag overschreven worden</label>
      <button class="btn ghost" id="aiChat">Vraag de agent</button>
      <span class="spacer"></span>
      <span class="note">${nAI}/${R.length} door AI · ${nMens} met menselijke correctie · model <b>${esc(C.modelFor('specialist'))}</b>${C.cfg.apiKey?'':' · <span class="warn">geen sleutel (Instellingen)</span>'}</span>
      <label class="note"><input type="checkbox" id="showSys" ${C.cfg.showSys?'checked':''}> systeemvoorstellen tonen</label>
    </div>
    <div class="tablewrap"><table><thead><tr><th>ID</th><th>Element</th><th class="wrap">Constatering</th><th>Cond.</th><th class="wrap">Faalwijze</th><th>O</th><th class="wrap">Onderbouwing O</th><th>D</th><th class="wrap">Onderbouwing D</th><th>T-klasse</th><th>T jr</th>${ASP_SHORT.map((a,i)=>`<th title="${ASP[i]}">${a}</th>`).join('')}<th class="wrap">Maatregel</th><th>Rest S/O/D</th><th>Kosten spec. €</th><th class="wrap">Onderbouwing kosten</th><th>Scope</th><th>Status</th><th>Verantwoording</th></tr></thead><tbody>
    ${R.map(r => { const sp = r.sp, id=r.id, ai = C.state.ai[id]; const P = k => provBadge(sp,k); return `<tr>
      <td>${id}</td><td>${esc(r.insp.element)}</td><td class="wrap">${esc(r.insp.constatering)}</td><td class="num">${r.insp.conditie??''}</td>
      <td class="oranje">${P('faalwijze')}<textarea data-sp="${id}" data-k="faalwijze" placeholder="${esc(r.libE?.faalwijze||'')}">${esc(sp.faalwijze||'')}</textarea>${C.cfg.showSys&&r.libE?`<div class="note">sys: ${esc(r.libE.faalwijze)}</div>`:''}</td>
      <td class="oranje">${P('O')}<input class="n" data-sp="${id}" data-k="O" value="${esc(sp.O??'')}" placeholder="${r.oSys}"><div class="note">${esc(C.OKANS()[(r.O??1)-1]||'')}</div></td>
      <td class="oranje"><textarea data-sp="${id}" data-k="onderbouwingO">${esc(sp.onderbouwingO||'')}</textarea>${C.cfg.showSys?`<div class="note">sys O=${r.oSys}: intensiteit ${esc(r.insp.intensiteit||'–')}, omvang ${pct(r.omvang)}, conditie ${r.insp.conditie??'–'}</div>`:''}</td>
      <td class="oranje">${P('D')}<input class="n" data-sp="${id}" data-k="D" value="${esc(sp.D??'')}" placeholder="${r.dSys??''}"><div class="note">${esc(C.DTEKST()[(r.D??1)-1]||'')}</div></td>
      <td class="oranje"><textarea data-sp="${id}" data-k="onderbouwingD">${esc(sp.onderbouwingD||'')}</textarea></td>
      <td class="oranje">${P('Tklasse')}<select data-sp="${id}" data-k="Tklasse"><option value="">(sys: ${esc(r.tKlSys)})</option>${tklassen().map(t=>`<option ${t===(sp.Tklasse||'')?'selected':''}>${t}</option>`).join('')}</select></td>
      <td class="oranje"><input class="n" data-sp="${id}" data-k="Tjaar" value="${esc(sp.Tjaar??'')}" placeholder="${r.tJaarSys??'?'}"></td>
      ${ASP.map((a,i)=>`<td class="oranje">${i===0?P('effect'):''}<input class="n" data-sp="${id}" data-k="effect${i}" value="${esc(sp.effect?.[i]??'')}" placeholder="${r.libE?r.libE.effect[i]:0}" title="${a}"></td>`).join('')}
      <td class="oranje">${P('maatregel')}<textarea data-sp="${id}" data-k="maatregel">${esc(sp.maatregel||'')}</textarea></td>
      <td class="oranje"><input class="n" data-sp="${id}" data-k="restS" value="${esc(sp.restS??'')}" placeholder="S"> <input class="n" data-sp="${id}" data-k="restO" value="${esc(sp.restO??'')}" placeholder="O"> <input class="n" data-sp="${id}" data-k="restD" value="${esc(sp.restD??'')}" placeholder="D"></td>
      <td class="oranje">${P('kostenSpecialist')}<input class="n" style="width:80px" data-sp="${id}" data-k="kostenSpecialist" value="${esc(sp.kostenSpecialist??'')}" placeholder="${r.eersteVoorstel??''}"></td>
      <td class="oranje"><textarea data-sp="${id}" data-k="onderbouwingKosten">${esc(sp.onderbouwingKosten||'')}</textarea></td>
      <td class="oranje"><select data-sp="${id}" data-k="scopeOverride"><option value="">(${esc(r.begrotingswijze||'–')})</option><option ${sp.scopeOverride==='Integraal uitvoeren'?'selected':''}>Integraal uitvoeren</option><option ${sp.scopeOverride==='Lokaal uitvoeren'?'selected':''}>Lokaal uitvoeren</option></select></td>
      <td><span class="tag">${esc(r.aiStatus)}</span>${ai?`<div class="note">vertrouwen ${esc(ai.vertrouwen||'?')}</div>`:''}</td>
      <td><button class="btn small" data-ai="${id}">${ai?'Verantwoording':'AI invullen'}</button></td></tr>`; }).join('')}
    </tbody></table></div>`;
  $$('[data-sp]').forEach(i => i.onchange = () => { const id=+i.dataset.sp, k=i.dataset.k; C.setSp(id, k, i.value, 'mens'); const sp=C.getSp(id); if (k==='Tklasse' && i.value && sp.Tjaar == null) C.setSp(id,'Tjaar',C.tJaarVanKlasse(i.value),'systeem'); C.save(); window.STEMI_UI.renderAll('specialist'); });
  $$('[data-ai]').forEach(b => b.onclick = () => openAI(+b.dataset.ai));
  $('#aiAll').onclick = () => aiFillAll({overschrijf: $('#aiOverschrijf').checked});
  $('#aiNew').onclick = () => aiFillAll({alleenNieuw:true, overschrijf: $('#aiOverschrijf').checked});
  $('#aiChat').onclick = openChat;
  $('#showSys').onchange = e => { C.cfg.showSys = e.target.checked; C.saveCfg(); render(); };
}

function openAI(id) {
  const r = C.calc.rows.find(x=>x.id===id); const ai = C.state.ai[id]; const sp = r.sp;
  $('#drawerTitle').textContent = `Verantwoording · regel ${id} · ${r.insp.element}`; const body = $('#drawerBody'); $('#drawer').classList.remove('hidden');
  const fmt = v => Array.isArray(v) ? v.join(' · ') : (v==null||v===''?'—':String(v));
  const hist = C.state.audit.filter(a => a.regel === id).slice(0, 40);
  body.innerHTML = `
    <div class="field"><label>Extra instructie voor de agent (optioneel)</label><textarea id="aiExtra" rows="2" placeholder="bijv. object wordt intensief gebruikt als opslag met heftrucks; wees conservatief op veiligheid"></textarea></div>
    <div class="toolbar"><button class="btn" id="aiRun">${ai?'Opnieuw analyseren':'AI invullen'}</button>${ai?`<button class="btn ghost" id="aiApplyAll">Voorstel overnemen</button><label class="note"><input type="checkbox" id="aiOv2"> ook menselijke velden</label>`:''}<span id="aiStatus" class="note"></span></div>
    ${ai ? `<p class="note">Model ${esc(ai._model||'')} · ${new Date(ai._ts).toLocaleString('nl-NL')} · vertrouwen <b>${esc(ai.vertrouwen||'?')}</b>${ai._usage?` · ${ai._usage.total_tokens} tokens`:''}</p>
    <h3>Velden: huidig vs AI-voorstel</h3>
    <table class="diff"><thead><tr><th>Veld</th><th>Huidig</th><th>AI</th><th></th></tr></thead><tbody>
    ${AI_FIELDS.map(([k,l])=>{ const cur = sp[k]; const nw = ai[k]; const changed = JSON.stringify(cur??null)!==JSON.stringify(nw??null); return `<tr class="${changed?'changed':'same'}"><td><b>${l}</b><br>${provBadge(sp,k)}</td><td>${esc(fmt(cur))}</td><td>${esc(fmt(nw))}</td><td>${changed&&nw!=null?`<button class="btn ghost small" data-apply="${k}" title="overnemen">←</button>`:''}</td></tr>`; }).join('')}
    </tbody></table>
    ${ai.verificatie?.length?`<h3>Verificatie bestaande waarden</h3><table class="diff"><tbody>${ai.verificatie.map(v=>`<tr><td><b>${esc(v.veld)}</b></td><td>${esc(fmt(v.huidig))}</td><td><span class="tag">${esc(v.oordeel)}</span> ${esc(v.reden)}</td></tr>`).join('')}</tbody></table>`:''}
    ${ai.gebruikteBronnen?.length?`<h3>Gebruikte bronnen</h3><ul>${ai.gebruikteBronnen.map(o=>`<li>${esc(o)}</li>`).join('')}</ul>`:''}
    ${ai.aanvullendOnderzoek?`<h3>Aanvullend onderzoek</h3><p>${esc(ai.aanvullendOnderzoek)}</p>`:''}
    ${ai.onzekerheden?.length?`<h3>Onzekerheden</h3><ul>${ai.onzekerheden.map(o=>`<li>${esc(o)}</li>`).join('')}</ul>`:''}
    <details><summary>Input naar de agent (herleidbaarheid)</summary><pre class="mono pre">${esc(JSON.stringify(ai._input,null,1))}</pre></details>
    <details><summary>Ruwe JSON van de agent</summary><pre class="mono pre">${esc(JSON.stringify(ai,null,1))}</pre></details>` : '<p class="note" style="margin-top:12px">Nog geen AI-voorstel voor deze regel.</p>'}
    <h3>Wijzigingshistorie (${hist.length})</h3>${hist.length?`<table class="diff"><tbody>${hist.map(h=>`<tr><td class="note">${new Date(h.ts).toLocaleString('nl-NL')}</td><td><b>${esc(h.veld)}</b> <span class="prov ${BRON[h.bron]?.[1]||''}">${esc(h.bron)}</span></td><td>${esc(fmt(h.oud))} → ${esc(fmt(h.nieuw))}${h.model?`<div class="note">${esc(h.model)}</div>`:''}</td></tr>`).join('')}</tbody></table>`:'<p class="note">Geen wijzigingen vastgelegd.</p>'}`;
  $('#aiRun').onclick = async () => { if(!C.cfg.apiKey){window.STEMI_UI.switchTab('instellingen');C.toast('Vul eerst een OpenRouter-sleutel in');return;} const st=$('#aiStatus'); st.innerHTML='<span class="spin"></span>agent denkt…'; $('#aiRun').disabled=true; try { await analyzeRow(id, $('#aiExtra').value.trim()); openAI(id); } catch(e) { st.innerHTML=`<span class="warn">${esc(e.message)}</span>`; $('#aiRun').disabled=false; } };
  $$('[data-apply]', body).forEach(b => b.onclick = () => { applyAI(id, [b.dataset.apply], true); C.recompute(); render(); openAI(id); });
  const all = $('#aiApplyAll'); if (all) all.onclick = () => { const n = applyAI(id, AI_FIELDS.map(f=>f[0]), $('#aiOv2').checked); C.recompute(); render(); openAI(id); C.toast(`${n} veld(en) overgenomen`); };
}
function openChat() {
  $('#drawerTitle').textContent = 'Agent · tabblad 03'; $('#drawer').classList.remove('hidden'); const body = $('#drawerBody');
  body.innerHTML = `<div class="chat" id="chatLog">${chatHistory.length?chatHistory.map(m=>`<div class="msg ${m.role==='user'?'user':'ai'}">${esc(m.content)}</div>`).join(''):'<p class="note">Vragen over de FMECA-regels, bijv. “Welke O-scores zijn twijfelachtig?”, “Vat de risico’s per waardeaspect samen”, “Waar wijkt de specialist af van het systeemvoorstel en is dat onderbouwd?”. De agent krijgt tab 02/03/04 en het instellingenprofiel mee.</p>'}</div>
    <div class="field" style="margin-top:10px"><textarea id="chatIn" rows="3" placeholder="Vraag…"></textarea></div><button class="btn" id="chatSend">Verstuur</button> <button class="btn ghost small" id="chatClear">Wissen</button> <span id="chatStatus" class="note"></span>`;
  $('#chatSend').onclick = async () => {
    const q = $('#chatIn').value.trim(); if(!q) return; if(!C.cfg.apiKey){window.STEMI_UI.switchTab('instellingen');C.toast('Vul eerst een OpenRouter-sleutel in');return;}
    chatHistory.push({role:'user',content:q}); $('#chatIn').value=''; openChat(); $('#chatStatus').innerHTML='<span class="spin"></span>';
    const ctx = { instellingenprofiel: C.state.settings.naam, parameters: C.state.settings.params, beslisregels: C.state.settings.rules, waardekompasBelang: Object.fromEntries(ASP.map((a,i)=>[a,C.calc.bel[i]])), regels: C.calc.rows.map(r=>({ ...rowContext(r), systeemmodel: { Stech:r.Stech, RPNtech:r.RPNtech, Swaarde:r.Swaarde, RPNwaarde:r.RPNwaarde, basis:r.basis, safety:r.safety, compliance:r.compliance, tPrio:r.tPrio, definitief:r.prio, laatsteJaar:r.laatsteJaar, deadline:r.deadline, domWaarde:r.domWaarde }, aiVoorstel: C.state.ai[r.id] ? {vertrouwen:C.state.ai[r.id].vertrouwen, onzekerheden:C.state.ai[r.id].onzekerheden} : null })) };
    const sys = systemPrompt().replace(/ANTWOORD ALTIJD MET ÉÉN JSON-OBJECT[\s\S]*$/, 'Beantwoord vragen van de specialist/assetmanager over de dataset hieronder. Antwoord in helder Nederlands met platte tekst (geen JSON), verwijs naar regel-ID’s en benoem concreet welke veldwaarden je zou aanpassen en waarom.\n\nDATASET:\n' + JSON.stringify(ctx));
    try { const d = await C.callAgent([{role:'system',content:sys}, ...chatHistory.slice(-10)], false, {taak:'chat'}); if (window.STEMI_DB) window.STEMI_DB.logAiRun({ taak:'chat', model:d.model, input:{vraag:q}, output:{antwoord:d.content}, usage:d.usage }); chatHistory.push({role:'assistant',content:d.content||''}); } catch(e) { chatHistory.push({role:'assistant',content:'Fout: '+e.message}); }
    openChat(); const log=$('#chatLog'); log.scrollTop=log.scrollHeight;
  };
  $('#chatClear').onclick = () => { chatHistory=[]; openChat(); };
}
window.STEMI_UI = window.STEMI_UI || {}; Object.assign(window.STEMI_UI, { renderSpecialist: render, aiFillAll, analyzeRow, applyAI, AI_FIELDS });
})();
