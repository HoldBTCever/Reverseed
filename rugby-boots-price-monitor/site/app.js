(function () {
  "use strict";

  const fmtUSD = (v) => v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
  const fmtPct = (v) => v == null ? "—" : (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
  const fmtDate = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // ---- tema ----
  const themeToggle = document.getElementById("themeToggle");
  function applyStoredTheme() {
    try {
      const saved = localStorage.getItem("rbpm-theme");
      if (saved) document.documentElement.setAttribute("data-theme", saved);
    } catch (e) { /* localStorage indisponível: segue no tema do sistema */ }
  }
  applyStoredTheme();
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("rbpm-theme", next); } catch (e) {}
    if (window.__rbpmChart) renderChart(window.__rbpmModels, window.__rbpmSelectedKey);
  });

  let chartInstance = null;

  function renderBanner(summary, alerts) {
    const slot = document.getElementById("bannerSlot");
    const deals = alerts.deals || [];

    if (summary.totals.models_tracked === 0) {
      slot.innerHTML = `
        <div class="banner">
          <h2><span class="dot" style="background:var(--status-warning)"></span> Ainda sem dados coletados</h2>
          <p>A primeira coleta automática ainda não rodou. Ela acontece todo dia via GitHub Actions — ou pode
          ser disparada manualmente na aba <strong>Actions → Coleta diária de preços → Run workflow</strong>
          do repositório. Assim que rodar, este painel se preenche sozinho.</p>
        </div>`;
      return;
    }

    if (deals.length === 0) {
      slot.innerHTML = `
        <div class="banner good">
          <h2><span class="dot"></span> Nenhuma oferta abaixo do limiar hoje</h2>
          <p>Nenhum modelo está ${document.getElementById("thresholdLabel").textContent} ou mais barato que sua média histórica no momento.</p>
        </div>`;
      return;
    }

    const items = deals.map((d) => `
      <li class="deal-item">
        <span>${d.brand} ${d.model} <em style="color:var(--text-muted); font-style:normal">${d.version}</em>
          — <a href="${d.url}" target="_blank" rel="noopener">${d.site_name}</a>
          <span style="color:var(--text-muted)">(${d.region})</span></span>
        <span class="deal-pct">${fmtPct(d.discount_pct)} abaixo · ${fmtUSD(d.deal_price_usd)} <span style="color:var(--text-muted); font-weight:400">vs média ${fmtUSD(d.avg_price_usd)}</span></span>
      </li>`).join("");

    slot.innerHTML = `
      <div class="banner critical">
        <h2><span class="dot"></span> ${deals.length} oferta${deals.length > 1 ? "s" : ""} encontrada${deals.length > 1 ? "s" : ""} hoje</h2>
        <p>Chuteiras com preço ${document.getElementById("thresholdLabel").textContent} ou mais abaixo da média histórica do modelo.</p>
        <ul class="deal-list">${items}</ul>
      </div>`;
  }

  function renderStats(summary) {
    const t = summary.totals;
    const tiles = [
      ["Modelos monitorados", t.models_tracked],
      ["Fontes ativas", t.sources],
      ["Ofertas hoje", t.deals_today],
      ["Observações totais", t.observations],
    ];
    document.getElementById("statsSlot").innerHTML = tiles.map(([label, value]) => `
      <div class="stat-tile">
        <div class="label">${label}</div>
        <div class="value">${value.toLocaleString("pt-BR")}</div>
      </div>`).join("");
  }

  function renderChart(models, selectedKey) {
    const model = models.find((m) => m.key === selectedKey) || models[0];
    if (!model) return;
    window.__rbpmSelectedKey = model.key;

    const container = document.querySelector(".chart-container");
    if (typeof Chart === "undefined") {
      if (container) {
        container.style.height = "auto";
        container.innerHTML = `<p style="color:var(--text-muted); padding:20px 0">
          Não foi possível carregar a biblioteca de gráficos (Chart.js via CDN). Verifique a conexão
          com a internet — o restante do painel continua funcionando normalmente.</p>`;
      }
      return;
    }
    if (!document.getElementById("priceChart")) return;

    const labels = model.history.map((h) => fmtDate(h.date));
    const avgData = model.history.map((h) => h.avg_price_usd);
    const minData = model.history.map((h) => h.min_price_usd);

    const ctx = document.getElementById("priceChart").getContext("2d");
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Preço médio",
            data: avgData,
            borderColor: cssVar("--series-1"),
            backgroundColor: cssVar("--series-1"),
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.25,
          },
          {
            label: "Menor preço do dia",
            data: minData,
            borderColor: cssVar("--series-2"),
            backgroundColor: cssVar("--series-2"),
            borderWidth: 2,
            borderDash: [4, 3],
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "start",
            labels: { color: cssVar("--text-secondary"), usePointStyle: true, boxWidth: 8 },
          },
          tooltip: {
            backgroundColor: cssVar("--surface-1"),
            titleColor: cssVar("--text-primary"),
            bodyColor: cssVar("--text-secondary"),
            borderColor: cssVar("--border"),
            borderWidth: 1,
            callbacks: { label: (item) => `${item.dataset.label}: ${fmtUSD(item.parsed.y)}` },
          },
        },
        scales: {
          x: { grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted") } },
          y: {
            grid: { color: cssVar("--gridline") },
            ticks: { color: cssVar("--text-muted"), callback: (v) => fmtUSD(v) },
          },
        },
      },
    });

    window.__rbpmChart = chartInstance;
  }

  function renderTable(models) {
    const rows = models.map((m) => `
      <tr>
        <td>${m.brand}</td>
        <td>${m.model}</td>
        <td>${m.version}</td>
        <td class="num">${fmtUSD(m.avg_price_usd)}</td>
        <td class="num">${fmtUSD(m.latest_min_price_usd)}</td>
        <td class="num">${fmtPct(m.discount_pct)}</td>
        <td>${m.latest_min_site ? `<a href="${m.latest_min_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none">${m.latest_min_site}</a>` : "—"}</td>
        <td>${m.is_deal ? '<span class="badge deal">Oferta</span>' : ""}</td>
      </tr>`).join("");

    return `
      <div class="card">
        <h2>Todos os modelos monitorados</h2>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Marca</th><th>Modelo</th><th>Versão</th>
                <th class="num">Média (USD)</th><th class="num">Menor hoje</th>
                <th class="num">Variação</th><th>Fonte</th><th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderMain(summary) {
    const models = summary.models;
    window.__rbpmModels = models;

    if (models.length === 0) {
      document.getElementById("mainContent").innerHTML = `
        <div class="card empty-state">
          <div class="icon">🏉</div>
          <h2>Nenhum histórico de preços ainda</h2>
          <p>Depois da primeira execução do workflow, os gráficos e a tabela aparecem aqui automaticamente.
          Para rodar agora: aba <strong>Actions</strong> do repositório →
          <code>daily-price-check</code> → <strong>Run workflow</strong>.</p>
        </div>`;
      return;
    }

    const options = models.map((m) =>
      `<option value="${m.key}">${m.brand} ${m.model} — ${m.version}${m.is_deal ? " 🔻" : ""}</option>`
    ).join("");

    const preselect = models.find((m) => m.is_deal) || models[0];

    document.getElementById("mainContent").innerHTML = `
      <div class="card">
        <h2>Histórico de preço médio</h2>
        <div class="chart-controls">
          <label for="modelSelect">Modelo:</label>
          <select id="modelSelect">${options}</select>
        </div>
        <div class="chart-container"><canvas id="priceChart"></canvas></div>
      </div>
      ${renderTable(models)}`;

    document.getElementById("modelSelect").value = preselect.key;
    document.getElementById("modelSelect").addEventListener("change", (e) => renderChart(models, e.target.value));
    renderChart(models, preselect.key);
  }

  async function main() {
    try {
      const [summaryRes, alertsRes] = await Promise.all([
        fetch("data/daily_summary.json", { cache: "no-store" }),
        fetch("data/alerts.json", { cache: "no-store" }),
      ]);
      const summary = await summaryRes.json();
      const alerts = await alertsRes.json();

      document.getElementById("thresholdLabel").textContent = fmtPct(summary.threshold_pct);
      document.getElementById("lastUpdated").textContent = summary.generated_at
        ? `Última coleta: ${new Date(summary.generated_at).toLocaleString("pt-BR")} · janela de média: ${summary.window_days} dias`
        : "Ainda sem coleta registrada";

      renderBanner(summary, alerts);
      renderStats(summary);
      renderMain(summary);
    } catch (err) {
      document.getElementById("mainContent").innerHTML = `
        <div class="card empty-state">
          <div class="icon">⚠️</div>
          <h2>Não foi possível carregar os dados</h2>
          <p>${err.message}</p>
        </div>`;
    }
  }

  main();
})();
