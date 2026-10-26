export function renderViagensTab() {
  return `
    <section id="tab-viagens" class="tab-pane hidden-section fade-in space-y-6">
      <div class="grid grid-cols-1 xl:grid-cols-[1.15fr_.85fr] gap-6">
        <div class="card p-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-2xl font-semibold">Viagens e Orçamentos</h2>
              <p class="muted mt-1">Calendário mensal de saídas confirmadas, propostas em negociação e disponibilidade da frota.</p>
            </div>
            <button id="openTripFormBtn" type="button" class="rounded-2xl px-4 py-3 btn-primary font-semibold">+ Nova proposta</button>
          </div>
          <div class="flex items-center justify-between gap-3">
            <button id="tripPrevMonthBtn" type="button" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Mês anterior</button>
            <div id="tripMonthLabel" class="text-lg font-semibold capitalize"></div>
            <button id="tripNextMonthBtn" type="button" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Próximo mês</button>
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
            <h3 class="text-xl font-semibold">Viagens e propostas cadastradas</h3>
            <p class="muted mt-1">Clique em editar para ajustar a proposta ou em abrir para visualizar e exportar o documento.</p>
          </div>
          <div class="chip">Calendário + Orçamento</div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Saída</th>
                <th>Nº Orçamento</th>
                <th>Cliente</th>
                <th>Destino</th>
                <th>Valor Final</th>
                <th>Margem / Custos</th>
                <th>Validade / Status</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="tripTable"></tbody>
          </table>
        </div>
      </div>

      <div id="tripFormCard" class="card p-6 space-y-6 hidden-section">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 id="tripFormHeading" class="text-2xl font-semibold">Nova proposta de viagem</h3>
            <p id="tripFormSubheading" class="muted mt-1">Preencha os dados comerciais, roteiro e custos operacionais no padrão Garcia Turismo.</p>
          </div>
          <button id="tripCancelEditBtn" type="button" class="rounded-2xl px-4 py-2.5 btn-secondary font-semibold">Fechar</button>
        </div>

        <form id="tripForm" class="space-y-6" novalidate>
          <input type="hidden" id="tripId" />
          <input type="hidden" id="tripEmissaoDate" />

          <!-- SEÇÃO 1: CLIENTE E IDENTIFICAÇÃO -->
          <div class="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 class="text-base font-bold text-slate-900">1. Cliente e identificação</h4>
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Identificação da Proposta</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">Nº Orçamento</label>
                <input id="tripOrcamentoNum" class="field bg-slate-50 font-semibold" type="text" placeholder="Gerado automaticamente" readonly />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Validade da Proposta (dias)</label>
                <input id="tripValidadeDias" class="field" type="number" min="1" max="365" value="7" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Status</label>
                <select id="tripStatus" class="field">
                  <option value="Rascunho">Rascunho</option>
                  <option value="Enviado">Enviado (Proposta)</option>
                  <option value="Confirmada">Confirmada (Viagem fechada)</option>
                  <option value="Aprovado">Aprovado</option>
                  <option value="Realizada">Realizada</option>
                  <option value="Recusado">Recusado</option>
                  <option value="Expirado">Expirado</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Responsável *</label>
                <input id="tripResponsible" list="tripResponsibleSuggestions" class="field" type="text" placeholder="Cid Augusto Garcia de Souza" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Cliente / Contratante *</label>
                <input id="tripClient" class="field" type="text" placeholder="Nome completo ou empresa" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">WhatsApp / Telefone do Cliente</label>
                <input id="tripClientPhone" class="field" type="text" placeholder="(74) 99999-0000" />
              </div>
            </div>
          </div>

          <!-- SEÇÃO 2: ITINERÁRIO, EMBARQUE E DATAS -->
          <div class="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h4 class="text-base font-bold text-slate-900">2. Itinerário, embarque e datas</h4>
              <button type="button" id="tripCalculateKmBtn" class="rounded-xl px-4 py-2 btn-secondary font-semibold text-sm">
                Calcular rota
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">Cidade de Origem *</label>
                <input id="tripOrigin" class="field" type="text" placeholder="Ex.: Juazeiro - BA" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Local de Embarque</label>
                <input id="tripBoardingPlace" class="field" type="text" placeholder="Ex.: Terminal Rodoviário / Praça Central" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Destino Final *</label>
                <input id="tripDestination" class="field" type="text" placeholder="Ex.: Salvador - BA" required />
              </div>

              <div class="md:col-span-3">
                <label class="block text-sm font-medium mb-2">Escalas / Paradas no Percurso</label>
                <textarea id="tripStops" class="field min-h-[76px]" placeholder="Uma cidade ou parada por linha (opcional)&#10;Ex.: Senhor do Bonfim - BA&#10;Feira de Santana - BA"></textarea>
              </div>

              <div>
                <label class="block text-sm font-medium mb-2">Data de Saída *</label>
                <input id="tripDepartureDate" class="field" type="date" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Horário de Saída</label>
                <input id="tripDepartureTime" class="field" type="time" value="06:00" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Duração da Viagem (dias) *</label>
                <input id="tripDuration" class="field" type="number" min="1" max="365" value="1" required />
              </div>

              <div>
                <label class="block text-sm font-medium mb-2">Data de Retorno *</label>
                <input id="tripReturnDate" class="field" type="date" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Horário de Retorno</label>
                <input id="tripReturnTime" class="field" type="time" value="18:00" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Km da Ida (referência)</label>
                <input id="tripOneWayKm" class="field" type="number" min="0" step="0.1" placeholder="0" />
              </div>

              <div>
                <label class="block text-sm font-medium mb-2">Total de km — ida e volta *</label>
                <input id="tripTotalKm" class="field font-semibold" type="number" min="0" step="0.1" placeholder="Ex.: 4400" required />
                <span class="text-xs muted">Já representa o percurso completo (não é multiplicado por 2).</span>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Km vazio (sem passageiros)</label>
                <input id="tripEmptyKm" class="field" type="number" min="0" step="0.1" value="0" />
                <span class="text-xs muted">Deslocamento de garagem/posicionamento.</span>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Deslocamento no destino (km)</label>
                <input id="tripLocalDisplacementKm" class="field" type="number" min="0" step="0.1" value="0" />
                <span class="text-xs muted">City tour / traslados locais não inclusos na rota principal.</span>
              </div>
            </div>

            <div class="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
              <span>Km operacional por veículo (ida e volta + km vazio + destino): <strong id="tripOperationalKmPerVehicleLabel">0 km</strong></span>
              <span>Km operacional total da frota na viagem: <strong id="tripTotalOperationalKmLabel">0 km</strong></span>
            </div>
          </div>

          <!-- SEÇÃO 3: VEÍCULOS E PASSAGEIROS -->
          <div class="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 class="text-base font-bold text-slate-900">3. Veículos e passageiros</h4>
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Escala e Lotação</span>
            </div>

            <div id="tripVehicleConflictAlert" class="hidden rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900"></div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="md:col-span-2">
                <label class="block text-sm font-medium mb-2">Escolher veículos da frota</label>
                <select id="tripVehicleIds" class="field min-h-[120px]" multiple></select>
                <p class="text-xs muted mt-1">Segure Ctrl (ou Cmd) para selecionar mais de um veículo. O consumo e a capacidade de cada veículo são lidos individualmente.</p>
              </div>
              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium mb-1">Quantidade de veículos</label>
                  <input id="tripVehiclesQty" class="field bg-slate-50" type="number" min="1" max="10" value="1" required />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Capacidade total (poltronas)</label>
                  <input id="tripTotalCapacity" class="field bg-slate-50" type="number" min="1" max="1000" value="46" readonly />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Passageiros previstos *</label>
                  <input id="tripPassengers" class="field" type="number" min="1" max="1000" placeholder="Ex.: 40" required />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Consumo de referência (km/L)</label>
                  <input id="tripConsumption" class="field" type="number" min="0.1" step="0.01" placeholder="Ex.: 3.5" required />
                </div>
              </div>
            </div>
          </div>

          <!-- SEÇÃO 4: PREÇO E DESCONTO -->
          <div class="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div class="flex items-center gap-2">
                <h4 class="text-base font-bold text-slate-900">4. Preço e desconto</h4>
                <span id="tripManualPriceBadge" class="hidden px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Valor ajustado manualmente
                </span>
              </div>
              <button type="button" id="tripRecalcFinalBtn" class="text-xs font-semibold text-red-600 hover:text-red-700">
                Restaurar valor automático por KM
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">Preço por km (R$)</label>
                <input id="tripPricePerKm" class="field" type="number" min="0" step="0.01" placeholder="Ex.: 8.00" />
                <span class="text-xs muted">Valor automático: <strong id="tripAutoBaseValueLabel">R$ 0,00</strong></span>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Valor Bruto / Negociado (R$) *</label>
                <input id="tripBaseValue" class="field font-semibold" type="number" min="0" step="0.01" placeholder="Ex.: 36000.00" required />
                <span class="text-xs muted">Não é sobrescrito ao recalcular rota se ajustado manualmente.</span>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Desconto Concedido (R$)</label>
                <input id="tripDiscount" class="field" type="number" min="0" step="0.01" value="0.00" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Valor Final ao Cliente (R$) *</label>
                <input id="tripFinalValue" class="field font-bold text-slate-900 bg-slate-50" type="number" min="0" step="0.01" placeholder="36000.00" required readonly />
                <span class="text-xs muted">Valor bruto − desconto.</span>
              </div>
            </div>
          </div>

          <!-- SEÇÃO 5: CUSTOS INTERNOS E LUCRATIVIDADE -->
          <div class="p-5 rounded-2xl border border-slate-200 bg-white space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 class="text-base font-bold text-slate-900">5. Custos internos</h4>
                <p class="text-xs muted">Informações confidenciais de operação — nunca aparecem na proposta nem no PDF do cliente.</p>
              </div>
              <label class="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <input type="checkbox" id="tripCostsConfirmedZero" class="w-4 h-4 cursor-pointer" />
                <span>Confirmo que despesas em branco são R$ 0,00</span>
              </label>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label class="block text-sm font-medium">Combustível: Preço do Diesel (R$/L)</label>
                <input id="tripFuelPrice" class="field" type="number" min="0" step="0.01" placeholder="6.20" value="6.20" />
                <div class="text-xs text-slate-600 space-y-1 pt-1">
                  <div>Litros necessários: <strong id="tripFuelLitersLabel">0,00</strong> L</div>
                  <div>Custo de combustível: <strong id="tripFuelCostLabel">R$ 0,00</strong></div>
                  <div id="tripFuelPerVehicleBreakdown" class="text-[11px] text-slate-500"></div>
                </div>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label class="block text-sm font-medium">1º Motorista</label>
                <div class="grid grid-cols-3 gap-2">
                  <select id="tripDriver1Type" class="field text-xs">
                    <option value="viagem">Por viagem</option>
                    <option value="dia">Por diária</option>
                  </select>
                  <input id="tripDriver1Value" class="field text-xs" type="number" min="0" step="0.01" placeholder="Valor R$" />
                  <input id="tripDriver1Days" class="field text-xs" type="number" min="1" max="365" step="1" value="1" title="Quantidade de diárias do 1º motorista" placeholder="Diárias" />
                </div>
                <div class="text-xs text-slate-600 pt-1">
                  Subtotal 1º motorista: <strong id="tripDriver1CostLabel">R$ 0,00</strong>
                </div>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label class="block text-sm font-medium">2º Motorista (Opcional)</label>
                <div class="grid grid-cols-3 gap-2">
                  <select id="tripDriver2Type" class="field text-xs">
                    <option value="viagem">Por viagem</option>
                    <option value="dia">Por diária</option>
                  </select>
                  <input id="tripDriver2Value" class="field text-xs" type="number" min="0" step="0.01" placeholder="Valor R$" />
                  <input id="tripDriver2Days" class="field text-xs" type="number" min="0" max="365" step="1" value="1" title="Quantidade de diárias do 2º motorista" placeholder="Diárias" />
                </div>
                <div class="text-xs text-slate-600 pt-1">
                  Subtotal 2º motorista: <strong id="tripDriver2CostLabel">R$ 0,00</strong>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">Pedágios (R$)</label>
                <input id="tripTollsCost" class="field" type="number" min="0" step="0.01" placeholder="0,00" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Estacionamento (R$)</label>
                <input id="tripParkingCost" class="field" type="number" min="0" step="0.01" placeholder="0,00" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Hospedagem Motoristas (R$)</label>
                <input id="tripLodgingCost" class="field" type="number" min="0" step="0.01" placeholder="0,00" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Alimentação Motoristas (R$)</label>
                <input id="tripDriverMealsCost" class="field" type="number" min="0" step="0.01" placeholder="0,00" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">ANTT / Taxas (R$)</label>
                <input id="tripAnttCost" class="field" type="number" min="0" step="0.01" placeholder="0,00" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Água / Kit Bordo (R$)</label>
                <input id="tripWaterCost" class="field" type="number" min="0" step="0.01" placeholder="0,00" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Seguro Viagem (R$)</label>
                <input id="tripInsuranceCost" class="field" type="number" min="0" step="0.01" value="0" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Custos Adicionais</label>
                <div id="tripOtherCostsContainer" class="space-y-2 mb-2"></div>
                <button type="button" id="tripAddOtherCostBtn" class="text-xs font-semibold text-red-600 hover:text-red-700">+ Adicionar despesa extra</button>
              </div>
            </div>

            <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span class="font-semibold text-slate-700">Total de Custos Diretos</span>
              <span id="tripTotalDirectCostsLabel" class="text-xl font-bold text-slate-900">R$ 0,00</span>
            </div>

            <!-- DIAGNÓSTICO DE LUCRATIVIDADE E INDICADORES -->
            <div class="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm uppercase font-bold text-slate-700">Diagnóstico de Lucratividade</span>
                <span id="tripPrecoJustoBadge" class="px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300">
                  Custos incompletos
                </span>
              </div>

              <div id="tripPendingItemsAlert" class="hidden rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900"></div>

              <div class="relative w-full h-4 bg-slate-200 rounded-full overflow-hidden flex">
                <div style="width: 30%; background-color: #ef4444;" class="h-full" title="Vermelho: < 30%"></div>
                <div style="width: 20%; background-color: #fbbf24;" class="h-full" title="Amarelo: 30% a 49.9%"></div>
                <div style="width: 50%; background-color: #10b981;" class="h-full" title="Verde: >= 50%"></div>
                <div id="tripPrecoJustoIndicator" class="absolute top-0 bottom-0 w-2 bg-slate-900 shadow-sm rounded-full transition-all duration-300" style="left: 0%; background-color: #0f172a;"></div>
              </div>
              <div class="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>0% (Prejuízo)</span>
                <span>30%</span>
                <span>50% (Meta)</span>
                <span>100%</span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <span class="text-xs text-slate-500 font-medium">Margem sobre a Receita:</span>
                  <p id="tripMargemAtualLabel" class="text-2xl font-bold text-slate-900">Custos incompletos</p>
                </div>
                <div>
                  <span class="text-xs text-slate-500 font-medium">Lucro Estimado:</span>
                  <p id="tripLucroEstimadoLabel" class="text-2xl font-bold text-slate-900">Custos incompletos</p>
                </div>
                <div class="flex flex-col justify-between">
                  <div>
                    <span class="text-xs text-slate-500 font-medium">Preço mínimo para margem de 50%:</span>
                    <p id="tripPrecoSugeridoLabel" class="text-lg font-bold text-slate-700">Aguardando custos</p>
                  </div>
                  <button type="button" id="tripAplicarPrecoBtn" class="mt-2 self-start rounded-xl px-3 py-1.5 btn-secondary font-semibold text-xs">
                    Aplicar preço sugerido
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-slate-200 text-sm">
                <div>
                  <span class="text-xs text-slate-500 block mb-1">Custo por KM</span>
                  <span id="tripCustoPorKmLabel" class="font-semibold text-slate-800">R$ 0,00</span>
                </div>
                <div>
                  <span class="text-xs text-slate-500 block mb-1">Receita por KM</span>
                  <span id="tripReceitaPorKmLabel" class="font-semibold text-slate-800">R$ 0,00</span>
                </div>
                <div>
                  <span class="text-xs text-slate-500 block mb-1">Preço / Passageiro Previsto</span>
                  <span id="tripPrecoPorPassageiroLabel" class="font-semibold text-slate-800">R$ 0,00</span>
                </div>
                <div>
                  <span class="text-xs text-slate-500 block mb-1">Preço / Poltrona Disponível</span>
                  <span id="tripPrecoPorPoltronaLabel" class="font-semibold text-slate-800">R$ 0,00</span>
                </div>
                <div>
                  <span class="text-xs text-slate-500 block mb-1">Ponto de Equilíbrio</span>
                  <span id="tripPontoEquilibrioLabel" class="font-semibold text-slate-800">Aguardando custos</span>
                </div>
              </div>
            </div>
          </div>

          <!-- SEÇÃO 6: CONDIÇÕES COMERCIAIS -->
          <div class="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 class="text-base font-bold text-slate-900">6. Condições comerciais</h4>
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contrato e Pagamento</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">Sinal / Entrada Prevista (R$)</label>
                <input id="tripDepositSignalValue" class="field" type="number" min="0" step="0.01" placeholder="Ex.: 10800.00" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Sinal Já Pago (R$)</label>
                <input id="tripDepositPaidValue" class="field" type="number" min="0" step="0.01" placeholder="0.00" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Vencimento do Saldo Restante</label>
                <input id="tripBalanceDueDate" class="field" type="date" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Forma e Condições de Pagamento</label>
              <input id="tripPaymentTerms" class="field" type="text" value="30% de sinal na confirmação e saldo restante até 5 dias antes do embarque." />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">O que está INCLUSO no serviço contratado</label>
                <textarea id="tripIncluded" class="field min-h-[90px]">Transporte fretado ida e volta, combustível, motorista(s), pedágios e taxas de rodagem.</textarea>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">O que NÃO está incluso</label>
                <textarea id="tripNotIncluded" class="field min-h-[90px]">Hospedagem de passageiros, alimentação de passageiros, ingressos e deslocamentos fora do roteiro contratado.</textarea>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">Regras de Embarque e Viagem</label>
                <textarea id="tripRules" class="field min-h-[100px]">- Tolerância de atraso no embarque: 15 minutos.
- Bagagem: 1 mala no bagageiro e 1 volume de mão por passageiro.
- Proibido o consumo de bebidas alcoólicas e fumo no interior do veículo.
- Menores de 16 anos desacompanhados necessitam de autorização legal.</textarea>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Política de Reserva e Cancelamento</label>
                <textarea id="tripCancellationPolicy" class="field min-h-[100px]">- A reserva da data e do veículo é confirmada mediante pagamento do sinal.
- Cancelamentos com até 7 dias de antecedência possuem devolução integral do sinal; após esse prazo, aplica-se retenção para cobertura de custos operacionais.</textarea>
              </div>
            </div>
          </div>

          <!-- SEÇÃO 7: AÇÕES CONSOLIDADAS -->
          <div class="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div class="text-xs text-slate-600">
              <strong>7. Prévia e exportação:</strong> A prévia abaixo acompanha os dados em tempo real. Salve como Rascunho mesmo se os custos ainda estiverem incompletos.
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <button type="button" id="tripCalculateKmFooterBtn" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">
                Calcular rota
              </button>
              <button type="submit" id="tripSaveBtn" class="rounded-2xl px-5 py-3 btn-primary font-semibold">
                Salvar proposta
              </button>
              <button type="button" id="tripFormExportPdfBtn" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">
                Exportar PDF
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- PRÉVIA E EXPORTAÇÃO UNIFICADA -->
      <div id="tripPreviewCard" class="card p-6 space-y-5 hidden-section">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 class="text-2xl font-semibold">7. Prévia e Exportação do Documento</h3>
            <p class="muted mt-1">Alterne entre a visão comercial do cliente (sem custos internos) e a planilha interna.</p>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <div class="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <label class="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-sm font-semibold">
                <input type="radio" name="tripPreviewType" value="cliente" checked />
                <span>Cliente</span>
              </label>
              <label class="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-sm font-semibold">
                <input type="radio" name="tripPreviewType" value="interno" />
                <span>Interno</span>
              </label>
            </div>
            <button id="tripOpenPrintPageBtn" type="button" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">
              Imprimir / Página completa
            </button>
            <button id="tripExportPdfBtn" type="button" class="rounded-2xl px-5 py-3 btn-primary font-semibold">
              Exportar PDF
            </button>
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
