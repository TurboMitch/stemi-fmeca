/* bootstrap: login → dossier → render */
(() => {
const C = window.STEMI, U = window.STEMI_UI, DB = window.STEMI_DB; const { $, $$, esc } = C;
function switchTab(t) { $$('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t)); $$('.tab').forEach(s=>s.classList.toggle('active',s.id==='tab-'+t)); window.scrollTo(0,0); }
const R = { overzicht: () => U.renderOverzicht(), eigenaar: () => U.renderEigenaar(), inspectie: () => U.renderInspectie(), specialist: () => U.renderSpecialist(), systeem: () => U.renderSysteem(), mjop: () => U.renderMjop(), instellingen: () => U.renderInstellingen(), uitleg: () => U.renderUitleg() };
function renderAll() { C.recompute(); for (const k in R) { try { R[k](); } catch(e) { console.error('render', k, e); $('#tab-'+k).innerHTML = `<p class="warn">Fout bij weergeven: ${esc(e.message)}</p>`; } } renderHeader(); }
Object.assign(U, { switchTab, renderAll });

function renderHeader() {
  const d = DB.dossier, p = DB.profile;
  $('#hdrUser').innerHTML = `<span class="note">${esc(p?.display_name||p?.username||'')}</span> <button class="btn ghost small" id="btnLogout">Uitloggen</button>`;
  $('#btnLogout').onclick = () => DB.logout();
  $('#hdrDossier').innerHTML = `<button class="btn ghost small" id="btnDossiers">📁 ${esc(d?.naam||'dossier')} <span class="note">v${d?.versie??0}</span></button> <span id="dbStatus" class="note"></span>`;
  $('#btnDossiers').onclick = openDossiers;
}
async function openDossiers() {
  const list = await DB.listDossiers(); const body = $('#drawerBody'); $('#drawerTitle').textContent = 'Dossiers (objecten / portefeuilles)'; $('#drawer').classList.remove('hidden');
  body.innerHTML = `<p class="note">Elk dossier bevat één volledige FMECA-MJOP-dataset (inspectie, specialist, besluiten, MJOP, instellingenprofiel, AI-runs). Alles staat in Supabase en is voor alle gebruikers zichtbaar.</p>
    <table class="diff"><tbody>${list.map(x=>`<tr class="${x.id===DB.dossier?.id?'changed':''}"><td><b>${esc(x.naam)}</b><div class="note">v${x.versie} · ${new Date(x.updated_at).toLocaleString('nl-NL')}</div></td><td><button class="btn small" data-open="${x.id}">Openen</button> <button class="btn ghost small" data-del="${x.id}">✕</button></td></tr>`).join('')}</tbody></table>
    <div class="field" style="margin-top:14px"><label>Nieuw dossier</label><input id="newDossier" placeholder="bijv. Loods De Kwakel"></div><button class="btn" id="newDossierGo">Aanmaken met voorbeelddata</button> <button class="btn ghost" id="newDossierEmpty">Leeg aanmaken</button>
    <div class="field" style="margin-top:14px"><label>Huidig dossier hernoemen</label><input id="renDossier" value="${esc(DB.dossier?.naam||'')}"></div><button class="btn ghost" id="renDossierGo">Hernoemen</button>`;
  $$('[data-open]', body).forEach(b => b.onclick = async () => { await DB.flush(C.state); const d = await DB.openDossier(b.dataset.open); C.setState(d.state); $('#drawer').classList.add('hidden'); renderAll(); C.toast('Dossier geopend: ' + d.naam); });
  $$('[data-del]', body).forEach(b => b.onclick = async () => { const x = list.find(l=>l.id===b.dataset.del); if (!confirm(`Dossier “${x.naam}” definitief verwijderen (incl. audittrail en AI-runs)?`)) return; await DB.deleteDossier(x.id); if (!DB.dossier) { await ensureDossier(); renderAll(); } openDossiers(); });
  const mk = async (empty) => { const n = $('#newDossier').value.trim(); if (!n) return; await DB.flush(C.state); const st = C.emptyState(); if (empty) { st.inspectie = []; st.specialist = []; } await DB.createDossier(n, st); C.setState(st); $('#drawer').classList.add('hidden'); renderAll(); C.toast('Dossier aangemaakt'); };
  $('#newDossierGo').onclick = () => mk(false); $('#newDossierEmpty').onclick = () => mk(true);
  $('#renDossierGo').onclick = async () => { const n=$('#renDossier').value.trim(); if(!n) return; await DB.renameDossier(n); renderHeader(); openDossiers(); };
}
async function ensureDossier() {
  const list = await DB.listDossiers(); const last = localStorage.getItem('stemi_dossier');
  let d = list.find(x=>x.id===last) || list[0];
  if (!d) { const st = C.emptyState(); d = await DB.createDossier('Loods – voorbeeld', st); }
  else d = await DB.openDossier(d.id);
  C.setState(d.state);
}
async function start() {
  const shared = await DB.getSetting('openrouter'); C.applySharedCfg(shared);
  await ensureDossier();
  renderAll();
  if (!C.state.settings.wizardVoltooid) switchTab('eigenaar');
  window.addEventListener('beforeunload', () => { if (DB.dossier) DB.flush(C.state); });
}
async function init() {
  await C.loadData();
  $$('#tabs button').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
  $('#drawerClose').onclick = () => $('#drawer').classList.add('hidden');
  $('#btnExport').onclick = () => U.exportXlsx();
  $('#btnReset').onclick = () => { if (confirm('Dit dossier terugzetten naar de voorbeelddata uit het Excel-model? (Audittrail in de database blijft bewaard)')) { C.resetState(); renderAll(); } };
  const ok = await DB.init();
  if (ok) await start(); else DB.showLogin(() => start().catch(showErr));
}
function showErr(e) { console.error(e); C.toast('Fout: ' + e.message, 6000); }
init().catch(e => { document.body.innerHTML = '<p style="padding:20px">Laden mislukt: ' + esc(e.message) + '</p>'; console.error(e); });
})();
