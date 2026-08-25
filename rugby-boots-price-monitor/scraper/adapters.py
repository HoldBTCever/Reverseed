"""Adaptadores de raspagem por site/plataforma.

Cada adaptador recebe a config de um site (de sites.json) e devolve uma
lista de listagens brutas: [{title, price, currency, url}, ...].

Erros em um produto ou em um site nunca devem derrubar a execução inteira
-- cada função captura suas próprias exceções e loga um aviso, retornando
o que conseguiu extrair até ali.
"""
from __future__ import annotations

import json
import logging
import re
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from . import config

log = logging.getLogger("scraper.adapters")

_PRICE_RE = re.compile(r"[\d][\d.,]*\d|\d")


def fetch(url: str) -> str | None:
    try:
        resp = requests.get(
            url, headers=config.HTTP_HEADERS, timeout=config.REQUEST_TIMEOUT_SECONDS
        )
        if resp.status_code != 200:
            log.warning("GET %s -> HTTP %s", url, resp.status_code)
            return None
        return resp.text
    except requests.RequestException as exc:
        log.warning("Falha ao buscar %s: %s", url, exc)
        return None


def parse_price_text(text: str, currency: str) -> float | None:
    """Converte um texto de preço em número, lidando com separadores
    de milhar/decimal que variam por local (1,234.56 vs 1.234,56)."""
    match = _PRICE_RE.search(text.replace("\xa0", " "))
    if not match:
        return None
    raw = match.group(0)

    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            raw = raw.replace(",", "")
    elif "," in raw:
        tail = raw.split(",")[-1]
        raw = raw.replace(",", ".") if len(tail) == 2 else raw.replace(",", "")
    elif "." in raw:
        tail = raw.split(".")[-1]
        if len(tail) != 2 and currency in {"JPY", "PYG"}:
            raw = raw.replace(".", "")

    try:
        return float(raw)
    except ValueError:
        return None


def extract_jsonld_products(html: str, page_url: str) -> list[dict]:
    """Procura blocos <script type="application/ld+json"> com schema.org
    Product/Offer -- a forma mais estável de extrair preço, pois não
    depende de classes CSS que mudam a cada redesign."""
    soup = BeautifulSoup(html, "lxml")
    results = []

    def _walk(node):
        if isinstance(node, dict):
            types = node.get("@type")
            types = [types] if isinstance(types, str) else (types or [])
            if "Product" in types:
                name = node.get("name")
                offers = node.get("offers")
                offer_list = offers if isinstance(offers, list) else [offers] if offers else []
                for offer in offer_list:
                    if not isinstance(offer, dict):
                        continue
                    price = offer.get("price") or offer.get("lowPrice")
                    currency = offer.get("priceCurrency")
                    if name and price and currency:
                        try:
                            price_val = float(str(price).replace(",", ""))
                        except ValueError:
                            continue
                        results.append({
                            "title": name.strip(),
                            "price": price_val,
                            "currency": currency,
                            "url": node.get("url") or page_url,
                        })
            for value in node.values():
                _walk(value)
        elif isinstance(node, list):
            for item in node:
                _walk(item)

    for tag in soup.find_all("script", {"type": "application/ld+json"}):
        try:
            data = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        _walk(data)

    return results


def discover_links(html: str, base_url: str, pattern: str, limit: int) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    seen, links = set(), []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if pattern in href:
            full = urljoin(base_url, href.split("?")[0])
            if full not in seen:
                seen.add(full)
                links.append(full)
        if len(links) >= limit:
            break
    return links


def scrape_jsonld_site(site: dict) -> list[dict]:
    """Para lojas Shopify/Magento/etc. que expõem schema.org Product:
    tenta primeiro extrair JSON-LD direto da página de listagem; se não
    houver, visita cada página de produto individualmente."""
    listings: list[dict] = []
    for listing_url in site["listing_urls"]:
        html = fetch(listing_url)
        if not html:
            continue

        found = extract_jsonld_products(html, listing_url)
        if found:
            listings.extend(found)
            continue

        product_links = discover_links(
            html, site["base_url"], site["product_link_pattern"], config.MAX_PRODUCTS_PER_SITE
        )
        for link in product_links:
            time.sleep(config.REQUEST_DELAY_SECONDS)
            product_html = fetch(link)
            if not product_html:
                continue
            listings.extend(extract_jsonld_products(product_html, link))

    return listings


def scrape_mercadolibre(site: dict) -> list[dict]:
    listings: list[dict] = []
    for listing_url in site["listing_urls"]:
        html = fetch(listing_url)
        if not html:
            continue
        soup = BeautifulSoup(html, "lxml")

        cards = soup.select("li.ui-search-layout__item") or soup.select("div.ui-search-result__wrapper")
        for card in cards[: config.MAX_PRODUCTS_PER_SITE]:
            link_tag = card.select_one("a.ui-search-link, a.ui-search-item__group__element")
            title_tag = card.select_one(
                "h2.ui-search-item__title, .poly-component__title, h3.poly-component__title-wrapper"
            )
            price_tag = card.select_one("span.andes-money-amount__fraction")
            if not (link_tag and price_tag):
                continue
            title = (title_tag or link_tag).get_text(strip=True)
            price = parse_price_text(price_tag.get_text(strip=True), site["currency"])
            href = link_tag.get("href")
            if title and price and href:
                listings.append({
                    "title": title, "price": price, "currency": site["currency"], "url": href,
                })
    return listings


def scrape_rakuten_search(site: dict) -> list[dict]:
    listings: list[dict] = []
    for listing_url in site["listing_urls"]:
        html = fetch(listing_url)
        if not html:
            continue
        soup = BeautifulSoup(html, "lxml")

        anchors = [
            a for a in soup.find_all("a", href=True)
            if site["product_link_pattern"] in a["href"]
        ]
        seen_urls = set()
        for a in anchors[: config.MAX_PRODUCTS_PER_SITE * 3]:
            href = a["href"].split("?")[0]
            if href in seen_urls:
                continue
            title = a.get_text(strip=True)
            if not title or len(title) < 6:
                continue

            price = None
            container = a.find_parent(["div", "li"])
            search_scope = container if container else a.parent
            for _ in range(3):
                if not search_scope:
                    break
                text = search_scope.get_text(" ", strip=True)
                yen_match = re.search(r"([\d,]{3,})\s*円", text)
                if yen_match:
                    price = parse_price_text(yen_match.group(1), "JPY")
                    break
                search_scope = search_scope.find_parent(["div", "li"])

            if price:
                seen_urls.add(href)
                listings.append({"title": title, "price": price, "currency": "JPY", "url": href})
            if len(listings) >= config.MAX_PRODUCTS_PER_SITE:
                break
    return listings


ADAPTERS = {
    "shopify_jsonld": scrape_jsonld_site,
    "generic_jsonld": scrape_jsonld_site,
    "mercadolibre_search": scrape_mercadolibre,
    "rakuten_search": scrape_rakuten_search,
}
