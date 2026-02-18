#!/usr/bin/env python3
"""Build/query a LlamaIndex property graph by projecting metadata directly.

This script:
1) reads JSONL rows with shape {"id", "text", "metadata"}
2) creates LlamaIndex Document objects
3) runs an ingestion pipeline (LegalMetadataExtractor, optional splitter)
4) builds PropertyGraphIndex from processed nodes with a deterministic legal
   structure projector (Instrument -> Section -> Provision)
5) runs a few test queries using an LLM-backed synonym retriever
"""

from __future__ import annotations

import argparse
import json
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Sequence

from llama_index.core import PropertyGraphIndex, Settings
from llama_index.core.extractors import BaseExtractor
from llama_index.core.graph_stores import EntityNode, Relation
from llama_index.core.graph_stores.types import KG_NODES_KEY, KG_RELATIONS_KEY
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.indices.property_graph import (
  ImplicitPathExtractor,
  LLMSynonymRetriever,
  VectorContextRetriever,
)
from llama_index.core.llms.mock import MockLLM
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import BaseNode, Document, TransformComponent
from llama_index.embeddings.cohere import CohereEmbedding
from llama_index.llms.google_genai import GoogleGenAI


DEFAULT_METADATA_KEYS = [
  "doc_family",
  "instrument",
  "section_id",
  "citation_key",
  "normalized_citation",
  "query_aliases",
]

DEFAULT_EMBED_VISIBLE_KEYS = [
  "query_aliases",
  "normalized_citation",
  "legal_scope",
  "excerpt_keywords",
]

_WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9_/-]{2,}")
_STOP_WORDS = {
  "a",
  "an",
  "the",
  "of",
  "and",
  "or",
  "to",
  "in",
  "on",
  "by",
  "for",
  "with",
  "this",
  "that",
  "from",
  "under",
  "shall",
  "may",
  "must",
  "into",
  "such",
  "are",
  "was",
  "were",
}


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


def configure_embeddings() -> str:
  api_key = os.getenv("COHERE_API_KEY", "").strip()
  if not api_key:
    raise ValueError("COHERE_API_KEY is required for Cohere embeddings.")

  model_name = os.getenv("COHERE_EMBED_MODEL", "embed-english-v3.0").strip()
  input_type = os.getenv("COHERE_INPUT_TYPE", "search_document").strip()
  embed_batch_size = int(os.getenv("COHERE_EMBED_BATCH_SIZE", "1"))
  num_workers = int(os.getenv("COHERE_EMBED_NUM_WORKERS", "1"))
  max_retries = int(os.getenv("COHERE_EMBED_MAX_RETRIES", "20"))
  Settings.embed_model = CohereEmbedding(
    api_key=api_key,
    model_name=model_name,
    input_type=input_type,
    embed_batch_size=embed_batch_size,
    num_workers=num_workers,
    max_retries=max_retries,
  )
  return (
    f"Cohere ({model_name}, input_type={input_type}, "
    f"batch={embed_batch_size}, workers={num_workers})"
  )


def neo4j_uri_from_db_id(database_id: str) -> str:
  return f"neo4j+s://{database_id}.databases.neo4j.io"


def resolve_graph_store(
  neo4j_db_id: str | None,
  neo4j_uri: str | None,
  neo4j_username: str | None,
  neo4j_password: str | None,
) -> Any:
  uri = (neo4j_uri or "").strip()
  db_id = (neo4j_db_id or "").strip()
  username = (neo4j_username or "").strip()
  password = (neo4j_password or "").strip()

  if not uri and db_id:
    uri = neo4j_uri_from_db_id(db_id)

  if not uri:
    return None

  if not username or not password:
    print(
      "Neo4j database id/uri detected but credentials are missing; "
      "falling back to in-memory graph store. Set NEO4J_USERNAME and NEO4J_PASSWORD."
    )
    return None

  from llama_index.graph_stores.neo4j import Neo4jPropertyGraphStore

  return Neo4jPropertyGraphStore(
    username=username,
    password=password,
    url=uri,
  )


def normalize_value(value: Any) -> str:
  if isinstance(value, (str, int, float, bool)):
    return str(value).strip()
  return ""


def normalize_values(value: Any) -> list[str]:
  if isinstance(value, list):
    values = [normalize_value(part) for part in value]
    return [item for item in values if item]
  one = normalize_value(value)
  return [one] if one else []


def top_terms(text: str, limit: int) -> list[str]:
  tokens = [token.lower() for token in _WORD_RE.findall(text or "")]
  counts = Counter(token for token in tokens if token not in _STOP_WORDS)
  return [term for term, _ in counts.most_common(limit)]


