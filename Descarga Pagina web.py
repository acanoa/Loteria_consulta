from pathlib import Path
from random import SystemRandom

from playwright.sync_api import sync_playwright


URL = "https://www.loteriasyapuestas.es/es/buscar-decimo"

CARPETA_DESCARGAS = Path(__file__).parent / "descargas"
CARPETA_DESCARGAS.mkdir(exist_ok=True)


def descargar_numeros_navidad():
    # Genera un número aleatorio entre 00000 y 99999.
    numero_aleatorio = f"{SystemRandom().randrange(100_000):05d}"

    with sync_playwright() as playwright:
        navegador = playwright.chromium.launch(
            headless=True  # Cambiar a False para ver el navegador.
        )

        contexto = navegador.new_context(
            accept_downloads=True,
            locale="es-ES"
        )

        pagina = contexto.new_page()
        pagina.set_default_timeout(60_000)

        try:
            # 1. Acceder a la página.
            pagina.goto(URL, wait_until="domcontentloaded")

            # 2. Cerrar el aviso de cookies si aparece.
            boton_cookies = pagina.get_by_role(
                "button",
                name="Solo usar cookies necesarias",
                exact=True
            )

            try:
                boton_cookies.wait_for(
                    state="visible",
                    timeout=3_000
                )
                boton_cookies.click()
            except Exception:
                pass

            # 3. Introducir el número aleatorio de cinco cifras.
            pagina.locator("#lnacNumber").fill(numero_aleatorio)

            # 4. Buscar la opción del Sorteo de Navidad.
            selector_sorteo = pagina.locator("#nextLNACDrawId")
            opciones = selector_sorteo.locator("option").all()

            valor_sorteo_navidad = None

            for opcion in opciones:
                texto = opcion.text_content() or ""

                if "SORTEO EXTRAORDINARIO DE NAVIDAD" in texto:
                    valor_sorteo_navidad = opcion.get_attribute("value")
                    break

            if not valor_sorteo_navidad:
                raise RuntimeError(
                    "No se ha encontrado el Sorteo Extraordinario "
                    "de Navidad."
                )

            # 5. Seleccionar el sorteo.
            selector_sorteo.select_option(
                value=valor_sorteo_navidad
            )

            # 6. Pulsar Buscar.
            pagina.locator("#lnac").click()

            # 7. Esperar al enlace del fichero completo.
            enlace_descarga = pagina.get_by_role(
                "link",
                name=(
                    "Ver números asignados a venta online "
                    "o por terminal para este sorteo"
                ),
                exact=False
            )

            enlace_descarga.wait_for(
                state="visible",
                timeout=60_000
            )

            # 8. Descargar el fichero.
            with pagina.expect_download(timeout=60_000) as descarga_info:
                enlace_descarga.click()

            descarga = descarga_info.value

            fichero_salida = (
                CARPETA_DESCARGAS /
                "numeros_navidad.csv"
            )

            descarga.save_as(fichero_salida)

            print("Descarga completada correctamente")
            print(f"Número utilizado: {numero_aleatorio}")
            print(f"Fichero: {fichero_salida.resolve()}")

        finally:
            contexto.close()
            navegador.close()


if __name__ == "__main__":
    descargar_numeros_navidad()