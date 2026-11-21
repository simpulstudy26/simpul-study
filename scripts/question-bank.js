(function () {
  'use strict';
  const catalog = window.SimpulStudyCatalog;
  const form = document.getElementById('bank-form');
  const subject = document.getElementById('bank-subject');
  const unit = document.getElementById('bank-unit');
  const hint = document.getElementById('bank-unit-hint');
  const input = document.getElementById('bank-files');
  const list = document.getElementById('bank-file-list');
  const status = document.getElementById('bank-files-status');
  let files = [];
  function option(value, text) {
    const node = document.createElement('option');
    node.value = value;
    node.textContent = text;
    return node;
  }
  catalog.forEach(item => subject.append(option(item.id, item.title)));
  subject.addEventListener('change', () => {
    const selected = catalog.find(item => item.id === subject.value);
    const units = selected?.units || [];
    unit.replaceChildren(option('', !selected ? '과목을 먼저 선택하세요' : units.length ? '전체 단원' : '단원 등록 준비 중'));
    units.forEach(item => unit.append(option(item.id, item.title)));
    unit.disabled = units.length === 0;
    hint.textContent = !selected ? '등록된 내용에 맞춰 단원 목록이 표시됩니다.' : units.length ? '원하는 단원을 선택하거나 전체 단원으로 설정하세요.' : '단원이 추가되면 이곳에서 선택할 수 있습니다. 과목만 선택해 둘 수 있습니다.';
  });
  function renderFiles() {
    list.replaceChildren();
    files.forEach(file => {
      const row = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '삭제';
      remove.setAttribute('aria-label', `${file.name} 삭제`);
      remove.addEventListener('click', () => {
        files = files.filter(item => item !== file);
        renderFiles();
        status.textContent = files.length ? `${files.length}개 파일이 선택되었습니다.` : '첨부한 파일이 없습니다.';
        input.focus();
      });
      row.append(name, remove);
      list.append(row);
    });
  }
  input.addEventListener('change', () => {
    const errors = [];
    for (const file of input.files) {
      if (!/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) {
        errors.push(`${file.name}: PDF 또는 JPG, PNG, WEBP 파일을 선택하세요.`);
      } else if (file.size > 14 * 1024 * 1024) {
        errors.push(`${file.name}: 14MB를 초과했습니다.`);
      } else if (files.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) {
        continue;
      } else if (files.length >= 5) {
        errors.push('파일은 최대 5개까지 첨부할 수 있습니다.');
        break;
      } else if (files.reduce((sum, item) => sum + item.size, 0) + file.size > 14 * 1024 * 1024) {
        errors.push('첨부 파일은 총 14MB까지 가능합니다.');
      } else {
        files.push(file);
      }
    }
    input.value = '';
    renderFiles();
    status.textContent = errors.length ? errors.join(' ') : `${files.length}개 파일이 선택되었습니다. 문제 생성 시 Google API에 전송됩니다.`;
  });
  // API 연동 시 이 FormData를 서버에 전달한다. 브라우저에 API 비밀 키를 저장하지 않는다.
  window.SimpulQuestionBank = {
    createRequest() {
      if (!form.reportValidity()) return null;
      const data = new FormData(form);
      if (!data.has('unit')) data.set('unit', '');
      files.forEach(file => data.append('references', file, file.name));
      return data;
    }
  };
  const button = document.getElementById('generate-bank');
  const bankStatus = document.getElementById('bank-status');
  const questions = document.getElementById('bank-questions');
  let busy = false;
  async function checkServer() {
    try {
      const response = await fetch('./api/status', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      bankStatus.textContent = data.ready ? '과목과 난이도를 선택하고 문제를 생성하세요.' : '서버의 Google API 키 설정이 필요합니다.';
      return Boolean(data.ready);
    } catch {
      bankStatus.textContent = '문제 생성 서버에 연결되지 않았습니다. http://127.0.0.1:8001/portal.html에서 열어 주세요. 서버를 켠 뒤 다시 눌러도 됩니다.';
      return false;
    }
  }
  function renderBatch(items) {
    const batch = document.createDocumentFragment();
    const offset = questions.children.length;
    items.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'question-card';
      const heading = document.createElement('h3');
      heading.textContent = `문항 ${offset + index + 1}`;
      const prompt = document.createElement('p');
      prompt.className = 'bank-question-text';
      prompt.textContent = item.question;
      const label = document.createElement('label');
      label.htmlFor = `bank-response-${offset + index}`;
      label.textContent = '나의 풀이';
      const response = document.createElement('textarea');
      response.id = label.htmlFor;
      response.rows = 3;
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = '정답 보기';
      details.addEventListener('toggle', () => { summary.textContent = details.open ? '정답 접기' : '정답 보기'; });
      const answer = document.createElement('p');
      answer.textContent = `정답: ${item.answer}`;
      const explanation = document.createElement('p');
      explanation.className = 'bank-question-text';
      explanation.textContent = `해설: ${item.explanation}`;
      details.append(summary, answer, explanation);
      card.append(heading, prompt, label, response, details);
      batch.append(card);
    });
    questions.append(batch);
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || button.disabled) return;
    const data = window.SimpulQuestionBank.createRequest();
    if (!data) return;
    const selected = catalog.find(item => item.id === subject.value);
    data.set('subject', selected.title);
    data.set('unit', selected.units.find(item => item.id === unit.value)?.title || '전체 단원');
    busy = true;
    button.disabled = true;
    button.textContent = '연결 확인 중…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 150000);
    try {
      if (!await checkServer()) return;
      button.textContent = '생성 중…';
      bankStatus.textContent = '문제 5개를 생성하고 있습니다. 잠시 기다려 주세요.';
      const response = await fetch('./api/questions', { method: 'POST', body: data, signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '문제 생성에 실패했습니다.');
      if (!Array.isArray(result.questions) || result.questions.length !== 5 || result.questions.some(item =>
        !item || ['question', 'answer', 'explanation'].some(key => typeof item[key] !== 'string' || !item[key].trim()))) {
        throw new Error('생성 결과 형식이 올바르지 않습니다. 다시 시도해 주세요.');
      }
      renderBatch(result.questions);
      bankStatus.textContent = `5문항을 추가했습니다. 총 ${questions.children.length}문항 · 다시 누르면 기존 문제 아래에 추가됩니다.`;
    } catch (error) {
      bankStatus.textContent = error.name === 'AbortError' ? '요청 시간이 초과되었습니다. 다시 시도해 주세요.' : error.message || '서버 연결에 실패했습니다.';
    } finally {
      clearTimeout(timer);
      busy = false;
      button.disabled = false;
      button.textContent = '5문항 더 생성';
    }
  });
  checkServer();
})();
