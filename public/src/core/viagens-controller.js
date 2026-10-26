import {
  $,
  $$,
  currency,
  escapeHtml,
  formatDate,
  getVehicleDisplayName,
  slugify,
  today,
  uid,
} from "./controller-helpers.js";
import {
  addMonthsToMonthString,
  computeDurationDays,
  formatMonthLabel,
} from "./trip-date-utils.js";
import {
  addDaysISO,
  calculateOrcamento,
  evaluateOrcamentoValidity,
  formatDateBR,
} from "../utils/orcamento-calculator.js";

const CONFIRMED_STATUSES = new Set(["Confirmada", "Aprovado", "Aprovada", "Realizada"]);
const CANCELLED_STATUSES = new Set(["Cancelada"]);
const INACTIVE_PROPOSAL_STATUSES = new Set(["Cancelada", "Recusado", "Expirado"]);

export function generateUniqueOrcamentoNum(existingTrips = [], dateStr = today()) {
  const cleanDate = String(dateStr || today()).replace(/-/g, "");
  const yearPrefix = cleanDate.slice(0, 4) || String(new Date().getFullYear());
  let maxSeq = 0;

  (existingTrips || []).forEach((trip) => {
    const rawNum = String(trip?.orcamentoNum || "");
    const match = rawNum.match(/GT-\d{8}-(\d+)/i) || rawNum.match(/(\d{3,})/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed < 100000 && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(3, "0");
  const uniqueSuffix = Math.random().toString(36).substring(2, 4).toUpperCase();
  const candidate = `GT-${cleanDate}-${nextSeq}${uniqueSuffix}`;

  const exists = (existingTrips || []).some((t) => t?.orcamentoNum === candidate);
  if (exists) {
    return `GT-${cleanDate}-${nextSeq}${uid().slice(-3).toUpperCase()}`;
  }
  return candidate;
}

export function checkVehicleScheduleConflicts({
  trips = [],
  vehicles = [],
  selectedVehicleIds = [],
  departureDate = "",
  returnDate = "",
  departureTime = "",
  returnTime = "",
  currentTripId = "",
} = {}) {
  if (!selectedVehicleIds.length || !departureDate || !returnDate) {
    return [];
  }

  const conflicts = [];

  selectedVehicleIds.forEach((vehicleId) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const vehicleLabel = vehicle ? getVehicleDisplayName(vehicle) : vehicleId;

    if (vehicle && vehicle.statusOperacional === "manutencao") {
      conflicts.push({
        type: "manutencao",
        vehicleId,
        vehicleLabel,
        message: `${vehicleLabel} está com status "Manutenção" na Gestão da Frota.`,
      });
    }

    trips.forEach((otherTrip) => {
      if (!otherTrip || otherTrip.id === currentTripId) return;
      const otherStatus = String(otherTrip.status || "Proposta");
      if (INACTIVE_PROPOSAL_STATUSES.has(otherStatus)) return;

      const otherIds = Array.isArray(otherTrip.vehicleIds) && otherTrip.vehicleIds.length
        ? otherTrip.vehicleIds
        : otherTrip.vehicleId
          ? [otherTrip.vehicleId]
          : [];
      if (!otherIds.includes(vehicleId)) return;

      const startA = departureDate;
      const endA = returnDate;
      const startB = otherTrip.departureDate || "";
      const endB = otherTrip.returnDate || otherTrip.departureDate || "";
      if (!startB || !endB) return;

      const dateOverlap = startA <= endB && endA >= startB;
      if (!dateOverlap) return;

      // Se coincidir apenas no dia limite e ambos tiverem horários compatíveis, verifica sobreposição de horário
      if (endA === startB && returnTime && otherTrip.departureTime && returnTime < otherTrip.departureTime) {
        return;
      }
      if (startA === endB && departureTime && otherTrip.returnTime && departureTime > otherTrip.returnTime) {
        return;
      }

      const isConfirmed = CONFIRMED_STATUSES.has(otherStatus);
      conflicts.push({
        type: isConfirmed ? "confirmada" : "proposta",
        vehicleId,
        vehicleLabel,
        tripId: otherTrip.id,
        client: otherTrip.client,
        destination: otherTrip.destination,
        status: otherStatus,
        period: `${formatDate(startB)} a ${formatDate(endB)}`,
        message: `${vehicleLabel} já possui ${isConfirmed ? "viagem confirmada" : `proposta (${otherStatus})`} para ${otherTrip.destination} (${otherTrip.client}) de ${formatDate(startB)} a ${formatDate(endB)}.`,
      });
    });
  });

  return conflicts;
}

export function createViagensController({
  state,
  logoPath,
  onRenderAll,
  saveFirestoreRecord,
  removeFirestoreRecord,
  showToast,
}) {
  let tripOtherCostsState = [];
  let isSavingTrip = false;

  function getSelectedPreviewType() {
    const checked = document.querySelector('input[name="tripPreviewType"]:checked');
    return checked?.value === "interno" ? "interno" : "cliente";
  }

  function getSelectedTripVehicleIds() {
    return [...($("#tripVehicleIds")?.selectedOptions || [])].map((option) => option.value).filter(Boolean);
  }

  function getSelectedVehiclesObjects(vehicleIds = getSelectedTripVehicleIds()) {
    return vehicleIds
      .map((id) => (state.data.vehicles || []).find((v) => v.id === id))
      .filter(Boolean);
  }

  function buildVehicleConfigsForCalculation(selectedIds = getSelectedTripVehicleIds(), fallbackConsumption = 0, fallbackCapacity = 46) {
    const selectedVehicles = getSelectedVehiclesObjects(selectedIds);
    if (selectedVehicles.length > 0) {
      return selectedVehicles.map((v) => ({
        id: v.id,
        nome: getVehicleDisplayName(v),
        modelo: v.modelo || v.nome || "Veículo",
        placa: v.placa || "",
        tipo: v.tipo || "onibus",
        layout: v.layout || "onibus_46",
        capacidade: Number(v.capacidade || v.lugares || 46),
        consumoKmPorLitro: Number(v.consumoKmPorLitro || v.averageConsumption || fallbackConsumption || 0),
      }));
    }

    const qty = Math.max(1, Number($("#tripVehiclesQty")?.value || 1));
    const perVehicleCap = qty > 0 && fallbackCapacity > 0 ? Math.round(fallbackCapacity / qty) : 46;
    return Array.from({ length: qty }, (_, index) => ({
      id: `avulso-${index + 1}`,
      nome: `Veículo ${index + 1}`,
      modelo: `Veículo ${index + 1}`,
      placa: "",
      tipo: "onibus",
      layout: "onibus_46",
      capacidade: perVehicleCap,
      consumoKmPorLitro: Number(fallbackConsumption || 0),
    }));
  }

  function renderTripOtherCostsRows() {
    const container = $("#tripOtherCostsContainer");
    if (!container) return;

    if (tripOtherCostsState.length === 0) {
      container.innerHTML = `<p class="text-xs muted italic">Nenhuma despesa extra adicionada.</p>`;
      return;
    }

    container.innerHTML = tripOtherCostsState
      .map(
        (item, index) => `
        <div class="flex items-center gap-2 p-2 rounded-xl bg-slate-100 border border-slate-200" data-custo-index="${index}">
          <input
            type="text"
            class="field text-xs py-1 px-2 flex-1 trip-other-cost-name"
            placeholder="Descrição (ex.: Guia, Balsa)"
            value="${escapeHtml(item.nome || "")}"
            data-index="${index}"
          />
          <div class="relative w-28">
            <span class="absolute left-2 top-1 text-xs text-slate-400">R$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              class="field text-xs py-1 pl-7 pr-2 w-full text-right font-medium trip-other-cost-value"
              placeholder="0,00"
              value="${item.valor ?? ""}"
              data-index="${index}"
            />
          </div>
          <button
            type="button"
            class="p-1 rounded-lg text-red-500 hover:bg-red-100 font-bold text-sm leading-none trip-remove-other-cost"
            data-index="${index}"
            title="Remover despesa"
          >×</button>
        </div>
      `,
      )
      .join("");

    $$(".trip-other-cost-name").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.index);
        if (tripOtherCostsState[idx]) {
          tripOtherCostsState[idx].nome = e.target.value;
          syncTripDirectCosts();
        }
      });
    });
    $$(".trip-other-cost-value").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.index);
        if (tripOtherCostsState[idx]) {
          tripOtherCostsState[idx].valor = Number(e.target.value) || 0;
          syncTripDirectCosts();
        }
      });
    });
    $$(".trip-remove-other-cost").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = Number(e.target.dataset.index);
        tripOtherCostsState.splice(idx, 1);
        renderTripOtherCostsRows();
        syncTripDirectCosts();
      });
    });
  }

  function updateManualPriceBadge() {
    const badge = $("#tripManualPriceBadge");
    if (!badge) return;
    badge.classList.toggle("hidden", !state.ui.tripManualBase);
  }

  function renderVehicleConflictBanner() {
    const banner = $("#tripVehicleConflictAlert");
    if (!banner) return;

    const conflicts = checkVehicleScheduleConflicts({
      trips: state.data.trips || [],
      vehicles: state.data.vehicles || [],
      selectedVehicleIds: getSelectedTripVehicleIds(),
      departureDate: $("#tripDepartureDate")?.value || "",
      returnDate: $("#tripReturnDate")?.value || "",
      departureTime: $("#tripDepartureTime")?.value || "",
      returnTime: $("#tripReturnTime")?.value || "",
      currentTripId: $("#tripId")?.value || "",
    });

    if (!conflicts.length) {
      banner.classList.add("hidden");
      banner.innerHTML = "";
      return;
    }

    banner.classList.remove("hidden");
    banner.innerHTML = `
      <div class="font-bold mb-1">⚠️ Atenção à disponibilidade de frota no período selecionado:</div>
      <ul class="list-disc pl-5 space-y-0.5">
        ${conflicts.map((c) => `<li>${escapeHtml(c.message)}</li>`).join("")}
      </ul>
    `;
  }

  function computeCurrentFormMetrics() {
    const totalKm = Number($("#tripTotalKm")?.value || 0);
    const emptyKm = Number($("#tripEmptyKm")?.value || 0);
    const localDisplacementKm = Number($("#tripLocalDisplacementKm")?.value || 0);
    const pricePerKm = Number($("#tripPricePerKm")?.value || 0);
    const baseValueRaw = $("#tripBaseValue")?.value ?? "";
    const discount = Number($("#tripDiscount")?.value || 0);
    const selectedIds = getSelectedTripVehicleIds();
    const vehiclesQty = Math.max(selectedIds.length || Number($("#tripVehiclesQty")?.value || 1), 1);
    const fallbackConsumption = Number($("#tripConsumption")?.value || 0);
    const totalCapacity = Number($("#tripTotalCapacity")?.value || 46);
    const passengers = Number($("#tripPassengers")?.value || 0);
    const fuelPrice = Number($("#tripFuelPrice")?.value || 0);

    const driver1Type = $("#tripDriver1Type")?.value || "viagem";
    const driver1ValueRaw = $("#tripDriver1Value")?.value ?? "";
    const driver1Days = Number($("#tripDriver1Days")?.value || 1);

    const driver2Type = $("#tripDriver2Type")?.value || "viagem";
    const driver2ValueRaw = $("#tripDriver2Value")?.value ?? "";
    const driver2Days = Number($("#tripDriver2Days")?.value || 1);

    const tollsCost = Number($("#tripTollsCost")?.value || 0);
    const parkingCost = Number($("#tripParkingCost")?.value || 0);
    const lodgingCost = Number($("#tripLodgingCost")?.value || 0);
    const driverMealsCost = Number($("#tripDriverMealsCost")?.value || 0);
    const anttCost = Number($("#tripAnttCost")?.value || 0);
    const waterCost = Number($("#tripWaterCost")?.value || 0);
    const insuranceCost = Number($("#tripInsuranceCost")?.value || 0);
    const costsConfirmedZero = $("#tripCostsConfirmedZero")?.checked === true;

    const vehicleConfigs = buildVehicleConfigsForCalculation(selectedIds, fallbackConsumption, totalCapacity);

    return calculateOrcamento({
      valorBruto: baseValueRaw !== "" ? Number(baseValueRaw) : undefined,
      desconto: discount,
      manualBaseValue: state.ui.tripManualBase && baseValueRaw !== "" ? Number(baseValueRaw) : undefined,
      isManualPrice: Boolean(state.ui.tripManualBase),
      pricePerKm,
      vehiclesQty,
      totalKm,
      emptyKm,
      localDisplacementKm,
      vehicles: vehicleConfigs,
      capacidadePassageiros: totalCapacity,
      passageirosPrevistos: passengers,
      consumptionKmPerLiter: fallbackConsumption,
      fuelPricePerLiter: fuelPrice,
      motorista1Tipo: driver1Type,
      motorista1Valor: driver1ValueRaw,
      motorista1Diarias: driver1Days,
      motorista2Tipo: driver2Type,
      motorista2Valor: driver2ValueRaw,
      motorista2Diarias: driver2Days,
      pedagios: tollsCost,
      estacionamento: parkingCost,
      hospedagem: lodgingCost,
      alimentacaoMotoristas: driverMealsCost,
      antt: anttCost,
      agua: waterCost,
      seguro: insuranceCost,
      outrosCustos: tripOtherCostsState,
      costsConfirmedZero,
      requireCompleteCosts: true,
    });
  }

  function computeTripRecordMetrics(trip = {}) {
    const selectedIds = Array.isArray(trip.vehicleIds) ? trip.vehicleIds.filter(Boolean) : [];
    const vehiclesFromState = getSelectedVehiclesObjects(selectedIds);
    const vehicleConfigs =
      Array.isArray(trip.vehicleConfigs) && trip.vehicleConfigs.length > 0
        ? trip.vehicleConfigs
        : vehiclesFromState.length > 0
          ? vehiclesFromState.map((v) => ({
              id: v.id,
              nome: getVehicleDisplayName(v),
              capacidade: Number(v.capacidade || v.lugares || 46),
              consumoKmPorLitro: Number(v.consumoKmPorLitro || trip.consumptionKmPerLiter || 0),
            }))
          : Array.from({ length: Math.max(1, Number(trip.vehiclesQty || 1)) }, (_, idx) => ({
              id: `v-${idx + 1}`,
              nome: `Veículo ${idx + 1}`,
              capacidade: Number(trip.totalCapacity || trip.passengers || 46),
              consumoKmPorLitro: Number(trip.consumptionKmPerLiter || 0),
            }));

    const hasExplicitDriver1 =
      trip.driver1Value !== undefined && trip.driver1Value !== null && trip.driver1Value !== "";
    const costsConfirmedZero =
      trip.costsConfirmedZero !== undefined ? Boolean(trip.costsConfirmedZero) : hasExplicitDriver1;

    return calculateOrcamento({
      valorBruto: trip.baseValue !== undefined ? Number(trip.baseValue) : undefined,
      desconto: Number(trip.discount || 0),
      valorCobrado: Number(trip.finalValue || 0),
      manualBaseValue: trip.manualBaseValue,
      isManualPrice: Boolean(trip.manualBaseValue !== undefined && trip.manualBaseValue !== null),
      pricePerKm: Number(trip.pricePerKm || 0),
      vehiclesQty: Math.max(1, Number(trip.vehiclesQty || 1)),
      totalKm: Number(trip.totalKm || 0),
      emptyKm: Number(trip.emptyKm || 0),
      localDisplacementKm: Number(trip.localDisplacementKm || 0),
      vehicles: vehicleConfigs,
      capacidadePassageiros: Number(trip.totalCapacity || trip.passengers || 0),
      passageirosPrevistos: Number(trip.passengers || 0),
      consumptionKmPerLiter: Number(trip.consumptionKmPerLiter || 0),
      fuelPricePerLiter: Number(trip.fuelPrice ?? 6.2),
      motorista1Tipo: trip.driver1Type || "viagem",
      motorista1Valor: hasExplicitDriver1 ? trip.driver1Value : "",
      motorista1Diarias: Number(trip.driver1Days ?? trip.durationDays ?? 1),
      motorista2Tipo: trip.driver2Type || "viagem",
      motorista2Valor: trip.driver2Value ?? 0,
      motorista2Diarias: Number(trip.driver2Days ?? trip.durationDays ?? 1),
      pedagios: Number(trip.tollsCost || 0),
      estacionamento: Number(trip.parkingCost || 0),
      hospedagem: Number(trip.lodgingCost || 0),
      alimentacaoMotoristas: Number(trip.driverMealsCost || 0),
      antt: Number(trip.anttCost || 0),
      agua: Number(trip.waterCost || 0),
      seguro: Number(trip.insuranceCost || 0),
      outrosCustos: trip.otherCosts || [],
      costsConfirmedZero,
      requireCompleteCosts: true,
    });
  }

  function syncTripDirectCosts() {
    const metrics = computeCurrentFormMetrics();
    const { custosDetalhados } = metrics;

    if ($("#tripOperationalKmPerVehicleLabel")) {
      $("#tripOperationalKmPerVehicleLabel").textContent = `${metrics.operationalKmPerVehicle.toLocaleString("pt-BR")} km`;
    }
    if ($("#tripTotalOperationalKmLabel")) {
      $("#tripTotalOperationalKmLabel").textContent = `${metrics.totalOperationalKm.toLocaleString("pt-BR")} km`;
    }
    if ($("#tripAutoBaseValueLabel")) {
      $("#tripAutoBaseValueLabel").textContent = currency(metrics.valorAutomatico);
    }

    if ($("#tripFuelLitersLabel")) {
      $("#tripFuelLitersLabel").textContent = metrics.litrosCombustivel.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    if ($("#tripFuelCostLabel")) {
      $("#tripFuelCostLabel").textContent = currency(custosDetalhados.combustivelCents / 100);
    }
    if ($("#tripFuelPerVehicleBreakdown")) {
      const breakdowns = metrics.vehicleFuelBreakdowns || [];
      if (breakdowns.length > 1) {
        $("#tripFuelPerVehicleBreakdown").innerHTML = breakdowns
          .map((b) =>
            b.validConsumption
              ? `${escapeHtml(b.nome)}: ${b.liters.toFixed(2)} L (${currency(b.fuelCostCents / 100)})`
              : `<span class="text-red-600 font-semibold">${escapeHtml(b.nome)}: consumo ausente</span>`,
          )
          .join(" • ");
      } else if (breakdowns.length === 1 && !breakdowns[0].validConsumption && metrics.operationalKmPerVehicle > 0) {
        $("#tripFuelPerVehicleBreakdown").innerHTML = `<span class="text-red-600 font-semibold">Informe um consumo válido (km/L).</span>`;
      } else {
        $("#tripFuelPerVehicleBreakdown").innerHTML = "";
      }
    }

    if ($("#tripDriver1CostLabel")) {
      $("#tripDriver1CostLabel").textContent = currency(custosDetalhados.motorista1Cents / 100);
    }
    if ($("#tripDriver2CostLabel")) {
      $("#tripDriver2CostLabel").textContent = currency(custosDetalhados.motorista2Cents / 100);
    }
    if ($("#tripTotalDirectCostsLabel")) {
      $("#tripTotalDirectCostsLabel").textContent = currency(metrics.custoTotal);
    }

    syncTripProfitability(metrics);
    return metrics.custoTotal;
  }

  function syncTripProfitability(precomputedMetrics) {
    const metrics = precomputedMetrics || computeCurrentFormMetrics();
    const statusObj = metrics.fairPrice;

    const pendingAlert = $("#tripPendingItemsAlert");
    if (pendingAlert) {
      if (metrics.custosIncompletos) {
        pendingAlert.classList.remove("hidden");
        pendingAlert.innerHTML = `
          <div class="font-bold mb-1">Custos incompletos — preencha os itens abaixo para consolidar lucro e margem:</div>
          <ul class="list-disc pl-5 space-y-0.5">
            ${metrics.pendingItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        `;
      } else {
        pendingAlert.classList.add("hidden");
        pendingAlert.innerHTML = "";
      }
    }

    if ($("#tripMargemAtualLabel")) {
      $("#tripMargemAtualLabel").textContent = metrics.custosIncompletos
        ? "Custos incompletos"
        : `${metrics.margemPercent.toFixed(1).replace(".", ",")}%`;
    }
    if ($("#tripLucroEstimadoLabel")) {
      $("#tripLucroEstimadoLabel").textContent = metrics.custosIncompletos
        ? "Custos incompletos"
        : currency(metrics.lucro);
    }
    if ($("#tripPrecoSugeridoLabel")) {
      $("#tripPrecoSugeridoLabel").textContent = metrics.custosIncompletos
        ? "Aguardando custos"
        : currency(metrics.precoSugeridoMeta);
    }

    if ($("#tripCustoPorKmLabel")) {
      $("#tripCustoPorKmLabel").textContent = metrics.custosIncompletos
        ? "Incompleto"
        : currency(metrics.custoPorKm);
    }
    if ($("#tripReceitaPorKmLabel")) {
      $("#tripReceitaPorKmLabel").textContent = currency(metrics.receitaPorKm);
    }
    if ($("#tripPrecoPorPassageiroLabel")) {
      $("#tripPrecoPorPassageiroLabel").textContent =
        metrics.precoPorPassageiro > 0 ? currency(metrics.precoPorPassageiro) : "-";
    }
    if ($("#tripPrecoPorPoltronaLabel")) {
      $("#tripPrecoPorPoltronaLabel").textContent =
        metrics.precoPorPoltrona > 0 ? currency(metrics.precoPorPoltrona) : "-";
    }
    if ($("#tripPontoEquilibrioLabel")) {
      $("#tripPontoEquilibrioLabel").textContent = metrics.custosIncompletos
        ? "Custos incompletos"
        : metrics.pontoEquilibrioPassageiros > 0
          ? `${metrics.pontoEquilibrioPassageiros} passageiro(s)`
          : "-";
    }

    const badge = $("#tripPrecoJustoBadge");
    if (badge) {
      badge.textContent = statusObj.label;
      badge.className = "px-3 py-1 rounded-full text-xs font-bold border";
      if (statusObj.status === "incompleto") {
        badge.style.backgroundColor = "#f1f5f9";
        badge.style.color = "#475569";
        badge.style.borderColor = "#cbd5e1";
      } else if (statusObj.status === "vermelho") {
        badge.style.backgroundColor = "#fee2e2";
        badge.style.color = "#991b1b";
        badge.style.borderColor = "#fca5a5";
      } else if (statusObj.status === "amarelo") {
        badge.style.backgroundColor = "#fef3c7";
        badge.style.color = "#92400e";
        badge.style.borderColor = "#fcd34d";
      } else {
        badge.style.backgroundColor = "#d1fae5";
        badge.style.color = "#065f46";
        badge.style.borderColor = "#6ee7b7";
      }
    }

    const indicator = $("#tripPrecoJustoIndicator");
    if (indicator) {
      let left = metrics.custosIncompletos ? 0 : metrics.margemPercent;
      if (left < 0) left = 0;
      if (left > 100) left = 100;
      indicator.style.left = `${left}%`;
    }

    state.ui.tripProfitabilityMetrics = metrics;
    updateManualPriceBadge();

    // Atualiza a prévia ao vivo quando aberta
    const previewDraft = buildTripPayloadFromForm({ silent: true, allowIncomplete: true });
    if (previewDraft) {
      state.ui.tripPreviewData = previewDraft;
      renderTripPreview();
    }
  }

  function tripStatusBadge(status) {
    if (CONFIRMED_STATUSES.has(status)) {
      return `<span class="status-badge status-paid">${escapeHtml(status)}</span>`;
    }
    if (CANCELLED_STATUSES.has(status) || status === "Recusado" || status === "Expirado") {
      return `<span class="status-badge status-cancelled">${escapeHtml(status)}</span>`;
    }
    return `<span class="status-badge status-scheduled">${escapeHtml(status || "Proposta")}</span>`;
  }

  function getTripsForDate(dateStr, { includeCancelled = true } = {}) {
    return (state.data.trips || []).filter((trip) => {
      if (!includeCancelled && CANCELLED_STATUSES.has(String(trip.status || ""))) {
        return false;
      }
      return trip.departureDate <= dateStr && trip.returnDate >= dateStr;
    });
  }

  function syncTripDuration() {
    const start = $("#tripDepartureDate")?.value;
    const end = $("#tripReturnDate")?.value;
    if (!start || !end) return;
    const computed = computeDurationDays(start, end);
    $("#tripDuration").value = computed;
    renderVehicleConflictBanner();
    syncTripDirectCosts();
  }

  function syncTripFinalValue() {
    const baseValue = Math.max(0, Number($("#tripBaseValue")?.value || 0));
    const discount = Math.max(0, Number($("#tripDiscount")?.value || 0));
    if ($("#tripFinalValue")) {
      $("#tripFinalValue").value = Math.max(baseValue - discount, 0).toFixed(2);
    }
    syncTripDirectCosts();
  }

  function syncTripSuggestedBaseValue(force = false) {
    const totalKm = Math.max(0, Number($("#tripTotalKm")?.value || 0));
    const emptyKm = Math.max(0, Number($("#tripEmptyKm")?.value || 0));
    const localKm = Math.max(0, Number($("#tripLocalDisplacementKm")?.value || 0));
    const operationalKm = totalKm + emptyKm + localKm;
    const pricePerKm = Math.max(0, Number($("#tripPricePerKm")?.value || 0));
    const vehiclesQty = Math.max(Number($("#tripVehiclesQty")?.value || 1), 1);

    if (operationalKm > 0 && pricePerKm > 0 && (force || !state.ui.tripManualBase)) {
      $("#tripBaseValue").value = (operationalKm * pricePerKm * vehiclesQty).toFixed(2);
    }
    updateManualPriceBadge();
    syncTripFinalValue();
  }

  function setTripFormEditingState(isEditing, orcamentoNum = "") {
    const heading = $("#tripFormHeading");
    const subheading = $("#tripFormSubheading");
    if (heading) {
      heading.textContent = isEditing
        ? `Editar proposta ${orcamentoNum ? `#${orcamentoNum}` : ""}`.trim()
        : "Nova proposta de viagem";
    }
    if (subheading) {
      subheading.textContent = isEditing
        ? "Revise o itinerário, valores negociados ou custos internos e salve as alterações."
        : "Preencha os dados comerciais, roteiro e custos operacionais no padrão Garcia Turismo.";
    }
  }

  function openTripForm() {
    $("#tripFormCard").classList.remove("hidden-section");
    $("#tripFormCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearTripForm() {
    $("#tripForm")?.reset();
    $("#tripId").value = "";
    const emission = today();
    $("#tripEmissaoDate").value = emission;
    $("#tripOrcamentoNum").value = generateUniqueOrcamentoNum(state.data.trips, emission);
    $("#tripValidadeDias").value = "7";
    $("#tripClientPhone").value = "";
    $("#tripBoardingPlace").value = "";
    $("#tripDepartureDate").value = emission;
    $("#tripReturnDate").value = emission;
    $("#tripDepartureTime").value = "06:00";
    $("#tripReturnTime").value = "18:00";
    $("#tripDuration").value = "1";
    $("#tripVehiclesQty").value = "1";
    $("#tripTotalCapacity").value = "46";
    setSelectedTripVehicleIds([]);
    $("#tripPassengers").value = "";
    $("#tripConsumption").value = "";
    $("#tripDiscount").value = "0.00";
    $("#tripPricePerKm").value = "";
    $("#tripBaseValue").value = "";
    $("#tripFinalValue").value = "0.00";
    $("#tripOneWayKm").value = "";
    $("#tripTotalKm").value = "";
    $("#tripEmptyKm").value = "0";
    $("#tripLocalDisplacementKm").value = "0";
    $("#tripStatus").value = "Rascunho";

    $("#tripFuelPrice").value = "6.20";
    $("#tripDriver1Type").value = "viagem";
    $("#tripDriver1Value").value = "";
    $("#tripDriver1Days").value = "1";
    $("#tripDriver2Type").value = "viagem";
    $("#tripDriver2Value").value = "";
    $("#tripDriver2Days").value = "1";
    $("#tripTollsCost").value = "";
    $("#tripParkingCost").value = "";
    $("#tripLodgingCost").value = "";
    $("#tripDriverMealsCost").value = "";
    $("#tripAnttCost").value = "";
    $("#tripWaterCost").value = "";
    $("#tripInsuranceCost").value = "0";
    if ($("#tripCostsConfirmedZero")) $("#tripCostsConfirmedZero").checked = false;

    $("#tripDepositSignalValue").value = "";
    $("#tripDepositPaidValue").value = "";
    $("#tripBalanceDueDate").value = "";
    $("#tripPaymentTerms").value = "30% de sinal na confirmação e saldo restante até 5 dias antes do embarque.";
    $("#tripIncluded").value = "Transporte fretado ida e volta, combustível, motorista(s), pedágios e taxas de rodagem.";
    $("#tripNotIncluded").value = "Hospedagem de passageiros, alimentação de passageiros, ingressos e deslocamentos fora do roteiro contratado.";
    $("#tripRules").value = "- Tolerância de atraso no embarque: 15 minutos.\n- Bagagem: 1 mala no bagageiro e 1 volume de mão por passageiro.\n- Proibido o consumo de bebidas alcoólicas e fumo no interior do veículo.\n- Menores de 16 anos desacompanhados necessitam de autorização legal.";
    $("#tripCancellationPolicy").value = "- A reserva da data e do veículo é confirmada mediante pagamento do sinal.\n- Cancelamentos com até 7 dias de antecedência possuem devolução integral do sinal; após esse prazo, aplica-se retenção para cobertura de custos operacionais.";

    tripOtherCostsState = [];
    renderTripOtherCostsRows();

    state.ui.tripEditingId = "";
    state.ui.tripManualBase = false;
    state.ui.tripManualFinal = false;
    setTripFormEditingState(false);
    updateManualPriceBadge();
    renderVehicleConflictBanner();
    syncTripDirectCosts();
  }

  function closeTripForm() {
    $("#tripFormCard").classList.add("hidden-section");
    clearTripForm();
  }

  function getTripItineraryPoints() {
    const origin = $("#tripOrigin").value.trim();
    const destination = $("#tripDestination").value.trim();
    const stops = $("#tripStops").value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
    return [origin, ...stops, destination].filter(Boolean);
  }

  function syncTripIncludedText() {
    if (!state.ui.tripEditingId && $("#tripIncluded")?.value.includes("Transporte")) {
      const selectedVehicles = getSelectedVehiclesObjects();
      const hasBus = selectedVehicles.some((v) => (v.tipo || "onibus") === "onibus");
      const hasVan = selectedVehicles.some((v) => v.tipo === "van");
      const insuranceCost = Number($("#tripInsuranceCost")?.value || 0);

      let text = "Transporte fretado ida e volta, combustível, motorista(s), pedágios e taxas de rodagem.";
      if (hasBus && !hasVan) {
        text = "Transporte fretado ida e volta em ônibus, combustível, motorista(s), pedágios e taxas de rodagem.";
      } else if (hasVan && !hasBus) {
        text = "Transporte fretado ida e volta em van, combustível, motorista(s), pedágios e taxas de rodagem.";
      }
      if (insuranceCost > 0) {
        text += " Seguro viagem de passageiros incluso.";
      }
      $("#tripIncluded").value = text;
    }
  }

  function syncTripVehiclesQtyFromSelection() {
    const selectedIds = getSelectedTripVehicleIds();
    const selectedVehicles = getSelectedVehiclesObjects(selectedIds);

    if (selectedVehicles.length > 0) {
      $("#tripVehiclesQty").value = String(selectedVehicles.length);

      let totalCapacity = 0;
      const consumptions = [];

      selectedVehicles.forEach((vehicle) => {
        totalCapacity += Number(vehicle.capacidade || vehicle.lugares || 46);
        const cons = Number(vehicle.consumoKmPorLitro || vehicle.averageConsumption || 0);
        if (cons > 0) consumptions.push(cons);
      });

      if (totalCapacity > 0) {
        $("#tripTotalCapacity").value = String(totalCapacity);
        if (!$("#tripPassengers").value) {
          $("#tripPassengers").value = String(totalCapacity);
        }
      }

      if (consumptions.length === 1) {
        $("#tripConsumption").value = consumptions[0].toFixed(2);
      } else if (consumptions.length > 1) {
        // Exibição de referência; o cálculo usa o consumo individual de cada veículo
        const refCons = consumptions[0];
        $("#tripConsumption").value = refCons.toFixed(2);
      }

      syncTripIncludedText();
    }

    renderVehicleConflictBanner();
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
    const ids = Array.isArray(trip?.vehicleIds) ? trip.vehicleIds.filter(Boolean) : [];
    return ids
      .map((id) => {
        const vehicle = state.data.vehicles.find((item) => item.id === id);
        return vehicle ? getVehicleDisplayName(vehicle) : "-";
      })
      .filter((name) => name && name !== "-");
  }

  async function geocodePlace(place) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=br&limit=1&q=${encodeURIComponent(place)}`;
    const response = await fetch(url, { headers: { "Accept-Language": "pt-BR,pt;q=0.9" } });
    if (!response.ok) throw new Error("Falha ao consultar geocodificação");
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) throw new Error(`Não encontrei a localização: ${place}`);
    return { lat: Number(data[0].lat), lon: Number(data[0].lon), name: data[0].display_name || place };
  }

  async function calculateTripDistance() {
    const points = getTripItineraryPoints();
    if (points.length < 2) {
      showToast("Informe origem e destino para calcular a rota.", "error");
      return null;
    }
    const button = $("#tripCalculateKmBtn");
    const footerBtn = $("#tripCalculateKmFooterBtn");
    const oldText = button ? button.textContent : "Calcular rota";
    if (button) {
      button.disabled = true;
      button.textContent = "Calculando...";
    }
    if (footerBtn) {
      footerBtn.disabled = true;
      footerBtn.textContent = "Calculando...";
    }

    try {
      const geocoded = await Promise.all(points.map((point) => geocodePlace(point)));
      const coordinates = geocoded.map((point) => `${point.lon},${point.lat}`).join(";");
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`);
      if (!response.ok) throw new Error("Falha ao consultar rota");
      const data = await response.json();
      if (data.code !== "Ok" || !data.routes?.length) throw new Error("Rota não encontrada");
      const oneWayKm = data.routes[0].distance / 1000;
      const roundTripKm = oneWayKm * 2;
      $("#tripOneWayKm").value = oneWayKm.toFixed(0);
      $("#tripTotalKm").value = roundTripKm.toFixed(0);
      // Preserva preço manual se o usuário já tiver ajustado manualmente
      syncTripSuggestedBaseValue(false);
      showToast("Rota calculada com sucesso.", "success");
      return roundTripKm;
    } catch (error) {
      console.error(error);
      showToast("Não foi possível calcular a rota automática. Você pode informar o km manualmente.", "error");
      return null;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText;
      }
      if (footerBtn) {
        footerBtn.disabled = false;
        footerBtn.textContent = "Calcular rota";
      }
    }
  }

  function normalizeIsoDateString(value) {
    if (!value) return "";
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10);
      const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }
    if (typeof value?.toDate === "function") {
      return value.toDate().toISOString().slice(0, 10);
    }
    return "";
  }

  function buildTripPayloadFromForm({ silent = false, allowIncomplete = false } = {}) {
    const tripId = $("#tripId")?.value || uid();
    const existing = (state.data.trips || []).find((trip) => trip.id === tripId);
    const emissaoDate =
      normalizeIsoDateString(existing?.emissaoDate) ||
      normalizeIsoDateString(existing?.emissionDate) ||
      normalizeIsoDateString($("#tripEmissaoDate")?.value) ||
      today();
    const orcamentoNum =
      $("#tripOrcamentoNum")?.value?.trim() ||
      existing?.orcamentoNum ||
      generateUniqueOrcamentoNum(state.data.trips, emissaoDate);

    const validadeDias = Math.max(1, Math.min(365, Number($("#tripValidadeDias")?.value || 7)));
    const responsible = ($("#tripResponsible")?.value || "").trim();
    const client = ($("#tripClient")?.value || "").trim();
    const clientPhone = ($("#tripClientPhone")?.value || "").trim();
    const origin = ($("#tripOrigin")?.value || "").trim();
    const boardingPlace = ($("#tripBoardingPlace")?.value || "").trim();
    const destination = ($("#tripDestination")?.value || "").trim();
    const departureDate = normalizeIsoDateString($("#tripDepartureDate")?.value);
    const returnDate = normalizeIsoDateString($("#tripReturnDate")?.value);
    const departureTime = ($("#tripDepartureTime")?.value || "").trim();
    const returnTime = ($("#tripReturnTime")?.value || "").trim();
    const durationDays = Math.max(1, Math.min(365, Number($("#tripDuration")?.value || 1)));

    const selectedVehicleIds = getSelectedTripVehicleIds().slice(0, 20);
    const vehiclesQty = Math.min(
      20,
      Math.max(selectedVehicleIds.length || Number($("#tripVehiclesQty")?.value || 1), 1),
    );
    const totalCapacity = Math.min(1000, Math.max(1, Number($("#tripTotalCapacity")?.value || 46)));
    const passengers = Math.min(1000, Math.max(0, Number($("#tripPassengers")?.value || 0)));
    const consumptionKmPerLiter = Math.min(100, Math.max(0, Number($("#tripConsumption")?.value || 0)));

    const oneWayKm = Math.min(100000, Math.max(0, Number($("#tripOneWayKm")?.value || 0)));
    const totalKm = Math.min(200000, Math.max(0, Number($("#tripTotalKm")?.value || 0)));
    const emptyKm = Math.min(200000, Math.max(0, Number($("#tripEmptyKm")?.value || 0)));
    const localDisplacementKm = Math.min(200000, Math.max(0, Number($("#tripLocalDisplacementKm")?.value || 0)));

    const pricePerKm = Math.min(10000, Math.max(0, Number($("#tripPricePerKm")?.value || 0)));
    const baseValue = Math.min(10000000, Math.max(0, Number($("#tripBaseValue")?.value || 0)));
    const discount = Math.min(10000000, Math.max(0, Number($("#tripDiscount")?.value || 0)));
    const finalValue = Math.min(10000000, Math.max(0, baseValue - discount));
    const status = ($("#tripStatus")?.value || "Rascunho").slice(0, 40);
    const stops = ($("#tripStops")?.value || "")
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10);

    const fuelPrice = Math.min(1000, Math.max(0, Number($("#tripFuelPrice")?.value || 6.2)));
    const driver1Type = ($("#tripDriver1Type")?.value || "viagem").slice(0, 40);
    const driver1ValueRaw = $("#tripDriver1Value")?.value ?? "";
    const driver1Value = Math.min(1000000, Math.max(0, Number(driver1ValueRaw || 0)));
    const driver1Days = Math.max(0, Math.min(365, Number($("#tripDriver1Days")?.value || 1)));

    const driver2Type = ($("#tripDriver2Type")?.value || "viagem").slice(0, 40);
    const driver2Value = Math.min(1000000, Math.max(0, Number($("#tripDriver2Value")?.value || 0)));
    const driver2Days = Math.max(0, Math.min(365, Number($("#tripDriver2Days")?.value || 0)));

    const tollsCost = Math.min(1000000, Math.max(0, Number($("#tripTollsCost")?.value || 0)));
    const parkingCost = Math.min(1000000, Math.max(0, Number($("#tripParkingCost")?.value || 0)));
    const lodgingCost = Math.min(1000000, Math.max(0, Number($("#tripLodgingCost")?.value || 0)));
    const driverMealsCost = Math.min(1000000, Math.max(0, Number($("#tripDriverMealsCost")?.value || 0)));
    const anttCost = Math.min(1000000, Math.max(0, Number($("#tripAnttCost")?.value || 0)));
    const waterCost = Math.min(1000000, Math.max(0, Number($("#tripWaterCost")?.value || 0)));
    const insuranceCost = Math.min(1000000, Math.max(0, Number($("#tripInsuranceCost")?.value || 0)));
    const costsConfirmedZero = $("#tripCostsConfirmedZero")?.checked === true || driver1ValueRaw === "0";

    const depositSignalValue = Math.min(10000000, Math.max(0, Number($("#tripDepositSignalValue")?.value || 0)));
    const depositPaidValue = Math.min(10000000, Math.max(0, Number($("#tripDepositPaidValue")?.value || 0)));
    const balanceDueDate = ($("#tripBalanceDueDate")?.value || "").trim();
    const paymentTerms = ($("#tripPaymentTerms")?.value || "").trim().slice(0, 1500);
    const included = ($("#tripIncluded")?.value || "").trim().slice(0, 1500);
    const notIncluded = ($("#tripNotIncluded")?.value || "").trim().slice(0, 1500);
    const rules = ($("#tripRules")?.value || "").trim().slice(0, 1500);
    const cancellationPolicy = ($("#tripCancellationPolicy")?.value || "").trim().slice(0, 1500);

    const sanitizedOtherCosts = (Array.isArray(tripOtherCostsState) ? tripOtherCostsState : [])
      .slice(0, 30)
      .map((item) => ({
        nome: String(item?.nome || "").trim().slice(0, 140),
        valor: Math.min(1000000, Math.max(0, Number(item?.valor || 0) || 0)),
      }))
      .filter((item) => item.nome || item.valor > 0);

    if (!allowIncomplete) {
      if (!responsible || !client || !origin || !destination || !departureDate || !returnDate) {
        if (!silent) showToast("Preencha responsável, cliente, origem, destino e datas.", "error");
        return null;
      }
      if (returnDate < departureDate) {
        if (!silent) showToast("A data de retorno não pode ser anterior à data de saída.", "error");
        return null;
      }
      const allowsZeroPricing = ["Rascunho", "Cancelada", "Recusado", "Expirado"].includes(status);
      if (!allowsZeroPricing && totalKm <= 0) {
        if (!silent) showToast("Informe ou calcule o total de km da viagem (ou salve como Rascunho).", "error");
        return null;
      }
      if (!allowsZeroPricing && (baseValue <= 0 || finalValue <= 0)) {
        if (!silent) showToast("Informe o valor bruto/final da proposta (ou salve como Rascunho).", "error");
        return null;
      }
    } else if (!origin && !destination && !client) {
      return null;
    }

    const vehicleConfigs = buildVehicleConfigsForCalculation(
      selectedVehicleIds,
      consumptionKmPerLiter,
      totalCapacity,
    );
    const totalOperationalKm = Math.min(
      500000,
      Number(((totalKm + emptyKm + localDisplacementKm) * vehiclesQty).toFixed(2)),
    );

    const payload = {
      id: tripId,
      ...(existing?.companyId ? { companyId: existing.companyId } : {}),
      ...(existing?.createdAt ? { createdAt: existing.createdAt } : {}),
      ...(existing?.createdBy ? { createdBy: existing.createdBy } : {}),
      responsible: (responsible || "Responsável").slice(0, 140),
      client: (client || "Cliente").slice(0, 140),
      clientPhone: clientPhone.slice(0, 40),
      origin: (origin || "Origem").slice(0, 220),
      boardingPlace: boardingPlace.slice(0, 220),
      destination: (destination || "Destino").slice(0, 220),
      stops,
      itinerary: [origin || "Origem", ...stops, destination || "Destino"].slice(0, 12),
      vehicleIds: selectedVehicleIds.slice(0, 20),
      vehicleId: selectedVehicleIds[0] || "",
      vehicleConfigs: vehicleConfigs.slice(0, 20),
      departureDate: departureDate || today(),
      returnDate: returnDate || departureDate || today(),
      departureTime: departureTime.slice(0, 20),
      returnTime: returnTime.slice(0, 20),
      durationDays,
      vehiclesQty,
      totalCapacity,
      passengers,
      consumptionKmPerLiter,
      oneWayKm,
      totalKm,
      emptyKm,
      localDisplacementKm,
      totalOperationalKm,
      pricePerKm,
      baseValue,
      manualBaseValue: state.ui.tripManualBase ? baseValue : null,
      discount,
      finalValue,
      status,
      emissionDate: emissaoDate,
      emissaoDate,
      orcamentoNum: orcamentoNum.slice(0, 60),
      validadeDias,
      fuelPrice,
      driver1Type,
      driver1Value,
      driver1Days,
      driver2Type,
      driver2Value,
      driver2Days,
      tollsCost,
      parkingCost,
      lodgingCost,
      driverMealsCost,
      anttCost,
      waterCost,
      insuranceCost,
      otherCosts: sanitizedOtherCosts,
      costsConfirmedZero,
      depositSignalValue,
      depositPaidValue,
      balanceDueDate: balanceDueDate.slice(0, 40),
      paymentTerms,
      included,
      notIncluded,
      rules,
      cancellationPolicy,
    };

    return payload;
  }

  function buildClientProposalMarkup(trip) {
    const selectedVehicles = getTripVehicleNames(trip);
    const emissaoIso = trip.emissaoDate || trip.emissionDate || today();
    const validadeIso = addDaysISO(emissaoIso, Number(trip.validadeDias || 7));
    const passengers = Number(trip.passengers || 0);
    const totalCap = Number(trip.totalCapacity || passengers || 46);
    const pricePerPassenger = passengers > 0 ? Number(trip.finalValue || 0) / passengers : 0;
    const hasDiscount = Number(trip.discount || 0) > 0;
    const depositSignal = Number(trip.depositSignalValue || 0);
    const depositPaid = Number(trip.depositPaidValue || 0);
    const balanceRemaining = Math.max(0, Number(trip.finalValue || 0) - depositPaid);

    return `
      <div class="proposal-doc" style="max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px 32px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #dc2626; padding-bottom: 16px; margin-bottom: 20px;">
          <div>
            <img src="${logoPath}" alt="Garcia Turismo" style="height: 54px; width: auto; margin: 0; object-fit: contain; display: block;" />
            <p style="font-size: 12px; color: #64748b; margin: 6px 0 0;">Fretamento Turístico, Executivo e Logística de Passageiros</p>
          </div>
          <div style="text-align: right; font-size: 12px; color: #334155;">
            <div style="font-size: 15px; font-weight: 800; color: #0f172a;">PROPOSTA COMERCIAL #${escapeHtml(trip.orcamentoNum || "-")}</div>
            <div>Emissão: <strong>${escapeHtml(formatDateBR(emissaoIso))}</strong></div>
            <div style="color: #b91c1c; font-weight: 700;">Válida até: ${escapeHtml(formatDateBR(validadeIso))} (${Number(trip.validadeDias || 7)} dias)</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 18px; font-size: 13px;">
          <div><strong>Cliente:</strong> ${escapeHtml(trip.client || "-")}</div>
          <div><strong>WhatsApp / Contato:</strong> ${escapeHtml(trip.clientPhone || "Não informado")}</div>
          <div><strong>Responsável Comercial:</strong> ${escapeHtml(trip.responsible || "-")}</div>
          <div><strong>Passageiros / Lotação:</strong> ${passengers > 0 ? `${passengers} passageiros previstos` : `${totalCap} lugares disponíveis`}</div>
          <div><strong>Origem:</strong> ${escapeHtml(trip.origin || "-")} ${trip.boardingPlace ? `(Embarque: ${escapeHtml(trip.boardingPlace)})` : ""}</div>
          <div><strong>Destino Final:</strong> ${escapeHtml(trip.destination || "-")}</div>
          <div><strong>Saída:</strong> ${escapeHtml(formatDateBR(trip.departureDate))} ${trip.departureTime ? `às ${escapeHtml(trip.departureTime)}` : ""}</div>
          <div><strong>Retorno:</strong> ${escapeHtml(formatDateBR(trip.returnDate))} ${trip.returnTime ? `às ${escapeHtml(trip.returnTime)}` : ""} (${Number(trip.durationDays || 1)} dia(s))</div>
          ${(trip.stops || []).length ? `<div style="grid-column: span 2;"><strong>Escalas / Roteiro:</strong> ${escapeHtml(trip.stops.join(" → "))}</div>` : ""}
          <div style="grid-column: span 2;">
            <strong>Frota Designada (${Number(trip.vehiclesQty || 1)} veículo(s) · ${totalCap} poltronas):</strong>
            ${escapeHtml(selectedVehicles.length ? selectedVehicles.join(" • ") : `${Number(trip.vehiclesQty || 1)} veículo(s) de turismo`)}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 13px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 10px 12px; border-bottom: 1px solid #cbd5e1;">Descrição Comercial</th>
              <th style="padding: 10px 12px; border-bottom: 1px solid #cbd5e1; text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${hasDiscount ? `
              <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">Valor Bruto do Fretamento</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${escapeHtml(currency(trip.baseValue))}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #15803d;">Desconto Comercial Concedido</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #15803d;">- ${escapeHtml(currency(trip.discount))}</td>
              </tr>
            ` : ""}
            <tr style="background: #fef2f2; font-weight: 800; font-size: 15px;">
              <td style="padding: 12px; color: #991b1b;">VALOR FINAL DA PROPOSTA</td>
              <td style="padding: 12px; text-align: right; color: #991b1b;">${escapeHtml(currency(trip.finalValue))}</td>
            </tr>
            ${pricePerPassenger > 0 ? `
              <tr>
                <td style="padding: 8px 12px; color: #475569;">Valor estimado por passageiro (${passengers} passageiros)</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: #0f172a;">${escapeHtml(currency(pricePerPassenger))}</td>
              </tr>
            ` : ""}
          </tbody>
        </table>

        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; font-size: 12.5px; margin-bottom: 16px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
            <strong style="color: #15803d; display: block; margin-bottom: 4px;">✓ O QUE ESTÁ INCLUSO</strong>
            <div style="white-space: pre-line; color: #334155;">${escapeHtml(trip.included || "Transporte fretado conforme roteiro contratado.")}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
            <strong style="color: #b91c1c; display: block; margin-bottom: 4px;">✕ O QUE NÃO ESTÁ INCLUSO</strong>
            <div style="white-space: pre-line; color: #334155;">${escapeHtml(trip.notIncluded || "Despesas pessoais, ingressos e itens não especificados.")}</div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 12.5px; margin-bottom: 16px; space-y: 6px;">
          <div><strong>Condições de Pagamento:</strong> ${escapeHtml(trip.paymentTerms || "A combinar.")}</div>
          ${depositSignal > 0 || depositPaid > 0 || trip.balanceDueDate ? `
            <div style="margin-top: 6px; color: #334155;">
              ${depositSignal > 0 ? `Sinal previsto: <strong>${escapeHtml(currency(depositSignal))}</strong> · ` : ""}
              ${depositPaid > 0 ? `Sinal pago: <strong>${escapeHtml(currency(depositPaid))}</strong> · Saldo: <strong>${escapeHtml(currency(balanceRemaining))}</strong> · ` : ""}
              ${trip.balanceDueDate ? `Vencimento do saldo: <strong>${escapeHtml(formatDateBR(trip.balanceDueDate))}</strong>` : ""}
            </div>
          ` : ""}
          ${trip.rules ? `<div style="margin-top: 8px; white-space: pre-line;"><strong>Regras de Viagem:</strong>\n${escapeHtml(trip.rules)}</div>` : ""}
          ${trip.cancellationPolicy ? `<div style="margin-top: 8px; white-space: pre-line;"><strong>Reserva e Cancelamento:</strong>\n${escapeHtml(trip.cancellationPolicy)}</div>` : ""}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569;">
          <div>
            <strong>Garcia Turismo</strong><br />
            WhatsApp: (74) 98816-4009 · E-mail: garciaturismoeviagens@gmail.com
          </div>
          <div style="text-align: center; min-width: 240px;">
            <div style="border-bottom: 1px solid #334155; height: 24px; margin-bottom: 4px;"></div>
            <span>De acordo — Assinatura do Contratante</span>
          </div>
        </div>
      </div>
    `;
  }

  function buildInternalProposalMarkup(trip) {
    const metrics = computeTripRecordMetrics(trip);
    const { custosDetalhados } = metrics;
    const emissaoIso = trip.emissaoDate || trip.emissionDate || today();

    return `
      <div class="proposal-doc" style="max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 28px 32px;">
        <div style="background: #fee2e2; color: #991b1b; border: 1px dashed #ef4444; border-radius: 10px; padding: 8px 12px; font-size: 12px; font-weight: 800; text-align: center; margin-bottom: 16px;">
          🔒 PLANILHA INTERNA DE CUSTOS E RENTABILIDADE — USO EXCLUSIVO GARCIA TURISMO
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${logoPath}" alt="Garcia Turismo" style="height: 44px; width: auto; margin: 0; object-fit: contain;" />
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a;">Análise Operacional #${escapeHtml(trip.orcamentoNum || "-")}</div>
              <div style="font-size: 12px; color: #64748b;">Cliente: ${escapeHtml(trip.client || "-")} · ${escapeHtml(trip.origin || "-")} → ${escapeHtml(trip.destination || "-")}</div>
            </div>
          </div>
          <div style="text-align: right; font-size: 12px;">
            <div>Emissão: <strong>${escapeHtml(formatDateBR(emissaoIso))}</strong></div>
            <div>Diagnóstico: <strong>${escapeHtml(metrics.fairPrice.label)}</strong></div>
          </div>
        </div>

        ${metrics.custosIncompletos ? `
          <div style="background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 10px 14px; border-radius: 10px; font-size: 12px; margin-bottom: 16px;">
            <strong>Custos incompletos:</strong> ${escapeHtml(metrics.pendingItems.join(" • "))}
          </div>
        ` : ""}

        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; font-size: 12px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px;">
            <div style="color: #64748b;">Valor Final</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${escapeHtml(currency(metrics.valorCobrado))}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px;">
            <div style="color: #64748b;">Custos Diretos</div>
            <div style="font-size: 16px; font-weight: 800; color: #334155;">${escapeHtml(currency(metrics.custoTotal))}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px;">
            <div style="color: #64748b;">Lucro Estimado</div>
            <div style="font-size: 16px; font-weight: 800; color: ${metrics.custosIncompletos ? "#64748b" : metrics.lucro >= 0 ? "#15803d" : "#dc2626"};">
              ${metrics.custosIncompletos ? "Incompleto" : escapeHtml(currency(metrics.lucro))}
            </div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px;">
            <div style="color: #64748b;">Margem s/ Receita</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">
              ${metrics.custosIncompletos ? "Incompleto" : `${metrics.margemPercent.toFixed(1)}%`}
            </div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 16px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Item de Custo Direto</th>
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Detalhamento</th>
              <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">Combustível (${metrics.litrosCombustivel.toFixed(2)} L)</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">
                ${(metrics.vehicleFuelBreakdowns || [])
                  .map((b) => `${escapeHtml(b.nome)}: ${b.operationalKm} km ÷ ${b.consumoKmPorLitro || "?"} km/L = ${b.liters.toFixed(2)} L`)
                  .join(" | ")} × ${escapeHtml(currency(trip.fuelPrice || 6.2))}/L
              </td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${escapeHtml(currency(custosDetalhados.combustivelCents / 100))}</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">1º Motorista</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">${trip.driver1Type === "dia" ? `${Number(trip.driver1Days || 1)} diária(s) × ${escapeHtml(currency(trip.driver1Value || 0))}` : "Valor por viagem"}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${escapeHtml(currency(custosDetalhados.motorista1Cents / 100))}</td>
            </tr>
            ${custosDetalhados.motorista2Cents > 0 ? `
              <tr>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">2º Motorista</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">${trip.driver2Type === "dia" ? `${Number(trip.driver2Days || 1)} diária(s) × ${escapeHtml(currency(trip.driver2Value || 0))}` : "Valor por viagem"}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${escapeHtml(currency(custosDetalhados.motorista2Cents / 100))}</td>
              </tr>
            ` : ""}
            <tr>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">Pedágios + Estacionamento</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">Pedágios: ${escapeHtml(currency(trip.tollsCost || 0))} · Estacionamento: ${escapeHtml(currency(trip.parkingCost || 0))}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${escapeHtml(currency((custosDetalhados.pedagiosCents + custosDetalhados.estacionamentoCents) / 100))}</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">Hospedagem + Alimentação Motoristas</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">Hospedagem: ${escapeHtml(currency(trip.lodgingCost || 0))} · Alimentação: ${escapeHtml(currency(trip.driverMealsCost || 0))}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${escapeHtml(currency((custosDetalhados.hospedagemCents + custosDetalhados.alimentacaoMotoristasCents) / 100))}</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">ANTT / Taxas / Água / Seguro / Extras</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">ANTT: ${escapeHtml(currency(trip.anttCost || 0))} · Água: ${escapeHtml(currency(trip.waterCost || 0))} · Seguro: ${escapeHtml(currency(trip.insuranceCost || 0))}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${escapeHtml(currency((custosDetalhados.anttCents + custosDetalhados.aguaCents + custosDetalhados.seguroCents + custosDetalhados.outrosCents) / 100))}</td>
            </tr>
          </tbody>
        </table>

        <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; font-size: 11.5px;">
          <div><span style="color: #64748b; display: block;">Custo / KM</span><strong>${metrics.custosIncompletos ? "-" : escapeHtml(currency(metrics.custoPorKm))}</strong></div>
          <div><span style="color: #64748b; display: block;">Receita / KM</span><strong>${escapeHtml(currency(metrics.receitaPorKm))}</strong></div>
          <div><span style="color: #64748b; display: block;">Preço / Passageiro</span><strong>${metrics.precoPorPassageiro > 0 ? escapeHtml(currency(metrics.precoPorPassageiro)) : "-"}</strong></div>
          <div><span style="color: #64748b; display: block;">Preço / Poltrona</span><strong>${metrics.precoPorPoltrona > 0 ? escapeHtml(currency(metrics.precoPorPoltrona)) : "-"}</strong></div>
          <div><span style="color: #64748b; display: block;">Ponto de Equilíbrio</span><strong>${metrics.custosIncompletos ? "Incompleto" : `${metrics.pontoEquilibrioPassageiros} pass.`}</strong></div>
        </div>
      </div>
    `;
  }

  function renderTripPreview() {
    const previewCard = $("#tripPreviewCard");
    const docEl = $("#tripProposalDocument");
    if (!previewCard || !docEl) return;

    if (!state.ui.tripPreviewData) {
      previewCard.classList.add("hidden-section");
      docEl.innerHTML = "";
      return;
    }

    previewCard.classList.remove("hidden-section");
    const mode = getSelectedPreviewType();
    docEl.innerHTML =
      mode === "interno"
        ? buildInternalProposalMarkup(state.ui.tripPreviewData)
        : buildClientProposalMarkup(state.ui.tripPreviewData);
  }

  function renderTripsTable() {
    const rows = [...(state.data.trips || [])].sort((a, b) =>
      String(b.departureDate || "").localeCompare(String(a.departureDate || "")),
    );
    const tableEl = $("#tripTable");
    if (!tableEl) return;

    tableEl.innerHTML =
      rows
        .map((trip) => {
          const metrics = computeTripRecordMetrics(trip);
          const statusObj = metrics.fairPrice;

          let marginBadgeStyle = "background:#d1fae5;color:#065f46;";
          if (statusObj.status === "incompleto") {
            marginBadgeStyle = "background:#f1f5f9;color:#475569;";
          } else if (statusObj.status === "vermelho") {
            marginBadgeStyle = "background:#fee2e2;color:#991b1b;";
          } else if (statusObj.status === "amarelo") {
            marginBadgeStyle = "background:#fef3c7;color:#92400e;";
          }

          const marginText = metrics.custosIncompletos
            ? "Custos incompletos"
            : `${metrics.margemPercent.toFixed(1).replace(".", ",")}%`;

          const valInfo = evaluateOrcamentoValidity({
            dataEmissao: trip.emissaoDate || trip.emissionDate || trip.createdAt,
            diasValidade: trip.validadeDias || 7,
            status: trip.status,
          });
          const validadeHtml = `${formatDate(valInfo.dataValidade)} ${
            valInfo.isExpirado
              ? '<span class="text-xs text-red-500 font-bold ml-1">(Expirado)</span>'
              : ""
          }`;

          return `<tr>
            <td>${formatDate(trip.departureDate)}</td>
            <td class="font-semibold">${escapeHtml(trip.orcamentoNum || "-")}</td>
            <td>
              <div>${escapeHtml(trip.client)}</div>
              ${trip.clientPhone ? `<div class="text-xs muted">${escapeHtml(trip.clientPhone)}</div>` : ""}
            </td>
            <td>${escapeHtml(trip.destination)}</td>
            <td class="font-bold">${currency(trip.finalValue)}</td>
            <td>
              <span class="px-2.5 py-1 rounded-full text-xs font-bold" style="${marginBadgeStyle}">
                ${escapeHtml(marginText)}
              </span>
            </td>
            <td>
              <div class="flex flex-col gap-1">
                ${tripStatusBadge(trip.status)}
                <span class="text-[10px] text-slate-500">Val.: ${validadeHtml}</span>
              </div>
            </td>
            <td class="text-right whitespace-nowrap">
              <button class="text-slate-700 font-semibold mr-3" data-action="edit-trip" data-id="${escapeHtml(trip.id)}">Editar</button>
              <button class="text-blue-600 font-semibold mr-3" data-action="duplicate-trip" data-id="${escapeHtml(trip.id)}">Duplicar</button>
              <button class="text-emerald-600 font-semibold mr-3" data-action="preview-trip" data-id="${escapeHtml(trip.id)}">Abrir</button>
              <button class="text-red-600 font-semibold" data-action="delete-trip" data-id="${escapeHtml(trip.id)}">Excluir</button>
            </td>
          </tr>`;
        })
        .join("") ||
      '<tr><td colspan="8" class="text-center muted py-6">Nenhuma viagem ou proposta cadastrada.</td></tr>';
  }

  function renderTripDaySummary() {
    $("#tripSelectedDateLabel").textContent = formatDate(state.ui.tripSelectedDate);
    const allTripsOnDate = getTripsForDate(state.ui.tripSelectedDate, { includeCancelled: true });

    $("#tripDaySummary").innerHTML =
      allTripsOnDate
        .map((trip) => {
          const isCancelled = CANCELLED_STATUSES.has(String(trip.status || ""));
          const isConfirmed = CONFIRMED_STATUSES.has(String(trip.status || ""));
          const categoryLabel = isCancelled
            ? "Cancelada (veículos liberados)"
            : isConfirmed
              ? "Viagem confirmada"
              : "Proposta em negociação";

          return `
            <div class="metric-card p-4 ${isCancelled ? "opacity-60" : ""}">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span class="text-[11px] uppercase font-bold tracking-wider ${isConfirmed ? "text-emerald-700" : isCancelled ? "text-red-600" : "text-amber-700"}">${escapeHtml(categoryLabel)}</span>
                  <div class="font-semibold text-base">${escapeHtml(trip.origin)} → ${escapeHtml(trip.destination)}</div>
                </div>
                ${tripStatusBadge(trip.status)}
              </div>
              <div class="muted text-sm mt-2">Cliente: <strong>${escapeHtml(trip.client)}</strong> ${trip.orcamentoNum ? `(#${escapeHtml(trip.orcamentoNum)})` : ""}</div>
              <div class="muted text-sm">Saída: ${formatDate(trip.departureDate)} ${trip.departureTime ? `às ${escapeHtml(trip.departureTime)}` : ""} • Retorno: ${formatDate(trip.returnDate)} ${trip.returnTime ? `às ${escapeHtml(trip.returnTime)}` : ""}</div>
              <div class="muted text-sm">Veículos: ${escapeHtml(getTripVehicleNames(trip).join(" • ") || `${trip.vehiclesQty || 1} veículo(s)`)}</div>
              <div class="flex flex-wrap gap-2 mt-3">
                <button type="button" class="rounded-xl px-3 py-2 btn-secondary text-sm font-semibold" data-action="edit-trip" data-id="${escapeHtml(trip.id)}">Editar proposta</button>
                <button type="button" class="rounded-xl px-3 py-2 btn-primary text-sm font-semibold" data-action="preview-trip" data-id="${escapeHtml(trip.id)}">Abrir documento</button>
              </div>
            </div>
          `;
        })
        .join("") ||
      '<div class="metric-card p-4 muted">Nenhuma viagem ou proposta ativa para esta data.</div>';
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
        dateStr = `${addMonthsToMonthString(currentMonth, -1)}-${String(dayNumber).padStart(2, "0")}`;
        muted = true;
      } else if (index >= firstDay + totalDays) {
        dayNumber = index - (firstDay + totalDays) + 1;
        dateStr = `${addMonthsToMonthString(currentMonth, 1)}-${String(dayNumber).padStart(2, "0")}`;
        muted = true;
      } else {
        dayNumber = index - firstDay + 1;
        dateStr = `${currentMonth}-${String(dayNumber).padStart(2, "0")}`;
      }

      // Exclui viagens canceladas da contagem ativa no calendário
      const activeTrips = getTripsForDate(dateStr, { includeCancelled: false });
      const confirmedCount = activeTrips.filter((t) => CONFIRMED_STATUSES.has(String(t.status || ""))).length;
      const proposalCount = activeTrips.length - confirmedCount;

      let countLabel = "";
      if (confirmedCount > 0 && proposalCount > 0) {
        countLabel = `${confirmedCount} conf. · ${proposalCount} prop.`;
      } else if (confirmedCount > 0) {
        countLabel = `${confirmedCount} confirmada(s)`;
      } else if (proposalCount > 0) {
        countLabel = `${proposalCount} proposta(s)`;
      }

      html += `
        <button
          type="button"
          class="calendar-day ${muted ? "muted-day" : ""} ${activeTrips.length ? "has-trip" : ""} ${state.ui.tripSelectedDate === dateStr ? "selected-day" : ""}"
          data-trip-date="${dateStr}"
        >
          <div class="text-sm font-semibold">${dayNumber}</div>
          <div class="calendar-day__count">${escapeHtml(countLabel)}</div>
        </button>
      `;
    }

    $("#tripCalendarGrid").innerHTML = html;
    $$("#tripCalendarGrid [data-trip-date]").forEach((button) =>
      button.addEventListener("click", () => {
        state.ui.tripSelectedDate = button.dataset.tripDate;
        renderTripsCalendar();
        renderTripDaySummary();
      }),
    );
  }

  function editTrip(id) {
    const trip = (state.data.trips || []).find((item) => item.id === id);
    if (!trip) return;
    openTripForm();

    $("#tripId").value = trip.id;
    $("#tripEmissaoDate").value = trip.emissaoDate || trip.emissionDate || today();
    $("#tripOrcamentoNum").value = trip.orcamentoNum || generateUniqueOrcamentoNum(state.data.trips, trip.emissaoDate || today());
    $("#tripValidadeDias").value = trip.validadeDias || "7";
    $("#tripResponsible").value = trip.responsible || "";
    $("#tripClient").value = trip.client || "";
    $("#tripClientPhone").value = trip.clientPhone || "";
    $("#tripStatus").value = trip.status || "Rascunho";
    $("#tripOrigin").value = trip.origin || "";
    $("#tripBoardingPlace").value = trip.boardingPlace || "";
    $("#tripDestination").value = trip.destination || "";
    $("#tripStops").value = (trip.stops || []).join("\n");
    $("#tripDepartureDate").value = trip.departureDate || today();
    $("#tripReturnDate").value = trip.returnDate || trip.departureDate || today();
    $("#tripDepartureTime").value = trip.departureTime || "06:00";
    $("#tripReturnTime").value = trip.returnTime || "18:00";
    $("#tripDuration").value = trip.durationDays || 1;
    $("#tripVehiclesQty").value = trip.vehiclesQty || 1;
    setSelectedTripVehicleIds(trip.vehicleIds || []);
    $("#tripTotalCapacity").value = trip.totalCapacity || trip.passengers || 46;
    $("#tripPassengers").value = trip.passengers || "";
    $("#tripConsumption").value = trip.consumptionKmPerLiter || "";
    $("#tripOneWayKm").value = trip.oneWayKm || "";
    $("#tripTotalKm").value = trip.totalKm ?? "";
    $("#tripEmptyKm").value = trip.emptyKm || "0";
    $("#tripLocalDisplacementKm").value = trip.localDisplacementKm || "0";

    const opKm = Number(trip.totalKm || 0) + Number(trip.emptyKm || 0) + Number(trip.localDisplacementKm || 0);
    const computedPricePerKm =
      Number(trip.pricePerKm) ||
      (opKm > 0 && Number(trip.vehiclesQty) > 0
        ? Number(trip.baseValue || 0) / (opKm * Number(trip.vehiclesQty))
        : 0);
    $("#tripPricePerKm").value = computedPricePerKm > 0 ? computedPricePerKm.toFixed(2) : "";
    $("#tripBaseValue").value = Number(trip.baseValue || 0).toFixed(2);
    $("#tripDiscount").value = Number(trip.discount || 0).toFixed(2);
    $("#tripFinalValue").value = Number(trip.finalValue || 0).toFixed(2);

    $("#tripFuelPrice").value = trip.fuelPrice ?? "6.20";
    $("#tripDriver1Type").value = trip.driver1Type || "viagem";
    $("#tripDriver1Value").value = trip.driver1Value !== undefined && trip.driver1Value !== null ? trip.driver1Value : "";
    $("#tripDriver1Days").value = trip.driver1Days ?? trip.durationDays ?? 1;
    $("#tripDriver2Type").value = trip.driver2Type || "viagem";
    $("#tripDriver2Value").value = trip.driver2Value || "";
    $("#tripDriver2Days").value = trip.driver2Days ?? trip.durationDays ?? 1;
    $("#tripTollsCost").value = trip.tollsCost || "";
    $("#tripParkingCost").value = trip.parkingCost || "";
    $("#tripLodgingCost").value = trip.lodgingCost || "";
    $("#tripDriverMealsCost").value = trip.driverMealsCost || "";
    $("#tripAnttCost").value = trip.anttCost || "";
    $("#tripWaterCost").value = trip.waterCost || "";
    $("#tripInsuranceCost").value = trip.insuranceCost || "0";
    if ($("#tripCostsConfirmedZero")) {
      $("#tripCostsConfirmedZero").checked = Boolean(trip.costsConfirmedZero);
    }

    $("#tripDepositSignalValue").value = trip.depositSignalValue || "";
    $("#tripDepositPaidValue").value = trip.depositPaidValue || "";
    $("#tripBalanceDueDate").value = trip.balanceDueDate || "";
    $("#tripPaymentTerms").value =
      trip.paymentTerms || "30% de sinal na confirmação e saldo restante até 5 dias antes do embarque.";
    $("#tripIncluded").value =
      trip.included || "Transporte fretado ida e volta, combustível, motorista(s), pedágios e taxas de rodagem.";
    $("#tripNotIncluded").value =
      trip.notIncluded || "Hospedagem de passageiros, alimentação de passageiros, ingressos e deslocamentos fora do roteiro contratado.";
    $("#tripRules").value =
      trip.rules ||
      "- Tolerância de atraso no embarque: 15 minutos.\n- Bagagem: 1 mala no bagageiro e 1 volume de mão por passageiro.\n- Proibido o consumo de bebidas alcoólicas e fumo no interior do veículo.\n- Menores de 16 anos desacompanhados necessitam de autorização legal.";
    $("#tripCancellationPolicy").value =
      trip.cancellationPolicy ||
      "- A reserva da data e do veículo é confirmada mediante pagamento do sinal.\n- Cancelamentos com até 7 dias de antecedência possuem devolução integral do sinal; após esse prazo, aplica-se retenção para cobertura de custos operacionais.";

    tripOtherCostsState = Array.isArray(trip.otherCosts) ? JSON.parse(JSON.stringify(trip.otherCosts)) : [];
    renderTripOtherCostsRows();

    state.ui.tripEditingId = trip.id;
    state.ui.tripManualBase = true;
    state.ui.tripManualFinal = false;
    state.ui.tripPreviewData = trip;
    state.ui.tripMonth = (trip.departureDate || today()).slice(0, 7);
    state.ui.tripSelectedDate = trip.departureDate || today();

    setTripFormEditingState(true, trip.orcamentoNum);
    updateManualPriceBadge();
    renderVehicleConflictBanner();
    syncTripDirectCosts();
    renderTripsCalendar();
    renderTripDaySummary();
    renderTripPreview();
    document.querySelector('[data-tab="viagens"]')?.click();
  }

  function previewTrip(id) {
    const trip = (state.data.trips || []).find((item) => item.id === id);
    if (!trip) return;
    state.ui.tripPreviewData = trip;
    state.ui.tripMonth = (trip.departureDate || today()).slice(0, 7);
    state.ui.tripSelectedDate = trip.departureDate || today();
    renderTripsCalendar();
    renderTripDaySummary();
    renderTripPreview();
    document.querySelector('[data-tab="viagens"]')?.click();
    $("#tripPreviewCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function persistProposalSnapshot(payload) {
    // Serializa apenas dados planos (sem state.charts ou referências circulares do Chart.js)
    const safeVehicles = (state.data.vehicles || []).map((v) => ({
      id: v.id,
      nome: v.nome || "",
      modelo: v.modelo || "",
      ano: v.ano || "",
      cor: v.cor || "",
      placa: v.placa || "",
      capacidade: v.capacidade || v.lugares || 46,
      lugares: v.lugares || v.capacidade || 46,
      tipo: v.tipo || "onibus",
      layout: v.layout || "onibus_46",
      consumoKmPorLitro: v.consumoKmPorLitro || 0,
    }));
    const safeTrips = [
      payload,
      ...(state.data.trips || []).filter((t) => t.id !== payload.id),
    ];
    try {
      localStorage.setItem(
        "garcia_turismo_state_backup",
        JSON.stringify({ data: { vehicles: safeVehicles, trips: safeTrips } }),
      );
      localStorage.setItem("garcia_turismo_current_orcamento", JSON.stringify(payload));
    } catch (storageErr) {
      console.warn("Aviso ao salvar cache local da proposta:", storageErr);
    }
  }

  function resolveActiveProposalPayload() {
    let payload = state.ui.tripPreviewData;
    const formOpen = !$("#tripFormCard")?.classList.contains("hidden-section");
    if (formOpen) {
      const currentDraft = buildTripPayloadFromForm({ silent: true, allowIncomplete: true });
      if (currentDraft) {
        payload = currentDraft;
        state.ui.tripPreviewData = currentDraft;
      }
    }
    if (!payload) {
      showToast("Abra ou preencha uma proposta antes de exportar o PDF.", "error");
      return null;
    }
    persistProposalSnapshot(payload);
    return payload;
  }

  function openPrintPreviewPage() {
    const payload = resolveActiveProposalPayload();
    if (!payload) return;
    const mode = getSelectedPreviewType();
    const targetPage = mode === "interno" ? "orcamento-interno.html" : "orcamento-cliente.html";
    window.open(`${targetPage}?id=${encodeURIComponent(payload.id)}`, "_blank");
  }

  async function preloadLogo(src) {
    if (!src) return;
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  async function exportSelectedPdf(event) {
    const payload = resolveActiveProposalPayload();
    if (!payload) return;

    renderTripPreview();
    const mode = getSelectedPreviewType();
    const cleanNum = String(payload.orcamentoNum || payload.id || today())
      .replace(/[^a-zA-Z0-9_-]+/g, "_");
    const filename =
      mode === "interno"
        ? `Planilha_Interna_${cleanNum}.pdf`
        : `Proposta_Comercial_${cleanNum}.pdf`;

    if (typeof html2pdf === "undefined") {
      openPrintPreviewPage();
      return;
    }

    const triggerBtn = event?.currentTarget || $("#tripExportPdfBtn");
    const originalText = triggerBtn ? triggerBtn.textContent : "Exportar PDF";
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = "Gerando PDF...";
    }

    try {
      await preloadLogo(logoPath);
      const wrapper = document.createElement("div");
      wrapper.style.width = "716px";
      wrapper.style.maxWidth = "100%";
      wrapper.style.boxSizing = "border-box";
      wrapper.style.background = "#ffffff";
      wrapper.style.padding = "2px";
      wrapper.innerHTML =
        mode === "interno"
          ? buildInternalProposalMarkup(payload)
          : buildClientProposalMarkup(payload);
      wrapper.querySelectorAll(".proposal-doc").forEach((docEl) => {
        docEl.style.maxWidth = "100%";
        docEl.style.width = "100%";
        docEl.style.boxSizing = "border-box";
        docEl.style.padding = "22px 24px";
      });

      await html2pdf()
        .set({
          margin: [0.25, 0.25, 0.25, 0.25],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, scrollY: 0, backgroundColor: "#ffffff" },
          jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .from(wrapper)
        .save();

      showToast("Arquivo PDF salvo com sucesso.", "success");
    } catch (error) {
      console.error("Erro ao exportar PDF da proposta:", error);
      showToast("Não foi possível baixar diretamente; abrindo página para salvar/imprimir.", "error");
      openPrintPreviewPage();
    } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = originalText;
      }
    }
  }

  function bindTrips() {
    $("#openTripFormBtn")?.addEventListener("click", () => {
      clearTripForm();
      openTripForm();
    });
    $("#tripCancelEditBtn")?.addEventListener("click", closeTripForm);
    $("#tripPrevMonthBtn")?.addEventListener("click", () => {
      state.ui.tripMonth = addMonthsToMonthString(state.ui.tripMonth, -1);
      renderTripsCalendar();
    });
    $("#tripNextMonthBtn")?.addEventListener("click", () => {
      state.ui.tripMonth = addMonthsToMonthString(state.ui.tripMonth, 1);
      renderTripsCalendar();
    });

    $("#tripDepartureDate")?.addEventListener("change", syncTripDuration);
    $("#tripReturnDate")?.addEventListener("change", syncTripDuration);
    $("#tripDepartureTime")?.addEventListener("change", renderVehicleConflictBanner);
    $("#tripReturnTime")?.addEventListener("change", renderVehicleConflictBanner);

    $("#tripVehiclesQty")?.addEventListener("input", () => syncTripSuggestedBaseValue(false));
    $("#tripVehicleIds")?.addEventListener("change", syncTripVehiclesQtyFromSelection);
    $("#tripTotalKm")?.addEventListener("input", () => syncTripSuggestedBaseValue(false));
    $("#tripEmptyKm")?.addEventListener("input", () => syncTripSuggestedBaseValue(false));
    $("#tripLocalDisplacementKm")?.addEventListener("input", () => syncTripSuggestedBaseValue(false));

    $("#tripPricePerKm")?.addEventListener("input", () => {
      if (!state.ui.tripManualBase) {
        syncTripSuggestedBaseValue(true);
      } else {
        syncTripDirectCosts();
      }
    });

    $("#tripBaseValue")?.addEventListener("input", () => {
      state.ui.tripManualBase = true;
      updateManualPriceBadge();
      syncTripFinalValue();
    });

    $("#tripDiscount")?.addEventListener("input", () => syncTripFinalValue());

    $("#tripRecalcFinalBtn")?.addEventListener("click", () => {
      state.ui.tripManualBase = false;
      updateManualPriceBadge();
      syncTripSuggestedBaseValue(true);
      showToast("Valor bruto recalculado automaticamente pela quilometragem.", "success");
    });

    $("#tripAplicarPrecoBtn")?.addEventListener("click", () => {
      const suggestedCents = state.ui.tripProfitabilityMetrics?.precoSugeridoMetaCents || 0;
      if (suggestedCents <= 0) {
        showToast("Complete os custos da viagem antes de aplicar o preço sugerido.", "error");
        return;
      }
      state.ui.tripManualBase = true;
      const discount = Math.max(0, Number($("#tripDiscount")?.value || 0));
      const newFinal = suggestedCents / 100;
      const newBase = newFinal + discount;
      $("#tripBaseValue").value = newBase.toFixed(2);
      $("#tripFinalValue").value = newFinal.toFixed(2);
      updateManualPriceBadge();
      syncTripDirectCosts();
      showToast("Preço sugerido para margem de 50% aplicado.", "success");
    });

    $("#tripCalculateKmBtn")?.addEventListener("click", calculateTripDistance);
    $("#tripCalculateKmFooterBtn")?.addEventListener("click", calculateTripDistance);

    $$('input[name="tripPreviewType"]').forEach((radio) => {
      radio.addEventListener("change", renderTripPreview);
    });

    $("#tripOpenPrintPageBtn")?.addEventListener("click", openPrintPreviewPage);
    $("#tripExportPdfBtn")?.addEventListener("click", exportSelectedPdf);
    $("#tripFormExportPdfBtn")?.addEventListener("click", exportSelectedPdf);

    $("#tripForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (isSavingTrip) return;

      const payload = buildTripPayloadFromForm();
      if (!payload) return;

      const saveBtn = $("#tripSaveBtn");
      const oldBtnText = saveBtn ? saveBtn.textContent : "Salvar proposta";
      isSavingTrip = true;
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Salvando...";
      }

      const index = (state.data.trips || []).findIndex((trip) => trip.id === payload.id);
      try {
        await saveFirestoreRecord("Trip", "trips", payload, { prepend: true });
        state.ui.tripEditingId = payload.id;
        state.ui.tripPreviewData = payload;
        state.ui.tripMonth = payload.departureDate.slice(0, 7);
        state.ui.tripSelectedDate = payload.departureDate;
        setTripFormEditingState(true, payload.orcamentoNum);
        onRenderAll();
        renderTripPreview();
        showToast(
          index >= 0 ? "Proposta atualizada com sucesso." : "Proposta salva com sucesso.",
          "success",
        );
      } catch (error) {
        console.error("Erro ao salvar proposta/viagem:", error);
        showToast(error.message || "Não foi possível salvar a proposta.", "error");
      } finally {
        isSavingTrip = false;
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = oldBtnText;
        }
      }
    });

    const costFields = [
      "#tripFuelPrice",
      "#tripDriver1Type",
      "#tripDriver1Value",
      "#tripDriver1Days",
      "#tripDriver2Type",
      "#tripDriver2Value",
      "#tripDriver2Days",
      "#tripTollsCost",
      "#tripParkingCost",
      "#tripLodgingCost",
      "#tripDriverMealsCost",
      "#tripAnttCost",
      "#tripWaterCost",
      "#tripInsuranceCost",
      "#tripCostsConfirmedZero",
      "#tripConsumption",
      "#tripDuration",
      "#tripPassengers",
    ];
    costFields.forEach((selector) => {
      const el = $(selector);
      if (!el) return;
      el.addEventListener("input", syncTripDirectCosts);
      el.addEventListener("change", syncTripDirectCosts);
    });

    $("#tripAddOtherCostBtn")?.addEventListener("click", () => {
      tripOtherCostsState.push({ nome: "", valor: 0 });
      renderTripOtherCostsRows();
      syncTripDirectCosts();
    });
  }

  function duplicateTrip(id) {
    const trip = (state.data.trips || []).find((item) => item.id === id);
    if (!trip) return;
    editTrip(id);

    const newEmission = today();
    const newNum = generateUniqueOrcamentoNum(state.data.trips, newEmission);
    $("#tripId").value = "";
    $("#tripEmissaoDate").value = newEmission;
    $("#tripValidadeDias").value = "7";
    $("#tripStatus").value = "Rascunho";
    $("#tripOrcamentoNum").value = newNum;

    state.ui.tripEditingId = "";
    setTripFormEditingState(false);
    renderVehicleConflictBanner();
    showToast(`Proposta duplicada com novo número #${newNum}. Revise e salve.`, "success");
  }

  async function deleteTrip(id) {
    if (!confirm("Tem certeza que deseja excluir esta viagem/proposta?")) return;
    try {
      await removeFirestoreRecord("Trip", "trips", id);
      state.data.trips = (state.data.trips || []).filter((t) => t.id !== id);
      if (state.ui.tripPreviewData?.id === id) {
        state.ui.tripPreviewData = null;
      }
      onRenderAll();
      showToast("Registro excluído com sucesso.", "success");
    } catch (e) {
      console.error(e);
      showToast("Erro ao excluir viagem: " + (e.message || "Falha de permissão."), "error");
    }
  }

  return {
    bindTrips,
    duplicateTrip,
    deleteTrip,
    clearTripForm,
    editTrip,
    previewTrip,
    renderTripDaySummary,
    renderTripPreview,
    renderTripsCalendar,
    renderTripsTable,
  };
}
