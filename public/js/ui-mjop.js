/* 05 MJOP – meerdere handelingen per element, momenten en cycli */
(() => {
const C = window.STEMI; const { $, $$, esc, num, eur, pill } = C;

function barChart(labels, values) {
  const W=900,H=220,pl=56,pb=28,max=Math.max(1,...values), bw=(W-pl-10)/labels.length;
  const bars = values.map((v,i)=>{const h=(H-pb-10)*v/max; return `<rect x="${pl+i*bw+1}" y="${H-pb-h}" width="${Math.max(1,bw-2)}" height="${h}" rx="2" fill="var(--accent)"><title>${labels[i]}: ${eur(v)}</title></rect>${labels.length<=20||i%5===0?`<text x="${pl+i*bw+bw/2}" y="${H-8}" font-size="10" text-anchor="middle">${labels[i]}</text>`:''}`}).join('');
  const ticks=[0,.5,1].map(t=>`<text x="${pl-6}" y="${H-pb-(H-pb-10)*t+4}" font-size="10" text-anchor="end">${Math.round(max*t/1000)}k</text><line x1="${pl}" x2="${W}" y1="${H-pb-(H-pb-10)*t}" y2="${H-pb-(H-pb-10)*t}" stroke="var(--line)"/>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${ticks}${bars}</svg>`;
}
function ensureOwn(r) {
  // eerste handmatige bewerking: maak van de automatische maatregel een eigen record
  if (C.state.maatregelen.some(m => m.regelId === r.id)) return;
  const a = r.maatregelen[0]; C.state.maatregelen.push({ id: C.uid(), regelId: r.id, handeling: a.handeling, jaar: a.jaar, kosten: a.kosten, cyclus: null, tot: null, bron: 'mens' });
}
function render() {
  const el = $('#tab-mjop'); const R = C.calc.rows, jaren = C.calc.jaren, n = C.cfg.mjopJaren || 15, show = jaren.slice(0, n);
  const perJaar = C.calc.perJaar;
  el.innerHTML = `
    <h2>05 MJOP ${C.state.settings.params.horizon} jaar</h2><p class="sub">Per element één of meer <b>handelingen</b>, elk met een moment (jaar), kosten en optioneel een <b>cyclus</b> (herhaling elke n jaar, tot jaar x). Zonder eigen handelingen geldt automatisch: besluit AM → anders laatste acceptabele jaar, kosten = definitieve maatregelkosten.</p>
    <div class="toolbar"><label class="note">Toon <select id="mjopN">${[10,15,20,30,40].map(x=>`<option ${x===n?'selected':''}>${x}</option>`).join('')}</select> jaar</label><span class="spacer"></span><b>Totaal ${eur(C.calc.totaal)}</b> over ${jaren.length} jaar · gemiddeld ${eur(C.calc.totaal/jaren.length)}/jaar</div>
    <div class="card">${barChart(show, perJaar.slice(0, show.length))}</div>
    <div class="tablewrap" style="margin-top:14px"><table><thead><tr><th>ID</th><th>Element</th><th>Prio</th><th>Uiterlijk</th><th>Deadline</th><th class="wrap">Handeling</th><th>Jaar</th><th>Kosten</th><th>Cyclus (jr)</th><th>Tot</th><th>Bron</th><th></th>${show.map(j=>`<th>${j}</th>`).join('')}</tr></thead><tbody>
    ${R.map(r => r.maatregelen.map((m,mi) => `<tr class="${mi>0?'sub':''}">
      ${mi===0?`<td rowspan="${r.maatregelen.length}">${r.id}</td><td rowspan="${r.maatregelen.length}">${esc(r.insp.element)}<br><button class="btn ghost small" data-addm="${r.id}">+ handeling</button></td><td rowspan="${r.maatregelen.length}">${pill(r.prio)}</td><td rowspan="${r.maatregelen.length}">${r.laatsteJaar??'—'}</td><td rowspan="${r.maatregelen.length}">${r.deadline??'—'}</td>`:''}
      <td class="blauw wrap"><textarea data-m="${m.id}" data-r="${r.id}" data-k="handeling">${esc(m.handeling||'')}</textarea></td>
      <td class="blauw"><input class="n" data-m="${m.id}" data-r="${r.id}" data-k="jaar" value="${m.jaar??''}">${m.jaar!=null&&r.laatsteJaar!=null&&m.jaar>r.laatsteJaar&&mi===0?' <span class="warn" title="Later dan laatste acceptabele jaar">!</span>':''}</td>
      <td class="blauw"><input class="n" style="width:80px" data-m="${m.id}" data-r="${r.id}" data-k="kosten" value="${m.kosten??''}"></td>
      <td class="blauw"><input class="n" data-m="${m.id}" data-r="${r.id}" data-k="cyclus" value="${m.cyclus??''}" placeholder="—"></td>
      <td class="blauw"><input class="n" data-m="${m.id}" data-r="${r.id}" data-k="tot" value="${m.tot??''}" placeholder="${jaren[jaren.length-1]}"></td>
      <td class="note">${m.auto?'automatisch':esc(m.bron||'mens')}</td>
      <td>${m.auto?'':`<button class="btn ghost small" data-delm="${m.id}">✕</button>`}</td>
      ${show.map(j=>`<td class="num ${m.jaren.includes(j)?'blauw':''}">${m.jaren.includes(j)?eur(m.kosten):''}</td>`).join('')}</tr>`).join('')).join('')}
    <tr><td colspan="7"><b>Totaal per jaar</b></td><td class="num"><b>${eur(C.calc.totaal)}</b></td><td colspan="4"></td>${show.map((j,i)=>`<td class="num"><b>${perJaar[i]?eur(perJaar[i]):''}</b></td>`).join('')}</tr>
    </tbody></table></div>
    <p class="note" style="margin-top:8px">Voorbeeld cyclus: “Conserverend schilderonderhoud” jaar 2031, cyclus 8 → 2031, 2039, 2047, 2055, 2063. Elementvervanging: handeling “Vervangen gevel” in het jaar aanleg + vervangingscyclus, kosten = kosten volledig element.</p>`;
  $('#mjopN').onchange = e => { C.cfg.mjopJaren = +e.target.value; C.saveCfg(); render(); };
  $$('[data-m]').forEach(i => i.onchange = () => { const r = R.find(x=>x.id===+i.dataset.r); ensureOwn(r); let m = C.state.maatregelen.find(x=>x.id===i.dataset.m) || C.state.maatregelen.find(x=>x.regelId===r.id); const k=i.dataset.k; const old=m[k]; m[k] = k==='handeling' ? i.value : num(i.value); m.bron='mens'; C.audit({regel:r.id, veld:'mjop.'+k, oud:old, nieuw:m[k], bron:'mens'}); C.save(); window.STEMI_UI.renderAll('mjop'); });
  $$('[data-addm]').forEach(b => b.onclick = () => { const r = R.find(x=>x.id===+b.dataset.addm); ensureOwn(r); C.state.maatregelen.push({ id: C.uid(), regelId: r.id, handeling: '', jaar: r.laatsteJaar ?? C.calc.start, kosten: null, cyclus: null, tot: null, bron:'mens' }); C.save(); window.STEMI_UI.renderAll('mjop'); });
  $$('[data-delm]').forEach(b => b.onclick = () => { C.state.maatregelen = C.state.maatregelen.filter(x=>x.id!==b.dataset.delm); C.save(); window.STEMI_UI.renderAll('mjop'); });
}
window.STEMI_UI = window.STEMI_UI || {}; window.STEMI_UI.renderMjop = render; window.STEMI_UI.barChart = barChart;
})();
