/* ================================================================
   SignalFaru — app.js v4
   Auth · Multi-page SPA · Price/Pct/Rank charts · Portfolio · Coin logos
   BUY = LIMIT order · SELL = OCO order · Auto-refresh
   ================================================================ */

const API       = "";
const LOGO_BASE = "https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/32/color";

/* ── State ─────────────────────────────────────────────────── */
const state = {
  token:                localStorage.getItem("sf_token") || null,
  username:             localStorage.getItem("sf_user")  || "admin",
  btcPrice:             null,
  usdtFree:             0,
  balances:             [],
  top10:                [],
  gracia:               [],
  metadata:             {},
  openOrders:           [],
  localOrders:          {},   // keyed by order_reference
  selectedCoin:         null,
  side:                 "BUY",
  currentTab:           "top10",
  currentPage:          "dashboard",
  priceChart:           null,
  pctChart:             null,
  rankChart:            null,
  portfolioChart:       null,
  orderChartsExpanded:  null,  // orderId of currently expanded chart panel
  orderPriceChart:      null,
  orderPctChart:        null,
};

/* ── Helpers ────────────────────────────────────────────────── */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const fmtUsd = (n, d = 2) => {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) < 0.001 && n !== 0) return `$${Number(n).toExponential(2)}`;
  const dec = n < 1 ? Math.max(d, 4) : d;
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
};
const fmtPct  = (n) => n == null || isNaN(n) ? "—" : `${n > 0 ? "+" : ""}${Number(n).toFixed(2)}%`;
const pctClass = (n) => n == null ? "neutral" : n > 0 ? "gain" : "loss";
const fmtVol  = (n) => {
  if (!n) return "—";
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`;
  return `$${(n/1e3).toFixed(1)}K`;
};
const fmtNum  = (n, d = 6) => (n == null || isNaN(n)) ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d });
const fmtUsdt = (n) => (n == null || isNaN(n)) ? "—" : `${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
const timeAgo = (iso) => {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 60)   return `${m}m`;
  if (m < 1440) return `${Math.floor(m/60)}h`;
  return `${Math.floor(m/1440)}d`;
};
const fmtDate = (ms) => new Date(ms).toLocaleDateString("es", { day: "2-digit", month: "short" });
const fmtTime = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};

const logoHtml = (symbol, cls = "coin-avatar") => {
  const s = symbol.toLowerCase();
  const meta = state.metadata[symbol] || state.metadata[s];
  const logoUrl = meta?.logo_url || `${LOGO_BASE}/${s}.png`;

  return `<div class="${cls}">
    <img src="${logoUrl}" alt="${symbol}"
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
    <div class="coin-fallback" style="display:none">${symbol.slice(0,3)}</div>
  </div>`;
};
const coinMarketCapSlug = (coin) => {
  const base = (coin.name || coin.symbol || "").toString().trim().toLowerCase();
  const slug = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || coin.symbol.toLowerCase();
};
const coinMarketCapUrl = (coin) => `https://coinmarketcap.com/currencies/${coinMarketCapSlug(coin)}/`;
const coinMarketCapLogo = () => `
  <span class="cmc-logo" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#3861FB"/>
      <path d="M5.4 13.7c.9-3.4 2-5.1 3.3-5.1 1.8 0 1.8 5.6 3.4 5.6 1.4 0 2.1-4.2 3.9-4.2 1.3 0 2.3 1.4 3.1 4.1" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M19.1 10.1c.4.7.6 1.5.6 2.3 0 3.3-3.4 6-7.6 6s-7.6-2.7-7.6-6 3.4-6 7.6-6c1.1 0 2.1.2 3 .5" stroke="#fff" stroke-width="1.25" stroke-linecap="round"/>
    </svg>
  </span>`;
const coinMarketCapLabel = () => `${coinMarketCapLogo()}<span>CoinMarketCap</span>`;
const setText = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
const socialIcon = (type) => {
  const icons = {
    website: `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.4"/><path d="M3 10h14M10 2.5c2 2 3 4.5 3 7.5s-1 5.5-3 7.5c-2-2-3-4.5-3-7.5s1-5.5 3-7.5z" stroke="currentColor" stroke-width="1.4"/></svg>`,
    twitter: `<svg viewBox="0 0 20 20" fill="none"><path d="M4 3.5l12 13M16 3.5l-12 13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6.2 3.5h-2l9.6 13h2L6.2 3.5z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>`,
    telegram: `<svg viewBox="0 0 20 20" fill="none"><path d="M17 4L3.5 9.3c-.8.3-.8 1.3.1 1.5l3.2.9 1.3 4c.2.7 1.1.8 1.5.2l1.8-2.5 3.3 2.5c.6.5 1.5.1 1.6-.7L18 5c.1-.7-.4-1.2-1-.9z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/><path d="M7 11.7L14 7" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>`,
    reddit: `<svg viewBox="0 0 20 20" fill="none"><path d="M6 10.8c0 2 1.8 3.6 4 3.6s4-1.6 4-3.6-1.8-3.6-4-3.6-4 1.6-4 3.6z" stroke="currentColor" stroke-width="1.35"/><path d="M8.3 11.8c.8.5 2.6.5 3.4 0M8.2 10.3h.01M11.8 10.3h.01M13.4 8.2l1.2-2.9 2.5.6" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/><circle cx="4.3" cy="9.4" r="1.3" stroke="currentColor" stroke-width="1.35"/><circle cx="15.7" cy="9.4" r="1.3" stroke="currentColor" stroke-width="1.35"/></svg>`,
    github: `<svg viewBox="0 0 20 20" fill="none"><path d="M7.5 16.5c-3 .9-3-1.5-4.2-1.8M13 18v-3.1c0-.8.2-1.3-.4-1.8 2-.2 4.1-1 4.1-4.4 0-1-.3-1.8-.9-2.4.1-.2.4-1.2-.1-2.4 0 0-.8-.2-2.5.9-.7-.2-1.5-.3-2.2-.3s-1.5.1-2.2.3C7.1 3.7 6.3 4 6.3 4c-.5 1.2-.2 2.2-.1 2.4-.6.6-.9 1.4-.9 2.4 0 3.4 2.1 4.1 4.1 4.4-.3.3-.5.8-.5 1.5V18" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    whitepaper: `<svg viewBox="0 0 20 20" fill="none"><path d="M5 2.5h6l4 4v11H5v-15z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/><path d="M11 2.5v4h4M7.5 10h5M7.5 13h5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    coingecko: `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" fill="#8CC63F"/><circle cx="7.7" cy="8.1" r="1.2" fill="#2D3A22"/><path d="M5.4 11.4c2.4 2.1 6.2 2 8.8-.4" stroke="#2D3A22" stroke-width="1.2" stroke-linecap="round"/><path d="M10 5.5c2.7 0 5 2 5.4 4.5-1.1-1-2.4-1.5-4-1.5-2 0-3.6.8-4.8 2.2-.7.8-1.5.7-2.1.2.1-3 2.5-5.4 5.5-5.4z" fill="#D8F4A8" opacity="0.9"/></svg>`,
  };
  return icons[type] || "";
};
const socialLinksHtml = (coin, mode = "icons") => {
  const meta = state.metadata[coin.symbol] || state.metadata[coin.symbol?.toUpperCase?.()];
  if (!meta) return "";
  const items = [
    ["website", "Website", meta.website_url],
    ["twitter", "X", meta.twitter_url],
    ["telegram", "Telegram", meta.telegram_url],
    ["reddit", "Reddit", meta.reddit_url],
    ["github", "GitHub", meta.github_url],
    ["whitepaper", "Whitepaper", meta.whitepaper_url],
    ["coingecko", "CoinGecko", meta.coingecko_url],
  ].filter(([, , url]) => !!url);
  if (!items.length) return "";
  return `<div class="social-links social-links--${mode}">
    ${items.map(([type, label, url]) => `
      <a class="social-link social-link--${type}" href="${url}" target="_blank" rel="noopener noreferrer" title="${label}" data-social>
        ${socialIcon(type)}${mode === "full" ? `<span>${label}</span>` : ""}
      </a>`).join("")}
  </div>`;
};

