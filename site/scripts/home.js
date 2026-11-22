(function () {
  'use strict';
  const S = window.Simpul;
  const el = S.el;

  /* 시험 버전 */
  const head = document.querySelector('.page-head');
  head.prepend(S.versionTabs());
  const duoToggle = S.duo && S.duo.toggle(); // 듀오링고 모드 스위치 (2학기 기말 버전에서만)
  if (duoToggle) head.querySelector('.version-tabs').after(duoToggle);
  head.querySelector('h1').textContent = S.version.title;
  head.querySelector('p').textContent = S.version.lead;
  document.title = '심풀스터디 · ' + S.version.title;

  /* 오늘 공부 시간 (공부 타이머 기록) */
  if (S.study) {
    const T = S.study, link = document.getElementById('home-timer');
    const draw = () => {
      const total = T.totalOn(T.today()), run = T.get().run;
      const sub = run && (S.findSubject(run.s) || { name: '기타' });
      document.getElementById('home-timer-total').textContent = total ? T.words(total) : '아직 기록 없음';
      document.getElementById('home-timer-now').textContent = sub ? '· ' + sub.name + ' 공부 중 ' + T.clock(T.runSeconds()) : '';
      link.classList.toggle('is-on', !!run);
    };
    draw();
    setInterval(draw, 1000);
  }

  /* 과목 고르기 */
  const grid = document.getElementById('subject-grid');
  S.SUBJECTS.forEach(subject => {
    grid.append(el('li', {}, [
      el('a', { class: 'subject-link', href: 'subject.html?s=' + subject.id, style: '--fx-spot:' + subject.color }, [
        el('span', { class: 'subject-mark', style: 'background:' + subject.color, 'aria-hidden': 'true', text: subject.mark }),
        el('span', { class: 'subject-name', text: subject.name }),
        el('span', { class: 'subject-meta', text: '자료 ' + subject.items.length + '개' }),
        el('span', { class: 'subject-summary', text: subject.summary })
      ])
    ]));
  });

  /* 이어서 보기와 최근 본 자료 */
  const recent = S.readRecent();
  if (recent.length) {
    const last = S.findItem(recent[0]);
    const subject = S.findSubject(last.subject);
    document.getElementById('resume-title').textContent = subject.name + ' · ' + last.title;
    const link = document.getElementById('resume-link');
    link.href = S.hrefFor(last);
    link.textContent = '이어서 보기';
    document.getElementById('resume').hidden = false;
  }
  if (recent.length > 1) {
    const list = document.getElementById('recent-list');
    recent.slice(1, 6).forEach(id => list.append(S.itemRow(S.findItem(id), true)));
    document.getElementById('recent').hidden = false;
  }

  /* 자료 찾기 */
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const status = document.getElementById('search-status');
  const all = S.allItems();
  const normalize = text => text.toLowerCase().replace(/\s+/g, '');

  function search() {
    const query = normalize(input.value);
    results.replaceChildren();
    if (!query) {
      results.hidden = true;
      status.textContent = '자료 이름, 단원, 과목 이름으로 찾을 수 있어요.';
      return;
    }
    const found = all.filter(item => {
      const subject = S.findSubject(item.subject);
      return normalize([item.title, item.course, subject.name, S.KINDS[item.kind]].join(' ')).includes(query);
    });
    found.forEach(item => results.append(S.itemRow(item, true)));
    results.hidden = found.length === 0;
    status.textContent = found.length
      ? '“' + input.value.trim() + '” 자료 ' + found.length + '개'
      : '“' + input.value.trim() + '”에 맞는 자료가 없어요. 단원 이름이나 과목 이름으로 다시 찾아보세요.';
  }
  input.addEventListener('input', search);
  document.getElementById('search-form').addEventListener('submit', event => { event.preventDefault(); search(); });
})();