def section_reference(metadata: dict[str, Any]) -> str:
  doc_family = str(metadata.get("doc_family", "")).strip().upper()
  section_id = str(metadata.get("section_id", "")).strip()
  if not section_id:
    return ""

  prefix = f"{doc_family}_"
  if doc_family and section_id.upper().startswith(prefix):
    section_id = section_id[len(prefix):]

  section_id = section_id.replace("_dot_", ".").replace("_", ".").strip(".")
  return section_id


def section_key(metadata: dict[str, Any]) -> str:
  doc_family = str(metadata.get("doc_family", "")).strip().upper()
  normalized = str(metadata.get("normalized_citation", "")).strip()
  if normalized:
    match = re.search(r"(\d+(?:\.\d+)?)", normalized)
    if match:
      return f"{doc_family}:{match.group(1)}" if doc_family else match.group(1)

  section_ref = section_reference(metadata)
  match = re.match(r"^(\d+(?:\.\d+)?)", section_ref)
  if match:
    return f"{doc_family}:{match.group(1)}" if doc_family else match.group(1)

  return f"{doc_family}:{section_ref}" if doc_family and section_ref else section_ref


def citation_aliases(metadata: dict[str, Any]) -> list[str]:
  doc_family = str(metadata.get("doc_family", "")).strip().upper()
  section_ref = section_reference(metadata)
  citation_key = str(metadata.get("citation_key", "")).strip()

  aliases: list[str] = []
  if citation_key:
    aliases.extend(
      [
        citation_key,
        citation_key.lower(),
        citation_key.replace("_", " "),
      ]
    )

  if doc_family and section_ref:
    aliases.extend(
      [
        f"{doc_family} {section_ref}",
        f"Section {section_ref} of {doc_family}",
        f"Regulation {section_ref}",
        f"s.{section_ref}",
        f"R{section_ref}",
      ]
    )

  return list(dict.fromkeys(alias for alias in aliases if alias.strip()))


def ensure_embed_visible(nodes: Sequence[BaseNode], keys: Sequence[str]) -> None:
  visible_keys = set(keys)
  for node in nodes:
    excluded = getattr(node, "excluded_embed_metadata_keys", None) or []
    node.excluded_embed_metadata_keys = [key for key in excluded if key not in visible_keys]


class LegalMetadataExtractor(BaseExtractor):
  """Enrich each node with legal aliases and lexical hints for retrieval."""

  top_k_terms: int = 8

  async def aextract(self, nodes: Sequence[BaseNode]) -> list[dict[str, Any]]:
    metadata_list: list[dict[str, Any]] = []
    for node in nodes:
      metadata = node.metadata if isinstance(node.metadata, dict) else {}
      doc_family = str(metadata.get("doc_family", "")).strip().upper()
      instrument = str(metadata.get("instrument", "")).strip().lower()
      authority_level = str(metadata.get("authority_level", "")).strip().lower()
      citation_key = str(metadata.get("citation_key") or metadata.get("section_id") or "").strip()
      keywords = ", ".join(top_terms(node.get_content(), self.top_k_terms))

      legal_scope = "|".join(
        part for part in [doc_family, instrument, authority_level] if part
      )
      metadata_list.append(
        {
          "normalized_citation": citation_key.upper() if citation_key else "",
          "legal_scope": legal_scope,
          "query_aliases": citation_aliases(metadata),
          "excerpt_keywords": keywords,
        }
      )

    return metadata_list


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
      if cleaned in _STOP_WORDS:
        continue
      seen.add(cleaned)
      expanded.append(cleaned)

  return expanded


def expand_entity_ids(value_text: str) -> list[str]:
  base = value_text.lower().strip()
  candidates = {base, base.replace(" ", "_"), base.replace("_", " ")}
  tokens = re.findall(r"[a-z0-9]+", base.replace("_", " "))
  for token in tokens:
    if token not in _STOP_WORDS:
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


