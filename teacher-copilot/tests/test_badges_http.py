"""Exercise the public badge contract over real local HTTP, without AWS."""
import json
import os
from pathlib import Path
import re
import select
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]


class BadgeHttpTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.process = None
        self.start_server()

    def tearDown(self):
        self.stop_server()
        self.tempdir.cleanup()

    def start_server(self, team=None):
        env = os.environ.copy()
        for name in ('TEAM_ID', 'TABLE_NAME', 'MODEL_ID'):
            env.pop(name, None)
        env['LOCAL_DB'] = str(Path(self.tempdir.name) / 'records.sqlite3')
        if team is not None:
            env['TEAM_ID'] = team
        self.process = subprocess.Popen(
            [sys.executable, str(ROOT / 'scripts/dev_server.py'), '--port', '0'],
            cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True,
        )
        ready, _, _ = select.select([self.process.stdout], [], [], 10)
        if not ready:
            self.stop_server()
            self.fail('Local HTTP server did not start within 10 seconds')
        line = self.process.stdout.readline()
        match = re.search(r'http://127\.0\.0\.1:(\d+)/app', line)
        if not match:
            self.stop_server()
            self.fail(f'Unexpected server startup: {line!r}')
        self.base = f'http://127.0.0.1:{match.group(1)}'

    def stop_server(self):
        if self.process is not None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
            self.process.stdout.close()
            self.process = None

    def request(self, path, data=None):
        body = None if data is None else json.dumps(data, ensure_ascii=False).encode('utf-8')
        req = Request(self.base + path, data=body, headers={'Content-Type': 'application/json'})
        with urlopen(req, timeout=5) as response:
            return response.status, json.load(response)

    def test_badge_contracts_and_persistence_after_restart(self):
        self.assertEqual(self.request('/health'), (200, {'status': 'ok', 'team': 'T084'}))
        value = '  Prueba ñ水🙂  '
        status, item = self.request('/items', {'value': value})
        self.assertIn(status, (200, 201))
        self.assertTrue(item['id'])
        self.assertEqual(self.request('/items/' + item['id'])[1]['value'], value)
        self.assertTrue(any(x['value'] == value for x in self.request('/items')[1]['items']))

        started = time.monotonic()
        status, job = self.request('/jobs', {'input': value})
        self.assertEqual(status, 202)
        self.assertTrue(job['jobId'])
        # A restart confirms that both records and pending jobs survive the process.
        self.stop_server()
        self.start_server()
        self.assertEqual(self.request('/items/' + item['id'])[1]['value'], value)
        self.assertTrue(any(x['value'] == value for x in self.request('/items')[1]['items']))
        deadline = started + 11.5
        while time.monotonic() < deadline:
            result = self.request('/jobs/' + job['jobId'])[1]
            if result['status'] == 'done':
                break
            time.sleep(0.1)
        else:
            self.fail('Job did not complete within the 12-second contract')
        self.assertEqual(result['output'], value[::-1])

    def test_team_can_be_overridden(self):
        self.stop_server()
        self.start_server(team='custom-team')
        self.assertEqual(self.request('/health')[1]['team'], 'custom-team')


if __name__ == '__main__':
    unittest.main()
