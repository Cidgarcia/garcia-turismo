export function renderAbastecimentoTab() {
  return `
    <section id="tab-abastecimento" class="tab-pane hidden-section fade-in">
      <div class="grid grid-cols-1 xl:grid-cols-[1.18fr_.82fr] gap-6">
        <div class="card p-6 space-y-5">
          <div>
            <h2 class="text-2xl font-semibold">Abastecimento</h2>
            <p class="muted mt-1">Controle de combustível, KM, média e pagamento.</p>
          </div>

          <form id="fuelForm" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <input id="fuelRecordId" type="hidden" />

            <div>
              <label class="block text-sm font-medium mb-2">Data do abastecimento</label>
              <input id="fuelDate" type="date" class="field" required />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Veículo</label>
              <select id="fuelVehicle" class="field" required>
                <option value="">Selecione</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Último KM</label>
              <input id="fuelLastKm" type="number" min="0" class="field bg-slate-100" required />
              <p id="fuelLastKmHint" class="muted text-xs mt-1">Selecione a data e o veículo para calcular.</p>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">KM atual</label>
              <input id="fuelCurrentKm" type="number" min="0" class="field" required />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Litros</label>
              <input id="fuelLiters" type="number" min="0.01" step="0.01" class="field" required />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Valor total</label>
              <input id="fuelTotal" type="number" min="0.01" step="0.01" class="field" required />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Forma de pagamento</label>
              <select id="fuelPayment" class="field" required>
                <option value="">Selecione</option>
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Status do lançamento</label>
              <select id="fuelStatus" class="field" required>
                <option value="pago">Pago</option>
                <option value="a_pagar">A pagar</option>
              </select>
            </div>

            <div id="wrapFuelCard" class="hidden-section">
              <label class="block text-sm font-medium mb-2">Cartão</label>
              <select id="fuelCard" class="field">
                <option value="">Selecione</option>
              </select>
            </div>

            <div id="wrapFuelBuyer" class="hidden-section">
              <label class="block text-sm font-medium mb-2">Quem comprou</label>
              <select id="fuelBuyer" class="field">
                <option value="">Selecione</option>
              </select>
            </div>

            <div id="wrapFuelInstallments" class="hidden-section">
              <label class="block text-sm font-medium mb-2">À vista ou dividido</label>
              <select id="fuelInstallments" class="field">
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

            <div id="wrapFuelChequeDate" class="hidden-section">
              <label class="block text-sm font-medium mb-2">Data de compensação</label>
              <input id="fuelChequeDate" type="date" class="field" />
            </div>

            <div id="wrapFuelChequeBank" class="hidden-section">
              <label class="block text-sm font-medium mb-2">Banco</label>
              <input id="fuelChequeBank" type="text" class="field" placeholder="Banco do Brasil" />
            </div>

            <div class="md:col-span-2 xl:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="metric-card p-4">
                <div class="text-sm muted">Distância</div>
                <div id="previewDistance" class="text-2xl font-semibold mt-1">0 km</div>
              </div>

              <div class="metric-card p-4">
                <div class="text-sm muted">Média</div>
                <div id="previewAverage" class="text-2xl font-semibold mt-1">0 km/l</div>
              </div>

              <div class="metric-card p-4">
                <div class="text-sm muted">Preço/L</div>
                <div id="previewPricePerLiter" class="text-2xl font-semibold mt-1">R$ 0,00</div>
              </div>
            </div>

            <div class="md:col-span-2 xl:col-span-3 flex flex-wrap justify-end gap-3">
              <button id="cancelFuelEditBtn" type="button" class="hidden-section rounded-2xl px-5 py-4 btn-secondary font-semibold">
                Cancelar edição
              </button>
              <button type="submit" class="rounded-2xl px-5 py-4 btn-primary font-semibold">
                <span id="fuelSubmitLabel">Salvar abastecimento</span>
              </button>
            </div>
          </form>
        </div>

        <div class="card p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h3 class="text-xl font-semibold">Últimos abastecimentos</h3>
            <div class="chip">Frota</div>
          </div>

          <div id="fuelHistory" class="space-y-3"></div>
        </div>
      </div>
    </section>
  `;
}