class LegalStructureProjector(TransformComponent):
  """Project deterministic legal structure: Instrument -> Section -> Provision."""

  def __call__(
    self, nodes: Sequence[BaseNode], show_progress: bool = False, **kwargs: Any
  ) -> Sequence[BaseNode]:
    last_provision_by_section: dict[str, str] = {}
    global_relation_dedupe: set[tuple[str, str, str]] = set()

    for node in nodes:
      existing_nodes = node.metadata.pop(KG_NODES_KEY, [])
      existing_relations = node.metadata.pop(KG_RELATIONS_KEY, [])
      metadata = node.metadata if isinstance(node.metadata, dict) else {}
      chunk_id = str(metadata.get("chunk_id") or node.node_id)
      doc_family = str(metadata.get("doc_family", "")).strip().upper()
      section_id = section_key(metadata)
      normalized_citation = str(metadata.get("normalized_citation", "")).strip()
      citation_key = str(metadata.get("citation_key", "")).strip()

      if not doc_family or not section_id or not chunk_id:
        node.metadata[KG_NODES_KEY] = existing_nodes
        node.metadata[KG_RELATIONS_KEY] = existing_relations
        continue

      instrument_node = EntityNode(
        name=doc_family,
        label="INSTRUMENT",
        properties={"doc_family": doc_family},
      )
      section_node = EntityNode(
        name=section_id,
        label="SECTION",
        properties={"doc_family": doc_family},
      )
      provision_node = EntityNode(
        name=chunk_id,
        label="PROVISION",
        properties={
          "doc_family": doc_family,
          "section_id": section_id,
          "citation_key": citation_key,
          "normalized_citation": normalized_citation,
        },
      )
      existing_nodes.extend([instrument_node, section_node, provision_node])

      base_relations = [
        Relation(label="HAS_SECTION", source_id=instrument_node.id, target_id=section_node.id, properties={}),
        Relation(label="HAS_PROVISION", source_id=section_node.id, target_id=provision_node.id, properties={}),
      ]
      for relation in base_relations:
        dedupe_key = (relation.label, relation.source_id, relation.target_id)
        if dedupe_key in global_relation_dedupe:
          continue
        global_relation_dedupe.add(dedupe_key)
        existing_relations.append(relation)

      previous = last_provision_by_section.get(section_id)
      if previous and previous != provision_node.id:
        next_rel = Relation(
          label="NEXT",
          source_id=previous,
          target_id=provision_node.id,
          properties={"section_id": section_id},
        )
        dedupe_key = (next_rel.label, next_rel.source_id, next_rel.target_id)
        if dedupe_key not in global_relation_dedupe:
          global_relation_dedupe.add(dedupe_key)
          existing_relations.append(next_rel)
      last_provision_by_section[section_id] = provision_node.id

      aliases = metadata.get("query_aliases")
      for alias in normalize_values(aliases):
        for alias_id in expand_entity_ids(alias):
          alias_node = EntityNode(
            name=alias_id,
            label="CITE_ALIAS",
            properties={"doc_family": doc_family, "alias": alias},
          )
          alias_rel = Relation(
            label="REFERS_TO",
            source_id=alias_node.id,
            target_id=provision_node.id,
            properties={"section_id": section_id},
          )
          dedupe_key = (alias_rel.label, alias_rel.source_id, alias_rel.target_id)
          if dedupe_key in global_relation_dedupe:
            continue
          global_relation_dedupe.add(dedupe_key)
          existing_nodes.append(alias_node)
          existing_relations.append(alias_rel)

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


def build_nodes(
  documents: list[Document],
  chunk_size: int,
  chunk_overlap: int,
  top_k_terms: int,
  use_sentence_splitter: bool,
) -> list[BaseNode]:
  transformations: list[Any] = [LegalMetadataExtractor(top_k_terms=top_k_terms)]
  if use_sentence_splitter:
    transformations.insert(
      0, SentenceSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    )
  pipeline = IngestionPipeline(transformations=transformations)
  nodes = pipeline.run(documents=documents)
  ensure_embed_visible(nodes, DEFAULT_EMBED_VISIBLE_KEYS)
  return nodes