/* ── API (auth-aware) ────────────────────────────────────────── */
async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
  const res = await fetch(API + path, { headers, ...opts });
  if (res.status === 401) {
    logout();
    return;
  }
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${t}`);
  }
  return res.json();
}

/* ── Toast ───────────────────────────────────────────────────── */
let toastTimer;
const metadataInFlight = new Set();
function toast(msg, type = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3600);
}

/* ================================================================
   AUTH FLOW
   ================================================================ */

function showApp() {
  $("#login-screen").style.display = "none";
  $("#app").hidden = false;
  const uEl = $("#nav-username");
  if (uEl) uEl.textContent = state.username;
  const avEl = $("#admin-avatar-letters");
  if (avEl) avEl.textContent = state.username.charAt(0).toUpperCase();
  setText("#admin-username-display", state.username);
}

function showLogin() {
  $("#app").hidden = true;
  $("#login-screen").style.display = "flex";
}

async function checkAuth() {
  if (!state.token) { showLogin(); return; }
  try {
    const me = await api("/auth/me");
    if (!me) return;
    state.username = me.username;
    localStorage.setItem("sf_user", me.username);
    showApp();
    boot();
  } catch {
    logout();
  }
}

function logout() {
  state.token = null;
  state.username = "admin";
  localStorage.removeItem("sf_token");
  localStorage.removeItem("sf_user");
  showLogin();
  const uf = $("#login-username"); if (uf) uf.value = "";
  const pf = $("#login-password"); if (pf) pf.value = "";
}

/* Login form */
$("#login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = $("#login-username")?.value?.trim();
  const password = $("#login-password")?.value;
  const errEl = $("#login-error");
  const btn   = $("#login-submit");

  if (!username || !password) return;

  btn.disabled = true;
  btn.querySelector("span").textContent = "Entrando…";
  if (errEl) errEl.hidden = true;

  try {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (errEl) { errEl.textContent = data.detail || "Error de autenticación"; errEl.hidden = false; }
      return;
    }
    state.token    = data.access_token;
    state.username = data.username;
    localStorage.setItem("sf_token",  state.token);
    localStorage.setItem("sf_user",   state.username);
    showApp();
    boot();
  } catch {
    if (errEl) { errEl.textContent = "No se pudo conectar con el servidor"; errEl.hidden = false; }
  } finally {
    btn.disabled = false;
    btn.querySelector("span").textContent = "Entrar";
  }
});

/* Toggle password visibility */
$("#toggle-pass")?.addEventListener("click", () => {
  const input = $("#login-password");
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
});

/* Logout */
$("#logout-btn")?.addEventListener("click", logout);

/* Admin: change password */
$("#change-pass-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const current = $("#cp-current")?.value;
  const newPwd  = $("#cp-new")?.value;
  const confirm = $("#cp-confirm")?.value;
  const msgEl   = $("#cp-msg");

  if (newPwd !== confirm) {
    if (msgEl) { msgEl.textContent = "Las contraseñas nuevas no coinciden"; msgEl.className = "form-msg err"; }
    return;
  }
  if (newPwd.length < 6) {
    if (msgEl) { msgEl.textContent = "La contraseña debe tener mínimo 6 caracteres"; msgEl.className = "form-msg err"; }
    return;
  }

  try {
    const res = await api("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: current, new_password: newPwd }),
    });
    if (!res) return;
    if (msgEl) { msgEl.textContent = "Contraseña actualizada exitosamente"; msgEl.className = "form-msg ok"; }
    toast("Contraseña actualizada", "ok");
    e.target.reset();
    setTimeout(() => { if (msgEl) msgEl.textContent = ""; }, 4000);
  } catch (err) {
    if (msgEl) { msgEl.textContent = err.message || "Error al cambiar contraseña"; msgEl.className = "form-msg err"; }
  }
});

/* ================================================================
   ROUTER (SPA)
   ================================================================ */

function navigate(page) {
  if (page === state.currentPage) return;
  state.currentPage = page;

  $$(".page").forEach(p => p.classList.remove("is-active"));
  $(`#page-${page}`)?.classList.add("is-active");

  $$(".nav-tab, .mnav-btn").forEach(b => {
    b.classList.toggle("is-active", b.dataset.page === page);
  });

  if (page === "orders") {
    _destroyOrderCharts();
    state.orderChartsExpanded = null;
    loadAllOrders();
  }
  if (page === "portfolio") loadPortfolio();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-page]");
  if (!btn) return;
  navigate(btn.dataset.page);
});

/* ================================================================
   REFRESH RING (countdown)
   ================================================================ */

const SIGNALS_INTERVAL  = 60;
const GRACE_PERIOD_LIMIT = 200;
const CIRCUMFERENCE     = 2 * Math.PI * 13;
let signalsSecs = SIGNALS_INTERVAL;

function tickRefreshRing() {
  signalsSecs--;
  if (signalsSecs <= 0) {
    signalsSecs = SIGNALS_INTERVAL;
    loadSignals(true);
  }
  const pct    = signalsSecs / SIGNALS_INTERVAL;
  const offset = CIRCUMFERENCE * (1 - pct);
  const ring   = $("#ring-progress");
  const label  = $("#ring-label");
  if (ring)  ring.style.strokeDashoffset = offset;
  if (label) label.textContent = signalsSecs > 99 ? "—" : `${signalsSecs}`;
  const cd = $("#signals-cd-secs");
  if (cd) cd.textContent = signalsSecs;
}

/* ================================================================
   DATA LOADERS
   ================================================================ */

async function loadBtc() {
  try {
    const d = await api("/market/btc");
    if (!d) return;
    state.btcPrice = d.price;
    const fmt = fmtUsd(d.price);
    setText("#btc-nav", `BTC ${fmt}`);
    setText("#dash-btc", fmt);
    updateLastUpdate();
  } catch { /* silent */ }
}

async function loadBalance() {
  try {
    const d = await api("/account/balance");
    if (!d) return;
    state.balances = d.balances || [];
    const usdt   = state.balances.find(b => b.asset === "USDT");
    state.usdtFree = usdt ? parseFloat(usdt.free) : 0;
    const locked = usdt ? parseFloat(usdt.locked) : 0;

    setText("#dash-usdt", fmtUsdt(state.usdtFree));
    setText("#dash-usdt-sub", locked > 0
      ? `${fmtNum(locked, 2)} bloqueado · ${state.balances.length} activos`
      : `${state.balances.length} activos en cartera`);
    updateInvestUI();
  } catch { /* silent */ }
}

async function loadOrdersCount() {
  try {
    const d = await api("/orders/open");
    if (!d) return;
    setText("#dash-orders", d.count);
  } catch { /* silent */ }
}

async function loadSignals(silent = false) {
  if (!silent) {
    $("#signals-list").innerHTML = `<div class="skeleton-list">
      ${Array(4).fill('<div class="signal-skeleton"></div>').join("")}
    </div>`;
  }
  const refreshBtn = $("#force-refresh");
  if (refreshBtn) refreshBtn.classList.add("spinning");

  try {
    const [top10, gracia] = await Promise.all([
      api("/signals/top10?limit=10&original=true"),
      api(`/signals/periodo-gracia?limit=${GRACE_PERIOD_LIMIT}`),
    ]);
    if (!top10 || !gracia) return;
    state.top10  = top10;
    state.gracia = gracia;

    setText("#dash-signals", top10.length);
    setText("#tab-top10-count", top10.length);
    setText("#tab-gracia-count", gracia.length);

    renderSignalsList();
    renderDashboardPreviews();
    updateLastUpdate();
    loadSocialMetadata([...top10, ...gracia]);
  } catch (e) {
    const el = $("#signals-list");
    if (el) el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  } finally {
    if (refreshBtn) refreshBtn.classList.remove("spinning");
  }
}

async function loadSocialMetadata(coins) {
  const unique = new Map();
  coins.forEach(c => {
    if (c?.symbol && c?.name) unique.set(c.symbol, { symbol: c.symbol, name: c.name });
  });
  const missing = Array.from(unique.values()).filter(c => !state.metadata[c.symbol]);
  const queued = missing.filter(c => !metadataInFlight.has(c.symbol));
  if (!queued.length) return;
  queued.forEach(c => metadataInFlight.add(c.symbol));

  try {
    const data = await api("/market/metadata", {
      method: "POST",
      body: JSON.stringify({ coins: queued }),
    });
    if (!data?.metadata) return;
    state.metadata = { ...state.metadata, ...data.metadata };
    renderSignalsList();
    renderDashboardPreviews();
    if (state.selectedCoin) fillTradePanel(state.selectedCoin);
  } catch {
    /* Metadata is a nice-to-have */
  } finally {
    queued.forEach(c => metadataInFlight.delete(c.symbol));
  }
}

function updateLastUpdate() {
  const el = $("#last-update-time");
  if (el) el.textContent = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ================================================================
   DASHBOARD PREVIEWS
   ================================================================ */

function renderDashboardPreviews() {
  renderPreviewGrid("#dash-preview", state.top10.slice(0, 3));
  renderPreviewGrid("#dash-gracia-preview", state.gracia.slice(0, 3));
}

function renderPreviewGrid(sel, coins) {
  const el = $(sel);
  if (!el) return;
  if (!coins.length) {
    el.innerHTML = `<div class="empty-state">Sin datos.</div>`;
    return;
  }
  el.innerHTML = coins.map(c => {
    const pct      = c.current_increase_percentage;
    const canTrade = !!c.binance_pair;
    return `
    <div class="preview-card" data-symbol="${c.symbol}">
      <div class="preview-card__top">
        <div class="preview-card__coin">
          ${logoHtml(c.symbol)}
          <div>
            <div class="preview-card__symbol">${c.symbol}</div>
            <div class="preview-card__name">${c.name}</div>
          </div>
        </div>
        <div class="preview-card__pct ${pctClass(pct)}">${fmtPct(pct)}</div>
      </div>
      <div class="preview-card__prices">
        <div>
          <div class="preview-card__price-label">Entrada</div>
          <div class="preview-card__price-val">${fmtUsd(c.initial_price_usd)}</div>
        </div>
        <div style="text-align:right">
          <div class="preview-card__price-label">Actual</div>
          <div class="preview-card__price-val">${fmtUsd(c.current_price_usd)}</div>
        </div>
      </div>
      ${socialLinksHtml(c)}
      <div class="preview-card__footer">
        <span class="preview-card__binance ${canTrade ? "ok" : "warn"}">
          ${canTrade ? `● ${c.binance_pair}` : "○ Sin par USDT"}
        </span>
        <div class="preview-card__actions">
          <a class="btn-market" href="${coinMarketCapUrl(c)}" target="_blank" rel="noopener noreferrer" title="Ver ${c.symbol} en CoinMarketCap" data-cmc>
            ${coinMarketCapLabel()}
          </a>
          <button class="btn-trade" ${canTrade ? "" : "disabled"} data-trade="${c.symbol}">
            Operar →
          </button>
        </div>
      </div>
    </div>`;
  }).join("");

  el.querySelectorAll("[data-cmc]").forEach(link => {
    link.addEventListener("click", (e) => e.stopPropagation());
  });
  el.querySelectorAll("[data-social]").forEach(link => {
    link.addEventListener("click", (e) => e.stopPropagation());
  });
  el.querySelectorAll("[data-trade]").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); selectCoin(btn.dataset.trade); });
  });
  el.querySelectorAll(".preview-card").forEach(card => {
    card.addEventListener("click", () => navigate("signals"));
  });
}

