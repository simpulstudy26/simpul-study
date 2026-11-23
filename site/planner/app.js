/* 역산 스터디 플래너 — 시험 준비를 끝낼 날(기본 12월 11일)에서 거꾸로 계산해 매일 할 일을 정한다.
   역산 순서: 끝나는 날 ← 최종 점검(과목별 총정리) ← 2회독(문제·복습) ← 1회독(개념)
   하루에 공부할 수 있는 시간을 끝나는 날부터 거꾸로 쌓아서 각 단계가 언제 시작·마감돼야 하는지 구하고,
   오늘부터 순서대로 하루 시간에 맞게 채운다. 못 한 일은 다음 날로 자동으로 다시 계산된다.
   모든 기록은 이 기기(localStorage)에만 저장된다. */
(function () {
  'use strict';
  const D = window.PLANNER_DATA;
  const P = window.Planner || window.Simpul || {}; // 심풀 안에서는 심풀의 풀이(scripts/mascot.js)를 쓴다
  const EMBED = !!window.PLANNER_EMBED;
  const KEY = 'yeoksan.planner.v1';
  const $ = s => document.querySelector(s);

  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : String(c)); });
    return e;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round5 = v => Math.max(5, Math.round(v / 5) * 5);

  /* ══ 날짜 (이 기기 시간 기준 YYYY-MM-DD) ══ */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diff = (a, b) => Math.round((Date.UTC(...b.split('-').map((v, i) => i === 1 ? v - 1 : +v)) - Date.UTC(...a.split('-').map((v, i) => i === 1 ? v - 1 : +v))) / 864e5);
  const today = () => ymd(new Date());
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const md = s => { const d = parse(s); return (d.getMonth() + 1) + '/' + d.getDate(); };
  const mdw = s => { const d = parse(s); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WD[d.getDay()] + ')'; };
  const hm = m => { m = Math.round(m); const hh = Math.floor(m / 60), mm = m % 60; return hh ? hh + '시간' + (mm ? ' ' + mm + '분' : '') : mm + '분'; };

  /* ══ 저장 ══ */
  const SUBJ = D.subjects;
  const subj = id => SUBJ.find(s => s.id === id);
  function blank() {
    return {
      v: 1, setup: false, end: D.end, cap: { wd: 240, we: 360 }, off: [], level: {},
      include: Object.fromEntries(SUBJ.map(s => [s.id, true])),
      ranges: JSON.parse(JSON.stringify(D.ranges)), done: {}, skip: {}, sound: true, theme: 'system'
    };
  }
  let st = (() => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) return Object.assign(blank(), s); } catch (e) { /* 무시 */ } return blank(); })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* 저장 불가 */ } };
  // 반을 바꿔 새로 생긴 과목(정보↔일본어)은 넣은 상태로, 범위는 기본값으로 채운다
  SUBJ.forEach(s => { if (!(s.id in st.include)) st.include[s.id] = true; if (!st.ranges[s.id]) st.ranges[s.id] = JSON.parse(JSON.stringify(D.ranges[s.id] || [])); });

  /* ══ 할 일 만들기 ══ */
  const ROUND = { 1: '1회독 · 개념', 2: '2회독 · 문제', 3: '최종 점검' };
  const LEVEL = { 1: { name: '약해요', f: 1.3 }, 2: { name: '보통', f: 1 }, 3: { name: '자신 있어요', f: 0.75 } };
  const CHUNK = 8; // 한 번에 볼 쪽수(안팎)
  function buildTasks() {
    const per = {}; // 과목별 [1회독들], [2회독들], 최종
    SUBJ.filter(s => st.include[s.id]).forEach(s => {
      const f = LEVEL[st.level[s.id] || 2].f;
      const r1 = [], r2 = [];
      (st.ranges[s.id] || []).forEach(it => {
        if (it.p && it.p[1] >= it.p[0]) {
          const [a, b] = it.p, total = b - a + 1, n = Math.max(1, Math.ceil(total / CHUNK)), size = Math.ceil(total / n);
          for (let k = 0, from = a; from <= b; k++, from += size) {
            const to = Math.min(b, from + size - 1), pages = to - from + 1;
            const label = it.src + ' p.' + from + (to > from ? '~' + to : '');
            r1.push({ id: it.id + '.' + k + '.1', s: s.id, round: 1, label, item: it, min: round5(Math.max(15, pages * 4 * f)) });
            r2.push({ id: it.id + '.' + k + '.2', s: s.id, round: 2, label, item: it, min: round5(Math.max(10, pages * 2 * f)) });
          }
        } else {
          const base = it.min || 60, label = it.src + ' ' + it.text;
          // 긴 자료는 40분 안팎으로 나눈다
          const n1 = Math.max(1, Math.round(base * f / 45));
          for (let k = 0; k < n1; k++) r1.push({ id: it.id + '.' + k + '.1', s: s.id, round: 1, label: label + (n1 > 1 ? ' (' + (k + 1) + '/' + n1 + ')' : ''), item: it, min: round5(base * f / n1) });
          r2.push({ id: it.id + '.0.2', s: s.id, round: 2, label, item: it, min: round5(Math.max(15, base * 0.5 * f)) });
        }
      });
      per[s.id] = { r1, r2, fin: { id: s.id + '.final', s: s.id, round: 3, label: '오답·암기 총정리', min: round5(50 * f) } };
    });
    // 같은 단계 안에서는 과목을 번갈아 (하루에 한 과목만 몰리지 않게)
    const rr = key => { const lists = Object.values(per).map(p => p[key].slice()), out = []; let more = true; while (more) { more = false; lists.forEach(l => { if (l.length) { out.push(l.shift()); more = true; } }); } return out; };
    const tasks = rr('r1').concat(rr('r2'), Object.values(per).map(p => p.fin));
    tasks.forEach((t, i) => { t.seq = i; });
    return tasks;
  }

  /* ══ 하루 공부 가능 시간 ══ */
  const doneOn = date => Object.values(st.done).filter(d => d.at === date).reduce((a, d) => a + d.min, 0);
  function baseCap(date) {
    if (st.off.includes(date)) return 0;
    const w = parse(date).getDay();
    return w === 0 || w === 6 ? st.cap.we : st.cap.wd;
  }
  const capOf = date => date === today() ? Math.max(0, baseCap(date) - doneOn(date)) : baseCap(date);

  /* ══ 역산 + 배치 ══ */
  function plan() {
    const t0 = today(), end = st.end;
    const tasks = buildTasks();
    const pending = tasks.filter(t => !st.done[t.id]);
    const days = [];
    for (let d = t0; diff(d, end) >= 0; d = addDays(d, 1)) days.push(d);
    const sum = r => pending.filter(t => t.round === r).reduce((a, t) => a + t.min, 0);
    const need = { 1: sum(1), 2: sum(2), 3: sum(3) };

    // 끝나는 날부터 거꾸로 시간을 쌓아 단계 시작일을 구한다
    const back = days.slice().reverse();
    let acc = 0, target = need[3], phase = 3;
    const start = { 3: null, 2: null, 1: t0 };
    for (const d of back) {
      acc += capOf(d);
      while (phase >= 2 && acc >= target) { start[phase] = d; phase--; target += phase >= 2 ? need[phase] : need[1]; if (phase < 2) break; }
      if (phase < 2) break;
    }
    if (!start[3]) start[3] = t0;
    if (!start[2]) start[2] = t0;
    const total = need[1] + need[2] + need[3];
    const capTotal = days.reduce((a, d) => a + capOf(d), 0);

    // 오늘부터 순서대로 채우기 (최종 점검은 역산한 시작일부터)
    const byDay = Object.fromEntries(days.map(d => [d, []]));
    const queue = pending.slice().sort((a, b) => a.seq - b.seq);
    for (const d of days) {
      let cap = capOf(d);
      for (let i = 0; i < queue.length && cap > 0;) {
        const t = queue[i];
        if (st.skip[t.id] === d || (t.round === 3 && diff(start[3], d) < 0)) { i++; continue; }
        if (t.min <= cap + 10 || byDay[d].length === 0 && cap >= 25) { byDay[d].push(t); cap -= t.min; queue.splice(i, 1); }
        else break; // 순서를 지키려고 다음 날로
      }
    }
    const overflow = queue;
    // 과목별 마일스톤: 각 단계가 실제로 끝나는 날
    const when = {};
    days.forEach(d => byDay[d].forEach(t => { when[t.id] = d; }));
    tasks.forEach(t => { if (st.done[t.id]) when[t.id] = st.done[t.id].at; });
    const subjects = SUBJ.filter(s => st.include[s.id]).map(s => {
      const ts = tasks.filter(t => t.s === s.id);
      const last = r => ts.filter(t => t.round === r).map(t => when[t.id] || null).reduce((a, b) => (a === undefined ? b : (a === null || b === null ? null : (a > b ? a : b))), undefined);
      const doneMin = ts.filter(t => st.done[t.id]).reduce((a, t) => a + t.min, 0), allMin = ts.reduce((a, t) => a + t.min, 0);
      return { s, tasks: ts, r1: last(1), r2: last(2), r3: last(3), pct: allMin ? doneMin / allMin : 0, doneMin, allMin };
    });
    return { days, byDay, overflow, start, need, total, capTotal, tasks, subjects };
  }

  /* ══ XP · 연속 학습일 ══ */
  const xpOf = t => 10 + Math.floor(t.min / 15) * 2;
  function totalXp() { return Object.values(st.done).reduce((a, d) => a + (d.xp || 0), 0); }
  function streak() {
    const days = new Set(Object.values(st.done).map(d => d.at));
    let d = today(), n = 0;
    if (!days.has(d)) d = addDays(d, -1);
    while (days.has(d)) { n++; d = addDays(d, -1); }
    return { n, today: days.has(today()) };
  }

  /* ══ 소리 ══ */
  let actx = null;
  function sound(kind) {
    if (!st.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + 0.01;
      const note = (f, at, dur, type, vol) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type || 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol || 0.18, at + 0.015); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
        o.connect(g).connect(actx.destination); o.start(at); o.stop(at + dur + 0.05);
      };
      if (kind === 'ok') { note(880, t, 0.16, 'triangle'); note(1318.5, t + 0.09, 0.28, 'triangle'); }
      else if (kind === 'undo') note(330, t, 0.15, 'sine', 0.1);
      else if (kind === 'win') [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, t + i * 0.11, 0.35, 'triangle', 0.16));
      else if (kind === 'tap') note(600, t, 0.06, 'sine', 0.06);
    } catch (e) { /* 소리 불가 */ }
  }

  /* ══ 꽃가루 ══ */
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = h('canvas', { class: 'confetti' }); document.body.append(c);
    const dpr = devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    const colors = ['#58CC02', '#1CB0F6', '#FFC800', '#FF4B4B', '#CE82FF', '#FF9600'];
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: colors[Math.floor(Math.random() * colors.length)] }));
    const t0 = performance.now();
    (function tick(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); });
      if (now - t0 < 2600) requestAnimationFrame(tick); else c.remove();
    })(t0);
  }

  /* ══ 아이콘 ══ */
  const I = {
    today: '<path d="M12 2c1 3 4 4.5 4 8.5A4 4 0 0 1 12 15a4 4 0 0 1-4-4.5c0-1.5.6-2.6 1.5-3.5.2 1.4 1 2.2 2 2.5C11 7 11 4.5 12 2Z"/><path d="M5 14a7 7 0 0 0 14 0"/><path d="M8 21h8"/>',
    plan: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 15 2 2 4-4"/>',
    subjects: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.5 1.3 2.8 2.5 2.8Z"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22v-7"/>',
    skip: '<path d="m5 4 10 8-10 8V4Z"/><path d="M19 5v14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'
  };
  const icon = (n, s) => '<svg viewBox="0 0 24 24" width="' + (s || 22) + '" height="' + (s || 22) + '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>';

  /* ══ 화면 틀 ══ */
  const app = $('#app');
  let tab = 'today';
  let P0 = null; // 마지막 계획
  function applyTheme() {
    // 심풀 안에서는 사이트 화면 모드(simpul.theme: 기본 다크, 'light'면 라이트)를 따른다
    let siteLight = false; try { siteLight = localStorage.getItem('simpul.theme') === 'light'; } catch (e) { /* 무시 */ }
    const dark = EMBED ? !siteLight : st.theme === 'dark' || (st.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark ? '#131F24' : '#FFFFFF';
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  addEventListener('storage', e => { if (e.key === 'simpul.theme') applyTheme(); });

  function render() {
    applyTheme();
    if (!st.setup) { renderOnboarding(); return; }
    P0 = plan();
    app.innerHTML = '';
    app.classList.add('has-nav');
    const nav = h('nav', { class: 'nav', 'aria-label': '메뉴' },
      h('div', { class: 'nav-logo' }, h('span', { class: 'logo-mark', text: '역' }), h('span', { text: '역산 플래너' })),
      ...[['today', '오늘'], ['plan', '계획'], ['subjects', '과목'], ['settings', '설정']].map(([id, name]) =>
        h('button', { type: 'button', class: 'nav-btn', 'aria-current': tab === id ? 'page' : null, onclick: () => { tab = id; sound('tap'); render(); scrollTo(0, 0); }, html: icon(id, 26) + '<span>' + name + '</span>' })));
    const main = h('main', { class: 'main' });
    main.append(statBar());
    if (tab === 'today') main.append(...viewToday());
    else if (tab === 'plan') main.append(...viewPlan());
    else if (tab === 'subjects') main.append(...viewSubjects());
    else main.append(...viewSettings());
    const side = h('aside', { class: 'side' }, ...sidePanel());
    app.append(nav, main, side);
  }

  function statBar() {
    const s = streak(), left = Math.max(0, diff(today(), st.end));
    return h('header', { class: 'stats' },
      h('div', { class: 'stat stat-dday', title: '준비 끝나는 날 ' + mdw(st.end) }, h('span', { html: icon('flag', 20) }), h('b', { text: left ? 'D-' + left : 'D-day' })),
      h('div', { class: 'stat stat-streak' + (s.today ? ' is-on' : ''), title: '연속 학습일' }, h('span', { html: icon('flame', 20) }), h('b', { text: String(s.n) })),
      h('div', { class: 'stat stat-xp', title: '경험치' }, h('span', { html: icon('bolt', 20) }), h('b', { text: String(totalXp()) })));
  }

  /* ── 오늘 ── */
  function todayItems() {
    const t = today();
    const planned = (P0.byDay[t] || []);
    const doneToday = P0.tasks.filter(x => st.done[x.id] && st.done[x.id].at === t);
    return { planned, doneToday };
  }
  function viewToday() {
    const t = today(), { planned, doneToday } = todayItems();
    const all = doneToday.concat(planned);
    const doneMin = doneToday.reduce((a, x) => a + x.min, 0), allMin = all.reduce((a, x) => a + x.min, 0);
    const pct = allMin ? doneMin / allMin : 1;
    const left = diff(t, st.end);
    const out = [];
    if (left < 0) {
      out.push(h('section', { class: 'card hero' }, speech('cheer', '시험 준비 기간이 끝났어요! 정말 수고 많았어요. 설정에서 다음 시험 날짜를 정할 수 있어요.')));
      return out;
    }
    let line;
    if (!all.length) line = baseCap(t) ? '오늘 할 일이 없어요. 계획보다 앞서 있어요!' : '오늘은 쉬는 날이에요. 푹 쉬고 내일 봐요!';
    else if (pct >= 1) line = '오늘 할 일을 모두 끝냈어요! 내일 할 일을 미리 해도 좋아요.';
    else if (doneMin) line = '좋아요! ' + hm(allMin - doneMin) + '만 더 하면 오늘 목표 끝!';
    else line = mdw(st.end) + '까지 거꾸로 계산했어요. 오늘은 ' + hm(allMin) + '!';
    out.push(h('section', { class: 'card hero' },
      speech(pct >= 1 && all.length ? 'cheer' : 'idle', line, 'pul-today'),
      h('div', { class: 'goal' },
        ring(pct),
        h('div', { class: 'goal-txt' }, h('b', { text: '오늘 목표' }), h('span', { text: hm(doneMin) + ' / ' + hm(allMin) + ' · ' + all.length + '개 중 ' + doneToday.length + '개' })))));
    if (P0.overflow.length) out.push(warnCard());
    const list = h('section', { class: 'tasks' });
    all.forEach(x => list.append(taskCard(x, true)));
    out.push(h('h2', { class: 'sec', text: mdw(t) + ' 할 일' }), list);
    // 내일 미리 하기
    const next = P0.days.slice(1).find(d => P0.byDay[d].length);
    if (next && pct >= 1 && all.length) {
      out.push(h('h2', { class: 'sec', text: '미리 하기 · ' + mdw(next) }));
      const l2 = h('section', { class: 'tasks' }); P0.byDay[next].slice(0, 3).forEach(x => l2.append(taskCard(x, true))); out.push(l2);
    }
    return out;
  }
  function speech(mood, text, cls) {
    const pul = P.mascot ? P.mascot.create(mood, { size: 84 }) : h('span');
    if (cls) pul.classList.add(cls);
    return h('div', { class: 'pul-say' }, pul, h('div', { class: 'pul-bubble', text }));
  }
  function ring(p) {
    const r = 30, c = 2 * Math.PI * r;
    return h('div', { class: 'ring', html: '<svg viewBox="0 0 72 72" width="72" height="72"><circle cx="36" cy="36" r="' + r + '" class="ring-bg"/><circle cx="36" cy="36" r="' + r + '" class="ring-fg" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - p)) + '"/></svg><b>' + Math.round(p * 100) + '%</b>' });
  }
  function warnCard() {
    const lack = P0.overflow.reduce((a, t) => a + t.min, 0), daysLeft = Math.max(1, P0.days.filter(d => baseCap(d) > 0).length);
    const per = Math.ceil(lack / daysLeft / 10) * 10;
    return h('section', { class: 'card warn' },
      h('b', { text: '이대로면 ' + hm(lack) + '이 모자라요' }),
      h('p', { text: '하루에 ' + hm(per) + '씩 더 공부하거나, 자신 있는 과목을 ‘자신 있어요’로 바꾸면 ' + md(st.end) + '까지 끝낼 수 있어요.' }),
      h('button', { class: 'btn btn-blue btn-sm', type: 'button', text: '공부 시간 바꾸기', onclick: () => { tab = 'settings'; render(); } }));
  }
  function taskCard(t, interactive) {
    const s = subj(t.s), done = !!st.done[t.id];
    const card = h('div', { class: 'task' + (done ? ' is-done' : ''), style: { '--c': s.color, '--cd': s.deep } });
    const box = h('button', { type: 'button', class: 'task-check', 'aria-pressed': String(done), 'aria-label': (done ? '완료 취소: ' : '완료: ') + s.short + ' ' + t.label, html: icon('check', 22) });
    box.addEventListener('click', e => toggleDone(t, e.currentTarget));
    card.append(
      h('span', { class: 'task-mark', text: s.mark }),
      h('div', { class: 'task-body' },
        h('div', { class: 'task-top' }, h('span', { class: 'task-round r' + t.round, text: ROUND[t.round] }), h('span', { class: 'task-min', text: hm(t.min) })),
        h('b', { class: 'task-title', text: s.short + ' · ' + t.label })),
      interactive ? box : null);
    if (interactive && !done && today() <= st.end) {
      card.append(h('button', { type: 'button', class: 'task-skip', title: '오늘은 못 해요 (내일로)', 'aria-label': '오늘은 못 해요: ' + t.label, html: icon('skip', 16), onclick: () => { st.skip[t.id] = today(); save(); sound('undo'); toast('다음 날로 다시 계산했어요'); render(); } }));
    }
    return card;
  }
  function toggleDone(t, btn) {
    if (st.done[t.id]) { delete st.done[t.id]; save(); sound('undo'); render(); return; }
    const before = todayItems();
    const wasAll = before.planned.length === 0;
    const xp = xpOf(t);
    st.done[t.id] = { at: today(), min: t.min, xp };
    delete st.skip[t.id];
    save();
    sound('ok');
    const r = btn.getBoundingClientRect();
    const fx = h('div', { class: 'xp-pop', text: '+' + xp + ' XP', style: { left: r.left + r.width / 2 + 'px', top: r.top + 'px' } });
    document.body.append(fx); setTimeout(() => fx.remove(), 1000);
    render();
    const mascot = document.querySelector('.pul-today'); if (mascot && P.mascot) P.mascot.set(mascot, 'happy');
    const after = todayItems();
    if (!wasAll && after.planned.length === 0 && after.doneToday.length) setTimeout(celebrate, 350);
  }
  function celebrate() {
    sound('win'); confetti();
    const s = streak(), { doneToday } = todayItems();
    const xp = doneToday.reduce((a, t) => a + st.done[t.id].xp, 0), min = doneToday.reduce((a, t) => a + t.min, 0);
    const dlg = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '오늘 목표 완료' },
      h('div', { class: 'modal-card' },
        P.mascot ? P.mascot.create('cheer', { size: 120 }) : null,
        h('h2', { text: '오늘 목표 완료!' }),
        h('p', { text: P.mascot ? P.mascot.line('cheer') : '' }),
        h('div', { class: 'result' },
          h('div', { class: 'res res-xp' }, h('small', { text: '얻은 XP' }), h('b', { html: icon('bolt', 18) + xp })),
          h('div', { class: 'res res-time' }, h('small', { text: '공부 시간' }), h('b', { text: hm(min) })),
          h('div', { class: 'res res-streak' }, h('small', { text: '연속' }), h('b', { html: icon('flame', 18) + s.n + '일' }))),
        h('button', { class: 'btn btn-green btn-block', type: 'button', text: '계속하기', onclick: () => dlg.remove() })));
    document.body.append(dlg);
  }

  /* ── 계획 (역산 로드맵 + 날짜별) ── */
  function viewPlan() {
    const out = [];
    const ms = [
      { d: today(), t: '오늘 · 1회독 시작', c: 'blue' },
      { d: P0.start[2], t: '2회독 시작 (1회독 마감)', c: 'orange' },
      { d: P0.start[3], t: '최종 점검 시작 (2회독 마감)', c: 'purple' },
      { d: st.end, t: '시험 준비 끝!', c: 'green' }
    ];
    const road = h('ol', { class: 'road' });
    ms.slice().reverse().forEach((m, i) => road.append(h('li', { class: 'road-' + m.c },
      h('span', { class: 'road-dot', html: i === 0 ? icon('flag', 18) : '' }),
      h('div', {}, h('b', { text: mdw(m.d) + (m.d === today() ? '' : ' · D-' + diff(m.d, st.end)) }), h('span', { text: m.t })))));
    out.push(h('section', { class: 'card' },
      h('h2', { class: 'card-title', text: '거꾸로 계산한 길' }),
      h('p', { class: 'muted', text: '남은 공부 ' + hm(P0.total) + ' · 끝나는 날까지 쓸 수 있는 시간 ' + hm(P0.capTotal) + '. 끝나는 날부터 거꾸로 시간을 쌓아서 단계마다 시작해야 하는 날을 정했어요.' }),
      road));
    if (P0.overflow.length) out.push(warnCard());
    out.push(h('h2', { class: 'sec', text: '날짜별 할 일' }));
    P0.days.forEach(d => {
      const ts = P0.tasks.filter(t => st.done[t.id] && st.done[t.id].at === d).concat(P0.byDay[d]), min = ts.reduce((a, t) => a + t.min, 0), cap = baseCap(d);
      const isToday = d === today(), isEnd = d === st.end;
      const det = h('details', { class: 'day' + (isToday ? ' is-today' : '') + (isEnd ? ' is-end' : '') + (!cap ? ' is-off' : '') });
      if (isToday) det.open = true;
      const dots = h('span', { class: 'day-dots' });
      [...new Set(ts.map(t => t.s))].forEach(id => dots.append(h('i', { style: { background: subj(id).color }, title: subj(id).short })));
      det.append(h('summary', {},
        h('span', { class: 'day-date' }, h('b', { text: mdw(d) }), h('small', { text: isToday ? '오늘' : 'D-' + diff(d, st.end) })),
        dots,
        h('span', { class: 'day-min', text: cap ? hm(min) : '쉬는 날' })));
      const body = h('div', { class: 'day-body' });
      if (!ts.length) body.append(h('p', { class: 'muted', text: cap ? '여유 있는 날 — 복습하거나 쉬어요.' : '쉬는 날로 정했어요.' }));
      ts.forEach(t => body.append(taskCard(t, isToday)));
      det.append(body);
      out.push(det);
    });
    return out;
  }

  /* ── 과목 ── */
  function viewSubjects() {
    const out = [h('h2', { class: 'sec', text: '과목별 진도' })];
    P0.subjects.forEach(x => {
      const s = x.s, lv = st.level[s.id] || 2;
      const card = h('section', { class: 'card subj', style: { '--c': s.color, '--cd': s.deep } });
      const rounds = [1, 2, 3].map(r => {
        const ts = x.tasks.filter(t => t.round === r), n = ts.filter(t => st.done[t.id]).length;
        return h('div', { class: 'subj-round' }, h('span', { text: ROUND[r] }), h('div', { class: 'bar' }, h('i', { style: { width: (ts.length ? n / ts.length * 100 : 0) + '%' } })), h('small', { text: n + '/' + ts.length }));
      });
      const levels = h('div', { class: 'seg' });
      [1, 2, 3].forEach(l => levels.append(h('button', { type: 'button', 'aria-pressed': String(lv === l), text: LEVEL[l].name, onclick: () => { st.level[s.id] = l; save(); render(); } })));
      const fin = x.r1 && x.r2 && x.r3 ? '1회독 ' + md(x.r1) + ' · 2회독 ' + md(x.r2) + ' · 최종 ' + md(x.r3) : '시간이 모자라 아직 다 배치되지 않았어요';
      card.append(
        h('div', { class: 'subj-head' }, h('span', { class: 'task-mark', text: s.mark }), h('div', {}, h('b', { text: s.name }), h('small', { text: fin })), h('b', { class: 'subj-pct', text: Math.round(x.pct * 100) + '%' })),
        ...rounds,
        h('div', { class: 'subj-row' }, h('span', { class: 'muted', text: '이 과목은' }), levels),
        rangeEditor(s));
      out.push(card);
    });
    const ex = SUBJ.filter(s => !st.include[s.id]);
    if (ex.length) out.push(h('p', { class: 'muted', text: '뺀 과목: ' + ex.map(s => s.short).join(', ') + ' (설정에서 다시 넣을 수 있어요)' }));
    return out;
  }
  function rangeEditor(s) {
    const det = h('details', { class: 'ranges' }, h('summary', { text: '시험범위 ' + (st.ranges[s.id] || []).length + '개 · 고치기' }));
    const list = h('ul', {});
    (st.ranges[s.id] || []).forEach((it, i) => list.append(h('li', {},
      h('span', {}, h('small', { text: it.src }), ' ' + it.text, h('em', { text: it.p ? ' · ' + (it.p[1] - it.p[0] + 1) + '쪽' : ' · 약 ' + hm(it.min || 60) })),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': it.text + ' 빼기', html: icon('trash', 16), onclick: () => { if (confirm('‘' + it.src + ' ' + it.text + '’를 범위에서 뺄까요?')) { st.ranges[s.id].splice(i, 1); save(); render(); } } }))));
    const f = h('form', { class: 'range-add' },
      h('input', { name: 'src', placeholder: '교재 (예: 부교재)', required: true, maxlength: 20 }),
      h('input', { name: 'a', type: 'number', placeholder: '시작쪽', min: 1 }),
      h('input', { name: 'b', type: 'number', placeholder: '끝쪽', min: 1 }),
      h('input', { name: 'm', type: 'number', placeholder: '쪽 없으면 분', min: 10, step: 10 }),
      h('button', { class: 'btn btn-blue btn-sm', type: 'submit', html: icon('plus', 16) + ' 추가' }));
    f.addEventListener('submit', e => {
      e.preventDefault();
      const a = +f.a.value, b = +f.b.value, m = +f.m.value;
      if (!(a && b && b >= a) && !m) { toast('쪽수(시작~끝) 또는 예상 시간을 적어 주세요'); return; }
      const it = { id: s.id + '-u' + Date.now().toString(36), src: f.src.value.trim(), text: a && b ? 'p.' + a + '~' + b : '직접 추가' };
      if (a && b && b >= a) it.p = [a, b]; else it.min = m;
      (st.ranges[s.id] = st.ranges[s.id] || []).push(it); save(); render();
    });
    det.append(list, f, h('button', { type: 'button', class: 'linkish', text: '심풀스터디 범위로 되돌리기', onclick: () => { st.ranges[s.id] = JSON.parse(JSON.stringify(D.ranges[s.id] || [])); save(); render(); } }));
    return det;
  }

  /* ── 설정 ── */
  function viewSettings() {
    const out = [h('h2', { class: 'sec', text: '설정' })];
    const end = h('input', { type: 'date', value: st.end, min: today() });
    end.addEventListener('change', () => { if (end.value) { st.end = end.value; save(); render(); } });
    out.push(h('section', { class: 'card form' },
      h('label', { class: 'field' }, h('span', { text: '시험 준비 끝나는 날' }), end),
      capField('평일 하루 공부 시간', 'wd'), capField('주말 하루 공부 시간', 'we')));
    // 쉬는 날
    const offIn = h('input', { type: 'date', min: today(), max: st.end });
    const offs = h('div', { class: 'chips' });
    st.off.slice().sort().forEach(d => offs.append(h('button', { type: 'button', class: 'chip', text: mdw(d) + ' ✕', onclick: () => { st.off = st.off.filter(x => x !== d); save(); render(); } })));
    out.push(h('section', { class: 'card form' },
      h('div', { class: 'field' }, h('span', { text: '쉬는 날 (학원·행사 등)' }),
        h('div', { class: 'row' }, offIn, h('button', { type: 'button', class: 'btn btn-white btn-sm', text: '추가', onclick: () => { if (offIn.value && !st.off.includes(offIn.value)) { st.off.push(offIn.value); save(); render(); } } }))),
      offs));
    const inc = h('div', { class: 'chips' });
    SUBJ.forEach(s => inc.append(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!!st.include[s.id]), style: { '--c': s.color }, text: s.short, onclick: () => { st.include[s.id] = !st.include[s.id]; save(); render(); } })));
    out.push(h('section', { class: 'card form' }, h('div', { class: 'field' }, h('span', { text: '공부할 과목' }), inc)));
    const theme = h('div', { class: 'seg' });
    [['system', '기기 따라'], ['light', '밝게'], ['dark', '어둡게']].forEach(([v, n]) => theme.append(h('button', { type: 'button', 'aria-pressed': String(st.theme === v), text: n, onclick: () => { st.theme = v; save(); render(); } })));
    const snd = h('div', { class: 'seg' });
    [[true, '켜기'], [false, '끄기']].forEach(([v, n]) => snd.append(h('button', { type: 'button', 'aria-pressed': String(st.sound === v), text: n, onclick: () => { st.sound = v; save(); render(); } })));
    out.push(h('section', { class: 'card form' },
      EMBED ? h('div', { class: 'field' }, h('span', { text: '화면' }), h('p', { class: 'muted', text: '심풀스터디 위쪽 해·달 버튼을 따라가요.' })) : h('div', { class: 'field' }, h('span', { text: '화면' }), theme),
      h('div', { class: 'field' }, h('span', { text: '효과음' }), snd)));
    const imp = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    imp.addEventListener('change', async () => {
      const f = imp.files[0]; if (!f) return;
      try { const s = JSON.parse(await f.text()); if (!s || s.v !== 1) throw 0; st = Object.assign(blank(), s); save(); toast('불러왔어요'); render(); }
      catch (e) { toast('역산 플래너 백업 파일이 아니에요'); }
    });
    out.push(h('section', { class: 'card form' },
      installRow(),
      h('div', { class: 'row wrap' },
        h('button', { type: 'button', class: 'btn btn-white btn-sm', text: '백업 저장', onclick: () => { const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(st)], { type: 'application/json' })), download: '역산플래너_백업_' + today() + '.json' }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); } }),
        h('label', { class: 'btn btn-white btn-sm' }, '백업 불러오기', imp),
        h('button', { type: 'button', class: 'btn btn-red btn-sm', text: '처음부터 다시', onclick: () => { if (confirm('완료 기록과 설정을 모두 지우고 처음부터 시작할까요?')) { st = blank(); save(); tab = 'today'; render(); } } }))));
    return out;
  }
  function capField(label, key) {
    const out = h('output', { text: hm(st.cap[key]) });
    const r = h('input', { type: 'range', min: 30, max: 720, step: 30, value: st.cap[key], 'aria-label': label });
    r.addEventListener('input', () => { out.textContent = hm(+r.value); });
    r.addEventListener('change', () => { st.cap[key] = +r.value; save(); render(); });
    return h('label', { class: 'field' }, h('span', {}, label, ' ', out), r);
  }

  /* ── 옆 패널(넓은 화면) ── */
  function sidePanel() {
    const out = [];
    const t = today(), next = P0.days.find(d => d > t && P0.byDay[d].length);
    out.push(h('section', { class: 'card side-card' },
      h('b', { text: '다음 마감' }),
      h('p', { text: diff(t, P0.start[2]) > 0 ? '1회독 마감까지 ' + diff(t, P0.start[2]) + '일 (' + md(P0.start[2]) + ')' : diff(t, P0.start[3]) > 0 ? '2회독 마감까지 ' + diff(t, P0.start[3]) + '일 (' + md(P0.start[3]) + ')' : '최종 점검 중! ' + md(st.end) + '까지' })));
    if (next) {
      const c = h('section', { class: 'card side-card' }, h('b', { text: '내일 미리 보기 · ' + md(next) }));
      P0.byDay[next].slice(0, 4).forEach(x => c.append(h('p', { class: 'side-task' }, h('i', { style: { background: subj(x.s).color } }), subj(x.s).short + ' · ' + x.label)));
      out.push(c);
    }
    return out;
  }

  /* ── 앱 설치 ── */
  let deferred = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; if (st.setup && tab === 'settings') render(); });
  function installRow() {
    if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) return h('p', { class: 'muted', text: '앱으로 설치되어 있어요.' });
    if (deferred) return h('button', { type: 'button', class: 'btn btn-green btn-block', text: '앱으로 설치하기', onclick: async () => { deferred.prompt(); await deferred.userChoice; deferred = null; render(); } });
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
    return h('p', { class: 'muted', text: ios ? '사파리 아래쪽 공유 버튼 → ‘홈 화면에 추가’를 누르면 앱처럼 설치돼요.' : '크롬·엣지 주소창 오른쪽의 설치 아이콘을 누르면 앱으로 설치돼요.' });
  }

  /* ══ 처음 시작 (온보딩) ══ */
  let ob = 0;
  function renderOnboarding() {
    app.innerHTML = '';
    app.classList.remove('has-nav');
    const steps = [obWelcome, obEnd, obTime, obLevel, obResult];
    const wrap = h('div', { class: 'ob' },
      h('div', { class: 'ob-top' },
        ob ? h('button', { type: 'button', class: 'icon-btn ob-back', 'aria-label': '이전', html: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>', onclick: () => { ob--; render(); } }) : h('span'),
        h('div', { class: 'bar ob-bar' }, h('i', { style: { width: (ob / (steps.length - 1) * 100) + '%' } }))));
    const { body, next, label } = steps[ob]();
    wrap.append(h('div', { class: 'ob-body' }, body),
      h('div', { class: 'ob-foot' }, h('button', { type: 'button', class: 'btn btn-green btn-block', text: label || '계속', onclick: () => { if (next && next() === false) return; sound('tap'); if (ob < steps.length - 1) { ob++; render(); } } })));
    app.append(wrap);
  }
  function obWelcome() {
    return { label: '시작하기', body: h('div', { class: 'ob-center' }, P.mascot ? P.mascot.create('cheer', { size: 150 }) : null,
      h('h1', { text: '역산 스터디 플래너' }),
      h('p', { text: '시험 준비를 끝낼 날에서 거꾸로 계산해서, 오늘 무엇을 얼마나 해야 하는지 정해 줄게요. 시험범위는 심풀스터디 ' + D.title + ' 범위 그대로예요.' })) };
  }
  function obEnd() {
    const inp = h('input', { type: 'date', class: 'big-input', value: st.end, min: today() });
    inp.addEventListener('change', () => { if (inp.value) st.end = inp.value; });
    return {
      next: () => { if (!inp.value || inp.value < today()) { toast('오늘 이후 날짜를 골라 주세요'); return false; } st.end = inp.value; save(); },
      body: h('div', {}, speech('idle', '시험 준비를 언제까지 끝낼까요?'), h('div', { class: 'ob-field' }, inp, h('p', { class: 'muted', text: '이 날까지 1회독 → 2회독 → 최종 점검을 모두 끝내도록 거꾸로 계산해요.' })))
    };
  }
  function obTime() {
    const opts = [[60, '1시간', '가볍게'], [120, '2시간', '보통'], [180, '3시간', '열심히'], [240, '4시간', '시험 모드'], [360, '6시간', '전력 질주']];
    const grid = (key, title) => {
      const g = h('div', { class: 'opt-grid' });
      opts.forEach(([v, n, sub]) => g.append(h('button', { type: 'button', class: 'opt', 'aria-pressed': String(st.cap[key] === v), onclick: () => { st.cap[key] = v; save(); sound('tap'); render(); } }, h('b', { text: n }), h('small', { text: sub }))));
      return h('div', { class: 'ob-field' }, h('h3', { text: title }), g);
    };
    return { body: h('div', {}, speech('think', '하루에 공부할 수 있는 시간은요?'), grid('wd', '평일 (월~금)'), grid('we', '주말 (토·일)')) };
  }
  function obLevel() {
    const list = h('div', { class: 'ob-field level-list' });
    SUBJ.forEach(s => {
      const lv = st.level[s.id] || 2, on = !!st.include[s.id];
      const seg = h('div', { class: 'seg' });
      [1, 2, 3].forEach(l => seg.append(h('button', { type: 'button', 'aria-pressed': String(on && lv === l), disabled: !on, text: LEVEL[l].name, onclick: () => { st.level[s.id] = l; save(); render(); } })));
      list.append(h('div', { class: 'level-row' + (on ? '' : ' is-off'), style: { '--c': s.color, '--cd': s.deep } },
        h('button', { type: 'button', class: 'task-mark', 'aria-pressed': String(on), title: on ? '빼기' : '넣기', 'aria-label': s.name + (on ? ' 빼기' : ' 넣기'), text: s.mark, onclick: () => { st.include[s.id] = !on; save(); render(); } }),
        h('b', { text: s.short }), seg));
    });
    return {
      next: () => { if (!SUBJ.some(s => st.include[s.id])) { toast('과목을 하나 이상 골라 주세요'); return false; } },
      body: h('div', {}, speech('idle', '과목마다 자신감은 어때요? 약한 과목에 시간을 더 줄게요. (동그라미를 누르면 과목을 빼요)'), list)
    };
  }
  function obResult() {
    const p = plan();
    const body = h('div', {}, speech(p.overflow.length ? 'think' : 'cheer', p.overflow.length ? '조금 빠듯해요. 그래도 시작해 봐요! 공부 시간은 나중에 바꿀 수 있어요.' : '계산 끝! 이렇게 하면 ' + md(st.end) + '까지 다 끝나요.'),
      h('ol', { class: 'road' },
        ...[[st.end, '시험 준비 끝!', 'green'], [p.start[3], '최종 점검 시작', 'purple'], [p.start[2], '2회독 시작 (1회독 마감)', 'orange'], [today(), '오늘 1회독 시작', 'blue']].map(([d, t, c], i) =>
          h('li', { class: 'road-' + c }, h('span', { class: 'road-dot', html: i === 0 ? icon('flag', 18) : '' }), h('div', {}, h('b', { text: mdw(d) }), h('span', { text: t }))))),
      h('p', { class: 'muted center', text: '전체 ' + hm(p.total) + ' · 오늘 할 일 ' + (p.byDay[today()] || []).length + '개' }));
    return { label: '플랜 시작!', next: () => { st.setup = true; save(); sound('win'); confetti(); tab = 'today'; setTimeout(render, 0); }, body };
  }

  /* ── 알림 ── */
  let toastEl = null, toastT = 0;
  function toast(t) {
    if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status' }); document.body.append(toastEl); }
    toastEl.textContent = t; toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 1800);
  }

  // 자정이 지나면 다시 계산
  let lastDay = today();
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); render(); } }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && today() !== lastDay) { lastDay = today(); render(); } });

  if (!EMBED && 'serviceWorker' in navigator && location.protocol !== 'file:') addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  window.__planner = { plan, get state() { return st; } };
  render();
})();
