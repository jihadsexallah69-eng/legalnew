#!/usr/bin/env python3
import math
from datetime import date
from typing import Any
from pydantic import BaseModel, Field, field_validator, model_validator


SCHEMA_VERSION = "1.0.0"
LEGAL_UNIT_TYPES = {"policy_rule", "glossary", "directory", "toc", "outline", "table"}
LEGAL_SCOPES = {"default", "glossary", "links", "toc"}
AUTHORITY_LEVEL_NUM_MAP = {
    # Binding legislation tiers.
    "statute": 4,
    "act": 4,
    "regulation": 4,
    # Subordinate binding policy tiers.
    "ministerial_instruction": 3,
    "mi": 3,
    "public_policy": 3,
    # Operational policy tiers.
    "policy": 2,
    "manual": 2,
    "voi": 2,
    "guide": 2,
    # Secondary/supporting.
    "secondary": 1,
    "commentary": 1,
    "reference": 1,
    "jurisprudence": 1,
    "case_law": 1,
    # Non-default retrieval scopes.
    "glossary": 0,
    "directory": 0,
    "toc": 0,
    "outline": 0,
}
ZERO_PRIORITY_UNIT_TYPES = {"glossary", "directory", "toc", "outline"}


class RawElement(BaseModel):
    element_id: str
    type: str
    text: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("element_id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        if not v:
            raise ValueError("element_id cannot be empty")
        return v

    @field_validator("text")
    @classmethod
    def validate_text_presence(cls, v: str | None, info: Any) -> str | None:
        element_type = (info.data or {}).get("type")
        if v is None and element_type != "Table":
            raise ValueError("text cannot be null for non-Table elements")
        return v


class StructuredElement(RawElement):
    root_id: str | None = None
    source_index: int = 0
    parent_chain: list[str] = Field(default_factory=list)
    heading_path: list[str] = Field(default_factory=list)


class NormalizedElement(StructuredElement):
    norm_text: str | None = None
    non_embed: bool = False
    flags: list[str] = Field(default_factory=list)
    metadata_candidates: dict[str, Any] = Field(default_factory=dict)


class LegalUnit(BaseModel):
    unit_id: str
    source_index: int = 0
    canonical_key: str | None = None
    embed_text: str
    display_text: str
    language: str
    language_raw: str | None = None
    authority_level: str
    authority_level_num: int | None = None
    instrument: str
    doc_type: str
    filename: str
    page_start: int
    page_end: int
    element_ids: list[str] = Field(default_factory=list)
    heading_path: list[str] = Field(default_factory=list)
    bilingual_group_id: str | None = None
    translation_role: str | None = None
    consolidation_date: date | None = None
    last_amended_date: date | None = None
    source_snapshot_id: str | None = None
    non_embed: bool = False
    unit_type: str = "policy_rule"
    scope: str = "default"
    cross_references: list[str] = Field(default_factory=list)
    estimated_tokens: int = 0

    @model_validator(mode="before")
    @classmethod
    def normalize_language(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        raw_language = str(data.get("language", "")).strip()
        if raw_language and not data.get("language_raw"):
            data["language_raw"] = raw_language

        lowered = raw_language.lower()
        if lowered in {"eng", "en"}:
            data["language"] = "en"
        elif lowered in {"fra", "fre", "fr"}:
            data["language"] = "fr"
        elif lowered.startswith("en-"):
            data["language"] = "en"
        elif lowered.startswith("fr-"):
            data["language"] = "fr"

        return data

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        if v not in ("en", "fr"):
            raise ValueError(f"Invalid language: {v}")
        return v

    @field_validator("translation_role")
    @classmethod
    def validate_translation_role(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if v not in ("primary", "parallel"):
            raise ValueError(f"Invalid translation_role: {v}")
        return v

    @field_validator("unit_type")
    @classmethod
    def validate_unit_type(cls, v: str) -> str:
        if v not in LEGAL_UNIT_TYPES:
            raise ValueError(f"Invalid unit_type: {v}")
        return v

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, v: str) -> str:
        if v not in LEGAL_SCOPES:
            raise ValueError(f"Invalid scope: {v}")
        return v

    @field_validator("authority_level_num")
    @classmethod
    def validate_authority_level_num(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if v < 0:
            raise ValueError("authority_level_num cannot be negative")
        return v

    @model_validator(mode="after")
    def derive_authority_level_num(self) -> "LegalUnit":
        # Preserve explicit numeric values, including 0.
        if self.authority_level_num is not None:
            return self

        if self.unit_type in ZERO_PRIORITY_UNIT_TYPES:
            self.authority_level_num = 0
            return self

        self.authority_level_num = AUTHORITY_LEVEL_NUM_MAP.get(self.authority_level.lower(), 1)
        return self

    @model_validator(mode="after")
    def derive_estimated_tokens(self) -> "LegalUnit":
        if self.estimated_tokens <= 0:
            self.estimated_tokens = math.ceil(len(self.embed_text) / 4)
        return self

    @model_validator(mode="after")
    def validate_legislation_requirements(self) -> "LegalUnit":
        if self.doc_type == "legislation":
            if not self.canonical_key:
                raise ValueError("canonical_key is required for legislation units")
        return self


def validate_raw_element(data: dict[str, Any]) -> RawElement:
    return RawElement(**data)


def validate_structured_element(data: dict[str, Any]) -> StructuredElement:
    return StructuredElement(**data)


def validate_normalized_element(data: dict[str, Any]) -> NormalizedElement:
    return NormalizedElement(**data)


def validate_legal_unit(data: dict[str, Any]) -> LegalUnit:
    return LegalUnit(**data)
