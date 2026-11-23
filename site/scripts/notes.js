/* 필기 (notes.html): 손필기 노트.
   - 서재: 노트 만들기·PDF 가져오기·백업 불러오기·과목별 보기
   - 편집: 펜(만년필·볼펜·붓펜, 필압), 형광펜, 지우개(획/부분), 올가미(이동·크기·색·복사·삭제),
     텍스트 상자, 이미지, 레이저 포인터, 그리고 멈추면 도형으로 바뀌기, 쪽 추가·복제·삭제·순서·배경,
     되돌리기, 확대·축소(두 손가락·⌘+휠), 펜만 그리기(손은 스크롤), PDF·PNG 내보내기, 백업 파일
   노트는 이 기기 IndexedDB('simpul-notes')에만 저장된다.
   데이터: notebook {id,title,subject,cover,created,updated,pages:[page]}
           page {id,w,h,tpl,paper,bg?,items:[item]}
           item 획 {i,t:'s',tool:'pen'|'hl',k,c,w,p:[x,y,압력,...]} · 글 {i,t:'x',x,y,w,s,c,v} · 그림 {i,t:'i',x,y,w,h,src}
   항목은 바꾸지 않고 새로 만든다(되돌리기는 page.items 배열을 통째로 바꿔 끼운다). */
