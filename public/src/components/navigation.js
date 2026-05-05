export function renderNavigation() {
  return `
      <header class="sticky top-0 z-30 px-4 md:px-6 py-4 no-print">
        <div class="max-w-7xl mx-auto glass rounded-[30px] px-4 py-4 flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
          <div class="flex items-center gap-4 min-w-0">
            <img loading="lazy" id="headerLogo" alt="Garcia Turismo" class="logo-header shrink-0" />
            <div class="hidden md:block">
              <p class="text-sm muted">Sistema financeiro e frota</p>
              <p class="text-lg font-semibold">Painel administrativo</p>
            </div>
          </div>
          <div class="dashboard-nav">
            <button class="nav-chip active" data-tab="inicio">Início</button>
            <button class="nav-chip" data-tab="despesas">Despesas</button>
            <button class="nav-chip" data-tab="abastecimento">Abastecimento</button>
            <button class="nav-chip" data-tab="cadastros">Cadastros</button>
            <button class="nav-chip" data-tab="viagens">Viagens</button>
            <button class="nav-chip" data-tab="pendentes">Pendentes</button>
            <button class="nav-chip" data-tab="relatorios">Relatórios</button>
            <button id="logoutBtn" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Sair</button>
          </div>
        </div>
      </header>
  `;
}
