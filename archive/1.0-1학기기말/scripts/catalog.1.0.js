/* 심풀스터디 자료 목록.
   자료를 추가할 때: 해당 과목의 items에 한 줄을 넣고, HTML 파일은 materials/<과목>/ 폴더에 둡니다.
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

  const SUBJECTS = [
    {
      id: 'korean', name: '국어', mark: '국', color: '#2f5bea',
      summary: '공통국어1 문법(문법 요소, 음운)과 현대소설',
      items: [
        { id: 'korean-grammar-elements', kind: 'note', title: '문법 요소 학습 노트', course: '공통국어1', file: 'korean/korean_grammar_elements.html' },
        { id: 'korean-phonology', kind: 'note', title: '음운 핵심 정리', course: '공통국어1', file: 'korean/korean_phonology.html' },
        { id: 'korean-novel', kind: 'note', title: '서사 갈래의 이해', course: '공통국어1', file: 'korean/korean_novel.html' },
        { id: 'korean-novel-mock-1', kind: 'exam', title: '제1회 현대소설 미니 모의고사', course: '공통국어1', file: 'korean/korean_novel_mock.html' },
        { id: 'korean-novel-mock-2', kind: 'exam', title: '제2회 현대소설 미니 모의고사', course: '공통국어1', file: 'korean/korean_novel_mock_2.html' }
      ]
    },
    {
      id: 'english', name: '영어', mark: 'En', color: '#0f7a6c',
      summary: '교과서 본문(Unit 2·3)과 부교재',
      items: [
        { id: 'english-unit2', kind: 'note', title: 'Odd Pairings That Work', course: 'Unit 2 본문', file: 'english/english_main.html' },
        { id: 'english-unit2-extra', kind: 'note', title: 'The World of Curries', course: 'Unit 2 추가 지문', file: 'english/english_main_lesson2_extra.html' },
        { id: 'english-unit3', kind: 'note', title: 'My Octopus Teacher', course: 'Unit 3 본문', file: 'english/english_main_lesson3.html' },
        { id: 'english-unit3-extra', kind: 'note', title: 'Your Leather Bags Are Going Un-Leather', course: 'Unit 3 추가 지문', file: 'english/english_main_lesson3_extra.html' },
        { id: 'english-supplement', kind: 'note', title: '부교재편 학습 노트', course: '부교재', file: 'english/english_supplement.html' }
      ]
    },
    {
      id: 'math', name: '수학', mark: '수', color: '#c2410c',
      summary: '공통수학1 문제 풀이, 공통수학2 명제·역함수 연습',
      items: [
        { id: 'math-common1-problems', kind: 'exam', title: '공통수학1 문제 풀이와 정답 확인', course: '공통수학1', file: 'math/math_supplement.html' },
        { id: 'math-conditions', kind: 'practice', title: '필요조건과 충분조건 서술형 연습', course: '공통수학2', page: 'practice.html?id=math-conditions', note: '누를 때마다 새 문제 5개' },
        { id: 'math-inverse', kind: 'practice', title: '역함수 개념과 기본 문제', course: '공통수학2', page: 'practice.html?id=math-inverse', note: '기본 문제 3개' }
      ]
    },
    {
      id: 'social', name: '통합사회', mark: '사', color: '#6d3fd6',
      summary: 'IV. 문화와 다양성, V. 생활공간과 사회',
      items: [
        { id: 'social-culture-regions', kind: 'note', title: '다양한 문화권의 특징', course: 'IV. 문화와 다양성', file: 'social/society_geo_culture.html' },
        { id: 'social-unit4', kind: 'note', title: '문화와 다양성 단원 정리', course: 'IV. 문화와 다양성', file: 'social/통합사회_4단원_정리.html' },
        { id: 'social-city', kind: 'note', title: '생활공간과 사회', course: 'V. 생활공간과 사회', file: 'social/society_city.html' }
      ]
    },
    {
      id: 'history', name: '한국사', mark: '한', color: '#9a3412',
      summary: '조선 후기 정치 변동과 근대사',
      items: [
        { id: 'history-late-joseon', kind: 'note', title: '조선 후기 정치: 통치 체제 변화부터 세도 정치까지', course: '한국사', file: 'history/history_hub.html' },
        { id: 'history-modern', kind: 'note', title: '근대사 총정리 (교과서 132~157쪽)', course: '한국사', file: 'history/history_modern.html' },
        { id: 'history-final-review', kind: 'exam', title: '1학기 기말고사 복습', course: '한국사', file: 'history/history_practice.html' }
      ]
    },
    {
      id: 'science', name: '통합과학', mark: '과', color: '#15803d',
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
    {
      id: 'japanese', name: '일본어', mark: 'あ', color: '#be123c',
      summary: '히라가나·가타카나 퀴즈와 일본어Ⅰ 정리',
      items: [
        { id: 'japanese-hiragana', kind: 'quiz', title: '히라가나 퀴즈', course: '일본어Ⅰ', file: 'japanese/japanese_hiragana.html' },
        { id: 'japanese-katakana', kind: 'quiz', title: '가타카나 퀴즈', course: '일본어Ⅰ', file: 'japanese/japanese_katakana.html' },
        { id: 'japanese-summary', kind: 'note', title: '가타카나·일본 문화·길찾기와 가족 방문 회화', course: '일본어Ⅰ', file: 'japanese/japanese_summary.html' }
      ]
    },
    {
      id: 'info', name: '정보', mark: '정', color: '#0369a1',
      summary: '디지털 문화, 알고리즘과 프로그래밍, 빅데이터',
      items: [
        { id: 'info-midterm', kind: 'exam', title: '중간고사 대비: 디지털 문화, 알고리즘과 프로그래밍', course: '정보', file: 'info/info_midterm.html' },
        { id: 'info-final', kind: 'exam', title: '기말고사 대비: 알고리즘과 프로그래밍, 빅데이터', course: '정보', file: 'info/info_new.html' }
      ]
    }
  ];

  SUBJECTS.forEach(subject => subject.items.forEach(item => { item.subject = subject.id; }));

  function hrefFor(item) {
    if (item.kind === 'link') return item.url;
    if (item.kind === 'practice') return item.page;
    return 'view.html?id=' + encodeURIComponent(item.id);
  }

  window.Simpul = window.Simpul || {};
  window.Simpul.KINDS = KINDS;
  window.Simpul.SUBJECTS = SUBJECTS;
  window.Simpul.allItems = () => SUBJECTS.flatMap(subject => subject.items);
  window.Simpul.findItem = id => window.Simpul.allItems().find(item => item.id === id);
  window.Simpul.findSubject = id => SUBJECTS.find(subject => subject.id === id);
  window.Simpul.hrefFor = hrefFor;
})();
