# syntax=docker/dockerfile:1.4

FROM python:3.11.7-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Dependencias para compilar paquetes (libffi para bcrypt)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    build-essential libffi-dev curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --user --no-cache-dir -r requirements.txt

COPY . .

FROM python:3.11.7-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/home/app/.local/bin:$PATH

# Dependencias mínimas de runtime
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    libffi8 && \
    rm -rf /var/lib/apt/lists/*

# Crear usuario sin privilegios
RUN useradd -m app

COPY --from=builder --chown=app:app /root/.local /home/app/.local
COPY --from=builder --chown=app:app /app /app

USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD \
  python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

ENTRYPOINT ["uvicorn", "app:app"]
CMD ["--host","0.0.0.0","--port","8000"]
