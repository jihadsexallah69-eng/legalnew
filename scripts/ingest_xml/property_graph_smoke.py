#!/usr/bin/env python3
"""Build/query a LlamaIndex property graph by projecting metadata directly.

This script:
1) reads JSONL rows with shape {"id", "text", "metadata"}
2) creates LlamaIndex Document objects
3) builds PropertyGraphIndex.from_documents(...) with a custom extractor that
   projects metadata fields into graph nodes/relations
4) runs a few test queries using an LLM-backed synonym retriever
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any, Iterable, Sequence

from llama_index.core import PropertyGraphIndex
from llama_index.core.graph_stores import EntityNode, Relation
from llama_index.core.graph_stores.types import KG_NODES_KEY, KG_RELATIONS_KEY
from llama_index.core.indices.property_graph import LLMSynonymRetriever
from llama_index.core.llms.mock import MockLLM
from llama_index.core.schema import BaseNode, Document, TransformComponent
from llama_index.llms.google_genai import GoogleGenAI


DEFAULT_METADATA_KEYS = [
  "doc_family",
  "authority_level",
  "jurisdiction",
  "instrument",
  "section_id",
  "citation_key",
  "source_scope",
]


def load_env_file(path: Path) -> None:
  if not path.exists():
    return
  for line in path.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
      continue
    key, value = line.split("=", 1)
    key = key.strip()
    if key and key not in os.environ:
      os.environ[key] = value.strip()


def normalize_value(value: Any) -> str:
  if isinstance(value, (str, int, float, bool)):
    return str(value).strip()
  if isinstance(value, list):
    parts = [str(part).strip() for part in value if str(part).strip()]
    return " | ".join(parts).strip()
  return ""


def parse_synonym_output(output: str) -> list[str]:
  parts = [token.strip().lower() for token in output.split("^") if token.strip()]
  expanded: list[str] = []
  seen: set[str] = set()

  for part in parts:
    candidates = {part, part.replace(" ", "_"), part.replace("_", " ")}
    word_tokens = re.findall(r"[a-z0-9]+", part.replace("_", " "))
    for token in word_tokens:
      candidates.add(token)
    if len(word_tokens) > 1:
      candidates.add(" ".join(word_tokens))
      candidates.add("_".join(word_tokens))

    for candidate in candidates:
      cleaned = candidate.strip()
      if not cleaned or cleaned in seen:
        continue
      seen.add(cleaned)
      expanded.append(cleaned)

  return expanded


def expand_entity_ids(value_text: str) -> list[str]:
  base = value_text.lower().strip()
  candidates = {base, base.replace(" ", "_"), base.replace("_", " ")}
  tokens = re.findall(r"[a-z0-9]+", base.replace("_", " "))
  for token in tokens:
    candidates.add(token)
  if len(tokens) > 1:
    candidates.add(" ".join(tokens))
    candidates.add("_".join(tokens))
  normalized = [candidate.strip().capitalize() for candidate in candidates if candidate.strip()]
  return list(dict.fromkeys(normalized))


def preview_text(node: BaseNode, max_chars: int = 180) -> str:
  text = node.get_content().replace("\n", " ").strip()
  if len(text) > max_chars:
    return f"{text[: max_chars - 3]}..."
  return text


class MetadataProjector(TransformComponent):
  """Project selected metadata key/value pairs into graph nodes and edges."""

  metadata_keys: list[str] | None = None
  relation_label: str = "HAS_METADATA"
  value_label: str = "METADATA_VALUE"

  def __call__(
    self, nodes: Sequence[BaseNode], show_progress: bool = False, **kwargs: Any
  ) -> Sequence[BaseNode]:
    for node in nodes:
      existing_nodes = node.metadata.pop(KG_NODES_KEY, [])
      existing_relations = node.metadata.pop(KG_RELATIONS_KEY, [])

      keys = self.metadata_keys or sorted(node.metadata.keys())
      relation_dedupe: set[tuple[str, str]] = set()
      for key in keys:
        if key not in node.metadata:
          continue
        value_text = normalize_value(node.metadata.get(key))
        if not value_text:
          continue

        for entity_id in expand_entity_ids(value_text):
          edge_key = (node.node_id, entity_id)
          if edge_key in relation_dedupe:
            continue
          relation_dedupe.add(edge_key)

          entity_node = EntityNode(
            name=entity_id,
            label=self.value_label,
            properties={
              "metadata_key": key,
              "metadata_value": value_text,
            },
          )
          relation = Relation(
            label=self.relation_label,
            source_id=entity_node.id,
            target_id=node.node_id,
            properties={"metadata_key": key},
          )

          existing_nodes.append(entity_node)
          existing_relations.append(relation)

      node.metadata[KG_NODES_KEY] = existing_nodes
      node.metadata[KG_RELATIONS_KEY] = existing_relations

    return nodes


def load_documents(jsonl_path: Path, limit: int) -> list[Document]:
  docs: list[Document] = []
  with jsonl_path.open("r", encoding="utf-8") as infile:
    for line in infile:
      if limit > 0 and len(docs) >= limit:
        break
      line = line.strip()
      if not line:
        continue
      row = json.loads(line)
      text = row.get("text", "")
      chunk_id = row.get("id")
      metadata = row.get("metadata", {}) if isinstance(row.get("metadata"), dict) else {}
      if not text or not chunk_id:
        continue
      metadata["chunk_id"] = chunk_id
      docs.append(Document(text=text, id_=chunk_id, metadata=metadata))
  if not docs:
    raise ValueError(f"No valid rows found in {jsonl_path}")
  return docs


def build_index(documents: list[Document], metadata_keys: list[str]) -> PropertyGraphIndex:
  projector = MetadataProjector(metadata_keys=metadata_keys)
  return PropertyGraphIndex.from_documents(
    documents=documents,
    transformations=[],  # keep each JSONL row as one document node
    kg_extractors=[projector],
    embed_kg_nodes=False,
    show_progress=False,
  )


def build_synonym_retriever(index: PropertyGraphIndex, model: str) -> Any:
  external_key = os.getenv("GEMINI_API_KEY")
  if external_key:
    llm = GoogleGenAI(model=model, api_key=external_key, temperature=0)
    print(f"Using external LLM model={model} via GEMINI_API_KEY")
  else:
    llm = MockLLM()
    print("GEMINI_API_KEY not found, falling back to MockLLM")

  return LLMSynonymRetriever(
    graph_store=index.property_graph_store,
    llm=llm,
    include_text=True,
    max_keywords=8,
    path_depth=1,
    output_parsing_fn=parse_synonym_output,
  )


def run_queries(index: PropertyGraphIndex, queries: Iterable[str], top_k: int, model: str) -> None:
  synonym_retriever = build_synonym_retriever(index, model=model)
  retriever = index.as_retriever(sub_retrievers=[synonym_retriever], include_text=True)

  for query in queries:
    results = retriever.retrieve(query)
    print(f"\nQuery: {query}")
    print(f"Results: {len(results)}")
    for i, item in enumerate(results[:top_k], start=1):
      print(
        f"{i}. score={item.score} node_id={item.node.node_id} "
        f"text={preview_text(item.node)}"
      )


def main() -> int:
  parser = argparse.ArgumentParser(description="PropertyGraphIndex metadata-projection smoke test")
  parser.add_argument(
    "--jsonl",
    default="data/SOR-2002-227_chunks.jsonl",
    help="Path to source JSONL file",
  )
  parser.add_argument(
    "--limit",
    type=int,
    default=250,
    help="Max rows to load (0 = all)",
  )
  parser.add_argument(
    "--top-k",
    type=int,
    default=3,
    help="Top results to print per query",
  )
  parser.add_argument(
    "--model",
    default="gemini-2.0-flash",
    help="External LLM model for LLMSynonymRetriever",
  )
  parser.add_argument(
    "--metadata-key",
    action="append",
    dest="metadata_keys",
    help="Metadata key to project (repeat flag for multiple keys)",
  )
  parser.add_argument(
    "--query",
    action="append",
    dest="queries",
    help="Query text (repeat flag to add multiple).",
  )
  args = parser.parse_args()

  load_env_file(Path(".env"))
  query_list = args.queries or [
    "federal regulation sections",
    "binding authority levels",
    "IRPR section identifiers",
  ]
  metadata_keys = args.metadata_keys or DEFAULT_METADATA_KEYS

  jsonl_path = Path(args.jsonl)
  documents = load_documents(jsonl_path, args.limit)
  print(f"Loaded {len(documents)} documents from {jsonl_path}")
  print(f"Projecting metadata keys: {', '.join(metadata_keys)}")

  index = build_index(documents, metadata_keys=metadata_keys)
  graph_dict = index.property_graph_store.to_dict()
  print(
    "Index built:"
    f" graph_nodes={len(graph_dict.get('nodes', {}))}"
    f" relations={len(graph_dict.get('relations', {}))}"
    f" triplets={len(graph_dict.get('triplets', []))}"
  )

  run_queries(index, query_list, args.top_k, model=args.model)
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
