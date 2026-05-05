import { APP_CONFIG, INITIAL_DATA } from "../config/app-config.js";
import { backupService } from "../services/backup-service.js";
import { authService } from "../services/auth-service.js";
import { databaseService } from "../services/database-service.js";
import { safeHTML } from "../utils/dom.js";
import { withErrorHandling } from "../utils/error-handler.js";

const LOGO_DATA = APP_CONFIG.logoPath;

const state = {
  currentTab: "inicio",
  charts: { categories: null, vehicles: null },
  ui: {
    tripMonth: new Date().toISOString().slice(0, 7),
    tripSelectedDate: new Date().toISOString().slice(0, 10),
    tripEditingId: "",
    tripManualBase: false,
    tripManualFinal: false,
    tripPreviewData: null,
  },
  storageKey: APP_CONFIG.storageKey,
  sessionKey: APP_CONFIG.sessionKey,
  data: {
    employees: [],
    vehicles: [],
    buyers: [],
    cards: [],
    expenses: [],
    fuelings: [],
    cardSchedules: [],
    trips: [],
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const currency = (value = 0) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const today = () => new Date().toISOString().slice(0, 10);
const monthNow = () => new Date().toISOString().slice(0, 7);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const formatDate = (value) =>
  value ? new Date(value + "T00:00:00").toLocaleDateString("pt-BR") : "-";

function applyLogo() {
  [
    "#loginLogoDesktop",
    "#loginLogoMobile",
    "#headerLogo",
    "#reportLogo",
  ].forEach((selector) => {
    const el = $(selector);
    if (el) {
      el.src = APP_CONFIG.logoPath;
      el.alt = "Garcia Turismo";
    }
  });
}

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

function escapeHtml(value = "") {
  return safeHTML(value);
}

function addDays(dateStr, amount) {
  const base = new Date(`${dateStr}T00:00:00`);
  base.setDate(base.getDate() + amount);
  return base.toISOString().slice(0, 10);
}

function addMonthsToMonthString(monthStr, amount) {
  const base = new Date(`${monthStr}-01T00:00:00`);
  base.setMonth(base.getMonth() + amount);
  return base.toISOString().slice(0, 7);
}

function formatMonthLabel(monthStr) {
  const [year, month] = monthStr.split("-").map(Number);
  return monthLabelFormatter.format(new Date(year, month - 1, 1));
}

function computeDurationDays(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diff = Math.round((end - start) / 86400000);
  return diff >= 0 ? diff + 1 : 1;
}

function slugify(value = "garcia_turismo") {
  return (
    String(value)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "garcia_turismo"
  );
}

function seedData() {
  return JSON.parse(JSON.stringify(INITIAL_DATA));
}

function persist() {
  state.data = databaseService.persist(state.data);
}

function load() {
  state.data = databaseService.loadLocal();
  persist();
}

async function loadCloudDataIfAvailable() {
  if (!databaseService.isCloudEnabled()) return;
  try {
    const remoteData = await databaseService.loadRemote();
    if (remoteData) {
      state.data = databaseService.saveLocal(remoteData);
      renderAll();
      showToast("Dados carregados do Supabase.", "success");
      return;
    }

    await databaseService.saveRemoteNow(state.data);
    showToast("Dados locais enviados para o Supabase.", "success");
  } catch (error) {
    console.error("Erro ao carregar dados do Supabase:", error);
    showToast(
      "Não foi possível sincronizar com o Supabase. Usando dados locais.",
      "error",
    );
  }
}

function setSession(value) {
  authService.setSession(value);
}

function hasSession() {
  return authService.hasSession();
}

function showToast(message, type = "default") {
  const el = $("#toast");
  const palette = {
    default: "background:rgba(15,23,42,.94);color:#fff;",
    success: "background:linear-gradient(135deg,#111113,#2d2f36);color:#fff;",
    error: "background:linear-gradient(135deg,#b91c1c,#ef4444);color:#fff;",
  };
  el.innerHTML = `<div class="rounded-2xl px-4 py-3 shadow-2xl" style="${palette[type] || palette.default}">${message}</div>`;
  el.classList.remove("hidden");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add("hidden"), 2800);
}

function categoryLabel(value) {
  return (
    {
      pecas_manutencao: "Peças e manutenção",
      materiais_limpeza: "Materiais de limpeza",
      salarios_adiantamentos: "Salários / Adiantamentos",
      viagens_extras: "Viagens por fora (Extras)",
      outros: "Outros",
      combustivel: "Abastecimento",
    }[value] ||
    value ||
    "-"
  );
}

function paymentLabel(value) {
  return (
    {
      pix: "PIX",
      dinheiro: "Dinheiro",
      cartao_credito: "Cartão de crédito",
      cheque: "Cheque",
    }[value] ||
    value ||
    "-"
  );
}

function getVehicleBaseName(vehicle) {
  if (!vehicle) return "-";
  return `${vehicle.modelo} ${vehicle.ano} - ${vehicle.cor}`;
}

function getVehicleDisplayName(vehicle) {
  if (!vehicle) return "-";
  const seats = Number(vehicle.lugares || 0);
  return seats > 0
    ? `${getVehicleBaseName(vehicle)} (${seats} lugares)`
    : getVehicleBaseName(vehicle);
}

function getVehicleName(id) {
  const item = state.data.vehicles.find((v) => v.id === id);
  return item ? getVehicleBaseName(item) : "-";
}

function getEmployeeName(id) {
  const item = state.data.employees.find((v) => v.id === id);
  return item ? item.nome : "-";
}

function getBuyerName(id) {
  const item = state.data.buyers.find((v) => v.id === id);
  return item ? item.nome : "-";
}

function getCardName(id) {
  const item = state.data.cards.find((v) => v.id === id);
  return item ? item.nome : "-";
}

function calculateInvoiceMonth(date, closingDay, dueDay, offset = 0) {
  const [year, month, day] = date.split("-").map(Number);
  let targetMonth = (day > Number(closingDay) ? month + 1 : month) + offset;
  let targetYear = year;
  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }
  const mm = String(targetMonth).padStart(2, "0");
  const dd = String(dueDay).padStart(2, "0");
  return {
    competencia: `${targetYear}-${mm}`,
    vencimentoDia: Number(dueDay),
    vencimento: `${targetYear}-${mm}-${dd}`,
  };
}

function rowStatusBadge(status) {
  if (status === "Pago")
    return `<span class="status-badge status-paid">Pago</span>`;
  if (status === "A pagar")
    return `<span class="status-badge status-pending">A pagar</span>`;
  if (status === "Futuro")
    return `<span class="status-badge status-future">Futuro</span>`;
  return `<span class="status-badge status-scheduled">${status}</span>`;
}

function renderSelectOptions() {
  const vehicles = state.data.vehicles.filter((v) => v.status !== "inativo");
  const employees = state.data.employees.filter((v) => v.status !== "inativo");
  const buyers = state.data.buyers.filter((v) => v.status !== "inativo");
  const cards = state.data.cards;

  const vehicleOptions = vehicles
    .map((v) => `<option value="${v.id}">${getVehicleDisplayName(v)}</option>`)
    .join("");
  const employeeOptions = employees
    .map((v) => `<option value="${v.id}">${v.nome} - ${v.cargo}</option>`)
    .join("");
  const buyerOptions = buyers
    .map((v) => `<option value="${v.id}">${v.nome}</option>`)
    .join("");
  const cardOptions = cards
    .map(
      (v) =>
        `<option value="${v.id}">${v.nome} (Fecha ${v.fechamento} / Vence ${v.vencimento})</option>`,
    )
    .join("");

  $("#expenseVehicle").innerHTML =
    `<option value="">Selecione</option>${vehicleOptions}`;
  $("#fuelVehicle").innerHTML =
    `<option value="">Selecione</option>${vehicleOptions}`;
  $("#reportVehicle").innerHTML =
    `<option value="">Todos</option>${vehicleOptions}`;
  if ($("#tripVehicleIds")) {
    $("#tripVehicleIds").innerHTML =
      vehicleOptions ||
      '<option value="" disabled>Nenhum veículo ativo cadastrado</option>';
  }
  $("#expenseEmployee").innerHTML =
    `<option value="">Selecione</option>${employeeOptions}`;
  $("#reportEmployee").innerHTML =
    `<option value="">Todos</option>${employeeOptions}`;
  $("#expenseBuyer").innerHTML =
    `<option value="">Selecione</option>${buyerOptions}`;
  $("#fuelBuyer").innerHTML =
    `<option value="">Selecione</option>${buyerOptions}`;
  $("#expenseCard").innerHTML =
    `<option value="">Selecione</option>${cardOptions}`;
  $("#fuelCard").innerHTML =
    `<option value="">Selecione</option>${cardOptions}`;
  if ($("#tripResponsibleSuggestions")) {
    $("#tripResponsibleSuggestions").innerHTML = buyers
      .map((v) => `<option value="${v.nome}"></option>`)
      .join("");
  }
}

function getOperationalCategoryTotals() {
  const totals = {};
  state.data.expenses.forEach((item) => {
    const label = categoryLabel(item.categoria);
    totals[label] = (totals[label] || 0) + Number(item.valor || 0);
  });
  state.data.fuelings.forEach((item) => {
    totals["Abastecimento"] =
      (totals["Abastecimento"] || 0) + Number(item.valorTotal || 0);
  });
  return totals;
}

function getVehicleTotals() {
  const totals = {};
  state.data.expenses.forEach((item) => {
    const label = getVehicleName(item.veiculoId);
    totals[label] = (totals[label] || 0) + Number(item.valor || 0);
  });
  state.data.fuelings.forEach((item) => {
    const label = getVehicleName(item.veiculoId);
    totals[label] = (totals[label] || 0) + Number(item.valorTotal || 0);
  });
  return totals;
}

