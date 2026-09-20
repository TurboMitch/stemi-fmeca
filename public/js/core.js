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
/* financiele standaardparameters: worden via migrateSettings ook aan bestaande projecten toegevoegd */
const FIN_DEFAULT = { prijspeil: 2026, inflatie: 0.03, inflatiePerJaar: {}, btwPercentage: 21, btwWeergave: 'excl', discontovoet: 0.025, budgetplafond: null, budgetplafondPerJaar: {} };
const WEERGAVEN = [['prijspeil','Prijspeil (excl. btw)'],['index','Geindexeerd naar uitvoeringsjaar'],['btw','Geindexeerd incl. btw'],['npv','Contante waarde (NPV)']];
const SP_FIELDS = ['faalwijze','O','onderbouwingO','D','onderbouwingD','Tklasse','Tjaar','onderbouwingT','effect','onderbouwingEffect','maatregel','restS','restO','restD','restToelichting','kostenSpecialist','onderbouwingKosten','scopeOverride','onderbouwingScope','aanvullendOnderzoek'];

// ---------- helpers ----------
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = v => (v === '' || v === null || v === undefined || isNaN(+v)) ? null : +v;
const eur = v => v == null ? '' : new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const pct = v => v == null ? '' : Math.round(v*100) + '%';
/** percentage met een decimaal: 0,025 → 2,5% (inflatie en discontovoet zijn te fijn voor hele procenten) */
const pct1 = v => v == null || v === '' || isNaN(+v) ? '' : (Math.round(v*1000)/10).toString().replace('.',',') + '%';
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
    tRegels: {
      actief: true,
      levensduur: clone(seed?.levensduur || {}), levensduurDefault: 30,
      curve: clone(seed?.degradatiecurve || {}), curveDefault: 'lineair',
      intensiteitFractie: {'Beginstadium':0.15,'Duidelijk waarneembaar':0.40,'Gevorderd':0.70,'Eindstadium':0.95},
      ontwikkelingSnelheid: {'Stabiel':0.6,'Langzaam':1,'Progressief':1.6,'Snel / actief':2.5},
      ernstFactor: {'Ernstig':0.6,'Serieus':1,'Gering':1.5},
      omvangFactor: [{min:0.5,factor:0.8},{min:0.2,factor:0.9}],
      conditieFractie: {1:0.05,2:0.20,3:0.40,4:0.60,5:0.80,6:0.95},
      gebruikConditie: true, herstelNiveau: {vervangen:1, herstellen:2, reinigen:-1}
    },
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
  return { versie:2, project: { klant:'', object:'', adres:'', status:'nieuw', omschrijving:'' }, settings: defaultSettings(seed), inspectie: clone(seed.inspectie), raw: null, specialist: clone(seed.specialist).map(s=>({...s, prov: Object.fromEntries(SP_FIELDS.filter(k=>s[k]!=null&&s[k]!=='').map(k=>[k,{bron:'excel',ts:'2026-09-16'}]))})), besluiten: clone(seed.besluiten), maatregelen: [], scenarios: [], ai: {}, audit: [] };
}
function migrateV1(old) {
  const st = emptyState();
  st.settings.params = Object.assign(st.settings.params, old.params||{});
  if (old.profielen) st.settings.profielen = old.profielen;
  st.inspectie = old.inspectie||[]; st.specialist = (old.specialist||[]).map(s=>({...s, prov: s.prov||{}})); st.besluiten = old.besluiten||[]; st.ai = old.ai||{};
  return st;
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch{} if (window.STEMI_DB) window.STEMI_DB.persist(state); }
function saveCfg() { try { localStorage.setItem(LS_CFG, JSON.stringify(cfg)); } catch{} if (window.STEMI_DB) window.STEMI_DB.setShared(cfg).catch(e=>console.warn(e)); }
function audit(entry) { const e = {ts:new Date().toISOString(), user: window.STEMI_DB?.profile?.username, ...entry}; state.audit.unshift(e); if (state.audit.length>300) state.audit.length=300; /* volledige trail staat in audit_log */ if (window.STEMI_DB) window.STEMI_DB.logAudit(e); }
function getSp(id) { let sp = state.specialist.find(x=>x.id===id); if(!sp){ sp={id,effect:[],prov:{}}; state.specialist.push(sp);} sp.prov = sp.prov||{}; return sp; }
/** zet een specialistveld met herkomst; logt in audit */
function setSp(id, k, v, bron, meta={}) {
  const sp = getSp(id); const old = k.startsWith('effect') && k!=='effect' ? (sp.effect||[])[+k.slice(6)] : sp[k];
  if (k.startsWith('effect') && k!=='effect') { sp.effect = sp.effect||[]; sp.effect[+k.slice(6)] = num(v); }
  else if (k==='effect') sp.effect = (v||[]).map(num);
  else if (SP_NUM.includes(k)) sp[k] = num(v);
  else sp[k] = v ?? '';
  const key = k.startsWith('effect') ? 'effect' : k;
  const vorige = sp.prov[key] ? sp.prov[key].bron : (old==null||old===''? 'systeem' : undefined);
  sp.prov[key] = { bron, ts: new Date().toISOString(), vorige, ...meta };
  audit({ regel:id, veld:k, oud: old, nieuw: v, bron, vorige, ...meta });
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
// ---------- T-bepaling: restlevensduur per bouwdeelcategorie ----------
/** vormfactor van de degradatiecurve: hoeveel van de levensduur rest bij degradatiegraad d */
function curveFactor(vorm, d) {
  const r = Math.max(0, 1 - d);
  return vorm === 'progressief' ? r * r : vorm === 'degressief' ? Math.sqrt(r) : r;   // progressief = versnelt, degressief = vertraagt
}
/** klasse die bij een aantal jaren hoort (eerste klasse waarvan de jaargrens niet lager is) */
function tKlasseVanJaar(j) {
  if (j == null) return 'Onbekend';
  const K = state.settings.rules.tKlassen.slice().sort((a,b)=>a.jaar-b.jaar);
  return (K.find(k => j <= k.jaar) || K[K.length-1])?.klasse || 'Onbekend';
}
/** Bepaalt het faalmoment T in jaren uit de restlevensduur van de bouwdeelcategorie.
 *  T = levensduur x curvefactor(degradatiegraad) / ontwikkelsnelheid x ernstfactor x omvangfactor.
 *  Degradatiegraad komt uit de NEN-intensiteit, met de conditiescore als kruiscontrole (verst gevorderde wint).
 *  Een expliciete regel per gebrekcode (tPerCode) gaat altijd voor. */
function bepaalT(insp, libE, omvang) {
  const R = state.settings.rules, T = R.tRegels || {}, horizon = num(state.settings.params.horizon) ?? 40;
  const code = insp.nenCode, vast = code ? R.tPerCode[code] : null;
  if (vast) return { jaar: vast.jaar, klasse: vast.klasse, bron: 'code', uitleg: vast.tekst || `Vaste regel voor gebrekcode ${code}.`, delen: [] };
  if (!T.actief) return { jaar: null, klasse: 'Onbekend', bron: 'onbekend', uitleg: 'T-model staat uit; de specialist bepaalt T.', delen: [] };
  const bouwdeel = libE?.bouwdeel || insp.bouwdeel || '';
  const L = num(T.levensduur?.[bouwdeel]) ?? num(T.levensduurDefault);
  const fI = insp.intensiteit ? num(T.intensiteitFractie?.[insp.intensiteit]) : null;
  const c = num(insp.conditie);
  const fC = (T.gebruikConditie && c != null) ? num(T.conditieFractie?.[c]) : null;
  if (L == null || (fI == null && fC == null)) return { jaar: null, klasse: 'Onbekend', bron: 'onbekend',
    uitleg: `Onvoldoende basis voor T: ${L == null ? 'geen levensduur voor bouwdeel “' + (bouwdeel||'onbekend') + '”' : 'geen intensiteit en geen conditiescore'}. De specialist bepaalt T.`, delen: [] };
  const d = Math.max(fI ?? 0, fC ?? 0);
  const vorm = T.curve?.[bouwdeel] || T.curveDefault || 'lineair';
  const f = curveFactor(vorm, d);
  const s = (insp.ontwikkelingKlasse ? num(T.ontwikkelingSnelheid?.[insp.ontwikkelingKlasse]) : null) ?? 1;
  const e = (insp.ernst ? num(T.ernstFactor?.[insp.ernst]) : null) ?? 1;
  const ov = num(omvang); const ob = ov == null ? null : (T.omvangFactor||[]).slice().sort((a,b)=>b.min-a.min).find(x => ov >= x.min);
  const of_ = ob ? ob.factor : 1;
  const ruw = Math.max(0, L * f / (s || 1) * e * of_);
  // een gunstige ontwikkeling of geringe ernst mag T nooit boven de resterende technische levensduur tillen
  const plafondRest = L * Math.max(0, 1 - d);
  const jaar = Math.round(Math.min(ruw, plafondRest) * 10) / 10;
  const begrensd = Math.min(jaar, horizon);
  const delen = [
    `levensduur ${bouwdeel || 'onbekend'} ${L} jr`,
    `degradatie ${Math.round(d*100)}% (${fI != null && (fI >= (fC ?? 0)) ? `intensiteit '${insp.intensiteit}'` : `conditie ${c}`})`,
    `curve ${vorm} → restfactor ${Math.round(f*100)/100}`,
    `ontwikkeling ${insp.ontwikkelingKlasse || 'onbekend'} ÷ ${s}`,
    `ernst ${insp.ernst || 'onbekend'} × ${e}`,
    ...(of_ !== 1 ? [`omvang ${pct(ov)} × ${of_}`] : []),
    ...(ruw > plafondRest + 0.05 ? [`begrensd op de resterende technische levensduur ${Math.round(plafondRest*10)/10} jr`] : [])
  ];
  return { jaar: begrensd, klasse: tKlasseVanJaar(begrensd), bron: 'model', L, d, vorm,
    uitleg: delen.join(' · ') + ` = ${begrensd} jaar${begrensd !== jaar ? ` (afgekapt op de horizon van ${horizon} jaar)` : ''}`, delen };
}
/** oude signatuur bleef in gebruik voor losse gebrekcodes zonder inspectiegegevens */
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

// ---------- indexering, btw en contante waarde ----------
/** inflatievoet voor een jaar: een eigen waarde per jaar gaat voor de algemene voet */
function inflatieVan(j) { const o = state.settings.params.inflatiePerJaar?.[j]; const v = num(o); return v == null ? (num(state.settings.params.inflatie) ?? 0) : v; }
/** indexfactor van prijspeil naar uitvoeringsjaar; samengesteld, per jaar de dan geldende voet */
function indexFactor(jaar) {
  const P = state.settings.params, pp = num(P.prijspeil) ?? num(P.startjaar) ?? 2026;
  if (jaar == null) return 1; let f = 1;
  if (jaar >= pp) { for (let j = pp + 1; j <= jaar; j++) f *= 1 + inflatieVan(j); }
  else { for (let j = jaar + 1; j <= pp; j++) f /= 1 + inflatieVan(j); }
  return f;
}
const btwFactor = () => 1 + (num(state.settings.params.btwPercentage) ?? 0) / 100;
/** contantefactor: een uitgave in jaar j teruggerekend naar het startjaar tegen de discontovoet */
function npvFactor(jaar) { const P = state.settings.params; return jaar == null ? 1 : 1 / Math.pow(1 + (num(P.discontovoet) ?? 0), jaar - (num(P.startjaar) ?? 2026)); }
/** een bedrag op prijspeil omrekenen naar de gevraagde weergave in het uitvoeringsjaar */
function bedrag(k, jaar, weergave) {
  if (k == null) return null; const w = weergave || weergaveDefault(); if (w === 'prijspeil') return k;
  const g = k * indexFactor(jaar); if (w === 'index') return g;
  const b = g * btwFactor(); if (w === 'btw') return b;
  if (w === 'npv') return (state.settings.params.btwWeergave === 'incl' ? b : g) * npvFactor(jaar);
  return g;
}
const weergaveDefault = () => state.settings.params.btwWeergave === 'incl' ? 'btw' : 'index';

/** som van de geindexeerde uitgaven in een jaar */
const somJaar = (posten, j) => posten.reduce((s, p) => s + (p.jaar === j ? p.kosten * indexFactor(j) : 0), 0);
/** schuift posten een jaar op tot elk jaar binnen zijn plafond past; laagste risico eerst.
 *  Cyclische posten blijven staan: die verschuiven zou de hele cyclus verplaatsen. */
function schuifBinnenPlafond(posten, plafondVan, maxSchuif, jaren) {
  const laatste = jaren[jaren.length - 1];
  for (const j of jaren) {
    const cap = plafondVan(j); if (cap == null) continue; let guard = 0;
    while (somJaar(posten, j) > cap && guard++ < 2000) {
      const kand = posten.filter(p => p.jaar === j && !p.cyclisch && p.jaar - p.origineelJaar < maxSchuif && p.jaar < laatste)
        .sort((a, b) => (b.prioN - a.prioN) || (a.rpn - b.rpn) || (b.kosten - a.kosten));
      if (!kand.length) break; kand[0].jaar = j + 1;
    }
  }
  return posten;
}
/** Budgetsturing: schuift handelingen naar later tot elk jaar binnen het plafond past.
 *  Laagste risico schuift eerst (hoogste prio-nummer, dan laagste RPN-waarde, dan hoogste bedrag).
 *  Cyclische handelingen blijven staan: die verschuiven zou de hele cyclus verplaatsen.
 *  Vergelijkt tegen het geindexeerde bedrag, want een plafond is een budget in het jaar zelf. */
function budgetPlan(opts = {}) {
  const P = state.settings.params, jaren = calc.jaren, laatste = jaren[jaren.length - 1];
  const perJaarPlafond = opts.perJaar || P.budgetplafondPerJaar || {};
  const algemeen = opts.plafond === undefined ? num(P.budgetplafond) : num(opts.plafond);
  const plafondVan = j => { const o = num(perJaarPlafond[j]); const v = o == null ? algemeen : o; return v == null || v <= 0 ? null : v; };
  const maxSchuif = opts.maxSchuif ?? 10;
  const posten = [];
  calc.rows.forEach(r => r.maatregelen.forEach(m => m.jaren.forEach((j, k) => posten.push({
    regel: r.id, element: r.insp.element, handeling: m.handeling || '', maatregelId: m.id, auto: !!m.auto,
    cyclisch: !!(m.cyclus && m.cyclus > 0), eerste: k === 0, jaar: j, origineelJaar: j, kosten: m.kosten ?? 0,
    prio: r.prio, prioN: (PRIOS.indexOf(r.prio) + 1) || 9, rpn: r.RPNwaarde ?? 0, laatsteJaar: r.laatsteJaar, deadline: r.deadline }))));
  schuifBinnenPlafond(posten, plafondVan, maxSchuif, jaren);
  const shifts = posten.filter(p => p.jaar !== p.origineelJaar).map(p => ({ ...p,
    voorbijLaatsteJaar: p.laatsteJaar != null && p.jaar > p.laatsteJaar,
    voorbijDeadline: p.deadline != null && p.jaar > p.deadline }));
  const perJaar = jaren.map(j => somJaar(posten, j));
  const nietOplosbaar = jaren.map((j, i) => { const c = plafondVan(j); return c != null && perJaar[i] > c + 0.5 ? { jaar: j, bedrag: perJaar[i], plafond: c } : null; }).filter(Boolean);
  const risico = { geschoven: shifts.length, bedrag: shifts.reduce((s, p) => s + p.kosten, 0),
    voorbijLaatsteJaar: shifts.filter(s => s.voorbijLaatsteJaar).length, voorbijDeadline: shifts.filter(s => s.voorbijDeadline).length,
    perPrio: PRIOS.map(p => ({ prio: p, n: shifts.filter(s => s.prio === p).length, buiten: shifts.filter(s => s.prio === p && s.voorbijLaatsteJaar).length })).filter(x => x.n),
    nietOplosbaar };
  return { shifts, perJaar, jaren, risico, plafondVan };
}
/** schuifvoorstel vastleggen in de handelingen; automatische handelingen worden eerst een eigen record */
function pasBudgetToe(plan) {
  let n = 0;
  for (const s of plan.shifts) {
    const r = calc.rows.find(x => x.id === s.regel); if (!r) continue;
    let m = state.maatregelen.find(x => x.id === s.maatregelId);
    if (!m) { const a = r.maatregelen.find(x => x.id === s.maatregelId) || r.maatregelen[0]; m = { id: uid(), regelId: r.id, handeling: a.handeling, jaar: a.jaar, kosten: a.kosten, cyclus: a.cyclus ?? null, tot: a.tot ?? null }; state.maatregelen.push(m); }
    const oud = m.jaar; m.jaar = s.jaar; m.bron = 'budgetsturing';
    audit({ regel: r.id, veld: 'mjop.jaar', oud, nieuw: s.jaar, bron: 'systeem', opmerking: `budgetsturing: geschoven van ${s.origineelJaar} naar ${s.jaar}` + (s.voorbijLaatsteJaar ? ` (voorbij laatste acceptabele jaar ${s.laatsteJaar})` : '') });
    n++;
  }
  if (n) save(); return n;
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
    const tInfo = bepaalT(insp, libE, omvang), tKlSys = tInfo.klasse, tJaarSys = tInfo.jaar, tTxtSys = tInfo.uitleg;
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
      oSys, oInfo, dSys, tKlSys, tJaarSys, tTxtSys, tInfo, O, D, Tklasse, Tjaar, effect, faalwijze, kostenSpec, definitieveKosten,
      kostenbron: kostenSpec != null ? 'Technisch specialist' : 'Inspectie/softwarevoorstel',
      Stech, RPNtech, impact, Swaarde, RPNwaarde, basis, safety, compliance, tPrio, nenSignaal, prio, laatsteJaar, deadline, domTech, domWaarde,
      status: compleet ? 'Compleet' : 'Aanvullen', aiStatus,
      drivers: [basis===prio&&'RPN', safety===prio&&'Safety', compliance===prio&&'Compliance', tPrio===prio&&'Tijd'].filter(Boolean) };
    r.maatregelen = maatregelenVan(r).map(m => ({...m, jaren: expandCyclus(m, jaren)}));
    r.planJaar = r.maatregelen[0]?.jaar ?? null;
    r.kostenHorizon = r.maatregelen.reduce((s,m)=> s + (m.kosten??0)*m.jaren.length, 0);
    r.kostenHorizonIndex = r.maatregelen.reduce((s,m)=> s + m.jaren.reduce((t,j)=> t + (m.kosten??0)*indexFactor(j), 0), 0);
    rows.push(r);
  }
  const perJaar = jaren.map(j => rows.reduce((s, r) => s + r.maatregelen.reduce((t,m)=> t + (m.jaren.includes(j) ? (m.kosten??0) : 0), 0), 0));
  // indexering, btw en contante waarde: binnen een jaar geldt voor elk bedrag dezelfde factor
  const idx = {}, npv = {}; jaren.forEach(j => { idx[j] = indexFactor(j); npv[j] = npvFactor(j); });
  const btwF = btwFactor(), inclBtw = P.btwWeergave === 'incl';
  const perJaarIndex = jaren.map((j,i) => perJaar[i] * idx[j]);
  const perJaarBtw = perJaarIndex.map(v => v * btwF);
  const perJaarNpv = jaren.map((j,i) => (inclBtw ? perJaarBtw[i] : perJaarIndex[i]) * npv[j]);
  const som = a => a.reduce((x,y)=>x+y,0);
  const series = { prijspeil: perJaar, index: perJaarIndex, btw: perJaarBtw, npv: perJaarNpv };
  calc = { rows, bel, fac, jaren, perJaar, perJaarIndex, perJaarBtw, perJaarNpv, series, idx, npv, btwF, inclBtw,
    serieVan: w => series[w] || perJaarIndex, weergave: weergaveDefault(),
    totaal: som(perJaar), totaalIndex: som(perJaarIndex), totaalBtw: som(perJaarBtw), totaalNpv: som(perJaarNpv),
    totaalVan: w => som(series[w] || perJaarIndex), start, prijspeil: num(P.prijspeil) ?? start };
  return calc;
}

