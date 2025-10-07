/* =========================================================
 * EstoqueFácil - app.js (Frontend Core)
 * Bootstrap + HTML + JS (compatível com TS compile-to-JS)
 * ========================================================= */

(() => {
  "use strict";

  /* -------------------------------
   * Constantes & Helpers
   * ------------------------------- */
  const STORAGE = {
    AUTH: "ef_auth",
    ORDERS: "ef_orders",         // pedidos finalizados (mock)
    ORDERS_DRAFT: "ef_orders_draft", // fila offline (mock)
  };

  const PAGES = {
    LOGIN: "index.html",
    DASH: "dashboard.html",
    PEDIDOS: "pedidos.html",
    COZINHA: "cozinha.html",
    INGREDIENTES: "ingredientes.html",
    PRODUTOS: "produtos.html",
    FORNECEDORES: "fornecedores.html",
    CAIXA: "caixa.html",
    SIMULACAO: "simulacao.html",
    CONFIG: "config.html",
  };

  const API_BASE = "/api"; // placeholder para quando o backend estiver pronto

  const fmtBRL = (n) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getCurrentPage() {
    const path = location.pathname.split("/").pop() || PAGES.LOGIN;
    return path.toLowerCase();
  }

  function nowISO() {
    return new Date().toISOString();
  }

  /* -------------------------------
   * Toasts (Bootstrap se disponível)
   * ------------------------------- */
  function ensureToastContainer() {
    let c = qs("#toast-container");
    if (!c) {
      c = document.createElement("div");
      c.id = "toast-container";
      c.style.position = "fixed";
      c.style.top = "1rem";
      c.style.right = "1rem";
      c.style.zIndex = "1080";
      document.body.appendChild(c);
    }
    return c;
  }

  function showToast(message, type = "info") {
    const container = ensureToastContainer();

    // Se Bootstrap estiver disponível, usa Toast; senão, fallback para alert
    const hasBootstrap = !!window.bootstrap && !!window.bootstrap.Toast;

    if (!hasBootstrap) {
      // Fallback simples
      console.log(`[${type.toUpperCase()}] ${message}`);
      alert(message);
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "toast align-items-center text-bg-" + (type === "success" ? "success" :
                                                               type === "error"   ? "danger"  :
                                                               type === "warn"    ? "warning" : "primary");
    wrapper.setAttribute("role", "alert");
    wrapper.setAttribute("aria-live", "assertive");
    wrapper.setAttribute("aria-atomic", "true");
    wrapper.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    container.appendChild(wrapper);

    const toast = new window.bootstrap.Toast(wrapper, { delay: 2500 });
    toast.show();
    wrapper.addEventListener("hidden.bs.toast", () => wrapper.remove());
  }

  /* -------------------------------
   * Autenticação (mock)
   * ------------------------------- */
  function isLoggedIn() {
    return !!localStorage.getItem(STORAGE.AUTH);
  }

  function login(email, _password) {
    // TODO: trocar por chamada real à API
    const token = {
      email,
      token: "mock-token-" + Math.random().toString(36).slice(2),
      issuedAt: nowISO(),
    };
    localStorage.setItem(STORAGE.AUTH, JSON.stringify(token));
    return token;
  }

  function logout() {
    localStorage.removeItem(STORAGE.AUTH);
    showToast("Sessão encerrada.", "success");
    location.href = PAGES.LOGIN;
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      location.href = PAGES.LOGIN;
    }
  }

  function redirectIfAuthenticated() {
    if (isLoggedIn()) location.href = PAGES.DASH;
  }

  /* -------------------------------
   * Fetch wrapper (mock de API)
   * ------------------------------- */
  async function fetchWithAuth(url, options = {}) {
    // Placeholder para quando a API existir
    const auth = JSON.parse(localStorage.getItem(STORAGE.AUTH) || "null");
    const headers = {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...(options.headers || {}),
    };
    // Aqui, apenas retorna um mock
    return { ok: true, json: async () => ({ message: "OK (mock)", url, headers }) };
  }

  /* -------------------------------
   * Dashboard (dados mock)
   * ------------------------------- */
  const dashboardAPI = {
    async salesToday() {
      // Simula uma chamada de API
      return 1250.0;
    },
    async topItems() {
      return [
        { name: "Hambúrguer", qty: 42 },
        { name: "Pizza", qty: 31 },
        { name: "Batata Frita", qty: 28 },
      ];
    },
    async lowStock() {
      return [
        { name: "Pão", qty: 5, unit: "un" },
        { name: "Queijo", qty: 2, unit: "kg" },
      ];
    },
  };

  async function initDashboardPage() {
    requireAuth();

    // Preenche vendas do dia
    const elSales = qs('[data-role="sales-today"]');
    if (elSales) {
      const v = await dashboardAPI.salesToday();
      elSales.textContent = fmtBRL(v);
    }

    // Preenche top itens
    const elTop = qs('[data-role="top-items"]');
    if (elTop) {
      const items = await dashboardAPI.topItems();
      elTop.innerHTML = "";
      items.forEach((i) => {
        const li = document.createElement("li");
        li.textContent = `${i.name} — ${i.qty} un`;
        elTop.appendChild(li);
      });
    }

    // Preenche estoque crítico
    const elCrit = qs('[data-role="critical-stock"]');
    if (elCrit) {
      const items = await dashboardAPI.lowStock();
      elCrit.innerHTML = "";
      items.forEach((i) => {
        const li = document.createElement("li");
        li.textContent = `${i.name} (${i.qty} ${i.unit})`;
        elCrit.appendChild(li);
      });
    }

    // Ações globais
    bindGlobalActions();
  }

  /* -------------------------------
   * Pedidos (atendente/cliente) - mock
   * ------------------------------- */
  const orderState = {
    items: [], // {id, name, price, qty}
  };

  function addItemToOrder({ id, name, price }) {
    const found = orderState.items.find((i) => i.id === id);
    if (found) found.qty += 1;
    else orderState.items.push({ id, name, price, qty: 1 });
    renderOrderList();
  }

  function removeItemFromOrder(id) {
    orderState.items = orderState.items.filter((i) => i.id !== id);
    renderOrderList();
  }

  function updateQty(id, qty) {
    const found = orderState.items.find((i) => i.id === id);
    if (!found) return;
    found.qty = Math.max(1, parseInt(qty, 10) || 1);
    renderOrderList();
  }

  function orderTotal() {
    return orderState.items.reduce((acc, i) => acc + i.price * i.qty, 0);
  }

  function renderOrderList() {
    const list = qs('[data-role="order-list"]');
    const totalEl = qs('[data-role="order-total"]');
    if (!list) return;

    list.innerHTML = "";
    orderState.items.forEach((i) => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex align-items-center justify-content-between";
      li.innerHTML = `
        <div class="me-2">
          <strong>${i.name}</strong><br>
          <small>${fmtBRL(i.price)}</small>
        </div>
        <div class="d-flex align-items-center">
          <input type="number" min="1" value="${i.qty}" class="form-control form-control-sm me-2" style="width: 80px" data-action="qty" data-id="${i.id}">
          <button class="btn btn-sm btn-outline-danger" data-action="remove" data-id="${i.id}">Remover</button>
        </div>
      `;
      list.appendChild(li);
    });

    if (totalEl) totalEl.textContent = fmtBRL(orderTotal());
  }

  function bindOrderActions() {
    const container = qs('[data-role="products-catalog"]');
    if (container) {
      container.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action='add-product']");
        if (!btn) return;
        const id = btn.getAttribute("data-id");
        const name = btn.getAttribute("data-name");
        const price = parseFloat(btn.getAttribute("data-price") || "0");
        addItemToOrder({ id, name, price });
        showToast(`${name} adicionado ao pedido.`, "success");
      });
    }

    const list = qs('[data-role="order-list"]');
    if (list) {
      list.addEventListener("click", (e) => {
        const rm = e.target.closest("[data-action='remove']");
        if (rm) {
          const id = rm.getAttribute("data-id");
          removeItemFromOrder(id);
          showToast("Item removido.", "warn");
        }
      });

      list.addEventListener("change", (e) => {
        const qty = e.target.closest("[data-action='qty']");
        if (qty) {
          const id = qty.getAttribute("data-id");
          updateQty(id, qty.value);
        }
      });
    }

    const submitBtn = qs("[data-action='submit-order']");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        if (!orderState.items.length) {
          showToast("Adicione itens ao pedido.", "warn");
          return;
        }
        // Salva pedido mock
        const all = JSON.parse(localStorage.getItem(STORAGE.ORDERS) || "[]");
        all.push({
          id: "PED-" + Date.now(),
          createdAt: nowISO(),
          items: orderState.items,
          total: orderTotal(),
          status: "novo",
        });
        localStorage.setItem(STORAGE.ORDERS, JSON.stringify(all));
        orderState.items = [];
        renderOrderList();
        showToast("Pedido enviado para a cozinha!", "success");
      });
    }
  }

  async function initPedidosPage() {
    requireAuth();
    bindGlobalActions();
    bindOrderActions();
    renderOrderList();

    // Pré-carregar catálogo (mock) se existir container
    const catalog = qs('[data-role="products-catalog"]');
    if (catalog) {
      const mockProducts = [
        { id: "p1", name: "Hambúrguer", price: 18.0 },
        { id: "p2", name: "Batata Frita", price: 12.0 },
        { id: "p3", name: "Pizza Fatia", price: 10.0 },
      ];
      catalog.innerHTML = mockProducts
        .map(
          (p) => `
          <div class="card shadow-sm mb-2">
            <div class="card-body d-flex justify-content-between align-items-center">
              <div>
                <h6 class="mb-1">${p.name}</h6>
                <small class="text-muted">${fmtBRL(p.price)}</small>
              </div>
              <button class="btn btn-primary" data-action="add-product" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}">Adicionar</button>
            </div>
          </div>`
        )
        .join("");
    }
  }

  /* -------------------------------
   * Cozinha - consome pedidos (mock)
   * ------------------------------- */
  function renderKitchen() {
    const list = qs('[data-role="kitchen-orders"]');
    if (!list) return;
    const all = JSON.parse(localStorage.getItem(STORAGE.ORDERS) || "[]");
    list.innerHTML = "";

    all
      .filter((p) => p.status === "novo")
      .forEach((p) => {
        const li = document.createElement("div");
        li.className = "card mb-2";
        li.innerHTML = `
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center">
              <strong>${p.id}</strong>
              <span class="badge text-bg-warning">Novo</span>
            </div>
            <ul class="mt-2 mb-3">
              ${p.items
                .map((i) => `<li>${i.qty}x ${i.name} — ${fmtBRL(i.price)}</li>`)
                .join("")}
            </ul>
            <div class="d-flex justify-content-between align-items-center">
              <span class="fw-bold">${fmtBRL(p.total)}</span>
              <div>
                <button class="btn btn-success btn-sm me-2" data-action="finish" data-id="${p.id}">Concluir</button>
                <button class="btn btn-outline-danger btn-sm" data-action="cancel" data-id="${p.id}">Cancelar</button>
              </div>
            </div>
          </div>
        `;
        list.appendChild(li);
      });

    // Bind actions
    list.addEventListener("click", (e) => {
      const btnF = e.target.closest("[data-action='finish']");
      const btnC = e.target.closest("[data-action='cancel']");
      if (!btnF && !btnC) return;

      const id = (btnF || btnC).getAttribute("data-id");
      const allP = JSON.parse(localStorage.getItem(STORAGE.ORDERS) || "[]");
      const idx = allP.findIndex((x) => x.id === id);
      if (idx >= 0) {
        allP[idx].status = btnF ? "concluido" : "cancelado";
        localStorage.setItem(STORAGE.ORDERS, JSON.stringify(allP));
        showToast(btnF ? "Pedido concluído!" : "Pedido cancelado.", btnF ? "success" : "warn");
        renderKitchen();
      }
    });
  }

  function initCozinhaPage() {
    requireAuth();
    bindGlobalActions();
    renderKitchen();
  }

  /* -------------------------------
   * PDV / Caixa (mock)
   * ------------------------------- */
  function initCaixaPage() {
    requireAuth();
    bindGlobalActions();

    const openBtn = qs("[data-action='open-cash']");
    const closeBtn = qs("[data-action='close-cash']");
    const info = qs("[data-role='cash-info']");

    let openedAt = null;

    function render() {
      if (!info) return;
      info.textContent = openedAt ? `Caixa aberto às ${new Date(openedAt).toLocaleTimeString()}` : "Caixa fechado";
    }

    openBtn?.addEventListener("click", () => {
      openedAt = Date.now();
      render();
      showToast("Caixa aberto.", "success");
    });

    closeBtn?.addEventListener("click", () => {
      openedAt = null;
      render();
      showToast("Caixa fechado.", "warn");
    });

    render();
  }

  /* -------------------------------
   * Simulação (mock)
   * ------------------------------- */
  function initSimulacaoPage() {
    requireAuth();
    bindGlobalActions();

    const runBtn = qs("[data-action='run-simulation']");
    const out = qs("[data-role='simulation-result']");

    runBtn?.addEventListener("click", () => {
      // Mock simples: compara semana atual x anterior
      const current = { total: 5230, top: "Hambúrguer" };
      const prev = { total: 4870, top: "Batata Frita" };
      const diff = current.total - prev.total;
      const pct = ((diff / prev.total) * 100).toFixed(1);

      if (out) {
        out.innerHTML = `
          <div class="card p-3">
            <div class="d-flex justify-content-between">
              <div>
                <h6 class="mb-1">Período Atual</h6>
                <div>Total: <strong>${fmtBRL(current.total)}</strong></div>
                <div>Mais vendido: <strong>${current.top}</strong></div>
              </div>
              <div>
                <h6 class="mb-1">Período Anterior</h6>
                <div>Total: <strong>${fmtBRL(prev.total)}</strong></div>
                <div>Mais vendido: <strong>${prev.top}</strong></div>
              </div>
            </div>
            <hr>
            <div class="${diff >= 0 ? "text-success" : "text-danger"}">
              Variação: <strong>${fmtBRL(diff)} (${pct}%)</strong>
            </div>
          </div>
        `;
      }
    });
  }

  /* -------------------------------
   * Cadastros (placeholders leves)
   * ------------------------------- */
  function initCadastroPage(kind) {
    requireAuth();
    bindGlobalActions();

    const form = qs("form[data-role='form-cadastro']");
    const list = qs("[data-role='cadastro-list']");

    if (!form || !list) return;

    const key = "ef_" + kind;

    function readAll() {
      return JSON.parse(localStorage.getItem(key) || "[]");
    }
    function writeAll(arr) {
      localStorage.setItem(key, JSON.stringify(arr));
    }

    function render() {
      const data = readAll();
      list.innerHTML = data
        .map(
          (it, idx) => `
        <tr>
          <td>${it.nome || "-"}</td>
          <td>${it.detalhe || "-"}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-danger" data-action="del" data-idx="${idx}">Excluir</button>
          </td>
        </tr>`
        )
        .join("");
    }

    list.addEventListener("click", (e) => {
      const del = e.target.closest("[data-action='del']");
      if (!del) return;
      const idx = parseInt(del.getAttribute("data-idx"), 10);
      const data = readAll();
      data.splice(idx, 1);
      writeAll(data);
      render();
      showToast("Registro excluído.", "warn");
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const nome = (fd.get("nome") || "").toString().trim();
      const detalhe = (fd.get("detalhe") || "").toString().trim();
      if (!nome) {
        showToast("Informe o nome.", "warn");
        return;
      }
      const data = readAll();
      data.push({ nome, detalhe, createdAt: nowISO() });
      writeAll(data);
      form.reset();
      render();
      showToast("Cadastro salvo!", "success");
    });

    render();
  }

  /* -------------------------------
   * Login
   * ------------------------------- */
  function initLoginPage() {
    redirectIfAuthenticated();
    const form = qs("form");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = qs("#email")?.value?.trim();
      const senha = qs("#senha")?.value?.trim();
      if (!email || !senha) {
        showToast("Preencha e-mail e senha.", "warn");
        return;
      }
      login(email, senha);
      showToast("Bem-vindo!", "success");
      location.href = PAGES.DASH;
    });
  }

  /* -------------------------------
   * Ações Globais (logout etc.)
   * ------------------------------- */
  function bindGlobalActions() {
    // logout
    qsa("[data-action='logout']").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
      });
    });
  }

  /* -------------------------------
   * Bootstrap por página
   * ------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    const page = getCurrentPage();

    switch (page) {
      case PAGES.LOGIN:
        initLoginPage();
        break;
      case PAGES.DASH:
        initDashboardPage();
        break;
      case PAGES.PEDIDOS:
        initPedidosPage();
        break;
      case PAGES.COZINHA:
        initCozinhaPage();
        break;
      case PAGES.CAIXA:
        initCaixaPage();
        break;
      case PAGES.INGREDIENTES:
        initCadastroPage("ingredientes");
        break;
      case PAGES.PRODUTOS:
        initCadastroPage("produtos");
        break;
      case PAGES.FORNECEDORES:
        initCadastroPage("fornecedores");
        break;
      case PAGES.SIMULACAO:
        initSimulacaoPage();
        break;
      case PAGES.CONFIG:
        requireAuth();
        bindGlobalActions();
        break;
      default:
        // Se a página não for reconhecida, apenas garante auth nas páginas não-login
        if (page !== PAGES.LOGIN) {
          requireAuth();
          bindGlobalActions();
        }
        break;
    }
  });
})();
document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector("form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("email").value;
      var senha = document.getElementById("senha").value;

      // Login de teste
      if (email === "admin@estoquefacil.com" && senha === "1234") {
        window.location.href = "dashboard.html";
      } else {
        alert("E-mail ou senha inválidos!");
      }
    });
  }
});
document.addEventListener("DOMContentLoaded", function () {
  const toggleBtn = document.getElementById("toggleSidebar");
  const sidebar = document.getElementById("sidebar");
  const content = document.getElementById("content");

  if (toggleBtn && sidebar && content) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("sidebar-collapsed");
      content.classList.toggle("collapsed-content");
    });
  }
});
