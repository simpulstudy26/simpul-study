#!/usr/bin/env node
/* 2학기 기말 자료 HTML에 심풀 학습 노트 디자인을 입힌다. 내용(글·표·문제·스크립트 동작)은 바꾸지 않는다.

   사용: node tools/unify_final_materials.mjs [--root 프로젝트] [파일 ...]
   파일을 주지 않으면 site/materials/s2-final 아래 HTML 전부.

   하는 일
   1) 장식용 이모지만 지운다. O/X 표시(⭕·❌)는 글자 O·X로 바꾸고, 뜻이 있는 기호(★☆✓✔✕✗✘ ❶~❿ ◎)는 남긴다.
   2) <style>·style="" 안의 색을 var(--c-xxxxxx)로 바꾸고, 파일마다 팔레트를 만든다.
        기본(shadcn/ui zinc): 무채색   ·   듀오링고 모드: 듀오링고 웹 색(REA로 확인한 값)
   3) 공통 테마를 붙인다: _theme/material-monochrome.css(구조) → _theme/study-ui.css(디자인) → _theme/study-ui.js(React Bits 효과·모드)
   여러 번 돌려도 결과가 같다(이미 바꾼 색·연결은 지우고 다시 붙인다). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP = new Set(['★', '☆', '✓', '✔', '✕', '✗', '✘']);
const EMOJI = /[\u{1F000}-\u{1FAFF}☀-⛿✀-❵➔-➿⏩-⏳⏸-⏺⬛⬜⭐⭕][︎️⃣\u{1F3FB}-\u{1F3FF}]?(?:‍[\u{1F000}-\u{1FAFF}☀-➿][️]?)*/gu;
const HEX = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

function cleanIcons(s) {
  s = s.replace(/❌|❎/g, 'X').replace(/⭕/g, 'O');
  s = s.replace(/>(\s*)✅(\s*)</g, '>$1O$2<');
  s = s.replace(/➜|➡️?/g, '→').replace(/⬅️?/g, '←').replace(/⬆️?/g, '↑').replace(/⬇️?/g, '↓');
  const strip = m => (KEEP.has(m[0]) ? m : '');
  // 글 앞 장식(“📌 제목”)은 뒤 공백까지 지워 줄이 밀리지 않게 한다
  s = s.replace(new RegExp('([>\'"`(])\\s*((?:' + EMOJI.source + ')\\s*)+', 'gu'), (all, lead) => {
    const kept = all.slice(lead.length).replace(EMOJI, strip);
    return lead + (kept.trim() ? kept : '');
  });
  return s.replace(EMOJI, strip).replace(/️/g, '').replace(/❖/g, '');
}

