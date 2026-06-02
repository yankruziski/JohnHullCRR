/* ── Bloomberg CRR Options Pricer — frontend logic ───────────────────────── */

"use strict";

// ── State ─────────────────────────────────────────────────────────────────────
let allTickers   = [];
let currentTicker = null;
let currentData   = null;
let priceChart    = null;
let selectedIndex = -1;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  startClock();
  loadTickers();
  bindControls();
});

function startClock() {
  const el = document.getElementById("clock");
  const update = () => {
    el.textContent = new Date().toLocaleTimeString("pt-BR", { hour12: false });
  };
  update();
  setInterval(update, 1000);
}

// ── Load ticker list ──────────────────────────────────────────────────────────
async function loadTickers() {
  try {
    const res = await fetch("/api/tickers");
    allTickers = await res.json();
  } catch (e) {
    showError("Falha ao carregar lista de ativos: " + e.message);
  }
}

// ── Control bindings ──────────────────────────────────────────────────────────
function bindControls() {
  const input    = document.getElementById("tickerInput");
  const dropdown = document.getElementById("tickerDropdown");
  const calcBtn  = document.getElementById("calcBtn");
  const nInput   = document.getElementById("nInput");

  // Autocomplete typing
  input.addEventListener("input", () => {
    const q = input.value.trim().toUpperCase();
    if (!q) { hideDropdown(); return; }
    const matches = allTickers.filter(t =>
      t.ticker.includes(q) || t.nome.toUpperCase().includes(q)
    ).slice(0, 12);
    renderDropdown(matches);
  });

  input.addEventListener("keydown", e => {
    const items = dropdown.querySelectorAll("li");
    if (e.key === "ArrowDown") {
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      highlightItem(items);
    } else if (e.key === "ArrowUp") {
      selectedIndex = Math.max(selectedIndex - 1, 0);
      highlightItem(items);
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && items[selectedIndex]) {
        items[selectedIndex].click();
      } else if (items.length === 1) {
        items[0].click();
      } else {
        triggerCalc();
      }
    } else if (e.key === "Escape") {
      hideDropdown();
    }
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".autocomplete-wrapper")) hideDropdown();
  });

  // Toggle Call / Put
  document.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if (currentTicker) triggerCalc();
    });
  });

  // Calc button and input changes
  calcBtn.addEventListener("click", triggerCalc);
  [nInput, document.getElementById("kInput"), document.getElementById("rInput")].forEach(el => {
    el.addEventListener("change", () => { if (currentTicker) triggerCalc(); });
  });
}

