from enum import Enum

from pydantic import BaseModel, Field, field_validator


class FilterType(str, Enum):
    FEWER_THAN = "menos_50"
    STARTS_WITH = "empieza"
    ENDS_WITH = "termina"


class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"


class ManualUpdateRequest(BaseModel):
    sorteo_id: str = Field(min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    sorteo_nombre: str = Field(min_length=1, max_length=255)

    @field_validator("sorteo_nombre")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return " ".join(value.split())
