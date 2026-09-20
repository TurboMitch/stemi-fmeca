/* 07 Scenario's – onderhoudsvarianten naast elkaar: kosten, risicogevolg en conditiebeeld */
(() => {
const C = window.STEMI; const { $, $$, esc, num, eur, pill } = C;

function lijst() { C.state.scenarios = C.state.scenarios || []; return C.state.scenarios; }
const STRAT = () => C.SCENARIO_STRATEGIE;
const stratLabel = k => (STRAT().find(x => x[0] === k) || [])[1] || k;

/** twee vaste vergelijkingsscenario's, zodat er altijd iets naast het plan staat */
function standaard() {
  return [
    { id: 'basis', naam: 'Zoals nu gepland', omschrijving: 'De handelingen zoals ze nu in het MJOP staan.', strategie: 'gepland', vast: true },
    { id: 'uitstel', naam: 'Uitstellen tot het laatste acceptabele jaar', omschrijving: 'Elke handeling zo laat als het beleid toestaat.', strategie: 'laatste', vast: true }
  ];
}
function alleScenarios() { return [...standaard(), ...lijst()]; }

function nieuw() {
  const s = { id: C.uid(), naam: 'Nieuw scenario', omschrijving: '', strategie: 'gepland', prios: [], plafond: null, maxSchuif: 10 };
  lijst().push(s); C.audit({ veld: 'scenario', nieuw: s.naam, bron: 'mens', opmerking: 'scenario toegevoegd' }); C.save(); return s;
}

/** rij in de vergelijkingstabel: label, waarde per scenario, en of hoger beter of slechter is */
function rijen(res) {
  const P = C.state.settings.params, n = C.calc.jaren.length;
  const f = v => v == null ? '—' : eur(v);
  return [
    ['Totaal op prijspeil ' + (P.prijspeil ?? P.startjaar), res.map(r => f(r.totaal)), 'De som van alle handelingen in de horizon, ongeacht het jaar.'],
    ['Totaal geïndexeerd', res.map(r => f(r.totaalIndex)), 'Uitstellen kost meer: elk jaar later betekent een hogere index.'],
    ['Contante waarde (NPV)', res.map(r => f(r.totaalNpv)), 'Later uitgeven is contant goedkoper; dit is de financiële kant van uitstellen.'],
    ['Piekjaar', res.map(r => `${r.piek.jaar} · ${eur(r.piek.bedrag)}`), 'Het zwaarste begrotingsjaar.'],
    ['Jaren boven het plafond', res.map(r => r.def.plafond ? String(r.bovenPlafond) : '—'), 'Alleen van toepassing met een jaarplafond.'],
    ['Handelingen verschoven', res.map(r => String(r.geschoven)), 'Aantal handelingen dat door dit scenario in een ander jaar valt.'],
    ['Voorbij het laatste acceptabele jaar', res.map(r => String(r.teLaat)), 'Hier neemt het risico aantoonbaar toe; vraagt een expliciet besluit.'],
    ['Voorbij de technische deadline (T)', res.map(r => String(r.naDeadline)), 'Het faalmoment volgens de specialist ligt vóór de uitvoering.'],
    ['Niet uitgevoerd', res.map(r => r.nietUitgevoerd.n ? `${r.nietUitgevoerd.n} × · ${eur(r.nietUitgevoerd.kosten)}` : '—'), 'Regels die dit scenario buiten de scope laat.'],
    ['Onbehandeld risico (som RPN)', res.map(r => r.nietUitgevoerd.rpn ? String(Math.round(r.nietUitgevoerd.rpn)) : '—'), 'Het waardegestuurde risico dat blijft staan.'],
    ['Gemiddelde conditie jaar 5', res.map(r => String(Math.round(r.conditie.jaar5 * 10) / 10)), 'NEN 2767: 1 is uitstekend, 6 is zeer slecht.'],
    ['Gemiddelde conditie jaar 15', res.map(r => String(Math.round(r.conditie.jaar15 * 10) / 10)), ''],
    ['Gemiddelde conditie einde horizon', res.map(r => String(Math.round(r.conditie.eind * 10) / 10)), `Na ${n} jaar.`],
    ['Regels conditie ≥ 5 in jaar 15', res.map(r => String(r.conditie.slecht15)), 'Aantal regels in slechte of zeer slechte staat.']
  ];
}

function render() {
  const el = $('#tab-scenario'); if (!el) return;
  const defs = alleScenarios();
  let res; try { res = defs.map(d => C.evalueerScenario(d)); }
  catch (e) { el.innerHTML = `<h2>07 Scenario's</h2><p class="warn">Doorrekenen mislukte: ${esc(e.message)}</p>`; return; }
  const n = C.cfg.prognoseJaren || 15, jaren = C.calc.jaren.slice(0, n);
  const kleuren = ['var(--accent)', '#c0392b', '#e0a80d', '#2d6fb3', '#7a4fbf', '#2f9e6f'];
  el.innerHTML = `<h2>07 Scenario's</h2>
    <p class="sub">Onderhoudsvarianten naast elkaar: wat kost het, wat gebeurt er met het risico en hoe ontwikkelt de technische staat zich. Een scenario wijzigt niets aan het project totdat je het toepast.</p>
    <div class="toolbar"><button class="btn" id="scNieuw">+ Scenario</button><span class="spacer"></span><label class="note">Grafieken ${n} jaar</label></div>

    <div class="grid two">
      <div class="card"><b>Kosten per jaar (geïndexeerd)</b>
        ${window.STEMI_UI.lineChart(jaren, res.map((r, i) => ({ naam: r.def.naam, waarden: r.perJaarIndex.slice(0, n) })), { min: 0, max: Math.max(1, ...res.flatMap(r => r.perJaarIndex.slice(0, n))), kleuren })}
      </div>
      <div class="card"><b>Gemiddelde NEN 2767-conditie</b>
        ${window.STEMI_UI.lineChart(jaren, res.map(r => ({ naam: r.def.naam, waarden: r.prognose.gemMet.slice(0, n) })), { min: 1, max: 6, kleuren })}
        <p class="note">Lager is beter: 1 is uitstekend, 6 is zeer slecht.</p>
      </div>
    </div>

    <div class="tablewrap" style="margin-top:14px"><table><thead><tr><th class="wrap">Kerncijfer</th>${defs.map((d, i) => `<th class="wrap"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${kleuren[i % kleuren.length]};margin-right:5px"></span>${esc(d.naam)}</th>`).join('')}</tr></thead><tbody>
      <tr><td class="note">Aanpak</td>${res.map(r => `<td class="note">${esc(stratLabel(r.def.strategie))}${r.def.prios?.length ? ` · alleen ${r.def.prios.join(', ')}` : ''}${r.def.plafond ? ` · plafond ${eur(r.def.plafond)}` : ''}</td>`).join('')}</tr>
      ${rijen(res).map(([l, ws, uitleg]) => `<tr><td>${l}${uitleg ? `<br><span class="note">${uitleg}</span>` : ''}</td>${ws.map(w => `<td class="num">${w}</td>`).join('')}</tr>`).join('')}
      <tr><td></td>${defs.map(d => `<td><button class="btn ghost small" data-apply="${d.id}">Toepassen op het MJOP</button></td>`).join('')}</tr>
    </tbody></table></div>

    <h3 style="margin-top:18px">Scenario's beheren</h3>
    ${lijst().length ? lijst().map(d => `<div class="card" style="margin-bottom:10px">
      <div class="grid two">
        <div class="field"><label>Naam</label><input data-sc="${d.id}" data-k="naam" value="${esc(d.naam)}"></div>
        <div class="field"><label>Aanpak</label><select data-sc="${d.id}" data-k="strategie">${STRAT().map(([k, l]) => `<option value="${k}" ${k === d.strategie ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>Budgetplafond per jaar (leeg = geen)</label><input data-sc="${d.id}" data-k="plafond" value="${d.plafond ?? ''}" placeholder="bijv. 150000"></div>
        <div class="field"><label>Max. jaren opschuiven binnen het plafond</label><input data-sc="${d.id}" data-k="maxSchuif" value="${d.maxSchuif ?? 10}"></div>
      </div>
      <label class="note">Alleen deze prioriteiten uitvoeren (niets aangevinkt = alles):</label><br>
      ${C.PRIOS.map(p => `<label class="note" style="margin-right:10px"><input type="checkbox" data-scp="${d.id}" value="${p}" ${d.prios?.includes(p) ? 'checked' : ''}> ${p}</label>`).join('')}
      <div class="field" style="margin-top:8px"><label>Omschrijving (komt in het rapport)</label><textarea data-sc="${d.id}" data-k="omschrijving" rows="2">${esc(d.omschrijving || '')}</textarea></div>
      <button class="btn ghost small" data-scdel="${d.id}">Scenario verwijderen</button>
    </div>`).join('') : '<p class="note">Nog geen eigen scenario. “Zoals nu gepland” en “Uitstellen tot het laatste acceptabele jaar” staan er altijd; voeg er een toe om bijvoorbeeld een jaarplafond of een prioriteitsgrens door te rekenen.</p>'}
    <p class="note">Toepassen zet de jaren van de handelingen om naar het scenario en legt elke verschuiving vast in de audittrail. Het rapport (tab 06) neemt de vergelijking op.</p>`;

  $('#scNieuw').onclick = () => { nieuw(); render(); };
  $$('[data-sc]').forEach(i => i.onchange = () => {
    const d = lijst().find(x => x.id === i.dataset.sc); if (!d) return; const k = i.dataset.k;
    d[k] = (k === 'plafond' || k === 'maxSchuif') ? num(i.value) : i.value;
    C.audit({ veld: 'scenario.' + k, nieuw: d[k], bron: 'mens', opmerking: d.naam }); C.save(); render();
  });
  $$('[data-scp]').forEach(i => i.onchange = () => {
    const d = lijst().find(x => x.id === i.dataset.scp); if (!d) return; d.prios = d.prios || [];
    d.prios = i.checked ? [...new Set([...d.prios, i.value])] : d.prios.filter(p => p !== i.value);
    C.save(); render();
  });
  $$('[data-scdel]').forEach(b => b.onclick = () => {
    if (!confirm('Scenario verwijderen?')) return;
    C.state.scenarios = lijst().filter(x => x.id !== b.dataset.scdel); C.save(); render();
  });
  $$('[data-apply]').forEach(b => b.onclick = () => {
    const r = res.find(x => x.def.id === b.dataset.apply); if (!r) return;
    const anders = r.posten.filter(p => p.jaar !== p.origineelJaar).length;
    if (!confirm(`Scenario “${r.def.naam}” toepassen?\n\n${anders || 'Geen'} handeling(en) krijgen een ander jaar.${r.teLaat ? `\n${r.teLaat} daarvan komen voorbij het laatste acceptabele jaar.` : ''}${r.nietUitgevoerd.n ? `\n\nLet op: ${r.nietUitgevoerd.n} regels vallen buiten dit scenario. Toepassen verandert die niet — ze blijven in het MJOP staan.` : ''}`)) return;
    const k = C.pasScenarioToe(r); window.STEMI_UI.renderAll('scenario'); C.toast(`${k} handeling(en) verschoven volgens “${r.def.naam}”`);
  });
}
window.STEMI_UI = window.STEMI_UI || {}; Object.assign(window.STEMI_UI, { renderScenario: render, alleScenarios, evalueerAlle: () => alleScenarios().map(d => C.evalueerScenario(d)) });
})();
