/* 2학기 기말고사 시험범위 — 시험범위 페이지(exams.html)와 듀오링고 학습 경로가 함께 쓰는 한 곳.
   ───────────────────────────────────────────────
   범위가 바뀌면 RANGES만 고치면 두 화면이 같이 바뀝니다.

   범위 한 줄: { id, src, text, p, parts, units, match }
     id     바꾸지 마세요(공부 기록이 이 id로 저장됨). 새 줄은 새 id로.
     p      [시작쪽, 끝쪽] 쪽수. 12쪽이 넘으면 학습 경로에서 12쪽 안팎 단계로 나눠요.
     parts  쪽수 대신 단계 이름을 직접 정할 때 (예: ['명제', '함수'])
     units  이 범위에 붙일 문제 단원 이름(무한 문제·문제 은행의 단원 이름과 똑같이)
     match  단원 이름에 이 낱말이 들어 있으면 이 범위에 붙여요 (예: ['빅데이터'])

   자동 업데이트: 학습 경로는 열 때마다 아래를 다시 모아요.
     - 문제 은행(cloud/<과목>.json)·브라우저 문제 생성기·내가 만든 문제의 단원 → units/match로 범위에 붙고,
       어디에도 안 맞는 단원은 그 과목 경로 끝 ‘추가된 문제·자료’에 나와요.
     - catalog.js 2학기 기말 자료 → 자료에 range: '범위 id'를 적으면 그 범위에, 없으면 ‘추가된 문제·자료’에 나와요.
   그래서 자료나 문제가 새로 생기면 따로 고치지 않아도 경로에 생깁니다. */
