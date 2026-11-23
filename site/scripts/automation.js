/* 자동화 센터: server.py의 /api/auto/* 를 사용한다. API 키는 서버에만 있다. */
(function () {
  'use strict';
  const S = window.Simpul;
  const el = S.el;
  const $ = id => document.getElementById(id);
  const STATUS = { queued: '대기', running: '진행 중', done: '완료', error: '실패' };
  const LEVEL = { easy: '쉬움', medium: '보통', hard: '어려움' };
  let files = [];
  let info = null;
  let online = false;

  async function api(path, body) {
    const opts = body instanceof FormData ? { method: 'POST', body }
      : body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' };
    const r = await fetch('./api/auto/' + path, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || '요청을 처리하지 못했어요.');
    return data;
  }
  const subjectName = id => (S.findSubject(id) || { name: id || '판별 중' }).name;
  const ago = t => {
    const s = Math.max(0, Date.now() / 1000 - t);
    return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분 전' : s < 86400 ? Math.floor(s / 3600) + '시간 전' : Math.floor(s / 86400) + '일 전';
  };

  /* ── 파일 고르기 ── */
  const drop = $('dropzone'), input = $('upload-files');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  function addFiles(list) {
    for (const f of list) if (!files.some(x => x.name === f.name && x.size === f.size)) files.push(f);
    files = files.slice(0, 30);
    renderFiles();
  }
  function renderFiles() {
    $('upload-list').replaceChildren(...files.map(f => {
      const rm = el('button', { type: 'button', text: '빼기', 'aria-label': f.name + ' 빼기' });
      rm.addEventListener('click', () => { files = files.filter(x => x !== f); renderFiles(); });
      return el('li', {}, [el('span', { text: f.name + ' (' + (f.size / 1048576).toFixed(1) + 'MB)' }), rm]);
    }));
    const total = files.reduce((a, f) => a + f.size, 0);
    $('upload-status').textContent = files.length ? '파일 ' + files.length + '개, 합계 ' + (total / 1048576).toFixed(1) + 'MB' + (total > 80 * 1048576 ? ' — 80MB를 넘어요. 나눠서 올려 주세요.' : '') : '';
  }

  $('upload-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!online) { $('upload-status').textContent = '자동화 서버에 연결된 뒤 올려 주세요.'; return; }
    if (!files.length) { $('upload-status').textContent = '올릴 파일을 먼저 골라 주세요.'; return; }
    const btn = $('upload-btn');
    btn.disabled = true;
    btn.textContent = '올리는 중…';
    try {
      const data = new FormData();
      ['subject', 'unit', 'difficulty', 'count', 'provider'].forEach(k => data.set(k, $('up-' + k).value));
      files.forEach(f => data.append('files', f, f.name));
      const r = await api('materials', data);
      files = [];
      renderFiles();
      $('upload-status').textContent = r.created.length + '개 자료의 자동 처리를 시작했어요.' + (r.errors.length ? ' 건너뜀: ' + r.errors.join(' ') : '') + ' 아래 작업 목록에서 진행 상황을 볼 수 있어요.';
      refresh();
    } catch (err) {
      $('upload-status').textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '올리고 자동 처리 시작';
    }
  });

  $('import-btn').addEventListener('click', async () => {
    if (!online) return;
    const btn = $('import-btn');
    btn.disabled = true;
    $('upload-status').textContent = '지금 시험 버전(catalog.js 기본값)의 자료를 읽고 있어요…';
    try {
      const r = await api('import-site', { count: Number($('up-count').value) || 10 });
      $('upload-status').textContent = r.jobs + '개 자료를 등록했어요. 이미 등록된 자료는 새 문제만 추가로 만들어요.';
      refresh();
    } catch (err) { $('upload-status').textContent = err.message; } finally { btn.disabled = false; }
  });

  /* ── 현황 ── */
  function renderStatus(d) {
    info = d;
    const q = d.questions || {};
    $('s-approved').textContent = q.approved || 0;
    $('s-review').textContent = q.review || 0;
    $('s-materials').textContent = d.materials;
    $('s-queued').textContent = d.queued + (d.current ? ' (+' + d.current + ' 진행 중)' : '');
    $('inbox-path').textContent = d.inbox;
    const p = d.providers;
    const chips = [el('span', { class: 'chip ' + (p.gemini ? 'ok' : 'off'), text: 'API · Gemini ' + (p.gemini ? '연결됨' : '키 없음') })];
    chips.push(el('span', { class: 'chip ' + (p.ollama.length ? 'ok' : 'off'), text: '로컬 AI · Ollama ' + (p.ollama.length ? '모델 ' + p.ollama.length + '개' : '꺼짐') }));
    if (d.settings.keeper_enabled) chips.push(el('span', { class: 'chip ok', text: '무한 보충 켜짐 · 단원당 ' + d.settings.keeper_target + '문항 유지' }));
    $('provider-row').replaceChildren(...chips);
    $('log-list').replaceChildren(...d.log.map(l => el('li', {}, [el('span', { class: 'log-at', text: ago(l.at) }), document.createTextNode(l.text)])));
  }

  function fillOnce(d) {
    (S.ALL_SUBJECTS || S.SUBJECTS).forEach(s => {
      $('up-subject').append(el('option', { value: s.id, text: s.name }));
      $('review-subject').append(el('option', { value: s.id, text: s.name }));
    });
    const units = new Set(d.subjects.flatMap(s => s.units));
    $('unit-options').replaceChildren(...[...units].map(u => el('option', { value: u })));
    const model = $('set-ollama_model');
    d.providers.ollama.forEach(m => model.append(el('option', { value: m.name, text: m.name + ' (' + (m.params || '?') + (m.cloud ? ', 클라우드' : ', 로컬') + ')' })));
    Object.entries(d.settings).forEach(([k, v]) => {
      const f = $('set-' + k);
      if (!f) return;
      if (f.type === 'checkbox') f.checked = v; else f.value = v;
    });
    $('up-count').value = d.settings.default_count;
    $('up-provider').value = d.settings.provider;
  }

  $('settings-form').addEventListener('change', async e => {
    const f = e.target;
    const key = f.id.replace('set-', '');
    try {
      await api('settings', { [key]: f.type === 'checkbox' ? f.checked : f.type === 'number' ? Number(f.value) : f.value });
      $('settings-status').textContent = '저장했어요.';
      refresh();
    } catch (err) { $('settings-status').textContent = err.message; }
  });

  /* ── 작업 목록 ── */
  function renderJobs(jobs) {
    $('jobs-count').textContent = jobs.filter(j => j.status === 'queued' || j.status === 'running').length + '개 처리 중';
    if (!jobs.length) { $('job-list').replaceChildren(el('li', { class: 'empty', text: '아직 작업이 없어요. 자료를 올려 보세요.' })); return; }
    $('job-list').replaceChildren(...jobs.slice(0, 30).map(j => {
      const pct = Math.min(100, Math.round((j.made || 0) / Math.max(1, j.count) * 100));
      const actions = [];
      if (j.status === 'error') actions.push(button('다시 시도', () => api('job', { id: j.id, action: 'retry' }).then(refresh)));
      if (j.status === 'queued') actions.push(button('취소', () => api('job', { id: j.id, action: 'cancel' }).then(refresh)));
      return el('li', { class: 'job is-' + j.status }, [
        el('div', { class: 'job-head' }, [
          el('strong', { text: (j.kind === 'refill' ? '♾ 보충 · ' : '') + (j.material || subjectName(j.subject) + ' 단원 지식') }),
          el('span', { class: 'job-state', text: STATUS[j.status] })
        ]),
        el('div', { class: 'job-meta', text: [subjectName(j.subject), j.unit, j.provider === 'ollama' ? '로컬 AI' : j.provider === 'gemini' ? 'API' : '자동', ago(j.updated)].filter(Boolean).join(' · ') }),
        el('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, [el('span', { style: 'width:' + pct + '%' })]),
        el('div', { class: 'job-meta', text: (j.progress || '') + (j.error ? ' — ' + j.error : '') }),
        actions.length ? el('div', { class: 'toolbar' }, actions) : null
      ]);
    }));
  }
  function button(text, onClick) {
    const b = el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text });
    b.addEventListener('click', async () => { b.disabled = true; try { await onClick(); } catch (e) { alert(e.message); } b.disabled = false; });
    return b;
  }

  /* ── 단원별 ── */
  function renderUnits(units) {
    if (!units.length) { $('unit-rows').replaceChildren(el('tr', {}, [el('td', { colspan: '5', class: 'empty', text: '자료를 올리면 단원별 현황이 여기에 나와요.' })])); return; }
    const target = info ? info.settings.keeper_target : 40;
    $('unit-rows').replaceChildren(...units.map(u => el('tr', {}, [
      el('td', { text: subjectName(u.subject) }),
      el('td', { text: u.unit || '—' }),
      el('td', {}, [el('span', { text: String(u.approved || 0) }), el('span', { class: 'mini-bar' }, [el('span', { style: 'width:' + Math.min(100, (u.approved || 0) / target * 100) + '%' })])]),
      el('td', { text: String(u.review || 0) }),
      el('td', {}, [button('10문항 더', () => api('refill', { subject: u.subject, unit: u.unit, count: 10 }).then(refresh))])
    ])));
  }

  /* ── 검토 ── */
  async function loadReview() {
    if (!online) return;
    const d = await api('questions?status=' + $('review-status').value + '&subject=' + $('review-subject').value);
    const list = $('review-list');
    if (!d.questions.length) { list.replaceChildren(el('p', { class: 'empty', text: '해당하는 문제가 없어요.' })); return; }
    list.replaceChildren(...d.questions.map(q => {
      const qText = el('textarea', { rows: '3', 'aria-label': '문제' }); qText.value = q.question;
      const aText = el('input', { class: 'input', 'aria-label': '정답' }); aText.value = q.answer;
      const eText = el('textarea', { rows: '3', 'aria-label': '해설' }); eText.value = q.explanation;
      const st = $('review-status').value;
      const actions = [];
      if (st !== 'approved') actions.push(button('공개', () => act(q.id, 'approved')));
      if (st !== 'rejected') actions.push(button('내리기', () => act(q.id, 'rejected')));
      actions.push(button('고친 내용 저장', () => api('question', { id: q.id, edit: { question: qText.value, answer: aText.value, explanation: eText.value } }).then(() => alert('저장했어요.'))));
      actions.push(button('삭제', () => confirm('이 문제를 완전히 지울까요? 되돌릴 수 없어요.') && act(q.id, 'delete')));
      return el('article', { class: 'question-card' }, [
        el('h3', { text: [subjectName(q.subject), q.unit, LEVEL[q.difficulty], q.provider].filter(Boolean).join(' · ') }),
        q.note ? el('p', { class: 'review-note', text: q.note }) : null,
        el('label', { text: '문제' }), qText,
        q.choices.length ? el('p', { class: 'tip', text: '보기: ' + q.choices.map((c, i) => '①②③④⑤⑥'[i] + ' ' + c).join('  ') }) : null,
        el('label', { text: '정답' }), aText,
        el('label', { text: '해설' }), eText,
        el('div', { class: 'toolbar', style: 'margin-top:12px' }, actions)
      ]);
    }));
  }
  async function act(id, action) { await api('question', { id, action }); loadReview(); refresh(); }
  function showReviewError(err) { $('review-list').replaceChildren(el('p', { class: 'empty', text: '검토 목록을 불러오지 못했어요: ' + err.message })); }
  $('review-status').addEventListener('change', () => loadReview().catch(showReviewError));
  $('review-subject').addEventListener('change', () => loadReview().catch(showReviewError));

  /* ── 주기적 새로고침 ── */
  let first = true;
  async function refresh() {
    try {
      const [st, jobs, units] = await Promise.all([api('status'), api('jobs'), api('units')]);
      online = true;
      if (first) { fillOnce(st); first = false; loadReview().catch(showReviewError); }
      $('auto-notice').textContent = st.providers.gemini || st.providers.ollama.length
        ? '자동화 서버에 연결됐어요. 자료를 올리거나 inbox 폴더에 넣으면 나머지는 자동으로 진행돼요.'
        : '서버는 켜져 있지만 사용할 AI가 없어요. Ollama를 켜거나 GEMINI_API_KEY를 설정해 주세요.';
      renderStatus(st);
      renderJobs(jobs.jobs);
      renderUnits(units.units);
    } catch (e) {
      online = false;
      $('auto-notice').textContent = '자동화 서버에 연결되지 않았어요. 맥북에서 ‘SIMPUL 실행’을 연 뒤 http://127.0.0.1:8001/automation.html 에서 사용하세요.';
    }
  }
  refresh();
  setInterval(refresh, 4000);
})();
