/* bootstrap: login → dossier → render */
(() => {
const C = window.STEMI, U = window.STEMI_UI, DB = window.STEMI_DB; const { $, $$, esc } = C;
const R = { projecten: () => U.renderProjecten(), overzicht: () => U.renderOverzicht(), eigenaar: () => U.renderEigenaar(), inspectie: () => U.renderInspectie(),
  specialist: () => U.renderSpecialist(), systeem: () => U.renderSysteem(), mjop: () => U.renderMjop(), scenario: () => U.renderScenario(),
  rapport: () => U.renderRapport(), kwaliteit: () => U.renderKwaliteit(), instellingen: () => U.renderInstellingen(), uitleg: () => U.renderUitleg() };
const actief = () => [...document.querySelectorAll('.tab')].find(s => s.classList.contains('active'))?.id.replace('tab-', '') || 'overzicht';
/** één tabblad opbouwen; fouten blijven in dat tabblad en slopen de rest niet */
function renderTab(k) { if (!R[k]) return; try { R[k](); } catch (e) { console.error('render', k, e); const el = $('#tab-' + k); if (el) el.innerHTML = `<p class="warn">Fout bij weergeven: ${esc(e.message)}</p>`; } }
function switchTab(t) {
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  $$('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + t));
  window.scrollTo(0, 0); renderTab(t);
}
/* Alleen het zichtbare tabblad opbouwen. Bij 1.000 inspectieregels kost tab 03 ruim 0,7 seconde;
   alles hertekenen bij elke wijziging maakte de app daar onbruikbaar. De andere tabbladen worden
   opgebouwd zodra je ze opent, dus ze zijn altijd actueel. */
function renderAll(hint) { C.recompute(); renderTab(actief()); if (hint && hint !== actief()) { /* bewust niet: dat tabblad wordt bij het openen bijgewerkt */ } renderHeader(); }
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
  // AI-voorstellen staan in een eigen tabel; wat nog in een oude state zit blijft als terugval bestaan
  try { const ai = await DB.aiVan(d.id); C.state.ai = { ...(C.state.ai || {}), ...ai }; } catch (e) { console.warn('ai laden', e); }
  try { await U.laadReferentie(); } catch (e) { console.warn('referentie laden', e); }
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
