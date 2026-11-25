#!/usr/bin/env node
/* 개념 자료에서 확인 문제를 빼고, 그 자리에 무한 문제 단원으로 가는 카드를 둔다. (한국사·통합과학·정보·일본어·공통국어2)
     node tools/strip_material_quiz.mjs
   순서: 원본(tools/material-src/) → node tools/build_material_bank.mjs → 이 스크립트 → node tools/unify_final_materials.mjs
   영어·통합사회는 tools/strip_material_quiz.py가 맡는다(형식이 달라서).

   - QUIZ_DATA의 탭마다 문제 배열을 비운다(탭 번호는 남겨 자료 스크립트가 오류 없이 돈다).
   - 확인 문제 칸(.quiz-section)은 숨기고, 바로 앞에 ‘무한 문제로 풀기’ 카드를 넣는다.
   - 공통국어2: 앱 안 quiz 배열을 비우고, ‘문제 풀이’ 화면과 단원의 ‘이 단원 문제’ 단추를 무한 문제로 잇는다.
   원본에서 다시 만들기 때문에 여러 번 실행해도 결과가 같다. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SRC, DST, QUIZ_FILES, KOREAN_APP, literalSpan, quizUnits } from './material-quiz-lib.mjs';

const INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/banks/index.json'), 'utf8')).subjects;
const CLOUD = '../../../cloud.html'; // materials/s2-final/<과목>/x.html 기준
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const href = (subject, unit) => CLOUD + '?s=' + subject + '&u=' + encodeURIComponent(unit);

function card(subject, unit, title = '이 부분 문제는 무한 문제에서 풀어요') {
  const n = (INDEX[subject] && INDEX[subject].units[unit]) || 0;
  return '<a class="m-practice" target="_top" href="' + esc(href(subject, unit)) + '"><span class="m-practice-ico" aria-hidden="true"></span>' +
    '<span class="m-practice-txt"><b>' + esc(title) + '</b><small>' + esc(unit) + ' · ' + n + '문제 · O/X·객관식·고난도</small></span>' +
    '<span class="m-practice-go">무한 문제로 풀기 →</span></a>';
}

/* 문제 배열만 비운 같은 모양의 리터럴: { "0": {"ox":[],"mc":[],"hard":[]}, … } */
const emptied = data => JSON.stringify(Object.fromEntries(Object.entries(data).map(([k, v]) =>
  [k, Object.fromEntries(Object.keys(v).map(t => [t, Array.isArray(v[t]) ? [] : v[t]]))])));
function replaceLiteral(s, re, fn) {
  const [a, b] = literalSpan(s, re);
  const value = (0, eval)('(' + s.slice(a, b) + ')');
  return s.slice(0, a) + fn(value) + s.slice(b);
}

/* .quiz-section 칸마다 [시작, 끝) 위치와 탭 번호 */
function quizSlots(s) {
  const out = [];
  const re = /<div\b[^>]*\bclass="quiz-section"[^>]*>/g;
  let m;
  while ((m = re.exec(s))) {
    let depth = 0, k = m.index, end = -1;
    const tag = /<(\/?)div\b[^>]*>/g;
    tag.lastIndex = m.index;
    let t;
    while ((t = tag.exec(s))) { depth += t[1] ? -1 : 1; if (!depth) { end = t.index + t[0].length; break; } }
    if (end < 0) throw new Error('quiz-section이 안 닫힘');
    const block = s.slice(m.index, end);
    // 탭 번호: 칸 id(quiz-3, quiz-panel-3) → 안쪽 id(scoreboard-3) → 감싼 패널(panel-3) 순
    let key = (/\bid="quiz-(?:panel-)?(\d+)"/.exec(m[0]) || /\bdata-tab="(\d+)"/.exec(m[0]) || /\bid="[a-z]+-(\d+)"/.exec(block) || [])[1];
    if (key === undefined) {
      const panels = [...s.slice(0, m.index).matchAll(/\bid="panel-(\d+)"/g)];
      key = panels.length ? panels[panels.length - 1][1] : undefined;
    }
    out.push({ start: m.index, end, open: m[0], key });
    re.lastIndex = end;
  }
  return out;
}

