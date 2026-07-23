from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, SecretStr, field_validator, model_validator
from pytz import timezone


APP_SCHEMA = "loteria_numeros"


class Settings(BaseModel):
    environment: Literal["development", "test", "production"] = "development"
    database_url: SecretStr
    cors_origins: tuple[str, ...] = ("http://localhost:8080",)
    admin_api_token: SecretStr | None = None
    auto_import_enabled: bool = True
    auto_import_hour: str = "03:00"
    auto_import_timezone: str = "Europe/Madrid"
    import_stale_minutes: int = Field(default=30, ge=5, le=1440)
    database_pool_min: int = Field(default=1, ge=1, le=20)
    database_pool_max: int = Field(default=5, ge=1, le=50)
    download_dir: Path = Path(__file__).resolve().parents[1] / "descargas"

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr) -> SecretStr:
        parsed = urlparse(value.get_secret_value())
        if parsed.scheme not in {"postgresql", "postgres"} or not parsed.hostname:
            raise ValueError("DATABASE_URL debe ser una URL PostgreSQL completa")
        return value

    @field_validator("auto_import_hour")
    @classmethod
    def validate_hour(cls, value: str) -> str:
        try:
            hour, minute = (int(part) for part in value.split(":"))
        except (TypeError, ValueError):
            raise ValueError("AUTO_IMPORT_HOUR debe usar el formato HH:MM") from None
        if not 0 <= hour <= 23 or not 0 <= minute <= 59:
            raise ValueError("AUTO_IMPORT_HOUR contiene una hora no válida")
        return f"{hour:02d}:{minute:02d}"

    @field_validator("auto_import_timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            timezone(value)
        except Exception:
            raise ValueError("AUTO_IMPORT_TIMEZONE no es una zona IANA válida") from None
        return value

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.database_pool_max < self.database_pool_min:
            raise ValueError("DATABASE_POOL_MAX no puede ser menor que DATABASE_POOL_MIN")
        if self.environment == "production" and self.admin_api_token is None:
            raise ValueError("ADMIN_API_TOKEN es obligatorio en producción")
        if self.environment == "production" and "*" in self.cors_origins:
            raise ValueError("CORS_ORIGINS no puede contener '*' en producción")
        return self

    @classmethod
    def from_env(cls) -> "Settings":
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise RuntimeError("Falta la variable de entorno obligatoria DATABASE_URL")

        origins = tuple(
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", "http://localhost:8080").split(",")
            if origin.strip()
        )
        return cls(
            environment=os.getenv("APP_ENV", "development"),
            database_url=SecretStr(database_url),
            cors_origins=origins,
            admin_api_token=(
                SecretStr(os.environ["ADMIN_API_TOKEN"])
                if os.getenv("ADMIN_API_TOKEN")
                else None
            ),
            auto_import_enabled=os.getenv("AUTO_IMPORT_ENABLED", "true").lower()
            in {"1", "true", "yes"},
            auto_import_hour=os.getenv("AUTO_IMPORT_HOUR", "03:00"),
            auto_import_timezone=os.getenv(
                "AUTO_IMPORT_TIMEZONE", "Europe/Madrid"
            ),
            import_stale_minutes=int(os.getenv("IMPORT_STALE_MINUTES", "30")),
            database_pool_min=int(os.getenv("DATABASE_POOL_MIN", "1")),
            database_pool_max=int(os.getenv("DATABASE_POOL_MAX", "5")),
            download_dir=Path(
                os.getenv(
                    "DOWNLOAD_DIR",
                    str(Path(__file__).resolve().parents[1] / "descargas"),
                )
            ),
        )


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()
