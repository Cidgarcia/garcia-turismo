export function renderCadastrosTab() {
  return `
    <section id="tab-cadastros" class="tab-pane hidden-section fade-in space-y-6">
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div class="card p-6 space-y-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-xl font-semibold">Funcionários / Motoristas</h3>
            <button type="button" class="rounded-2xl px-4 py-3 btn-primary font-semibold" data-open-modal="employee">
              Novo
            </button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cargo</th>
                  <th>Telefone</th>
                  <th>Valor mensal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="employeeTable"></tbody>
            </table>
          </div>
        </div>

        <div class="card p-6 space-y-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-xl font-semibold">Veículos</h3>
            <button type="button" class="rounded-2xl px-4 py-3 btn-primary font-semibold" data-open-modal="vehicle">
              Novo
            </button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Ano</th>
                  <th>Cor</th>
                  <th>KM</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="vehicleTable"></tbody>
            </table>
          </div>
        </div>

        <div class="card p-6 space-y-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-xl font-semibold">Compradores / Gestores</h3>
            <button type="button" class="rounded-2xl px-4 py-3 btn-primary font-semibold" data-open-modal="buyer">
              Novo
            </button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="buyerTable"></tbody>
            </table>
          </div>
        </div>

        <div class="card p-6 space-y-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-xl font-semibold">Cartões</h3>
            <button type="button" class="rounded-2xl px-4 py-3 btn-primary font-semibold" data-open-modal="card">
              Novo
            </button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cartão</th>
                  <th>Fecha</th>
                  <th>Vence</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="cardTable"></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `;
}
