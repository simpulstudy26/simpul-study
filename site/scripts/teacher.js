/* 출제실: 로컬 서버(server.py)의 /api/questions로 문제 생성 요청을 보낸다.
   API 키는 서버에만 있고 브라우저에는 저장하지 않는다. */
(function () {
  'use strict';
  const S = window.Simpul;
  const el = S.el;
  const MAX_BYTES = 14 * 1024 * 1024;
  const subjectSelect = document.getElementById('bank-subject');
  const unitSelect = document.getElementById('bank-unit');
  const fileInput = document.getElementById('bank-files');
  const fileList = document.getElementById('bank-file-list');
  const fileStatus = document.getElementById('bank-files-status');
  const form = document.getElementById('bank-form');
  const button = document.getElementById('generate-bank');
  const status = document.getElementById('bank-status');
  const notice = document.getElementById('server-notice');
  const results = document.getElementById('bank-questions');
  const count = document.getElementById('bank-count');
  let files = [];
  let busy = false;

  (S.ALL_SUBJECTS || S.SUBJECTS).forEach(s => subjectSelect.append(el('option', { value: s.id, text: s.name })));
  function fillUnits() {
    const subject = S.findSubject(subjectSelect.value);
    unitSelect.replaceChildren(el('option', { value: '', text: '전체 범위' }));
    subject.items.filter(x => x.kind !== 'link').forEach(x => unitSelect.append(el('option', { value: x.id, text: x.course + ' · ' + x.title })));
  }
  subjectSelect.addEventListener('change', fillUnits);
  fillUnits();

  function renderFiles() {
    fileList.replaceChildren();
    files.forEach(file => {
      const remove = el('button', { type: 'button', text: '빼기', 'aria-label': file.name + ' 빼기' });
      remove.addEventListener('click', () => {
        files = files.filter(x => x !== file);
        renderFiles();
        fileStatus.textContent = files.length ? '파일 ' + files.length + '개를 첨부했어요.' : '첨부한 파일이 없어요.';
        fileInput.focus();
      });
      fileList.append(el('li', {}, [el('span', { text: file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + 'MB)' }), remove]));
    });
  }
  fileInput.addEventListener('change', () => {
    const errors = [];
    for (const file of fileInput.files) {
      const total = files.reduce((sum, x) => sum + x.size, 0);
      if (!/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) errors.push(file.name + ': PDF, JPG, PNG, WEBP만 첨부할 수 있어요.');
      else if (files.some(x => x.name === file.name && x.size === file.size)) continue;
      else if (files.length >= 5) { errors.push('파일은 5개까지 첨부할 수 있어요.'); break; }
      else if (total + file.size > MAX_BYTES) errors.push(file.name + ': 합계 14MB를 넘어요.');
      else files.push(file);
    }
    fileInput.value = '';
    renderFiles();
    fileStatus.textContent = errors.length ? errors.join(' ') : '파일 ' + files.length + '개를 첨부했어요. 문제를 만들 때 Google AI로 전송돼요.';
  });

  async function checkServer() {
    try {
      const response = await fetch('./api/status', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      notice.textContent = data.ready
        ? '출제 서버에 연결됐어요. 조건을 고르고 ‘문제 5개 만들기’를 누르세요.'
        : '출제 서버는 켜져 있지만 Google API 키가 설정되지 않았어요. README의 키 설정 방법을 확인하세요.';
      return Boolean(data.ready);
    } catch (e) {
      notice.textContent = '출제 서버에 연결되지 않았어요. 맥북의 simpul-3.0 폴더에서 ‘SIMPUL 실행’을 연 뒤 열린 주소(http://127.0.0.1:8001)에서 이 페이지를 사용하세요.';
      return false;
    }
  }

  function renderQuestions(items) {
    const offset = results.children.length;
    items.forEach((q, i) => {
      const n = offset + i + 1;
      const responseId = 'bank-response-' + n;
      results.append(el('article', { class: 'question-card' }, [
        el('h3', { text: '문항 ' + n }),
        el('p', { class: 'bank-text', text: q.question }),
        el('label', { for: responseId, text: '검토 메모' }),
        el('textarea', { id: responseId, rows: '2', placeholder: '정답 확인 결과나 고칠 점을 적어 두세요.' }),
        el('details', {}, [
          el('summary', { text: '정답·해설 보기' }),
          el('p', { text: '정답: ' + q.answer }),
          el('p', { class: 'bank-text', text: '해설: ' + q.explanation })
        ])
      ]));
    });
    count.textContent = results.children.length + '문항';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    button.disabled = true;
    button.textContent = '서버 확인 중…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 150000);
    try {
      if (!await checkServer()) { status.textContent = '출제 서버에 연결된 뒤 다시 눌러 주세요.'; return; }
      const subject = S.findSubject(subjectSelect.value);
      const unit = S.findItem(unitSelect.value);
      const data = new FormData();
      data.set('subject', subject.name);
      data.set('unit', unit ? unit.course + ' · ' + unit.title : '전체 범위');
      data.set('difficulty', document.getElementById('bank-difficulty').value);
      data.set('instructions', document.getElementById('bank-instructions').value);
      files.forEach(file => data.append('references', file, file.name));
      button.textContent = '만드는 중…';
      status.textContent = '문제 5개를 만들고 있어요. 1~2분 걸릴 수 있어요.';
      const response = await fetch('./api/questions', { method: 'POST', body: data, signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '문제를 만들지 못했어요.');
      const ok = Array.isArray(result.questions) && result.questions.length === 5 && result.questions.every(q =>
        q && ['question', 'answer', 'explanation'].every(k => typeof q[k] === 'string' && q[k].trim()));
      if (!ok) throw new Error('받은 결과의 형식이 맞지 않아요. 다시 눌러 주세요.');
      renderQuestions(result.questions);
      status.textContent = '5문항을 아래에 추가했어요. 다시 누르면 그 아래에 이어서 추가돼요.';
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? '시간이 너무 오래 걸려 멈췄어요. 첨부 파일을 줄이고 다시 눌러 주세요.' : error.message;
    } finally {
      clearTimeout(timer);
      busy = false;
      button.disabled = false;
      button.textContent = results.children.length ? '문제 5개 더 만들기' : '문제 5개 만들기';
    }
  });

  checkServer();
})();