(function () {
  'use strict';
  const S = window.Simpul = window.Simpul || {};

  const RANGES = [
    { s: 'korean', name: '공통국어2', unit: 4, items: [
      { id: 'ko-1', src: '교과서', text: 'p.115~121', p: [115, 121] },
      { id: 'ko-2', src: '교과서', text: 'p.152~156', p: [152, 156] },
      { id: 'ko-3', src: '교과서', text: 'p.160~166', p: [160, 166] },
      { id: 'ko-4', src: '교과서', text: 'p.60~105', p: [60, 105] },
      { id: 'ko-5', src: '프린트', text: '문학 프린트 전체' }] },
    { s: 'math', name: '공통수학2', unit: 4, items: [
      { id: 'ma-1', src: '교과서', text: 'p.72~끝', parts: ['명제', '함수'], match: ['명제', '함수'] },
      { id: 'ma-2', src: '부교재', text: '92번~끝' }] },
    { s: 'english', name: '공통영어2', unit: 3, items: [
      { id: 'en-1', src: '교과서', text: 'p.39~44', p: [39, 44], match: ['교과서 Unit 2'] },
      { id: 'en-2', src: '교과서', text: 'p.46~47', p: [46, 47] },
      { id: 'en-3', src: '교과서', text: 'p.66~70', p: [66, 70], match: ['교과서 Unit 3'] },
      { id: 'en-4', src: '교과서', text: 'p.72~73', p: [72, 73] },
      { id: 'en-5', src: '부교재', text: 'p.159~165', p: [159, 165], match: ['부교재'] },
      { id: 'en-6', src: '부교재', text: 'p.216~277', p: [216, 277] }] },
    { s: 'history', name: '한국사2', unit: 3, items: [
      { id: 'hi-1', src: '한국사A 교과서', text: 'p.44~59', p: [44, 59] },
      { id: 'hi-2', src: '한국사B 교과서', text: 'p.94~157', p: [94, 157] },
      { id: 'hi-3', src: '프린트', text: '프린트물 참조' }] },
    { s: 'social', name: '통합사회2', unit: 4, items: [
      { id: 'so-1', src: '교과서', text: 'Ⅱ-3~5 (p.48~65)', p: [48, 65], match: ['Ⅱ.'] },
      { id: 'so-2', src: '교과서', text: 'Ⅲ단원 전체 (p.68~99)', p: [68, 99], match: ['Ⅲ.'] },
      { id: 'so-3', src: '교과서', text: 'Ⅳ단원 전체 (p.102~125)', p: [102, 125], match: ['Ⅳ.'] },
      { id: 'so-4', src: '프린트', text: '해당 영역 수업 프린트' }] },
    { s: 'science', name: '통합과학2', unit: 4, items: [
      { id: 'sc-1', src: '교과서', text: 'p.48~85', p: [48, 85] },
      { id: 'sc-2', src: '교과서', text: 'p.90~125', p: [90, 125] },
      { id: 'sc-3', src: '교과서', text: 'p.138~157', p: [138, 157] },
      { id: 'sc-4', src: '자료', text: '문제 풀이 자료' }] },
    { s: 'japanese', name: '일본어', unit: 3, items: [
      { id: 'ja-1', src: '교과서', text: '60p ~ 5과', match: ['일본어'] }] },
    { s: 'info', name: '정보', unit: 3, items: [
      { id: 'in-1', src: '교과서', text: 'p.210~237', p: [210, 237] },
      { id: 'in-2', src: '교과서', text: 'p.54~71', p: [54, 71] },
      { id: 'in-3', src: '교과서', text: 'p.78~151', p: [78, 151] },
      { id: 'in-4', src: '학습지', text: '2학기 기간 내 제공된 모든 학습지 및 pdf 전체' }] }
  ];
  const CHUNK = 12; // 한 단계에 볼 쪽수(안팎)

  /* 범위 한 줄을 학습 단계로 나눈다 */
  function stepsOf(item) {
    if (item.parts) return item.parts.map((label, k) => ({ id: item.id + '.' + (k + 1), item, label: item.src + ' · ' + label }));
    if (item.p) {
      const [a, b] = item.p, total = b - a + 1, n = Math.max(1, Math.ceil(total / CHUNK));
      if (n === 1) return [{ id: item.id + '.1', item, label: item.src + ' ' + item.text }];
      const size = Math.ceil(total / n), out = [];
      for (let k = 0, from = a; from <= b; k++, from += size) {
        const to = Math.min(b, from + size - 1);
        out.push({ id: item.id + '.' + (k + 1), item, label: item.src + ' p.' + from + '~' + to, pages: to - from + 1 });
      }
      return out;
    }
    return [{ id: item.id + '.1', item, label: item.src + ' · ' + item.text }];
  }

  /* ── 공부 기록 (이 기기에만): { 단계id: 시각 } ── */
  const KEY = 'simpul.range.v1';
  let done = {};
  try { done = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { done = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) { /* 저장 불가 */ } };

  /* 예전 시험범위 페이지 체크(과목순서-줄순서)를 옮겨 온다 */
  try {
    const OLD = 'simpul.exams.s2-final.v1';
    const old = JSON.parse(localStorage.getItem(OLD) || 'null');
    if (old && typeof old === 'object') {
      Object.keys(old).forEach(k => {
        const [ri, ii] = k.split('-').map(Number);
        const item = RANGES[ri] && RANGES[ri].items[ii];
        if (old[k] && item) stepsOf(item).forEach(st => { done[st.id] = done[st.id] || Date.now(); });
      });
      save();
      localStorage.removeItem(OLD);
    }
  } catch (e) { /* 무시 */ }

  const isDone = id => !!done[id];
  function setDone(id, on) { if (on) done[id] = Date.now(); else delete done[id]; save(); }
  function itemState(item) {
    const st = stepsOf(item), n = st.filter(x => done[x.id]).length;
    return { n, total: st.length, all: n === st.length, some: n > 0 && n < st.length };
  }
  function setItem(item, on) { stepsOf(item).forEach(x => { if (on) done[x.id] = done[x.id] || Date.now(); else delete done[x.id]; }); save(); }
  function clearAll() { done = {}; save(); }

  /* ── 학습 경로 만들기 ──
     units: 그 과목에서 지금 풀 수 있는 문제 단원 이름들, materials: catalog 자료들
     돌려주는 값: [{ title, sub, nodes:[{ type:'study'|'quiz'|'material', id, label, ... }] }] */
  function path(subjectId, units, materials) {
    const r = RANGES.find(x => x.s === subjectId);
    if (!r) return [];
    const taken = new Set(), usedMat = new Set();
    const sections = r.items.map(item => {
      const nodes = stepsOf(item).map(st => ({ type: 'study', id: st.id, label: st.label, item }));
      (materials || []).filter(m => m.range === item.id).forEach(m => { usedMat.add(m.id); nodes.push({ type: 'material', id: 'm:' + m.id, label: m.title, mat: m }); });
      (units || []).filter(u => !taken.has(u) && ((item.units || []).includes(u) || (item.match || []).some(w => u.includes(w))))
        .forEach(u => { taken.add(u); nodes.push({ type: 'quiz', id: 'q:' + u, label: u, unit: u }); });
      return { title: item.src + ' ' + item.text, sub: item.p ? (item.p[1] - item.p[0] + 1) + '쪽' : '', item, nodes };
    });
    const extra = [];
    (materials || []).filter(m => !usedMat.has(m.id)).forEach(m => extra.push({ type: 'material', id: 'm:' + m.id, label: m.title, mat: m }));
    (units || []).filter(u => !taken.has(u)).forEach(u => extra.push({ type: 'quiz', id: 'q:' + u, label: u, unit: u }));
    if (extra.length) sections.push({ title: '추가된 문제·자료', sub: '범위 연습', extra: true, nodes: extra });
    return sections;
  }

  S.ranges = { RANGES, stepsOf, isDone, setDone, itemState, setItem, clearAll, path, of: id => RANGES.find(x => x.s === id) };
})();
