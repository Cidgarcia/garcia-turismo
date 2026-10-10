export function renderViagensTab() {
  return `
        <section id="tab-viagens" class="tab-pane hidden-section fade-in space-y-6">
          <div class="grid grid-cols-1 xl:grid-cols-[1.15fr_.85fr] gap-6">
            <div class="card p-6 space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 class="text-2xl font-semibold">Viagens</h2>
                  <p class="muted mt-1">Calendário mensal de saídas e propostas da Garcia Turismo.</p>
                </div>
                <button id="openTripFormBtn" class="rounded-2xl px-4 py-3 btn-primary font-semibold">Nova proposta</button>
              </div>
              <div class="flex items-center justify-between gap-3">
                <button id="tripPrevMonthBtn" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Mês anterior</button>
                <div id="tripMonthLabel" class="text-lg font-semibold capitalize"></div>
                <button id="tripNextMonthBtn" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Próximo mês</button>
              </div>
              <div class="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-[0.18em] muted">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
              </div>
              <div id="tripCalendarGrid" class="grid grid-cols-7 gap-2"></div>
            </div>

            <div class="card p-6 space-y-4">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-xl font-semibold">Resumo do dia</h3>
                <div id="tripSelectedDateLabel" class="chip">-</div>
              </div>
              <div id="tripDaySummary" class="space-y-3"></div>
            </div>
          </div>

          <div class="card p-6 space-y-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 class="text-xl font-semibold">Viagens cadastradas</h3>
                <p class="muted mt-1">Clique em editar para ajustar a proposta ou em abrir para visualizar o documento.</p>
              </div>
              <div class="chip">Calendário + orçamento</div>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Saída</th>
                    <th>Cliente</th>
                    <th>Destino</th>
                    <th>Veículos</th>
                    <th>Status</th>
                    <th>Valor final</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="tripTable"></tbody>
              </table>
            </div>
          </div>

          <div id="tripFormCard" class="card p-6 space-y-5 hidden-section">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-2xl font-semibold">Nova proposta de viagem</h3>
                <p class="muted mt-1">Preencha o itinerário, calcule o km e gere o orçamento no padrão Garcia Turismo.</p>
              </div>
              <button id="tripCancelEditBtn" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Fechar</button>
            </div>

            <form id="tripForm" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <input type="hidden" id="tripId" />
              <div>
                <label class="block text-sm font-medium mb-2">Responsável</label>
                <input id="tripResponsible" list="tripResponsibleSuggestions" class="field" type="text" placeholder="Cid Augusto Garcia de Souza" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Cliente</label>
                <input id="tripClient" class="field" type="text" placeholder="Nome do cliente" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Status</label>
                <select id="tripStatus" class="field">
                  <option value="Proposta">Proposta</option>
                  <option value="Confirmada">Confirmada</option>
                  <option value="Realizada">Realizada</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Origem</label>
                <input id="tripOrigin" class="field" type="text" placeholder="Sobradinho - Bahia" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Destino final</label>
                <input id="tripDestination" class="field" type="text" placeholder="Salvador - Bahia" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Escalas</label>
                <textarea id="tripStops" class="field min-h-[120px]" placeholder="Uma cidade por linha&#10;Juazeiro - Bahia&#10;Petrolina - Pernambuco"></textarea>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Data de saída</label>
                <input id="tripDepartureDate" class="field" type="date" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Data de retorno</label>
                <input id="tripReturnDate" class="field" type="date" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Duração (dias)</label>
                <input id="tripDuration" class="field" type="number" min="1" value="1" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Quantidade de veículos</label>
                <input id="tripVehiclesQty" class="field" type="number" min="1" value="1" required readonly />
                <p class="text-xs muted mt-2">A quantidade é atualizada pela seleção de veículos.</p>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Escolher veículos</label>
                <select id="tripVehicleIds" class="field min-h-[140px]" multiple></select>
                <p class="text-xs muted mt-2">Selecione um ou mais veículos cadastrados. A quantidade será atualizada automaticamente.</p>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Passageiros previstos</label>
                <input id="tripPassengers" class="field" type="number" min="1" placeholder="40" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Consumo (km/l)</label>
                <input id="tripConsumption" class="field" type="number" min="0.1" step="0.1" placeholder="3.5" required readonly />
                <p class="text-xs muted mt-2">Preenchido automaticamente a partir dos veículos.</p>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Km da ida</label>
                <input id="tripOneWayKm" class="field" type="number" min="0" step="0.1" placeholder="0" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Total de km (ida e volta)</label>
                <input id="tripTotalKm" class="field" type="number" min="0" step="0.1" placeholder="0" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Km vazio (deslocamento sem passageiros)</label>
                <input id="tripEmptyKm" class="field" type="number" min="0" step="0.1" value="0" />
                <p class="text-xs muted mt-2">Opcional. Será somado ao total de km no cálculo de custos.</p>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Preço por km</label>
                <input id="tripPricePerKm" class="field" type="number" min="0" step="0.01" placeholder="7.00" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Valor total</label>
                <input id="tripBaseValue" class="field" type="number" min="0" step="0.01" placeholder="18000" required />
                <p class="text-xs muted mt-2">Sugestão automática: km total x preço por km x quantidade de veículos.</p>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Desconto</label>
                <input id="tripDiscount" class="field" type="number" min="0" step="0.01" value="0" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Valor final</label>
                <input id="tripFinalValue" class="field" type="number" min="0" step="0.01" placeholder="17000" required />
              </div>
              <div class="xl:col-span-3 pt-4 pb-2">
                <h4 class="text-lg font-semibold border-b border-slate-200 pb-2">Custos Diretos (Uso Interno)</h4>
              </div>

              <div class="space-y-4">
                <label class="block text-sm font-medium mb-2">Combustível: Preço do Diesel (R$/l)</label>
                <input id="tripFuelPrice" class="field" type="number" min="0" step="0.01" placeholder="6.20" value="6.20" />
                <div class="text-xs muted mt-2 flex flex-col gap-1">
                  <span>Litros necessários: <strong id="tripFuelLitersLabel">-</strong> l</span>
                  <span>Custo total: <strong id="tripFuelCostLabel">R$ 0,00</strong></span>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium mb-2">1º Motorista</label>
                <div class="flex gap-2">
                  <select id="tripDriver1Type" class="field w-1/3">
                    <option value="viagem">Por viagem</option>
                    <option value="dia">Por dia</option>
                  </select>
                  <input id="tripDriver1Value" class="field w-2/3" type="number" min="0" step="0.01" placeholder="Valor" />
                </div>
                <div class="text-xs muted mt-2">Custo total: <strong id="tripDriver1CostLabel">R$ 0,00</strong></div>
              </div>

              <div>
                <label class="block text-sm font-medium mb-2">2º Motorista (Opcional)</label>
                <div class="flex gap-2">
                  <select id="tripDriver2Type" class="field w-1/3">
                    <option value="viagem">Por viagem</option>
                    <option value="dia">Por dia</option>
                  </select>
                  <input id="tripDriver2Value" class="field w-2/3" type="number" min="0" step="0.01" placeholder="Valor" />
                </div>
                <div class="text-xs muted mt-2">Custo total: <strong id="tripDriver2CostLabel">R$ 0,00</strong></div>
              </div>

              <div>
                <label class="block text-sm font-medium mb-2">Hospedagem</label>
                <input id="tripLodgingCost" class="field" type="number" min="0" step="0.01" placeholder="0" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">ANTT / Taxas</label>
                <input id="tripAnttCost" class="field" type="number" min="0" step="0.01" placeholder="0" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Água / Lanches</label>
                <input id="tripWaterCost" class="field" type="number" min="0" step="0.01" placeholder="0" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Seguro (Opcional)</label>
                <input id="tripInsuranceCost" class="field" type="number" min="0" step="0.01" value="0" />
              </div>

              <div class="xl:col-span-2">
                <label class="block text-sm font-medium mb-2">Outros Custos</label>
                <div id="tripOtherCostsContainer" class="space-y-3 mb-3"></div>
                <button type="button" id="tripAddOtherCostBtn" class="text-sm font-semibold text-red-600 hover:text-red-700">+ Adicionar item</button>
              </div>

              <div class="xl:col-span-3 flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-2">
                <span class="font-medium text-slate-700">Total de Custos Diretos</span>
                <span id="tripTotalDirectCostsLabel" class="text-xl font-bold text-slate-900">R$ 0,00</span>
              </div>

              <div class="xl:col-span-3 flex flex-wrap justify-end gap-2">
                <button type="button" id="tripCalculateKmBtn" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Calcular km</button>
                <button type="button" id="tripRecalcFinalBtn" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Recalcular valor final</button>
                <button type="button" id="tripPreviewBtn" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Atualizar prévia</button>
                <button type="submit" id="tripSaveBtn" class="rounded-2xl px-5 py-4 btn-primary font-semibold">Salvar viagem</button>
              </div>
            </form>
          </div>

          <div id="tripPreviewCard" class="card p-6 space-y-5 hidden-section">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-2xl font-semibold">Prévia do orçamento</h3>
                <p class="muted mt-1">Exporte a proposta em PDF ou imagem.</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button id="tripExportPdfBtn" class="rounded-2xl px-4 py-3 btn-primary font-semibold">Exportar PDF</button>
                <button id="tripExportImageBtn" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Exportar imagem</button>
              </div>
            </div>
            <div class="overflow-auto">
              <div id="tripProposalDocument"></div>
            </div>
          </div>

          <datalist id="tripResponsibleSuggestions"></datalist>
        </section>

  `;
}
