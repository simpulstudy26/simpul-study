/* 심풀 학습 노트 효과 — React Bits 컴포넌트를 바닐라 JS로 옮겨 자료 HTML에 붙인다. 내용은 바꾸지 않는다.
   BlurText(제목) · ShinyText(머리말) · AnimatedContent(카드 등장) · SpotlightCard(포인터 빛) · ClickSpark(누른 자리 불꽃)
   · Magnet(맨 위로 버튼) · 미끄러지는 탭 표시 · 읽은 만큼 차는 진행 막대 · (듀오링고 모드) 다 읽으면 축하 조각
   화면 모드(simpul.theme)와 듀오링고 모드(simpul.duo.v1, 바깥 사이트의 <html data-duo>)를 따라간다.
   자료가 화면을 다시 그려도(탭 전환 등) MutationObserver로 따라가고, 움직임 줄이기 설정에서는 효과를 끈다. */
(function () {
  'use strict';
  const html = document.documentElement;
  html.classList.remove('m-dark');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CARD = '[class*="card"]:not([class*="cards"]), [class*="box"]:not([class*="boxes"]):not(input), .panel, .cmp, .person, .quiz-item, .sum-block, .lesson-section, .map-root, .table-wrap, .tbl-wrap';
  const TABBAR = '.tab-bar, .tabs, .tab-nav, .navtabs, .mode-toggle, .unit-switch';
  const ACTIVE = '.active, .on, .selected, [aria-selected="true"]';
  const THEME_KEY = 'simpul.theme', DUO_KEY = 'simpul.duo.v1';
  const bars = new Set(); // 미끄러지는 표시를 붙인 탭 막대

  /* ── 화면 모드 · 듀오링고 모드 ── */
  function parentRoot() {
    try { if (parent !== window && parent.location.origin === location.origin) return parent.document.documentElement; } catch (e) { /* 다른 주소 */ }
    return null;
  }
  function storedMode() {
    const p = parentRoot();
    if (p) return p.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return html.dataset.materialTheme || 'dark'; }
  }
  function duoOn() {
    const p = parentRoot();
    if (p) return p.hasAttribute('data-duo');
    try { return JSON.parse(localStorage.getItem(DUO_KEY) || '{}').on === true; } catch (e) { return false; }
  }
  const isDuo = () => html.hasAttribute('data-material-duo');

  let modeButton;
  function applyMode(mode) {
    html.dataset.materialTheme = mode;
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.content = mode;
    if (modeButton) {
      const target = mode === 'dark' ? '라이트 모드' : '다크 모드';
      modeButton.textContent = target;
      modeButton.setAttribute('aria-label', target + '로 바꾸기');
      modeButton.title = target + '로 바꾸기';
    }
  }
  function applyDuo(on) {
    if (on) html.setAttribute('data-material-duo', ''); else html.removeAttribute('data-material-duo');
    html.style.setProperty('--m-spark', '');
    moveIndicators();
  }
  function sync() { applyMode(storedMode()); applyDuo(duoOn()); }

  function mountModeToggle() {
    if (document.getElementById('material-theme-toggle')) return;
    modeButton = document.createElement('button');
    modeButton.type = 'button';
    modeButton.id = 'material-theme-toggle';
    modeButton.className = 'material-mode-toggle';
    modeButton.addEventListener('click', () => {
      const next = html.dataset.materialTheme === 'dark' ? 'light' : 'dark';
      let synced = false;
      // 액자 바깥 사이트의 해·달 버튼을 눌러 사이트와 같이 바꾼다
      const p = parentRoot();
      if (p) {
        const toggle = p.ownerDocument.querySelector('.theme-toggle');
        if (toggle && (p.getAttribute('data-theme') === 'light') !== (next === 'light')) { toggle.click(); synced = true; }
      }
      if (!synced) {
        try { next === 'light' ? localStorage.setItem(THEME_KEY, 'light') : localStorage.removeItem(THEME_KEY); } catch (e) { /* 저장 불가 */ }
      }
      applyMode(next);
    });
    // 자료에 자기 머리글 버튼 줄이 있으면 그 줄 끝에 나란히 둔다
    const own = document.querySelector('.header-actions');
    if (own) { modeButton.classList.add('ui-in-flow'); own.append(modeButton); applyMode(storedMode()); return; }
    const slot = ['.title-row','.header-inner', '.topbar-in', '.top-in', '.topbar', '.page-header', 'header'].map(s => document.querySelector(s)).find(Boolean) || document.body;
    slot.append(modeButton);
    applyMode(storedMode());
  }
  addEventListener('storage', e => { if (e.key === THEME_KEY || e.key === DUO_KEY || e.key === null) sync(); });
  addEventListener('pageshow', sync);
  // 바깥 사이트에서 모드가 바뀌면 바로 따라간다
  const pr = parentRoot();
  if (pr && 'MutationObserver' in window) new MutationObserver(sync).observe(pr, { attributes: true, attributeFilter: ['data-theme', 'data-duo'] });
  sync();

  /* ── 다크 모드에서 밝게 칠한 SVG 도표 표시 ── */
  function isLightHex(v) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((v || '').trim());
    if (!m) return false;
    let h = m[1]; if (h.length === 3) h = h.replace(/./g, c => c + c);
    const n = parseInt(h, 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 510 > 0.85;
  }
  function markSvgs(root) {
    (root.querySelectorAll ? root.querySelectorAll('svg') : []).forEach(svg => {
      if (svg.classList.contains('m-inv') || svg.closest('button')) return;
      for (const node of svg.querySelectorAll('[fill],[stroke]')) {
        if (isLightHex(node.getAttribute('fill')) || (node.tagName === 'text' && /^#/.test(node.getAttribute('fill') || ''))) { svg.classList.add('m-inv'); return; }
      }
    });
  }

  /* ── BlurText: 제목 낱말마다 흐릿하게 내려오며 또렷해진다 ── */
  function blurText(node) {
    if (!node || reduce || node.dataset.mBlur || node.children.length > 3) return;
    const text = node.textContent.trim();
    if (!text || text.length > 60) return;
    node.dataset.mBlur = '1';
    let i = 0;
    [...node.childNodes].forEach(k => {
      if (k.nodeType !== 3 || !k.textContent.trim()) return;
      const frag = document.createElement('span');
      k.textContent.split(/(\s+)/).forEach(w => {
        if (!w) return;
        if (/^\s+$/.test(w)) { frag.append(w); return; }
        const s = document.createElement('span');
        s.className = 'm-blur-word';
        s.style.animationDelay = (i++ * 80) + 'ms';
        s.textContent = w;
        frag.append(s);
      });
      k.replaceWith(frag);
    });
  }

  /* ── ShinyText: 작은 머리말에 빛이 지나간다 ── */
  function shiny(root) {
    if (reduce || !root.querySelectorAll) return;
    root.querySelectorAll('.subject-label, .eyebrow').forEach(n => { if (n.children.length <= 2) n.classList.add('ui-shiny'); });
  }

  /* ── AnimatedContent: 카드가 처음 화면에 들어올 때 올라오며 나타남 ── */
  const io = !reduce && 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('m-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -6% 0px' }) : null;
  function reveal(root) {
    if (!io || !root.querySelectorAll) return;
    const list = root.matches && root.matches(CARD) ? [root] : [];
    root.querySelectorAll(CARD).forEach(n => list.push(n));
    let n = 0;
    list.forEach(card => {
      if (card.dataset.mSeen || card.closest('.page-header, .topbar, nav, header') || (card.parentElement && card.parentElement.closest('.m-reveal'))) return;
      card.dataset.mSeen = '1';
      const r = card.getBoundingClientRect();
      card.classList.add('m-reveal');
      if (r.top < innerHeight && r.bottom > 0 && r.height) {
        card.style.transitionDelay = Math.min(n++ * 45, 270) + 'ms';
        requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('m-in')));
        return;
      }
      io.observe(card);
    });
  }
  // 숨은 탭 안 카드는 보이게 된 뒤 등장한다. 너무 늦게 남은 카드는 그냥 보여 준다.
  addEventListener('beforeprint', () => document.querySelectorAll('.m-reveal').forEach(c => c.classList.add('m-in')));

  /* ── SpotlightCard: 포인터를 따라가는 빛 ── */
  if (!reduce) document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || !e.target.closest) return;
    const card = e.target.closest(CARD);
    if (!card) return;
    card.classList.add('m-spot');
    const r = card.getBoundingClientRect();
    card.style.setProperty('--m-x', (e.clientX - r.left) + 'px');
    card.style.setProperty('--m-y', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* ── 캔버스 하나로 ClickSpark·축하 조각을 그린다 ── */
  let canvas, ctx, parts = [], raf = 0;
  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'm-spark-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    ctx = canvas.getContext('2d');
    const size = () => { const d = devicePixelRatio || 1; canvas.width = innerWidth * d; canvas.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
  }
  function tick(now) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => {
      const t = (now - p.start) / p.life;
      if (t >= 1) return false;
      if (p.kind === 'spark') {
        const ease = t * (2 - t), dist = ease * p.reach, len = p.len * (1 - ease);
        const x1 = p.x + dist * Math.cos(p.a), y1 = p.y + dist * Math.sin(p.a);
        ctx.strokeStyle = p.color; ctx.lineWidth = p.w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + len * Math.cos(p.a), y1 + len * Math.sin(p.a)); ctx.stroke();
      } else {
        const s = (now - p.start) / 1000;
        const x = p.x + p.vx * s, y = p.y + p.vy * s + 520 * s * s;
        ctx.save(); ctx.globalAlpha = 1 - t; ctx.translate(x, y); ctx.rotate(p.r + s * p.spin);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
      }
      return true;
    });
    raf = parts.length ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const DUO_COLORS = ['#58CC02', '#FFC800', '#1CB0F6', '#FF4B4B', '#CE82FF', '#FF9600'];

  /* ClickSpark: 버튼·탭을 누른 자리에서 짧은 선이 튀어 나간다 (듀오링고 모드는 여러 색, 더 굵고 멀리) */
  if (!reduce) document.addEventListener('click', e => {
    if (!e.target.closest || !e.target.closest('button, [role="tab"], a, summary')) return;
    ensureCanvas();
    const duo = isDuo(), start = performance.now();
    const base = getComputedStyle(html).getPropertyValue('--m-spark').trim() || '#a1a1aa';
    const n = duo ? 10 : 8;
    for (let i = 0; i < n; i++) parts.push({
      kind: 'spark', x: e.clientX, y: e.clientY, a: Math.PI * 2 * i / n, start, life: duo ? 520 : 420,
      reach: duo ? 34 : 24, len: duo ? 11 : 9, w: duo ? 3 : 2, color: duo ? DUO_COLORS[i % DUO_COLORS.length] : base
    });
    run();
  });

  function confetti(x, y) {
    if (reduce) return;
    ensureCanvas();
    const start = performance.now();
    for (let i = 0; i < 70; i++) {
      const a = -Math.PI / 2 + (Math.random() - .5) * Math.PI * .9, v = 380 + Math.random() * 420;
      parts.push({ kind: 'bit', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, spin: (Math.random() - .5) * 12,
        size: 7 + Math.random() * 6, color: DUO_COLORS[i % DUO_COLORS.length], start, life: 1600 + Math.random() * 600 });
    }
    run();
  }

  /* ── Magnet: 맨 위로 버튼이 포인터 쪽으로 살짝 끌려온다 ── */
  function magnet(el) {
    if (reduce || !el || el.dataset.uiMagnet) return;
    el.dataset.uiMagnet = '1';
    const pad = 60, strength = 4;
    document.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const near = Math.abs(e.clientX - cx) < r.width / 2 + pad && Math.abs(e.clientY - cy) < r.height / 2 + pad;
      el.style.transform = near ? 'translate(' + (e.clientX - cx) / strength + 'px,' + (e.clientY - cy) / strength + 'px)' : '';
    }, { passive: true });
  }

  /* ── 미끄러지는 탭 표시 (shadcn Tabs + React Bits 움직임) ── */
  function setupTabs(root) {
    if (!root.querySelectorAll) return;
    const found = root.matches && root.matches(TABBAR) ? [root] : [];
    root.querySelectorAll(TABBAR).forEach(b => found.push(b));
    found.forEach(bar => {
      if (bars.has(bar) || bar.closest('.ui-has-indicator') && bar.closest('.ui-has-indicator') !== bar) return;
      if (!bar.querySelector('button, [role="tab"]')) return;
      bars.add(bar);
      if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
      const ind = document.createElement('span');
      ind.className = 'ui-tab-indicator';
      ind.setAttribute('aria-hidden', 'true');
      bar.prepend(ind);
      bar.classList.add('ui-has-indicator');
      new MutationObserver(() => moveIndicator(bar)).observe(bar, { attributes: true, subtree: true, attributeFilter: ['class', 'aria-selected'] });
      moveIndicator(bar);
    });
  }
  function moveIndicator(bar) {
    const ind = bar.querySelector(':scope > .ui-tab-indicator');
    if (!ind) return;
    const tab = [...bar.querySelectorAll('button, [role="tab"]')].find(b => b.matches(ACTIVE));
    if (!tab || !tab.offsetWidth) { ind.style.opacity = '0'; return; }
    ind.style.opacity = '1';
    ind.style.width = tab.offsetWidth + 'px';
    ind.style.height = tab.offsetHeight + 'px';
    // 버튼의 offsetParent가 탭 막대가 아닐 수도 있어 화면 좌표 차이로 잰다
    const br = bar.getBoundingClientRect(), tr = tab.getBoundingClientRect();
    ind.style.transform = 'translate(' + (tr.left - br.left + bar.scrollLeft - bar.clientLeft) + 'px,' + (tr.top - br.top + bar.scrollTop - bar.clientTop) + 'px)';
  }
  function moveIndicators() { bars.forEach(moveIndicator); }
  addEventListener('resize', moveIndicators);

  /* ── 읽은 만큼 차는 진행 막대 (듀오링고 모드: 레슨 진행 막대, 끝까지 읽으면 축하) ── */
  let bar, celebrated = false;
  function mountProgress() {
    bar = document.createElement('div');
    bar.className = 'ui-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.append(document.createElement('i'));
    document.body.append(bar);
    let pending = false;
    const update = () => {
      pending = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 40 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      bar.style.setProperty('--ui-read', p.toFixed(4));
      const done = p > .995;
      bar.classList.toggle('ui-done', done);
      if (done && !celebrated && isDuo()) {
        celebrated = true;
        const r = bar.getBoundingClientRect();
        confetti(r.right - 10, r.top);
      }
      if (p < .9) celebrated = false;
    };
    const queue = () => { if (!pending) { pending = true; requestAnimationFrame(update); } };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    document.addEventListener('click', () => setTimeout(queue, 60));
    update();
  }

  function enhance(root) { markSvgs(root); reveal(root); shiny(root); setupTabs(root); }
  function start() {
    if (!document.body) { addEventListener('DOMContentLoaded', start, { once: true }); return; }
    mountModeToggle();
    enhance(document.body);
    blurText(document.querySelector('.page-title, .hero h1, h1'));
    mountProgress();
    magnet(document.querySelector('.totop'));
    let queued = new Set(), pending = false;
    new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && !(n.classList && (n.classList.contains('ui-tab-indicator') || n.classList.contains('m-spark-canvas')))) queued.add(n); }));
      if (pending || !queued.size) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const nodes = [...queued]; queued = new Set();
        nodes.forEach(n => n.isConnected && enhance(n));
        const t = document.querySelector('.page-title, .hero h1');
        if (t && !t.dataset.mBlur) blurText(t);
        magnet(document.querySelector('.totop'));
        moveIndicators();
      });
    }).observe(document.body, { childList: true, subtree: true });
    // 글꼴이 늦게 오면 탭 폭이 바뀐다
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveIndicators);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
