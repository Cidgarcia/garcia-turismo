/**
 * Componente da aba de Orçamentos Comerciais da Garcia Turismo.
 * Oferece interface com barra de Preço Justo em tempo real, detalhamento de custos,
 * mapa de poltronas e ações para emissão dos PDFs do cliente e interno.
 */

export function renderOrcamentosTab() {
  return `
    <section id="tab-orcamentos" class="tab-pane hidden-section fade-in space-y-6">
      
      <!-- Top Metrics Bar -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="card p-5">
          <p class="text-xs uppercase tracking-wider font-semibold muted">Total de Orçamentos</p>
          <p id="metricTotalOrcamentos" class="text-3xl font-bold mt-2">0</p>
          <p class="text-xs muted mt-1">Registrados no sistema</p>
        </div>
        <div class="card p-5">
          <p class="text-xs uppercase tracking-wider font-semibold text-emerald-600">Aprovados</p>
          <p id="metricAprovadosOrcamentos" class="text-3xl font-bold text-emerald-600 mt-2">0</p>
          <p class="text-xs muted mt-1">Viagens confirmadas</p>
        </div>
        <div class="card p-5">
          <p class="text-xs uppercase tracking-wider font-semibold text-amber-600">Em Negociação</p>
          <p id="metricPendentesOrcamentos" class="text-3xl font-bold text-amber-600 mt-2">0</p>
          <p class="text-xs muted mt-1">Enviados dentro da validade</p>
        </div>
        <div class="card p-5">
          <p class="text-xs uppercase tracking-wider font-semibold text-blue-600">Margem Média</p>
          <p id="metricMargemMediaOrcamentos" class="text-3xl font-bold text-blue-600 mt-2">0%</p>
          <p class="text-xs muted mt-1">Meta recomendada: 50%</p>
        </div>
      </div>

      <!-- Action & Filter Bar -->
      <div class="card p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <input
            type="text"
            id="orcamentoSearchInput"
            class="field max-w-xs text-sm"
            placeholder="Buscar por cliente, destino ou nº..."
          />
          <select id="orcamentoStatusFilter" class="field max-w-[180px] text-sm">
            <option value="todos">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="enviado">Enviado</option>
            <option value="aprovado">Aprovado</option>
            <option value="recusado">Recusado</option>
            <option value="expirado">Expirado</option>
          </select>
        </div>

        <button
          type="button"
          id="btnNovoOrcamento"
          class="rounded-2xl px-5 py-3 btn-primary font-semibold flex items-center gap-2 shrink-0"
        >
          <span>+</span> Novo Orçamento
        </button>
      </div>

      <!-- Form Card (Collapsed by default, opens on "Novo" or "Editar") -->
      <div id="orcamentoFormCard" class="card p-6 space-y-6 hidden-section">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 id="orcamentoFormTitle" class="text-2xl font-bold text-slate-800">Novo Orçamento Comercial</h3>
            <p class="text-sm muted">Calcule custos detalhados, confira a barra de Preço Justo e gere as propostas.</p>
          </div>
          <button type="button" id="btnFecharOrcamentoForm" class="rounded-2xl px-4 py-2 btn-secondary font-semibold self-start">
            Fechar
          </button>
        </div>

        <form id="orcamentoForm" class="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <input type="hidden" id="orcamentoId" name="orcamentoId" value="" />
          <input type="hidden" id="orcamentoNumero" name="orcamentoNumero" value="" />
          <input type="hidden" id="orcamentoVersao" name="orcamentoVersao" value="1" />

          <!-- Left Column: Dados da Viagem e Custos (7 cols) -->
          <div class="lg:col-span-7 space-y-6">
            
            <!-- Bloco 1: Cliente e Itinerário -->
            <div class="space-y-4">
              <h4 class="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                <span>📍</span> 1. Cliente &amp; Roteiro
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div class="md:col-span-2">
                  <label class="block text-xs font-semibold muted mb-1">Nome do Cliente *</label>
                  <input class="field text-sm" id="orcCliente" required placeholder="Ex.: Associação Atlética ou Empresa X" />
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Passageiros Previstos *</label>
                  <input type="number" min="1" class="field text-sm" id="orcPassageiros" value="44" required />
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Telefone / WhatsApp</label>
                  <input class="field text-sm" id="orcClienteTelefone" placeholder="(74) 99999-9999" />
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1">E-mail para Envio</label>
                  <input type="email" class="field text-sm" id="orcClienteEmail" placeholder="cliente@email.com" />
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Origem *</label>
                  <input class="field text-sm" id="orcOrigem" required placeholder="Ex.: Juazeiro-BA / Petrolina-PE" />
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Destino Principal *</label>
                  <input class="field text-sm" id="orcDestino" required placeholder="Ex.: Salvador-BA" />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold muted mb-1">Paradas / Itinerário Detalhado</label>
                <input class="field text-sm" id="orcParadas" placeholder="Ex.: Parada em Feira de Santana para almoço" />
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Data / Hora de Ida *</label>
                  <input type="datetime-local" class="field text-sm" id="orcDataHoraIda" required />
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Data / Hora de Retorno *</label>
                  <input type="datetime-local" class="field text-sm" id="orcDataHoraVolta" required />
                </div>
              </div>
            </div>

            <!-- Bloco 2: Veículo e Distâncias -->
            <div class="space-y-4 pt-4 border-t border-slate-200">
              <h4 class="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                <span>🚍</span> 2. Veículo &amp; Quilometragem
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div class="md:col-span-2">
                  <label class="block text-xs font-semibold muted mb-1">Veículo Selecionado *</label>
                  <select id="orcVeiculoSelect" class="field text-sm" required>
                    <option value="">Selecione um veículo</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Consumo Veículo (km/l)</label>
                  <input type="number" step="0.01" min="0.1" id="orcConsumoKmLitro" class="field text-sm bg-slate-50" />
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs font-semibold muted mb-1">KM com Passageiros</label>
                  <input type="number" min="0" id="orcKmPassageiros" class="field text-sm" value="0" />
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Deslocamento Vazio (KM)</label>
                  <input type="number" min="0" id="orcKmDeslocamentoVazio" class="field text-sm" value="0" title="Garagem ➔ Origem ➔ Retorno Garagem" />
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1 font-bold text-slate-800">Distância Total (KM)</label>
                  <input type="number" min="0" id="orcDistanciaTotalKm" class="field text-sm font-bold bg-slate-50" value="0" readonly />
                </div>
              </div>
            </div>

            <!-- Bloco 3: Custos Operacionais Detalhados -->
            <div class="space-y-4 pt-4 border-t border-slate-200">
              <div class="flex items-center justify-between">
                <h4 class="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                  <span>💰</span> 3. Composição de Custos Diretos
                </h4>
                <span id="labelTotalCustosDiretos" class="text-sm font-bold text-slate-700">Custos: R$ 0,00</span>
              </div>

              <!-- Combustível -->
              <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Preço Diesel (R$/Litro)</label>
                  <input type="number" step="0.01" min="0" id="orcPrecoLitroDiesel" class="field text-sm" value="6.29" />
                </div>
                <div>
                  <p class="text-xs muted">Litros Necessários</p>
                  <p id="orcLitrosEstimados" class="text-sm font-bold text-slate-700 mt-1">0 L</p>
                </div>
                <div>
                  <p class="text-xs muted">Custo Combustível</p>
                  <p id="orcCombustivelCalculado" class="text-sm font-bold text-blue-600 mt-1">R$ 0,00</p>
                </div>
              </div>

              <!-- Motoristas -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold muted mb-1">1º Motorista (Diária/Viagem R$)</label>
                  <input type="number" step="0.01" min="0" id="orcMotorista1Valor" class="field text-sm" value="0" />
                </div>
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-xs font-semibold muted">2º Motorista (Opcional)</label>
                    <label class="text-xs flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" id="orcHabilitarMotorista2" /> Ativar
                    </label>
                  </div>
                  <input type="number" step="0.01" min="0" id="orcMotorista2Valor" class="field text-sm" value="0" disabled />
                </div>
              </div>

              <!-- Outros custos fixos operacionais -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Hospedagem (R$)</label>
                  <input type="number" step="0.01" min="0" id="orcHospedagem" class="field text-sm" value="0" />
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1">ANTT / Taxas (R$)</label>
                  <input type="number" step="0.01" min="0" id="orcAntt" class="field text-sm" value="0" />
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Água / Lanches (R$)</label>
                  <input type="number" step="0.01" min="0" id="orcAgua" class="field text-sm" value="0" />
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1" title="Custo específico operacional">Stilmill (R$)</label>
                  <input type="number" step="0.01" min="0" id="orcStilmill" class="field text-sm" value="0" />
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Pedágios (R$)</label>
                  <input type="number" step="0.01" min="0" id="orcPedagios" class="field text-sm" value="0" />
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Manutenção/KM (R$)</label>
                  <input type="number" step="0.01" min="0" id="orcManutencaoKm" class="field text-sm bg-slate-50" readonly />
                  <span id="orcManutencaoCalculada" class="text-xs text-slate-500 font-medium">R$ 0,00</span>
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Impostos (% Simples)</label>
                  <input type="number" step="0.1" min="0" max="30" id="orcAliquotaImposto" class="field text-sm" value="6.0" />
                  <span id="orcImpostoCalculado" class="text-xs text-slate-500 font-medium">R$ 0,00</span>
                </div>
              </div>

              <!-- Lista de Outros Custos Dinâmicos -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-semibold muted uppercase tracking-wide">Outros Custos Adicionais</label>
                  <button type="button" id="btnAdicionarOutroCusto" class="text-xs text-blue-600 font-semibold hover:underline">
                    + Adicionar Item
                  </button>
                </div>
                <div id="containerOutrosCustos" class="space-y-2"></div>
              </div>
            </div>

            <!-- Bloco 4: Condições Comerciais & Regras do PDF do Cliente -->
            <div class="space-y-4 pt-4 border-t border-slate-200">
              <h4 class="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                <span>📄</span> 4. Condições Comerciais &amp; Regras (PDF do Cliente)
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Forma de Pagamento</label>
                  <input class="field text-sm" id="orcFormaPagamento" value="50% na reserva e 50% até 24h antes do embarque" />
                </div>
                <div>
                  <label class="block text-xs font-semibold muted mb-1">Validade da Proposta</label>
                  <select id="orcDiasValidade" class="field text-sm">
                    <option value="7" selected>7 dias a partir da emissão</option>
                    <option value="5">5 dias</option>
                    <option value="3">3 dias</option>
                    <option value="15">15 dias</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold muted mb-1">O que está incluso</label>
                <input class="field text-sm" id="orcIncluso" value="Transporte em ônibus executivo, motorista profissional, combustível, taxas ANTT e seguro de passageiros." />
              </div>
              <div>
                <label class="block text-xs font-semibold muted mb-1">O que NÃO está incluso</label>
                <input class="field text-sm" id="orcNaoIncluso" value="Hospedagem e alimentação de passageiros, ingressos em eventos ou despesas pessoais." />
              </div>
              <div>
                <label class="block text-xs font-semibold muted mb-1">Regras de Viagem por Poltrona</label>
                <textarea rows="2" class="field text-sm" id="orcRegrasViagem">Bagagem permitida: até 20kg no bagageiro + 5kg de mão. Tolerância máxima de atraso no embarque: 15 minutos. Proibido fumar ou consumir bebidas alcoólicas a bordo. Menores de idade devem portar autorização legal.</textarea>
              </div>
            </div>

          </div>

          <!-- Right Column: Diagnóstico Financeiro & Barra de Preço Justo (5 cols) -->
          <div class="lg:col-span-5 space-y-6">
            
            <!-- Card Principal: Valor Cobrado e Preço Justo -->
            <div class="card p-6 bg-slate-900 text-white rounded-3xl space-y-6 shadow-xl border border-slate-800">
              
              <div>
                <label class="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
                  Valor Cobrado do Cliente (R$) *
                </label>
                <div class="relative">
                  <span class="absolute left-4 top-3 text-2xl font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    id="orcValorCobrado"
                    class="w-full bg-slate-800 text-white border-2 border-blue-500 rounded-2xl py-3 pl-14 pr-4 text-3xl font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/30"
                    placeholder="0,00"
                    required
                  />
                </div>
                <p class="text-xs text-slate-400 mt-2">Altere o valor para recalcular a margem instantaneamente.</p>
              </div>

              <!-- BARRA DE PREÇO JUSTO -->
              <div class="space-y-3 p-4 bg-slate-800/80 rounded-2xl border border-slate-700">
                <div class="flex items-center justify-between">
                  <span class="text-xs uppercase font-bold text-slate-300">Diagnóstico de Lucratividade</span>
                  <span id="badgePrecoJusto" class="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Preço Justo
                  </span>
                </div>

                <!-- Barra Visual de Margem -->
                <div class="relative w-full h-4 bg-slate-700 rounded-full overflow-hidden flex">
                  <div style="width: 30%" class="h-full bg-red-500/60" title="Vermelho: &lt; 30%"></div>
                  <div style="width: 20%" class="h-full bg-amber-500/60" title="Amarelo: 30% a 49.9%"></div>
                  <div style="width: 50%" class="h-full bg-emerald-500/60" title="Verde: &gt;= 50%"></div>
                  <!-- Indicador de Posição Atual -->
                  <div id="indicadorPrecoJusto" class="absolute top-0 bottom-0 w-2 bg-white shadow-lg rounded-full transition-all duration-300" style="left: 0%"></div>
                </div>
                <div class="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0% (Prejuízo)</span>
                  <span>30%</span>
                  <span>50% (Meta)</span>
                  <span>100%</span>
                </div>

                <!-- Resumo Numérico -->
                <div class="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <span class="text-xs text-slate-400">Margem Atual:</span>
                    <p id="dispMargemAtual" class="text-2xl font-black text-white">0,0%</p>
                  </div>
                  <div>
                    <span class="text-xs text-slate-400">Lucro Estimado:</span>
                    <p id="dispLucroEstimado" class="text-2xl font-black text-emerald-400">R$ 0,00</p>
                  </div>
                </div>

                <!-- Preço Mínimo para bater 50% -->
                <div class="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                  <div>
                    <span class="text-xs text-slate-400">Mínimo sugerido para 50%:</span>
                    <p id="dispPrecoSugeridoMeta" class="text-base font-bold text-amber-300">R$ 0,00</p>
                  </div>
                  <button
                    type="button"
                    id="btnAplicarPrecoSugerido"
                    class="rounded-xl px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1 shrink-0"
                    title="Preenche o valor cobrado com o valor ideal de 50%"
                  >
                    ⚡ Aplicar Preço
                  </button>
                </div>
              </div>

              <!-- Indicadores Unitários & Ponto de Equilíbrio -->
              <div class="grid grid-cols-2 gap-3 text-xs bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
                <div>
                  <span class="text-slate-400">Custo Total:</span>
                  <p id="dispCustoTotal" class="font-bold text-slate-200 mt-0.5">R$ 0,00</p>
                </div>
                <div>
                  <span class="text-slate-400">Impostos Simples:</span>
                  <p id="dispImpostosTotal" class="font-bold text-slate-200 mt-0.5">R$ 0,00</p>
                </div>
                <div>
                  <span class="text-slate-400">Custo por KM:</span>
                  <p id="dispCustoPorKm" class="font-bold text-slate-200 mt-0.5">R$ 0,00</p>
                </div>
                <div>
                  <span class="text-slate-400">Receita por KM:</span>
                  <p id="dispReceitaPorKm" class="font-bold text-slate-200 mt-0.5">R$ 0,00</p>
                </div>
                <div>
                  <span class="text-slate-400">Preço por Poltrona:</span>
                  <p id="dispPrecoPorPoltrona" class="font-bold text-blue-400 mt-0.5">R$ 0,00</p>
                </div>
                <div>
                  <span class="text-slate-400">Ponto de Equilíbrio:</span>
                  <p id="dispPontoEquilibrio" class="font-bold text-amber-400 mt-0.5">0 poltronas</p>
                </div>
              </div>

            </div>

            <!-- Prévia do Mapa de Poltronas do Veículo -->
            <div class="card p-5 space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="font-bold text-sm text-slate-700">Prévia do Mapa de Poltronas</h4>
                <span id="labelCapacidadeMapa" class="text-xs chip font-semibold">46 Lugares</span>
              </div>
              <div id="previewMapaPoltronas" class="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-center overflow-auto max-h-[300px]">
                <p class="text-xs muted py-6 text-center">Selecione um veículo para visualizar o mapa.</p>
              </div>
            </div>

            <!-- Botões de Ação do Formulário -->
            <div class="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                id="btnSalvarRascunho"
                class="rounded-2xl px-5 py-3 btn-secondary font-semibold"
              >
                Salvar Rascunho
              </button>
              <button
                type="submit"
                id="btnSalvarOrcamento"
                class="rounded-2xl px-6 py-3 btn-primary font-semibold flex items-center justify-center gap-2"
              >
                <span>✓</span> Salvar Orçamento
              </button>
            </div>

          </div>
        </form>
      </div>

      <!-- Lista / Tabela de Orçamentos -->
      <div class="card p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold text-slate-800">Histórico de Orçamentos</h3>
          <span id="contagemOrcamentos" class="text-xs muted font-semibold">0 encontrados</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº / Versão</th>
                <th>Cliente</th>
                <th>Roteiro &amp; Datas</th>
                <th>Veículo</th>
                <th>Valor Cobrado</th>
                <th>Lucro / Margem</th>
                <th>Validade / Status</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="orcamentosTableBody">
              <tr>
                <td colspan="8" class="text-center muted py-10">Carregando orçamentos...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </section>
  `;
}
