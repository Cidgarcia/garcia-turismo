import { $, currency, escapeHtml, formatDate, paymentLabel, today, uid } from "./controller-helpers.js";
import { buildCardSchedules, togglePaymentBlocks } from "./payment-utils.js";
import {
  calculateFuelMetrics,
  getFuelingDate,
  getPreviousFueling,
  sortFuelingsChronologically,
} from "../utils/fueling-utils.js";

export function createAbastecimentosController({
  state,
  getVehicleName,
  onRenderAll,
  saveFirestoreRecord,
  showToast,
}) {
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
      try {
        await saveFirestoreRecord("Fueling", "fuelings", payload, { prepend: true });
        for (const schedule of schedules) {
          await saveFirestoreRecord("CardSchedule", "cardSchedules", schedule, { prepend: true });
        }
        if (vehicle) {
          await saveFirestoreRecord("Vehicle", "vehicles", {
            ...vehicle,
            kmAtual: vehicleKmAfterFueling(vehicle, payload),
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
    calculateFuelPreview,
    clearFuelForm,
    renderFuelHistory,
    startFuelEdit,
    toggleFuelFields,
  };
}
