/* 심풀 자료 공통 움직임 — React Bits의 BlurText · SpotlightCard · AnimatedContent · ClickSpark를 바닐라 JS로 옮김.
   자료 HTML이 그 자리에서 화면을 다시 그려도(탭 전환 등) MutationObserver로 따라간다.
   움직임 줄이기 설정을 켠 기기에서는 효과를 쓰지 않는다. */
(function () {
  'use strict';
  const html = document.documentElement;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CARD = '[class*="card"]:not([class*="cards"]), [class*="box"]:not([class*="boxes"]):not(input), .panel, .cmp, .person, .quiz-item';

  /* 화면 모드: 사이트(simpul.theme)와 같은 값. 다른 탭에서 바꿔도 바로 따라감 */
  function applyTheme() {
    let light = false;
    try { light = localStorage.getItem('simpul.theme') === 'light'; } catch (e) {}
    html.classList.toggle('m-dark', !light);
  }
  addEventListener('storage', e => { if (e.key === 'simpul.theme') applyTheme(); });
  applyTheme();

  /* 다크 모드에서 밝은 색을 직접 칠한 SVG 도표 표시 */
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
      const filled = svg.querySelectorAll('[fill],[stroke]');
      for (const node of filled) {
        if (isLightHex(node.getAttribute('fill')) || (node.tagName === 'text' && /^#/.test(node.getAttribute('fill') || ''))) { svg.classList.add('m-inv'); return; }
      }
    });
  }

  /* BlurText: 제목 낱말마다 흐릿하게 내려오며 또렷해진다 */
  function blurText(node) {
    if (!node || reduce || node.dataset.mBlur || node.children.length > 3) return;
    const text = node.textContent.trim();
    if (!text || text.length > 60) return;
    node.dataset.mBlur = '1';
    const kids = [...node.childNodes];
    let i = 0;
    kids.forEach(k => {
      if (k.nodeType !== 3 || !k.textContent.trim()) return;
      // 제목이 flex여도 낱말 사이가 벌어지지 않게 한 덩어리로 감싼다
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

  /* AnimatedContent: 카드가 처음 화면에 들어올 때 올라오며 나타남 */
  const io = !reduce && 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('m-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -6% 0px' }) : null;
  function reveal(root) {
    if (!io || !root.querySelectorAll) return;
    const list = root.matches && root.matches(CARD) ? [root] : [];
    root.querySelectorAll(CARD).forEach(n => list.push(n));
    let n = 0;
    list.forEach(card => {
      if (card.dataset.mSeen || card.closest('.page-header, .topbar, nav') || card.parentElement.closest('.m-reveal')) return;
      card.dataset.mSeen = '1';
      const r = card.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0 && r.height) { card.classList.add('m-reveal'); card.style.transitionDelay = Math.min(n++ * 40, 240) + 'ms'; requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('m-in'))); return; }
      card.classList.add('m-reveal');
      io.observe(card);
    });
  }

  /* SpotlightCard: 포인터를 따라가는 빛 */
  if (!reduce) document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || !e.target.closest) return;
    const card = e.target.closest(CARD);
    if (!card) return;
    card.classList.add('m-spot');
    const r = card.getBoundingClientRect();
    card.style.setProperty('--m-x', (e.clientX - r.left) + 'px');
    card.style.setProperty('--m-y', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* ClickSpark: 버튼·탭을 누른 자리에서 짧은 선이 튀어 나간다 */
  let canvas, ctx, sparks = [], raf = 0;
  function tick(now) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    sparks = sparks.filter(s => {
      const t = (now - s.start) / 420;
      if (t >= 1) return false;
      const ease = t * (2 - t), dist = ease * 24, len = 9 * (1 - ease);
      const x1 = s.x + dist * Math.cos(s.a), y1 = s.y + dist * Math.sin(s.a);
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + len * Math.cos(s.a), y1 + len * Math.sin(s.a)); ctx.stroke();
      return true;
    });
    raf = sparks.length ? requestAnimationFrame(tick) : 0;
  }
  if (!reduce) document.addEventListener('click', e => {
    if (!e.target.closest || !e.target.closest('button, [role="tab"], a, summary')) return;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'm-spark-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.append(canvas);
      ctx = canvas.getContext('2d');
      const size = () => { const d = devicePixelRatio || 1; canvas.width = innerWidth * d; canvas.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
      size(); addEventListener('resize', size);
    }
    const color = getComputedStyle(html).getPropertyValue('--m-spark').trim() || '#facc15';
    const start = performance.now();
    for (let i = 0; i < 8; i++) sparks.push({ x: e.clientX, y: e.clientY, a: Math.PI * i / 4, start, color });
    if (!raf) raf = requestAnimationFrame(tick);
  });

  function enhance(root) { markSvgs(root); reveal(root); }
  function start() {
    enhance(document.body);
    blurText(document.querySelector('.page-title, .hero h1, h1'));
    let queued = new Set(), pending = false;
    new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) queued.add(n); }));
      if (pending || !queued.size) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const nodes = [...queued]; queued = new Set();
        nodes.forEach(n => n.isConnected && enhance(n));
        const t = document.querySelector('.page-title, .hero h1');
        if (t && !t.dataset.mBlur) blurText(t);
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
