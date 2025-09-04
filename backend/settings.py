from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    FILES_ROOT: Path = Path("/data")
    MAX_FILE_MB: int = 50
    ALLOWED_EXT: str = "pdf,docx,xlsx,jpg,png,zip"
    ACCESS_TOKEN_MIN: int = 120
    ALLOWED_ORIGINS: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

