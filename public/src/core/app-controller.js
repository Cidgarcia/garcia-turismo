import { APP_CONFIG, INITIAL_DATA } from "../config/app-config.js";
import { backupService } from "../services/backup-service.js";
import { authService } from "../services/auth-service.js";
import { databaseService } from "../services/database-service.js";
import { withErrorHandling } from "../utils/error-handler.js";
import { createAbastecimentosController } from "./abastecimentos-controller.js";
import { state } from "./app-state.js";
import { createCadastrosController } from "./cadastros-controller.js";
import {
  $,
  $$,
  createStateLookups,
  monthNow,
  today,
} from "./controller-helpers.js";
import { createDashboardController } from "./dashboard-controller.js";
import { createDespesasController } from "./despesas-controller.js";
import { showToast } from "./notifications.js";
import { createRelatoriosController } from "./relatorios-controller.js";
import { createViagensController } from "./viagens-controller.js";

const { getVehicleName, getEmployeeName, getBuyerName, getCardName } =
  createStateLookups(state);

function seedData() {
  return JSON.parse(JSON.stringify(INITIAL_DATA));
}

async function saveFirestoreRecord(recordType, listName, payload, options = {}) {
  const list = state.data[listName];
  const index = list.findIndex((item) => item.id === payload.id);
  const saved = index >= 0
    ? await databaseService.update(recordType, payload.id, payload)
    : await databaseService.create(recordType, payload);

  if (index >= 0) list[index] = { ...payload, ...saved };
  else if (options.prepend) list.unshift({ ...payload, ...saved });
  else list.push({ ...payload, ...saved });
  return saved;
}

async function removeFirestoreRecord(recordType, listName, id) {
  await databaseService.remove(recordType, id);
  state.data[listName] = state.data[listName].filter((item) => item.id !== id);
}

const dashboardController = createDashboardController({ state, getVehicleName });
const cadastrosController = createCadastrosController({
  state,
  onRenderAll: () => renderAll(),
  saveFirestoreRecord,
  removeFirestoreRecord,
  showToast,
});
const despesasController = createDespesasController({
  state,
  getEmployeeName,
  getVehicleName,
  onRenderAll: () => renderAll(),
  removeFirestoreRecord,
  saveFirestoreRecord,
  showToast,
});
const abastecimentosController = createAbastecimentosController({
  state,
  getVehicleName,
  onRenderAll: () => renderAll(),
  saveFirestoreRecord,
  showToast,
});
const relatoriosController = createRelatoriosController({
  state,
  databaseService,
  getBuyerName,
  getCardName,
  getEmployeeName,
  getVehicleName,
  logoPath: APP_CONFIG.logoPath,
  onRenderAll: () => renderAll(),
  showToast,
  today,
});
const viagensController = createViagensController({
  state,
  logoPath: APP_CONFIG.logoPath,
  onRenderAll: () => renderAll(),
  saveFirestoreRecord,
  showToast,
});

window.closeModal = cadastrosController.closeModal;
window.openEntityModal = cadastrosController.openEntityModal;
window.removeEntity = cadastrosController.removeEntity;
window.deleteExpense = despesasController.deleteExpense;
window.deleteReportEntry = relatoriosController.deleteReportEntry;
window.undoReportPayment = relatoriosController.undoReportPayment;
window.markPendingAsPaid = relatoriosController.markPendingAsPaid;
window.editTrip = viagensController.editTrip;
window.previewTrip = viagensController.previewTrip;

function applyLogo() {
  ["#loginLogoDesktop", "#loginLogoMobile", "#headerLogo", "#reportLogo"].forEach(
    (selector) => {
      const element = $(selector);
      if (element) {
        element.src = APP_CONFIG.logoPath;
        element.alt = "Garcia Turismo";
      }
    },
  );
}

function load() {
  state.data = seedData();
}

async function loadCloudDataIfAvailable() {
  if (!databaseService.isCloudEnabled()) return;
  try {
    const remoteData = await databaseService.loadRemote();
    if (remoteData) {
      state.data = { ...seedData(), ...remoteData };
      renderAll();
      showToast("Dados carregados do Firebase.", "success");
    }
  } catch (error) {
    console.error("Erro ao carregar dados do Firebase:", error);
    showToast("Não foi possível carregar os dados do Firebase.", "error");
  }
}

function setSession(value) {
  authService.setSession(value);
}

function hasSession() {
  return authService.hasSession();
}