function getCashflowTotals() {
  let paid = 0;
  let pending = 0;
  let pendingCount = 0;

  state.data.expenses.forEach((item) => {
    if (item.paymentMethod === "cartao_credito") return;
    if (item.status === "pago") paid += Number(item.valor || 0);
    if (item.status === "a_pagar") {
      pending += Number(item.valor || 0);
      pendingCount += 1;
    }
  });

  state.data.fuelings.forEach((item) => {
    if (item.paymentMethod === "cartao_credito") return;
    if (item.status === "pago") paid += Number(item.valorTotal || 0);
    if (item.status === "a_pagar") {
      pending += Number(item.valorTotal || 0);
      pendingCount += 1;
    }
  });

  state.data.cardSchedules.forEach((item) => {
    if (item.status === "pago") paid += Number(item.valor || 0);
    if (item.status === "a_pagar") {
      pending += Number(item.valor || 0);
      pendingCount += 1;
    }
  });

  return { paid, pending, pendingCount };
}

function renderKPIs() {
  const currentMonth = monthNow();
  const monthExpenses =
    state.data.expenses.filter((x) => (x.data || "").startsWith(currentMonth))
      .length +
    state.data.fuelings.filter((x) => (x.data || "").startsWith(currentMonth))
      .length;
  const activeVehicles = state.data.vehicles.filter(
    (v) => v.status !== "inativo",
  ).length;
  const activeEmployees = state.data.employees.filter(
    (v) => v.status !== "inativo",
  ).length;
  const lastFuel = [...state.data.fuelings].sort((a, b) =>
    (b.data || "").localeCompare(a.data || ""),
  )[0];
  const flow = getCashflowTotals();

  $("#kpiPago").textContent = currency(flow.paid);
  $("#kpiAPagar").textContent = currency(flow.pending);
  $("#kpiAbastecimentos").textContent = state.data.fuelings.length;
  $("#kpiPendencias").textContent = flow.pendingCount;
  $("#resumoVeiculos").textContent = activeVehicles;
  $("#resumoFuncionarios").textContent = activeEmployees;
  $("#resumoUltimoAbastecimento").textContent = lastFuel
    ? `${getVehicleName(lastFuel.veiculoId)} • ${formatDate(lastFuel.data)}`
    : "Sem registro";
}

