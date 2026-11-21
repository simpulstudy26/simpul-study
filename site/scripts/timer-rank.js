/* 공부 타이머 ‘랭킹’ 탭: 반 친구끼리 그룹을 만들어 공부 시간 순위를 본다.
   - 그룹 만들기 → 6글자 초대 코드가 생김 → 친구는 코드와 닉네임으로 참여
   - 그룹 안 순위(오늘 / 최근 7일), 반(그룹)끼리 1인 평균 공부 시간 순위
   - 서버로 보내는 것: 날짜별 공부 시간 합계(초)와 닉네임뿐. 과목·할 일은 보내지 않는다.
   서버 API는 cloudflare/api.js (groups/*, study/sync). 맥북 로컬 서버(server.py)에는 API가 없어 안내만 보인다. */
(function () {
  'use strict';
  const S = window.Simpul, T = S.study, el = S.el;
  const GID_KEY = 'simpul.rank.gid';
  const MEDAL = ['🥇', '🥈', '🥉'];
  let groups = null, gid = null, range = 'day', busy = false, kickArmed = null, leaveArmed = false, showJoin = false;
  try { gid = Number(localStorage.getItem(GID_KEY)) || null; } catch (e) { gid = null; }
  const saveGid = () => { try { gid ? localStorage.setItem(GID_KEY, String(gid)) : localStorage.removeItem(GID_KEY); } catch (e) { /* 저장 불가 */ } };
  const root = () => document.getElementById('rk-root');

  async function api(path, body) {
    const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ uid: S.uid() }, body)) } : { cache: 'no-store' };
    let res;
    try { res = await fetch('./api/' + path, opt); } catch (e) { throw new Error('인터넷 연결을 확인해 주세요.'); }
    let data = {};
    try { data = await res.json(); } catch (e) { /* 아래에서 처리 */ }
    if (res.status === 404 && !data.error) throw Object.assign(new Error('랭킹 서버가 없어요.'), { noServer: true });
    if (!res.ok) throw new Error(data.error || '잠시 후 다시 시도해 주세요.');
    return data;
  }
  const q = p => p + (p.includes('?') ? '&' : '?') + 'uid=' + encodeURIComponent(S.uid());

  /* ── 화면 그리기 ── */
  function msg(text, kind) { return el('p', { class: 'rk-msg' + (kind ? ' is-' + kind : ''), role: 'status', text }); }

  function joinForms(first) {
    const wrap = el('div', { class: 'rk-forms' });
    const status = el('p', { class: 'rk-form-status', role: 'status' });
    const joinCode = el('input', { class: 'tm-input rk-code', id: 'rk-join-code', maxlength: '6', autocomplete: 'off', placeholder: '예: BR2K3K', 'aria-label': '초대 코드 6글자' });
    const joinNick = el('input', { class: 'tm-input', id: 'rk-join-nick', maxlength: '12', autocomplete: 'off', placeholder: '닉네임', 'aria-label': '그룹에서 쓸 닉네임' });
    const joinForm = el('form', { class: 'rk-form' }, [
      el('h3', { class: 'rk-form-title', text: '초대 코드로 참여' }),
      el('div', { class: 'rk-form-row' }, [joinCode, joinNick, el('button', { class: 'tm-chip rk-go', type: 'submit', text: '참여' })])
    ]);
    joinCode.addEventListener('input', () => { joinCode.value = joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    joinForm.addEventListener('submit', e => { e.preventDefault(); submit('groups/join', { code: joinCode.value, nick: joinNick.value }, status); });

    const makeName = el('input', { class: 'tm-input', id: 'rk-make-name', maxlength: '20', autocomplete: 'off', placeholder: '그룹 이름 (예: 1학년 3반)', 'aria-label': '그룹 이름' });
    const makeNick = el('input', { class: 'tm-input', id: 'rk-make-nick', maxlength: '12', autocomplete: 'off', placeholder: '닉네임', 'aria-label': '그룹에서 쓸 닉네임' });
    const makeForm = el('form', { class: 'rk-form' }, [
      el('h3', { class: 'rk-form-title', text: '새 그룹 만들기' }),
      el('div', { class: 'rk-form-row' }, [makeName, makeNick, el('button', { class: 'tm-chip rk-go', type: 'submit', text: '만들기' })])
    ]);
    makeForm.addEventListener('submit', e => { e.preventDefault(); submit('groups/create', { name: makeName.value, nick: makeNick.value }, status); });

    if (first) wrap.append(el('div', { class: 'rk-hero' }, [
      el('span', { class: 'rk-hero-icon', 'aria-hidden': 'true', text: '🏆' }),
      el('div', {}, [
        el('h2', { class: 'tm-block-title', text: '반 친구들과 공부 시간 랭킹' }),
        el('p', { class: 'rk-sub', text: '반 그룹을 만들어 초대 코드를 알려 주거나, 받은 코드로 참여하세요. 오늘·최근 7일 공부 시간으로 순위를 매겨요.' })
      ])
    ]));
    wrap.append(joinForm, makeForm, status,
      el('p', { class: 'rk-privacy', text: '그룹에 들어가면 날짜별 공부 시간 합계와 닉네임이 그룹 친구들에게 보여요(과목·할 일은 안 보내요). 그룹 이름은 반 랭킹에서 모두에게 보여요. 실명·학교·연락처 대신 별명을 쓰는 걸 권해요.' }));
    return wrap;
  }

  async function submit(path, body, status) {
    if (busy) return;
    busy = true; status.textContent = '보내는 중…'; status.className = 'rk-form-status';
    try {
      T.setRankJoined(true);
      const r = await api(path, body);
      gid = r.id; saveGid(); showJoin = false;
      await T.syncRank(true);
      await load();
    } catch (e) {
      if (!groups || !groups.length) T.setRankJoined(false);
      status.textContent = e.message; status.className = 'rk-form-status is-bad';
    } finally { busy = false; }
  }

  function groupChips() {
    const row = el('div', { class: 'rk-chips', role: 'tablist', 'aria-label': '내 그룹' });
    groups.forEach(g => {
      const b = el('button', { type: 'button', role: 'tab', class: 'rk-chip', 'aria-selected': String(g.id === gid && !showJoin), text: g.name });
      b.addEventListener('click', () => { gid = g.id; saveGid(); showJoin = false; kickArmed = null; leaveArmed = false; draw(); });
      row.append(b);
    });
    const add = el('button', { type: 'button', class: 'rk-chip rk-chip-add', 'aria-expanded': String(showJoin), text: '+ 그룹' });
    add.addEventListener('click', () => { showJoin = !showJoin; draw(); });
    row.append(add);
    return row;
  }

  function seg() {
    const box = el('div', { class: 'tm-seg', role: 'tablist', 'aria-label': '기간' });
    [['day', '오늘'], ['week', '최근 7일']].forEach(([v, t]) => {
      const b = el('button', { type: 'button', role: 'tab', 'aria-selected': String(range === v), text: t });
      b.addEventListener('click', () => { range = v; draw(); });
      box.append(b);
    });
    return box;
  }

  let rankCache = {}, boardCache = {};
  async function draw() {
    const r = root();
    if (!groups) return;
    r.replaceChildren();
    if (!groups.length) { r.append(el('div', { class: 'tm-block' }, [joinForms(true)])); return; }
    if (!groups.some(g => g.id === gid)) { gid = groups[0].id; saveGid(); }
    r.append(el('div', { class: 'tm-block rk-top' }, [groupChips()]));
    if (showJoin) { r.append(el('div', { class: 'tm-block' }, [joinForms(false)])); return; }

    const g = groups.find(x => x.id === gid);
    const codeBtn = el('button', { type: 'button', class: 'rk-code-btn', 'aria-label': '초대 코드 ' + g.code + ' 복사' }, [
      el('span', { class: 'rk-code-label', text: '초대 코드' }), el('b', { text: g.code }), el('span', { class: 'rk-copy', text: '복사' })
    ]);
    codeBtn.addEventListener('click', () => {
      const done = () => { codeBtn.querySelector('.rk-copy').textContent = '복사됨 ✓'; setTimeout(() => { codeBtn.querySelector('.rk-copy').textContent = '복사'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(g.code).then(done, () => {}); else done();
    });
    const head = el('div', { class: 'tm-block' }, [
      el('div', { class: 'tm-block-head' }, [
        el('div', {}, [el('h2', { class: 'tm-block-title', text: g.name }), el('p', { class: 'rk-sub', text: g.members + '명 · 나는 ‘' + g.nick + '’' + (g.owner ? ' · 그룹을 만든 사람' : '') })]),
        seg()
      ]),
      codeBtn
    ]);
    const list = el('ol', { class: 'rk-list', 'aria-label': g.name + ' 순위' }, [el('li', { class: 'tm-empty', text: '순위를 불러오는 중…' })]);
    head.append(list);
    r.append(head);

    const boardBox = el('div', { class: 'tm-block' }, [
      el('div', { class: 'tm-block-head' }, [el('h2', { class: 'tm-block-title', text: '반 랭킹' }), el('p', { class: 'rk-sub', text: (range === 'day' ? '오늘' : '최근 7일') + ' 1인 평균 공부 시간 · 2명 이상 그룹' })]),
      el('ol', { class: 'rk-list rk-board' }, [el('li', { class: 'tm-empty', text: '불러오는 중…' })])
    ]);
    r.append(boardBox, myTools(g));

    const key = gid + '|' + range;
    try {
      const [rank, board] = await Promise.all([api(q('groups/rank?gid=' + gid + '&range=' + range)), api(q('groups/board?range=' + range))]);
      rankCache[key] = rank; boardCache[range] = board;
      if (gid !== g.id) return;
      fillRank(list, rank, g);
      fillBoard(boardBox.querySelector('.rk-board'), board);
    } catch (e) {
      list.replaceChildren(el('li', { class: 'tm-empty', text: e.message }));
      boardBox.remove();
    }
  }

  function fmt(sec) { return sec ? T.words(sec) : '0분'; }

  function fillRank(list, data, g) {
    const rows = data.rows || [];
    const top = Math.max(1, ...rows.map(x => x.sec));
    list.replaceChildren();
    let rank = 0, prev = -1;
    rows.forEach((x, i) => {
      if (x.sec !== prev) rank = i + 1;
      prev = x.sec;
      const li = el('li', { class: 'rk-row' + (x.me ? ' is-me' : '') + (rank <= 3 && x.sec ? ' is-top' : '') }, [
        el('span', { class: 'rk-rank', text: rank <= 3 && x.sec ? MEDAL[rank - 1] : String(rank) }),
        el('span', { class: 'rk-name' }, [document.createTextNode(x.nick), x.me ? el('span', { class: 'rk-me', text: '나' }) : null]),
        el('span', { class: 'rk-bar', 'aria-hidden': 'true' }, [el('span', { style: 'width:' + Math.round(x.sec / top * 100) + '%' })]),
        el('span', { class: 'rk-time', text: fmt(x.sec) })
      ]);
      if (g.owner && !x.me) {
        const k = el('button', { type: 'button', class: 'rk-kick', text: kickArmed === x.nick ? '한 번 더' : '내보내기', 'aria-label': x.nick + ' 내보내기' });
        k.addEventListener('click', async () => {
          if (kickArmed !== x.nick) { kickArmed = x.nick; k.textContent = '한 번 더'; return; }
          kickArmed = null;
          try { await api('groups/kick', { gid: g.id, nick: x.nick }); await load(); } catch (e) { k.textContent = e.message; }
        });
        li.append(k);
      }
      list.append(li);
    });
    if (rows.length === 1) list.append(el('li', { class: 'tm-empty', text: '아직 나 혼자예요. 초대 코드 ' + g.code + '를 반 친구들에게 알려 주세요.' }));
  }

  function fillBoard(list, data) {
    const rows = data.groups || [];
    list.replaceChildren();
    if (!rows.length) { list.append(el('li', { class: 'tm-empty', text: '2명 이상인 그룹이 생기면 반끼리 순위가 나와요.' })); return; }
    const top = Math.max(1, ...rows.map(x => x.avg));
    rows.forEach(x => list.append(el('li', { class: 'rk-row' + (x.mine ? ' is-me' : '') + (x.rank <= 3 && x.avg ? ' is-top' : '') }, [
      el('span', { class: 'rk-rank', text: x.rank <= 3 && x.avg ? MEDAL[x.rank - 1] : String(x.rank) }),
      el('span', { class: 'rk-name' }, [document.createTextNode(x.name), el('small', { text: ' ' + x.members + '명' })]),
      el('span', { class: 'rk-bar', 'aria-hidden': 'true' }, [el('span', { style: 'width:' + Math.round(x.avg / top * 100) + '%' })]),
      el('span', { class: 'rk-time', text: fmt(x.avg) })
    ])));
    if (data.total > rows.length) list.append(el('li', { class: 'tm-empty', text: '전체 ' + data.total + '개 그룹 중 30위까지' }));
  }

  function myTools(g) {
    const box = el('div', { class: 'tm-block rk-tools' });
    const nick = el('input', { class: 'tm-input', id: 'rk-nick', maxlength: '12', value: g.nick, 'aria-label': '내 닉네임' });
    const save = el('button', { class: 'tm-chip', type: 'submit', text: '닉네임 바꾸기' });
    const status = el('span', { class: 'rk-form-status', role: 'status' });
    const form = el('form', { class: 'rk-form-row' }, [nick, save]);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      try { await api('groups/nick', { gid: g.id, nick: nick.value }); status.textContent = '바꿨어요'; status.className = 'rk-form-status'; await load(); }
      catch (err) { status.textContent = err.message; status.className = 'rk-form-status is-bad'; }
    });
    const leave = el('button', { class: 'linkish rk-leave', type: 'button', text: leaveArmed ? '한 번 더 누르면 나가요' : '이 그룹 나가기' });
    leave.addEventListener('click', async () => {
      if (!leaveArmed) { leaveArmed = true; leave.textContent = '한 번 더 누르면 나가요'; setTimeout(() => { leaveArmed = false; leave.textContent = '이 그룹 나가기'; }, 3000); return; }
      leaveArmed = false;
      try { await api('groups/leave', { gid: g.id }); gid = null; saveGid(); await load(); } catch (e) { leave.textContent = e.message; }
    });
    box.append(el('h2', { class: 'tm-block-title rk-tools-title', text: '내 설정' }), form, status, el('p', { class: 'tm-danger' }, [leave]));
    return box;
  }

  async function load() {
    const r = root();
    if (!groups) r.replaceChildren(el('div', { class: 'tm-block' }, [msg('랭킹을 불러오는 중…')]));
    try {
      const data = await api(q('groups/mine'));
      groups = data.groups || [];
      T.setRankJoined(groups.length > 0);
      draw();
    } catch (e) {
      r.replaceChildren(el('div', { class: 'tm-block' }, [msg(e.noServer
        ? '랭킹은 인터넷에 올린 심풀스터디 사이트에서만 쓸 수 있어요. (맥북 로컬 서버에는 랭킹 서버가 없어요)'
        : e.message, 'bad')]));
    }
  }

  /* 탭을 열 때마다: 내 시간 올리기 → 그룹 목록(인원 수)과 순위 다시 받기 */
  S.timerRank = {
    async show() {
      await T.syncRank(true);
      await load();
    }
  };
})();
