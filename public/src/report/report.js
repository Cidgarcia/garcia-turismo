import { buildReportRows } from "./report-data.js";

const root = document.getElementById("reportRoot");
window.__GARCIA_REPORT_STATUS__ = { ready: false, error: null };

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

function money(value = 0) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "-";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
}

function loadPayload() {
  const payload = window.__GARCIA_REPORT_PAYLOAD__;
  if (!payload?.data || !payload?.period) {
    throw new Error("Dados do relatório não foram fornecidos pela automação segura.");
  }
  if (payload.vehicle !== null && (!payload.vehicle?.id || !payload.vehicle?.name)) {
    throw new Error("O veículo do relatório individual está incompleto.");
  }
  return payload;
}

function renderReport(data, period, vehicle = null) {
  const rows = buildReportRows(data, period, vehicle);
  const total = rows.reduce((sum, item) => sum + item.valor, 0);
  const safeTitle = escapeHtml(vehicle ? `Relatório mensal — ${vehicle.name}` : "Relatório financeiro mensal");
  const safeVehicle = escapeHtml(vehicle?.name || "Consolidado da operação");
  const safeLabel = escapeHtml(period.label);
  const emptyMessage = vehicle
    ? "Nenhum lançamento encontrado para este veículo no período."
    : "Nenhum lançamento encontrado no período.";

  root.innerHTML = `
    <section id="reportArea" class="report-document">
      <header class="report-document__header">
        <div class="report-document__logo-crop" aria-hidden="true">
          <img src="./assets/GARCIA TURISMO.png" alt="" class="report-document__logo" />
        </div>
        <div class="report-document__heading">
          <p class="report-document__eyebrow">Garcia Turismo · Financeiro</p>
          <h1 class="report-document__title">${safeTitle}</h1>
          <p class="report-document__vehicle">${safeVehicle}</p>
        </div>
        <div class="report-document__period">
          <span>Período</span>
          <strong>${safeLabel}</strong>
        </div>
      </header>
      <div class="report-document__metrics">
        <div class="report-document__metric">
          <div class="report-document__metric-label">Total do período</div>
          <div class="report-document__metric-value">${money(total)}</div>
        </div>
        <div class="report-document__metric">
          <div class="report-document__metric-label">Lançamentos</div>
          <div class="report-document__metric-value">${rows.length}</div>
        </div>
        <div class="report-document__metric">
          <div class="report-document__metric-label">Emitido em</div>
          <div class="report-document__metric-value report-document__metric-value--date">${escapeHtml(new Date().toLocaleString("pt-BR"))}</div>
        </div>
      </div>
      <div class="report-document__table-wrap">
        <table class="report-document__table">
          <colgroup>
            <col class="report-document__col-date" />
            <col class="report-document__col-type" />
            <col class="report-document__col-category" />
            <col class="report-document__col-description" />
            <col class="report-document__col-vehicle" />
            <col class="report-document__col-payment" />
            <col class="report-document__col-status" />
            <col class="report-document__col-value" />
          </colgroup>
          <thead>
            <tr>
              <th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th>
              <th>Veículo</th><th>Pagamento</th><th>Status</th><th class="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length
              ? rows.map((item) => `
                <tr>
                  <td>${escapeHtml(formatDate(item.data))}</td>
                  <td>${escapeHtml(item.tipo)}</td>
                  <td>${escapeHtml(item.categoria)}</td>
                  <td>${escapeHtml(item.descricao)}</td>
                  <td>${escapeHtml(item.veiculo)}</td>
                  <td>${escapeHtml(item.pagamento)}</td>
                  <td>${escapeHtml(item.status)}</td>
                  <td class="text-right">${escapeHtml(money(item.valor))}</td>
                </tr>`).join("")
              : `<tr><td colspan="8" class="report-document__empty">${emptyMessage}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>`;
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  const { data, period, vehicle } = loadPayload();
  const requestedVehicleId = params.get("vehicleId") || "";

  if (requestedVehicleId && String(vehicle?.id || "") !== requestedVehicleId) {
    throw new Error("O veículo solicitado não corresponde ao contexto seguro do relatório.");
  }

  renderReport(data, period, vehicle || null);
  await document.fonts?.ready;
  window.__GARCIA_REPORT_STATUS__ = { ready: true, error: null };
}

main().catch((error) => {
  const message = String(error?.message || error);
  window.__GARCIA_REPORT_STATUS__ = { ready: false, error: message };
  root.textContent = "";
  const wrapper = document.createElement("div");
  wrapper.className = "report-document report-document--error";
  const title = document.createElement("h1");
  title.textContent = "Erro ao carregar relatório";
  const details = document.createElement("pre");
  details.textContent = message;
  wrapper.append(title, details);
  root.append(wrapper);
});
