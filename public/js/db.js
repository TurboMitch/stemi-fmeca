/* Supabase-laag: login, dossiers, opslag van state, audittrail, AI-runs en gedeelde instellingen */
window.STEMI_DB = (() => {
const CFG = window.STEMI_CONFIG; const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
let user = null, profile = null, dossier = null, saveTimer = null, dirty = false, saving = false, laatsteToken = null;
sb.auth.onAuthStateChange((_e, s) => { if (s?.access_token) laatsteToken = s.access_token; });
const $ = s => document.querySelector(s);

async function init() {
  const { data } = await sb.auth.getSession(); if (data.session) { user = data.session.user; laatsteToken = data.session.access_token; await loadProfile(); return true; }
  return false;
}
async function loadProfile() { const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle(); profile = data || { username: user.email.split('@')[0] }; }
async function login(username, password) {
  const email = username.includes('@') ? username : `${username.trim().toLowerCase()}@${CFG.emailDomain}`;
  const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Onbekende gebruiker of verkeerd wachtwoord' : error.message);
  user = data.user; await loadProfile(); return user;
}
async function logout() { await sb.auth.signOut(); user = null; profile = null; dossier = null; location.reload(); }
async function token() {
  let { data } = await sb.auth.getSession(); let s = data.session; if (!s) return null;
  if ((s.expires_at || 0) * 1000 - Date.now() < 5 * 60 * 1000) { const r = await sb.auth.refreshSession(); if (r.data.session) s = r.data.session; }
  laatsteToken = s.access_token; return s.access_token;
}

// ---------- dossiers ----------
const KOLOMMEN = 'id,naam,meta,versie,portefeuille,created_at,updated_at,updated_by,created_by,verwijderd_op,verwijderd_door';
/** projecten waar deze gebruiker lid van is (beheerder ziet alles); verwijderde projecten alleen met opts.prullenbak */
async function listDossiers(opts = {}) {
  let q = sb.from('dossiers').select(KOLOMMEN).order('updated_at', { ascending: false });
  q = opts.prullenbak ? q.not('verwijderd_op', 'is', null) : q.is('verwijderd_op', null);
  const { data, error } = await q; if (error) throw error;
  const ids = [...new Set(data.flatMap(d => [d.updated_by, d.created_by, d.verwijderd_door]).filter(Boolean))];
  let names = {}; if (ids.length) { const { data: pr } = await sb.from('profiles').select('id,username,display_name').in('id', ids); (pr||[]).forEach(p => names[p.id] = p.display_name || p.username); }
  // eigen rol per project in één query; een beheerder mag overal bij
  const { data: mijn } = await sb.from('dossier_leden').select('dossier_id,rol').eq('user_id', user.id);
  const rollen = Object.fromEntries((mijn||[]).map(l => [l.dossier_id, l.rol]));
  const { data: tel } = await sb.from('dossier_leden').select('dossier_id');
  const aantal = {}; (tel||[]).forEach(l => aantal[l.dossier_id] = (aantal[l.dossier_id]||0)+1);
  return data.map(d => ({ ...d, updated_by_naam: names[d.updated_by]||'', created_by_naam: names[d.created_by]||'',
    verwijderd_door_naam: names[d.verwijderd_door]||'', mijnRol: rollen[d.id] || (isAdmin() ? 'beheerder' : ''), aantalLeden: aantal[d.id] || 0 }));
}
const mijnRolIn = d => d?.mijnRol || (isAdmin() ? 'beheerder' : '');
/** mag de ingelogde gebruiker in dit project schrijven? (de database bewaakt het ook zelf) */
function magSchrijven(d = dossier) { const r = mijnRolIn(d); return r === 'beheerder' || r === 'eigenaar' || r === 'redacteur'; }
function magBeheren(d = dossier) { const r = mijnRolIn(d); return r === 'beheerder' || r === 'eigenaar'; }
/** metadata die de projectenlijst nodig heeft zonder de hele state te laden */
function metaVan(state, kpi) { const pj = state.project || {}; return { klant: pj.klant||'', object: pj.object||'', adres: pj.adres||'', status: pj.status||'', omschrijving: pj.omschrijving||'', regels: (state.inspectie||[]).length, ai: Object.keys(state.ai||{}).length, profiel: state.settings?.naam||'', ...(kpi || {}) }; }
async function openDossier(id) { annuleerSave(); const { data, error } = await sb.from('dossiers').select('*').eq('id', id).single(); if (error) throw error; dossier = data; localStorage.setItem('stemi_dossier', id); await rolVanDossier(); return data; }
async function rolVanDossier() { if (!dossier || !user) return; const { data } = await sb.from('dossier_leden').select('rol').eq('dossier_id', dossier.id).eq('user_id', user.id).maybeSingle(); dossier.mijnRol = data?.rol || (isAdmin() ? 'beheerder' : ''); }

// ---------- AI-voorstellen (staan in een eigen tabel, niet in de projectstate) ----------
/** alle AI-voorstellen van een project als object regel → voorstel */
async function aiVan(dossierId) {
  const { data, error } = await sb.from('dossier_ai').select('regel,data').eq('dossier_id', dossierId);
  if (error) { console.warn('ai laden', error); return {}; }
  return Object.fromEntries((data||[]).map(r => [r.regel, r.data]));
}
async function zetAi(regel, data) { if (!dossier) return; const { error } = await sb.from('dossier_ai').upsert({ dossier_id: dossier.id, regel, data, bijgewerkt_op: new Date().toISOString() }); if (error) { console.warn('ai opslaan', error); logFout('opslaan', error.message, { soort: 'ai_upsert', details: { regel } }); } }
async function zetAlleAi(obj) { if (!dossier) return; const rijen = Object.entries(obj||{}).map(([regel, data]) => ({ dossier_id: dossier.id, regel: +regel, data, bijgewerkt_op: new Date().toISOString() })); if (!rijen.length) return; const { error } = await sb.from('dossier_ai').upsert(rijen); if (error) console.warn('ai opslaan', error); }
async function wisAi(regel) { if (!dossier) return; if (regel == null) await sb.from('dossier_ai').delete().eq('dossier_id', dossier.id); else await sb.from('dossier_ai').delete().eq('dossier_id', dossier.id).eq('regel', regel); }
async function createDossier(naam, state, extra = {}) { const { data, error } = await sb.from('dossiers').insert({ naam, state: zonderAi(state), meta: metaVan(state), created_by: user.id, updated_by: user.id, ...extra }).select().single(); if (error) throw error; dossier = data; dossier.mijnRol = 'eigenaar'; localStorage.setItem('stemi_dossier', data.id); if (state.ai && Object.keys(state.ai).length) await zetAlleAi(state.ai); return data; }
/** de AI-voorstellen gaan niet mee in de projectstate: die staan in dossier_ai (scheelt honderden kB per opslagronde) */
function zonderAi(state) { const { ai, ...rest } = state || {}; return rest; }
async function renameDossier(naam) { const { error } = await sb.from('dossiers').update({ naam, updated_by: user.id }).eq('id', dossier.id); if (error) throw error; dossier.naam = naam; }
async function duplicateDossier(id, naam, opts={}) {
  const { data: src, error } = await sb.from('dossiers').select('state,portefeuille').eq('id', id).single(); if (error) throw error;
  const st = JSON.parse(JSON.stringify(src.state));
  if (opts.alleenInstellingen) { st.inspectie = []; st.specialist = []; st.besluiten = []; st.maatregelen = []; st.scenarios = []; st.ai = {}; st.audit = []; st.raw = null; st.project = { ...(st.project||{}), klant: opts.klant||'', object: opts.object||'', adres: opts.adres||'', status: 'nieuw', omschrijving: opts.omschrijving||'' }; }
  else { st.project = { ...(st.project||{}), ...(opts.project||{}) }; st.ai = await aiVan(id); }   // volledige kopie neemt ook de AI-voorstellen mee
  return createDossier(naam, st, { portefeuille: opts.portefeuille ?? src.portefeuille ?? null });
}
/** naar de prullenbak: het project blijft met alle historie bestaan en is terug te zetten */
async function deleteDossier(id) { const { error } = await sb.from('dossiers').update({ verwijderd_op: new Date().toISOString(), verwijderd_door: user.id, updated_by: user.id }).eq('id', id); if (error) throw error; if (dossier?.id === id) { dossier = null; localStorage.removeItem('stemi_dossier'); } }
async function herstelUitPrullenbak(id) { const { error } = await sb.from('dossiers').update({ verwijderd_op: null, verwijderd_door: null, updated_by: user.id }).eq('id', id); if (error) throw error; }
/** definitief weg, inclusief audittrail, AI-runs en back-ups (cascade). Alleen eigenaar of beheerder. */
async function definitiefVerwijderen(id) { const { error } = await sb.from('dossiers').delete().eq('id', id); if (error) throw error; if (dossier?.id === id) { dossier = null; localStorage.removeItem('stemi_dossier'); } }
async function zetPortefeuille(id, naam) { const { error } = await sb.from('dossiers').update({ portefeuille: naam || null, updated_by: user.id }).eq('id', id); if (error) throw error; if (dossier?.id === id) dossier.portefeuille = naam || null; }

// ---------- AI-kwaliteit: referentieset en evaluaties ----------
/** door mensen vastgestelde referentiewaarden van dit project, als object regel -> rij */
async function referentieVan(dossierId) {
  const id = dossierId || dossier?.id; if (!id) return {};
  const { data, error } = await sb.from('ai_referentie').select('*').eq('dossier_id', id);
  if (error) throw error;
  return Object.fromEntries((data || []).map(r => [r.regel, r]));
}
const hashVan = t => { const s2 = JSON.stringify(t ?? ''); let h = 0; for (let i = 0; i < s2.length; i++) { h = (h * 31 + s2.charCodeAt(i)) | 0; } return String(h); };
async function zetReferentie(rij) {
  if (!dossier) throw new Error('geen project geopend');
  const { error } = await sb.from('ai_referentie').upsert({ dossier_id: dossier.id, regel: rij.regel, waarden: rij.waarden,
    invoer: rij.invoer ?? null, invoer_hash: hashVan(rij.invoer), element: rij.element || null,
    vastgesteld_door: user.id, vastgesteld_op: new Date().toISOString(), opmerking: rij.opmerking ?? null });
  if (error) throw error;
}
async function wisReferentie(regel) {
  if (!dossier) return; const q = sb.from('ai_referentie').delete().eq('dossier_id', dossier.id);
  const { error } = regel == null ? await q : await q.eq('regel', regel); if (error) throw error;
}
async function bewaarEvaluatie(ev) {
  if (!dossier) throw new Error('geen project geopend');
  const { data, error } = await sb.from('ai_evaluaties').insert({ dossier_id: dossier.id, model: ev.model,
    prompt_versie: ev.promptVersie || null, context_hash: hashVan(ev.context), n: ev.n || 0, mislukt: ev.mislukt || 0,
    resultaat: ev.resultaat, tokens_in: ev.tokensIn ?? null, tokens_uit: ev.tokensUit ?? null,
    kosten_usd: ev.kostenUsd ?? null, duur_ms: ev.duurMs ?? null, door: user.id, gereed_op: new Date().toISOString() })
    .select().single();
  if (error) throw error; return data;
}
async function evaluatiesVan(limit = 25) {
  if (!dossier) return [];
  const { data, error } = await sb.from('ai_evaluaties').select('*').eq('dossier_id', dossier.id).order('gestart_op', { ascending: false }).limit(limit);
  if (error) throw error; return data || [];
}
async function wisEvaluatie(id) { const { error } = await sb.from('ai_evaluaties').delete().eq('id', id); if (error) throw error; }

// ---------- leden en gebruikers ----------
async function ledenVan(dossierId) {
  const { data, error } = await sb.from('dossier_leden').select('user_id,rol,toegevoegd_op').eq('dossier_id', dossierId); if (error) throw error;
  const ids = (data||[]).map(l => l.user_id); let pr = [];
  if (ids.length) { const r = await sb.from('profiles').select('id,username,display_name,role').in('id', ids); pr = r.data || []; }
  return (data||[]).map(l => { const p = pr.find(x => x.id === l.user_id) || {}; return { ...l, username: p.username || '', naam: p.display_name || p.username || '(onbekend)', beheerder: p.role === 'admin' }; })
    .sort((a,b) => (a.rol === 'eigenaar' ? -1 : b.rol === 'eigenaar' ? 1 : a.naam.localeCompare(b.naam)));
}
async function zetLid(dossierId, userId, rol) { const { error } = await sb.from('dossier_leden').upsert({ dossier_id: dossierId, user_id: userId, rol, toegevoegd_door: user.id }); if (error) throw error; }
async function verwijderLid(dossierId, userId) { const { error } = await sb.from('dossier_leden').delete().eq('dossier_id', dossierId).eq('user_id', userId); if (error) throw error; }
async function alleGebruikers() { const { data, error } = await sb.from('profiles').select('id,username,display_name,role').order('username'); if (error) throw error; return data || []; }
async function zetGebruikersRol(userId, role) { const { error } = await sb.from('profiles').update({ role }).eq('id', userId); if (error) throw error; }

/** state opslaan (debounced). Conflictdetectie op versie: als een ander de dossier intussen wijzigde, wordt de remote versie geladen. */
let laatsteKpi = null;
let pending = null;                     // state die nog moet worden weggeschreven zodra de lopende save klaar is
/** Plant een save. De state wordt aan het huidige dossier-id gebonden, zodat een uitgestelde save nooit in een ander (intussen geopend) project terechtkomt. */
function persist(state, kpi) { dirty = true; if (kpi) laatsteKpi = kpi; clearTimeout(saveTimer); const id = dossier?.id; saveTimer = setTimeout(() => flush(state, id), 700); }
/** Annuleert een geplande save; aanroepen vóór het wisselen van project. */
function annuleerSave() { clearTimeout(saveTimer); saveTimer = null; pending = null; }
async function flush(state, voorId) {
  if (!dossier || !user) return;
  if (voorId && voorId !== dossier.id) return;          // hoort bij een ander project: weggooien
  if (saving) { pending = state; return; }              // wordt na de lopende save alsnog weggeschreven
  // leesrechten: niet proberen op te slaan (de database zou het weigeren en dat vult de foutenlijst)
  if (!magSchrijven()) { dirty = false; setStatus('alleen lezen – niet opgeslagen', true); return; }
  saving = true; setStatus('opslaan…'); const id = dossier.id;
  try {
    // optimistic locking: alleen schrijven als de versie in de database nog de versie is die wij kennen
    const { data, error } = await sb.from('dossiers').update({ state: zonderAi(state), meta: metaVan(state, laatsteKpi), updated_by: user.id }).eq('id', id).eq('versie', dossier.versie).select('versie,updated_at').maybeSingle();
    if (error) throw error;
    if (!data) {
      const { data: cur } = await sb.from('dossiers').select('versie,updated_by,updated_at').eq('id', id).single();
      const wie = cur?.updated_by === user.id ? 'jou in een ander tabblad' : 'een andere gebruiker';
      setStatus('conflict – niet opgeslagen', true);
      if (confirm(`Dit project is intussen gewijzigd door ${wie} (versie ${cur?.versie}). Herladen met die versie? (Annuleren = jouw versie opslaan en die wijzigingen overschrijven)`)) { location.reload(); saving = false; return; }
      const { data: d2, error: e2 } = await sb.from('dossiers').update({ state: zonderAi(state), meta: metaVan(state, laatsteKpi), updated_by: user.id }).eq('id', id).select('versie,updated_at').single();
      if (e2) throw e2; dossier.versie = d2.versie; dossier.updated_at = d2.updated_at;
    } else { dossier.versie = data.versie; dossier.updated_at = data.updated_at; }
    dirty = false; setStatus('opgeslagen ' + new Date().toLocaleTimeString('nl-NL'));
  } catch (e) { console.error(e); setStatus('opslaan mislukt: ' + e.message, true); logFout('opslaan', e.message, { soort: 'persist', details: { dossier: dossier?.naam, versie: dossier?.versie } }); }
  saving = false;
  if (pending && dossier && dossier.id === id) { const p = pending; pending = null; await flush(p, id); }
}
/** Bij het sluiten van het tabblad: één directe schrijfactie met keepalive, zonder wachten. */
function flushBijSluiten(state) {
  if (!dossier || !user || !dirty || !magSchrijven()) return;
  const stuur = token => { try { fetch(`${CFG.supabaseUrl}/rest/v1/dossiers?id=eq.${dossier.id}&versie=eq.${dossier.versie}`, { method: 'PATCH', keepalive: true, headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ state: zonderAi(state), meta: metaVan(state, laatsteKpi), updated_by: user.id }) }); } catch {} };
  if (laatsteToken) stuur(laatsteToken);
}
function setStatus(t, warn=false) { const el = $('#dbStatus'); if (el) { el.textContent = t; el.classList.toggle('warn', warn); } }