// ---------- conditieprognose (NEN 2767 over de horizon) ----------
/** herstelniveau uit de tekst van een handeling: vervangen → conditie 1, herstellen → 2, reinigen/conserveren → een stap beter */
function herstelEffect(handeling, huidig) {
  const hn = state.settings.rules.tRegels?.herstelNiveau || { vervangen: 1, herstellen: 2, reinigen: -1 };
  const t = String(handeling || '').toLowerCase();
  if (/vervang|renov|nieuw aanbrengen|volledig/.test(t)) return { c: hn.vervangen ?? 1, soort: 'vervangen' };
  if (/herstel|repar|dicht|vastzet|aanhel/.test(t)) return { c: hn.herstellen ?? 2, soort: 'herstellen' };
  if (/reinig|conserv|schilder|onderhoud|smeer|inspect/.test(t)) return { c: Math.max(1, huidig + (hn.reinigen ?? -1)), soort: 'reinigen/conserveren' };
  return { c: Math.max(1, huidig + (hn.reinigen ?? -1)), soort: 'onbekende handeling' };
}
/** restjaren tot conditie 6 vanuit een conditiescore, via de degradatiecurve van het bouwdeel */
function restjarenVan(c, L, vorm) {
  const F = state.settings.rules.tRegels?.conditieFractie || {};
  const d = num(F[Math.max(1, Math.min(6, Math.round(c)))]) ?? Math.max(0, (c - 1) / 5);
  return Math.max(0, (L ?? 30) * curveFactor(vorm || 'lineair', d));
}
/** Conditieprognose per jaar, met en zonder de geplande handelingen.
 *  Per regel: conditie loopt lineair naar 6 op het faalmoment T; een handeling zet de conditie terug
 *  en daarna begint de degradatie opnieuw vanuit die conditie (over de levensduur van het bouwdeel).
 *  opts.posten: eigen lijst {regel, jaar, handeling} (voor scenario's); standaard de geplande handelingen. */
