(function () {
  'use strict';
  const S = window.Simpul;
  const id = new URLSearchParams(location.search).get('id') || 'math-conditions';
  const item = S.findItem(id);
  const section = document.getElementById(id);
  if (!item || !section) { location.replace('subject.html?s=math'); return; }
  section.hidden = false;
  document.title = item.title + ' · 수학 · 심풀스터디';
  S.rememberItem(item.id);

  /* 같은 과목의 다른 자료로 이어지는 목록 */
  const subject = S.findSubject(item.subject);
  const others = subject.items.filter(x => x.id !== item.id);
  if (others.length) {
    const list = S.el('ul', { class: 'item-list' });
    others.forEach(x => list.append(S.itemRow(x, false)));
    document.getElementById('practice-next').append(
      S.el('h2', { class: 'section-title', text: '수학의 다른 자료' }), list);
  }
})();
