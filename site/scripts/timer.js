/* 공부 타이머 화면 (열품타 디자인·흐름을 따름)
   주황 헤더(오늘 순공 시간) → 과목마다 색 동그라미 재생 버튼 → 누르면 어두운 ‘공부 중’ 화면이 바로 열림
   (큰 시계 = 그 과목 오늘 시간, 오늘 / 현재 집중) → 일시정지하면 기록하고 목록으로.
   탭: 타이머 / To-do / 통계(과목별 기록, 최근 7일, 설정). 딴짓 방지: 다른 탭·앱으로 가면 멈춤. */
(function () {
  'use strict';
  const S = window.Simpul, T = S.study, el = S.el;
  const $ = id => document.getElementById(id);

  /* 과목 색: 국어·영어·수학·과학·사회는 열품타 앱 화면에서 뽑은 색, 나머지는 같은 톤으로 고른 색 */
  /* 과목 색: 일반 모드는 사이트 과목 색(홈·과목 탭과 같게), 듀오링고 모드는 듀오링고 색 */
  const DUO_COLOR = { korean: '#FF9600', english: '#FFC800', math: '#1CB0F6', science: '#58CC02', social: '#CE82FF',
    history: '#FF4B4B', japanese: '#FF86D0', info: '#2B70C9', etc: '#AFAFAF' };
  const duoOn = document.documentElement.hasAttribute('data-duo');
  const SUBJECTS = S.SUBJECTS.map(s => ({ id: s.id, name: s.name, color: duoOn ? DUO_COLOR[s.id] || s.color : s.color }))
    .concat([{ id: 'etc', name: '기타', color: duoOn ? DUO_COLOR.etc : '#71717a' }]);
  const subjectOf = id => SUBJECTS.find(s => s.id === id) || { id, name: id, color: '#9E9E9E' };

  const pad = n => String(n).padStart(2, '0');
  const clock2 = sec => { sec = Math.max(0, Math.floor(sec)); return pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor(sec % 3600 / 60)) + ':' + pad(sec % 60); };
  let range = 'day';

  function notice(text) {
    const n = $('tm-notice');
    n.textContent = text;
    n.hidden = false;
    clearTimeout(notice.t);
    notice.t = setTimeout(() => { n.hidden = true; }, 8000);
  }
  const forgot = T.checkForgotten();
  if (forgot) notice('타이머가 12시간 넘게 켜져 있어서 12시간까지만 기록하고 멈췄어요.');

  /* ── 탭 ── */
  const tabs = ['timer', 'todo', 'stats', 'rank'];
  function showTab(name, focus) {
    tabs.forEach(t => {
      const on = t === name;
      $('tab-' + t).setAttribute('aria-selected', on ? 'true' : 'false');
      $('tab-' + t).tabIndex = on ? 0 : -1;
      $('panel-' + t).hidden = !on;
    });
    if (focus) $('tab-' + name).focus();
    if (name === 'stats') { renderSplit(); renderWeek(); }
    if (name === 'rank' && S.timerRank) S.timerRank.show();
  }
  tabs.forEach((t, i) => {
    $('tab-' + t).addEventListener('click', () => showTab(t));
    $('tab-' + t).addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        showTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
      }
    });
  });
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
    showTab('stats');
    if (b.dataset.go === 'settings') $('tm-settings').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  /* ── 과목 목록 (색 동그라미 재생 버튼 · 이름 · 시간) ── */
  const rows = {};
  SUBJECTS.forEach(s => {
    const time = el('span', { class: 'tm-sub-time', text: '00:00:00' });
    const play = el('button', { class: 'tm-play', type: 'button', style: '--c:' + s.color, 'aria-label': s.name + ' 공부 시작' });
    play.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
    play.addEventListener('click', () => begin(s.id));
    const li = el('li', { class: 'tm-sub' }, [play, el('span', { class: 'tm-sub-name', text: s.name }), time]);
    rows[s.id] = { li, time, play };
    $('tm-subjects').append(li);
  });

  /* ── 공부 중 화면 ── */
  const run = $('tm-run');
  let opener = null;
  const MINI_KEY = 'simpul.timer.mini'; // 공부 중 화면을 접어 둔 상태 (이 탭에서만)
  const setMini = on => { try { on ? sessionStorage.setItem(MINI_KEY, '1') : sessionStorage.removeItem(MINI_KEY); } catch (e) { /* 저장 불가 */ } };
  const isMini = () => { try { return sessionStorage.getItem(MINI_KEY) === '1'; } catch (e) { return false; } };
  function begin(id) {
    opener = rows[id] ? rows[id].play : null;
    T.start(id);
    setMini(false);
    openRun();
  }
  function closeRun() {
    run.hidden = true;
    document.documentElement.classList.remove('tm-run-open');
  }
  /* 접기: 타이머는 계속 돌고, 목록·다른 기능을 쓸 수 있다 */
  function fold() {
    setMini(true);
    closeRun();
    notice('타이머는 계속 돌아가요. 심풀스터디의 다른 기능을 써도 기록돼요.');
    (opener || $('tab-timer')).focus();
  }
  function openRun() {
    run.hidden = false;
    document.documentElement.classList.add('tm-run-open');
    tick();
    $('tm-run-pause').focus();
  }
  function pause() {
    const r = T.stop();
    setMini(false);
    closeRun();
    if (r) notice(subjectOf(r.s).name + ' ' + T.words(Math.round(r.ms / 1000)) + ' 기록했어요.');
    render();
    (opener || $('tab-timer')).focus();
  }
  $('tm-run-pause').addEventListener('click', pause);
  $('tm-run-fold').addEventListener('click', fold);
  /* 공부하러 가기 링크: 타이머를 켠 채로 이동 */
  run.querySelectorAll('.tm-run-go a').forEach(a => a.addEventListener('click', () => setMini(true)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !run.hidden) fold(); });
  /* 위쪽 ‘공부 중’ 줄을 누르면 다시 큰 화면으로 */
  $('tm-live').addEventListener('click', () => { setMini(false); openRun(); });

  /* ── 매초 ── */
  function tick() {
    const st = T.get(), per = T.secondsOn(T.today());
    const total = Object.values(per).reduce((a, b) => a + b, 0);
    $('tm-total').textContent = clock2(total);
    const goal = st.goal * 60, pct = Math.min(100, Math.round(total / goal * 100));
    $('tm-goal-fill').style.width = pct + '%';
    $('tm-goal-bar').setAttribute('aria-valuenow', String(pct));
    $('tm-goal-text').textContent = total >= goal ? '목표 ' + T.words(goal) + ' 달성!' : '목표 ' + T.words(goal) + ' · ' + pct + '%';
    SUBJECTS.forEach(s => { rows[s.id].time.textContent = clock2(per[s.id] || 0); rows[s.id].li.classList.toggle('is-on', !!(st.run && st.run.s === s.id)); });
    const sub = st.run ? subjectOf(st.run.s) : null;
    $('tm-live').hidden = !sub || !run.hidden;
    if (sub) { $('tm-live-dot').style.background = sub.color; $('tm-live-text').textContent = sub.name + ' 공부 중 · ' + clock2(T.runSeconds()); }
    if (sub) {
      $('tm-run-name').textContent = sub.name;
      $('tm-run-dot').style.background = sub.color;
      $('tm-run-clock').textContent = clock2(per[sub.id] || 0);
      $('tm-run-today').textContent = clock2(total);
      $('tm-run-focus').textContent = clock2(T.runSeconds());
      $('tm-run-pause').setAttribute('aria-label', sub.name + ' 일시정지');
      document.title = clock2(per[sub.id] || 0) + ' ' + sub.name + ' · 공부 타이머';
    } else {
      if (!run.hidden) closeRun();
      document.title = '공부 타이머 · 심풀스터디';
    }
  }

  /* ── D-day (주황 헤더 왼쪽 위) ── */
  function renderDday() {
    const d = T.get().dday, box = $('tm-dday');
    if (!d.date) { box.textContent = 'D-day 설정'; box.classList.add('is-empty'); return; }
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const [y, m, dd] = d.date.split('-').map(Number);
    const diff = Math.round((new Date(y, m - 1, dd) - t0) / 86400000);
    box.textContent = (diff > 0 ? 'D-' + diff : diff === 0 ? 'D-DAY' : 'D+' + (-diff)) + (d.name ? ' · ' + d.name : '');
    box.classList.remove('is-empty');
  }
  $('tm-dday').addEventListener('click', () => { if (!T.get().dday.date) { showTab('stats'); $('tm-settings').scrollIntoView({ behavior: 'smooth' }); $('tm-dday-date').focus(); } });

  /* ── To-do ── */
  function todos() { const st = T.get(); return (st.todos[T.today()] = st.todos[T.today()] || []); }
  function renderTodos() {
    const list = $('tm-todos');
    list.replaceChildren();
    const items = todos();
    if (!items.length) { list.append(el('li', { class: 'tm-empty', text: '오늘 할 일이 아직 없어요.' })); return; }
    items.forEach((t, i) => {
      const cb = el('input', { type: 'checkbox', id: 'tm-todo-' + i });
      cb.checked = !!t.done;
      cb.addEventListener('change', () => { t.done = cb.checked; T.save(); });
      const del = el('button', { class: 'tm-todo-del', type: 'button', 'aria-label': '“' + t.text + '” 지우기', text: '×' });
      del.addEventListener('click', () => { items.splice(i, 1); T.save(); });
      list.append(el('li', { class: 'tm-todo' + (t.done ? ' is-done' : '') }, [cb, el('label', { for: 'tm-todo-' + i, text: t.text }), del]));
    });
  }
  $('tm-todo-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('tm-todo-input'), text = input.value.trim();
    if (!text) return;
    todos().push({ text, done: false });
    input.value = '';
    T.save();
    input.focus();
  });

  /* ── 통계: 과목별 기록 (한 가지 색 막대 + 이름·시간 글자) ── */
  function renderSplit() {
    const days = range === 'day' ? [T.today()] : T.lastDays(7);
    const sum = {};
    days.forEach(d => Object.entries(T.secondsOn(d)).forEach(([k, v]) => { sum[k] = (sum[k] || 0) + v; }));
    const list = $('tm-split'), data = Object.entries(sum).filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]);
    list.replaceChildren();
    if (!data.length) { list.append(el('li', { class: 'tm-empty', text: range === 'day' ? '오늘 기록이 아직 없어요.' : '최근 7일 기록이 없어요.' })); return; }
    const max = data[0][1], total = data.reduce((a, [, v]) => a + v, 0);
    data.forEach(([id, v]) => {
      const s = subjectOf(id);
      list.append(el('li', {}, [
        el('span', { class: 'tm-split-name' }, [el('span', { class: 'tm-dot', style: 'background:' + s.color, 'aria-hidden': 'true' }), document.createTextNode(s.name)]),
        el('span', { class: 'tm-split-bar', 'aria-hidden': 'true' }, [el('span', { style: 'width:' + Math.max(2, v / max * 100) + '%' })]),
        el('span', { class: 'tm-split-val', text: T.words(v) + ' · ' + Math.round(v / total * 100) + '%' })
      ]));
    });
  }
  document.querySelectorAll('.tm-seg button').forEach(b => b.addEventListener('click', () => {
    range = b.dataset.range;
    document.querySelectorAll('.tm-seg button').forEach(x => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
    renderSplit();
  }));

  /* ── 통계: 최근 7일 막대 (한 가지 색, 막대마다 날짜·시간 툴팁) ── */
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  function renderWeek() {
    const days = T.lastDays(7), vals = days.map(T.totalOn), goal = T.get().goal * 60;
    const max = Math.max(goal, ...vals, 3600), box = $('tm-week');
    box.replaceChildren();
    box.style.setProperty('--goal-n', String(goal / max));
    box.append(el('span', { class: 'tm-week-goal', 'aria-hidden': 'true' }, [el('span', { text: '목표 ' + T.words(goal) })]));
    days.forEach((d, i) => {
      const [y, m, dd] = d.split('-').map(Number), date = new Date(y, m - 1, dd), isToday = d === T.today();
      const label = m + '월 ' + dd + '일 ' + WD[date.getDay()] + '요일' + (isToday ? '(오늘)' : '') + ' · ' + (vals[i] ? T.words(vals[i]) : '기록 없음');
      box.append(el('button', { class: 'tm-week-col' + (isToday ? ' is-today' : ''), type: 'button', 'aria-label': label, 'data-tip': label }, [
        el('span', { class: 'tm-week-track' }, [el('span', { class: 'tm-week-bar', style: 'height:' + (vals[i] ? Math.max(2, vals[i] / max * 100) : 0) + '%' })]),
        isToday && vals[i] ? el('span', { class: 'tm-week-val', text: T.words(vals[i]) }) : null,
        el('span', { class: 'tm-week-day', text: isToday ? '오늘' : WD[date.getDay()] })
      ]));
    });
    const sum = vals.reduce((a, b) => a + b, 0);
    $('tm-week-sum').textContent = '합계 ' + T.words(sum) + ' · 하루 평균 ' + T.words(sum / 7);
  }
  const tip = $('tm-tip');
  function showTip(e) {
    const col = e.target.closest('.tm-week-col');
    if (!col) return;
    const box = $('tm-week').getBoundingClientRect(), r = col.getBoundingClientRect();
    tip.textContent = col.dataset.tip;
    tip.hidden = false;
    tip.style.left = Math.min(Math.max(r.left + r.width / 2 - box.left, 80), box.width - 80) + 'px';
  }
  $('tm-week').addEventListener('pointerover', showTip);
  $('tm-week').addEventListener('focusin', showTip);
  $('tm-week').addEventListener('pointerleave', () => { tip.hidden = true; });
  $('tm-week').addEventListener('focusout', () => { tip.hidden = true; });

  /* ── 설정 ── */
  const goalSel = $('tm-goal-select'), ddName = $('tm-dday-name'), ddDate = $('tm-dday-date'), guard = $('tm-guard');
  function renderSettings() {
    const st = T.get();
    if (![...goalSel.options].some(o => Number(o.value) === st.goal)) goalSel.append(el('option', { value: String(st.goal), text: T.words(st.goal * 60) }));
    goalSel.value = String(st.goal);
    if (document.activeElement !== ddName) ddName.value = st.dday.name || '';
    if (document.activeElement !== ddDate) ddDate.value = st.dday.date || '';
    guard.checked = !!st.guard;
  }
  goalSel.addEventListener('change', () => { T.get().goal = Number(goalSel.value) || 180; T.save(); });
  ddName.addEventListener('change', () => { T.get().dday.name = ddName.value.trim(); T.save(); });
  ddDate.addEventListener('change', () => { T.get().dday.date = ddDate.value; T.save(); });
  guard.addEventListener('change', () => { T.get().guard = guard.checked; T.save(); });
  $('tm-reset').addEventListener('click', () => {
    if (!confirm('공부 기록과 할 일을 모두 지울까요? 되돌릴 수 없어요. (목표·D-day 설정은 남아요)')) return;
    T.reset();
  });

  /* ── 딴짓 방지: 판단은 studytime.js(모든 페이지 공통)가 하고, 여기서는 알림만 ── */
  T.onGuardStop(r => {
    closeRun();
    notice('심풀스터디 밖으로 나가서 타이머를 멈췄어요. (' + subjectOf(r.s).name + ' ' + T.words(Math.round(r.ms / 1000)) + ' 기록) 다시 하려면 재생을 누르세요.');
    render();
  });

  function render() { tick(); renderDday(); renderTodos(); renderSettings(); if (!$('panel-stats').hidden) { renderSplit(); renderWeek(); } }
  T.onChange(render);
  render();
  /* 처음 열 때: 공부 중이면 큰 화면 (접어 둔 상태였으면 목록 그대로, ?run=1이면 큰 화면) */
  if (T.get().run && (!isMini() || new URLSearchParams(location.search).get('run') === '1')) { setMini(false); openRun(); }
  setInterval(tick, 1000);
  setInterval(() => { if (!$('panel-stats').hidden && T.get().run) { renderSplit(); renderWeek(); } }, 5000);
})();
