/* bootstrap: login → dossier → render */
(() => {
const C = window.STEMI, U = window.STEMI_UI, DB = window.STEMI_DB; const { $, $$, esc } = C;
function switchTab(t) { $$('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t)); $$('.tab').forEach(s=>s.classList.toggle('active',s.id==='tab-'+t)); window.scrollTo(0,0); if (t === 'rapport') try { U.renderRapport(); } catch(e) { console.error(e); } }
const R = { projecten: () => U.renderProjecten(), overzicht: () => U.renderOverzicht(), eigenaar: () => U.renderEigenaar(), inspectie: () => U.renderInspectie(), specialist: () => U.renderSpecialist(), systeem: () => U.renderSysteem(), mjop: () => U.renderMjop(), rapport: () => { if (document.querySelector('#tab-rapport').classList.contains('active')) U.renderRapport(); }, /* rapport is zwaar: alleen opbouwen als de tab open staat */ instellingen: () => U.renderInstellingen(), uitleg: () => U.renderUitleg() };
function renderAll() { C.recompute(); for (const k in R) { try { R[k](); } catch(e) { console.error('render', k, e); $('#tab-'+k).innerHTML = `<p class="warn">Fout bij weergeven: ${esc(e.message)}</p>`; } } renderHeader(); }
Object.assign(U, { switchTab, renderAll });

function renderHeader() {
  const d = DB.dossier, p = DB.profile;
  $('#hdrUser').innerHTML = `<span class="note">${esc(p?.display_name||p?.username||'')}</span> <button class="btn ghost small" id="btnLogout">Uitloggen</button>`;
  $('#btnLogout').onclick = () => DB.logout();
  U.renderProjectSelector();
}
async function ensureDossier() {
  const list = await DB.listDossiers(); const last = localStorage.getItem('stemi_dossier');
  let d = list.find(x=>x.id===last) || list[0];
  if (!d) { const st = C.emptyState(); st.project = { klant:'Voorbeeld', object:'Loods', adres:'', status:'nieuw', omschrijving:'Voorbeelddata uit het Excel-model V2' }; d = await DB.createDossier('Loods – voorbeeld', st); }
  else d = await DB.openDossier(d.id);
  C.setState(d.state);
}
async function start() {
  const shared = await DB.getShared(); C.applySharedCfg(shared);
  await ensureDossier(); await U.refreshProjecten();
  renderAll();
  if (!C.state.settings.wizardVoltooid) switchTab('eigenaar');
  window.addEventListener('beforeunload', () => { if (DB.dossier) DB.flush(C.state); });
}
async function init() {
  C.startFoutafhandeling();
  await C.loadData();
  $$('#tabs button').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
  $('#drawerClose').onclick = () => $('#drawer').classList.add('hidden');
  $('#btnExport').onclick = () => U.exportXlsx();
  $('#btnReset').onclick = () => { if (confirm('Dit project terugzetten naar de voorbeelddata uit het Excel-model? (Audittrail in de database blijft bewaard)')) { C.resetState(); renderAll(); } };
  const ok = await DB.init();
  if (ok) await start(); else DB.showLogin(() => start().catch(showErr));
}
function showErr(e) { console.error(e); C.toast('Fout: ' + e.message, 6000); }
init().catch(e => { document.body.innerHTML = '<p style="padding:20px">Laden mislukt: ' + esc(e.message) + '</p>'; console.error(e); });
})();
