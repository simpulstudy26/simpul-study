/* 모든 페이지가 함께 쓰는 기능: 최근 본 자료 기록, 자료 목록 줄 만들기, 앱 설치용 서비스 워커 */
(function () {
  'use strict';
  const S = window.Simpul;
  const RECENT_KEY = 'simpul.recent.v1';

  S.readRecent = function () {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(list) ? list.filter(id => S.findItem(id)) : [];
    } catch (e) { return []; }
  };

  S.rememberItem = function (id) {
    try {
      const list = S.readRecent().filter(x => x !== id);
      list.unshift(id);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
    } catch (e) { /* 저장이 막힌 브라우저에서는 기록하지 않음 */ }
  };

  S.el = function (tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    });
    (children || []).forEach(child => child && node.append(child));
    return node;
  };

  S.actionLabel = function (item) {
    if (item.kind === 'link') return '새 탭에서 열기 ↗';
    if (item.kind === 'practice') return '바로 풀기 →';
    if (item.kind === 'quiz') return '퀴즈 풀기 →';
    if (item.kind === 'exam') return '문제 풀기 →';
    return '자료 열기 →';
  };

  /* 자료 한 줄. showSubject가 참이면 과목 이름을 함께 표시 */
  S.itemRow = function (item, showSubject) {
    const subject = S.findSubject(item.subject);
    const external = item.kind === 'link';
    const metaParts = [];
    if (showSubject) metaParts.push(subject.name);
    metaParts.push(item.course);
    if (item.note) metaParts.push(item.note);
    const title = S.el('span', { class: 'item-title' }, [
      showSubject ? S.el('span', { class: 'dot', style: 'background:' + subject.color, 'aria-hidden': 'true' }) : null,
      document.createTextNode(item.title)
    ]);
    return S.el('li', {}, [
      S.el('a', {
        class: 'item-row', href: S.hrefFor(item),
        target: external ? '_blank' : null, rel: external ? 'noopener' : null
      }, [
        title,
        S.el('span', { class: 'item-meta', text: metaParts.join(' · ') }),
        S.el('span', { class: 'item-action', text: S.actionLabel(item) })
      ])
    ]);
  };

  /* 시험 버전 고르기 (shadcn Tabs 모양). 누르면 그 버전으로 페이지를 다시 연다. */
  S.versionTabs = function () {
    const box = S.el('div', { class: 'version-tabs', role: 'tablist', 'aria-label': '시험 버전' });
    S.VERSIONS.forEach(v => {
      const active = v.id === S.version.id;
      const tab = S.el('button', { type: 'button', role: 'tab', 'aria-selected': active ? 'true' : 'false', text: v.label });
      if (!active) tab.addEventListener('click', () => S.setVersion(v.id));
      box.append(tab);
    });
    return box;
  };

  /* 익명 사용자 id: 이름·이메일 없이 기기마다 무작위로 만든다. 현재 사용자 수 집계와 하루 문제 만들기 횟수에만 쓴다. */
  S.uid = function () {
    try {
      let id = localStorage.getItem('simpul.uid.v1');
      if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
        id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
        localStorage.setItem('simpul.uid.v1', id);
      }
      return id;
    } catch (e) { return S._tempUid || (S._tempUid = 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16))); }
  };

  /* 접속 알림: 화면을 보고 있는 동안 2분마다. 서버(API)가 없는 곳에서는 조용히 무시 */
  /* enter: 이 탭에서 처음 보내는 접속 알림이면 ‘한 번 들어옴’으로 센다 (새 탭·새로 연 브라우저마다 1번) */
  function ping() {
    if (document.hidden || location.protocol === 'file:') return;
    let enter = false;
    try { enter = sessionStorage.getItem('simpul.entered') !== '1'; if (enter) sessionStorage.setItem('simpul.entered', '1'); } catch (e) { /* 저장 불가 */ }
    fetch('./api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: S.uid(), enter }), keepalive: true }).catch(() => {});
  }
  if (!/admin\.html$/.test(location.pathname)) {
    ping();
    setInterval(ping, 120000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
  }

  /* 화면 모드: 기본 다크, 버튼으로 라이트. 선택은 이 기기에 저장 (shadcn ModeToggle과 같은 해·달 아이콘) */
  const THEME_KEY = 'simpul.theme';
  const ICONS = '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
    + '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
  const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';
  function applyTheme(light) {
    if (light) document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#ffffff' : '#09090b');
    document.querySelectorAll('.theme-toggle').forEach(b => {
      b.setAttribute('aria-label', light ? '다크 모드로 바꾸기' : '라이트 모드로 바꾸기');
      b.title = light ? '다크 모드' : '라이트 모드';
    });
  }
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'theme-toggle';
  toggle.innerHTML = ICONS;
  toggle.addEventListener('click', () => {
    const light = !isLight();
    applyTheme(light);
    try { light ? localStorage.setItem(THEME_KEY, 'light') : localStorage.removeItem(THEME_KEY); } catch (e) { /* 저장 불가 */ }
  });
  const slot = document.querySelector('.site-header .wrap') || document.querySelector('.viewer-bar');
  if (slot) slot.append(toggle);
  applyTheme(isLight());

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
