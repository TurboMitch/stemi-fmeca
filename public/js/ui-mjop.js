/* 05 MJOP – meerdere handelingen per element, momenten en cycli, indexering/btw/NPV en budgetsturing */
(() => {
const C = window.STEMI; const { $, $$, esc, num, eur, pill } = C;
let plan = null;                       // laatst berekende budgetvoorstel (nog niet toegepast)

/** breedte van het tekenvlak: op een smal scherm een smaller vlak, zodat tekst leesbaar blijft */
const smal = w => (window.innerWidth < 700 && !(w && w.vast)) ? 520 : ((w && w.w) || w || 900);
/** staafdiagram; opts.cap tekent een plafondlijn, opts.cum een cumulatieve lijn */
function barChart(labels, values, opts = {}) {
  const W=smal(opts.w),H=opts.h||220,pl=56,pb=28,max=Math.max(1,...values,opts.cap||0), bw=(W-pl-10)/labels.length, y=v=>H-pb-(H-pb-10)*v/max;
  const bars = values.map((v,i)=>{const h=(H-pb-10)*v/max; return `<rect x="${pl+i*bw+1}" y="${H-pb-h}" width="${Math.max(1,bw-2)}" height="${h}" rx="2" fill="${opts.cap&&v>opts.cap?'var(--rood,#c0392b)':'var(--accent)'}"><title>${labels[i]}: ${eur(v)}</title></rect>${labels.length<=20||i%5===0?`<text x="${pl+i*bw+bw/2}" y="${H-8}" font-size="10" text-anchor="middle">${labels[i]}</text>`:''}`}).join('');
  const ticks=[0,.5,1].map(t=>`<text x="${pl-6}" y="${y(max*t)+4}" font-size="10" text-anchor="end">${Math.round(max*t/1000)}k</text><line x1="${pl}" x2="${W}" y1="${y(max*t)}" y2="${y(max*t)}" stroke="var(--line)"/>`).join('');
  const cap = opts.cap ? `<line x1="${pl}" x2="${W}" y1="${y(opts.cap)}" y2="${y(opts.cap)}" stroke="#c0392b" stroke-width="1.5" stroke-dasharray="5 3"><title>Plafond ${eur(opts.cap)}</title></line><text x="${W-4}" y="${y(opts.cap)-4}" font-size="10" text-anchor="end" fill="#c0392b">plafond ${eur(opts.cap)}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="max-height:${H+60}px">${ticks}${bars}${cap}</svg>`;
}
/** lijndiagram voor de conditieprognose: één of meer reeksen op een vaste y-as (NEN-conditie 1–6) */
function lineChart(labels, reeksen, opts = {}) {
  const W=smal(opts.w),H=opts.h||220,min=opts.min??1,max=opts.max??6;
  // y-as: hooguit ~6 streepjes met een ronde stap, ook bij bedragen (anders duizenden labels)
  const bereik=Math.max(1e-9,max-min), ruw=bereik/5, mag=Math.pow(10,Math.floor(Math.log10(ruw))), stap=[1,2,2.5,5,10].map(f=>f*mag).find(f=>f>=ruw)||ruw;
  const fmt=v=>Math.abs(max)>=10000?Math.round(v/1000)+'k':String(Math.round(v*100)/100);
  const pl=Math.max(40,12+7*fmt(max).length),pb=28;
  const x=i=>pl+(W-pl-22)*(labels.length<2?0.5:i/(labels.length-1)), y=v=>H-pb-(H-pb-10)*(v-min)/(max-min);
  const kleuren = opts.kleuren || ['var(--accent)','#c0392b','#8e8e93'];
  const lijnen = reeksen.map((r,k)=>`<polyline fill="none" stroke="${kleuren[k%kleuren.length]}" stroke-width="2" ${r.stippel?'stroke-dasharray="5 3"':''} points="${r.waarden.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}"><title>${esc(r.naam)}</title></polyline>`).join('');
  const ticks=[];for(let v=Math.ceil(min/stap)*stap;v<=max+1e-9;v+=stap)ticks.push(`<text x="${pl-6}" y="${y(v)+4}" font-size="10" text-anchor="end">${fmt(v)}</text><line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/>`);
  const jaar = labels.map((l,i)=> (labels.length<=20||i%5===0) ? `<text x="${x(i)}" y="${H-8}" font-size="10" text-anchor="middle">${l}</text>` : '').join('');
  const leg = reeksen.map((r,k)=>`<span class="note" style="margin-right:12px"><span style="display:inline-block;width:14px;height:3px;background:${kleuren[k%kleuren.length]};vertical-align:middle;margin-right:4px"></span>${esc(r.naam)}</span>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="max-height:${H+60}px">${ticks.join('')}${lijnen}${jaar}</svg><div>${leg}</div>`;
}
function ensureOwn(r) {
  // eerste handmatige bewerking: maak van de automatische maatregel een eigen record
  if (C.state.maatregelen.some(m => m.regelId === r.id)) return;
  const a = r.maatregelen[0]; C.state.maatregelen.push({ id: C.uid(), regelId: r.id, handeling: a.handeling, jaar: a.jaar, kosten: a.kosten, cyclus: null, tot: null, bron: 'mens' });
}
const weergave = () => C.cfg.mjopWeergave || C.calc.weergave;
const wLabel = w => (C.WEERGAVEN.find(x=>x[0]===w)||[])[1] || w;

/** kaart met de vier totalen naast elkaar, zodat het prijseffect zichtbaar is */
function totalenHtml() {
  const P = C.state.settings.params, n = C.calc.jaren.length;
  const rij = (l, v, note) => `<tr><td>${l}</td><td class="num"><b>${eur(v)}</b></td><td class="note">${note}</td></tr>`;
  return `<div class="card"><h3 style="margin-top:0">Totalen over ${n} jaar</h3><table class="mini"><tbody>
    ${rij('Prijspeil ' + (P.prijspeil ?? P.startjaar) + ' (excl. btw)', C.calc.totaal, 'kengetallen zoals ingevoerd')}
    ${rij('Geïndexeerd naar uitvoeringsjaar', C.calc.totaalIndex, `inflatie ${C.pct1(P.inflatie)} per jaar` + (Object.keys(P.inflatiePerJaar||{}).length ? ` (${Object.keys(P.inflatiePerJaar).length} jaar met eigen voet)` : ''))}
    ${rij('Geïndexeerd incl. btw', C.calc.totaalBtw, `btw ${num(P.btwPercentage)??0}% · begroting staat op ${P.btwWeergave === 'incl' ? 'inclusief' : 'exclusief'}`)}
    ${rij('Contante waarde (NPV)', C.calc.totaalNpv, `discontovoet ${C.pct1(P.discontovoet)}, peildatum ${P.startjaar}`)}
  </tbody></table><p class="note">Gemiddeld ${eur(C.calc.totaalVan(weergave())/n)} per jaar in de weergave “${esc(wLabel(weergave()))}”. De parameters staan in <a href="#" data-go="eigenaar">tab 01, Financiële parameters</a>.</p></div>`;
}

/** budgetsturing: plafond invullen, voorstel bekijken, toepassen */
function budgetHtml() {
  const P = C.state.settings.params, w = weergave();
  const eigen = Object.entries(P.budgetplafondPerJaar||{}).filter(([,v])=>num(v)!=null);
  let voorstel = '';
  if (plan) {
    const R = plan.risico;
    voorstel = `<div class="card" style="margin-top:10px"><b>Voorstel: ${R.geschoven} handeling(en) schuiven, samen ${eur(R.bedrag)} (prijspeil)</b>
      <p class="note">Laagste risico schuift eerst: eerst de hoogste prioriteitsklasse (P5 vóór P1), daarna de laagste RPN-waarde. Cyclische handelingen blijven staan, want die verplaatsen de hele cyclus.</p>
      <table class="mini"><tbody>
        <tr><td>Voorbij het laatste acceptabele jaar</td><td class="num ${R.voorbijLaatsteJaar?'warn':''}"><b>${R.voorbijLaatsteJaar}</b></td><td class="note">hier neemt het risico aantoonbaar toe – vraagt een expliciet besluit van de eigenaar</td></tr>
        <tr><td>Voorbij de technische deadline (T)</td><td class="num ${R.voorbijDeadline?'warn':''}"><b>${R.voorbijDeadline}</b></td><td class="note">faalmoment volgens de specialist ligt vóór de nieuwe uitvoering</td></tr>
        <tr><td>Per prioriteit</td><td colspan="2">${R.perPrio.length?R.perPrio.map(x=>`${pill(x.prio)} ${x.n}${x.buiten?` <span class="warn">(${x.buiten} te laat)</span>`:''}`).join(' · '):'<span class="note">—</span>'}</td></tr>
        ${R.nietOplosbaar.length?`<tr><td>Niet oplosbaar binnen het plafond</td><td colspan="2" class="warn">${R.nietOplosbaar.map(o=>`${o.jaar}: ${eur(o.bedrag)} van max ${eur(o.plafond)}`).join(' · ')}</td></tr>`:''}
      </tbody></table>
      <div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>ID</th><th>Element</th><th class="wrap">Handeling</th><th>Prio</th><th>Van</th><th>Naar</th><th>Uiterlijk</th><th>Kosten</th><th class="wrap">Gevolg</th></tr></thead><tbody>
      ${plan.shifts.slice(0,200).map(s=>`<tr><td>${s.regel}</td><td>${esc(s.element)}</td><td class="wrap note">${esc((s.handeling||'').slice(0,90))}</td><td>${pill(s.prio)}</td><td class="num">${s.origineelJaar}</td><td class="num"><b>${s.jaar}</b></td><td class="num">${s.laatsteJaar??'—'}</td><td class="num">${eur(s.kosten)}</td><td class="wrap ${s.voorbijLaatsteJaar?'warn':'note'}">${s.voorbijDeadline?'voorbij technische deadline '+s.deadline:s.voorbijLaatsteJaar?'voorbij laatste acceptabele jaar '+s.laatsteJaar:'binnen de acceptabele termijn'}</td></tr>`).join('')}
      </tbody></table></div>${plan.shifts.length>200?`<p class="note">Eerste 200 van ${plan.shifts.length} regels.</p>`:''}
      <div class="toolbar" style="margin-top:8px"><button class="btn" id="bgApply">Voorstel toepassen (${plan.shifts.length})</button><button class="btn ghost" id="bgDrop">Verwerpen</button><span class="note">Toepassen zet de jaren vast in de handelingen en legt elke verschuiving vast in de audittrail.</span></div></div>`;
  }
  return `<div class="card" style="margin-top:14px"><h3 style="margin-top:0">Budgetsturing</h3>
    <p class="note">Een plafond per jaar is een budget in geld van dát jaar, dus het voorstel toetst op het <b>geïndexeerde</b> bedrag.</p>
    <div class="toolbar"><label class="note">Plafond per jaar <input class="n" id="bgCap" style="width:110px" value="${P.budgetplafond??''}" placeholder="bijv. 150000"></label>
      <label class="note">Max. jaren opschuiven <input class="n" id="bgMax" style="width:60px" value="${C.cfg.bgMax??10}"></label>
      <button class="btn" id="bgCalc">Voorstel berekenen</button><span class="spacer"></span>
      <span class="note">${eigen.length?`Eigen plafond in ${eigen.length} jaar: ${eigen.slice(0,6).map(([j,v])=>`${j} ${eur(num(v))}`).join(', ')}${eigen.length>6?'…':''}`:'Nog geen jaren met een eigen plafond'}</span></div>
    <details><summary class="note">Plafond per jaar afwijkend instellen</summary><div class="tablewrap" style="margin-top:8px"><table><thead><tr>${C.calc.jaren.slice(0,15).map(j=>`<th>${j}</th>`).join('')}</tr></thead><tbody><tr>${C.calc.jaren.slice(0,15).map(j=>`<td><input class="n" data-cap="${j}" style="width:80px" value="${P.budgetplafondPerJaar?.[j]??''}" placeholder="—"></td>`).join('')}</tr></tbody></table></div></details>
    ${voorstel}</div>`;
}

const KAP = 250; let alleRijen = false;
function render() {
  const el = $('#tab-mjop'); const Ralles = C.calc.rows, R = alleRijen ? Ralles : Ralles.slice(0, KAP), jaren = C.calc.jaren, n = C.cfg.mjopJaren || 15, show = jaren.slice(0, n);
  const w = weergave(), serie = C.calc.serieVan(w), P = C.state.settings.params;
  const cap = num(P.budgetplafond); const cum = []; serie.forEach((v,i)=>cum.push((cum[i-1]||0)+v));
  el.innerHTML = `
    <h2>05 MJOP ${P.horizon} jaar</h2><p class="sub">Per element één of meer <b>handelingen</b>, elk met een moment (jaar), kosten en optioneel een <b>cyclus</b> (herhaling elke n jaar, tot jaar x). Zonder eigen handelingen geldt automatisch: besluit AM → anders laatste acceptabele jaar, kosten = definitieve maatregelkosten. Kosten voer je in op <b>prijspeil ${P.prijspeil??P.startjaar}</b>; indexering, btw en contante waarde rekent het model zelf.</p>
    <div class="toolbar"><label class="note">Toon <select id="mjopN">${[10,15,20,30,40].map(x=>`<option ${x===n?'selected':''}>${x}</option>`).join('')}</select> jaar</label>
      <label class="note">Weergave <select id="mjopW">${C.WEERGAVEN.map(([k,l])=>`<option value="${k}" ${k===w?'selected':''}>${l}</option>`).join('')}</select></label>
      <span class="spacer"></span><b>Totaal ${eur(C.calc.totaalVan(w))}</b> over ${jaren.length} jaar · gemiddeld ${eur(C.calc.totaalVan(w)/jaren.length)}/jaar</div>
    <div class="grid two"><div class="card">${barChart(show, serie.slice(0, show.length), { cap })}<p class="note">${esc(wLabel(w))}${cap?` · rode staven liggen boven het plafond van ${eur(cap)}`:''}</p></div>${totalenHtml()}</div>
    ${budgetHtml()}
    <div class="tablewrap" style="margin-top:14px"><table><thead><tr><th>ID</th><th>Element</th><th>Prio</th><th>Uiterlijk</th><th>Deadline</th><th class="wrap">Handeling</th><th>Jaar</th><th>Kosten (prijspeil)</th><th>In uitvoeringsjaar</th><th>Cyclus (jr)</th><th>Tot</th><th>Bron</th><th></th>${show.map(j=>`<th>${j}</th>`).join('')}</tr></thead><tbody>
    ${R.map(r => r.maatregelen.map((m,mi) => `<tr class="${mi>0?'sub':''}">
      ${mi===0?`<td rowspan="${r.maatregelen.length}">${r.id}</td><td rowspan="${r.maatregelen.length}">${esc(r.insp.element)}<br><button class="btn ghost small" data-addm="${r.id}">+ handeling</button></td><td rowspan="${r.maatregelen.length}">${pill(r.prio)}</td><td rowspan="${r.maatregelen.length}">${r.laatsteJaar??'—'}</td><td rowspan="${r.maatregelen.length}">${r.deadline??'—'}</td>`:''}
      <td class="blauw wrap"><textarea data-m="${m.id}" data-r="${r.id}" data-k="handeling">${esc(m.handeling||'')}</textarea></td>
      <td class="blauw"><input class="n" data-m="${m.id}" data-r="${r.id}" data-k="jaar" value="${m.jaar??''}">${m.jaar!=null&&r.laatsteJaar!=null&&m.jaar>r.laatsteJaar&&mi===0?' <span class="warn" title="Later dan laatste acceptabele jaar">!</span>':''}</td>
      <td class="blauw"><input class="n" style="width:80px" data-m="${m.id}" data-r="${r.id}" data-k="kosten" value="${m.kosten??''}"></td>
      <td class="num note" title="${esc(wLabel(w))}">${m.kosten!=null&&m.jaar!=null?eur(C.bedrag(m.kosten,m.jaar,w)):''}${m.jaren.length>1?` <span class="note">×${m.jaren.length}</span>`:''}</td>
      <td class="blauw"><input class="n" data-m="${m.id}" data-r="${r.id}" data-k="cyclus" value="${m.cyclus??''}" placeholder="—"></td>
      <td class="blauw"><input class="n" data-m="${m.id}" data-r="${r.id}" data-k="tot" value="${m.tot??''}" placeholder="${jaren[jaren.length-1]}"></td>
      <td class="note">${m.auto?'automatisch':esc(m.bron||'mens')}</td>
      <td>${m.auto?'':`<button class="btn ghost small" data-delm="${m.id}">✕</button>`}</td>
      ${show.map(j=>`<td class="num ${m.jaren.includes(j)?'blauw':''}">${m.jaren.includes(j)?eur(C.bedrag(m.kosten??0,j,w)):''}</td>`).join('')}</tr>`).join('')).join('')}
    <tr><td colspan="8"><b>Totaal per jaar (${esc(wLabel(w))})</b></td><td class="num"><b>${eur(C.calc.totaalVan(w))}</b></td><td colspan="4"></td>${show.map((j,i)=>`<td class="num ${cap&&serie[i]>cap?'warn':''}"><b>${serie[i]?eur(serie[i]):''}</b></td>`).join('')}</tr>
    <tr><td colspan="8" class="note">Cumulatief</td><td colspan="5"></td>${show.map((j,i)=>`<td class="num note">${eur(cum[i])}</td>`).join('')}</tr>
    </tbody></table></div>
    ${Ralles.length > KAP ? `<p class="note">${R.length} van ${Ralles.length} elementen getoond (de totalen en het diagram gaan over alle ${Ralles.length}). <button class="btn ghost small" id="mjopAlles">${alleRijen ? `alleen de eerste ${KAP} tonen` : 'alles tonen (kan traag zijn)'}</button></p>` : ''}
    <p class="note" style="margin-top:8px">Voorbeeld cyclus: “Conserverend schilderonderhoud” jaar 2031, cyclus 8 → 2031, 2039, 2047, 2055, 2063. Elementvervanging: handeling “Vervangen gevel” in het jaar aanleg + vervangingscyclus, kosten = kosten volledig element.</p>`;
  $('#mjopN').onchange = e => { C.cfg.mjopJaren = +e.target.value; C.saveCfg(); render(); };
  const ma = $('#mjopAlles'); if (ma) ma.onclick = () => { alleRijen = !alleRijen; render(); };
  $('#mjopW').onchange = e => { C.cfg.mjopWeergave = e.target.value; C.saveCfg(); render(); };
  $$('[data-go]').forEach(b => b.onclick = e => { e.preventDefault(); window.STEMI_UI.switchTab(b.dataset.go); });
  $$('[data-m]').forEach(i => i.onchange = () => { const r = R.find(x=>x.id===+i.dataset.r); ensureOwn(r); let m = C.state.maatregelen.find(x=>x.id===i.dataset.m) || C.state.maatregelen.find(x=>x.regelId===r.id); const k=i.dataset.k; const old=m[k]; m[k] = k==='handeling' ? i.value : num(i.value); m.bron='mens'; C.audit({regel:r.id, veld:'mjop.'+k, oud:old, nieuw:m[k], bron:'mens'}); C.save(); window.STEMI_UI.renderAll('mjop'); });
  $$('[data-addm]').forEach(b => b.onclick = () => { const r = R.find(x=>x.id===+b.dataset.addm); ensureOwn(r); C.state.maatregelen.push({ id: C.uid(), regelId: r.id, handeling: '', jaar: r.laatsteJaar ?? C.calc.start, kosten: null, cyclus: null, tot: null, bron:'mens' }); C.save(); window.STEMI_UI.renderAll('mjop'); });
  $$('[data-delm]').forEach(b => b.onclick = () => { C.state.maatregelen = C.state.maatregelen.filter(x=>x.id!==b.dataset.delm); C.save(); window.STEMI_UI.renderAll('mjop'); });
  $('#bgCalc').onclick = () => { const c = num($('#bgCap').value), mx = num($('#bgMax').value) ?? 10;
    if (c == null || c <= 0) { C.toast('Vul eerst een plafond per jaar in'); return; }
    P.budgetplafond = c; C.cfg.bgMax = mx; C.saveCfg(); C.save();
    plan = C.budgetPlan({ plafond: c, maxSchuif: mx });
    if (!plan.shifts.length) C.toast(plan.risico.nietOplosbaar.length ? 'Geen schuifruimte gevonden' : 'Alle jaren passen al binnen het plafond');
    render(); };
  $$('[data-cap]').forEach(i => i.onchange = () => { P.budgetplafondPerJaar = P.budgetplafondPerJaar || {}; const v = num(i.value); if (v == null) delete P.budgetplafondPerJaar[i.dataset.cap]; else P.budgetplafondPerJaar[i.dataset.cap] = v; C.audit({veld:'param.budgetplafond.'+i.dataset.cap, nieuw:v, bron:'mens'}); C.save(); plan = null; render(); });
  const ap = $('#bgApply'); if (ap) ap.onclick = () => { if (!confirm(`${plan.shifts.length} handeling(en) naar een later jaar zetten?` + (plan.risico.voorbijLaatsteJaar ? `\n\n${plan.risico.voorbijLaatsteJaar} daarvan komen voorbij het laatste acceptabele jaar: het risico neemt daar aantoonbaar toe.` : ''))) return;
    const n2 = C.pasBudgetToe(plan); plan = null; window.STEMI_UI.renderAll('mjop'); C.toast(`${n2} handeling(en) verschoven en vastgelegd in de audittrail`); };
  const dr = $('#bgDrop'); if (dr) dr.onclick = () => { plan = null; render(); };
}
window.STEMI_UI = window.STEMI_UI || {}; window.STEMI_UI.renderMjop = render; window.STEMI_UI.barChart = barChart; window.STEMI_UI.lineChart = lineChart;
})();
