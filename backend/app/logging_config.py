import logging


def configure_logging(environment: str) -> None:
    logging.basicConfig(
        level=logging.DEBUG if environment == "development" else logging.INFO,
        format=(
            "%(asctime)s level=%(levelname)s logger=%(name)s "
            "message=%(message)s"
        ),
        force=True,
    )
