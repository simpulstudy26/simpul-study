(function () {
  'use strict';
  const S = window.Simpul;
  const id = new URLSearchParams(location.search).get('id');
  const item = S.findItem(id);
  const frame = document.getElementById('viewer-frame');

  if (!item || !item.file) {
    document.getElementById('viewer-title').textContent = '자료를 찾지 못했어요';
    document.querySelector('.viewer-actions').hidden = true;
    document.body.classList.remove('viewer-body');
    frame.replaceWith(S.el('div', { class: 'wrap page-head' }, [
      S.el('h2', { text: '주소에 맞는 자료가 없어요.' }),
      S.el('p', { text: '자료 이름이 바뀌었을 수 있어요. 홈에서 과목을 골라 다시 찾아 주세요.' }),
      S.el('a', { class: 'btn btn-primary', href: './index.html', text: '과목 목록으로 가기' })
    ]));
    return;
  }

  const subject = S.findSubject(item.subject);
  const src = 'materials/' + item.file;
  document.title = item.title + ' · ' + subject.name + ' · 심풀스터디';
  document.getElementById('viewer-title').textContent = item.title;
  frame.title = item.title;
  frame.src = src;

  const back = document.getElementById('back-link');
  back.href = 'subject.html?s=' + subject.id;
  back.textContent = '← ' + subject.name + ' 목록';
  document.getElementById('open-link').href = src;

  /* 같은 과목 안에서 이전·다음 자료 (외부 링크는 건너뜀) */
  const siblings = subject.items.filter(x => x.kind !== 'link');
  const index = siblings.indexOf(item);
  function setNav(linkId, target, label) {
    const link = document.getElementById(linkId);
    if (!target) return;
    link.href = S.hrefFor(target);
    link.removeAttribute('aria-disabled');
    link.title = label + ': ' + target.title;
  }
  setNav('prev-link', siblings[index - 1], '이전 자료');
  setNav('next-link', siblings[index + 1], '다음 자료');

  S.rememberItem(item.id);
})();
