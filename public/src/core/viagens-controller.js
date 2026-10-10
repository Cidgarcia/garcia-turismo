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
import { calculateOrcamento, evaluateOrcamentoValidity } from "../utils/orcamento-calculator.js";

export function createViagensController({
  state,
  logoPath,
  onRenderAll,
  saveFirestoreRecord,
  showToast,
}) {
  let tripOtherCostsState = [];

  function renderTripOtherCostsRows() {
    const container = $("#tripOtherCostsContainer");
    if (!container) return;

    if (tripOtherCostsState.length === 0) {
      container.innerHTML = `<p class="text-xs muted italic">Nenhum custo adicional inserido.</p>`;
      return;
    }

    container.innerHTML = tripOtherCostsState
      .map(
        (item, index) => `
        <div class="flex items-center gap-2 p-2 rounded-xl bg-slate-100 border border-slate-200" data-custo-index="${index}">
          <input
            type="text"
            class="field text-xs py-1 px-2 flex-1 trip-other-cost-name"
            placeholder="Descrição (ex: Estacionamento)"
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
              value="${item.valor || ""}"
              data-index="${index}"
            />
          </div>
          <button
            type="button"
            class="p-1 rounded-lg text-red-500 hover:bg-red-100 font-bold text-sm leading-none trip-remove-other-cost"
            data-index="${index}"
            title="Remover custo"
          >×</button>
        </div>
      `,
      )
      .join("");
      
    // Bind events for the newly rendered inputs
    $$(".trip-other-cost-name").forEach(input => {
      input.addEventListener("input", (e) => {
        const idx = e.target.dataset.index;
        tripOtherCostsState[idx].nome = e.target.value;
        syncTripDirectCosts();
      });
    });
    $$(".trip-other-cost-value").forEach(input => {
      input.addEventListener("input", (e) => {
        const idx = e.target.dataset.index;
        tripOtherCostsState[idx].valor = Number(e.target.value) || 0;
        syncTripDirectCosts();
      });
    });
    $$(".trip-remove-other-cost").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = e.target.dataset.index;
        tripOtherCostsState.splice(idx, 1);
        renderTripOtherCostsRows();
        syncTripDirectCosts();
      });
    });
  }

  function syncTripDirectCosts() {
    const totalKm = Number($("#tripTotalKm")?.value || 0);
    const emptyKm = Number($("#tripEmptyKm")?.value || 0);
    const consumption = Number($("#tripConsumption")?.value || 0);
    const fuelPrice = Number($("#tripFuelPrice")?.value || 0);
    
    // Fuel logic
    const distanceForFuel = totalKm + emptyKm;
    let fuelLiters = 0;
    let fuelCost = 0;
    if (consumption > 0 && distanceForFuel > 0) {
      fuelLiters = distanceForFuel / consumption;
      fuelCost = fuelLiters * fuelPrice;
    }
    
    if ($("#tripFuelLitersLabel")) $("#tripFuelLitersLabel").textContent = fuelLiters.toFixed(1);
    if ($("#tripFuelCostLabel")) $("#tripFuelCostLabel").textContent = currency(fuelCost);
    
    // Drivers
    const driver1Type = $("#tripDriver1Type")?.value || "viagem";
    const driver1Val = Number($("#tripDriver1Value")?.value || 0);
    const duration = Number($("#tripDuration")?.value || 1);
    const driver1Cost = driver1Type === "dia" ? driver1Val * duration : driver1Val;
    if ($("#tripDriver1CostLabel")) $("#tripDriver1CostLabel").textContent = currency(driver1Cost);

    const driver2Type = $("#tripDriver2Type")?.value || "viagem";
    const driver2Val = Number($("#tripDriver2Value")?.value || 0);
    const driver2Cost = driver2Type === "dia" ? driver2Val * duration : driver2Val;
    if ($("#tripDriver2CostLabel")) $("#tripDriver2CostLabel").textContent = currency(driver2Cost);

    const lodging = Number($("#tripLodgingCost")?.value || 0);
    const antt = Number($("#tripAnttCost")?.value || 0);
    const water = Number($("#tripWaterCost")?.value || 0);
    const insurance = Number($("#tripInsuranceCost")?.value || 0);
    
    const others = tripOtherCostsState.reduce((acc, curr) => acc + Number(curr.valor || 0), 0);
    
    const total = fuelCost + driver1Cost + driver2Cost + lodging + antt + water + insurance + others;
    
    if ($("#tripTotalDirectCostsLabel")) $("#tripTotalDirectCostsLabel").textContent = currency(total);
    
    syncTripProfitability();
    return total;
  }

  function syncTripProfitability() {
    const totalKm = Number($("#tripTotalKm")?.value || 0);
    const emptyKm = Number($("#tripEmptyKm")?.value || 0);
    const passageiros = Number($("#tripPassengers")?.value || 0);
    const consumption = Number($("#tripConsumption")?.value || 0);
    
    // Drivers
    const duration = Number($("#tripDuration")?.value || 1);
    const driver1Type = $("#tripDriver1Type")?.value || "viagem";
    const driver1Val = Number($("#tripDriver1Value")?.value || 0);
    const driver1Cost = driver1Type === "dia" ? driver1Val * duration : driver1Val;
    const driver2Type = $("#tripDriver2Type")?.value || "viagem";
    const driver2Val = Number($("#tripDriver2Value")?.value || 0);
    const driver2Cost = driver2Type === "dia" ? driver2Val * duration : driver2Val;

    const metrics = calculateOrcamento({
      valorCobrado: $("#tripFinalValue")?.value || 0,
      totalKm: totalKm + emptyKm,
      capacidadePassageiros: passageiros,
      consumoKmPerLiter: consumption,
      fuelPricePerLiter: Number($("#tripFuelPrice")?.value || 0),
      motorista1Valor: driver1Cost,
      motorista2Valor: driver2Cost,
      hospedagem: Number($("#tripLodgingCost")?.value || 0),
      antt: Number($("#tripAnttCost")?.value || 0),
      agua: Number($("#tripWaterCost")?.value || 0),
      seguro: Number($("#tripInsuranceCost")?.value || 0),
      outrosCustos: tripOtherCostsState,
    });

    if ($("#tripMargemAtualLabel")) $("#tripMargemAtualLabel").textContent = metrics.margemPercent.toFixed(1).replace(".", ",") + "%";
    if ($("#tripLucroEstimadoLabel")) $("#tripLucroEstimadoLabel").textContent = metrics.lucro;
    if ($("#tripPrecoSugeridoLabel")) $("#tripPrecoSugeridoLabel").textContent = metrics.precoSugeridoMeta;

    if ($("#tripCustoPorKmLabel")) $("#tripCustoPorKmLabel").textContent = metrics.custoPorKm;
    if ($("#tripReceitaPorKmLabel")) $("#tripReceitaPorKmLabel").textContent = metrics.receitaPorKm;
    if ($("#tripPrecoPorPoltronaLabel")) $("#tripPrecoPorPoltronaLabel").textContent = metrics.precoPorPoltrona;
    if ($("#tripPontoEquilibrioLabel")) $("#tripPontoEquilibrioLabel").textContent = `${metrics.pontoEquilibrioPoltronas} poltronas`;

    const statusObj = metrics.fairPrice;
    const badge = $("#tripPrecoJustoBadge");
    if (badge) {
      badge.textContent = statusObj.label;
      // Extract color classes from orcamento-calculator logic if possible, or define them here.
      // orcamento-calculator.js uses: textColor, bgClass, borderColor
      badge.className = `px-3 py-1 rounded-full text-xs font-bold border ${statusObj.textColor || 'text-slate-600'} ${statusObj.bgClass || 'bg-slate-200'} ${statusObj.borderColor || 'border-slate-300'}`;
    }

    const indicator = $("#tripPrecoJustoIndicator");
    if (indicator) {
      let left = metrics.margemPercent;
      if (left < 0) left = 0;
      if (left > 100) left = 100;
      indicator.style.left = `${left}%`;
    }
    
    state.ui.tripProfitabilityMetrics = metrics;
  }

  function tripStatusBadge(status) {
    if (status === "Confirmada" || status === "Realizada") return `<span class="status-badge status-paid">${escapeHtml(status)}</span>`;
    if (status === "Cancelada") return '<span class="status-badge status-cancelled">Cancelada</span>';
    return `<span class="status-badge status-scheduled">${escapeHtml(status || "Proposta")}</span>`;
  }
  function getTripsForDate(dateStr) {
    return state.data.trips.filter((trip) => trip.departureDate <= dateStr && trip.returnDate >= dateStr);
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
    if (force || !state.ui.tripManualFinal) $("#tripFinalValue").value = Math.max(baseValue - discount, 0).toFixed(2);
    syncTripProfitability();
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
    $("#tripEmissaoDate").value = today();
    $("#tripOrcamentoNum").value = "";
    $("#tripOrcamentoVersao").value = "1";
    $("#tripValidadeDias").value = "7";
    // Keep the commercial conditions from the duplicated trip
    $("#tripDepartureDate").value = today();
    $("#tripReturnDate").value = today();
    $("#tripDuration").value = "1";
    $("#tripVehiclesQty").value = "1";
    setSelectedTripVehicleIds([]);
    $("#tripPassengers").value = "";
    $("#tripConsumption").value = "";
    $("#tripDiscount").value = "0.00";
    $("#tripPricePerKm").value = "";
    $("#tripOneWayKm").value = "";
    $("#tripTotalKm").value = "";
    $("#tripEmptyKm").value = "0";
    $("#tripStatus").value = "Rascunho";
    
    // Clear costs
    $("#tripFuelPrice").value = "6.20";
    $("#tripDriver1Type").value = "viagem";
    $("#tripDriver1Value").value = "";
    $("#tripDriver2Type").value = "viagem";
    $("#tripDriver2Value").value = "";
    $("#tripLodgingCost").value = "";
    $("#tripAnttCost").value = "";
    $("#tripWaterCost").value = "";
    $("#tripInsuranceCost").value = "0";
    
    $("#tripPaymentTerms").value = "30% na confirmação e o restante até 5 dias antes da viagem.";
    $("#tripIncluded").value = "Transporte ida e volta, combustível, motorista(s), pedágios e taxas de rodagem.";
    $("#tripNotIncluded").value = "Hospedagem de passageiros, alimentação de passageiros, ingressos e passeios extras.";
    $("#tripRules").value = "- Tolerância de atraso: 15 minutos.\n- Bagagem: 1 mala no bagageiro e 1 volume de mão pequeno por passageiro.\n- É expressamente proibido o consumo de bebidas alcoólicas e fumo no interior do veículo.\n- Menores de 16 anos desacompanhados precisam de autorização judicial ou dos pais reconhecida em cartório.";
    tripOtherCostsState = [];
    renderTripOtherCostsRows();
    syncTripDirectCosts();

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
    const stops = $("#tripStops").value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
    return [origin, ...stops, destination].filter(Boolean);
  }
  function getSelectedTripVehicleIds() {
    return [...($("#tripVehicleIds")?.selectedOptions || [])].map((option) => option.value).filter(Boolean);
  }
  function syncTripIncludedText() {
    if (!state.ui.tripEditingId || $("#tripIncluded").value.includes("Transporte")) {
      const selectedIds = getSelectedTripVehicleIds();
      let hasBus = false; let hasVan = false;
      selectedIds.forEach((id) => {
        const vehicle = state.data.vehicles.find((v) => v.id === id);
        if (vehicle && vehicle.type && vehicle.type.toLowerCase() === "ônibus") hasBus = true;
        else if (vehicle && vehicle.type && vehicle.type.toLowerCase() === "van") hasVan = true;
      });
      const insuranceCost = Number($("#tripInsuranceCost").value || 0);
      let text = "Transporte ida e volta, combustível, motorista(s), pedágios e taxas de rodagem.";
      if (hasBus) text = "Transporte ida e volta em ônibus executivo, combustível, motorista(s), pedágios e taxas de rodagem.";
      if (hasVan) text = "Transporte ida e volta em van executiva, combustível, motorista(s), pedágios e taxas de rodagem.";
      if (hasBus && hasVan) text = "Transporte ida e volta, combustível, motorista(s), pedágios e taxas de rodagem.";
      
      if (insuranceCost > 0) text += " Seguro de viagem por passageiro incluso.";
      $("#tripIncluded").value = text;
    }
  }
  function syncTripVehiclesQtyFromSelection() {
    const selectedIds = getSelectedTripVehicleIds();
    if (selectedIds.length) {
      $("#tripVehiclesQty").value = String(selectedIds.length);
      
      let totalPassengers = 0;
      let totalConsumption = 0;
      let countConsumption = 0;

      selectedIds.forEach((id) => {
        const vehicle = state.data.vehicles.find((v) => v.id === id);
        if (vehicle) {
          totalPassengers += Number(vehicle.passengerCapacity || 0);
          if (vehicle.averageConsumption) {
            totalConsumption += Number(vehicle.averageConsumption);
            countConsumption++;
          }
        }
      });

      if (totalPassengers > 0) $("#tripPassengers").value = totalPassengers;
        syncTripIncludedText();
      if (countConsumption > 0) $("#tripConsumption").value = (totalConsumption / countConsumption).toFixed(1);
    }
    syncTripSuggestedBaseValue(false);
  }
  function setSelectedTripVehicleIds(vehicleIds = []) {
    const selected = new Set(vehicleIds || []);
    [...($("#tripVehicleIds")?.options || [])].forEach((option) => { option.selected = selected.has(option.value); });
    if (selected.size) $("#tripVehiclesQty").value = String(selected.size);
  }
  function getTripVehicleNames(trip) {
    const ids = Array.isArray(trip?.vehicleIds) ? trip.vehicleIds.filter(Boolean) : [];
    return ids.map((id) => {
      const vehicle = state.data.vehicles.find((item) => item.id === id);
      return vehicle ? getVehicleDisplayName(vehicle) : "-";
    }).filter((name) => name && name !== "-");
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
      showToast("Informe origem e destino para calcular o km.", "error");
      return null;
    }
    const button = $("#tripCalculateKmBtn");
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Calculando...";
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
      syncTripSuggestedBaseValue(false);
      showToast("Distância calculada com sucesso.", "success");
      return roundTripKm;
    } catch (error) {
      console.error(error);
      showToast("Não foi possível calcular a distância automática. Você pode ajustar o km manualmente.", "error");
      return null;
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }
  function buildTripPayloadFromForm({ silent = false } = {}) {
    const tripId = $("#tripId").value || uid();
    const emissaoDate = $("#tripEmissaoDate").value || today();
    const orcamentoNum = $("#tripOrcamentoNum").value || `${tripId.substring(0,6).toUpperCase()}`;
    const orcamentoVersao = Number($("#tripOrcamentoVersao").value || 1);
    const validadeDias = Number($("#tripValidadeDias").value || 7);
    const responsible = $("#tripResponsible").value.trim();
    const client = $("#tripClient").value.trim();
    const origin = $("#tripOrigin").value.trim();
    const destination = $("#tripDestination").value.trim();
    const departureDate = $("#tripDepartureDate").value;
    const returnDate = $("#tripReturnDate").value;
    const durationDays = Number($("#tripDuration").value || 1);
    const selectedVehicleIds = getSelectedTripVehicleIds();
    const vehiclesQty = Math.max(selectedVehicleIds.length || Number($("#tripVehiclesQty").value || 1), 1);
    const passengers = Number($("#tripPassengers").value || 0);
    const consumptionKmPerLiter = Number($("#tripConsumption").value || 0);
    const oneWayKm = Number($("#tripOneWayKm").value || 0);
    const totalKm = Number($("#tripTotalKm").value || 0);
    const emptyKm = Number($("#tripEmptyKm").value || 0);
    const pricePerKm = Number($("#tripPricePerKm").value || 0);
    const baseValue = Number($("#tripBaseValue").value || 0);
    const discount = Number($("#tripDiscount").value || 0);
    const finalValue = Number($("#tripFinalValue").value || 0);
    const status = $("#tripStatus").value;
    const stops = $("#tripStops").value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
    const existing = state.data.trips.find((trip) => trip.id === tripId);
    
    // Cost fields
    const fuelPrice = Number($("#tripFuelPrice").value || 6.2);
    const driver1Type = $("#tripDriver1Type").value || "viagem";
    const driver1Value = Number($("#tripDriver1Value").value || 0);
    const driver2Type = $("#tripDriver2Type").value || "viagem";
    const driver2Value = Number($("#tripDriver2Value").value || 0);
    const lodgingCost = Number($("#tripLodgingCost").value || 0);
    const anttCost = Number($("#tripAnttCost").value || 0);
    const waterCost = Number($("#tripWaterCost").value || 0);
    const insuranceCost = Number($("#tripInsuranceCost").value || 0);

    if (!responsible || !client || !origin || !destination || !departureDate || !returnDate) {
      if (!silent) showToast("Preencha os campos principais da proposta.", "error");
      return null;
    }
    if (returnDate < departureDate) {
      if (!silent) showToast("A data de retorno não pode ser menor que a data de saída.", "error");
      return null;
    }
    if (totalKm <= 0) {
      if (!silent) showToast("Calcule ou informe o total de km da viagem.", "error");
      return null;
    }
    if (baseValue <= 0 || finalValue <= 0) {
      if (!silent) showToast("Informe o valor total e o valor final da proposta.", "error");
      return null;
    }
    return { 
      id: tripId, responsible, client, origin, destination, stops, itinerary: [origin, ...stops, destination], vehicleIds: selectedVehicleIds, vehicleId: selectedVehicleIds[0] || "", departureDate, returnDate, durationDays, vehiclesQty, passengers, consumptionKmPerLiter, oneWayKm, totalKm, emptyKm, pricePerKm, baseValue, discount, finalValue, status, emissionDate: existing?.emissionDate || today(),
      fuelPrice, driver1Type, driver1Value, driver2Type, driver2Value, lodgingCost, anttCost, waterCost, insuranceCost, otherCosts: [...tripOtherCostsState]
    };
  }
  function tripVehicleLabel(qty) { return `${Math.max(Number(qty || 0), 1)}`; }
  function buildTripProposalMarkup(trip) {
    const selectedVehicles = getTripVehicleNames(trip);
    const selectedVehiclesMarkup = selectedVehicles.length ? `<p><strong>Veículos selecionados:</strong> ${escapeHtml(selectedVehicles.join(" • "))}</p>` : "";
    const discountRow = Number(trip.discount || 0) > 0 ? `<tr><td>Desconto</td><td>${escapeHtml(currency(trip.discount).replace("R$", "").trim())}</td></tr>` : "";
    return `<div class="proposal-doc"><img src="${logoPath}" alt="Garcia Turismo" /><h1>PROPOSTA DE VIAGEM – GARCIA TURISMO</h1><p><strong>Responsável:</strong> ${escapeHtml(trip.responsible)}</p><p><strong>Origem:</strong> ${escapeHtml(trip.origin)}</p><p><strong>Destino:</strong> ${escapeHtml(trip.destination)}</p><p><strong>Duração:</strong> ${escapeHtml(trip.durationDays)} dia(s)</p><p><strong>Serviços Inclusos:</strong> Transporte (ida e volta)</p><p><strong>Quantidade de veículos:</strong> ${escapeHtml(tripVehicleLabel(trip.vehiclesQty))}</p>${selectedVehiclesMarkup}<p><strong>Total de km (ida e volta):</strong> ${escapeHtml(Number(trip.totalKm).toFixed(0))} km</p><p><strong>Valor Total:</strong> ${escapeHtml(currency(trip.baseValue))}</p><p><strong>Data de Saída:</strong> ${escapeHtml(formatDate(trip.departureDate))}</p><p><strong>Data de Retorno:</strong> ${escapeHtml(formatDate(trip.returnDate))}</p><p><strong>Data de Emissão:</strong> ${escapeHtml(formatDate(trip.emissionDate))}</p><table><thead><tr><th>Descrição</th><th>Valor (R$)</th></tr></thead><tbody><tr><td>Valor</td><td>${escapeHtml(currency(trip.baseValue).replace("R$", "").trim())}</td></tr>${discountRow}<tr><td>Valor final</td><td class="highlight-cell">${escapeHtml(currency(trip.finalValue).replace("R$", "").trim())}</td></tr></tbody></table><p><strong>Observações:</strong></p><p>- Oferta válida por 7 dias a partir da data de emissão.</p><p>- Valores incluem transporte (ida e volta) apenas.</p><p class="proposal-doc__contact"><strong>Contato:</strong></p><p>WhatsApp: (74) 98816-4009</p><p>E-mail: garciaturismoeviagens@gmail.com</p><div class="signature">__________________________________<br>Assinatura do Cliente / Data</div></div>`;
  }
  function renderTripPreview() {
    if (!state.ui.tripPreviewData) {
      $("#tripPreviewCard").classList.add("hidden-section");
      $("#tripProposalDocument").innerHTML = "";
      return;
    }
    $("#tripPreviewCard").classList.remove("hidden-section");
    $("#tripProposalDocument").innerHTML = buildTripProposalMarkup(state.ui.tripPreviewData);
  }
  function renderTripsTable() {
    const rows = [...state.data.trips].sort((a, b) => (a.departureDate || "").localeCompare(b.departureDate || ""));
    $("#tripTable").innerHTML = rows.map((trip) => {
        // Calculate profitability metrics for the list
        const driver1Cost = trip.driver1Type === "dia" ? (Number(trip.driver1Value)||0) * (Number(trip.durationDays)||1) : (Number(trip.driver1Value)||0);
        const driver2Cost = trip.driver2Type === "dia" ? (Number(trip.driver2Value)||0) * (Number(trip.durationDays)||1) : (Number(trip.driver2Value)||0);
        
        const metrics = calculateOrcamento({
            valorCobrado: trip.finalValue || 0,
            totalKm: (Number(trip.totalKm)||0) + (Number(trip.emptyKm)||0),
            capacidadePassageiros: Number(trip.passengers)||0,
            consumoKmPerLiter: Number(trip.consumptionKmPerLiter)||0,
            fuelPricePerLiter: Number(trip.fuelPrice)||0,
            motorista1Valor: driver1Cost,
            motorista2Valor: driver2Cost,
            hospedagem: Number(trip.lodgingCost)||0,
            antt: Number(trip.anttCost)||0,
            agua: Number(trip.waterCost)||0,
            seguro: Number(trip.insuranceCost)||0,
            outrosCustos: trip.otherCosts || []
        });
        
        const statusObj = metrics.fairPrice;
        
        // Validade
        const valInfo = evaluateOrcamentoValidity({
            dataEmissao: trip.emissaoDate || trip.createdAt,
            diasValidade: trip.validadeDias || 7,
            status: trip.status
        });
        const validadeHtml = `${formatDate(valInfo.dataValidade)} ${valInfo.isExpirado ? '<span class="text-xs text-red-500 font-bold ml-1">(Expirado)</span>' : ''}`;

        return `<tr>
            <td>${formatDate(trip.departureDate)}</td>
            <td>${escapeHtml(trip.orcamentoNum || "")} v${trip.orcamentoVersao || "1"}</td>
            <td>${escapeHtml(trip.client)}</td>
            <td>${escapeHtml(trip.destination)}</td>
            <td class="font-bold">${currency(trip.finalValue)}</td>
            <td><span class="px-2 py-0.5 rounded-full text-xs font-bold ${statusObj.bgClass} ${statusObj.textColor}">${metrics.margemPercent.toFixed(1).replace(".",",")}%</span></td>
            <td><div class="flex flex-col gap-1">${tripStatusBadge(trip)}<span class="text-[10px] text-slate-500">${validadeHtml}</span></div></td>
            <td class="text-right whitespace-nowrap">
                <button class="text-slate-700 font-semibold mr-3" data-action="edit-trip" data-id="${escapeHtml(trip.id)}">Editar</button>
                <button class="text-blue-600 font-semibold mr-3" data-action="duplicate-trip" data-id="${escapeHtml(trip.id)}">Duplicar</button>
                <button class="text-red-600 font-semibold" data-action="preview-trip" data-id="${escapeHtml(trip.id)}">Abrir</button>
            </td>
        </tr>`;
    }).join("") || '<tr><td colspan="8" class="text-center muted py-6">Nenhuma viagem cadastrada.</td></tr>';
  }
  function renderTripDaySummary() {
    $("#tripSelectedDateLabel").textContent = formatDate(state.ui.tripSelectedDate);
    const trips = getTripsForDate(state.ui.tripSelectedDate);
    $("#tripDaySummary").innerHTML = trips.map((trip) => `<div class="metric-card p-4"><div class="flex items-center justify-between gap-3 flex-wrap"><div class="font-semibold">${escapeHtml(trip.destination)}</div>${tripStatusBadge(trip)}</div><div class="muted text-sm mt-2">Cliente: ${escapeHtml(trip.client)}</div><div class="muted text-sm">Saída: ${formatDate(trip.departureDate)} • Retorno: ${formatDate(trip.returnDate)}</div><div class="muted text-sm">Veículos: ${escapeHtml(getTripVehicleNames(trip).join(" • ") || tripVehicleLabel(trip.vehiclesQty))}</div><div class="flex flex-wrap gap-2 mt-3"><button class="rounded-xl px-3 py-2 btn-secondary text-sm font-semibold" data-action="edit-trip" data-id="${escapeHtml(trip.id)}">Editar</button><button class="rounded-xl px-3 py-2 btn-primary text-sm font-semibold" data-action="preview-trip" data-id="${escapeHtml(trip.id)}">Abrir proposta</button></div></div>`).join("") || '<div class="metric-card p-4 muted">Nenhuma viagem cadastrada para esta data.</div>';
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
      let dayNumber = 0; let dateStr = ""; let muted = false;
      if (index < firstDay) { dayNumber = previousMonthDays - firstDay + index + 1; dateStr = `${addMonthsToMonthString(currentMonth, -1)}-${String(dayNumber).padStart(2, "0")}`; muted = true; }
      else if (index >= firstDay + totalDays) { dayNumber = index - (firstDay + totalDays) + 1; dateStr = `${addMonthsToMonthString(currentMonth, 1)}-${String(dayNumber).padStart(2, "0")}`; muted = true; }
      else { dayNumber = index - firstDay + 1; dateStr = `${currentMonth}-${String(dayNumber).padStart(2, "0")}`; }
      const trips = getTripsForDate(dateStr);
      html += `<button type="button" class="calendar-day ${muted ? "muted-day" : ""} ${trips.length ? "has-trip" : ""} ${state.ui.tripSelectedDate === dateStr ? "selected-day" : ""}" data-trip-date="${dateStr}"><div class="text-sm font-semibold">${dayNumber}</div><div class="calendar-day__count">${trips.length ? `${trips.length} viagem(ns)` : ""}</div></button>`;
    }
    $("#tripCalendarGrid").innerHTML = html;
    $$("#tripCalendarGrid [data-trip-date]").forEach((button) => button.addEventListener("click", () => {
      state.ui.tripSelectedDate = button.dataset.tripDate;
      renderTripsCalendar(); renderTripDaySummary();
    }));
  }
  function editTrip(id) {
    const trip = state.data.trips.find((item) => item.id === id);
    if (!trip) return;
    openTripForm();
    $("#tripId").value = trip.id;
    $("#tripEmissaoDate").value = trip.emissaoDate || trip.createdAt || today();
    $("#tripOrcamentoNum").value = trip.orcamentoNum || "";
    $("#tripOrcamentoVersao").value = trip.orcamentoVersao || "1";
    $("#tripValidadeDias").value = trip.validadeDias || "7";
    $("#tripResponsible").value = trip.responsible; $("#tripClient").value = trip.client; $("#tripStatus").value = trip.status; $("#tripOrigin").value = trip.origin; $("#tripDestination").value = trip.destination; $("#tripStops").value = (trip.stops || []).join("\n"); $("#tripDepartureDate").value = trip.departureDate; $("#tripReturnDate").value = trip.returnDate; $("#tripDuration").value = trip.durationDays; $("#tripVehiclesQty").value = trip.vehiclesQty; setSelectedTripVehicleIds(trip.vehicleIds || []); $("#tripPassengers").value = trip.passengers || ""; $("#tripConsumption").value = trip.consumptionKmPerLiter || ""; $("#tripOneWayKm").value = trip.oneWayKm || ""; $("#tripTotalKm").value = trip.totalKm; $("#tripEmptyKm").value = trip.emptyKm || "0";
    $("#tripPricePerKm").value = Number(trip.pricePerKm || (Number(trip.totalKm) > 0 && Number(trip.vehiclesQty) > 0 ? Number(trip.baseValue) / (Number(trip.totalKm) * Number(trip.vehiclesQty)) : 0)).toFixed(2);
    $("#tripBaseValue").value = Number(trip.baseValue).toFixed(2); $("#tripDiscount").value = Number(trip.discount).toFixed(2); $("#tripFinalValue").value = Number(trip.finalValue).toFixed(2);
    
    $("#tripFuelPrice").value = trip.fuelPrice || "6.20";
    $("#tripDriver1Type").value = trip.driver1Type || "viagem";
    $("#tripDriver1Value").value = trip.driver1Value || "";
    $("#tripDriver2Type").value = trip.driver2Type || "viagem";
    $("#tripDriver2Value").value = trip.driver2Value || "";
    $("#tripLodgingCost").value = trip.lodgingCost || "";
    $("#tripAnttCost").value = trip.anttCost || "";
    $("#tripWaterCost").value = trip.waterCost || "";
    $("#tripInsuranceCost").value = trip.insuranceCost || "0";
    $("#tripPaymentTerms").value = trip.paymentTerms || "30% na confirmação e o restante até 5 dias antes da viagem.";
    $("#tripIncluded").value = trip.included || "Transporte ida e volta, combustível, motorista(s), pedágios e taxas de rodagem.";
    $("#tripNotIncluded").value = trip.notIncluded || "Hospedagem de passageiros, alimentação de passageiros, ingressos e passeios extras.";
    $("#tripRules").value = trip.rules || "- Tolerância de atraso: 15 minutos.\n- Bagagem: 1 mala no bagageiro e 1 volume de mão pequeno por passageiro.\n- É expressamente proibido o consumo de bebidas alcoólicas e fumo no interior do veículo.\n- Menores de 16 anos desacompanhados precisam de autorização judicial ou dos pais reconhecida em cartório.";
    
    tripOtherCostsState = Array.isArray(trip.otherCosts) ? JSON.parse(JSON.stringify(trip.otherCosts)) : [];
    renderTripOtherCostsRows();
    syncTripDirectCosts();

    state.ui.tripEditingId = trip.id; state.ui.tripManualBase = true; state.ui.tripManualFinal = true; state.ui.tripPreviewData = trip; state.ui.tripMonth = trip.departureDate.slice(0, 7); state.ui.tripSelectedDate = trip.departureDate;
    renderTripsCalendar(); renderTripDaySummary(); renderTripPreview(); document.querySelector('[data-tab="viagens"]').click();
  }
  function previewTrip(id) {
    const trip = state.data.trips.find((item) => item.id === id);
    if (!trip) return;
    state.ui.tripPreviewData = trip; state.ui.tripMonth = trip.departureDate.slice(0, 7); state.ui.tripSelectedDate = trip.departureDate;
    renderTripsCalendar(); renderTripDaySummary(); renderTripPreview(); document.querySelector('[data-tab="viagens"]').click(); $("#tripPreviewCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function exportTripProposalPdf() {
    const source = $("#tripProposalDocument");
    if (!source || !source.innerHTML.trim()) { showToast("Gere a prévia da proposta antes de exportar.", "error"); return; }
    const clone = source.cloneNode(true); clone.style.background = "#fff"; clone.style.padding = "0";
    const wrap = document.createElement("div"); wrap.style.position = "fixed"; wrap.style.left = "-99999px"; wrap.style.top = "0"; wrap.appendChild(clone); document.body.appendChild(wrap);
    try { await html2pdf().set({ margin: 0.25, filename: `proposta_viagem_${slugify(state.ui.tripPreviewData?.destination || "garcia")}_${today()}.pdf`, image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, scrollY: 0 }, jsPDF: { unit: "in", format: "a4", orientation: "portrait" } }).from(clone).save(); showToast("Proposta em PDF gerada com sucesso.", "success"); }
    catch (error) { console.error(error); showToast("Erro ao gerar o PDF da proposta.", "error"); }
    finally { document.body.removeChild(wrap); }
  }
  async function exportTripProposalImage() {
    const source = $("#tripProposalDocument");
    if (!source || !source.innerHTML.trim()) { showToast("Gere a prévia da proposta antes de exportar.", "error"); return; }
    try { const canvas = await html2canvas(source, { scale: 2, useCORS: true, backgroundColor: "#ffffff" }); const link = document.createElement("a"); link.href = canvas.toDataURL("image/png"); link.download = `proposta_viagem_${slugify(state.ui.tripPreviewData?.destination || "garcia")}_${today()}.png`; link.click(); showToast("Imagem da proposta gerada com sucesso.", "success"); }
    catch (error) { console.error(error); showToast("Erro ao gerar a imagem da proposta.", "error"); }
  }
  function bindTrips() {
    $("#openTripFormBtn").addEventListener("click", () => { openTripForm(); if (!$("#tripId").value) clearTripForm(); });
    $("#tripCancelEditBtn").addEventListener("click", closeTripForm);
    $("#tripPrevMonthBtn").addEventListener("click", () => { state.ui.tripMonth = addMonthsToMonthString(state.ui.tripMonth, -1); renderTripsCalendar(); });
    $("#tripNextMonthBtn").addEventListener("click", () => { state.ui.tripMonth = addMonthsToMonthString(state.ui.tripMonth, 1); renderTripsCalendar(); });
    $("#tripDepartureDate").addEventListener("change", syncTripDuration); $("#tripReturnDate").addEventListener("change", syncTripDuration);
    $("#tripVehiclesQty").addEventListener("input", () => syncTripSuggestedBaseValue(false)); $("#tripVehicleIds").addEventListener("change", syncTripVehiclesQtyFromSelection); $("#tripTotalKm").addEventListener("input", () => syncTripSuggestedBaseValue(false));
    $("#tripPricePerKm").addEventListener("input", () => { state.ui.tripManualBase = false; syncTripSuggestedBaseValue(true); });
    $("#tripBaseValue").addEventListener("input", () => { state.ui.tripManualBase = true; syncTripFinalValue(false); });
    $("#tripDiscount").addEventListener("input", () => syncTripFinalValue(false));
    $("#tripFinalValue").addEventListener("input", () => { state.ui.tripManualFinal = true; syncTripProfitability(); });
    $("#tripRecalcFinalBtn").addEventListener("click", () => { state.ui.tripManualFinal = false; syncTripFinalValue(true); });
    
    $("#tripAplicarPrecoBtn")?.addEventListener("click", () => {
      const suggestedCents = state.ui.tripProfitabilityMetrics?.precoSugeridoMetaCents || 0;
      if (suggestedCents > 0) {
        state.ui.tripManualFinal = true;
        const newVal = suggestedCents / 100;
        $("#tripFinalValue").value = newVal.toFixed(2);
        
        const totalKm = Number($("#tripTotalKm")?.value || 0);
        const vehiclesQty = Math.max(Number($("#tripVehiclesQty")?.value || 1), 1);
        if (totalKm > 0) {
           const discount = Number($("#tripDiscount").value || 0);
           const baseVal = newVal + discount;
           $("#tripBaseValue").value = baseVal.toFixed(2);
           $("#tripPricePerKm").value = (baseVal / (totalKm * vehiclesQty)).toFixed(2);
        }

        syncTripProfitability();
        showToast("Preço sugerido aplicado com sucesso.", "success");
      }
    });

    $("#tripCalculateKmBtn").addEventListener("click", calculateTripDistance); $("#tripPreviewBtn").addEventListener("click", () => { const payload = buildTripPayloadFromForm(); if (!payload) return; state.ui.tripPreviewData = payload; renderTripPreview(); $("#tripPreviewCard").scrollIntoView({ behavior: "smooth", block: "start" }); });
    $("#tripForm").addEventListener("submit", async (event) => { event.preventDefault(); const payload = buildTripPayloadFromForm(); if (!payload) return; const index = state.data.trips.findIndex((trip) => trip.id === payload.id); try { await saveFirestoreRecord("Trip", "trips", payload, { prepend: true }); state.ui.tripPreviewData = payload; state.ui.tripMonth = payload.departureDate.slice(0, 7); state.ui.tripSelectedDate = payload.departureDate; onRenderAll(); renderTripPreview(); showToast(index >= 0 ? "Viagem atualizada com sucesso." : "Viagem cadastrada com sucesso.", "success"); } catch (error) { console.error("Erro ao salvar viagem:", error); showToast(error.message || "Não foi possível salvar a viagem.", "error"); } });
    $("#tripExportInternalPdfBtn")?.addEventListener("click", () => {
      const id = state.ui.tripPreviewData?.id;
      if (id) window.open(`orcamento-interno.html?id=${id}`, '_blank');
      else showToast("Gere a prévia da proposta antes de exportar.", "error");
    });
    
    $("#tripExportClientPdfBtn")?.addEventListener("click", () => {
      const id = state.ui.tripPreviewData?.id;
      if (id) window.open(`orcamento-cliente.html?id=${id}`, '_blank');
      else showToast("Gere a prévia da proposta antes de exportar.", "error");
    });
    
    // Bind cost fields
    const costFields = ["#tripFuelPrice", "#tripDriver1Type", "#tripDriver1Value", "#tripDriver2Type", "#tripDriver2Value", "#tripLodgingCost", "#tripAnttCost", "#tripWaterCost", "#tripInsuranceCost", "#tripTotalKm", "#tripEmptyKm", "#tripConsumption", "#tripDuration", "#tripPassengers"];
    costFields.forEach(selector => {
      const el = $(selector);
      if (el) el.addEventListener("input", syncTripDirectCosts);
      if (el && el.tagName === "SELECT") el.addEventListener("change", syncTripDirectCosts);
    });

    $("#tripAddOtherCostBtn")?.addEventListener("click", () => {
      tripOtherCostsState.push({ nome: "", valor: 0 });
      renderTripOtherCostsRows();
      syncTripDirectCosts();
    });
  }
  function duplicateTrip(id, bumpVersion = false) {
    const trip = state.data.trips.find((item) => item.id === id);
    if (!trip) return;
    editTrip(id);
    
    $("#tripId").value = "";
    $("#tripEmissaoDate").value = today();
    $("#tripValidadeDias").value = "7";
    $("#tripStatus").value = "Rascunho";
    
    if (bumpVersion) {
        $("#tripOrcamentoVersao").value = String((Number(trip.orcamentoVersao) || 1) + 1);
    } else {
        $("#tripOrcamentoNum").value = "";
        $("#tripOrcamentoVersao").value = "1";
    }
    
    state.ui.tripEditingId = null;
    showToast(bumpVersion ? "Nova versão gerada. Ajuste e salve." : "Viagem duplicada. Ajuste e salve.", "success");
  }

  return { bindTrips, duplicateTrip, clearTripForm, editTrip, previewTrip, renderTripDaySummary, renderTripPreview, renderTripsCalendar, renderTripsTable };
}
