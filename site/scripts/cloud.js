/* 무한 문제 클라우드
   문제 출처 3단계: ① AI 문제 은행(cloud/<과목>.json, 자동화 엔진이 계속 채움) ② 브라우저 문제 생성기(정보·일본어, 끝이 없음)
   ③ 둘 다 바닥나면 푼 문제 복습. 로컬 서버에서 열면 문제가 줄어들 때 자동으로 보충을 요청한다. */
(function () {
  'use strict';
  const S = window.Simpul;
  const G = S.generators;
  const el = S.el;
  const KEY = 'simpul.cloud.v1';
  const LEVEL = { easy: '쉬움', medium: '보통', hard: '어려움' };
  const $ = id => document.getElementById(id);
  const tabs = $('cloud-subjects'), unitSelect = $('cloud-unit'), levelSelect = $('cloud-level'), sourceSelect = $('cloud-source');
  const keyOf = q => (q.mine ? q.id : 'b' + q.id);
  if (/^(mine|shared)$/.test(new URLSearchParams(location.search).get('src') || '')) sourceSelect.value = new URLSearchParams(location.search).get('src');
  const card = $('cloud-card'), status = $('cloud-status');
  const duoToggle = S.duo && S.duo.toggle(); // 듀오링고 모드 스위치 (2학기 기말 버전에서만)
  if (duoToggle) document.querySelector('.page-head').append(duoToggle);

  let index = { subjects: {} };
  const banks = {};
  let local = false;
  let subject = new URLSearchParams(location.search).get('s') || '';
  let current = null, answered = false, sinceReview = 0;
  const refillAsked = new Set();

  /* 듀오링고 모드(2학기 기말 버전에서 켰을 때만): 5문제 레슨, 틀린 문제는 레슨 끝에 한 번 더, 결과 화면 */
  const D = S.duo && S.duo.active() ? S.duo : null;
  const params = new URLSearchParams(location.search);
  let wantUnit = params.get('u') || '';
  const mode = D && params.get('mode') === 'review' ? 'review' : 'lesson';
  const LESSON_SIZE = 5;
  let lesson = null;
  function newLesson() {
    const total = mode === 'review' ? Math.min(LESSON_SIZE, D.mistakes(subject, unitSelect.value).length) : LESSON_SIZE;
    lesson = { n: 0, total, correct: 0, xp: 0, retry: [], asked: new Set(), start: Date.now(), combo: 0 };
  }
  const lessonDone = () => lesson && lesson.n >= lesson.total && !lesson.retry.length;

  /* ── 기록 (이 기기에만) ── */
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || '{}'); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; }
  }
  const store = Object.assign({ seen: {}, wrong: {}, stats: {}, subject: '' }, load());
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 저장 불가 브라우저 */ } }
  const stats = () => (store.stats[subject] = store.stats[subject] || { solved: 0, correct: 0, streak: 0 });

  /* ── 데이터 ── */
  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(url);
    return r.json();
  }
  async function loadBank(id, force) {
    if (banks[id] && !force) return banks[id];
    try { banks[id] = (await getJSON('./cloud/' + id + '.json')).questions || []; } catch (e) { banks[id] = banks[id] || []; }
    return banks[id];
  }
  const bankCount = id => ((index.subjects[id] || {}).count || 0);
  const hasGen = id => G.subjects.includes(id);

  function pool() {
    const unit = unitSelect.value, level = levelSelect.value, src = sourceSelect.value;
    const list = (src === 'mine' ? [] : banks[subject] || []).concat(src === 'shared' ? [] : S.mine.forSubject(subject));
    return list.filter(q => (!unit || q.u === unit) && (!level || q.d === level));
  }
  const genUnits = () => G.units(subject);
  const unitIsGen = () => genUnits().includes(unitSelect.value);

  /* ── 다음 문제 고르기 ── */
  function nextQuestion() {
    if (D) {
      if (lesson.n >= lesson.total && lesson.retry.length) return Object.assign({}, lesson.retry.shift(), { tag: '다시 도전', retry: true });
      if (mode === 'review') {
        const left = D.mistakes(subject, unitSelect.value).filter(q => !lesson.asked.has(q._k));
        if (!left.length) return null;
        const q = left[Math.floor(Math.random() * left.length)];
        lesson.asked.add(q._k);
        return Object.assign({ tag: '틀린 문제 복습 · ' + q.miss + '번 틀림' }, q);
      }
    }
    const list = pool();
    const seen = store.seen, wrong = store.wrong;
    const unseen = list.filter(q => !seen[keyOf(q)]);
    sinceReview++;
    // 틀린 문제는 4문제마다 한 번 다시 나온다.
    const review = list.filter(q => wrong[keyOf(q)]);
    if (review.length && sinceReview >= 4) {
      sinceReview = 0;
      return Object.assign({ tag: '틀린 문제 다시 풀기' }, review[Math.floor(Math.random() * review.length)]);
    }
    if (unseen.length && !unitIsGen()) {
      maybeRefill(unseen.filter(q => !q.mine).length);
      const pickQ = unseen[Math.floor(Math.random() * unseen.length)];
      return Object.assign({ tag: pickQ.mine ? '내가 만든 문제' : 'AI 문제 은행' }, pickQ);
    }
    const level = levelSelect.value;
    for (let i = 0; i < 20 && hasGen(subject) && sourceSelect.value !== 'mine'; i++) {
      const g = G.generate(subject, unitIsGen() ? unitSelect.value : '');
      if (g && (!level || g.d === level)) return Object.assign({ tag: '자동 생성 · 무한' }, g);
    }
    maybeRefill(0);
    if (list.length) { // 새 문제가 없으면 복습
      list.forEach(q => { delete seen[keyOf(q)]; });
      save();
      return Object.assign({ tag: '복습 (모두 풀었어요)' }, list[Math.floor(Math.random() * list.length)]);
    }
    return null;
  }

  /* 로컬 서버에서 열었을 때만: 남은 새 문제가 적으면 자동화 엔진에 보충 요청 */
  function maybeRefill(left) {
    const unit = unitSelect.value;
    const key = subject + '|' + unit;
    if (!local || left >= 5 || refillAsked.has(key) || unitIsGen() || sourceSelect.value === 'mine') return;
    const units = Object.keys((index.subjects[subject] || {}).units || {});
    const target = unit || units[Math.floor(Math.random() * units.length)];
    if (!target) return;
    refillAsked.add(key);
    fetch('./api/auto/refill', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, unit: target, count: 10, reason: '학생 화면 자동 보충' }) }).catch(() => {});
    status.textContent = '새 문제가 얼마 남지 않아 AI가 더 만들고 있어요. 잠시 뒤 자동으로 추가돼요.';
  }

  /* ── 화면 ── */
  function renderTabs() {
    tabs.replaceChildren();
    S.SUBJECTS.forEach(s => {
      const n = bankCount(s.id);
      const m = S.mine.forSubject(s.id).length;
      const label = s.name + (n + m ? ' ' + (n + m) : '') + (hasGen(s.id) ? ' ∞' : '');
      const a = el('a', { href: '?s=' + s.id, text: label, 'aria-current': s.id === subject ? 'page' : null });
      a.addEventListener('click', e => { e.preventDefault(); choose(s.id); });
      tabs.append(el('li', {}, [a]));
    });
  }

  function renderUnits() {
    const units = (index.subjects[subject] || {}).units || {};
    unitSelect.replaceChildren(el('option', { value: '', text: '전체 단원' }));
    const keep = unitSelect.value;
    if (sourceSelect.value !== 'mine') Object.entries(units).sort().forEach(([u, n]) => unitSelect.append(el('option', { value: u, text: u + ' (' + n + ')' })));
    if (sourceSelect.value !== 'shared') {
      const mineUnits = {};
      S.mine.forSubject(subject).forEach(q => { mineUnits[q.u] = (mineUnits[q.u] || 0) + 1; });
      Object.entries(mineUnits).forEach(([u, n]) => unitSelect.append(el('option', { value: u, text: u + ' (내 문제 ' + n + ')' })));
    }
    if (sourceSelect.value !== 'mine') genUnits().forEach(u => unitSelect.append(el('option', { value: u, text: u + ' (∞ 자동 생성)' })));
    if ([...unitSelect.options].some(o => o.value === keep)) unitSelect.value = keep;
  }

  function renderStats() {
    const st = stats();
    $('stat-solved').textContent = st.solved;
    $('stat-rate').textContent = st.solved ? Math.round(st.correct / st.solved * 100) + '%' : '–';
    $('stat-streak').textContent = st.streak;
    const left = pool().filter(q => !store.seen[keyOf(q)]).length;
    $('stat-left').textContent = hasGen(subject) && sourceSelect.value !== 'mine' ? (left ? left + ' + ∞' : '∞') : left;
  }

  /* 듀오링고 모드 레슨 위쪽 줄: 나가기 · 진행 막대 · 연속 정답 */
  function renderLessonBar() {
    if (!D) return;
    let bar = $('duo-lesson-bar');
    if (!bar) {
      bar = el('div', { class: 'duo-lesson-bar', id: 'duo-lesson-bar' });
      card.before(bar);
    }
    const pct = lesson.total ? Math.round(Math.min(lesson.n, lesson.total) / lesson.total * 100) : 0;
    bar.replaceChildren(
      el('a', { class: 'duo-quit', href: './index.html', 'aria-label': '레슨 그만하고 홈으로', text: '✕' }),
      el('span', { class: 'duo-progress duo-progress-lg', role: 'progressbar', 'aria-label': '레슨 진행', 'aria-valuemin': '0', 'aria-valuemax': String(lesson.total), 'aria-valuenow': String(Math.min(lesson.n, lesson.total)) }, [el('span', { style: 'width:' + pct + '%' })]),
      el('span', { class: 'duo-combo' + (lesson.combo >= 3 ? ' is-hot' : ''), text: '🔥 ' + lesson.combo })
    );
  }

  function showResult() {
    const r = D.finishLesson(lesson);
    const secs = Math.round((Date.now() - lesson.start) / 1000);
    const xp = lesson.xp + r.bonus;
    D.sound(r.perfect ? 'perfect' : 'done');
    (r.quests || []).forEach((q, i) => D.sound(q.id === 'xp' ? 'goal' : 'quest', null, 1.6 + i * 0.9));
    const again = el('button', { class: 'btn btn-primary', type: 'button', text: mode === 'review' ? '복습 더 하기' : '다음 레슨' });
    again.addEventListener('click', () => { newLesson(); show(); });
    const streakLine = r.streak ? (r.streak.usedShield ? '🛡️ 방패가 연속 학습을 지켜 줬어요! ' : '') + '🔥 ' + r.streak.n + '일 연속 학습!' + (r.streak.newShield ? ' 방패 1개를 얻었어요.' : '') : '';
    card.replaceChildren(el('article', { class: 'question-card duo-result' }, [
      el('p', { class: 'duo-result-title', text: r.perfect ? '완벽해요! 한 문제도 안 틀렸어요' : '레슨 완료!' }),
      el('div', { class: 'duo-result-stats' }, [
        el('div', {}, [el('small', { text: '얻은 XP' }), el('b', { text: '+' + xp })]),
        el('div', {}, [el('small', { text: '정답' }), el('b', { text: lesson.correct + '/' + lesson.total })]),
        el('div', {}, [el('small', { text: '걸린 시간' }), el('b', { text: Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0') })])
      ]),
      streakLine ? el('p', { class: 'duo-result-streak', text: streakLine }) : null,
      el('p', { class: 'duo-note', text: '오늘 ' + D.today().xp + ' / ' + D.goal() + ' XP' }),
      el('div', { class: 'toolbar' }, [again, el('a', { class: 'btn btn-secondary', href: './index.html', text: '학습 경로로' })])
    ]));
    lesson.n = lesson.total; // 진행 막대를 가득 채운 채로 둔다
    renderLessonBar();
    again.focus();
  }

  function show() {
    if (D && !lesson) newLesson();
    if (D && lessonDone() && lesson.total) return showResult();
    current = nextQuestion();
    answered = false;
    renderStats();
    renderLessonBar();
    if (D && !current && mode === 'review') {
      card.replaceChildren(el('div', { class: 'concept' }, [
        el('p', { text: '이 과목에는 복습할 틀린 문제가 없어요. 잘했어요!' }),
        el('p', {}, [el('a', { class: 'btn btn-primary', href: 'cloud.html?s=' + subject, text: '새 문제 풀기' })])
      ]));
      return;
    }
    if (!current) {
      card.replaceChildren(el('div', { class: 'concept' }, [
        el('p', { text: sourceSelect.value === 'mine' ? '이 과목에서 내가 만든 문제가 아직 없어요.' : '이 과목에는 아직 공용 문제가 없어요.' }),
        el('p', { class: 'tip', text: '2학기 기말고사 문제를 준비하고 있어요. 지금은 정보·일본어만 무한 문제를 풀 수 있어요.' }),
        el('p', {}, [el('a', { class: 'btn btn-primary', href: 'make.html?s=' + subject, text: '내 문제 만들기' })])
      ]));
      return;
    }
    const q = current;
    const meta = [q.u, LEVEL[q.d], q.tag].filter(Boolean).join(' · ');
    const body = [el('h3', { text: meta }), el('p', { class: 'bank-text cloud-q', text: q.q })];
    const explain = el('div', { class: 'cloud-explain', hidden: '' }, [
      el('p', { class: 'cloud-answer', text: '정답: ' + q.a }),
      el('p', { class: 'bank-text', text: q.e })
    ]);
    const next = el('button', { class: 'btn btn-primary', type: 'button', text: '다음 문제 →', hidden: '' });
    next.addEventListener('click', show);

    if (q.c && q.c.length) {
      const list = el('div', { class: 'choice-list', role: 'group', 'aria-label': '보기' });
      q.c.forEach((c, i) => {
        const b = el('button', { class: 'choice', type: 'button' }, [el('span', { class: 'choice-no', text: '①②③④⑤⑥'[i] || i + 1 }), document.createTextNode(c)]);
        b.addEventListener('click', () => {
          if (answered) return;
          const ok = c === q.a;
          list.querySelectorAll('.choice').forEach((x, j) => {
            x.disabled = true;
            if (q.c[j] === q.a) x.classList.add('is-right');
          });
          if (!ok) b.classList.add('is-wrong');
          finish(ok, explain, next);
        });
        list.append(b);
      });
      body.push(list);
    } else {
      const id = 'cloud-response';
      const input = el('textarea', { id, rows: '2', placeholder: '답을 적어 보세요.' });
      const check = el('button', { class: 'btn btn-secondary', type: 'button', text: '정답 확인' });
      const grade = el('div', { class: 'toolbar', hidden: '' }, [
        el('span', { class: 'grade-ask', text: '맞았나요?' }),
        el('button', { class: 'btn btn-secondary', type: 'button', text: '맞았어요', 'data-ok': '1' }),
        el('button', { class: 'btn btn-secondary', type: 'button', text: '틀렸어요', 'data-ok': '0' })
      ]);
      check.addEventListener('click', () => {
        explain.hidden = false;
        check.hidden = true;
        const typed = input.value.replace(/\s+/g, '');
        if (typed && typed === q.a.replace(/\s+/g, '')) finish(true, explain, next); // 정확히 같으면 자동 채점
        else grade.hidden = false;
      });
      grade.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b || answered) return;
        grade.hidden = true;
        finish(b.dataset.ok === '1', explain, next);
      });
      body.push(el('label', { for: id, text: '나의 답' }), input, el('div', { class: 'toolbar', style: 'margin-top:10px' }, [check]), grade);
    }
    if (D) { next.textContent = '계속'; explain.append(el('div', { class: 'toolbar duo-sheet-actions' }, [next])); body.push(explain); }
    else body.push(explain, el('div', { class: 'toolbar', style: 'margin-top:14px' }, [next]));
    card.replaceChildren(el('article', { class: 'question-card cloud-card' }, body));
  }

  function finish(ok, explain, next) {
    if (answered) return;
    answered = true;
    const st = stats();
    st.solved++;
    if (ok) { st.correct++; st.streak++; } else st.streak = 0;
    if (!current.gen && current.id) {
      const key = keyOf(current);
      store.seen[key] = 1;
      if (ok) delete store.wrong[key]; else store.wrong[key] = 1;
    }
    save();
    explain.hidden = false;
    let praise = ok ? '정답이에요!' : '아쉬워요. 해설을 확인하세요.';
    if (D) {
      const r = D.answer({ ok, q: current, bankKey: current.gen ? null : keyOf(current), subject, retry: !!current.retry });
      if (!current.retry) {
        lesson.n++;
        if (ok) lesson.correct++;
        else lesson.retry.push(Object.assign({}, current, { tag: undefined }));
      }
      lesson.xp += r.gain;
      lesson.combo = ok ? lesson.combo + 1 : 0;
      D.sound(ok ? 'ok' : 'bad', lesson.combo);
      if (ok && (lesson.combo === 3 || lesson.combo === 5 || lesson.combo === 10)) D.sound('combo', null, 0.32);
      (r.quests || []).forEach((q, i) => D.sound(q.id === 'xp' ? 'goal' : 'quest', null, 0.7 + i * 0.9));
      explain.classList.add('duo-sheet', ok ? 'is-ok' : 'is-bad');
      if (ok) praise = (r.gain ? '+' + r.gain + ' XP · ' : '') + (lesson.combo >= 3 ? lesson.combo + '연속 정답!' : ['좋아요!', '정답!', '훌륭해요!'][lesson.combo % 3]);
      else praise = current.retry ? '아쉬워요. 이 문제는 복습 목록에 남겨 둘게요.' : '괜찮아요! 레슨 끝에 한 번 더 나와요.';
      next.textContent = lessonDone() ? '결과 보기' : '계속';
      renderLessonBar();
    }
    explain.prepend(el('p', { class: ok ? 'result-ok' : 'result-bad', text: praise }));
    next.hidden = false;
    next.focus();
    renderStats();
  }

  async function choose(id) {
    subject = id;
    store.subject = id;
    save();
    history.replaceState(null, '', '?s=' + id + (sourceSelect.value ? '&src=' + sourceSelect.value : '') + (mode === 'review' ? '&mode=review' : ''));
    renderTabs();
    status.textContent = '문제를 불러오고 있어요.';
    await loadBank(id);
    renderUnits();
    if (wantUnit && [...unitSelect.options].some(o => o.value === wantUnit)) unitSelect.value = wantUnit;
    wantUnit = '';
    if (D) newLesson();
    const mineN = S.mine.forSubject(id).length;
    status.textContent = bankCount(id) || hasGen(id) || mineN
      ? ['공용 문제 ' + bankCount(id) + '개', mineN ? '내 문제 ' + mineN + '개' : '', hasGen(id) ? '자동 생성 문제 무한' : ''].filter(Boolean).join(' + ') + (D ? (mode === 'review' ? '. 틀린 문제 복습 레슨이에요.' : '. 5문제 레슨이에요. 숫자 키로 고르고 Enter로 계속.') : '. 풀고 나서 ‘다음 문제’를 누르세요.')
      : '이 과목은 2학기 기말고사 문제를 모으는 중이에요.';
    show();
  }

  const restart = () => { if (D) newLesson(); show(); };
  if (D) { // 듀오링고 모드 키보드: 숫자 1~5로 보기 고르기, Enter로 계속
    document.addEventListener('keydown', e => {
      if (e.target.closest('textarea, input, select') || e.metaKey || e.ctrlKey || e.altKey) return;
      const choices = card.querySelectorAll('.choice:not([disabled])');
      if (/^[1-6]$/.test(e.key) && choices[e.key - 1]) { e.preventDefault(); choices[e.key - 1].click(); return; }
      if (e.key === 'Enter') {
        const btn = [...card.querySelectorAll('.btn-primary')].find(b => !b.hidden && b.offsetParent);
        if (btn && document.activeElement !== btn) { e.preventDefault(); btn.click(); }
      }
    });
  }
  unitSelect.addEventListener('change', restart);
  sourceSelect.addEventListener('change', () => { renderUnits(); restart(); });
  levelSelect.addEventListener('change', restart);
  $('cloud-reset').addEventListener('click', () => {
    (banks[subject] || []).concat(S.mine.forSubject(subject)).forEach(q => { delete store.seen[keyOf(q)]; delete store.wrong[keyOf(q)]; });
    store.stats[subject] = { solved: 0, correct: 0, streak: 0 };
    save();
    show();
  });

  async function init() {
    try { index = await getJSON('./cloud/index.json'); } catch (e) { index = { subjects: {} }; }
    try { local = (await fetch('./api/auto/status', { cache: 'no-store' })).ok; } catch (e) { local = false; }
    if (!S.findSubject(subject)) subject = S.findSubject(store.subject) ? store.subject : (S.SUBJECTS.find(s => bankCount(s.id) || hasGen(s.id)) || S.findSubject('info')).id;
    await choose(subject);
    if (local) { // 로컬에서는 엔진이 새로 만든 문제를 30초마다 받아 온다.
      setInterval(async () => {
        try {
          index = await getJSON('./cloud/index.json');
          const before = (banks[subject] || []).length;
          await loadBank(subject, true);
          if (banks[subject].length !== before) { renderTabs(); const u = unitSelect.value; renderUnits(); unitSelect.value = u; renderStats(); }
        } catch (e) { /* 다음 주기에 다시 */ }
      }, 30000);
    }
  }
  init();
})();
