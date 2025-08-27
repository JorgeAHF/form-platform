import os

# Ensure environment variables required by settings are set before importing app
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "testsecret")

from fastapi.testclient import TestClient
from app import app

app.router.on_startup.clear()

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
