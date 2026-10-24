import { $, $$, currency, escapeHtml, formatDate, paymentLabel, today, uid } from "./controller-helpers.js";
import { sanitizeVehiclePayload } from "./cadastros-controller.js";
import { buildCardSchedules, togglePaymentBlocks } from "./payment-utils.js";
import {
  calculateFuelMetrics,
  calculateTankMetrics,
  computeNewFuelLevel,
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
  let currentFuelFilter = "todos";
  let currentSearchQuery = "";

  function renderFuelHistory() {
    const historyEl = $("#fuelHistory");
    if (!historyEl) return;
    const list = sortFuelingsChronologically(state.data.fuelings).reverse().slice(0, 6);
    historyEl.innerHTML =
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

  function renderVehicleTypeIcon(tipo = "onibus") {
    const normalized = String(tipo || "onibus").toLowerCase();
    if (normalized === "van" || normalized === "microonibus") {
      return `
        <svg class="fleet-vehicle-type-svg" viewBox="0 0 48 36" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 25V12a3 3 0 0 1 3-3h22l8 7 6 2a2 2 0 0 1 2 2v5h-4" />
          <path d="M4 17h31" />
          <path d="M18 9v8" />
          <line x1="15" y1="25" x2="33" y2="25" />
          <circle cx="11" cy="25" r="4" />
          <circle cx="37" cy="25" r="4" />
        </svg>
      `;
    }
    return `
      <svg class="fleet-vehicle-type-svg" viewBox="0 0 44 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="7" y="4" width="30" height="26" rx="4" />
        <path d="M7 12h30" />
        <path d="M7 21h30" />
        <path d="M4 13v5" />
        <path d="M40 13v5" />
        <circle cx="13" cy="25.5" r="1.5" fill="currentColor" />
        <circle cx="31" cy="25.5" r="1.5" fill="currentColor" />
        <path d="M12 30v5" />
        <path d="M32 30v5" />
      </svg>
    `;
  }

  function resolveCardData(vehicle) {
    const modelo = String(vehicle.modelo || vehicle.nome || "VEÍCULO").toUpperCase();
    const ano = vehicle.ano ? ` ${vehicle.ano}` : "";
    const cor = vehicle.cor ? ` - ${String(vehicle.cor).toUpperCase()}` : "";
    const title = `${modelo}${ano}${cor}`;

    const tank = calculateTankMetrics({
      fuelLevelL: vehicle.fuelLevelL,
      tankCapacityL: vehicle.tankCapacityL,
    });

    const vehicleTrips = (state.data.trips || [])
      .filter((t) => {
        if (String(t.status || "").toLowerCase() === "cancelada") return false;
        const ids = Array.isArray(t.vehicleIds) ? t.vehicleIds : [t.vehicleId];
        return ids.includes(vehicle.id) || t.vehicleId === vehicle.id;
      })
      .sort((a, b) => String(b.departureDate || "").localeCompare(String(a.departureDate || "")));
    const lastTrip = vehicleTrips[0] || null;

    const vehicleFuelings = sortFuelingsChronologically(
      (state.data.fuelings || []).filter((f) => (f.veiculoId || f.vehicleId) === vehicle.id),
    );
    const lastFueling = vehicleFuelings.at(-1) || null;

    const status = ["disponivel", "em_viagem", "manutencao"].includes(vehicle.statusOperacional)
      ? vehicle.statusOperacional
      : "disponivel";
    const kmAtual = Number(vehicle.kmAtual || 0);
    const lastTripKm = lastTrip
      ? Number(lastTrip.totalOperationalKm || lastTrip.totalKm || lastTrip.oneWayKm || 0)
      : lastFueling
        ? Number(lastFueling.distanciaPercorrida || 0)
        : 0;

    let driverName = vehicle.motoristaPadrao || "Não escalado";
    if (vehicle.motoristaId) {
      const empById = (state.data.employees || []).find((e) => e.id === vehicle.motoristaId);
      if (empById?.nome) driverName = empById.nome;
    } else if (lastTrip?.employeeId) {
      const emp = (state.data.employees || []).find((e) => e.id === lastTrip.employeeId);
      if (emp?.nome) driverName = emp.nome;
    }

    const nextRevKm = Number(vehicle.proximaRevisaoKm || 0);
    const overdueByKm = nextRevKm > 0 && kmAtual >= nextRevKm;
    const revisaoPendente = Boolean(vehicle.revisaoPendente) || status === "manutencao" || overdueByKm;

    let nextRevisionText = "Não informada";
    if (revisaoPendente) {
      nextRevisionText = vehicle.proximaRevisaoTexto || "Revisão pendente";
    } else if (vehicle.proximaRevisaoTexto) {
      nextRevisionText = vehicle.proximaRevisaoTexto;
    } else if (nextRevKm > kmAtual) {
      const remainingKm = nextRevKm - kmAtual;
      nextRevisionText = `Em ${remainingKm.toLocaleString("pt-BR")} km`;
    }

    const lastRouteText = lastTrip && lastTrip.origin && lastTrip.destination
      ? `${lastTrip.origin} → ${lastTrip.destination}`
      : vehicle.ultimaRota || "Sem rota registrada";

    const lastFuelingText = lastFueling
      ? `${formatDate(getFuelingDate(lastFueling))} · ${Number(lastFueling.litros || 0)} L`
      : "Sem registro";

    return {
      id: vehicle.id,
      title,
      modelo: vehicle.modelo || vehicle.nome || "",
      placa: vehicle.placa || "SEM PLACA",
      tipo: vehicle.tipo || "onibus",
      capacidade: Number(vehicle.capacidade || vehicle.lugares || 0),
      consumoKmPorLitro: Number(vehicle.consumoKmPorLitro || 0),
      status,
      tank,
      kmAtual,
      lastTripKm,
      revisaoPendente,
      driverName,
      nextRevisionText,
      lastRouteText,
      lastFuelingText,
    };
  }

  function getActiveFleetVehicles() {
    return (state.data.vehicles || []).filter((v) => v.status !== "inativo");
  }

  function renderFuelTanks() {
    const grid = $("#fuelTanksGrid");
    if (!grid) return;

    const rawVehicles = getActiveFleetVehicles();
    const captionEl = $("#fleetDataSourceCaption");
    if (captionEl) {
      captionEl.textContent =
        rawVehicles.length > 0
          ? `${rawVehicles.length} ${rawVehicles.length === 1 ? "veículo ativo na frota" : "veículos ativos na frota"}`
          : "Nenhum veículo ativo cadastrado";
    }

    const totalVehicles = rawVehicles.length;
    const availableCount = rawVehicles.filter(
      (v) => (v.statusOperacional || "disponivel") === "disponivel",
    ).length;
    const tripCount = rawVehicles.filter(
      (v) => (v.statusOperacional || "disponivel") === "em_viagem",
    ).length;
    const maintenanceCount = rawVehicles.filter(
      (v) => (v.statusOperacional || "disponivel") === "manutencao",
    ).length;
    const reserveCount = rawVehicles.filter((v) => {
      const m = calculateTankMetrics({ fuelLevelL: v.fuelLevelL, tankCapacityL: v.tankCapacityL });
      return m.hasCapacity && m.percent < 25;
    }).length;

    const pct = (count) => (totalVehicles > 0 ? Math.round((count / totalVehicles) * 100) : 0);

    if ($("#fuelSummaryTotal")) {
      $("#fuelSummaryTotal").textContent = `${totalVehicles} ${totalVehicles === 1 ? "veículo" : "veículos"}`;
    }
    if ($("#fuelSummaryAvailable")) {
      $("#fuelSummaryAvailable").textContent = `${availableCount} ${availableCount === 1 ? "disponível" : "disponíveis"}`;
    }
    if ($("#fuelSummaryAvailablePct")) {
      $("#fuelSummaryAvailablePct").textContent = `${pct(availableCount)}% da frota`;
    }
    if ($("#fuelSummaryTrip")) {
      $("#fuelSummaryTrip").textContent = `${tripCount} em viagem`;
    }
    if ($("#fuelSummaryTripPct")) {
      $("#fuelSummaryTripPct").textContent = `${pct(tripCount)}% da frota`;
    }
    if ($("#fuelSummaryMaintenance")) {
      $("#fuelSummaryMaintenance").textContent = `${maintenanceCount} em manutenção`;
    }
    if ($("#fuelSummaryMaintenancePct")) {
      $("#fuelSummaryMaintenancePct").textContent = `${pct(maintenanceCount)}% da frota`;
    }
    if ($("#fuelSummaryReserve")) {
      $("#fuelSummaryReserve").textContent = String(reserveCount);
    }

    if (totalVehicles === 0) {
      grid.innerHTML = `
        <div class="tank-empty-state col-span-full py-12">
          <svg class="w-10 h-10 text-slate-300 mb-2 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="3" width="16" height="15" rx="2" stroke-width="1.6" />
            <path stroke-width="1.6" d="M4 11h16M8 15h.01M16 15h.01M6 18v3M18 18v3" />
          </svg>
          <p class="font-semibold text-slate-800 text-base">Nenhum veículo cadastrado na frota</p>
          <p class="muted text-sm mt-1 mb-4">Cadastre os veículos da Garcia Turismo para acompanhar combustível, odômetro e disponibilidade.</p>
          <button type="button" class="fleet-btn-new-vehicle mx-auto" data-vehicle-action="new-vehicle">
            + Cadastrar veículo
          </button>
        </div>
      `;
      return;
    }

    let filtered = rawVehicles.filter((v) => {
      const status = v.statusOperacional || "disponivel";
      if (currentFuelFilter === "disponivel" || currentFuelFilter === "disponiveis") {
        return status === "disponivel";
      }
      if (currentFuelFilter === "em_viagem") {
        return status === "em_viagem";
      }
      if (currentFuelFilter === "manutencao") {
        return status === "manutencao";
      }
      if (currentFuelFilter === "indisponiveis") {
        return status !== "disponivel";
      }
      if (currentFuelFilter === "reserva") {
        const m = calculateTankMetrics({ fuelLevelL: v.fuelLevelL, tankCapacityL: v.tankCapacityL });
        return m.hasCapacity && m.percent < 25;
      }
      return true;
    });

    if (currentSearchQuery.trim()) {
      const query = currentSearchQuery.trim().toLowerCase();
      filtered = filtered.filter((v) => {
        const target = `${v.nome || ""} ${v.modelo || ""} ${v.placa || ""} ${v.cor || ""} ${v.ano || ""}`.toLowerCase();
        return target.includes(query);
      });
    }

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="tank-empty-state col-span-full py-12">
          <svg class="w-10 h-10 text-slate-300 mb-2 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p class="font-semibold text-slate-700">Nenhum veículo encontrado para este filtro.</p>
          <p class="muted text-sm mt-1">Limpe a busca ou selecione outro status.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((rawVehicle) => {
      const card = resolveCardData(rawVehicle);
      const { tank, status } = card;
      const pctValue = tank.hasCapacity ? Math.round(tank.percent) : 0;

      // Cor dinâmica da barra de progresso: Verde > 50%, Amarelo 25% a 50%, Vermelho < 25%
      let fuelColorClass = "fleet-fuel-bar--high";
      if (!tank.hasCapacity || pctValue < 25) {
        fuelColorClass = "fleet-fuel-bar--critical";
      } else if (pctValue <= 50) {
        fuelColorClass = "fleet-fuel-bar--medium";
      }

      let statusBadgeHtml = "";
      let dotColorClass = "fleet-dot--available";
      if (status === "disponivel") {
        statusBadgeHtml = `<span class="fleet-status-pill fleet-status-pill--available"><span class="fleet-status-dot"></span>Disponível</span>`;
        dotColorClass = "fleet-dot--available";
      } else if (status === "em_viagem") {
        statusBadgeHtml = `<span class="fleet-status-pill fleet-status-pill--trip"><span class="fleet-status-dot"></span>Em viagem</span>`;
        dotColorClass = "fleet-dot--trip";
      } else {
        statusBadgeHtml = `<span class="fleet-status-pill fleet-status-pill--maintenance"><span class="fleet-status-dot"></span>Manutenção</span>`;
        dotColorClass = "fleet-dot--maintenance";
      }

      return `
        <article class="fleet-vehicle-card" data-vehicle-id="${escapeHtml(card.id)}">
          <!-- 1. Topo do Card -->
          <div class="fleet-card-top">
            <div class="fleet-card-identity">
              <div class="fleet-vehicle-icon-box">
                ${renderVehicleTypeIcon(card.tipo)}
              </div>
              <div class="min-w-0">
                <h2 class="fleet-vehicle-title">${escapeHtml(card.title)}</h2>
                <p class="fleet-vehicle-plate">${escapeHtml(card.placa)}</p>
              </div>
            </div>
            <div class="shrink-0">
              ${statusBadgeHtml}
            </div>
          </div>

          <hr class="fleet-card-divider" />

          <!-- 2. Seção de Combustível -->
          <div class="fleet-fuel-section">
            ${tank.hasCapacity ? `
              <div class="fleet-fuel-header">
                <div class="fleet-fuel-label">
                  <svg class="fleet-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 22L15 22" />
                    <path d="M4 9L14 9" />
                    <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" />
                    <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" />
                  </svg>
                  <span>Combustível</span>
                </div>
                <div class="fleet-fuel-percent">${pctValue}%</div>
              </div>

              <div
                class="fleet-fuel-progress-track"
                role="progressbar"
                aria-valuenow="${pctValue}"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label="Nível de combustível de ${escapeHtml(card.title)}: ${pctValue}%"
              >
                <div class="fleet-fuel-progress-fill ${fuelColorClass}" style="width: ${Math.max(pctValue, 4)}%"></div>
              </div>

              <div class="fleet-fuel-meta">
                <span><strong>${Number(tank.level).toFixed(0)} L</strong> de ${tank.capacity} L</span>
                <span class="fleet-fuel-capacity">Capacidade do tanque: ${tank.capacity} L</span>
              </div>
            ` : `
              <div class="fleet-fuel-missing-compact">
                <div class="fleet-fuel-missing-info">
                  <svg class="fleet-icon-sm text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 22L15 22" />
                    <path d="M4 9L14 9" />
                    <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" />
                    <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" />
                  </svg>
                  <span>Tanque não informado</span>
                </div>
                <button
                  type="button"
                  class="fleet-fuel-missing-btn"
                  data-vehicle-action="edit"
                  data-id="${escapeHtml(card.id)}"
                >
                  Completar cadastro
                </button>
              </div>
            `}
          </div>

          <hr class="fleet-card-divider" />

          <!-- 3. Seção de Quilometragem (Odômetro & Viagem / Alerta) -->
          <div class="fleet-odometer-section">
            <div class="fleet-odometer-block">
              <div class="fleet-odometer-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 14l4-4" />
                  <path d="M3.34 19a10 10 0 1 1 17.32 0" />
                </svg>
              </div>
              <div>
                <div class="fleet-odometer-label">Odômetro atual</div>
                <div class="fleet-odometer-value">${card.kmAtual.toLocaleString("pt-BR")} km</div>
              </div>
            </div>

            <div class="fleet-odometer-divider" aria-hidden="true"></div>

            <div class="fleet-trip-or-alert-block">
              ${card.revisaoPendente ? `
                <div class="fleet-revision-alert">
                  <svg class="fleet-revision-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                  <span>Revisão pendente</span>
                </div>
              ` : `
                <div class="fleet-last-trip-box">
                  <div class="fleet-road-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.5 3L5 21h4.5l1.5-18H9.5zm5 0L13 21h1.5L19 3h-4.5zM11.5 4h1v3h-1V4zm0 6h1v4h-1v-4zm0 7h1v3h-1v-3z" />
                    </svg>
                  </div>
                  <div>
                    <div class="fleet-last-trip-label">Última viagem</div>
                    <div class="fleet-last-trip-value">${card.lastTripKm > 0 ? `${card.lastTripKm.toLocaleString("pt-BR")} km` : "Sem viagem"}</div>
                  </div>
                </div>
              `}
            </div>
          </div>

          <hr class="fleet-card-divider" />

          <!-- 4. Resumo Operacional -->
          <div class="fleet-operational-section">
            <h3 class="fleet-operational-heading">Resumo operacional</h3>

            <ul class="fleet-operational-list">
              <li class="fleet-operational-row">
                <span class="fleet-operational-key">
                  <svg class="fleet-op-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd" />
                  </svg>
                  <span>Motorista</span>
                </span>
                <span class="fleet-operational-val ${card.driverName !== "Não escalado" ? "is-strong" : ""}">
                  ${escapeHtml(card.driverName)}
                </span>
              </li>

              <li class="fleet-operational-row">
                <span class="fleet-operational-key">
                  <svg class="fleet-op-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                  <span>Próxima revisão</span>
                </span>
                <span class="fleet-operational-val ${card.revisaoPendente ? "is-danger" : ""}">
                  ${escapeHtml(card.nextRevisionText)}
                </span>
              </li>

              <li class="fleet-operational-row">
                <span class="fleet-operational-key">
                  <svg class="fleet-op-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                  </svg>
                  <span>Última rota</span>
                </span>
                <span class="fleet-operational-val">
                  ${escapeHtml(card.lastRouteText)}
                </span>
              </li>
            </ul>

            <div class="fleet-last-fuel-row">
              <span class="fleet-operational-key">
                <svg class="fleet-op-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 22L15 22" />
                  <path d="M4 9L14 9" />
                  <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" />
                  <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" />
                </svg>
                <span>Último abastecimento</span>
              </span>
              <span class="fleet-operational-val">
                ${escapeHtml(card.lastFuelingText)}
              </span>
            </div>
          </div>

          <!-- 5. Rodapé de Ações do Card -->
          <div class="fleet-card-actions">
            <div class="fleet-quick-status-wrap">
              <span class="fleet-quick-status-dot ${dotColorClass}" aria-hidden="true"></span>
              <select
                class="fleet-quick-status-select"
                data-vehicle-action="change-status"
                data-id="${escapeHtml(card.id)}"
                aria-label="Alterar status de ${escapeHtml(card.title)}"
              >
                <option value="disponivel" ${status === "disponivel" ? "selected" : ""}>Disponível</option>
                <option value="em_viagem" ${status === "em_viagem" ? "selected" : ""}>Em viagem</option>
                <option value="manutencao" ${status === "manutencao" ? "selected" : ""}>Manutenção</option>
              </select>
            </div>

            <button
              type="button"
              class="fleet-action-btn fleet-action-btn--details"
              data-vehicle-action="details"
              data-id="${escapeHtml(card.id)}"
              title="Ver ficha completa do veículo"
            >
              <svg class="fleet-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Detalhes</span>
            </button>

            <button
              type="button"
              class="fleet-action-btn fleet-action-btn--details"
              data-vehicle-action="edit"
              data-id="${escapeHtml(card.id)}"
              title="Editar cadastro do veículo"
            >
              <svg class="fleet-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>Editar</span>
            </button>

            <button
              type="button"
              class="fleet-action-btn fleet-action-btn--fuel"
              data-vehicle-action="quick-fuel"
              data-id="${escapeHtml(card.id)}"
              title="Lançar abastecimento"
            >
              <svg class="fleet-btn-icon fleet-btn-icon--red" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6 2a2 2 0 0 0-2 2v18h12V4a2 2 0 0 0-2-2H6zm0 3h8v5H6V5zm11 2l3.41 3.41A2 2 0 0 1 21 11.83V17a2.5 2.5 0 0 1-5 0v-3h-1v-2h1.5a1.5 1.5 0 0 1 1.5 1.5V17a.5.5 0 0 0 1 0v-5.17l-2.7-2.7L17 7z" />
              </svg>
              <span>Abastecer</span>
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  async function handleQuickStatusChange(vehicleId, newStatus) {
    const statusLabels = {
      disponivel: "Disponível",
      em_viagem: "Em viagem",
      manutencao: "Manutenção",
    };

    const vehicle = state.data.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;

    try {
      const payload = sanitizeVehiclePayload(vehicle, {
        statusOperacional: newStatus,
      });
      await saveFirestoreRecord("Vehicle", "vehicles", payload);
      onRenderAll();
      showToast(`Status de ${getVehicleName(vehicleId)} alterado para ${statusLabels[newStatus] || newStatus}.`, "success");
    } catch (error) {
      console.error("Erro ao atualizar status do veículo:", error);
      renderFuelTanks();
      showToast(error.message || "Não foi possível atualizar o status do veículo.", "error");
    }
  }

  function handleVehicleDetails(vehicleId) {
    const realVehicle = (state.data.vehicles || []).find((v) => v.id === vehicleId);
    if (!realVehicle) return;

    const card = resolveCardData(realVehicle);
    const modalRoot = $("#modalRoot");
    const modalContent = $("#modalContent");
    if (modalRoot && modalContent) {
      modalRoot.classList.remove("hidden");
      modalRoot.classList.add("flex");
      modalContent.innerHTML = `
        <div class="flex items-center justify-between mb-5">
          <div>
            <h3 class="text-2xl font-bold text-slate-900">${escapeHtml(card.title)}</h3>
            <p class="text-sm muted">Placa: ${escapeHtml(card.placa)} · Capacidade: ${card.capacidade} lugares · Consumo: ${card.consumoKmPorLitro > 0 ? `${card.consumoKmPorLitro} km/L` : "Não informado"}</p>
          </div>
          <button type="button" data-action="close-modal" class="rounded-2xl px-4 py-2.5 btn-secondary font-semibold">Fechar</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div class="metric-card p-4">
            <div class="muted text-xs uppercase font-bold">Combustível Atual</div>
            <div class="text-xl font-bold mt-1">
              ${card.tank.hasCapacity
                ? `${Number(card.tank.level).toFixed(0)} L de ${card.tank.capacity} L (${Math.round(card.tank.percent)}%)`
                : "Tanque não informado"}
            </div>
          </div>
          <div class="metric-card p-4">
            <div class="muted text-xs uppercase font-bold">Odômetro Atual</div>
            <div class="text-xl font-bold mt-1">${card.kmAtual.toLocaleString("pt-BR")} km</div>
          </div>
          <div class="metric-card p-4">
            <div class="muted text-xs uppercase font-bold">Motorista Escalado</div>
            <div class="text-base font-semibold mt-1">${escapeHtml(card.driverName)}</div>
          </div>
          <div class="metric-card p-4">
            <div class="muted text-xs uppercase font-bold">Próxima Revisão</div>
            <div class="text-base font-semibold mt-1 ${card.revisaoPendente ? "text-red-600" : ""}">${escapeHtml(card.nextRevisionText)}</div>
          </div>
          <div class="metric-card p-4">
            <div class="muted text-xs uppercase font-bold">Última Rota</div>
            <div class="text-base font-semibold mt-1">${escapeHtml(card.lastRouteText)}</div>
          </div>
          <div class="metric-card p-4">
            <div class="muted text-xs uppercase font-bold">Último Abastecimento</div>
            <div class="text-base font-semibold mt-1">${escapeHtml(card.lastFuelingText)}</div>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button type="button" data-action="close-modal" class="rounded-2xl px-5 py-3 btn-secondary font-semibold">Fechar</button>
          <button type="button" class="rounded-2xl px-5 py-3 btn-primary font-semibold" data-action="open-entity" data-entity-type="vehicle" data-id="${escapeHtml(card.id)}">Editar cadastro</button>
        </div>
      `;
    }
  }

  function handleVehicleEdit(vehicleId) {
    if (typeof window.openEntityModal === "function") {
      window.openEntityModal("vehicle", vehicleId);
    }
  }

  function handleQuickFuel(vehicleId) {
    const vehicleSelect = $("#fuelVehicle");
    if (vehicleSelect) {
      const hasOption = [...vehicleSelect.options].some((opt) => opt.value === vehicleId);
      if (hasOption) {
        vehicleSelect.value = vehicleId;
        syncFuelLastKm();
        calculateFuelPreview();
      }
      const formSection = $("#fuelLaunchSection") || $("#fuelForm");
      if (formSection) formSection.scrollIntoView({ behavior: "smooth", block: "start" });
      const litersInput = $("#fuelLiters");
      if (litersInput) setTimeout(() => litersInput.focus(), 250);
    }
  }

  function bindFuelTanks() {
    const statusFilterSelect = $("#fleetStatusFilterSelect");
    if (statusFilterSelect) {
      statusFilterSelect.addEventListener("change", (e) => {
        currentFuelFilter = e.target.value;
        renderFuelTanks();
      });
    }

    const searchInput = $("#fleetSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        currentSearchQuery = e.target.value;
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
        const newVehicleBtn = event.target.closest("button[data-vehicle-action='new-vehicle']");
        if (newVehicleBtn) {
          handleVehicleEdit("");
          return;
        }
        const fuelBtn = event.target.closest("button[data-vehicle-action='quick-fuel']");
        if (fuelBtn) {
          handleQuickFuel(fuelBtn.dataset.id);
          return;
        }
        const editBtn = event.target.closest("button[data-vehicle-action='edit']");
        if (editBtn) {
          handleVehicleEdit(editBtn.dataset.id);
          return;
        }
        const detailsBtn = event.target.closest("button[data-vehicle-action='details']");
        if (detailsBtn) {
          handleVehicleDetails(detailsBtn.dataset.id);
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
          await saveFirestoreRecord(
            "Vehicle",
            "vehicles",
            sanitizeVehiclePayload(vehicle, {
              kmAtual: vehicleKmAfterFueling(vehicle, payload),
              fuelLevelL: newFuelLevel,
            }),
          );
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
