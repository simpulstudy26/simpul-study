/* 내 문제 만들기: /api/generate (Cloudflare)로 AI 문제를 받아 이 기기에만 저장한다. */
(function () {
  'use strict';
  const S = window.Simpul;
  const el = S.el;
  const $ = id => document.getElementById(id);
  const LEVEL = { easy: '쉬움', medium: '보통', hard: '어려움' };
  const subjectSel = $('make-subject'), unitSel = $('make-unit');
  let info = null, concepts = [], busy = false;

  async function getJSON(url, opts) {
    const r = await fetch(url, Object.assign({ cache: 'no-store' }, opts || {}));
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || '서버에 연결하지 못했어요.');
    return data;
  }

  function fillSubjects() {
    const counts = (info && info.concept_subjects) || {};
    const wanted = new URLSearchParams(location.search).get('s');
    subjectSel.replaceChildren(...S.SUBJECTS.map(s => el('option', { value: s.id, text: s.name + (counts[s.id] ? ' · 범위 개념 ' + counts[s.id] + '단원' : '') })));
    if (S.findSubject(wanted)) subjectSel.value = wanted;
  }

  async function loadConcepts() {
    unitSel.replaceChildren(el('option', { value: '', text: '시험 범위 전체' }));
    concepts = [];
    try { concepts = (await getJSON('./api/concepts?subject=' + subjectSel.value)).concepts; } catch (e) { /* 서버 없음 */ }
    concepts.forEach(c => unitSel.append(el('option', { value: c.unit, text: c.unit })));
    showConcept();
    renderMine();
  }

  function showConcept() {
    const box = $('make-concepts'), body = $('make-concepts-body');
    const list = unitSel.value ? concepts.filter(c => c.unit === unitSel.value) : concepts;
    box.hidden = !list.length;
    body.replaceChildren(...list.map(c => el('div', { class: 'concept-unit' }, [
      el('h3', { text: c.unit }),
      c.summary ? el('p', { text: c.summary }) : null,
      el('ul', {}, (c.points || []).map(p => el('li', { text: p })))
    ])));
    $('make-status').textContent = concepts.length ? '' : '이 과목은 선생님이 아직 시험 범위 개념을 올리지 않아서, 고1 2학기 교육과정 기준으로 만들어요.';
  }

  function updateRemaining() {
    $('make-remaining').textContent = !(info && info.enabled) ? ''
      : info.global_left === 0 ? '오늘 사이트 전체 무료 사용량이 다 찼어요. 내일 다시 만들 수 있어요.'
        : '오늘 남은 횟수 ' + info.remaining + ' / ' + info.daily_limit;
    $('make-btn').disabled = !(info && info.enabled && info.remaining > 0);
  }

  async function loadInfo() {
    try {
      info = await getJSON('./api/info?uid=' + encodeURIComponent(S.uid()));
      $('make-notice').textContent = info.enabled
        ? (info.notice || '과목과 단원을 고르고 ‘문제 만들기’를 누르세요. 한 번에 최대 5문제씩 만들어요.')
        : (info.notice || '지금은 문제 만들기를 잠시 쉬고 있어요. 이미 만든 문제와 무한 문제는 계속 풀 수 있어요.');
    } catch (e) {
      info = null;
      $('make-notice').textContent = '문제 만들기 서버에 연결되지 않았어요. 인터넷 연결을 확인해 주세요. 이미 만든 문제는 아래에서 계속 볼 수 있어요.';
    }
    updateRemaining();
  }

  $('make-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !info || !info.enabled) return;
    busy = true;
    const btn = $('make-btn');
    btn.disabled = true;
    btn.textContent = '만드는 중…';
    $('make-status').textContent = 'AI가 문제를 만들고 정답을 검사하고 있어요. 30초~1분쯤 걸려요.';
    try {
      const subject = subjectSel.value, unit = unitSel.value;
      const r = await getJSON('./api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: S.uid(), subject, unit, difficulty: $('make-difficulty').value, count: Number($('make-count').value), request: $('make-request').value })
      });
      const saved = S.mine.add(subject, unit || '시험 범위 전체', r.questions);
      if (!saved) throw new Error('기기 저장 공간이 부족해 저장하지 못했어요. 오래된 문제를 지운 뒤 다시 시도해 주세요.');
      info.remaining = r.remaining;
      $('make-status').replaceChildren(document.createTextNode(saved.length + '문제를 만들어 이 기기에 저장했어요. ' + (r.dropped ? '(정답 검사에서 ' + r.dropped + '문제를 뺐어요) ' : '')),
        el('a', { href: 'cloud.html?s=' + subject + '&src=mine', text: '바로 풀기 →' }));
      renderMine();
    } catch (e) {
      $('make-status').textContent = e.message;
      loadInfo();
    } finally {
      busy = false;
      btn.textContent = '문제 만들기';
      updateRemaining();
    }
  });

  function renderMine() {
    const list = S.mine.forSubject(subjectSel.value).reverse();
    const name = S.findSubject(subjectSel.value).name;
    $('mine-count').textContent = name + ' ' + list.length + '문제 · 이 기기에만 저장';
    const tools = [];
    if (list.length) {
      tools.push(el('a', { class: 'btn btn-primary', href: 'cloud.html?s=' + subjectSel.value + '&src=mine', text: '내 문제 이어서 풀기' }));
      const clear = el('button', { class: 'btn btn-secondary', type: 'button', text: name + ' 문제 모두 지우기' });
      clear.addEventListener('click', () => { if (confirm(name + '에서 만든 문제 ' + list.length + '개를 이 기기에서 지울까요? 되돌릴 수 없어요.')) { S.mine.clear(subjectSel.value); renderMine(); } });
      tools.push(clear);
    }
    $('mine-tools').replaceChildren(...tools);
    if (!list.length) { $('mine-list').replaceChildren(el('p', { class: 'empty', text: '아직 만든 문제가 없어요.' })); return; }
    $('mine-list').replaceChildren(...list.slice(0, 100).map(q => {
      const del = el('button', { class: 'linkish', type: 'button', text: '지우기' });
      del.addEventListener('click', () => { S.mine.remove(q.id); renderMine(); });
      return el('article', { class: 'question-card' }, [
        el('h3', { text: [q.u, LEVEL[q.d], new Date(q.t).toLocaleDateString('ko-KR')].filter(Boolean).join(' · ') }),
        el('p', { class: 'bank-text', text: q.q }),
        q.c.length ? el('ol', { class: 'mine-choices' }, q.c.map(c => el('li', { text: c }))) : null,
        el('details', {}, [el('summary', { text: '정답·해설 보기' }), el('p', { text: '정답: ' + q.a }), el('p', { class: 'bank-text', text: q.e })]),
        el('div', { style: 'text-align:right' }, [del])
      ]);
    }));
  }

  subjectSel.addEventListener('change', () => { history.replaceState(null, '', '?s=' + subjectSel.value); loadConcepts(); });
  unitSel.addEventListener('change', showConcept);

  (async () => {
    await loadInfo();
    fillSubjects();
    loadConcepts();
  })();
})();
