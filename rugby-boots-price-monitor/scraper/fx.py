"""Conversão de moedas locais para USD, com cache diário em disco."""
from __future__ import annotations

import json
from datetime import date

import requests

from . import config


def _load_cache() -> dict:
    if config.FX_CACHE_JSON.exists():
        try:
            return json.loads(config.FX_CACHE_JSON.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_cache(cache: dict) -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    config.FX_CACHE_JSON.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")


def get_usd_rates() -> dict[str, float]:
    """Retorna {moeda: quantas unidades da moeda valem 1 USD}.

    Usa cache de um dia para não bater na API a cada execução, e cai de
    volta para o último cache válido (ou uma tabela fixa aproximada) se a
    API estiver fora do ar.
    """
    cache = _load_cache()
    today = date.today().isoformat()
    if cache.get("date") == today and cache.get("rates"):
        return cache["rates"]

    try:
        resp = requests.get(config.FX_API_URL, timeout=config.REQUEST_TIMEOUT_SECONDS)
        resp.raise_for_status()
        payload = resp.json()
        rates = payload["rates"]
        _save_cache({"date": today, "rates": rates})
        return rates
    except Exception:
        if cache.get("rates"):
            return cache["rates"]
        # Fallback grosseiro apenas para não quebrar a primeira execução
        # sem rede; será substituído assim que a API responder.
        return {
            "USD": 1.0, "GBP": 0.79, "EUR": 0.92, "JPY": 152.0,
            "ARS": 1000.0, "PYG": 7300.0,
        }


def to_usd(amount: float, currency: str, rates: dict[str, float]) -> float | None:
    if currency == "USD":
        return round(amount, 2)
    rate = rates.get(currency)
    if not rate:
        return None
    return round(amount / rate, 2)