function stripQuizData(subject, file) {
  let s = fs.readFileSync(path.join(SRC, file.f), 'utf8');
  const { units } = quizUnits(s, file);
  s = replaceLiteral(s, /QUIZ_DATA\s*=/, emptied);
  // 뒤에 붙이는 탭(Object.assign)도 비운다
  for (const m of [...s.matchAll(/Object\.assign\(\s*QUIZ_DATA\s*,\s*([A-Za-z_$][\w$]*)?/g)].reverse()) {
    if (m[1]) s = replaceLiteral(s, new RegExp('(?:const|let|var)\\s+' + m[1] + '\\s*='), emptied);
    else s = s.slice(0, m.index) + replaceLiteral(s.slice(m.index), /Object\.assign\(\s*QUIZ_DATA\s*,/, emptied);
  }
  const slots = quizSlots(s);
  let moved = 0;
  for (const slot of slots.reverse()) {
    const unit = units[slot.key];
    if (!unit) continue; // 문제 묶음이 없는 칸(예: 빈 자리)은 둔다
    const hiddenOpen = slot.open.replace(/^<div\b/, '<div hidden style="display:none" data-moved-to-bank');
    s = s.slice(0, slot.start) + '<div class="m-practice-wrap">' + card(subject, unit) + '</div>' + hiddenOpen + s.slice(slot.start + slot.open.length);
    moved++;
  }
  const missing = Object.values(units).length - moved;
  fs.writeFileSync(path.join(DST, file.f), s);
  console.log('문제 뺌:', file.f, '칸 ' + moved + '개' + (missing > 0 ? ' (카드 없는 묶음 ' + missing + '개)' : ''));
}

function stripKorean() {
  const f = KOREAN_APP.f;
  let s = fs.readFileSync(path.join(SRC, f), 'utf8');
  const m = /<script id="app-data" type="application\/json">([\s\S]*?)<\/script>/.exec(s);
  const app = JSON.parse(m[1]);
  const quizStart = m.index + m[0].indexOf(m[1]);
  const [a, b] = literalSpan(s.slice(quizStart), /"quiz"\s*:/);
  s = s.slice(0, quizStart + a) + '[]' + s.slice(quizStart + b);

  const unitOf = Object.fromEntries(app.units.map(u => [u.id, KOREAN_APP.prefix + u.title]));
  const links = Object.fromEntries(app.units.map(u => [u.id, href('korean', unitOf[u.id])]));
  const total = (INDEX.korean && INDEX.korean.count) || 0;
  const cards = app.units.filter(u => (INDEX.korean.units[unitOf[u.id]] || 0) > 0).map(u => card('korean', unitOf[u.id], u.title)).join('');
  const practice = '<div class="eyebrow">읽은 내용을 내 것으로</div><h1>문제로 확인하기</h1>' +
    '<p class="lead">문제는 무한 문제에서 풀어요. 단원을 고르면 그 단원 문제를 5문제씩 풀 수 있습니다.</p><div class="m-practice-wrap">' + cards + '</div>';
  const inject = 'const PRACTICE_HTML=' + JSON.stringify(practice) + ',PRACTICE_LINK=' + JSON.stringify(links) + ',PRACTICE_TOTAL=' + total + ';\n';
  const rep = (from, to) => { if (!s.includes(from)) throw new Error('공통국어2에서 못 찾음: ' + from.slice(0, 40)); s = s.replace(from, to); };
  rep('function renderQuiz(){', inject + 'function renderQuiz(){main.innerHTML=PRACTICE_HTML+footer();return;');
  rep('if(b.dataset.quizUnit){', 'if(b.dataset.quizUnit){if(PRACTICE_LINK[b.dataset.quizUnit])window.top.location.href=new URL(PRACTICE_LINK[b.dataset.quizUnit],location.href).href;return;');
  rep('${QUIZ.length}<small>문항</small></strong><span>해설형 연습문제</span>', '${PRACTICE_TOTAL}<small>문항</small></strong><span>무한 문제</span>');
  fs.writeFileSync(path.join(DST, f), s);
  console.log('문제 뺌:', f, '카드 ' + (cards.match(/m-practice"/g) || []).length + '개');
}

Object.entries(QUIZ_FILES).forEach(([subject, list]) => list.forEach(file => stripQuizData(subject, file)));
stripKorean();
