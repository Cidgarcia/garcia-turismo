import { $, currency, escapeHtml, formatDate, paymentLabel, today, uid } from "./controller-helpers.js";
import { buildCardSchedules, togglePaymentBlocks } from "./payment-utils.js";

export function createAbastecimentosController({
  state,
  getVehicleName,
  onRenderAll,
  saveFirestoreRecord,
  showToast,
}) {
  function renderFuelHistory() {
    const list = [...state.data.fuelings]
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
      .slice(0, 6);
    $("#fuelHistory").innerHTML =
      list.map((item) => `
        <div class="rounded-2xl border border-slate-200 bg-white/70 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold">${escapeHtml(getVehicleName(item.veiculoId))}</div>
              <div class="text-sm muted mt-1">${formatDate(item.data)} • ${item.litros} L • ${currency(item.valorTotal)}</div>
              <div class="text-sm muted mt-1">${paymentLabel(item.paymentMethod)}${item.paymentMethod === "cartao_credito" ? ` • ${item.installments}x` : ""}</div>
            </div>
            <div class="text-right text-sm">
              <div class="font-semibold">${item.mediaKmLitro.toFixed(2)} km/l</div>
              <div class="muted">${item.distanciaPercorrida} km</div>
            </div>
          </div>
        </div>`).join("") || '<div class="muted text-sm">Sem abastecimentos ainda.</div>';
  }

  function toggleFuelFields() {
    togglePaymentBlocks("fuel");
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

  function bindFuelForm() {
    $("#fuelVehicle").addEventListener("change", () => {
      const vehicle = state.data.vehicles.find((item) => item.id === $("#fuelVehicle").value);
      $("#fuelLastKm").value = vehicle ? Number(vehicle.kmAtual || 0) : 0;
      calculateFuelPreview();
    });
    ["#fuelCurrentKm", "#fuelLiters", "#fuelTotal"].forEach((selector) => {
      $(selector).addEventListener("input", calculateFuelPreview);
    });
    $("#fuelPayment").addEventListener("change", toggleFuelFields);
    $("#fuelForm").addEventListener("submit", async (event) => {
      event.preventDefault();
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
        id: uid(), data: today(), veiculoId: vehicleId, vehicleId,
        ultimoKm: metrics.lastKm, kmAtual: metrics.currentKm, litros: metrics.liters,
        valorTotal: metrics.total, distanciaPercorrida: metrics.distance,
        mediaKmLitro: Number(metrics.average.toFixed(2)), precoLitro: Number(metrics.pricePerLiter.toFixed(2)),
        paymentMethod, status, paymentDetails: {},
      };
      if (paymentMethod === "pix" || paymentMethod === "dinheiro") {
        payload.paymentDetails = { tipo: paymentMethod, instantaneo: true, vencimento: payload.data };
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
        schedules = buildCardSchedules({
          cards: state.data.cards, uid, sourceType: "fuel", sourceId: payload.id,
          description: `Abastecimento ${getVehicleName(vehicleId)}`, cardId, buyerId,
          baseDate: payload.data, totalValue: payload.valorTotal, parcelas: installments,
          firstStatus: status, vehicleId, category: "combustivel", extra: `${payload.litros}L`,
        });
      }
      const vehicle = state.data.vehicles.find((item) => item.id === vehicleId);
      try {
        await saveFirestoreRecord("Fueling", "fuelings", payload, { prepend: true });
        for (const schedule of schedules) {
          await saveFirestoreRecord("CardSchedule", "cardSchedules", schedule, { prepend: true });
        }
        if (vehicle) {
          await saveFirestoreRecord("Vehicle", "vehicles", { ...vehicle, kmAtual: metrics.currentKm });
        }
        onRenderAll();
        clearFuelForm();
        showToast("Abastecimento salvo com sucesso.", "success");
      } catch (error) {
        console.error("Erro ao salvar abastecimento:", error);
        showToast(error.message || "Não foi possível salvar o abastecimento.", "error");
      }
    });
  }

  return { bindFuelForm, calculateFuelPreview, clearFuelForm, renderFuelHistory, toggleFuelFields };
}
