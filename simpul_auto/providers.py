"""AI 공급자: Google Gemini API와 Ollama 로컬 AI. 하나가 실패하면 다음 공급자로 자동 전환한다."""
import base64
import json
import os
import re
import socket
import ssl
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

KEY_FILE = Path('/private/tmp/simpul-google-api-key')
FREE_MODELS = 'gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.8-flash'
OLLAMA = os.environ.get('OLLAMA_HOST', 'http://127.0.0.1:11434').rstrip('/')
if not OLLAMA.startswith('http'):
    OLLAMA = 'http://' + OLLAMA


class ProviderError(Exception):
    pass


def gemini_key():
    return os.environ.get('GEMINI_API_KEY') or (KEY_FILE.read_text().strip() if KEY_FILE.exists() else '')


def ssl_context():
    context = ssl.create_default_context()
    if not context.get_ca_certs() and not (os.environ.get('SSL_CERT_FILE') or os.environ.get('SSL_CERT_DIR')):
        system_ca = Path('/etc/ssl/cert.pem')
        if system_ca.is_file():
            context.load_verify_locations(cafile=str(system_ca))
    return context


_models_cache = {'at': 0, 'models': []}


def ollama_models():
    """설치된 Ollama 모델 목록 (30초 캐시). Ollama가 꺼져 있으면 빈 목록."""
    if time.time() - _models_cache['at'] < 30:
        return _models_cache['models']
    models = []
    try:
        with urlopen(OLLAMA + '/api/tags', timeout=2) as response:
            for m in json.load(response).get('models', []):
                caps = m.get('capabilities') or []
                if caps and 'completion' not in caps:
                    continue  # 임베딩 전용 모델 제외
                models.append({'name': m['name'], 'size': m.get('size', 0), 'cloud': bool(m.get('remote_host')),
                               'vision': 'vision' in caps, 'params': (m.get('details') or {}).get('parameter_size', '')})
    except (URLError, OSError, ValueError):
        pass
    _models_cache.update(at=time.time(), models=models)
    return models


def pick_ollama_model(preferred=''):
    models = ollama_models()
    names = [m['name'] for m in models]
    if preferred and preferred in names:
        return preferred
    local = [m for m in models if not m['cloud']] or models
    return max(local, key=lambda m: m['size'])['name'] if local else ''


def status():
    return {'gemini': bool(gemini_key()), 'ollama': ollama_models()}


# ── 공통 JSON 스키마 → Gemini responseSchema(OpenAPI 대문자 타입)로 변환 ──
def _gemini_schema(schema):
    out = {}
    for key, value in schema.items():
        if key == 'type':
            out['type'] = value.upper()
        elif key == 'properties':
            out['properties'] = {k: _gemini_schema(v) for k, v in value.items()}
        elif key == 'items':
            out['items'] = _gemini_schema(value)
        elif key in ('required', 'enum', 'description'):
            out[key] = value
    return out


def _parse_json(text):
    text = (text or '').strip()
    text = re.sub(r'^```(?:json)?\s*|\s*```$', '', text)
    try:
        return json.loads(text)
    except ValueError:
        match = re.search(r'\{.*\}', text, re.S)
        if match:
            try:
                return json.loads(match.group(0))
            except ValueError:
                pass
    raise ProviderError('AI 응답을 JSON으로 읽지 못했습니다.')


