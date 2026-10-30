"""One HTTP API/Lambda handler for the product, static assets and public badge contracts."""
import base64
import json
import logging
import os
import re
import time
import uuid
from pathlib import Path

from generation import BedrockGenerator, DemoGenerator, ProviderError, lesson_fields, required_text
from storage import DynamoStore, SQLiteStore

MODULES = [
    {'id': 'water', 'title': 'El agua en nuestra comunidad', 'label': 'Muestra ficticia · no es material oficial',
     'text': 'El agua se utiliza en el hogar, la escuela y las chacras. Observar cómo la usamos permite reconocer situaciones de desperdicio y proponer acciones para cuidarla. Comparar ideas y justificar acuerdos ayuda a construir una propuesta de acción colectiva.'},
    {'id': 'reading', 'title': 'Leemos para comprender', 'label': 'Muestra ficticia · no es material oficial',
     'text': 'Comprender un texto implica identificar una idea central, relacionarla con experiencias y explicar qué partes sustentan nuestra interpretación. Conversar sobre interpretaciones distintas ayuda a revisar las ideas. El docente ofrece preguntas y oportunidades de releer.'},
]
WEB = Path(__file__).parent / 'web'
ASSETS = {'/app': ('index.html', 'text/html'), '/app/': ('index.html', 'text/html'),
          '/app/assets/app.js': ('app.js', 'application/javascript'), '/app/assets/style.css': ('style.css', 'text/css')}
ID = r'[a-f0-9]{32}'


class ApiError(Exception):
    def __init__(self, status, message):
        self.status = status
        super().__init__(message)