function destroyCharts() {
  if (state.charts.categories) state.charts.categories.destroy();
  if (state.charts.vehicles) state.charts.vehicles.destroy();
}
function shortCategoryLabel(label = "") {
  const map = {
    "Peças e manutenção": "Manutenção",
    "Materiais de limpeza": "Limpeza",
    "Salários / Adiantamentos": "Salários",
    "Impostos, taxas": "Impostos",
    "Viagens por fora (Extras)": "Extras",
    Abastecimento: "Combustível",
  };

  return map[label] || label;
}
function renderCharts() {
  destroyCharts();

  const byCategory = getOperationalCategoryTotals();
  const byVehicle = getVehicleTotals();

  const categoryLabels = Object.keys(byCategory);
  const categoryValues = Object.values(byCategory);

  const vehicleLabels = Object.keys(byVehicle);
  const vehicleValues = Object.values(byVehicle);

  state.charts.categories = new Chart($("#chartCategorias"), {
    type: "bar",
    data: {
      labels: categoryLabels.length
        ? categoryLabels.map(shortCategoryLabel)
        : ["Sem dados"],
      datasets: [
        {
          label: "Gastos",
          data: categoryValues.length ? categoryValues : [0],
          borderRadius: 16,
          borderSkipped: false,
          backgroundColor: "rgba(17, 17, 19, 0.88)",
          maxBarThickness: 54,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 8,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#111113",
          padding: 12,
          cornerRadius: 12,
          callbacks: {
            label(context) {
              return currency(context.raw || 0);
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: "#64748b",
            font: {
              size: 12,
              weight: "500",
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(148, 163, 184, 0.18)",
          },
          ticks: {
            color: "#64748b",
            callback(value) {
              return currency(value);
            },
          },
        },
      },
    },
  });

  state.charts.vehicles = new Chart($("#chartVeiculos"), {
    type: "doughnut",
    data: {
      labels: vehicleLabels.length ? vehicleLabels : ["Sem dados"],
      datasets: [
        {
          label: "Gastos",
          data: vehicleValues.length ? vehicleValues : [1],
          backgroundColor: [
            "rgba(17, 17, 19, 0.92)",
            "rgba(204, 31, 31, 0.86)",
            "rgba(71, 85, 105, 0.78)",
            "rgba(148, 163, 184, 0.78)",
            "rgba(30, 41, 59, 0.78)",
          ],
          borderColor: "#ffffff",
          borderWidth: 6,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 18,
            color: "#334155",
            font: {
              size: 12,
              weight: "500",
            },
          },
        },
        tooltip: {
          backgroundColor: "#111113",
          padding: 12,
          cornerRadius: 12,
          callbacks: {
            label(context) {
              return `${context.label}: ${currency(context.raw || 0)}`;
            },
          },
        },
      },
    },
  });
}

function renderCadastros() {
  $("#employeeTable").innerHTML =
    state.data.employees
      .map(
        (item) => `
        <tr>
          <td>${item.nome}</td>
          <td>${item.cargo}</td>
          <td>${item.telefone}</td>
          <td>${currency(item.salarioBase)}</td>
          <td class="text-right">
            <button class="text-slate-700 font-semibold mr-3" onclick="openEntityModal('employee','${item.id}')">Editar</button>
            <button class="text-red-600 font-semibold" onclick="removeEntity('employee','${item.id}')">Inativar</button>
          </td>
        </tr>`,
      )
      .join("") ||
    `<tr><td colspan="5" class="text-center muted py-6">Nenhum funcionário cadastrado.</td></tr>`;

  $("#vehicleTable").innerHTML =
    state.data.vehicles
      .map(
        (item) => `
        <tr>
          <td>${item.modelo}</td>
          <td>${item.ano}</td>
          <td>${item.cor}</td>
          <td>${item.kmAtual || 0}</td>
          <td class="text-right">
            <button class="text-slate-700 font-semibold mr-3" onclick="openEntityModal('vehicle','${item.id}')">Editar</button>
            <button class="text-red-600 font-semibold" onclick="removeEntity('vehicle','${item.id}')">Inativar</button>
          </td>
        </tr>`,
      )
      .join("") ||
    `<tr><td colspan="5" class="text-center muted py-6">Nenhum veículo cadastrado.</td></tr>`;

  $("#buyerTable").innerHTML =
    state.data.buyers
      .map(
        (item) => `
        <tr>
          <td>${item.nome}</td>
          <td>${item.status}</td>
          <td class="text-right">
            <button class="text-slate-700 font-semibold mr-3" onclick="openEntityModal('buyer','${item.id}')">Editar</button>
            <button class="text-red-600 font-semibold" onclick="removeEntity('buyer','${item.id}')">Inativar</button>
          </td>
        </tr>`,
      )
      .join("") ||
    `<tr><td colspan="3" class="text-center muted py-6">Nenhum gestor cadastrado.</td></tr>`;

  $("#cardTable").innerHTML =
    state.data.cards
      .map(
        (item) => `
        <tr>
          <td>${item.nome}</td>
          <td>Dia ${item.fechamento}</td>
          <td>Dia ${item.vencimento}</td>
          <td class="text-right">
            <button class="text-slate-700 font-semibold mr-3" onclick="openEntityModal('card','${item.id}')">Editar</button>
            <button class="text-red-600 font-semibold" onclick="removeEntity('card','${item.id}')">Excluir</button>
          </td>
        </tr>`,
      )
      .join("") ||
    `<tr><td colspan="4" class="text-center muted py-6">Nenhum cartão cadastrado.</td></tr>`;
}

function renderFuelHistory() {
  const list = [...state.data.fuelings]
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
    .slice(0, 6);
  $("#fuelHistory").innerHTML =
    list
      .map(
        (item) => `
        <div class="rounded-2xl border border-slate-200 bg-white/70 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold">${getVehicleName(item.veiculoId)}</div>
              <div class="text-sm muted mt-1">${formatDate(item.data)} • ${item.litros} L • ${currency(item.valorTotal)}</div>
              <div class="text-sm muted mt-1">${paymentLabel(item.paymentMethod)}${item.paymentMethod === "cartao_credito" ? ` • ${item.installments}x` : ""}</div>
            </div>
            <div class="text-right text-sm">
              <div class="font-semibold">${item.mediaKmLitro.toFixed(2)} km/l</div>
              <div class="muted">${item.distanciaPercorrida} km</div>
            </div>
          </div>
        </div>`,
      )
      .join("") || `<div class="muted text-sm">Sem abastecimentos ainda.</div>`;
}

function getFilteredReportRows() {
  const month = $("#reportMonth").value;
  const vehicleId = $("#reportVehicle").value;
  const employeeId = $("#reportEmployee").value;

  const expenseRows = state.data.expenses
    .filter((item) => item.paymentMethod !== "cartao_credito")
    .map((item) => ({
      sourceRowType: "expense",
      sourceId: item.id,
      data: item.data,
      type: "Despesa",
      category: categoryLabel(item.categoria),
      description:
        item.descricao +
        (item.descricaoGasto ? ` • ${item.descricaoGasto}` : ""),
      veiculoId: item.veiculoId || "",
      vehicle: getVehicleName(item.veiculoId),
      funcionarioId: item.funcionarioId || "",
      employee: getEmployeeName(item.funcionarioId),
      payment: paymentLabel(item.paymentMethod),
      status: item.status === "pago" ? "Pago" : "A pagar",
      value: Number(item.valor || 0),
    }));

  const fuelRows = state.data.fuelings
    .filter((item) => item.paymentMethod !== "cartao_credito")
    .map((item) => ({
      sourceRowType: "fuel",
      sourceId: item.id,
      data: item.data,
      type: "Combustível",
      category: "Abastecimento",
      description: `${item.litros} L • ${item.mediaKmLitro.toFixed(2)} km/l`,
      veiculoId: item.veiculoId || "",
      vehicle: getVehicleName(item.veiculoId),
      funcionarioId: "",
      employee: "-",
      payment: paymentLabel(item.paymentMethod),
      status: item.status === "pago" ? "Pago" : "A pagar",
      value: Number(item.valorTotal || 0),
    }));

  const scheduleRows = state.data.cardSchedules.map((item) => ({
    sourceRowType: "schedule",
    sourceId: item.id,
    data: item.vencimento,
    type: item.sourceType === "fuel" ? "Combustível" : "Despesa",
    category:
      item.sourceType === "fuel"
        ? "Abastecimento"
        : categoryLabel(item.category),
    description: `${item.description} • ${item.parcela}/${item.totalParcelas}`,
    veiculoId: item.veiculoId || "",
    vehicle: getVehicleName(item.veiculoId),
    funcionarioId: item.funcionarioId || "",
    employee: getEmployeeName(item.funcionarioId),
    payment: `Cartão ${getCardName(item.cardId)} • ${item.totalParcelas}x`,
    status: item.status === "pago" ? "Pago" : "Futuro",
    value: Number(item.valor || 0),
  }));

  return [...expenseRows, ...fuelRows, ...scheduleRows]
    .filter((item) => {
      const okMonth = !month || (item.data || "").startsWith(month);
      const okVehicle = !vehicleId || item.veiculoId === vehicleId;
      const okEmployee = !employeeId || item.funcionarioId === employeeId;
      return okMonth && okVehicle && okEmployee;
    })
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
}

function reportActions(item) {
  const canUndo = item.status === "Pago";
  return `
        <div class="flex justify-end gap-2 no-print">
          ${canUndo ? `<button class="rounded-xl px-3 py-2 btn-secondary text-sm font-semibold" onclick="undoReportPayment('${item.sourceRowType}','${item.sourceId}')">Estornar baixa</button>` : ""}
          <button class="rounded-xl px-3 py-2 btn-secondary text-sm font-semibold text-red-600" onclick="deleteReportEntry('${item.sourceRowType}','${item.sourceId}')">Excluir</button>
        </div>`;
}

function renderReport() {
  const rows = getFilteredReportRows();
  $("#reportTable").innerHTML =
    rows
      .map(
        (item) => `
        <tr>
          <td>${formatDate(item.data)}</td>
          <td>${item.type}</td>
          <td>${item.category}</td>
          <td>${item.description}</td>
          <td>${item.vehicle}</td>
          <td>${item.employee}</td>
          <td>${item.payment}</td>
          <td>${rowStatusBadge(item.status)}</td>
          <td class="text-right">${currency(item.value)}</td>
          <td class="text-right no-print">${reportActions(item)}</td>
        </tr>`,
      )
      .join("") ||
    `<tr><td colspan="10" class="text-center muted py-6">Nenhum lançamento encontrado.</td></tr>`;
  $("#reportTotal").textContent = currency(
    rows.reduce((acc, item) => acc + Number(item.value || 0), 0),
  );
  $("#reportCount").textContent = rows.length;
  $("#reportGeneratedAt").textContent = new Date().toLocaleString("pt-BR");
}

function renderExpenseTable() {
  const rows = [...state.data.expenses].sort((a, b) =>
    (b.data || "").localeCompare(a.data || ""),
  );
  $("#expenseTable").innerHTML =
    rows
      .map(
        (item) => `
        <tr>
          <td>${formatDate(item.data)}</td>
          <td>${categoryLabel(item.categoria)}</td>
          <td>
            <div class="font-medium">${escapeHtml(item.descricao || "-")}</div>
            <div class="muted text-xs mt-1">${escapeHtml(item.descricaoGasto || getVehicleName(item.veiculoId) || getEmployeeName(item.funcionarioId) || "-")}</div>
          </td>
          <td>${paymentLabel(item.paymentMethod)}${item.paymentMethod === "cartao_credito" ? ` • ${item.installments || 1}x` : ""}</td>
          <td>${rowStatusBadge(item.status)}</td>
          <td class="text-right">${currency(item.valor)}</td>
          <td class="text-right">
            <button class="rounded-xl px-3 py-2 btn-secondary text-sm font-semibold" onclick="deleteExpense('${item.id}')">Excluir</button>
          </td>
        </tr>`,
      )
      .join("") ||
    `<tr><td colspan="7" class="text-center muted py-6">Nenhuma despesa lançada até agora.</td></tr>`;
}

function getPendingRows() {
  const directExpenses = state.data.expenses
    .filter(
      (item) =>
        item.paymentMethod !== "cartao_credito" && item.status === "a_pagar",
    )
    .map((item) => ({
      id: item.id,
      rowType: "expense",
      vencimento: item.paymentDetails?.dataCompensacao || item.data,
      kind: "Conta",
      descricao: item.descricao,
      origem: paymentLabel(item.paymentMethod),
      valor: Number(item.valor || 0),
    }));

  const directFuel = state.data.fuelings
    .filter(
      (item) =>
        item.paymentMethod !== "cartao_credito" && item.status === "a_pagar",
    )
    .map((item) => ({
      id: item.id,
      rowType: "fuel",
      vencimento: item.paymentDetails?.dataCompensacao || item.data,
      kind: "Combustível",
      descricao: `${getVehicleName(item.veiculoId)} • ${item.litros} L`,
      origem: paymentLabel(item.paymentMethod),
      valor: Number(item.valorTotal || 0),
    }));

  const cardSchedules = state.data.cardSchedules
    .filter((item) => item.status === "a_pagar")
    .map((item) => ({
      id: item.id,
      rowType: "schedule",
      vencimento: item.vencimento,
      kind:
        item.sourceType === "fuel" ? "Parcela combustível" : "Parcela despesa",
      descricao: `${item.description} • ${item.parcela}/${item.totalParcelas}`,
      origem: `${getCardName(item.cardId)} • ${getBuyerName(item.buyerId)}`,
      valor: Number(item.valor || 0),
    }));

  return [...directExpenses, ...directFuel, ...cardSchedules].sort((a, b) =>
    (a.vencimento || "").localeCompare(b.vencimento || ""),
  );
}

function renderPending() {
  const rows = getPendingRows();
  $("#pendingTable").innerHTML =
    rows
      .map(
        (item) => `
        <tr>
          <td>${formatDate(item.vencimento)}</td>
          <td>${item.kind}</td>
          <td>${item.descricao}</td>
          <td>${item.origem}</td>
          <td>${currency(item.valor)}</td>
          <td class="text-right">
            <button class="rounded-xl px-3 py-2 btn-primary text-sm font-semibold" onclick="markPendingAsPaid('${item.rowType}','${item.id}')">Dar baixa</button>
          </td>
        </tr>`,
      )
      .join("") ||
    `<tr><td colspan="6" class="text-center muted py-6">Nenhuma pendência no momento.</td></tr>`;
}

function tripStatusBadge(status) {
  if (status === "Confirmada" || status === "Realizada")
    return `<span class="status-badge status-paid">${escapeHtml(status)}</span>`;
  if (status === "Cancelada")
    return `<span class="status-badge status-cancelled">Cancelada</span>`;
  return `<span class="status-badge status-scheduled">${escapeHtml(status || "Proposta")}</span>`;
}

function getTripsForDate(dateStr) {
  return state.data.trips.filter(
    (trip) => trip.departureDate <= dateStr && trip.returnDate >= dateStr,
  );
}

function syncTripDuration() {
  const start = $("#tripDepartureDate").value;
  const end = $("#tripReturnDate").value;
  if (!start || !end) return;
  $("#tripDuration").value = computeDurationDays(start, end);
}

function syncTripFinalValue(force = false) {
  const baseValue = Number($("#tripBaseValue").value || 0);
  const discount = Number($("#tripDiscount").value || 0);
  if (force || !state.ui.tripManualFinal) {
    $("#tripFinalValue").value = Math.max(baseValue - discount, 0).toFixed(2);
  }
}

function syncTripSuggestedBaseValue(force = false) {
  const totalKm = Number($("#tripTotalKm").value || 0);
  const pricePerKm = Number($("#tripPricePerKm").value || 0);
  const vehiclesQty = Math.max(Number($("#tripVehiclesQty").value || 1), 1);
  if (totalKm > 0 && pricePerKm > 0 && (force || !state.ui.tripManualBase)) {
    $("#tripBaseValue").value = (totalKm * pricePerKm * vehiclesQty).toFixed(2);
  }
  syncTripFinalValue(force);
}

function openTripForm() {
  $("#tripFormCard").classList.remove("hidden-section");
  $("#tripFormCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearTripForm() {
  $("#tripForm").reset();
  $("#tripId").value = "";
  $("#tripDepartureDate").value = today();
  $("#tripReturnDate").value = today();
  $("#tripDuration").value = "1";
  $("#tripVehiclesQty").value = "1";
  setSelectedTripVehicleIds([]);
  $("#tripDiscount").value = "0.00";
  $("#tripPricePerKm").value = "";
  $("#tripOneWayKm").value = "";
  $("#tripTotalKm").value = "";
  $("#tripStatus").value = "Proposta";
  state.ui.tripEditingId = "";
  state.ui.tripManualBase = false;
  state.ui.tripManualFinal = false;
  syncTripFinalValue(true);
}

function closeTripForm() {
  $("#tripFormCard").classList.add("hidden-section");
  clearTripForm();
}

function getTripItineraryPoints() {
  const origin = $("#tripOrigin").value.trim();
  const destination = $("#tripDestination").value.trim();
  const stops = $("#tripStops")
    .value.split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return [origin, ...stops, destination].filter(Boolean);
}

function getSelectedTripVehicleIds() {
  return [...($("#tripVehicleIds")?.selectedOptions || [])]
    .map((option) => option.value)
    .filter(Boolean);
}

function syncTripVehiclesQtyFromSelection() {
  const selectedIds = getSelectedTripVehicleIds();
  if (selectedIds.length) {
    $("#tripVehiclesQty").value = String(selectedIds.length);
  }
  syncTripSuggestedBaseValue(false);
}

function setSelectedTripVehicleIds(vehicleIds = []) {
  const selected = new Set(vehicleIds || []);
  [...($("#tripVehicleIds")?.options || [])].forEach((option) => {
    option.selected = selected.has(option.value);
  });
  if (selected.size) {
    $("#tripVehiclesQty").value = String(selected.size);
  }
}

function getTripVehicleNames(trip) {
  const ids = Array.isArray(trip?.vehicleIds)
    ? trip.vehicleIds.filter(Boolean)
    : [];
  if (ids.length) {
    return ids
      .map((id) => {
        const vehicle = state.data.vehicles.find((item) => item.id === id);
        return vehicle ? getVehicleDisplayName(vehicle) : "-";
      })
      .filter((name) => name && name !== "-");
  }
  return [];
}

async function geocodePlace(place) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=br&limit=1&q=${encodeURIComponent(place)}`;
  const response = await fetch(url, {
    headers: { "Accept-Language": "pt-BR,pt;q=0.9" },
  });
  if (!response.ok) throw new Error("Falha ao consultar geocodificação");
  const data = await response.json();
  if (!Array.isArray(data) || !data.length)
    throw new Error(`Não encontrei a localização: ${place}`);
  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
    name: data[0].display_name || place,
  };
}

async function calculateTripDistance() {
  const points = getTripItineraryPoints();
  if (points.length < 2) {
    showToast("Informe origem e destino para calcular o km.", "error");
    return null;
  }

  const button = $("#tripCalculateKmBtn");
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = "Calculando...";

  try {
    const geocoded = await Promise.all(
      points.map((point) => geocodePlace(point)),
    );
    const coordinates = geocoded
      .map((point) => `${point.lon},${point.lat}`)
      .join(";");
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`;
    const response = await fetch(routeUrl);
    if (!response.ok) throw new Error("Falha ao consultar rota");
    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.length)
      throw new Error("Rota não encontrada");
    const oneWayKm = data.routes[0].distance / 1000;
    const roundTripKm = oneWayKm * 2;
    $("#tripOneWayKm").value = oneWayKm.toFixed(0);
    $("#tripTotalKm").value = roundTripKm.toFixed(0);
    syncTripSuggestedBaseValue(false);
    showToast("Distância calculada com sucesso.", "success");
    return roundTripKm;
  } catch (error) {
    console.error(error);
    showToast(
      "Não foi possível calcular a distância automática. Você pode ajustar o km manualmente.",
      "error",
    );
    return null;
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}

