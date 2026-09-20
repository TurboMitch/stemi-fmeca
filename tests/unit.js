/* Unit-tests zonder browser en zonder database: laadt de rekenkern en de voorbewerking in Node
   met minimale stubs. Geschikt voor CI — draait in enkele seconden.
   Uitvoeren: node tests/unit.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
let mislukt = 0;
const ok = (naam, cond, extra = '') => { if (!cond) mislukt++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${naam}${extra ? ' — ' + extra : ''}`); };
const bijna = (a, b, marge = 0.5) => a != null && Math.abs(a - b) <= marge;

// ---------- harness: minimale window/document/localStorage/fetch ----------
const seed = JSON.parse(fs.readFileSync(path.join(root, 'public/data/seed.json'), 'utf8'));
const bib = JSON.parse(require('zlib').gunzipSync(fs.readFileSync(path.join(root, 'public/data/bibliotheek.min.json.gz'))).toString());

const listeners = {};
const win = {
  addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { hostname: 'localhost', pathname: '/', hash: '' },
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, Math, JSON, Date, console, TextEncoder,
  fetch: async (u) => {
    if (String(u).includes('seed.json')) return { json: async () => seed, ok: true };
    // uitgepakt teruggeven: core.js valt dan terug op JSON.parse en heeft geen DecompressionStream nodig
    if (String(u).includes('bibliotheek')) return { arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(bib)).buffer };
    throw new Error('onverwachte fetch: ' + u);
  },
  DecompressionStream: undefined, TextDecoder,
};
win.window = win;
const doc = { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, createElement: () => ({ style: {}, classList: { add(){}, remove(){}, toggle(){} }, appendChild(){}, setAttribute(){} }), body: { appendChild(){} } };
const ctx = vm.createContext({ ...win, document: doc, globalThis: win, Response: class {}, AbortController: class { constructor(){ this.signal = {}; } abort(){} } });
ctx.window = ctx; ctx.globalThis = ctx;

const laad = f => vm.runInContext(fs.readFileSync(path.join(root, 'public/js', f), 'utf8'), ctx, { filename: f });
laad('core.js'); laad('prep.js'); laad('ui-mjop.js'); laad('ui-rapport.js');
const C = ctx.STEMI, P = ctx.STEMI_PREP;
ok('core.js en prep.js laden in Node', !!C && !!P);

// bibliotheek en seed handmatig injecteren (loadData gebruikt fetch/DecompressionStream)
(async () => {
  await C.loadData().catch(e => { console.log('loadData fout:', e.message); });
  ok('gebrekenbibliotheek geladen', C.lib.length > 1000, C.lib.length + ' codes');
  C.setState(C.emptyState()); C.recompute();

  // ---------- rekenkern tegen de voorbeelddata uit het Excel-model ----------
  const R = C.calc.rows;
  ok('voorbeelddossier heeft 3 regels', R.length === 3);
  ok('RPN technisch klopt met het Excel-model', R.map(r => r.RPNtech).join(',') === '378,72,70', R.map(r => r.RPNtech).join(','));
  ok('prioriteiten kloppen met het Excel-model', R.map(r => r.prio).join(',') === 'P1,P4,P1', R.map(r => r.prio).join(','));
  ok('definitieve kosten kloppen met het Excel-model', bijna(R.reduce((a, r) => a + (r.definitieveKosten || 0), 0), 27000, 1), String(Math.round(R.reduce((a, r) => a + (r.definitieveKosten || 0), 0))));
  ok('omvang = hoeveelheid met gebrek / totaal', bijna(R[0].omvang, 10 / 200, 0.001), String(R[0].omvang));

  // ---------- O-systeemvoorstel ----------
  const o1 = C.systeemvoorstelO({ intensiteit: 'Gevorderd', ontwikkelingKlasse: 'Progressief' }, 0.05, true);
  ok('O-voorstel: basis 2 + gevorderd 2 + progressief 2 = 6', o1.o === 6, JSON.stringify(o1.o));
  const o2 = C.systeemvoorstelO({ intensiteit: 'Eindstadium', ontwikkelingKlasse: 'Snel / actief' }, 0.9, true);
  ok('O-voorstel loopt niet boven 10', o2.o <= 10, String(o2.o));
  const o3 = C.systeemvoorstelO({ intensiteit: 'Beginstadium' }, 0.01, true);
  ok('O-voorstel meldt ontbrekende invoer', o3.ontbreekt.length > 0, o3.ontbreekt.join(', '));

  // ---------- D- en T-voorstel ----------
  ok('D-voorstel: Deels → 5', C.voorstelD('Deels') === 5, String(C.voorstelD('Deels')));
  ok('D-voorstel: Niet → 8', C.voorstelD('Niet') === 8, String(C.voorstelD('Niet')));

  // ---------- indexering, btw en contante waarde ----------
  const Pp = C.state.settings.params, start = C.calc.start;
  ok('indexfactor op het prijspeil is 1', C.indexFactor(Pp.prijspeil) === 1, String(C.indexFactor(Pp.prijspeil)));
  ok('indexfactor 10 jaar bij 3% = 1,03^10', bijna(C.indexFactor(Pp.prijspeil + 10), Math.pow(1.03, 10), 1e-9), String(C.indexFactor(Pp.prijspeil + 10)));
  Pp.inflatiePerJaar = { [Pp.prijspeil + 1]: 0.10 };
  ok('eigen inflatievoet per jaar gaat voor de algemene voet', bijna(C.indexFactor(Pp.prijspeil + 1), 1.10, 1e-9), String(C.indexFactor(Pp.prijspeil + 1)));
  ok('samengesteld: 10% en daarna 3%', bijna(C.indexFactor(Pp.prijspeil + 2), 1.10 * 1.03, 1e-9), String(C.indexFactor(Pp.prijspeil + 2)));
  Pp.inflatiePerJaar = {};
  ok('btw-factor bij 21% = 1,21', bijna(C.btwFactor(), 1.21, 1e-9), String(C.btwFactor()));
  ok('contantefactor in het startjaar is 1', C.npvFactor(start) === 1, String(C.npvFactor(start)));
  ok('contantefactor 10 jaar bij 2,5%', bijna(C.npvFactor(start + 10), 1 / Math.pow(1.025, 10), 1e-9), String(C.npvFactor(start + 10)));
  const j10 = start + 10, f10 = Math.pow(1.03, 10);
  ok('bedrag op prijspeil blijft ongewijzigd', C.bedrag(1000, j10, 'prijspeil') === 1000);
  ok('bedrag geindexeerd naar uitvoeringsjaar', bijna(C.bedrag(1000, j10, 'index'), 1000 * f10, 1e-6), String(C.bedrag(1000, j10, 'index')));
  ok('bedrag incl. btw = geindexeerd x 1,21', bijna(C.bedrag(1000, j10, 'btw'), 1000 * f10 * 1.21, 1e-6), String(C.bedrag(1000, j10, 'btw')));
  ok('contante waarde = geindexeerd / (1+d)^n', bijna(C.bedrag(1000, j10, 'npv'), 1000 * f10 / Math.pow(1.025, 10), 1e-6), String(C.bedrag(1000, j10, 'npv')));
  Pp.btwWeergave = 'incl';
  ok('bij een begroting incl. btw rekent NPV over het btw-bedrag', bijna(C.bedrag(1000, j10, 'npv'), 1000 * f10 * 1.21 / Math.pow(1.025, 10), 1e-6));
  Pp.btwWeergave = 'excl'; C.recompute();
  ok('jaarreeks geindexeerd = jaarreeks prijspeil x indexfactor', C.calc.jaren.every((j, i) => bijna(C.calc.perJaarIndex[i], C.calc.perJaar[i] * C.calc.idx[j], 0.01)));
  ok('totaal geindexeerd is hoger dan totaal op prijspeil', C.calc.totaalIndex > C.calc.totaal, `${Math.round(C.calc.totaal)} → ${Math.round(C.calc.totaalIndex)}`);
  ok('contante waarde is lager dan het geindexeerde totaal', C.calc.totaalNpv < C.calc.totaalIndex, `${Math.round(C.calc.totaalNpv)} < ${Math.round(C.calc.totaalIndex)}`);

  // ---------- budgetsturing ----------
  C.state.maatregelen = C.calc.rows.map(r => ({ id: 'bt' + r.id, regelId: r.id, handeling: 'test', jaar: start, kosten: 10000, cyclus: null, tot: null }));
  C.recompute();
  const plan = C.budgetPlan({ plafond: 15000, maxSchuif: 5 });
  ok('budgetsturing schuift tot onder het plafond', plan.perJaar.every(v => v <= 15000.01), plan.perJaar.slice(0, 4).map(Math.round).join(' / '));
  ok('budgetsturing schuift twee van de drie handelingen', plan.shifts.length === 2, plan.shifts.map(s => `${s.regel}: ${s.origineelJaar}→${s.jaar}`).join(', '));
  const P4 = plan.shifts.find(s => s.prio === 'P4');
  ok('de laagste prioriteit schuift het verst', !!P4 && P4.jaar === start + 2, P4 ? String(P4.jaar) : 'geen P4 geschoven');
  ok('plafond toetst op het geindexeerde bedrag', bijna(plan.perJaar[1], 10000 * C.calc.idx[start + 1], 0.01), String(Math.round(plan.perJaar[1])));
  ok('een P1 voorbij het laatste acceptabele jaar wordt gemeld', plan.risico.voorbijLaatsteJaar === 1, String(plan.risico.voorbijLaatsteJaar));
  ok('geschoven bedrag telt op tot 20.000', bijna(plan.risico.bedrag, 20000, 0.01), String(plan.risico.bedrag));
  const auditVoor = C.state.audit.length, toegepast = C.pasBudgetToe(plan);
  ok('toepassen verzet de jaren in de handelingen', toegepast === 2 && C.state.maatregelen.filter(m => m.jaar > start).length === 2);
  ok('elke verschuiving komt in de audittrail', C.state.audit.length === auditVoor + 2, `${auditVoor} → ${C.state.audit.length}`);
  C.recompute();
  ok('na toepassen past de planning binnen het plafond', C.calc.perJaarIndex.every(v => v <= 15000.01), C.calc.perJaarIndex.slice(0, 4).map(Math.round).join(' / '));
  C.state.maatregelen = []; C.recompute();

  // ---------- importvalidatie ----------
  const imp = {
    headers: ['ElementNaam', 'Hvh', 'Eenheid', 'GebrekOmschrijving', 'Omvang'],
    rows: [['Gevel', '200', 'm2', 'EC Scheuren constructief', '10'], ['Dak', '50', 'm2', 'GA Vuil', '20']],
    map: { element: 0, hoevTotaal: 1, eenheid: 2, constatering: 3, omvang: 4 }
  };
  let v = P.valideerMapping(imp);
  ok('correcte mapping levert geen blokkades', v.blokkades.length === 0, v.blokkades.map(b => b.tekst).join(' | '));

  imp.map.hoevTotaal = 2; // zelfde kolom als eenheid: exact de Roffa-fout
  v = P.valideerMapping(imp);
  ok('dubbele kolomkoppeling wordt geblokkeerd', v.blokkades.some(b => b.type === 'dubbel'), v.blokkades.map(b => b.type).join(','));
  ok('tekstkolom op getalveld wordt geblokkeerd', v.blokkades.some(b => b.type === 'type'));

  imp.map = { hoevTotaal: 1, eenheid: 2 };
  v = P.valideerMapping(imp);
  ok('ontbrekend verplicht veld wordt geblokkeerd', v.blokkades.some(b => b.type === 'verplicht'));

  // ---------- kengetalkeuze ----------
  const kg = { kengetalVervangen: 100, kengetalHerstellen: 10, kengetalReinigen: 1 };
  ok('vuil/afwerking → reinigen', P.kiesKengetal({ gebrekPrefix: 'GA', gebrek: 'Vuil, aanslag' }, kg).maatregel === 'Reinigen');
  ok('veroudering in eindstadium → vervangen', P.kiesKengetal({ gebrekPrefix: 'GV', intensiteit: 'Eindstadium', gebrek: 'Ouder dan 87 %' }, kg).maatregel === 'Vervangen');
  ok('constructief serieus → herstellen', P.kiesKengetal({ gebrekPrefix: 'SC', intensiteit: 'Duidelijk waarneembaar', gebrek: 'Scheuren' }, kg).maatregel === 'Herstellen');
  ok('geen kengetal > 0 → geen bedrag', P.kiesKengetal({ gebrekPrefix: 'SC' }, { kengetalVervangen: 0, kengetalHerstellen: 0, kengetalReinigen: 0 }).kengetal === null);

  // ---------- bibliotheekmatch ----------
  const m = P.matchLib({ gebrekPrefix: 'EC', gebrek: 'Scheuren constructief', bouwdeel: 'Balkons, galerijen en trappen', element: 'Balkon beton' });
  ok('bibliotheekmatch vindt een constructieve code', !!m && m.code && m.code.slice(3, 5) === 'EC', m ? `${m.code} (${m.zeker})` : 'geen match');

  // ---------- datakwaliteit ----------
  const q = P.quality([{ element: 'A', constatering: 'B', intensiteit: 'Gevorderd', hoevTotaal: 10, hoevGebrek: 1, kengetal: 5 }, { element: 'C' }]);
  ok('datakwaliteit rekent vulling per veld', q.items.find(i => i.k === 'element').ok === 2 && q.items.find(i => i.k === 'kengetal').ok === 1);

  // ---------- MJOP-rapport ----------
  C.state.project = { klant: 'Testklant', object: 'Loods 1', adres: 'Teststraat 1', status: 'actief', omschrijving: 'unit-test' };
  const rap = ctx.STEMI_UI.rapportHtml({ jaren: 15, topN: 10, onderbouwing: true, bijlagen: true, audit: true });
  ok('rapport is een volledig HTML-document', rap.startsWith('<!DOCTYPE html>') && rap.trim().endsWith('</html>'));
  ['Managementsamenvatting', 'Uitgangspunten', 'Risicobeeld', 'Meerjarenplanning', 'Onderbouwing per maatregel', 'Bijlagen', 'Testklant', 'Loods 1']
    .forEach(t => ok('rapport bevat "' + t + '"', rap.includes(t)));
  ok('rapport bevat geen lege waarden (undefined/NaN)', !/undefined|NaN/.test(rap), (rap.match(/.{40}(undefined|NaN).{40}/) || [''])[0]);
  ok('rapport bevat de prioriteitsverdeling en een risicotabel', rap.includes('Prioriteitsverdeling') && rap.includes('RPN'));
  ok('rapport toont het prijspeil en de indexering', rap.includes('Prijspeil') && rap.includes('Contante waarde'));
  const rapW = ctx.STEMI_UI.rapportHtml({ jaren: 10, topN: 5, onderbouwing: false, bijlagen: true, audit: false, word: true });
  ok('Word-variant heeft de Office-namespace', rapW.includes('urn:schemas-microsoft-com:office:word'));
  ok('Word-variant gebruikt tabelstaven in plaats van SVG', !rapW.includes('<svg') && rapW.includes('class="bar"'));
  ok('rapport zonder onderbouwing laat dat hoofdstuk weg', !rapW.includes('Onderbouwing per maatregel'));
  ok('SVG-variant gebruikt wel een diagram', rap.includes('<svg'));

  console.log(`\n${mislukt ? mislukt + ' test(s) MISLUKT' : 'alle unit-tests geslaagd'}`);
  process.exit(mislukt ? 1 : 0);
})();