function conditiePrognose(opts = {}) {
  const jaren = calc.jaren, start = calc.start, Rg = state.settings.rules.tRegels || {};
  const posten = opts.posten || calc.rows.flatMap(r => r.maatregelen.flatMap(m => m.jaren.map(j => ({ regel: r.id, jaar: j, handeling: m.handeling }))));
  const perRegel = {}; posten.forEach(p => { (perRegel[p.regel] = perRegel[p.regel] || []).push(p); });
  const stap = (c, rest) => rest <= 0 ? 6 : Math.min(6, c + (6 - c) / rest);
  const rijen = calc.rows.map(r => {
    const L = r.tInfo?.L ?? num(Rg.levensduurDefault) ?? 30, vorm = r.tInfo?.vorm || Rg.curveDefault || 'lineair';
    const nu = num(r.insp.conditie) ?? Math.max(1, Math.min(6, Math.round(1 + 5 * (r.tInfo?.d ?? 0.2))));
    const T = r.Tjaar != null ? r.Tjaar : restjarenVan(nu, L, vorm);
    const eigen = (perRegel[r.id] || []).slice().sort((a, b) => a.jaar - b.jaar);
    const zonder = [], met = [];
    let cZ = nu, rZ = T, cM = nu, rM = T;
    for (const j of jaren) {
      const ing = eigen.find(p => p.jaar === j);
      if (ing) { const h = herstelEffect(ing.handeling, cM); cM = h.c; rM = restjarenVan(cM, L, vorm); }
      zonder.push(Math.round(cZ * 10) / 10); met.push(Math.round(cM * 10) / 10);
      cZ = stap(cZ, rZ); rZ = Math.max(0, rZ - 1); cM = stap(cM, rM); rM = Math.max(0, rM - 1);
    }
    return { id: r.id, element: r.insp.element, prio: r.prio, nu, T, L, vorm, gewicht: num(r.insp.hoevTotaal) || 1, zonder, met };
  });
  const gewichtTotaal = rijen.reduce((a, x) => a + x.gewicht, 0) || 1;
  const gem = k => jaren.map((_, i) => rijen.reduce((a, x) => a + x[k][i] * x.gewicht, 0) / gewichtTotaal);
  const aantalVanaf = (k, grens) => jaren.map((_, i) => rijen.filter(x => x[k][i] >= grens).length);
  return { jaren, rijen, gemMet: gem('met'), gemZonder: gem('zonder'),
    slechtMet: aantalVanaf('met', 5), slechtZonder: aantalVanaf('zonder', 5),
    kritiekMet: aantalVanaf('met', 5.5), gewogen: rijen.some(x => x.gewicht !== 1) };
}

