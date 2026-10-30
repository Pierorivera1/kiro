"""Behavior contracts, using SQLite and fake Bedrock/DynamoDB (no AWS calls)."""
import base64
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
import app
from storage import SQLiteStore, DynamoStore
from generation import BedrockGenerator, ProviderError, demo_lesson


class AppTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = SQLiteStore(str(Path(self.tmp.name) / 'test.db'))
        self.api = app.Application(self.store, generator=Mock(generate=lambda x: demo_lesson(x)), mode='demo', team='T054')

    def tearDown(self):
        self.tmp.cleanup()

    def call(self, method, path, data=None, status=200):
        event = {'rawPath': path, 'requestContext': {'http': {'method': method}}, 'body': json.dumps(data) if data is not None else None}
        response = self.api.handle(event)
        self.assertEqual(response['statusCode'], status, response['body'])
        return json.loads(response['body']) if 'application/json' in response['headers']['Content-Type'] else response

    def generate(self):
        return self.call('POST', '/sessions/generate', {'moduleId': 'water', 'grade': '5.º primaria', 'duration': 60, 'context': 'Aula multigrado, sin conexión.'}, 201)

    def test_health_team_and_config(self):
        self.assertEqual(self.call('GET', '/health'), {'status': 'ok', 'team': 'T054'})
        self.api.team = 'OTHER'
        self.assertEqual(self.call('GET', '/health')['team'], 'OTHER')
        self.assertEqual(self.call('GET', '/config')['mode'], 'demo')

    def test_item_nonce_round_trip_and_list_isolated(self):
        nonce = '  Ñ\n水🙂  '
        item = self.call('POST', '/items', {'value': nonce}, 201)
        self.assertEqual(item['value'], nonce)
        self.assertEqual(set(item), {'id', 'value'})
        self.assertEqual(self.call('GET', '/items/' + item['id']), item)
        self.generate()
        self.assertEqual(self.call('GET', '/items'), {'items': [item]})
        persisted = SQLiteStore(self.store.path).get('item', item['id'])
        self.assertEqual(persisted['value'], item['value'])
        self.assertIsInstance(persisted['createdAt'], int)

    def test_latest_item_is_listed_after_over_100_existing_records(self):
        for n in range(120):
            self.store.put('item', {'id': f'{n:032x}', 'value': 'older'})
        latest = self.call('POST', '/items', {'value': 'new nonce'}, 201)
        items = self.call('GET', '/items')['items']
        self.assertEqual(len(items), 100)
        self.assertIn(latest, items)
        self.assertTrue(all(set(item) == {'id', 'value'} for item in items))

    def test_nonce_whitespace_is_preserved_not_normalized(self):
        for nonce in ['   ', '\t\n', 'e\u0301水']:
            item = self.call('POST', '/items', {'value': nonce}, 201)
            self.assertEqual(item['value'], nonce)
            self.call('POST', '/jobs', {'input': nonce}, 202)

    def test_job_lazy_completion_exact_inversion(self):
        nonce = '  Ñ\n水🙂  '
        with patch('app.time.time', return_value=100):
            job = self.call('POST', '/jobs', {'input': nonce}, 202)
            result = self.call('GET', '/jobs/' + job['jobId'])
            self.assertEqual(result['status'], 'queued')
            self.assertNotIn('output', result)
        with patch('app.time.time', return_value=102.1):
            result = self.call('GET', '/jobs/' + job['jobId'])
            self.assertEqual(result['status'], 'done')
            self.assertEqual(result['output'], nonce[::-1])
        self.assertEqual(self.store.get('job', job['jobId'])['status'], 'done')

    def test_session_edit_save_list_and_evidence_link(self):
        lesson = self.generate()
        self.assertEqual(lesson['provenance'], 'demo')
        self.assertEqual(lesson['moduleId'], 'water')
        lesson['objective'] = 'Objetivo editado por el docente'
        saved = self.call('PUT', '/sessions/' + lesson['id'], lesson)
        self.assertEqual(saved['status'], 'saved')
        self.assertEqual(self.call('GET', '/sessions/' + lesson['id'])['objective'], lesson['objective'])
        self.assertEqual(self.call('GET', '/sessions')['sessions'][0]['id'], lesson['id'])
        evidence = self.call('POST', '/sessions/' + lesson['id'] + '/evidence', {'text': 'El grupo acordó cerrar el caño. Próximo paso: contrastar ideas.'}, 201)
        self.assertEqual(evidence['sessionId'], lesson['id'])
        self.assertEqual(self.call('GET', '/sessions/' + lesson['id'] + '/evidence')['evidence'], [evidence])
        other = self.generate()
        self.assertEqual(self.call('GET', '/sessions/' + other['id'] + '/evidence'), {'evidence': []})

    def test_save_preserves_model_provenance(self):
        lesson = self.generate()
        lesson['provenance'] = 'bedrock'
        lesson['moduleId'] = 'reading'
        result = self.call('PUT', '/sessions/' + lesson['id'], lesson)
        self.assertEqual(result['provenance'], 'demo')
        self.assertEqual(result['moduleId'], 'water')

    def test_not_found_and_method(self):
        for path in ['/items/nope', '/jobs/nope', '/sessions/nope', '/sessions/nope/evidence', '/unknown', '/app/assets/../app.py']:
            self.call('GET', path, status=404)
        self.call('POST', '/health', {}, 405)
        self.call('DELETE', '/sessions', {}, 405)
        self.call('POST', '/sessions/nope/evidence', {'text': 'hello'}, 404)

    def test_invalid_inputs(self):
        for value in [None, 123, '', 'x' * 2001]:
            self.call('POST', '/items', {'value': value}, 400)
        for value in [None, 5, '', 'x' * 2001]:
            self.call('POST', '/jobs', {'input': value}, 400)
        for change in [{'moduleId': 'missing'}, {'context': 'x' * 1201}, {'duration': True}, {'duration': 1}, {'duration': 60.5}, {'grade': ''}]:
            data = {'moduleId': 'water', 'grade': '5.º', 'duration': 60, 'context': 'Materiales simples'}
            data.update(change)
            self.call('POST', '/sessions/generate', data, 400)
        lesson = self.generate()
        lesson['opening']['minutes'] = 179
        self.call('PUT', '/sessions/' + lesson['id'], lesson, 400)
        self.call('POST', '/sessions/' + lesson['id'] + '/evidence', {'text': '   '}, 400)
        self.call('POST', '/items', [], 400)

    def test_invalid_json_body_and_base64(self):
        for body in ['{', 'x' * 50001, 'null']:
            response = self.api.handle({'rawPath': '/items', 'requestContext': {'http': {'method': 'POST'}}, 'body': body})
            self.assertEqual(response['statusCode'], 400)
        response = self.api.handle({'rawPath': '/items', 'requestContext': {'http': {'method': 'POST'}}, 'isBase64Encoded': True, 'body': base64.b64encode(b'{"value":"hello"}').decode()})
        self.assertEqual(response['statusCode'], 201)

    def test_provider_failure_exposed_not_mocked(self):
        self.api.generator.generate = Mock(side_effect=ProviderError(502, 'No se pudo generar. Inténtalo de nuevo.'))
        self.call('POST', '/sessions/generate', {'moduleId': 'water', 'grade': '5.º', 'duration': 60, 'context': 'Aula rural'}, 502)
        self.assertEqual(self.call('GET', '/sessions'), {'sessions': []})

    def test_html_and_assets(self):
        for route, mime in [('/app', 'text/html'), ('/app/', 'text/html'), ('/app/assets/app.js', 'application/javascript'), ('/app/assets/style.css', 'text/css')]:
            response = self.call('GET', route)
            self.assertIn(mime, response['headers']['Content-Type'])
            self.assertIn('X-Content-Type-Options', response['headers'])
        self.assertIn('Preparar clase', self.call('GET', '/app')['body'])
        self.assertNotIn('innerHTML', Path('src/web/app.js').read_text())


