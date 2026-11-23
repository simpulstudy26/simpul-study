/* 문제 은행 읽기 — 무한 문제·듀오링고 레슨·학습 경로가 함께 쓴다.
   두 곳을 합친다: ① cloud/<과목>.json (AI 문제 은행, 자동화 엔진이 DB에서 다시 씀)
                  ② banks/<과목>.json (2학기 기말 자료에서 옮긴 문제, tools/build_material_bank.mjs로 만듦)
   O/X 문제는 t:'ox', c:['O','X'], a:'O'|'X'. */
(function () {
  'use strict';
  const S = window.Simpul = window.Simpul || {};
  const SOURCES = ['./cloud/', './banks/'];

  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(url);
    return r.json();
  }

  /* 두 은행의 index.json을 합친다: { subjects: { id: { count, units: { 단원: 개수 } } } } */
  async function index() {
    const parts = await Promise.all(SOURCES.map(base => getJSON(base + 'index.json').catch(() => ({ subjects: {} }))));
    const out = { subjects: {} };
    parts.forEach(p => Object.entries(p.subjects || {}).forEach(([id, v]) => {
      const t = out.subjects[id] = out.subjects[id] || { count: 0, units: {} };
      t.count += v.count || 0;
      Object.entries(v.units || {}).forEach(([u, n]) => { t.units[u] = (t.units[u] || 0) + n; });
    }));
    return out;
  }

  /* 한 과목의 문제 전체 (AI 은행 먼저, 자료 문제 뒤) */
  async function load(subject) {
    const parts = await Promise.all(SOURCES.map(base => getJSON(base + subject + '.json').then(d => d.questions || []).catch(() => [])));
    return parts.flat();
  }

  const isOX = q => !!q && (q.t === 'ox' || (Array.isArray(q.c) && q.c.length === 2 && q.c[0] === 'O' && q.c[1] === 'X'));

  S.bank = { index, load, isOX };
})();
