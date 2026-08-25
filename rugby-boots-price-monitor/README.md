# Monitor de Preços — Chuteiras de Rugby

Coleta diária de preços de chuteiras de rugby em lojas de várias regiões,
calcula a média histórica por modelo/versão, publica um site com o
histórico em gráfico e destaca qualquer chuteira **39,5% ou mais abaixo**
da sua média.

## Como funciona

```
scraper/scrape.py      -> visita cada loja configurada, extrai produtos e preços,
                           converte para USD e adiciona uma linha em data/price_history.csv
scraper/aggregate.py   -> calcula a média móvel (90 dias) por modelo/versão,
                           gera data/daily_summary.json e data/alerts.json
site/                  -> painel estático (HTML/CSS/JS + Chart.js) que lê esses JSONs
.github/workflows/     -> roda os dois scripts todo dia e publica o site no GitHub Pages
```

Nenhum dado é inventado: o repositório é publicado com o histórico vazio e o
próprio painel mostra um aviso "ainda sem coleta" até a primeira execução do
workflow rodar de verdade contra as lojas.

## Lojas monitoradas

| Região | Loja | Adaptador |
|---|---|---|
| EUA | World Rugby Shop, Rugby Imports | JSON-LD (schema.org Product) |
| Europa (Reino Unido / França) | Lovell Rugby, Decathlon | JSON-LD |
| Japão | Rakuten Ichiba (busca "ラグビー スパイク") | HTML da busca |
| Argentina | MercadoLibre Argentina (busca "botines de rugby") | HTML da busca |
| Paraguai | MercadoLibre Paraguay (busca "botines de rugby") | HTML da busca |

Adicione, remova ou ajuste lojas em `scraper/sites.json` — cada entrada
define região, moeda, URL(s) de listagem e qual adaptador usar
(`scraper/adapters.py`). Sites que expõem dados estruturados schema.org
(`shopify_jsonld` / `generic_jsonld`) são os mais estáveis, pois não
dependem de classes CSS que mudam a cada redesign.

## Como o preço é normalizado

`scraper/normalize.py` extrai marca, modelo e versão do título de cada
produto usando uma lista de marcas conhecidas (`scraper/catalog.json`) e
remove ruído (tamanho, cor, gênero). É uma heurística — ajuste
`catalog.json` se notar produtos agrupados incorretamente.

Preços são convertidos para USD com as taxas de
[open.er-api.com](https://open.er-api.com) (cache de 1 dia em
`data/fx_cache.json`).

## O alerta de oferta

Em `scraper/config.py`:

```python
DEAL_THRESHOLD_PCT = 0.395          # 39,5%
AVERAGE_WINDOW_DAYS = 90            # janela da média histórica
MIN_OBSERVATIONS_FOR_ALERT = 2      # mínimo de observações para confiar na média
```

Um modelo/versão vira "oferta" quando o menor preço encontrado no dia está
`>= 39,5%` abaixo da média dos últimos 90 dias daquele mesmo modelo/versão,
desde que já existam pelo menos 2 observações históricas (evita alertar
com base em um único preço).

## Rodar localmente

```bash
cd rugby-boots-price-monitor
pip install -r requirements.txt
python -m scraper.scrape       # coleta os preços de hoje
python -m scraper.aggregate    # recalcula médias e alertas
python -m http.server 8000 --directory site   # abre em localhost:8000
```

## Automação diária (GitHub Actions)

O workflow `.github/workflows/daily-price-check.yml`:

1. roda `scrape.py` + `aggregate.py` todo dia às 09:00 UTC (ou a qualquer
   momento via **Actions → daily-price-check → Run workflow**);
2. faz commit dos JSONs/CSV atualizados de volta no branch;
3. publica `rugby-boots-price-monitor/site/` no GitHub Pages.

**Duas configurações manuais únicas, feitas pelo dono do repositório:**

- **GitHub Pages**: em Settings → Pages, defina Source = "GitHub Actions"
  (uma vez só; depois disso o deploy é sempre automático).
- **Cron no branch padrão**: o gatilho `schedule` do GitHub Actions só
  dispara para o workflow que estiver no branch padrão do repositório. Hoje
  o branch padrão é `claude/card-notification-parser-nILHd` — depois de
  revisar, faça merge deste branch (ou defina este como o novo branch
  padrão) para a coleta automática diária começar a rodar sozinha. Até lá,
  dá para testar a qualquer momento com "Run workflow" manualmente.

## Limitações conhecidas

- Raspagem de HTML quebra quando a loja muda o layout — o workflow
  continua rodando mesmo se um site falhar (erro só daquele site fica
  registrado em `data/last_run.json`), mas vale revisar `sites.json`
  periodicamente.
- Sites que só carregam preços via JavaScript (sem HTML estático nem
  JSON-LD) não são suportados pelos adaptadores atuais.
- A normalização marca/modelo/versão é best-effort; produtos com títulos
  muito genéricos podem cair em "Modelo não identificado".
