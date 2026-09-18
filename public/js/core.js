/* STEMI core: state, instellingenprofiel, rekenkern, herkomst/audit */
window.STEMI = (() => {
// waardeaspecten zijn organisatie-specifiek: deze arrays worden in-place gesynchroniseerd met settings.aspecten (syncAspects)
const ASP = ['Veiligheid','Compliance','Functionaliteit','Beschikbaarheid','Betrouwbaarheid','Technische instandhouding','Duurzaamheid/energie','Esthetiek'];
const ASP_SHORT = ['Veil','Compl','Funct','Besch','Betr','Inst','Duurz','Esth'];
const ONTWIKKELING = ['Stabiel','Langzaam','Progressief','Snel / actief'];
const INTENSITEIT = ['Beginstadium','Duidelijk waarneembaar','Gevorderd','Eindstadium'];
const ERNST = ['Ernstig','Serieus','Gering'];
const INSPECTEERBAAR = ['Volledig','Deels','Niet'];
const PRIOS = ['P1','P2','P3','P4','P5'];
const MODELS = ['anthropic/claude-sonnet-4.5','anthropic/claude-opus-4.1','openai/gpt-4.1','openai/gpt-5','google/gemini-2.5-pro','deepseek/deepseek-chat-v3.1','mistralai/mistral-large'];
const LS_KEY = 'stemi_fmeca_state_v2', LS_KEY_V1 = 'stemi_fmeca_state_v1', LS_CFG = 'stemi_fmeca_cfg_v1';
const SP_NUM = ['O','D','Tjaar','restS','restO','restD','kostenSpecialist'];
const SP_FIELDS = ['faalwijze','O','onderbouwingO','D','onderbouwingD','Tklasse','Tjaar','onderbouwingT','effect','onderbouwingEffect','maatregel','restS','restO','restD','restToelichting','kostenSpecialist','onderbouwingKosten','scopeOverride','onderbouwingScope','aanvullendOnderzoek'];

// ---------- helpers ----------
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = v => (v === '' || v === null || v === undefined || isNaN(+v)) ? null : +v;
const eur = v => v == null ? '' : new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const pct = v => v == null ? '' : Math.round(v*100) + '%';
const pill = p => p ? `<span class="pill ${p}">${p}</span>` : '';
const uid = () => Math.random().toString(36).slice(2,9);
const toast = (m, ms=2500) => { const t=$('#toast'); if(!t) return; t.textContent=m; t.classList.remove('hidden'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.add('hidden'),ms); };
const clone = o => JSON.parse(JSON.stringify(o));

// ---------- standaard instellingenprofiel (rekenkern = beleid) ----------
function defaultRules() {
  return {
    rpn: [{min:301,prio:'P1'},{min:151,prio:'P2'},{min:76,prio:'P3'},{min:26,prio:'P4'}],
    safety: [{min:9,prio:'P1'},{min:7,prio:'P2'},{min:5,prio:'P3'}],
    compliance: [{min:9,prio:'P1'},{min:8,prio:'P2'}],
    tPrio: [{max:0.25,prio:'P1'},{max:1,prio:'P2'},{max:3,prio:'P3'},{max:5,prio:'P4'}],
    laatsteJaar: {P1:0,P2:1,P3:3,P4:5,P5:null},
    oVoorstel: { basis:2, intensiteit:{'Beginstadium':0,'Duidelijk waarneembaar':1,'Gevorderd':2,'Eindstadium':3}, omvang:[{min:0.5,add:2},{min:0.2,add:1}], ontwikkeling:{'Stabiel':0,'Langzaam':1,'Progressief':2,'Snel / actief':3}, conditieVanaf:null, conditieAdd:0 },
    dVoorstel: {'Volledig':2,'Deels':5,'Niet':8},
    safetyAspect: 'Veiligheid', complianceAspect: 'Compliance',
    tKlassen: [{klasse:'Reeds aanwezig',jaar:0},{klasse:'< 1 jaar',jaar:0.5},{klasse:'1–3 jaar',jaar:2},{klasse:'3–5 jaar',jaar:4},{klasse:'> 5 jaar',jaar:8}],
    tPerCode: {'B05EC01':{klasse:'< 1 jaar',jaar:0.5,tekst:'Korte termijn technisch beoordelen.'},'B15SM07':{klasse:'3–5 jaar',jaar:4,tekst:'Termijn is startvoorstel; specialist bevestigt.'},'B05VZ02':{klasse:'Reeds aanwezig',jaar:0,tekst:'Esthetische faalwijze is reeds aanwezig.'}}
  };
}
function defaultSettings(seed) {
  return {
    naam: 'Standaard (uit Excel-model V2)',
    params: clone(seed.params),
    profielen: clone(seed.profielen),
    aspecten: clone(seed.aspecten),
    rules: defaultRules(),
    scorekaarten: clone(seed.scorekaarten),
    libOverrides: {},          // nenCode -> {effect:[8], faalwijze}
    wizardVoltooid: false
  };
}

// ---------- state ----------
let seed=null, lib=[], libByCode={}, state=null, cfg=null, calc=null;

function emptyState() {
  return { versie:2, settings: defaultSettings(seed), inspectie: clone(seed.inspectie), raw: null, specialist: clone(seed.specialist).map(s=>({...s, prov: Object.fromEntries(SP_FIELDS.filter(k=>s[k]!=null&&s[k]!=='').map(k=>[k,{bron:'excel',ts:'2026-09-16'}]))})), besluiten: clone(seed.besluiten), maatregelen: [], ai: {}, audit: [] };
}
function migrateV1(old) {
  const st = emptyState();
  st.settings.params = Object.assign(st.settings.params, old.params||{});
  if (old.profielen) st.settings.profielen = old.profielen;
  st.inspectie = old.inspectie||[]; st.specialist = (old.specialist||[]).map(s=>({...s, prov: s.prov||{}})); st.besluiten = old.besluiten||[]; st.ai = old.ai||{};
  return st;
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch{} if (window.STEMI_DB) window.STEMI_DB.persist(state); }
function saveCfg() { try { localStorage.setItem(LS_CFG, JSON.stringify(cfg)); } catch{} if (window.STEMI_DB) window.STEMI_DB.setSetting('openrouter', cfg).catch(e=>console.warn(e)); }
function audit(entry) { const e = {ts:new Date().toISOString(), user: window.STEMI_DB?.profile?.username, ...entry}; state.audit.unshift(e); if (state.audit.length>2000) state.audit.length=2000; if (window.STEMI_DB) window.STEMI_DB.logAudit(e); }
function getSp(id) { let sp = state.specialist.find(x=>x.id===id); if(!sp){ sp={id,effect:[],prov:{}}; state.specialist.push(sp);} sp.prov = sp.prov||{}; return sp; }
/** zet een specialistveld met herkomst; logt in audit */
function setSp(id, k, v, bron, meta={}) {
  const sp = getSp(id); const old = k.startsWith('effect') && k!=='effect' ? (sp.effect||[])[+k.slice(6)] : sp[k];
  if (k.startsWith('effect') && k!=='effect') { sp.effect = sp.effect||[]; sp.effect[+k.slice(6)] = num(v); }
  else if (k==='effect') sp.effect = (v||[]).map(num);
  else if (SP_NUM.includes(k)) sp[k] = num(v);
  else sp[k] = v ?? '';
  const key = k.startsWith('effect') ? 'effect' : k;
  sp.prov[key] = { bron, ts: new Date().toISOString(), ...meta };
  audit({ regel:id, veld:k, oud: old, nieuw: v, bron, ...meta });
}

// ---------- rekenkern ----------
function belangen() {
  const S = state.settings, prof = S.profielen[S.params.profiel] || Object.values(S.profielen)[0] || [];
  return ASP.map((_, i) => Math.max(num(prof[i]) ?? 0, num(S.params.minimum?.[i]) ?? 0));
}
function libEntry(code) { const e = libByCode[code]; if (!e) return null; const o = state.settings.libOverrides?.[code]; return o ? {...e, effect: o.effect||e.effect, faalwijze: o.faalwijze||e.faalwijze, override:true} : e; }
/** O-systeemvoorstel = MIN(10, basis + intensiteit + omvang + ontwikkeling) – organisatie-eigen O-bepalingsregels; geeft ook de uitleg terug */
function systeemvoorstelO(insp, omvang, withUitleg=false) {
  const R = state.settings.rules.oVoorstel; const delen = [`basis ${R.basis}`]; let o = R.basis;
  const iv = insp.intensiteit ? (R.intensiteit[insp.intensiteit] ?? 0) : 0; o += iv; delen.push(`intensiteit ${insp.intensiteit ? `'${insp.intensiteit}'` : 'niet ingevuld'} (+${iv})`);
  const omv = num(omvang); const b = omv == null ? null : R.omvang.slice().sort((a,b)=>b.min-a.min).find(x => omv >= x.min); const ov = b ? b.add : 0; o += ov; delen.push(`omvang ${omv==null?'onbekend':pct(omv)} (+${ov})`);
  const ok = insp.ontwikkelingKlasse; const ontw = R.ontwikkeling || {}; const ow = ok ? (ontw[ok] ?? 0) : 0; o += ow; delen.push(`ontwikkeling ${ok ? `'${ok}'` : 'niet ingevuld'} (+${ow})`);
  if (R.conditieVanaf != null && (num(insp.conditie) ?? 0) >= R.conditieVanaf) { o += R.conditieAdd; delen.push(`conditie ≥ ${R.conditieVanaf} (+${R.conditieAdd})`); }
  o = Math.min(10, Math.max(1, o));
  if (!withUitleg) return o;
  const kl = state.settings.scorekaarten.O.find(x => x.score === o);
  return { o, klasse: kl ? kl.classificatie : '', uitleg: delen.join(' + ') + ` = ${o}` + (kl ? ` – ${kl.classificatie}` : ''), ontbreekt: [!insp.intensiteit&&'intensiteit', omv==null&&'omvang', !ok&&'ontwikkeling'].filter(Boolean) };
}
function oKlasse(o) { const kl = state.settings.scorekaarten.O.find(x => x.score === o); return kl ? (kl.classificatie || kl.betekenis || '') : ''; }
function dKlasse(d) { const kl = state.settings.scorekaarten.D.find(x => x.score === d); return kl ? (kl.detect || '') : ''; }
function voorstelD(insp) { const R = state.settings.rules.dVoorstel; return insp ? (R[insp] ?? R['Niet']) : null; }
function voorstelDtekst(insp) { const d = voorstelD(insp); const kl = d ? state.settings.scorekaarten.D.find(x=>x.score===d) : null; return `inspecteerbaarheid '${insp||'onbekend'}' → D ${d??'?'}${kl?` – ${kl.detect}: ${kl.criterium}`:''}`; }
function voorstelT(code) { const t = state.settings.rules.tPerCode[code]; return t ? [t.klasse, t.jaar, t.tekst] : ['Onbekend', null, 'T niet betrouwbaar uit alleen gebrekcode; specialist bepaalt.']; }
function tJaarVanKlasse(k) { return state.settings.rules.tKlassen.find(t=>t.klasse===k)?.jaar ?? null; }
function prioFromThresholds(list, v, dflt) { if (v==null) return null; const hit = list.slice().sort((a,b)=>b.min-a.min).find(x => v >= x.min); return hit ? hit.prio : dflt; }
function prioT(t) { if (t==null) return null; const R = state.settings.rules.tPrio; const hit = R.slice().sort((a,b)=>a.max-b.max).find(x => t <= x.max); return hit ? hit.prio : 'P5'; }
const OKANS = () => state.settings.scorekaarten.O.map(o=>o.classificatie || o.kans);
const DTEKST = () => state.settings.scorekaarten.D.map(d=>d.detect);

/** maatregelen (handelingen) van een regel, incl. default uit specialist/AM */
function maatregelenVan(r) {
  const own = state.maatregelen.filter(m => m.regelId === r.id);
  if (own.length) return own;
  const jaar = num(r.bes.jaar) ?? r.laatsteJaar ?? r.deadline;
  return [{ id:'auto-'+r.id, regelId:r.id, handeling: r.bes.maatregel || r.sp.maatregel || r.insp.maatregel || '', jaar, kosten: r.definitieveKosten, cyclus: null, auto:true }];
}
function expandCyclus(m, jaren) {
  if (m.jaar == null) return [];
  if (!m.cyclus || m.cyclus <= 0) return jaren.includes(m.jaar) ? [m.jaar] : [];
  const out = []; for (let j = m.jaar; j <= jaren[jaren.length-1]; j += m.cyclus) { if (j >= jaren[0]) out.push(j); if (m.tot != null && j >= m.tot) break; }
  return out;
}

function recompute() {
  const S = state.settings, P = S.params, R = S.rules, bel = belangen(), fac = bel.map(b => b/5);
  const start = num(P.startjaar) ?? 2026, horizon = num(P.horizon) ?? 40;
  const jaren = Array.from({length: horizon}, (_, i) => start + i);
  const rows = [];
  for (const insp of state.inspectie) {
    if (!insp.object && !insp.element) continue;
    const sp = getSp(insp.id), bes = state.besluiten.find(b => b.id === insp.id) || {};
    const tot = num(insp.hoevTotaal), geb = num(insp.hoevGebrek), kg = num(insp.kengetal);
    const omvang = (tot && geb != null) ? geb/tot : (num(insp.omvang) ?? null);
    const kostenElement = (tot != null && kg != null) ? tot*kg : null;
    const kostenLokaal = (geb != null && kg != null) ? geb*kg : null;
    const omslagEff = num(insp.omslagMaatregel) ?? num(P.omslagDefault) ?? 0.65;
    const begrotingswijze = omvang == null ? '' : (omvang >= omslagEff ? 'Integraal 100%' : 'Lokaal o.b.v. gebrek');
    const begrHoev = begrotingswijze === 'Integraal 100%' ? tot : geb;
    const eersteVoorstel = (begrHoev != null && kg != null) ? begrHoev*kg : null;
    const libE = libEntry(insp.nenCode);
    const oInfo = systeemvoorstelO(insp, omvang, true), oSys = oInfo.o, dSys = voorstelD(insp.inspecteerbaarheid);
    const [tKlSys, tJaarSys, tTxtSys] = voorstelT(insp.nenCode);
    const O = num(sp.O) ?? oSys, D = num(sp.D) ?? dSys;
    const Tklasse = sp.Tklasse || tKlSys;
    const Tjaar = num(sp.Tjaar) ?? (sp.Tklasse ? tJaarVanKlasse(sp.Tklasse) : tJaarSys);
    const effect = ASP.map((_, i) => num(sp.effect?.[i]) ?? (libE ? num(libE.effect[i]) : 0) ?? 0);
    const faalwijze = sp.faalwijze || libE?.faalwijze || '';
    const kostenSpec = num(sp.kostenSpecialist);
    const definitieveKosten = kostenSpec ?? eersteVoorstel;
    const Stech = Math.max(...effect), RPNtech = (O != null && D != null) ? Stech*O*D : null;
    const impact = effect.map((e, i) => e*fac[i]), Swaarde = Math.max(...impact);
    const RPNwaarde = (O != null && D != null) ? Swaarde*O*D : null;
    const basis = prioFromThresholds(R.rpn, RPNwaarde, 'P5');
    const iS = Math.max(0, ASP.indexOf(R.safetyAspect || 'Veiligheid')), iC = Math.max(0, ASP.indexOf(R.complianceAspect || 'Compliance'));
    const safety = prioFromThresholds(R.safety, effect[iS], '') || '';
    const compliance = prioFromThresholds(R.compliance, effect[iC], '') || '';
    const tPrio = prioT(Tjaar);
    const nenSignaal = (num(insp.conditie) ?? 0) >= (num(P.nenSignaal) ?? 5) ? 'Technische toestand vraagt expliciete beoordeling' : '';
    const cand = [basis, safety, compliance, tPrio].filter(Boolean);
    const prio = PRIOS.find(p => cand.includes(p)) || null;
    const off = prio ? R.laatsteJaar[prio] : null; const laatsteJaar = off == null ? null : start + off;
    const deadline = Tjaar == null ? null : start + Math.ceil(Tjaar);
    const domTech = ASP[effect.indexOf(Stech)], domWaarde = Swaarde === 0 ? 'Geen waarde-impact' : ASP[impact.indexOf(Swaarde)];
    const compleet = faalwijze && O != null && D != null && Tjaar != null;
    const bronnen = Object.values(sp.prov||{}).map(p=>p.bron);
    const aiStatus = bronnen.includes('mens') ? 'Mens gecontroleerd' : bronnen.includes('ai') ? 'AI ingevuld' : bronnen.includes('excel') ? 'Uit Excel' : 'Systeemvoorstel';
    const r = { id: insp.id, insp, sp, bes, libE, omvang, kostenElement, kostenLokaal, omslagEff, begrotingswijze, begrHoev, eersteVoorstel,
      oSys, oInfo, dSys, tKlSys, tJaarSys, tTxtSys, O, D, Tklasse, Tjaar, effect, faalwijze, kostenSpec, definitieveKosten,
      kostenbron: kostenSpec != null ? 'Technisch specialist' : 'Inspectie/softwarevoorstel',
      Stech, RPNtech, impact, Swaarde, RPNwaarde, basis, safety, compliance, tPrio, nenSignaal, prio, laatsteJaar, deadline, domTech, domWaarde,
      status: compleet ? 'Compleet' : 'Aanvullen', aiStatus,
      drivers: [basis===prio&&'RPN', safety===prio&&'Safety', compliance===prio&&'Compliance', tPrio===prio&&'Tijd'].filter(Boolean) };
    r.maatregelen = maatregelenVan(r).map(m => ({...m, jaren: expandCyclus(m, jaren)}));
    r.planJaar = r.maatregelen[0]?.jaar ?? null;
    r.kostenHorizon = r.maatregelen.reduce((s,m)=> s + (m.kosten??0)*m.jaren.length, 0);
    rows.push(r);
  }
  const perJaar = jaren.map(j => rows.reduce((s, r) => s + r.maatregelen.reduce((t,m)=> t + (m.jaren.includes(j) ? (m.kosten??0) : 0), 0), 0));
  calc = { rows, bel, fac, jaren, perJaar, totaal: perJaar.reduce((a,b)=>a+b,0), start };
  return calc;
}

// ---------- OpenRouter ----------
function modelFor(taak) { return (cfg.models && cfg.models[taak]) || cfg.model; }
async function callAgent(messages, json=true, opts={}) {
  const tok = window.STEMI_DB ? await window.STEMI_DB.token() : null;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 240000);
  let r, d;
  try {
    r = await fetch('/api/analyze', { method:'POST', signal: ctrl.signal, headers:{'Content-Type':'application/json', ...(cfg.apiKey?{'x-openrouter-key':cfg.apiKey}:{}), ...(tok?{'Authorization':'Bearer '+tok}:{})}, body: JSON.stringify({ model: opts.model||modelFor(opts.taak||'specialist'), messages, json, max_tokens: opts.max_tokens||16000 }) });
    const txt = await r.text(); try { d = JSON.parse(txt); } catch { d = { error: (r.status===504?'Time-out op de server (model te traag)':'Onverwacht antwoord '+r.status) + ': ' + txt.slice(0,200) }; }
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'Time-out: het model antwoordde niet binnen 4 minuten' : 'Netwerkfout: ' + e.message); }
  finally { clearTimeout(t); }
  if (!r.ok) throw new Error(d.error || 'Fout ' + r.status); return d;
}
function parseJSON(text) { try { return JSON.parse(text); } catch {} const m = String(text).match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch {} } throw new Error('Agent gaf geen geldige JSON terug'); }