// ---------- onderhoudsscenario's ----------
const SCENARIO_STRATEGIE = [['gepland','Zoals nu gepland'],['laatste','Alles naar het laatste acceptabele jaar'],['deadline','Alles naar de technische deadline (T)']];
/** Rekent een scenario door zonder de projectdata te wijzigen: welke prioriteiten uitvoeren,
 *  wanneer, en binnen welk jaarplafond. Geeft kosten, risicogevolg en conditiebeeld terug. */
function evalueerScenario(def = {}) {
  const jaren = calc.jaren, P = state.settings.params;
  const prios = (def.prios && def.prios.length) ? def.prios : null;
  const plafond = num(def.plafond), maxSchuif = def.maxSchuif ?? 10;
  const posten = [], niet = [];
  calc.rows.forEach(r => {
    const doen = !prios || (r.prio && prios.includes(r.prio));
    r.maatregelen.forEach(m => {
      if (!doen) { niet.push({ regel: r.id, element: r.insp.element, prio: r.prio, kosten: (m.kosten ?? 0) * Math.max(1, m.jaren.length), rpn: r.RPNwaarde ?? 0 }); return; }
      const basis = def.strategie === 'laatste' ? (r.laatsteJaar ?? m.jaar) : def.strategie === 'deadline' ? (r.deadline ?? m.jaar) : m.jaar;
      const vm = { ...m, jaar: basis };
      const jrn = (m.cyclus && m.cyclus > 0) ? expandCyclus(vm, jaren) : (basis == null || !jaren.includes(basis) ? [] : [basis]);
      jrn.forEach((j, k) => posten.push({ regel: r.id, element: r.insp.element, handeling: m.handeling || '', maatregelId: m.id,
        cyclisch: !!(m.cyclus && m.cyclus > 0), eerste: k === 0, jaar: j, origineelJaar: j, kosten: m.kosten ?? 0, prio: r.prio,
        prioN: (PRIOS.indexOf(r.prio) + 1) || 9, rpn: r.RPNwaarde ?? 0, laatsteJaar: r.laatsteJaar, deadline: r.deadline }));
    });
  });
  const plafondVan = () => (plafond == null || plafond <= 0) ? null : plafond;
  if (plafond) schuifBinnenPlafond(posten, plafondVan, maxSchuif, jaren);
  const perJaar = jaren.map(j => posten.reduce((s, p) => s + (p.jaar === j ? p.kosten : 0), 0));
  const perJaarIndex = jaren.map((j, i) => perJaar[i] * (calc.idx[j] ?? 1));
  const perJaarNpv = jaren.map((j, i) => perJaarIndex[i] * (calc.inclBtw ? calc.btwF : 1) * (calc.npv[j] ?? 1));
  const som = a => a.reduce((x, y) => x + y, 0);
  const piekI = perJaarIndex.indexOf(Math.max(...perJaarIndex));
  // alleen de eerste uitvoering telt voor "te laat": een cyclusherhaling in 2060 is geen uitstel maar planmatig onderhoud
  const teLaat = posten.filter(p => p.eerste && p.laatsteJaar != null && p.jaar > p.laatsteJaar);
  const naDeadline = posten.filter(p => p.eerste && p.deadline != null && p.jaar > p.deadline);
  const pg = conditiePrognose({ posten });
  const bij = n => pg.gemMet[Math.min(n - 1, pg.gemMet.length - 1)];
  return { def, jaren, posten, perJaar, perJaarIndex, perJaarNpv,
    totaal: som(perJaar), totaalIndex: som(perJaarIndex), totaalNpv: som(perJaarNpv),
    piek: { jaar: jaren[piekI], bedrag: perJaarIndex[piekI] },
    bovenPlafond: plafond ? perJaarIndex.filter(v => v > plafond + 0.5).length : 0,
    teLaat: teLaat.length, naDeadline: naDeadline.length, geschoven: posten.filter(p => p.jaar !== p.origineelJaar).length,
    nietUitgevoerd: { n: niet.length, kosten: som(niet.map(x => x.kosten)), rpn: som(niet.map(x => x.rpn)) },
    conditie: { jaar5: bij(5), jaar10: bij(10), jaar15: bij(15), eind: pg.gemMet[pg.gemMet.length - 1],
      slecht15: pg.slechtMet[Math.min(14, pg.slechtMet.length - 1)], slechtEind: pg.slechtMet[pg.slechtMet.length - 1] },
    prognose: pg };
}
/** de jaren van een scenario vastleggen in de handelingen (zelfde route als de budgetsturing) */
function pasScenarioToe(res) {
  let n = 0;
  for (const p of res.posten) {
    if (p.jaar === p.origineelJaar && res.def.strategie === 'gepland' && !res.def.plafond) continue;
    const r = calc.rows.find(x => x.id === p.regel); if (!r) continue;
    let m = state.maatregelen.find(x => x.id === p.maatregelId);
    if (!m) { const a = r.maatregelen.find(x => x.id === p.maatregelId) || r.maatregelen[0]; m = { id: uid(), regelId: r.id, handeling: a.handeling, jaar: a.jaar, kosten: a.kosten, cyclus: a.cyclus ?? null, tot: a.tot ?? null }; state.maatregelen.push(m); }
    if (m.jaar === p.jaar) continue;
    const oud = m.jaar; m.jaar = p.jaar; m.bron = 'scenario';
    audit({ regel: r.id, veld: 'mjop.jaar', oud, nieuw: p.jaar, bron: 'systeem', opmerking: `scenario “${res.def.naam || ''}”: van ${oud} naar ${p.jaar}` });
    n++;
  }
  if (n) save(); return n;
}

