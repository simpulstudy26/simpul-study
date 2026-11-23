#!/usr/bin/env node
/* 2학기 기말 자료 HTML 안의 문제·드릴을 무한 문제 은행으로 옮긴다.
     node tools/build_material_bank.mjs
   결과: site/banks/<과목>.json  {subject, questions:[{id,u,d,q,c,a,e,t?}]}  +  site/banks/index.json (단원별 개수)
   - 무한 문제(cloud.js)·듀오링고 레슨(lesson.js)·학습 경로(duo-home.js)가 cloud/<과목>.json(AI 은행)과 함께 읽는다.
   - cloud/*.json은 자동화 엔진이 DB에서 다시 쓰므로 자료 문제는 따로 banks/에 둔다.
   - O/X 문제는 t:'ox', c:['O','X'], a:'O'|'X'. 보기형으로도 채점되므로 예전 화면에서도 풀린다.
   id는 자료 안 위치로 정해서 다시 만들어도 같다(푼 기록·틀린 문제 기록이 유지됨). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAT = path.join(ROOT, 'tools/material-src'); // 문제가 들어 있는 원본 (사이트 자료에서는 문제를 뺐음)
const OUT = path.join(ROOT, 'site/banks');

/* 자료 HTML 안의 `이름 = [...]` / `{...}` 리터럴을 잘라 낸다 (문자열 안 괄호는 건너뜀) */
function grab(src, re) {
  const m = re.exec(src);
  if (!m) throw new Error('못 찾음: ' + re);
  let j = m.index + m[0].length;
  while (src[j] !== '[' && src[j] !== '{') j++;
  let depth = 0, k = j, quote = null, esc = false;
  for (; k < src.length; k++) {
    const c = src[k];
    if (quote) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (!depth) break; }
  }
  return (0, eval)('(' + src.slice(j, k + 1) + ')');
}
const read = f => fs.readFileSync(path.join(MAT, f), 'utf8');
const strip = h => String(h || '').replace(/<b class="sl">\/<\/b>/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
/* 같은 입력이면 늘 같은 결과가 나오는 섞기 (문자열 씨앗) */
function seeded(seed) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
function pickOthers(pool, not, n, seed) {
  const rnd = seeded(seed), list = [...new Set(pool.filter(x => x && x !== not))];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list.slice(0, n);
}
function shuffleWith(arr, seed) {
  const rnd = seeded(seed), a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const ox = (id, u, q, yes, e, d = 'easy') => ({ id, u, d, t: 'ox', q, c: ['O', 'X'], a: yes ? 'O' : 'X', e });
const mc = (id, u, d, q, c, a, e) => ({ id, u, d, q, c, a, e });

/* ── 영어 ── */
function english() {
  const out = [];
  // 교과서 Unit 2·3 어휘 훈련 → 뜻 고르기 + O/X
  const units = grab(read('english/english_textbook_u2_u3.html'), /(?:const|let|var)\s+UNITS\s*=/);
  units.forEach(un => {
    const name = '교과서 Unit ' + un.id.replace(/\D/g, '');
    const meanings = un.drill.map(x => x.a);
    un.drill.forEach((x, i) => {
      const id = `m-en-t-${un.id}-${i}`;
      const where = ' (' + x.r.replace('-', '단락 ') + '문장)';
      if (i % 2 === 0) {
        const c = shuffleWith([x.a, ...pickOthers(meanings, x.a, 3, id)], id + 'c');
        out.push(mc(id, name + ' · 어휘', 'easy', `“${x.w}”의 본문 속 뜻으로 알맞은 것은?`, c, x.a, x.w + ' = ' + x.a + where));
      } else {
        const yes = seeded(id)() < 0.5, shown = yes ? x.a : pickOthers(meanings, x.a, 1, id)[0];
        out.push(ox(id, name + ' · 어휘 O/X', `본문의 “${x.w}”은(는) ‘${shown}’(이)라는 뜻이다.`, yes, x.w + ' = ' + x.a + where));
      }
    });
  });

  // 부교재 11·15·16과 지문 드릴
  const passages = grab(read('english/english_supplement.html'), /PASSAGES\s*=/);
  const vocabByLesson = {};
  passages.forEach(p => (p.drills.vocab || []).forEach(v => (vocabByLesson[p.lesson] = vocabByLesson[p.lesson] || []).push(v.ko)));
  passages.forEach(p => {
    const L = '부교재 ' + p.lesson + '과', tag = `[${p.id} ${p.title}]`, dr = p.drills || {};
    const text = (p.sents || []).map(s => strip(s.en)).join(' ');
    (dr.gram || []).forEach((g, i) => out.push(mc(`m-en-s-${p.id}-g${i}`, L + ' · 어법', 'medium',
      `${tag} 어법상 알맞은 것을 고르세요.\n${g.pre}[ ${g.o.join(' / ')} ]${g.post}`, g.o, g.o[g.a], g.e)));
    (dr.word || []).forEach((g, i) => out.push(mc(`m-en-s-${p.id}-w${i}`, L + ' · 낱말', 'medium',
      `${tag} 문맥상 알맞은 낱말을 고르세요.\n${g.pre}[ ${g.o.join(' / ')} ]${g.post}`, g.o, g.o[g.a], g.e)));
    (dr.vocab || []).forEach((v, i) => {
      const id = `m-en-s-${p.id}-v${i}`;
      const yes = seeded(id)() < 0.5, shown = yes ? v.ko : pickOthers(vocabByLesson[p.lesson], v.ko, 1, id)[0];
      const sent = strip((p.sents[v.s] || {}).en);
      out.push(ox(id, L + ' · 어휘 O/X', `${tag} 다음 문장의 “${v.en}”은(는) ‘${shown}’(으)로 해석된다.\n${sent}`, yes, v.en + ' = ' + v.ko));
    });
    [].concat(dr.title || []).forEach((g, i) => out.push(mc(`m-en-s-${p.id}-t${i}`, L + ' · 주제·제목', 'hard',
      `${tag} 다음 글의 제목으로 가장 알맞은 것은?\n${text}`, g.o, g.o[g.a], g.e)));
    if (dr.order && dr.order.answer) {
      const o = dr.order, id = `m-en-s-${p.id}-o`;
      const given = strip((p.sents[o.given] || {}).en);
      const boxes = o.boxes.map(b => '(' + b.k + ') ' + b.ss.map(n => strip((p.sents[n] || {}).en)).join(' ')).join('\n');
      const ans = o.answer.join(' - ');
      const perms = [];
      const permute = (arr, acc = []) => { if (!arr.length) perms.push(acc.join(' - ')); arr.forEach((x, i) => permute(arr.filter((_, j) => j !== i), acc.concat(x))); };
      permute(o.boxes.map(b => b.k));
      const c = shuffleWith([ans, ...pickOthers(perms, ans, 3, id)], id + 'c');
      out.push(mc(id, L + ' · 글의 순서', 'hard', `${tag} 주어진 글 다음에 이어질 순서로 알맞은 것은?\n${given}\n\n${boxes}`, c, ans, o.exp));
    }
    // 요약문 빈칸: 고를 빈칸만 [ A / B ], 나머지 빈칸은 정답으로 채워 보여 준다
    const sumSent = (p.sents || []).find(x => x.isSummary);
    if (dr.summary && sumSent) {
      const plain = strip(sumSent.en);
      const spots = dr.summary.map(d => {
        let best = -1;
        for (let at = plain.indexOf(d.en); at >= 0; at = plain.indexOf(d.en, at + 1)) if (best < 0 || Math.abs(at - d.at) < Math.abs(best - d.at)) best = at;
        return Object.assign({ pos: best }, d);
      });
      if (spots.every(d => d.pos >= 0)) spots.forEach((d, i) => {
        let shown = plain;
        [...spots].sort((a, b) => b.pos - a.pos).forEach(x => {
          const fill = x === d ? '[ ' + x.o.join(' / ') + ' ]' : x.en;
          shown = shown.slice(0, x.pos) + fill + shown.slice(x.pos + x.en.length);
        });
        out.push(mc(`m-en-s-${p.id}-s${i}`, L + ' · 요약문 빈칸', 'hard', `${tag} 본문을 요약한 문장의 빈칸에 알맞은 말은?\n${shown}`, d.o, d.o[d.a], d.e));
      });
    }
    // 문장 배열: 우리말에 맞게 낱말을 배열해 직접 쓰기 (서술형)
    (dr.scr || []).forEach((d, i) => {
      const id = `m-en-s-${p.id}-r${i}`, answer = d.s.replace(/\.$/, '');
      const words = shuffleWith(answer.split(' '), id).join(' / ');
      out.push({ id, u: L + ' · 문장 배열', d: 'hard', q: `${tag} 우리말에 맞게 낱말을 모두 배열해 영어 문장을 쓰세요.\n${d.ko}\n\n${words}`, c: [], a: answer, e: d.ko });
    });
  });
  return out;
}

/* ── 통합사회 ── */
function social() {
  const out = [];
  const files = [
    { f: 'social/social2_part_a.html', key: 'a', unit: i => (i <= 5 ? 'Ⅱ. ' : 'Ⅳ. ') },
    { f: 'social/social2_part_b.html', key: 'b', unit: () => 'Ⅲ. ' }
  ];
  files.forEach(({ f, key, unit }) => {
    const src = read(f);
    const data = grab(src, /QUIZ_DATA\s*=/);
    const labels = {};
    for (const m of src.matchAll(/switchTab\((\d+)\)"[^>]*>(?:<span class="tab-num">\d+<\/span>)?([^<]+)</g)) labels[m[1]] = m[2].trim();
    Object.keys(data).forEach(tab => {
      const u = unit(Number(tab)) + labels[tab];
      const set = data[tab];
      (set.ox || []).forEach((x, i) => out.push(ox(`m-so-${key}${tab}-x${i}`, u, x.q, x.a === true || x.a === 'O', x.exp)));
      ['mc', 'hard'].forEach(type => (set[type] || []).forEach((x, i) => {
        if (x.fig) return; // 그림이 있어야 풀 수 있는 문제는 자료에서 풀기
        let q = String(x.q).replace(/\^/g, '\n');
        if (x.stmts && x.stmts.length) q += '\n' + x.stmts.map((s, j) => 'ㄱㄴㄷㄹㅁㅂ'[j] + '. ' + s).join('\n');
        out.push(mc(`m-so-${key}${tab}-${type === 'mc' ? 'm' : 'h'}${i}`, u, type === 'mc' ? 'medium' : 'hard', strip(q.replace(/\n/g, '\u0001')).replace(/\u0001/g, '\n'), x.opts.map(strip), strip(x.opts[x.a]), strip(x.exp)));
      }));
    });
  });
  return out;
}

const banks = { english: english(), social: social() };
fs.mkdirSync(OUT, { recursive: true });
const index = { updated: Math.floor(Date.now() / 1000), subjects: {} };
for (const [s, qs] of Object.entries(banks)) {
  const ids = new Set();
  qs.forEach(q => { if (ids.has(q.id)) throw new Error('id 중복: ' + q.id); ids.add(q.id); if (q.c.length && !q.c.includes(q.a)) throw new Error('정답이 보기에 없음: ' + q.id); });
  const units = {};
  qs.forEach(q => { units[q.u] = (units[q.u] || 0) + 1; });
  index.subjects[s] = { count: qs.length, units };
  fs.writeFileSync(path.join(OUT, s + '.json'), JSON.stringify({ subject: s, questions: qs }));
  console.log(s, qs.length + '문제', Object.keys(units).length + '단원', 'O/X ' + qs.filter(q => q.t === 'ox').length);
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
