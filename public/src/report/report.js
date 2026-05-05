import { SUPABASE_CONFIG } from "../config/supabase-config.js";

const root = document.getElementById("reportRoot");

function money(value = 0) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function previousMonthRange() {
  const now = new Date();
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastPrevMonth = new Date(firstThisMonth.getTime() - 1);
  const firstPrevMonth = new Date(
    lastPrevMonth.getFullYear(),
    lastPrevMonth.getMonth(),
    1,
  );

  return {
    start: firstPrevMonth.toISOString().slice(0, 10),
    end: lastPrevMonth.toISOString().slice(0, 10),
    label: firstPrevMonth.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    }),
  };
}

async function loadData() {
  const response = await fetch(
    `${SUPABASE_CONFIG.url}/rest/v1/app_states?id=eq.${SUPABASE_CONFIG.stateId}&select=data`,
    {
      headers: {
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = await response.json();
  return rows?.[0]?.data;
}

function getVehicleName(data, id) {
  const vehicle = (data.vehicles || []).find((item) => item.id === id);
  if (!vehicle) return "-";
  return `${vehicle.modelo || ""} ${vehicle.ano || ""} - ${vehicle.cor || ""}`;
}

function buildRows(data, vehicleId = "") {
  const { start, end } = previousMonthRange();

  const expenses = (data.expenses || [])
    .filter((item) => item.data >= start && item.data <= end)
    .filter((item) => !vehicleId || item.veiculoId === vehicleId)
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
    .filter((item) => item.data >= start && item.data <= end)
    .filter((item) => !vehicleId || item.veiculoId === vehicleId)
    .map((item) => ({
      data: item.data,
      tipo: "Combustível",
      categoria: "Abastecimento",
      descricao: `${item.litros || 0} L • ${item.mediaKmLitro || 0} km/l`,
      veiculo: getVehicleName(data, item.veiculoId),
      funcionario: "-",
      pagamento: item.paymentMethod || "-",
      status: item.status === "pago" ? "Pago" : "A pagar",
      valor: Number(item.valorTotal || 0),
    }));

  return [...expenses, ...fuelings].sort((a, b) =>
    String(a.data).localeCompare(String(b.data)),
  );
}

function renderReport(data, options = {}) {
  const { label } = previousMonthRange();
  const rows = buildRows(data, options.vehicleId || "");

  const total = rows.reduce((sum, item) => sum + item.valor, 0);

  root.innerHTML = `
    <section id="reportArea" class="card p-6 space-y-5 bg-white">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
         <img 
  src="./assets/GARCIA TURISMO.png" 
  alt="Garcia Turismo" 
  class="w-20 h-20 object-contain rounded-2xl bg-white p-2 shadow-sm"
/>

          <div>
            <h1 class="text-2xl font-semibold">
              ${options.title || "Relatórios financeiros"}
            </h1>
            <p class="muted mt-1">
              Garcia Turismo • ${label}
            </p>
          </div>
        </div>

        <div class="chip">PDF automático</div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="metric-card p-4">
          <div class="text-sm muted">Total filtrado</div>
          <div class="text-2xl font-semibold mt-1">${money(total)}</div>
        </div>

        <div class="metric-card p-4">
          <div class="text-sm muted">Qtd. lançamentos</div>
          <div class="text-2xl font-semibold mt-1">${rows.length}</div>
        </div>

        <div class="metric-card p-4">
          <div class="text-sm muted">Gerado em</div>
          <div class="text-base font-semibold mt-2">${new Date().toLocaleString("pt-BR")}</div>
        </div>
      </div>

      <div class="table-wrap text-[12px] md:text-[13px]">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Veículo</th>
              <th>Funcionário</th>
              <th>Pagamento</th>
              <th>Status</th>
              <th class="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (item) => `
                        <tr>
                          <td>${formatDate(item.data)}</td>
                          <td>${item.tipo}</td>
                          <td>${item.categoria}</td>
                          <td>${item.descricao}</td>
                          <td>${item.veiculo}</td>
                          <td>${item.funcionario}</td>
                          <td>${item.pagamento}</td>
                          <td>${item.status}</td>
                          <td class="text-right">${money(item.valor)}</td>
                        </tr>
                      `,
                    )
                    .join("")
                : `<tr><td colspan="9" class="text-center muted py-6">Nenhum lançamento encontrado.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  const vehicleId = params.get("vehicleId") || "";
  const title = params.get("title") || "";

  const data = await loadData();

  renderReport(data, {
    vehicleId,
    title: title || undefined,
  });
}

main().catch((error) => {
  root.innerHTML = `
    <div class="card p-6">
      <h1 class="text-xl font-semibold text-red-600">Erro ao carregar relatório</h1>
      <pre class="mt-4 whitespace-pre-wrap text-sm">${String(error.message || error)}</pre>
    </div>
  `;
});