// ---------- audit & AI-runs ----------
async function logAudit(entry) { if (!dossier || !user) return; try { await sb.from('audit_log').insert({ dossier_id: dossier.id, user_id: user.id, username: profile?.username, ts: entry.ts, regel: entry.regel ?? null, veld: entry.veld ?? null, oud: entry.oud === undefined ? null : entry.oud, nieuw: entry.nieuw === undefined ? null : entry.nieuw, bron: entry.bron ?? null, model: entry.model ?? null, opmerking: entry.opmerking ?? null }); } catch (e) { console.warn('audit', e); } }
async function logAiRun(run) { if (!dossier || !user) return; try { const { error } = await sb.from('ai_runs').insert({ dossier_id: dossier.id, user_id: user.id, regel: run.regel ?? null, taak: run.taak || 'specialist', model: run.model || null, input: run.input ?? null, output: run.output ?? null, usage: run.usage ?? null }); if (error) console.warn('ai_run', error); } catch (e) { console.warn('ai_run', e); } }
async function backupsVan(dossierId) { const { data, error } = await sb.from('dossier_backups').select('id,naam,versie,reden,gemaakt_op').eq('dossier_id', dossierId).order('gemaakt_op', { ascending: false }).limit(20); if (error) throw error; return data || []; }
async function herstelDossier(dossierId, backupId) { const { data, error } = await sb.rpc('herstel_dossier', { p_dossier: dossierId, p_backup: backupId || null }); if (error) throw error; return data; }
/** Legt een fout vast in app_errors (stil: als loggen zelf faalt, gebeurt er niets extra). */
async function logFout(bron, melding, extra = {}) {
  try {
    await sb.from('app_errors').insert({
      user_id: user?.id || null, username: profile?.username || null,
      dossier_id: dossier?.id || null, dossier_naam: dossier?.naam || null,
      bron, soort: extra.soort || null, melding: String(melding).slice(0, 2000),
      details: extra.details ?? null, url: location.pathname + location.hash, app_versie: window.STEMI_VERSIE || null
    });
  } catch (e) { console.warn('fout loggen mislukt', e); }
}
async function foutSamenvatting() { const { data, error } = await sb.rpc('fout_samenvatting'); if (error) throw error; return data || []; }
async function laatsteFouten(limit = 25) { const { data, error } = await sb.from('app_errors').select('*').order('ts', { ascending: false }).limit(limit); if (error) throw error; return data || []; }
async function aiRunsVan(regel) { const { data, error } = await sb.from('ai_runs').select('*').eq('dossier_id', dossier.id).eq('regel', regel).order('ts', { ascending: false }).limit(3); if (error) throw error; return data || []; }
async function auditFromDb(limit=500) { const { data } = await sb.from('audit_log').select('*').eq('dossier_id', dossier.id).order('ts', { ascending: false }).limit(limit); return data || []; }

