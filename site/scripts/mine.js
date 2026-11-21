/* 내가 만든 문제: 이 기기 브라우저(localStorage)에만 저장한다. 서버로 보내지 않으므로 다른 사람은 볼 수 없다. */
(function () {
  'use strict';
  const KEY = 'simpul.mine.v1';
  const MAX = 600;
  function all() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list.filter(q => q && q.id && q.q && q.a) : [];
    } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX))); return true; } catch (e) { return false; }
  }
  function add(subject, unit, questions) {
    const now = Date.now();
    const items = questions.map((q, i) => ({ id: 'm' + now.toString(36) + i, s: subject, u: unit || '내 문제', d: q.d, q: q.q, c: q.c || [], a: q.a, e: q.e, t: now, mine: true }));
    const ok = save(all().concat(items));
    return ok ? items : null;
  }
  function remove(id) { save(all().filter(q => q.id !== id)); }
  function clear(subject) { save(all().filter(q => subject && q.s !== subject)); }
  window.Simpul = window.Simpul || {};
  window.Simpul.mine = { all, add, remove, clear, forSubject: s => all().filter(q => q.s === s) };
})();