// ---------- init ----------
async function loadData() {
  const loadLib = async () => { const buf = await (await fetch('/data/bibliotheek.min.json.gz')).arrayBuffer(); const u = new Uint8Array(buf);
    if (u[0] === 0x1f && u[1] === 0x8b) return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
    return JSON.parse(new TextDecoder().decode(u)); };
  const [S, L] = await Promise.all([fetch('/data/seed.json').then(r=>r.json()), loadLib()]);
  seed = S;
  const ERN = {E:'Ernstig',S:'Serieus',G:'Gering'}, VERT = {L:'Laag',M:'Middel',H:'Hoog'};
  lib = L.rows.map(r => ({ code:r[0], bouwdeel:L.bd[r[1]], ernst:ERN[r[2]]||r[2], gebreksoort:L.gs[r[3]], omschrijving:L.om[r[4]],
    faalwijze: r[5] >= 0 ? L.fw[r[5]] : 'Technische prestatie kan afnemen door: ' + L.om[r[4]].split(':')[0], effect: r[6].split('').map(Number), vertrouwen: VERT[r[7]]||r[7] }));
  lib.forEach(e => libByCode[e.code] = e);
  try { cfg = JSON.parse(localStorage.getItem(LS_CFG)); } catch {}
  cfg = Object.assign({ apiKey:'', model: MODELS[0], models:{}, context:'', showSys:true, mjopJaren:15, autoAI:true }, cfg||{});
}
/** state uit een dossier (Supabase) of leeg */
function syncAspects() {
  const A = state.settings.aspecten; ASP.length = 0; ASP_SHORT.length = 0;
  A.forEach(a => { ASP.push(a.naam); ASP_SHORT.push(a.kort || a.naam.slice(0,5)); });
}
/** waardeaspect toevoegen: alle afhankelijke arrays (profielen, minimum, S-scorekaart) meegroeien */
function addAspect(naam, kort, omschrijving) {
  const S = state.settings; if (S.aspecten.some(a => a.naam === naam)) return false;
  S.aspecten.push({ naam, kort: kort || naam.slice(0,5), omschrijving: omschrijving || '' });
  Object.values(S.profielen).forEach(p => p.push(3)); S.params.minimum.push(0);
  S.scorekaarten.S.forEach(s => s.aspecten.push(''));
  syncAspects(); return true;
}
function removeAspect(i) {
  const S = state.settings; if (S.aspecten.length <= 1) return false;
  S.aspecten.splice(i, 1); Object.values(S.profielen).forEach(p => p.splice(i, 1)); S.params.minimum.splice(i, 1);
  S.scorekaarten.S.forEach(s => s.aspecten.splice(i, 1)); state.specialist.forEach(sp => { if (Array.isArray(sp.effect) && sp.effect.length > i) sp.effect.splice(i, 1); });
  Object.values(state.ai || {}).forEach(a => { if (Array.isArray(a.effect) && a.effect.length > i) a.effect.splice(i, 1); });
  syncAspects(); return true;
}
function migrateSettings(S) {
  if (!S.aspecten) S.aspecten = clone(seed.aspecten);
  if (!S.rules.oVoorstel.ontwikkeling) { S.rules.oVoorstel = defaultRules().oVoorstel; S.rules.dVoorstel = defaultRules().dVoorstel; }
  if (!S.rules.safetyAspect) { S.rules.safetyAspect = 'Veiligheid'; S.rules.complianceAspect = 'Compliance'; }
  if (!S.scorekaarten.O[0].omschrijving) { S.scorekaarten.O = clone(seed.scorekaarten.O); S.scorekaarten.Odefinitie = seed.scorekaarten.Odefinitie; }
  if (!S.scorekaarten.D[0].criterium || S.scorekaarten.D.length !== 10 || !S.scorekaarten.Ddefinitie) { S.scorekaarten.D = clone(seed.scorekaarten.D); S.scorekaarten.Ddefinitie = seed.scorekaarten.Ddefinitie; }
  if (!S.scorekaarten.belangSchaal) S.scorekaarten.belangSchaal = clone(seed.scorekaarten.belangSchaal);
}
function setState(st) {
  state = st && st.inspectie ? st : emptyState();
  if (!state.settings) state.settings = defaultSettings(seed); if (!state.settings.rules) state.settings.rules = defaultRules();
  migrateSettings(state.settings); syncAspects();
  state.maatregelen = state.maatregelen || []; state.audit = state.audit || []; state.ai = state.ai || {}; state.besluiten = state.besluiten || []; state.specialist = state.specialist || [];
}
function applySharedCfg(v) { if (v) cfg = Object.assign(cfg, v); }
function resetState() { state = emptyState(); save(); }

return { ASP, ASP_SHORT, ONTWIKKELING, INTENSITEIT, ERNST, INSPECTEERBAAR, PRIOS, MODELS, SP_NUM, SP_FIELDS, syncAspects, addAspect, removeAspect, oKlasse, dKlasse,
  $, $$, esc, num, eur, pct, pill, uid, toast, clone, defaultRules, defaultSettings,
  get seed(){return seed}, get lib(){return lib}, get libByCode(){return libByCode}, get state(){return state}, set state(v){state=v}, get cfg(){return cfg}, get calc(){return calc},
  save, saveCfg, audit, getSp, setSp, belangen, libEntry, systeemvoorstelO, voorstelD, voorstelDtekst, voorstelT, tJaarVanKlasse, OKANS, DTEKST,
  maatregelenVan, expandCyclus, recompute, callAgent, modelFor, parseJSON, loadData, resetState, emptyState, setState, applySharedCfg, migrateV1 };
})();