// ---------- gedeelde instellingen (OpenRouter-sleutel, modellen, context) ----------
async function getSetting(key) { const { data } = await sb.from('app_settings').select('value').eq('key', key).maybeSingle(); return data?.value || null; }
const isAdmin = () => profile?.role === 'admin';
/** gedeelde instellingen: modellen/context voor iedereen, API-sleutel alleen leesbaar voor beheerders */
async function getShared() {
  const pub = await getSetting('openrouter') || {};
  let sec = null; if (isAdmin()) { try { sec = await getSetting('openrouter_secret'); } catch {} }
  return { ...pub, apiKey: sec?.apiKey || '', sleutelBeheerdersOnly: !isAdmin() };
}
async function setShared(cfg) {
  const { apiKey, sleutelBeheerdersOnly, ...pub } = cfg || {};
  await setSetting('openrouter', pub);
  if (isAdmin() && apiKey) await setSetting('openrouter_secret', { apiKey });
}
async function setSetting(key, value) { const { error } = await sb.from('app_settings').upsert({ key, value, updated_by: user.id, updated_at: new Date().toISOString() }); if (error) throw error; }

// ---------- login UI ----------
function showLogin(onDone) {
  const ov = $('#login'); ov.classList.remove('hidden');
  const form = $('#loginForm'); form.onsubmit = async e => { e.preventDefault(); const st = $('#loginStatus'); st.innerHTML = '<span class="spin"></span>inloggen…'; try { await login($('#loginUser').value, $('#loginPass').value); ov.classList.add('hidden'); onDone(); } catch (err) { st.innerHTML = `<span class="warn">${err.message}</span>`; } };
  setTimeout(() => $('#loginUser').focus(), 50);
}
return { sb, init, login, logout, token, get user(){return user}, get profile(){return profile}, get dossier(){return dossier}, listDossiers, openDossier, createDossier, renameDossier, duplicateDossier, deleteDossier,
  herstelUitPrullenbak, definitiefVerwijderen, zetPortefeuille, referentieVan, zetReferentie, wisReferentie, bewaarEvaluatie, evaluatiesVan, wisEvaluatie, hashVan, ledenVan, zetLid, verwijderLid, alleGebruikers, zetGebruikersRol, aiVan, zetAi, zetAlleAi, wisAi, magSchrijven, magBeheren, mijnRolIn,
  metaVan, backupsVan, herstelDossier, persist, flush, flushBijSluiten, annuleerSave, logAudit, logAiRun, logFout, foutSamenvatting, laatsteFouten, aiRunsVan, auditFromDb, getSetting, setSetting, getShared, setShared, get isAdmin(){return isAdmin()}, showLogin, setStatus };
})();
