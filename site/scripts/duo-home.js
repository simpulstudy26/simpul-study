/* 듀오링고 모드 홈: 오늘 상태(연속 학습일·XP·방패), 일일 퀘스트, 틀린 문제 복습, 과목별 단원 경로.
   듀오링고 모드가 꺼져 있으면 아무것도 하지 않는다. */
(function () {
  'use strict';
  const S = window.Simpul;
  const D = S.duo;
  if (!D || !D.active()) return;
  const el = S.el;
  const G = S.generators || { units: () => [], subjects: [] };

  const anchor = document.querySelector('.home-cloud');
  const root = el('section', { class: 'duo-home', 'aria-label': '듀오링고 모드' });
  anchor.before(root);

  /* 오늘 상태 */
  const day = D.today();
  const streak = D.streakNow();
  const goalPct = Math.min(100, Math.round(day.xp / D.goal() * 100));
  const ring = el('span', { class: 'duo-ring', style: '--p:' + goalPct, 'aria-hidden': 'true' }, [el('span', { text: goalPct + '%' })]);
  root.append(el('div', { class: 'duo-bar' }, [
    el('div', { class: 'duo-stat duo-fill duo-fill-orange' + (D.playedToday() ? ' is-lit' : '') }, [
      el('span', { class: 'duo-ico', 'aria-hidden': 'true', text: '🔥' }),
      el('span', {}, [el('b', { text: streak + '일' }), el('small', { text: D.playedToday() ? '연속 학습 중' : (streak ? '오늘 풀면 ' + (streak + 1) + '일' : '오늘 시작해요') })])
    ]),
    el('div', { class: 'duo-stat duo-fill duo-fill-blue' }, [
      ring,
      el('span', {}, [el('b', { text: day.xp + ' / ' + D.goal() + ' XP' }), el('small', { text: day.xp >= D.goal() ? '오늘 목표 달성!' : '오늘 목표까지 ' + (D.goal() - day.xp) + ' XP' })])
    ]),
    el('div', { class: 'duo-stat duo-fill duo-fill-green' }, [
      el('span', { class: 'duo-ico', 'aria-hidden': 'true', text: '🛡️' }),
      el('span', {}, [el('b', { text: '방패 ' + D.shields() + '개' }), el('small', { text: '7일 연속마다 1개 · 하루 빠져도 지켜 줘요' })])
    ])
  ]));

  /* 일일 퀘스트 + 틀린 문제 복습 */
  const questBox = el('div', { class: 'duo-panel duo-fill duo-fill-gold' }, [el('h2', { class: 'duo-h', text: '오늘의 퀘스트' })]);
  D.quests().forEach(q => questBox.append(el('div', { class: 'duo-quest' + (q.done ? ' is-done' : '') }, [
    el('span', { class: 'duo-quest-title', text: (q.done ? '✓ ' : '') + q.title }),
    el('span', { class: 'duo-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(q.goal), 'aria-valuenow': String(Math.min(q.now, q.goal)), 'aria-label': q.title }, [
      el('span', { style: 'width:' + q.pct + '%' })
    ]),
    el('span', { class: 'duo-quest-num', text: Math.min(q.now, q.goal) + '/' + q.goal })
  ])));

  const counts = D.mistakeCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const reviewBox = el('div', { class: 'duo-panel duo-fill duo-fill-red' }, [
    el('h2', { class: 'duo-h', text: '틀린 문제 복습' }),
    el('p', { class: 'duo-note', text: total ? '틀린 문제 ' + total + '개가 기다리고 있어요. 맞히면 목록에서 빠져요. (28일 지나면 자동으로 지워져요)' : '틀린 문제가 없어요. 레슨에서 틀린 문제는 여기에 모여요.' })
  ]);
  if (total) {
    const row = el('div', { class: 'duo-chips' });
    S.SUBJECTS.filter(s => counts[s.id]).forEach(s => row.append(el('a', { class: 'btn duo-chip', href: 'lesson.html?s=' + s.id + '&mode=review' }, [
      el('span', { class: 'dot', style: 'background:' + s.color, 'aria-hidden': 'true' }), document.createTextNode(s.name + ' ' + counts[s.id])
    ])));
    reviewBox.append(row);
  }
  root.append(el('div', { class: 'duo-grid' }, [questBox, reviewBox]));

  /* ── 학습 경로: 시험범위(ranges.js)를 단계로 나눈 길 ──
     단계 종류: 공부(범위를 펴고 보고 ‘공부했어요’) · 문제(5문제 레슨, 정답 UNIT_GOAL개면 완료) · 자료(열면 완료).
     문제 은행·생성기·내 문제의 단원과 catalog 자료를 열 때마다 다시 모으므로, 새로 생기면 경로에 자동으로 붙는다. */
  const RG = S.ranges;
  const pathBox = el('div', { class: 'duo-panel duo-paths duo-fill duo-fill-green', id: 'duo-path' }, [
    el('h2', { class: 'duo-h', text: '학습 경로 · 시험범위 한 바퀴' }),
    el('p', { class: 'duo-note', text: '시험범위를 12쪽 안팎씩 나눈 길이에요. 동그라미를 눌러 그 부분을 공부하고 ‘공부했어요’를 누르세요. ? 는 문제 레슨, ≡ 는 자료예요. 끝까지 가면 범위를 한 번 다 본 거예요.' })
  ]);
  const tabs = el('div', { class: 'duo-path-tabs', role: 'tablist', 'aria-label': '과목' });
  const stage = el('div', { class: 'duo-path-stage' });
  pathBox.append(tabs, stage);
  root.append(pathBox);

  function unitsOf(index, s) {
    const set = new Set(Object.keys(((index.subjects || {})[s.id] || {}).units || {}).sort());
    G.units(s.id).forEach(u => set.add(u));
    if (S.mine) S.mine.forSubject(s.id).forEach(q => set.add(q.u));
    return [...set].filter(Boolean);
  }

  const nodeDone = n => n.type === 'quiz' ? D.unitProgress(n.s, n.unit) >= D.UNIT_GOAL : RG.isDone(n.id);
  const nodePct = n => n.type === 'quiz' ? Math.min(100, Math.round(D.unitProgress(n.s, n.unit) / D.UNIT_GOAL * 100)) : (RG.isDone(n.id) ? 100 : 0);
  function sectionsOf(x) {
    const secs = RG.path(x.s.id, x.units, x.s.items);
    secs.forEach(sec => sec.nodes.forEach(n => { n.s = x.s.id; }));
    return secs;
  }
  const countOf = secs => {
    const all = secs.flatMap(sec => sec.nodes);
    return { done: all.filter(nodeDone).length, total: all.length };
  };

  /* 범위 구간 머리 띠 색 (듀오링고 유닛 색: 파랑·보라·주황·분홍·하늘·빨강 순서로 돌려 씀) */
  const SEC_TONES = [['#1CB0F6', '#1899D6'], ['#CE82FF', '#A568CC'], ['#FF9600', '#CD7900'], ['#FF86D0', '#D96BAE'], ['#2B70C9', '#1F5AA3'], ['#FF4B4B', '#EA2B2B']];
  let openId = null;
  function drawPath(x) {
    const s = x.s, secs = sectionsOf(x);
    stage.replaceChildren();
    if (!secs.length) {
      stage.append(el('p', { class: 'duo-note', text: s.name + ' 시험범위가 아직 없어요.' }));
      return;
    }
    const list = el('ol', { class: 'duo-path' });
    let currentMarked = false, i = 0;
    secs.forEach((sec, si) => {
      const c = countOf([sec]);
      const tone = SEC_TONES[si % SEC_TONES.length];
      list.append(el('li', { class: 'duo-sec' + (sec.extra ? ' is-extra' : '') + (c.done === c.total ? ' is-done' : ''), style: sec.extra || c.done === c.total ? null : '--sec:' + tone[0] + ';--sec-deep:' + tone[1] }, [
        el('span', { class: 'duo-sec-kicker', text: sec.extra ? '더 연습' : '범위 ' + (si + 1) }),
        el('span', { class: 'duo-sec-title', text: sec.title }),
        el('span', { class: 'duo-sec-count', text: c.done + ' / ' + c.total + (sec.sub && !sec.extra ? ' · ' + sec.sub : '') })
      ]));
      sec.nodes.forEach(n => {
        const done = nodeDone(n);
        const isCurrent = !done && !currentMarked && !sec.extra;
        if (isCurrent) currentMarked = true;
        const face = done ? '★' : n.type === 'quiz' ? '?' : n.type === 'material' ? '≡' : String(i + 1);
        const cls = 'duo-node duo-node-' + n.type + (done ? ' is-done' : '') + (isCurrent ? ' is-current' : '');
        const style = '--p:' + nodePct(n) + ';--c:' + s.color;
        const kind = n.type === 'quiz' ? '문제 레슨' : n.type === 'material' ? '자료' : '공부';
        const label = n.label + ' · ' + kind + ' · ' + (done ? '완료' : n.type === 'quiz' ? D.unitProgress(n.s, n.unit) + '/' + D.UNIT_GOAL + ' 정답' : '아직');
        let node;
        if (n.type === 'quiz') {
          node = el('a', { class: cls, href: 'lesson.html?s=' + s.id + '&u=' + encodeURIComponent(n.unit), style, 'aria-label': label });
        } else if (n.type === 'material') {
          node = el('a', { class: cls, href: S.hrefFor(n.mat), style, 'aria-label': label });
          node.addEventListener('click', () => RG.setDone(n.id, true));
        } else {
          node = el('button', { class: cls, type: 'button', style, 'aria-label': label, 'aria-expanded': String(openId === n.id) });
          node.addEventListener('click', () => { openId = openId === n.id ? null : n.id; drawPath(x); focusNode(n.id); });
        }
        node.dataset.id = n.id;
        node.append(el('span', { class: 'duo-node-face', 'aria-hidden': 'true', text: face }));
        const li = el('li', { style: '--x:' + [0, 1, 2, 1, 0, -1, -2, -1][i % 8] }, [
          isCurrent ? el('span', { class: 'duo-bubble', text: '시작' }) : null,
          node,
          el('span', { class: 'duo-node-label', text: n.label })
        ]);
        list.append(li);
        if (n.type === 'study' && openId === n.id) list.append(el('li', { class: 'duo-step-row' }, [studyCard(x, n, sec, done)]));
        i++;
      });
    });
    const all = countOf(secs), finished = all.total && secs.filter(sec => !sec.extra).every(sec => sec.nodes.every(nodeDone));
    list.append(el('li', { class: 'duo-goal' + (finished ? ' is-done' : '') }, [
      el('span', { class: 'duo-goal-cup', 'aria-hidden': 'true', text: '🏆' }),
      el('span', { class: 'duo-node-label', text: finished ? s.name + ' 시험범위를 한 번 다 봤어요!' : '여기까지 오면 ' + s.name + ' 시험범위를 한 번 다 본 거예요' })
    ]));
    stage.append(list);
    if (x.tab) x.tab.textContent = s.name + ' ' + all.done + '/' + all.total;
  }

  function studyCard(x, n, sec, done) {
    const quiz = sec.nodes.filter(m => m.type === 'quiz');
    const mats = sec.nodes.filter(m => m.type === 'material');
    const pages = n.item.p ? n.label.replace(/^.*?(p\.)/, '$1') : n.item.text;
    const card = el('div', { class: 'duo-step', role: 'group', 'aria-label': n.label }, [
      el('strong', { text: n.label }),
      el('p', { text: done ? '공부한 단계예요. 다시 보고 싶으면 펴서 훑어보세요.'
        : n.item.src + '에서 ' + pages + (n.item.p ? ' 부분을 펴고 읽어 보세요. 굵은 글씨·표·그림 설명까지 한 번씩 보면 돼요.' : ' 부분을 꺼내 한 번 훑어보세요.') })
    ]);
    const row = el('div', { class: 'duo-step-actions' });
    const btn = el('button', { type: 'button', class: 'btn btn-primary', text: done ? '다시 공부할래요' : '공부했어요 ✓' });
    btn.addEventListener('click', e => {
      RG.setDone(n.id, !done);
      if (!done) D.sound && D.sound('ok');
      if (!done && window.FX) { const r = btn.getBoundingClientRect(); FX.spark(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2); }
      openId = null; drawPath(x);
      const next = stage.querySelector('.duo-node.is-current');
      if (next) next.focus(); else focusNode(n.id);
    });
    row.append(btn);
    quiz.slice(0, 2).forEach(q => row.append(el('a', { class: 'btn btn-secondary', href: 'lesson.html?s=' + x.s.id + '&u=' + encodeURIComponent(q.unit), text: '문제 풀기: ' + q.label })));
    mats.slice(0, 2).forEach(m => row.append(el('a', { class: 'btn btn-secondary', href: S.hrefFor(m.mat), text: '자료: ' + m.label })));
    card.append(row);
    return card;
  }
  function focusNode(id) { const b = stage.querySelector('[data-id="' + CSS.escape(id) + '"]'); if (b) b.focus(); }

  (async function init() {
    let index = { subjects: {} };
    try { index = await (await fetch('./cloud/index.json', { cache: 'no-store' })).json(); } catch (e) { /* 문제 은행 없음 */ }
    const withUnits = S.SUBJECTS.map(s => ({ s, units: unitsOf(index, s) }));
    const back = withUnits.find(x => x.s.id === new URLSearchParams(location.search).get('ps')); // 레슨에서 돌아온 과목
    const first = back || withUnits[0];
    withUnits.forEach(x => {
      const c = countOf(sectionsOf(x));
      const b = el('button', { type: 'button', role: 'tab', 'aria-selected': x === first ? 'true' : 'false', text: x.s.name + ' ' + c.done + '/' + c.total });
      x.tab = b;
      b.addEventListener('click', () => {
        tabs.querySelectorAll('button').forEach(t => t.setAttribute('aria-selected', t === b ? 'true' : 'false'));
        openId = null;
        drawPath(x);
      });
      tabs.append(b);
    });
    drawPath(first);
    if (location.hash === '#duo-path') pathBox.scrollIntoView({ block: 'start' });
  })();
})();
