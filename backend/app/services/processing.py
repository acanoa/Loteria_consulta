from __future__ import annotations

import csv
from pathlib import Path


def parse_lottery_csv(file_path: Path) -> list[tuple[str, int]]:
    if not file_path.is_file() or file_path.stat().st_size == 0:
        raise ValueError("El fichero CSV está vacío o no existe.")

    records: list[tuple[str, int]] = []
    seen: set[str] = set()
    with file_path.open(mode="r", encoding="utf-8-sig", newline="") as stream:
        sample = stream.readline()
        stream.seek(0)
        reader = csv.reader(stream, delimiter=";" if ";" in sample else ",")
        header = next(reader, None)
        if not header:
            raise ValueError("CSV sin cabeceras válidas.")
        normalized = [column.strip().upper() for column in header]
        try:
            number_index = normalized.index("NUMERO")
            fractions_index = normalized.index("FRACCIONES")
        except ValueError:
            raise ValueError(
                "Faltan las columnas NUMERO o FRACCIONES en el CSV."
            ) from None

        for line_number, row in enumerate(reader, start=2):
            if len(row) <= max(number_index, fractions_index):
                continue
            raw_number = "".join(
                character for character in row[number_index] if character.isdigit()
            )
            if not raw_number:
                continue
            number_as_int = int(raw_number)
            if number_as_int > 99_999:
                raise ValueError(f"Línea {line_number}: número fuera de rango")
            number = f"{number_as_int:05d}"
            try:
                fractions = int(row[fractions_index].strip())
            except ValueError:
                raise ValueError(
                    f"Línea {line_number}: fracciones no es un entero"
                ) from None
            if fractions < 0:
                raise ValueError(f"Línea {line_number}: fracciones negativas")
            if number in seen:
                raise ValueError(f"Línea {line_number}: número duplicado {number}")
            seen.add(number)
            records.append((number, fractions))

    if not records:
        raise ValueError("El CSV no contiene registros válidos.")
    return records
