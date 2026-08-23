export function renderRelatoriosTab() {
  return `
    <section id="tab-relatorios" class="tab-pane hidden-section fade-in space-y-6">
      <div id="reportArea" class="card p-6 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <img loading="lazy" id="reportLogo" alt="Garcia Turismo" class="logo-report" />
            <div>
              <h2 class="text-2xl font-semibold">Relatórios financeiros</h2>
              <p class="muted mt-1">Lista única com despesas, combustível e pagamentos futuros.</p>
            </div>
          </div>

          <button id="exportPdfBtn" type="button" class="rounded-2xl px-5 py-4 btn-primary font-semibold no-print">
            Gerar PDF
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
          <div>
            <label class="block text-sm font-medium mb-2">Mês</label>
            <input id="reportMonth" type="month" class="field" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Veículo</label>
            <select id="reportVehicle" class="field">
              <option value="">Todos</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Funcionário</label>
            <select id="reportEmployee" class="field">
              <option value="">Todos</option>
            </select>
          </div>

          <div class="flex items-end">
            <button id="applyFiltersBtn" type="button" class="w-full rounded-2xl px-4 py-4 btn-secondary font-semibold">
              Aplicar filtros
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="metric-card p-4">
            <div class="text-sm muted">Total filtrado</div>
            <div id="reportTotal" class="text-2xl font-semibold mt-1">R$ 0,00</div>
          </div>

          <div class="metric-card p-4">
            <div class="text-sm muted">Qtd. lançamentos</div>
            <div id="reportCount" class="text-2xl font-semibold mt-1">0</div>
          </div>

          <div class="metric-card p-4">
            <div class="text-sm muted">Gerado em</div>
            <div id="reportGeneratedAt" class="text-base font-semibold mt-2">-</div>
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
                <th class="text-right no-print">Ações</th>
              </tr>
            </thead>
            <tbody id="reportTable"></tbody>
          </table>
        </div>
      </div>

      <div id="fuelingReportArea" class="card p-6 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-semibold">Relatório de Abastecimentos</h2>
            <p class="muted mt-1">Consumo, custos e médias por período e veículo.</p>
          </div>

          <button id="exportFuelReportPdfBtn" type="button" class="rounded-2xl px-5 py-4 btn-primary font-semibold no-print">
            Gerar PDF de abastecimentos
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
          <div>
            <label class="block text-sm font-medium mb-2">Data inicial</label>
            <input id="fuelReportStart" type="date" class="field" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Data final</label>
            <input id="fuelReportEnd" type="date" class="field" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Veículo</label>
            <select id="fuelReportVehicle" class="field">
              <option value="">Todos os veículos</option>
            </select>
          </div>

          <div class="flex items-end">
            <button id="applyFuelReportFiltersBtn" type="button" class="w-full rounded-2xl px-4 py-4 btn-secondary font-semibold">
              Aplicar filtros
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div class="text-sm font-semibold">Período: <span id="fuelReportPeriod">Todos os registros</span></div>
            <div class="muted text-sm mt-1">Filtro: <span id="fuelReportVehicleLabel">Todos os veículos</span></div>
          </div>
          <div class="chip"><span id="fuelReportCount">0</span> abastecimentos</div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div class="metric-card p-4">
            <div class="text-sm muted">Total abastecido</div>
            <div id="fuelReportLiters" class="text-xl font-semibold mt-1">0 L</div>
          </div>
          <div class="metric-card p-4">
            <div class="text-sm muted">Total gasto</div>
            <div id="fuelReportTotal" class="text-xl font-semibold mt-1">R$ 0,00</div>
          </div>
          <div class="metric-card p-4">
            <div class="text-sm muted">Distância total</div>
            <div id="fuelReportDistance" class="text-xl font-semibold mt-1">0 km</div>
          </div>
          <div class="metric-card p-4">
            <div class="text-sm muted">Preço médio/L</div>
            <div id="fuelReportPrice" class="text-xl font-semibold mt-1">R$ 0,00</div>
          </div>
          <div class="metric-card p-4">
            <div class="text-sm muted">Média de consumo</div>
            <div id="fuelReportAverage" class="text-xl font-semibold mt-1">0,00 km/l</div>
          </div>
        </div>

        <div class="table-wrap text-[12px] md:text-[13px]">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Veículo</th>
                <th>KM anterior</th>
                <th>KM atual</th>
                <th>Distância</th>
                <th>Litros</th>
                <th>Valor total</th>
                <th>Preço/L</th>
                <th>Média km/L</th>
                <th>Pagamento</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="fuelReportTable"></tbody>
          </table>
        </div>

        <div id="fuelReportVehicleSummary"></div>
      </div>
    </section>
  `;
}