// ---------- OpenRouter ----------
function modelFor(taak) { return (cfg.models && cfg.models[taak]) || cfg.model; }
/** tijdelijke fouten waarbij opnieuw proberen zin heeft (OpenRouter-credits/rate limit, overbelast model, 5xx) */
const HERKANSBAAR = /credit|rate limit|rate-limit|429|402|503|502|overloaded|temporarily|in-flight|too many/i;
async function callAgentOnce(messages, json, opts) {
  const tok = window.STEMI_DB ? await window.STEMI_DB.token() : null;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 240000);
  let r, d;
  try {
    r = await fetch('/api/analyze', { method:'POST', signal: ctrl.signal, headers:{'Content-Type':'application/json', ...(cfg.apiKey?{'x-openrouter-key':cfg.apiKey}:{}), ...(tok?{'Authorization':'Bearer '+tok}:{})}, body: JSON.stringify({ model: opts.model||modelFor(opts.taak||'specialist'), messages, json, max_tokens: opts.max_tokens||16000 }) });
    const txt = await r.text(); try { d = JSON.parse(txt); } catch { d = { error: (r.status===504?'Time-out op de server (model te traag)':'Onverwacht antwoord '+r.status) + ': ' + txt.slice(0,200) }; }
  } catch (e) { const err = new Error(e.name === 'AbortError' ? 'Time-out: het model antwoordde niet binnen 4 minuten' : 'Netwerkfout: ' + e.message); err.herkansbaar = e.name !== 'AbortError'; throw err; }
  finally { clearTimeout(t); }
  if (!r.ok) { const err = new Error(d.error || 'Fout ' + r.status); err.status = r.status; err.herkansbaar = r.status === 429 || r.status === 402 || r.status >= 500 || HERKANSBAAR.test(String(d.error||'')); throw err; }
  return d;
}
/** roept de agent aan met exponentiële backoff bij tijdelijke fouten (credits/rate limit/overbelast) */
async function callAgent(messages, json=true, opts={}) {
  const maxPogingen = opts.pogingen || 4; let laatste;
  for (let i = 0; i < maxPogingen; i++) {
    try { return await callAgentOnce(messages, json, opts); }
    catch (e) {
      laatste = e; if (!e.herkansbaar || i === maxPogingen - 1) break;
      const wacht = Math.round(2000 * Math.pow(2, i) * (0.75 + Math.random() * 0.5)); // 2s, 4s, 8s (+jitter)
      if (opts.onWacht) opts.onWacht(wacht, i + 1, e.message);
      await new Promise(res => setTimeout(res, wacht));
    }
  }
  laatste.message = (laatste.herkansbaar ? `na ${maxPogingen} pogingen: ` : '') + laatste.message;
  throw laatste;
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
  Object.entries(FIN_DEFAULT).forEach(([k,v]) => { if (S.params[k] === undefined) S.params[k] = clone(v); });
  if (!S.rules?.tRegels) { if (S.rules) S.rules.tRegels = defaultRules().tRegels; }
  else { const d = defaultRules().tRegels; Object.keys(d).forEach(k => { if (S.rules.tRegels[k] === undefined) S.rules.tRegels[k] = d[k]; }); if (!Object.keys(S.rules.tRegels.levensduur||{}).length) S.rules.tRegels.levensduur = d.levensduur; }
  if (S.params.prijspeil == null) S.params.prijspeil = S.params.startjaar;
  if (!S.rules.oVoorstel.ontwikkeling) { S.rules.oVoorstel = defaultRules().oVoorstel; S.rules.dVoorstel = defaultRules().dVoorstel; }
  if (!S.rules.safetyAspect) { S.rules.safetyAspect = 'Veiligheid'; S.rules.complianceAspect = 'Compliance'; }
  if (!S.scorekaarten.O[0].omschrijving) { S.scorekaarten.O = clone(seed.scorekaarten.O); S.scorekaarten.Odefinitie = seed.scorekaarten.Odefinitie; }
  if (!S.scorekaarten.D[0].criterium || S.scorekaarten.D.length !== 10 || !S.scorekaarten.Ddefinitie) { S.scorekaarten.D = clone(seed.scorekaarten.D); S.scorekaarten.Ddefinitie = seed.scorekaarten.Ddefinitie; }
  if (!S.scorekaarten.belangSchaal) S.scorekaarten.belangSchaal = clone(seed.scorekaarten.belangSchaal);
}
function setState(st) {
  state = st && st.inspectie ? st : emptyState(); state.project = state.project || { klant:'', object:'', adres:'', status:'actief', omschrijving:'' };
  if (!state.settings) state.settings = defaultSettings(seed); if (!state.settings.rules) state.settings.rules = defaultRules();
  migrateSettings(state.settings); syncAspects();
  state.maatregelen = state.maatregelen || []; state.scenarios = state.scenarios || []; state.audit = state.audit || []; state.ai = state.ai || {}; state.besluiten = state.besluiten || []; state.specialist = state.specialist || [];
}
/** Globale foutafhandeling: onverwachte fouten en afgewezen promises worden vastgelegd. */
function startFoutafhandeling() {
  const log = (bron, melding, details) => { try { window.STEMI_DB?.logFout(bron, melding, { soort: details?.soort, details }); } catch {} };
  window.addEventListener('error', e => { if (e.message) log('browser', e.message, { soort: 'error', bestand: e.filename, regel: e.lineno, kolom: e.colno, stack: e.error?.stack?.slice(0, 1500) }); });
  window.addEventListener('unhandledrejection', e => { const r = e.reason; log('browser', (r?.message || String(r)).slice(0, 500), { soort: 'unhandledrejection', stack: r?.stack?.slice(0, 1500) }); });
}
function applySharedCfg(v) { if (!v) return; const { apiKey, ...rest } = v; cfg = Object.assign(cfg, rest); if (apiKey) cfg.apiKey = apiKey; /* lege gedeelde sleutel mag een lokaal ingevulde sleutel niet wissen */ }
function resetState() { state = emptyState(); save(); }

