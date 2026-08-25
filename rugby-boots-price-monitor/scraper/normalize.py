"""Extrai marca, modelo e versão de um título de produto em texto livre."""
from __future__ import annotations

import json
import re

from . import config

_catalog = json.loads(config.CATALOG_CONFIG.read_text(encoding="utf-8"))
_BRANDS = _catalog["brands"]
_NOISE = {w.lower() for w in _catalog["noise_words"]}
_VERSION_TOKENS = {w.lower() for w in _catalog["version_tokens"]}

_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
_SIZE_RE = re.compile(r"\b(size|talla|tamanho|tam|号)?\s*\d{1,2}([.,]\d)?\s*(us|uk|eu|jp)?\b", re.IGNORECASE)


def normalize_title(title: str) -> dict:
    """Retorna {brand, model, version} a partir de um título de produto.

    Heurística best-effort: encontra a primeira marca conhecida no texto,
    remove ruído (tamanhos, gênero, palavras genéricas) do restante e usa
    as primeiras palavras significativas como "modelo", com tokens de
    versão conhecidos (ano, Elite/Pro/Team, V1/V2...) destacados à parte.
    """
    clean = title.strip()
    lower = clean.lower()

    brand = next((b for b in _BRANDS if b.lower() in lower), None)

    working = clean
    if brand:
        working = re.sub(re.escape(brand), "", working, flags=re.IGNORECASE)

    working = _SIZE_RE.sub(" ", working)

    words = [w for w in re.split(r"[\s\-/]+", working) if w]
    version_parts = []
    model_parts = []
    for w in words:
        wl = w.lower().strip(",.()[]")
        if not wl or wl in _NOISE:
            continue
        if wl in _VERSION_TOKENS or _YEAR_RE.fullmatch(wl):
            version_parts.append(w)
        else:
            model_parts.append(w)

    model = " ".join(model_parts[:4]).strip() or "Modelo não identificado"
    version = " ".join(version_parts).strip() or "Padrão"

    return {
        "brand": brand or "Outra marca",
        "model": model,
        "version": version,
    }


def group_key(brand: str, model: str, version: str) -> str:
    return f"{brand}|{model}|{version}".lower()