function buildTripPayloadFromForm({ silent = false } = {}) {
  const tripId = $("#tripId").value || uid();
  const responsible = $("#tripResponsible").value.trim();
  const client = $("#tripClient").value.trim();
  const origin = $("#tripOrigin").value.trim();
  const destination = $("#tripDestination").value.trim();
  const departureDate = $("#tripDepartureDate").value;
  const returnDate = $("#tripReturnDate").value;
  const durationDays = Number($("#tripDuration").value || 1);
  const selectedVehicleIds = getSelectedTripVehicleIds();
  const vehiclesQty = Math.max(
    selectedVehicleIds.length || Number($("#tripVehiclesQty").value || 1),
    1,
  );
  const oneWayKm = Number($("#tripOneWayKm").value || 0);
  const totalKm = Number($("#tripTotalKm").value || 0);
  const pricePerKm = Number($("#tripPricePerKm").value || 0);
  const baseValue = Number($("#tripBaseValue").value || 0);
  const discount = Number($("#tripDiscount").value || 0);
  const finalValue = Number($("#tripFinalValue").value || 0);
  const status = $("#tripStatus").value;
  const stops = $("#tripStops")
    .value.split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const existing = state.data.trips.find((trip) => trip.id === tripId);

  if (
    !responsible ||
    !client ||
    !origin ||
    !destination ||
    !departureDate ||
    !returnDate
  ) {
    if (!silent)
      showToast("Preencha os campos principais da proposta.", "error");
    return null;
  }
  if (returnDate < departureDate) {
    if (!silent)
      showToast(
        "A data de retorno não pode ser menor que a data de saída.",
        "error",
      );
    return null;
  }
  if (totalKm <= 0) {
    if (!silent)
      showToast("Calcule ou informe o total de km da viagem.", "error");
    return null;
  }
  if (baseValue <= 0 || finalValue <= 0) {
    if (!silent)
      showToast("Informe o valor total e o valor final da proposta.", "error");
    return null;
  }

  return {
    id: tripId,
    responsible,
    client,
    origin,
    destination,
    stops,
    itinerary: [origin, ...stops, destination],
    vehicleIds: selectedVehicleIds,
    departureDate,
    returnDate,
    durationDays,
    vehiclesQty,
    oneWayKm,
    totalKm,
    pricePerKm,
    baseValue,
    discount,
    finalValue,
    status,
    emissionDate: existing?.emissionDate || today(),
  };
}

function tripVehicleLabel(qty) {
  return `${Math.max(Number(qty || 0), 1)}`;
}

function buildTripProposalMarkup(trip) {
  const showDiscount = Number(trip.discount || 0) > 0;
  const selectedVehicles = getTripVehicleNames(trip);
  const selectedVehiclesMarkup = selectedVehicles.length
    ? `<p><strong>Veículos selecionados:</strong> ${escapeHtml(selectedVehicles.join(" • "))}</p>`
    : "";
  const discountRow = showDiscount
    ? `
              <tr>
                <td>Desconto</td>
                <td>${escapeHtml(currency(trip.discount).replace("R$", "").trim())}</td>
              </tr>`
    : "";

  return `
        <div class="proposal-doc">
          <img src="${LOGO_DATA}" alt="Garcia Turismo" />
          <h1>PROPOSTA DE VIAGEM – GARCIA TURISMO</h1>
          <p><strong>Responsável:</strong> ${escapeHtml(trip.responsible)}</p>
          <p><strong>Origem:</strong> ${escapeHtml(trip.origin)}</p>
          <p><strong>Destino:</strong> ${escapeHtml(trip.destination)}</p>
          <p><strong>Duração:</strong> ${escapeHtml(trip.durationDays)} dia(s)</p>
          <p><strong>Serviços Inclusos:</strong> Transporte (ida e volta)</p>
          <p><strong>Quantidade de veículos:</strong> ${escapeHtml(tripVehicleLabel(trip.vehiclesQty))}</p>
          ${selectedVehiclesMarkup}
          <p><strong>Total de km (ida e volta):</strong> ${escapeHtml(Number(trip.totalKm).toFixed(0))} km</p>
          <p><strong>Valor Total:</strong> ${escapeHtml(currency(trip.baseValue))}</p>
          <p><strong>Data de Saída:</strong> ${escapeHtml(formatDate(trip.departureDate))}</p>
          <p><strong>Data de Retorno:</strong> ${escapeHtml(formatDate(trip.returnDate))}</p>
          <p><strong>Data de Emissão:</strong> ${escapeHtml(formatDate(trip.emissionDate))}</p>

          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Valor</td>
                <td>${escapeHtml(currency(trip.baseValue).replace("R$", "").trim())}</td>
              </tr>
              ${discountRow}
              <tr>
                <td>Valor final</td>
                <td class="highlight-cell">${escapeHtml(currency(trip.finalValue).replace("R$", "").trim())}</td>
              </tr>
            </tbody>
          </table>

          <p><strong>Observações:</strong></p>
          <p>- Oferta válida por 30 dias a partir da data de emissão.</p>
          <p>- Valores incluem transporte (ida e volta) apenas.</p>

          <p style="margin-top:14px;"><strong>Contato:</strong></p>
          <p>WhatsApp: (74) 98816-4009</p>
          <p>E-mail: garciaturismoeviagens@gmail.com</p>

          <div class="signature">__________________________________<br>Assinatura do Cliente / Data</div>
        </div>`;
}

function renderTripPreview() {
  if (!state.ui.tripPreviewData) {
    $("#tripPreviewCard").classList.add("hidden-section");
    $("#tripProposalDocument").innerHTML = "";
    return;
  }
  $("#tripPreviewCard").classList.remove("hidden-section");
  $("#tripProposalDocument").innerHTML = buildTripProposalMarkup(
    state.ui.tripPreviewData,
  );
}