def response(status, data, mime='application/json', extra=None):
    headers = {'Content-Type': mime + '; charset=utf-8', 'X-Content-Type-Options': 'nosniff',
               'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
               'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}
    headers.update(extra or {})
    return {'statusCode': status, 'headers': headers,
            'body': json.dumps(data, ensure_ascii=False) if mime == 'application/json' else data}


def body(event):
    raw = event.get('body') or ''
    if len(raw) > 50000:
        raise ValueError('La solicitud es demasiado grande (máximo 50 000 caracteres).')
    if event.get('isBase64Encoded'):
        raw = base64.b64decode(raw, validate=True).decode('utf-8')
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError('Envía un objeto JSON.')
    return data


def nonce_text(value):
    # Badge nonces are opaque: even all-whitespace strings must round-trip.
    if not isinstance(value, str) or not 1 <= len(value) <= 2000:
        raise ValueError('El valor debe ser texto de 1 a 2000 caracteres.')
    return value


def new_id():
    return uuid.uuid4().hex


class Application:
    def __init__(self, store, generator, mode='bedrock', team='T054'):
        self.store, self.generator, self.mode, self.team = store, generator, mode, team

    def require(self, kind, identifier):
        record = self.store.get(kind, identifier)
        if record is None:
            raise ApiError(404, 'No se encontró el registro.')
        return record

    def handle(self, event):
        try:
            return self.route(event)
        except (ApiError, ProviderError) as error:
            return response(error.status, {'error': str(error)})
        except (ValueError, UnicodeError) as error:
            return response(400, {'error': str(error) if not isinstance(error, json.JSONDecodeError) else 'El JSON no es válido.'})
        except Exception as error:
            # Never log lesson/student text or provider response payloads.
            logging.error('Request failed: %s', type(error).__name__)
            return response(500, {'error': 'No se pudo completar la operación. Tus cambios locales se conservan; vuelve a intentarlo.'})

    def route(self, event):
        path = event.get('rawPath', event.get('path', '/'))
        method = event.get('requestContext', {}).get('http', {}).get('method', event.get('httpMethod', 'GET')).upper()
        if path in ASSETS:
            if method != 'GET':
                return response(405, {'error': 'Método no permitido.'}, extra={'Allow': 'GET'})
            filename, mime = ASSETS[path]
            return response(200, (WEB / filename).read_text(), mime)
        routes = [('/health', ['GET']), ('/config', ['GET']), ('/modules', ['GET']),
                  ('/items', ['GET', 'POST']), (f'/items/{ID}', ['GET']),
                  ('/jobs', ['POST']), (f'/jobs/{ID}', ['GET']),
                  ('/sessions/generate', ['POST']), ('/sessions', ['GET']),
                  (f'/sessions/{ID}', ['GET', 'PUT']), (f'/sessions/{ID}/evidence', ['GET', 'POST'])]
        allowed = next((methods for pattern, methods in routes if re.fullmatch(pattern, path)), None)
        if allowed is None:
            raise ApiError(404, 'No se encontró la ruta o el identificador.')
        if method not in allowed:
            return response(405, {'error': 'Método no permitido.'}, extra={'Allow': ', '.join(allowed)})
        if path == '/health':
            return response(200, {'status': 'ok', 'team': self.team})
        if path == '/config':
            return response(200, {'mode': self.mode, 'team': self.team})
        if path == '/modules':
            return response(200, {'modules': MODULES})
        if path == '/items':
            if method == 'GET':
                return response(200, {'items': self.store.list('item', 100)})
            value = nonce_text(body(event).get('value'))
            return response(201, self.store.put('item', {'id': new_id(), 'value': value}))
        if path.startswith('/items/'):
            return response(200, self.require('item', path.split('/')[2]))
        if path == '/jobs':
            value = nonce_text(body(event).get('input'))
            identifier = new_id()
            self.store.put('job', {'id': identifier, 'jobId': identifier, 'input': value, 'status': 'queued', 'readyAt': time.time() + 2})
            return response(202, {'jobId': identifier})
        if path.startswith('/jobs/'):
            job = self.require('job', path.split('/')[2])
            if job['status'] == 'queued' and time.time() >= job['readyAt']:
                job.update(status='done', output=job['input'][::-1])
                self.store.put('job', job)
            result = {'jobId': job['jobId'], 'status': job['status']}
            if job['status'] == 'done':
                result['output'] = job['output']
            return response(200, result)
        if path == '/sessions/generate':
            data = body(event)
            module = next((m for m in MODULES if m['id'] == data.get('moduleId')), None)
            if not module:
                raise ValueError('Selecciona un módulo disponible.')
            duration = data.get('duration')
            if type(duration) is not int or not 30 <= duration <= 180:
                raise ValueError('La duración debe ser un número entero entre 30 y 180 minutos.')
            context = {'moduleId': module['id'], 'module': module,
                       'grade': required_text(data.get('grade'), 'Grado', 80),
                       'context': required_text(data.get('context'), 'Contexto', 1200), 'duration': duration}
            generated = lesson_fields(self.generator.generate(context), duration)
            lesson = dict(generated, id=new_id(), moduleId=module['id'], moduleTitle=module['title'],
                          grade=context['grade'], context=context['context'], duration=duration,
                          provenance=self.mode, status='draft', createdAt=int(time.time()))
            self.store.put('session', lesson)
            return response(201, lesson)
        if path == '/sessions':
            sessions = self.store.list('session', 100)
            sessions.sort(key=lambda x: x['createdAt'], reverse=True)
            return response(200, {'sessions': sessions})
        parts = path.split('/')
        lesson = self.require('session', parts[2])
        if len(parts) == 3:
            if method == 'GET':
                return response(200, lesson)
            clean = lesson_fields(body(event), lesson['duration'])
            lesson.update(clean, status='saved', updatedAt=int(time.time()))
            return response(200, self.store.put('session', lesson))
        if method == 'GET':
            return response(200, {'evidence': self.store.list('evidence', 100, session_id=lesson['id'])})
        text = required_text(body(event).get('text'), 'Evidencia', 3000)
        evidence = {'id': new_id(), 'sessionId': lesson['id'], 'text': text, 'createdAt': int(time.time())}
        return response(201, self.store.put('evidence', evidence))


_application = None


def create_application():
    """AWS defaults to real Bedrock. Local demo must be explicitly enabled."""
    mode = os.environ.get('MODEL_MODE', 'bedrock')
    if mode not in ['demo', 'bedrock']:
        raise ValueError('MODEL_MODE must be demo or bedrock')
    table = os.environ.get('TABLE_NAME')
    if table or mode == 'bedrock':
        import boto3
        from botocore.config import Config
    store = DynamoStore(boto3.resource('dynamodb').Table(table)) if table else SQLiteStore(os.environ.get('LOCAL_DB', '.local/copiloto.sqlite3'))
    if mode == 'bedrock':
        model_id = os.environ.get('MODEL_ID')
        if not model_id:
            raise ValueError('MODEL_ID is required in bedrock mode')
        client = boto3.client('bedrock-runtime', config=Config(connect_timeout=2, read_timeout=6, retries={'total_max_attempts': 1}))
        generator = BedrockGenerator(client, model_id)
    else:
        generator = DemoGenerator()
    return Application(store, generator, mode, os.environ.get('TEAM_ID', 'T054'))


def handler(event, context=None):
    global _application
    try:
        if _application is None:
            _application = create_application()
        return _application.handle(event)
    except Exception as error:
        logging.error('Initialization failed: %s', type(error).__name__)
        return response(503, {'error': 'El servicio no está configurado. Revisa MODEL_ID, almacenamiento y permisos.'})