def build_index(
  nodes: list[BaseNode],
  property_graph_store: Any = None,
) -> PropertyGraphIndex:
  projector = LegalStructureProjector()
  return PropertyGraphIndex(
    nodes=nodes,
    kg_extractors=[projector, ImplicitPathExtractor()],
    property_graph_store=property_graph_store,
    use_async=False,
    embed_kg_nodes=False,
    show_progress=True,
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
  vector_retriever = VectorContextRetriever(
    index.property_graph_store,
    vector_store=index.vector_store,
    embed_model=index._embed_model,
    similarity_top_k=top_k,
    path_depth=1,
    include_text=True,
  )
  retriever = index.as_retriever(
    sub_retrievers=[vector_retriever, synonym_retriever],
    include_text=True,
  )

  for query in queries:
    results = retriever.retrieve(query)
    print(f"\nQuery: {query}")
    print(f"Results: {len(results)}")
    for i, item in enumerate(results[:top_k], start=1):
      print(
        f"{i}. score={item.score} node_id={item.node.node_id} "
        f"text={preview_text(item.node)}"
      )


def print_graph_summary(index: PropertyGraphIndex) -> None:
  graph_store = index.property_graph_store
  if hasattr(graph_store, "to_dict"):
    graph_dict = graph_store.to_dict()
    print(
      "Index built:"
      f" graph_nodes={len(graph_dict.get('nodes', {}))}"
      f" relations={len(graph_dict.get('relations', {}))}"
      f" triplets={len(graph_dict.get('triplets', []))}"
    )
    return

  schema_str = ""
  if hasattr(graph_store, "get_schema_str"):
    try:
      schema_str = graph_store.get_schema_str()
    except Exception:
      schema_str = ""
  print(
    "Index built:"
    f" graph_store={type(graph_store).__name__}"
    f" schema_chars={len(schema_str)}"
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
    "--chunk-size",
    type=int,
    default=1024,
    help="Sentence splitter chunk size",
  )
  parser.add_argument(
    "--chunk-overlap",
    type=int,
    default=20,
    help="Sentence splitter chunk overlap",
  )
  parser.add_argument(
    "--top-k-terms",
    type=int,
    default=5,
    help="Top lexical terms to store in excerpt_keywords",
  )
  parser.add_argument(
    "--use-sentence-splitter",
    action="store_true",
    help="Enable SentenceSplitter (keep disabled for pre-chunked IRPA/IRPR JSONL).",
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
  parser.add_argument(
    "--show-node-metadata",
    action="store_true",
    help="Print metadata sample from the first processed node.",
  )
  parser.add_argument(
    "--neo4j-db-id",
    default="",
    help="Neo4j Aura database id (e.g. d83d90d2)",
  )
  parser.add_argument(
    "--neo4j-uri",
    default="",
    help="Neo4j URI (if omitted, derived from --neo4j-db-id)",
  )
  parser.add_argument(
    "--neo4j-username",
    default="",
    help="Neo4j username",
  )
  parser.add_argument(
    "--neo4j-password",
    default="",
    help="Neo4j password",
  )
  args = parser.parse_args()

  load_env_file(Path(".env"))
  embedding_desc = configure_embeddings()
  print(f"Embeddings: {embedding_desc}")
  if not args.neo4j_db_id:
    args.neo4j_db_id = os.getenv("NEO4J_DATABASE_ID", "")
  if not args.neo4j_uri:
    args.neo4j_uri = os.getenv("NEO4J_URI", "")
  if not args.neo4j_username:
    args.neo4j_username = os.getenv("NEO4J_USERNAME", "")
  if not args.neo4j_password:
    args.neo4j_password = os.getenv("NEO4J_PASSWORD", "")
  query_list = args.queries or [
    "federal regulation sections",
    "binding authority levels",
    "IRPR section identifiers",
  ]
  metadata_keys = args.metadata_keys or DEFAULT_METADATA_KEYS

  jsonl_path = Path(args.jsonl)
  documents = load_documents(jsonl_path, args.limit)
  print(f"Loaded {len(documents)} documents from {jsonl_path}")
  nodes = build_nodes(
    documents,
    chunk_size=args.chunk_size,
    chunk_overlap=args.chunk_overlap,
    top_k_terms=args.top_k_terms,
    use_sentence_splitter=args.use_sentence_splitter,
  )
  print(f"Processed {len(nodes)} nodes via ingestion pipeline")
  print(f"Projecting metadata keys: {', '.join(metadata_keys)}")
  if args.show_node_metadata and nodes:
    sample = nodes[0].metadata
    print(
      "Sample metadata keys:",
      ", ".join(sorted(sample.keys())),
    )
    aliases = sample.get("query_aliases")
    if aliases:
      print("Sample query_aliases:", aliases[:8] if isinstance(aliases, list) else aliases)

  graph_store = resolve_graph_store(
    neo4j_db_id=args.neo4j_db_id,
    neo4j_uri=args.neo4j_uri,
    neo4j_username=args.neo4j_username,
    neo4j_password=args.neo4j_password,
  )
  if graph_store is not None:
    effective_uri = (args.neo4j_uri or "").strip() or neo4j_uri_from_db_id(args.neo4j_db_id.strip())
    print(f"Using Neo4j graph store at {effective_uri}")
  else:
    print("Using in-memory SimplePropertyGraphStore (no Neo4j config provided)")

  index = build_index(nodes, property_graph_store=graph_store)
  print_graph_summary(index)

  run_queries(index, query_list, args.top_k, model=args.model)
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
