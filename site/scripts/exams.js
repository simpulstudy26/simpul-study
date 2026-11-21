/* 시험범위 페이지 (exams.html). 범위 자료는 scripts/ranges.js의 RANGES 한 곳에서 고칩니다.
   체크는 듀오링고 학습 경로의 ‘공부했어요’와 같은 기록이라, 여기서 체크하면 경로에도 반영돼요. */
(function () {
  'use strict';
  const S = window.Simpul, R = S.ranges;
  const RANGES = R.RANGES;

  const $ = id => document.getElementById(id);
  const meta = id => (S.findSubject && S.findSubject(id)) || {};
  let active = 'all';

  /* 검색어를 <mark>로 감싼 텍스트 노드들 */
  function hl(text, q) {
    const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (i < 0) return [document.createTextNode(text)];
    return [document.createTextNode(text.slice(0, i)), S.el('mark', { text: text.slice(i, i + q.length) }), document.createTextNode(text.slice(i + q.length))];
  }

  function renderTabs() {
    const box = $('ex-tabs');
    box.replaceChildren();
    [{ s: 'all', name: '전체' }, ...RANGES].forEach(r => {
      const b = S.el('button', { type: 'button', 'aria-pressed': String(r.s === active), 'data-s': r.s, text: r.name });
      box.append(S.el('li', {}, [b]));
    });
  }

  function render() {
    const q = $('ex-q').value.trim();
    const list = $('ex-list');
    list.replaceChildren();
    RANGES.forEach(r => {
      if (active !== 'all' && r.s !== active) return;
      const nameHit = q && r.name.toLowerCase().includes(q.toLowerCase());
      const shown = r.items.filter(it => !q || nameHit || (it.src + ' ' + it.text).toLowerCase().includes(q.toLowerCase()));
      if (!shown.length) return;
      const doneN = r.items.filter(it => R.itemState(it).all).length;
      const done = doneN === r.items.length;
      const m = meta(r.s);

      const head = S.el('div', { class: 'ex-head' }, [
        S.el('span', { class: 'subject-mark', style: 'background:' + (m.color || 'hsl(var(--muted))'), 'aria-hidden': 'true', text: m.mark || r.name[0] }),
        S.el('h2', { class: 'ex-name' }, hl(r.name, q)),
        S.el('span', { class: 'ex-meta', text: r.unit + '단위 · 범위 ' + r.items.length + '개' }),
        S.el('span', { class: 'ex-count', text: done ? '다 봤어요 ✓' : doneN + ' / ' + r.items.length })
      ]);
      const ul = S.el('ul', { class: 'ex-items' });
      shown.forEach(it => {
        const st = R.itemState(it);
        const box = S.el('input', { type: 'checkbox', id: 'ex-' + it.id, 'data-id': it.id });
        box.checked = st.all;
        box.indeterminate = st.some;
        const text = S.el('span', { class: 'ex-text' }, [S.el('span', { class: 'ex-src' }, hl(it.src, q)), ...hl(it.text, q)]);
        const side = st.some ? st.n + '/' + st.total + '단계' : it.p ? (it.p[1] - it.p[0] + 1) + '쪽' : '';
        ul.append(S.el('li', { class: st.all ? 'is-checked' : '' }, [
          S.el('label', { for: 'ex-' + it.id }, [box, text, side ? S.el('span', { class: 'ex-pages', text: side }) : null])
        ]));
      });
      const card = S.el('section', { class: 'ex-card' + (done ? ' is-done' : ''), 'aria-label': r.name + ' 시험범위' }, [head, ul]);
      if (m.id) card.append(S.el('a', { class: 'ex-go', href: './subject.html?s=' + m.id, text: m.name + ' 자료 보러 가기 →' }));
      list.append(card);
    });
    if (!list.children.length) list.append(S.el('p', { class: 'empty', text: '“' + q + '”에 맞는 범위가 없어요.' }));

    const all = RANGES.flatMap(r => r.items);
    const total = all.length;
    const done = all.filter(it => R.itemState(it).all).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    $('ex-total').textContent = total;
    $('ex-done').textContent = done;
    $('ex-fill').style.width = pct + '%';
    $('ex-bar').setAttribute('aria-valuenow', pct);
  }

  $('ex-tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-s]');
    if (!b) return;
    active = b.dataset.s;
    renderTabs(); render();
  });
  $('ex-list').addEventListener('change', e => {
    const id = e.target.dataset && e.target.dataset.id;
    const item = id && RANGES.flatMap(r => r.items).find(it => it.id === id);
    if (!item) return;
    R.setItem(item, e.target.checked);
    render();
    const again = $('ex-' + id);
    if (again) again.focus();
  });
  $('ex-q').addEventListener('input', render);

  let armed = null;
  $('ex-reset').addEventListener('click', e => {
    const b = e.currentTarget;
    if (!armed) {
      b.textContent = '한 번 더 누르면 지워요';
      armed = setTimeout(() => { armed = null; b.textContent = '체크 모두 지우기'; }, 3000);
      return;
    }
    clearTimeout(armed); armed = null;
    R.clearAll(); b.textContent = '체크 모두 지우기'; render();
  });

  renderTabs(); render();
})();
