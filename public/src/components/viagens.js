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
                      <th>Nº Orçamento</th>
                      <th>Cliente</th>
                      <th>Destino</th>
                      <th>Valor</th>
                      <th>Margem</th>
                      <th>Validade / Status</th>
                      <th class="text-right">Ações</th>
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
                <input type="hidden" id="tripEmissaoDate" />

                <div class="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 pb-2 mb-2 border-b border-slate-200">
                  <div>
                    <label class="block text-sm font-medium mb-2">Nº Orçamento</label>
                    <input id="tripOrcamentoNum" class="field" type="text" placeholder="Automático" readonly />
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-2">Validade (dias)</label>
                    <input id="tripValidadeDias" class="field" type="number" min="1" value="7" required />
                  </div>
                </div>

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
                    <option value="Rascunho">Rascunho</option>
                    <option value="Enviado">Enviado</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Recusado">Recusado</option>
                    <option value="Expirado">Expirado</option>
                    <option value="Proposta">Proposta (Antigo)</option>
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

              <!-- BARRA DE PREÇO JUSTO (Diagnóstico de Lucratividade) -->
              <div class="xl:col-span-3 space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 mb-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm uppercase font-bold text-slate-700">Diagnóstico de Lucratividade</span>
                  <span id="tripPrecoJustoBadge" class="px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-600 border border-slate-300">
                    Aguardando cálculo
                  </span>
                </div>

                <!-- Barra Visual de Margem -->
                <div class="relative w-full h-4 bg-slate-200 rounded-full overflow-hidden flex" style="background-color: #e2e8f0;">
                  <div style="width: 30%; background-color: #ef4444;" class="h-full" title="Vermelho: < 30%"></div>
                  <div style="width: 20%; background-color: #fbbf24;" class="h-full" title="Amarelo: 30% a 49.9%"></div>
                  <div style="width: 50%; background-color: #10b981;" class="h-full" title="Verde: >= 50%"></div>
                  <!-- Indicador de Posição Atual -->
                  <div id="tripPrecoJustoIndicator" class="absolute top-0 bottom-0 w-2 bg-slate-900 shadow-sm rounded-full transition-all duration-300" style="left: 0%; background-color: #0f172a;"></div>
                </div>
                <div class="flex justify-between text-[10px] text-slate-500 font-medium">
                  <span>0% (Prejuízo)</span>
                  <span>30%</span>
                  <span>50% (Meta)</span>
                  <span>100%</span>
                </div>

                <!-- Resumo Numérico -->
                <div class="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span class="text-xs text-slate-500 font-medium">Margem Atual:</span>
                    <p id="tripMargemAtualLabel" class="text-2xl font-bold text-slate-900">0,0%</p>
                  </div>
                  <div>
                    <span class="text-xs text-slate-500 font-medium">Lucro Estimado:</span>
                    <p id="tripLucroEstimadoLabel" class="text-2xl font-bold text-slate-900">R$ 0,00</p>
                  </div>
                </div>

                <!-- Preço Mínimo para bater 50% -->
                <div class="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span class="text-xs text-slate-500 font-medium">Mínimo sugerido para margem de 50%:</span>
                    <p id="tripPrecoSugeridoLabel" class="text-lg font-bold text-slate-700">R$ 0,00</p>
                  </div>
                  <button type="button" id="tripAplicarPrecoBtn" class="rounded-2xl px-4 py-2 btn-secondary font-semibold text-sm">
                    Aplicar preço sugerido
                  </button>
                </div>

                <!-- Indicadores Unitários & Ponto de Equilíbrio -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200 text-sm">
                  <div>
                    <span class="text-xs text-slate-500 block mb-1">Custo por KM</span>
                    <span id="tripCustoPorKmLabel" class="font-semibold text-slate-700">R$ 0,00</span>
                  </div>
                  <div>
                    <span class="text-xs text-slate-500 block mb-1">Receita por KM</span>
                    <span id="tripReceitaPorKmLabel" class="font-semibold text-slate-700">R$ 0,00</span>
                  </div>
                  <div>
                    <span class="text-xs text-slate-500 block mb-1">Preço por Poltrona</span>
                    <span id="tripPrecoPorPoltronaLabel" class="font-semibold text-slate-700">R$ 0,00</span>
                  </div>
                  <div>
                    <span class="text-xs text-slate-500 block mb-1">Ponto de Equilíbrio</span>
                    <span id="tripPontoEquilibrioLabel" class="font-semibold text-slate-700">0 poltronas</span>
                  </div>
                </div>
              </div>

              <!-- CONDIÇÕES COMERCIAIS -->
              <div class="xl:col-span-3 pt-4 pb-2">
                <h4 class="text-lg font-semibold border-b border-slate-200 pb-2">Condições Comerciais e Regras</h4>
              </div>

              <div class="xl:col-span-3 space-y-4 mb-4">
                <div>
                  <label class="block text-sm font-medium mb-2">Forma de Pagamento</label>
                  <input id="tripPaymentTerms" class="field" type="text" value="30% na confirmação e o restante até 5 dias antes da viagem." />
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium mb-2">O que está INCLUSO</label>
                    <textarea id="tripIncluded" class="field min-h-[100px]">Transporte ida e volta, combustível, motorista(s), pedágios e taxas de rodagem.</textarea>
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-2">O que NÃO está incluso</label>
                    <textarea id="tripNotIncluded" class="field min-h-[100px]">Hospedagem de passageiros, alimentação de passageiros, ingressos e passeios extras.</textarea>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Regras de Viagem</label>
                  <textarea id="tripRules" class="field min-h-[120px]">- Tolerância de atraso: 15 minutos.
- Bagagem: 1 mala no bagageiro e 1 volume de mão pequeno por passageiro.
- É expressamente proibido o consumo de bebidas alcoólicas e fumo no interior do veículo.
- Menores de 16 anos desacompanhados precisam de autorização judicial ou dos pais reconhecida em cartório.</textarea>
                </div>
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
                <h3 class="text-2xl font-semibold">Prévia do Orçamento</h3>
                <p class="muted mt-1">Selecione o tipo de PDF para exportar.</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button id="tripExportInternalPdfBtn" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">PDF Interno</button>
                <button id="tripExportClientPdfBtn" class="rounded-2xl px-4 py-3 btn-primary font-semibold">PDF do Cliente</button>
              </div>
            </div>
            
            <!-- Type Selector for Preview -->
            <div class="flex gap-4 mt-4 border-b border-slate-200 pb-2">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tripPreviewType" value="cliente" checked />
                    <span class="text-sm font-semibold">Visão do Cliente</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tripPreviewType" value="interno" />
                    <span class="text-sm font-semibold">Visão Interna</span>
                </label>
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
