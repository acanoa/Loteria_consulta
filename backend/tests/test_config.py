import unittest

from pydantic import SecretStr, ValidationError

from app.config import Settings


class SettingsTests(unittest.TestCase):
    def test_production_requires_admin_token(self) -> None:
        with self.assertRaises(ValidationError):
            Settings(
                environment="production",
                database_url=SecretStr(
                    "postgresql://user:pass@db.example/postgres"
                ),
            )

    def test_rejects_invalid_schedule(self) -> None:
        with self.assertRaises(ValidationError):
            Settings(
                database_url=SecretStr(
                    "postgresql://user:pass@localhost/postgres"
                ),
                auto_import_hour="25:90",
            )
