/* Projecten: elk project (klant/object) is een eigen dataset (dossier in Supabase) met eigen inspectie, specialist, MJOP en instellingenprofiel */
(() => {
const C = window.STEMI, DB = window.STEMI_DB; const { $, $$, esc } = C;
const STATUS = ['nieuw', 'inspectie', 'specialist', 'besluitvorming', 'mjop gereed', 'afgerond'];
let cache = [];

const fmtDate = d => d ? new Date(d).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) : '';
const U = () => window.STEMI_UI;

async function refresh() { cache = await DB.listDossiers(); return cache; }

/** projectkiezer in de header: dropdown met alle projecten + nieuw/beheer */
async function renderSelector() {
  const el = $('#hdrDossier'); if (!el) return; const cur = DB.dossier;
  if (!cache.length) { try { await refresh(); } catch (e) { console.warn(e); } }
  el.innerHTML = `<label class="projsel"><span class="note">Project</span><select id="projSel">${cache.map(x => `<option value="${x.id}" ${x.id === cur?.id ? 'selected' : ''}>${esc(x.naam)}${x.meta?.klant ? ' · ' + esc(x.meta.klant) : ''}</option>`).join('')}<option value="__new">＋ Nieuw project…</option><option value="__manage">⚙ Projecten beheren…</option></select></label> <span id="dbStatus" class="note"></span>`;
  $('#projSel').onchange = async e => {
    const v = e.target.value;
    if (v === '__new') { e.target.value = cur?.id || ''; U().switchTab('projecten'); setTimeout(() => $('#npNaam')?.focus(), 50); return; }
    if (v === '__manage') { e.target.value = cur?.id || ''; U().switchTab('projecten'); return; }
    await openProject(v);
  };
}

async function openProject(id) {
  await DB.flush(C.state); const d = await DB.openDossier(id); C.setState(d.state); U().renderAll(); C.toast('Project geopend: ' + d.naam);
  U().switchTab(C.state.settings.wizardVoltooid ? 'overzicht' : 'eigenaar');
}

async function createProject(f) {
  const naam = f.naam.trim(); if (!naam) { C.toast('Geef het project een naam'); return; }
  if (cache.some(x => x.naam.toLowerCase() === naam.toLowerCase())) { if (!confirm(`Er bestaat al een project “${naam}”. Toch aanmaken?`)) return; }
  await DB.flush(C.state);
  const project = { klant: f.klant.trim(), object: f.object.trim(), adres: f.adres.trim(), status: 'nieuw', omschrijving: f.omschrijving.trim(), aangemaakt: new Date().toISOString() };
  let d;
  if (f.basis === 'kopie' && f.bron) { d = await DB.duplicateDossier(f.bron, naam, { alleenInstellingen: true, ...project }); }
  else if (f.basis === 'volledig' && f.bron) { d = await DB.duplicateDossier(f.bron, naam, { project }); }
  else { const st = C.emptyState(); st.project = project; if (f.basis !== 'voorbeeld') { st.inspectie = []; st.specialist = []; st.besluiten = []; st.ai = {}; } d = await DB.createDossier(naam, st); }
  C.setState(d.state); C.audit({ veld: 'project', nieuw: `aangemaakt (${f.basis})`, bron: 'mens' });
  await refresh(); U().renderAll(); C.toast(`Project “${naam}” aangemaakt`, 5000);
  U().switchTab(f.basis === 'kopie' || f.basis === 'volledig' ? 'inspectie' : 'eigenaar');
}

function render() {
  const el = $('#tab-projecten'); const cur = DB.dossier; const P = C.state.project || {};
  el.innerHTML = `<h2>Projecten</h2><p class="sub">Elk project is een eigen dataset voor één klant/object (of portefeuille): inspectie, specialistbeoordeling, waardekompas, MJOP, instellingenprofiel, audittrail en AI-runs. Alles staat in de database en is voor alle gebruikers zichtbaar. Wissel van project via de keuzelijst rechtsboven of hieronder.</p>
  <div class="grid two">
    <div class="card">
      <h3>Nieuw project</h3>
      <div class="field"><label>Projectnaam *</label><input id="npNaam" placeholder="bijv. Loods De Kwakel – 2026"></div>
      <div class="grid two">
        <div class="field"><label>Klant / eigenaar</label><input id="npKlant" placeholder="bijv. Gemeente Aalsmeer"></div>
        <div class="field"><label>Object</label><input id="npObject" placeholder="bijv. Bedrijfshal + kantoor"></div>
      </div>
      <div class="field"><label>Adres</label><input id="npAdres" placeholder="straat, plaats"></div>
      <div class="field"><label>Omschrijving</label><textarea id="npOms" rows="2" placeholder="scope, bouwjaar, bijzonderheden"></textarea></div>
      <div class="field"><label>Startpunt</label>
        <select id="npBasis">
          <option value="leeg">Leeg project met standaardinstellingen (wizard doorlopen, daarna inspectiedata importeren)</option>
          <option value="kopie" ${cache.length ? 'selected' : ''}>Instellingenprofiel kopiëren van bestaand project (zonder data)</option>
          <option value="volledig">Volledige kopie van bestaand project (incl. data)</option>
          <option value="voorbeeld">Met voorbeelddata uit het Excel-model (demo)</option>
        </select></div>
      <div class="field" id="npBronWrap"><label>Bronproject</label><select id="npBron">${cache.map(x => `<option value="${x.id}" ${x.id === cur?.id ? 'selected' : ''}>${esc(x.naam)} · profiel “${esc(x.meta?.profiel || '')}”</option>`).join('')}</select></div>
      <button class="btn" id="npGo">Project aanmaken</button>
    </div>
    <div class="card">
      <h3>Huidig project: ${esc(cur?.naam || '')}</h3>
      <div class="grid two">
        <div class="field"><label>Projectnaam</label><input id="cpNaam" value="${esc(cur?.naam || '')}"></div>
        <div class="field"><label>Status</label><select id="cpStatus">${STATUS.map(s => `<option ${s === (P.status || 'actief') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Klant / eigenaar</label><input id="cpKlant" value="${esc(P.klant || '')}"></div>
        <div class="field"><label>Object</label><input id="cpObject" value="${esc(P.object || '')}"></div>
      </div>
      <div class="field"><label>Adres</label><input id="cpAdres" value="${esc(P.adres || '')}"></div>
      <div class="field"><label>Omschrijving</label><textarea id="cpOms" rows="2">${esc(P.omschrijving || '')}</textarea></div>
      <p class="note">${C.state.inspectie.length} inspectieregels · ${Object.keys(C.state.ai || {}).length} door AI beoordeeld · instellingenprofiel “${esc(C.state.settings.naam || '')}” · versie ${cur?.versie ?? 0} · laatst gewijzigd ${fmtDate(cur?.updated_at)}</p>
      <button class="btn" id="cpSave">Opslaan</button> <button class="btn ghost" id="cpDup">Dupliceren…</button> <button class="btn ghost" id="cpDel">Project verwijderen</button>
    </div>
  </div>
  <div class="card" style="margin-top:14px">
    <div class="toolbar"><h3 style="margin:0">Alle projecten (${cache.length})</h3><span class="spacer"></span><input id="projFilter" placeholder="zoeken op naam / klant / object" style="width:260px"></div>
    <div class="tablewrap"><table id="projTable"><thead><tr><th>Project</th><th>Klant</th><th>Object</th><th>Status</th><th class="num">Regels</th><th class="num">AI</th><th>Profiel</th><th>Laatst gewijzigd</th><th>Door</th><th></th></tr></thead><tbody>
    ${cache.map(x => { const m = x.meta || {}; return `<tr class="${x.id === cur?.id ? 'changed' : ''}" data-row="${esc((x.naam + ' ' + (m.klant || '') + ' ' + (m.object || '')).toLowerCase())}"><td><b>${esc(x.naam)}</b>${x.id === cur?.id ? ' <span class="tag">huidig</span>' : ''}${m.omschrijving ? `<div class="note">${esc(m.omschrijving)}</div>` : ''}</td><td>${esc(m.klant || '')}</td><td>${esc(m.object || '')}${m.adres ? `<div class="note">${esc(m.adres)}</div>` : ''}</td><td>${esc(m.status || '')}</td><td class="num">${m.regels ?? ''}</td><td class="num">${m.ai ?? ''}</td><td class="note">${esc(m.profiel || '')}</td><td class="note">${fmtDate(x.updated_at)}<div>v${x.versie}</div></td><td class="note">${esc(x.updated_by_naam || '')}</td><td>${x.id === cur?.id ? '' : `<button class="btn small" data-open="${x.id}">Openen</button>`} <button class="btn ghost small" data-dup="${x.id}" title="dupliceren">⧉</button> <button class="btn ghost small" data-del="${x.id}" title="verwijderen">✕</button></td></tr>`; }).join('')}
    </tbody></table></div>
  </div>`;
  const basisSel = $('#npBasis'); const showBron = () => $('#npBronWrap').style.display = (basisSel.value === 'kopie' || basisSel.value === 'volledig') && cache.length ? '' : 'none'; basisSel.onchange = showBron; showBron();
  $('#npGo').onclick = () => createProject({ naam: $('#npNaam').value, klant: $('#npKlant').value, object: $('#npObject').value, adres: $('#npAdres').value, omschrijving: $('#npOms').value, basis: basisSel.value, bron: $('#npBron')?.value }).catch(e => C.toast('Aanmaken mislukt: ' + e.message, 6000));
  $('#cpSave').onclick = async () => { const n = $('#cpNaam').value.trim(); if (n && n !== cur.naam) await DB.renameDossier(n); C.state.project = { ...(C.state.project || {}), klant: $('#cpKlant').value.trim(), object: $('#cpObject').value.trim(), adres: $('#cpAdres').value.trim(), status: $('#cpStatus').value, omschrijving: $('#cpOms').value.trim() }; C.audit({ veld: 'project', nieuw: 'projectgegevens gewijzigd', bron: 'mens' }); C.save(); await DB.flush(C.state); await refresh(); U().renderAll(); C.toast('Projectgegevens opgeslagen'); };
  $('#cpDel').onclick = () => delProject(cur.id, cur.naam);
  $('#cpDup').onclick = () => dupProject(cur.id, cur.naam);
  $$('[data-open]', el).forEach(b => b.onclick = () => openProject(b.dataset.open));
  $$('[data-dup]', el).forEach(b => b.onclick = () => { const x = cache.find(c => c.id === b.dataset.dup); dupProject(x.id, x.naam); });
  $$('[data-del]', el).forEach(b => b.onclick = () => { const x = cache.find(c => c.id === b.dataset.del); delProject(x.id, x.naam); });
  $('#projFilter').oninput = e => { const q = e.target.value.toLowerCase(); $$('#projTable tbody tr').forEach(tr => tr.style.display = tr.dataset.row.includes(q) ? '' : 'none'); };
}

async function dupProject(id, naam) {
  const n = prompt('Naam voor de kopie:', naam + ' (kopie)'); if (!n) return;
  const alleen = confirm('Alleen het instellingenprofiel kopiëren (OK) of ook alle data (Annuleren)?');
  await DB.flush(C.state); const d = await DB.duplicateDossier(id, n.trim(), alleen ? { alleenInstellingen: true } : {}); C.setState(d.state); await refresh(); U().renderAll(); C.toast(`Project “${n}” aangemaakt`);
}
async function delProject(id, naam) {
  if (cache.length <= 1) { C.toast('Het laatste project kan niet verwijderd worden'); return; }
  if (!confirm(`Project “${naam}” definitief verwijderen, inclusief audittrail en AI-runs?`)) return;
  if (prompt(`Typ ter bevestiging de projectnaam:`) !== naam) { C.toast('Naam komt niet overeen – niet verwijderd'); return; }
  const wasCur = DB.dossier?.id === id; await DB.deleteDossier(id); await refresh();
  if (wasCur) { const d = await DB.openDossier(cache[0].id); C.setState(d.state); }
  U().renderAll(); C.toast('Project verwijderd');
}

window.STEMI_UI = window.STEMI_UI || {}; Object.assign(window.STEMI_UI, { renderProjecten: render, renderProjectSelector: renderSelector, openProject, refreshProjecten: refresh });
})();
