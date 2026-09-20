/* 06 Rapport – MJOP-rapport in huisstijl: printen naar PDF, downloaden als Word of HTML */
(() => {
const C = window.STEMI; const { $, $$, esc, num, eur, pct, pct1 } = C;
const D = () => new Date().toLocaleDateString('nl-NL', { day:'numeric', month:'long', year:'numeric' });

/** huisstijl staat in de gedeelde instellingen, zodat elk project hetzelfde rapport oplevert */
function hs() { C.cfg.huisstijl = Object.assign({ bedrijf:'STEMI', kleur:'#12776a', logo:'', voettekst:'' }, C.cfg.huisstijl || {}); return C.cfg.huisstijl; }
const opts = () => { C.cfg.rapport = Object.assign({ jaren:15, onderbouwing:true, audit:true, bijlagen:true, topN:10 }, C.cfg.rapport || {}); return C.cfg.rapport; };

// ---------- bouwstenen ----------
const tbl = (head, rows, cls='') => `<table class="${cls}"><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${typeof c === 'number' ? 'num' : ''}">${c==null?'':(typeof c==='number'?eur(c):c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
/** horizontale staafjes als tabel: werkt zowel in print/PDF als in Word (SVG doet Word niet) */
function barTable(labels, values, cap) {
  const max = Math.max(1, ...values, cap || 0);
  return `<table class="bars">${labels.map((l,i)=>{ const w = Math.round(100*values[i]/max), over = cap && values[i] > cap;
    return `<tr><th>${l}</th><td class="barcell"><table class="bar"><tr><td width="${Math.max(w,1)}%" bgcolor="${over?'#c0392b':hs().kleur}">&nbsp;</td><td width="${100-Math.max(w,1)}%">&nbsp;</td></tr></table></td><td class="num">${values[i]?eur(values[i]):'—'}</td></tr>`; }).join('')}</table>
    ${cap?`<p class="note">Plafond ${eur(cap)} per jaar; rood = boven het plafond.</p>`:''}`;
}
function prioVerdeling(R) {
  return C.PRIOS.map(p => { const rs = R.filter(r => r.prio === p); return [p, rs.length, rs.reduce((s,r)=>s+(r.definitieveKosten||0),0)]; }).filter(x => x[1]);
}
const risicoLijst = (R, n) => R.filter(r => r.RPNwaarde != null).sort((a,b) => b.RPNwaarde - a.RPNwaarde).slice(0, n);

/** de kern van het rapport: één HTML-document, zelfstandig te printen of te openen in Word */
function rapportHtml(o = {}) {
  const S = C.state.settings, P = S.params, pj = C.state.project || {}, R = C.calc.rows, K = hs();
  const n = o.jaren || opts().jaren, jaren = C.calc.jaren.slice(0, n), w = C.cfg.mjopWeergave || C.calc.weergave;
  const serie = C.calc.serieVan('index').slice(0, n), cum = []; serie.forEach((v,i)=>cum.push((cum[i-1]||0)+v));
  const prio = prioVerdeling(R), top = risicoLijst(R, o.topN || opts().topN);
  const compleet = R.filter(r => r.status === 'Compleet').length;
  const bronnen = {}; R.forEach(r => Object.values(r.sp.prov||{}).forEach(p => bronnen[p.bron] = (bronnen[p.bron]||0)+1));
  const zonderKengetal = R.filter(r => r.insp.kengetal == null || r.insp.kengetal === '').length;
  const zonderT = R.filter(r => r.Tjaar == null).length;
  const eerste = R.reduce((s,r)=>s+(r.eersteVoorstel||0),0), definitief = R.reduce((s,r)=>s+(r.definitieveKosten||0),0);
  const aiRegels = Object.keys(C.state.ai||{}).length;
  const flags = Object.values(C.state.ai||{}).reduce((s,a)=>s+((a._flags||[]).length),0);
  const horizonTot = C.calc.totaal, horizonIdx = C.calc.totaalIndex;
  const p15 = serie.reduce((a,b)=>a+b,0);

  const kop = `<div class="cover">
    ${K.logo?`<img class="logo" src="${K.logo}" alt="">`:`<div class="brandtext">${esc(K.bedrijf||'')}</div>`}
    <h1>Meerjarenonderhoudsplan</h1>
    <p class="lead">Waardegestuurd onderhoudsplan op basis van NEN 2767-inspectie, FMECA-risicoanalyse en het waardekompas (NEN 8026)</p>
    ${tbl(['Onderdeel','Gegeven'], [
      ['Opdrachtgever', esc(pj.klant||'—')], ['Object', esc(pj.object||'—')], ['Adres', esc(pj.adres||'—')],
      ['Omschrijving', esc(pj.omschrijving||'—')], ['Planperiode', `${P.startjaar} – ${P.startjaar + (num(P.horizon)||40) - 1} (${P.horizon} jaar)`],
      ['Prijspeil', `${P.prijspeil ?? P.startjaar}, ${P.btwWeergave === 'incl' ? 'inclusief' : 'exclusief'} btw`],
      ['Rapportdatum', D()], ['Opgesteld door', esc(window.STEMI_DB?.profile?.display_name || window.STEMI_DB?.profile?.username || '—')],
      ['Instellingenprofiel', esc(S.naam)], ['Aantal geïnspecteerde regels', String(R.length)] ], 'kv')}
    <p class="note">Dit rapport is gegenereerd uit het model; elke waarde is in het model herleidbaar naar inspecteur, technisch specialist, AI-voorstel of systeemregel.</p>
  </div>`;

  const samenvatting = `<h2>1 Managementsamenvatting</h2>
    <p>Voor <b>${esc(pj.object||'het object')}</b> zijn <b>${R.length}</b> gebreken beoordeeld. Op basis van het waardekompas
    ${prio.length?`valt daarvan <b>${(prio.find(x=>x[0]==='P1')||[0,0])[1]} in prioriteit P1</b> en <b>${(prio.find(x=>x[0]==='P2')||[0,0])[1]} in P2</b>`:'is nog geen prioriteit bepaald'}.
    De totale onderhoudsbehoefte over ${P.horizon} jaar bedraagt <b>${eur(horizonTot)}</b> op prijspeil ${P.prijspeil ?? P.startjaar}
    (<b>${eur(horizonIdx)}</b> geïndexeerd naar het uitvoeringsjaar), gemiddeld ${eur(horizonTot/(num(P.horizon)||40))} per jaar.
    In de eerste ${n} jaar is <b>${eur(p15)}</b> voorzien (geïndexeerd).</p>
    ${tbl(['Kerncijfer','Waarde','Toelichting'], [
      ['Beoordeelde regels', String(R.length), `${compleet} compleet, ${R.length-compleet} vragen nog aanvulling`],
      ['Onderhoudsbehoefte prijspeil ' + (P.prijspeil ?? P.startjaar), eur(horizonTot), `${P.horizon} jaar, excl. btw`],
      ['Geïndexeerd naar uitvoeringsjaar', eur(horizonIdx), `inflatie ${pct1(P.inflatie)} per jaar`],
      ['Inclusief btw', eur(C.calc.totaalBtw), `btw ${num(P.btwPercentage)||0}%`],
      ['Contante waarde (NPV)', eur(C.calc.totaalNpv), `discontovoet ${pct1(P.discontovoet)}, peildatum ${P.startjaar}`],
      ['Eerste ' + n + ' jaar', eur(p15), 'geïndexeerd, basis voor de begroting'],
      ['Eerste kostenvoorstel uit kengetallen', eur(eerste), 'vóór beoordeling door de specialist'],
      ['Definitieve maatregelkosten', eur(definitief), `verschil ${eur(definitief-eerste)} na beoordeling`],
      ['Budgetplafond', P.budgetplafond ? eur(P.budgetplafond) + ' per jaar' : 'geen', P.budgetplafond ? 'planning is hierop gestuurd' : 'geen sturing op een jaarplafond'] ], 'kv')}
    <h3>1.1 Prioriteitsverdeling</h3>
    ${tbl(['Prioriteit','Aantal','Maatregelkosten','Uiterlijk uitvoeren'], prio.map(([p,cnt,k]) => [p, String(cnt), k, (S.rules.laatsteJaar[p]==null?'geen termijn':`${P.startjaar + S.rules.laatsteJaar[p]} (${S.rules.laatsteJaar[p]} jaar)`)]))}
    <h3>1.2 Belangrijkste bevindingen</h3>
    <ol class="bevind">
      ${top.slice(0,5).map(r => `<li><b>${esc(r.insp.element)}</b> – ${esc(r.faalwijze||r.insp.constatering||'')} · prioriteit ${r.prio||'—'} (RPN-waarde ${Math.round(r.RPNwaarde)}), dominant waardeaspect <b>${esc(r.domWaarde)}</b>. Maatregel: ${esc(r.sp.maatregel||r.insp.maatregel||'nog te bepalen')} — ${eur(r.definitieveKosten)}${r.planJaar?` in ${r.planJaar}`:''}.</li>`).join('')}
    </ol>
    ${zonderT||zonderKengetal?`<h3>1.3 Aandachtspunten in de onderbouwing</h3><ul class="bevind">
      ${zonderT?`<li>${zonderT} regels hebben nog geen faalmoment (T). Die kosten staan wel in het totaal, maar nog niet in een jaar.</li>`:''}
      ${zonderKengetal?`<li>${zonderKengetal} regels hebben geen kengetal uit de koppeltabel; de kosten daarvan zijn een schatting of ontbreken.</li>`:''}
    </ul>`:''}`;

  const uitgangspunten = `<h2>2 Uitgangspunten</h2>
    <h3>2.1 Waardekompas van de eigenaar</h3>
    <p>Het waardekompas bepaalt hoe zwaar elk waardeaspect meeweegt. Profiel: <b>${esc(P.profiel)}</b>. De waardefactor is het definitieve belang gedeeld door 5; de risicoscore per regel is het hoogste product van effect en factor.</p>
    ${tbl(['Waardeaspect','Uit profiel','Minimum eigenaar','Definitief belang','Waardefactor'], C.ASP.map((a,i)=>[esc(a), String((S.profielen[P.profiel]||[])[i]??''), String(P.minimum[i]??''), String(C.calc.bel[i]), String(C.calc.fac[i])]))}
    <h3>2.2 Beslisregels</h3>
    ${tbl(['Regel','Instelling'], [
      ['Prioriteit uit RPN-waarde', S.rules.rpn.map(x=>`${x.prio} ≥ ${x.min}`).join(' · ')],
      ['Veiligheidsoverride', S.rules.safety.map(x=>`${x.prio} bij effect ≥ ${x.min}`).join(' · ')],
      ['Compliance-override', S.rules.compliance.map(x=>`${x.prio} bij effect ≥ ${x.min}`).join(' · ')],
      ['Prioriteit uit faalmoment T', S.rules.tPrio.map(x=>`${x.prio} bij T ≤ ${x.max} jaar`).join(' · ')],
      ['Laatste acceptabele jaar', C.PRIOS.map(p=>`${p}: ${S.rules.laatsteJaar[p]==null?'—':'+'+S.rules.laatsteJaar[p]+' jr'}`).join(' · ')],
      ['Omslag naar integraal uitvoeren', pct(P.omslagDefault) + ' van de hoeveelheid met gebrek'],
      ['NEN-signaal', 'conditie ≥ ' + P.nenSignaal + ' vraagt expliciete beoordeling'] ], 'kv')}
    <h3>2.3 Financiële uitgangspunten</h3>
    ${tbl(['Parameter','Waarde','Betekenis'], [
      ['Prijspeil', String(P.prijspeil ?? P.startjaar), 'jaar waarin de kengetallen zijn uitgedrukt'],
      ['Indexering', pct1(P.inflatie) + ' per jaar', 'samengesteld naar het uitvoeringsjaar' + (Object.keys(P.inflatiePerJaar||{}).length?`; afwijkend in ${Object.keys(P.inflatiePerJaar).join(', ')}`:'')],
      ['Btw', (num(P.btwPercentage)||0) + '%', 'begroting vastgelegd ' + (P.btwWeergave === 'incl' ? 'inclusief' : 'exclusief') + ' btw'],
      ['Discontovoet', pct1(P.discontovoet), `contante waarde met peildatum ${P.startjaar}`] ], 'kv')}`;

  const risico = `<h2>3 Risicobeeld</h2>
    <p>Per gebrek is de risicoscore bepaald als <b>S(waarde) × O × D</b>: het effect op de waardeaspecten gewogen met het waardekompas, de kans dat het gebrek zich voordoet en de mate waarin het tijdig te ontdekken is.</p>
    <h3>3.1 Top ${top.length} naar waardegestuurd risico</h3>
    ${tbl(['ID','Element','Faalwijze','Prio','S','O','D','RPN','Dominant aspect','T','Maatregel','Kosten'],
      top.map(r => [String(r.id), esc(r.insp.element), esc((r.faalwijze||'').slice(0,120)), r.prio||'—', String(Math.round(r.Swaarde*10)/10), String(r.O??''), String(r.D??''), String(Math.round(r.RPNwaarde)), esc(r.domWaarde), r.Tjaar==null?'—':r.Tjaar+' jr', esc((r.sp.maatregel||r.insp.maatregel||'').slice(0,90)), r.definitieveKosten]))}
    <h3>3.2 Verdeling over de waardeaspecten</h3>
    ${tbl(['Waardeaspect','Regels waar dit aspect dominant is','Maatregelkosten'], C.ASP.map(a => { const rs = R.filter(r=>r.domWaarde===a); return [esc(a), String(rs.length), rs.reduce((s,r)=>s+(r.definitieveKosten||0),0)]; }).filter(x=>+x[1]))}`;

  const planning = `<h2>4 Meerjarenplanning ${jaren[0]} – ${jaren[jaren.length-1]}</h2>
    <p>Bedragen geïndexeerd naar het uitvoeringsjaar${P.btwWeergave==='incl'?' en inclusief btw':', exclusief btw'}. Een handeling met een cyclus komt in elk herhalingsjaar terug.</p>
    ${o.word ? barTable(jaren, serie, num(P.budgetplafond)) : window.STEMI_UI.barChart(jaren, serie, { cap: num(P.budgetplafond) })}
    ${tbl(['Jaar','Prijspeil','Geïndexeerd','Incl. btw','Contante waarde','Cumulatief geïndexeerd'],
      jaren.map((j,i)=>[String(j), C.calc.perJaar[i], C.calc.perJaarIndex[i], C.calc.perJaarBtw[i], C.calc.perJaarNpv[i], cum[i]]))}
    <h3>4.1 Handelingen per jaar</h3>
    ${tbl(['Jaar','ID','Element','Handeling','Prio','Kosten prijspeil','Geïndexeerd','Cyclus'],
      jaren.flatMap(j => R.flatMap(r => r.maatregelen.filter(m => m.jaren.includes(j)).map(m =>
        [String(j), String(r.id), esc(r.insp.element), esc((m.handeling||'').slice(0,110)), r.prio||'—', m.kosten||0, (m.kosten||0)*(C.calc.idx[j]||1), m.cyclus?`elke ${m.cyclus} jr`:'eenmalig']))))}`;

  const onderbouwing = !o.onderbouwing ? '' : `<h2>5 Onderbouwing per maatregel</h2>
    <p class="note">Per regel staat waar elke waarde vandaan komt: <b>inspectie</b> (veldopname), <b>specialist</b> (mens), <b>AI-voorstel</b> (gecontroleerd door de specialist) of <b>systeemregel</b> (rekenkern uit de instellingen).</p>
    ${R.map(r => { const s = r.sp, pv = s.prov||{}, bron = k => ({excel:'inspectiebestand', mens:'technisch specialist', ai:'AI-voorstel', systeem:'systeemregel'})[pv[k]?.bron] || 'systeemregel';
      return `<div class="regel"><h4>${r.id} · ${esc(r.insp.element)}${r.insp.locatie?` – ${esc(r.insp.locatie)}`:''} <span class="tag">${r.prio||'—'}</span></h4>
      ${tbl(['Onderdeel','Vastgelegd','Onderbouwing','Herkomst'], [
        ['Constatering (NEN 2767)', esc(`${r.insp.gebrek||''} ${r.insp.ernst?`· ernst ${r.insp.ernst}`:''} ${r.insp.intensiteit?`· ${r.insp.intensiteit}`:''} ${r.omvang!=null?`· omvang ${pct(r.omvang)}`:''}`), esc(r.insp.constatering||''), 'inspecteur'],
        ['Faalwijze', esc(r.faalwijze||'—'), esc(r.libE?.omschrijving||''), bron('faalwijze')],
        ['Kans O', String(r.O??'—') + (C.oKlasse(r.O)?` – ${esc(C.oKlasse(r.O))}`:''), esc(s.onderbouwingO || r.oInfo?.uitleg || ''), bron('O')],
        ['Detecteerbaarheid D', String(r.D??'—') + (C.dKlasse(r.D)?` – ${esc(C.dKlasse(r.D))}`:''), esc(s.onderbouwingD || C.voorstelDtekst(r.insp.inspecteerbaarheid)), bron('D')],
        ['Faalmoment T', r.Tjaar==null?'—':`${esc(r.Tklasse||'')} (${r.Tjaar} jaar, deadline ${r.deadline??'—'})`, esc(s.onderbouwingT || r.tTxtSys || ''), bron('Tjaar')],
        ['Effect per waardeaspect', C.ASP.map((a,i)=>`${C.ASP_SHORT[i]} ${r.effect[i]}`).join(' · '), esc(s.onderbouwingEffect||''), bron('effect')],
        ['Risico', `S ${Math.round(r.Swaarde*10)/10} × O ${r.O??'—'} × D ${r.D??'—'} = RPN ${r.RPNwaarde==null?'—':Math.round(r.RPNwaarde)}`, `prioriteit ${r.prio||'—'} via ${r.drivers.join(', ')||'—'}; dominant ${esc(r.domWaarde)}`, 'systeemregel'],
        ['Maatregel', esc(s.maatregel || r.insp.maatregel || '—'), esc(s.restToelichting||''), bron('maatregel')],
        ['Restrisico na maatregel', (s.restS!=null||s.restO!=null||s.restD!=null)?`S ${s.restS??'—'} · O ${s.restO??'—'} · D ${s.restD??'—'}`:'—', esc(s.restToelichting||''), bron('restS')],
        ['Kosten', `${eur(r.definitieveKosten)}${r.begrotingswijze?` · ${esc(r.begrotingswijze)}`:''}`, esc(s.onderbouwingKosten || (r.insp.kengetal?`${r.begrHoev??''} × ${eur(r.insp.kengetal)} kengetal`:'')), r.kostenSpec!=null?'technisch specialist':'kengetal inspectie'],
        ['Planning', r.planJaar?`uitvoeren in ${r.planJaar}${r.laatsteJaar?` (uiterlijk ${r.laatsteJaar})`:''}`:'nog niet ingepland', r.maatregelen.map(m=>esc(m.handeling||'')).filter(Boolean).join(' / '), r.maatregelen[0]?.auto?'systeemregel':'planner'] ], 'kv')}
      ${(s.aanvullendOnderzoek||'').trim()?`<p class="note"><b>Aanvullend onderzoek:</b> ${esc(s.aanvullendOnderzoek)}</p>`:''}
      </div>`; }).join('')}`;

  const bijlagen = !o.bijlagen ? '' : `<h2>6 Bijlagen</h2>
    <h3>6.1 Herkomst en controle</h3>
    ${tbl(['Herkomst','Aantal vastgelegde velden'], Object.entries(bronnen).map(([b,c])=>[({excel:'Inspectiebestand',mens:'Technisch specialist',ai:'AI-voorstel',systeem:'Systeemregel'})[b]||b, String(c)]))}
    <p class="note">${aiRegels} regels zijn door de AI voorgesteld; ${flags} voorgestelde waarden zijn door de bewaking geweigerd of gesignaleerd en door de specialist beoordeeld. De volledige wijzigingshistorie staat in het model (audittrail) en in de database.</p>
    ${!o.audit ? '' : `<h3>6.2 Laatste wijzigingen</h3>
    ${tbl(['Tijd','Gebruiker','Regel','Veld','Oud','Nieuw','Herkomst'], (C.state.audit||[]).slice(0,60).map(a=>[
      new Date(a.ts).toLocaleString('nl-NL'), esc(a.user||''), String(a.regel??''), esc(a.veld??''),
      esc(String(a.oud??'').slice(0,40)), esc(String(a.nieuw??'').slice(0,40)), esc(a.bron??'')]))}
    <p class="note">Weergegeven zijn de laatste 60 van ${(C.state.audit||[]).length} in dit project bewaarde wijzigingen; de database bewaart de volledige trail.</p>`}
    <h3>6.${o.audit?'3':'2'} Begrippen</h3>
    ${tbl(['Begrip','Betekenis'], [
      ['NEN 2767', 'conditiemeting: gebrek, ernst, omvang en intensiteit leiden tot een conditiescore 1–6'],
      ['FMECA', 'faalwijze- en effectanalyse: S (effect) × O (kans) × D (detecteerbaarheid) = RPN'],
      ['Waardekompas (NEN 8026)', 'weging van waardeaspecten door de eigenaar; bepaalt welk effect zwaar weegt'],
      ['RPN-waarde', 'risicoscore ná weging met het waardekompas; basis voor de prioriteit'],
      ['Laatste acceptabele jaar', 'uiterste uitvoeringsjaar dat volgt uit de prioriteit en het beleid van de eigenaar'],
      ['Indexering', 'kosten van prijspeil naar uitvoeringsjaar, samengesteld met de inflatievoet'],
      ['Contante waarde (NPV)', 'toekomstige uitgaven teruggerekend naar het startjaar tegen de discontovoet'] ], 'kv')}`;

  const css = `
  /* het rapport is een zelfstandig document: de variabelen uit de app-stylesheet hier opnieuw zetten,
     anders vallen de staven in het diagram terug op zwart */
  :root { --accent: ${K.kleur}; --line: #d5dbe0; --rood: #c0392b; }
  @page { size: A4 portrait; margin: 18mm 14mm; }
  body { font: 10pt/1.45 "Segoe UI", Arial, sans-serif; color:#1b1f23; margin:0; padding:14px; }
  h1 { font-size: 24pt; margin:.2em 0 .1em; color:${K.kleur}; }
  h2 { font-size: 14pt; margin:1.6em 0 .4em; color:${K.kleur}; border-bottom:2px solid ${K.kleur}; padding-bottom:3px; page-break-after:avoid; }
  h3 { font-size: 11.5pt; margin:1.2em 0 .3em; page-break-after:avoid; }
  h4 { font-size: 10.5pt; margin:1em 0 .3em; page-break-after:avoid; }
  p, li { margin:.35em 0; }
  table { border-collapse:collapse; width:100%; margin:.4em 0 .8em; font-size:8.5pt; }
  th, td { border:1px solid #d5dbe0; padding:3px 5px; text-align:left; vertical-align:top; }
  th { background:#f1f4f6; font-weight:600; }
  td.num, th.num { text-align:right; white-space:nowrap; }
  table.kv th:first-child, table.kv td:first-child { width:26%; }
  table.bars, table.bars td, table.bars th { border:0; }
  table.bars th { background:none; width:44px; text-align:right; padding-right:6px; }
  table.bar, table.bar td { border:0; padding:0; height:11px; }
  .cover { border-bottom:3px solid ${K.kleur}; padding-bottom:12px; margin-bottom:6px; }
  .cover .logo { max-height:52px; margin-bottom:10px; }
  .brandtext { font-size:15pt; font-weight:700; color:${K.kleur}; letter-spacing:.5px; }
  .lead { font-size:11pt; color:#4a5560; margin-bottom:12px; }
  .note { font-size:8pt; color:#5d6a75; }
  .tag { font-size:8pt; background:${K.kleur}; color:#fff; border-radius:8px; padding:1px 7px; vertical-align:middle; }
  .regel { page-break-inside:avoid; border-top:1px solid #e3e8ec; padding-top:6px; margin-top:10px; }
  .bevind li { margin:.3em 0; }
  .chart { width:100%; height:auto; }
  .voet { margin-top:18px; border-top:1px solid #d5dbe0; padding-top:6px; font-size:8pt; color:#5d6a75; }
  @media print { .regel, tr { page-break-inside:avoid; } h2 { page-break-before:auto; } }`;

  const body = kop + samenvatting + uitgangspunten + risico + planning + onderbouwing + bijlagen +
    `<div class="voet">${esc(K.voettekst || `${K.bedrijf} · waardegestuurd onderhoudsplan`)} · ${esc(pj.klant||'')} ${esc(pj.object||'')} · ${D()} · pagina's genummerd door de printer</div>`;
  const wordKop = o.word ? `<xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml>` : '';
  return `<!DOCTYPE html><html lang="nl"${o.word?' xmlns:w="urn:schemas-microsoft-com:office:word"':''}><head><meta charset="utf-8">
    <title>MJOP ${esc(pj.object||'')} ${esc(pj.klant||'')}</title>${o.word?`<!--[if gte mso 9]>${wordKop}<![endif]-->`:''}
    <style>${css}</style></head><body>${body}</body></html>`;
}

function download(naam, tekst, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿', tekst], { type })); a.download = naam; a.click(); }
const bestandsnaam = ext => `MJOP_${(C.state.project?.object||'object').replace(/\W+/g,'_')}_${new Date().toISOString().slice(0,10)}.${ext}`;

function render() {
  const el = $('#tab-rapport'); if (!el) return; const O = opts(), K = hs();
  el.innerHTML = `<h2>06 Rapport</h2><p class="sub">Het volledige MJOP-rapport: managementsamenvatting, uitgangspunten, risicobeeld, meerjarenplanning, onderbouwing per maatregel en de audittrail als bijlage. Printen levert een PDF; de Word-versie is bedoeld om zelf nog tekst toe te voegen.</p>
    <div class="toolbar">
      <button class="btn" id="rapPrint">Printen / PDF</button>
      <button class="btn ghost" id="rapWord">Downloaden als Word</button>
      <button class="btn ghost" id="rapHtml">Downloaden als HTML</button>
      <span class="spacer"></span>
      <label class="note">Planperiode in rapport <select id="rapJaren">${[10,15,20,30,40].map(x=>`<option ${x===O.jaren?'selected':''}>${x}</option>`).join('')}</select> jaar</label>
      <label class="note">Top <select id="rapTop">${[5,10,15,25].map(x=>`<option ${x===O.topN?'selected':''}>${x}</option>`).join('')}</select> risico's</label>
    </div>
    <div class="toolbar"><label class="note"><input type="checkbox" id="rapOnd" ${O.onderbouwing?'checked':''}> onderbouwing per maatregel opnemen (${C.calc.rows.length} regels)</label>
      <label class="note"><input type="checkbox" id="rapBij" ${O.bijlagen?'checked':''}> bijlagen opnemen</label>
      <label class="note"><input type="checkbox" id="rapAud" ${O.audit?'checked':''}> laatste wijzigingen uit de audittrail opnemen</label></div>
    <div class="grid two">
      <div class="card"><h3 style="margin-top:0">Huisstijl</h3>
        <div class="field"><label>Organisatie / afzender</label><input id="hsBedrijf" value="${esc(K.bedrijf||'')}"></div>
        <div class="field"><label>Accentkleur</label><input type="color" id="hsKleur" value="${esc(K.kleur)}" style="width:64px;height:32px;padding:2px"> <span class="note">koppen, lijnen en staven</span></div>
        <div class="field"><label>Logo (png of svg, max 300 kB)</label><input type="file" id="hsLogo" accept="image/*">${K.logo?` <button class="btn ghost small" id="hsLogoDel">verwijderen</button><br><img src="${K.logo}" style="max-height:44px;margin-top:8px">`:''}</div>
        <div class="field"><label>Voettekst</label><input id="hsVoet" value="${esc(K.voettekst||'')}" placeholder="STEMI · waardegestuurd onderhoudsplan"></div>
        <button class="btn" id="hsSave">Huisstijl opslaan (gedeeld)</button>
      </div>
      <div class="card"><h3 style="margin-top:0">Inhoud van dit rapport</h3><ol class="note" style="padding-left:18px;line-height:1.7">
        <li>Managementsamenvatting met kerncijfers, prioriteitsverdeling en de vijf belangrijkste bevindingen</li>
        <li>Uitgangspunten: waardekompas, beslisregels en financiële parameters</li>
        <li>Risicobeeld: top-risico's en verdeling over de waardeaspecten</li>
        <li>Meerjarenplanning per jaar in prijspeil, geïndexeerd, incl. btw en contante waarde</li>
        <li>Onderbouwing per maatregel met de herkomst van elke waarde</li>
        <li>Bijlagen: herkomst en controle, laatste wijzigingen, begrippenlijst</li></ol>
        <p class="note">Tip: kies bij Printen “Opslaan als PDF”, A4 staand, marges standaard. Achtergrondkleuren aanzetten geeft de gekleurde koppen mee.</p></div>
    </div>
    <h3>Voorbeeld</h3><p class="note">Onderstaande weergave is het rapport zoals het geprint wordt.</p>
    <div class="card" style="padding:0"><iframe id="rapPrev" style="width:100%;height:760px;border:0;background:#fff"></iframe></div>`;

  const doc = () => rapportHtml({ ...O, word: false });
  const fr = $('#rapPrev'); fr.srcdoc = doc();
  const zet = (k, v) => { O[k] = v; C.saveCfg(); render(); };
  $('#rapJaren').onchange = e => zet('jaren', +e.target.value);
  $('#rapTop').onchange = e => zet('topN', +e.target.value);
  $('#rapOnd').onchange = e => zet('onderbouwing', e.target.checked);
  $('#rapBij').onchange = e => zet('bijlagen', e.target.checked);
  $('#rapAud').onchange = e => zet('audit', e.target.checked);
  $('#rapPrint').onclick = () => { const w = fr.contentWindow; w.focus(); w.print(); };
  $('#rapWord').onclick = () => download(bestandsnaam('doc'), rapportHtml({ ...O, word: true }), 'application/msword');
  $('#rapHtml').onclick = () => download(bestandsnaam('html'), doc(), 'text/html');
  $('#hsSave').onclick = () => { K.bedrijf = $('#hsBedrijf').value; K.kleur = $('#hsKleur').value; K.voettekst = $('#hsVoet').value; C.saveCfg(); C.toast('Huisstijl opgeslagen'); render(); };
  $('#hsLogo').onchange = e => { const f = e.target.files[0]; if (!f) return;
    if (f.size > 300000) { alert('Het logo is groter dan 300 kB; gebruik een kleinere afbeelding.'); return; }
    const rd = new FileReader(); rd.onload = () => { K.logo = rd.result; C.saveCfg(); render(); }; rd.readAsDataURL(f); };
  const dl = $('#hsLogoDel'); if (dl) dl.onclick = () => { K.logo = ''; C.saveCfg(); render(); };
}
window.STEMI_UI = window.STEMI_UI || {}; Object.assign(window.STEMI_UI, { renderRapport: render, rapportHtml });
})();
