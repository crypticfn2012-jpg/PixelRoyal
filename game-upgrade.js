/* PixelRoyale upgrade layer.
   Add as the LAST script in index.html:  <script src="game-upgrade.js"></script>
   It wraps existing functions at runtime, so nothing in index.html is edited and removing the tag reverts everything. */
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- OG mode: open the real og/index.html ---------- */
  enterOGMode = function () {
    try { mpDisconnect(); } catch (e) {}
    try { if (G && G.run) { G.run = 0; G.paused = 0; } } catch (e) {}
    try { gp(0); } catch (e) {}
    location.href = './og/index.html';
  };

  /* ---------- Ranked ladder: persistent RP, divisions, streaks and seasonal-ready stats ---------- */
  const mmr = () => Number.isFinite(S.mmr) ? S.mmr : 1000;
  const RANKS = [
    {name:'Rookie',min:0,color:'#a9b3c2',icon:'I'},
    {name:'Bronze',min:100,color:'#cd8b55',icon:'II'},
    {name:'Silver',min:250,color:'#c7d3e3',icon:'III'},
    {name:'Gold',min:450,color:'#ffd166',icon:'IV'},
    {name:'Platinum',min:700,color:'#57e4d4',icon:'V'},
    {name:'Diamond',min:1000,color:'#67a9ff',icon:'VI'},
    {name:'Pulse',min:1400,color:'#d58aff',icon:'VII'},
    {name:'Royal',min:1850,color:'#ffcf70',icon:'VIII'}
  ];
  const rp = () => Math.max(0, Number(S.rankPoints ?? (Number.isFinite(S.mmr) ? S.mmr - 400 : 0)) || 0);
  const rankInfo = points => { let r=RANKS[0]; for(const x of RANKS) if(points>=x.min) r=x; return r; };
  const tier = m => rankInfo(Math.max(0,m-400)).name.toUpperCase();
  const nextRank = points => RANKS.find(r=>r.min>points)||null;
  let adMatches = 0, adLast = 0;
  const _ms = matchSkill;
  matchSkill = function () { return clamp(.7 * (mmr() - 1000) / 160 + .3 * _ms(), -3, 3); }; // bot difficulty follows SR
  const _rec = recordMatchResult;
  recordMatchResult = function (win) {
    const box = G && G.mode === 'box', u = G && G.u, place = win ? 1 : (G && G.place) || 24;
    const score = box ? (win ? 1 : 0) : (24 - place) / 23 * .8 + Math.min(.2, ((u && u.k) || 0) * .04);
    const delta = Math.round(34 * (score - .43) * 2);
    S.lastDelta = delta;
    S.rankDelta = delta;
    S.rankPoints = clamp(rp() + delta, 0, 2400);
    S.mmr = clamp(400 + S.rankPoints, 400, 2800);
    S.rankMatches = (Number(S.rankMatches)||0) + 1;
    S.rankWins = (Number(S.rankWins)||0) + (win ? 1 : 0);
    S.rankBest = Math.max(Number(S.rankBest)||0, S.rankPoints);
    S.rankStreak = delta >= 0 ? Math.max(0,Number(S.rankStreak)||0)+1 : Math.min(0,Number(S.rankStreak)||0)-1;
    save();
    adMatches++;
    _rec(win);
  };
  const note = () => {
    const e = $('ec');
    if (e && S.lastDelta != null) {
      const points=rp(), rank=rankInfo(points), next=nextRank(points), progress=next?Math.round((points-rank.min)/(next.min-rank.min)*100):100;
      e.innerHTML += '<br><span style="color:'+rank.color+';font-weight:900">RANKED · '+rank.name.toUpperCase()+' '+rank.icon+' · '+points+' RP ('+(S.lastDelta>=0?'+':'')+S.lastDelta+')</span>'
        + (next ? '<br><small style="color:#aebbd0">'+progress+'% to '+next.name+'</small>' : '<br><small style="color:#ffcf70">TOP RANK REACHED</small>');
      save();
    }
  };
  const _fin = finish;
  finish = function () { _fin(); if (G && G.mode !== 'box') note(); };
  const _fbm = finishBoxMatch;
  finishBoxMatch = function () { const was = G && G.over; _fbm(); if (!was) note(); };
  // Online queue sends the SR bucket; the Worker must use it to pair similar players (see notes).
  const _mc = mpConnect;
  mpConnect = function (p) { if (p && p.mode) { p.skill = Math.floor(mmr() / 200); p.mmr = mmr(); } return _mc(p); };
  const lb = $('lvlBadge');
  if (lb && lb.parentNode) { const s = document.createElement('small'); s.id = 'srBadge'; lb.parentNode.appendChild(s); }
  const _ui = ui;
  ui = function () {
    _ui();
    const points=rp(), rank=rankInfo(points), next=nextRank(points), s=$('srBadge');
    if (s) {
      s.textContent = rank.name.toUpperCase()+' '+rank.icon+' · '+points+' RP';
      s.style.color=rank.color;
      s.title=next ? Math.max(0,next.min-points)+' RP to '+next.name : 'Top rank reached';
    }
    const badge=$('lvlBadge');
    if (badge) badge.title='Ranked: '+rank.name+' · '+points+' RP'+(next?' · '+(next.min-points)+' RP to '+next.name:'');
  };

  /* ---------- Make Pulse shards feel like meaningful tactical power spikes ---------- */
  const shardBuffs = {
    overdrive:{duration:8,damageMult:1.28,incomingDamageMult:1.05,tradeoff:'Deal 28% more damage, take 5% more damage'},
    phase:{duration:3.5,speedMult:1.7,damageMult:.95,tradeoff:'Move 70% faster for 3.5s'},
    aegis:{duration:7,shield:35,speedMult:.94,tradeoff:'Gain 35 shield, move 6% slower'},
    vitalflow:{duration:10,healPerSec:5,shieldPerSec:3,tradeoff:'Restore health and shield over 10s'},
    pulseSurge:{duration:9,pulseDamageMult:1.28,tradeoff:'Pulse weapons deal 28% more damage'},
    quickcycle:{duration:9,reloadMult:.65,tradeoff:'Reload 35% faster'},
    deadeye:{duration:8,accuracyMult:.55,tradeoff:'Weapon spread reduced by 45%'},
    kinetic:{duration:7,speedMult:1.3,tradeoff:'Move 30% faster'},
    bulwark:{duration:8,incomingDamageMult:.68,tradeoff:'Take 32% less damage'},
    capacitor:{duration:8,fireRateMult:.78,tradeoff:'Fire 22% faster'},
    pulseguard:{duration:8,pulseDamageMult:1.2,incomingDamageMult:.84,tradeoff:'Pulse weapons deal 20% more damage and take 16% less damage'},
    overclock:{duration:7,fireRateMult:.82,reloadMult:.78,tradeoff:'Fire 18% faster and reload 22% faster'}
  };
  for (const sc of SHARD_CONFIG) if (shardBuffs[sc.id]) Object.assign(sc,shardBuffs[sc.id]);
  const _activateShard = activateShard;
  activateShard = function(p) {
    const before = p && p.shardCooldownUntil;
    _activateShard(p);
    if (!p || p !== G.u || !p.shardType || p.shardCooldownUntil === before) return;
    const sc=SHARD_CONFIG.find(q=>q.id===p.shardType);
    if(sc) { G.tip=sc.name+' ACTIVE · '+(sc.tradeoff||'Pulse power unleashed'); G.tt=2.2; }
    if (sc && sc.id==='phase') {
      p.pulseDashes=Math.min(3,(p.pulseDashes||0)+1);
      G.tip='PHASE BURST · SPEED + DASH'; G.tt=2.2;
    }
    if (sc && sc.id==='aegis') {
      p.sh=Math.min(100,p.sh+35);
      for(let i=0;i<14;i++) G.fx.push({x:p.x,y:p.y,vx:(R()-.5)*150,vy:(R()-.5)*150,l:.45,c:sc.color});
    }
    if (sc && sc.id==='medwave') p.hp=Math.min(p.mh,p.hp+30);
    if (sc && sc.id==='shieldwave') p.sh=Math.min(100,p.sh+35);
    save();
  };

  /* ---------- Wall editing: one edit per wall, edit again to reset ---------- */
  function applyEdit(w, sel) {
    const at = G.W.indexOf(w);
    if (at < 0) return false;
    const keep = wallSections(w).filter(p => !sel.includes(p.index));
    const grp = { o: { x: w.x, y: w.y, w: w.w, h: w.h }, maxHp: w.maxHp, ang: w.ang, own: w.o, n: keep.length, t: G.T };
    G.W.splice(at, 1, ...keep.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h, hp: w.hp, maxHp: w.maxHp, o: w.o, type: 'wall', ang: w.ang, grp, edited: true })));
    return true;
  }
  function resetEdit(w, by) {
    const g = w.grp; if (!g) return false;
    const say = m => { if (by === G.u) { G.tip = m; G.tt = 1.4; } };
    const ps = G.W.filter(x => x.grp === g);
    if (ps.length !== g.n) { say('Edit too damaged to reset'); return false; }
    const o = g.o;
    for (const q of G.P) if (q.alive && q.x > o.x - 16 && q.x < o.x + o.w + 16 && q.y > o.y - 16 && q.y < o.y + o.h + 16) { say('Space occupied'); return false; }
    const hp = ps.reduce((s, x) => s + x.hp, 0) / ps.length;
    for (const x of ps) G.W.splice(G.W.indexOf(x), 1);
    G.W.push({ x: o.x, y: o.y, w: o.w, h: o.h, hp, maxHp: g.maxHp, o: g.own, type: 'wall', ang: g.ang });
    say('Edit reset');
    return true;
  }
  beginEdit = function (wx, wy) {
    if (!G || !G.run || G.paused) return;
    G.buildMode = false; $('bw').textContent = 'BUILD'; $('bf').textContent = 'FIRE'; touchFire = 0;
    const u = G.u; let t = null, best = Infinity;
    for (const w of G.W) {
      if (w.o !== u) continue;
      const x = w.x + w.w / 2, y = w.y + w.h / 2, dc = Math.hypot(x - wx, y - wy), dp = Math.hypot(x - u.x, y - u.y);
      if (dp > 290) continue;
      const s = dc < 110 ? dc : dp + 100;
      if (s < best) { best = s; t = w; }
    }
    if (!t || best > 205) { G.tip = 'Aim at one of your walls to edit it'; G.tt = 1.4; return; }
    if (t.edited) { resetEdit(t, u); return; } // already edited: edit key resets it instead
    G.edit = { wall: t, selected: [] };
    G.tip = MOB ? 'Tap one tile or two touching tiles, then tap EDIT to confirm' : 'Select one tile or two touching tiles, then press ' + controlKey('edit', 'v').toUpperCase();
    G.tt = 2;
  };
  finishEdit = function () {
    if (!G || !G.edit) return;
    const e = G.edit, sel = e.selected.slice(); G.edit = null;
    if (!sel.length) { G.tip = 'Edit cancelled'; G.tt = 1; return; }
    if (applyEdit(e.wall, sel)) { G.tip = 'Edited · press edit on it again to reset'; snd(320, .07, 'triangle', .04); } else G.tip = 'That wall was destroyed';
    G.tt = 1.4;
  };

  /* ---------- Smarter bots: lead their shots, build in fights, peek through edits, reset when hurt ---------- */
  function vel(t) {
    const T = G.T;
    if (t._vt === undefined || T - t._vt > .5) { t._px = t.x; t._py = t.y; t._vt = T; t._vx = 0; t._vy = 0; }
    else if (T - t._vt > .1) { const d = T - t._vt; t._vx = (t.x - t._px) / d; t._vy = (t.y - t._py) / d; t._px = t.x; t._py = t.y; t._vt = T; }
    return [t._vx, t._vy];
  }
  function botEdit(b) {
    const t = b.tg;
    if (t && t.alive && b.td < 300 && b.bc <= 0 && b.wc <= 0 && G.mode !== 'box' && b.hp < b.mh * .8 && !G.W.some(w => w.o === b && Math.hypot(w.x - b.x, w.y - b.y) < 100)) {
      build(b, Math.atan2(t.y - b.y, t.x - b.x)); b.bc = 3 + R() * 2; return;
    }
    const own = G.W.filter(w => w.o === b); if (!own.length) return;
    for (const w of own) if (w.grp && (G.T - w.grp.t > 3.2 || b.hp < b.mh * .4)) { if (resetEdit(w, b)) return; }
    if (!t || !t.alive || (b.edCd || 0) > G.T || b.hp < b.mh * .5) return;
    const d = Math.hypot(t.x - b.x, t.y - b.y); if (d > 520 || d < 1) return;
    const ux = (t.x - b.x) / d, uy = (t.y - b.y) / d;
    for (const w of own) {
      if (w.edited) continue;
      const wx = w.x + w.w / 2, wy = w.y + w.h / 2, al = (wx - b.x) * ux + (wy - b.y) * uy, off = Math.abs((wx - b.x) * uy - (wy - b.y) * ux);
      if (al < 10 || al > 140 || off > 45) continue;
      let bi = 0, bd = 1e9;
      for (const p of wallSections(w)) { const o = Math.abs((p.x + p.w / 2 - b.x) * uy - (p.y + p.h / 2 - b.y) * ux); if (o < bd) { bd = o; bi = p.index; } }
      if (applyEdit(w, [bi])) b.edCd = G.T + 4 + R() * 3;
      return;
    }
  }
  const _ai = ai;
  ai = function (b, dt) {
    _ai(b, dt);
    if (b.alive && G && G.mode !== 'box' && G.T > 12) {
      /* Bosses are side objectives, not the bots' permanent target. Prefer nearby
         living players and only let a minority of bots stay on a boss at a time. */
      const target = b.tg;
      const isBossTarget = target && target.alive && target.bossOnly;
      if (isBossTarget) {
        const nearby = G.P.filter(p => p !== b && p.alive && !p.bot &&
          Math.hypot(p.x - b.x, p.y - b.y) < 760 && los(b, p))
          .sort((a, z) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(z.x - b.x, z.y - b.y));
        if (nearby.length && R() < .88) {
          b.tg = nearby[0];
          b.td = Math.hypot(nearby[0].x - b.x, nearby[0].y - b.y);
          b.bossFocusUntil = G.T + 5 + R() * 4;
        }
      }
      /* If a bot is already fighting a player, don't let the boss AI steal focus
         every quarter-second. Retarget only when the player target is gone or far away. */
      if (b.tg && !b.tg.bossOnly && (!b.tg.alive || Math.hypot(b.tg.x - b.x, b.tg.y - b.y) > 920)) {
        b.tg = null; b.td = 1e9;
      }
    }
    if (b.alive && !b.use && ((b.edT = (b.edT || 0) - dt) <= 0)) {
      b.edT = .5 + R() * .4; botEdit(b);
    }
  };

  /* ---------- Gun feel: bloom, kick, shells, layered sound, crosshair, hit markers, banners ---------- */
  function gunNoise(w, loud) {
    if (muted || !sndOn || !S.settings.sound || S.settings.volume <= 0 || loud <= 0) return;
    try {
      ac = ac || new AudioContext();
      const dur = w.p > 1 ? .16 : .09, n = ac.sampleRate * dur | 0, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = buf; f.type = 'bandpass'; f.frequency.value = w.pulse ? 2600 : w.d > 40 ? 900 : 1500;
      g.gain.value = .22 * loud * S.settings.volume / 100;
      s.connect(f); f.connect(g); g.connect(ac.destination); s.start();
    } catch (e) {}
  }
  const _fire = fire;
  fire = function (p, alt) {
    const g = p.guns && p.guns[p.cur]; if (!g) return _fire(p, alt);
    const before = g.a, a0 = p.ang, e0 = p.err, w = GUNS[g.t], me = p === G.u;
    if (p.bot && p.tg && p.tg.x != null && w && w.s) { // lead moving targets (accuracy scales with SR)
      const t = p.tg, d = Math.hypot(t.x - p.x, t.y - p.y), v = vel(t), tt = d / w.s * clamp(.45 + matchSkill() * .14, .15, .9);
      const a = Math.atan2(t.y + v[1] * tt - p.y, t.x + v[0] * tt - p.x), df = Math.atan2(Math.sin(a - p.ang), Math.cos(a - p.ang));
      if (Math.abs(df) < .5) p.ang += df;
    }
    if (me) p.err = e0 + (p.bloom || 0);
    _fire(p, alt);
    p.ang = a0; p.err = e0;
    if (w && !w.pulseSplash && g.a < before) {
      gunNoise(w, me ? 1 : clamp(1 - Math.hypot(p.x - G.u.x, p.y - G.u.y) / 500, 0, 1) * .5);
      if (S.settings.particles && G.fx.length < 260) G.fx.push({ x: p.x + Math.cos(a0 + 1.57) * 8, y: p.y + Math.sin(a0 + 1.57) * 8, vx: Math.cos(a0 + 1.4) * (60 + R() * 60), vy: Math.sin(a0 + 1.4) * (60 + R() * 60), l: .35, c: '#e8c15a', r: 1.6 });
      if (me) {
        if (w.r < .6) p.bloom = Math.min(.05, (p.bloom || 0) + Math.min(.02, .006 + .0006 / (w.r + .05)));
        if (S.settings.screenShake) G.kick = Math.min(4, (G.kick || 0) + Math.min(3, .6 + w.d * w.p * .035));
      }
    }
  };
  const _upd = upd;
  upd = function (dt) { _upd(dt); if (!G || !G.u) return; G.u.bloom = Math.max(0, (G.u.bloom || 0) - dt * .07); G.kick = Math.max(0, (G.kick || 0) - dt * 14); };
  const _dmg = dmg;
  dmg = function (p, d, o) {
    const was = p.alive; _dmg(p, d, o);
    if (was && G && o === G.u && p !== o) { const k = !p.alive; G.hm = { t: G.T, k }; snd(k ? 700 : 1300, .05, 'square', .035); }
  };
  const _bd = bossDamage;
  bossDamage = function (b, a, o) { _bd(b, a, o); if (G && o === G.u && a > 0) G.hm = { t: G.T, k: !b.alive }; };
  const _kill = kill;
  kill = function (p, o) {
    const was = p.alive; _kill(p, o);
    if (was && !p.alive && G && o === G.u && p !== o) {
      const c = (G.T - (G.lk || -99) < 6 ? (G.combo || 0) : 0) + 1; G.combo = c; G.lk = G.T;
      G.banner = { t: G.T, a: 'ELIMINATED ' + String(p.n).toUpperCase(), b: c > 4 ? 'RAMPAGE' : ['', '', 'DOUBLE ELIM', 'TRIPLE ELIM', 'QUAD ELIM'][c] };
    }
  };
  function overlay() {
    const u = G.u; if (!u.alive || G.paused) return;
    const T = G.T, sx = cv.width / innerWidth, W2 = cv.width, H2 = cv.height;
    cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.lineCap = 'round'; cx.shadowColor = '#000'; cx.shadowBlur = 3;
    if (!MOB) {
      cv.style.cursor = 'none';
      const x = ms.x * sx, y = ms.y * sx, g = u.guns[u.cur], w = g && GUNS[g.t], gap = 7 + (u.bloom || 0) * 160;
      cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = 2; cx.beginPath();
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { cx.moveTo(x + a * gap, y + b * gap); cx.lineTo(x + a * (gap + 7), y + b * (gap + 7)); }
      cx.stroke(); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x, y, 1.5, 0, 7); cx.fill();
      if (G.hm && T - G.hm.t < .18) {
        const k = G.hm.k, r = k ? 14 : 10; cx.strokeStyle = k ? '#ff4d4d' : '#fff'; cx.lineWidth = k ? 3 : 2; cx.beginPath();
        for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { cx.moveTo(x + a * 5, y + b * 5); cx.lineTo(x + a * r, y + b * r); }
        cx.stroke();
      }
    }
    if (G.banner && T - G.banner.t < 2.2) {
      const f = T - G.banner.t; cx.globalAlpha = Math.min(1, f * 6, (2.2 - f) * 2); cx.textAlign = 'center';
      cx.font = '900 22px Segoe UI,Arial'; cx.fillStyle = '#ffd447'; cx.fillText(G.banner.a, W2 / 2, H2 * .22);
      if (G.banner.b) { cx.font = '900 14px Segoe UI,Arial'; cx.fillStyle = '#ff8a5a'; cx.fillText(G.banner.b, W2 / 2, H2 * .22 + 24); }
      cx.globalAlpha = 1;
    }
    if (!S.tutDone) {
      if (T < 3) {
        const key = name => controlKey(name, ({build:'f',edit:'v',pickup:'e',reload:'r',med:'h',shield:'j',chug:'k',pause:'escape'})[name] || name).toUpperCase();
        const L = MOB
          ? ['Left stick MOVE · right stick AIM · hold FIRE', 'Build, edit, reload and items use the touch buttons']
          : ['WASD MOVE · MOUSE AIM & SHOOT · ' + key('reload') + ' RELOAD',
             key('pickup') + ' PICK UP · ' + key('build') + ' BUILD · ' + key('edit') + ' EDIT',
             key('med') + ' MEDKIT · ' + key('shield') + ' SHIELD · ' + key('chug') + ' CHUG · Q SHARD · SHIFT DASH'];
        const fade = T > 2.35 ? Math.max(0, (3 - T) / .65) : 1;
        cx.globalAlpha = fade; cx.shadowBlur = 0; cx.fillStyle = 'rgba(7,12,22,.78)';
        cx.fillRect(W2 / 2 - 230, H2 * .6, 460, 18 + L.length * 22); cx.fillStyle = '#eaf2ff'; cx.textAlign = 'center'; cx.font = '800 13px Segoe UI,Arial';
        L.forEach((s, i) => cx.fillText(s, W2 / 2, H2 * .6 + 26 + i * 22));
      } else { S.tutDone = 1; save(); }
    }
    cx.restore();
  }
  const _draw = draw;
  draw = function () {
    const u = G.u, k = S.settings.screenShake && G.kick > .05 ? G.kick : 0, kx = (R() - .5) * k, ky = (R() - .5) * k;
    u.x += kx; u.y += ky;
    try { _draw(); } finally { u.x -= kx; u.y -= ky; }
    overlay();
  };
  const _menu = menu;
  menu = function () { cv.style.cursor = ''; _menu(); };

  /* ---------- Ads: one midgame break after every 2 matches (3 min apart); rewarded ads stay opt-in ---------- */
  $('en').addEventListener('click', function (e) {
    const b = e.target.closest && e.target.closest('button'); if (!b) return;
    const txt = b.textContent.trim(), again = txt === 'PLAY AGAIN';
    if (!again && txt !== 'MENU') return;
    if (adMatches < 2 || Date.now() - adLast < 180000) return;
    e.stopPropagation(); e.preventDefault();
    adLast = Date.now(); adMatches = 0; b.disabled = true;
    ad('midgame').then(function () { b.disabled = false; if (again) play(G && G.mode || 'br'); else menu(); });
  }, true);

  /* ---------- Menu polish: controls hint + one-click PLAY ---------- */
  if (!$('menuHint')) { const d = document.createElement('div'); d.id = 'menuHint'; $('mn').appendChild(d); }
  selectMode('br');
})();
