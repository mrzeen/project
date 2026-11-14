// Tune the battle rules: for several (HP, per-realm damage cap) settings, simulate AI-vs-AI games
// with preset decks and report when and how games end.
const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + __dirname + '/index.html'); await p.waitForTimeout(500);
  const out = await p.evaluate(() => {
    window.render = () => {}; window.toast = () => {};
    function plan(side){
      const o = OPP[side]; let e = S.energy[side];
      for (const c of [...S.hand[side]].sort((x,y)=>y.cost-x.cost || Math.random()-.5)){
        if (c.cost > e) continue; let best=-1, bs=-Infinity;
        S.locs.forEach((L,li) => { if (!canPlace(c,li)) return;
          let est = c.power + c.buff; if (c.el && L.el){ if (c.el===L.el) est++; else if (BEATS[L.el]===c.el) est--; }
          if (L.mod) est += L.mod(c, L);
          const s = est - L.cards[side].length*0.6 + Math.random()*2; if (s>bs){ bs=s; best=li; } });
        if (best>=0){ S.hand[side].splice(S.hand[side].indexOf(c),1); c.loc=best; S.locs[best].cards[side].push(c); S.pending[side].push(c); e-=c.cost; }
      }
    }
    const keys = Object.keys(PRESETS), rows = [];
    for (const [hp, cap, maxt, r0, r1] of [[25,6,8,0,8],[25,6,8,1,8],[25,6,8,1,5],[25,6,8,2,6],[30,6,8,1,5],[30,6,8,2,6],[30,5,8,2,6]]){
      HP0 = hp; LANE_CAP = cap; MAXT = maxt; RALLY = [r0, r1];
      const st = {n:0, ends:{}, ko:0, lead:0, swing:0, deck:{}};
      keys.forEach(k => st.deck[k] = {w:0, n:0});
      for (let g=0; g<1500; g++){
        const ka = keys[g%keys.length], kb = keys[Math.floor(Math.random()*keys.length)];
        newGame({decks:{host:PRESETS[ka].ids, guest:PRESETS[kb].ids}}); FX = [];
        let t, leader3 = null;
        for (t=1; t<=maxt; t++){
          if (t>1){ S.turn = t; for (const s of ['p','a']){ S.energy[s]=S.maxE[s]=t+S.bonus[s]+rallyFor(s); S.bonus[s]=0; draw(s); } }
          plan('p'); plan('a');
          const first = t%2===1 ? 'p':'a';
          for (const c of [...S.pending[first], ...S.pending[OPP[first]]]){
            if (!locOf(c).cards[c.owner].includes(c)) continue;
            c.revealed = true; if (c.dark) addKarma(c.owner, c.dark*(locOf(c).karmaX??1));
            if (c.reveal) c.reveal(c); if (locOf(c).onHere) locOf(c).onHere(c);
          }
          S.pending = {p:[],a:[]}; karmaCheck(); FX = [];
          for (const h of clashList()) S.hp[h.loser] -= h.dmg;
          if (t===3) leader3 = S.hp.p===S.hp.a ? null : S.hp.p>S.hp.a ? 'p' : 'a';
          if (S.hp.p<=0 || S.hp.a<=0) break;
        }
        t = Math.min(t, maxt); const w = result();
        st.n++; st.ends[t] = (st.ends[t]||0)+1; if (S.hp.p<=0 || S.hp.a<=0) st.ko++;
        if (leader3 && w){ st.lead++; if (w!==leader3) st.swing++; }
        st.deck[ka].n++; st.deck[kb].n++; if (w==='p') st.deck[ka].w++; if (w==='a') st.deck[kb].w++;
      }
      rows.push({hp, cap: cap+' rally '+r0+'/'+r1, ends: st.ends, ko: (100*st.ko/st.n).toFixed(0)+'%', comeback: (100*st.swing/st.lead).toFixed(0)+'%',
                 decks: Object.fromEntries(keys.map(k => [k, (100*st.deck[k].w/st.deck[k].n).toFixed(0)+'%']))});
    }
    return rows;
  });
  for (const r of out) console.log(`HP ${r.hp} cap ${r.cap}  end turn ${JSON.stringify(r.ends)}  KO ${r.ko}  comeback after T3 ${r.comeback}\n    decks ${JSON.stringify(r.decks)}`);
  await b.close();
})();
