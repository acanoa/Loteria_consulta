from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

from fastapi import HTTPException

from app.api.routes import list_numbers
from app.schemas.api import FilterType, SortOrder


def make_request() -> tuple[SimpleNamespace, Mock]:
    repository = Mock()
    repository.query_numbers.return_value = ([], 0)
    request = SimpleNamespace(
        app=SimpleNamespace(state=SimpleNamespace(repository=repository))
    )
    return request, repository


@pytest.mark.parametrize("filter_type", [FilterType.STARTS_WITH, FilterType.ENDS_WITH])
class ListNumbersTests(TestCase):
    def test_four_digits_keep_leading_zeros(self) -> None:
        for filter_type in (FilterType.STARTS_WITH, FilterType.ENDS_WITH):
            with self.subTest(filter_type=filter_type):
                request, repository = make_request()

                response = list_numbers(
                    request, filter_type, "0073", SortOrder.ASC, 100, 0
                )

                self.assertEqual(response, {"data": [], "total": 0})
                repository.query_numbers.assert_called_once_with(
                    filter_type.value, "0073", "asc", 100, 0
                )

    def test_rejects_values_outside_two_to_four_digits(self) -> None:
        for filter_value in ("7", "12345"):
            with self.subTest(filter_value=filter_value):
                request, repository = make_request()

                with self.assertRaises(HTTPException) as raised:
                    list_numbers(
                        request,
                        FilterType.ENDS_WITH,
                        filter_value,
                        SortOrder.ASC,
                        100,
                        0,
                    )

                self.assertEqual(raised.exception.status_code, 422)
                repository.query_numbers.assert_not_called()
