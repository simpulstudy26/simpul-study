"""SQLite 저장소. 자료·작업·문제·설정을 data/simpul.db 한 파일에 보관한다 (site/ 밖이라 배포되지 않음)."""
import json
import sqlite3
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
UPLOADS = DATA / 'uploads'
DB_PATH = DATA / 'simpul.db'

DEFAULT_SETTINGS = {
    'provider': 'auto',          # 업로드 작업 기본 AI: auto | gemini | ollama
    'ollama_model': '',          # 비우면 설치된 로컬 모델 중 가장 큰 것을 자동 선택
    'auto_publish': True,        # 검증을 통과한 문제를 바로 학생용 클라우드에 공개
    'verify': True,              # 생성 후 AI가 정답을 한 번 더 검토
    'default_count': 10,         # 자료 하나당 처음 만들 문항 수
    'keeper_enabled': True,      # 무한 모드: 단원별 문항 수가 목표보다 적으면 계속 보충
    'keeper_target': 40,         # 단원별로 유지할 공개 문항 수
    'keeper_provider': 'auto',   # 보충 생성에 쓸 AI. auto = API 우선, 안 되면 로컬. 목표 수에 닿으면 멈추므로 사용량은 단원 수에 비례
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY, name TEXT, subject TEXT, unit TEXT, mime TEXT, path TEXT,
  sha TEXT UNIQUE, text TEXT, chars INTEGER, created REAL);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY, kind TEXT, material_id INTEGER, subject TEXT, unit TEXT, difficulty TEXT,
  count INTEGER, provider TEXT, status TEXT, progress TEXT, made INTEGER DEFAULT 0, error TEXT,
  created REAL, updated REAL);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY, subject TEXT, unit TEXT, difficulty TEXT, question TEXT, choices TEXT,
  answer TEXT, explanation TEXT, source_id INTEGER, provider TEXT, status TEXT, note TEXT,
  fp TEXT UNIQUE, created REAL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX IF NOT EXISTS q_unit ON questions(subject, unit, status);
CREATE INDEX IF NOT EXISTS j_status ON jobs(status);
"""


class Store:
    def __init__(self, path=DB_PATH):
        DATA.mkdir(exist_ok=True)
        UPLOADS.mkdir(exist_ok=True)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(str(path), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        # 서버가 작업 도중 꺼졌다면 다시 대기열로 돌린다.
        self.db.execute("UPDATE jobs SET status='queued', progress='서버 재시작 후 다시 대기' WHERE status='running'")
        self.db.commit()

    def q(self, sql, args=()):
        with self.lock:
            return [dict(r) for r in self.db.execute(sql, args).fetchall()]

    def one(self, sql, args=()):
        rows = self.q(sql, args)
        return rows[0] if rows else None

    def run(self, sql, args=()):
        with self.lock:
            cur = self.db.execute(sql, args)
            self.db.commit()
            return cur.lastrowid

    # ── 설정 ──
    def settings(self):
        values = dict(DEFAULT_SETTINGS)
        for row in self.q('SELECT key, value FROM settings'):
            if row['key'] in values:
                values[row['key']] = json.loads(row['value'])
        return values

    def save_settings(self, changes):
        current = self.settings()
        for key, value in changes.items():
            if key not in DEFAULT_SETTINGS:
                continue
            kind = type(DEFAULT_SETTINGS[key])
            if kind is bool:
                value = bool(value)
            elif kind is int:
                value = max(1, min(int(value), 5000))
            else:
                value = str(value)[:100]
            current[key] = value
            self.run('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)', (key, json.dumps(value)))
        return current

    # ── 작업 ──
    def add_job(self, kind, material_id, subject, unit, difficulty, count, provider):
        now = time.time()
        return self.run('INSERT INTO jobs(kind, material_id, subject, unit, difficulty, count, provider, status, progress, created, updated) '
                        "VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', '대기 중', ?, ?)",
                        (kind, material_id, subject, unit, difficulty, count, provider, now, now))

    def update_job(self, job_id, **fields):
        fields['updated'] = time.time()
        keys = ', '.join(k + '=?' for k in fields)
        self.run('UPDATE jobs SET ' + keys + ' WHERE id=?', (*fields.values(), job_id))
