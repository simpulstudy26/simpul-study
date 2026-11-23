/* 역산 플래너 기본 데이터 — 시험범위는 심풀스터디 scripts/ranges.js(RANGES)에서 그대로 읽는다.
   그래서 시험범위를 ranges.js에서 고치면 플래너도 같이 바뀐다(앱 ‘과목’ 탭에서 따로 고친 범위는 이 기기에 따로 저장).
   쪽수가 없는 범위(프린트·문제 번호 등)는 아래 MIN의 예상 시간(분)으로 계산한다. */
(function () {
  'use strict';
  const RG = (window.Simpul && window.Simpul.ranges) || null;

  const SUBJECTS = [
    { id: 'korean', name: '공통국어2', short: '국어', mark: '국', color: '#FF9600', deep: '#CD7900' },
    { id: 'math', name: '공통수학2', short: '수학', mark: '수', color: '#1CB0F6', deep: '#1899D6' },
    { id: 'english', name: '공통영어2', short: '영어', mark: 'En', color: '#FFC800', deep: '#E0A800' },
    { id: 'history', name: '한국사2', short: '한국사', mark: '한', color: '#FF4B4B', deep: '#EA2B2B' },
    { id: 'social', name: '통합사회2', short: '사회', mark: '사', color: '#CE82FF', deep: '#A568CC' },
    { id: 'science', name: '통합과학2', short: '과학', mark: '과', color: '#58CC02', deep: '#58A700' },
    { id: 'japanese', name: '일본어', short: '일본어', mark: 'あ', color: '#FF86D0', deep: '#E065B4' },
    { id: 'info', name: '정보', short: '정보', mark: '정', color: '#2B70C9', deep: '#1F5AA6' }
  ];
  /* 쪽수가 없는 범위의 예상 시간(분). id는 ranges.js의 id (parts로 나뉜 것은 id + a, b, …) */
  const MIN = { 'ko-5': 90, 'ma-1a': 120, 'ma-1b': 120, 'ma-2': 150, 'hi-3': 60, 'so-4': 60, 'sc-4': 90, 'ja-1': 120, 'in-4': 90 };
  const DEFAULT_MIN = 90;

  /* ranges.js 한 줄 → 플래너 범위(들). parts가 있으면 단계마다 하나씩 나눈다 */
  function convert(item) {
    if (item.parts) return item.parts.map((part, k) => {
      const id = item.id + String.fromCharCode(97 + k);
      return { id, src: item.src, text: item.text + ' · ' + part, min: MIN[id] || DEFAULT_MIN };
    });
    if (item.p) return [{ id: item.id, src: item.src, text: item.text, p: item.p.slice() }];
    return [{ id: item.id, src: item.src, text: item.text, min: MIN[item.id] || DEFAULT_MIN }];
  }

  /* 심풀 ‘내 반’(simpul.class)을 따라 안 듣는 선택 과목을 뺀다: 1~4반 일본어, 5~8반 정보 */
  const ELECTIVE = { japanese: [1, 2, 3, 4], info: [5, 6, 7, 8] };
  let cls = 0; try { cls = parseInt(localStorage.getItem('simpul.class'), 10) || 0; } catch (e) { cls = 0; }
  if (cls >= 1 && cls <= 8) for (let i = SUBJECTS.length - 1; i >= 0; i--) { const e = ELECTIVE[SUBJECTS[i].id]; if (e && !e.includes(cls)) SUBJECTS.splice(i, 1); }

  const ranges = {};
  SUBJECTS.forEach(s => {
    const r = RG && RG.of(s.id);
    ranges[s.id] = r ? r.items.flatMap(convert) : [];
  });

  window.PLANNER_DATA = {
    title: '2학기 기말고사',
    end: '2026-12-11', // 시험 준비를 끝낼 날 (모든 과목)
    subjects: SUBJECTS,
    ranges
  };
  window.PLANNER_EMBED = window.parent !== window || /[?&]embed\b/.test(location.search);
})();
