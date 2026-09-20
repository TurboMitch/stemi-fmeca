/* AI-kwaliteit – referentieset van door mensen vastgestelde waarden, en evaluaties per model
   die meten hoe ver een model daarvan afwijkt en wat een ronde kost. */
(() => {
const C = window.STEMI, DB = window.STEMI_DB; const { $, $$, esc, num, eur, pill } = C;
const U = () => window.STEMI_UI;
let evaluaties = null, bezig = null, laatsteDetail = null;
const fmt = d => d ? new Date(d).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) : '';
const pct = v => v == null ? '—' : Math.round(v * 100) + '%';
const g2 = v => v == null ? '—' : (Math.round(v * 100) / 100).toString().replace('.', ',');

/** prijs per miljoen tokens uit de OpenRouter-lijst, als die is opgehaald */
function prijsVan(model) {
  const m = (window._models || []).find(x => x.id === model);
  if (!m) return null;
  const inPrijs = parseFloat(m.prompt), uitPrijs = parseFloat(m.completion);
  return (isNaN(inPrijs) || isNaN(uitPrijs)) ? null : { in: inPrijs, uit: uitPrijs };
}
function kostenVan(model, tokensIn, tokensUit) {
  const p = prijsVan(model); if (!p) return null;
  return (tokensIn || 0) * p.in + (tokensUit || 0) * p.uit;
}
const usd = v => v == null ? '—' : '$ ' + (v < 0.01 ? v.toFixed(5) : v.toFixed(v < 1 ? 4 : 2));

/** één regel door een model laten beoordelen zonder iets in het project te wijzigen */
async function evalueerRegel(r, model, uit) {
  const t0 = Date.now();
  const msgs = [{ role: 'system', content: U().systemPrompt() },
                { role: 'user', content: `Interpreteer deze FMECA-regel en vul tabblad 03 volledig in.\n\n${JSON.stringify(U().rowContext(r), null, 1)}` }];
  const d = await C.callAgent(msgs, true, { taak: 'specialist', model, max_tokens: 8000, onWacht: (ms, p, m) => { uit.wacht = `poging ${p + 1} na ${Math.round(ms / 1000)}s (${m.slice(0, 60)})`; toonVoortgang(); } });
  const voorstel = C.parseJSON(d.content);
  const flags = U().keurVoorstel(voorstel, r) || [];     // zelfde plausibiliteitscontrole als in tab 03
  return { voorstel, flags, usage: d.usage || {}, model: d.model || model, duurMs: Date.now() - t0 };
}

function toonVoortgang() {
  const el = $('#kwVoortgang'); if (!el || !bezig) return;
  const b = bezig;
  el.innerHTML = `<div class="card"><b>Evaluatie bezig: ${esc(b.model)}</b>
    <p class="note">${b.klaar} van ${b.totaal} regels · ${b.mislukt} mislukt${b.wacht ? ` · wachten: ${esc(b.wacht)}` : ''} · tot nu ${usd(kostenVan(b.model, b.tokensIn, b.tokensUit))}</p>
    <div style="height:8px;background:var(--line);border-radius:4px;overflow:hidden"><div style="height:100%;width:${Math.round(100 * b.klaar / Math.max(1, b.totaal))}%;background:var(--accent)"></div></div>
    <p class="note" style="margin-top:6px">Je kunt dit tabblad openlaten; sluit de pagina niet.</p></div>`;
}

async function startEvaluatie(model, maxRegels) {
  const ref = U().huidigeReferentie();
  const ids = Object.keys(ref).map(Number).sort((a, b) => a - b).slice(0, maxRegels || 999);
  const rijen = ids.map(id => C.calc.rows.find(r => r.id === id)).filter(Boolean);
  if (!rijen.length) { C.toast('Geen regels in de referentieset'); return; }
  bezig = { model, totaal: rijen.length, klaar: 0, mislukt: 0, tokensIn: 0, tokensUit: 0, wacht: '' };
  render(); toonVoortgang();
  const perRegel = [], vergelijkingen = []; const t0 = Date.now();
  const CONC = 2; let i = 0;
  async function werker() {
    while (i < rijen.length) {
      const r = rijen[i++];
      try {
        const res = await evalueerRegel(r, model, bezig);
        const vgl = C.vergelijkVoorstel(ref[r.id].waarden, res.voorstel, { fac: C.calc.fac });
        bezig.tokensIn += res.usage.prompt_tokens || 0; bezig.tokensUit += res.usage.completion_tokens || 0;
        vergelijkingen.push(vgl);
        perRegel.push({ regel: r.id, element: r.insp.element, vgl, flags: res.flags.length, signalen: res.flags.filter(f => f.signaal).length,
          duurMs: res.duurMs, tokens: (res.usage.prompt_tokens || 0) + (res.usage.completion_tokens || 0),
          voorstel: { O: res.voorstel.O, D: res.voorstel.D, Tjaar: res.voorstel.Tjaar, effect: res.voorstel.effect, kostenSpecialist: res.voorstel.kostenSpecialist } });
      } catch (e) { bezig.mislukt++; perRegel.push({ regel: r.id, element: r.insp.element, fout: e.message }); }
      bezig.klaar++; bezig.wacht = ''; toonVoortgang();
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, rijen.length) }, werker));
  const samenvatting = C.vatEvaluatieSamen(vergelijkingen);
  const duurMs = Date.now() - t0;
  const kosten = kostenVan(model, bezig.tokensIn, bezig.tokensUit);
  try {
    await DB.bewaarEvaluatie({ model, promptVersie: DB.hashVan(U().systemPrompt()), context: C.cfg.context || '',
      n: vergelijkingen.length, mislukt: bezig.mislukt, resultaat: { samenvatting, perRegel },
      tokensIn: bezig.tokensIn, tokensUit: bezig.tokensUit, kostenUsd: kosten, duurMs });
    evaluaties = await DB.evaluatiesVan();
    C.audit({ veld: 'ai-evaluatie', nieuw: `${model}: ${vergelijkingen.length} regels`, bron: 'systeem', model,
      opmerking: `prioriteit gelijk ${pct(samenvatting.prio.gelijk)}, O-afwijking ${g2(samenvatting.O.gem)}, kosten ${usd(kosten)}` });
    C.save();
  } catch (e) { C.toast('Opslaan van de evaluatie mislukt: ' + e.message, 8000); }
  bezig = null; render();
  C.toast(`Evaluatie klaar: prioriteit gelijk in ${pct(samenvatting.prio.gelijk)} van de regels`, 8000);
}

