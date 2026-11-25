/* 자료 HTML 안 확인 문제(QUIZ_DATA 형식, 공통국어2 앱 형식)를 읽는 공통 도구.
   tools/build_material_bank.mjs(문제 은행 만들기)와 tools/strip_material_quiz.mjs(자료에서 문제 빼기)가 같이 쓴다. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = path.join(ROOT, 'tools/material-src');      // 문제가 들어 있는 원본
export const DST = path.join(ROOT, 'site/materials/s2-final'); // 사이트 자료 (문제 뺀 것)

/* QUIZ_DATA = { 탭: { ox:[{q,a,exp}], mc:[{q,opts,a,exp,stmts?,fig?}], hard:[…] } } 형식을 쓰는 자료.
   key: 문제 id 앞부분(바꾸면 푼 기록이 끊기므로 고정), prefix: 단원 이름 앞에 붙일 말 */
export const QUIZ_FILES = {
  history: [
    { f: 'history/history_part_choi.html', key: 'choi', prefix: '' },
    { f: 'history/history_part_jung.html', key: 'jung', prefix: '' }
  ],
  science: [
    { f: 'science/biology_ecosystem.html', key: 'bio', prefix: '생태계 · ' },
    { f: 'science/earth_future_society.html', key: 'earth', prefix: '과학과 미래 사회 · ' }
  ],
  info: [
    { f: 'info/info_midterm.html', key: 'mid', prefix: '' },
    { f: 'info/info_new.html', key: 'new', prefix: '' }
  ],
  japanese: [
    { f: 'japanese/japanese_summary.html', key: 'sum', prefix: '' }
  ]
};
/* 공통국어2 통합 학습실: <script id="app-data"> 안 quiz 배열 */
export const KOREAN_APP = { f: 'korean/korean2_integrated.html', key: 'k2', prefix: '공통국어2 · ' };

/* `이름 = [...]`/`{...}` 리터럴의 [시작, 끝) 위치. 문자열 안 괄호는 건너뛴다. */
export function literalSpan(src, re) {
  const m = re.exec(src);
  if (!m) throw new Error('못 찾음: ' + re);
  let j = m.index + m[0].length;
  while (src[j] !== '[' && src[j] !== '{') j++;
  let depth = 0, quote = null, esc = false;
  for (let k = j; k < src.length; k++) {
    const c = src[k];
    if (quote) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === quote) quote = null; continue; }
    if (c === '/' && src[k + 1] === '/') { k = src.indexOf('\n', k); if (k < 0) break; continue; }
    if (c === '/' && src[k + 1] === '*') { k = src.indexOf('*/', k) + 1; continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (!depth) return [j, k + 1]; }
  }
  throw new Error('괄호가 안 닫힘: ' + re);
}
export const grab = (src, re) => { const [a, b] = literalSpan(src, re); return (0, eval)('(' + src.slice(a, b) + ')'); };

export const strip = h => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[a-zA-Z][^>]*>/g, '') /* <보기> 같은 글자는 남긴다 */.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/[ \t]+$/gm, '').replace(/^\s*\n|\n\s*$/g, '').replace(/^[ \t]+/, ''); // 줄 앞 들여쓰기(코드)는 남긴다

/* 탭 단추 → { 탭 번호: 이름 }. switchTab(n)·data-tab="n"이 있으면 그 번호, 없으면 순서 */
export function tabLabels(src) {
  const out = {};
  let i = 0;
  for (const m of src.matchAll(/<button\b([^>]*\bclass="[^"]*\btab-btn\b[^"]*"[^>]*)>([\s\S]*?)<\/button>/g)) {
    const attrs = m[1];
    const n = (/switchTab\((\d+)\)/.exec(attrs) || /data-tab="(\d+)"/.exec(attrs) || /data-idx="(\d+)"/.exec(attrs) || [, String(i)])[1];
    out[n] = strip(m[2].replace(/<span class="(?:tab-num|tab-pg|tab-ico|ico|icon)"[^>]*>[\s\S]*?<\/span>/g, '')).replace(/\s+/g, ' ');
    i++;
  }
  return out;
}

/* 한 자료의 QUIZ_DATA → 단원 이름별 문제 목록 */
export function quizUnits(src, { prefix }) {
  const data = grab(src, /QUIZ_DATA\s*=/);
  // 뒤에서 Object.assign(QUIZ_DATA, {...})로 탭을 더 붙이는 자료도 있다 (정보 중간고사)
  // Object.assign(QUIZ_DATA, QUIZ_DATA_EXT)처럼 다른 이름을 붙이는 자료도 있다 (정보 기말)
  for (const m of src.matchAll(/Object\.assign\(\s*QUIZ_DATA\s*,\s*([A-Za-z_$][\w$]*)?/g)) {
    Object.assign(data, m[1] ? grab(src, new RegExp('(?:const|let|var)\\s+' + m[1] + '\\s*=')) : grab(src.slice(m.index), /Object\.assign\(\s*QUIZ_DATA\s*,/));
  }
  const labels = tabLabels(src);
  const units = {};
  Object.keys(data).forEach(tab => {
    if (!labels[tab]) throw new Error('탭 이름 없음: ' + tab);
    units[tab] = prefix + labels[tab];
  });
  return { data, units };
}
