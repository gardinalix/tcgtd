from __future__ import annotations

from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Callable, Iterable


_VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}


def _normalize_space(value: str) -> str:
    return " ".join((value or "").replace("\xa0", " ").split()).strip()


@dataclass
class Node:
    tag: str
    attrs: dict[str, str] = field(default_factory=dict)
    children: list["Node"] = field(default_factory=list)
    parent: "Node | None" = None
    _text_parts: list[str] = field(default_factory=list)

    def get(self, key: str, default: str = "") -> str:
        return str(self.attrs.get(key, default) or default)

    def add_text(self, value: str) -> None:
        if value:
            self._text_parts.append(value)

    def text_content(self) -> str:
        parts: list[str] = []

        def walk(node: "Node") -> None:
            parts.extend(node._text_parts)
            for child in node.children:
                walk(child)

        walk(self)
        return _normalize_space("".join(parts))


class _TreeBuilder(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("document")
        self._stack: list[Node] = [self.root]

    @property
    def current(self) -> Node:
        return self._stack[-1]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag=tag.lower(), attrs={k.lower(): (v or "") for k, v in attrs}, parent=self.current)
        self.current.children.append(node)
        if tag.lower() not in _VOID_TAGS:
            self._stack.append(node)

    def handle_endtag(self, tag: str) -> None:
        target = tag.lower()
        for idx in range(len(self._stack) - 1, 0, -1):
            if self._stack[idx].tag == target:
                del self._stack[idx:]
                return

    def handle_data(self, data: str) -> None:
        self.current.add_text(data)


def parse_html(html_text: str) -> Node:
    parser = _TreeBuilder()
    parser.feed(html_text or "")
    parser.close()
    return parser.root


def iter_descendants(node: Node) -> Iterable[Node]:
    stack = list(reversed(node.children))
    while stack:
        current = stack.pop()
        yield current
        if current.children:
            stack.extend(reversed(current.children))


def node_matches(
    node: Node,
    *,
    tag: str | None = None,
    attr_exists: str | None = None,
    attr_eq: tuple[str, str] | None = None,
    attr_contains: tuple[str, str] | None = None,
) -> bool:
    if tag is not None and node.tag != tag:
        return False
    if attr_exists is not None and attr_exists.lower() not in node.attrs:
        return False
    if attr_eq is not None:
        key, expected = attr_eq
        if _normalize_space(node.get(key)) != expected:
            return False
    if attr_contains is not None:
        key, needle = attr_contains
        if needle not in (node.get(key) or ""):
            return False
    return True


def find_all(
    root: Node,
    *,
    tag: str | None = None,
    attr_exists: str | None = None,
    attr_eq: tuple[str, str] | None = None,
    attr_contains: tuple[str, str] | None = None,
    predicate: Callable[[Node], bool] | None = None,
) -> list[Node]:
    matches: list[Node] = []
    for node in iter_descendants(root):
        if predicate is not None and not predicate(node):
            continue
        if node_matches(
            node,
            tag=tag,
            attr_exists=attr_exists,
            attr_eq=attr_eq,
            attr_contains=attr_contains,
        ):
            matches.append(node)
    return matches


def find_first(
    root: Node,
    *,
    tag: str | None = None,
    attr_exists: str | None = None,
    attr_eq: tuple[str, str] | None = None,
    attr_contains: tuple[str, str] | None = None,
    predicate: Callable[[Node], bool] | None = None,
) -> Node | None:
    for node in iter_descendants(root):
        if predicate is not None and not predicate(node):
            continue
        if node_matches(
            node,
            tag=tag,
            attr_exists=attr_exists,
            attr_eq=attr_eq,
            attr_contains=attr_contains,
        ):
            return node
    return None