class DynamoTests(unittest.TestCase):
    def test_recent_item_scans_past_first_100_and_includes_new_nonce(self):
        table = Mock()
        table.scan.side_effect = [
            {'Items': [{'data': json.dumps({'id': str(n), 'value': 'old'})} for n in range(100)],
             'ScannedCount': 100, 'LastEvaluatedKey': {'pk': 'next'}},
            {'Items': [{'data': json.dumps({'id': 'new', 'value': 'nonce', 'createdAt': 10})}],
             'ScannedCount': 1},
        ]
        result = DynamoStore(table).list_recent_items()
        self.assertEqual(len(result), 100)
        self.assertEqual(result[0]['value'], 'nonce')
        self.assertEqual(table.scan.call_args_list[1].kwargs['ExclusiveStartKey'], {'pk': 'next'})

    def test_recent_items_scan_budget_is_explicit_error_not_silent_truncation(self):
        table = Mock()
        table.scan.return_value = {'Items': [], 'ScannedCount': 200, 'LastEvaluatedKey': {'pk': 'next'}}
        with self.assertRaises(RuntimeError):
            DynamoStore(table).list_recent_items(scan_budget=400)
        self.assertEqual(table.scan.call_count, 2)

    def test_scan_follows_empty_filtered_page_and_stops_at_100(self):
        table = Mock()
        table.scan.side_effect = [
            {'Items': [], 'LastEvaluatedKey': {'pk': 'session#1'}},
            {'Items': [{'data': json.dumps({'id': 'a', 'value': 'nonce'})}], 'LastEvaluatedKey': {'pk': 'item#a'}},
            {'Items': [{'data': json.dumps({'id': str(n), 'value': 'x'})} for n in range(110)]},
        ]
        result = DynamoStore(table).list('item', 100)
        self.assertEqual(len(result), 100)
        self.assertEqual(result[0]['value'], 'nonce')
        self.assertEqual(table.scan.call_args_list[1].kwargs['ExclusiveStartKey'], {'pk': 'session#1'})
        self.assertEqual(table.scan.call_args_list[0].kwargs['ExpressionAttributeValues'], {':kind': 'item'})


