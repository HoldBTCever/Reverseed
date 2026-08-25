"""Configurações globais do monitor de preços de chuteiras de rugby."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SITE_DATA_DIR = ROOT / "site" / "data"
SITES_CONFIG = ROOT / "scraper" / "sites.json"
CATALOG_CONFIG = ROOT / "scraper" / "catalog.json"

PRICE_HISTORY_CSV = DATA_DIR / "price_history.csv"
DAILY_SUMMARY_JSON = DATA_DIR / "daily_summary.json"
ALERTS_JSON = DATA_DIR / "alerts.json"
FX_CACHE_JSON = DATA_DIR / "fx_cache.json"
SCRAPE_LOG_JSON = DATA_DIR / "last_run.json"

# Uma chuteira é considerada "oferta" quando o preço encontrado hoje está
# a esta fração (ou mais) abaixo da média histórica do modelo/versão.
DEAL_THRESHOLD_PCT = 0.395

# Quantos dias de histórico entram no cálculo da média móvel.
AVERAGE_WINDOW_DAYS = 90

# Exige um mínimo de observações históricas para considerar a média confiável
# o suficiente para gerar alerta (evita "média" baseada em 1 único preço).
MIN_OBSERVATIONS_FOR_ALERT = 2

HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 "
        "RugbyBootsPriceMonitor/1.0 (+https://github.com/HoldBTCever/Reverseed)"
    ),
    "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,ja;q=0.7,es;q=0.7",
}
REQUEST_TIMEOUT_SECONDS = 20
REQUEST_DELAY_SECONDS = 1.5  # intervalo educado entre requisições ao mesmo site
MAX_PRODUCTS_PER_SITE = 40

FX_API_URL = "https://open.er-api.com/v6/latest/USD"
