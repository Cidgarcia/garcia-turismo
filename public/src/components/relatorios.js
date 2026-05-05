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
    </section>
  `;
}
