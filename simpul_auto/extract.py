"""올린 자료에서 텍스트를 꺼낸다. 추가 설치 없이 macOS 기본 기능(PDFKit, textutil)과 파이썬 표준 라이브러리만 쓴다."""
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path

TEXT_EXT = {'.txt', '.md', '.csv', '.tsv', '.json'}
HTML_EXT = {'.html', '.htm'}
PDF_EXT = {'.pdf'}
IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.webp'}
OFFICE_EXT = {'.docx', '.doc', '.rtf', '.odt', '.pages'}
ALLOWED_EXT = TEXT_EXT | HTML_EXT | PDF_EXT | IMAGE_EXT | OFFICE_EXT
MIME = {'.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}


class _TextParser(HTMLParser):
    SKIP = {'script', 'style', 'noscript', 'svg', 'head', 'template'}
    BLOCK = {'p', 'div', 'li', 'tr', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'table', 'dt', 'dd'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag in self.BLOCK:
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        elif tag in self.BLOCK:
            self.parts.append('\n')

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def html_text(raw):
    parser = _TextParser()
    parser.feed(raw)
    return clean(''.join(parser.parts))


def clean(text):
    text = re.sub(r'[ \t ]+', ' ', text)
    text = re.sub(r'\n\s*\n+', '\n\n', text)
    return text.strip()


_JXA_PDF = '''
ObjC.import('PDFKit');
function run(argv) {
  var doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(argv[0]));
  if (!doc) return '';
  var s = doc.string;
  return s ? ObjC.unwrap(s) : '';
}
'''


def pdf_text(path):
    try:
        out = subprocess.run(['osascript', '-l', 'JavaScript', '-e', _JXA_PDF, str(path)],
                             capture_output=True, timeout=180, check=False)
        text = out.stdout.decode('utf-8', 'replace')
        if text.strip():
            return clean(text)
    except (OSError, subprocess.TimeoutExpired):
        pass
    try:  # 다른 운영체제이거나 PDFKit이 실패하면 pypdf가 있을 때만 시도
        from pypdf import PdfReader
        return clean('\n'.join(page.extract_text() or '' for page in PdfReader(str(path)).pages))
    except Exception:
        return ''


def office_text(path):
    try:
        out = subprocess.run(['textutil', '-convert', 'txt', '-stdout', str(path)], capture_output=True, timeout=120, check=False)
        return clean(out.stdout.decode('utf-8', 'replace'))
    except (OSError, subprocess.TimeoutExpired):
        return ''


def extract(path):
    """(text, attachment_mime) 반환. attachment_mime이 있으면 원본 파일을 AI에 그대로 보내야 함(스캔 PDF, 사진)."""
    path = Path(path)
    ext = path.suffix.lower()
    if ext in TEXT_EXT:
        raw = path.read_bytes()
        for enc in ('utf-8-sig', 'cp949'):
            try:
                text = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            text = raw.decode('utf-8', 'replace')
        if ext == '.json':
            try:
                text = json.dumps(json.loads(text), ensure_ascii=False, indent=1)
            except ValueError:
                pass
        return clean(text), None
    if ext in HTML_EXT:
        return html_text(path.read_text('utf-8', 'replace')), None
    if ext in PDF_EXT:
        text = pdf_text(path)
        # 글자가 거의 없으면 스캔본으로 보고 원본을 AI(비전)에게 보낸다.
        return text, (None if len(text) >= 300 else MIME['.pdf'])
    if ext in OFFICE_EXT:
        return office_text(path), None
    if ext in IMAGE_EXT:
        return '', MIME[ext]
    raise ValueError('지원하지 않는 파일 형식입니다: ' + ext)


def chunks(text, size=3500, overlap=300):
    """긴 자료를 겹치는 조각으로 나눈다. 조각을 돌아가며 써서 같은 자료로도 계속 다른 문제가 나오게 한다."""
    if len(text) <= size:
        return [text] if text else []
    out, start = [], 0
    while start < len(text):
        out.append(text[start:start + size])
        start += size - overlap
    return out