/* ================================================================
   SIGNALS LIST
   ================================================================ */

function renderSignalsList() {
  const coins = state.currentTab === "top10" ? state.top10 : state.gracia;
  const el    = $("#signals-list");
  if (!el) return;

  if (!coins.length) {
    el.innerHTML = `<div class="empty-state">Sin señales disponibles.</div>`;
    return;
  }

  el.innerHTML = coins.map((c, i) => {
    const rank     = c.rank ?? i + 1;
    const pct      = c.current_increase_percentage;
    const canTrade = !!c.binance_pair;
    const isSelected = state.selectedCoin?.symbol === c.symbol;

    return `
    <div class="signal-row ${isSelected ? "is-selected" : ""}" data-symbol="${c.symbol}">
      <div class="signal-row__rank">${rank}</div>
      <div class="signal-row__coin">
        ${logoHtml(c.symbol)}
        <div class="signal-row__coinname">
          <div class="signal-row__symbol">${c.symbol}</div>
          <div class="signal-row__name">${c.name}</div>
          <div class="signal-row__socials">${socialLinksHtml(c, "coin")}</div>
        </div>
      </div>
      <div class="signal-row__prices">
        <div class="signal-row__price-entry">Entrada: ${fmtUsd(c.initial_price_usd)}</div>
        <div class="signal-row__price-current">${fmtUsd(c.current_price_usd)}</div>
        <div class="signal-row__tags">
          <span class="chip ${canTrade ? "binance-ok" : "binance-warn"}">
            ${canTrade ? `● ${c.binance_pair}` : "○ Sin par Binance"}
          </span>
          <span class="chip">↑ ${timeAgo(c.in_top_since)}</span>
          <span class="chip">vol ${fmtVol(c.volumen24h)}</span>
          <a class="chip chip-link" href="${coinMarketCapUrl(c)}" target="_blank" rel="noopener noreferrer" data-cmc>${coinMarketCapLabel()}</a>
        </div>
      </div>
      <div class="signal-row__pct">
        <div class="pct-now ${pctClass(pct)}">${fmtPct(pct)}</div>
        <div class="pct-max">máx ${fmtPct(c.max_increase_percentage)}</div>
      </div>
      <div class="signal-row__actions">
        <a class="btn-market" href="${coinMarketCapUrl(c)}" target="_blank" rel="noopener noreferrer" title="Ver ${c.symbol} en CoinMarketCap" data-cmc>
          ${coinMarketCapLabel()}
        </a>
        <button class="btn-trade" ${canTrade ? "" : "disabled"} data-trade="${c.symbol}">
          Operar →
        </button>
      </div>
    </div>`;
  }).join("");

  el.querySelectorAll("[data-cmc]").forEach(link => {
    link.addEventListener("click", (e) => e.stopPropagation());
  });
  el.querySelectorAll("[data-social]").forEach(link => {
    link.addEventListener("click", (e) => e.stopPropagation());
  });
  el.querySelectorAll("[data-trade]").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); selectCoin(btn.dataset.trade); });
  });
  el.querySelectorAll(".signal-row").forEach(row => {
    row.addEventListener("click", () => selectCoin(row.dataset.symbol));
  });
}

/* ================================================================
   COIN SELECTION → TRADE PAGE
   ================================================================ */

function selectCoin(symbol) {
  const all  = [...state.top10, ...state.gracia];
  const coin = all.find(c => c.symbol === symbol);
  if (!coin) return;
  state.selectedCoin = coin;

  $$(".signal-row").forEach(r => r.classList.toggle("is-selected", r.dataset.symbol === symbol));

  const mnavTrade = $("#mnav-trade");
  if (mnavTrade) mnavTrade.disabled = false;

  navigate("trade");
  fillTradePanel(coin);
  loadCoinExtras(coin);
  loadPriceChart(coin.symbol);
  loadPctChart(coin.symbol);
  loadRankChart(coin.symbol);
}

function fillTradePanel(coin) {
  const empty  = $("#trade-empty");
  const layout = $("#trade-layout");
  if (empty)  empty.hidden = true;
  if (layout) layout.hidden = false;

  const logoImg = $("#trade-logo");
  const logoFb  = $("#trade-logo-fb");
  if (logoImg) {
    logoImg.src = `${LOGO_BASE}/${coin.symbol.toLowerCase()}.png`;
    logoImg.style.display = "";
    logoImg.onerror = () => {
      logoImg.style.display = "none";
      if (logoFb) { logoFb.style.display = "flex"; logoFb.textContent = coin.symbol.slice(0, 3); }
    };
  }
  if (logoFb) logoFb.style.display = "none";

  setText("#trade-symbol", coin.symbol);
  setText("#trade-name",   coin.name);
  setText("#trade-price",  fmtUsd(coin.current_price_usd));

  const pct = coin.current_increase_percentage;
  const changeEl = $("#trade-change");
  if (changeEl) { changeEl.textContent = `${fmtPct(pct)} desde entrada`; changeEl.className = `trade-change ${pctClass(pct)}`; }

  const availEl = $("#trade-avail");
  if (availEl) {
    const cmcLink = `<a class="trade-market-link" href="${coinMarketCapUrl(coin)}" target="_blank" rel="noopener noreferrer">${coinMarketCapLabel()}</a>`;
    if (coin.binance_pair) {
      availEl.className = "trade-availability ok";
      availEl.innerHTML = `● Disponible en Binance · <strong>${coin.binance_pair}</strong> · ${cmcLink}`;
    } else {
      availEl.className   = "trade-availability warn";
      availEl.innerHTML = `○ Sin par USDT en Binance — no disponible para operar aquí · ${cmcLink}`;
    }
  }

  const socialEl = $("#trade-socials");
  if (socialEl) {
    const socials = socialLinksHtml(coin, "full");
    socialEl.innerHTML = socials || `<div class="empty-mini">Sin redes guardadas todavía.</div>`;
  }

  setText("#tstat-initial", fmtUsd(coin.initial_price_usd));
  setText("#tstat-max",     fmtUsd(coin.max_price_usd));
  setText("#tstat-vol",     fmtVol(coin.volumen24h));
  setText("#tstat-since",   timeAgo(coin.in_top_since) + " atrás");

  // Pre-cargar precio límite con el precio actual
  const limitInput = $("#f-limit-price");
  if (limitInput && coin.current_price_usd) {
    const d = coin.current_price_usd < 1 ? 6 : coin.current_price_usd < 10 ? 4 : 2;
    limitInput.value = parseFloat(coin.current_price_usd.toFixed(d));
    setText("#f-limit-display", `Precio actual: ${fmtUsd(coin.current_price_usd)}`);
  }

  updateOcoPrices(coin.current_price_usd);
  updateFormSide();

  const slider = $("#invest-slider");
  if (slider) { slider.value = 0; updateInvestUI(); }

  const placeBtn = $("#btn-place");
  if (placeBtn) placeBtn.disabled = !coin.binance_pair;

  const msg = $("#form-msg");
  if (msg) {
    msg.textContent = coin.binance_pair ? "" : "Este par no tiene mercado en Binance.";
    msg.className   = coin.binance_pair ? "form-msg" : "form-msg err";
  }
}

/* Actualiza qué sección del form se muestra según BUY/SELL */
function updateFormSide() {
  const isBuy = state.side === "BUY";
  const buySection  = $("#buy-limit-section");
  const sellSection = $("#sell-oco-section");
  const eyebrow     = $("#form-eyebrow");
  const btnLabel    = $("#btn-place-label");

  if (buySection)  buySection.style.display  = isBuy ? "" : "none";
  if (sellSection) sellSection.style.display = isBuy ? "none" : "";
  if (eyebrow)     eyebrow.textContent = isBuy ? "Orden Límite · Binance Spot (BUY)" : "Orden OCO · Binance Spot (SELL)";
  if (btnLabel)    btnLabel.textContent = isBuy ? "Comprar a límite" : "Colocar orden OCO";
}

/* ================================================================
   PRICE CHART (Chart 1)
   ================================================================ */

