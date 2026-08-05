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
  return payload;
}

function getVehicleName(data, id) {
  const vehicle = (data.vehicles || []).find((item) => String(item.id) === String(id));
  if (!vehicle) return "-";
  return `${vehicle.modelo || ""} ${vehicle.ano || ""} - ${vehicle.cor || ""}`.trim();
}

function buildRows(data, period, vehicleId = "") {
  const inPeriod = (item) => item.data >= period.start && item.data <= period.end;
  const matchesVehicle = (item) => !vehicleId || String(item.veiculoId) === String(vehicleId);

  const expenses = (data.expenses || [])
    .filter(inPeriod)
    .filter(matchesVehicle)
    .map((item) => ({
      data: item.data,
      tipo: "Despesa",
      categoria: item.categoria || "-",
      descricao: item.descricao || item.descricaoGasto || "-",
      veiculo: getVehicleName(data, item.veiculoId),
      funcionario: "-",
      pagamento: item.paymentMethod || "-",
      status: item.status === "pago" ? "Pago" : "A pagar",
      valor: Number(item.valor || 0),
    }));

  const fuelings = (data.fuelings || [])
    .filter(inPeriod)
    .filter(matchesVehicle)
    .map((item) => ({
      data: item.data,
      tipo: "Combustível",
      categoria: "Abastecimento",
      descricao: `${Number(item.litros || 0)} L • ${Number(item.mediaKmLitro || 0)} km/l`,
      veiculo: getVehicleName(data, item.veiculoId),
      funcionario: "-",
      pagamento: item.paymentMethod || "-",
      status: item.status === "pago" ? "Pago" : "A pagar",
      valor: Number(item.valorTotal || 0),
    }));

  return [...expenses, ...fuelings].sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

function renderReport(data, period, options = {}) {
  const rows = buildRows(data, period, options.vehicleId || "");
  const total = rows.reduce((sum, item) => sum + item.valor, 0);
  const safeTitle = escapeHtml(options.title || "Relatório financeiro mensal");
  const safeLabel = escapeHtml(period.label);
  const safeVehicle = escapeHtml(options.vehicleName || "Consolidado da operação");

  root.innerHTML = `
    <section id="reportArea" class="card p-6 report-document">
      <header class="report-document__header">
        <div class="report-document__brand">
          <img src="./assets/GARCIA TURISMO.png" alt="Garcia Turismo" class="report-document__logo" />
          <div>
            <p class="report-document__eyebrow">Garcia Turismo · Financeiro</p>
            <h1 class="report-document__title">${safeTitle}</h1>
            <p class="report-document__period">${safeVehicle} · ${safeLabel}</p>
          </div>
        </div>
        <div class="chip report-document__tag">Relatório mensal</div>
      </div>
      <div class="report-document__metrics">
        <div class="metric-card report-document__metric">
          <div class="report-document__metric-label">Total do período</div>
          <div class="report-document__metric-value">${money(total)}</div>
        </div>
        <div class="metric-card report-document__metric">
          <div class="report-document__metric-label">Lançamentos</div>
          <div class="report-document__metric-value">${rows.length}</div>
        </div>
        <div class="metric-card report-document__metric">
          <div class="report-document__metric-label">Emitido em</div>
          <div class="report-document__metric-value text-base">${escapeHtml(new Date().toLocaleString("pt-BR"))}</div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th>
              <th>Veículo</th><th>Funcionário</th><th>Pagamento</th><th>Status</th>
              <th class="text-right">Valor</th>
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
                  <td>${escapeHtml(item.funcionario)}</td>
                  <td>${escapeHtml(item.pagamento)}</td>
                  <td>${escapeHtml(item.status)}</td>
                  <td class="text-right">${escapeHtml(money(item.valor))}</td>
                </tr>`).join("")
              : '<tr><td colspan="9" class="report-document__empty">Nenhum lançamento encontrado para este veículo no período.</td></tr>'}
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

  renderReport(data, period, {
    vehicleId: requestedVehicleId,
    title: vehicle ? `Relatório mensal — ${vehicle.name}` : "Relatório financeiro mensal",
    vehicleName: vehicle?.name,
  });

  await document.fonts?.ready;
  window.__GARCIA_REPORT_STATUS__ = { ready: true, error: null };
}

main().catch((error) => {
  const message = String(error?.message || error);
  window.__GARCIA_REPORT_STATUS__ = { ready: false, error: message };
  root.textContent = "";
  const wrapper = document.createElement("div");
  wrapper.className = "card p-6";
  const title = document.createElement("h1");
  title.className = "text-xl font-semibold text-red-600";
  title.textContent = "Erro ao carregar relatório";
  const details = document.createElement("pre");
  details.className = "mt-4 whitespace-pre-wrap text-sm";
  details.textContent = message;
  wrapper.append(title, details);
  root.append(wrapper);
});