return { ASP, ASP_SHORT, ONTWIKKELING, INTENSITEIT, ERNST, INSPECTEERBAAR, PRIOS, MODELS, SP_NUM, SP_FIELDS, syncAspects, addAspect, removeAspect, oKlasse, dKlasse,
  $, $$, esc, num, eur, pct, pct1, pill, uid, toast, clone, defaultRules, defaultSettings,
  get seed(){return seed}, get lib(){return lib}, get libByCode(){return libByCode}, get state(){return state}, set state(v){state=v}, get cfg(){return cfg}, get calc(){return calc},
  save, saveCfg, audit, getSp, setSp, belangen, libEntry, systeemvoorstelO, voorstelD, voorstelDtekst, voorstelT, tJaarVanKlasse, OKANS, DTEKST,
  maatregelenVan, expandCyclus, recompute, WEERGAVEN, FIN_DEFAULT, inflatieVan, indexFactor, btwFactor, npvFactor, bedrag, weergaveDefault, budgetPlan, pasBudgetToe,
  bepaalT, tKlasseVanJaar, curveFactor, restjarenVan, herstelEffect, conditiePrognose, evalueerScenario, pasScenarioToe, SCENARIO_STRATEGIE, startFoutafhandeling, callAgent, modelFor, parseJSON, loadData, resetState, emptyState, setState, applySharedCfg, migrateV1 };
})();