function renderTripsTable() {
  const rows = [...state.data.trips].sort((a, b) =>
    (a.departureDate || "").localeCompare(b.departureDate || ""),
  );
  $("#tripTable").innerHTML =
    rows
      .map(
        (trip) => `
        <tr>
          <td>${formatDate(trip.departureDate)}</td>
          <td>${escapeHtml(trip.client)}</td>
          <td>${escapeHtml(trip.destination)}</td>
          <td>${escapeHtml(getTripVehicleNames(trip).join(" • ") || tripVehicleLabel(trip.vehiclesQty))}</td>
          <td>${tripStatusBadge(trip.status)}</td>
          <td>${currency(trip.finalValue)}</td>
          <td class="text-right whitespace-nowrap">
            <button class="text-slate-700 font-semibold mr-3" onclick="editTrip('${trip.id}')">Editar</button>
            <button class="text-red-600 font-semibold" onclick="previewTrip('${trip.id}')">Abrir</button>
          </td>
        </tr>`,
      )
      .join("") ||
    `<tr><td colspan="7" class="text-center muted py-6">Nenhuma viagem cadastrada.</td></tr>`;
}

function renderTripDaySummary() {
  $("#tripSelectedDateLabel").textContent = formatDate(
    state.ui.tripSelectedDate,
  );
  const trips = getTripsForDate(state.ui.tripSelectedDate);
  $("#tripDaySummary").innerHTML =
    trips
      .map(
        (trip) => `
        <div class="metric-card p-4">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="font-semibold">${escapeHtml(trip.destination)}</div>
            ${tripStatusBadge(trip.status)}
          </div>
          <div class="muted text-sm mt-2">Cliente: ${escapeHtml(trip.client)}</div>
          <div class="muted text-sm">Saída: ${formatDate(trip.departureDate)} • Retorno: ${formatDate(trip.returnDate)}</div>
          <div class="muted text-sm">Veículos: ${escapeHtml(getTripVehicleNames(trip).join(" • ") || tripVehicleLabel(trip.vehiclesQty))}</div>
          <div class="flex flex-wrap gap-2 mt-3">
            <button class="rounded-xl px-3 py-2 btn-secondary text-sm font-semibold" onclick="editTrip('${trip.id}')">Editar</button>
            <button class="rounded-xl px-3 py-2 btn-primary text-sm font-semibold" onclick="previewTrip('${trip.id}')">Abrir proposta</button>
          </div>
        </div>`,
      )
      .join("") ||
    `<div class="metric-card p-4 muted">Nenhuma viagem cadastrada para esta data.</div>`;
}

function renderTripsCalendar() {
  const currentMonth = state.ui.tripMonth;
  const [year, month] = currentMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const totalDays = new Date(year, month, 0).getDate();
  const previousMonthDays = new Date(year, month - 1, 0).getDate();
  $("#tripMonthLabel").textContent = formatMonthLabel(currentMonth);

  let html = "";
  for (let index = 0; index < 42; index++) {
    let dayNumber = 0;
    let dateStr = "";
    let muted = false;

    if (index < firstDay) {
      dayNumber = previousMonthDays - firstDay + index + 1;
      const prevMonth = addMonthsToMonthString(currentMonth, -1);
      dateStr = `${prevMonth}-${String(dayNumber).padStart(2, "0")}`;
      muted = true;
    } else if (index >= firstDay + totalDays) {
      dayNumber = index - (firstDay + totalDays) + 1;
      const nextMonth = addMonthsToMonthString(currentMonth, 1);
      dateStr = `${nextMonth}-${String(dayNumber).padStart(2, "0")}`;
      muted = true;
    } else {
      dayNumber = index - firstDay + 1;
      dateStr = `${currentMonth}-${String(dayNumber).padStart(2, "0")}`;
    }

    const trips = getTripsForDate(dateStr);
    html += `
          <button type="button" class="calendar-day ${muted ? "muted-day" : ""} ${trips.length ? "has-trip" : ""} ${state.ui.tripSelectedDate === dateStr ? "selected-day" : ""}" data-trip-date="${dateStr}">
            <div class="text-sm font-semibold">${dayNumber}</div>
            <div class="calendar-day__count">${trips.length ? `${trips.length} viagem(ns)` : ""}</div>
          </button>`;
  }
  $("#tripCalendarGrid").innerHTML = html;
  $$("#tripCalendarGrid [data-trip-date]").forEach((button) => {
    button.addEventListener("click", () => {
      state.ui.tripSelectedDate = button.dataset.tripDate;
      renderTripsCalendar();
      renderTripDaySummary();
    });
  });
}

window.editTrip = function (id) {
  const trip = state.data.trips.find((item) => item.id === id);
  if (!trip) return;
  openTripForm();
  $("#tripId").value = trip.id;
  $("#tripResponsible").value = trip.responsible;
  $("#tripClient").value = trip.client;
  $("#tripStatus").value = trip.status;
  $("#tripOrigin").value = trip.origin;
  $("#tripDestination").value = trip.destination;
  $("#tripStops").value = (trip.stops || []).join("\n");
  $("#tripDepartureDate").value = trip.departureDate;
  $("#tripReturnDate").value = trip.returnDate;
  $("#tripDuration").value = trip.durationDays;
  $("#tripVehiclesQty").value = trip.vehiclesQty;
  setSelectedTripVehicleIds(trip.vehicleIds || []);
  $("#tripOneWayKm").value = trip.oneWayKm || "";
  $("#tripTotalKm").value = trip.totalKm;
  $("#tripPricePerKm").value = Number(
    trip.pricePerKm ||
      (Number(trip.totalKm) > 0 && Number(trip.vehiclesQty) > 0
        ? Number(trip.baseValue) /
          (Number(trip.totalKm) * Number(trip.vehiclesQty))
        : 0),
  ).toFixed(2);
  $("#tripBaseValue").value = Number(trip.baseValue).toFixed(2);
  $("#tripDiscount").value = Number(trip.discount).toFixed(2);
  $("#tripFinalValue").value = Number(trip.finalValue).toFixed(2);
  state.ui.tripEditingId = trip.id;
  state.ui.tripManualBase = true;
  state.ui.tripManualFinal = true;
  state.ui.tripPreviewData = trip;
  state.ui.tripMonth = trip.departureDate.slice(0, 7);
  state.ui.tripSelectedDate = trip.departureDate;
  renderTripsCalendar();
  renderTripDaySummary();
  renderTripPreview();
  document.querySelector('[data-tab="viagens"]').click();
};

window.previewTrip = function (id) {
  const trip = state.data.trips.find((item) => item.id === id);
  if (!trip) return;
  state.ui.tripPreviewData = trip;
  state.ui.tripMonth = trip.departureDate.slice(0, 7);
  state.ui.tripSelectedDate = trip.departureDate;
  renderTripsCalendar();
  renderTripDaySummary();
  renderTripPreview();
  document.querySelector('[data-tab="viagens"]').click();
  $("#tripPreviewCard").scrollIntoView({ behavior: "smooth", block: "start" });
};

