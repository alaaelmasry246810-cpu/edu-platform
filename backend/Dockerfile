# ── Builder: install Python deps into an isolated prefix ─────────
FROM python:3.12-slim AS builder
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Runtime: only what's needed to actually run the app ───────────
FROM python:3.12-slim
WORKDIR /app

# System dependencies for OCR + PDF (runtime libs only, no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-ara \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . .

RUN mkdir -p /app/uploads

# Hugging Face Spaces runs containers as UID 1000 regardless of the Dockerfile's
# USER directive, so the app dir must be writable by a non-root user.
RUN chmod -R 777 /app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