function renderAll() {
  cadastrosController.renderSelectOptions();
  dashboardController.renderKPIs();
  dashboardController.renderCharts();
  cadastrosController.renderCadastros();
  abastecimentosController.renderFuelHistory();
  viagensController.renderTripsCalendar();
  viagensController.renderTripDaySummary();
  viagensController.renderTripsTable();
  despesasController.renderExpenseTable();
  relatoriosController.renderPending();
  relatoriosController.renderReport();
  viagensController.renderTripPreview();
}

function bindTabs() {
  $$(".nav-chip[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentTab = button.dataset.tab;
      $$(".nav-chip[data-tab]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
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

async function validateCloudSession() {
  if (!databaseService.isCloudEnabled()) {
    setSession(false);
    return false;
  }
  try {
    const session = await authService.getSession();
    const isValid = Boolean(session?.user);
    setSession(isValid);
    return isValid;
  } catch (error) {
    console.warn("Sessão do Firebase inválida ou expirada:", error);
    setSession(false);
    return false;
  }
}

function bindDynamicActions() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, entityType, rowType, id } = button.dataset;
    if (action === "close-modal") window.closeModal();
    if (action === "open-entity") window.openEntityModal(entityType, id);
    if (action === "remove-entity") window.removeEntity(entityType, id);
    if (action === "delete-expense") window.deleteExpense(id);
    if (action === "delete-report-entry") window.deleteReportEntry(rowType, id);
    if (action === "undo-report-payment") window.undoReportPayment(rowType, id);
    if (action === "mark-pending-paid") window.markPendingAsPaid(rowType, id);
    if (action === "edit-trip") window.editTrip(id);
    if (action === "preview-trip") window.previewTrip(id);
  });
}

function bindLogin() {
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = $("#loginUser").value.trim();
    const pass = $("#loginPass").value.trim();
    try {
      const result = await authService.signIn(user, pass);
      if (result.mode === "firebase") await loadCloudDataIfAvailable();
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
      await authService.signOut();
    } catch (error) {
      console.error("Erro ao sair:", error);
    } finally {
      databaseService.clearLocal();
      state.data = seedData();
      setSession(false);
      switchScreens();
    }
  });
}

function bindAuthState() {
  if (!authService.isCloudEnabled()) return;
  authService.observeAuthState((session) => {
    if (session?.error) {
      console.warn("Perfil Firebase inválido:", session.error);
      authService.signOut().catch(() => undefined);
      setSession(false);
      state.data = seedData();
      switchScreens();
      return;
    }
    if (!session) {
      setSession(false);
      state.data = seedData();
      switchScreens();
      return;
    }
    setSession(true);
  }).catch((error) => console.warn("Falha ao observar a sessão Firebase:", error));
}

function initDefaults() {
  $("#expenseDate").value = today();
  $("#reportMonth").value = monthNow();
  $("#expenseInstallments").value = "1";
  $("#fuelInstallments").value = "1";
  state.ui.tripMonth = monthNow();
  state.ui.tripSelectedDate = today();
  viagensController.clearTripForm();
  abastecimentosController.calculateFuelPreview();
}

async function init() {
  applyLogo();
  load();
  const hasValidCloudSession = await validateCloudSession();
  if (!hasValidCloudSession) {
    databaseService.clearLocal();
    state.data = seedData();
  }
  switchScreens();
  bindTabs();
  bindLogin();
  bindAuthState();
  despesasController.bindExpenseForm();
  abastecimentosController.bindFuelForm();
  viagensController.bindTrips();
  relatoriosController.bindReports();
  cadastrosController.bindModalTriggers();
  bindDynamicActions();
  initDefaults();
  renderAll();
  despesasController.toggleExpenseFields();
  abastecimentosController.toggleFuelFields();
  if (hasValidCloudSession) await loadCloudDataIfAvailable();
}

export async function bootstrap() {
  await withErrorHandling(init, (error) => {
    console.error("Erro ao iniciar sistema:", error);
    alert("Erro ao iniciar o sistema. Verifique o console.");
  })();
  const reportHeader = document.querySelector("#tab-relatorios .flex.flex-wrap");
  if (reportHeader && !document.querySelector("#exportBackupBtn")) {
    const button = document.createElement("button");
    button.id = "exportBackupBtn";
    button.type = "button";
    button.className = "rounded-2xl px-5 py-4 btn-secondary font-semibold no-print";
    button.textContent = "Exportar backup JSON";
    button.addEventListener("click", () => {
      backupService.exportNow(state.data);
      showToast("Backup exportado em JSON.", "success");
    });
    reportHeader.appendChild(button);
  }
}
