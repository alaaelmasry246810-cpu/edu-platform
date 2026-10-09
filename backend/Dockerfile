# ── Builder: install Python deps into an isolated prefix ─────────
FROM python:3.12-slim AS builder
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Runtime: only what's needed to actually run the app ───────────
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . .

RUN mkdir -p /app/uploads

# Hugging Face Spaces runs containers as UID 1000 regardless of the Dockerfile's
# USER directive, so the app dir must be writable by a non-root user.
RUN chmod -R 777 /app

EXPOSE 8000

# Hosts like Render pass the port in $PORT; default 8000 elsewhere.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers --forwarded-allow-ips=*"]
