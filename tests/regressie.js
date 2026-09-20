const { chromium } = require('playwright');
const S = __dirname; // testbestanden staan naast dit script
let mislukt = 0;
const ok = (naam, cond, extra='') => { if (!cond) mislukt++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${naam}${extra ? ' — ' + extra : ''}`); };
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({viewport:{width:1600,height:1000}});
  pg.on('pageerror', e => console.log('PAGEERROR', e.message)); pg.on('dialog', d => d.accept());
  await pg.goto('http://localhost:8123/');
  await pg.fill('#loginUser','mitchell'); await pg.fill('#loginPass','Zandwijken1!'); await pg.click('#loginForm button[type=submit]');
  await pg.waitForSelector('#projSel', {timeout:30000}); await pg.waitForTimeout(1200);
  ok('app laadt en projectkiezer verschijnt', true);

  // testproject
  await pg.evaluate(async () => { const DB = window.STEMI_DB; const d = await DB.duplicateDossier((await DB.listDossiers()).find(x=>x.naam==='Loods – voorbeeld').id, '__test fixes '+Date.now(), {alleenInstellingen:true, klant:'Test', object:'Complex'}); window.STEMI.setState(d.state); window.STEMI_UI.renderAll(); });
  await pg.evaluate(() => { window.STEMI.cfg.autoAI = false; }); await pg.waitForTimeout(400); await pg.evaluate(() => window.STEMI_UI.switchTab('inspectie'));

  // 1. import starten
  await pg.setInputFiles('#rawFile', S + '/voorbeeld-inspectie.xlsx');
  await pg.waitForSelector('#impGo', {timeout:15000}); await pg.waitForTimeout(400);
  const goedeMap = await pg.$$eval('[data-map]', s => Object.fromEntries(s.filter(x=>x.value!=='').map(x=>[x.dataset.map, x.options[x.selectedIndex].text])));
  ok('automatische mapping koppelt Hvh aan hoevTotaal', goedeMap.hoevTotaal === 'Hvh', JSON.stringify(goedeMap.hoevTotaal));
  ok('geen blokkades bij correcte mapping', !(await pg.$('.card.blok')), '');
  ok('importknop actief', !(await pg.$eval('#impGo', b => b.disabled)));

  // 2. exact de fout van Roffa nabootsen: hoevTotaal -> Eenheid (kolom 6, index 6)
  const eenheidIdx = await pg.$$eval('[data-map="eenheid"] option', o => { const x = o.find(y=>y.textContent==='Eenheid'); return x ? x.value : null; });
  await pg.selectOption('[data-map="hoevTotaal"]', eenheidIdx); await pg.waitForTimeout(500);
  const blok = await pg.$eval('.card.blok', e => e.innerText).catch(()=>'');
  ok('dubbele kolomkoppeling wordt geblokkeerd', /aan 2 doelvelden/i.test(blok), blok.split('\n').slice(1,2).join(''));
  ok('typefout (tekstkolom op getalveld) wordt gemeld', /slechts 0% van de waarden is een getal|geen getal/i.test(blok));
  ok('importknop geblokkeerd', await pg.$eval('#impGo', b => b.disabled));
  await pg.evaluate(() => document.querySelector('#impGo').click()); await pg.waitForTimeout(600);
  ok('programmatische klik op Importeren wordt ook tegengehouden', (await pg.evaluate(() => window.STEMI.state.inspectie.length)) === 0);

  // 3. mapping herstellen en importeren
  const hvhIdx = await pg.$$eval('[data-map="hoevTotaal"] option', o => { const x = o.find(y=>y.textContent==='Hvh'); return x ? x.value : null; });
  await pg.selectOption('[data-map="hoevTotaal"]', hvhIdx); await pg.waitForTimeout(400);
  await pg.click('#impGo'); await pg.waitForTimeout(1500);
  const na = await pg.evaluate(() => { const S = window.STEMI.state; return { n: S.inspectie.length, tot: S.inspectie.filter(r=>r.hoevTotaal!=null).length, geb: S.inspectie.filter(r=>r.hoevGebrek!=null).length }; });
  ok('import werkt na herstel', na.n === 93 && na.tot === 93 && na.geb === 93, JSON.stringify(na));

  // 4. koppeltabel
  await pg.setInputFiles('#lkFile', S + '/voorbeeld-kengetallen.xlsx'); await pg.waitForSelector('#lkGo', {timeout:15000}); await pg.waitForTimeout(400);
  await pg.click('#lkGo'); await pg.waitForTimeout(1200);
  const kg = await pg.evaluate(() => { const R = window.STEMI.calc.rows; return { met: window.STEMI.state.inspectie.filter(r=>r.kengetal!=null).length, voorstel: Math.round(R.reduce((a,r)=>a+(r.eersteVoorstel||0),0)) }; });
  ok('koppeltabel levert kengetallen en een kostenvoorstel', kg.met === 77 && kg.voorstel > 100000, JSON.stringify(kg));

  // 5. guardrails op AI-output
  const guard = await pg.evaluate(() => {
    const r = window.STEMI.calc.rows[0]; const basis = r.eersteVoorstel;
    const test = (p) => { const kopie = JSON.parse(JSON.stringify(p)); const flags = window.__keur(kopie, r); return { over: kopie, flags }; };
    const a = test({ O: 99, D: 5, kostenSpecialist: basis * 50, Tjaar: 2, effect: [1,2,3,4,5,6,7,8] });
    const b = test({ O: 7, kostenSpecialist: basis * 1.5 });
    const c = test({ kostenSpecialist: 5000, Tjaar: 999, Tklasse: 'ooit', effect: [1,2,3] });
    const zonderBasis = (() => { const r2 = { ...r, eersteVoorstel: null, kostenLokaal: null, kostenElement: null }; const p = { kostenSpecialist: 250000 }; const f = window.__keur(p, r2); return { p, f }; })();
    return { a, b, c, zonderBasis, basis };
  });
  ok('O buiten 1-10 wordt geweigerd', guard.a.over.O === undefined && guard.a.flags.some(f=>f.veld==='O'));
  ok('absurd bedrag (50x) wordt geweigerd', guard.a.over.kostenSpecialist === undefined && guard.a.flags.some(f=>f.veld==='kostenSpecialist'));
  ok('geldig bedrag (1,5x) wordt wel overgenomen', guard.b.over.kostenSpecialist != null && guard.b.flags.length === 0);
  const band = await pg.evaluate(() => {
    const r = window.STEMI.calc.rows.find(x => x.kostenElement > x.kostenLokaal * 2) || window.STEMI.calc.rows[0];
    const integraal = { kostenSpecialist: r.kostenElement }; const f1 = window.__keur(integraal, r);
    const veelTeHoog = { kostenSpecialist: r.kostenElement * 10 }; const f2 = window.__keur(veelTeHoog, r);
    return { lokaal: Math.round(r.kostenLokaal||0), integraal: Math.round(r.kostenElement||0), integraalOk: integraal.kostenSpecialist != null, f1: f1.length, teHoogGeweigerd: veelTeHoog.kostenSpecialist === undefined, f2: f2.length };
  });
  ok('integraal bedrag mag, ook als de rekenkern lokaal begroot', band.integraalOk && band.f1 === 0, `lokaal ${band.lokaal} / integraal ${band.integraal}`);
  ok('10x het integrale bedrag wordt nog steeds geweigerd', band.teHoogGeweigerd && band.f2 === 1);
  ok('onmogelijke T-waarden geweigerd', guard.c.over.Tjaar === undefined && guard.c.over.Tklasse === undefined);
  ok('effect met verkeerd aantal waarden geweigerd', guard.c.over.effect === undefined);
  ok('bedrag zonder kostenbasis nooit overgenomen', guard.zonderBasis.p.kostenSpecialist === undefined && /geen kostenbasis/.test(guard.zonderBasis.f[0].reden));

  // 6. retry met backoff bij 429
  const retry = await pg.evaluate(async () => {
    const orig = window.fetch; let pogingen = 0;
    window.fetch = async (u, o) => { if (String(u).includes('/api/analyze')) { pogingen++; if (pogingen < 3) return new Response(JSON.stringify({ error: 'This request would exceed your available credits given your current in-flight requests' }), { status: 402 }); return new Response(JSON.stringify({ content: '{"ok":true}', model: 'test', usage: { total_tokens: 10 } }), { status: 200 }); } return orig(u, o); };
    const t0 = Date.now(); let res, err;
    try { res = await window.STEMI.callAgent([{role:'user',content:'x'}], true, { taak:'specialist' }); } catch (e) { err = e.message; }
    window.fetch = orig; return { pogingen, gelukt: !!res, err, ms: Date.now() - t0 };
  });
  ok('herkansing na creditfout: derde poging slaagt', retry.pogingen === 3 && retry.gelukt, `${retry.pogingen} pogingen in ${retry.ms} ms`);

  // 7. blijvende fout stopt na 4 pogingen met duidelijke melding
  const faal = await pg.evaluate(async () => {
    const orig = window.fetch; let p = 0;
    window.fetch = async (u, o) => { if (String(u).includes('/api/analyze')) { p++; return new Response(JSON.stringify({ error: 'rate limit' }), { status: 429 }); } return orig(u, o); };
    let err; try { await window.STEMI.callAgent([{role:'user',content:'x'}], true, { taak:'specialist', pogingen: 3 }); } catch (e) { err = e.message; }
    window.fetch = orig; return { p, err };
  });
  ok('geeft na max pogingen een duidelijke fout', faal.p === 3 && /na 3 pogingen/.test(faal.err), faal.err);

  // 8. datakwaliteit bovenaan zichtbaar
  await pg.evaluate(() => window.STEMI_UI.switchTab('inspectie'));
  const kwal = await pg.$eval('#tab-inspectie details.card summary', e => e.innerText).catch(()=>'');
  ok('datakwaliteit-kaart staat boven de tabel', /Datakwaliteit/.test(kwal), kwal.slice(0,80));
  await pg.screenshot({path: S + '/../.tmp-datakwaliteit.png', fullPage:false});

  // 9. tab 03 rendert nog (met 93 regels)
  await pg.evaluate(() => window.STEMI_UI.switchTab('specialist')); await pg.waitForTimeout(800);
  const rijen = await pg.$$eval('#tab-specialist tbody tr', r => r.length);
  ok('tab 03 rendert alle regels', rijen === 93, rijen + ' rijen');
  ok('AI-knop is niet meer geblokkeerd door ontbrekende sleutel', !(await pg.$eval('#aiAll', b => b.disabled)));

  // 10. MJOP/systeemmodel rekenen door
  const calc = await pg.evaluate(() => {
    const C = window.STEMI; const id = C.calc.rows[0].id;
    const voor = C.calc.rows[0].RPNtech;
    C.setSp(id, 'O', 7, 'mens'); C.setSp(id, 'D', 6, 'mens'); C.recompute();
    const r = C.calc.rows.find(x=>x.id===id);
    return { voor, na: r.RPNtech, prio: r.prio, kosten: Math.round(r.definitieveKosten||0), effect: r.effect.slice(0,3) };
  });
  ok('RPN blijft leeg tot O en D zijn vastgesteld', calc.voor == null);
  ok('rekenkern levert RPN, prioriteit en kosten na invullen O/D', calc.na > 0 && !!calc.prio && calc.kosten > 0, JSON.stringify(calc));
  await b.close();
  console.log(`\n${mislukt ? mislukt + ' test(s) MISLUKT' : 'alle tests geslaagd'}`);
  process.exit(mislukt ? 1 : 0);
})().catch(e => { console.error('TESTFOUT', e); process.exit(1); });