function renderDropdown(matches) {
  const dropdown = document.getElementById("tickerDropdown");
  selectedIndex = -1;
  if (!matches.length) { hideDropdown(); return; }
  dropdown.innerHTML = "";
  matches.forEach(t => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${t.nome}</span><span class="dd-ticker">${t.ticker}</span>`;
    li.addEventListener("click", () => {
      document.getElementById("tickerInput").value = t.ticker;
      currentTicker = t.ticker;
      hideDropdown();
      triggerCalc();
    });
    dropdown.appendChild(li);
  });
  dropdown.hidden = false;
}

function highlightItem(items) {
  items.forEach((li, i) => li.classList.toggle("active", i === selectedIndex));
  if (items[selectedIndex]) items[selectedIndex].scrollIntoView({ block: "nearest" });
}

function hideDropdown() {
  const d = document.getElementById("tickerDropdown");
  d.hidden = true;
  d.innerHTML = "";
  selectedIndex = -1;
}

// ── Main calculation ──────────────────────────────────────────────────────────
async function triggerCalc() {
  const ticker = (document.getElementById("tickerInput").value || "").toUpperCase().trim();
  if (!ticker) { showError("Selecione um ativo."); return; }
  currentTicker = ticker;

  const n    = parseInt(document.getElementById("nInput").value) || 3;
  const K    = document.getElementById("kInput").value.trim();
  const r    = document.getElementById("rInput").value.trim();
  const tipo = document.querySelector(".toggle-btn.active")?.dataset.tipo || "call";

  const params = new URLSearchParams({ ticker, n, tipo });
  if (K) params.set("K", K);
  if (r) params.set("r", r);

  showLoading(true);
  clearError();

  try {
    const res = await fetch(`/api/price?${params}`);
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Erro desconhecido.");
      showLoading(false);
      return;
    }

    currentData = data;
    renderAll(data);
    document.getElementById("results").classList.remove("hidden");
  } catch (e) {
    showError("Falha de rede: " + e.message);
  } finally {
    showLoading(false);
  }
}

// ── Render all sections ───────────────────────────────────────────────────────
function renderAll(d) {
  renderHeader(d);
  renderChart(d);
  renderMetrics(d);
  renderParams(d);
  renderTree(d);
  renderPaths(d);
  renderResult(d);

  // Pre-fill K with S0 if not already set
  const kInput = document.getElementById("kInput");
  if (!kInput.value) kInput.value = d.S0.toFixed(2);
}

function renderHeader(d) {
  document.getElementById("assetName").textContent = `${d.ticker} — ${d.nome}`;
  document.getElementById("s0Display").textContent = fmtBRL(d.S0);
}

// ── Price chart (Chart.js) ─────────────────────────────────────────────────────
function renderChart(d) {
  const ctx = document.getElementById("priceChart").getContext("2d");

  // Highlight only the last point (S0)
  const pointRadii = d.prices.map((_, i) => i === d.prices.length - 1 ? 6 : 0);
  const pointColors = d.prices.map((_, i) => i === d.prices.length - 1 ? "#00ff7f" : "transparent");

  // Thin the labels to avoid overcrowding
  const step = Math.max(1, Math.floor(d.dates.length / 8));
  const labels = d.dates.map((dt, i) =>
    i % step === 0 || i === d.dates.length - 1 ? dt.slice(5) : ""
  );

  const chartData = {
    labels,
    datasets: [{
      label: "Fechamento",
      data: d.prices,
      borderColor: "#ffa500",
      backgroundColor: "rgba(255,165,0,0.07)",
      fill: true,
      tension: 0.2,
      pointRadius: pointRadii,
      pointBackgroundColor: pointColors,
      pointBorderColor: pointColors,
      pointBorderWidth: 2,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => `R$ ${ctx.parsed.y.toFixed(2)}`,
          title: ctx => ctx[0].label || "",
        },
        backgroundColor: "#111",
        titleColor: "#888",
        bodyColor: "#ffa500",
        borderColor: "#333",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: "#666", font: { family: "IBM Plex Mono", size: 9 }, maxRotation: 0 },
        grid:  { color: "#111" },
        border: { color: "#333" },
      },
      y: {
        ticks: {
          color: "#888",
          font: { family: "IBM Plex Mono", size: 9 },
          callback: v => `${v.toFixed(0)}`,
        },
        grid:  { color: "#111" },
        border: { color: "#333" },
      },
    },
  };

  // Inline plugin to draw the S0 label above the last data point
  const s0LabelPlugin = {
    id: "s0label",
    afterDraw(chart) { drawS0Label(chart, d.S0); },
  };

  if (priceChart) priceChart.destroy();
  priceChart = new Chart(ctx, { type: "line", data: chartData, options, plugins: [s0LabelPlugin] });
}

function drawS0Label(chart, S0) {
  const ds    = chart.data.datasets[0];
  const meta  = chart.getDatasetMeta(0);
  const last  = meta.data[meta.data.length - 1];
  if (!last) return;
  const { ctx } = chart;
  ctx.save();
  ctx.font = "bold 9px IBM Plex Mono, monospace";
  ctx.fillStyle = "#00ff7f";
  ctx.textAlign = "center";
  ctx.fillText(`R$ ${S0.toFixed(2)}`, last.x, last.y - 12);
  ctx.restore();
}

// ── Metrics ───────────────────────────────────────────────────────────────────
function renderMetrics(d) {
  const m = d.metrics;
  set("mVol",    `${m.volatility_pct.toFixed(2)}%`);
  set("mMean",   fmtBRL(m.mean_price));
  set("mMedian", fmtBRL(m.median_price));
  set("mVar",    m.variance_log_ret.toFixed(6));
  const bahEl = document.getElementById("mBah");
  bahEl.textContent = `${m.bah_return_pct >= 0 ? "+" : ""}${m.bah_return_pct.toFixed(2)}%`;
  bahEl.className = "metric-value " + (m.bah_return_pct >= 0 ? "pos" : "neg");
  set("mDD",   `-${m.max_drawdown_pct.toFixed(2)}%`);
  set("mMin",  fmtBRL(m.min_price));
  set("mMax",  fmtBRL(m.max_price));
}

// ── Model params ──────────────────────────────────────────────────────────────
function renderParams(d) {
  const uPct = ((d.u - 1) * 100).toFixed(2);
  const dPct = ((d.d - 1) * 100).toFixed(2);

  const items = [
    ["σ",  `${(d.sigma * 100).toFixed(2)}%`],
    ["u",  `${d.u.toFixed(4)} <span class="param-pct">(+${uPct}%)</span>`],
    ["d",  `${d.d.toFixed(4)} <span class="param-pct">(${dPct}%)</span>`],
    ["p",  d.p.toFixed(4)],
    ["Δt", `${d.dt.toFixed(6)} anos`],
    ["T",  `${d.T.toFixed(4)} anos`],
    ["K",  fmtBRL(d.K)],
    ["r SELIC", `${(d.r_input * 100).toFixed(2)}% → r_cc ${(d.r_cc * 100).toFixed(4)}%`],
  ];

  document.getElementById("modelParams").innerHTML = items
    .map(([k, v]) =>
      `<span class="param-item"><span class="param-key">${k} =</span><span class="param-val">${v}</span></span>`
    )
    .join("");
}

// ── Binomial tree (SVG) ───────────────────────────────────────────────────────
function renderTree(d) {
  const { nodes, n, tipo } = d;
  document.getElementById("treeLabel").textContent =
    `${n} PASSOS — ${tipo.toUpperCase()}  K = ${fmtBRL(d.K)}`;

  const svg = document.getElementById("treeSvg");
  svg.innerHTML = "";

  const NW  = 96;   // node box width
  const NH  = 50;   // node box height
  const COL = 175;  // horizontal step size
  const ROW = 78;   // vertical step size
  const PAD = 50;   // canvas padding

  const W = PAD * 2 + n * COL + NW;
  const H = PAD * 2 + n * ROW + NH;

  svg.setAttribute("width",  W);
  svg.setAttribute("height", H);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const cx = W / 2;  // not used; tree is left-aligned
  const cy = H / 2;  // vertical center

  // Map (step, j) → pixel center
  const pos = {};
  for (const nd of nodes) {
    const { step: i, j } = nd;
    pos[`${i},${j}`] = {
      x: PAD + i * COL + NW / 2,
      y: cy + (i / 2 - j) * ROW,
    };
  }

  // ── Draw edges first (behind nodes) ───────────────────────────────────────
  for (const nd of nodes) {
    const { step: i, j } = nd;
    if (i >= n) continue;
    const from  = pos[`${i},${j}`];
    const toUp  = pos[`${i + 1},${j + 1}`];
    const toDn  = pos[`${i + 1},${j}`];

    drawLine(svg, from.x, from.y, toUp.x, toUp.y, "#00ff7f", 0.45);
    drawLine(svg, from.x, from.y, toDn.x, toDn.y, "#ff3333", 0.45);
  }

  // ── Draw nodes ────────────────────────────────────────────────────────────
  for (const nd of nodes) {
    const { step: i, j, S, C, po } = nd;
    const { x, y } = pos[`${i},${j}`];
    const isRoot = (i === 0 && j === 0);
    drawNode(svg, x, y, NW, NH, S, C, po, isRoot, tipo);
  }
}

function drawLine(svg, x1, y1, x2, y2, color, opacity = 1) {
  const line = svgEl("line");
  line.setAttribute("x1", x1); line.setAttribute("y1", y1);
  line.setAttribute("x2", x2); line.setAttribute("y2", y2);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", 1);
  line.setAttribute("opacity", opacity);
  svg.appendChild(line);
}

function drawNode(svg, cx, cy, w, h, S, C, po, isRoot, tipo) {
  const g = svgEl("g");

  // Box
  const rect = svgEl("rect");
  rect.setAttribute("x",      cx - w / 2);
  rect.setAttribute("y",      cy - h / 2);
  rect.setAttribute("width",  w);
  rect.setAttribute("height", h);
  rect.setAttribute("rx",     3);
  rect.setAttribute("fill",   po ? "#1a0000" : isRoot ? "#001515" : "#0c0c0c");
  rect.setAttribute("stroke", po ? "#ff3333" : isRoot ? "#00e5ff" : "#2a2a00");
  rect.setAttribute("stroke-width", isRoot ? 1.5 : 0.8);
  g.appendChild(rect);

  // S value
  const tS = svgEl("text");
  tS.setAttribute("x",           cx);
  tS.setAttribute("y",           cy - 8);
  tS.setAttribute("text-anchor", "middle");
  tS.setAttribute("fill",        "#ffa500");
  tS.setAttribute("font-family", "IBM Plex Mono, monospace");
  tS.setAttribute("font-size",   "9.5");
  tS.textContent = `S ${fmtBRL(S)}`;
  g.appendChild(tS);

  // C value or ∅
  const tC = svgEl("text");
  tC.setAttribute("x",           cx);
  tC.setAttribute("y",           cy + 10);
  tC.setAttribute("text-anchor", "middle");
  tC.setAttribute("font-family", "IBM Plex Mono, monospace");
  tC.setAttribute("font-size",   "9.5");

  if (po) {
    tC.setAttribute("fill", "#ff3333");
    tC.textContent = "∅  pó";
  } else {
    tC.setAttribute("fill", isRoot ? "#ffee00" : "#00ff7f");
    tC.setAttribute("font-weight", isRoot ? "bold" : "normal");
    tC.textContent = `C ${fmtBRL(C)}`;
  }
  g.appendChild(tC);

  // Root marker
  if (isRoot) {
    const tLabel = svgEl("text");
    tLabel.setAttribute("x",           cx);
    tLabel.setAttribute("y",           cy + 25);
    tLabel.setAttribute("text-anchor", "middle");
    tLabel.setAttribute("fill",        "#00e5ff");
    tLabel.setAttribute("font-size",   "7.5");
    tLabel.textContent = "← hoje";
    g.appendChild(tLabel);
  }

  svg.appendChild(g);
}

function svgEl(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

// ── Performing paths table ────────────────────────────────────────────────────
function renderPaths(d) {
  const tbody  = document.getElementById("pathsBody");
  const noPaths = document.getElementById("noPaths");
  const tbl    = document.getElementById("pathsTable");
  tbody.innerHTML = "";

  if (!d.performing_paths.length) {
    tbl.classList.add("hidden");
    noPaths.classList.remove("hidden");
    return;
  }

  tbl.classList.remove("hidden");
  noPaths.classList.add("hidden");

  d.performing_paths.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.scenario}</td>
      <td>${fmtBRL(p.S_T)}</td>
      <td>${fmtBRL(p.K)}</td>
      <td class="payoff-pos">${fmtBRL(p.payoff)}</td>
      <td>${fmtBRL(p.Cu)}</td>
      <td>${p.Cd > 0 ? fmtBRL(p.Cd) : '<span style="color:#555">—</span>'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Result highlight ──────────────────────────────────────────────────────────
function renderResult(d) {
  document.getElementById("tipoDisplay").textContent = d.tipo.toUpperCase();
  document.getElementById("optionPrice").textContent = fmtBRL(d.option_price);
  document.getElementById("resultSub").textContent =
    `${d.ticker} — ${d.tipo.toUpperCase()} — K ${fmtBRL(d.K)} — ${d.n} meses — σ ${(d.sigma * 100).toFixed(2)}%`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(v) {
  if (v == null || isNaN(v)) return "—";
  return "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function set(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showLoading(on) {
  document.getElementById("loadingBar").classList.toggle("hidden", !on);
}

function showError(msg) {
  const el = document.getElementById("errorBar");
  el.textContent = "ERRO: " + msg;
  el.classList.remove("hidden");
}

function clearError() {
  document.getElementById("errorBar").classList.add("hidden");
}
