import { APP_CONFIG } from "../config/app-config.js";

export function renderNavigation() {
  return `
      <header class="fleet-top-header sticky top-0 z-30 no-print">
        <div class="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <!-- Lado Esquerdo: Logotipo Oficial Garcia Turismo -->
          <div class="flex items-center gap-3 shrink-0">
            <a href="#abastecimento" class="garcia-brand-logo-link" data-tab-trigger="abastecimento" aria-label="Garcia Turismo">
              <img
                id="headerLogo"
                src="${APP_CONFIG.logoPath}"
                alt="Garcia Turismo"
                class="logo-header-official"
              />
            </a>
          </div>

          <!-- Navegação Central -->
          <nav class="fleet-main-nav" aria-label="Navegação principal">
            <button type="button" class="fleet-nav-item nav-chip" data-tab="inicio">
              <svg class="fleet-nav-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
                <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
              </svg>
              <span>Visão geral</span>
            </button>

            <button type="button" class="fleet-nav-item nav-chip active" data-tab="abastecimento">
              <svg class="fleet-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="4" y="3" width="16" height="15" rx="2" />
                <path d="M4 11h16" />
                <path d="M8 15h.01" />
                <path d="M16 15h.01" />
                <path d="M6 18v3" />
                <path d="M18 18v3" />
              </svg>
              <span>Frota</span>
            </button>

            <button type="button" class="fleet-nav-item nav-chip" data-tab="viagens">
              <svg class="fleet-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="6" cy="19" r="2.5" />
                <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
                <circle cx="18" cy="5" r="2.5" />
              </svg>
              <span>Viagens</span>
            </button>

            <div class="fleet-nav-dropdown-wrap">
              <button type="button" class="fleet-nav-item nav-chip" data-tab="despesas" id="financeNavBtn">
                <svg class="fleet-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                <span>Financeiro</span>
              </button>
            </div>
          </nav>

          <!-- Lado Direito: Avatar do Usuário com Menu Dropdown -->
          <div class="relative shrink-0" id="userMenuWrapper">
            <button
              type="button"
              id="userMenuBtn"
              class="fleet-avatar-btn"
              aria-expanded="false"
              aria-haspopup="true"
              title="Menu do usuário e atalhos"
            >
              <span class="fleet-avatar-circle">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd" />
                </svg>
              </span>
              <svg class="w-4 h-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
              </svg>
            </button>

            <div id="userDropdownMenu" class="fleet-user-dropdown hidden-section" role="menu">
              <div class="px-3 py-2 border-b border-slate-100">
                <p id="userProfileNameLabel" class="text-xs font-bold text-slate-800">Painel Garcia Turismo</p>
                <p id="userProfileRoleLabel" class="text-[11px] text-slate-500">Módulos do sistema</p>
              </div>
              <button type="button" class="fleet-dropdown-item nav-chip" data-tab="inicio" role="menuitem">
                <span>🏠 Visão geral</span>
              </button>
              <button type="button" class="fleet-dropdown-item nav-chip" data-tab="abastecimento" role="menuitem">
                <span>🚌 Gestão da frota</span>
              </button>
              <button type="button" class="fleet-dropdown-item nav-chip" data-tab="viagens" role="menuitem">
                <span>🗺️ Viagens e Orçamentos</span>
              </button>
              <button type="button" class="fleet-dropdown-item nav-chip" data-tab="despesas" role="menuitem">
                <span>💸 Despesas e Salários</span>
              </button>
              <button type="button" class="fleet-dropdown-item nav-chip" data-tab="pendentes" role="menuitem">
                <span>⏳ Contas Pendentes</span>
              </button>
              <button type="button" class="fleet-dropdown-item nav-chip" data-tab="relatorios" role="menuitem">
                <span>📊 Relatórios e PDF</span>
              </button>
              <button type="button" class="fleet-dropdown-item nav-chip" data-tab="cadastros" role="menuitem">
                <span>🗂️ Cadastros Gerais</span>
              </button>
              <div class="border-t border-slate-100 mt-1 pt-1">
                <button type="button" id="logoutBtn" class="fleet-dropdown-item text-red-600 font-semibold" role="menuitem">
                  <span>🚪 Sair do sistema</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
  `;
}
