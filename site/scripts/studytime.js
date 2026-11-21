/* 공부 시간 기록 (공부 타이머와 홈이 함께 씀). 열품타처럼 과목을 누르면 시간이 쌓인다.
   시간은 ‘시작 시각’만 저장해 두고 그때그때 계산하므로, 탭을 닫거나 화면이 꺼져도 정확하다.
   자정을 넘기면 날짜별로 나눠 기록한다. 기록은 이 기기(localStorage)에만 저장한다. */
(function () {
  'use strict';
  const S = window.Simpul = window.Simpul || {};
  const KEY = 'simpul.timer.v1';
  const MAX_RUN_MS = 12 * 3600 * 1000; // 켜 둔 채 잊어버린 경우: 12시간까지만 기록

  const blank = () => ({ run: null, days: {}, goal: 180, dday: { name: '', date: '' }, todos: {}, guard: false });
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return Object.assign(blank(), d && typeof d === 'object' ? d : {}); }
    catch (e) { return blank(); }
  }
  let st = load();
  const listeners = new Set();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* 저장 불가 */ }
    listeners.forEach(fn => fn());
  }
  /* 다른 탭에서 바뀌면 따라간다 */
  window.addEventListener('storage', e => { if (e.key === KEY) { st = load(); listeners.forEach(fn => fn()); } });

  const pad = n => String(n).padStart(2, '0');
  const dayOf = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const nextMidnight = t => { const d = new Date(t); d.setHours(24, 0, 0, 0); return d.getTime(); };
  const today = () => dayOf(Date.now());

  /* from~to 구간을 날짜별로 나눠 더한다 */
  function addSpan(subject, from, to) {
    while (from < to) {
      const end = Math.min(to, nextMidnight(from));
      const day = (st.days[dayOf(from)] = st.days[dayOf(from)] || {});
      day[subject] = (day[subject] || 0) + Math.round((end - from) / 1000);
      from = end;
    }
  }

  function stop(at) {
    if (!st.run) return null;
    const end = Math.min(at || Date.now(), st.run.t + MAX_RUN_MS);
    const ran = { s: st.run.s, ms: end - st.run.t };
    addSpan(st.run.s, st.run.t, end);
    st.run = null;
    save();
    return ran;
  }
  function start(subject) {
    if (st.run && st.run.s === subject) return;
    if (st.run) stop();
    st.run = { s: subject, t: Date.now() };
    save();
  }
  /* 켜 둔 채 12시간이 넘었으면 12시간까지만 기록하고 멈춘다 */
  function checkForgotten() {
    if (st.run && Date.now() - st.run.t > MAX_RUN_MS) { const r = stop(); return r; }
    return null;
  }

  /* 날짜 하나의 과목별 초 (지금 켜져 있는 시간 포함) */
  function secondsOn(date) {
    const out = Object.assign({}, st.days[date] || {});
    if (st.run) {
      let from = st.run.t;
      const to = Math.min(Date.now(), st.run.t + MAX_RUN_MS);
      while (from < to) {
        const end = Math.min(to, nextMidnight(from));
        if (dayOf(from) === date) out[st.run.s] = (out[st.run.s] || 0) + Math.round((end - from) / 1000);
        from = end;
      }
    }
    return out;
  }
  const totalOn = date => Object.values(secondsOn(date)).reduce((a, b) => a + b, 0);
  function lastDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i); out.push(dayOf(d.getTime())); }
    return out;
  }
  const runSeconds = () => (st.run ? Math.round((Math.min(Date.now(), st.run.t + MAX_RUN_MS) - st.run.t) / 1000) : 0);

  const clock = sec => { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 3600) + ':' + pad(Math.floor(sec % 3600 / 60)) + ':' + pad(sec % 60); };
  const words = sec => {
    sec = Math.max(0, Math.floor(sec));
    if (sec > 0 && sec < 60) return sec + '초';
    const m = Math.floor(sec / 60), h = Math.floor(m / 60);
    if (h && m % 60) return h + '시간 ' + (m % 60) + '분';
    if (h) return h + '시간';
    return m + '분';
  };

  /* ── 딴짓 방지 (모든 페이지 공통) ──
     심풀스터디 안에서 다른 페이지로 가는 건 괜찮고, 사이트 밖(다른 탭·앱)으로 나가면 멈춘다.
     페이지를 떠날 때 ‘떠난 시각’을 적어 두고:
       · 몇 초 안에 심풀스터디의 다른 페이지가 열리면 → 사이트 안 이동이니 계속
       · 같은 페이지로 다시 돌아오거나 한참 뒤에 열리면 → 떠난 시각까지만 기록하고 멈춤
     (휴대폰 사파리처럼 beforeunload가 없는 브라우저에서도 같은 방식으로 동작) */
  const AWAY_KEY = 'simpul.timer.away', NAV_GRACE_MS = 5000;
  const guardFns = new Set();
  let guardPending = null;
  function guardStop(at) {
    const r = stop(at);
    if (!r) return;
    if (guardFns.size) guardFns.forEach(fn => fn(r)); else guardPending = r;
  }
  function readAway() { try { return JSON.parse(localStorage.getItem(AWAY_KEY) || 'null'); } catch (e) { return null; } }
  function clearAway() { try { localStorage.removeItem(AWAY_KEY); } catch (e) { /* 저장 불가 */ } }
  /* 페이지가 열릴 때: 직전에 떠난 기록 확인 */
  (function onOpen() {
    const away = readAway();
    if (!away) return;
    clearAway();
    st = load();
    if (!st.run || !st.guard) return;
    if (Date.now() - away.at > NAV_GRACE_MS) guardStop(away.at);
  })();
  const pageId = Math.random().toString(36).slice(2);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      st = load();
      if (st.run && st.guard) { try { localStorage.setItem(AWAY_KEY, JSON.stringify({ at: Date.now(), page: pageId })); } catch (e) { /* 저장 불가 */ } }
    } else {
      const away = readAway();
      if (!away) return;
      clearAway();
      st = load();
      /* 떠났던 그 페이지로 돌아옴 = 다른 탭·앱에 다녀옴 → 멈춤. 다른 심풀스터디 탭이 보이게 된 것 = 사이트 안 이동 → 계속 */
      if (st.run && st.guard && away.page === pageId) guardStop(away.at);
    }
  });

  /* ── 랭킹 그룹에 들어간 기기만: 최근 8일 날짜별 공부 시간 합계(초)를 서버로 보낸다 ──
     과목·할 일·D-day는 보내지 않는다. 기록이 바뀌면 10초 뒤, 공부 중이면 2분마다. */
  const RANK_KEY = 'simpul.rank.joined';
  const rankJoined = () => { try { return localStorage.getItem(RANK_KEY) === '1'; } catch (e) { return false; } };
  let syncTimer = null, lastSync = 0;
  function syncRank(force) {
    if (!rankJoined() || location.protocol === 'file:' || !S.uid) return Promise.resolve(false);
    if (!force && Date.now() - lastSync < 20000) return Promise.resolve(false);
    lastSync = Date.now();
    const days = {};
    lastDays(8).forEach(d => { const t = totalOn(d); if (t > 0) days[d] = t; });
    return fetch('./api/study/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: S.uid(), days }), keepalive: true })
      .then(r => r.ok).catch(() => false);
  }
  listeners.add(() => { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncRank(true), 10000); });
  setInterval(() => { if (st.run && !document.hidden) syncRank(true); }, 120000);
  document.addEventListener('visibilitychange', () => { if (document.hidden && st.run) syncRank(true); });

  S.study = {
    syncRank, setRankJoined(on) { try { on ? localStorage.setItem(RANK_KEY, '1') : localStorage.removeItem(RANK_KEY); } catch (e) { /* 저장 불가 */ } },
    onGuardStop(fn) { guardFns.add(fn); if (guardPending) { const r = guardPending; guardPending = null; fn(r); } },
    get: () => st, save, start, stop, checkForgotten, secondsOn, totalOn, lastDays, today, dayOf, runSeconds,
    clock, words, onChange: fn => listeners.add(fn),
    /* 공부 기록과 할 일만 지운다 (목표·D-day·딴짓 방지 설정은 남김) */
    reset() { st = Object.assign(blank(), { goal: st.goal, dday: st.dday, guard: st.guard }); save(); }
  };
})();
