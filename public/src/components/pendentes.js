export function renderPendentesTab() {
  return `
    <section id="tab-pendentes" class="tab-pane hidden-section fade-in">
      <div class="card p-6 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-semibold">Pendentes</h2>
            <p class="muted mt-1">Contas diretas e parcelas futuras com confirmação para dar baixa.</p>
          </div>

          <div class="chip">Financeiro</div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Origem</th>
                <th>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="pendingTable"></tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}
