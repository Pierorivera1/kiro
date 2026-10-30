#!/usr/bin/env python3
"""Serve the SAME Lambda handler with persistent stdlib SQLite; AWS not required."""
import argparse
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
import app


class RequestHandler(BaseHTTPRequestHandler):
    def dispatch(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = -1
        if not 0 <= length <= 50000:
            result = app.response(400, {'error': 'El tamaño de la solicitud no es válido.'})
        else:
            payload = self.rfile.read(length).decode('utf-8', errors='replace')
            result = app.handler({'rawPath': urlsplit(self.path).path,
                                  'requestContext': {'http': {'method': self.command}}, 'body': payload})
        data = result['body'].encode('utf-8')
        self.send_response(result['statusCode'])
        for name, value in result['headers'].items():
            self.send_header(name, value)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)

    do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = do_OPTIONS = do_HEAD = dispatch

    def log_message(self, format_string, *args):
        # Do not log bodies or student text.
        sys.stderr.write('%s %s\n' % (self.command, self.path))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--mode', choices=['demo', 'bedrock'], default='demo')
    args = parser.parse_args()
    os.environ['MODEL_MODE'] = args.mode
    os.environ.setdefault('LOCAL_DB', str(ROOT / '.local' / 'copiloto.sqlite3'))
    app._application = app.create_application()
    server = ThreadingHTTPServer((args.host, args.port), RequestHandler)
    print(f'Local: http://{args.host}:{server.server_port}/app — mode={args.mode}; persistent SQLite', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
