from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables.

    Reasonable defaults are provided so the application can run in a
    development environment without the need for a ``.env`` file.  Each value
    can still be overridden via the environment when deploying to production.
    """

    # Default to a local SQLite database so the API can start even if no
    # DATABASE_URL is supplied.  For production a proper database URL should be
    # provided via the environment.
    DATABASE_URL: str = "sqlite:///./local.db"

    # A non-empty JWT secret is required by the app.  Using a deterministic
    # value helps development but should be overridden in production.
    JWT_SECRET: str = "dev-secret"

    # Store uploaded files inside the repository by default which makes local
    # development easier.  docker-compose overrides this with a persistent
    # volume.
    FILES_ROOT: Path = Path("./storage")
    MAX_FILE_MB: int = 50
    ALLOWED_EXT: str = "pdf,docx,xlsx,jpg,png,zip"
    ACCESS_TOKEN_MIN: int = 120
    ALLOWED_ORIGINS: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

