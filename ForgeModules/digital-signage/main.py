#!/usr/bin/env python3
"""Mural Digital & InfoScreen — UNESP Sorocaba."""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

HTML_CONTENT = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Mural Digital — UNESP Sorocaba</title>
  <style>
    body { background: #0f1414; color: #e6edf3; font-family: sans-serif; margin: 0; padding: 40px; }
    h1 { color: #9ce0bd; font-size: 3rem; margin-bottom: 8px; }
    h2 { color: #8b949e; font-size: 1.5rem; margin-top: 0; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-top: 40px; }
    .card { background: #1a2222; border: 1px solid #2a3434; border-radius: 16px; padding: 24px; }
    .card h3 { color: #9ce0bd; margin-top: 0; }
  </style>
</head>
<body>
  <h1>ICTS — UNESP Sorocaba</h1>
  <h2>Mural Digital do Câmpus &bull; Informações em Tempo Real</h2>
  <div class="grid">
    <div class="card">
      <h3>Engenharia de Controle e Automação (ECA)</h3>
      <p><strong>08:00 - 11:40:</strong> Sistemas de Controle I (Lab 3 - Prof. Marcos Paulo)</p>
      <p><strong>14:00 - 17:40:</strong> Robótica Industrial (Lab 3 - Prof. Marcos Paulo)</p>
    </div>
    <div class="card">
      <h3>Engenharia Ambiental (EA)</h3>
      <p><strong>08:00 - 11:40:</strong> Química Geral (Lab 1 - Profa. Ana Costa)</p>
      <p><strong>14:00 - 17:40:</strong> Tratamento de Água (Lab 1 - Profa. Ana Costa)</p>
    </div>
  </div>
</body>
</html>
"""

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path in ('/', '/index.html'):
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(HTML_CONTENT.encode('utf-8'))
        elif self.path == '/health':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'OK')
        else:
            self.send_response(404)
            self.end_headers()

def run():
    server = HTTPServer(('0.0.0.0', 8083), Handler)
    print('[Digital-Signage] Servidor ativo em http://0.0.0.0:8083')
    server.serve_forever()

if __name__ == '__main__':
    run()