def call_gemini(prompt, schema, attachments=()):
    key = gemini_key()
    if not key:
        raise ProviderError('Gemini API 키가 없습니다.')
    parts = [{'text': prompt}] + [{'inline_data': {'mime_type': mime, 'data': base64.b64encode(raw).decode()}} for mime, raw in attachments]
    payload = {'contents': [{'role': 'user', 'parts': parts}],
               'generationConfig': {'responseMimeType': 'application/json', 'responseSchema': _gemini_schema(schema),
                                    'temperature': 0.9, 'maxOutputTokens': 16000}}
    # 무료 운영: 모델마다 무료 사용량이 따로라서 막히면 다음 무료 모델로 넘어간다.
    models = list(dict.fromkeys(m.strip() for m in os.environ.get(
        'GEMINI_MODELS', os.environ.get('GEMINI_MODEL', '') + ',' + FREE_MODELS).split(',') if m.strip()))
    body = json.dumps(payload).encode()
    last = None
    for attempt, model in enumerate(models):
        request = Request('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
                          data=body, headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
        try:
            with urlopen(request, timeout=90, context=ssl_context()) as response:
                result = json.load(response)
            break
        except HTTPError as error:
            last = {403: 'Gemini 키 권한 오류', 400: 'Gemini가 요청을 거절함',
                    404: f'Gemini 모델({model})을 쓸 수 없음 — GEMINI_MODEL 환경변수로 다른 모델 지정',
                    503: 'Gemini 서버 과부하', 429: '무료 사용량 소진'}.get(error.code, f'Gemini 오류 {error.code}')
            if error.code not in (404, 429, 500, 503, 504):
                raise ProviderError(last)
            time.sleep(2)  # 한도·과부하: 잠깐 쉬고 다음 무료 모델로
        except (TimeoutError, socket.timeout):
            last = f'Gemini({model}) 응답 지연'
        except (URLError, OSError) as error:
            if isinstance(getattr(error, 'reason', None), (TimeoutError, socket.timeout)):
                last = f'Gemini({model}) 응답 지연'
                continue
            raise ProviderError('Gemini 연결 실패: ' + str(getattr(error, 'reason', error)))
    else:
        raise ProviderError(last or 'Gemini 응답 없음')
    candidate = (result.get('candidates') or [{}])[0]
    text = ''.join(p.get('text', '') for p in candidate.get('content', {}).get('parts', []) if not p.get('thought'))
    return _parse_json(text), 'gemini:' + model


def call_ollama(prompt, schema, attachments=(), model='', has_text=False):
    model = pick_ollama_model(model)
    if not model:
        raise ProviderError('Ollama가 꺼져 있거나 설치된 모델이 없습니다.')
    images = [base64.b64encode(raw).decode() for mime, raw in attachments if mime.startswith('image/')]
    if attachments and not images and not has_text:
        raise ProviderError('로컬 AI는 PDF 원본을 직접 읽지 못합니다 (스캔 PDF는 Gemini 필요).')
    if images and not next((m['vision'] for m in ollama_models() if m['name'] == model), False):
        vision = [m['name'] for m in ollama_models() if m['vision']]
        if not vision:
            raise ProviderError('사진을 읽을 수 있는 로컬 모델이 없습니다.')
        model = vision[0]
    message = {'role': 'user', 'content': prompt}
    if images:
        message['images'] = images
    payload = {'model': model, 'messages': [message], 'stream': False, 'format': schema,
               'options': {'temperature': 0.8, 'num_ctx': 8192}, 'keep_alive': '10m'}
    request = Request(OLLAMA + '/api/chat', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    try:
        with urlopen(request, timeout=1800) as response:
            result = json.load(response)
    except HTTPError as error:
        raise ProviderError(f'Ollama 오류 {error.code}: ' + error.read().decode('utf-8', 'replace')[:200])
    except (URLError, OSError) as error:
        raise ProviderError('Ollama 연결 실패: ' + str(getattr(error, 'reason', error)))
    return _parse_json(result.get('message', {}).get('content', '')), 'ollama:' + model


def generate(prompt, schema, attachments=(), provider='auto', ollama_model='', fallback=True, has_text=False):
    """provider 순서대로 시도하고, 실패하면 다음 공급자로 넘어간다. (결과, 사용한 공급자 이름) 반환."""
    if provider == 'gemini':
        order = ['gemini', 'ollama']
    elif provider == 'ollama':
        order = ['ollama', 'gemini']
    else:  # auto: API 키가 있으면 빠르고 정확한 Gemini 우선, 실패·한도 초과 시 로컬 AI로 전환
        order = ['gemini', 'ollama']
    if not fallback and provider in ('gemini', 'ollama'):
        order = [provider]
    errors = []
    for name in order:
        if name == 'gemini' and not gemini_key():
            errors.append('Gemini 키 없음')
            continue
        if name == 'ollama' and not ollama_models():
            errors.append('Ollama 꺼짐')
            continue
        try:
            if name == 'gemini':
                return call_gemini(prompt, schema, attachments)
            return call_ollama(prompt, schema, attachments, ollama_model, has_text)
        except ProviderError as error:
            errors.append(str(error))
    raise ProviderError(' / '.join(errors) or '사용할 수 있는 AI가 없습니다.')
