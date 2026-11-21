/* 첫 화면 인트로 (심풀 1.0 인트로의 내용을 3.0 디자인으로 다시 만든 것)
   흐름: "심규원·최시원의 / 풀서비스 스터디"를 타자 치듯 쓴다 → "규원·최시원의"와 "서비스"가 사라진다
   → 남은 "심", "풀", "스터디"가 실제로 미끄러져 모여 "심풀 스터디"가 된다 → 학습 시작.
   브라우저를 새로 열었을 때 한 번만 나온다(이 탭에서 다시 안 나옴). 주소에 ?intro=1을 붙이면 다시 볼 수 있다. */
(function () {
  'use strict';
  const S = window.Simpul || {};
  const KEY = 'simpul.intro.seen';
  const force = new URLSearchParams(location.search).get('intro') === '1';
  let seen = false;
  try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) { /* 저장 불가 */ }
  const html = document.documentElement;
  if (seen && !force) { html.classList.remove('intro-pending'); return; }
  try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* 저장 불가 */ }

  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));

  /* ── 화면 만들기 ── */
  const root = make('div', 'intro');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', '심풀스터디 소개');
  const inner = make('div', 'intro-inner');
  const badge = make('span', 'intro-badge');
  badge.append(make('i', ''), document.createTextNode('SIMPUL STUDY PORTAL'));
  const title = make('h1', 'visually-hidden', '심규원·최시원의 풀서비스 스터디, 심풀 스터디');

  /* 글자 조각: keep은 끝까지 남고 drop은 사라진다 */
  const stage = make('div', 'intro-stage');
  stage.setAttribute('aria-hidden', 'true');
  const line1 = make('div', 'intro-line');
  const line2 = make('div', 'intro-line');
  const piece = (text, kind) => {
    const p = make('span', 'intro-piece ' + (kind === 'keep' ? 'is-keep' : 'is-drop'));
    [...text].forEach(ch => p.append(make('span', 'intro-ch', ch === ' ' ? ' ' : ch)));
    return p;
  };
  const shim = piece('심', 'keep'), name = piece('규원·최시원의', 'drop');
  const pul = piece('풀', 'keep'), service = piece('서비스', 'drop'), study = piece(' 스터디', 'keep');
  shim.classList.add('is-shim'); pul.classList.add('is-pul'); study.classList.add('is-study');
  line1.append(shim, name);
  line2.append(pul, service, study);
  stage.append(line1, line2);

  const sub = make('p', 'intro-sub', S.version && S.version.title ? S.version.title : '고1 내신 대비 자료실');
  const actions = make('div', 'intro-actions');
  const start = make('button', 'intro-start', '학습 시작');
  start.type = 'button';

  /* 모드 고르기: 2학기 기말 버전에서만(듀오링고 모드가 되는 버전). 지금 상태가 먼저 골라져 있다 */
  const D = S.duo && S.duo.allowed && S.duo.allowed() ? S.duo : null;
  let wantDuo = D ? D.active() : false;
  if (D) {
    const modes = make('div', 'intro-modes');
    modes.setAttribute('role', 'radiogroup');
    modes.setAttribute('aria-label', '공부 모드');
    const opt = (duo, icon, name, desc) => {
      const b = make('button', 'intro-mode' + (duo ? ' is-duo' : ''));
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.duo = duo ? '1' : '';
      b.append(make('span', 'intro-mode-icon', icon), make('b', '', name), make('small', '', desc));
      b.addEventListener('click', () => pick(duo));
      b.addEventListener('keydown', e => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); pick(!duo); modes.querySelector('[aria-checked="true"]').focus(); }
      });
      return b;
    };
    modes.append(
      opt(false, '📘', '기본 모드', '과목 자료와 무한 문제를 차분하게'),
      opt(true, '🔥', '듀오링고 모드', 'XP · 연속 학습일 · 5문제 레슨 · 학습 경로')
    );
    function pick(duo) {
      wantDuo = duo;
      modes.querySelectorAll('.intro-mode').forEach(b => {
        const on = !!b.dataset.duo === duo;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      start.textContent = duo === D.active() ? '학습 시작' : (duo ? '듀오링고 모드로 시작' : '기본 모드로 시작');
      start.classList.toggle('is-plain', !duo);
    }
    pick(wantDuo);
    actions.append(make('p', 'intro-modes-label', '어떻게 공부할까요?'), modes, make('p', 'intro-modes-note', '나중에 홈 위쪽 스위치로 언제든 바꿀 수 있어요.'));
  }
  actions.append(start);
  const skip = make('button', 'intro-skip', '건너뛰기');
  skip.type = 'button';

  inner.append(badge, title, stage, sub, actions);
  root.append(make('div', 'intro-bg'), inner, skip);
  document.body.append(root);
  html.classList.add('intro-open');
  html.classList.remove('intro-pending');
  skip.focus();

  /* ── 닫기 ── */
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    root.classList.add('is-leaving');
    html.classList.remove('intro-open');
    setTimeout(() => root.remove(), reduce ? 0 : 650);
    const target = document.querySelector('.page-head h1');
    if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
  }
  start.addEventListener('click', () => {
    if (D && wantDuo !== D.active()) { // 모드가 바뀌면 원이 퍼지며 새로고침 (?intro=1로 왔으면 그 표시를 지워 인트로가 다시 안 나오게)
      closed = true;
      if (force) { const u = new URL(location.href); u.searchParams.delete('intro'); history.replaceState(null, '', u); }
      D.set(wantDuo, start);
      return;
    }
    close();
  });
  skip.addEventListener('click', close);
  root.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  /* ── 애니메이션 ── */
  async function type(line, gap) {
    line.classList.add('is-typing');
    for (const ch of line.querySelectorAll('.intro-ch')) { ch.classList.add('is-on'); await wait(gap); }
    line.classList.remove('is-typing');
  }

  /* FLIP: 조각들의 위치를 재고 → 줄을 합친 뒤 → 원래 자리에서 새 자리로 미끄러지게 */
  function merge() {
    const keeps = [shim, pul, study];
    const before = keeps.map(k => k.getBoundingClientRect());
    line2.prepend(shim);
    line1.remove();
    stage.classList.add('is-merged');
    const after = keeps.map(k => k.getBoundingClientRect());
    keeps.forEach((k, i) => {
      const dx = before[i].left - after[i].left, dy = before[i].top - after[i].top;
      const s = before[i].height / after[i].height;
      k.style.transformOrigin = '0 0';
      k.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')';
    });
    void stage.offsetWidth;
    keeps.forEach(k => { k.style.transition = 'transform .8s cubic-bezier(.22,1,.36,1)'; k.style.transform = ''; });
  }

  /* 완성 순간: 듀오링고 색 도형이 글자 주변으로 퍼졌다가 둥둥 떠 있는다 */
  function burst() {
    const box = make('div', 'intro-burst');
    box.setAttribute('aria-hidden', 'true');
    const colors = ['#58CC02', '#1CB0F6', '#FFC800', '#FF9600', '#FF4B4B', '#58CC02', '#FFC800', '#1CB0F6', '#FF9600', '#FF4B4B'];
    const shapes = ['dot', 'pill', 'square', 'ring'];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = 0.62 + Math.random() * 0.38;
      const s = make('span', 'intro-bit is-' + shapes[i % shapes.length]);
      s.style.setProperty('--x', (Math.cos(ang) * dist * 50).toFixed(1) + 'vmin');
      s.style.setProperty('--y', (Math.sin(ang) * dist * 26).toFixed(1) + 'vmin');
      s.style.setProperty('--r', Math.round(Math.random() * 300 - 150) + 'deg');
      s.style.setProperty('--c', colors[i % colors.length]);
      s.style.setProperty('--d', (i * 0.025).toFixed(3) + 's');
      s.style.setProperty('--f', (3 + Math.random() * 2).toFixed(2) + 's');
      box.append(s);
    }
    stage.append(box);
  }

  async function play() {
    if (reduce) {
      [...stage.querySelectorAll('.intro-ch')].forEach(c => c.classList.add('is-on'));
      name.remove(); service.remove();
      line2.prepend(shim); line1.remove();
      stage.classList.add('is-merged', 'is-done');
      root.classList.add('is-final');
      return;
    }
    await wait(450);
    await type(line1, 105);
    await wait(250);
    await type(line2, 100);
    await wait(900);
    if (closed) return;
    stage.classList.add('is-focus'); // 남을 글자만 밝게
    await wait(700);
    [name, service].forEach(d => { d.style.maxWidth = d.getBoundingClientRect().width + 'px'; });
    void stage.offsetWidth;
    stage.classList.add('is-dropping'); // 나머지는 흐려지며 폭이 줄어든다
    await wait(750);
    name.remove(); service.remove();
    if (closed) return;
    merge();
    await wait(850);
    stage.classList.add('is-done');
    burst();
    root.classList.add('is-final');
    start.focus({ preventScroll: true });
  }
  play();
})();