function referentieHtml() {
  const ref = U().huidigeReferentie() || {}, ids = Object.keys(ref).map(Number).sort((a, b) => a - b);
  const kandidaten = C.calc.rows.filter(r => U().menselijkGecontroleerd(r));
  const gewijzigd = ids.filter(id => { const r = C.calc.rows.find(x => x.id === id); return r && ref[id].invoer_hash && ref[id].invoer_hash !== DB.hashVan(U().rowContext(r)); });
  return `<div class="card"><h3 style="margin-top:0">Referentieset (${ids.length} regels)</h3>
    <p class="note">De maatstaf: regels waarvan een mens O, D en T heeft vastgesteld. Een evaluatie laat een model dezelfde regels beoordelen en meet de afwijking. In dit project zijn <b>${kandidaten.length}</b> regels door een mens gecontroleerd${kandidaten.length > ids.length ? `, waarvan ${kandidaten.length - ids.length} nog niet vastgelegd` : ''}.</p>
    <div class="toolbar"><button class="btn" id="kwRefBij">Referentieset bijwerken uit tab 03</button>
      ${ids.length ? '<button class="btn ghost" id="kwRefLeeg">Referentieset leegmaken</button>' : ''}
      <button class="btn ghost" data-go="specialist">Naar tab 03</button></div>
    ${gewijzigd.length ? `<p class="note warn">Bij ${gewijzigd.length} regel(s) is de inspectiedata gewijzigd nadat de referentie is vastgelegd (${gewijzigd.slice(0, 8).join(', ')}${gewijzigd.length > 8 ? '…' : ''}). Leg die opnieuw vast, anders meet je tegen verouderde invoer.</p>` : ''}
    ${ids.length ? `<div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>ID</th><th>Element</th><th class="num">O</th><th class="num">D</th><th class="num">T</th><th>Effecten</th><th class="num">Kosten</th><th>Vastgesteld</th><th></th></tr></thead><tbody>
      ${ids.map(id => { const x = ref[id], w = x.waarden || {}; return `<tr${gewijzigd.includes(id) ? ' class="ovr"' : ''}><td>${id}</td><td>${esc(x.element || '')}</td><td class="num">${w.O ?? ''}</td><td class="num">${w.D ?? ''}</td><td class="num">${w.Tjaar ?? ''}</td><td class="note">${(w.effect || []).join('·')}</td><td class="num">${w.kostenSpecialist != null ? eur(w.kostenSpecialist) : ''}</td><td class="note">${fmt(x.vastgesteld_op)}</td><td><button class="btn ghost small" data-refdel="${id}">✕</button></td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="note">Nog leeg. Controleer in tab 03 een aantal regels handmatig (O, D en T) en leg ze dan vast — 30 tot 50 regels geeft al een bruikbaar beeld.</p>'}</div>`;
}

function kolomHtml(s) {
  if (!s) return '<td colspan="6" class="note">geen cijfers</td>';
  return `<td class="num">${pct(s.prio.gelijk)}<div class="note">±1: ${pct(s.prio.binnen1klasse)}</div></td>
    <td class="num">${g2(s.O.gem)}<div class="note">±1: ${pct(s.O.binnen1)} · bias ${g2(s.O.bias)}</div></td>
    <td class="num">${g2(s.D.gem)}<div class="note">±1: ${pct(s.D.binnen1)} · bias ${g2(s.D.bias)}</div></td>
    <td class="num">${g2(s.T.gem)} jr<div class="note">factor ≤2: ${pct(s.T.binnenFactor2)}</div></td>
    <td class="num">${g2(s.effect?.gem)}<div class="note">max ${g2(s.effect?.max)}</div></td>
    <td class="num">${pct(s.kosten.gem)}<div class="note">≤25%: ${pct(s.kosten.binnen25pct)}</div></td>`;
}

function render() {
  const el = $('#tab-kwaliteit'); if (!el) return;
  const ref = U().huidigeReferentie() || {}, nRef = Object.keys(ref).length;
  const modellen = [...new Set([...(C.MODELS || []), ...Object.values(C.cfg.models || {}), C.cfg.model].filter(Boolean))];
  const prijzenBekend = !!(window._models || []).length;
  const schat = (() => { if (!nRef) return null; const r = C.calc.rows.find(x => ref[x.id]); if (!r) return null;
    const tekens = (U().systemPrompt() + JSON.stringify(U().rowContext(r))).length;
    return { tokensIn: Math.round(tekens / 3.5), tokensUit: 1500 }; })();
  const gekozen = C.cfg.evalModel || C.cfg.models?.specialist || C.cfg.model;
  const schatting = schat && prijsVan(gekozen) ? kostenVan(gekozen, schat.tokensIn * nRef, schat.tokensUit * nRef) : null;

  el.innerHTML = `<h2>AI-kwaliteit</h2>
    <p class="sub">Hoe goed doet de AI het eigenlijk? Deze tab meet dat: een referentieset van door mensen vastgestelde regels, en per model de afwijking op O, D, T, de effecten en de kosten — plus de uitkomst die echt telt, de prioriteit. Een evaluatie wijzigt niets in het project.</p>
    ${referentieHtml()}
    <div class="card" style="margin-top:14px"><h3 style="margin-top:0">Evaluatie uitvoeren</h3>
      ${nRef ? `<p class="note">Het gekozen model beoordeelt ${nRef} referentieregels opnieuw, met dezelfde systeemprompt en dezelfde plausibiliteitscontrole als tab 03. Dit kost credits.</p>
      <div class="toolbar">
        <label class="note">Model <select id="kwModel" style="min-width:260px">${modellen.map(m => `<option ${m === gekozen ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
        <label class="note">Aantal regels <select id="kwN">${[10, 25, 50, 100].filter(n => n <= Math.max(10, nRef)).map(n => `<option ${n === Math.min(nRef, C.cfg.evalN || nRef) ? 'selected' : ''}>${n}</option>`).join('')}<option value="alle" ${!C.cfg.evalN ? 'selected' : ''}>alle (${nRef})</option></select></label>
        <button class="btn" id="kwStart" ${bezig ? 'disabled' : ''}>Evaluatie starten</button>
        ${prijzenBekend ? '' : '<button class="btn ghost" id="kwPrijzen">Modelprijzen ophalen</button>'}
        <span class="note">${schatting != null ? `geschatte kosten: <b>${usd(schatting)}</b> voor ${nRef} regels` : prijzenBekend ? 'prijs van dit model onbekend' : 'haal de modelprijzen op voor een kostenschatting'}</span>
      </div>` : '<p class="note">Leg eerst een referentieset vast.</p>'}
      <div id="kwVoortgang"></div>
    </div>

    <div class="card" style="margin-top:14px"><h3 style="margin-top:0">Uitslagen per ronde ${evaluaties ? `(${evaluaties.length})` : ''}</h3>
      ${evaluaties === null ? '<p class="note">ophalen…</p>' : !evaluaties.length ? '<p class="note">Nog geen evaluaties uitgevoerd.</p>' : `
      <p class="note">Gesorteerd op datum. <b>Prioriteit gelijk</b> is de belangrijkste kolom: dat is de uitkomst waarmee het MJOP wordt gevuld. De rest zijn gemiddelde absolute afwijkingen ten opzichte van de mens; <b>bias</b> is de gemiddelde afwijking met teken (positief = het model scoort hoger dan de mens).</p>
      <div class="tablewrap"><table><thead><tr><th>Wanneer</th><th>Model</th><th class="num">n</th><th class="num">Prio gelijk</th><th class="num">O</th><th class="num">D</th><th class="num">T</th><th class="num">Effect</th><th class="num">Kosten</th><th class="num">Tokens</th><th class="num">$ / regel</th><th class="num">s / regel</th><th></th></tr></thead><tbody>
      ${evaluaties.map(e => { const s = e.resultaat?.samenvatting; const n = e.n || 1; return `<tr${laatsteDetail === e.id ? ' class="changed"' : ''}>
        <td class="note">${fmt(e.gestart_op)}${e.mislukt ? `<div class="warn">${e.mislukt} mislukt</div>` : ''}</td>
        <td>${esc(e.model)}<div class="note">prompt ${esc(String(e.prompt_versie || '').slice(0, 7))}</div></td>
        <td class="num">${e.n}</td>${kolomHtml(s)}
        <td class="num note">${((e.tokens_in || 0) + (e.tokens_uit || 0)).toLocaleString('nl-NL')}</td>
        <td class="num">${e.kosten_usd != null ? usd(+e.kosten_usd / n) : '—'}</td>
        <td class="num note">${e.duur_ms ? Math.round(e.duur_ms / n / 1000) : '—'}</td>
        <td><button class="btn ghost small" data-detail="${e.id}">${laatsteDetail === e.id ? 'verbergen' : 'regels'}</button> <button class="btn ghost small" data-evdel="${e.id}">✕</button></td></tr>`; }).join('')}
      </tbody></table></div>
      ${detailHtml()}`}
    </div>

    <div class="card" style="margin-top:14px"><h3 style="margin-top:0">Bescherming tegen instructies in de data</h3>
      <p class="note">De inspectiedata komt uit klantbestanden. Vrije tekst wordt gecontroleerd op instructie-achtige patronen (“negeer het bovenstaande”, rolmarkeringen, codeblokken, opdrachten om een prioriteit of bedrag te forceren). Wat gevaarlijk is wordt onschadelijk gemaakt vóórdat de agent het ziet, de agent krijgt expliciet mee dat data nooit een opdracht is, en de regel wordt in tab 03 gesignaleerd. De uitvoer gaat daarna nog door de plausibiliteitscontrole, dus een geforceerde score of bedrag komt er ook langs die kant niet door.</p>
      <p class="note">In dit project: ${(() => { const ov = window.STEMI_PREP.injectieOverzicht(C.state.inspectie || []); return ov.aantal ? `<b class="warn">${ov.aantal} regel(s) met instructie-achtige tekst</b> — zie de melding bovenaan tab 03` : 'geen instructie-achtige tekst aangetroffen'; })()}.</p>
    </div>`;

  $$('[data-go]', el).forEach(b => b.onclick = () => U().switchTab(b.dataset.go));
  $('#kwRefBij').onclick = () => U().referentieBijwerken().then(() => render()).catch(e => C.toast('Mislukt: ' + e.message, 7000));
  const leeg = $('#kwRefLeeg'); if (leeg) leeg.onclick = async () => { if (!confirm('De hele referentieset verwijderen? De evaluaties blijven staan.')) return; await DB.wisReferentie(null); await U().laadReferentie(); render(); };
  $$('[data-refdel]', el).forEach(b => b.onclick = async () => { await DB.wisReferentie(+b.dataset.refdel); await U().laadReferentie(); render(); });
  const pr = $('#kwPrijzen'); if (pr) pr.onclick = async () => { pr.disabled = true; pr.textContent = 'ophalen…'; try { const tok = await DB.token(); const r = await fetch('/api/models', { headers: { ...(C.cfg.apiKey ? { 'x-openrouter-key': C.cfg.apiKey } : {}), Authorization: 'Bearer ' + tok } }); const d = await r.json(); if (!r.ok) throw new Error(d.error || r.status); window._models = d.models; render(); } catch (e) { C.toast('Mislukt: ' + e.message, 7000); pr.disabled = false; pr.textContent = 'Modelprijzen ophalen'; } };
  const start = $('#kwStart'); if (start) start.onclick = () => {
    const model = $('#kwModel').value, nSel = $('#kwN').value, n = nSel === 'alle' ? Object.keys(ref).length : +nSel;
    C.cfg.evalModel = model; C.cfg.evalN = nSel === 'alle' ? null : n; C.saveCfg();
    const k = schat && prijsVan(model) ? kostenVan(model, schat.tokensIn * n, schat.tokensUit * n) : null;
    if (!confirm(`${n} regel(s) laten beoordelen door ${model}?\n\n${k != null ? `Geschatte kosten: ${usd(k)}.` : 'De kosten van dit model zijn niet bekend.'}\nDit kost echte credits en wijzigt niets in het project.`)) return;
    startEvaluatie(model, n).catch(e => { bezig = null; render(); C.toast('Evaluatie mislukt: ' + e.message, 9000); });
  };
  $$('[data-detail]', el).forEach(b => b.onclick = () => { laatsteDetail = laatsteDetail === b.dataset.detail ? null : b.dataset.detail; render(); });
  $$('[data-evdel]', el).forEach(b => b.onclick = async () => { if (!confirm('Deze evaluatie verwijderen?')) return; await DB.wisEvaluatie(b.dataset.evdel); evaluaties = await DB.evaluatiesVan(); render(); });
  if (evaluaties === null && DB.dossier) DB.evaluatiesVan().then(x => { evaluaties = x; render(); }).catch(e => { evaluaties = []; console.warn(e); });
  toonVoortgang();
}

function detailHtml() {
  if (!laatsteDetail || !evaluaties) return '';
  const e = evaluaties.find(x => x.id === laatsteDetail); if (!e) return '';
  const rijen = e.resultaat?.perRegel || [];
  const afw = rijen.filter(r => r.vgl && !r.vgl.prio.gelijk).length;
  return `<h4 style="margin-top:14px">Per regel — ${esc(e.model)}, ${fmt(e.gestart_op)}</h4>
    <p class="note">${afw} van de ${rijen.filter(r => r.vgl).length} regels komen op een andere prioriteit uit. Die regels zijn het interessantst: daar verschilt de AI van de specialist op een manier die het MJOP raakt.</p>
    <div class="tablewrap"><table><thead><tr><th>ID</th><th>Element</th><th>Prio mens → AI</th><th class="num">O mens/AI</th><th class="num">D mens/AI</th><th class="num">T mens/AI</th><th class="num">Effect afw.</th><th class="num">Kosten mens/AI</th><th class="num">Controle</th></tr></thead><tbody>
    ${rijen.slice().sort((a, b) => (a.vgl?.prio.gelijk === b.vgl?.prio.gelijk) ? 0 : (a.vgl?.prio.gelijk ? 1 : -1)).map(r => r.fout
      ? `<tr><td>${r.regel}</td><td>${esc(r.element || '')}</td><td colspan="7" class="warn">${esc(r.fout)}</td></tr>`
      : `<tr><td>${r.regel}</td><td>${esc(r.element || '')}</td>
        <td>${pill(r.vgl.prio.ref)} → ${pill(r.vgl.prio.ai)} ${r.vgl.prio.gelijk ? '' : `<span class="warn">≠</span>`}</td>
        <td class="num">${r.vgl.O.ref ?? '—'} / ${r.vgl.O.ai ?? '—'}</td>
        <td class="num">${r.vgl.D.ref ?? '—'} / ${r.vgl.D.ai ?? '—'}</td>
        <td class="num">${r.vgl.T.ref ?? '—'} / ${r.vgl.T.ai ?? '—'}</td>
        <td class="num">${g2(r.vgl.effect.gem)}</td>
        <td class="num">${r.vgl.kosten.ref != null ? eur(r.vgl.kosten.ref) : '—'} / ${r.vgl.kosten.ai != null ? eur(r.vgl.kosten.ai) : '—'}</td>
        <td class="num note">${r.flags ? `${r.flags - r.signalen} geweigerd${r.signalen ? `, ${r.signalen} gesignaleerd` : ''}` : '—'}</td></tr>`).join('')}
    </tbody></table></div>`;
}

window.STEMI_UI = window.STEMI_UI || {}; Object.assign(window.STEMI_UI, { renderKwaliteit: render, startEvaluatie, laatsteEvaluatie: () => (evaluaties && evaluaties[0]) || null, laadEvaluaties: async () => { evaluaties = await DB.evaluatiesVan(); return evaluaties; } });
})();
