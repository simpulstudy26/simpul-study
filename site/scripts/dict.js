/* 사전 (영어·국어·일본어): 네이버 사전 결과를 /api/dict?d=en|ko|ja(서버가 대신 불러 정리)로 받아 보여 준다.
   - dict.html: 사전 고르기·검색·자동완성·최근 검색·내 단어장
   - view.html: 자료 안의 단어를 두 번 누르면 뜻이 뜨는 사전 창 (영어 단어 → 영어사전, 한글 → 국어사전)
   단어장·최근 검색·고른 사전은 이 기기 브라우저에만 저장된다. */
(function () {
  'use strict';
  const S = window.Simpul || (window.Simpul = {});
  const el = S.el;
  const WB_KEY = 'simpul.wordbook.v1';
  const RECENT_KEY = 'simpul.dict.recent.v1';
  const MODE_KEY = 'simpul.dict.mode';
  const DICTS = {
    en: { name: '영어사전', short: '영어', hint: '예: apple, 사과, look up' },
    ko: { name: '국어사전', short: '국어', hint: '예: 음운, 사과, 반어법' },
    ja: { name: '일본어사전', short: '일본어', hint: '예: 学校, たべる, 사과' }
  };
  const cache = new Map();
  const validDict = d => (DICTS[d] ? d : 'en');

  /* ── 저장소 ── */
  function readList(key) {
    try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function writeList(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) { /* 저장이 막힌 브라우저 */ }
  }
  function savedMode() { try { return validDict(localStorage.getItem(MODE_KEY)); } catch (e) { return 'en'; } }
  function saveMode(d) { try { localStorage.setItem(MODE_KEY, d); } catch (e) { /* 저장 불가 */ } }

  // 예전 단어장(영어만, d 없음)은 영어사전 단어로 본다.
  const same = (x, word, d) => x.word.toLowerCase() === word.toLowerCase() && validDict(x.d) === d;
  const wordbook = {
    list: () => readList(WB_KEY).filter(x => x && x.word).map(x => ({ ...x, d: validDict(x.d) })),
    has: (word, d) => readList(WB_KEY).some(x => x && x.word && same(x, word, d)),
    add(word, mean, d) {
      const list = readList(WB_KEY).filter(x => x && x.word && !same(x, word, d));
      list.unshift({ word, mean, d, at: Date.now() });
      writeList(WB_KEY, list.slice(0, 500));
      document.dispatchEvent(new CustomEvent('simpul:wordbook'));
    },
    remove(word, d) {
      writeList(WB_KEY, readList(WB_KEY).filter(x => x && x.word && !same(x, word, d)));
      document.dispatchEvent(new CustomEvent('simpul:wordbook'));
    }
  };
  // 최근 검색: {q, d}. 예전 기록(문자열)은 영어사전으로.
  const readRecent = () => readList(RECENT_KEY).map(x => (typeof x === 'string' ? { q: x, d: 'en' } : x)).filter(x => x && x.q);
  function remember(q, d) {
    writeList(RECENT_KEY, [{ q, d }, ...readRecent().filter(x => !(x.q.toLowerCase() === q.toLowerCase() && x.d === d))].slice(0, 12));
  }

  /* ── API ── */
  async function getJSON(url) {
    if (cache.has(url)) return cache.get(url);
    if (location.protocol === 'file:') throw new Error('사전은 로컬 서버(SIMPUL 실행)나 배포 사이트에서 열어야 쓸 수 있어요.');
    const res = await fetch(url);
    let data = null;
    try { data = await res.json(); } catch (e) { /* 아래에서 처리 */ }
    if (!res.ok || !data) throw new Error((data && data.error) || '사전을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    cache.set(url, data);
    return data;
  }
  const lookup = (q, d) => getJSON('./api/dict?d=' + validDict(d) + '&q=' + encodeURIComponent(q));
  const suggest = (q, d) => getJSON('./api/dict/ac?d=' + validDict(d) + '&q=' + encodeURIComponent(q)).then(r => r.items || []);

  /* ── 발음 ── */
  let audio = null;
  function play(url, button) {
    try {
      if (audio) audio.pause();
      audio = new Audio(url);
      button && button.classList.add('playing');
      audio.addEventListener('ended', () => button && button.classList.remove('playing'));
      audio.play().catch(() => button && button.classList.remove('playing'));
    } catch (e) { /* 재생 불가 */ }
  }

  const shortMean = w => w.senses.flatMap(s => s.means).slice(0, 2).map(m => m.text).join('; ').slice(0, 160);
  const langOf = text => (/[぀-ヿ]/.test(text) ? 'ja' : /[가-힣]/.test(text) ? 'ko' : /[一-鿿]/.test(text) ? 'ja' : 'en');

  /* 서버가 후리가나를 {学校|がっこう}로 보내 줌 → <ruby>로 그린다 (HTML을 그대로 넣지 않음) */
  function rich(text, attrs) {
    const node = el('span', attrs || {});
    String(text || '').split(/(\{[^{}|]+\|[^{}|]+\})/).forEach(part => {
      const m = part.match(/^\{([^{}|]+)\|([^{}|]+)\}$/);
      if (m) node.append(el('ruby', {}, [document.createTextNode(m[1]), el('rp', { text: '(' }), el('rt', { text: m[2] }), el('rp', { text: ')' })]));
      else if (part) node.append(document.createTextNode(part));
    });
    return node;
  }
  const flat = text => String(text || '').replace(/\{([^{}|]+)\|[^{}|]+\}/g, '$1');

  /* ── 단어 카드 ── */
  function saveButton(word, mean, d) {
    const btn = el('button', { type: 'button', class: 'dict-save' });
    const sync = () => {
      const saved = wordbook.has(word, d);
      btn.textContent = saved ? '★ 단어장' : '☆ 단어장';
      btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      btn.setAttribute('aria-label', word + (saved ? ' 단어장에서 빼기' : ' 단어장에 넣기'));
    };
    btn.addEventListener('click', () => {
      if (wordbook.has(word, d)) wordbook.remove(word, d);
      else {
        wordbook.add(word, mean, d);
        if (S.duo && S.duo.active()) { S.duo.sound('ok'); btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
      }
    });
    document.addEventListener('simpul:wordbook', sync);
    sync();
    return btn;
  }

  function relatedRow(label, words, onWord) {
    if (!words || !words.length) return null;
    return el('div', { class: 'dict-related' }, [
      el('span', { class: 'dict-related-label', text: label }),
      ...words.map(w => {
        if (!onWord) return el('span', { class: 'dict-related-word', text: w });
        const b = el('button', { type: 'button', class: 'dict-related-word', text: w, title: w + ' 찾기' });
        b.addEventListener('click', () => onWord(w));
        return b;
      })
    ]);
  }

  function wordCard(w, d, opts) {
    const o = opts || {};
    const maxMeans = o.compact ? 3 : 99;
    const phon = el('div', { class: 'dict-phon' });
    w.phonetics.forEach(p => {
      const type = p.type || '발음';
      const bits = [el('span', { class: 'dict-phon-type', text: type })];
      if (p.value) bits.push(el('span', { class: 'dict-phon-value', text: '[' + p.value + ']' }));
      if (p.audio) {
        const b = el('button', { type: 'button', class: 'dict-play', 'aria-label': w.entry + ' ' + type + ' 듣기', title: '발음 듣기', text: '▶' });
        b.addEventListener('click', () => play(p.audio, b));
        bits.push(b);
      }
      phon.append(el('span', { class: 'dict-phon-item' }, bits));
    });

    let shown = 0;
    const senses = el('div', { class: 'dict-senses' });
    w.senses.forEach(s => {
      if (shown >= maxMeans) return;
      const list = el('ol', { class: 'dict-means' });
      s.means.forEach(m => {
        if (shown >= maxMeans) return;
        shown++;
        list.append(el('li', {}, [
          rich(m.text, { class: 'dict-mean' }),
          m.ex && !o.compact ? el('span', { class: 'dict-ex' }, [
            rich(m.ex, { lang: langOf(flat(m.ex)) }), m.exKo ? rich(m.exKo, { class: 'dict-ex-ko' }) : null]) : null
        ]));
      });
      senses.append(el('div', { class: 'dict-sense' }, [s.pos ? el('span', { class: 'dict-pos', text: s.pos }) : null, list]));
    });

    return el('article', { class: 'dict-word' }, [
      el('div', { class: 'dict-word-head' }, [
        el('h3', { class: 'dict-entry', lang: langOf(w.entry) }, [
          document.createTextNode(w.entry),
          w.sup ? el('sup', { class: 'dict-sup', text: w.sup }) : null
        ]),
        w.reading ? el('span', { class: 'dict-reading', lang: 'ja', text: w.reading }) : null,
        w.origin ? el('span', { class: 'dict-origin', text: '(' + w.origin + ')' }) : null,
        el('span', { class: 'dict-source', text: w.source }),
        saveButton(w.entry + (w.sup ? ' ' + w.sup : ''),
          (w.reading ? '[' + w.reading + '] ' : '') + (w.origin ? '(' + w.origin + ') ' : '') + shortMean(w), d)
      ]),
      w.note ? el('p', { class: 'dict-note', text: w.note }) : null,
      w.phonetics.length ? phon : null,
      senses,
      o.compact ? null : relatedRow('비슷한말', w.synonyms, o.onWord),
      o.compact ? null : relatedRow('반대말', w.antonyms, o.onWord),
      w.link && !o.compact ? el('a', { class: 'dict-more', href: w.link, target: '_blank', rel: 'noopener', text: '네이버 사전에서 자세히 ↗' }) : null
    ]);
  }

  function renderResult(box, data, opts) {
    const o = opts || {};
    const d = validDict(data.dict);
    box.replaceChildren();
    if (!data.words.length) {
      box.append(el('p', { class: 'empty', text: DICTS[d].name + '에 “' + data.query + '”에 맞는 단어가 없어요. 철자를 확인하거나 다른 사전에서 찾아보세요.' }));
      return;
    }
    data.words.slice(0, o.compact ? 2 : 8).forEach(w => box.append(wordCard(w, d, o)));
    if (!o.compact && data.examples.length) {
      box.append(el('h3', { class: 'sub-title', text: '예문' }), el('ul', { class: 'dict-examples' }, data.examples.map(x =>
        el('li', {}, [rich(x.text, { lang: langOf(flat(x.text)) }), x.trans ? rich(x.trans, { class: 'dict-ex-ko' }) : null,
          el('span', { class: 'dict-source', text: x.source })]))));
    }
    box.append(el('p', { class: 'dict-credit' }, [
      document.createTextNode('출처: 네이버 ' + DICTS[d].name + ' · '),
      el('a', { href: data.more, target: '_blank', rel: 'noopener', text: '네이버에서 전체 결과 보기 ↗' })
    ]));
  }

  /* ── 사전 고르기 (영어·국어) ── */
  function dictTabs(current, onChange, small) {
    const box = el('div', { class: 'version-tabs dict-tabs' + (small ? ' dict-tabs-sm' : ''), role: 'tablist', 'aria-label': '사전 고르기' });
    const buttons = Object.keys(DICTS).map(d => {
      const b = el('button', { type: 'button', role: 'tab', 'data-d': d, text: small ? DICTS[d].short : DICTS[d].name });
      b.addEventListener('click', () => onChange(d));
      box.append(b);
      return b;
    });
    const set = d => buttons.forEach(b => b.setAttribute('aria-selected', b.dataset.d === d ? 'true' : 'false'));
    set(current);
    return { box, set };
  }

  /* ── 검색칸 + 자동완성 (combobox) ── */
  function searchBox(input, listbox, getDict, onPick) {
    let timer = null, items = [], active = -1, seq = 0;
    const close = () => { listbox.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; input.removeAttribute('aria-activedescendant'); };
    const mark = () => {
      [...listbox.children].forEach((li, i) => li.setAttribute('aria-selected', i === active ? 'true' : 'false'));
      if (active >= 0) input.setAttribute('aria-activedescendant', listbox.children[active].id); else input.removeAttribute('aria-activedescendant');
    };
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (!q) return close();
      timer = setTimeout(async () => {
        const mine = ++seq;
        try { items = await suggest(q, getDict()); } catch (e) { items = []; }
        if (mine !== seq || input.value.trim() !== q) return;
        listbox.replaceChildren(...items.map((x, i) => {
          const li = el('li', { role: 'option', id: listbox.id + '-' + i, 'aria-selected': 'false' }, [
            el('span', { class: 'dict-ac-word', text: x.word }), x.reading ? el('span', { class: 'dict-ac-reading', text: x.reading }) : null,
            x.mean ? el('span', { class: 'dict-ac-mean', text: flat(x.mean) }) : null]);
          li.addEventListener('mousedown', e => { e.preventDefault(); close(); onPick(x.word); });
          return li;
        }));
        active = -1;
        listbox.hidden = !items.length;
        input.setAttribute('aria-expanded', items.length ? 'true' : 'false');
      }, 150);
    });
    input.addEventListener('keydown', e => {
      if (e.isComposing || listbox.hidden) return; // 한글 입력 중(조합 중)에는 화살표·Enter를 건드리지 않음
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = items.length; // -1은 검색칸으로 돌아온 상태
        if (e.key === 'ArrowDown') active = active + 1 >= n ? -1 : active + 1;
        else active = active - 1 < -1 ? n - 1 : active - 1;
        mark();
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        const w = items[active].word;
        close(); onPick(w);
      } else if (e.key === 'Escape') close();
    });
    input.addEventListener('blur', () => setTimeout(close, 100));
    return { close };
  }

  S.dict = { lookup, suggest, wordbook, renderResult, wordCard, searchBox, play, DICTS };

  /* ══ 사전 페이지 (dict.html) ══ */
  function initPage() {
    const params = new URLSearchParams(location.search);
    let mode = params.has('d') ? validDict(params.get('d')) : savedMode();
    const form = document.getElementById('dict-form');
    const input = document.getElementById('dict-q');
    const status = document.getElementById('dict-status');
    const result = document.getElementById('dict-result');
    const recentBox = document.getElementById('dict-recent');
    const wbList = document.getElementById('wb-list');
    const wbCount = document.getElementById('wb-count');
    const wbHide = document.getElementById('wb-hide');
    const title = document.getElementById('dict-title');
    const ac = searchBox(input, document.getElementById('dict-ac'), () => mode, q => { input.value = q; search(q, true); });
    const tabs = dictTabs(mode, d => {
      if (d === mode) return;
      setMode(d);
      if (input.value.trim()) search(input.value, true); else history.replaceState(null, '', '?d=' + d);
      input.focus();
    });
    document.getElementById('dict-tabs').replaceWith(tabs.box);

    function setMode(d) {
      mode = validDict(d);
      saveMode(mode);
      tabs.set(mode);
      title.textContent = DICTS[mode].name;
      input.placeholder = DICTS[mode].hint;
    }

    async function search(q, push) {
      q = q.trim().slice(0, 60);
      if (!q) return;
      ac.close();
      const url = '?d=' + mode + '&q=' + encodeURIComponent(q);
      if (push) history.pushState(null, '', url);
      document.title = q + ' · ' + DICTS[mode].name + ' · 심풀스터디';
      status.textContent = DICTS[mode].name + '에서 “' + q + '” 찾는 중…';
      result.setAttribute('aria-busy', 'true');
      const d = mode;
      try {
        const data = await lookup(q, d);
        if (d !== mode) return; // 그사이 사전을 바꿈
        renderResult(result, data, { onWord: w => { input.value = w; search(w, true); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
        status.textContent = data.words.length ? '“' + q + '” 단어 ' + data.total.toLocaleString() + '개 중 ' + Math.min(8, data.words.length) + '개' : '';
        if (data.words.length) { remember(q, d); renderRecent(); }
      } catch (e) {
        result.replaceChildren();
        status.textContent = e.message;
      } finally {
        result.removeAttribute('aria-busy');
      }
    }

    function renderRecent() {
      const list = readRecent();
      recentBox.replaceChildren(...list.map(x => {
        const b = el('button', { type: 'button', class: 'dict-chip', title: DICTS[validDict(x.d)].name }, [
          el('span', { class: 'dict-chip-tag', text: DICTS[validDict(x.d)].short }), document.createTextNode(x.q)]);
        b.addEventListener('click', () => { setMode(x.d); input.value = x.q; search(x.q, true); });
        return b;
      }));
      if (list.length) {
        const clear = el('button', { type: 'button', class: 'linkish', text: '지우기' });
        clear.addEventListener('click', () => { writeList(RECENT_KEY, []); renderRecent(); });
        recentBox.append(clear);
      } else recentBox.append(el('span', { class: 'tip', text: '아직 찾은 단어가 없어요.' }));
    }

    function renderWordbook() {
      const list = wordbook.list();
      wbCount.textContent = list.length ? list.length + '개' : '';
      wbList.classList.toggle('hide-mean', wbHide.checked);
      wbList.replaceChildren(...(list.length ? list.map(x => {
        const head = x.word.replace(/\s\d+$/, ''); // 동형어 번호(사과 8)는 빼고 검색
        const word = el('button', { type: 'button', class: 'wb-word', lang: langOf(x.word), title: DICTS[x.d].name + '에서 보기' }, [
          el('span', { class: 'dict-chip-tag', text: DICTS[x.d].short }), document.createTextNode(x.word)]);
        word.addEventListener('click', () => { setMode(x.d); input.value = head; search(head, true); window.scrollTo({ top: 0, behavior: 'smooth' }); });
        const del = el('button', { type: 'button', class: 'wb-del', 'aria-label': x.word + ' 단어장에서 빼기', title: '빼기', text: '×' });
        del.addEventListener('click', () => wordbook.remove(x.word, x.d));
        const mean = rich(x.mean, { class: 'wb-mean', tabindex: '0', title: '뜻 가리기 중이면 눌러서 보기' });
        mean.addEventListener('click', () => mean.classList.toggle('peek'));
        return el('li', {}, [word, mean, del]);
      }) : [el('li', { class: 'empty', text: '단어 카드의 ☆ 단어장을 누르면 여기에 모여요.' })]));
    }

    form.addEventListener('submit', e => { e.preventDefault(); search(input.value, true); });
    wbHide.addEventListener('change', renderWordbook);
    document.addEventListener('simpul:wordbook', renderWordbook);
    window.addEventListener('popstate', () => {
      const p = new URLSearchParams(location.search);
      if (p.has('d')) setMode(p.get('d'));
      const q = p.get('q') || '';
      input.value = q;
      if (q) search(q, false); else { result.replaceChildren(); status.textContent = ''; }
    });
    setMode(mode);
    renderRecent();
    renderWordbook();
    const first = params.get('q');
    if (first) { input.value = first; search(first, false); } else input.focus();
  }

  /* ══ 자료 보기 사전 창 (view.html) ══ */
  function initPopup() {
    const frame = document.getElementById('viewer-frame');
    const actions = document.querySelector('.viewer-actions');
    if (!frame || !actions) return;
    let mode = savedMode();

    const input = el('input', { class: 'input', type: 'search', id: 'pop-q', autocomplete: 'off',
      role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'pop-ac', 'aria-label': '사전에서 찾을 단어' });
    const acList = el('ul', { class: 'dict-ac', id: 'pop-ac', role: 'listbox', hidden: '' });
    const body = el('div', { class: 'dict-pop-body', 'aria-live': 'polite' }, [
      el('p', { class: 'tip', text: '자료 안의 단어를 두 번 누르면 뜻이 나와요. 영어는 영어사전, 한글은 국어사전, 가나·한자는 일본어사전에서 찾아요.' })]);
    const more = el('a', { class: 'dict-more', href: './dict.html', target: '_blank', rel: 'noopener', text: '크게 보기 ↗' });
    const closeBtn = el('button', { type: 'button', class: 'dict-pop-close', 'aria-label': '사전 닫기', text: '×' });
    const tabs = dictTabs(mode, d => { setMode(d); if (input.value.trim()) show(input.value, d); else input.focus(); }, true);
    const form = el('form', { class: 'dict-pop-form', role: 'search' }, [el('div', { class: 'dict-combo' }, [input, acList])]);
    const pop = el('section', { class: 'dict-pop', role: 'dialog', 'aria-label': '사전', hidden: '' }, [
      el('div', { class: 'dict-pop-head' }, [tabs.box, more, closeBtn]), form, body]);
    document.body.append(pop);

    const toggle = el('button', { type: 'button', class: 'viewer-dict-btn', 'aria-expanded': 'false', text: '사전' });
    actions.prepend(toggle);

    function setMode(d) {
      mode = validDict(d);
      saveMode(mode);
      tabs.set(mode);
      input.placeholder = DICTS[mode].hint;
    }
    setMode(mode);
    const open = () => { pop.hidden = false; toggle.setAttribute('aria-expanded', 'true'); };
    const close = () => { pop.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', () => { if (pop.hidden) { open(); input.focus(); } else close(); });
    closeBtn.addEventListener('click', () => { close(); toggle.focus(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) close(); });

    async function show(q, d) {
      q = q.trim().slice(0, 60);
      if (!q) return;
      if (d && d !== mode) setMode(d);
      const dd = mode;
      open();
      input.value = q;
      more.href = './dict.html?d=' + dd + '&q=' + encodeURIComponent(q);
      body.replaceChildren(el('p', { class: 'tip', text: '“' + q + '” 찾는 중…' }));
      try {
        const data = await lookup(q, dd);
        if (dd !== mode) return;
        renderResult(body, data, { compact: true });
        if (data.words.length) remember(q, dd);
      } catch (e) {
        body.replaceChildren(el('p', { class: 'tip', text: e.message }));
      }
    }
    const ac = searchBox(input, acList, () => mode, w => show(w));
    form.addEventListener('submit', e => { e.preventDefault(); ac.close(); show(input.value); });

    // 같은 사이트 자료(iframe)에서 단어를 두 번 누르면 찾기. 다른 사이트 자료는 브라우저가 막으므로 건너뜀.
    frame.addEventListener('load', () => {
      let doc;
      try { doc = frame.contentDocument; } catch (e) { return; }
      if (!doc) return;
      doc.addEventListener('dblclick', () => {
        const sel = doc.getSelection ? String(doc.getSelection()).trim() : '';
        if (/^[A-Za-z][A-Za-z'’-]{0,40}$/.test(sel)) show(sel.replace(/’/g, "'"), 'en');
        else if (/^[가-힣]{1,20}$/.test(sel)) show(sel, 'ko');
        else if (/^[぀-ヿ一-鿿々ー]{1,20}$/.test(sel)) show(sel, 'ja'); // 가나·한자 → 일본어사전
      });
      doc.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) close(); });
    });
  }

  function start() {
    if (document.getElementById('dict-app')) initPage();
    if (document.getElementById('viewer-frame')) initPopup();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
