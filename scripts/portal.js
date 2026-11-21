(function () {
  'use strict';
  const nav = document.getElementById('subjectNav');
  const cards = document.getElementById('cardPanel');
  const viewer = document.getElementById('viewerPanel');
  const bank = document.getElementById('questionBankPanel');
  const title = document.getElementById('pageTitle');
  const description = document.getElementById('pageDescription');
  const subjects = window.SimpulStudyCatalog.map(subject => subject.title);
  function selectSubject(subject, button) {
    nav.querySelectorAll('button').forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    title.textContent = subject;
    description.textContent = '과목을 선택해 학습자료를 확인하세요.';
    bank.hidden = true;
    viewer.hidden = true;
    cards.hidden = false;
    cards.replaceChildren();
    if (subject !== '수학') {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '등록된 학습자료가 없습니다.';
      cards.append(empty);
      return;
    }
    window.SimpulStudyCatalog.find(item => item.title === subject).units.forEach(unit => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'study-card';
      for (const [tag, className, text] of [
        ['span', 'card-subject', unit.course],
        ['strong', '', unit.name],
        ['span', 'card-action', unit.action]
      ]) {
        const item = document.createElement(tag);
        item.className = className;
        item.textContent = text;
        card.append(item);
      }
      card.addEventListener('click', () => {
        cards.hidden = true;
        viewer.hidden = false;
        document.getElementById('conditions-practice').hidden = unit.panel !== 'conditions-practice';
        document.getElementById('inverse-practice').hidden = unit.panel !== 'inverse-practice';
        const focusTarget = unit.panel === 'conditions-practice'
          ? document.getElementById('generate') : document.getElementById('inverse-title');
        focusTarget.focus();
      });
      cards.append(card);
    });
  }
  subjects.forEach(subject => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = subject;
    button.setAttribute('aria-pressed', 'false');
    if (subject === '수학') button.id = 'math-subject';
    button.addEventListener('click', () => selectSubject(subject, button));
    nav.append(button);
  });
  const bankButton = document.createElement('button');
  bankButton.type = 'button';
  bankButton.id = 'question-bank-menu';
  bankButton.className = 'question-bank-menu';
  bankButton.textContent = '문제 은행';
  bankButton.setAttribute('aria-controls', 'questionBankPanel');
  bankButton.setAttribute('aria-pressed', 'false');
  bankButton.addEventListener('click', () => {
    nav.querySelectorAll('button').forEach(item => {
      item.classList.toggle('active', item === bankButton);
      item.setAttribute('aria-pressed', String(item === bankButton));
    });
    title.textContent = '문제 은행';
    description.textContent = 'API로 새로운 문제를 생성하는 공간입니다.';
    cards.hidden = true;
    viewer.hidden = true;
    bank.hidden = false;
  });
  nav.append(bankButton);
  const initial = document.createElement('div');
  initial.className = 'empty-state';
  initial.textContent = '과목을 선택해 학습자료를 확인하세요.';
  cards.append(initial);
  document.getElementById('backToCards').addEventListener('click', () => {
    viewer.hidden = true;
    cards.hidden = false;
    cards.querySelector('button')?.focus();
  });
  const toggle = document.getElementById('subjectToggle');
  toggle.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    toggle.textContent = collapsed ? '과목 열기' : '과목 닫기';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    document.getElementById('subjectSidebar').hidden = collapsed;
  });
})();
