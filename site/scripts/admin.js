/* 관리자 페이지: /api/admin/* (Cloudflare). 로그인 토큰은 이 탭(sessionStorage)에만 둔다. */
(function () {
  'use strict';
  const S = window.Simpul;
  const el = S.el;
  const $ = id => document.getElementById(id);
  const TOKEN_KEY = 'simpul.admin.token';
  let token = '';
  try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { /* 저장 불가 */ }
  let draft = null;
  let statsTimer = null;

  async function api(path, opts) {
    opts = opts || {};
    const headers = { Authorization: 'Bearer ' + token };
    let body = opts.body;
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    const r = await fetch('./api/' + path, { method: body ? 'POST' : 'GET', headers, body, cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== 'admin/login') { logout('로그인이 만료됐어요. 다시 로그인해 주세요.'); throw new Error('로그인이 필요해요.'); }
    if (!r.ok) throw new Error(data.error || (r.status === 404 ? '관리자 API가 없어요. Cloudflare에 배포된 사이트에서 열어 주세요.' : '요청을 처리하지 못했어요.'));
    return data;
  }
  const subjectName = id => (S.findSubject(id) || { name: id }).name;
  const when = t => (t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

  /* ── 로그인 ── */
  function setToken(t) { token = t; try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* 무시 */ } }
  function logout(message) {
    setToken('');
    clearInterval(statsTimer);
    $('admin-app').hidden = true;
    $('admin-nav').hidden = true;
    $('login-form').hidden = false;
    $('login-status').textContent = message || '';
  }
  $('logout').addEventListener('click', () => logout('로그아웃했어요.'));
  /* 비밀번호 보기·숨기기 (오타 확인용) + Caps Lock 알림 */
  function setShown(show) {
    $('login-password').type = show ? 'text' : 'password';
    $('login-show').textContent = show ? '숨기기' : '보기';
    $('login-show').setAttribute('aria-pressed', show ? 'true' : 'false');
  }
  $('login-show').addEventListener('click', () => { setShown($('login-password').type === 'password'); $('login-password').focus(); });
  const caps = e => { if (e.getModifierState) $('login-caps').hidden = !e.getModifierState('CapsLock'); };
  $('login-password').addEventListener('keydown', caps);
  $('login-password').addEventListener('keyup', caps);
  $('login-password').addEventListener('blur', () => { $('login-caps').hidden = true; });

  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('login-status').textContent = '확인 중…';
    try {
      const r = await api('admin/login', { body: { password: $('login-password').value } });
      setToken(r.token);
      $('login-password').value = '';
      setShown(false);
      start();
    } catch (err) { $('login-status').textContent = err.message; }
  });

  function start() {
    $('login-form').hidden = true;
    $('admin-app').hidden = false;
    $('admin-nav').hidden = false;
    api('admin/me', { body: { uid: S.uid() } }).then(loadStats, loadStats); // 이 기기는 사용자 수에서 뺀다
    loadConcepts();
    loadConfig();
    loadGroups();
    clearInterval(statsTimer);
    statsTimer = setInterval(() => { if (!document.hidden) loadStats(); }, 30000);
  }

  /* ── 현황 ── */
  async function loadStats() {
    try {
      const s = await api('admin/stats');
      $('st-online').textContent = s.online;
      $('st-today').textContent = s.today;
      $('st-people').textContent = s.people_today;
      $('st-total').textContent = s.total;
      $('st-new').textContent = s.new_today;
      $('st-back').textContent = s.returning_today;
      $('st-entries').textContent = s.entries_today;
      $('st-entries-avg').textContent = s.today ? '1명당 ' + (s.entries_today / s.today).toFixed(1) + '번' : '';
      $('st-admin').textContent = s.admin_devices + '대';
      renderDupes(s.dupes || [], s.today, s.people_today);
      $('st-req').textContent = s.generations.requests || 0;
      $('st-q').textContent = s.generations.questions || 0;
      $('st-fail').textContent = s.generations.failures || 0;
      $('st-units').textContent = s.concepts.reduce((a, c) => a + c.units, 0);
      $('stats-updated').textContent = when(s.now) + ' 기준 · 30초마다 새로고침';
      renderChart(s.days);
      if (s.modes) renderModes(s.modes);
    } catch (e) { $('stats-updated').textContent = e.message; }
  }
  /* 같은 인터넷 연결에서 들어온 기기 묶음 (한 사람이 여러 기기·시크릿 창으로 들어왔을 수 있음) */
  function renderDupes(list, devices, people) {
    $('st-dupes-sum').textContent = devices === people
      ? '오늘은 같은 연결·같은 기기 종류로 겹친 기기가 없어요.'
      : '오늘 기기 ' + devices + '대 중 같은 연결·같은 기기 종류로 겹친 ' + (devices - people) + '대를 한 사람으로 보면 약 ' + people + '명이에요.';
    if (!list.length) { $('st-dupes').replaceChildren(el('li', { class: 'empty', text: '같은 인터넷 연결에서 2대 이상 들어온 묶음이 없어요.' })); return; }
    $('st-dupes').replaceChildren(...list.map(g => el('li', {}, [el('div', { class: 'item-row' }, [
      el('span', { class: 'item-title', text: '연결 #' + g.net.slice(0, 4).toUpperCase() + ' · 기기 ' + g.devices + '대' }),
      el('span', { class: 'item-meta', text: g.kinds.map(k => k.dev + (k.n > 1 ? ' ×' + k.n + ' (같은 사람일 가능성 높음)' : '')).join(' · ') }),
      el('span', { class: 'item-action', text: '들어온 횟수 ' + g.entries + '번' })
    ])])));
  }
  $('st-unmark').addEventListener('click', async () => {
    if (!confirm('관리자 기기 표시를 모두 지울까요? 이 기기는 다시 로그인하면 또 빠져요.')) return;
    try { await api('admin/unmark', { body: {} }); await api('admin/me', { body: { uid: S.uid() } }); loadStats(); } catch (e) { alert(e.message); }
  });

  /* 일반 모드 vs 듀오링고 모드 */
  function renderModes(m) {
    const fmtMin = n => n >= 60 ? Math.floor(n / 60) + '시간 ' + (n % 60 ? (n % 60) + '분' : '') : n + '분';
    const t = m.today, totalMin = t.normal.minutes + t.duo.minutes;
    const duoPct = totalMin ? Math.round(t.duo.minutes / totalMin * 100) : 0;
    const card = (k, name) => el('div', { class: 'mode-card mode-' + k }, [
      el('strong', { class: 'mode-name', text: name }),
      el('dl', {}, [
        el('dt', { text: '지금 접속 중' }), el('dd', { text: m.online[k] + '대' }),
        el('dt', { text: '오늘 쓴 기기' }), el('dd', { text: t[k].devices + '대' }),
        el('dt', { text: '오늘 들어온 횟수' }), el('dd', { text: t[k].entries + '번' }),
        el('dt', { text: '오늘 사용 시간(약)' }), el('dd', { text: fmtMin(t[k].minutes) }),
        el('dt', { text: '최근 14일 기기 · 시간' }), el('dd', { text: m.last14[k].devices + '대 · ' + fmtMin(m.last14[k].minutes) })
      ])
    ]);
    $('st-modes').replaceChildren(
      card('normal', '일반 모드'), card('duo', '듀오링고 모드'),
      el('div', { class: 'mode-share', title: '오늘 사용 시간 비율' }, [
        el('span', { class: 'mode-share-bar', role: 'img', 'aria-label': '오늘 사용 시간 중 듀오링고 모드 ' + duoPct + '%' }, [el('span', { style: 'width:' + (totalMin ? 100 - duoPct : 50) + '%' })]),
        el('small', { text: totalMin ? '오늘 사용 시간 · 일반 ' + (100 - duoPct) + '% / 듀오링고 ' + duoPct + '%' : '오늘은 아직 사용 기록이 없어요' })
      ]));
    const max = Math.max(1, ...m.days.map(d => Math.max(d.normal.minutes, d.duo.minutes)));
    $('st-mode-chart').replaceChildren(...m.days.map(d => el('div', { class: 'chart-col', title: `${d.day} 일반 ${d.normal.devices}대·${fmtMin(d.normal.minutes)} · 듀오링고 ${d.duo.devices}대·${fmtMin(d.duo.minutes)}` }, [
      el('div', { class: 'chart-bars' }, [
        el('span', { class: 'bar-normal', style: 'height:' + (d.normal.minutes / max * 100) + '%' }),
        el('span', { class: 'bar-duo', style: 'height:' + (d.duo.minutes / max * 100) + '%' })
      ]),
      el('span', { class: 'chart-label', text: d.day.slice(8) })
    ])));
    $('st-mode-chart').append(el('p', { class: 'chart-legend' }, [el('span', { class: 'lg-normal', text: '일반 모드 사용 시간' }), el('span', { class: 'lg-duo', text: '듀오링고 모드 사용 시간' })]));
  }

  function renderChart(days) {
    const max = Math.max(1, ...days.map(d => Math.max(d.users, d.requests)));
    $('st-chart').replaceChildren(...days.map(d => el('div', { class: 'chart-col', title: `${d.day} 방문 기기 ${d.users}대 · 들어온 횟수 ${d.entries || d.users}번 · 문제 만들기 ${d.requests}번` }, [
      el('div', { class: 'chart-bars' }, [
        el('span', { class: 'bar-users', style: 'height:' + (d.users / max * 100) + '%' }),
        el('span', { class: 'bar-gens', style: 'height:' + (d.requests / max * 100) + '%' })
      ]),
      el('span', { class: 'chart-label', text: d.day.slice(8) })
    ])));
    $('st-chart').append(el('p', { class: 'chart-legend' }, [el('span', { class: 'lg-users', text: '방문자' }), el('span', { class: 'lg-gens', text: '문제 만들기' })]));
  }

  /* ── 범위 개념 ── */
  (S.ALL_SUBJECTS || S.SUBJECTS).forEach(s => $('ex-subject').append(el('option', { value: s.id, text: s.name })));
  $('extract-form').addEventListener('submit', async e => {
    e.preventDefault();
    const files = [...$('ex-files').files];
    if (!files.length) { $('ex-status').textContent = '자료 파일을 골라 주세요.'; return; }
    const btn = $('ex-btn');
    btn.disabled = true;
    $('ex-status').textContent = 'AI가 자료를 읽고 개념을 정리하고 있어요. 30초~2분 걸려요.';
    try {
      const form = new FormData();
      form.set('subject', $('ex-subject').value);
      form.set('unit', $('ex-unit').value);
      form.set('scope', $('ex-scope').value);
      files.forEach(f => form.append('files', f, f.name));
      draft = await api('admin/concepts/extract', { body: form });
      renderDraft();
      $('ex-status').textContent = draft.units.length + '개 단원으로 정리했어요. 확인 후 저장하세요.';
    } catch (err) { $('ex-status').textContent = err.message; } finally { btn.disabled = false; }
  });

  function renderDraft() {
    $('draft').hidden = !draft;
    if (!draft) return;
    $('draft-list').replaceChildren(...draft.units.map((u, i) => {
      const id = 'd' + i;
      return el('article', { class: 'question-card draft-card', 'data-i': String(i) }, [
        el('label', { class: 'check' }, [el('input', { type: 'checkbox', class: 'd-use', checked: '' }), document.createTextNode(subjectName(draft.subject) + ' 단원 저장')]),
        el('label', { for: id + 'u', text: '단원 이름' }), withValue(el('input', { class: 'input d-unit', id: id + 'u', maxlength: '120' }), u.unit),
        el('label', { for: id + 's', text: '요약' }), withValue(el('textarea', { class: 'd-summary', id: id + 's', rows: '3' }), u.summary),
        el('label', { for: id + 'p', text: '핵심 개념 (한 줄에 하나)' }), withValue(el('textarea', { class: 'd-points', id: id + 'p', rows: '7' }), u.points.join('\n')),
        el('label', { for: id + 't', text: '용어 (한 줄에 “용어: 뜻”)' }), withValue(el('textarea', { class: 'd-terms', id: id + 't', rows: '4' }), u.terms.map(t => t.term + ': ' + t.meaning).join('\n'))
      ]);
    }));
  }
  function withValue(node, value) { node.value = value || ''; return node; }

  $('draft-cancel').addEventListener('click', () => { draft = null; renderDraft(); $('ex-status').textContent = '정리 결과를 버렸어요.'; });
  $('draft-save').addEventListener('click', async () => {
    const units = [...document.querySelectorAll('.draft-card')].filter(c => c.querySelector('.d-use').checked).map(c => ({
      unit: c.querySelector('.d-unit').value.trim(),
      summary: c.querySelector('.d-summary').value.trim(),
      points: c.querySelector('.d-points').value.split('\n').map(x => x.trim()).filter(Boolean),
      terms: c.querySelector('.d-terms').value.split('\n').map(x => x.trim()).filter(Boolean).map(line => {
        const at = line.indexOf(':');
        return at > 0 ? { term: line.slice(0, at).trim(), meaning: line.slice(at + 1).trim() } : { term: line, meaning: '' };
      })
    })).filter(u => u.unit);
    if (!units.length) { $('ex-status').textContent = '저장할 단원을 하나 이상 선택해 주세요.'; return; }
    try {
      await api('admin/concepts/save', { body: { subject: draft.subject, units, source: draft.source } });
      $('ex-status').textContent = units.length + '개 단원을 저장했어요. 같은 이름의 단원은 새 내용으로 바뀌었어요.';
      draft = null;
      renderDraft();
      $('ex-files').value = '';
      loadConcepts();
      loadStats();
    } catch (err) { $('ex-status').textContent = err.message; }
  });

  async function loadConcepts() {
    try {
      const { concepts } = await api('admin/concepts');
      if (!concepts.length) { $('concept-list').replaceChildren(el('p', { class: 'empty', text: '아직 저장된 범위 개념이 없어요. 위에서 자료를 올려 보세요.' })); return; }
      const groups = {};
      concepts.forEach(c => (groups[c.subject] = groups[c.subject] || []).push(c));
      $('concept-list').replaceChildren(...Object.entries(groups).map(([sid, list]) => el('details', { class: 'concept-group', open: '' }, [
        el('summary', { text: subjectName(sid) + ' · ' + list.length + '단원' }),
        ...list.map(c => {
          const del = el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: '삭제' });
          del.addEventListener('click', async () => {
            if (!confirm(`「${c.unit}」 개념을 지울까요? 학생 화면과 문제 만들기 범위에서 빠지고, 되돌릴 수 없어요.`)) return;
            await api('admin/concepts/delete', { body: { id: c.id } }).catch(err => alert(err.message));
            loadConcepts();
          });
          return el('div', { class: 'concept-unit' }, [
            el('div', { class: 'job-head' }, [el('strong', { text: c.unit }), del]),
            el('p', { class: 'job-meta', text: '수정 ' + when(c.updated) + (c.source ? ' · 자료: ' + c.source : '') }),
            c.summary ? el('p', { text: c.summary }) : null,
            el('ul', {}, (c.points || []).map(p => el('li', { text: p })))
          ]);
        })
      ])));
    } catch (e) { $('concept-list').replaceChildren(el('p', { class: 'empty', text: e.message })); }
  }

  /* ── 공부 타이머 랭킹 그룹 ── */
  async function loadGroups() {
    try {
      const { groups } = await api('admin/groups');
      if (!groups.length) { $('group-list').replaceChildren(el('li', { class: 'empty', text: '아직 만든 그룹이 없어요.' })); return; }
      $('group-list').replaceChildren(...groups.map(g => {
        const del = el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: '지우기' });
        del.addEventListener('click', async () => {
          if (!confirm(`「${g.name}」 그룹을 지울까요? 멤버 ${g.members}명이 모두 빠지고, 되돌릴 수 없어요.`)) return;
          await api('admin/groups/delete', { body: { id: g.id } }).catch(err => alert(err.message));
          loadGroups();
        });
        return el('li', {}, [el('div', { class: 'item-row' }, [
          el('span', { class: 'item-title', text: g.name }),
          el('span', { class: 'item-meta', text: g.members + '명 · 코드 ' + g.code + ' · 만든 날 ' + when(g.created) }),
          el('span', { class: 'item-action' }, [del])
        ])]);
      }));
    } catch (e) { $('group-list').replaceChildren(el('li', { class: 'empty', text: e.message })); }
  }

  /* ── API 관리 ── */
  function showConfig(c) {
    $('cf-enabled').checked = c.enabled;
    $('cf-verify').checked = c.verify;
    ['daily_limit', 'global_daily_limit', 'model', 'fallback_model', 'notice'].forEach(k => { $('cf-' + k).value = c[k]; });
    $('key-state').textContent = c.key.source === 'none' ? '— 등록된 키 없음 (학생 문제 만들기가 꺼져 있어요)'
      : c.key.source === 'admin' ? '— 관리자 페이지에서 등록한 키 사용 중 (…' + c.key.last4 + ')'
        : '— Cloudflare 비밀값(GEMINI_API_KEY) 사용 중 (…' + c.key.last4 + ')';
  }
  async function loadConfig() {
    try { showConfig(await api('admin/config')); } catch (e) { $('cf-status').textContent = e.message; }
  }
  $('config-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      showConfig(await api('admin/config', { body: {
        enabled: $('cf-enabled').checked, verify: $('cf-verify').checked, daily_limit: Number($('cf-daily_limit').value), global_daily_limit: Number($('cf-global_daily_limit').value),
        model: $('cf-model').value.trim(), fallback_model: $('cf-fallback_model').value.trim(), notice: $('cf-notice').value
      } }));
      $('cf-status').textContent = '설정을 저장했어요.';
    } catch (err) { $('cf-status').textContent = err.message; }
  });
  $('key-save').addEventListener('click', async () => {
    const key = $('key-input').value.trim();
    if (!key) { $('cf-status').textContent = '새 API 키를 붙여 넣어 주세요.'; return; }
    try {
      showConfig(await api('admin/config', { body: { gemini_key: key } }));
      $('key-input').value = '';
      $('cf-status').textContent = 'API 키를 바꿨어요. ‘연결 테스트’로 확인해 보세요.';
    } catch (err) { $('cf-status').textContent = err.message; }
  });
  $('key-clear').addEventListener('click', async () => {
    if (!confirm('관리자 페이지에서 등록한 API 키를 지울까요? Cloudflare 비밀값 키가 없으면 학생 문제 만들기가 멈춰요.')) return;
    try { showConfig(await api('admin/config', { body: { clear_key: true } })); $('cf-status').textContent = '관리자 페이지 키를 지웠어요.'; } catch (err) { $('cf-status').textContent = err.message; }
  });
  $('key-test').addEventListener('click', async () => {
    $('cf-status').textContent = 'AI에 연결해 보는 중…';
    try { const r = await api('admin/test-key', { body: {} }); $('cf-status').textContent = `연결 성공 · ${r.model} · ${(r.ms / 1000).toFixed(1)}초`; } catch (err) { $('cf-status').textContent = '연결 실패: ' + err.message; }
  });
  $('load-models').addEventListener('click', async () => {
    try {
      const { models } = await api('admin/models');
      $('model-list').replaceChildren(...models.map(m => el('option', { value: m })));
      $('cf-status').textContent = '모델 ' + models.length + '개를 불러왔어요. 모델 칸을 누르면 목록이 나와요.';
    } catch (err) { $('cf-status').textContent = err.message; }
  });

  if (token) start();
})();
