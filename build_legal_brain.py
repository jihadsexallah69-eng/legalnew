#!/usr/bin/env python3
"""
The "Master Builder" for a Canadian immigration legal graph.

Pipeline:
1) Load all data/*.jsonl rows (IRPA + IRPR)
2) Treat each row as an atomic legal unit (no sentence splitter)
3) Build a deterministic legal structure graph + implicit reading-flow edges
4) Stitch IRPR provisions back to IRPA authority sections (Neo4j only)
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any, Sequence

from llama_index.core import Document, PropertyGraphIndex, Settings
from llama_index.embeddings.cohere import CohereEmbedding
from llama_index.core.graph_stores import EntityNode, Relation
from llama_index.core.graph_stores.types import KG_NODES_KEY, KG_RELATIONS_KEY
from llama_index.core.indices.property_graph import (
  ImplicitPathExtractor,
  LLMSynonymRetriever,
  VectorContextRetriever,
)
from llama_index.core.llms.mock import MockLLM
from llama_index.core.schema import BaseNode, NodeRelationship, RelatedNodeInfo, TransformComponent
from llama_index.graph_stores.neo4j import Neo4jPropertyGraphStore
from llama_index.llms.google_genai import GoogleGenAI

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


def normalize_label_token(token: str) -> str:
  cleaned = str(token).strip().lower()
  cleaned = cleaned.replace("(", "").replace(")", "")
  cleaned = cleaned.replace(".", "_")
  cleaned = re.sub(r"[^a-z0-9_]+", "_", cleaned)
  cleaned = re.sub(r"_+", "_", cleaned).strip("_")
  return cleaned or "unknown"


def derive_label_path(metadata: dict[str, Any]) -> list[str]:
  raw_path = metadata.get("label_path")
  if isinstance(raw_path, list) and raw_path:
    return [str(item).strip() for item in raw_path if str(item).strip()]

  section_id = str(metadata.get("section_id", "")).strip()
  doc_family = str(metadata.get("doc_family", "")).strip().upper()
  if not section_id:
    return []

  prefix = f"{doc_family}_"
  if doc_family and section_id.upper().startswith(prefix):
    section_id = section_id[len(prefix):]
  parts = [part for part in section_id.split("_") if part]
  if not parts:
    return []

  label_path = []
  first, tail = parts[0], parts[1:]
  label_path.append(first)
  for part in tail:
    label_path.append(f"({part})")
  return label_path


def section_label_for_depth(depth: int, token: str) -> str:
  if depth == 0:
    return "SECTION"
  plain = token.strip().strip("()")
  if plain.isdigit():
    return "SUBSECTION"
  if plain.isalpha() and len(plain) == 1:
    return "PARAGRAPH"
  return "SUBUNIT"


class LegalStructureProjector(TransformComponent):
  """
  Deterministic legal structure projection.

  Effect:
  INSTRUMENT -> HAS_SECTION -> SECTION/(SUBUNITS) -> HAS_PROVISION -> PROVISION
  """

  def __call__(self, nodes: Sequence[BaseNode], **kwargs: Any) -> Sequence[BaseNode]:
    for node in nodes:
      existing_nodes = node.metadata.get(KG_NODES_KEY, [])
      existing_relations = node.metadata.get(KG_RELATIONS_KEY, [])

      metadata = node.metadata if isinstance(node.metadata, dict) else {}
      doc_family = str(metadata.get("doc_family", "")).strip().upper()
      label_path = derive_label_path(metadata)
      provision_id = str(metadata.get("chunk_id") or node.node_id)
      text = node.get_content()

      if not doc_family or not label_path:
        continue

      instrument_node = EntityNode(
        name=doc_family,
        label="INSTRUMENT",
        properties={"name": doc_family, "doc_family": doc_family},
      )
      existing_nodes.append(instrument_node)

      parent_id = instrument_node.id
      unit_ids: list[str] = []
      for depth, token in enumerate(label_path):
        unit_key = ":".join(
          normalize_label_token(piece) for piece in label_path[: depth + 1]
        )
        unit_id = f"{doc_family}:{unit_key}"
        unit_label = section_label_for_depth(depth, token)
        unit_node = EntityNode(
          name=unit_id,
          label=unit_label,
          properties={
            "doc_family": doc_family,
            "token": str(token),
            "path_depth": depth,
          },
        )
        existing_nodes.append(unit_node)

        relation = Relation(
          label="HAS_SECTION" if depth == 0 else "HAS_SUBUNIT",
          source_id=parent_id,
          target_id=unit_node.id,
          properties={},
        )
        existing_relations.append(relation)
        parent_id = unit_node.id
        unit_ids.append(unit_id)

      provision_node = EntityNode(
        name=provision_id,
        label="PROVISION",
        properties={
          **metadata,
          "text": text,
          "doc_family": doc_family,
          "unit_path": unit_ids,
        },
      )
      existing_nodes.append(provision_node)
      existing_relations.append(
        Relation(
          label="HAS_PROVISION",
          source_id=parent_id,
          target_id=provision_node.id,
          properties={},
        )
      )

      node.metadata[KG_NODES_KEY] = existing_nodes
      node.metadata[KG_RELATIONS_KEY] = existing_relations

    return nodes


def link_reading_flow(documents: list[Document]) -> None:
  for i, doc in enumerate(documents):
    relationships: dict[NodeRelationship, RelatedNodeInfo] = {}
    if i > 0:
      relationships[NodeRelationship.PREVIOUS] = RelatedNodeInfo(
        node_id=documents[i - 1].node_id
      )
    if i < len(documents) - 1:
      relationships[NodeRelationship.NEXT] = RelatedNodeInfo(
        node_id=documents[i + 1].node_id
      )
    if relationships:
      doc.relationships = relationships


def load_documents(folder: Path, limit: int) -> list[Document]:
  docs: list[Document] = []
  files = sorted(folder.glob("*.jsonl"))
  for file in files:
    print(f"📂 Loading {file.name}...")
    with file.open("r", encoding="utf-8") as infile:
      for line in infile:
        if limit > 0 and len(docs) >= limit:
          break
        line = line.strip()
        if not line:
          continue
        row = json.loads(line)
        text = row.get("text", "")
        row_id = row.get("id")
        metadata = row.get("metadata", {}) if isinstance(row.get("metadata"), dict) else {}
        if not text or not row_id:
          continue
        metadata["chunk_id"] = row_id
        docs.append(Document(text=text, id_=row_id, metadata=metadata))
    if limit > 0 and len(docs) >= limit:
      break
  link_reading_flow(docs)
  return docs


def resolve_neo4j_store(uri: str, username: str, password: str) -> Neo4jPropertyGraphStore | None:
  if not uri:
    return None
  if not username or not password:
    raise ValueError("Neo4j URI provided but username/password missing.")
  return Neo4jPropertyGraphStore(username=username, password=password, url=uri)


def stitch_irpr_to_irpa(index: PropertyGraphIndex) -> None:
  print("🧵 Stitching IRPR -> IRPA authority links...")
  store = index.property_graph_store
  if not hasattr(store, "structured_query"):
    print("⚠️ Stitching skipped (graph store does not support structured_query).")
    return

  section_rows = store.structured_query(
    "MATCH (s:SECTION) WHERE s.doc_family='IRPA' RETURN s.name AS name"
  )
  total = 0
  for row in section_rows:
    section_name = str(row.get("name", "")).strip()
    if not section_name:
      continue
    section_number = section_name.split(":")[-1].replace("_", ".")
    params = {
      "section_name": section_name,
      "section_phrase": f"section {section_number} of the act",
      "subsection_phrase": f"subsection {section_number} of the act",
    }
    results = store.structured_query(
      """
      MATCH (act:SECTION {name: $section_name, doc_family: 'IRPA'})
      MATCH (reg:PROVISION)
      WHERE reg.doc_family = 'IRPR'
        AND reg.text IS NOT NULL
        AND (
          toLower(reg.text) CONTAINS $section_phrase
          OR toLower(reg.text) CONTAINS $subsection_phrase
        )
      MERGE (act)-[r:ENABLES]->(reg)
      RETURN count(r) AS links
      """,
      param_map=params,
    )
    if results and "links" in results[0]:
      total += int(results[0]["links"])

  print(f"✅ Stitching complete. ENABLES links created/merged: {total}")


def build_retriever(index: PropertyGraphIndex, top_k: int, llm_model: str):
  sub_retrievers = []
  if index._embed_model and (
    index.property_graph_store.supports_vector_queries or index.vector_store
  ):
    sub_retrievers.append(
      VectorContextRetriever(
        index.property_graph_store,
        vector_store=index.vector_store,
        embed_model=index._embed_model,
        similarity_top_k=top_k,
        path_depth=1,
        include_text=True,
      )
    )

  gemini_key = os.getenv("GEMINI_API_KEY")
  llm = GoogleGenAI(model=llm_model, api_key=gemini_key, temperature=0) if gemini_key else MockLLM()
  sub_retrievers.append(
    LLMSynonymRetriever(index.property_graph_store, llm=llm, include_text=True, path_depth=1)
  )
  return index.as_retriever(
    sub_retrievers=sub_retrievers,
    include_text=True,
  )


def main() -> int:
  load_env_file(Path(".env"))

  parser = argparse.ArgumentParser(description="Build the IRPA/IRPR legal property graph")
  parser.add_argument("--data-dir", default="data")
  parser.add_argument("--limit", type=int, default=0, help="0 = all rows")
  parser.add_argument("--neo4j-db-id", default=os.getenv("NEO4J_DATABASE_ID", ""))
  parser.add_argument("--neo4j-uri", default=os.getenv("NEO4J_URI", ""))
  parser.add_argument("--neo4j-user", default=os.getenv("NEO4J_USERNAME", "neo4j"))
  parser.add_argument("--neo4j-pass", default=os.getenv("NEO4J_PASSWORD", ""))
  parser.add_argument("--skip-stitch", action="store_true")
  parser.add_argument("--query", action="append", dest="queries")
  parser.add_argument("--top-k", type=int, default=3)
  parser.add_argument("--llm-model", default="gemini-2.0-flash")
  args = parser.parse_args()
  embedding_desc = configure_embeddings()

  if not args.neo4j_uri and args.neo4j_db_id:
    args.neo4j_uri = f"neo4j+s://{args.neo4j_db_id}.databases.neo4j.io"
  print(f"🧠 Embeddings: {embedding_desc}")

  print(f"🔌 Neo4j URI: {args.neo4j_uri or '<in-memory>'}")
  graph_store = resolve_neo4j_store(args.neo4j_uri, args.neo4j_user, args.neo4j_pass) if args.neo4j_uri else None

  documents = load_documents(Path(args.data_dir), args.limit)
  print(f"📄 Loaded {len(documents)} legal chunks.")
  if not documents:
    raise ValueError("No documents loaded from JSONL.")

  print("🏗️ Building Property Graph...")
  index = PropertyGraphIndex.from_documents(
    documents=documents,
    transformations=[],
    kg_extractors=[LegalStructureProjector(), ImplicitPathExtractor()],
    property_graph_store=graph_store,
    use_async=False,
    embed_kg_nodes=True,
    show_progress=True,
  )

  if graph_store and not args.skip_stitch:
    stitch_irpr_to_irpa(index)

  queries = args.queries or ["IRPR 179(b)", "IRPA 40", "s.1"]
  print("🔎 Running validation queries...")
  retriever = build_retriever(index, top_k=args.top_k, llm_model=args.llm_model)
  for query in queries:
    results = retriever.retrieve(query)
    print(f"\nQ: {query} | results={len(results)}")
    for i, item in enumerate(results[: args.top_k], start=1):
      text = (item.node.get_content() or "").replace("\n", " ").strip()
      if len(text) > 160:
        text = f"{text[:157]}..."
      print(f"{i}. score={item.score} node_id={item.node.node_id} text={text}")

  print("🎉 Ingestion complete. Legal graph is ready.")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
