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
laad('core.js'); laad('prep.js');
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

  console.log(`\n${mislukt ? mislukt + ' test(s) MISLUKT' : 'alle unit-tests geslaagd'}`);
  process.exit(mislukt ? 1 : 0);
})();
