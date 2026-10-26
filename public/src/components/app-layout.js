import { renderLoginScreen } from "./login.js";
import { renderNavigation } from "./navigation.js";
import { renderDashboardTab } from "./dashboard.js";
import { renderDespesasTab } from "./despesas.js";
import { renderAbastecimentoTab } from "./abastecimento.js";
import { renderCadastrosTab } from "./cadastros.js";
import { renderViagensTab } from "./viagens.js";
import { renderPendentesTab } from "./pendentes.js";
import { renderRelatoriosTab } from "./relatorios.js";
import { renderModalShell } from "./modal-shell.js";

export function renderAppLayout() {
  return `
    ${renderLoginScreen()}

    <section id="dashboardScreen" class="hidden-section relative">
      <div class="ambient-red-orbs no-print" aria-hidden="true">
        <span class="ambient-orb ambient-orb--1"></span>
        <span class="ambient-orb ambient-orb--2"></span>
        <span class="ambient-orb ambient-orb--3"></span>
        <span class="ambient-orb ambient-orb--4"></span>
        <span class="ambient-orb ambient-orb--5"></span>
        <span class="ambient-orb ambient-orb--6"></span>
      </div>

      ${renderNavigation()}

      <main class="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        ${renderAbastecimentoTab()}
        ${renderDashboardTab()}
        ${renderDespesasTab()}
        ${renderCadastrosTab()}
        ${renderViagensTab()}
        ${renderPendentesTab()}
        ${renderRelatoriosTab()}
      </main>
    </section>

    ${renderModalShell()}
  `;
}
