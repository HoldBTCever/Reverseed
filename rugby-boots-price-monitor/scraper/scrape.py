#!/usr/bin/env python3
"""Roda a raspagem diária: consulta cada site configurado, normaliza os
produtos encontrados e adiciona uma linha por listagem em data/price_history.csv.

Uso: python -m scraper.scrape
"""
from __future__ import annotations

import csv
import json
import logging
import time
from datetime import date, datetime, timezone

from . import config, fx, normalize
from .adapters import ADAPTERS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("scraper.scrape")

CSV_FIELDS = [
    "date", "site_id", "site_name", "region", "brand", "model", "version",
    "title", "price_local", "currency", "price_usd", "url",
]


def run() -> dict:
    sites = json.loads(config.SITES_CONFIG.read_text(encoding="utf-8"))
    rates = fx.get_usd_rates()
    today = date.today().isoformat()

    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    file_exists = config.PRICE_HISTORY_CSV.exists()

    run_log = {"date": today, "generated_at": datetime.now(timezone.utc).isoformat(), "sites": []}
    new_rows = []

    for i, site in enumerate(sites):
        adapter = ADAPTERS.get(site["adapter"])
        site_entry = {"id": site["id"], "name": site["name"], "region": site["region"]}
        if not adapter:
            site_entry.update(status="error", error=f"adaptador desconhecido: {site['adapter']}", count=0)
            run_log["sites"].append(site_entry)
            continue

        if i > 0:
            time.sleep(config.REQUEST_DELAY_SECONDS)

        try:
            listings = adapter(site)
        except Exception as exc:  # nunca deixa um site derrubar os outros
            log.exception("Falha ao raspar %s", site["name"])
            site_entry.update(status="error", error=str(exc), count=0)
            run_log["sites"].append(site_entry)
            continue

        count = 0
        for item in listings:
            price_usd = fx.to_usd(item["price"], item["currency"], rates)
            if price_usd is None:
                continue
            info = normalize.normalize_title(item["title"])
            new_rows.append({
                "date": today,
                "site_id": site["id"],
                "site_name": site["name"],
                "region": site["region"],
                "brand": info["brand"],
                "model": info["model"],
                "version": info["version"],
                "title": item["title"],
                "price_local": item["price"],
                "currency": item["currency"],
                "price_usd": price_usd,
                "url": item["url"],
            })
            count += 1

        site_entry.update(status="ok" if count else "empty", count=count)
        run_log["sites"].append(site_entry)
        log.info("%s: %d listagens", site["name"], count)

    with config.PRICE_HISTORY_CSV.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if not file_exists:
            writer.writeheader()
        writer.writerows(new_rows)

    run_log["total_listings"] = len(new_rows)
    config.SCRAPE_LOG_JSON.write_text(json.dumps(run_log, indent=2, ensure_ascii=False), encoding="utf-8")
    log.info("Total: %d listagens novas em %s", len(new_rows), today)
    return run_log


if __name__ == "__main__":
    run()
