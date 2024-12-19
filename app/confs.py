from typing import Literal, TypeVar, overload


ConfScalar = None | int | float | bool | str
ConfStruct = dict[str, 'ConfVal'] | list['ConfVal']
ConfVal = ConfScalar | ConfStruct

ConfTypeName = Literal['list', 'liststr', 'dict', 'str', 'int', 'float', 'bool', 'any', 'struct', 'scalar']


def is_expected_type(val: ConfVal, expect: ConfTypeName):
    TYPE_DATA: dict[str, type | tuple[type, ...]] = {
        'list': list,
        'liststr': (list, str),
        'struct': (list, dict),
        'dict': dict,
        'str': str,
        'int': int,
        'float': float,
        'bool': bool
    }
    try:
        return isinstance(val, TYPE_DATA[expect])
    except KeyError:
        if expect == 'any':
            return True
        # scalar
        return not isinstance(val, (list, dict))


_T = TypeVar('_T')


class ConfDict(dict[str, ConfVal]):
    @overload
    def __getitem__(self, key: tuple[Literal['str'], str]) -> str:  ...

    @overload
    def __getitem__(self, key: tuple[Literal['int'], str]) -> int:  ...

    @overload
    def __getitem__(self, key: tuple[Literal['bool'], str]) -> bool:  ...

    @overload
    def __getitem__(self, key: tuple[Literal['float'], str]) -> float:  ...

    @overload
    def __getitem__(self, key: tuple[Literal['dict'], str]) -> dict[str, ConfVal]:  ...

    @overload
    def __getitem__(self, key: tuple[Literal['list'], str]) -> list[ConfVal]:  ...

    @overload
    def __getitem__(self, key: tuple[Literal['struct'], str]) -> ConfStruct:  ...

    @overload
    def __getitem__(self, key: tuple[Literal['scalar'], str]) -> ConfScalar:  ...

    @overload
    def __getitem__(self, key: tuple[Literal['liststr'], str]) -> list[str]:  ...

    @overload
    def __getitem__(self, key: str) -> ConfVal:  ...

    def __getitem__(self, key: str | tuple[ConfTypeName, str]) -> ConfVal | list[str]:
        if not isinstance(key, tuple):
            return super().__getitem__(key)
        type_name, key = key
        res = super().__getitem__(key)
        if not is_expected_type(res, type_name):
            raise KeyError(f'{key}, found: {type(res).__name__} expected: {type_name}')
        if type_name == 'liststr':
            return [str(el) for el in (res if isinstance(res, list) else (res,))]
        return res

    @overload
    def get_as(self, expected_type: Literal['str'], key: str, default: _T = None) -> str | _T:  ...

    @overload
    def get_as(self, expected_type: Literal['int'], key: str, default: _T = None) -> int | _T:  ...

    @overload
    def get_as(self, expected_type: Literal['bool'], key: str, default: _T = None) -> bool | _T:  ...

    @overload
    def get_as(self, expected_type: Literal['float'], key: str, default: _T = None) -> float | _T:  ...

    @overload
    def get_as(self, expected_type: Literal['dict'], key: str, default: _T = None) -> dict[str, ConfVal] | _T:  ...

    @overload
    def get_as(self, expected_type: Literal['list'], key: str, default: _T = None) -> list[ConfVal] | _T:  ...

    @overload
    def get_as(self, expected_type: Literal['struct'], key: str, default: _T = None) -> ConfStruct | _T:  ...

    @overload
    def get_as(self, expected_type: Literal['scalar'], key: str, default: _T = None) -> ConfScalar | _T:  ...

    @overload
    def get_as(self, expected_type: Literal['liststr'], key: str, default: _T = None) -> list[str] | _T:  ...

    def get_as(self, expected_type: ConfTypeName, key: str, default: _T = None) -> ConfVal | list[str] | _T:
        try:
            res = super().__getitem__(key)
        except KeyError:
            return default
        if not is_expected_type(res, expected_type):
            return default
        if expected_type == 'liststr':
            return [str(el) for el in (res if isinstance(res, list) else (res,))]
        return res

    def copy(self):
        return ConfDict(self)