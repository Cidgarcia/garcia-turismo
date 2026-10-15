import { $, $$, currency, escapeHtml, formatDate, paymentLabel, today, uid } from "./controller-helpers.js";
import { buildCardSchedules, togglePaymentBlocks } from "./payment-utils.js";
import {
  calculateFuelMetrics,
  calculateTankMetrics,
  computeNewFuelLevel,
  filterVehiclesByFuelStatus,
  getFuelingDate,
  getPreviousFueling,
  sortFuelingsChronologically,
  sortVehiclesByFuel,
  summarizeFuelings,
} from "../utils/fueling-utils.js";

export function createAbastecimentosController({
  state,
  getVehicleName,
  onRenderAll,
  saveFirestoreRecord,
  showToast,
}) {
  let currentFuelFilter = "todos";
  let currentFuelSort = "fuel-asc";
  function renderFuelHistory() {
    const list = sortFuelingsChronologically(state.data.fuelings).reverse().slice(0, 6);
    $("#fuelHistory").innerHTML =
      list.map((item) => `
        <div class="rounded-2xl border border-slate-200 bg-white/70 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold">${escapeHtml(getVehicleName(item.veiculoId || item.vehicleId))}</div>
              <div class="text-sm muted mt-1">${formatDate(getFuelingDate(item))} • ${Number(item.litros || 0)} L • ${currency(item.valorTotal)}</div>
              <div class="text-sm muted mt-1">${escapeHtml(paymentLabel(item.paymentMethod))}${item.paymentMethod === "cartao_credito" ? ` • ${Number(item.installments || 1)}x` : ""}</div>
            </div>
            <div class="text-right text-sm">
              <div class="font-semibold">${Number(item.mediaKmLitro || 0).toFixed(2)} km/l</div>
              <div class="muted">${Number(item.distanciaPercorrida || 0)} km</div>
              <button type="button" class="mt-3 rounded-xl px-3 py-2 btn-secondary font-semibold" data-fuel-action="edit" data-id="${escapeHtml(item.id)}">Editar</button>
            </div>
          </div>
        </div>`).join("") || '<div class="muted text-sm">Sem abastecimentos ainda.</div>';
  }

  function generateTankSvg({ vehicleId, fuelLevel, tankCapacity, percent, isReserve, vehicleName }) {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const totalHeight = 118;
    const liquidHeight = (clampedPercent / 100) * totalHeight;
    const liquidY = 130 - liquidHeight;
    const ariaLabel = `Tanque de combustível do veículo ${vehicleName}: ${fuelLevel.toFixed(0)} L de ${tankCapacity} L (${percent.toFixed(0)}%)${isReserve ? " - Alerta de reserva" : ""}`;
    const clipId = `tank-clip-${escapeHtml(String(vehicleId))}`;

    return `
      <div class="tank-svg-container">
        <svg class="tank-svg" viewBox="0 0 100 140" role="img" aria-label="${escapeHtml(ariaLabel)}">
          <defs>
            <clipPath id="${clipId}">
              <rect x="17" y="12" width="66" height="118" rx="10" />
            </clipPath>
          </defs>
          <!-- Bocal superior do tanque -->
          <rect x="42" y="4" width="16" height="8" rx="2" fill="#94a3b8" />
          <rect x="40" y="2" width="20" height="3" rx="1.5" fill="#64748b" />
          <!-- Corpo externo do tanque -->
          <rect x="15" y="10" width="70" height="122" rx="12" fill="#f8fafc" stroke="#94a3b8" stroke-width="2.5" />
          <!-- Conteúdo interno com cantos arredondados -->
          <g clip-path="url(#${clipId})">
            <!-- Fundo vazio do tanque -->
            <rect x="17" y="12" width="66" height="118" fill="#f1f5f9" />
            <!-- Líquido amarelo (#F5B301) preenchendo conforme o nível -->
            <rect class="tank-liquid-rect" x="17" y="${liquidY.toFixed(1)}" width="66" height="${liquidHeight.toFixed(1)}" fill="#f5b301" />
            ${clampedPercent > 0 && clampedPercent < 100 ? `
              <!-- Leve ondulação na superfície do líquido -->
              <path class="tank-liquid-wave" d="M 17 ${liquidY.toFixed(1)} Q 33.5 ${(liquidY - 2.5).toFixed(1)} 50 ${liquidY.toFixed(1)} T 83 ${liquidY.toFixed(1)} L 83 ${(liquidY + 6).toFixed(1)} L 17 ${(liquidY + 6).toFixed(1)} Z" fill="#e09f00" opacity="0.85" />
            ` : ""}
            <!-- Brilho no vidro esquerdo -->
            <rect x="21" y="16" width="6" height="110" rx="3" fill="#ffffff" opacity="0.28" pointer-events="none" />
            <!-- Marcações de nível (3/4, 1/2, 1/4) -->
            <line x1="68" y1="41.5" x2="83" y2="41.5" stroke="#94a3b8" stroke-width="1.5" />
            <text x="65" y="44" font-size="7" font-weight="700" text-anchor="end" fill="#64748b">3/4</text>
            <line x1="66" y1="71" x2="83" y2="71" stroke="#94a3b8" stroke-width="2" />
            <text x="63" y="73.5" font-size="7.5" font-weight="700" text-anchor="end" fill="#475569">1/2</text>
            <line x1="68" y1="100.5" x2="83" y2="100.5" stroke="#94a3b8" stroke-width="1.5" />
            <text x="65" y="103" font-size="7" font-weight="700" text-anchor="end" fill="#64748b">1/4</text>
            <!-- Marca de reserva (< 15%) -->
            <line x1="17" y1="112.3" x2="83" y2="112.3" stroke="#d97706" stroke-width="1.2" stroke-dasharray="2,2" opacity="0.9" />
            <text x="22" y="110" font-size="7" font-weight="bold" fill="#d97706">R</text>
          </g>
        </svg>
      </div>
    `;
  }

  function renderFuelTanks() {
    const grid = $("#fuelTanksGrid");
    if (!grid) return;

    const vehicles = state.data.vehicles || [];
    const totalVehicles = vehicles.length;
    const availableVehicles = vehicles.filter(
      (v) => (v.statusOperacional || "disponivel") === "disponivel",
    ).length;
    const reserveVehicles = vehicles.filter((v) => {
      const metrics = calculateTankMetrics({
        fuelLevelL: v.fuelLevelL,
        tankCapacityL: v.tankCapacityL,
      });
      return metrics.isReserve;
    }).length;
    const unavailableVehicles = totalVehicles - availableVehicles;

    if ($("#fuelSummaryTotal")) $("#fuelSummaryTotal").textContent = String(totalVehicles);
    if ($("#fuelSummaryAvailable")) $("#fuelSummaryAvailable").textContent = String(availableVehicles);
    if ($("#fuelSummaryReserve")) $("#fuelSummaryReserve").textContent = String(reserveVehicles);

    if ($("#countFilterTodos")) $("#countFilterTodos").textContent = String(totalVehicles);
    if ($("#countFilterDisponiveis")) $("#countFilterDisponiveis").textContent = String(availableVehicles);
    if ($("#countFilterIndisponiveis")) $("#countFilterIndisponiveis").textContent = String(unavailableVehicles);
    if ($("#countFilterReserva")) $("#countFilterReserva").textContent = String(reserveVehicles);

    const filtered = filterVehiclesByFuelStatus(vehicles, currentFuelFilter);
    const sorted = sortVehiclesByFuel(filtered, currentFuelSort);

    if (!sorted.length) {
      grid.innerHTML = `
        <div class="tank-empty-state col-span-full py-10">
          <svg class="w-10 h-10 text-slate-300 mb-2 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p class="font-semibold text-slate-700">Nenhum veículo encontrado para este filtro.</p>
          <p class="muted text-sm mt-1">Selecione outro filtro ou cadastre novos veículos.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = sorted.map((vehicle) => {
      const vehicleName = getVehicleName(vehicle.id);
      const tank = calculateTankMetrics({
        fuelLevelL: vehicle.fuelLevelL,
        tankCapacityL: vehicle.tankCapacityL,
      });
      const status = vehicle.statusOperacional || "disponivel";

      let statusBadge = "";
      if (status === "disponivel") {
        statusBadge = '<span class="vehicle-status-badge vehicle-status--available">Disponível</span>';
      } else if (status === "em_viagem") {
        statusBadge = '<span class="vehicle-status-badge vehicle-status--trip">Em viagem</span>';
      } else if (status === "manutencao") {
        statusBadge = '<span class="vehicle-status-badge vehicle-status--maintenance">Manutenção</span>';
      } else {
        statusBadge = '<span class="vehicle-status-badge vehicle-status--unavailable">Indisponível</span>';
      }

      const vehicleFuelings = state.data.fuelings.filter(
        (f) => (f.veiculoId || f.vehicleId) === vehicle.id,
      );
      const lastFueling = sortFuelingsChronologically(vehicleFuelings).at(-1);
      const summary = summarizeFuelings(vehicleFuelings);

      const lastFuelingText = lastFueling
        ? `${formatDate(getFuelingDate(lastFueling))} (${Number(lastFueling.litros || 0)} L)`
        : "Nenhum registro";

      const avgConsumptionText = summary.averageConsumption > 0
        ? `${summary.averageConsumption.toFixed(2)} km/l`
        : "Em cálculo";

      return `
        <div class="fuel-vehicle-card ${tank.isReserve ? "is-reserve" : ""}" data-vehicle-id="${escapeHtml(vehicle.id)}">
          <!-- Topo do card: Nome do veículo e Selo de status -->
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="font-bold text-base text-slate-900 leading-tight">${escapeHtml(vehicleName)}</div>
              <div class="text-xs muted mt-0.5">${escapeHtml(vehicle.placa || "")}${vehicle.tipo ? ` • ${escapeHtml(vehicle.tipo.toUpperCase())}` : ""}</div>
            </div>
            <div class="flex-shrink-0">
              ${statusBadge}
            </div>
          </div>

          <!-- Centro: Visual do Tanque ou Estado Vazio -->
          <div class="tank-visual-wrap">
            ${tank.hasCapacity ? `
              ${generateTankSvg({
                vehicleId: vehicle.id,
                fuelLevel: tank.level,
                tankCapacity: tank.capacity,
                percent: tank.percent,
                isReserve: tank.isReserve,
                vehicleName,
              })}
              <div class="flex-1 space-y-1.5">
                <div class="flex items-center gap-2">
                  <span class="text-2xl font-bold text-slate-800">${tank.percent.toFixed(0)}%</span>
                  ${tank.isReserve ? `
                    <span class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded-md px-2 py-0.5">
                      Reserva
                    </span>
                  ` : ""}
                </div>
                <div class="text-sm font-semibold text-slate-700">
                  ${tank.level.toFixed(0)} L <span class="text-xs muted font-normal">de ${tank.capacity} L</span>
                </div>
                <span class="text-[11px] muted italic block">Estimativa baseada nos registros</span>
              </div>
            ` : `
              <div class="tank-empty-state w-full">
                <svg class="w-8 h-8 text-slate-400 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span class="text-xs font-semibold text-slate-700">Capacidade do tanque não informada</span>
                <span class="text-[11px] muted mt-0.5">Cadastre a capacidade para ativar o tanque visual.</span>
                <button type="button" class="btn-secondary rounded-lg px-2.5 py-1 text-xs font-semibold mt-2.5" data-action="open-entity" data-entity-type="Vehicle" data-id="${escapeHtml(vehicle.id)}">
                  Editar veículo
                </button>
              </div>
            `}
          </div>

          <!-- Dados complementares: Último abastecimento, consumo médio e odômetro -->
          <div class="space-y-1.5 text-xs text-slate-600 bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 mb-3">
            <div class="flex justify-between items-center">
              <span class="muted">Último abastec.:</span>
              <span class="font-medium text-slate-800">${escapeHtml(lastFuelingText)}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="muted">Consumo médio:</span>
              <span class="font-medium text-slate-800">${escapeHtml(avgConsumptionText)}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="muted">Odômetro:</span>
              <span class="font-medium text-slate-800">${Number(vehicle.kmAtual || 0).toLocaleString("pt-BR")} km</span>
            </div>
          </div>

          <!-- Rodapé do card: Seletor de status rápido e Botão abastecer -->
          <div class="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
            <div class="flex items-center gap-1.5">
              <label class="text-xs muted font-medium">Status:</label>
              <select class="quick-status-select" data-vehicle-action="change-status" data-id="${escapeHtml(vehicle.id)}">
                <option value="disponivel" ${status === "disponivel" ? "selected" : ""}>Disponível</option>
                <option value="em_viagem" ${status === "em_viagem" ? "selected" : ""}>Em viagem</option>
                <option value="manutencao" ${status === "manutencao" ? "selected" : ""}>Manutenção</option>
              </select>
            </div>

            <button type="button" class="btn-secondary rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1" data-vehicle-action="quick-fuel" data-id="${escapeHtml(vehicle.id)}">
              ⛽ Abastecer
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  async function handleQuickStatusChange(vehicleId, newStatus) {
    const vehicle = state.data.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;

    const statusLabels = {
      disponivel: "Disponível",
      em_viagem: "Em viagem",
      manutencao: "Manutenção",
    };

    try {
      await saveFirestoreRecord("Vehicle", "vehicles", {
        ...vehicle,
        statusOperacional: newStatus,
      });
      onRenderAll();
      showToast(`Status de ${getVehicleName(vehicleId)} alterado para ${statusLabels[newStatus] || newStatus}.`, "success");
    } catch (error) {
      console.error("Erro ao atualizar status do veículo:", error);
      showToast(error.message || "Não foi possível atualizar o status do veículo.", "error");
    }
  }

  function handleQuickFuel(vehicleId) {
    const vehicleSelect = $("#fuelVehicle");
    if (vehicleSelect) {
      vehicleSelect.value = vehicleId;
      syncFuelLastKm();
      calculateFuelPreview();
      const litersInput = $("#fuelLiters");
      if (litersInput) litersInput.focus();
      const form = $("#fuelForm");
      if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function bindFuelTanks() {
    $$(".fuel-filter-btn[data-fuel-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        currentFuelFilter = button.dataset.fuelFilter;
        $$(".fuel-filter-btn[data-fuel-filter]").forEach((b) => b.classList.remove("active"));
        button.classList.add("active");
        renderFuelTanks();
      });
    });

    const sortSelect = $("#fuelSortOrder");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        currentFuelSort = e.target.value;
        renderFuelTanks();
      });
    }

    const grid = $("#fuelTanksGrid");
    if (grid) {
      grid.addEventListener("change", (event) => {
        const select = event.target.closest("select[data-vehicle-action='change-status']");
        if (select) {
          handleQuickStatusChange(select.dataset.id, select.value);
        }
      });

      grid.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-vehicle-action='quick-fuel']");
        if (button) {
          handleQuickFuel(button.dataset.id);
        }
      });
    }
  }

  function toggleFuelFields() {
    togglePaymentBlocks("fuel");
  }

  function setFuelFormMode(isEditing) {
    $("#fuelSubmitLabel").textContent = isEditing ? "Salvar alterações" : "Salvar abastecimento";
    $("#cancelFuelEditBtn").classList.toggle("hidden-section", !isEditing);
  }

  function setLastKm(value, { readOnly = false, hint = "" } = {}) {
    $("#fuelLastKm").value = value === "" || value === null || value === undefined ? "" : Number(value);
    $("#fuelLastKm").readOnly = readOnly;
    $("#fuelLastKm").classList.toggle("bg-slate-100", readOnly);
    $("#fuelLastKmHint").textContent = hint;
  }

  function syncFuelLastKm({ fallbackLastKm } = {}) {
    const vehicleId = $("#fuelVehicle").value;
    const fuelingDate = $("#fuelDate").value;
    const currentId = $("#fuelRecordId").value;

    if (!vehicleId || !fuelingDate) {
      setLastKm("", { hint: "Selecione a data e o veículo para calcular." });
      return;
    }

    const previousFueling = getPreviousFueling({
      fuelings: state.data.fuelings,
      vehicleId,
      fuelingDate,
      currentId,
      createdAt: state.data.fuelings.find((item) => item.id === currentId)?.createdAt || Date.now(),
    });
    if (previousFueling) {
      setLastKm(previousFueling.kmAtual, {
        readOnly: true,
        hint: `Baseado no abastecimento de ${formatDate(getFuelingDate(previousFueling))}.`,
      });
      return;
    }

    const otherFuelings = state.data.fuelings.filter(
      (item) => (item.veiculoId || item.vehicleId) === vehicleId && item.id !== currentId,
    );
    if (!otherFuelings.length) {
      const vehicle = state.data.vehicles.find((item) => item.id === vehicleId);
      setLastKm(vehicle ? Number(vehicle.kmAtual || 0) : 0, {
        readOnly: true,
        hint: "Baseado no KM atual do veículo.",
      });
      return;
    }

    setLastKm(fallbackLastKm ?? "", {
      hint: "Não há abastecimento anterior para esta data. Informe o KM anterior.",
    });
  }

  function clearFuelForm() {
    $("#fuelForm").reset();
    $("#fuelRecordId").value = "";
    $("#fuelDate").value = today();
    $("#fuelInstallments").value = "1";
    if ($("#fuelFullTank")) $("#fuelFullTank").checked = false;
    setFuelFormMode(false);
    syncFuelLastKm();
    calculateFuelPreview();
    toggleFuelFields();
  }

  function calculateFuelPreview() {
    const metrics = calculateFuelMetrics({
      lastKm: $("#fuelLastKm").value,
      currentKm: $("#fuelCurrentKm").value,
      liters: $("#fuelLiters").value,
      total: $("#fuelTotal").value,
    });

    $("#previewDistance").textContent = `${metrics.distance.toFixed(0)} km`;
    $("#previewAverage").textContent = `${metrics.average.toFixed(2)} km/l`;
    $("#previewPricePerLiter").textContent = currency(metrics.pricePerLiter);

    if (metrics.currentKm && metrics.lastKm && !metrics.validKm) {
      $("#fuelLastKmHint").textContent = "O KM atual precisa ser maior que o último KM.";
    }

    return metrics;
  }

  function startFuelEdit(id) {
    const item = state.data.fuelings.find((fueling) => fueling.id === id);
    if (!item) {
      showToast("Abastecimento não encontrado.", "error");
      return;
    }

    $("#fuelRecordId").value = item.id;
    $("#fuelDate").value = getFuelingDate(item);
    $("#fuelVehicle").value = item.veiculoId || item.vehicleId || "";
    $("#fuelCurrentKm").value = Number(item.kmAtual || 0);
    $("#fuelLiters").value = Number(item.litros || 0);
    $("#fuelTotal").value = Number(item.valorTotal || 0);
    if ($("#fuelFullTank")) $("#fuelFullTank").checked = false;
    $("#fuelPayment").value = item.paymentMethod || "";
    $("#fuelStatus").value = item.status || "pago";
    $("#fuelCard").value = item.cardId || "";
    $("#fuelBuyer").value = item.buyerId || "";
    $("#fuelInstallments").value = String(item.installments || 1);
    $("#fuelChequeDate").value = item.paymentDetails?.dataCompensacao || "";
    $("#fuelChequeBank").value = item.paymentDetails?.banco || "";
    setFuelFormMode(true);
    toggleFuelFields();
    syncFuelLastKm({ fallbackLastKm: item.ultimoKm });
    calculateFuelPreview();
    $("#fuelDate").focus();
  }

  function vehicleKmAfterFueling(vehicle, payload) {
    const knownKms = state.data.fuelings
      .filter((item) => (item.veiculoId || item.vehicleId) === payload.veiculoId && item.id !== payload.id)
      .map((item) => Number(item.kmAtual || 0));

    return Math.max(Number(vehicle.kmAtual || 0), Number(payload.kmAtual || 0), ...knownKms);
  }

  function bindFuelForm() {
    $("#fuelVehicle").addEventListener("change", () => {
      syncFuelLastKm();
      calculateFuelPreview();
    });
    $("#fuelDate").addEventListener("change", () => {
      syncFuelLastKm();
      calculateFuelPreview();
    });
    ["#fuelLastKm", "#fuelCurrentKm", "#fuelLiters", "#fuelTotal"].forEach((selector) => {
      $(selector).addEventListener("input", calculateFuelPreview);
    });
    $("#fuelPayment").addEventListener("change", toggleFuelFields);
    $("#cancelFuelEditBtn").addEventListener("click", clearFuelForm);
    $("#fuelHistory").addEventListener("click", (event) => {
      const button = event.target.closest("[data-fuel-action='edit']");
      if (button) startFuelEdit(button.dataset.id);
    });
    $("#fuelForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const vehicleId = $("#fuelVehicle").value;
      const fuelingDate = $("#fuelDate").value;
      const recordId = $("#fuelRecordId").value;
      if (!vehicleId) {
        showToast("Selecione um veículo.", "error");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fuelingDate)) {
        showToast("Informe a data do abastecimento.", "error");
        return;
      }

      const metrics = calculateFuelPreview();
      if (!metrics.validKm) {
        showToast("KM atual deve ser maior que o último KM.", "error");
        return;
      }
      if (metrics.liters <= 0 || metrics.total <= 0) {
        showToast("Informe litros e valor total maiores que zero.", "error");
        return;
      }

      const paymentMethod = $("#fuelPayment").value;
      const status = $("#fuelStatus").value;
      const existingFueling = state.data.fuelings.find((item) => item.id === recordId);
      const linkedCardSchedules = recordId
        ? state.data.cardSchedules.filter((item) => item.sourceType === "fuel" && item.sourceId === recordId)
        : [];
      if (linkedCardSchedules.length) {
        showToast("Este abastecimento possui parcelas no cartão e não pode ser editado por aqui.", "error");
        return;
      }
      const payload = {
        id: recordId || uid(),
        ...(existingFueling?.createdAt ? { createdAt: existingFueling.createdAt } : {}),
        fuelingDate,
        data: fuelingDate,
        veiculoId: vehicleId,
        vehicleId,
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
        payload.paymentDetails = { tipo: paymentMethod, instantaneo: true, vencimento: fuelingDate };
      }
      if (paymentMethod === "cheque") {
        const dataCompensacao = $("#fuelChequeDate").value;
        const banco = $("#fuelChequeBank").value.trim();
        if (!dataCompensacao || !banco) {
          showToast("Cheque exige banco e data de compensação.", "error");
          return;
        }
        payload.paymentDetails = { tipo: "cheque", dataCompensacao, banco, vencimento: dataCompensacao };
      }

      let schedules = [];
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
        payload.paymentDetails = { tipo: "cartao_credito", parcelas: installments };
        if (!recordId) {
          schedules = buildCardSchedules({
            cards: state.data.cards,
            uid,
            sourceType: "fuel",
            sourceId: payload.id,
            description: `Abastecimento ${getVehicleName(vehicleId)}`,
            cardId,
            buyerId,
            baseDate: fuelingDate,
            totalValue: payload.valorTotal,
            parcelas: installments,
            firstStatus: status,
            vehicleId,
            category: "combustivel",
            extra: `${payload.litros}L`,
          });
        }
      }

      const vehicle = state.data.vehicles.find((item) => item.id === vehicleId);
      const isFullTank = $("#fuelFullTank") ? $("#fuelFullTank").checked : false;
      const newFuelLevel = vehicle
        ? computeNewFuelLevel({
            vehicle,
            litersAdded: metrics.liters,
            isFullTank,
          })
        : 0;

      try {
        await saveFirestoreRecord("Fueling", "fuelings", payload, { prepend: true });
        for (const schedule of schedules) {
          await saveFirestoreRecord("CardSchedule", "cardSchedules", schedule, { prepend: true });
        }
        if (vehicle) {
          await saveFirestoreRecord("Vehicle", "vehicles", {
            ...vehicle,
            kmAtual: vehicleKmAfterFueling(vehicle, payload),
            fuelLevelL: newFuelLevel,
          });
        }
        onRenderAll();
        clearFuelForm();
        showToast(recordId ? "Abastecimento atualizado com sucesso." : "Abastecimento salvo com sucesso.", "success");
      } catch (error) {
        console.error("Erro ao salvar abastecimento:", error);
        showToast(error.message || "Não foi possível salvar o abastecimento.", "error");
      }
    });
  }

  return {
    bindFuelForm,
    bindFuelTanks,
    calculateFuelPreview,
    clearFuelForm,
    renderFuelHistory,
    renderFuelTanks,
    startFuelEdit,
    toggleFuelFields,
  };
}
