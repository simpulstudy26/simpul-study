/* 심풀스터디 자료 목록 — 시험 버전 3가지 (1학기 기말 · 2학기 중간 · 2학기 기말).
   화면 위쪽에서 버전을 고르면 그 시험의 자료만 보여요. 고른 버전은 이 기기에 저장되고, 주소 끝 ?v=버전 으로도 바꿀 수 있어요.
   자료를 추가할 때: 해당 버전·과목의 items에 한 줄을 넣고, HTML 파일은 materials/<과목>/ 폴더에 둡니다.
   (맥북 자동화 엔진이 이 파일을 읽으니 한 줄에 자료 하나, `// @version 버전id` 표시는 지우지 마세요.)
   kind: 'note' 개념 정리 · 'exam' 문제·모의고사 · 'quiz' 퀴즈 · 'practice' 연습(사이트 안에서 바로 풂) · 'link' 외부 자료 */
(function () {
  'use strict';
  const KINDS = {
    note: '개념 정리',
    exam: '문제·모의고사',
    quiz: '퀴즈',
    practice: '바로 풀기',
    link: '외부 자료'
  };

  const SUBJECT_META = [
    { id: 'korean', name: '국어', mark: '국', color: '#2f5bea' },
    { id: 'english', name: '영어', mark: 'En', color: '#0f7a6c' },
    { id: 'math', name: '수학', mark: '수', color: '#c2410c' },
    { id: 'social', name: '통합사회', mark: '사', color: '#6d3fd6' },
    { id: 'history', name: '한국사', mark: '한', color: '#9a3412' },
    { id: 'science', name: '통합과학', mark: '과', color: '#15803d' },
    { id: 'japanese', name: '일본어', mark: 'あ', color: '#be123c' },
    { id: 'info', name: '정보', mark: '정', color: '#0369a1' }
  ];

  /* concepts: 관리자 페이지의 ‘범위 개념’과 AI 문제 만들기를 이 버전에 보여 줄지 */
  const VERSIONS = [
    {
      // @version s1-final
      id: 's1-final', label: '1학기 기말', title: '고1 1학기 기말고사 대비', concepts: false,
      lead: '1학기 기말고사 때 쓰던 개념 정리, 교과서 본문 분석, 모의고사를 그대로 모았어요.',
      subjects: {
        korean: {
          summary: '공통국어1 문법(문법 요소, 음운)과 현대소설',
          items: [
          { id: 'korean-grammar-elements', kind: 'note', title: '문법 요소 학습 노트', course: '공통국어1', file: 'korean/korean_grammar_elements.html' },
          { id: 'korean-phonology', kind: 'note', title: '음운 핵심 정리', course: '공통국어1', file: 'korean/korean_phonology.html' },
          { id: 'korean-novel', kind: 'note', title: '서사 갈래의 이해', course: '공통국어1', file: 'korean/korean_novel.html' },
          { id: 'korean-novel-mock-1', kind: 'exam', title: '제1회 현대소설 미니 모의고사', course: '공통국어1', file: 'korean/korean_novel_mock.html' },
          { id: 'korean-novel-mock-2', kind: 'exam', title: '제2회 현대소설 미니 모의고사', course: '공통국어1', file: 'korean/korean_novel_mock_2.html' }
        ]
        },
        english: {
          summary: '교과서 본문(Unit 2·3)과 부교재',
          items: [
          { id: 'english-unit2', kind: 'note', title: 'Odd Pairings That Work', course: 'Unit 2 본문', file: 'english/english_main.html' },
          { id: 'english-unit2-extra', kind: 'note', title: 'The World of Curries', course: 'Unit 2 추가 지문', file: 'english/english_main_lesson2_extra.html' },
          { id: 'english-unit3', kind: 'note', title: 'My Octopus Teacher', course: 'Unit 3 본문', file: 'english/english_main_lesson3.html' },
          { id: 'english-unit3-extra', kind: 'note', title: 'Your Leather Bags Are Going Un-Leather', course: 'Unit 3 추가 지문', file: 'english/english_main_lesson3_extra.html' },
          { id: 'english-supplement', kind: 'note', title: '부교재편 학습 노트', course: '부교재', file: 'english/english_supplement.html' }
        ]
        },
        math: {
          summary: '공통수학1 문제 풀이, 공통수학2 명제·역함수 연습',
          items: [
          { id: 'math-common1-problems', kind: 'exam', title: '공통수학1 문제 풀이와 정답 확인', course: '공통수학1', file: 'math/math_supplement.html' },
          { id: 'math-conditions', kind: 'practice', title: '필요조건과 충분조건 서술형 연습', course: '공통수학2', page: 'practice.html?id=math-conditions', note: '누를 때마다 새 문제 5개' },
          { id: 'math-inverse', kind: 'practice', title: '역함수 개념과 기본 문제', course: '공통수학2', page: 'practice.html?id=math-inverse', note: '기본 문제 3개' }
        ]
        },
        social: {
          summary: 'IV. 문화와 다양성, V. 생활공간과 사회',
          items: [
          { id: 'social-culture-regions', kind: 'note', title: '다양한 문화권의 특징', course: 'IV. 문화와 다양성', file: 'social/society_geo_culture.html' },
          { id: 'social-unit4', kind: 'note', title: '문화와 다양성 단원 정리', course: 'IV. 문화와 다양성', file: 'social/통합사회_4단원_정리.html' },
          { id: 'social-city', kind: 'note', title: '생활공간과 사회', course: 'V. 생활공간과 사회', file: 'social/society_city.html' }
        ]
        },
        history: {
          summary: '조선 후기 정치 변동과 근대사',
          items: [
          { id: 'history-late-joseon', kind: 'note', title: '조선 후기 정치: 통치 체제 변화부터 세도 정치까지', course: '한국사', file: 'history/history_hub.html' },
          { id: 'history-modern', kind: 'note', title: '근대사 총정리 (교과서 132~157쪽)', course: '한국사', file: 'history/history_modern.html' },
          { id: 'history-final-review', kind: 'exam', title: '1학기 기말고사 복습', course: '한국사', file: 'history/history_practice.html' }
        ]
        },
        science: {
          summary: '통합과학1 화학 결합, 판 구조론, 생명 시스템, 역학',
          items: [
          { id: 'science-chemical-bond', kind: 'note', title: '화학 결합', course: '통합과학1 II단원', file: 'science/science_chemistry.html' },
          { id: 'science-plate-tectonics', kind: 'note', title: '지구시스템과 판 구조론', course: '통합과학1', file: 'science/science_earth.html' },
          { id: 'science-life-system', kind: 'note', title: '생명 시스템: 물질대사·효소, 유전정보의 흐름', course: '통합과학1', file: 'science/science_life.html' },
          { id: 'science-enzyme-graph', kind: 'note', title: '효소 그래프 해석', course: '생명 시스템 부록', file: 'science/science_life_appendix.html' },
          { id: 'science-mechanics', kind: 'note', title: '역학 시스템과 중력의 작용', course: '통합과학1', file: 'science/science_physics.html' },
          { id: 'science-projectile-sim', kind: 'link', title: '포물선 운동 시뮬레이션 (PhET)', course: '역학 보충', url: 'https://phet.colorado.edu/sims/html/projectile-motion/latest/projectile-motion_ko.html', note: 'PhET 사이트에서 열림' }
        ]
        },
        japanese: {
          summary: '히라가나·가타카나 퀴즈와 일본어Ⅰ 정리',
          items: [
          { id: 'japanese-hiragana', kind: 'quiz', title: '히라가나 퀴즈', course: '일본어Ⅰ', file: 'japanese/japanese_hiragana.html' },
          { id: 'japanese-katakana', kind: 'quiz', title: '가타카나 퀴즈', course: '일본어Ⅰ', file: 'japanese/japanese_katakana.html' },
          { id: 'japanese-summary', kind: 'note', title: '가타카나·일본 문화·길찾기와 가족 방문 회화', course: '일본어Ⅰ', file: 'japanese/japanese_summary.html' }
        ]
        },
        info: {
          summary: '디지털 문화, 알고리즘과 프로그래밍, 빅데이터',
          items: [
          { id: 'info-midterm', kind: 'exam', title: '중간고사 대비: 디지털 문화, 알고리즘과 프로그래밍', course: '정보', file: 'info/info_midterm.html' },
          { id: 'info-final', kind: 'exam', title: '기말고사 대비: 알고리즘과 프로그래밍, 빅데이터', course: '정보', file: 'info/info_new.html' }
        ]
        }
      }
    },
    {
      // @version s2-mid
      id: 's2-mid', label: '2학기 중간', title: '고1 2학기 중간고사 대비', concepts: false,
      lead: '2학기 중간고사 때 쓰던 과목별 정리 노트를 그대로 모았어요.',
      subjects: {
        korean: {
          summary: '고전 시가와 「세상을 밝히는 힘」 독해 노트',
          items: [
          { id: 's2m-korean-classic-poetry', kind: 'note', title: '고전 시가', course: '공통국어2', file: 's2-mid/korean/bugfur.html' },
          { id: 's2m-korean-reading', kind: 'note', title: '세상을 밝히는 힘 · 독해 노트', course: '공통국어2', file: 's2-mid/korean/korean_silver_gun.html' }
        ]
        },
        english: {
          summary: '부교재 Lesson 11~14와 교과서 학습',
          items: [
          { id: 's2m-english-supplement', kind: 'note', title: '부교재 Lesson 11~14 통합 학습', course: '부교재', file: 's2-mid/english/english_lessons_11_to_14_integrated.html' },
          { id: 's2m-english-textbook', kind: 'note', title: '교과서 본문 학습', course: '교과서', file: 's2-mid/english/kyokwaseo.html' }
        ]
        },
        math: {
          summary: '공통수학2 · 2학기 중간고사 자료를 준비하고 있어요',
          items: []
        },
        social: {
          summary: '통합사회2 선생님 파트별 정리',
          items: [
          { id: 's2m-social-part-a', kind: 'note', title: '통합사회2 · 방O현 선생님 파트', course: '통합사회2', file: 's2-mid/social/geo.html' },
          { id: 's2m-social-part-b', kind: 'note', title: '통합사회2 · 민O훈 선생님 파트', course: '통합사회2', file: 's2-mid/social/royal44.html' }
        ]
        },
        history: {
          summary: '선생님 파트별 정리와 연대기',
          items: [
          { id: 's2m-history-part-a', kind: 'note', title: '최O석 선생님 파트', course: '한국사', file: 's2-mid/history/cowrock.html' },
          { id: 's2m-history-part-a-timeline', kind: 'note', title: '최O석 선생님 파트 연대기', course: '한국사', file: 's2-mid/history/cowrock_time.html' },
          { id: 's2m-history-part-b', kind: 'note', title: '정O수 선생님 파트', course: '한국사', file: 's2-mid/history/silverwater.html' },
          { id: 's2m-history-part-b-timeline', kind: 'note', title: '정O수 선생님 파트 연대기', course: '한국사', file: 's2-mid/history/silverwater_time.html' }
        ]
        },
        science: {
          summary: '통합과학2 지구과학·물리·생명·화학 파트',
          items: [
          { id: 's2m-science-earth', kind: 'note', title: '통합과학2 지구과학 파트', course: '통합과학2', file: 's2-mid/science/kkk.html' },
          { id: 's2m-science-physics', kind: 'note', title: '통합과학2 물리 파트', course: '통합과학2', file: 's2-mid/science/physics.html' },
          { id: 's2m-science-biology', kind: 'note', title: '통합과학2 생명 파트', course: '통합과학2', file: 's2-mid/science/biology.html' },
          { id: 's2m-science-chemistry', kind: 'note', title: '통합과학2 화학 파트', course: '통합과학2', file: 's2-mid/science/chemical.html' }
        ]
        },
        japanese: {
          summary: '히라가나 50음도 학습',
          items: [
          { id: 's2m-japanese-hiragana', kind: 'note', title: '히라가나 50음도 학습', course: '일본어Ⅰ', file: 's2-mid/japanese/jap.html' }
        ]
        },
        info: {
          summary: '디지털 문화, 알고리즘과 프로그래밍, 빅데이터',
          items: [
          { id: 's2m-info-midterm', kind: 'exam', title: '중간고사 대비: 디지털 문화, 알고리즘과 프로그래밍', course: '정보', file: 's2-mid/info/info_midterm.html' },
          { id: 's2m-info-final', kind: 'exam', title: '기말고사 대비: 알고리즘과 프로그래밍, 빅데이터', course: '정보', file: 's2-mid/info/info_new.html' }
        ]
        }
      }
    },
    {
      // @version s2-final
      id: 's2-final', label: '2학기 기말', title: '고1 2학기 기말고사 대비', concepts: true,
      lead: '과목을 고르면 2학기 기말고사 범위 핵심 개념과 자료가 나와요. 무한 문제로 연습하고, 나만의 문제도 만들어 보세요.',
      subjects: {
        korean: {
          summary: '2학기 기말고사 범위 자료를 준비하고 있어요',
          items: []
        },
        english: {
          summary: '교과서 Unit 2·3 정독 노트와 부교재 학습',
          items: [
          { id: 's2f-english-textbook', kind: 'note', title: '교과서 Unit 2 · Unit 3 정독 노트', course: '교과서', file: 's2-final/english/english_textbook_u2_u3.html' },
          { id: 's2f-english-supplement', kind: 'note', title: '부교재 학습', course: '부교재', file: 's2-final/english/english_supplement.html' }
        ]
        },
        math: {
          summary: '공통수학2 명제·함수 · 2학기 기말고사 범위 자료를 준비하고 있어요',
          items: []
        },
        social: {
          summary: '정의와 불평등 · 세계화 · 시장경제와 금융',
          items: [
          { id: 's2f-social-part-a', kind: 'note', title: '방O현 선생님 파트 · 사회 정의와 불평등, 세계화와 평화', course: '통합사회2', file: 's2-final/social/social2_part_a.html' },
          { id: 's2f-social-part-b', kind: 'note', title: '민O훈 선생님 파트 · 시장경제와 금융', course: '통합사회2', file: 's2-final/social/social2_part_b.html' }
        ]
        },
        history: {
          summary: '2학기 기말고사 범위 자료를 준비하고 있어요',
          items: []
        },
        science: {
          summary: '2학기 기말고사 범위 자료를 준비하고 있어요',
          items: []
        },
        japanese: {
          summary: '히라가나·가타카나 퀴즈와 일본어Ⅰ 정리',
          items: [
          { id: 'japanese-hiragana', kind: 'quiz', title: '히라가나 퀴즈', course: '일본어Ⅰ', file: 'japanese/japanese_hiragana.html' },
          { id: 'japanese-katakana', kind: 'quiz', title: '가타카나 퀴즈', course: '일본어Ⅰ', file: 'japanese/japanese_katakana.html' },
          { id: 'japanese-summary', kind: 'note', title: '가타카나·일본 문화·길찾기와 가족 방문 회화', course: '일본어Ⅰ', file: 'japanese/japanese_summary.html' }
        ]
        },
        info: {
          summary: '디지털 문화, 알고리즘과 프로그래밍, 빅데이터',
          items: [
          { id: 'info-midterm', kind: 'exam', title: '중간고사 대비: 디지털 문화, 알고리즘과 프로그래밍', course: '정보', file: 'info/info_midterm.html' },
          { id: 'info-final', kind: 'exam', title: '기말고사 대비: 알고리즘과 프로그래밍, 빅데이터', course: '정보', file: 'info/info_new.html' }
        ]
        }
      }
    }
  ];
  const DEFAULT_VERSION = 's2-final';  // 지금 다가오는 시험
  const VERSION_KEY = 'simpul.version';

  /* 버전마다 과목 목록을 만든다 (자료마다 subject·version 표시) */
  const BY_VERSION = {};
  VERSIONS.forEach(v => {
    BY_VERSION[v.id] = SUBJECT_META.map(meta => {
      const data = v.subjects[meta.id] || { summary: '', items: [] };
      const items = data.items.map(item => Object.assign({}, item, { subject: meta.id, version: v.id }));
      return Object.assign({}, meta, { summary: data.summary, items });
    });
  });
  const findIn = (vid, id) => BY_VERSION[vid].flatMap(s => s.items).find(item => item.id === id);

  /* 지금 버전 정하기: 주소의 ?v= → 저장된 선택 → 기본값.
     다른 버전에만 있는 자료 주소(?id=)로 들어오면 그 버전으로 바꾼다. */
  const params = new URLSearchParams(location.search);
  let current = params.get('v');
  if (!BY_VERSION[current]) {
    try { current = localStorage.getItem(VERSION_KEY); } catch (e) { current = null; }
  }
  if (!BY_VERSION[current]) current = DEFAULT_VERSION;
  const linkedId = params.get('id');
  if (linkedId && !findIn(current, linkedId)) {
    const owner = VERSIONS.find(v => findIn(v.id, linkedId));
    if (owner) current = owner.id;
  }
  try { localStorage.setItem(VERSION_KEY, current); } catch (e) { /* 저장 불가 */ }
  /* 반마다 듣는 선택 과목이 다르다: 1~4반은 일본어, 5~8반은 정보. 반을 고르면 안 듣는 과목은 목록에서 뺀다(고르기 전엔 모두 보임) */
  const CLASS_KEY = 'simpul.class';
  const ELECTIVE = { japanese: [1, 2, 3, 4], info: [5, 6, 7, 8] };
  let myClass = 0;
  try { myClass = parseInt(localStorage.getItem(CLASS_KEY), 10) || 0; } catch (e) { myClass = 0; }
  if (myClass < 1 || myClass > 8) myClass = 0;
  const takes = id => !myClass || !ELECTIVE[id] || ELECTIVE[id].includes(myClass);
  const ALL_SUBJECTS = BY_VERSION[current];
  const SUBJECTS = ALL_SUBJECTS.filter(s => takes(s.id));
  function setClass(n) {
    try { if (n) localStorage.setItem(CLASS_KEY, String(n)); else localStorage.removeItem(CLASS_KEY); } catch (e) { /* 저장 불가 */ }
    location.reload();
  }

  function hrefFor(item) {
    if (item.kind === 'link') return item.url;
    if (item.kind === 'practice') return item.page;
    return 'view.html?id=' + encodeURIComponent(item.id);
  }

  function setVersion(id) {
    if (!BY_VERSION[id]) return;
    try { localStorage.setItem(VERSION_KEY, id); } catch (e) { /* 저장 불가 */ }
    const url = new URL(location.href);
    url.searchParams.set('v', id);
    url.searchParams.delete('id');
    location.href = url.toString();
  }

  window.Simpul = window.Simpul || {};
  window.Simpul.KINDS = KINDS;
  window.Simpul.VERSIONS = VERSIONS.map(v => ({ id: v.id, label: v.label, title: v.title, lead: v.lead, concepts: v.concepts }));
  window.Simpul.version = VERSIONS.find(v => v.id === current);
  window.Simpul.setVersion = setVersion;
  window.Simpul.SUBJECTS = SUBJECTS;          // 내 반이 듣는 과목만
  window.Simpul.ALL_SUBJECTS = ALL_SUBJECTS;  // 관리자 도구용 전체 과목
  window.Simpul.myClass = myClass;
  window.Simpul.setClass = setClass;
  window.Simpul.takes = takes;
  window.Simpul.ELECTIVE = ELECTIVE;
  window.Simpul.allItems = () => SUBJECTS.flatMap(subject => subject.items);
  /* 지금 버전에서 먼저 찾고, 없으면 다른 버전에서 (최근 본 자료·예전 주소용) */
  window.Simpul.findItem = id => findIn(current, id) || VERSIONS.map(v => findIn(v.id, id)).find(Boolean);
  /* 주소로 바로 들어온 과목(예: 다른 반 과목 자료)도 열리도록 전체에서 찾는다 */
  window.Simpul.findSubject = id => ALL_SUBJECTS.find(subject => subject.id === id);
  window.Simpul.hrefFor = hrefFor;
})();
