/* 듀오링고 모드 — 2학기 기말 버전에서만 켤 수 있고 기본은 꺼짐.
   켜면: 하루 XP 목표, 연속 학습일과 방패, 일일 퀘스트, 단원 경로, 5문제 레슨, 틀린 문제 복습(28일 보관).
   기록은 이 기기 브라우저(localStorage)에만 저장한다. 서버로 보내지 않는다. */
(function () {
  'use strict';
  const S = window.Simpul;
  const KEY = 'simpul.duo.v1';
  const ONLY_VERSION = 's2-final';
  const MISTAKE_TTL = 28 * 24 * 3600 * 1000; // Duolingo 웹 앱의 틀린 문제 기록 보관 기간과 같게
  const MISTAKE_MAX = 300;
  const XP_RIGHT = 10, XP_LESSON = 5, XP_PERFECT = 5;
  const UNIT_GOAL = 10; // 단원 하나를 ‘완료’로 보는 정답 수

  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || '{}'); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; }
  }
  const st = Object.assign({ on: false, sound: true, goal: 30, days: {}, streak: { n: 0, last: '', best: 0, shields: 0 }, mistakes: {}, units: {} }, load());
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* 저장 불가 브라우저 */ } }

  const allowed = () => S.version && S.version.id === ONLY_VERSION;
  const active = () => allowed() && st.on === true;

  /* ── 날짜 (기기 시간 기준) ── */
  const pad = n => String(n).padStart(2, '0');
  const dayOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const shift = n => { const d = new Date(); d.setDate(d.getDate() + n); return dayOf(d); };
  const today = () => dayOf(new Date());
  const todayStats = () => (st.days[today()] = st.days[today()] || { xp: 0, correct: 0, solved: 0, combo: 0, best: 0, reviewed: 0, lessons: 0 });
  function pruneDays() {
    const keep = shift(-35);
    Object.keys(st.days).forEach(k => { if (k < keep) delete st.days[k]; });
  }

  /* ── 연속 학습일: XP를 처음 얻는 날 늘어난다. 하루 빠진 날은 방패가 있으면 지켜 준다. ── */
  function touchStreak() {
    const s = st.streak, t = today();
    if (s.last === t) return null;
    let usedShield = false;
    if (s.last === shift(-1)) s.n++;
    else if (s.last === shift(-2) && s.shields > 0) { s.shields--; s.n++; usedShield = true; }
    else s.n = 1;
    s.last = t;
    if (s.n % 7 === 0) s.shields = Math.min(2, s.shields + 1);
    s.best = Math.max(s.best, s.n);
    return { n: s.n, usedShield, newShield: s.n % 7 === 0 && s.shields > 0 };
  }
  function streakNow() {
    const s = st.streak;
    if (s.last === today() || s.last === shift(-1)) return s.n;
    if (s.last === shift(-2) && s.shields > 0) return s.n;
    return 0;
  }

  /* ── 틀린 문제 기록 ── */
  function hash(text) { let h = 5381; for (let i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) >>> 0; return h.toString(36); }
  const keyFor = (q, bankKey) => q._k || (q.gen ? 'g' + hash(q.q) : bankKey);
  function pruneMistakes() {
    const now = Date.now();
    const list = Object.entries(st.mistakes).filter(([, m]) => now - m.t < MISTAKE_TTL);
    list.sort((a, b) => b[1].t - a[1].t);
    st.mistakes = Object.fromEntries(list.slice(0, MISTAKE_MAX));
  }
  function mistakes(subject, unit) {
    pruneMistakes();
    return Object.entries(st.mistakes)
      .filter(([, m]) => m.s === subject && (!unit || m.q.u === unit))
      .map(([k, m]) => Object.assign({}, m.q, { _k: k, miss: m.miss }));
  }
  function mistakeCounts() {
    pruneMistakes();
    const out = {};
    Object.values(st.mistakes).forEach(m => { out[m.s] = (out[m.s] || 0) + 1; });
    return out;
  }

  /* ── 한 문제 채점 결과 기록. 얻은 XP를 돌려준다. ── */
  function answer({ ok, q, bankKey, subject, retry }) {
    const before = doneIds();
    const day = todayStats();
    const key = keyFor(q, bankKey);
    let gain = 0, streak = null;
    day.solved++;
    if (ok) {
      day.combo++;
      day.best = Math.max(day.best, day.combo);
      if (!retry) {
        gain = XP_RIGHT;
        day.correct++;
        const uk = subject + '|' + (q.u || '');
        st.units[uk] = (st.units[uk] || 0) + 1;
      }
      if (st.mistakes[key]) { delete st.mistakes[key]; day.reviewed++; }
    } else {
      day.combo = 0;
      const old = st.mistakes[key];
      st.mistakes[key] = { s: subject, t: Date.now(), miss: (old ? old.miss : 0) + 1,
        q: { q: q.q, c: q.c || [], a: q.a, e: q.e || '', u: q.u || '', d: q.d || '', t: q.t || '' } };
      pruneMistakes();
    }
    if (gain) { day.xp += gain; streak = touchStreak(); }
    pruneDays();
    save();
    return { gain, streak, combo: day.combo, quests: newlyDone(before) };
  }

  /* 레슨이 끝나면 보너스 XP */
  function finishLesson({ total, correct }) {
    const before = doneIds();
    const day = todayStats();
    let bonus = total ? XP_LESSON : 0;
    if (total && correct === total) bonus += XP_PERFECT;
    day.xp += bonus;
    day.lessons++;
    const streak = bonus ? touchStreak() : null;
    save();
    return { bonus, streak, perfect: total > 0 && correct === total, quests: newlyDone(before) };
  }

  /* ── 일일 퀘스트 (매일 같은 3개, 오늘 기록으로 계산) ── */
  function quests() {
    const d = todayStats();
    return [
      { id: 'xp', title: st.goal + ' XP 얻기', now: d.xp, goal: st.goal },
      { id: 'correct', title: '문제 10개 맞히기', now: d.correct, goal: 10 },
      { id: 'combo', title: '5문제 연속 맞히기', now: d.best, goal: 5 }
    ].map(q => Object.assign(q, { done: q.now >= q.goal, pct: Math.min(100, Math.round(q.now / q.goal * 100)) }));
  }

  /* ── 소리 (Web Audio로 직접 합성, 외부 파일 없음) ──
     듀오링고 효과음의 ‘설계’만 참고했다 (음원은 쓰지 않음):
       · 정답: 짧고 밝은 종소리가 위로 올라가는 2음 (장조, 0.3초 안)
       · 오답: 낮게 아래로 꺼지는 2음. 벌 주는 느낌 없이 부드럽게
       · 보기 누름·계속: 아주 짧은 ‘톡’ (40~60ms) — 손맛만 준다
       · 연속 정답: 정답음이 한 음씩 높아진다
       · 레슨 완료·퀘스트·연속 학습일: 아르페지오 + 반짝임으로 보상감
     모든 소리는 마스터 → 컴프레서를 거쳐 겹쳐도 찢어지지 않게 한다. */
  let audio = null, master = null, noiseBuf = null;
  function ctx() {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      const comp = audio.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4;
      master = audio.createGain(); master.gain.value = 0.9;
      master.connect(comp).connect(audio.destination);
    }
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  /* 엔벨로프 붙은 단음. bend는 끝 주파수 비율(1이면 그대로) */
  function tone(f, t, dur, o) {
    o = o || {};
    const a = audio, osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.bend && o.bend !== 1) osc.frequency.exponentialRampToValueAtTime(f * o.bend, t + dur);
    const vol = o.vol == null ? 0.2 : o.vol, atk = o.atk || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g;
    if (o.lp) { const flt = a.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = o.lp; g.connect(flt); out = flt; }
    osc.connect(g); out.connect(master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  /* 종소리: 배음을 겹치고 높은 배음일수록 빨리 사라지게 */
  function bell(f, t, dur, vol) {
    vol = vol == null ? 0.18 : vol;
    [[1, 1], [2, 0.42], [3, 0.18], [4.07, 0.1]].forEach(([m, a], i) => tone(f * m, t, dur / (1 + i * 0.7), { vol: vol * a, atk: 0.003 }));
  }
  /* 쉭 소리: 노이즈를 대역 필터로 쓸어 올린다 */
  function whoosh(t, dur, from, to, vol) {
    const a = audio;
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = a.createBufferSource(), flt = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf;
    flt.type = 'bandpass'; flt.Q.value = 1.4;
    flt.frequency.setValueAtTime(from, t); flt.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.25, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }
  /* 반짝임: 높은 음 몇 개를 흩뿌린다 */
  function sparkle(t, n, base) {
    const scale = [0, 4, 7, 11, 12, 16, 19];
    for (let i = 0; i < n; i++) bell(midi(base + scale[Math.floor(Math.random() * scale.length)]), t + i * 0.045 + Math.random() * 0.02, 0.35, 0.05);
  }

  const SOUNDS = {
    /* 보기 고를 때 */
    tap(t) { tone(1300, t, 0.05, { vol: 0.09, bend: 0.7 }); },
    /* ‘계속’으로 다음 문제 */
    next(t) { tone(520, t, 0.07, { vol: 0.08, bend: 1.6, type: 'triangle' }); },
    /* 정답: 콤보가 쌓일수록 한 반음씩 (최대 7) 올라간다 */
    ok(t, combo) {
      const up = Math.min(Math.max((combo || 1) - 1, 0), 7);
      bell(midi(76 + up), t, 0.28, 0.17);          // E5
      bell(midi(83 + up), t + 0.085, 0.5, 0.2);    // B5
      tone(midi(88 + up), t + 0.085, 0.4, { vol: 0.04 }); // 위에 얹는 맑은 음
      if (combo >= 5) sparkle(t + 0.15, 3, 88 + up);
    },
    /* 오답 */
    bad(t) {
      tone(midi(55), t, 0.16, { type: 'square', vol: 0.07, lp: 900, bend: 0.94 });
      tone(midi(50), t + 0.13, 0.32, { type: 'square', vol: 0.08, lp: 700, bend: 0.9 });
      tone(midi(38), t + 0.13, 0.32, { type: 'sine', vol: 0.12, bend: 0.9 });
    },
    /* 3·5·10 연속 정답 이정표 */
    combo(t) { [79, 83, 86, 91].forEach((n, i) => bell(midi(n), t + i * 0.06, 0.3, 0.1)); },
    /* 레슨 완료 */
    done(t) {
      [72, 76, 79, 84].forEach((n, i) => bell(midi(n), t + i * 0.09, 0.4, 0.16));
      const c = t + 0.36;
      [60, 64, 67, 72].forEach(n => tone(midi(n), c, 1.1, { type: 'triangle', vol: 0.07, atk: 0.02 }));
      bell(midi(88), c, 1.0, 0.12);
      sparkle(c + 0.1, 6, 84);
    },
    /* 한 문제도 안 틀린 레슨 */
    perfect(t) {
      [72, 76, 79, 84, 88, 91].forEach((n, i) => bell(midi(n), t + i * 0.07, 0.4, 0.15));
      const c = t + 0.45;
      [60, 64, 67, 71, 72].forEach(n => tone(midi(n), c, 1.4, { type: 'triangle', vol: 0.06, atk: 0.02 }));
      bell(midi(96), c, 1.2, 0.1);
      sparkle(c + 0.05, 10, 86);
    },
    /* 연속 학습일 화면: 불붙는 쉭 + 올라가는 종 */
    streak(t) {
      whoosh(t, 0.5, 300, 3500, 0.22);
      tone(midi(48), t, 0.5, { type: 'sawtooth', vol: 0.05, lp: 600, bend: 2 });
      [76, 79, 83, 88].forEach((n, i) => bell(midi(n), t + 0.42 + i * 0.07, 0.5, 0.14));
      sparkle(t + 0.7, 5, 88);
    },
    /* 일일 퀘스트 하나 완료: 상자 여는 짤랑 */
    quest(t) {
      tone(midi(43), t, 0.12, { type: 'triangle', vol: 0.15, bend: 0.8 });
      [79, 83, 86, 91, 95].forEach((n, i) => bell(midi(n), t + 0.08 + i * 0.05, 0.35, 0.12));
      bell(midi(98), t + 0.38, 0.9, 0.1);
      sparkle(t + 0.4, 6, 91);
    },
    /* 하루 XP 목표 달성 */
    goal(t) {
      [67, 72, 76, 79].forEach((n, i) => tone(midi(n), t + i * 0.1, 0.25, { type: 'square', vol: 0.05, lp: 2400 }));
      [72, 76, 79, 84].forEach(n => tone(midi(n), t + 0.42, 0.9, { type: 'triangle', vol: 0.07, atk: 0.01 }));
      bell(midi(91), t + 0.42, 1, 0.12);
      sparkle(t + 0.5, 6, 84);
    }
  };
  function sound(kind, arg, delay) {
    if (!st.sound || !SOUNDS[kind]) return;
    try { const a = ctx(); SOUNDS[kind](a.currentTime + 0.01 + (delay || 0), arg); } catch (e) { /* 소리를 못 내는 브라우저 */ }
  }
  /* 방금 끝난 퀘스트 찾기: 기록하기 전·후의 quests()를 비교 */
  const doneIds = () => quests().filter(q => q.done).map(q => q.id);
  const newlyDone = before => quests().filter(q => q.done && !before.includes(q.id));

  /* ── 켜고 끄기 스위치: 2학기 기말 버전에서만 보인다 ── */
  function toggle() {
    if (!allowed()) return null;
    const el = S.el;
    const input = el('input', { type: 'checkbox', role: 'switch', id: 'duo-switch' });
    input.checked = active();
    input.addEventListener('change', () => {
      st.on = input.checked;
      save();
      switchWithWipe(st.on, input.nextElementSibling);
    });
    const box = el('div', { class: 'duo-toggle' }, [
      el('label', { class: 'duo-switch', for: 'duo-switch' }, [
        input, el('span', { class: 'duo-switch-track', 'aria-hidden': 'true' }),
        el('span', { class: 'duo-switch-text' }, [
          el('strong', { text: '듀오링고 모드' }),
          el('small', { text: active() ? '켜짐 · XP, 연속 학습일, 5문제 레슨, 틀린 문제 복습' : '꺼짐 · 켜면 매일 조금씩 푸는 화면으로 바뀌어요' })
        ])
      ])
    ]);
    if (active()) {
      const snd = el('button', { type: 'button', class: 'duo-mini', text: st.sound ? '소리 켜짐' : '소리 꺼짐', 'aria-pressed': st.sound ? 'true' : 'false' });
      snd.addEventListener('click', () => {
        st.sound = !st.sound; save();
        snd.textContent = st.sound ? '소리 켜짐' : '소리 꺼짐';
        snd.setAttribute('aria-pressed', st.sound ? 'true' : 'false');
        if (st.sound) sound('ok');
      });
      const goal = el('select', { class: 'duo-mini', 'aria-label': '하루 목표 XP' });
      [[10, '가볍게 10 XP'], [30, '보통 30 XP'], [50, '열심히 50 XP'], [100, '시험 직전 100 XP']].forEach(([v, t]) => {
        const o = el('option', { value: String(v), text: '하루 목표 · ' + t });
        if (v === st.goal) o.selected = true;
        goal.append(o);
      });
      goal.addEventListener('change', () => { st.goal = Number(goal.value) || 30; save(); location.reload(); });
      box.append(el('div', { class: 'duo-toggle-tools' }, [goal, snd]));
    }
    return box;
  }

  /* 켜고 끌 때: 스위치 자리에서 원이 퍼지며 화면을 덮은 뒤 새로고침.
     켤 때는 듀오링고 초록(#58CC02), 끌 때는 원래 사이트 배경색. 새로고침 뒤 드러나는 애니메이션은 duo.css가 맡는다. */
  function switchWithWipe(on, from) {
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { sessionStorage.setItem('simpul.duo.anim', on ? 'in' : 'out'); } catch (e) { /* 저장 불가 */ }
    if (reduce || !document.body.animate) { location.reload(); return; }
    const r = from.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    const wipe = document.createElement('div');
    wipe.className = 'duo-wipe';
    wipe.style.background = on ? '#58CC02' : (light ? '#ffffff' : '#09090b');
    document.body.append(wipe);
    const anim = wipe.animate(
      [{ clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' }, { clipPath: 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)' }],
      { duration: 520, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    anim.onfinish = () => location.reload();
    setTimeout(() => location.reload(), 1200); // 애니메이션이 멈춰도 새로고침은 한다
  }

  /* 화면 색: 머리 부분 스크립트가 미리 붙인 표시를 실제 상태에 맞춘다 */
  const html = document.documentElement;
  if (active()) html.setAttribute('data-duo', ''); else html.removeAttribute('data-duo');
  if (!active() && html.getAttribute('data-duo-anim') === 'in') html.removeAttribute('data-duo-anim');
  if (html.hasAttribute('data-duo-anim')) setTimeout(() => html.removeAttribute('data-duo-anim'), 1400);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta && active()) themeMeta.setAttribute('content', html.getAttribute('data-theme') === 'light' ? '#ffffff' : '#131f24');

  /* 바깥(첫 화면 인트로 등)에서 켜고 끄기. from은 원이 퍼지기 시작할 요소 */
  function set(on, from) {
    if (!allowed()) return;
    st.on = !!on;
    save();
    switchWithWipe(st.on, from || document.body);
  }

  S.duo = {
    active, allowed, toggle, set, answer, finishLesson, quests, mistakes, mistakeCounts, keyFor, sound,
    streakNow, shields: () => st.streak.shields, best: () => st.streak.best,
    today: todayStats, goal: () => st.goal,
    unitProgress: (s, u) => st.units[s + '|' + u] || 0, UNIT_GOAL,
    playedToday: () => st.streak.last === today()
  };
})();
