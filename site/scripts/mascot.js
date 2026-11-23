/* 심풀 캐릭터 ‘풀이’ — 심풀의 ‘풀’에서 따온 새싹 캐릭터 (심풀 고유 디자인, 인라인 SVG).
   배치는 REA로 분석한 듀오링고 레슨 구조를 따름: 문제마다 캐릭터가 말풍선으로 문제를 말하고,
   답을 고르면 표정이 바뀌고, 레슨이 끝나면 응원한다. 그림·이름은 듀오링고 것을 쓰지 않는다.
   S.mascot.create(mood, { size, label }) → <span class="pul">   S.mascot.set(el, mood)
   mood: idle(기본) · happy(정답) · sad(오답) · cheer(완료·축하) · think(문제 준비·없음) */
(function () {
  'use strict';
  const S = window.Simpul = window.Simpul || {};
  const NS = 'http://www.w3.org/2000/svg';
  const MOODS = ['idle', 'happy', 'sad', 'cheer', 'think'];

  const SVG = `
<svg viewBox="0 0 120 132" aria-hidden="true" focusable="false">
  <ellipse class="pul-shadow" cx="60" cy="124" rx="30" ry="5"/>
  <g class="pul-bob">
    <g class="pul-sprout">
      <path class="pul-stem" d="M60 40 C60 30 60 24 61 16"/>
      <path class="pul-leaf pul-leaf-l" d="M60 26 C46 26 36 18 34 8 C46 6 58 12 60 26 Z"/>
      <path class="pul-leaf pul-leaf-r" d="M61 20 C70 10 82 6 92 9 C90 21 76 26 61 20 Z"/>
      <path class="pul-vein" d="M59 25 C51 22 44 17 39 10 M62 19 C70 15 78 12 87 11"/>
    </g>
    <path class="pul-body" d="M60 36 C88 36 104 56 104 82 C104 106 86 118 60 118 C34 118 16 106 16 82 C16 56 32 36 60 36 Z"/>
    <path class="pul-belly" d="M60 72 C78 72 88 84 88 96 C88 108 76 114 60 114 C44 114 32 108 32 96 C32 84 42 72 60 72 Z"/>
    <g class="pul-arm pul-arm-l"><ellipse cx="17" cy="88" rx="7" ry="11" transform="rotate(20 17 88)"/></g>
    <g class="pul-arm pul-arm-r"><ellipse cx="103" cy="88" rx="7" ry="11" transform="rotate(-20 103 88)"/></g>
    <g class="pul-face">
      <g class="pul-eyes pul-eyes-open">
        <ellipse class="pul-eye" cx="45" cy="66" rx="8" ry="10"/>
        <ellipse class="pul-eye" cx="75" cy="66" rx="8" ry="10"/>
        <circle class="pul-pupil" cx="47" cy="68" r="4.6"/>
        <circle class="pul-pupil" cx="77" cy="68" r="4.6"/>
        <circle class="pul-glint" cx="49" cy="64" r="1.8"/>
        <circle class="pul-glint" cx="79" cy="64" r="1.8"/>
      </g>
      <g class="pul-eyes pul-eyes-joy"><path d="M37 68 Q45 58 53 68 M67 68 Q75 58 83 68"/></g>
      <g class="pul-eyes pul-eyes-sad"><path d="M37 64 Q45 72 53 66 M67 66 Q75 72 83 64"/><path class="pul-brow" d="M38 56 L52 60 M82 56 L68 60"/></g>
      <ellipse class="pul-blush" cx="34" cy="80" rx="6" ry="3.6"/>
      <ellipse class="pul-blush" cx="86" cy="80" rx="6" ry="3.6"/>
      <path class="pul-mouth pul-mouth-idle" d="M53 82 Q60 88 67 82"/>
      <path class="pul-mouth pul-mouth-open" d="M50 80 Q60 96 70 80 Z"/>
      <path class="pul-mouth pul-mouth-sad" d="M52 88 Q60 81 68 88"/>
      <path class="pul-mouth pul-mouth-think" d="M54 85 L66 83"/>
      <path class="pul-tear" d="M84 70 C84 70 89 77 89 80 A5 5 0 0 1 79 80 C79 77 84 70 84 70 Z"/>
    </g>
  </g>
  <g class="pul-sparks"><path d="M14 30 l4 8 l-8 -4 Z M106 26 l-4 9 l8 -5 Z M100 52 l7 1 l-6 4 Z"/></g>
  <g class="pul-dots"><circle cx="96" cy="40" r="3"/><circle cx="104" cy="30" r="4"/><circle cx="112" cy="18" r="5"/></g>
</svg>`;

  function create(mood, opts) {
    opts = opts || {};
    const wrap = document.createElement('span');
    wrap.className = 'pul' + (opts.className ? ' ' + opts.className : '');
    if (opts.size) wrap.style.setProperty('--pul-size', opts.size + 'px');
    if (opts.label) { wrap.setAttribute('role', 'img'); wrap.setAttribute('aria-label', opts.label); } else wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = SVG.trim();
    set(wrap, mood || 'idle');
    return wrap;
  }

  /* 표정 바꾸기. 같은 표정이어도 뛰는 움직임을 다시 보여 준다 */
  function set(el, mood) {
    if (!el) return;
    el.dataset.mood = MOODS.includes(mood) ? mood : 'idle';
    el.classList.remove('is-react');
    void el.offsetWidth; // 애니메이션 다시 시작
    if (mood === 'happy' || mood === 'sad' || mood === 'cheer') el.classList.add('is-react');
  }

  /* 캐릭터 대사 (짧게, 상황마다 몇 가지에서 고른다) */
  const LINES = {
    ask: ['이 문제, 같이 풀어 봐요!', '천천히 읽어 보세요.', '할 수 있어요!', '이건 시험에 나올지도 몰라요.'],
    happy: ['좋아요!', '바로 그거예요!', '완벽해요!', '역시!'],
    sad: ['괜찮아요, 다시 보면 돼요.', '아깝다! 해설을 같이 봐요.', '틀려도 기억에 남아요.'],
    cheer: ['레슨 끝! 정말 잘했어요!', '오늘도 한 걸음 더!', '이 기세로 계속 가요!']
  };
  const line = kind => { const l = LINES[kind] || LINES.ask; return l[Math.floor(Math.random() * l.length)]; };

  S.mascot = { create, set, line, MOODS };
})();
