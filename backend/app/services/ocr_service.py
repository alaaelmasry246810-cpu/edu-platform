"""OCR & Document Parsing Service — extracts text from PDF and images via OpenAI Vision."""
import base64
import io
import re
from pathlib import Path
from typing import NamedTuple

import fitz  # PyMuPDF
from PIL import Image
from openai import AsyncOpenAI

from app.config import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class PageText(NamedTuple):
    page_num: int
    text: str
    confidence: float


class DocumentParser:
    """Extracts text from PDFs (text-based or scanned) and images."""

    OCR_PROMPT = (
        "استخرج كل النص الموجود في هذه الصورة بالضبط كما هو مكتوب، "
        "من غير أي تعليق أو شرح إضافي. لو الصورة مفيهاش نص واضح، رد بسلسلة فاضية."
    )

    async def parse_pdf(self, file_path: str) -> list[PageText]:
        pages: list[PageText] = []
        doc = fitz.open(file_path)

        for i, page in enumerate(doc):
            # Try native text first (fast, accurate for digital PDFs)
            text = page.get_text("text").strip()
            confidence = 1.0

            if len(text) < 50:
                # Scanned page — render and OCR via vision model
                mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for quality
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                text, confidence = await self._ocr_image_bytes(img_bytes)

            pages.append(PageText(page_num=i + 1, text=text, confidence=confidence))

        doc.close()
        return pages

    async def parse_image(self, file_path: str) -> PageText:
        img = Image.open(file_path)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        text, confidence = await self._ocr_image_bytes(buf.getvalue())
        return PageText(page_num=1, text=text, confidence=confidence)

    async def _ocr_image_bytes(self, img_bytes: bytes) -> tuple[str, float]:
        b64 = base64.b64encode(img_bytes).decode()
        response = await client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": self.OCR_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                    ],
                }
            ],
            temperature=0,
        )
        text = (response.choices[0].message.content or "").strip()
        confidence = 0.9 if text else 0.0
        return text, confidence


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
