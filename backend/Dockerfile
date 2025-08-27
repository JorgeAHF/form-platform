FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Dependencias del sistema mínimas (libffi para bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libffi-dev curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["uvicorn", "app:app"]
CMD ["--host","0.0.0.0","--port","8000"]
