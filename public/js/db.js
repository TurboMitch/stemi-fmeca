/* Supabase-laag: login, dossiers, opslag van state, audittrail, AI-runs en gedeelde instellingen */
window.STEMI_DB = (() => {
const CFG = window.STEMI_CONFIG; const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
let user = null, profile = null, dossier = null, saveTimer = null, dirty = false, saving = false;
const $ = s => document.querySelector(s);

async function init() {
  const { data } = await sb.auth.getSession(); if (data.session) { user = data.session.user; await loadProfile(); return true; }
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
  return s.access_token;
}

// ---------- dossiers ----------
async function listDossiers() { const { data, error } = await sb.from('dossiers').select('id,naam,meta,versie,created_at,updated_at,updated_by,created_by').order('updated_at', { ascending: false }); if (error) throw error; const ids = [...new Set(data.flatMap(d=>[d.updated_by,d.created_by]).filter(Boolean))]; let names = {}; if (ids.length) { const { data: pr } = await sb.from('profiles').select('id,username,display_name').in('id', ids); (pr||[]).forEach(p => names[p.id] = p.display_name || p.username); } return data.map(d => ({ ...d, updated_by_naam: names[d.updated_by]||'', created_by_naam: names[d.created_by]||'' })); }
/** metadata die de projectenlijst nodig heeft zonder de hele state te laden */
function metaVan(state) { const pj = state.project || {}; return { klant: pj.klant||'', object: pj.object||'', adres: pj.adres||'', status: pj.status||'', omschrijving: pj.omschrijving||'', regels: (state.inspectie||[]).length, ai: Object.keys(state.ai||{}).length, profiel: state.settings?.naam||'' }; }
async function openDossier(id) { const { data, error } = await sb.from('dossiers').select('*').eq('id', id).single(); if (error) throw error; dossier = data; localStorage.setItem('stemi_dossier', id); return data; }
async function createDossier(naam, state) { const { data, error } = await sb.from('dossiers').insert({ naam, state, meta: metaVan(state), created_by: user.id, updated_by: user.id }).select().single(); if (error) throw error; dossier = data; localStorage.setItem('stemi_dossier', data.id); return data; }
async function renameDossier(naam) { const { error } = await sb.from('dossiers').update({ naam, updated_by: user.id }).eq('id', dossier.id); if (error) throw error; dossier.naam = naam; }
async function duplicateDossier(id, naam, opts={}) { const { data: src, error } = await sb.from('dossiers').select('state').eq('id', id).single(); if (error) throw error; const st = JSON.parse(JSON.stringify(src.state)); if (opts.alleenInstellingen) { st.inspectie = []; st.specialist = []; st.besluiten = []; st.maatregelen = []; st.ai = {}; st.audit = []; st.raw = null; st.project = { ...(st.project||{}), klant: opts.klant||'', object: opts.object||'', adres: opts.adres||'', status: 'nieuw', omschrijving: opts.omschrijving||'' }; } else { st.project = { ...(st.project||{}), ...(opts.project||{}) }; } return createDossier(naam, st); }
async function deleteDossier(id) { const { error } = await sb.from('dossiers').delete().eq('id', id); if (error) throw error; if (dossier?.id === id) { dossier = null; localStorage.removeItem('stemi_dossier'); } }

/** state opslaan (debounced). Conflictdetectie op versie: als een ander de dossier intussen wijzigde, wordt de remote versie geladen. */
function persist(state) { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(() => flush(state), 700); }
async function flush(state) {
  if (!dossier || !user || saving) return; saving = true; setStatus('opslaan…');
  try {
    const { data: cur } = await sb.from('dossiers').select('versie,updated_by').eq('id', dossier.id).single();
    if (cur && cur.versie !== dossier.versie && cur.updated_by !== user.id) { setStatus('conflict – herladen'); saving = false; if (confirm('Dit dossier is intussen door een andere gebruiker gewijzigd. Herladen met hun versie? (Annuleren = jouw versie opslaan en hun wijzigingen overschrijven)')) { location.reload(); return; } }
    const { data, error } = await sb.from('dossiers').update({ state, meta: metaVan(state), updated_by: user.id }).eq('id', dossier.id).select('versie,updated_at').single();
    if (error) throw error; dossier.versie = data.versie; dossier.updated_at = data.updated_at; dirty = false; setStatus('opgeslagen ' + new Date().toLocaleTimeString('nl-NL'));
  } catch (e) { console.error(e); setStatus('opslaan mislukt: ' + e.message, true); logFout('opslaan', e.message, { soort: 'persist', details: { dossier: dossier?.naam, versie: dossier?.versie } }); }
  saving = false;
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
return { sb, init, login, logout, token, get user(){return user}, get profile(){return profile}, get dossier(){return dossier}, listDossiers, openDossier, createDossier, renameDossier, duplicateDossier, deleteDossier, metaVan, backupsVan, herstelDossier, persist, flush, logAudit, logAiRun, logFout, foutSamenvatting, laatsteFouten, aiRunsVan, auditFromDb, getSetting, setSetting, getShared, setShared, get isAdmin(){return isAdmin()}, showLogin, setStatus };
})();