function bindTrips() {
  $("#openTripFormBtn").addEventListener("click", () => {
    openTripForm();
    if (!$("#tripId").value) clearTripForm();
  });
  $("#tripCancelEditBtn").addEventListener("click", closeTripForm);
  $("#tripPrevMonthBtn").addEventListener("click", () => {
    state.ui.tripMonth = addMonthsToMonthString(state.ui.tripMonth, -1);
    renderTripsCalendar();
  });
  $("#tripNextMonthBtn").addEventListener("click", () => {
    state.ui.tripMonth = addMonthsToMonthString(state.ui.tripMonth, 1);
    renderTripsCalendar();
  });
  $("#tripDepartureDate").addEventListener("change", syncTripDuration);
  $("#tripReturnDate").addEventListener("change", syncTripDuration);
  $("#tripVehiclesQty").addEventListener("input", () =>
    syncTripSuggestedBaseValue(false),
  );
  $("#tripVehicleIds").addEventListener(
    "change",
    syncTripVehiclesQtyFromSelection,
  );
  $("#tripTotalKm").addEventListener("input", () =>
    syncTripSuggestedBaseValue(false),
  );
  $("#tripPricePerKm").addEventListener("input", () => {
    state.ui.tripManualBase = false;
    syncTripSuggestedBaseValue(true);
  });
  $("#tripBaseValue").addEventListener("input", () => {
    state.ui.tripManualBase = true;
    syncTripFinalValue(false);
  });
  $("#tripDiscount").addEventListener("input", () => syncTripFinalValue(false));
  $("#tripFinalValue").addEventListener("input", () => {
    state.ui.tripManualFinal = true;
  });
  $("#tripRecalcFinalBtn").addEventListener("click", () => {
    state.ui.tripManualFinal = false;
    syncTripFinalValue(true);
  });
  $("#tripCalculateKmBtn").addEventListener("click", calculateTripDistance);
  $("#tripPreviewBtn").addEventListener("click", () => {
    const payload = buildTripPayloadFromForm();
    if (!payload) return;
    state.ui.tripPreviewData = payload;
    renderTripPreview();
    $("#tripPreviewCard").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
  $("#tripForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = buildTripPayloadFromForm();
    if (!payload) return;
    const index = state.data.trips.findIndex((trip) => trip.id === payload.id);
    if (index >= 0) state.data.trips[index] = payload;
    else state.data.trips.unshift(payload);
    state.ui.tripPreviewData = payload;
    state.ui.tripMonth = payload.departureDate.slice(0, 7);
    state.ui.tripSelectedDate = payload.departureDate;
    persist();
    renderAll();
    renderTripPreview();
    showToast(
      index >= 0
        ? "Viagem atualizada com sucesso."
        : "Viagem cadastrada com sucesso.",
      "success",
    );
  });
  $("#tripExportPdfBtn").addEventListener("click", exportTripProposalPdf);
  $("#tripExportImageBtn").addEventListener("click", exportTripProposalImage);
}

async function exportTripProposalPdf() {
  const source = $("#tripProposalDocument");
  if (!source || !source.innerHTML.trim()) {
    showToast("Gere a prévia da proposta antes de exportar.", "error");
    return;
  }
  const clone = source.cloneNode(true);
  clone.style.background = "#fff";
  clone.style.padding = "0";
  const wrap = document.createElement("div");
  wrap.style.position = "fixed";
  wrap.style.left = "-99999px";
  wrap.style.top = "0";
  wrap.appendChild(clone);
  document.body.appendChild(wrap);
  try {
    await html2pdf()
      .set({
        margin: 0.25,
        filename: `proposta_viagem_${slugify(state.ui.tripPreviewData?.destination || "garcia")}_${today()}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      })
      .from(clone)
      .save();
    showToast("Proposta em PDF gerada com sucesso.", "success");
  } catch (error) {
    console.error(error);
    showToast("Erro ao gerar o PDF da proposta.", "error");
  } finally {
    document.body.removeChild(wrap);
  }
}

async function exportTripProposalImage() {
  const source = $("#tripProposalDocument");
  if (!source || !source.innerHTML.trim()) {
    showToast("Gere a prévia da proposta antes de exportar.", "error");
    return;
  }
  try {
    const canvas = await html2canvas(source, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `proposta_viagem_${slugify(state.ui.tripPreviewData?.destination || "garcia")}_${today()}.png`;
    link.click();
    showToast("Imagem da proposta gerada com sucesso.", "success");
  } catch (error) {
    console.error(error);
    showToast("Erro ao gerar a imagem da proposta.", "error");
  }
}

function renderAll() {
  renderSelectOptions();
  renderKPIs();
  renderCharts();
  renderCadastros();
  renderFuelHistory();
  renderTripsCalendar();
  renderTripDaySummary();
  renderTripsTable();
  renderExpenseTable();
  renderPending();
  renderReport();
  renderTripPreview();
}

function togglePaymentBlocks(prefix) {
  const payment = $(`#${prefix}Payment`).value;
  const isCard = payment === "cartao_credito";
  const isCheque = payment === "cheque";

  $(
    `#wrap${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Card`,
  ).classList.toggle("hidden-section", !isCard);
  $(
    `#wrap${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Buyer`,
  ).classList.toggle("hidden-section", !isCard);
  $(
    `#wrap${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Installments`,
  ).classList.toggle("hidden-section", !isCard);
  $(`#${prefix}Card`).required = isCard;
  $(`#${prefix}Buyer`).required = isCard;
  $(`#${prefix}Installments`).required = isCard;

  $(
    `#wrap${prefix.charAt(0).toUpperCase() + prefix.slice(1)}ChequeDate`,
  ).classList.toggle("hidden-section", !isCheque);
  $(
    `#wrap${prefix.charAt(0).toUpperCase() + prefix.slice(1)}ChequeBank`,
  ).classList.toggle("hidden-section", !isCheque);
  $(`#${prefix}ChequeDate`).required = isCheque;
  $(`#${prefix}ChequeBank`).required = isCheque;
}

function toggleExpenseFields() {
  const isOther = $("#expenseCategory").value === "outros";
  $("#wrapExpenseOtherDescription").classList.toggle(
    "hidden-section",
    !isOther,
  );
  $("#expenseOtherDescription").required = isOther;
  togglePaymentBlocks("expense");
}

function toggleFuelFields() {
  togglePaymentBlocks("fuel");
}

function clearExpenseForm() {
  $("#expenseForm").reset();
  $("#expenseDate").value = today();
  $("#expenseInstallments").value = "1";
  toggleExpenseFields();
}

function clearFuelForm() {
  $("#fuelForm").reset();
  $("#fuelLastKm").value = "";
  $("#fuelInstallments").value = "1";
  calculateFuelPreview();
  toggleFuelFields();
}

function calculateFuelPreview() {
  const lastKm = Number($("#fuelLastKm").value || 0);
  const currentKm = Number($("#fuelCurrentKm").value || 0);
  const liters = Number($("#fuelLiters").value || 0);
  const total = Number($("#fuelTotal").value || 0);
  const distance = Math.max(0, currentKm - lastKm);
  const average = liters > 0 ? distance / liters : 0;
  const pricePerLiter = liters > 0 ? total / liters : 0;
  $("#previewDistance").textContent = `${distance.toFixed(0)} km`;
  $("#previewAverage").textContent = `${average.toFixed(2)} km/l`;
  $("#previewPricePerLiter").textContent = currency(pricePerLiter);
  return { lastKm, currentKm, liters, total, distance, average, pricePerLiter };
}

function addCardSchedules({
  sourceType,
  sourceId,
  description,
  cardId,
  buyerId,
  baseDate,
  totalValue,
  parcelas,
  firstStatus,
  vehicleId = "",
  employeeId = "",
  category = "",
  extra = "",
}) {
  const card = state.data.cards.find((x) => x.id === cardId);
  if (!card) return;
  const basePart = Number((totalValue / parcelas).toFixed(2));

  for (let i = 1; i <= parcelas; i++) {
    const due = calculateInvoiceMonth(
      baseDate,
      card.fechamento,
      card.vencimento,
      i - 1,
    );
    const value =
      i === parcelas
        ? Number((totalValue - basePart * (parcelas - 1)).toFixed(2))
        : basePart;
    state.data.cardSchedules.unshift({
      id: uid(),
      sourceType,
      sourceId,
      description: extra ? `${description} • ${extra}` : description,
      cardId,
      buyerId,
      parcela: i,
      totalParcelas: parcelas,
      valor: value,
      vencimento: due.vencimento,
      status: i === 1 ? firstStatus : "a_pagar",
      veiculoId: vehicleId,
      funcionarioId: employeeId,
      category,
    });
  }
}

function openModal(html) {
  $("#modalRoot").classList.remove("hidden");
  $("#modalRoot").classList.add("flex");
  $("#modalContent").innerHTML = html;
}

function closeModal() {
  $("#modalRoot").classList.add("hidden");
  $("#modalRoot").classList.remove("flex");
  $("#modalContent").innerHTML = "";
}

window.closeModal = closeModal;

window.openEntityModal = function (type, id = "") {
  const config = {
    employee: {
      item: state.data.employees.find((x) => x.id === id) || {},
      title: id ? "Editar funcionário" : "Novo funcionário",
      form: (item) => `
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-2xl font-semibold">${id ? "Editar funcionário" : "Novo funcionário"}</h3>
              <button onclick="closeModal()" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Fechar</button>
            </div>
            <form id="entityForm" class="grid md:grid-cols-2 gap-4">
              <input type="hidden" name="entityType" value="employee">
              <input type="hidden" name="entityId" value="${id}">
              <div><label class="block text-sm font-medium mb-2">Nome</label><input class="field" name="nome" value="${item.nome || ""}" required></div>
              <div><label class="block text-sm font-medium mb-2">Cargo</label><input class="field" name="cargo" value="${item.cargo || ""}" required></div>
              <div><label class="block text-sm font-medium mb-2">Telefone</label><input class="field" name="telefone" value="${item.telefone || ""}" required></div>
              <div><label class="block text-sm font-medium mb-2">Salário base</label><input type="number" min="0" step="0.01" class="field" name="salarioBase" value="${item.salarioBase || ""}" required></div>
              <div class="md:col-span-2 flex justify-end"><button class="rounded-2xl px-5 py-4 btn-primary font-semibold">Salvar</button></div>
            </form>`,
    },
    vehicle: {
      item: state.data.vehicles.find((x) => x.id === id) || {},
      form: (item) => `
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-2xl font-semibold">${id ? "Editar veículo" : "Novo veículo"}</h3>
              <button onclick="closeModal()" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Fechar</button>
            </div>
            <form id="entityForm" class="grid md:grid-cols-2 gap-4">
              <input type="hidden" name="entityType" value="vehicle">
              <input type="hidden" name="entityId" value="${id}">
              <div><label class="block text-sm font-medium mb-2">Modelo</label><input class="field" name="modelo" value="${item.modelo || ""}" required></div>
              <div><label class="block text-sm font-medium mb-2">Ano</label><input type="number" class="field" name="ano" value="${item.ano || ""}" required></div>
              <div><label class="block text-sm font-medium mb-2">Cor</label><input class="field" name="cor" value="${item.cor || ""}" required></div>
              <div><label class="block text-sm font-medium mb-2">Placa</label><input class="field" name="placa" value="${item.placa || ""}"></div>
              <div><label class="block text-sm font-medium mb-2">KM atual</label><input type="number" class="field" name="kmAtual" value="${item.kmAtual || 0}" required></div>
              <div><label class="block text-sm font-medium mb-2">Quantidade de lugares</label><input type="number" min="1" class="field" name="lugares" value="${item.lugares || ""}" required></div>
              <div><label class="block text-sm font-medium mb-2">Status</label><select class="field" name="status"><option value="ativo" ${item.status !== "inativo" ? "selected" : ""}>Ativo</option><option value="inativo" ${item.status === "inativo" ? "selected" : ""}>Inativo</option></select></div>
              <div class="md:col-span-2 flex justify-end"><button class="rounded-2xl px-5 py-4 btn-primary font-semibold">Salvar</button></div>
            </form>`,
    },
    buyer: {
      item: state.data.buyers.find((x) => x.id === id) || {},
      form: (item) => `
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-2xl font-semibold">${id ? "Editar gestor" : "Novo gestor"}</h3>
              <button onclick="closeModal()" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Fechar</button>
            </div>
            <form id="entityForm" class="grid md:grid-cols-2 gap-4">
              <input type="hidden" name="entityType" value="buyer">
              <input type="hidden" name="entityId" value="${id}">
              <div><label class="block text-sm font-medium mb-2">Nome</label><input class="field" name="nome" value="${item.nome || ""}" required></div>
              <div><label class="block text-sm font-medium mb-2">Status</label><select class="field" name="status"><option value="ativo" ${item.status !== "inativo" ? "selected" : ""}>Ativo</option><option value="inativo" ${item.status === "inativo" ? "selected" : ""}>Inativo</option></select></div>
              <div class="md:col-span-2 flex justify-end"><button class="rounded-2xl px-5 py-4 btn-primary font-semibold">Salvar</button></div>
            </form>`,
    },
    card: {
      item: state.data.cards.find((x) => x.id === id) || {},
      form: (item) => `
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-2xl font-semibold">${id ? "Editar cartão" : "Novo cartão"}</h3>
              <button onclick="closeModal()" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Fechar</button>
            </div>
            <form id="entityForm" class="grid md:grid-cols-3 gap-4">
              <input type="hidden" name="entityType" value="card">
              <input type="hidden" name="entityId" value="${id}">
              <div><label class="block text-sm font-medium mb-2">Nome do cartão</label><input class="field" name="nome" value="${item.nome || ""}" required></div>
              <div><label class="block text-sm font-medium mb-2">Dia de fechamento</label><input type="number" min="1" max="31" class="field" name="fechamento" value="${item.fechamento || ""}" required></div>
              <div><label class="block text-sm font-medium mb-2">Dia de vencimento</label><input type="number" min="1" max="31" class="field" name="vencimento" value="${item.vencimento || ""}" required></div>
              <div class="md:col-span-3 flex justify-end"><button class="rounded-2xl px-5 py-4 btn-primary font-semibold">Salvar</button></div>
            </form>`,
    },
  };
  openModal(config[type].form(config[type].item));
  bindEntityForm();
};

window.removeEntity = function (type, id) {
  if (!confirm("Tem certeza que deseja continuar?")) return;

  if (type === "employee") {
    const item = state.data.employees.find((x) => x.id === id);
    if (item) item.status = "inativo";
  }
  if (type === "vehicle") {
    const item = state.data.vehicles.find((x) => x.id === id);
    if (item) item.status = "inativo";
  }
  if (type === "buyer") {
    const item = state.data.buyers.find((x) => x.id === id);
    if (item) item.status = "inativo";
  }
  if (type === "card") {
    state.data.cards = state.data.cards.filter((x) => x.id !== id);
  }

  persist();
  renderAll();
  showToast("Registro atualizado.", "success");
};

function bindEntityForm() {
  const form = $("#entityForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const id = data.entityId || uid();

    if (data.entityType === "employee") {
      const payload = {
        id,
        nome: data.nome,
        cargo: data.cargo,
        telefone: data.telefone,
        salarioBase: Number(data.salarioBase),
        status: "ativo",
      };
      const index = state.data.employees.findIndex((x) => x.id === id);
      index >= 0
        ? (state.data.employees[index] = payload)
        : state.data.employees.push(payload);
    }

    if (data.entityType === "vehicle") {
      const payload = {
        id,
        modelo: data.modelo,
        ano: Number(data.ano),
        cor: data.cor,
        placa: data.placa,
        kmAtual: Number(data.kmAtual),
        lugares: Math.max(Number(data.lugares || 0), 1),
        status: data.status,
      };
      const index = state.data.vehicles.findIndex((x) => x.id === id);
      index >= 0
        ? (state.data.vehicles[index] = payload)
        : state.data.vehicles.push(payload);
    }

    if (data.entityType === "buyer") {
      const payload = { id, nome: data.nome, status: data.status };
      const index = state.data.buyers.findIndex((x) => x.id === id);
      index >= 0
        ? (state.data.buyers[index] = payload)
        : state.data.buyers.push(payload);
    }

    if (data.entityType === "card") {
      const payload = {
        id,
        nome: data.nome,
        fechamento: Number(data.fechamento),
        vencimento: Number(data.vencimento),
      };
      const index = state.data.cards.findIndex((x) => x.id === id);
      index >= 0
        ? (state.data.cards[index] = payload)
        : state.data.cards.push(payload);
    }

    persist();
    renderAll();
    closeModal();
    showToast("Cadastro salvo com sucesso.", "success");
  });
}

function bindTabs() {
  $$(".nav-chip[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentTab = btn.dataset.tab;
      $$(".nav-chip[data-tab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      $$(".tab-pane").forEach((pane) => pane.classList.add("hidden-section"));
      $(`#tab-${state.currentTab}`).classList.remove("hidden-section");
    });
  });
}
function switchScreens() {
  const loginScreen = document.querySelector("#loginScreen");
  const dashboardScreen = document.querySelector("#dashboardScreen");

  if (!loginScreen || !dashboardScreen) return;

  if (hasSession()) {
    loginScreen.classList.add("hidden-section");
    dashboardScreen.classList.remove("hidden-section");
  } else {
    dashboardScreen.classList.add("hidden-section");
    loginScreen.classList.remove("hidden-section");
  }
}
function bindLogin() {
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = $("#loginUser").value.trim();
    const pass = $("#loginPass").value.trim();

    try {
      const result = await authService.signIn(user, pass);
      if (result.mode === "supabase") {
        await loadCloudDataIfAvailable();
      }
      switchScreens();
      renderAll();
      showToast(`Bem-vindo, ${result.user}.`, "success");
    } catch (error) {
      console.error("Erro no login:", error);
      showToast(error.message || "Usuário ou senha inválidos.", "error");
    }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    try {
      await databaseService.flush();
      await authService.signOut();
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
    switchScreens();
  });
}