function makeChartConfig({ labels, data, color, fillA, isUp, minVal, formatCallback }) {
  return {
    type: "line",
    data: {
      labels,
      datasets: [{
        data,
        borderColor: color,
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        backgroundColor: (ctx2) => {
          const chart = ctx2.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return fillA;
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, isUp ? "rgba(52,211,153,0.22)" : "rgba(248,113,113,0.18)");
          gradient.addColorStop(1, "rgba(0,0,0,0)");
          return gradient;
        },
        pointRadius: data.length > 20 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: color,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(17,21,32,0.96)",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          titleColor: "rgba(255,255,255,0.5)",
          bodyColor: "#EEF2FC",
          titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
          bodyFont:  { family: "'JetBrains Mono', monospace", size: 13, weight: "600" },
          padding: 10,
          callbacks: { label: (ctx2) => formatCallback(ctx2.raw) },
        },
      },
      scales: {
        x: {
          grid:  { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#424F65", font: { family: "'JetBrains Mono', monospace", size: 10 }, maxTicksLimit: 6, maxRotation: 0 },
          border: { color: "rgba(255,255,255,0.06)" },
        },
        y: {
          position: "right",
          grid:  { color: "rgba(255,255,255,0.04)" },
          ticks: {
            color: "#7E8BA0", font: { family: "'JetBrains Mono', monospace", size: 10 },
            maxTicksLimit: 5,
            callback: (v) => formatCallback(v),
          },
          border: { color: "rgba(255,255,255,0.06)" },
          ...(formatCallback._reversed ? { reverse: true } : {}),
        },
      },
      interaction: { mode: "index", intersect: false },
    },
  };
}

async function loadPriceChart(symbol) {
  const chartWrap  = $("#chart-card .chart-wrap");
  const chartEmpty = $("#chart-empty");
  const subEl      = $("#chart-sub");

  if (subEl) subEl.textContent = "Cargando…";
  if (chartEmpty) chartEmpty.hidden = true;
  if (chartWrap)  chartWrap.style.display = "";

  try {
    const points = await api(`/signals/chart/${symbol}?limit=60`);
    if (!points || points.length < 2) {
      if (chartWrap)  chartWrap.style.display = "none";
      if (chartEmpty) chartEmpty.hidden = false;
      if (subEl) subEl.textContent = "Sin historial";
      return;
    }

    if (subEl) subEl.textContent = `${points.length} snapshots`;

    const labels = points.map(p => fmtTime(p.t));
    const prices = points.map(p => p.price);
    const minP   = Math.min(...prices);
    const firstP = prices[0];
    const lastP  = prices[prices.length - 1];
    const isUp   = lastP >= firstP;
    const color  = isUp ? "rgba(52,211,153,1)" : "rgba(248,113,113,1)";
    const fillA  = isUp ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.10)";

    const canvas = $("#price-chart");
    if (!canvas) return;
    if (state.priceChart) { state.priceChart.destroy(); state.priceChart = null; }

    const fmt = (v) => fmtUsd(v, minP < 0.01 ? 6 : 2);
    state.priceChart = new Chart(canvas.getContext("2d"), makeChartConfig({
      labels, data: prices, color, fillA, isUp, minVal: minP, formatCallback: fmt,
    }));
  } catch {
    const chartWrap2 = $("#chart-card .chart-wrap");
    if (chartWrap2)  chartWrap2.style.display = "none";
    if (chartEmpty) chartEmpty.hidden = false;
    if (subEl) subEl.textContent = "Error al cargar";
  }
}

/* ================================================================
   PCT CHART (Chart 2 — % desde entrada)
   ================================================================ */

async function loadPctChart(symbol) {
  const wrap  = $("#pct-chart-card .chart-wrap");
  const empty = $("#pct-chart-empty");
  const sub   = $("#pct-chart-sub");

  if (sub)   sub.textContent = "Cargando…";
  if (empty) empty.hidden = true;
  if (wrap)  wrap.style.display = "";

  try {
    const points = await api(`/signals/pct-chart/${symbol}?limit=60`);
    if (!points || points.length < 2) {
      if (wrap)  wrap.style.display = "none";
      if (empty) empty.hidden = false;
      if (sub) sub.textContent = "Sin historial";
      return;
    }

    if (sub) sub.textContent = `${points.length} snapshots`;

    const labels = points.map(p => fmtTime(p.t));
    const pcts   = points.map(p => p.pct);
    const firstP = pcts[0];
    const lastP  = pcts[pcts.length - 1];
    const isUp   = lastP >= firstP;
    const color  = isUp ? "rgba(52,211,153,1)" : "rgba(248,113,113,1)";
    const fillA  = isUp ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.10)";
    const fmt    = (v) => `${v > 0 ? "+" : ""}${Number(v).toFixed(2)}%`;

    const canvas = $("#pct-chart");
    if (!canvas) return;
    if (state.pctChart) { state.pctChart.destroy(); state.pctChart = null; }

    state.pctChart = new Chart(canvas.getContext("2d"), makeChartConfig({
      labels, data: pcts, color, fillA, isUp, minVal: Math.min(...pcts), formatCallback: fmt,
    }));
  } catch {
    if (wrap)  wrap.style.display = "none";
    if (empty) empty.hidden = false;
    if (sub) sub.textContent = "Error al cargar";
  }
}

/* ================================================================
   RANK CHART (Chart 3 — posición en ranking)
   ================================================================ */

async function loadRankChart(symbol) {
  const wrap  = $("#rank-chart-card .chart-wrap");
  const empty = $("#rank-chart-empty");
  const sub   = $("#rank-chart-sub");

  if (sub)   sub.textContent = "Cargando…";
  if (empty) empty.hidden = true;
  if (wrap)  wrap.style.display = "";

  try {
    const points = await api(`/signals/rank-chart/${symbol}?limit=60`);
    if (!points || points.length < 2) {
      if (wrap)  wrap.style.display = "none";
      if (empty) empty.hidden = false;
      if (sub) sub.textContent = "Sin historial de ranking";
      return;
    }

    if (sub) sub.textContent = `${points.length} snapshots`;

    const labels = points.map(p => fmtTime(p.t));
    const ranks  = points.map(p => p.rank);
    // En ranking: posición 1 es mejor, por eso invertimos el eje Y
    const firstP = ranks[0];
    const lastP  = ranks[ranks.length - 1];
    // Mejor ranking (número más bajo) = ganancia
    const improved = lastP <= firstP;
    const color  = improved ? "rgba(52,211,153,1)" : "rgba(248,113,113,1)";
    const fillA  = improved ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.10)";
    const fmt    = (v) => `#${Math.round(v)}`;
    fmt._reversed = true;  // señal para invertir el eje Y

    const canvas = $("#rank-chart");
    if (!canvas) return;
    if (state.rankChart) { state.rankChart.destroy(); state.rankChart = null; }

    const config = makeChartConfig({
      labels, data: ranks, color, fillA, isUp: improved, minVal: 1, formatCallback: fmt,
    });
    // Invertir eje Y para que posición 1 esté arriba
    config.options.scales.y.reverse = true;
    config.options.scales.y.min = 1;
    config.options.scales.y.max = 10;
    config.options.scales.y.ticks.stepSize = 1;
    config.options.scales.y.ticks.callback = (v) => `#${v}`;

    state.rankChart = new Chart(canvas.getContext("2d"), config);
  } catch {
    if (wrap)  wrap.style.display = "none";
    if (empty) empty.hidden = false;
    if (sub) sub.textContent = "Sin datos de ranking";
  }
}

/* ================================================================
   PORTFOLIO PAGE
   ================================================================ */

