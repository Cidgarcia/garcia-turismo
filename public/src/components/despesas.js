export function renderDespesasTab() {
  return `
    <section id="tab-despesas" class="tab-pane hidden-section fade-in">
      <div class="card p-6 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-semibold">Lançamento de despesas</h2>
            <p class="muted mt-1">Cartão com opção à vista ou parcelado até 12x.</p>
          </div>
          <button id="expenseClearBtn" class="rounded-2xl px-4 py-3 btn-secondary font-semibold" type="button">
            Limpar
          </button>
        </div>

        <form id="expenseForm" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">Data</label>
            <input id="expenseDate" type="date" class="field" required />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Categoria</label>
            <select id="expenseCategory" class="field" required>
              <option value="">Selecione</option>
              <option value="pecas_manutencao">Peças e manutenção</option>
              <option value="materiais_limpeza">Materiais de limpeza</option>
              <option value="salarios_adiantamentos">Salários / Adiantamentos</option>
              <option value="viagens_extras">Viagens por fora (Extras)</option>
              <option value="outros">Outros</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Descrição</label>
            <input id="expenseDescription" type="text" class="field" placeholder="Ex.: troca de óleo" required />
          </div>

          <div id="expenseEmployeeQuickTypes" class="expense-quick-types hidden-section xl:col-span-3" aria-live="polite">
            <span class="text-sm font-medium">Escolha o tipo de lançamento</span>
            <div class="expense-quick-types__actions">
              <button type="button" class="btn-secondary" data-employee-payment-quick-type="advance">Vale / Adiantamento</button>
              <button type="button" class="btn-secondary" data-employee-payment-quick-type="salary">Pagamento de salário</button>
              <button type="button" class="btn-secondary" data-employee-payment-quick-type="daily">Diária de viagem</button>
              <button type="button" class="btn-secondary" data-employee-payment-quick-type="other">Outro extra</button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Valor</label>
            <input id="expenseAmount" type="number" min="0.01" step="0.01" class="field" required />
          </div>

          <div id="wrapExpenseVehicle">
            <label class="block text-sm font-medium mb-2">Veículo</label>
            <select id="expenseVehicle" class="field">
              <option value="">Selecione</option>
            </select>
          </div>

          <div id="wrapExpenseEmployee" class="hidden-section">
            <label class="block text-sm font-medium mb-2">Funcionário</label>
            <select id="expenseEmployee" class="field">
              <option value="">Selecione</option>
            </select>
          </div>

          <div id="wrapExpenseEmployeePaymentType" class="hidden-section">
            <label class="block text-sm font-medium mb-2">Tipo de pagamento do funcionário</label>
            <select id="expenseEmployeePaymentType" class="field">
              <option value="">Selecione</option>
              <option value="advance">Vale / Adiantamento</option>
              <option value="salary">Pagamento de salário</option>
              <option value="daily">Diária de viagem</option>
              <option value="other">Outro extra</option>
            </select>
          </div>

          <div id="wrapExpenseCompetenceMonth" class="hidden-section">
            <label class="block text-sm font-medium mb-2">Mês de competência</label>
            <input id="expenseCompetenceMonth" type="month" class="field" />
          </div>

          <div id="wrapExpenseTrip" class="hidden-section">
            <label class="block text-sm font-medium mb-2">Viagem vinculada (opcional)</label>
            <select id="expenseTrip" class="field">
              <option value="">Sem vínculo com viagem</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Forma de pagamento</label>
            <select id="expensePayment" class="field" required>
              <option value="">Selecione</option>
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao_credito">Cartão de crédito</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Status do lançamento</label>
            <select id="expenseStatus" class="field" required>
              <option value="pago">Pago</option>
              <option value="a_pagar">A pagar</option>
            </select>
          </div>

          <div id="wrapExpenseCard" class="hidden-section">
            <label class="block text-sm font-medium mb-2">Cartão</label>
            <select id="expenseCard" class="field">
              <option value="">Selecione</option>
            </select>
          </div>

          <div id="wrapExpenseBuyer" class="hidden-section">
            <label class="block text-sm font-medium mb-2">Quem comprou</label>
            <select id="expenseBuyer" class="field">
              <option value="">Selecione</option>
            </select>
          </div>

          <div id="wrapExpenseInstallments" class="hidden-section">
            <label class="block text-sm font-medium mb-2">À vista ou dividido</label>
            <select id="expenseInstallments" class="field">
              <option value="1">À vista</option>
              <option value="2">2x</option>
              <option value="3">3x</option>
              <option value="4">4x</option>
              <option value="5">5x</option>
              <option value="6">6x</option>
              <option value="7">7x</option>
              <option value="8">8x</option>
              <option value="9">9x</option>
              <option value="10">10x</option>
              <option value="11">11x</option>
              <option value="12">12x</option>
            </select>
          </div>

          <div id="wrapExpenseChequeDate" class="hidden-section">
            <label class="block text-sm font-medium mb-2">Data de compensação</label>
            <input id="expenseChequeDate" type="date" class="field" />
          </div>

          <div id="wrapExpenseChequeBank" class="hidden-section">
            <label class="block text-sm font-medium mb-2">Banco</label>
            <input id="expenseChequeBank" type="text" class="field" placeholder="Banco do Brasil" />
          </div>

          <div class="xl:col-span-3">
            <label class="block text-sm font-medium mb-2">Comprovante / URL da foto</label>
            <input id="expenseProof" type="url" class="field" placeholder="Cole aqui a URL do comprovante" />
          </div>

          <div class="xl:col-span-3 flex justify-end">
            <button type="submit" class="rounded-2xl px-5 py-4 btn-primary font-semibold">
              Salvar despesa
            </button>
          </div>
        </form>
      </div>

      <section class="card p-6 space-y-4 mt-6" aria-labelledby="employeePaymentsTitle">
        <div class="employee-payments__header">
          <div>
            <h3 id="employeePaymentsTitle" class="text-xl font-semibold">Pagamentos de funcionários</h3>
            <p class="muted mt-1">Acompanhe salário, diárias e outros pagamentos por competência.</p>
          </div>
          <div class="employee-payments__month">
            <label class="block text-sm font-medium mb-2" for="employeePaymentsMonth">Mês de competência</label>
            <input id="employeePaymentsMonth" type="month" class="field" />
          </div>
        </div>
        <div id="employeePaymentsList" class="employee-payments-list"></div>
      </section>

      <div class="card p-6 space-y-4 mt-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-xl font-semibold">Despesas lançadas</h3>
            <p class="muted mt-1">Use excluir para apagar lançamentos feitos por engano.</p>
          </div>
          <div class="chip">Controle rápido</div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Categoria</th>
                <th>Descrição</th>
                <th>Pagamento</th>
                <th>Status</th>
                <th class="text-right">Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="expenseTable"></tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}
