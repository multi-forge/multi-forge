# -*- coding: utf-8 -*-
"""
pdf_extractor_service.py
==============================================================================
MABI / ForgeOS — Extrator Ultraleve de PDFs Acadêmicos (Pypdf + SQLite Pipeline)
==============================================================================
Processa documentos oficiais da UNESP Sorocaba (grades de horários e calendários),
extrai dados estruturados e realiza ingestão atômica no academic.db local.
Projetado para operar em ambientes com poucos recursos (TV Box ARM / 2GB RAM).
"""

import os
import re
import sys
import io
import urllib.request
import sqlite3
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from pypdf import PdfReader

# Garante path relativo ao projeto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "config", "academic.db")

class AcademicPdfPipeline:
    def __init__(self, db_path: str = None):
        if db_path:
            self.db_path = db_path
        else:
            candidates = [
                DB_PATH,
                os.path.join(os.getcwd(), "config", "academic.db"),
                os.path.join(os.path.dirname(__file__), "..", "..", "config", "academic.db")
            ]
            self.db_path = candidates[0]
            for c in candidates:
                if os.path.exists(c):
                    self.db_path = os.path.abspath(c)
                    break


    def _get_conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def extract_text_from_pdf(self, pdf_input: Any) -> str:
        """Extrai todo o texto do PDF a partir de caminho de arquivo, bytes ou URL."""
        if isinstance(pdf_input, str):
            if pdf_input.startswith("http://") or pdf_input.startswith("https://"):
                req = urllib.request.Request(
                    pdf_input, 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MabiExtractor/1.0'}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    reader = PdfReader(io.BytesIO(resp.read()))
            else:
                reader = PdfReader(pdf_input)
        elif isinstance(pdf_input, (bytes, bytearray)):
            reader = PdfReader(io.BytesIO(pdf_input))
        else:
            reader = PdfReader(pdf_input)

        text_pages = []
        for idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            text_pages.append(page_text)
        return "\n--- PAGE_BREAK ---\n".join(text_pages)

    def parse_schedule_text(self, text: str, course_id: str = "ECA", year: int = 2026, semester: int = 1) -> List[Dict[str, Any]]:
        """
        Parser de alta tolerância para grade horária de aulas da UNESP.
        Identifica linhas com: Dia (ou coluna), Horário (HH:MM - HH:MM), Matéria, Sala e Docente.
        """
        classes = []
        weekday_map = {
            "segunda": 0, "seg": 0,
            "terça": 1, "terca": 1, "ter": 1,
            "quarta": 2, "qua": 2,
            "quinta": 3, "qui": 3,
            "sexta": 4, "sex": 4,
            "sábado": 5, "sabado": 5, "sab": 5
        }

        # Padrão típico de horário: HH:MM às HH:MM ou HH:MM - HH:MM
        time_pattern = re.compile(r'(\d{1,2}[:h]\d{2})\s*(?:-|às|as)\s*(\d{1,2}[:h]\d{2})', re.IGNORECASE)

        lines = [line.strip() for line in text.splitlines() if line.strip()]
        current_weekday = 0
        current_term = "1º Termo"

        for line in lines:
            # Identificação de cabeçalho de termo
            term_match = re.search(r'(\d+[ºo]?\s*Termo)', line, re.IGNORECASE)
            if term_match:
                current_term = term_match.group(1)

            # Identificação de dia da semana na linha
            line_lower = line.lower()
            for w_name, w_idx in weekday_map.items():
                if w_name in line_lower and (f"{w_name}-feira" in line_lower or len(w_name) > 3):
                    current_weekday = w_idx
                    break

            match = time_pattern.search(line)
            if match:
                start_raw, end_raw = match.groups()
                start_time = start_raw.replace('h', ':').rjust(5, '0')
                end_time = end_raw.replace('h', ':').rjust(5, '0')

                # Remove o horário da linha para analisar o restante (disciplina, sala, professor)
                rest = line[:match.start()] + " " + line[match.end():]
                tokens = [t.strip() for t in rest.split('|') if t.strip()]
                
                if len(tokens) >= 3:
                    subject = tokens[0]
                    room = tokens[1]
                    teacher = tokens[2]
                else:
                    # Divisão heurística por hífen ou tabs
                    sub_parts = [p.strip() for p in rest.split('-') if p.strip()]
                    subject = sub_parts[0] if sub_parts else "Disciplina Geral"
                    room = "Sala D1"
                    teacher = "Docente Responsável"
                    for part in sub_parts[1:]:
                        if "sala" in part.lower() or "lab" in part.lower() or "d" in part.lower():
                            room = part
                        elif "prof" in part.lower():
                            teacher = part

                classes.append({
                    "course_id": course_id,
                    "academic_year": year,
                    "semester": semester,
                    "term": current_term,
                    "subject_code": subject[:15].upper(),
                    "subject_name": subject,
                    "class_group": "A",
                    "professor_name": teacher,
                    "weekday": current_weekday,
                    "start_time": start_time,
                    "end_time": end_time,
                    "room": room,
                    "status": "current"
                })

        return classes

    def parse_calendar_text(self, text: str, year: int = 2026) -> List[Dict[str, Any]]:
        """
        Parser para calendário escolar e portarias da UNESP.
        Identifica datas (DD/MM ou AAAA-MM-DD), categorias e descrição dos eventos.
        """
        events = []
        lines = [line.strip() for line in text.splitlines() if line.strip()]

        # Padrão: DD/MM a DD/MM ou DD/MM/AAAA ou DD/MM
        date_pattern = re.compile(r'(\d{1,2}/\d{1,2}(?:/\d{2,4})?)(?:\s*(?:a|à|-)\s*(\d{1,2}/\d{1,2}(?:/\d{2,4})?))?', re.IGNORECASE)

        for line in lines:
            m = date_pattern.search(line)
            if m:
                d_start_raw = m.group(1)
                d_end_raw = m.group(2) or d_start_raw

                def format_date(d_str: str) -> str:
                    parts = d_str.split('/')
                    if len(parts) == 2:
                        return f"{year}-{int(parts[1]):02d}-{int(parts[0]):02d}"
                    elif len(parts) == 3:
                        y = parts[2] if len(parts[2]) == 4 else f"20{parts[2]}"
                        return f"{y}-{int(parts[1]):02d}-{int(parts[0]):02d}"
                    return d_str

                d_start = format_date(d_start_raw)
                d_end = format_date(d_end_raw)
                desc = (line[:m.start()] + " " + line[m.end():]).strip()
                desc = re.sub(r'^[-\s:;]+|[-\s:;]+$', '', desc)

                if len(desc) > 3:
                    cat = "periodo_letivo"
                    desc_lower = desc.lower()
                    if "matrícula" in desc_lower or "matricula" in desc_lower:
                        cat = "matricula"
                    elif "feriado" in desc_lower or "recesso" in desc_lower:
                        cat = "feriado"
                    elif "exame" in desc_lower or "prova" in desc_lower:
                        cat = "exames"

                    events.append({
                        "academic_year": year,
                        "semester": 1 if "-01-" in d_start or "-02-" in d_start or "-03-" in d_start or "-04-" in d_start or "-05-" in d_start or "-06-" in d_start or "-07-" in d_start else 2,
                        "category": cat,
                        "title": desc,
                        "date_start": d_start,
                        "date_end": d_end,
                        "description": desc
                    })
        return events

    def ingest_classes(self, classes_data: List[Dict[str, Any]], source_doc: str = "upload.pdf") -> int:
        """Insere ou atualiza turmas no academic.db em uma única transação atômica."""
        if not classes_data:
            return 0

        conn = self._get_conn()
        cursor = conn.cursor()
        inserted = 0

        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            for c in classes_data:
                # Deduplicação por disciplina, dia, horário e sala
                cursor.execute("""
                    SELECT id FROM classes 
                    WHERE subject_name = ? AND weekday = ? AND start_time = ? AND room = ? AND status = 'current'
                """, (c["subject_name"], c["weekday"], c["start_time"], c["room"]))
                
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO classes (
                            course_id, academic_year, semester, term, subject_code,
                            subject_name, class_group, professor_name, weekday,
                            start_time, end_time, room, source_document, fetched_at, status, provenance_type
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'current', 'PDF_EXTRACTOR')
                    """, (
                        c.get("course_id", "ECA"),
                        c.get("academic_year", 2026),
                        c.get("semester", 1),
                        c.get("term", "1º Termo"),
                        c.get("subject_code", "GERAL"),
                        c["subject_name"],
                        c.get("class_group", "A"),
                        c.get("professor_name", "Docente"),
                        c["weekday"],
                        c["start_time"],
                        c["end_time"],
                        c["room"],
                        source_doc,
                        now_iso
                    ))
                    inserted += 1
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

        return inserted

    def ingest_calendar(self, calendar_events: List[Dict[str, Any]], source_doc: str = "upload.pdf") -> int:
        """Insere eventos no academic_calendar de forma atômica."""
        if not calendar_events:
            return 0

        conn = self._get_conn()
        cursor = conn.cursor()
        inserted = 0
        try:
            for ev in calendar_events:
                cursor.execute("""
                    SELECT id FROM academic_calendar 
                    WHERE title = ? AND date_start = ?
                """, (ev["title"], ev["date_start"]))
                
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO academic_calendar (
                            academic_year, semester, category, title, date_start, date_end, description
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        ev.get("academic_year", 2026),
                        ev.get("semester", 1),
                        ev.get("category", "periodo_letivo"),
                        ev["title"],
                        ev["date_start"],
                        ev.get("date_end", ev["date_start"]),
                        ev.get("description", ev["title"])
                    ))
                    inserted += 1
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

        return inserted

    def process_pdf_full(self, pdf_input: Any, doc_type: str = "schedule", source_name: str = "documento.pdf") -> Dict[str, Any]:
        """Circuito completo: extração -> normalização -> ingestão no banco."""
        text = self.extract_text_from_pdf(pdf_input)
        if not text.strip():
            return {"status": "empty", "message": "Nenhum texto pôde ser extraído do PDF."}

        if doc_type == "calendar":
            events = self.parse_calendar_text(text)
            count = self.ingest_calendar(events, source_doc=source_name)
            return {"status": "success", "type": "calendar", "total_parsed": len(events), "new_inserted": count}
        else:
            classes = self.parse_schedule_text(text)
            count = self.ingest_classes(classes, source_doc=source_name)
            return {"status": "success", "type": "schedule", "total_parsed": len(classes), "new_inserted": count}

if __name__ == "__main__":
    extractor = AcademicPdfPipeline()
    print("Pipeline de Extração Acadêmica MABI pronto.")
    print("Banco configurado em:", DB_PATH)