async function loadPortfolio() {
  const listEl    = $("#portfolio-list");
  const totalEl   = $("#portfolio-total");
  const centerNum = $("#portfolio-center-num");

  if (listEl) listEl.innerHTML = `<div class="loading-state">Cargando portafolio…</div>`;

  try {
    const d = await api("/account/portfolio");
    if (!d) return;

    if (totalEl) totalEl.textContent = `$${d.total_usdt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
    if (centerNum) centerNum.textContent = d.assets.length;

    // Donut chart
    const canvas = $("#portfolio-donut");
    if (canvas) {
      if (state.portfolioChart) { state.portfolioChart.destroy(); state.portfolioChart = null; }

      const PALETTE = [
        "#00C9A7","#3B82F6","#F59E0B","#EC4899","#8B5CF6",
        "#10B981","#EF4444","#06B6D4","#F97316","#84CC16",
        "#A78BFA","#34D399","#FB923C","#38BDF8","#4ADE80",
      ];

      const labels = d.assets.slice(0, 15).map(a => a.asset);
      const values = d.assets.slice(0, 15).map(a => a.value_usdt);
      const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

      state.portfolioChart = new Chart(canvas.getContext("2d"), {
        type: "doughnut",
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderColor: "rgba(8,10,15,0.8)",
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(17,21,32,0.96)",
              borderColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
              titleColor: "rgba(255,255,255,0.5)",
              bodyColor: "#EEF2FC",
              titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
              bodyFont:  { family: "'JetBrains Mono', monospace", size: 13, weight: "600" },
              padding: 10,
              callbacks: {
                label: (ctx) => {
                  const item = d.assets[ctx.dataIndex];
                  return ` $${item.value_usdt.toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2})} · ${item.pct}%`;
                },
              },
            },
          },
        },
      });
    }

    // Tabla
    if (listEl) {
      if (!d.assets.length) {
        listEl.innerHTML = `<div class="empty-state">Sin activos en Spot Wallet.</div>`;
        return;
      }
      const PALETTE = [
        "#00C9A7","#3B82F6","#F59E0B","#EC4899","#8B5CF6",
        "#10B981","#EF4444","#06B6D4","#F97316","#84CC16",
        "#A78BFA","#34D399","#FB923C","#38BDF8","#4ADE80",
      ];
      listEl.innerHTML = d.assets.map((a, i) => {
        const color = PALETTE[i % PALETTE.length];
        const barW  = Math.max(a.pct, 0.5);
        return `
        <div class="portfolio-row">
          <div class="portfolio-row__asset">
            <div class="portfolio-row__dot" style="background:${color}"></div>
            ${logoHtml(a.asset, "coin-avatar coin-avatar--sm")}
            <div>
              <div class="portfolio-row__symbol">${a.asset}</div>
              <div class="portfolio-row__qty">${fmtNum(a.total, 6)}</div>
            </div>
          </div>
          <div class="portfolio-row__price">${a.price_usdt > 0 ? fmtUsd(a.price_usdt) : "—"}</div>
          <div class="portfolio-row__qty-cell">
            <span class="portfolio-row__free">${fmtNum(a.free, 6)}</span>
            ${a.locked > 0 ? `<span class="portfolio-row__locked"> + ${fmtNum(a.locked, 6)} 🔒</span>` : ""}
          </div>
          <div class="portfolio-row__value">${fmtUsdt(a.value_usdt)}</div>
          <div class="portfolio-row__pct-bar">
            <div class="portfolio-row__pct-fill" style="width:${barW}%;background:${color}"></div>
            <span class="portfolio-row__pct-label">${a.pct}%</span>
          </div>
        </div>`;
      }).join("");
    }
  } catch (e) {
    if (listEl) listEl.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

/* ================================================================
   COIN EXTRAS (orders + P&L in sidebar)
   ================================================================ */

async function loadCoinExtras(coin) {
  if (!coin.binance_pair) {
    setText("#sidebar-orders-count", "0");
    const so = $("#sidebar-orders");
    if (so) so.innerHTML = `<div class="empty-mini">Sin par en Binance.</div>`;
    const sp = $("#sidebar-pnl");
    if (sp) sp.innerHTML = `<div class="empty-mini">Sin par en Binance.</div>`;
    return;
  }

  try {
    const d = await api(`/orders/open?symbol=${coin.binance_pair}`);
    if (!d) return;
    state.openOrders = d.open_orders || [];
    setText("#sidebar-orders-count", state.openOrders.length);
    renderSidebarOrders(coin.binance_pair);
  } catch (e) {
    const el = $("#sidebar-orders");
    if (el) el.innerHTML = `<div class="empty-mini">Error: ${e.message}</div>`;
  }

  try {
    const d = await api(`/account/trades/${coin.symbol}`);
    if (!d) return;
    renderSidebarPnl(d);
  } catch {
    const el = $("#sidebar-pnl");
    if (el) el.innerHTML = `<div class="empty-mini">Sin historial de trades.</div>`;
  }
}

function renderSidebarOrders(pair) {
  const el = $("#sidebar-orders");
  if (!el) return;
  if (!state.openOrders.length) {
    el.innerHTML = `<div class="empty-mini">Sin órdenes en este par.</div>`;
    return;
  }
  el.innerHTML = state.openOrders.map(o => {
    // Buscar metadata local
    const refKey = o.orderListId != null && o.orderListId !== -1
      ? String(o.orderListId)
      : String(o.orderId);
    const meta = state.localOrders[refKey];
    const posLabel = meta?.coinscanx_position === "top10" ? "Top 10" : meta?.coinscanx_position === "periodo_gracia" ? "P. Gracia" : null;
    return `
    <div class="order-item">
      <div class="order-item__info">
        <span class="side-chip ${o.side}">${o.side}</span>
        <strong>${o.type}</strong><br>
        <span>${fmtNum(parseFloat(o.origQty), 6)} @ ${fmtUsd(parseFloat(o.price))}</span>
        ${o.stopPrice && parseFloat(o.stopPrice) > 0 ? `<br><span>stop: ${fmtUsd(parseFloat(o.stopPrice))}</span>` : ""}
        ${meta ? `
        <div class="order-meta">
          ${meta.coinscanx_price ? `<span class="order-meta__item">CSX: ${fmtUsd(meta.coinscanx_price)}</span>` : ""}
          ${meta.binance_price_at_launch ? `<span class="order-meta__item">Binance: ${fmtUsd(meta.binance_price_at_launch)}</span>` : ""}
          ${posLabel ? `<span class="order-meta__badge">${posLabel}${meta.coinscanx_rank ? ` #${meta.coinscanx_rank}` : ""}</span>` : ""}
          ${meta.coinscanx_pct != null ? `<span class="order-meta__item ${meta.coinscanx_pct >= 0 ? "gain" : "loss"}">${fmtPct(meta.coinscanx_pct)}</span>` : ""}
        </div>` : ""}
      </div>
      <button class="btn-cancel" data-cancel="${o.orderId}" data-pair="${pair}">Cancelar</button>
    </div>`;
  }).join("");

  el.querySelectorAll("[data-cancel]").forEach(btn =>
    btn.addEventListener("click", () => cancelOrder(btn.dataset.pair, btn.dataset.cancel))
  );
}

function renderSidebarPnl(data) {
  const el = $("#sidebar-pnl");
  if (!el) return;
  if (!data?.trades?.length) {
    el.innerHTML = `<div class="empty-mini">Sin trades registrados.</div>`;
    return;
  }
  const s = data.summary;
  const totalClass = s.total_pnl_usdt >= 0 ? "gain" : "loss";
  const sign = s.total_pnl_usdt >= 0 ? "+" : "";

  el.innerHTML = `
    <div class="pnl-row">
      <div class="pnl-mini">
        <div class="pnl-mini__label">P&L Total</div>
        <div class="pnl-mini__val ${totalClass}">${sign}${fmtUsdt(s.total_pnl_usdt)}</div>
        <div class="pnl-mini__sub">realizado + abierto</div>
      </div>
      <div class="pnl-mini">
        <div class="pnl-mini__label">Posición</div>
        <div class="pnl-mini__val">${fmtNum(s.open_position_qty, 6)}</div>
        <div class="pnl-mini__sub">prom. ${fmtUsd(s.avg_buy_price)}</div>
      </div>
    </div>
    ${data.trades.slice(-5).reverse().map(t => `
      <div class="trade-mini">
        <span class="side-chip ${t.side}">${t.side}</span>
        <div class="trade-mini__detail"><strong>${fmtNum(t.qty, 4)}</strong> @ ${fmtUsd(t.price)}</div>
        <span class="trade-mini__date">${fmtDate(t.time)}</span>
      </div>
    `).join("")}`;
}

/* ================================================================
   OCO FORM — precios calculados por porcentaje
   ================================================================ */

function updateOcoPrices(currentPrice) {
  if (!currentPrice) return;
  const gainPct = parseFloat($("#f-gain-pct")?.value || 10);
  const lossPct = parseFloat($("#f-loss-pct")?.value || 5);
  const d = currentPrice < 1 ? 6 : currentPrice < 10 ? 4 : 2;
  const takeProfit = currentPrice * (1 + gainPct / 100);
  const stopPrice  = currentPrice * (1 - lossPct / 100);
  const priceEl = $("#f-price-display");
  const stopEl  = $("#f-stop-display");
  if (priceEl) priceEl.textContent = `→ ${fmtUsd(takeProfit, d)}`;
  if (stopEl)  stopEl.textContent  = `→ ${fmtUsd(stopPrice,  d)}`;
}

function updateInvestUI() {
  const slider = $("#invest-slider");
  if (!slider) return;
  const pct  = parseFloat(slider.value);
  slider.style.setProperty("--pct", `${pct}%`);

  const coin  = state.selectedCoin;
  const isBuy = state.side === "BUY";

  let available = 0;
  if (isBuy) {
    available = state.usdtFree;
    setText("#invest-card-label", "Cantidad a invertir (USDT)");
  } else if (coin) {
    const asset = state.balances.find(b => b.asset === coin.symbol);
    available = asset ? parseFloat(asset.free) : 0;
    setText("#invest-card-label", `Vender ${coin.symbol}`);
  }

  const availEl = $("#invest-avail");
  if (availEl) availEl.textContent = isBuy ? fmtUsdt(available) : `${fmtNum(available, 6)} ${coin?.symbol || ""}`;

  const amount = available * pct / 100;

  if (isBuy && coin?.current_price_usd) {
    setText("#invest-usdt", fmtUsdt(amount));
    setText("#invest-qty",  `${fmtNum(amount / coin.current_price_usd, 6)} ${coin.symbol}`);
  } else if (!isBuy && coin?.current_price_usd) {
    setText("#invest-usdt", `${fmtNum(amount, 6)} ${coin.symbol}`);
    setText("#invest-qty",  fmtUsdt(amount * coin.current_price_usd));
  } else {
    setText("#invest-usdt", isBuy ? "0.00 USDT" : "0");
    setText("#invest-qty", "—");
  }
}

async function placeOrder() {
  const coin = state.selectedCoin;
  if (!coin?.binance_pair) return;

  const pct = parseFloat($("#invest-slider")?.value || 0);
  if (pct <= 0) { toast("Mueve la barra para definir la cantidad.", "err"); return; }

  const isBuy = state.side === "BUY";
  let quantity;
  if (isBuy) {
    quantity = (state.usdtFree * pct / 100) / coin.current_price_usd;
  } else {
    const asset = state.balances.find(b => b.asset === coin.symbol);
    quantity = ((asset ? parseFloat(asset.free) : 0) * pct / 100);
  }
  quantity = parseFloat(quantity.toFixed(6));

  const btn = $("#btn-place");
  if (btn) btn.disabled = true;

  try {
    if (isBuy) {
      // ── BUY: orden LIMIT ────────────────────────────────────
      const limitInput = parseFloat($("#f-limit-price")?.value || 0);
      if (!limitInput || limitInput <= 0) { toast("Define el precio límite de compra.", "err"); return; }

      const cp = coin.current_price_usd;
      const d  = cp < 1 ? 6 : cp < 10 ? 4 : 2;
      const limitPrice = parseFloat(limitInput.toFixed(d));

      const body = {
        symbol:   coin.binance_pair,
        side:     "BUY",
        quantity,
        price:    limitPrice,
      };

      await api("/orders/limit", { method: "POST", body: JSON.stringify(body) });
      toast(`Orden LIMIT BUY enviada · ${coin.binance_pair} @ ${fmtUsd(limitPrice)}`, "ok");

    } else {
      // ── SELL: orden OCO ─────────────────────────────────────
      const cp      = coin.current_price_usd;
      const gainPct = parseFloat($("#f-gain-pct")?.value || 10);
      const lossPct = parseFloat($("#f-loss-pct")?.value || 5);

      if (!gainPct || !lossPct || gainPct <= 0 || lossPct <= 0) {
        toast("Define los porcentajes de ganancia y pérdida.", "err");
        return;
      }

      const d         = cp < 1 ? 6 : cp < 10 ? 4 : 2;
      const takeProfit = parseFloat((cp * (1 + gainPct / 100)).toFixed(d));
      const stopPrice  = parseFloat((cp * (1 - lossPct / 100)).toFixed(d));

      const body = {
        symbol:           coin.binance_pair,
        side:             "SELL",
        quantity,
        price:            takeProfit,
        stop_price:       stopPrice,
        stop_limit_price: stopPrice,
      };

      await api("/orders/oco", { method: "POST", body: JSON.stringify(body) });
      toast(`Orden OCO SELL enviada · ${coin.binance_pair}`, "ok");
    }

    const slider = $("#invest-slider");
    if (slider) { slider.value = 0; updateInvestUI(); }
    await Promise.all([loadBalance(), loadOrdersCount(), loadCoinExtras(coin)]);
    // Recargar metadata local para que los nuevos badges aparezcan
    loadLocalOrdersMetadata();

  } catch (e) {
    toast(`Error: ${e.message}`, "err");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function cancelOrder(pair, orderId) {
  if (!confirm(`¿Cancelar orden #${orderId}?`)) return;
  try {
    await api(`/orders/${pair}/${orderId}`, { method: "DELETE" });
    toast("Orden cancelada.", "ok");
    await Promise.all([loadOrdersCount(), loadCoinExtras(state.selectedCoin)]);
  } catch (e) {
    toast(`Error al cancelar: ${e.message}`, "err");
  }
}