(function () {
  'use strict';
  const S = window.Simpul || (window.Simpul = {});
  const $ = (s, r) => (r || document).querySelector(s);
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : String(c)); });
    return e;
  }
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = v => Math.round(v * 10) / 10;
  const FONT = "'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

  /* ══ 상수 ══ */
  const SIZES = { p: [820, 1160], l: [1160, 820] };
  const TEMPLATES = [
    { id: 'blank', name: '무지' }, { id: 'lined', name: '줄' }, { id: 'grid', name: '모눈' },
    { id: 'dot', name: '점' }, { id: 'cornell', name: '코넬' }, { id: 'wrong', name: '오답노트' }
  ];
  const PAPERS = { white: { name: '흰색', c: '#ffffff' }, cream: { name: '미색', c: '#fbf6e9' }, dark: { name: '어두운', c: '#232428' } };
  const COVERS = ['#2f5bea', '#0f7a6c', '#c2410c', '#6d3fd6', '#be123c', '#15803d', '#0369a1', '#a16207', '#3f3f46'];
  const PEN_COLORS = ['#111827', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#f97316', '#ffffff'];
  const HL_COLORS = ['#fde047', '#86efac', '#7dd3fc', '#f9a8d4', '#fdba74'];
  const SIZE_SET = { pen: [1.4, 2.6, 4.6], hl: [10, 18, 28], eraser: [8, 18, 36], text: [14, 20, 30] };
  const PEN_KINDS = [{ id: 'fountain', name: '만년필' }, { id: 'ball', name: '볼펜' }, { id: 'brush', name: '붓펜' }];
  const PREF_KEY = 'simpul.notes.prefs.v1';
  const MAX_UNDO = 200;

  const ICON = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    hl: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
    lasso: '<path d="M7 22a5 5 0 0 1-2-4"/><path d="M3.3 14A6.8 6.8 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1"/><circle cx="5" cy="16" r="2"/>',
    text: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    laser: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    pages: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    page: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2v6h6"/><path d="M12 18v-6M9 15h6"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    minus: '<path d="M5 12h14"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2v-.5a2 2 0 0 1 2-2h1.6A4.4 4.4 0 0 0 22 13 10.6 10.6 0 0 0 12 2Z"/>',
    paste: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'
  };
  const svg = (name, size) => '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + '</svg>';

  /* ══ 저장소 (IndexedDB, 막힌 브라우저에서는 이 탭 동안만 메모리에) ══ */
  const DB = (() => {
    let dbp = null;
    const mem = new Map();
    let useMem = !('indexedDB' in window);
    function open() {
      if (!dbp) dbp = new Promise((res, rej) => {
        const r = indexedDB.open('simpul-notes', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('notebooks', { keyPath: 'id' });
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.onblocked = () => rej(new Error('blocked'));
      });
      return dbp;
    }
    async function tx(mode, fn) {
      if (!useMem) {
        try {
          const db = await open();
          return await new Promise((res, rej) => {
            const t = db.transaction('notebooks', mode);
            const req = fn(t.objectStore('notebooks'));
            t.oncomplete = () => res(req && req.result);
            t.onerror = () => rej(t.error);
            t.onabort = () => rej(t.error);
          });
        } catch (e) {
          if (e && e.name === 'QuotaExceededError') throw e;
          useMem = true;
          DB.memOnly = true;
        }
      }
      return null;
    }
    return {
      memOnly: useMem,
      async all() { const r = await tx('readonly', s => s.getAll()); return useMem ? [...mem.values()] : (r || []); },
      async get(id) { const r = await tx('readonly', s => s.get(id)); return useMem ? mem.get(id) : r; },
      async put(nb) { if (useMem) { mem.set(nb.id, nb); return; } await tx('readwrite', s => s.put(nb)); if (useMem) mem.set(nb.id, nb); },
      async del(id) { mem.delete(id); await tx('readwrite', s => s.delete(id)); }
    };
  })();

  /* ══ 설정 ══ */
  const prefs = (() => {
    const d = {
      tool: 'pen', penOnly: false, penAuto: true, penSeen: false, snap: true, thumbs: true,
      pen: { c: '#111827', w: 2.6, k: 'fountain' }, hl: { c: '#fde047', w: 18 },
      eraser: { w: 18, mode: 'stroke' }, text: { s: 20, c: '#111827' },
      skin: 'auto', accent: 'auto', custom: { pen: [], hl: [] }
    };
    try {
      const s = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      ['pen', 'hl', 'eraser', 'text'].forEach(k => { if (s[k]) Object.assign(d[k], s[k]); });
      ['tool', 'penOnly', 'penAuto', 'penSeen', 'snap', 'thumbs', 'skin', 'accent'].forEach(k => { if (k in s) d[k] = s[k]; });
      if (s.custom) ['pen', 'hl'].forEach(k => { if (Array.isArray(s.custom[k])) d.custom[k] = s.custom[k].filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 12); });
    } catch (e) { /* 무시 */ }
    if (d.tool === 'image') d.tool = 'pen';
    return d;
  })();
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* 저장 불가 */ } }

  /* ══ 디자인: 기본 / 듀오링고 / 사이트 따라가기 + 강조색 팔레트 ══ */
  const SKINS = [{ id: 'auto', name: '사이트 따라가기' }, { id: 'basic', name: '기본' }, { id: 'duo', name: '듀오링고' }];
  const ACCENTS = [
    { id: 'auto', name: '자동' }, { id: '#1CB0F6', name: '하늘' }, { id: '#58CC02', name: '초록' }, { id: '#FFC800', name: '노랑' },
    { id: '#FF9600', name: '주황' }, { id: '#FF4B4B', name: '빨강' }, { id: '#CE82FF', name: '보라' }, { id: '#FF86D0', name: '분홍' }, { id: '#2B70C9', name: '파랑' }
  ];
  const isDuo = () => prefs.skin === 'duo' || (prefs.skin === 'auto' && document.documentElement.hasAttribute('data-duo'));
  function applyDesign() {
    const root = document.documentElement, duo = isDuo();
    root.classList.toggle('nt-duo', duo);
    const a = prefs.accent !== 'auto' ? prefs.accent : duo ? '#58CC02' : '';
    if (a) {
      root.style.setProperty('--nt-accent', a);
      root.style.setProperty('--nt-accent-soft', a + '29');
    } else { root.style.removeProperty('--nt-accent'); root.style.removeProperty('--nt-accent-soft'); }
  }
  function designMenu(anchor) {
    const box = h('div', { class: 'nt-design' }, h('strong', { text: '디자인' }));
    const skins = h('div', { class: 'nt-seg' });
    SKINS.forEach(k => skins.append(h('button', { type: 'button', 'aria-pressed': String(prefs.skin === k.id), onclick: () => { prefs.skin = k.id; savePrefs(); applyDesign(); designMenu(anchor); }, text: k.name })));
    const acc = h('div', { class: 'nt-accents' });
    ACCENTS.forEach(a => acc.append(h('button', { type: 'button', class: 'nt-accent' + (a.id === 'auto' ? ' is-auto' : ''), style: { '--c': a.id }, title: a.name, 'aria-label': '강조색 ' + a.name, 'aria-pressed': String(prefs.accent === a.id), onclick: () => { prefs.accent = a.id; savePrefs(); applyDesign(); designMenu(anchor); } })));
    const pick = h('input', { type: 'color', class: 'nt-colorpick', 'aria-label': '강조색 직접 고르기', value: prefs.accent === 'auto' ? '#58cc02' : prefs.accent });
    pick.addEventListener('input', () => { prefs.accent = pick.value; savePrefs(); applyDesign(); });
    acc.append(pick);
    box.append(h('div', { class: 'nt-group' }, h('span', { text: '모양' }), skins),
      h('div', { class: 'nt-group' }, h('span', { text: '강조색' }), acc),
      h('div', { class: 'nt-group' }, h('span', { text: '내 펜 팔레트' }), paletteEditor('pen')),
      h('div', { class: 'nt-group' }, h('span', { text: '내 형광펜 팔레트' }), paletteEditor('hl')),
      h('p', { class: 'nt-hint', text: '‘사이트 따라가기’는 홈에서 듀오링고 모드를 켜면 함께 바뀌어요. 팔레트 색은 도구 막대에 바로 나와요.' }));
    popover(anchor, box);
  }
  // 내 팔레트: 색 추가·삭제 (펜·형광펜 따로, 최대 12색)
  function paletteEditor(t) {
    const row = h('div', { class: 'nt-colors' });
    const draw = () => {
      row.innerHTML = '';
      prefs.custom[t].forEach((c, i) => row.append(h('span', { class: 'nt-custom' },
        h('button', { type: 'button', class: 'nt-dot', style: { '--c': c }, 'aria-label': '색 ' + c + ' 쓰기', 'aria-pressed': String(prefs[t].c.toLowerCase() === c), onclick: () => { prefs[t].c = c; savePrefs(); refreshTools(); draw(); } }),
        h('button', { type: 'button', class: 'nt-x', 'aria-label': c + ' 팔레트에서 빼기', text: '×', onclick: () => { prefs.custom[t].splice(i, 1); savePrefs(); refreshTools(); draw(); } }))));
      if (prefs.custom[t].length < 12) {
        const inp = h('input', { type: 'color', hidden: true, value: prefs[t].c });
        inp.addEventListener('change', () => { const c = inp.value.toLowerCase(); if (!prefs.custom[t].includes(c)) prefs.custom[t].push(c); prefs[t].c = c; savePrefs(); refreshTools(); draw(); });
        row.append(h('label', { class: 'nt-addcolor' }, '＋ 색 추가', inp));
      }
    };
    draw();
    return row;
  }

  /* ══ 그리기 ══ */
  const imgCache = new Map();
  function getImg(src, onload) {
    let e = imgCache.get(src);
    if (!e) {
      const im = new Image();
      e = { im, ok: false, waiters: new Set() };
      im.onload = () => { e.ok = true; e.waiters.forEach(f => f()); e.waiters.clear(); };
      im.onerror = () => { e.waiters.clear(); };
      im.src = src;
      imgCache.set(src, e);
    }
    if (!e.ok && onload) e.waiters.add(onload);
    return e.ok ? e.im : null;
  }
  function preload(srcs) {
    return Promise.all(srcs.map(src => new Promise(res => { if (getImg(src, res)) res(); setTimeout(res, 8000); })));
  }
  const pageSrcs = page => [page.bg, ...page.items.filter(it => it.t === 'i').map(it => it.src)].filter(Boolean);

  function drawTemplate(ctx, page) {
    const W = page.w, H = page.h, dark = page.paper === 'dark';
    const line = dark ? 'rgba(255,255,255,0.14)' : 'rgba(70,110,180,0.25)';
    const accent = dark ? 'rgba(248,113,113,0.4)' : 'rgba(220,38,38,0.38)';
    const label = dark ? 'rgba(255,255,255,0.4)' : 'rgba(60,70,90,0.5)';
    ctx.lineWidth = 1;
    const hline = (y, x0, x1, c) => { ctx.strokeStyle = c || line; ctx.beginPath(); ctx.moveTo(x0 == null ? 0 : x0, y); ctx.lineTo(x1 == null ? W : x1, y); ctx.stroke(); };
    const vline = (x, y0, y1, c) => { ctx.strokeStyle = c || line; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); };
    switch (page.tpl) {
      case 'lined':
        for (let y = 100; y < H - 40; y += 34) hline(y);
        vline(88, 0, H, accent);
        break;
      case 'grid':
        ctx.lineWidth = 0.8;
        for (let x = 26; x < W; x += 26) vline(x, 0, H);
        for (let y = 26; y < H; y += 26) hline(y);
        break;
      case 'dot':
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.28)' : 'rgba(70,90,130,0.38)';
        for (let x = 26; x < W; x += 26) for (let y = 26; y < H; y += 26) { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill(); }
        break;
      case 'cornell': {
        const cue = Math.round(W * 0.28), sum = Math.round(H * 0.8);
        hline(90, 0, W, accent);
        for (let y = 124; y < sum; y += 34) hline(y, cue, W);
        vline(cue, 90, sum, accent);
        ctx.lineWidth = 2; hline(sum, 0, W, accent); ctx.lineWidth = 1;
        ctx.fillStyle = label; ctx.font = '600 13px ' + FONT; ctx.textBaseline = 'top';
        ctx.fillText('핵심어 · 질문', 20, 100); ctx.fillText('필기', cue + 16, 100); ctx.fillText('요약', 20, sum + 12);
        break;
      }
      case 'wrong': {
        const m = 36, top = 92;
        const box = (y0, y1, name) => {
          ctx.strokeStyle = line; ctx.lineWidth = 1.2;
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(m, y0, W - m * 2, y1 - y0, 10); else ctx.rect(m, y0, W - m * 2, y1 - y0); ctx.stroke();
          ctx.fillStyle = label; ctx.font = '600 14px ' + FONT; ctx.fillText(name, m + 14, y0 + 12);
        };
        ctx.fillStyle = label; ctx.font = '600 14px ' + FONT; ctx.textBaseline = 'top';
        const cols = ['날짜', '과목', '출처·번호'];
        cols.forEach((t, i) => { const x = m + i * (W - m * 2) / 3; ctx.fillText(t, x, 40); hline(66, x + 70, x + (W - m * 2) / 3 - 16); });
        const a = top + (H - top) * 0.36, b = top + (H - top) * 0.68;
        box(top, a - 12, '문제');
        box(a, b - 12, '내 풀이 (틀린 이유)');
        box(b, H - 36, '정답 · 핵심 개념');
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.18)' : 'rgba(70,90,130,0.25)';
        for (let x = m + 26; x < W - m; x += 26) for (let y = a + 44; y < b - 20; y += 26) { ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      default: break;
    }
  }

  function penRadius(it) {
    const w = it.w;
    if (it.k === 'ball') return p => w * (0.82 + 0.3 * p) / 2;
    if (it.k === 'brush') return p => w * (0.12 + 1.9 * p * p) / 2;
    return p => w * (0.32 + 1.0 * p) / 2;
  }
  function traceSmooth(ctx, a, move) {
    const m = a.length / 2;
    if (move) ctx.moveTo(a[0], a[1]); else ctx.lineTo(a[0], a[1]);
    for (let i = 1; i < m - 1; i++) ctx.quadraticCurveTo(a[i * 2], a[i * 2 + 1], (a[i * 2] + a[i * 2 + 2]) / 2, (a[i * 2 + 1] + a[i * 2 + 3]) / 2);
    if (m > 1) ctx.lineTo(a[(m - 1) * 2], a[(m - 1) * 2 + 1]);
  }
  function drawStroke(ctx, it, dark) {
    const p = it.p, n = p.length / 3;
    if (!n) return;
    if (it.tool === 'hl') {
      ctx.save();
      if (dark) { ctx.globalAlpha = 0.38; } else { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.85; }
      ctx.strokeStyle = it.c; ctx.lineWidth = it.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      const a = []; for (let i = 0; i < n; i++) a.push(p[i * 3], p[i * 3 + 1]);
      if (n === 1) a.push(p[0] + 0.1, p[1]);
      traceSmooth(ctx, a, true);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const rf = penRadius(it);
    ctx.fillStyle = it.c;
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) raw[i] = rf(p[i * 3 + 2]);
    const r = new Float32Array(n);
    for (let i = 0; i < n; i++) r[i] = (raw[Math.max(0, i - 1)] + raw[i] * 2 + raw[Math.min(n - 1, i + 1)]) / 4;
    if (n === 1) { ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(r[0], 0.5), 0, Math.PI * 2); ctx.fill(); return; }
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let dx = p[b * 3] - p[a * 3], dy = p[b * 3 + 1] - p[a * 3 + 1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, x = p[i * 3], y = p[i * 3 + 1];
      L.push(x + nx * r[i], y + ny * r[i]); R.push(x - nx * r[i], y - ny * r[i]);
    }
    const Rr = []; for (let i = R.length - 2; i >= 0; i -= 2) Rr.push(R[i], R[i + 1]);
    ctx.beginPath();
    traceSmooth(ctx, L, true);
    traceSmooth(ctx, Rr, false);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); ctx.arc(p[0], p[1], r[0], 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p[(n - 1) * 3], p[(n - 1) * 3 + 1], r[n - 1], 0, Math.PI * 2); ctx.fill();
  }
  const measureCtx = document.createElement('canvas').getContext('2d');
  function wrapText(ctx, text, w) {
    const out = [];
    text.split('\n').forEach(para => {
      let line = '';
      for (const ch of Array.from(para)) {
        if (line && ctx.measureText(line + ch).width > w) { out.push(line); line = ch === ' ' ? '' : ch; } else line += ch;
      }
      out.push(line);
    });
    return out;
  }
  function textLines(it) { measureCtx.font = it.s + 'px ' + FONT; return wrapText(measureCtx, it.v, it.w); }
  function drawText(ctx, it) {
    ctx.font = it.s + 'px ' + FONT; ctx.fillStyle = it.c; ctx.textBaseline = 'top';
    wrapText(ctx, it.v, it.w).forEach((l, i) => ctx.fillText(l, it.x, it.y + i * it.s * 1.45 + it.s * 0.12));
  }
  function renderPage(ctx, page, scale, onLate, skipId) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = (PAPERS[page.paper] || PAPERS.white).c;
    ctx.fillRect(0, 0, page.w, page.h);
    if (page.bg) { const im = getImg(page.bg, onLate); if (im) ctx.drawImage(im, 0, 0, page.w, page.h); }
    else drawTemplate(ctx, page);
    const dark = page.paper === 'dark';
    const items = page.items;
    for (const it of items) if (it.t === 'i' && it.i !== skipId) { const im = getImg(it.src, onLate); if (im) ctx.drawImage(im, it.x, it.y, it.w, it.h); }
    for (const it of items) if (it.t === 's' && it.tool === 'hl' && it.i !== skipId) drawStroke(ctx, it, dark);
    for (const it of items) if (it.t === 's' && it.tool !== 'hl' && it.i !== skipId) drawStroke(ctx, it, dark);
    for (const it of items) if (it.t === 'x' && it.i !== skipId) drawText(ctx, it);
  }

  /* ══ 항목 계산 ══ */
  const bboxCache = new WeakMap();
  function bbox(it) {
    let b = bboxCache.get(it);
    if (b) return b;
    if (it.t === 's') {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < it.p.length; i += 3) { const x = it.p[i], y = it.p[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const m = it.w;
      b = { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m };
    } else if (it.t === 'x') {
      const n = textLines(it).length;
      b = { x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + n * it.s * 1.45 };
    } else b = { x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + it.h };
    bboxCache.set(it, b);
    return b;
  }
  function unionBox(items) {
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    items.forEach(it => { const c = bbox(it); b.x0 = Math.min(b.x0, c.x0); b.y0 = Math.min(b.y0, c.y0); b.x1 = Math.max(b.x1, c.x1); b.y1 = Math.max(b.y1, c.y1); });
    return b;
  }
  function transformItem(it, f) { // f: {ox,oy,s,dx,dy} → x' = ox + (x-ox)*s + dx
    const T = (x, ox) => ox + (x - ox) * f.s;
    if (it.t === 's') {
      const p = new Array(it.p.length);
      for (let i = 0; i < p.length; i += 3) { p[i] = r1(T(it.p[i], f.ox) + f.dx); p[i + 1] = r1(T(it.p[i + 1], f.oy) + f.dy); p[i + 2] = it.p[i + 2]; }
      return { ...it, p, w: f.s === 1 ? it.w : r1(Math.max(0.6, it.w * f.s)) };
    }
    const n = { ...it, x: r1(T(it.x, f.ox) + f.dx), y: r1(T(it.y, f.oy) + f.dy), w: r1(it.w * f.s) };
    if (it.t === 'x') n.s = r1(Math.max(6, it.s * f.s));
    if (it.t === 'i') n.h = r1(it.h * f.s);
    return n;
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function strokeHit(it, x, y, rad) {
    const b = bbox(it);
    if (x < b.x0 - rad || x > b.x1 + rad || y < b.y0 - rad || y > b.y1 + rad) return false;
    const p = it.p, rr = rad + it.w / 2;
    if (p.length === 3) return Math.hypot(p[0] - x, p[1] - y) <= rr;
    for (let i = 0; i + 3 < p.length; i += 3) if (segDist(x, y, p[i], p[i + 1], p[i + 3], p[i + 4]) <= rr) return true;
    return false;
  }
  function itemAt(page, x, y) {
    for (let k = page.items.length - 1; k >= 0; k--) {
      const it = page.items[k];
      if (it.t === 's' ? strokeHit(it, x, y, 6) : (() => { const b = bbox(it); return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; })()) return it;
    }
    return null;
  }
  function inPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
      const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }
  // 부분 지우개: 지우개 원 안의 점을 빼고 획을 여러 조각으로 나눈다
  function eraseSplit(it, x, y, rad) {
    if (!strokeHit(it, x, y, rad)) return null;
    // 긴 선분은 잘게 나눠서 원이 선 가운데를 지나도 잘리게
    const src = it.p, p = [];
    const step = Math.max(1.5, rad / 2);
    for (let i = 0; i < src.length; i += 3) {
      if (i) {
        const ax = src[i - 3], ay = src[i - 2], bx = src[i], by = src[i + 1], d = Math.hypot(bx - ax, by - ay);
        const k = Math.floor(d / step);
        for (let j = 1; j < k; j++) { const t = j / k; p.push(ax + (bx - ax) * t, ay + (by - ay) * t, src[i - 1] + (src[i + 2] - src[i - 1]) * t); }
      }
      p.push(src[i], src[i + 1], src[i + 2]);
    }
    const rr = rad + it.w / 2, parts = [];
    let cur = [];
    for (let i = 0; i < p.length; i += 3) {
      if (Math.hypot(p[i] - x, p[i + 1] - y) <= rr) { if (cur.length) parts.push(cur); cur = []; }
      else cur.push(r1(p[i]), r1(p[i + 1]), p[i + 2]);
    }
    if (cur.length) parts.push(cur);
    return parts.filter(q => q.length >= 6).map(q => ({ ...it, i: uid(), p: q }));
  }

  /* ══ 도형 인식 (그리고 멈추면) ══ */
  function rdp(pts, eps) { // pts: [[x,y]...]
    if (pts.length < 3) return pts.slice();
    let idx = 0, md = 0;
    const a = pts[0], b = pts[pts.length - 1];
    for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i][0], pts[i][1], a[0], a[1], b[0], b[1]); if (d > md) { md = d; idx = i; } }
    if (md <= eps) return [a, b];
    return rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps));
  }
  function densify(corners, closed, pr) {
    const out = [], cs = closed ? corners.concat([corners[0]]) : corners;
    for (let i = 0; i < cs.length - 1; i++) {
      const [ax, ay] = cs[i], [bx, by] = cs[i + 1], k = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
      for (let j = 0; j < k; j++) { const t = j / k; out.push(r1(ax + (bx - ax) * t), r1(ay + (by - ay) * t), pr); }
    }
    const last = cs[cs.length - 1]; out.push(r1(last[0]), r1(last[1]), pr);
    return out;
  }
  function recognize(flat, lineOnly) {
    const n = flat.length / 3;
    if (n < 4) return null;
    const pts = []; let L = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = flat[i * 3], y = flat[i * 3 + 1]; pts.push([x, y]);
      if (i) L += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const bw = x1 - x0, bh = y1 - y0, D = Math.hypot(bw, bh);
    if (D < 14) return null;
    const s = pts[0], e = pts[n - 1], d = Math.hypot(e[0] - s[0], e[1] - s[1]);
    const pr = 0.55;
    if (lineOnly || d / L > 0.9) {
      // 수평·수직에 가까우면 반듯하게
      let ex = e[0], ey = e[1];
      const ang = Math.abs(Math.atan2(ey - s[1], ex - s[0]) * 180 / Math.PI);
      if (ang < 6 || ang > 174) ey = s[1]; else if (Math.abs(ang - 90) < 6) ex = s[0];
      return { name: '직선', p: densify([s, [ex, ey]], false, pr) };
    }
    if (d > 0.3 * D) return null;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = bw / 2, ry = bh / 2;
    if (rx < 5 || ry < 5) return null;
    let err = 0;
    pts.forEach(([x, y]) => { err += Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1); });
    err /= n;
    const ellipse = () => {
      let rxx = rx, ryy = ry;
      if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.12) rxx = ryy = (rx + ry) / 2;
      const c = []; for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2; c.push([cx + Math.cos(a) * rxx, cy + Math.sin(a) * ryy]); }
      return { name: rxx === ryy ? '원' : '타원', p: densify(c, true, pr) };
    };
    if (err < 0.08) return ellipse();
    let poly = rdp(pts, 0.06 * D);
    if (poly.length > 1 && Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]) < 0.2 * D) poly.pop();
    // 거의 일직선인 꼭짓점 빼기
    let changed = true;
    while (changed && poly.length > 3) {
      changed = false;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[(i - 1 + poly.length) % poly.length], b = poly[i], c = poly[(i + 1) % poly.length];
        if (segDist(b[0], b[1], a[0], a[1], c[0], c[1]) < 0.07 * D) { poly.splice(i, 1); changed = true; break; }
      }
    }
    if (poly.length === 3) return { name: '삼각형', p: densify(poly, true, pr) };
    if (poly.length === 4) {
      const axis = poly.every((q, i) => {
        const r = poly[(i + 1) % 4], a = Math.abs(Math.atan2(r[1] - q[1], r[0] - q[0]) * 180 / Math.PI) % 90;
        return a < 14 || a > 76;
      });
      if (axis) return { name: '사각형', p: densify([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true, pr) };
      return { name: '사각형', p: densify(poly, true, pr) };
    }
    if (err < 0.17) return ellipse();
    if (poly.length <= 8) return { name: '다각형', p: densify(poly, true, pr) };
    return null;
  }

  /* ══ 노트 만들기 ══ */
  function newPage(o) {
    const [w, h] = SIZES[o.orient || 'p'];
    return { id: uid(), w: o.w || w, h: o.h || h, tpl: o.tpl || 'blank', paper: o.paper || 'white', bg: o.bg || null, items: [] };
  }
  function newNotebook(o) {
    const now = Date.now();
    return {
      id: uid(), title: o.title || '제목 없는 노트', subject: o.subject || '', cover: o.cover || COVERS[0],
      created: now, updated: now, pages: o.pages || [newPage(o)]
    };
  }
  const subjects = () => (S.SUBJECTS || []).map(s => ({ id: s.id, name: s.name, color: s.color }));
  const subjectName = id => { const s = subjects().find(x => x.id === id); return s ? s.name : ''; };

  /* ══ 외부 라이브러리 (필요할 때만) ══ */
  const scripts = {};
  function loadScript(src) {
    if (!scripts[src]) scripts[src] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete scripts[src]; rej(new Error('load')); };
      document.head.append(s);
    });
    return scripts[src];
  }
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

  const busyEl = $('#nt-busy'), busyText = $('#nt-busy-text');
  function busy(text) { if (text) { busyText.textContent = text; busyEl.hidden = false; } else busyEl.hidden = true; }

  async function pdfToPages(file) {
    busy('PDF 준비 중…');
    await loadScript(PDFJS);
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    const total = Math.min(pdf.numPages, 300), pages = [];
    for (let i = 1; i <= total; i++) {
      busy('PDF 쪽 불러오는 중… ' + i + ' / ' + total);
      const pg = await pdf.getPage(i);
      const v1 = pg.getViewport({ scale: 1 });
      const W = v1.width > v1.height ? 1160 : 820, H = Math.round(W * v1.height / v1.width);
      const scale = Math.min(1600 / v1.width, 2400 / v1.height);
      const vp = pg.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      pages.push(newPage({ w: W, h: H, bg: c.toDataURL('image/jpeg', 0.85) }));
      c.width = c.height = 1;
    }
    return pages;
  }
  async function exportPdf(nb) {
    busy('PDF 만드는 중…');
    try {
      await loadScript(JSPDF);
      const { jsPDF } = window.jspdf;
      let doc = null;
      for (let i = 0; i < nb.pages.length; i++) {
        busy('PDF 만드는 중… ' + (i + 1) + ' / ' + nb.pages.length);
        const page = nb.pages[i];
        await preload(pageSrcs(page));
        const c = document.createElement('canvas'), sc = 2;
        c.width = page.w * sc; c.height = page.h * sc;
        renderPage(c.getContext('2d'), page, sc);
        const wpt = page.w * 0.75, hpt = page.h * 0.75, o = wpt > hpt ? 'l' : 'p';
        if (!doc) doc = new jsPDF({ orientation: o, unit: 'pt', format: [wpt, hpt], compress: true });
        else doc.addPage([wpt, hpt], o);
        doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, wpt, hpt);
        c.width = c.height = 1;
      }
      doc.save(safeName(nb.title) + '.pdf');
    } catch (e) {
      alert('PDF를 만들지 못했어요. 인터넷 연결을 확인해 주세요.');
    } finally { busy(false); }
  }
  async function exportPng(nb, page) {
    await preload(pageSrcs(page));
    const c = document.createElement('canvas'), sc = 2;
    c.width = page.w * sc; c.height = page.h * sc;
    renderPage(c.getContext('2d'), page, sc);
    c.toBlob(b => download(b, safeName(nb.title) + '_' + (nb.pages.indexOf(page) + 1) + '쪽.png'), 'image/png');
  }
  const safeName = s => (s || '노트').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
  function download(blob, name) {
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function exportBackup(nb) {
    const blob = new Blob([JSON.stringify({ format: 'simpul-note', version: 1, notebook: nb })], { type: 'application/json' });
    download(blob, safeName(nb.title) + '.simpulnote.json');
  }
  function readImageFile(file, maxSide) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const k = Math.min(1, maxSide / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const png = /png|gif|webp/.test(file.type);
        res({ src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88), w: c.width, h: c.height });
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
      im.src = url;
    });
  }

  /* ══ 작은 팝오버 메뉴 ══ */
  let openPop = null;
  function closePop() { if (openPop) { openPop.remove(); openPop = null; } }
  function popover(anchor, content, cls) {
    closePop();
    const pop = h('div', { class: 'nt-pop ' + (cls || ''), role: 'dialog' }, content);
    document.body.append(pop);
    const r = anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = clamp(r.left + r.width / 2 - pw / 2, 8, innerWidth - pw - 8);
    let top = r.bottom + 8;
    if (top + ph > innerHeight - 8) top = Math.max(8, r.top - ph - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    openPop = pop;
    return pop;
  }
  document.addEventListener('pointerdown', e => { if (openPop && !openPop.contains(e.target) && !e.target.closest('[data-pop]')) closePop(); }, true);
  const menuItem = (label, fn, opt) => h('button', { type: 'button', class: 'nt-menu-item' + (opt && opt.danger ? ' is-danger' : ''), onclick: () => { closePop(); fn(); }, html: label });

  /* ══════════════ 서재 ══════════════ */
  const lib = { filter: '', q: '' };
  const grid = $('#nt-grid'), statusEl = $('#nt-status');

  async function showLibrary() {
    $('#nt-editor').hidden = true;
    $('#nt-library').hidden = false;
    $('#nt-footer').hidden = false;
    document.body.classList.remove('nt-editing');
    document.title = '필기 · 심풀스터디';
    const list = (await DB.all()).sort((a, b) => b.updated - a.updated);
    renderChips(list);
    const q = lib.q.trim().toLowerCase();
    const shown = list.filter(nb => (!lib.filter || nb.subject === lib.filter) && (!q || nb.title.toLowerCase().includes(q)));
    grid.innerHTML = '';
    statusEl.textContent = DB.memOnly ? '이 브라우저는 저장소가 막혀 있어서 이 탭을 닫으면 노트가 사라져요. 백업 저장을 꼭 해 주세요.' : '';
    if (!list.length) {
      grid.append(h('div', { class: 'nt-empty' },
        h('div', { class: 'nt-empty-art', html: svg('pen', 36) }),
        h('h2', { text: '첫 노트를 만들어 보세요' }),
        h('p', { text: '수업 필기, 오답노트, 학습지 PDF 위에 바로 쓰기까지. 아이패드라면 애플펜슬로, 컴퓨터라면 마우스나 펜 태블릿으로 쓸 수 있어요.' }),
        h('div', { class: 'toolbar' },
          h('button', { class: 'btn btn-primary', type: 'button', onclick: openNewDialog, text: '＋ 새 노트' }),
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => quickCreate('wrong'), text: '오답노트로 시작' }))));
      return;
    }
    if (!shown.length) { statusEl.textContent = '조건에 맞는 노트가 없어요.'; return; }
    shown.forEach(nb => grid.append(card(nb)));
  }
  function renderChips(list) {
    const box = $('#nt-chips'); box.innerHTML = '';
    const used = new Set(list.map(n => n.subject).filter(Boolean));
    if (!used.size) return;
    const chip = (id, name) => h('button', { type: 'button', class: 'nt-chip', 'aria-pressed': String(lib.filter === id), onclick: () => { lib.filter = id; showLibrary(); }, text: name });
    box.append(chip('', '전체'));
    subjects().filter(s => used.has(s.id)).forEach(s => box.append(chip(s.id, s.name)));
  }
  function card(nb) {
    const page = nb.pages[0];
    const cv = h('canvas', { class: 'nt-card-cv' });
    const W = 220, sc = W / page.w, dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(page.w * sc * dpr); cv.height = Math.round(page.h * sc * dpr);
    const draw = () => renderPage(cv.getContext('2d'), page, sc * dpr, draw);
    draw();
    const menuBtn = h('button', { type: 'button', class: 'nt-card-menu', 'aria-label': nb.title + ' 메뉴', 'data-pop': '', html: svg('more') });
    menuBtn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      popover(menuBtn, h('div', { class: 'nt-menu' },
        menuItem('이름 바꾸기', async () => { const t = prompt('새 이름', nb.title); if (t && t.trim()) { nb.title = t.trim().slice(0, 60); nb.updated = Date.now(); await DB.put(nb); showLibrary(); } }),
        menuItem('복제', async () => { const c = JSON.parse(JSON.stringify(nb)); c.id = uid(); c.title = nb.title + ' 사본'; c.created = c.updated = Date.now(); c.pages.forEach(p => { p.id = uid(); }); await DB.put(c); showLibrary(); }),
        menuItem('PDF로 내보내기', () => exportPdf(nb)),
        menuItem('백업 저장 (.json)', () => exportBackup(nb)),
        menuItem('삭제', async () => { if (confirm('‘' + nb.title + '’ 노트를 지울까요? 되돌릴 수 없어요.')) { await DB.del(nb.id); showLibrary(); } }, { danger: true })));
    });
    const sub = subjectName(nb.subject);
    const date = new Date(nb.updated);
    return h('a', { class: 'nt-card', href: '#nb=' + nb.id, style: { '--cover': nb.cover } },
      h('div', { class: 'nt-card-cover' }, cv),
      h('div', { class: 'nt-card-info' },
        h('strong', { text: nb.title }),
        h('span', { text: [sub, nb.pages.length + '쪽', (date.getMonth() + 1) + '월 ' + date.getDate() + '일'].filter(Boolean).join(' · ') })),
      menuBtn);
  }

  // 새 노트 대화상자
  const dlg = $('#nt-new'), form = $('#nt-new-form');
  const newState = { cover: COVERS[0], tpl: 'lined', paper: 'white', orient: 'p' };
  function seg(box, opts, key) {
    box.innerHTML = '';
    opts.forEach(o => box.append(h('button', { type: 'button', 'aria-pressed': String(newState[key] === o.id), onclick: () => { newState[key] = o.id; buildDialog(); }, text: o.name })));
  }
  function buildDialog() {
    const covers = $('#nt-new-covers'); covers.innerHTML = '';
    COVERS.forEach(c => covers.append(h('button', { type: 'button', class: 'nt-swatch', style: { background: c }, 'aria-label': '표지 색 ' + c, 'aria-pressed': String(newState.cover === c), onclick: () => { newState.cover = c; buildDialog(); } })));
    const tpls = $('#nt-new-tpls'); tpls.innerHTML = '';
    TEMPLATES.forEach(t => {
      const [w, hh] = SIZES[newState.orient];
      const cv = h('canvas'); const sc = 84 / w, dpr = 2;
      cv.width = Math.round(w * sc * dpr); cv.height = Math.round(hh * sc * dpr);
      renderPage(cv.getContext('2d'), { w, h: hh, tpl: t.id, paper: newState.paper, items: [] }, sc * dpr);
      tpls.append(h('button', { type: 'button', class: 'nt-tpl', 'aria-pressed': String(newState.tpl === t.id), onclick: () => { newState.tpl = t.id; buildDialog(); } }, cv, h('span', { text: t.name })));
    });
    seg($('#nt-new-paper'), Object.keys(PAPERS).map(k => ({ id: k, name: PAPERS[k].name })), 'paper');
    seg($('#nt-new-orient'), [{ id: 'p', name: '세로' }, { id: 'l', name: '가로' }], 'orient');
  }
  function openNewDialog() {
    const sel = $('#nt-new-subject'); sel.innerHTML = '';
    sel.append(h('option', { value: '', text: '과목 없음' }));
    subjects().forEach(s => sel.append(h('option', { value: s.id, text: s.name })));
    if (lib.filter) sel.value = lib.filter;
    form.title.value = '';
    buildDialog();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(() => form.title.focus(), 30);
  }
  $('#nt-new-cancel').addEventListener('click', () => dlg.close());
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const sub = form.subject.value;
    const s = subjects().find(x => x.id === sub);
    const nb = newNotebook({ title: form.title.value.trim(), subject: sub, cover: newState.cover, tpl: newState.tpl, paper: newState.paper, orient: newState.orient });
    if (s && newState.cover === COVERS[0] && s.color) nb.cover = s.color;
    await DB.put(nb);
    dlg.close();
    location.hash = '#nb=' + nb.id;
  });
  async function quickCreate(tpl) {
    const nb = newNotebook({ title: tpl === 'wrong' ? '오답노트' : '새 노트', tpl, cover: COVERS[4] });
    await DB.put(nb);
    location.hash = '#nb=' + nb.id;
  }
  $('#nt-new-btn').addEventListener('click', openNewDialog);
  $('#nt-design-btn').addEventListener('click', e => designMenu(e.currentTarget));
  $('#nt-search').addEventListener('input', e => { lib.q = e.target.value; showLibrary(); });
  $('#nt-pdf-in').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const pages = await pdfToPages(f);
      const nb = newNotebook({ title: f.name.replace(/\.pdf$/i, '').slice(0, 60), pages, cover: COVERS[6] });
      busy('저장하는 중…');
      await DB.put(nb);
      busy(false);
      location.hash = '#nb=' + nb.id;
    } catch (err) {
      busy(false);
      alert(err && err.name === 'QuotaExceededError' ? '저장 공간이 모자라요. 안 쓰는 노트를 지워 주세요.' : 'PDF를 열지 못했어요. 인터넷 연결이나 파일을 확인해 주세요.');
    }
  });
  $('#nt-json-in').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const nb = data && data.format === 'simpul-note' ? data.notebook : null;
      if (!nb || !Array.isArray(nb.pages) || !nb.pages.length) throw new Error('format');
      nb.id = uid(); nb.updated = Date.now();
      nb.pages.forEach(p => { p.id = p.id || uid(); p.items = Array.isArray(p.items) ? p.items : []; p.items.forEach(it => { it.i = it.i || uid(); }); });
      await DB.put(nb);
      showLibrary();
    } catch (err) { alert('심풀스터디 필기 백업 파일이 아니에요.'); }
  });

  /* ══════════════ 편집 ══════════════ */
  const vp = $('#nt-viewport'), stack = $('#nt-stack'), thumbsEl = $('#nt-thumbs'), topbar = $('#nt-topbar'), pageInd = $('#nt-pageind');
  const E = {
    nb: null, zoom: 1, undo: [], redo: [], sel: null, clip: null,
    els: new Map(), visible: new Set(), dirty: new Set(), thumbDirty: new Set(), raf: 0,
    current: 0, active: null, textEd: null, live: null, touches: new Map(), pinch: null, pan: null, laser: []
  };
  const dpr = () => Math.min(3, devicePixelRatio || 1);
  const pageById = id => E.nb.pages.find(p => p.id === id);

  async function openNotebook(id) {
    const nb = await DB.get(id);
    if (!nb) { location.hash = ''; return; }
    if (E.nb && E.nb.id !== id) await flushSave();
    E.nb = nb; E.undo = []; E.redo = []; E.sel = null; E.current = 0;
    $('#nt-library').hidden = true;
    $('#nt-footer').hidden = true;
    $('#nt-editor').hidden = false;
    document.body.classList.add('nt-editing');
    document.title = nb.title + ' · 필기 · 심풀스터디';
    setHeaderVar();
    buildTopbar();
    const maxW = Math.max(...nb.pages.map(p => p.w));
    E.zoom = clamp(Math.min(1.25, (vp.clientWidth - (innerWidth < 700 ? 20 : 64)) / maxW), 0.3, 4);
    buildPages();
    buildThumbs();
    vp.scrollTop = 0;
    updateCurrent();
  }
  function setHeaderVar() {
    const hd = $('.site-header');
    document.documentElement.style.setProperty('--nt-hdr', (hd ? hd.offsetHeight : 56) + 'px');
  }
  addEventListener('resize', () => { if (E.nb) setHeaderVar(); });

  // 저장
  let saveT = 0, savePending = false;
  function touch() {
    E.nb.updated = Date.now();
    savePending = true;
    setSaveState('저장 중…');
    clearTimeout(saveT);
    saveT = setTimeout(flushSave, 700);
  }
  async function flushSave() {
    clearTimeout(saveT);
    if (!savePending || !E.nb) return;
    savePending = false;
    try { await DB.put(E.nb); setSaveState(DB.memOnly ? '임시 저장(백업 필요)' : '저장됨'); }
    catch (e) { setSaveState('저장 실패'); if (e && e.name === 'QuotaExceededError') alert('저장 공간이 모자라요. 안 쓰는 노트나 큰 PDF를 지워 주세요.'); }
  }
  function setSaveState(t) { const s = $('#nt-save'); if (s) s.textContent = t; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
  addEventListener('pagehide', flushSave);

  // 되돌리기
  function pushOp(op) {
    E.undo.push(op); if (E.undo.length > MAX_UNDO) E.undo.shift();
    E.redo = [];
    touch(); updateUndoBtns();
  }
  function setItems(page, items) { page.items = items; markDirty(page.id); }
  function itemsOp(page, before) { if (before !== page.items) pushOp({ k: 'items', pid: page.id, before, after: page.items }); }
  function applyOp(op, dir) {
    const v = dir < 0 ? op.before : op.after;
    if (op.k === 'items') { const pg = pageById(op.pid); if (pg) { setItems(pg, v); thumbDirty(pg.id); } }
    else if (op.k === 'pages') { E.nb.pages = v.slice(); buildPages(); buildThumbs(); }
    else if (op.k === 'props') { const pg = pageById(op.pid); if (pg) { Object.assign(pg, v); markDirty(pg.id); thumbDirty(pg.id); } }
  }
  function undo() { commitText(); const op = E.undo.pop(); if (!op) return; clearSel(); applyOp(op, -1); E.redo.push(op); touch(); updateUndoBtns(); }
  function redo() { commitText(); const op = E.redo.pop(); if (!op) return; clearSel(); applyOp(op, 1); E.undo.push(op); touch(); updateUndoBtns(); }
  function updateUndoBtns() { const u = $('#nt-undo'), r = $('#nt-redo'); if (u) u.disabled = !E.undo.length; if (r) r.disabled = !E.redo.length; }

  // 쪽 화면
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      const id = en.target.dataset.pid;
      if (en.isIntersecting) { E.visible.add(id); markDirty(id); }
      else {
        E.visible.delete(id);
        const rec = E.els.get(id); if (rec) { rec.cv.width = rec.cv.height = 1; rec.size = ''; }
        E.dirty.add(id);
      }
    });
  }, { root: vp, rootMargin: '900px 0px' });

  function buildPages() {
    commitText(); clearSel();
    io.disconnect();
    E.els.clear(); E.visible.clear(); E.dirty.clear();
    stack.innerHTML = '';
    E.nb.pages.forEach((page, i) => {
      const cv = h('canvas', { class: 'nt-cv' });
      const el = h('div', { class: 'nt-page', 'data-pid': page.id }, cv);
      const wrap = h('div', { class: 'nt-pagewrap' }, el, h('div', { class: 'nt-pagenum', text: (i + 1) + ' / ' + E.nb.pages.length }));
      stack.append(wrap);
      E.els.set(page.id, { el, cv, size: '' });
      io.observe(el);
    });
    stack.append(h('button', { type: 'button', class: 'nt-addpage', onclick: () => addPage(E.nb.pages.length - 1), html: svg('plus', 16) + ' 새 쪽 추가' }));
    sizePages();
  }
  function sizePages() {
    stack.style.setProperty('--z', E.zoom);
    E.nb.pages.forEach(p => { const r = E.els.get(p.id); if (r) { r.el.style.width = p.w * E.zoom + 'px'; r.el.style.height = p.h * E.zoom + 'px'; } });
    const z = $('#nt-zoomval'); if (z) z.textContent = Math.round(E.zoom * 100) + '%';
  }
  function markDirty(id) { E.dirty.add(id); schedule(); }
  function schedule() { if (!E.raf) E.raf = requestAnimationFrame(flushRender); }
  function flushRender() {
    E.raf = 0;
    E.dirty.forEach(id => { if (E.visible.has(id)) { renderEl(id); E.dirty.delete(id); } });
  }
  function canvasScale(page) { return Math.min(E.zoom * dpr(), 2800 / page.w, 4000 / page.h); }
  function renderEl(id) {
    const rec = E.els.get(id), page = pageById(id);
    if (!rec || !page) return;
    const sc = canvasScale(page), w = Math.round(page.w * sc), hh = Math.round(page.h * sc), key = w + 'x' + hh;
    if (rec.size !== key) { rec.cv.width = w; rec.cv.height = hh; rec.size = key; }
    renderPage(rec.cv.getContext('2d'), page, sc, () => markDirty(id), E.textEd && E.textEd.pid === id ? E.textEd.skip : null);
  }

  // 미리보기(왼쪽 쪽 목록)
  function buildThumbs() {
    thumbsEl.innerHTML = '';
    thumbsEl.hidden = !prefs.thumbs || innerWidth < 900;
    E.nb.pages.forEach((page, i) => {
      const cv = h('canvas');
      const b = h('button', { type: 'button', class: 'nt-thumb', 'data-pid': page.id, 'aria-label': (i + 1) + '쪽으로 가기', onclick: () => { goPage(i); if (innerWidth < 900) thumbsEl.hidden = true; } }, cv, h('span', { text: String(i + 1) }));
      thumbsEl.append(b);
      drawThumb(page, cv);
    });
    markThumb();
  }
  function drawThumb(page, cv) {
    const W = 104, sc = W / page.w * 2;
    cv.width = Math.round(page.w * sc); cv.height = Math.round(page.h * sc);
    const d = () => renderPage(cv.getContext('2d'), page, sc, d);
    d();
  }
  let thumbT = 0;
  function thumbDirty(id) {
    E.thumbDirty.add(id);
    clearTimeout(thumbT);
    thumbT = setTimeout(() => {
      E.thumbDirty.forEach(pid => { const b = thumbsEl.querySelector('[data-pid="' + pid + '"] canvas'); const p = pageById(pid); if (b && p) drawThumb(p, b); });
      E.thumbDirty.clear();
    }, 400);
  }
  function markThumb() {
    thumbsEl.querySelectorAll('.nt-thumb').forEach((b, i) => b.classList.toggle('is-current', i === E.current));
    const cur = thumbsEl.children[E.current];
    if (cur && !thumbsEl.hidden) { const r = cur.getBoundingClientRect(), pr = thumbsEl.getBoundingClientRect(); if (r.top < pr.top || r.bottom > pr.bottom) cur.scrollIntoView({ block: 'nearest' }); }
  }
  function goPage(i) {
    const p = E.nb.pages[i]; if (!p) return;
    const rec = E.els.get(p.id);
    vp.scrollTo({ top: rec.el.parentElement.offsetTop - 12, behavior: 'smooth' });
  }
  function updateCurrent() {
    if (!E.nb) return;
    const mid = vp.getBoundingClientRect().top + vp.clientHeight * 0.4;
    let cur = 0;
    E.nb.pages.forEach((p, i) => { const r = E.els.get(p.id).el.getBoundingClientRect(); if (r.top <= mid) cur = i; });
    if (cur !== E.current || !pageInd.textContent) {
      E.current = cur;
      markThumb();
    }
    pageInd.textContent = (E.current + 1) + ' / ' + E.nb.pages.length;
  }
  let scrollT = 0;
  vp.addEventListener('scroll', () => {
    pageInd.classList.add('is-on');
    clearTimeout(scrollT);
    scrollT = setTimeout(() => pageInd.classList.remove('is-on'), 900);
    updateCurrent();
  }, { passive: true });

  // 확대·축소
  let zoomT = 0;
  function setZoom(z, ax, ay) {
    commitText();
    z = clamp(z, 0.3, 4);
    if (Math.abs(z - E.zoom) < 0.001) return;
    const r = vp.getBoundingClientRect();
    if (ax == null) { ax = vp.clientWidth / 2; ay = vp.clientHeight / 2; } else { ax -= r.left; ay -= r.top; }
    const k = z / E.zoom, cx = vp.scrollLeft + ax, cy = vp.scrollTop + ay;
    E.zoom = z;
    sizePages();
    vp.scrollLeft = cx * k - ax;
    vp.scrollTop = cy * k - ay;
    if (E.sel) showSel();
    clearTimeout(zoomT);
    zoomT = setTimeout(() => { E.nb.pages.forEach(p => E.dirty.add(p.id)); schedule(); }, 140);
  }
  vp.addEventListener('wheel', e => {
    if (!E.nb || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(E.zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
  }, { passive: false });
  // 사파리 트랙패드 핀치
  let gz = 1;
  vp.addEventListener('gesturestart', e => { e.preventDefault(); gz = E.zoom; });
  vp.addEventListener('gesturechange', e => { e.preventDefault(); setZoom(gz * e.scale, e.clientX, e.clientY); });

  /* ── 위쪽 도구 막대 ── */
  function toolBtn(id, label, key) {
    return h('button', { type: 'button', class: 'nt-tool', id: 'nt-tool-' + id, 'aria-label': label + ' (' + key + ')', title: label + ' (' + key + ')', 'data-pop': '', 'aria-pressed': String(prefs.tool === id), onclick: e => onToolClick(id, e.currentTarget), html: svg(id) });
  }
  function iconBtn(icon, label, fn, extra) {
    return h('button', Object.assign({ type: 'button', class: 'nt-ibtn', 'aria-label': label, title: label, onclick: fn, html: svg(icon) }, extra || {}));
  }
  function buildTopbar() {
    topbar.innerHTML = '';
    const title = h('input', { class: 'nt-title', value: E.nb.title, 'aria-label': '노트 이름', maxlength: '60' });
    title.addEventListener('change', () => { E.nb.title = title.value.trim() || '제목 없는 노트'; title.value = E.nb.title; document.title = E.nb.title + ' · 필기 · 심풀스터디'; touch(); });
    title.addEventListener('keydown', e => { if (e.key === 'Enter') title.blur(); });
    const left = h('div', { class: 'nt-tb-left' },
      h('a', { class: 'nt-ibtn', href: '#', 'aria-label': '서재로', title: '서재로', html: svg('back') }),
      iconBtn('pages', '쪽 목록 보기', () => { thumbsEl.hidden = !thumbsEl.hidden; if (innerWidth >= 900) { prefs.thumbs = !thumbsEl.hidden; savePrefs(); } if (!thumbsEl.hidden) markThumb(); }),
      h('div', { class: 'nt-titlebox' }, title, h('span', { class: 'nt-save', id: 'nt-save', text: '저장됨' })));
    const tools = h('div', { class: 'nt-tools', role: 'toolbar', 'aria-label': '필기 도구' },
      toolBtn('pen', '펜', 'P'), toolBtn('hl', '형광펜', 'H'), toolBtn('eraser', '지우개', 'E'), toolBtn('lasso', '올가미', 'L'),
      toolBtn('text', '텍스트', 'T'),
      iconBtn('image', '그림 넣기', pickImage),
      toolBtn('laser', '레이저 포인터', 'K'),
      h('span', { class: 'nt-sep' }),
      h('div', { class: 'nt-quick', id: 'nt-quick' }));
    const right = h('div', { class: 'nt-tb-right' },
      iconBtn('undo', '되돌리기 (⌘Z)', undo, { id: 'nt-undo' }), iconBtn('redo', '다시 하기 (⇧⌘Z)', redo, { id: 'nt-redo' }),
      h('span', { class: 'nt-sep' }),
      iconBtn('minus', '축소', () => setZoom(E.zoom / 1.2)),
      h('button', { type: 'button', class: 'nt-zoomval', id: 'nt-zoomval', title: '폭에 맞추기', onclick: fitWidth }),
      iconBtn('plus', '확대', () => setZoom(E.zoom * 1.2)),
      h('span', { class: 'nt-sep' }),
      iconBtn('paste', '붙여넣기 (⌘V)', paste, { id: 'nt-paste', hidden: !E.clip }),
      iconBtn('page', '이 쪽 메뉴', e => pageMenu(e.currentTarget), { 'data-pop': '' }),
      iconBtn('palette', '디자인 · 팔레트', e => designMenu(e.currentTarget), { 'data-pop': '' }),
      iconBtn('more', '더 보기', e => moreMenu(e.currentTarget), { 'data-pop': '' }));
    topbar.append(left, tools, right);
    updateUndoBtns();
    refreshTools();
  }
  function fitWidth() {
    const maxW = Math.max(...E.nb.pages.map(p => p.w));
    setZoom((vp.clientWidth - (innerWidth < 700 ? 20 : 64)) / maxW);
  }
  function refreshTools() {
    ['pen', 'hl', 'eraser', 'lasso', 'text', 'laser'].forEach(t => { const b = $('#nt-tool-' + t); if (b) b.setAttribute('aria-pressed', String(prefs.tool === t)); });
    const pen = $('#nt-tool-pen'); if (pen) pen.style.setProperty('--ink', prefs.pen.c);
    const hl = $('#nt-tool-hl'); if (hl) hl.style.setProperty('--ink', prefs.hl.c);
    const tx = $('#nt-tool-text'); if (tx) tx.style.setProperty('--ink', prefs.text.c);
    // 빠른 색·굵기
    const q = $('#nt-quick'); if (!q) return;
    q.innerHTML = '';
    const t = prefs.tool;
    if (t === 'pen' || t === 'hl' || t === 'text') {
      const st = prefs[t], colors = t === 'hl' ? HL_COLORS : PEN_COLORS;
      const extra = t === 'text' ? prefs.custom.pen : prefs.custom[t];
      colors.slice(0, 5).concat(extra.filter(c => !colors.slice(0, 5).includes(c))).forEach(c => q.append(h('button', { type: 'button', class: 'nt-dot', style: { '--c': c }, 'aria-label': '색 ' + c, 'aria-pressed': String(st.c.toLowerCase() === c), onclick: () => { st.c = c; savePrefs(); refreshTools(); recolorTextEd(); } })));
      const sizes = SIZE_SET[t], key = t === 'text' ? 's' : 'w';
      q.append(h('span', { class: 'nt-sep' }));
      sizes.forEach((s, i) => q.append(h('button', { type: 'button', class: 'nt-size', 'aria-label': '굵기 ' + (i + 1), 'aria-pressed': String(st[key] === s), onclick: () => { st[key] = s; savePrefs(); refreshTools(); } }, h('i', { style: { width: (6 + i * 5) + 'px', height: (6 + i * 5) + 'px' } }))));
    } else if (t === 'eraser') {
      q.append(h('span', { class: 'nt-qlabel', text: prefs.eraser.mode === 'stroke' ? '획 지우개' : '부분 지우개' }));
      SIZE_SET.eraser.forEach((s, i) => q.append(h('button', { type: 'button', class: 'nt-size', 'aria-label': '크기 ' + (i + 1), 'aria-pressed': String(prefs.eraser.w === s), onclick: () => { prefs.eraser.w = s; savePrefs(); refreshTools(); } }, h('i', { style: { width: (6 + i * 5) + 'px', height: (6 + i * 5) + 'px' } }))));
    } else if (t === 'lasso') {
      q.append(h('span', { class: 'nt-qlabel', text: '둘러싸서 고르기 · 눌러서 하나 고르기' }));
    } else if (t === 'laser') {
      q.append(h('span', { class: 'nt-qlabel', text: '설명할 때 쓰는 빨간 점 (저장 안 됨)' }));
    }
    stack.dataset.tool = t;
  }
  function setTool(t) {
    closePop();
    if (t !== 'lasso') clearSel();
    if (t !== 'text') commitText();
    prefs.tool = t; savePrefs(); refreshTools();
  }
  function onToolClick(id, btn) {
    if (prefs.tool !== id) { setTool(id); return; }
    // 이미 고른 도구를 한 번 더 누르면 자세한 설정
    if (id === 'pen') toolSettings(btn, 'pen');
    else if (id === 'hl') toolSettings(btn, 'hl');
    else if (id === 'eraser') toolSettings(btn, 'eraser');
    else if (id === 'text') toolSettings(btn, 'text');
  }
  function colorRow(st, colors, t) {
    const row = h('div', { class: 'nt-colors' });
    if (t) colors = colors.concat(prefs.custom[t].filter(c => !colors.includes(c)));
    colors.forEach(c => row.append(h('button', { type: 'button', class: 'nt-dot', style: { '--c': c }, 'aria-label': '색 ' + c, 'aria-pressed': String(st.c.toLowerCase() === c), onclick: () => { st.c = c; savePrefs(); refreshTools(); recolorTextEd(); row.querySelectorAll('.nt-dot').forEach(b => b.setAttribute('aria-pressed', String(b.style.getPropertyValue('--c') === c))); } })));
    const pick = h('input', { type: 'color', value: st.c, 'aria-label': '다른 색 고르기', class: 'nt-colorpick' });
    pick.addEventListener('input', () => { st.c = pick.value; savePrefs(); refreshTools(); recolorTextEd(); });
    row.append(pick);
    if (t) row.append(h('button', { type: 'button', class: 'nt-addcolor', text: '＋ 내 팔레트에', onclick: () => { const c = st.c.toLowerCase(); if (!prefs.custom[t].includes(c) && prefs.custom[t].length < 12) { prefs.custom[t].push(c); savePrefs(); refreshTools(); toast('팔레트에 넣었어요'); } } }));
    return row;
  }
  function slider(label, min, max, step, val, fn) {
    const out = h('output', { text: String(val) });
    const r = h('input', { type: 'range', min, max, step, value: val });
    r.addEventListener('input', () => { out.textContent = r.value; fn(parseFloat(r.value)); });
    return h('label', { class: 'nt-slider' }, h('span', { text: label }), r, out);
  }
  function toolSettings(btn, t) {
    const st = prefs[t], box = h('div', { class: 'nt-settings' });
    if (t === 'pen') {
      const seg2 = h('div', { class: 'nt-seg' });
      PEN_KINDS.forEach(k => seg2.append(h('button', { type: 'button', 'aria-pressed': String(st.k === k.id), onclick: () => { st.k = k.id; savePrefs(); seg2.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === k.name))); }, text: k.name })));
      box.append(h('strong', { text: '펜' }), seg2, colorRow(st, PEN_COLORS, 'pen'), slider('굵기', 0.6, 10, 0.2, st.w, v => { st.w = v; savePrefs(); refreshTools(); }));
      const snap = h('input', { type: 'checkbox' }); snap.checked = prefs.snap;
      snap.addEventListener('change', () => { prefs.snap = snap.checked; savePrefs(); });
      box.append(h('label', { class: 'nt-check' }, snap, ' 그리고 멈추면 도형으로 (직선·원·사각형·삼각형)'));
    } else if (t === 'hl') {
      box.append(h('strong', { text: '형광펜' }), colorRow(st, HL_COLORS, 'hl'), slider('굵기', 4, 40, 1, st.w, v => { st.w = v; savePrefs(); refreshTools(); }),
        h('p', { class: 'nt-hint', text: '긋고 잠깐 멈추면 반듯한 직선이 돼요. 글씨 아래에 칠해져요.' }));
    } else if (t === 'eraser') {
      const seg2 = h('div', { class: 'nt-seg' });
      [{ id: 'stroke', name: '획 지우개' }, { id: 'pixel', name: '부분 지우개' }].forEach(m => seg2.append(h('button', { type: 'button', 'aria-pressed': String(st.mode === m.id), onclick: () => { st.mode = m.id; savePrefs(); refreshTools(); seg2.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === m.name))); }, text: m.name })));
      box.append(h('strong', { text: '지우개' }), seg2, slider('크기', 4, 60, 1, st.w, v => { st.w = v; savePrefs(); refreshTools(); }),
        h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onclick: () => { closePop(); clearPage(); }, text: '이 쪽 모두 지우기' }));
    } else if (t === 'text') {
      box.append(h('strong', { text: '텍스트' }), colorRow(st, PEN_COLORS), slider('글자 크기', 10, 60, 1, st.s, v => { st.s = v; savePrefs(); refreshTools(); }),
        h('p', { class: 'nt-hint', text: '쪽을 누른 곳에 글상자가 생겨요. 있는 글을 누르면 고칠 수 있어요.' }));
    }
    popover(btn, box);
  }
  function clearPage() {
    const page = E.nb.pages[E.current];
    if (!page || !page.items.length) return;
    if (!confirm((E.current + 1) + '쪽의 필기를 모두 지울까요? (되돌리기로 살릴 수 있어요)')) return;
    const before = page.items; setItems(page, []); itemsOp(page, before); thumbDirty(page.id);
  }

  /* ── 쪽 메뉴 · 더 보기 ── */
  function pagesOp(newPages) {
    const before = E.nb.pages.slice();
    E.nb.pages = newPages;
    pushOp({ k: 'pages', before, after: newPages.slice() });
    buildPages(); buildThumbs();
  }
  function addPage(after) {
    const ref = E.nb.pages[after] || E.nb.pages[E.nb.pages.length - 1];
    const p = { id: uid(), w: ref.w, h: ref.h, tpl: ref.bg ? 'blank' : ref.tpl, paper: ref.paper, bg: null, items: [] };
    const arr = E.nb.pages.slice(); arr.splice(after + 1, 0, p);
    pagesOp(arr);
    requestAnimationFrame(() => goPage(after + 1));
  }
  function pageMenu(btn) {
    const i = E.current, page = E.nb.pages[i], n = E.nb.pages.length;
    const box = h('div', { class: 'nt-menu nt-pagemenu' }, h('strong', { class: 'nt-menu-title', text: (i + 1) + '쪽' }));
    box.append(
      menuItem('다음에 새 쪽 넣기', () => addPage(i)),
      menuItem('이 쪽 복제', () => { const c = { ...page, id: uid(), items: page.items.map(it => ({ ...it, i: uid() })) }; const a = E.nb.pages.slice(); a.splice(i + 1, 0, c); pagesOp(a); requestAnimationFrame(() => goPage(i + 1)); }),
      i > 0 ? menuItem('앞으로 옮기기', () => { const a = E.nb.pages.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; pagesOp(a); requestAnimationFrame(() => goPage(i - 1)); }) : null,
      i < n - 1 ? menuItem('뒤로 옮기기', () => { const a = E.nb.pages.slice(); [a[i + 1], a[i]] = [a[i], a[i + 1]]; pagesOp(a); requestAnimationFrame(() => goPage(i + 1)); }) : null,
      menuItem('이 쪽 PNG로 저장', () => exportPng(E.nb, page)),
      n > 1 ? menuItem('이 쪽 삭제', () => { const a = E.nb.pages.slice(); a.splice(i, 1); pagesOp(a); }, { danger: true }) : null);
    if (!page.bg) {
      const tpls = h('div', { class: 'nt-tpls nt-tpls-sm' });
      TEMPLATES.forEach(t => {
        const cv = h('canvas'), sc = 52 / page.w;
        cv.width = Math.round(page.w * sc * 2); cv.height = Math.round(page.h * sc * 2);
        renderPage(cv.getContext('2d'), { ...page, tpl: t.id, items: [] }, sc * 2);
        tpls.append(h('button', { type: 'button', class: 'nt-tpl', 'aria-pressed': String(page.tpl === t.id), onclick: () => { setProps(page, { tpl: t.id }); closePop(); } }, cv, h('span', { text: t.name })));
      });
      const papers = h('div', { class: 'nt-seg' });
      Object.keys(PAPERS).forEach(k => papers.append(h('button', { type: 'button', 'aria-pressed': String(page.paper === k), onclick: () => { setProps(page, { paper: k }); closePop(); }, text: PAPERS[k].name })));
      box.append(h('strong', { class: 'nt-menu-title', text: '배경' }), tpls, papers,
        menuItem('모든 쪽에 이 배경 쓰기', () => {
          const before = E.nb.pages.slice(), after = E.nb.pages.map(p => p.bg ? p : { ...p, tpl: page.tpl, paper: page.paper });
          E.nb.pages = after; pushOp({ k: 'pages', before, after: after.slice() }); buildPages(); buildThumbs();
        }));
    }
    popover(btn, box);
  }
  function setProps(page, v) {
    const before = { tpl: page.tpl, paper: page.paper };
    Object.assign(page, v);
    pushOp({ k: 'props', pid: page.id, before, after: { tpl: page.tpl, paper: page.paper } });
    markDirty(page.id); thumbDirty(page.id);
  }
  function moreMenu(btn) {
    const chk = (on, label, fn) => menuItem((on ? '✓ ' : '<span class="nt-blank">✓</span> ') + label, fn);
    popover(btn, h('div', { class: 'nt-menu' },
      chk(prefs.penAuto, '펜 자동 인식 (펜을 쓰면 손가락은 이동)' + (prefs.penAuto && prefs.penSeen ? ' · 인식됨' : ''), () => { prefs.penAuto = !prefs.penAuto; if (!prefs.penAuto) prefs.penSeen = false; savePrefs(); }),
      chk(prefs.penOnly, '항상 펜으로만 쓰기 (손가락은 이동)', () => { prefs.penOnly = !prefs.penOnly; savePrefs(); }),
      chk(prefs.snap, '그리고 멈추면 도형으로', () => { prefs.snap = !prefs.snap; savePrefs(); }),
      h('hr'),
      h('label', { class: 'nt-menu-item' }, 'PDF 쪽 뒤에 붙이기', h('input', { type: 'file', accept: 'application/pdf', hidden: true, onchange: async e => {
        const f = e.target.files[0]; closePop(); if (!f) return;
        try { const pages = await pdfToPages(f); busy(false); pagesOp(E.nb.pages.concat(pages)); } catch (err) { busy(false); alert('PDF를 열지 못했어요.'); }
      } })),
      menuItem('PDF로 내보내기', async () => { await flushSave(); exportPdf(E.nb); }),
      menuItem('백업 저장 (.json)', async () => { await flushSave(); exportBackup(E.nb); }),
      h('hr'),
      h('p', { class: 'nt-hint nt-menu-hint', html: '펜을 쓰면 한 손가락으로 이동 · 두 손가락으로 확대·이동<br>⌘/Ctrl+휠로 확대 · 도구를 한 번 더 누르면 자세한 설정' })));
  }

  /* ── 입력 ── */
  function toPage(e, el) {
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / E.zoom, y: (e.clientY - r.top) / E.zoom };
  }
  function attachLive(rec, page) {
    if (!E.live) E.live = h('canvas', { class: 'nt-live' });
    const cv = E.live;
    if (cv.parentElement !== rec.el) rec.el.append(cv);
    const sc = canvasScale(page), w = Math.round(page.w * sc), hh = Math.round(page.h * sc);
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, hh);
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    cv.classList.toggle('is-multiply', prefs.tool === 'hl' && page.paper !== 'dark');
    return ctx;
  }
  function clearLive() { if (E.live) { const c = E.live.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, E.live.width, E.live.height); } }

  stack.addEventListener('pointerdown', onDown);
  stack.addEventListener('pointermove', onMove);
  stack.addEventListener('pointerup', onUp);
  stack.addEventListener('pointercancel', onUp);
  stack.addEventListener('contextmenu', e => { if (e.target.closest('.nt-page')) e.preventDefault(); });

  /* 펜(Apple Pencil 등)이 한 번이라도 닿으면 이 기기를 ‘펜 기기’로 기억한다 → 손가락 한 개는 그리기 대신 이동 */
  const fingerPans = () => prefs.penOnly || (prefs.penAuto && prefs.penSeen);
  function notePen(e) {
    if (e.pointerType !== 'pen' || !prefs.penAuto || prefs.penSeen) return;
    prefs.penSeen = true; savePrefs();
    if (E.active && E.active.touch) cancelActive();
    toast('펜을 인식했어요 · 이제 손가락 한 개로 이동해요');
  }
  /* 손을 떼면 미끄러지듯 조금 더 이동 (관성) */
  function stopGlide() { cancelAnimationFrame(E.glide || 0); E.glide = 0; }
  function glide(vx, vy) {
    stopGlide();
    let last = performance.now();
    const step = now => {
      const dt = Math.min(32, now - last); last = now;
      vp.scrollLeft -= vx * dt; vp.scrollTop -= vy * dt;
      const k = Math.pow(0.94, dt / 16); vx *= k; vy *= k;
      E.glide = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    E.glide = requestAnimationFrame(step);
  }

  function onDown(e) {
    if (e.target.closest('.nt-selbox, .nt-selbar, .nt-textedit, .nt-addpage')) return;
    stopGlide();
    notePen(e);
    if (e.pointerType === 'pen') E.penAt = Infinity;
    if (e.pointerType === 'touch') {
      // 손바닥 무시: 펜으로 쓰는 중이거나 막 뗀 직후(0.35초)에 닿은 손가락은 이동·확대에 쓰지 않는다
      if (fingerPans() && (E.penAt === Infinity || performance.now() - (E.penAt || 0) < 350)) return;
      E.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (E.touches.size === 2) {
        if (E.active && E.active.touch) cancelActive();
        const [a, b] = [...E.touches.values()];
        E.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: E.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        E.pan = null;
        try { stack.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
        return;
      }
      if (E.touches.size > 2) return;
      if (fingerPans()) {
        E.pan = { x: e.clientX, y: e.clientY, t: e.timeStamp, vx: 0, vy: 0 };
        try { stack.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
        return;
      }
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (E.active) return;
    const el = e.target.closest('.nt-page');
    if (!el) { if (E.sel) clearSel(); return; }
    e.preventDefault();
    commitText();
    try { stack.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
    const page = pageById(el.dataset.pid), rec = E.els.get(page.id), pt = toPage(e, el);
    const base = { id: e.pointerId, page, rec, touch: e.pointerType === 'touch', type: e.pointerType };
    const tool = prefs.tool;
    if (tool === 'pen' || tool === 'hl') beginStroke(base, pt, e);
    else if (tool === 'eraser') { E.active = Object.assign(base, { kind: 'erase', before: page.items, last: pt }); eraseAt(pt); drawEraserCursor(pt); }
    else if (tool === 'lasso') { clearSel(); E.active = Object.assign(base, { kind: 'lasso', poly: [pt.x, pt.y] }); }
    else if (tool === 'text') { E.active = null; openText(page, pt); }
    else if (tool === 'laser') { E.active = Object.assign(base, { kind: 'laser' }); E.laser.push({ x: pt.x, y: pt.y, t: performance.now(), pid: page.id }); runLaser(); }
  }
  function onMove(e) {
    if (e.pointerType === 'touch' && E.touches.has(e.pointerId)) {
      E.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (E.pinch && E.touches.size >= 2) {
        const [a, b] = [...E.touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        vp.scrollLeft -= cx - E.pinch.cx; vp.scrollTop -= cy - E.pinch.cy;
        E.pinch.cx = cx; E.pinch.cy = cy;
        setZoom(E.pinch.z * d / E.pinch.d, cx, cy);
        return;
      }
      if (E.pan) {
        const dx = e.clientX - E.pan.x, dy = e.clientY - E.pan.y, dt = Math.max(1, e.timeStamp - E.pan.t);
        vp.scrollLeft -= dx; vp.scrollTop -= dy;
        // 속도(px/ms)를 부드럽게 따라가며 기억해 두었다가 손을 떼면 관성에 쓴다
        E.pan = { x: e.clientX, y: e.clientY, t: e.timeStamp, vx: E.pan.vx * 0.5 + dx / dt * 0.5, vy: E.pan.vy * 0.5 + dy / dt * 0.5 };
        return;
      }
    }
    const A = E.active;
    if (!A || A.id !== e.pointerId) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (A.kind === 'stroke') { (evs.length ? evs : [e]).forEach(ev => addPoint(A, ev)); scheduleLive(); }
    else if (A.kind === 'erase') { const pt = toPage(e, A.rec.el); const steps = Math.max(1, Math.ceil(Math.hypot(pt.x - A.last.x, pt.y - A.last.y) / (prefs.eraser.w / 3))); for (let k = 1; k <= steps; k++) eraseAt({ x: A.last.x + (pt.x - A.last.x) * k / steps, y: A.last.y + (pt.y - A.last.y) * k / steps }); A.last = pt; drawEraserCursor(pt); }
    else if (A.kind === 'lasso') { const pt = toPage(e, A.rec.el); A.poly.push(r1(pt.x), r1(pt.y)); drawLasso(A); }
    else if (A.kind === 'laser') { const pt = toPage(e, A.rec.el); E.laser.push({ x: pt.x, y: pt.y, t: performance.now(), pid: A.page.id }); }
    else if (A.kind === 'move' || A.kind === 'scale') dragSel(e);
  }
  function onUp(e) {
    if (e.pointerType === 'pen') E.penAt = performance.now();
    if (e.pointerType === 'touch') {
      const wasPan = E.pan && E.touches.has(e.pointerId) && E.touches.size === 1 ? E.pan : null;
      E.touches.delete(e.pointerId);
      if (E.touches.size < 2) E.pinch = null;
      if (!E.touches.size) E.pan = null;
      else if (E.touches.size === 1 && fingerPans() && !E.pan) { const t = [...E.touches.values()][0]; E.pan = { x: t.x, y: t.y, t: e.timeStamp, vx: 0, vy: 0 }; } // 확대 뒤 남은 손가락으로 계속 이동
      if (wasPan && e.type === 'pointerup' && e.timeStamp - wasPan.t < 80 && Math.hypot(wasPan.vx, wasPan.vy) > 0.15) glide(wasPan.vx, wasPan.vy);
    }
    const A = E.active;
    if (!A || A.id !== e.pointerId) return;
    E.active = null;
    clearTimeout(holdT);
    if (A.kind === 'stroke') endStroke(A, e.type === 'pointercancel');
    else if (A.kind === 'erase') { clearLive(); itemsOp(A.page, A.before); if (A.before !== A.page.items) thumbDirty(A.page.id); }
    else if (A.kind === 'lasso') endLasso(A);
    else if (A.kind === 'move' || A.kind === 'scale') endDrag(A);
  }
  function cancelActive() {
    const A = E.active; E.active = null; clearTimeout(holdT);
    if (!A) return;
    if (A.kind === 'erase' && A.before !== A.page.items) setItems(A.page, A.before);
    clearLive();
  }

  // 펜·형광펜
  let holdT = 0, liveRaf = 0;
  function beginStroke(A, pt, e) {
    const tool = prefs.tool, st = prefs[tool];
    const item = { i: uid(), t: 's', tool, c: st.c, w: st.w, p: [] };
    if (tool === 'pen') item.k = st.k;
    Object.assign(A, { kind: 'stroke', item, pr: 0.6, lt: e.timeStamp, lx: pt.x, ly: pt.y, anchor: pt, snapped: null });
    E.active = A;
    attachLive(A.rec, A.page);
    addPoint(A, e, true);
    scheduleLive();
    armHold(A);
  }
  function addPoint(A, ev, first) {
    if (A.snapped) return;
    const pt = toPage(ev, A.rec.el);
    const p = A.item.p;
    if (!first) {
      const d = Math.hypot(pt.x - A.lx, pt.y - A.ly);
      if (d < 0.7 / E.zoom) return;
      if (Math.hypot(pt.x - A.anchor.x, pt.y - A.anchor.y) > 3 / E.zoom) { A.anchor = pt; armHold(A); }
      let target;
      if (A.type === 'pen' && ev.pressure > 0) target = ev.pressure;
      else { const dt = Math.max(1, ev.timeStamp - A.lt), v = d * E.zoom / dt; target = clamp(1.05 - v * 0.32, 0.25, 1); }
      A.pr = A.pr * 0.6 + target * 0.4;
      A.lt = ev.timeStamp;
    } else if (A.type === 'pen' && ev.pressure > 0) A.pr = ev.pressure;
    A.lx = pt.x; A.ly = pt.y;
    p.push(r1(pt.x), r1(pt.y), Math.round(A.pr * 100) / 100);
  }
  function armHold(A) {
    clearTimeout(holdT);
    if (!prefs.snap && A.item.tool !== 'hl') return;
    holdT = setTimeout(() => {
      if (E.active !== A || A.snapped) return;
      const r = recognize(A.item.p, A.item.tool === 'hl');
      if (!r) return;
      A.item.p = r.p; A.snapped = r.name;
      scheduleLive();
      toast(r.name);
    }, 520);
  }
  function scheduleLive() {
    if (liveRaf) return;
    liveRaf = requestAnimationFrame(() => {
      liveRaf = 0;
      const A = E.active; if (!A || A.kind !== 'stroke') return;
      const ctx = attachLive(A.rec, A.page);
      drawStroke(ctx, A.item, A.page.paper === 'dark');
    });
  }
  function endStroke(A, cancelled) {
    clearLive();
    if (cancelled || !A.item.p.length) return;
    const before = A.page.items;
    setItems(A.page, before.concat([A.item]));
    itemsOp(A.page, before);
    thumbDirty(A.page.id);
  }

  // 지우개
  function eraseAt(pt) {
    const A = E.active, page = A.page, rad = prefs.eraser.w / 2;
    let changed = false;
    const out = [];
    for (const it of page.items) {
      if (it.t !== 's') { out.push(it); continue; }
      if (prefs.eraser.mode === 'stroke') { if (strokeHit(it, pt.x, pt.y, rad)) changed = true; else out.push(it); }
      else { const parts = eraseSplit(it, pt.x, pt.y, rad); if (parts) { changed = true; out.push(...parts); } else out.push(it); }
    }
    if (changed) setItems(page, out);
  }
  function drawEraserCursor(pt) {
    const A = E.active; if (!A) return;
    const ctx = attachLive(A.rec, A.page);
    ctx.lineWidth = 1.5 / E.zoom; ctx.strokeStyle = 'rgba(120,120,130,0.9)'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(pt.x, pt.y, prefs.eraser.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // 레이저 포인터
  let laserRaf = 0;
  function runLaser() {
    if (laserRaf) return;
    const tick = () => {
      const now = performance.now();
      E.laser = E.laser.filter(p => now - p.t < 700);
      const last = E.laser[E.laser.length - 1];
      if (!last) { clearLive(); laserRaf = 0; return; }
      const page = pageById(last.pid), rec = E.els.get(last.pid);
      if (!page || !rec) { laserRaf = 0; return; }
      const ctx = attachLive(rec, page);
      const pts = E.laser.filter(p => p.pid === last.pid);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < pts.length; i++) {
        const a = 1 - (now - pts[i].t) / 700;
        ctx.strokeStyle = 'rgba(255,40,60,' + (a * 0.9) + ')'; ctx.lineWidth = 3 + a * 4;
        ctx.shadowColor = 'rgba(255,0,40,0.8)'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
      ctx.shadowBlur = 16; ctx.fillStyle = '#ff2a3d';
      ctx.beginPath(); ctx.arc(last.x, last.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      if (E.active && E.active.kind === 'laser') E.laser[E.laser.length - 1].t = now; // 누르고 있는 동안 점 유지
      laserRaf = requestAnimationFrame(tick);
    };
    laserRaf = requestAnimationFrame(tick);
  }

  // 올가미 선택
  function drawLasso(A) {
    const ctx = attachLive(A.rec, A.page), p = A.poly;
    ctx.lineWidth = 1.5 / E.zoom; ctx.setLineDash([6 / E.zoom, 5 / E.zoom]); ctx.strokeStyle = '#3b82f6'; ctx.fillStyle = 'rgba(59,130,246,0.08)';
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
  }
  function endLasso(A) {
    clearLive();
    const p = A.poly, page = A.page;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
    let ids = [];
    if (Math.max(x1 - x0, y1 - y0) < 8) {
      const it = itemAt(page, p[0], p[1]); if (it) ids = [it.i];
    } else {
      page.items.forEach(it => {
        if (it.t === 's') {
          let inside = 0, n = it.p.length / 3;
          for (let i = 0; i < it.p.length; i += 3) if (inPoly(it.p[i], it.p[i + 1], p)) inside++;
          if (inside / n > 0.5) ids.push(it.i);
        } else { const b = bbox(it); if (inPoly((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, p)) ids.push(it.i); }
      });
    }
    if (ids.length) { E.sel = { pid: page.id, ids: new Set(ids) }; showSel(); }
  }
  let selBox = null, selBar = null;
  const selItems = () => { const pg = pageById(E.sel.pid); return pg ? pg.items.filter(it => E.sel.ids.has(it.i)) : []; };
  function clearSel() { E.sel = null; if (selBox) { selBox.remove(); selBox = null; } if (selBar) { selBar.remove(); selBar = null; } }
  function showSel() {
    const page = pageById(E.sel.pid), rec = E.els.get(E.sel.pid), items = selItems();
    if (!page || !rec || !items.length) { clearSel(); return; }
    const b = unionBox(items), pad = 6, z = E.zoom;
    if (!selBox) {
      selBox = h('div', { class: 'nt-selbox' }, h('div', { class: 'nt-handle', 'aria-label': '크기 바꾸기' }));
      selBox.addEventListener('pointerdown', startDrag);
    }
    if (selBox.parentElement !== rec.el) rec.el.append(selBox);
    Object.assign(selBox.style, { left: (b.x0 - pad) * z + 'px', top: (b.y0 - pad) * z + 'px', width: (b.x1 - b.x0 + pad * 2) * z + 'px', height: (b.y1 - b.y0 + pad * 2) * z + 'px' });
    if (!selBar) {
      selBar = h('div', { class: 'nt-selbar' });
      const recolor = c => {
        const pg = pageById(E.sel.pid), before = pg.items;
        setItems(pg, before.map(it => E.sel.ids.has(it.i) && (it.t === 's' && it.tool === 'pen' || it.t === 'x') ? { ...it, c } : it));
        itemsOp(pg, before); thumbDirty(pg.id);
      };
      PEN_COLORS.slice(0, 5).forEach(c => selBar.append(h('button', { type: 'button', class: 'nt-dot', style: { '--c': c }, 'aria-label': '색 ' + c, onclick: () => recolor(c) })));
      selBar.append(h('span', { class: 'nt-sep' }),
        h('button', { type: 'button', text: '복사', onclick: copySel }),
        h('button', { type: 'button', text: '잘라내기', onclick: () => { copySel(); deleteSel(); } }),
        h('button', { type: 'button', text: '복제', onclick: duplicateSel }),
        h('button', { type: 'button', class: 'is-danger', text: '삭제', onclick: deleteSel }));
      selBar.addEventListener('pointerdown', e => e.stopPropagation());
    }
    if (selBar.parentElement !== rec.el) rec.el.append(selBar);
    const top = (b.y0 - pad) * z - 46;
    Object.assign(selBar.style, { left: Math.max(0, (b.x0 - pad) * z) + 'px', top: (top < 4 ? (b.y1 + pad) * z + 8 : top) + 'px' });
  }
  function startDrag(e) {
    e.stopPropagation(); e.preventDefault();
    if (E.active) return;
    const page = pageById(E.sel.pid), rec = E.els.get(page.id);
    const scale = e.target.classList.contains('nt-handle');
    const b = unionBox(selItems());
    try { stack.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
    E.active = { id: e.pointerId, kind: scale ? 'scale' : 'move', page, rec, before: page.items, start: toPage(e, rec.el), box: b, moved: false };
  }
  function dragSel(e) {
    const A = E.active, pt = toPage(e, A.rec.el);
    let f;
    if (A.kind === 'move') f = { ox: 0, oy: 0, s: 1, dx: pt.x - A.start.x, dy: pt.y - A.start.y };
    else {
      const b = A.box, w0 = b.x1 - b.x0, h0 = b.y1 - b.y0;
      const s = clamp(Math.max((pt.x - b.x0) / (w0 || 1), (pt.y - b.y0) / (h0 || 1)), 0.1, 10);
      f = { ox: b.x0, oy: b.y0, s, dx: 0, dy: 0 };
    }
    A.moved = true;
    setItems(A.page, A.before.map(it => E.sel.ids.has(it.i) ? transformItem(it, f) : it));
    showSel();
  }
  function endDrag(A) {
    if (!A.moved) return;
    itemsOp(A.page, A.before); thumbDirty(A.page.id);
  }
  function copySel() {
    if (!E.sel) return;
    E.clip = selItems().map(it => ({ ...it }));
    const pb = $('#nt-paste'); if (pb) pb.hidden = false;
    toast('복사했어요');
  }
  function deleteSel() {
    if (!E.sel) return;
    const pg = pageById(E.sel.pid), before = pg.items;
    setItems(pg, before.filter(it => !E.sel.ids.has(it.i)));
    itemsOp(pg, before); thumbDirty(pg.id); clearSel();
  }
  function insertItems(page, items, offset) {
    const f = { ox: 0, oy: 0, s: 1, dx: offset, dy: offset };
    const add = items.map(it => ({ ...transformItem(it, f), i: uid() }));
    const before = page.items;
    setItems(page, before.concat(add));
    itemsOp(page, before); thumbDirty(page.id);
    prefs.tool = 'lasso'; refreshTools();
    E.sel = { pid: page.id, ids: new Set(add.map(it => it.i)) };
    clearSelDom(); showSel();
  }
  function clearSelDom() { if (selBox) { selBox.remove(); selBox = null; } if (selBar) { selBar.remove(); selBar = null; } }
  function duplicateSel() { if (!E.sel) return; insertItems(pageById(E.sel.pid), selItems(), 24); }
  function paste() {
    if (!E.clip || !E.clip.length) return;
    const page = E.nb.pages[E.current];
    // 붙여넣을 쪽 밖으로 나가지 않게
    const b = unionBox(E.clip);
    const off = (b.x1 + 24 > page.w || b.y1 + 24 > page.h) ? 0 : 24;
    insertItems(page, E.clip, off);
  }

  // 텍스트
  function openText(page, pt, existing) {
    const rec = E.els.get(page.id);
    const it = existing || itemAt(page, pt.x, pt.y);
    const edit = it && it.t === 'x' ? it : null;
    const st = prefs.text;
    const x = edit ? edit.x : pt.x, y = edit ? edit.y : pt.y - st.s * 0.7;
    const w = edit ? edit.w : clamp(page.w - x - 24, 120, 420);
    const s = edit ? edit.s : st.s, c = edit ? edit.c : st.c;
    const ta = h('textarea', { class: 'nt-textedit', rows: '1', spellcheck: 'false', 'aria-label': '글 쓰기' });
    ta.value = edit ? edit.v : '';
    const z = E.zoom;
    Object.assign(ta.style, { left: x * z + 'px', top: y * z + 'px', width: w * z + 'px', fontSize: s * z + 'px', color: c, lineHeight: '1.45' });
    ta.addEventListener('input', () => fitTa(ta));
    ta.addEventListener('pointerdown', e => e.stopPropagation());
    ta.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); commitText(); } e.stopPropagation(); });
    ta.addEventListener('blur', () => setTimeout(() => { if (E.textEd && E.textEd.ta === ta) commitText(); }, 0));
    rec.el.append(ta);
    E.textEd = { ta, pid: page.id, skip: edit ? edit.i : null, edit, x, y, w, s, c };
    if (edit) markDirty(page.id);
    fitTa(ta);
    setTimeout(() => { ta.focus(); if (edit) ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
  }
  function fitTa(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  function recolorTextEd() { if (E.textEd && prefs.tool === 'text') { E.textEd.c = prefs.text.c; E.textEd.ta.style.color = prefs.text.c; } }
  function commitText() {
    const T = E.textEd; if (!T) return;
    E.textEd = null;
    const page = pageById(T.pid);
    const v = T.ta.value.replace(/\s+$/, '');
    T.ta.remove();
    if (!page) return;
    const before = page.items;
    if (T.edit) {
      if (!v) setItems(page, before.filter(it => it.i !== T.edit.i));
      else if (v !== T.edit.v || T.c !== T.edit.c) setItems(page, before.map(it => it.i === T.edit.i ? { ...it, v, c: T.c } : it));
      else markDirty(page.id);
    } else if (v) setItems(page, before.concat([{ i: uid(), t: 'x', x: r1(T.x), y: r1(T.y), w: r1(T.w), s: T.s, c: T.c, v }]));
    itemsOp(page, before);
    if (before !== page.items) thumbDirty(page.id);
  }
  stack.addEventListener('dblclick', e => {
    const el = e.target.closest('.nt-page'); if (!el || prefs.tool !== 'lasso') return;
    const page = pageById(el.dataset.pid), pt = toPage(e, el), it = itemAt(page, pt.x, pt.y);
    if (it && it.t === 'x') { clearSel(); prefs.tool = 'text'; refreshTools(); openText(page, pt, it); }
  });

  // 그림
  function pickImage() {
    const inp = h('input', { type: 'file', accept: 'image/*' });
    inp.addEventListener('change', async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const img = await readImageFile(f, 1400);
        const page = E.nb.pages[E.current];
        const k = Math.min(1, (page.w * 0.6) / img.w, (page.h * 0.5) / img.h);
        const w = img.w * k, hh = img.h * k;
        const r = vp.getBoundingClientRect(), pr = E.els.get(page.id).el.getBoundingClientRect();
        const cy = clamp(((r.top + r.height / 2) - pr.top) / E.zoom - hh / 2, 20, page.h - hh - 20);
        insertItems(page, [{ i: uid(), t: 'i', x: r1((page.w - w) / 2), y: r1(cy), w: r1(w), h: r1(hh), src: img.src }], 0);
      } catch (e) { alert('그림을 열지 못했어요.'); }
    });
    inp.click();
  }
  // 붙여넣기로 그림 넣기
  document.addEventListener('paste', async e => {
    if (!E.nb || e.target.closest && e.target.closest('input, textarea')) return;
    const file = [...(e.clipboardData && e.clipboardData.files || [])].find(f => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    const img = await readImageFile(file, 1400);
    const page = E.nb.pages[E.current];
    const k = Math.min(1, (page.w * 0.6) / img.w, (page.h * 0.5) / img.h);
    insertItems(page, [{ i: uid(), t: 'i', x: 60, y: 60, w: r1(img.w * k), h: r1(img.h * k), src: img.src }], 0);
  });

  // 알림
  let toastEl = null, toastT = 0;
  function toast(t) {
    if (!toastEl) { toastEl = h('div', { class: 'nt-toast', role: 'status' }); document.body.append(toastEl); }
    toastEl.textContent = t; toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 1100);
  }

  // 단축키
  document.addEventListener('keydown', e => {
    if (!E.nb || $('#nt-editor').hidden) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'c' && E.sel) { e.preventDefault(); copySel(); return; }
    if (mod && k === 'x' && E.sel) { e.preventDefault(); copySel(); deleteSel(); return; }
    if (mod && k === 'v' && E.clip) { e.preventDefault(); paste(); return; }
    if (mod && k === 'd' && E.sel) { e.preventDefault(); duplicateSel(); return; }
    if (mod && (k === '=' || k === '+')) { e.preventDefault(); setZoom(E.zoom * 1.2); return; }
    if (mod && k === '-') { e.preventDefault(); setZoom(E.zoom / 1.2); return; }
    if (mod && k === '0') { e.preventDefault(); fitWidth(); return; }
    if (mod) return;
    if ((k === 'backspace' || k === 'delete') && E.sel) { e.preventDefault(); deleteSel(); return; }
    if (k === 'escape') { clearSel(); closePop(); return; }
    const map = { p: 'pen', h: 'hl', e: 'eraser', l: 'lasso', t: 'text', k: 'laser' };
    if (map[k]) { setTool(map[k]); return; }
    if (k === 'pagedown') { e.preventDefault(); goPage(E.current + 1); }
    if (k === 'pageup') { e.preventDefault(); goPage(E.current - 1); }
  });

  /* ══ 주소에 따라 화면 바꾸기 ══ */
  async function route() {
    closePop();
    const m = location.hash.match(/^#nb=([\w-]+)/);
    if (m) await openNotebook(m[1]);
    else {
      if (E.nb) { commitText(); await flushSave(); E.nb = null; }
      showLibrary();
    }
  }
  addEventListener('hashchange', route);
  applyDesign();
  // 듀오링고 모드 스크립트가 data-duo를 나중에 바꿔도 따라가기
  new MutationObserver(applyDesign).observe(document.documentElement, { attributes: true, attributeFilter: ['data-duo'] });
  route();
})();
