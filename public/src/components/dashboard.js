export function renderDashboardTab() {
  return `
    <section id="tab-inicio" class="tab-pane fade-in space-y-6">
      <div class="grid grid-cols-1 xl:grid-cols-[1.35fr_.65fr] gap-6">
        <div class="card p-6">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="chip">Garcia Turismo • Visão geral</div>
            <button id="openQuickExpense" class="rounded-2xl px-5 py-4 btn-primary font-semibold no-print">
              Nova despesa
            </button>
          </div>

          <div class="grid md:grid-cols-2 gap-4 mt-8">
            <div class="metric-card p-5">
              <p class="text-sm muted">Receita prevista</p>
              <h3 id="kpiReceitas" class="text-3xl font-semibold mt-2 break-words">R$ 0,00</h3>
            </div>

            <div class="metric-card p-5">
              <p class="text-sm muted">Despesas do mês</p>
              <h3 id="kpiDespesas" class="text-3xl font-semibold mt-2 break-words">R$ 0,00</h3>
            </div>

            <div class="metric-card p-5">
              <p class="text-sm muted">Saldo projetado</p>
              <h3 id="kpiSaldo" class="text-3xl font-semibold mt-2 break-words">R$ 0,00</h3>
            </div>

            <div class="metric-card p-5">
              <p class="text-sm muted">Viagens no mês</p>
              <h3 id="kpiViagens" class="text-3xl font-semibold mt-2">0</h3>
            </div>
          </div>
        </div>

        <div class="card p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h2 class="text-xl font-semibold">Resumo rápido</h2>
            <div class="chip">Hoje</div>
          </div>

          <div class="space-y-4 text-sm">
            <div class="rounded-2xl bg-white/70 border border-white p-4">
              <div class="muted">Veículos ativos</div>
              <div id="resumoVeiculos" class="text-2xl font-semibold mt-1">0</div>
            </div>

            <div class="rounded-2xl bg-white/70 border border-white p-4">
              <div class="muted">Funcionários ativos</div>
              <div id="resumoFuncionarios" class="text-2xl font-semibold mt-1">0</div>
            </div>

            <div class="rounded-2xl bg-white/70 border border-white p-4">
              <div class="muted">Último abastecimento</div>
              <div id="resumoUltimoAbastecimento" class="text-base font-semibold mt-1">
                Sem registro
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div class="card p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-xl font-semibold">Gastos por categoria</h3>
              <p class="muted text-sm mt-1">Distribuição operacional dos custos</p>
            </div>
            <div class="chip">Operacional</div>
          </div>

          <div class="h-[320px]">
            <canvas id="chartCategorias"></canvas>
          </div>
        </div>

        <div class="card p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-xl font-semibold">Gastos por veículo</h3>
              <p class="muted text-sm mt-1">Participação de cada veículo nos custos</p>
            </div>
            <div class="chip">Frota</div>
          </div>

          <div class="h-[320px]">
            <canvas id="chartVeiculos"></canvas>
          </div>
        </div>
      </div>
    </section>
  `;
}
