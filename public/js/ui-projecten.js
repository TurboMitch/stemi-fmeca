/* Projecten: elk project (klant/object) is een eigen dataset met eigen inspectie, specialist, MJOP en
   instellingenprofiel. Toegang loopt per project via lidmaatschap; de database bewaakt dat zelf (RLS). */
(() => {
const C = window.STEMI, DB = window.STEMI_DB; const { $, $$, esc, eur } = C;
const STATUS = ['nieuw', 'inspectie', 'specialist', 'besluitvorming', 'mjop gereed', 'afgerond'];
const ROLLEN = [['eigenaar','Eigenaar – beheert leden en mag het project verwijderen'],['redacteur','Redacteur – mag alles invullen en wijzigen'],['lezer','Lezer – mag alleen meekijken']];
let cache = [], prullenbak = [], leden = null, gebruikers = null;

const fmtDate = d => d ? new Date(d).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) : '';
const U = () => window.STEMI_UI;
const rolLabel = r => r === 'beheerder' ? 'beheerder (STEMI)' : r || 'geen toegang';

async function refresh() { cache = await DB.listDossiers(); return cache; }

/** projectkiezer in de header: dropdown met alle projecten + nieuw/beheer */
async function renderSelector() {
  const el = $('#hdrDossier'); if (!el) return; const cur = DB.dossier;
  if (!cache.length) { try { await refresh(); } catch (e) { console.warn(e); } }
  const groepen = {}; cache.forEach(x => { const g = x.portefeuille || x.meta?.klant || 'Zonder portefeuille'; (groepen[g] = groepen[g] || []).push(x); });
  el.innerHTML = `<label class="projsel"><span class="note">Project</span><select id="projSel">${Object.keys(groepen).sort().map(g => `<optgroup label="${esc(g)}">${groepen[g].map(x => `<option value="${x.id}" ${x.id === cur?.id ? 'selected' : ''}>${esc(x.naam)}${x.meta?.object ? ' · ' + esc(x.meta.object) : ''}</option>`).join('')}</optgroup>`).join('')}<option value="__new">＋ Nieuw project…</option><option value="__manage">⚙ Projecten beheren…</option></select></label> ${DB.dossier && !DB.magSchrijven() ? '<span class="tag" title="Je kunt dit project alleen bekijken">alleen lezen</span>' : ''} <span id="dbStatus" class="note"></span>`;
  $('#projSel').onchange = async e => {
    const v = e.target.value;
    if (v === '__new') { e.target.value = cur?.id || ''; U().switchTab('projecten'); setTimeout(() => $('#npNaam')?.focus(), 50); return; }
    if (v === '__manage') { e.target.value = cur?.id || ''; U().switchTab('projecten'); return; }
    await openProject(v);
  };
}

async function openProject(id) {
  await DB.flush(C.state); const d = await DB.openDossier(id); C.setState(d.state);
  try { C.state.ai = { ...(C.state.ai || {}), ...(await DB.aiVan(id)) }; } catch (e) { console.warn('ai laden', e); }
  try { await U().laadReferentie(); } catch (e) { console.warn('referentie laden', e); }
  leden = null; U().renderAll(); C.toast('Project geopend: ' + d.naam);
  U().switchTab(C.state.settings.wizardVoltooid ? 'overzicht' : 'eigenaar');
}

async function createProject(f) {
  const naam = f.naam.trim(); if (!naam) { C.toast('Geef het project een naam'); return; }
  if (cache.some(x => x.naam.toLowerCase() === naam.toLowerCase())) { if (!confirm(`Er bestaat al een project “${naam}”. Toch aanmaken?`)) return; }
  await DB.flush(C.state);
  const project = { klant: f.klant.trim(), object: f.object.trim(), adres: f.adres.trim(), status: 'nieuw', omschrijving: f.omschrijving.trim(), aangemaakt: new Date().toISOString() };
  const port = (f.portefeuille || '').trim() || null;
  let d;
  if (f.basis === 'kopie' && f.bron) d = await DB.duplicateDossier(f.bron, naam, { alleenInstellingen: true, ...project, portefeuille: port });
  else if (f.basis === 'volledig' && f.bron) d = await DB.duplicateDossier(f.bron, naam, { project, portefeuille: port });
  else { const st = C.emptyState(); st.project = project; if (f.basis !== 'voorbeeld') { st.inspectie = []; st.specialist = []; st.besluiten = []; st.ai = {}; } d = await DB.createDossier(naam, st, { portefeuille: port }); }
  C.setState(d.state); C.state.ai = d.state.ai || {}; leden = null;
  C.audit({ veld: 'project', nieuw: `aangemaakt (${f.basis})`, bron: 'mens' });
  await refresh(); U().renderAll(); C.toast(`Project “${naam}” aangemaakt – jij bent eigenaar`, 5000);
  U().switchTab(f.basis === 'kopie' || f.basis === 'volledig' ? 'inspectie' : 'eigenaar');
}

/** portefeuillelaag: meerdere complexen per klant, opgeteld uit de kengetallen in meta */
function portefeuilleHtml() {
  const groepen = {};
  cache.forEach(x => { const g = x.portefeuille || x.meta?.klant || '(geen portefeuille)'; (groepen[g] = groepen[g] || []).push(x); });
  const namen = Object.keys(groepen).sort();
  if (namen.length <= 1 && cache.length <= 1) return '';
  const rij = g => {
    const xs = groepen[g], m = xs.map(x => x.meta || {});
    const som = k => m.reduce((a, x) => a + (+x[k] || 0), 0);
    const prio = {}; m.forEach(x => Object.entries(x.perPrio || {}).forEach(([p, n]) => prio[p] = (prio[p] || 0) + n));
    const mist = m.filter(x => x.totaal == null).length;
    return `<tr><td><b>${esc(g)}</b></td><td class="num">${xs.length}</td><td class="num">${som('regels')}</td><td class="num">${som('ai')}</td>
      <td class="num">${som('totaal') ? eur(som('totaal')) : '—'}</td><td class="num">${som('totaalIndex') ? eur(som('totaalIndex')) : '—'}</td>
      <td class="num">${som('totaalNpv') ? eur(som('totaalNpv')) : '—'}</td>
      <td>${C.PRIOS.map(p => prio[p] ? `${C.pill(p)} ${prio[p]}` : '').filter(Boolean).join(' ') || '<span class="note">—</span>'}</td>
      <td class="note">${xs.map(x => esc(x.naam)).join(', ')}${mist ? `<br><span class="warn">${mist} project(en) nog niet doorgerekend sinds de laatste opslag</span>` : ''}</td></tr>`;
  };
  return `<div class="card" style="margin-top:14px"><h3 style="margin-top:0">Portefeuilles (${namen.length})</h3>
    <p class="note">Opgeteld uit de kengetallen die bij elke opslagronde per project worden bijgehouden — zonder alle projecten te hoeven laden. Een project zonder eigen portefeuillenaam valt onder zijn klant.</p>
    <div class="tablewrap"><table><thead><tr><th>Portefeuille</th><th class="num">Projecten</th><th class="num">Regels</th><th class="num">AI</th><th class="num">MJOP prijspeil</th><th class="num">Geïndexeerd</th><th class="num">Contante waarde</th><th>Prioriteiten</th><th class="wrap">Projecten</th></tr></thead><tbody>
    ${namen.map(rij).join('')}</tbody></table></div></div>`;
}

function ledenHtml(cur) {
  if (!leden) return '<p class="note">leden ophalen…</p>';
  const mag = DB.magBeheren(cur);
  const vrij = (gebruikers || []).filter(g => !leden.some(l => l.user_id === g.id));
  return `<p class="note">Wie toegang heeft tot <b>${esc(cur?.naam || '')}</b>. De database bewaakt dit: iemand zonder lidmaatschap ziet dit project niet, ook zijn audittrail, AI-runs en back-ups niet. Beheerders van STEMI kunnen altijd bij alles.</p>
    <table class="mini"><tbody>${leden.map(l => `<tr><td><b>${esc(l.naam)}</b>${l.beheerder ? ' <span class="tag">beheerder</span>' : ''}<div class="note">lid sinds ${fmtDate(l.toegevoegd_op)}</div></td>
      <td>${mag ? `<select data-lidrol="${l.user_id}">${ROLLEN.map(([k, t]) => `<option value="${k}" ${k === l.rol ? 'selected' : ''} title="${esc(t)}">${k}</option>`).join('')}</select>` : esc(l.rol)}</td>
      <td>${mag && leden.filter(x => x.rol === 'eigenaar').length > 1 || (mag && l.rol !== 'eigenaar') ? `<button class="btn ghost small" data-liddel="${l.user_id}">verwijderen</button>` : '<span class="note">laatste eigenaar</span>'}</td></tr>`).join('')}</tbody></table>
    ${mag ? (vrij.length ? `<div class="toolbar" style="margin-top:8px"><select id="lidNieuw">${vrij.map(g => `<option value="${g.id}">${esc(g.display_name || g.username)}</option>`).join('')}</select>
      <select id="lidNieuwRol">${ROLLEN.map(([k, t]) => `<option value="${k}" ${k === 'redacteur' ? 'selected' : ''}>${k}</option>`).join('')}</select>
      <button class="btn small" id="lidAdd">Toevoegen</button></div>` : '<p class="note">Alle bekende gebruikers zijn al lid. Nieuwe accounts maakt een beheerder aan in Supabase (Authentication → Users); daarna zijn ze hier toe te voegen.</p>')
      : '<p class="note">Alleen de eigenaar van dit project of een STEMI-beheerder kan leden beheren.</p>'}`;
}

function prullenbakHtml() {
  if (!prullenbak.length) return '';
  return `<div class="card" style="margin-top:14px"><h3 style="margin-top:0">Prullenbak (${prullenbak.length})</h3>
    <p class="note">Verwijderde projecten blijven met alle historie bestaan tot ze definitief worden gewist. Terugzetten kan altijd.</p>
    <div class="tablewrap"><table><thead><tr><th>Project</th><th>Klant</th><th class="num">Regels</th><th>Verwijderd op</th><th>Door</th><th></th></tr></thead><tbody>
    ${prullenbak.map(x => `<tr><td><b>${esc(x.naam)}</b></td><td>${esc(x.meta?.klant || '')}</td><td class="num">${x.meta?.regels ?? ''}</td><td class="note">${fmtDate(x.verwijderd_op)}</td><td class="note">${esc(x.verwijderd_door_naam || '')}</td>
      <td><button class="btn small" data-terug="${x.id}">Terugzetten</button> ${DB.magBeheren(x) ? `<button class="btn ghost small" data-weg="${x.id}" title="definitief verwijderen">✕ definitief</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}

function render() {
  const el = $('#tab-projecten'); const cur = DB.dossier; const P = C.state.project || {};
  const mijnRol = DB.mijnRolIn(cur), magSchrijven = DB.magSchrijven(cur), magBeheren = DB.magBeheren(cur);
  const porties = [...new Set(cache.map(x => x.portefeuille).filter(Boolean))];
  el.innerHTML = `<h2>Projecten</h2><p class="sub">Elk project is een eigen dataset voor één klant/object: inspectie, specialistbeoordeling, waardekompas, MJOP, instellingenprofiel, audittrail en AI-runs. Toegang loopt per project via lidmaatschap. Jouw rol in dit project: <b>${esc(rolLabel(mijnRol))}</b>.</p>
  <div class="grid two">
    <div class="card">
      <h3>Nieuw project</h3>
      <div class="field"><label>Projectnaam *</label><input id="npNaam" placeholder="bijv. Loods De Kwakel – 2026"></div>
      <div class="grid two">
        <div class="field"><label>Klant / eigenaar</label><input id="npKlant" placeholder="bijv. Gemeente Aalsmeer"></div>
        <div class="field"><label>Object</label><input id="npObject" placeholder="bijv. Bedrijfshal + kantoor"></div>
      </div>
      <div class="field"><label>Adres</label><input id="npAdres" placeholder="straat, plaats"></div>
      <div class="field"><label>Portefeuille <span class="note">(meerdere complexen van dezelfde klant bij elkaar)</span></label><input id="npPort" list="portLijst" placeholder="bijv. Gemeente Aalsmeer – vastgoed"><datalist id="portLijst">${porties.map(p => `<option>${esc(p)}</option>`).join('')}</datalist></div>
      <div class="field"><label>Omschrijving</label><textarea id="npOms" rows="2" placeholder="scope, bouwjaar, bijzonderheden"></textarea></div>
      <div class="field"><label>Startpunt</label>
        <select id="npBasis">
          <option value="leeg">Leeg project met standaardinstellingen (wizard doorlopen, daarna inspectiedata importeren)</option>
          <option value="kopie" ${cache.length ? 'selected' : ''}>Instellingenprofiel kopiëren van bestaand project (zonder data)</option>
          <option value="volledig">Volledige kopie van bestaand project (incl. data en AI-voorstellen)</option>
          <option value="voorbeeld">Met voorbeelddata uit het Excel-model (demo)</option>
        </select></div>
      <div class="field" id="npBronWrap"><label>Bronproject</label><select id="npBron">${cache.map(x => `<option value="${x.id}" ${x.id === cur?.id ? 'selected' : ''}>${esc(x.naam)} · profiel “${esc(x.meta?.profiel || '')}”</option>`).join('')}</select></div>
      <button class="btn" id="npGo">Project aanmaken</button>
      <p class="note">Je wordt automatisch eigenaar van een nieuw project en bepaalt daarna wie er nog bij mag.</p>
    </div>
    <div class="card">
      <h3>Huidig project: ${esc(cur?.naam || '')}</h3>
      ${magSchrijven ? '' : '<p class="note warn">Je hebt alleen leesrechten in dit project; wijzigingen worden door de database geweigerd.</p>'}
      <div class="grid two">
        <div class="field"><label>Projectnaam</label><input id="cpNaam" value="${esc(cur?.naam || '')}" ${magSchrijven ? '' : 'disabled'}></div>
        <div class="field"><label>Status</label><select id="cpStatus" ${magSchrijven ? '' : 'disabled'}>${STATUS.map(s => `<option ${s === (P.status || 'nieuw') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Klant / eigenaar</label><input id="cpKlant" value="${esc(P.klant || '')}" ${magSchrijven ? '' : 'disabled'}></div>
        <div class="field"><label>Object</label><input id="cpObject" value="${esc(P.object || '')}" ${magSchrijven ? '' : 'disabled'}></div>
      </div>
      <div class="field"><label>Adres</label><input id="cpAdres" value="${esc(P.adres || '')}" ${magSchrijven ? '' : 'disabled'}></div>
      <div class="field"><label>Portefeuille</label><input id="cpPort" list="portLijst2" value="${esc(cur?.portefeuille || '')}" ${magSchrijven ? '' : 'disabled'}><datalist id="portLijst2">${porties.map(p => `<option>${esc(p)}</option>`).join('')}</datalist></div>
      <div class="field"><label>Omschrijving</label><textarea id="cpOms" rows="2" ${magSchrijven ? '' : 'disabled'}>${esc(P.omschrijving || '')}</textarea></div>
      <p class="note">${C.state.inspectie.length} inspectieregels · ${Object.keys(C.state.ai || {}).length} door AI beoordeeld · instellingenprofiel “${esc(C.state.settings.naam || '')}” · versie ${cur?.versie ?? 0} · laatst gewijzigd ${fmtDate(cur?.updated_at)} · ${cur?.aantalLeden ?? leden?.length ?? '?'} lid/leden</p>
      <button class="btn" id="cpSave" ${magSchrijven ? '' : 'disabled'}>Opslaan</button> <button class="btn ghost" id="cpDup">Dupliceren…</button> <button class="btn ghost" id="cpLeden">Leden…</button> <button class="btn ghost" id="cpBack">Back-ups…</button> <button class="btn ghost" id="cpDel" ${magBeheren ? '' : 'disabled'}>Naar prullenbak</button>
      <div id="cpPaneel"></div>
    </div>
  </div>
  ${portefeuilleHtml()}
  <div class="card" style="margin-top:14px">
    <div class="toolbar"><h3 style="margin:0">Mijn projecten (${cache.length})</h3><span class="spacer"></span><input id="projFilter" placeholder="zoeken op naam / klant / object" style="width:260px"></div>
    <div class="tablewrap"><table id="projTable"><thead><tr><th>Project</th><th>Portefeuille</th><th>Klant</th><th>Object</th><th>Status</th><th class="num">Regels</th><th class="num">AI</th><th class="num">MJOP</th><th>Mijn rol</th><th class="num">Leden</th><th>Laatst gewijzigd</th><th></th></tr></thead><tbody>
    ${cache.map(x => { const m = x.meta || {}; return `<tr class="${x.id === cur?.id ? 'changed' : ''}" data-row="${esc((x.naam + ' ' + (m.klant || '') + ' ' + (m.object || '') + ' ' + (x.portefeuille || '')).toLowerCase())}"><td><b>${esc(x.naam)}</b>${x.id === cur?.id ? ' <span class="tag">huidig</span>' : ''}${m.omschrijving ? `<div class="note">${esc(m.omschrijving)}</div>` : ''}</td><td class="note">${esc(x.portefeuille || '')}</td><td>${esc(m.klant || '')}</td><td>${esc(m.object || '')}${m.adres ? `<div class="note">${esc(m.adres)}</div>` : ''}</td><td>${esc(m.status || '')}</td><td class="num">${m.regels ?? ''}</td><td class="num">${m.ai ?? ''}</td><td class="num">${m.totaal ? eur(m.totaal) : ''}</td><td class="note">${esc(rolLabel(x.mijnRol))}</td><td class="num note">${x.aantalLeden || ''}</td><td class="note">${fmtDate(x.updated_at)}<div>v${x.versie} · ${esc(x.updated_by_naam || '')}</div></td><td>${x.id === cur?.id ? '' : `<button class="btn small" data-open="${x.id}">Openen</button>`} <button class="btn ghost small" data-dup="${x.id}" title="dupliceren">⧉</button> ${DB.magBeheren(x) ? `<button class="btn ghost small" data-del="${x.id}" title="naar prullenbak">✕</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div>
  </div>
  ${prullenbakHtml()}`;

  const basisSel = $('#npBasis'); const showBron = () => $('#npBronWrap').style.display = (basisSel.value === 'kopie' || basisSel.value === 'volledig') && cache.length ? '' : 'none'; basisSel.onchange = showBron; showBron();
  $('#npGo').onclick = () => createProject({ naam: $('#npNaam').value, klant: $('#npKlant').value, object: $('#npObject').value, adres: $('#npAdres').value, portefeuille: $('#npPort').value, omschrijving: $('#npOms').value, basis: basisSel.value, bron: $('#npBron')?.value }).catch(e => C.toast('Aanmaken mislukt: ' + e.message, 6000));
  $('#cpSave').onclick = async () => {
    try {
      const n = $('#cpNaam').value.trim(); if (n && n !== cur.naam) await DB.renameDossier(n);
      const port = $('#cpPort').value.trim(); if ((cur.portefeuille || '') !== port) await DB.zetPortefeuille(cur.id, port);
      C.state.project = { ...(C.state.project || {}), klant: $('#cpKlant').value.trim(), object: $('#cpObject').value.trim(), adres: $('#cpAdres').value.trim(), status: $('#cpStatus').value, omschrijving: $('#cpOms').value.trim() };
      C.audit({ veld: 'project', nieuw: 'projectgegevens gewijzigd', bron: 'mens' }); C.save(); await DB.flush(C.state); await refresh(); U().renderAll(); C.toast('Projectgegevens opgeslagen');
    } catch (e) { C.toast('Opslaan mislukt: ' + e.message, 7000); }
  };
  $('#cpDel').onclick = () => delProject(cur.id, cur.naam);
  $('#cpLeden').onclick = async () => {
    const box = $('#cpPaneel'); box.innerHTML = '<p class="note">leden ophalen…</p>';
    try { leden = await DB.ledenVan(cur.id); if (!gebruikers) gebruikers = await DB.alleGebruikers(); } catch (e) { box.innerHTML = `<p class="note warn">${esc(e.message)}</p>`; return; }
    box.innerHTML = `<div style="margin-top:10px">${ledenHtml(cur)}</div>`;
    const na = async (melding) => { leden = await DB.ledenVan(cur.id); await refresh(); render(); C.toast(melding); $('#cpLeden').click(); };
    $$('[data-lidrol]', box).forEach(s => s.onchange = async () => { try { await DB.zetLid(cur.id, s.dataset.lidrol, s.value); await na('Rol gewijzigd'); } catch (e) { C.toast('Mislukt: ' + e.message, 7000); } });
    $$('[data-liddel]', box).forEach(b => b.onclick = async () => { if (!confirm('Deze gebruiker de toegang tot dit project ontnemen?')) return; try { await DB.verwijderLid(cur.id, b.dataset.liddel); await na('Lid verwijderd'); } catch (e) { C.toast('Mislukt: ' + e.message, 7000); } });
    const add = $('#lidAdd', box); if (add) add.onclick = async () => { try { await DB.zetLid(cur.id, $('#lidNieuw').value, $('#lidNieuwRol').value); await na('Lid toegevoegd'); } catch (e) { C.toast('Mislukt: ' + e.message, 7000); } };
  };
  $('#cpBack').onclick = async () => {
    const box = $('#cpPaneel'); box.innerHTML = '<p class="note">back-ups ophalen…</p>';
    try {
      const bs = await DB.backupsVan(cur.id);
      box.innerHTML = bs.length ? `<p class="note" style="margin-top:8px">Elke nacht wordt automatisch een back-up gemaakt zodra er iets gewijzigd is; ze worden 30 dagen bewaard. Herstellen maakt eerst een back-up van de huidige toestand, dus je kunt het altijd terugdraaien. Let op: de AI-voorstellen staan sinds september in een eigen tabel en zitten niet in een back-up — de volledige AI-uitvoer blijft wel bewaard in ai_runs.</p>
        <table class="mini"><tbody>${bs.map(b=>`<tr><td class="note">${fmtDate(b.gemaakt_op)}</td><td>v${b.versie}</td><td class="note">${esc(b.reden||'')}</td><td>${DB.magBeheren(cur) ? `<button class="btn ghost small" data-herstel="${b.id}">Herstellen</button>` : '<span class="note">alleen de eigenaar kan herstellen</span>'}</td></tr>`).join('')}</tbody></table>`
        : '<p class="note">Nog geen back-ups van dit project.</p>';
      $$('[data-herstel]', box).forEach(b => b.onclick = async () => {
        if (!confirm('Dit project terugzetten naar deze back-up? De huidige toestand wordt eerst als back-up bewaard.')) return;
        b.disabled = true; b.textContent = 'herstellen…';
        try { const melding = await DB.herstelDossier(cur.id, b.dataset.herstel); const d = await DB.openDossier(cur.id); C.setState(d.state); C.state.ai = { ...(C.state.ai||{}), ...(await DB.aiVan(cur.id)) }; await refresh(); U().renderAll(); C.toast(melding, 9000); }
        catch (e) { C.toast('Herstel mislukt: ' + e.message, 8000); b.disabled = false; b.textContent = 'Herstellen'; }
      });
    } catch (e) { box.innerHTML = `<p class="note warn">${esc(e.message)}</p>`; }
  };
  $('#cpDup').onclick = () => dupProject(cur.id, cur.naam);
  $$('[data-open]', el).forEach(b => b.onclick = () => openProject(b.dataset.open));
  $$('[data-dup]', el).forEach(b => b.onclick = () => { const x = cache.find(c => c.id === b.dataset.dup); dupProject(x.id, x.naam); });
  $$('[data-del]', el).forEach(b => b.onclick = () => { const x = cache.find(c => c.id === b.dataset.del); delProject(x.id, x.naam); });
  $$('[data-terug]', el).forEach(b => b.onclick = async () => { try { await DB.herstelUitPrullenbak(b.dataset.terug); await laadPrullenbak(); await refresh(); render(); U().renderProjectSelector(); C.toast('Project teruggezet'); } catch (e) { C.toast('Mislukt: ' + e.message, 7000); } });
  $$('[data-weg]', el).forEach(b => b.onclick = async () => {
    const x = prullenbak.find(p => p.id === b.dataset.weg); if (!x) return;
    if (!confirm(`“${x.naam}” definitief verwijderen, inclusief audittrail, AI-runs en back-ups? Dit kan niet terug.`)) return;
    if (prompt('Typ ter bevestiging de projectnaam:') !== x.naam) { C.toast('Naam komt niet overeen – niet verwijderd'); return; }
    try { await DB.definitiefVerwijderen(x.id); await laadPrullenbak(); render(); C.toast('Project definitief verwijderd'); } catch (e) { C.toast('Mislukt: ' + e.message, 7000); }
  });
  $('#projFilter').oninput = e => { const q = e.target.value.toLowerCase(); $$('#projTable tbody tr').forEach(tr => tr.style.display = tr.dataset.row.includes(q) ? '' : 'none'); };
}

async function laadPrullenbak() { try { prullenbak = await DB.listDossiers({ prullenbak: true }); } catch (e) { prullenbak = []; console.warn(e); } }

async function dupProject(id, naam) {
  const n = prompt('Naam voor de kopie:', naam + ' (kopie)'); if (!n) return;
  const alleen = confirm('Alleen het instellingenprofiel kopiëren (OK) of ook alle data (Annuleren)?');
  await DB.flush(C.state);
  try {
    const d = await DB.duplicateDossier(id, n.trim(), alleen ? { alleenInstellingen: true } : {});
    C.setState(d.state); C.state.ai = { ...(await DB.aiVan(d.id)) }; leden = null; await refresh(); U().renderAll(); C.toast(`Project “${n}” aangemaakt – jij bent eigenaar`);
  } catch (e) { C.toast('Dupliceren mislukt: ' + e.message, 7000); }
}
async function delProject(id, naam) {
  if (cache.length <= 1) { C.toast('Het laatste project kan niet verwijderd worden'); return; }
  if (!confirm(`Project “${naam}” naar de prullenbak? Alle historie blijft bewaard en je kunt het terugzetten.`)) return;
  try {
    const wasCur = DB.dossier?.id === id; await DB.deleteDossier(id); await refresh(); await laadPrullenbak();
    if (wasCur && cache.length) { const d = await DB.openDossier(cache[0].id); C.setState(d.state); C.state.ai = await DB.aiVan(d.id); leden = null; }
    U().renderAll(); C.toast('Project naar de prullenbak');
  } catch (e) { C.toast('Verwijderen mislukt: ' + e.message, 7000); }
}

window.STEMI_UI = window.STEMI_UI || {}; Object.assign(window.STEMI_UI, { renderProjecten: render, renderProjectSelector: renderSelector, openProject, refreshProjecten: async () => { await refresh(); await laadPrullenbak(); return cache; } });
})();