function bindExpenseForm() {
  $("#expenseCategory").addEventListener("change", toggleExpenseFields);
  $("#expensePayment").addEventListener("change", toggleExpenseFields);
  $("#expenseClearBtn").addEventListener("click", clearExpenseForm);
  $("#openQuickExpense").addEventListener("click", () =>
    document.querySelector('[data-tab="despesas"]').click(),
  );

  $("#expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const category = $("#expenseCategory").value;
    const paymentMethod = $("#expensePayment").value;
    const status = $("#expenseStatus").value;
    const value = Number($("#expenseAmount").value);
    const description = $("#expenseDescription").value.trim();
    const otherDescription = $("#expenseOtherDescription").value.trim();

    if (category === "outros" && !otherDescription) {
      showToast("Informe a descrição do gasto em Outros.", "error");
      return;
    }

    const payload = {
      id: uid(),
      data: $("#expenseDate").value,
      categoria: category,
      descricao: description,
      descricaoGasto: category === "outros" ? otherDescription : "",
      valor: value,
      veiculoId: $("#expenseVehicle").value || "",
      funcionarioId: $("#expenseEmployee").value || "",
      paymentMethod,
      status,
      comprovanteUrl: $("#expenseProof").value || "",
      paymentDetails: {},
    };

    if (paymentMethod === "pix" || paymentMethod === "dinheiro") {
      payload.paymentDetails = {
        tipo: paymentMethod,
        instantaneo: true,
        vencimento: payload.data,
      };
    }

    if (paymentMethod === "cheque") {
      const dataCompensacao = $("#expenseChequeDate").value;
      const banco = $("#expenseChequeBank").value.trim();
      if (!dataCompensacao || !banco) {
        showToast("Cheque exige banco e data de compensação.", "error");
        return;
      }
      payload.paymentDetails = {
        tipo: "cheque",
        dataCompensacao,
        banco,
        vencimento: dataCompensacao,
      };
    }

    if (paymentMethod === "cartao_credito") {
      const cardId = $("#expenseCard").value;
      const buyerId = $("#expenseBuyer").value;
      const installments = Number($("#expenseInstallments").value || 1);
      if (!cardId || !buyerId) {
        showToast("Selecione cartão e comprador.", "error");
        return;
      }
      payload.cardId = cardId;
      payload.buyerId = buyerId;
      payload.installments = installments;
      payload.paymentDetails = {
        tipo: "cartao_credito",
        parcelas: installments,
      };
      addCardSchedules({
        sourceType: "expense",
        sourceId: payload.id,
        description,
        cardId,
        buyerId,
        baseDate: payload.data,
        totalValue: value,
        parcelas: installments,
        firstStatus: status,
        vehicleId: payload.veiculoId,
        employeeId: payload.funcionarioId,
        category,
        extra: payload.descricaoGasto,
      });
    }

    state.data.expenses.unshift(payload);
    persist();
    renderAll();
    clearExpenseForm();
    showToast("Despesa salva com sucesso.", "success");
  });
}

