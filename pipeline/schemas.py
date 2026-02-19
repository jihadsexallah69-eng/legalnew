#!/usr/bin/env python3
from datetime import date
from typing import Any
from pydantic import BaseModel, Field, field_validator, model_validator


SCHEMA_VERSION = "1.0.0"


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

    @model_validator(mode="after")
    def validate_legislation_requirements(self) -> "LegalUnit":
        if self.doc_type == "legislation":
            if not self.canonical_key:
                raise ValueError("canonical_key is required for legislation units")
            if not self.bilingual_group_id:
                raise ValueError("bilingual_group_id is required for legislation units")
            if not self.translation_role:
                raise ValueError("translation_role is required for legislation units")
            if not self.consolidation_date:
                raise ValueError("consolidation_date is required for legislation units")
            if not self.last_amended_date:
                raise ValueError("last_amended_date is required for legislation units")
            if not self.source_snapshot_id:
                raise ValueError("source_snapshot_id is required for legislation units")
        return self


def validate_raw_element(data: dict[str, Any]) -> RawElement:
    return RawElement(**data)


def validate_structured_element(data: dict[str, Any]) -> StructuredElement:
    return StructuredElement(**data)


def validate_normalized_element(data: dict[str, Any]) -> NormalizedElement:
    return NormalizedElement(**data)


def validate_legal_unit(data: dict[str, Any]) -> LegalUnit:
    return LegalUnit(**data)
