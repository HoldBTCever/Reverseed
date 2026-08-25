#!/usr/bin/env python3
"""Lê data/price_history.csv e gera dois arquivos consumidos pelo site:

- data/daily_summary.json: média histórica e série temporal por modelo/versão
- data/alerts.json: chuteiras cujo menor preço de hoje está a
  DEAL_THRESHOLD_PCT (ou mais) abaixo da média histórica do modelo

Uso: python -m scraper.aggregate
"""
from __future__ import annotations

import csv
import json
import shutil
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from . import config
from .normalize import group_key


def _read_rows() -> list[dict]:
    if not config.PRICE_HISTORY_CSV.exists():
        return []
    with config.PRICE_HISTORY_CSV.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def run() -> None:
    rows = _read_rows()
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=config.AVERAGE_WINDOW_DAYS)).date().isoformat()

    groups: dict[str, dict] = {}
    by_date: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    latest_date = None

    for row in rows:
        try:
            price_usd = float(row["price_usd"])
        except (KeyError, ValueError):
            continue
        if row["date"] < cutoff:
            continue

        key = group_key(row["brand"], row["model"], row["version"])
        g = groups.setdefault(key, {
            "key": key, "brand": row["brand"], "model": row["model"], "version": row["version"],
            "prices": [], "sources": set(), "latest": [],
        })
        g["prices"].append(price_usd)
        g["sources"].add(row["site_name"])
        by_date[key][row["date"]].append(price_usd)

        if latest_date is None or row["date"] > latest_date:
            latest_date = row["date"]

    if latest_date:
        for row in rows:
            if row["date"] != latest_date:
                continue
            key = group_key(row["brand"], row["model"], row["version"])
            if key in groups:
                groups[key]["latest"].append(row)

    models = []
    deals = []

    for key, g in groups.items():
        n = len(g["prices"])
        avg_price = round(sum(g["prices"]) / n, 2)

        history = [
            {"date": d, "avg_price_usd": round(sum(vals) / len(vals), 2), "min_price_usd": round(min(vals), 2)}
            for d, vals in sorted(by_date[key].items())
        ]

        entry = {
            "key": key, "brand": g["brand"], "model": g["model"], "version": g["version"],
            "avg_price_usd": avg_price, "n_observations": n,
            "sources": sorted(g["sources"]), "history": history,
            "latest_date": latest_date, "latest_min_price_usd": None,
            "latest_min_site": None, "latest_min_region": None, "latest_min_url": None,
            "discount_pct": None, "is_deal": False,
        }

        if g["latest"]:
            cheapest = min(g["latest"], key=lambda r: float(r["price_usd"]))
            latest_min = float(cheapest["price_usd"])
            entry.update(
                latest_min_price_usd=round(latest_min, 2),
                latest_min_site=cheapest["site_name"],
                latest_min_region=cheapest["region"],
                latest_min_url=cheapest["url"],
            )
            if avg_price > 0:
                discount = round((avg_price - latest_min) / avg_price, 4)
                entry["discount_pct"] = discount
                if discount >= config.DEAL_THRESHOLD_PCT and n >= config.MIN_OBSERVATIONS_FOR_ALERT:
                    entry["is_deal"] = True
                    deals.append({
                        "brand": g["brand"], "model": g["model"], "version": g["version"],
                        "avg_price_usd": avg_price, "deal_price_usd": round(latest_min, 2),
                        "discount_pct": discount, "site_name": cheapest["site_name"],
                        "region": cheapest["region"], "url": cheapest["url"], "date": latest_date,
                    })

        models.append(entry)

    models.sort(key=lambda m: (-(m["discount_pct"] or -1), m["brand"], m["model"]))
    deals.sort(key=lambda d: -d["discount_pct"])

    all_sources = sorted({s for g in groups.values() for s in g["sources"]})
    summary = {
        "generated_at": now.isoformat(),
        "threshold_pct": config.DEAL_THRESHOLD_PCT,
        "window_days": config.AVERAGE_WINDOW_DAYS,
        "latest_date": latest_date,
        "totals": {
            "models_tracked": len(models),
            "sources": len(all_sources),
            "deals_today": len(deals),
            "observations": len(rows),
        },
        "sources": all_sources,
        "models": models,
    }
    alerts = {
        "generated_at": now.isoformat(),
        "threshold_pct": config.DEAL_THRESHOLD_PCT,
        "date": latest_date,
        "deals": deals,
    }

    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    config.DAILY_SUMMARY_JSON.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    config.ALERTS_JSON.write_text(json.dumps(alerts, indent=2, ensure_ascii=False), encoding="utf-8")

    config.SITE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy(config.DAILY_SUMMARY_JSON, config.SITE_DATA_DIR / "daily_summary.json")
    shutil.copy(config.ALERTS_JSON, config.SITE_DATA_DIR / "alerts.json")

    print(f"{len(models)} modelos, {len(deals)} ofertas (>= {config.DEAL_THRESHOLD_PCT:.1%} abaixo da média)")


if __name__ == "__main__":
    run()
