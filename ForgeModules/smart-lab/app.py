#!/usr/bin/env python3
"""Smart Lab Management — UNESP Sorocaba."""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

LABS = {
    "campus": "UNESP Sorocaba",
    "laboratorios": [
        {"id": "lab-eca-1", "nome": "Laboratório de Circuitos e Eletrônica", "bancadas_totais": 12, "ocupadas": 5, "energia_ativa": True},
        {"id": "lab-eca-2", "nome": "Laboratório de Robótica e Controle", "bancadas_totais": 8, "ocupadas": 3, "energia_ativa": True},
        {"id": "lab-amb-1", "nome": "Laboratório de Química e Recursos Hídricos", "bancadas_totais": 10, "ocupadas": 4, "energia_ativa": True}
    ]
}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(LABS, ensure_ascii=False, indent=2).encode('utf-8'))

def run():
    server = HTTPServer(('0.0.0.0', 8084), Handler)
    print('[Smart-Lab] API ativa em http://0.0.0.0:8084')
    server.serve_forever()

if __name__ == '__main__':
    run()
