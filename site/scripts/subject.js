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
    const list = el('ul', { class: 'item-list' });
    items.forEach(item => list.append(S.itemRow(item, false)));
    groups.append(el('section', { class: 'section', 'aria-labelledby': headingId }, [
      el('h2', { class: 'section-title', id: headingId }, [
        document.createTextNode(S.KINDS[kind]),
        el('small', { text: items.length + '개' })
      ]),
      list
    ]));
  });
})();