/* ── 색 ── */
const norm = h => { h = h.toLowerCase(); return h.length === 3 ? h.replace(/./g, c => c + c) : h; };
function hsl(h) {
  const n = parseInt(h, 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let hue = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { h: hue, s, l, d };
}
function gray(h) {
  if (h === 'ffffff') return '#ffffff';
  const { l } = hsl(h);
  return l < .08 ? '#09090b' : l < .18 ? '#18181b' : l < .35 ? '#3f3f46' : l < .65 ? '#52525b' : l < .82 ? '#a1a1aa' : l < .94 ? '#e4e4e7' : '#f4f4f5';
}
const DARK_GRAY = { '#ffffff': '#0e0e11', '#09090b': '#fafafa', '#18181b': '#f4f4f5', '#3f3f46': '#d4d4d8', '#52525b': '#a1a1aa', '#a1a1aa': '#71717a', '#e4e4e7': '#27272a', '#f4f4f5': '#18181b' };

/* 듀오링고 색: [기본, 그림자(진한 색), 옅은 면] — styles/duo.css 머리말과 같은 값 */
const DUO = {
  red: ['#FF4B4B', '#EA2B2B', '#FFDFE0'], orange: ['#FF9600', '#CD7900', '#FFF0D9'], yellow: ['#FFC800', '#E5A000', '#FFF5D3'],
  green: ['#58CC02', '#58A700', '#D7FFB8'], blue: ['#1CB0F6', '#1899D6', '#DDF4FF'], purple: ['#CE82FF', '#A568CC', '#F4E5FF']
};
const DUO_BG = '#131F24';
function family(c) {
  if (c.s < .18 || c.d < .07) return null;
  const x = c.h;
  return x < 16 || x >= 335 ? 'red' : x < 40 ? 'orange' : x < 62 ? 'yellow' : x < 165 ? 'green' : x < 255 ? 'blue' : x < 300 ? 'purple' : 'red';
}
const mix = (a, pct, b) => 'color-mix(in srgb,' + a + ' ' + pct + '%,' + b + ')';
function duoLight(h) {
  const c = hsl(h), f = family(c);
  if (!f) return c.l >= .97 ? '#FFFFFF' : c.l >= .93 ? '#F7F7F7' : c.l >= .84 ? '#E5E5E5' : c.l >= .62 ? '#AFAFAF' : c.l >= .4 ? '#777777' : c.l >= .2 ? '#4B4B4B' : '#3C3C3C';
  const [base, deep, tint] = DUO[f];
  return c.l >= .9 ? tint : c.l >= .74 ? mix(base, 45, '#FFFFFF') : c.l >= .4 ? base : deep;
}
function duoDark(h) {
  const c = hsl(h), f = family(c);
  if (!f) return c.l >= .97 ? DUO_BG : c.l >= .93 ? '#202F36' : c.l >= .84 ? '#37464F' : c.l >= .62 ? '#52656D' : c.l >= .4 ? '#AFAFAF' : c.l >= .2 ? '#DCE6EC' : '#F1F7FB';
  const [base] = DUO[f];
  return c.l >= .9 ? mix(base, 16, DUO_BG) : c.l >= .74 ? mix(base, 40, DUO_BG) : c.l >= .4 ? base : mix(base, 78, '#FFFFFF');
}

function patch(file, root) {
  let s = fs.readFileSync(file, 'utf8');
  // 예전 테마 연결을 걷어 낸다 (효과 엔진이 두 번 돌지 않게)
  s = s.replace(/<link\b[^>]*href=["'][^"']*\/_theme\/(?:material(?:-monochrome)?|study-ui)\.css[^"']*["'][^>]*>\n?/g, '');
  s = s.replace(/<script\b[^>]*src=["'][^"']*\/_theme\/(?:material(?:-monochrome)?|study-ui)\.js[^"']*["'][^>]*>\s*<\/script>\n?/g, '');
  s = s.replace(/<script\b[^>]*data-simpul-effects[^>]*>[\s\S]*?<\/script>/g, '');
  s = s.replace(/<style\b[^>]*data-simpul-monochrome-palette[^>]*>[\s\S]*?<\/style>/g, '');
  s = s.replace(/<script\b[^>]*data-material-theme-init[^>]*>[\s\S]*?<\/script>/g, '');
  if (s.includes('data-simpul-theme="shadcn-zinc"')) {
    s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');
    s = s.replace('개념 정리 미리보기', '개념 정리');
  }
  // 예전 restyle 도구가 넣은 짧은 화면 모드 스크립트만 지운다. 자료 자체 스크립트는 그대로.
  s = s.replace(/<script>([\s\S]*?)<\/script>/g, (all, body) => (body.length < 500 && body.includes('simpul.theme') && body.includes('m-dark') ? '' : all));
  s = cleanIcons(s);

  const used = new Set([...s.matchAll(/--c-([0-9a-fA-F]{6})/g)].map(m => m[1].toLowerCase()));
  const color = (m, h) => { h = norm(h); used.add(h); return 'var(--c-' + h + ')'; };
  s = s.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g, (all, a, css, b) =>
    // #abc { 처럼 색처럼 보이는 id 선택자는 그대로 둔다
    a + css.replace(HEX, (m, h, at) => (/^\s*[{:#>+~]/.test(css.slice(at + m.length)) ? m : color(m, h))) + b);
  s = s.replace(/style="([^"]*)"/g, (all, v) => 'style="' + v.replace(HEX, color) + '"');

  const list = [...used].sort();
  const block = (sel, fn) => sel + '{' + list.map(h => '--c-' + h + ':' + fn(h) + ';').join('') + '}';
  const palette = '<style data-simpul-monochrome-palette>' +
    block(':root', gray) + block('html[data-material-theme="dark"]', h => DARK_GRAY[gray(h)]) +
    block('html[data-material-duo]', duoLight) + block('html[data-material-duo][data-material-theme="dark"]', duoDark) + '</style>';
  // 첫 그림 전에 화면 모드·듀오링고 모드를 정한다 (액자 바깥 사이트 → 저장값 순)
  const init = '<script data-material-theme-init>(function(){var d=document.documentElement,t="dark",o=false;' +
    'try{t=localStorage.getItem("simpul.theme")==="light"?"light":"dark";o=JSON.parse(localStorage.getItem("simpul.duo.v1")||"{}").on===true}catch(e){}' +
    'try{if(parent!==window&&parent.document){var p=parent.document.documentElement;o=p.hasAttribute("data-duo");if(p.getAttribute("data-theme")==="light")t="light"}}catch(e){}' +
    'd.dataset.materialTheme=t;if(o)d.setAttribute("data-material-duo","")})()</script>';
  const theme = path.relative(path.dirname(file), path.join(root, 'site/materials/_theme')).split(path.sep).join('/');
  const wiring = init + palette + '\n<link rel="stylesheet" href="' + theme + '/material-monochrome.css">\n<link rel="stylesheet" href="' + theme +
    '/study-ui.css">\n<script src="' + theme + '/study-ui.js" defer></script>\n';
  s = s.replace('</head>', wiring + '</head>');
  s = s.replace(/<html\b[^>]*>/, tag => tag.includes('simpul-material') ? tag
    : /\bclass=/.test(tag) ? tag.replace(/(\bclass=["'])/, '$1simpul-material ') : tag.slice(0, -1) + ' class="simpul-material">');
  fs.writeFileSync(file, s);
}

const args = process.argv.slice(2);
let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ri = args.indexOf('--root');
if (ri >= 0) { root = path.resolve(args[ri + 1]); args.splice(ri, 2); }
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.html') && !e.name.startsWith('._') ? [path.join(d, e.name)] : []);
const files = args.length ? args.map(f => path.resolve(f)) : walk(path.join(root, 'site/materials/s2-final')).sort();
files.forEach(f => patch(f, root));
console.log('심풀 학습 노트 디자인 적용:', files.length, '개 파일');