function bindFuelForm() {
  $("#fuelVehicle").addEventListener("change", () => {
    const vehicle = state.data.vehicles.find(
      (v) => v.id === $("#fuelVehicle").value,
    );
    $("#fuelLastKm").value = vehicle ? Number(vehicle.kmAtual || 0) : 0;
    calculateFuelPreview();
  });

  ["#fuelCurrentKm", "#fuelLiters", "#fuelTotal"].forEach((selector) => {
    $(selector).addEventListener("input", calculateFuelPreview);
  });

  $("#fuelPayment").addEventListener("change", toggleFuelFields);

  $("#fuelForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const vehicleId = $("#fuelVehicle").value;
    if (!vehicleId) {
      showToast("Selecione um veículo.", "error");
      return;
    }

    const metrics = calculateFuelPreview();
    if (metrics.currentKm <= metrics.lastKm) {
      showToast("KM atual deve ser maior que o último KM.", "error");
      return;
    }

    const paymentMethod = $("#fuelPayment").value;
    const status = $("#fuelStatus").value;

    const payload = {
      id: uid(),
      data: today(),
      veiculoId: vehicleId,
      ultimoKm: metrics.lastKm,
      kmAtual: metrics.currentKm,
      litros: metrics.liters,
      valorTotal: metrics.total,
      distanciaPercorrida: metrics.distance,
      mediaKmLitro: Number(metrics.average.toFixed(2)),
      precoLitro: Number(metrics.pricePerLiter.toFixed(2)),
      paymentMethod,
      status,
      paymentDetails: {},
    };

    if (paymentMethod === "pix" || paymentMethod === "dinheiro") {
      payload.paymentDetails = {
        tipo: paymentMethod,
        instantaneo: true,
        vencimento: payload.data,
      };
    }

    if (paymentMethod === "cheque") {
      const dataCompensacao = $("#fuelChequeDate").value;
      const banco = $("#fuelChequeBank").value.trim();
      if (!dataCompensacao || !banco) {
        showToast("Cheque exige banco e data de compensação.", "error");
        return;
      }
      payload.paymentDetails = {
        tipo: "cheque",
        dataCompensacao,
        banco,
        vencimento: dataCompensacao,
      };
    }

    if (paymentMethod === "cartao_credito") {
      const cardId = $("#fuelCard").value;
      const buyerId = $("#fuelBuyer").value;
      const installments = Number($("#fuelInstallments").value || 1);
      if (!cardId || !buyerId) {
        showToast("Selecione cartão e comprador no abastecimento.", "error");
        return;
      }
      payload.cardId = cardId;
      payload.buyerId = buyerId;
      payload.installments = installments;
      payload.paymentDetails = {
        tipo: "cartao_credito",
        parcelas: installments,
      };
      addCardSchedules({
        sourceType: "fuel",
        sourceId: payload.id,
        description: `Abastecimento ${getVehicleName(vehicleId)}`,
        cardId,
        buyerId,
        baseDate: payload.data,
        totalValue: payload.valorTotal,
        parcelas: installments,
        firstStatus: status,
        vehicleId,
        category: "combustivel",
        extra: `${payload.litros}L`,
      });
    }

    state.data.fuelings.unshift(payload);
    const vehicle = state.data.vehicles.find((v) => v.id === vehicleId);
    if (vehicle) vehicle.kmAtual = metrics.currentKm;

    persist();
    renderAll();
    clearFuelForm();
    showToast("Abastecimento salvo com sucesso.", "success");
  });
}

window.deleteExpense = function (id) {
  if (
    !confirm(
      "Tem certeza que deseja excluir esta despesa? Essa ação não pode ser desfeita.",
    )
  )
    return;

  const expense = state.data.expenses.find((x) => x.id === id);
  if (!expense) {
    showToast("Despesa não encontrada.", "error");
    return;
  }

  state.data.expenses = state.data.expenses.filter((x) => x.id !== id);
  state.data.cardSchedules = state.data.cardSchedules.filter(
    (x) => !(x.sourceType === "expense" && x.sourceId === id),
  );
  persist();
  renderAll();
  showToast("Despesa excluída com sucesso.", "success");
};

window.deleteReportEntry = function (rowType, id) {
  if (
    !confirm(
      "Tem certeza que deseja excluir este lançamento do relatório? Essa ação não pode ser desfeita.",
    )
  )
    return;

  if (rowType === "expense") {
    const expense = state.data.expenses.find((x) => x.id === id);
    if (!expense) {
      showToast("Despesa não encontrada.", "error");
      return;
    }
    state.data.expenses = state.data.expenses.filter((x) => x.id !== id);
    state.data.cardSchedules = state.data.cardSchedules.filter(
      (x) => !(x.sourceType === "expense" && x.sourceId === id),
    );
  }

  if (rowType === "fuel") {
    const fueling = state.data.fuelings.find((x) => x.id === id);
    if (!fueling) {
      showToast("Abastecimento não encontrado.", "error");
      return;
    }
    state.data.fuelings = state.data.fuelings.filter((x) => x.id !== id);
    state.data.cardSchedules = state.data.cardSchedules.filter(
      (x) => !(x.sourceType === "fuel" && x.sourceId === id),
    );
  }

  if (rowType === "schedule") {
    const schedule = state.data.cardSchedules.find((x) => x.id === id);
    if (!schedule) {
      showToast("Parcela não encontrada.", "error");
      return;
    }
    state.data.cardSchedules = state.data.cardSchedules.filter(
      (x) => x.id !== id,
    );
  }

  persist();
  renderAll();
  showToast("Lançamento excluído com sucesso.", "success");
};

window.undoReportPayment = function (rowType, id) {
  if (!confirm("Tem certeza que deseja estornar esta baixa?")) return;

  let item = null;
  if (rowType === "expense")
    item = state.data.expenses.find((x) => x.id === id);
  if (rowType === "fuel") item = state.data.fuelings.find((x) => x.id === id);
  if (rowType === "schedule")
    item = state.data.cardSchedules.find((x) => x.id === id);

  if (!item) {
    showToast("Lançamento não encontrado.", "error");
    return;
  }

  item.status = rowType === "schedule" ? "futuro" : "a_pagar";
  persist();
  renderAll();
  showToast("Baixa estornada com sucesso.", "success");
};

window.markPendingAsPaid = function (rowType, id) {
  if (!confirm("Tem certeza que deseja dar baixa nesta pendência?")) return;

  if (rowType === "expense") {
    const item = state.data.expenses.find((x) => x.id === id);
    if (item) item.status = "pago";
  }

  if (rowType === "fuel") {
    const item = state.data.fuelings.find((x) => x.id === id);
    if (item) item.status = "pago";
  }

  if (rowType === "schedule") {
    const item = state.data.cardSchedules.find((x) => x.id === id);
    if (item) item.status = "pago";
  }

  persist();
  renderAll();
  showToast("Pendência baixada com sucesso.", "success");
};

function bindReports() {
  $("#applyFiltersBtn").addEventListener("click", renderReport);
  $("#exportPdfBtn").addEventListener("click", exportPdf);
}

async function exportPdf() {
  renderReport();

  const source = $("#reportArea").cloneNode(true);
  source.style.background = "#ffffff";
  source.style.padding = "16px";
  source.querySelectorAll(".no-print").forEach((el) => el.remove());

  const header = document.createElement("div");
  header.style.marginBottom = "8px";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.innerHTML = `
        <div><img src="${LOGO_DATA}" alt="Garcia Turismo" style="height:48px;width:auto;"></div>
        <div style="text-align:right;color:#475569;font-size:10px;line-height:1.4;">
          <div>Relatório Garcia Turismo</div>
          <div>Emitido em ${new Date().toLocaleString("pt-BR")}</div>
        </div>`;
  source.prepend(header);

  const wrap = document.createElement("div");
  wrap.style.position = "fixed";
  wrap.style.left = "-99999px";
  wrap.style.top = "0";
  wrap.appendChild(source);
  document.body.appendChild(wrap);

  try {
    if (typeof html2pdf !== "undefined") {
      await html2pdf()
        .set({
          margin: 0.28,
          filename: `relatorio_garcia_turismo_${today()}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
          jsPDF: { unit: "in", format: "a4", orientation: "landscape" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .from(source)
        .save();
    } else {
      const printWin = window.open("", "_blank");
      printWin.document.write(
        `<html><head><title>Relatório Garcia Turismo</title></head><body>${source.outerHTML}</body></html>`,
      );
      printWin.document.close();
      printWin.focus();
      printWin.print();
    }
    showToast("PDF gerado com sucesso.", "success");
  } catch (error) {
    console.error(error);
    showToast(
      "Erro ao gerar o relatório. Tente abrir com Live Server.",
      "error",
    );
  } finally {
    document.body.removeChild(wrap);
  }
}

function bindModalTriggers() {
  $$("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => openEntityModal(btn.dataset.openModal));
  });
  $("#modalRoot").addEventListener("click", (e) => {
    if (e.target.id === "modalRoot") closeModal();
  });
}

function initDefaults() {
  $("#expenseDate").value = today();
  $("#reportMonth").value = monthNow();
  $("#expenseInstallments").value = "1";
  $("#fuelInstallments").value = "1";
  state.ui.tripMonth = monthNow();
  state.ui.tripSelectedDate = today();
  clearTripForm();
  calculateFuelPreview();
}

async function init() {
  applyLogo();
  load();
  switchScreens();
  bindTabs();
  bindLogin();
  bindExpenseForm();
  bindFuelForm();
  bindTrips();
  bindReports();
  bindModalTriggers();
  initDefaults();
  renderAll();
  toggleExpenseFields();
  toggleFuelFields();
  if (databaseService.isCloudEnabled() && hasSession()) {
    await loadCloudDataIfAvailable();
  }
}

export async function bootstrap() {
  await withErrorHandling(init, (error) => {
    console.error("Erro ao iniciar sistema:", error);
    alert("Erro ao iniciar o sistema. Verifique o console.");
  })();

  const reportHeader = document.querySelector(
    "#tab-relatorios .flex.flex-wrap",
  );

  if (reportHeader && !document.querySelector("#exportBackupBtn")) {
    const button = document.createElement("button");
    button.id = "exportBackupBtn";
    button.type = "button";
    button.className =
      "rounded-2xl px-5 py-4 btn-secondary font-semibold no-print";
    button.textContent = "Exportar backup JSON";

    button.addEventListener("click", () => {
      backupService.exportNow(state.data);
      showToast("Backup exportado em JSON.", "success");
    });

    reportHeader.appendChild(button);
  }
}
