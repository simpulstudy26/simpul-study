#!/usr/bin/env python3
"""2학기 기말 자료(site/materials/s2-final)에서 문제를 빼고, 그 자리에 무한 문제 단원으로 가는 카드를 둔다.

  python3 tools/strip_material_quiz.py

순서: (원본은 tools/material-src/에 보관) → node tools/build_material_bank.mjs → 이 스크립트.
문제는 site/banks/ (무한 문제)에서만 푼다. 카드의 문제 수는 site/banks/index.json에서 읽는다.
- 통합사회 두 자료: QUIZ_DATA를 비우고, 탭마다 있던 확인 문제 칸을 카드로 바꾼다.
- 영어 부교재: PASSAGES의 drills를 지우고 '실전 훈련' 탭을 '문제 풀기' 카드 탭으로 바꾼다.
- 영어 교과서: UNITS의 drill을 지우고 '어휘 훈련' 탭을 '어휘 문제' 카드 탭으로 바꾼다.
원본(tools/material-src/)에서 다시 만들기 때문에 여러 번 실행해도 결과가 같다.
"""
import html
import json
import os
import re
import urllib.parse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'tools', 'material-src')
DST = os.path.join(ROOT, 'site', 'materials', 's2-final')
INDEX = json.load(open(os.path.join(ROOT, 'site', 'banks', 'index.json'), encoding='utf-8'))['subjects']
CLOUD = '../../../cloud.html'  # materials/s2-final/<과목>/x.html 기준


def literal_span(s, pattern):
    """`이름 = [...]`/`{...}` 리터럴의 (시작, 끝) 위치. 문자열 안 괄호는 건너뛴다."""
    m = re.search(pattern, s)
    if not m:
        raise SystemExit('못 찾음: ' + pattern)
    j = m.end()
    while s[j] not in '[{':
        j += 1
    depth, k, quote, esc = 0, j, None, False
    while k < len(s):
        c = s[k]
        if quote:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == quote:
                quote = None
        elif c in '"\'`':
            quote = c
        elif c in '[{':
            depth += 1
        elif c in ']}':
            depth -= 1
            if depth == 0:
                return j, k + 1
        k += 1
    raise SystemExit('괄호가 안 닫힘: ' + pattern)


def card(subject, unit, note='', title='이 부분 문제는 무한 문제에서 풀어요'):
    n = INDEX.get(subject, {}).get('units', {}).get(unit, 0)
    href = CLOUD + '?s=' + subject + '&u=' + urllib.parse.quote(unit)
    return ('<a class="m-practice" target="_top" href="%s"><span class="m-practice-ico" aria-hidden="true">📝</span>'
            '<span class="m-practice-txt"><b>%s</b><small>%s · %d문제 · %s</small></span>'
            '<span class="m-practice-go">무한 문제로 풀기 →</span></a>') % (html.escape(href), html.escape(title), html.escape(unit), n, html.escape(note) if note else '5문제씩 · O/X·객관식')


def read(rel):
    return open(os.path.join(SRC, rel), encoding='utf-8').read()


def write(rel, s):
    open(os.path.join(DST, rel), 'w', encoding='utf-8').write(s)
    print('문제 뺌:', rel)


def tab_labels(s):
    return {int(m.group(1)): m.group(2).strip() for m in re.finditer(r'switchTab\((\d+)\)"[^>]*>(?:<span class="tab-num">\d+</span>)?([^<]+)<', s)}


# ── 통합사회 ──
def social(rel, prefix, slot_re):
    s = read(rel)
    labels = tab_labels(s)
    a, b = literal_span(s, r'QUIZ_DATA\s*=')
    s = s[:a] + '{} /* 문제는 무한 문제(site/banks/social.json)로 옮김 */' + s[b:]
    s = re.sub(slot_re, lambda m: '<div class="m-practice-wrap">' + card('social', prefix(int(m.group(1))) + labels[int(m.group(1))], 'O/X·객관식·고난도') + '</div>', s)
    write(rel, s)


social('social/social2_part_a.html', lambda i: 'Ⅱ. ' if i <= 5 else 'Ⅳ. ', r'<div class="quiz-section" data-tab="(\d+)"></div>')
social('social/social2_part_b.html', lambda i: 'Ⅲ. ', r'<div class="quiz-section" id="quiz-(\d+)"></div>')

# ── 영어 부교재 ──
rel = 'english/english_supplement.html'
s = read(rel)
a, b = literal_span(s, r'PASSAGES\s*=')
passages = json.loads(s[a:b])
for p in passages:
    p.pop('drills', None)
s = s[:a] + json.dumps(passages, ensure_ascii=False, separators=(',', ':')) + s[b:]
units = INDEX['english']['units']
by_lesson = {}
for u in units:
    m = re.match(r'부교재 (\d+)과 · ', u)
    if m:
        by_lesson.setdefault(m.group(1), []).append(u)
cards = {L: ''.join(card('english', u, '5문제씩 풀어요', u.split(' · ')[1] + ' 문제') for u in us) for L, us in by_lesson.items()}
s = s.replace("{group:'훈련',label:'실전 훈련'}", "{group:'문제',label:'문제 풀기'}", 1)
s = re.sub(r"\n\s*renderChoice\('gram'\);renderChoice\('word'\);.*?\n\s*renderScr\(\);\n", '\n', s, count=1, flags=re.S)
s = s.replace('function panelDrills(){', '''const PRACTICE=%s;
function panelDrills(){
  return `<div class="unit-banner">📌 문제는 무한 문제에서 · 어법·낱말·어휘 O/X·순서·요약·배열 문제를 ${P.lesson}과 단원별로 풀어요</div><div class="m-practice-wrap">${PRACTICE[P.lesson]||''}</div>`;
}
function _oldPanelDrills(){''' % json.dumps(cards, ensure_ascii=False), 1)
s = s.replace('실전 훈련의 어휘 선택을 풀어 보세요', '문제 풀기 탭에서 어휘 문제를 풀어 보세요').replace('실전 훈련', '문제 풀기')
assert 'renderChoice(\'gram\');renderChoice' not in s and 'const PRACTICE=' in s and "label:'문제 풀기'" in s
write(rel, s)

# ── 영어 교과서 ──
rel = 'english/english_textbook_u2_u3.html'
s = read(rel)
while re.search(r'\bdrill:\s*\[\s*\{', s):
    a, b = literal_span(s, r'\bdrill:\s*(?=\[\s*\{)')
    s = s[:a] + '[]' + s[b:]
tb = {}
for u in units:
    m = re.match(r'교과서 Unit (\d+) · ', u)
    if m:
        tb.setdefault('u' + m.group(1), []).append(card('english', u, '5문제씩 풀어요', u.split(' · ')[1] + ' 문제'))
s = s.replace("{k:'drill', l:'어휘 훈련', ic:'✏️'}", "{k:'drill', l:'어휘 문제', ic:'📝'}", 1)
s = s.replace('const R = {overview:rOverview, text:rText, para:rPara, gram:rGram, drill:rDrill};',
              'const PRACTICE = %s;\nfunction rPractice(u){ return `<div class="lead">이 단원의 어휘 문제(뜻 고르기·O/X)는 무한 문제에서 풀어요.</div><div class="m-practice-wrap">${(PRACTICE[u.id]||[]).join(\'\')}</div>`; }\n'
              'const R = {overview:rOverview, text:rText, para:rPara, gram:rGram, drill:rPractice};' % json.dumps(tb, ensure_ascii=False), 1)
assert 'drill:rPractice' in s and "l:'어휘 문제'" in s
write(rel, s)
