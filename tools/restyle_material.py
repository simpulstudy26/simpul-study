#!/usr/bin/env python3
"""자료 HTML 한 개를 심풀 디자인(shadcn/ui zinc 토큰 + React Bits 움직임)으로 바꾼다.

  python3 tools/restyle_material.py <원본.html> <site/materials/...결과.html>

- 자료 안의 색(#hex)을 var(--c-xxxxxx)로 바꾸고, 라이트·다크 값을 문서 맨 앞 :root에 만든다.
  · 무채색에 가까운 색(slate·종이색 등)은 shadcn zinc 단계로 맞추고 다크에서는 단계를 뒤집는다.
  · 유채색은 라이트에서 원래 색, 다크에서는 밝기를 조절한 같은 색상(연한 바탕 → 어두운 바탕, 진한 글자 → 밝은 글자).
- 본문 글꼴을 Pretendard로 바꾼다(영어 본문용 세리프·손글씨 글꼴은 그대로).
- materials/_theme/material.css · material.js를 붙인다(화면 모드 동기화, BlurText·SpotlightCard·AnimatedContent·ClickSpark).
SVG의 fill/stroke 속성은 건드리지 않고, 다크 모드에서 material.js가 반전 필터로 처리한다.
"""
import colorsys
import os
import re
import sys

ZINC = {50: 'fafafa', 100: 'f4f4f5', 200: 'e4e4e7', 300: 'd4d4d8', 400: 'a1a1aa', 500: '71717a',
        600: '52525b', 700: '3f3f46', 800: '27272a', 900: '18181b', 950: '09090b'}
DARK_OF = {50: '09090b', 100: '18181b', 200: '27272a', 300: '3f3f46', 400: '71717a', 500: 'a1a1aa',
           600: 'a1a1aa', 700: 'd4d4d8', 800: 'e4e4e7', 900: 'f4f4f5', 950: 'fafafa'}
HEX = re.compile(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b')


def norm(h):
    h = h.lower()
    return ''.join(c * 2 for c in h) if len(h) == 3 else h


def rgb(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def to_hex(r, g, b):
    return '%02x%02x%02x' % tuple(max(0, min(255, round(x * 255))) for x in (r, g, b))


def pair(h):
    """(라이트 값, 다크 값)"""
    r, g, b = rgb(h)
    hh, l, s = colorsys.rgb_to_hls(r, g, b)
    chroma = max(r, g, b) - min(r, g, b)
    if h == 'ffffff':
        return '#ffffff', '#0e0e11'          # 카드 바탕
    if chroma < 0.16:                         # 무채색 → zinc
        step = min(ZINC, key=lambda k: abs(colorsys.rgb_to_hls(*rgb(ZINC[k]))[1] - l))
        return '#' + ZINC[step], '#' + DARK_OF[step]
    if l >= 0.88:                             # 연한 색 바탕
        d = colorsys.hls_to_rgb(hh, 0.14, min(s, 0.55))
    elif l >= 0.65:                           # 옅은 테두리·강조
        d = colorsys.hls_to_rgb(hh, 0.32, min(s, 0.6))
    elif l > 0.35:                            # 강조색
        d = colorsys.hls_to_rgb(hh, max(l, 0.64), min(s, 0.85))
    else:                                     # 진한 색 글자
        d = colorsys.hls_to_rgb(hh, 0.78, min(s, 0.75))
    return '#' + h, '#' + to_hex(*d)


def main(src, dst):
    s = open(src, encoding='utf-8').read()
    used = set()

    def sub_hex(text):
        def rep(m):
            h = norm(m.group(1))
            used.add(h)
            return 'var(--c-%s)' % h
        return HEX.sub(rep, text)

    # 1) <style> 안의 색
    s = re.sub(r'(<style[^>]*>)(.*?)(</style>)', lambda m: m.group(1) + sub_hex(m.group(2)) + m.group(3), s, flags=re.S)

    # 2) <script> 밖의 style="..." 속성
    parts = re.split(r'(<script[^>]*>.*?</script>)', s, flags=re.S)
    for i, p in enumerate(parts):
        if i % 2 == 0:
            parts[i] = re.sub(r'style="([^"]*)"', lambda m: 'style="%s"' % sub_hex(m.group(1)), p)
        else:
            # 3) 스크립트 안: CSS 값 자리(: 또는 공백 뒤)에 있는 색만. fill="#.." 같은 SVG 속성과 '#id' 선택자는 그대로
            def js_rep(m):
                h = norm(m.group(2))
                used.add(h)
                return m.group(1) + 'var(--c-%s)' % h
            parts[i] = re.sub(r'([:\s])#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?=[;"\'\s\\),}])', js_rep, p)
    s = ''.join(parts)

    # 4) 글꼴
    s = s.replace("'Noto Sans KR',sans-serif", "'Pretendard Variable',Pretendard,-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif")
    s = s.replace("'Noto Sans KR', sans-serif", "'Pretendard Variable',Pretendard,-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif")

    # 5) 색 변수 + 테마 연결
    light = ';'.join('--c-%s:%s' % (h, pair(h)[0]) for h in sorted(used))
    dark = ';'.join('--c-%s:%s' % (h, pair(h)[1]) for h in sorted(used))
    theme_dir = os.path.relpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site', 'materials', '_theme'),
                                os.path.dirname(os.path.abspath(dst)))
    head = (
        '\n<!-- 심풀 테마: tools/restyle_material.py로 만듦 -->\n'
        "<script>try{if(localStorage.getItem('simpul.theme')!=='light')document.documentElement.classList.add('m-dark')}catch(e){document.documentElement.classList.add('m-dark')}</script>\n"
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">\n'
        '<style>:root{%s}html.m-dark{%s}</style>\n'
        '<link rel="stylesheet" href="%s/material.css">\n'
        '<script src="%s/material.js" defer></script>\n' % (light, dark, theme_dir, theme_dir)
    )
    # 자료 자체 <style>보다 뒤에 와야 헤더 덮어쓰기가 먹으므로 </head> 바로 앞에 넣는다(:root 변수는 순서 무관)
    s = s.replace('</head>', head + '</head>', 1)
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    open(dst, 'w', encoding='utf-8').write(s)
    print('%s: 색 %d개 변환 → %s' % (os.path.basename(src), len(used), dst))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
