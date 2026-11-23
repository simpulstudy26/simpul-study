/* 불꽃 — 연속 정답·연속 학습일 표시용 납작한 만화풍 불꽃 (심풀이 직접 그린 SVG, 라이브러리 없음).
   듀오링고식 표현을 따름: 꺼져 있으면 회색, 붙으면 주황·노랑 겹 불꽃이 일렁이고, 붙는 순간 통통 튄다.
   S.flame.icon({ lit, size, big })  → <span class="fl">   (size: px, big: 연속 학습 화면용 큰 불꽃)
   S.flame.set(el, lit, level)        켜기·끄기, level 0~3이면 일렁임이 빨라지고 커진다
   S.flame.burst(x, y, { count }) / S.flame.burstAt(el)   불티(둥근 조각)가 튄다
   움직임 줄이기 설정이면 일렁임·불티 없이 모양만 바뀐다. */
(function () {
  'use strict';
  const S = window.Simpul = window.Simpul || {};
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SVG = `
<svg viewBox="0 0 64 80" aria-hidden="true" focusable="false">
  <g class="fl-outer"><path d="M32 2 C36 14 50 22 54 38 C59 58 48 76 32 77 C16 76 5 64 8 46 C10 34 18 30 19 20 C25 26 26 32 26 32 C28 20 30 12 32 2 Z"/></g>
  <g class="fl-mid"><path d="M33 24 C37 34 46 40 46 53 C46 66 40 72 32 72 C23 72 17 66 18 55 C19 47 24 44 25 38 C28 42 29 46 29 46 C30 38 31 31 33 24 Z"/></g>
  <g class="fl-core"><path d="M32 46 C35 52 39 56 39 62 C39 68 36 71 32 71 C28 71 25 68 25 63 C25 58 29 55 32 46 Z"/></g>
  <path class="fl-shine" d="M17 46 C16 40 19 35 22 31"/>
</svg>`;

  function icon(opts) {
    opts = opts || {};
    const el = document.createElement('span');
    el.className = 'fl' + (opts.big ? ' fl-big' : '') + (opts.className ? ' ' + opts.className : '');
    if (opts.size) el.style.setProperty('--fl-size', opts.size + 'px');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = SVG.trim();
    set(el, opts.lit !== false, opts.level || 0, true);
    return el;
  }

  /* 켜기·끄기. 꺼져 있다가 켜지면 통통 튄다 */
  function set(el, lit, level, quiet) {
    if (!el) return;
    const was = el.classList.contains('is-lit');
    el.classList.toggle('is-lit', !!lit);
    el.dataset.level = String(Math.max(0, Math.min(3, Math.round(level || 0))));
    if (lit && !was && !quiet && !reduce) { el.classList.remove('is-pop'); void el.offsetWidth; el.classList.add('is-pop'); }
  }

  /* ── 불티: 둥근 주황·노랑 조각이 위로 튀었다 떨어진다 (화면 위 고정 canvas 하나) ── */
  let bc, bctx, bits = [], raf = 0, last = 0;
  const COLORS = ['#FF9600', '#FFC800', '#FF4B4B', '#FFB020'];
  function ensure() {
    if (bc) return;
    bc = document.createElement('canvas');
    bc.className = 'fl-burst-canvas';
    bc.setAttribute('aria-hidden', 'true');
    document.body.append(bc);
    bctx = bc.getContext('2d');
    const size = () => { const d = Math.min(2, devicePixelRatio || 1); bc.width = innerWidth * d; bc.height = innerHeight * d; bctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
  }
  function tick(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    bctx.clearRect(0, 0, innerWidth, innerHeight);
    bits = bits.filter(b => {
      b.age += dt / b.life;
      if (b.age >= 1) return false;
      b.vy += 520 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      bctx.globalAlpha = Math.min(1, (1 - b.age) * 1.6);
      bctx.fillStyle = b.c;
      bctx.beginPath(); bctx.arc(b.x, b.y, b.r * (1 - b.age * 0.5), 0, Math.PI * 2); bctx.fill();
      return true;
    });
    bctx.globalAlpha = 1;
    raf = bits.length ? requestAnimationFrame(tick) : 0;
    if (!raf) last = 0;
  }
  function burst(x, y, opts) {
    if (reduce) return;
    ensure();
    const n = (opts && opts.count) || 16;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1, sp = 160 + Math.random() * 220;
      bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2.5 + Math.random() * 3.5, age: 0, life: 0.6 + Math.random() * 0.4, c: COLORS[i % COLORS.length] });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  const burstAt = (el, opts) => { if (!el) return; const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height * 0.4, opts); };

  S.flame = { icon, set, burst, burstAt, reduce };
})();
