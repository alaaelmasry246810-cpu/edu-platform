"""OCR & Document Parsing Service — extracts text from PDF, images, QR codes."""
import io
import re
from pathlib import Path
from typing import NamedTuple

import fitz  # PyMuPDF
from PIL import Image
import pytesseract
import cv2
import numpy as np


class PageText(NamedTuple):
    page_num: int
    text: str
    confidence: float


class DocumentParser:
    """Extracts text from PDFs (text-based or scanned) and images."""

    TESSERACT_LANGS = "ara+eng"

    async def parse_pdf(self, file_path: str) -> list[PageText]:
        pages: list[PageText] = []
        doc = fitz.open(file_path)

        for i, page in enumerate(doc):
            # Try native text first (fast, accurate for digital PDFs)
            text = page.get_text("text").strip()
            confidence = 1.0

            if len(text) < 50:
                # Scanned page — render and OCR
                mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for quality
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_bytes))
                text, confidence = self._ocr_image(img)

            pages.append(PageText(page_num=i + 1, text=text, confidence=confidence))

        doc.close()
        return pages

    async def parse_image(self, file_path: str) -> PageText:
        img = Image.open(file_path)
        text, confidence = self._ocr_image(img)
        return PageText(page_num=1, text=text, confidence=confidence)

    def _ocr_image(self, img: Image.Image) -> tuple[str, float]:
        img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        # Preprocessing for better accuracy
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        denoised = cv2.fastNlMeansDenoising(gray, h=10)
        _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        pil_clean = Image.fromarray(binary)
        data = pytesseract.image_to_data(
            pil_clean, lang=self.TESSERACT_LANGS,
            output_type=pytesseract.Output.DICT
        )

        words = [w for w, c in zip(data["text"], data["conf"]) if int(c) > 40 and w.strip()]
        text = " ".join(words)
        confidences = [int(c) for c in data["conf"] if int(c) > 0]
        avg_conf = sum(confidences) / len(confidences) / 100 if confidences else 0.5
        return text, avg_conf

    async def extract_qr_url(self, file_path: str) -> list[str]:
        """Extract URLs from QR codes in an image."""
        img = cv2.imread(file_path)
        detector = cv2.QRCodeDetector()
        data, _, _ = detector.detectAndDecodeMulti(img)
        return [d for d in (data or []) if d]


class CurriculumChunker:
    """Splits document text into structured chunks for RAG."""

    UNIT_PATTERNS = [
        r"(?:الوحدة|وحدة)\s*(?:الأولى|الثانية|الثالثة|الرابعة|الخامسة|\d+)",
        r"Unit\s+\d+",
        r"UNIT\s+\d+",
    ]
    LESSON_PATTERNS = [
        r"(?:الدرس|درس)\s*(?:الأول|الثاني|الثالث|الرابع|\d+)",
        r"Lesson\s+\d+",
        r"(?:\d+[\.\-]\d+)\s+\w",
    ]

    def detect_structure(self, pages: list[PageText]) -> dict:
        """Auto-detect units and lessons from page text."""
        full_text = "\n".join(p.text for p in pages)
        units = []
        current_unit = {"title": "الوحدة الأولى", "lessons": [], "start_page": 1}
        current_lesson = None

        for page in pages:
            for pattern in self.UNIT_PATTERNS:
                matches = re.findall(pattern, page.text, re.IGNORECASE)
                for match in matches:
                    if current_lesson:
                        current_unit["lessons"].append(current_lesson)
                        current_lesson = None
                    if current_unit["lessons"] or units:
                        units.append(current_unit)
                    current_unit = {"title": match.strip(), "lessons": [], "start_page": page.page_num}

            for pattern in self.LESSON_PATTERNS:
                matches = re.findall(pattern, page.text, re.IGNORECASE)
                for match in matches:
                    if current_lesson:
                        current_unit["lessons"].append(current_lesson)
                    current_lesson = {"title": match.strip(), "start_page": page.page_num, "text": ""}

            if current_lesson:
                current_lesson["text"] += "\n" + page.text

        if current_lesson:
            current_unit["lessons"].append(current_lesson)
        units.append(current_unit)

        # Fallback: if no structure detected, split by page groups
        if len(units) == 1 and not units[0]["lessons"]:
            return self._fallback_structure(pages)

        return {"units": units}

    def _fallback_structure(self, pages: list[PageText]) -> dict:
        """Group every 5 pages as a lesson under one unit."""
        chunk_size = 5
        lessons = []
        for i in range(0, len(pages), chunk_size):
            chunk = pages[i: i + chunk_size]
            lessons.append({
                "title": f"الدرس {i // chunk_size + 1}",
                "start_page": chunk[0].page_num,
                "text": "\n".join(p.text for p in chunk),
            })
        return {"units": [{"title": "الوحدة الأولى", "lessons": lessons, "start_page": 1}]}

    def make_rag_chunks(self, text: str, metadata: dict, chunk_size: int = 800) -> list[dict]:
        """Split text into overlapping chunks for vector storage."""
        words = text.split()
        overlap = 100
        chunks = []
        for i in range(0, len(words), chunk_size - overlap):
            chunk_words = words[i: i + chunk_size]
            chunks.append({
                "text": " ".join(chunk_words),
                "metadata": {**metadata, "chunk_index": len(chunks)},
            })
        return chunks
