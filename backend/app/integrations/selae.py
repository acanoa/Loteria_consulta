from __future__ import annotations

import logging
from pathlib import Path
from random import SystemRandom

from playwright.sync_api import sync_playwright


logger = logging.getLogger(__name__)
SELAE_URL = "https://www.loteriasyapuestas.es/es/buscar-decimo"


class SelaeClient:
    def __init__(self, download_dir: Path) -> None:
        self._download_dir = download_dir

    def list_draws(self) -> list[dict[str, str]]:
        with sync_playwright() as playwright:
            browser, context, page = self._page(playwright, accept_downloads=False)
            try:
                self._goto(page)
                self._dismiss_cookies(page)
                page.locator("#lnacNumber").fill(self._random_number())
                options = page.locator("#nextLNACDrawId option").all()
                return [
                    {"id": value, "nombre": " ".join((text or "").split())}
                    for option in options
                    if (value := option.get_attribute("value"))
                    and value != "NONE"
                    and (text := option.text_content())
                ]
            finally:
                context.close()
                browser.close()

    def download_draw(self, draw_id: str) -> Path:
        self._download_dir.mkdir(parents=True, exist_ok=True)
        output = self._download_dir / f"sorteo_{draw_id}.csv"
        if output.exists():
            output.unlink()

        with sync_playwright() as playwright:
            browser, context, page = self._page(playwright, accept_downloads=True)
            try:
                self._goto(page)
                self._dismiss_cookies(page)
                page.locator("#lnacNumber").fill(self._random_number())
                page.locator("#nextLNACDrawId").select_option(value=draw_id)
                page.locator("#lnac").click()
                link = page.locator('a[href*=".csv"]')
                link.wait_for(state="visible", timeout=60_000)
                with page.expect_download(timeout=60_000) as download_info:
                    link.click()
                download_info.value.save_as(output)
                return output
            finally:
                context.close()
                browser.close()

    @staticmethod
    def _page(playwright, accept_downloads: bool):
        browser = playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        context = browser.new_context(
            accept_downloads=accept_downloads,
            locale="es-ES",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            extra_http_headers={
                "Accept": (
                    "text/html,application/xhtml+xml,application/xml;q=0.9,"
                    "image/avif,image/webp,image/apng,*/*;q=0.8,"
                    "application/signed-exchange;v=b3;q=0.7"
                ),
                "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                "Sec-Ch-Ua": (
                    '"Google Chrome";v="125", "Chromium";v="125", '
                    '"Not.A/Brand";v="24"'
                ),
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1",
            },
        )
        page = context.new_page()
        page.set_default_timeout(60_000)
        return browser, context, page

    @staticmethod
    def _goto(page) -> None:
        response = page.goto(SELAE_URL, wait_until="domcontentloaded")
        if response is None or response.status >= 400:
            status = response.status if response is not None else "sin respuesta"
            raise RuntimeError(f"SELAE rechazó la navegación: HTTP {status}")

    @staticmethod
    def _dismiss_cookies(page) -> None:
        button = page.get_by_role("button", name="cookies necesarias", exact=False)
        try:
            button.wait_for(state="visible", timeout=4_000)
            button.click()
        except Exception:
            logger.debug("El aviso de cookies no estaba visible")

    @staticmethod
    def _random_number() -> str:
        return f"{SystemRandom().randrange(100_000):05d}"
