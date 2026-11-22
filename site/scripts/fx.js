/* 심풀 움직임 효과 — React Bits의 BlurText · SpotlightCard · ClickSpark를 바닐라 JS로 옮김.
   라이브러리 없이 CSS 변수와 canvas만 쓴다. 움직임 줄이기 설정을 켠 기기에서는 아무것도 하지 않는다.
   window.FX = { blurText(el), spotlight(container, selector), spark(x, y, color) } */
(function () {
  'use strict';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const html = document.documentElement;

  /* BlurText: 낱말마다 흐릿하게 아래에서 올라오며 또렷해진다 */
  function blurText(node, { delay = 90 } = {}) {
    if (!node || reduce || node.dataset.fxBlur) return;
    node.dataset.fxBlur = '1';
    const words = node.textContent.trim().split(/\s+/);
    node.setAttribute('aria-label', node.textContent.trim());
    node.textContent = '';
    words.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'fx-blur-word';
      s.setAttribute('aria-hidden', 'true');
      s.style.animationDelay = (i * delay) + 'ms';
      s.textContent = w;
      node.append(s, i < words.length - 1 ? ' ' : '');
    });
  }

  /* SpotlightCard: 포인터를 따라 카드 안에 은은한 빛이 따라온다 (색은 --fx-spot) */
  function spotlight(container, selector) {
    if (!container || reduce) return;
    container.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const card = e.target.closest(selector);
      if (!card || !container.contains(card)) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--fx-x', (e.clientX - r.left) + 'px');
      card.style.setProperty('--fx-y', (e.clientY - r.top) + 'px');
    });
  }

  /* ClickSpark: 누른 자리에서 짧은 선 8개가 튀어 나간다. 화면 위 고정 canvas라 DOM이 다시 그려져도 남는다 */
  let canvas, ctx, sparks = [], raf = 0;
  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'fx-spark-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    ctx = canvas.getContext('2d');
    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    addEventListener('resize', size);
  }
  function tick(now) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    sparks = sparks.filter(s => {
      const t = (now - s.start) / 420;
      if (t >= 1) return false;
      const ease = t * (2 - t); // ease-out
      const dist = ease * 26, len = 10 * (1 - ease);
      const x1 = s.x + dist * Math.cos(s.a), y1 = s.y + dist * Math.sin(s.a);
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + len * Math.cos(s.a), y1 + len * Math.sin(s.a)); ctx.stroke();
      return true;
    });
    raf = sparks.length ? requestAnimationFrame(tick) : 0;
  }
  function spark(x, y, color) {
    if (reduce) return;
    ensureCanvas();
    const c = color || getComputedStyle(html).getPropertyValue('--fx-spark').trim() || '#facc15';
    const start = performance.now();
    for (let i = 0; i < 8; i++) sparks.push({ x, y, a: (Math.PI * 2 * i) / 8, start, color: c });
    if (!raf) raf = requestAnimationFrame(tick);
  }

  window.FX = { blurText, spotlight, spark, reduce };

  /* 홈: 제목은 인트로가 닫힌 뒤에 등장 */
  document.addEventListener('DOMContentLoaded', () => {
    const h1 = document.querySelector('[data-fx="blur"]');
    if (h1) {
      const run = () => blurText(h1);
      if (html.classList.contains('intro-open') || html.classList.contains('intro-pending')) {
        document.addEventListener('simpul:intro-done', run, { once: true });
      } else run();
    }
    spotlight(document.getElementById('subject-grid'), '.subject-link');
  });
})();