/* Carga metadata local de órdenes en state.localOrders (keyed por order_reference) */
async function loadLocalOrdersMetadata() {
  try {
    const data = await api("/orders/metadata");
    if (!data) return;
    state.localOrders = {};
    data.forEach(o => { state.localOrders[o.order_reference] = o; });
  } catch { /* silent */ }
}

/* ================================================================
   ORDERS PAGE
   ================================================================ */

/* Helper: obtener precio actual de una moneda (cache simple) */
const priceCache = {};
async function getSymbolPrice(symbol) {
  if (priceCache[symbol] !== undefined) return priceCache[symbol];
  // Buscar en signals cargadas
  const allCoins = [...state.top10, ...state.gracia];
  const coin = allCoins.find(c => c.symbol === symbol);
  if (coin?.current_price_usd) {
    priceCache[symbol] = coin.current_price_usd;
    return coin.current_price_usd;
  }
  // Si no está, fetch del API
  try {
    const d = await api(`/market/price/${symbol}USDT`);
    if (d?.price) {
      priceCache[symbol] = d.price;
      return d.price;
    }
  } catch {
    // silencio
  }
  return null;
}

async function loadAllOrders() {
  const el = $("#all-orders-list");
  if (!el) return;

  // Cargar metadata local primero
  await loadLocalOrdersMetadata();

  try {
    const d = await api("/orders/open");
    if (!d) return;
    setText("#dash-orders", d.count);
    if (!d.open_orders?.length) {
      el.innerHTML = `<div class="empty-state">No tienes órdenes abiertas en este momento.</div>`;
      return;
    }

    // Agrupar órdenes OCO: mismo orderListId = una sola orden con dos sub-órdenes
    const grouped = new Map();
    d.open_orders.forEach(o => {
      const groupKey = o.orderListId != null && o.orderListId !== -1
        ? String(o.orderListId)
        : `order-${o.orderId}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey).push(o);
    });

    // Pre-cargar precios para órdenes OCO
    const prices = {};
    for (const [, orders] of grouped) {
      if (orders.length > 1) {  // Solo para OCO
        const baseSymbol = orders[0].symbol.endsWith("USDT") ? orders[0].symbol.slice(0, -4) : orders[0].symbol;
        const price = await getSymbolPrice(baseSymbol);
        if (price) prices[baseSymbol] = price;
      }
    }

    const rows = Array.from(grouped.entries()).map(([groupKey, orders]) => {
      const primary    = orders[0];
      const baseSymbol = primary.symbol.endsWith("USDT") ? primary.symbol.slice(0, -4) : primary.symbol;
      const refKey     = primary.orderListId != null && primary.orderListId !== -1
        ? String(primary.orderListId) : String(primary.orderId);
      const meta       = state.localOrders[refKey];
      const posLabel   = meta?.coinscanx_position === "top10" ? "Top 10"
        : meta?.coinscanx_position === "periodo_gracia" ? "P. Gracia" : null;
      const isOco      = orders.length > 1;

      // ── Zona 2: líneas de órdenes ──────────────────────────────
      const limitOrder = orders.find(o => o.type === "LIMIT" || o.type === "LIMIT_MAKER");
      const stopOrder  = orders.find(o => o.type !== "LIMIT" && o.type !== "LIMIT_MAKER");

      const linesHtml = [
        limitOrder ? `
          <div class="order-line">
            <span class="order-line__badge order-line__badge--limit">Limit</span>
            <span class="order-line__qty">${fmtNum(parseFloat(limitOrder.origQty), 6)}</span>
            <span class="order-line__sep">@</span>
            <span class="order-line__price">${fmtUsd(parseFloat(limitOrder.price))}</span>
          </div>` : "",
        stopOrder ? `
          <div class="order-line">
            <span class="order-line__badge order-line__badge--stop">Stop</span>
            <span class="order-line__qty">${fmtNum(parseFloat(stopOrder.origQty), 6)}</span>
            <span class="order-line__sep">trigger</span>
            <span class="order-line__price">${fmtUsd(parseFloat(stopOrder.stopPrice || stopOrder.price))}</span>
            ${stopOrder.price && parseFloat(stopOrder.stopPrice) !== parseFloat(stopOrder.price)
              ? `<span class="order-line__sep">→</span><span class="order-line__price">${fmtUsd(parseFloat(stopOrder.price))}</span>` : ""}
          </div>` : "",
        !isOco && limitOrder ? `
          <div class="order-line">
            <span class="order-line__qty">${fmtNum(parseFloat(limitOrder.origQty), 6)} unidades</span>
          </div>` : "",
      ].filter(Boolean).join("");

      // ── Zona 3: PnL para OCO ───────────────────────────────────
      let pnlHtml = "";
      if (isOco && prices[baseSymbol]) {
        const curP      = prices[baseSymbol];
        const tpPrice   = parseFloat(limitOrder?.price || 0);
        const slPrice   = parseFloat(stopOrder?.stopPrice || 0);
        const gainPct   = tpPrice  ? ((tpPrice - curP) / curP) * 100 : null;
        const lossPct   = slPrice  ? ((curP - slPrice) / curP) * 100 : null;

        pnlHtml = `<div class="orders-table-row__pnl">
          ${gainPct != null ? `<div class="order-pnl-block order-pnl-block--gain">
            <span class="order-pnl-block__pct">+${gainPct.toFixed(2)}%</span>
            <span class="order-pnl-block__label">ganancia</span>
          </div>` : ""}
          ${lossPct != null ? `<div class="order-pnl-block order-pnl-block--loss">
            <span class="order-pnl-block__pct">-${lossPct.toFixed(2)}%</span>
            <span class="order-pnl-block__label">pérdida</span>
          </div>` : ""}
        </div>`;
      }

      // ── Zona 4: metadata footer ────────────────────────────────
      const metaHtml = meta ? `
        <div class="orders-table-row__meta">
          <span class="order-meta__item">
            <svg viewBox="0 0 14 14" fill="none" style="width:10px;height:10px;display:inline-block;vertical-align:-1px"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M7 4v3l2 1.3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            ${new Date(meta.created_at).toLocaleString("es",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
          </span>
          ${meta.coinscanx_price ? `<span class="order-meta__item">Precio al entrar: ${fmtUsd(meta.coinscanx_price)}</span>` : ""}
          ${posLabel ? `<span class="order-meta__badge">${posLabel}${meta.coinscanx_rank ? ` #${meta.coinscanx_rank}` : ""}</span>` : ""}
          ${(() => {
            if (!isOco || !meta.coinscanx_price || !prices[baseSymbol]) return "";
            const gainSinceLaunch = ((prices[baseSymbol] - meta.coinscanx_price) / meta.coinscanx_price) * 100;
            const cls = gainSinceLaunch >= 0 ? "gain" : "loss";
            return `<span class="order-meta__item ${cls}">${gainSinceLaunch >= 0 ? "+" : ""}${gainSinceLaunch.toFixed(2)}% desde lanzamiento</span>`;
          })()}
        </div>` : "";

      return `
      <div class="orders-table-row" data-order-row="${groupKey}" data-side="${primary.side}">
        <div class="orders-table-row__body">

          <!-- Zona 1: identidad -->
          <div class="orders-table-row__identity">
            ${logoHtml(baseSymbol, "coin-avatar coin-avatar--sm")}
            <div class="orders-pair">
              <div class="orders-pair__name">
                <strong>${baseSymbol}</strong><span class="orders-pair__sep">/</span><span class="orders-pair__quote">USDT</span>
              </div>
              <div class="orders-pair__badges">
                <span class="side-chip ${primary.side}">${primary.side}</span>
                ${isOco ? `<span class="order-oco-badge">OCO</span>` : `<span class="order-oco-badge order-oco-badge--limit">LIMIT</span>`}
              </div>
            </div>
          </div>

          <!-- Zona 2: líneas de la orden -->
          <div class="orders-table-row__lines">${linesHtml}</div>

          <!-- Zona 3: PnL % -->
          ${pnlHtml}

          <!-- Zona 4: acciones -->
          <div class="orders-table-row__actions">
            <button class="order-chart-btn" data-charts="${groupKey}" data-symbol="${baseSymbol}" title="Ver gráfica de ${baseSymbol}">
              <svg viewBox="0 0 14 14" fill="none" style="width:11px;height:11px"><polyline points="1,10 4,6 7,8 10,3 13,5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
              Gráfica
            </button>
            <button class="btn-cancel" data-cancel="${primary.orderId}" data-pair="${primary.symbol}">✕</button>
          </div>
        </div>
        ${metaHtml}
      </div>`;
    }).join("");

    el.innerHTML = `<div class="orders-table">${rows}</div>`;

    el.querySelectorAll("[data-cancel]").forEach(btn =>
      btn.addEventListener("click", () => cancelOrder(btn.dataset.pair, btn.dataset.cancel))
    );
    el.querySelectorAll("[data-charts]").forEach(btn =>
      btn.addEventListener("click", () => toggleOrderCharts(btn.dataset.charts, btn.dataset.symbol))
    );
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

/* ================================================================
   ORDER CHARTS — inline expandable chart panel per order
   ================================================================ */

function _destroyOrderCharts() {
  if (state.orderPriceChart) { state.orderPriceChart.destroy(); state.orderPriceChart = null; }
  if (state.orderPctChart)   { state.orderPctChart.destroy();   state.orderPctChart   = null; }
  const old = document.getElementById("order-charts-panel");
  if (old) old.remove();
}

function toggleOrderCharts(orderId, symbol) {
  // Toggle off if same row clicked again
  if (state.orderChartsExpanded === orderId) {
    state.orderChartsExpanded = null;
    _destroyOrderCharts();
    $$(".order-chart-btn").forEach(b => b.classList.remove("is-active"));
    return;
  }

  // Close previous
  _destroyOrderCharts();
  $$(".order-chart-btn").forEach(b => b.classList.remove("is-active"));

  state.orderChartsExpanded = orderId;
  const activeBtn = document.querySelector(`[data-charts="${orderId}"]`);
  if (activeBtn) activeBtn.classList.add("is-active");

  // Obtener metadata para este grupo (entrada, tiempo de lanzamiento)
  const refKey    = orderId.startsWith("order-") ? orderId.slice(6) : orderId;
  const meta      = state.localOrders[refKey];
  const entryPrice  = meta?.coinscanx_price   ? parseFloat(meta.coinscanx_price)   : null;
  const launchTime  = meta?.created_at || null;

  // Find the row and insert panel after it
  const row = document.querySelector(`[data-order-row="${orderId}"]`);
  if (!row) return;

  const entryLabel = entryPrice ? `· entrada ${fmtUsd(entryPrice)}` : "";

  const panel = document.createElement("div");
  panel.id = "order-charts-panel";
  panel.className = "order-charts-panel";
  panel.innerHTML = `
    <div class="order-charts-panel__header">
      <span class="order-charts-panel__title">
        <svg viewBox="0 0 14 14" fill="none" style="width:13px;height:13px;display:inline-block;vertical-align:-1px">
          <polyline points="1,10 4,6 7,8 10,3 13,5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        ${symbol} ${entryLabel}
      </span>
      <button class="order-charts-close" id="order-charts-close-btn">✕ Cerrar</button>
    </div>
    <div class="order-charts-panel__grid">
      <div class="order-chart-wrap">
        <div class="order-chart-head">
          <span class="order-chart-title">
            <svg viewBox="0 0 12 12" fill="none" style="width:10px;height:10px;display:inline-block;vertical-align:-1px;margin-right:4px"><circle cx="6" cy="6" r="4" stroke="rgba(251,191,36,0.9)" stroke-width="1.4"/><circle cx="6" cy="6" r="1.8" fill="rgba(251,191,36,0.9)"/></svg>
            Desde mi compra
          </span>
          <span class="order-chart-sub" id="opanel-price-sub">Cargando…</span>
        </div>
        <div class="order-chart-canvas-wrap">
          <canvas id="order-price-canvas"></canvas>
          <div class="chart-empty order-chart-empty" id="opanel-price-empty" hidden>Sin historial desde la compra</div>
        </div>
      </div>
      <div class="order-chart-wrap">
        <div class="order-chart-head">
          <span class="order-chart-title">Historia en CoinScanX</span>
          <span class="order-chart-sub" id="opanel-pct-sub">Cargando…</span>
        </div>
        <div class="order-chart-canvas-wrap">
          <canvas id="order-pct-canvas"></canvas>
          <div class="chart-empty order-chart-empty" id="opanel-pct-empty" hidden>Sin historial de señal</div>
        </div>
      </div>
    </div>
  `;
  row.after(panel);

  // Close button
  document.getElementById("order-charts-close-btn")?.addEventListener("click", () => {
    toggleOrderCharts(orderId, symbol);
  });

  // Cargar las dos gráficas con los datos de entrada
  loadOrderPriceChart(symbol, entryPrice, launchTime);
  loadOrderCsxChart(symbol, entryPrice);
}

/* Gráfica 1: Precio desde que se lanzó la orden, con punto de entrada marcado */
async function loadOrderPriceChart(symbol, entryPrice, launchTime) {
  const sub    = document.getElementById("opanel-price-sub");
  const empty  = document.getElementById("opanel-price-empty");
  const canvas = document.getElementById("order-price-canvas");
  if (!canvas) return;

  try {
    const allPoints = await api(`/signals/chart/${symbol}?limit=200`);
    if (!allPoints || !allPoints.length) {
      if (canvas) canvas.style.display = "none";
      if (empty)  empty.hidden = false;
      if (sub)    sub.textContent = "Sin historial";
      return;
    }

    // Filtrar a partir del momento del lanzamiento
    const launchMs = launchTime ? new Date(launchTime).getTime() : null;
    const points   = launchMs
      ? allPoints.filter(p => new Date(p.t).getTime() >= launchMs - 60_000) // 1 min de margen
      : allPoints;
    const display  = points.length >= 2 ? points : allPoints; // fallback a todo si hay pocos

    if (sub) sub.textContent = `${display.length} snapshots`;

    const labels  = display.map(p => fmtTime(p.t));
    const prices  = display.map(p => p.price);
    const lastP   = prices[prices.length - 1];
    // Color basado en si el precio actual está sobre el precio de entrada
    const refPrice = entryPrice || prices[0];
    const isUp     = lastP >= refPrice;
    const color    = isUp ? "rgba(52,211,153,1)" : "rgba(248,113,113,1)";
    const fillA    = isUp ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.10)";
    const minP     = Math.min(...prices, entryPrice || Infinity);
    const fmt      = (v) => fmtUsd(v, minP < 0.01 ? 6 : 2);

    const cfg = makeChartConfig({ labels, data: prices, color, fillA, isUp, minVal: minP, formatCallback: fmt });

    // Punto dorado de entrada: primer punto del rango filtrado
    cfg.data.datasets[0].pointRadius      = prices.map((_, i) => i === 0 ? 7 : 0);
    cfg.data.datasets[0].pointHoverRadius = prices.map((_, i) => i === 0 ? 9 : 5);
    cfg.data.datasets[0].pointBackgroundColor = prices.map((_, i) =>
      i === 0 ? "rgba(251,191,36,1)" : color
    );
    cfg.data.datasets[0].pointBorderColor = prices.map((_, i) =>
      i === 0 ? "rgba(251,191,36,0.3)" : "transparent"
    );
    cfg.data.datasets[0].pointBorderWidth = prices.map((_, i) => i === 0 ? 3 : 0);

    // Línea horizontal punteada en el precio de entrada
    if (entryPrice) {
      cfg.data.datasets.push({
        data:             prices.map(() => entryPrice),
        borderColor:      "rgba(251,191,36,0.55)",
        borderWidth:      1.5,
        segment:          { borderDash: () => [5, 4] },
        fill:             false,
        pointRadius:      0,
        pointHoverRadius: 0,
        tension:          0,
        label:            `Entrada ${fmt(entryPrice)}`,
      });
      cfg.options.plugins.tooltip.callbacks.label = (ctx) => {
        if (ctx.datasetIndex === 1) return ` Precio entrada: ${fmt(ctx.raw)}`;
        return ` ${fmt(ctx.raw)}`;
      };
    }

    state.orderPriceChart = new Chart(canvas.getContext("2d"), cfg);
  } catch {
    const canvas2 = document.getElementById("order-price-canvas");
    if (canvas2) canvas2.style.display = "none";
    const empty2 = document.getElementById("opanel-price-empty");
    if (empty2) { empty2.hidden = false; empty2.textContent = "Error al cargar"; }
    const sub2 = document.getElementById("opanel-price-sub");
    if (sub2) sub2.textContent = "Error";
  }
}

/* Gráfica 2: Historia completa de CoinScanX con línea horizontal de entrada */
async function loadOrderCsxChart(symbol, entryPrice) {
  const sub    = document.getElementById("opanel-pct-sub");
  const empty  = document.getElementById("opanel-pct-empty");
  const canvas = document.getElementById("order-pct-canvas");
  if (!canvas) return;

  try {
    const points = await api(`/signals/chart/${symbol}?limit=200`);
    if (!points || points.length < 2) {
      if (canvas) canvas.style.display = "none";
      if (empty)  empty.hidden = false;
      if (sub)    sub.textContent = "Sin historial";
      return;
    }

    if (sub) sub.textContent = `${points.length} snapshots`;

    const labels  = points.map(p => fmtTime(p.t));
    const prices  = points.map(p => p.price);
    const firstP  = prices[0];
    const lastP   = prices[prices.length - 1];
    const isUp    = lastP >= firstP;
    const color   = isUp ? "rgba(52,211,153,1)" : "rgba(248,113,113,1)";
    const fillA   = isUp ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.10)";
    const minP    = Math.min(...prices, entryPrice || Infinity);
    const fmt     = (v) => fmtUsd(v, minP < 0.01 ? 6 : 2);

    const cfg = makeChartConfig({ labels, data: prices, color, fillA, isUp, minVal: minP, formatCallback: fmt });

    // Línea horizontal punteada en precio de entrada
    if (entryPrice) {
      cfg.data.datasets.push({
        data:             prices.map(() => entryPrice),
        borderColor:      "rgba(251,191,36,0.55)",
        borderWidth:      1.5,
        segment:          { borderDash: () => [5, 4] },
        fill:             false,
        pointRadius:      0,
        pointHoverRadius: 0,
        tension:          0,
        label:            `Mi entrada ${fmt(entryPrice)}`,
      });
      cfg.options.plugins.tooltip.callbacks.label = (ctx) => {
        if (ctx.datasetIndex === 1) return ` Mi entrada: ${fmt(ctx.raw)}`;
        return ` ${fmt(ctx.raw)}`;
      };
    }

    state.orderPctChart = new Chart(canvas.getContext("2d"), cfg);
  } catch {
    const canvas2 = document.getElementById("order-pct-canvas");
    if (canvas2) canvas2.style.display = "none";
    const empty2 = document.getElementById("opanel-pct-empty");
    if (empty2) { empty2.hidden = false; empty2.textContent = "Error al cargar"; }
    const sub2 = document.getElementById("opanel-pct-sub");
    if (sub2) sub2.textContent = "Error";
  }
}

async function searchHistory(symbol) {
  const el = $("#orders-history");
  if (!el || !symbol) return;
  el.innerHTML = `<div class="loading-state">Buscando trades de ${symbol.toUpperCase()}…</div>`;
  try {
    const d = await api(`/account/trades/${symbol.trim().toUpperCase()}`);
    if (!d) return;
    if (!d.trades?.length) {
      el.innerHTML = `<div class="empty-state">Sin trades registrados para ${d.symbol}.</div>`;
      return;
    }
    const s = d.summary || {};
    el.innerHTML = `
      <div class="pnl-full">
        <div class="pnl-full__cards">
          <div class="pnl-card">
            <div class="pnl-card__label">P&L Total</div>
            <div class="pnl-card__val ${s.total_pnl_usdt >= 0 ? "gain" : "loss"}">
              ${s.total_pnl_usdt >= 0 ? "+" : ""}${fmtUsdt(s.total_pnl_usdt)}
            </div>
          </div>
          <div class="pnl-card">
            <div class="pnl-card__label">Realizado</div>
            <div class="pnl-card__val ${s.realized_pnl_usdt >= 0 ? "gain" : "loss"}">
              ${s.realized_pnl_usdt >= 0 ? "+" : ""}${fmtUsdt(s.realized_pnl_usdt)}
            </div>
          </div>
          <div class="pnl-card">
            <div class="pnl-card__label">Posición abierta</div>
            <div class="pnl-card__val">${fmtNum(s.open_position_qty, 6)}</div>
            <div class="pnl-card__sub">prom. ${fmtUsd(s.avg_buy_price)}</div>
          </div>
          <div class="pnl-card">
            <div class="pnl-card__label">Precio actual</div>
            <div class="pnl-card__val">${fmtUsd(d.current_price)}</div>
          </div>
        </div>
        <div class="trades-full">
          ${d.trades.map(t => `
            <div class="trade-full-row">
              <span class="side-chip ${t.side}">${t.side}</span>
              <strong>${fmtNum(t.qty, 6)} ${symbol.toUpperCase()}</strong>
              <span>@ ${fmtUsd(t.price)}</span>
              <span>${fmtUsdt(t.total_usdt)}</span>
              <span>${fmtDate(t.time)}</span>
            </div>
          `).join("")}
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

/* ================================================================
   EVENT WIRING
   ================================================================ */

$$(".signal-tab").forEach(t => {
  t.addEventListener("click", () => {
    $$(".signal-tab").forEach(x => x.classList.remove("is-active"));
    t.classList.add("is-active");
    state.currentTab = t.dataset.stab;
    renderSignalsList();
  });
});

$$(".side-btn").forEach(b => {
  b.addEventListener("click", () => {
    $$(".side-btn").forEach(x => x.classList.remove("is-active"));
    b.classList.add("is-active");
    state.side = b.dataset.side;
    const slider = $("#invest-slider");
    if (slider) slider.value = 0;
    updateInvestUI();
    updateFormSide();
    if (state.selectedCoin?.current_price_usd) {
      updateOcoPrices(state.selectedCoin.current_price_usd);
    }
  });
});

$("#invest-slider")?.addEventListener("input", updateInvestUI);

$$(".pct-btns button").forEach(b => {
  b.addEventListener("click", () => {
    const s = $("#invest-slider");
    if (s) { s.value = b.dataset.pct; updateInvestUI(); }
  });
});

["#f-gain-pct", "#f-loss-pct"].forEach(sel => {
  $(sel)?.addEventListener("input", () => {
    if (state.selectedCoin?.current_price_usd) updateOcoPrices(state.selectedCoin.current_price_usd);
  });
});

$("#btn-place")?.addEventListener("click", placeOrder);

$("#force-refresh")?.addEventListener("click", () => {
  signalsSecs = SIGNALS_INTERVAL;
  loadSignals(false);
});

$("#orders-refresh")?.addEventListener("click", loadAllOrders);
$("#portfolio-refresh")?.addEventListener("click", loadPortfolio);

$("#history-search-btn")?.addEventListener("click", () => {
  const sym = $("#history-symbol-input")?.value?.trim();
  if (sym) searchHistory(sym);
});
$("#history-symbol-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const sym = e.target.value?.trim();
    if (sym) searchHistory(sym);
  }
});

/* ================================================================
   BOOT
   ================================================================ */

async function boot() {
  // Detectar modo demo — mostrar banner SOLO si demo:true
  try {
    const health = await fetch("/api").then(r => r.json());
    const banner = $("#demo-banner");
    if (banner) banner.hidden = !health?.demo;
  } catch {
    const banner = $("#demo-banner");
    if (banner) banner.hidden = true;
  }

  await Promise.all([loadBtc(), loadBalance(), loadOrdersCount(), loadSignals(), loadLocalOrdersMetadata()]);
  setInterval(tickRefreshRing, 1000);
  setInterval(loadBtc,          60_000);
  setInterval(loadBalance,      60_000);
  setInterval(loadOrdersCount,  60_000);
}

/* Entry point */
checkAuth();
