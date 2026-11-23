(function () {
  'use strict';
  const S = window.Simpul;
  const el = S.el;
  const id = new URLSearchParams(location.search).get('s');
  const subject = S.findSubject(id) || S.SUBJECTS[0];

  document.title = subject.name + ' 자료 · 심풀스터디';
  document.getElementById('crumb-subject').textContent = subject.name;
  document.getElementById('subject-title').textContent = subject.name + ' 자료';
  document.querySelector('.page-head .crumbs').after(S.versionTabs());
  document.getElementById('subject-summary').textContent = subject.summary + (subject.items.length ? ' · 자료 ' + subject.items.length + '개' : '');

  const tabs = document.getElementById('subject-tabs');
  S.SUBJECTS.forEach(s => {
    tabs.append(el('li', {}, [
      el('a', { href: 'subject.html?s=' + s.id, 'aria-current': s.id === subject.id ? 'page' : null, text: s.name })
    ]));
  });
  const current = tabs.querySelector('[aria-current]');
  if (current) current.scrollIntoView({ block: 'nearest', inline: 'center' });

  /* shadcn Tabs + 움직이는 표시: 고른 과목 아래 흰 칸이 포인터를 따라 미끄러진다 */
  tabs.style.setProperty('--fx-spot', subject.color);
  const pill = el('li', { class: 'tab-pill', 'aria-hidden': 'true' });
  tabs.prepend(pill);
  function movePill(a, instant) {
    if (!a) { pill.style.opacity = '0'; return; }
    if (instant) pill.style.transition = 'none';
    pill.style.opacity = '1';
    pill.style.width = a.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + (a.offsetLeft - 3) + 'px)';
    if (instant) { pill.offsetWidth; pill.style.transition = ''; }
  }
  tabs.classList.add('has-pill');
  movePill(current, true);
  addEventListener('resize', () => movePill(current, true));
  if (document.fonts) document.fonts.ready.then(() => movePill(current, true));
  tabs.addEventListener('pointerover', e => { const a = e.target.closest('a'); if (a) movePill(a); });
  tabs.addEventListener('pointerleave', () => movePill(current));
  tabs.addEventListener('focusin', e => { const a = e.target.closest('a'); if (a) movePill(a); });

  if (window.FX) window.FX.blurText(document.getElementById('subject-title'));

  /* 자료 종류별로 묶어서 보여 줌: 개념 정리 → 문제·모의고사 → 퀴즈 → 바로 풀기 → 외부 자료 */
  const groups = document.getElementById('groups');

  /* 2학기 기말고사 범위 개념 (관리자가 올림) + 바로 가기 — 범위 개념을 쓰는 버전에서만 */
  const conceptSection = el('section', { class: 'section', 'aria-labelledby': 'concept-title' }, [
    el('h2', { class: 'section-title', id: 'concept-title', text: '2학기 기말고사 범위 핵심 개념' }),
    el('div', { id: 'concept-body' }, [el('p', { class: 'empty', text: '범위 개념을 불러오고 있어요.' })]),
    el('div', { class: 'toolbar', style: 'margin-top:12px' }, [
      el('a', { class: 'btn btn-primary', href: 'cloud.html?s=' + subject.id, text: subject.name + ' 무한 문제 풀기' }),
      el('a', { class: 'btn btn-secondary', href: 'make.html?s=' + subject.id, text: '내 문제 만들기' })
    ])
  ]);
  if (S.version.concepts) groups.before(conceptSection);

  /* 듀오링고 모드: 문제가 있는 과목(자료 문제·AI 은행·자동 생성·내 문제)은 들어오자마자 레슨부터 */
  const D = S.duo && S.duo.active() ? S.duo : null;
  if (D && S.bank) {
    const G = S.generators || { units: () => [] };
    const lessonBox = el('section', { class: 'section duo-subject', 'aria-labelledby': 'duo-subject-title', hidden: '' });
    (S.version.concepts ? conceptSection : groups).before(lessonBox);
    S.bank.index().then(index => {
      const info = (index.subjects || {})[subject.id] || { count: 0, units: {} };
      const units = Object.assign({}, info.units);
      G.units(subject.id).forEach(u => { units[u] = units[u] || Infinity; });
      if (S.mine) S.mine.forSubject(subject.id).forEach(q => { units[q.u] = (units[q.u] || 0) + 1; });
      const names = Object.keys(units).filter(Boolean); // 자료 순서 그대로
      if (!names.length) return; // 아직 문제가 없는 과목은 원래 화면 그대로
      const href = u => 'lesson.html?s=' + subject.id + (u ? '&u=' + encodeURIComponent(u) : '');
      const done = names.filter(u => D.unitProgress(subject.id, u) >= D.UNIT_GOAL).length;
      const miss = D.mistakes(subject.id).length;
      const list = el('ol', { class: 'duo-unit-list' });
      names.forEach(u => {
        const n = D.unitProgress(subject.id, u), pct = Math.min(100, Math.round(n / D.UNIT_GOAL * 100));
        list.append(el('li', {}, [el('a', { class: 'duo-unit' + (pct >= 100 ? ' is-done' : ''), href: href(u), style: '--fx-spot:' + subject.color }, [
          el('span', { class: 'duo-unit-face', 'aria-hidden': 'true', text: pct >= 100 ? '★' : '?' }),
          el('span', { class: 'duo-unit-name', text: u }),
          el('span', { class: 'duo-unit-meta', text: (units[u] === Infinity ? '∞ 자동 생성' : units[u] + '문제') + ' · ' + Math.min(n, D.UNIT_GOAL) + '/' + D.UNIT_GOAL + ' 정답' }),
          el('span', { class: 'duo-progress', 'aria-hidden': 'true' }, [el('span', { style: 'width:' + pct + '%' })])
        ])]));
      });
      lessonBox.append(
        el('div', { class: 'duo-subject-head' }, [
          S.mascot ? S.mascot.create(done === names.length ? 'cheer' : 'idle', { size: 64, className: 'duo-subject-pul' }) : null,
          el('div', { class: 'duo-subject-text' }, [
            el('h2', { class: 'section-title', id: 'duo-subject-title' }, [document.createTextNode(subject.name + ' 문제 레슨'), el('small', { text: '단원 ' + done + '/' + names.length + ' 완료' })]),
            el('p', { class: 'duo-note', text: '5문제씩 풀어요. O/X·객관식이 섞여 나오고, 틀린 문제는 레슨 끝에 한 번 더 나와요. 단원마다 ' + D.UNIT_GOAL + '문제를 맞히면 완료예요.' })
          ]),
          el('div', { class: 'duo-subject-actions' }, [
            el('a', { class: 'btn btn-primary duo-start', href: href(''), text: '레슨 시작' }),
            miss ? el('a', { class: 'btn btn-secondary', href: 'lesson.html?s=' + subject.id + '&mode=review', text: '틀린 문제 ' + miss + '개 복습' }) : null
          ])
        ]),
        list
      );
      lessonBox.hidden = false;
      if (window.FX) { window.FX.spotlight(list, '.duo-unit'); window.FX.reveal(list.querySelectorAll('.duo-unit')); }
    }).catch(() => {});
  }
  if (S.version.concepts) fetch('./api/concepts?subject=' + subject.id, { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(({ concepts }) => {
      const body = document.getElementById('concept-body');
      if (!concepts.length) { body.replaceChildren(el('p', { class: 'empty', text: '선생님이 2학기 기말고사 범위 개념을 준비하고 있어요.' })); return; }
      body.replaceChildren(...concepts.map(c => el('details', { class: 'concept-group' }, [
        el('summary', { text: c.unit }),
        c.summary ? el('p', { text: c.summary }) : null,
        el('ul', {}, (c.points || []).map(p => el('li', { text: p }))),
        (c.terms || []).length ? el('dl', { class: 'terms' }, c.terms.flatMap(t => [el('dt', { text: t.term }), el('dd', { text: t.meaning })])) : null
      ])));
    })
    .catch(() => { document.getElementById('concept-body').replaceChildren(el('p', { class: 'empty', text: '범위 개념은 인터넷에 연결된 사이트에서 볼 수 있어요.' })); });
  if (!subject.items.length) groups.append(el('p', { class: 'empty', text: S.version.label + ' ' + subject.name + ' 자료를 준비하고 있어요. 위에서 다른 시험 버전을 골라 볼 수도 있어요.' }));
  Object.keys(S.KINDS).forEach(kind => {
    const items = subject.items.filter(item => item.kind === kind);
    if (!items.length) return;
    const headingId = 'group-' + kind;
    const list = el('ul', { class: 'material-grid' });
    items.forEach(item => list.append(materialCard(item)));
    groups.append(el('section', { class: 'section', 'aria-labelledby': headingId }, [
      el('h2', { class: 'section-title', id: headingId }, [
        document.createTextNode(S.KINDS[kind]),
        el('small', { text: items.length + '개' })
      ]),
      list
    ]));
  });

  if (window.FX) {
    window.FX.spotlight(groups, '.material-card');
    window.FX.reveal(groups.querySelectorAll('.material-card'));
  }

  /* 자료 카드 (shadcn Card + Badge). 과목 색은 왼쪽 표시줄과 포인터 빛(SpotlightCard)에 쓴다 */
  function materialCard(item) {
    const external = item.kind === 'link';
    return el('li', {}, [
      el('a', {
        class: 'material-card', href: S.hrefFor(item), style: '--fx-spot:' + subject.color,
        target: external ? '_blank' : null, rel: external ? 'noopener' : null
      }, [
        el('span', { class: 'material-badges' }, [
          el('span', { class: 'badge', text: S.KINDS[item.kind] || '자료' }),
          item.course ? el('span', { class: 'badge badge-outline', text: item.course }) : null
        ]),
        el('span', { class: 'material-title', text: item.title }),
        item.note ? el('span', { class: 'material-note', text: item.note }) : null,
        el('span', { class: 'material-action', text: S.actionLabel(item) })
      ])
    ]);
  }
})();
