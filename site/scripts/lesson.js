/* 듀오링고식 레슨 화면 (lesson.html?s=과목&u=단원, 복습은 &mode=review)
   흐름: 문제 고르기 → 확인 → 아래 결과 패널 → 계속. 틀린 문제는 레슨 끝에 다시 나온다(문제마다 최대 2번).
   끝나면 레슨 완료 화면 → (연속 학습일이 늘었으면) 연속 학습 화면 → 학습 경로로.
   듀오링고 모드가 꺼져 있으면 무한 문제 클라우드로 보낸다. 기록은 이 기기에만 저장. */
(function () {
  'use strict';
  const S = window.Simpul, D = S.duo, G = S.generators, el = S.el;
  const P = new URLSearchParams(location.search);
  const subject = P.get('s') || '';
  const unit = P.get('u') || '';
  const mode = P.get('mode') === 'review' ? 'review' : 'lesson';
  if (!D || !D.active() || !S.findSubject(subject)) {
    location.replace('cloud.html' + (subject ? '?s=' + subject + (unit ? '&u=' + encodeURIComponent(unit) : '') : ''));
    return;
  }
  const SIZE = 5, MAX_RETRY = 2;
  const $ = id => document.getElementById(id);
  const main = $('ls-main'), foot = $('ls-foot');

  /* 무한 문제 클라우드와 같은 ‘푼 문제·틀린 문제’ 기록을 함께 쓴다 */
  const CKEY = 'simpul.cloud.v1';
  let cstore;
  try { cstore = JSON.parse(localStorage.getItem(CKEY) || '{}') || {}; } catch (e) { cstore = {}; }
  cstore = Object.assign({ seen: {}, wrong: {}, stats: {}, subject: '' }, cstore);
  const csave = () => { try { localStorage.setItem(CKEY, JSON.stringify(cstore)); } catch (e) { /* 저장 불가 */ } };
  const keyOf = q => (q.mine ? q.id : 'b' + q.id);

  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ── 문제 고르기 ── */
  async function build() {
    if (mode === 'review') {
      return shuffle(D.mistakes(subject, unit)).slice(0, SIZE).map(q => Object.assign({ old: true }, q));
    }
    let bank = [];
    try { bank = await S.bank.load(subject); } catch (e) { bank = []; }
    const pool = bank.concat(S.mine ? S.mine.forSubject(subject) : []).filter(q => !unit || q.u === unit);
    const unseen = shuffle(pool.filter(q => !cstore.seen[keyOf(q)]));
    const picks = unseen.slice(0, SIZE);
    const canGen = G && (unit ? G.units(subject).includes(unit) : G.subjects.includes(subject));
    for (let i = 0; picks.length < SIZE && canGen && i < 40; i++) { const g = G.generate(subject, unit); if (g) picks.push(g); }
    if (picks.length < SIZE) shuffle(pool.filter(q => !picks.includes(q))).slice(0, SIZE - picks.length).forEach(q => picks.push(q));
    /* 이 단원에서 전에 틀린 문제가 있으면 하나를 섞는다 (듀오링고의 ‘이전 실수’처럼) */
    const old = D.mistakes(subject, unit);
    if (old.length && picks.length) picks.splice(Math.floor(Math.random() * picks.length), picks.length >= SIZE ? 1 : 0, Object.assign({ old: true }, old[Math.floor(Math.random() * old.length)]));
    return picks.slice(0, SIZE);
  }

  /* ── 레슨 상태 ── */
  let items = [], queue = [], cur = null, picked = null, phase = 'idle';
  const M = S.mascot;
  /* 위쪽 연속 정답 🔥 이모지를 납작한 불꽃 그림으로 바꾼다 */
  let comboFire = null;
  if (S.flame) {
    const box = $('ls-streak');
    if (box && box.firstChild && box.firstChild.nodeType === 3) box.firstChild.replaceWith(comboFire = S.flame.icon({ lit: false, size: 22 }), ' ');
  } // 캐릭터 ‘풀이’: 문제를 말풍선으로 말하고 답에 따라 표정이 바뀐다
  let pul = null;
  const L = { total: 0, done: 0, firstRight: 0, xp: 0, combo: 0, start: 0, streak: null };

  function setBar() {
    const pct = L.total ? Math.round(L.done / L.total * 100) : 0;
    $('ls-bar-fill').style.width = pct + '%';
    $('ls-bar').setAttribute('aria-valuemax', String(L.total));
    $('ls-bar').setAttribute('aria-valuenow', String(L.done));
    $('ls-combo').textContent = L.combo;
    $('ls-streak').classList.toggle('is-hot', L.combo >= 3);
    /* 3연속 정답부터 불꽃이 켜지고, 연속이 길수록 빠르게 일렁인다. 틀리면 꺼진다 */
    if (S.flame && comboFire) S.flame.set(comboFire, L.combo >= 3, L.combo >= 10 ? 3 : L.combo >= 7 ? 2 : L.combo >= 5 ? 1 : 0);
  }
  function comboTag(n) {
    if (S.flame && comboFire) S.flame.burstAt(comboFire, { count: Math.min(40, 10 + n * 2) });
    const tag = $('ls-combo-tag');
    tag.textContent = n + '연속 정답!';
    tag.hidden = false;
    tag.classList.remove('is-pop'); void tag.offsetWidth; tag.classList.add('is-pop');
    clearTimeout(comboTag.t);
    comboTag.t = setTimeout(() => { tag.hidden = true; }, 1500);
  }

  /* 일일 퀘스트를 방금 끝냈으면: 위에서 내려오는 알림 + 소리 (하루 XP 목표는 따로 팡파르) */
  function celebrate(list, delay) {
    (list || []).forEach((q, i) => {
      const wait = delay + i * 0.9;
      D.sound(q.id === 'xp' ? 'goal' : 'quest', null, wait);
      setTimeout(() => {
        const t = el('div', { class: 'ls-toast', role: 'status' }, [
          el('span', { class: 'ls-toast-ico', 'aria-hidden': 'true', text: q.id === 'xp' ? '🎯' : '🎁' }),
          el('span', {}, [el('b', { text: q.id === 'xp' ? '오늘 목표 달성!' : '퀘스트 완료!' }), el('small', { text: q.title })])
        ]);
        document.body.append(t);
        setTimeout(() => t.classList.add('is-out'), 2400);
        setTimeout(() => t.remove(), 2900);
      }, wait * 1000);
    });
  }

  /* ── 문제 화면 ── */
  function showItem() {
    cur = queue.shift();
    if (!cur) return finish();
    picked = null; phase = 'idle';
    const q = cur.q;
    const isOX = S.bank.isOX(q);
    const isChoice = q.c && q.c.length;
    const head = [];
    if (cur.tries > 0) head.push(el('span', { class: 'ls-tag ls-tag-retry', text: '↻ 다시 도전' }));
    else if (q.old) head.push(el('span', { class: 'ls-tag ls-tag-old', text: '이전에 틀린 문제' }));
    head.push(el('span', { class: 'ls-unit', text: q.u || '' }));
    const body = el('section', { class: 'ls-challenge', 'aria-live': 'polite' }, [
      el('div', { class: 'ls-head' }, head),
      el('h1', { class: 'ls-title', text: isOX ? '맞으면 O, 틀리면 X' : isChoice ? '알맞은 답을 고르세요' : '답을 입력하세요' }),
      M ? el('div', { class: 'pul-say pul-say-stack ls-say' }, [
        (pul = M.create(cur.tries > 0 || q.old ? 'think' : 'idle', { size: 92 })),
        el('div', { class: 'pul-bubble' }, [el('p', { class: 'ls-prompt', text: q.q })])
      ]) : el('p', { class: 'ls-prompt', text: q.q })
    ]);
    const fig = S.bank && S.bank.figure ? S.bank.figure(q) : null;
    if (fig) body.append(fig);
    if (isOX) {
      const list = el('div', { class: 'ls-ox', role: 'radiogroup', 'aria-label': 'O 또는 X' });
      q.c.forEach((c, i) => {
        const b = el('button', { class: 'ls-choice', type: 'button', role: 'radio', 'aria-checked': 'false', 'data-i': String(i), 'data-ox': c, 'aria-label': c === 'O' ? '맞다 (O)' : '틀리다 (X)' }, [
          el('span', { class: 'ls-ox-mark', 'aria-hidden': 'true', text: c === 'O' ? '○' : '✕' }),
          el('span', { class: 'ls-choice-text', text: c === 'O' ? '맞다' : '틀리다' })
        ]);
        b.addEventListener('click', () => select(i));
        list.append(b);
      });
      body.append(list);
    } else if (isChoice) {
      const list = el('div', { class: 'ls-choices', role: 'radiogroup', 'aria-label': '보기' });
      q.c.forEach((c, i) => {
        const b = el('button', { class: 'ls-choice', type: 'button', role: 'radio', 'aria-checked': 'false', 'data-i': String(i) }, [
          el('span', { class: 'ls-key', text: String(i + 1), 'aria-hidden': 'true' }),
          el('span', { class: 'ls-choice-text', text: c })
        ]);
        b.addEventListener('click', () => select(i));
        list.append(b);
      });
      body.append(list);
    } else {
      const ta = el('textarea', { class: 'ls-input', id: 'ls-input', rows: '3', placeholder: '여기에 답을 적어 보세요', 'aria-label': '나의 답', autocomplete: 'off' });
      ta.addEventListener('input', () => { picked = ta.value.trim() ? ta.value : null; idleFoot(); });
      body.append(ta);
      setTimeout(() => ta.focus(), 50);
    }
    main.replaceChildren(body);
    main.scrollTop = 0;
    idleFoot();
  }

  function select(i) {
    if (phase !== 'idle') return;
    if (picked !== i) D.sound('tap');
    picked = i;
    main.querySelectorAll('.ls-choice').forEach((b, j) => {
      b.classList.toggle('is-picked', j === i);
      b.setAttribute('aria-checked', j === i ? 'true' : 'false');
    });
    idleFoot();
  }

  /* ── 아래 패널 ── */
  function idleFoot() {
    foot.className = 'ls-foot';
    const skip = el('button', { class: 'ls-btn ls-btn-ghost', type: 'button', text: '건너뛰기' });
    skip.addEventListener('click', () => grade(false, true));
    const check = el('button', { class: 'ls-btn ls-btn-green', type: 'button', text: '확인', id: 'ls-primary' });
    if (picked === null) check.disabled = true;
    check.addEventListener('click', onCheck);
    foot.replaceChildren(el('div', { class: 'ls-foot-in' }, [skip, check]));
  }

  function onCheck() {
    if (phase !== 'idle' || picked === null) return;
    const q = cur.q;
    if (q.c && q.c.length) return grade(q.c[picked] === q.a);
    const typed = String(picked).replace(/\s+/g, '');
    if (typed === String(q.a).replace(/\s+/g, '')) return grade(true);
    /* 서술형이라 글자가 다르면 스스로 채점 */
    phase = 'self';
    $('ls-input').readOnly = true;
    foot.className = 'ls-foot is-self';
    const no = el('button', { class: 'ls-btn ls-btn-ghost', type: 'button', text: '틀렸어요' });
    const yes = el('button', { class: 'ls-btn ls-btn-green', type: 'button', text: '맞았어요', id: 'ls-primary' });
    no.addEventListener('click', () => { phase = 'idle'; grade(false); });
    yes.addEventListener('click', () => { phase = 'idle'; grade(true); });
    foot.replaceChildren(el('div', { class: 'ls-foot-in ls-foot-self' }, [
      el('div', { class: 'ls-verdict' }, [
        el('p', { class: 'ls-verdict-title', text: '정답과 비교해 보세요' }),
        el('p', { class: 'ls-answer' }, [el('b', { text: '정답: ' }), document.createTextNode(q.a)]),
        q.e ? el('p', { class: 'ls-explain', text: q.e }) : null
      ]),
      el('div', { class: 'ls-foot-btns' }, [no, yes])
    ]));
    yes.focus();
  }

  function grade(ok, skipped) {
    if (phase !== 'idle') return;
    phase = 'graded';
    if (M) M.set(pul, ok ? 'happy' : 'sad');
    const q = cur.q;
    const retry = cur.tries > 0;
    /* 화면 표시 */
    main.querySelectorAll('.ls-choice').forEach((b, j) => {
      b.disabled = true;
      if (q.c[j] === q.a) b.classList.add('is-right');
      else if (j === picked && !ok) b.classList.add('is-wrong');
    });
    /* 기록 */
    const bankKey = q.gen || q._k ? null : keyOf(q);
    const r = D.answer({ ok, q, bankKey, subject, retry });
    if (bankKey) { cstore.seen[bankKey] = 1; if (ok) delete cstore.wrong[bankKey]; else cstore.wrong[bankKey] = 1; }
    const st = (cstore.stats[subject] = cstore.stats[subject] || { solved: 0, correct: 0, streak: 0 });
    st.solved++; if (ok) { st.correct++; st.streak++; } else st.streak = 0;
    csave();
    if (r.streak) L.streak = r.streak;
    L.xp += r.gain;
    if (ok) {
      if (!retry) L.firstRight++;
      L.done++;
      L.combo++;
      if (L.combo >= 3) comboTag(L.combo);
    } else {
      L.combo = 0;
      cur.tries++;
      if (cur.tries <= MAX_RETRY) queue.push(cur); else L.done++; // 두 번 더 틀리면 넘어간다 (복습 목록엔 남음)
    }
    setBar();
    D.sound(ok ? 'ok' : 'bad', L.combo);
    if (ok && (L.combo === 3 || L.combo === 5 || L.combo === 10)) D.sound('combo', null, 0.32);
    celebrate(r.quests, 0.7);
    /* 결과 패널 */
    const praise = ['좋아요!', '훌륭해요!', '정답이에요!', '완벽해요!', '대단해요!'];
    const title = ok ? praise[Math.floor(Math.random() * praise.length)] : skipped ? '건너뛰었어요' : '오답이에요';
    foot.className = 'ls-foot ' + (ok ? 'is-ok' : 'is-bad');
    const go = el('button', { class: 'ls-btn ' + (ok ? 'ls-btn-green' : 'ls-btn-red'), type: 'button', text: '계속', id: 'ls-primary' });
    go.addEventListener('click', () => { if (queue.length) D.sound('next'); showItem(); });
    foot.replaceChildren(el('div', { class: 'ls-foot-in ls-foot-result' }, [
      el('div', { class: 'ls-verdict' }, [
        el('p', { class: 'ls-verdict-title' }, [
          el('span', { class: 'ls-verdict-icon', 'aria-hidden': 'true', text: ok ? '✓' : '✕' }),
          document.createTextNode(title + (ok && r.gain ? '  +' + r.gain + ' XP' : ''))
        ]),
        ok ? null : el('p', { class: 'ls-answer' }, [el('b', { text: '정답: ' }), document.createTextNode(q.a)]),
        q.e ? el('p', { class: 'ls-explain', text: q.e }) : null,
        !ok && cur.tries <= MAX_RETRY ? el('p', { class: 'ls-note', text: '이 문제는 레슨 끝에 다시 나와요.' }) : null
      ]),
      go
    ]));
    go.focus();
  }

  /* ── 끝 화면들 ── */
  function finish() {
    const r = D.finishLesson({ total: L.total, correct: L.firstRight });
    if (r.streak) L.streak = r.streak;
    const xp = L.xp + r.bonus;
    const secs = Math.round((Date.now() - L.start) / 1000);
    const acc = L.total ? Math.round(L.firstRight / L.total * 100) : 0;
    D.sound(r.perfect ? 'perfect' : 'done');
    celebrate(r.quests, 1.6);
    $('ls-app').classList.add('is-end');
    const tile = (cls, label, value) => el('div', { class: 'ls-stat ' + cls }, [el('span', { class: 'ls-stat-label', text: label }), el('span', { class: 'ls-stat-value', text: value })]);
    main.replaceChildren(el('section', { class: 'ls-end' }, [
      M ? el('div', { class: 'ls-burst ls-burst-pul' }, [M.create('cheer', { size: 150, label: '풀이가 축하해요' })]) : el('div', { class: 'ls-burst', 'aria-hidden': 'true' }, [el('span', { text: r.perfect ? '🏆' : '🎉' })]),
      el('h1', { class: 'ls-end-title', text: r.perfect ? '완벽한 레슨!' : mode === 'review' ? '복습 완료!' : '레슨 완료!' }),
      el('p', { class: 'ls-end-sub', text: r.perfect ? '한 문제도 안 틀렸어요. 보너스 XP를 받았어요.' : '틀린 문제는 복습 목록에 모아 둘게요.' }),
      el('div', { class: 'ls-stats' }, [
        tile('is-gold', '총 XP', String(xp)),
        tile('is-green', '정확도', acc + '%'),
        tile('is-blue', '시간', Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'))
      ])
    ]));
    foot.className = 'ls-foot';
    const again = el('button', { class: 'ls-btn ls-btn-ghost', type: 'button', text: mode === 'review' ? '복습 더 하기' : '한 번 더' });
    again.addEventListener('click', () => location.reload());
    const go = el('button', { class: 'ls-btn ls-btn-green', type: 'button', text: '계속', id: 'ls-primary' });
    go.addEventListener('click', () => (L.streak ? streakScreen() : leave()));
    foot.replaceChildren(el('div', { class: 'ls-foot-in' }, [again, go]));
    go.focus();
  }

  function streakScreen() {
    const s = L.streak;
    D.sound('streak');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const today = new Date().getDay();
    const week = el('div', { class: 'ls-week', 'aria-hidden': 'true' });
    for (let i = 6; i >= 0; i--) {
      const d = (today - i + 7) % 7;
      const lit = i < Math.min(s.n, 7);
      week.append(el('span', { class: 'ls-day' + (lit ? ' is-lit' : '') + (i === 0 ? ' is-today' : '') }, [el('b', { text: days[d] }), el('i', { text: lit ? '✓' : '' })]));
    }
    main.replaceChildren(el('section', { class: 'ls-end ls-streak-end' }, [
      S.flame ? el('div', { class: 'ls-flame ls-flame-svg', id: 'ls-big-flame' }, [S.flame.icon({ big: true, lit: true })]) : el('div', { class: 'ls-flame', 'aria-hidden': 'true', text: '🔥' }),
      el('p', { class: 'ls-streak-num', text: String(s.n) }),
      el('h1', { class: 'ls-end-title is-orange', text: s.n + '일 연속 학습!' }),
      el('p', { class: 'ls-end-sub', text: s.usedShield ? '🛡️ 방패가 연속 기록을 지켜 줬어요!' : s.newShield ? '7일 달성! 방패 1개를 얻었어요.' : '내일도 한 레슨만 하면 기록이 이어져요.' }),
      week
    ]));
    if (S.flame) setTimeout(() => S.flame.burstAt($('ls-big-flame'), { count: 30 }), 450); // 큰 불꽃이 통통 튄 뒤 불티
    const go = el('button', { class: 'ls-btn ls-btn-green', type: 'button', text: '계속', id: 'ls-primary' });
    go.addEventListener('click', leave);
    foot.replaceChildren(el('div', { class: 'ls-foot-in ls-foot-one' }, [go]));
    go.focus();
  }

  const leave = () => { location.href = './index.html?ps=' + subject + '#duo-path'; };

  /* ── 나가기 확인 ── */
  const modal = $('ls-modal');
  if (M) { const emo = modal.querySelector('.ls-modal-emoji'); if (emo) emo.replaceWith(M.create('sad', { size: 96, className: 'ls-modal-pul' })); }
  $('ls-quit').addEventListener('click', () => {
    if ($('ls-app').classList.contains('is-end') || !L.total) return leave();
    modal.hidden = false; $('ls-stay').focus();
  });
  $('ls-stay').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });

  /* ── 키보드: 숫자로 보기, Enter로 확인·계속, Esc로 나가기 ── */
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { if (!modal.hidden) modal.hidden = true; else $('ls-quit').click(); return; }
    if (!modal.hidden) return;
    const inText = e.target.closest('textarea');
    if (!inText && /^[oOxX]$/.test(e.key) && phase === 'idle') {
      const b = main.querySelector('.ls-choice[data-ox="' + e.key.toUpperCase() + '"]');
      if (b) { e.preventDefault(); b.click(); }
      return;
    }
    if (!inText && /^[1-9]$/.test(e.key) && phase === 'idle') {
      const b = main.querySelectorAll('.ls-choice')[e.key - 1];
      if (b) { e.preventDefault(); b.click(); }
      return;
    }
    if (e.key === 'Enter' && !(inText && e.shiftKey)) {
      const btn = $('ls-primary');
      if (btn && !btn.disabled && document.activeElement !== btn) { e.preventDefault(); btn.click(); }
    }
  });

  /* ── 시작 ── */
  (async function start() {
    const list = await build();
    if (!list.length) {
      main.replaceChildren(el('section', { class: 'ls-end' }, [
        M ? el('div', { class: 'ls-burst ls-burst-pul' }, [M.create(mode === 'review' ? 'happy' : 'think', { size: 130 })]) : el('div', { class: 'ls-burst', 'aria-hidden': 'true' }, [el('span', { text: mode === 'review' ? '✨' : '📭' })]),
        el('h1', { class: 'ls-end-title', text: mode === 'review' ? '복습할 문제가 없어요' : '아직 문제가 없어요' }),
        el('p', { class: 'ls-end-sub', text: mode === 'review' ? '틀린 문제를 모두 해결했어요!' : '이 단원 문제를 준비하고 있어요. 내 문제를 만들어도 돼요.' })
      ]));
      const go = el('button', { class: 'ls-btn ls-btn-green', type: 'button', text: '학습 경로로', id: 'ls-primary' });
      go.addEventListener('click', leave);
      foot.replaceChildren(el('div', { class: 'ls-foot-in ls-foot-one' }, [go]));
      $('ls-app').classList.add('is-end');
      return;
    }
    items = list.map(q => ({ q, tries: 0 }));
    queue = items.slice();
    L.total = items.length;
    L.start = Date.now();
    document.title = (mode === 'review' ? '틀린 문제 복습' : (unit || S.findSubject(subject).name)) + ' · 레슨';
    setBar();
    showItem();
  })();
})();
