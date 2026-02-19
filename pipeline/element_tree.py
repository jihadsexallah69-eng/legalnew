#!/usr/bin/env python3
from typing import Any


def _heading_text(node: dict[str, Any]) -> str:
    return (node.get("text") or "").strip()


def build_tree(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not raw:
        return []

    node_map: dict[str, dict[str, Any]] = {}
    children_map: dict[str, list[str]] = {}
    roots: list[str] = []
    seen_ids: set[str] = set()

    # First pass: create nodes and validate duplicates.
    for idx, item in enumerate(raw):
        element_id = str(item.get("element_id", "")).strip()
        if not element_id:
            raise ValueError("element_id cannot be empty")
        if element_id in seen_ids:
            raise ValueError(f"duplicate element_id: {element_id}")
        seen_ids.add(element_id)

        node_map[element_id] = {
            "element_id": element_id,
            "type": item.get("type", "Unknown"),
            "text": item.get("text"),
            "metadata": item.get("metadata", {}) or {},
            "source_index": idx,
            "parent_id": (item.get("metadata", {}) or {}).get("parent_id"),
            "root_id": None,
            "parent_chain": [],
            "heading_path": [],
        }

    # Second pass: build edges independent of source order.
    for element_id, node in node_map.items():
        parent_id = node.get("parent_id")
        if parent_id and parent_id in node_map:
            children_map.setdefault(parent_id, []).append(element_id)
        else:
            roots.append(element_id)

    # Stable traversal order for deterministic outputs.
    for key in children_map:
        children_map[key].sort(key=lambda eid: node_map[eid]["source_index"])
    roots.sort(key=lambda eid: node_map[eid]["source_index"])

    visited: set[str] = set()
    in_stack: set[str] = set()

    def dfs(element_id: str, root_id: str, chain: list[str], headings: list[str]) -> None:
        if element_id in in_stack:
            raise ValueError(f"cycle detected at element_id={element_id}")
        if element_id in visited:
            return

        in_stack.add(element_id)
        node = node_map[element_id]

        node["parent_chain"] = chain.copy()
        node["root_id"] = root_id
        # heading_path should represent headings above this node, not including itself.
        node["heading_path"] = headings.copy()

        next_headings = headings
        if node.get("type") == "Title":
            heading = _heading_text(node)
            if heading:
                next_headings = headings + [heading]

        for child_id in children_map.get(element_id, []):
            dfs(child_id, root_id, chain + [element_id], next_headings)

        in_stack.remove(element_id)
        visited.add(element_id)

    for root_id in roots:
        dfs(root_id, root_id, [], [])

    # If any nodes remain unvisited (edge-case malformed graph), traverse them as synthetic roots.
    for element_id in sorted(node_map.keys(), key=lambda eid: node_map[eid]["source_index"]):
        if element_id not in visited:
            dfs(element_id, element_id, [], [])

    result = list(node_map.values())
    result.sort(key=lambda x: x["source_index"])
    return result


def validate_tree(elements: list[dict[str, Any]]) -> tuple[bool, list[dict[str, Any]]]:
    errors: list[dict[str, Any]] = []
    seen: set[str] = set()

    for el in elements:
        eid = el.get("element_id")
        if not eid:
            errors.append({"error": "missing_element_id"})
            continue

        if eid in seen:
            errors.append({"error": "duplicate_element_id", "element_id": eid})
        seen.add(eid)

        if not el.get("root_id"):
            errors.append({"error": "missing_root_id", "element_id": eid})

        chain = el.get("parent_chain", [])
        if not isinstance(chain, list):
            errors.append({"error": "invalid_parent_chain", "element_id": eid})
        elif eid in chain:
            errors.append({"error": "self_in_parent_chain", "element_id": eid})

    return len(errors) == 0, errors
