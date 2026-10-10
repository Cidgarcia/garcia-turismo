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

    <section id="dashboardScreen" class="hidden-section">
      ${renderNavigation()}

      <main class="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        ${renderDashboardTab()}
        ${renderDespesasTab()}
        ${renderAbastecimentoTab()}
        ${renderCadastrosTab()}
        ${renderViagensTab()}
        ${renderPendentesTab()}
        ${renderRelatoriosTab()}
      </main>
    </section>

    ${renderModalShell()}
  `;
}