class BedrockTests(unittest.TestCase):
    def setUp(self):
        self.data = {'moduleId': 'water', 'grade': '5.º', 'duration': 60, 'context': 'Aula rural', 'module': {'title': 'Agua', 'text': 'Fuente ficticia'}}
        self.lesson = demo_lesson(self.data)
        self.client = Mock()
        self.client.converse.return_value = {'output': {'message': {'content': [{'text': json.dumps(self.lesson)}]}}}
        self.model = BedrockGenerator(self.client, 'model-under-test', sleep=Mock())

    def test_real_converse_input_and_output(self):
        self.assertEqual(self.model.generate(self.data), self.lesson)
        args = self.client.converse.call_args.kwargs
        self.assertEqual(args['modelId'], 'model-under-test')
        self.assertIn('Aula rural', args['messages'][0]['content'][0]['text'])
        self.assertIn('Fuente ficticia', args['messages'][0]['content'][0]['text'])
        self.assertLessEqual(args['inferenceConfig']['maxTokens'], 2000)

    def test_fenced_json_output(self):
        for label in ('json', '', 'JSON'):
            with self.subTest(label=label):
                text = f'  ```{label}\n{json.dumps(self.lesson)}\n```  '
                self.client.converse.return_value = {'output': {'message': {'content': [{'text': text}]}}}
                self.assertEqual(self.model.generate(self.data), self.lesson)

    def test_fenced_output_still_requires_valid_document_and_lesson(self):
        valid = json.dumps(self.lesson)
        invalid_lesson = json.dumps(dict(self.lesson, opening={'text': 'a', 'minutes': 500}))
        for text in (f'Intro\n```json\n{valid}\n```', f'```json\n{valid}\n```\nOutro',
                     f'```python\n{valid}\n```', f'```json\n{valid}',
                     f'```json\n{invalid_lesson}\n```', '```json\n{}\n```'):
            with self.subTest(text=text[:40]):
                self.client.converse.return_value = {'output': {'message': {'content': [{'text': text}]}}}
                with self.assertRaises(ProviderError) as error:
                    self.model.generate(self.data)
                self.assertEqual(error.exception.status, 502)

    def test_throttle_retry_bounded(self):
        self.client.converse.side_effect = [AwsError('ThrottlingException'), self.client.converse.return_value]
        self.model.generate(self.data)
        self.assertEqual(self.client.converse.call_count, 2)
        self.model.sleep.assert_called_once()

    def test_provider_errors_and_bad_output(self):
        for code, status, attempts in [('ValidationException', 400, 1), ('AccessDeniedException', 502, 1), ('ThrottlingException', 502, 3)]:
            self.client.reset_mock()
            self.client.converse.side_effect = AwsError(code)
            with self.assertRaises(ProviderError) as error:
                self.model.generate(self.data)
            self.assertEqual(error.exception.status, status)
            self.assertEqual(self.client.converse.call_count, attempts)
        self.client.converse.side_effect = None
        for result in ['not JSON', '{}', json.dumps(dict(self.lesson, objective='<script>alert(1)</script>', opening={'text': 'a', 'minutes': 500}))]:
            self.client.converse.return_value = {'output': {'message': {'content': [{'text': result}]}}}
            with self.assertRaises(ProviderError) as error:
                self.model.generate(self.data)
            self.assertEqual(error.exception.status, 502)


class AwsError(Exception):
    def __init__(self, code):
        self.response = {'Error': {'Code': code}}
        super().__init__(code)


if __name__ == '__main__':
    unittest.main()
