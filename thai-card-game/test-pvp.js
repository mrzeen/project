// Two real pages play a friend match through a stand-in room that relays presence between them.
// After every turn, both pages' boards must be identical mirror images.
const {chromium} = require('playwright');

const FAKE_ROOM = () => {
  const listeners = []; const mine = {}; let opp = null;
  const peer = (presence, me) => ({peer: me ? 'me' : 'friend', by: null, isMe: me, sameTab: me, kind: 'viewer', guest: false, presence, updatedAt: Date.now()});
  const peers = () => opp ? [peer({...mine}, true), peer(opp, false)] : [peer({...mine}, true)];
  const fire = () => { const p = peers(); listeners.forEach(f => f({peers: p, joined: [], left: [], updated: []})); };
  window.__recv = o => { opp = o; setTimeout(fire, 0); };
  window.__gone = () => { opp = null; setTimeout(fire, 0); };
  const named = {
    name: 'test',
    presence: async patch => { for (const k in patch){ if (patch[k] === null) delete mine[k]; else mine[k] = patch[k]; }
                               window.__relay(JSON.stringify(mine)); },
    onPeers: f => { listeners.push(f); setTimeout(fire, 0); return () => {}; },
    peers, leave: async () => {}, emit: async () => {}, on: () => () => {},
    connected: () => true, onConnection: () => () => {},
  };
  window.claude = {use: async n => n === 'room' ? {join: async () => named} : null};
};

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 430, height: 780}});
  const [host, guest] = [await ctx.newPage(), await ctx.newPage()];
  const errs = [];
  for (const [pg, other, tag] of [[host, () => guest, 'host'], [guest, () => host, 'guest']]) {
    pg.on('pageerror', e => errs.push(tag + ': ' + e.message));
    await pg.addInitScript(FAKE_ROOM);
    await pg.exposeBinding('__relay', (src, s) => other().evaluate(o => window.__recv(o), JSON.parse(s)).catch(() => {}));
    await pg.goto('file://' + __dirname + '/index.html');
  }
  await host.waitForTimeout(800);
  await host.evaluate(() => { DK.sel = 'destroy'; }); await guest.evaluate(() => { DK.sel = 'trick'; });
  await host.click('#mHost');
  await host.waitForSelector('#roomCode:not(:empty)');
  const code = await host.textContent('#roomCode');
  await host.screenshot({path: require('os').tmpdir() + '/pvp-host-menu.png'});
  await guest.fill('#mCode', code);
  await guest.click('#mJoin');
  await host.waitForFunction(() => MODE.pvp && S.turn === 1, null, {timeout: 10000});
  await guest.waitForFunction(() => MODE.pvp && S.turn === 1, null, {timeout: 10000});
  console.log('room', code, 'both started');

  const snapshot = pg => pg.evaluate(() => S.locs.map(L => ({
    id: L.id, p: L.cards.p.map(c => c.id + ':' + power(c)).join(','), a: L.cards.a.map(c => c.id + ':' + power(c)).join(','),
    tp: sideTotal(L, 'p'), ta: sideTotal(L, 'a'), hp: S.hp.p, ho: S.hp.a})));
  const sameDecks = await Promise.all([host, guest].map(pg => pg.evaluate(() => [S.deck.p.map(c=>c.id).join(), S.deck.a.map(c=>c.id).join()])));
  console.log('decks mirrored:', sameDecks[0][0] === sameDecks[1][1] && sameDecks[0][1] === sameDecks[1][0]);
  console.log('host plays destroy deck, guest plays trick deck:', await host.evaluate(() => [...S.deck.p, ...S.hand.p].every(c => PRESETS.destroy.ids.includes(c.id)) && [...S.deck.a, ...S.hand.a].every(c => PRESETS.trick.ids.includes(c.id))));

  let mismatches = 0;
  for (let t = 1; t <= 8; t++) {
    if (await host.evaluate(() => S.phase === 'over')) break;
    for (const pg of [host, guest]) {
      for (let k = 0; k < 3; k++) {
        const ok = await pg.evaluate(() => {
          const h = document.querySelector('.hc:not(.no)'); if (!h) return false; h.click();
          const tg = [...document.querySelectorAll('.slots.p.target')]; if (!tg.length){ h.click(); return false; }
          tg[Math.floor(Math.random() * tg.length)].click(); return true;
        });
        if (!ok) break;
      }
    }
    if (t === 3) await host.evaluate(() => document.querySelector('#btnVow').click());
    if (t === 3){ await host.evaluate(() => { S.ult.p.armed = 1; }); await guest.evaluate(() => { S.ult.p.armed = 0; }); }   // both fire their signature moves
    await host.evaluate(() => document.querySelector('#btnEnd').click());
    await host.waitForTimeout(300);
    if (t === 2) await host.screenshot({path: require('os').tmpdir() + '/pvp-wait.png'});
    await guest.evaluate(() => document.querySelector('#btnEnd').click());
    for (const pg of [host, guest])
      await pg.waitForFunction(n => (S.phase === 'play' && S.turn === n + 1) || S.phase === 'over', t, {timeout: 30000});
    const [a, g] = [await snapshot(host), await snapshot(guest)];
    const mirrored = a.every((L, i) => L.id === g[i].id && L.p === g[i].a && L.a === g[i].p && L.tp === g[i].ta && L.ta === g[i].tp && L.hp === g[i].ho && L.ho === g[i].hp);
    if (!mirrored) { mismatches++; console.log('MISMATCH turn', t, JSON.stringify(a), JSON.stringify(g)); }
    console.log(`turn ${t}: ` + a.map(L => `${L.id} ${L.tp}-${L.ta}`).join(' | ') + `  HP ${a[0].hp}-${a[0].ho}` + (mirrored ? '  ✓ ตรงกัน' : '  ✗'));
  }
  console.log('signature moves used on both screens:', JSON.stringify(await Promise.all([host, guest].map(pg => pg.evaluate(() => [S.ult.p.used, S.ult.a.used, S.ult.p.kind, S.ult.a.kind])))));
  await host.waitForTimeout(1500);
  const res = await Promise.all([host, guest].map(pg => pg.evaluate(() => [document.querySelector('#endTitle').textContent, S.stakes])));
  console.log('host sees:', res[0], ' guest sees:', res[1]);
  await host.screenshot({path: require('os').tmpdir() + '/pvp-end-host.png'});

  // rematch from the host; the guest must follow
  await host.evaluate(() => document.querySelector('#btnAgain').click());
  await guest.waitForFunction(() => S.turn === 1 && S.phase === 'play' && NET.game === 2, null, {timeout: 10000});
  console.log('rematch: guest followed host into game', await guest.evaluate(() => NET.game));

  // the friend disappears mid-game: the other side ends the game after the grace period
  await guest.evaluate(() => window.__gone());
  await guest.waitForFunction(() => S.phase === 'over', null, {timeout: 12000});
  console.log('friend left ->', await guest.textContent('#endTitle'));
  console.log('mismatched turns:', mismatches, ' errors:', errs);
  await b.close();
})();
