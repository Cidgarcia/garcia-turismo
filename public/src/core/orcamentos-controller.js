import {
  $,
  $$,
  currency,
  escapeHtml,
  formatDate,
  getVehicleDisplayName,
  today,
  uid,
} from "./controller-helpers.js";
import {
  calculateOrcamento,
  evaluateOrcamentoValidity,
  formatDateBR,
  fromCents,
  toCents,
} from "../utils/orcamento-calculator.js";
import { generateSeatMapSVG } from "../components/seat-map.js";

export function createOrcamentosController({
  state,
  onRenderAll,
  saveFirestoreRecord,
  removeFirestoreRecord,
  showToast,
}) {
  let outrosCustosState = [];

  function getNextSequentialNumber() {
    const list = state.data.orcamentos || [];
    let max = 0;
    list.forEach((item) => {
      const match = String(item.numeroSequencial || "").match(/ORC-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    });
    const next = max + 1;
    return `ORC-${String(next).padStart(3, "0")}`;
  }

  function getLatestDieselPrice() {
    const fuelings = state.data.fuelings || [];
    if (fuelings.length > 0) {
      const sorted = [...fuelings].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
      const latest = sorted[0];
      if (latest?.precoLitro) return Number(latest.precoLitro);
      if (latest?.valorTotal && latest?.litros) {
        return Number((latest.valorTotal / latest.litros).toFixed(2));
      }
    }
    return 6.29;
  }

  function renderVehicleOptions() {
    const select = $("#orcVeiculoSelect");
    if (!select) return;

    const vehicles = (state.data.vehicles || []).filter((v) => v.status !== "inativo");
    const options = vehicles
      .map(
        (v) =>
          `<option value="${escapeHtml(v.id)}" data-consumo="${v.consumoKmPorLitro || 3.5}" data-manut="${v.custoManutencaoKm || 0}" data-capacidade="${v.capacidade || v.lugares || 46}" data-layout="${v.layout || "onibus_46"}" data-tipo="${v.tipo || "onibus"}">
            ${escapeHtml(getVehicleDisplayName(v))}
          </option>`,
      )
      .join("");

    select.innerHTML = `<option value="">Selecione um veículo</option>${options}`;
  }

  function updateSeatMapPreview(vehicle) {
    const container = $("#previewMapaPoltronas");
    const labelCap = $("#labelCapacidadeMapa");
    if (!container) return;

    if (!vehicle) {
      container.innerHTML = `<p class="text-xs muted py-6 text-center">Selecione um veículo para visualizar o mapa de poltronas.</p>`;
      if (labelCap) labelCap.textContent = "-";
      return;
    }

    const capacidade = Number(vehicle.capacidade || vehicle.lugares || 46);
    if (labelCap) labelCap.textContent = `${capacidade} Lugares`;

    const svg = generateSeatMapSVG({
      tipo: vehicle.tipo || "onibus",
      layout: vehicle.layout || "onibus_46",
      capacidade,
      showLegend: true,
    });
    container.innerHTML = svg;
  }

  function renderOutrosCustosRows() {
    const container = $("#containerOutrosCustos");
    if (!container) return;

    if (outrosCustosState.length === 0) {
      container.innerHTML = `<p class="text-xs muted italic">Nenhum custo adicional inserido.</p>`;
      return;
    }

    container.innerHTML = outrosCustosState
      .map(
        (item, index) => `
        <div class="flex items-center gap-2 p-2 rounded-xl bg-slate-100 border border-slate-200" data-custo-index="${index}">
          <input
            type="text"
            class="field text-xs py-1 px-2 flex-1"
            placeholder="Descrição do custo (ex: Estacionamento)"
            value="${escapeHtml(item.nome || "")}"
            data-field="nome"
          />
          <div class="relative w-28">
            <span class="absolute left-2 top-1 text-xs text-slate-400">R$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              class="field text-xs py-1 pl-7 pr-2 w-full text-right font-medium"
              placeholder="0,00"
              value="${item.valor || ""}"
              data-field="valor"
            />
          </div>
          <button
            type="button"
            class="p-1 rounded-lg text-red-500 hover:bg-red-100 font-bold text-sm leading-none"
            data-action="remove-custo"
            title="Remover custo"
          >
            ×
          </button>
        </div>
      `,
      )
      .join("");
  }

  function getCalculatedOrcamentoFromForm() {
    const kmPass = Number($("#orcKmPassageiros")?.value || 0);
    const kmVazio = Number($("#orcKmDeslocamentoVazio")?.value || 0);
    const totalKm = kmPass + kmVazio;
    if ($("#orcDistanciaTotalKm")) $("#orcDistanciaTotalKm").value = totalKm;

    const consumo = Number($("#orcConsumoKmLitro")?.value || 3.5);
    const precoLitro = Number($("#orcPrecoLitroDiesel")?.value || getLatestDieselPrice());
    const pass = Number($("#orcPassageiros")?.value || 46);

    const m1 = Number($("#orcMotorista1Valor")?.value || 0);
    const m2Habilitado = $("#orcHabilitarMotorista2")?.checked;
    const m2 = m2Habilitado ? Number($("#orcMotorista2Valor")?.value || 0) : 0;

    const hosp = Number($("#orcHospedagem")?.value || 0);
    const antt = Number($("#orcAntt")?.value || 0);
    const agua = Number($("#orcAgua")?.value || 0);
    const stil = Number($("#orcStilmill")?.value || 0);
    const ped = Number($("#orcPedagios")?.value || 0);
    const manutKm = Number($("#orcManutencaoKm")?.value || 0);
    const aliqImp = Number($("#orcAliquotaImposto")?.value || 0);

    const valorCobrado = Number($("#orcValorCobrado")?.value || 0);

    return calculateOrcamento({
      valorCobrado,
      totalKm,
      capacidadePassageiros: pass,
      consumoKmPerLiter: consumo,
      fuelPricePerLiter: precoLitro,
      maintenanceCostPerKm: manutKm,
      motorista1Valor: m1,
      motorista2Valor: m2,
      hospedagem: hosp,
      antt: antt,
      agua: agua,
      stilmill: stil,
      pedagios: ped,
      outrosCustos: outrosCustosState,
      aliquotaImpostoPercent: aliqImp,
      metaMargemPercent: 50,
    });
  }

  function recalculateLiveMetrics() {
    const calc = getCalculatedOrcamentoFromForm();

    const kmPass = Number($("#orcKmPassageiros")?.value || 0);
    const kmVazio = Number($("#orcKmDeslocamentoVazio")?.value || 0);
    const totalKm = kmPass + kmVazio;
    const consumo = Number($("#orcConsumoKmLitro")?.value || 3.5);

    if ($("#orcLitrosEstimados")) {
      const litros = consumo > 0 ? (totalKm / consumo).toFixed(1) : "0";
      $("#orcLitrosEstimados").textContent = `${litros} L`;
    }
    if ($("#orcCombustivelCalculado")) {
      $("#orcCombustivelCalculado").textContent = currency(calc.custosDetalhados.combustivelCents / 100);
    }
    if ($("#orcManutencaoCalculada")) {
      $("#orcManutencaoCalculada").textContent = currency(calc.custosDetalhados.manutencaoCents / 100);
    }
    if ($("#orcImpostoCalculado")) {
      $("#orcImpostoCalculado").textContent = currency(calc.impostos);
    }
    if ($("#labelTotalCustosDiretos")) {
      $("#labelTotalCustosDiretos").textContent = `Custos Diretos: ${currency(calc.custosDetalhados.totalDiretoCents / 100)}`;
    }

    // Painel direito - Barra de Preço Justo
    if ($("#dispMargemAtual")) $("#dispMargemAtual").textContent = `${calc.margemPercent.toFixed(1)}%`;
    if ($("#dispLucroEstimado")) {
      $("#dispLucroEstimado").textContent = currency(calc.lucro);
      $("#dispLucroEstimado").className = `text-2xl font-black ${
        calc.lucro < 0 ? "text-red-400" : calc.lucro === 0 ? "text-slate-200" : "text-emerald-400"
      }`;
    }
    if ($("#dispPrecoSugeridoMeta")) $("#dispPrecoSugeridoMeta").textContent = currency(calc.precoSugeridoMeta);
    if ($("#dispCustoTotal")) $("#dispCustoTotal").textContent = currency(calc.custoTotal);
    if ($("#dispImpostosTotal")) $("#dispImpostosTotal").textContent = currency(calc.impostos);
    if ($("#dispCustoPorKm")) $("#dispCustoPorKm").textContent = currency(calc.custoPorKm);
    if ($("#dispReceitaPorKm")) $("#dispReceitaPorKm").textContent = currency(calc.receitaPorKm);
    if ($("#dispPrecoPorPoltrona")) $("#dispPrecoPorPoltrona").textContent = currency(calc.precoPorPoltrona);
    if ($("#dispPontoEquilibrio")) $("#dispPontoEquilibrio").textContent = `${calc.pontoEquilibrioPoltronas} poltronas`;

    // Posicionamento do marcador na barra de progresso (0% a 100%)
    if ($("#indicadorPrecoJusto")) {
      const pos = Math.min(Math.max(calc.margemPercent, 0), 100);
      $("#indicadorPrecoJusto").style.left = `calc(${pos}% - 4px)`;
    }

    // Badge visual de status
    if ($("#badgePrecoJusto")) {
      const badge = $("#badgePrecoJusto");
      badge.textContent = `${calc.fairPrice.label} (${calc.margemPercent.toFixed(1)}%)`;
      if (calc.fairPrice.status === "vermelho") {
        badge.className = "px-3 py-1 rounded-full text-xs font-extrabold bg-red-500/20 text-red-400 border border-red-500/30";
      } else if (calc.fairPrice.status === "amarelo") {
        badge.className = "px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30";
      } else {
        badge.className = "px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      }
    }

    return calc;
  }

  function openOrcamentoForm(orcamento = null) {
    const formCard = $("#orcamentoFormCard");
    if (!formCard) return;

    renderVehicleOptions();

    const isEdit = Boolean(orcamento);
    $("#orcamentoFormTitle").textContent = isEdit
      ? `Editar Orçamento #${orcamento.numeroSequencial || ""}`
      : "Novo Orçamento Comercial";

    $("#orcamentoId").value = orcamento?.id || "";
    $("#orcamentoNumero").value = orcamento?.numeroSequencial || getNextSequentialNumber();
    $("#orcamentoVersao").value = orcamento?.versao || 1;

    $("#orcCliente").value = orcamento?.cliente || "";
    $("#orcPassageiros").value = orcamento?.numeroPassageiros || 44;
    $("#orcClienteTelefone").value = orcamento?.clienteTelefone || "";
    $("#orcClienteEmail").value = orcamento?.clienteEmail || "";
    $("#orcOrigem").value = orcamento?.origem || "";
    $("#orcDestino").value = orcamento?.destino || "";
    $("#orcParadas").value = orcamento?.paradas || "";

    const now = new Date();
    const defaultIda = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    const defaultVolta = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16);

    $("#orcDataHoraIda").value = orcamento?.dataHoraIda || defaultIda;
    $("#orcDataHoraVolta").value = orcamento?.dataHoraVolta || defaultVolta;

    $("#orcKmPassageiros").value = orcamento?.distanciaKmPassageiros || 0;
    $("#orcKmDeslocamentoVazio").value = orcamento?.distanciaKmDeslocamentoVazio || 0;

    $("#orcPrecoLitroDiesel").value = orcamento?.custoCombustivelLitro || getLatestDieselPrice();
    $("#orcMotorista1Valor").value = orcamento?.custos?.motorista1Valor || 0;
    $("#orcMotorista2Valor").value = orcamento?.custos?.motorista2Valor || 0;
    $("#orcHabilitarMotorista2").checked = Boolean(orcamento?.custos?.motorista2Valor > 0);
    $("#orcMotorista2Valor").disabled = !$("#orcHabilitarMotorista2").checked;

    $("#orcHospedagem").value = orcamento?.custos?.hospedagem || 0;
    $("#orcAntt").value = orcamento?.custos?.antt || 0;
    $("#orcAgua").value = orcamento?.custos?.agua || 0;
    $("#orcStilmill").value = orcamento?.custos?.stilmill || 0;
    $("#orcPedagios").value = orcamento?.custos?.pedagios || 0;
    $("#orcAliquotaImposto").value = orcamento?.aliquotaImpostoPercent ?? 6.0;

    $("#orcFormaPagamento").value = orcamento?.condicoesComerciais?.formaPagamento || "50% na reserva e 50% até 24h antes do embarque";
    $("#orcDiasValidade").value = orcamento?.diasValidade || 7;
    $("#orcIncluso").value = orcamento?.condicoesComerciais?.incluso || "Transporte em ônibus executivo, motorista profissional, combustível, taxas ANTT e seguro de passageiros.";
    $("#orcNaoIncluso").value = orcamento?.condicoesComerciais?.naoIncluso || "Hospedagem e alimentação de passageiros, ingressos em eventos ou despesas pessoais.";
    $("#orcRegrasViagem").value = orcamento?.regrasViagem || "Bagagem permitida: até 20kg no bagageiro + 5kg de mão. Tolerância máxima de atraso no embarque: 15 minutos. Proibido fumar ou consumir bebidas alcoólicas a bordo. Menores de idade devem portar autorização legal.";

    $("#orcValorCobrado").value = orcamento?.valorCobrado || "";

    outrosCustosState = Array.isArray(orcamento?.outrosCustos) ? JSON.parse(JSON.stringify(orcamento.outrosCustos)) : [];
    renderOutrosCustosRows();

    if (orcamento?.veiculoId) {
      $("#orcVeiculoSelect").value = orcamento.veiculoId;
      const vehicle = (state.data.vehicles || []).find((v) => v.id === orcamento.veiculoId);
      $("#orcConsumoKmLitro").value = orcamento.custoCombustivelConsumo || vehicle?.consumoKmPorLitro || 3.5;
      $("#orcManutencaoKm").value = vehicle?.custoManutencaoKm || 0;
      updateSeatMapPreview(vehicle);
    } else {
      const firstVehicle = (state.data.vehicles || []).find((v) => v.status !== "inativo");
      if (firstVehicle) {
        $("#orcVeiculoSelect").value = firstVehicle.id;
        $("#orcConsumoKmLitro").value = firstVehicle.consumoKmPorLitro || 3.5;
        $("#orcManutencaoKm").value = firstVehicle.custoManutencaoKm || 0;
        updateSeatMapPreview(firstVehicle);
      }
    }

    formCard.classList.remove("hidden-section");
    formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    recalculateLiveMetrics();
  }

  function closeOrcamentoForm() {
    const formCard = $("#orcamentoFormCard");
    if (formCard) formCard.classList.add("hidden-section");
  }

  function renderOrcamentosTable() {
    const tbody = $("#orcamentosTableBody");
    if (!tbody) return;

    const list = state.data.orcamentos || [];
    const filter = state.ui.orcamentoFilter || "todos";
    const search = ($("#orcamentoSearchInput")?.value || "").toLowerCase().trim();

    const todayDate = today();

    // Atualiza status e expiração dinamicamente
    const evaluatedList = list.map((item) => {
      const val = evaluateOrcamentoValidity({
        dataEmissao: item.dataEmissao || item.createdAt?.slice?.(0, 10) || todayDate,
        diasValidade: item.diasValidade || 7,
        status: item.status || "rascunho",
        dataReferencia: todayDate,
      });
      return { ...item, ...val };
    });

    const filtered = evaluatedList.filter((item) => {
      if (filter !== "todos" && item.statusExibicao !== filter) return false;
      if (search) {
        const text = `${item.numeroSequencial || ""} ${item.cliente || ""} ${item.destino || ""} ${item.origem || ""}`.toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });

    // Atualiza contadores do topo
    if ($("#metricTotalOrcamentos")) $("#metricTotalOrcamentos").textContent = list.length;
    if ($("#metricAprovadosOrcamentos")) {
      $("#metricAprovadosOrcamentos").textContent = list.filter((i) => i.status === "aprovado").length;
    }
    if ($("#metricPendentesOrcamentos")) {
      $("#metricPendentesOrcamentos").textContent = evaluatedList.filter((i) => i.statusExibicao === "enviado").length;
    }
    if ($("#metricMargemMediaOrcamentos")) {
      const comValor = list.filter((i) => Number(i.valorCobrado) > 0 && i.margemPercent !== undefined);
      const media = comValor.length > 0
        ? (comValor.reduce((acc, curr) => acc + Number(curr.margemPercent || 0), 0) / comValor.length).toFixed(1)
        : "0";
      $("#metricMargemMediaOrcamentos").textContent = `${media}%`;
    }
    if ($("#contagemOrcamentos")) $("#contagemOrcamentos").textContent = `${filtered.length} de ${list.length} orçamentos`;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center muted py-10">Nenhum orçamento encontrado com os filtros atuais.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((item) => {
        const veiculo = (state.data.vehicles || []).find((v) => v.id === item.veiculoId);
        const veiculoNome = veiculo ? escapeHtml(getVehicleDisplayName(veiculo)) : "-";

        let statusBadge = "";
        if (item.statusExibicao === "aprovado") {
          statusBadge = `<span class="status-badge status-paid">Aprovado</span>`;
        } else if (item.statusExibicao === "recusado") {
          statusBadge = `<span class="status-badge status-cancelled">Recusado</span>`;
        } else if (item.statusExibicao === "expirado") {
          statusBadge = `<span class="status-badge bg-rose-100 text-rose-700 border border-rose-300 font-bold">Expirado ⚠️</span>`;
        } else if (item.statusExibicao === "enviado") {
          statusBadge = `<span class="status-badge status-scheduled">Enviado</span>`;
        } else {
          statusBadge = `<span class="status-badge bg-slate-100 text-slate-700 border border-slate-300">Rascunho</span>`;
        }

        let marginBadge = "";
        const margem = Number(item.margemPercent || 0);
        if (margem >= 50) {
          marginBadge = `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Margem: ${margem.toFixed(1)}%</span>`;
        } else if (margem >= 30) {
          marginBadge = `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">Margem: ${margem.toFixed(1)}%</span>`;
        } else {
          marginBadge = `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">Margem: ${margem.toFixed(1)}%</span>`;
        }

        const dataIdaFmt = item.dataHoraIda ? formatDateBR(item.dataHoraIda.slice(0, 10)) : "-";
        const dataVoltaFmt = item.dataHoraVolta ? formatDateBR(item.dataHoraVolta.slice(0, 10)) : "-";

        return `
          <tr>
            <td>
              <div class="font-bold text-slate-800">${escapeHtml(item.numeroSequencial || "-")}</div>
              <div class="text-[11px] text-slate-500 font-mono">v${item.versao || 1}</div>
            </td>
            <td>
              <div class="font-semibold text-slate-900">${escapeHtml(item.cliente || "-")}</div>
              <div class="text-xs text-slate-500">${escapeHtml(item.clienteTelefone || item.clienteEmail || "")}</div>
            </td>
            <td>
              <div class="text-sm font-medium text-slate-800">${escapeHtml(item.origem || "")} ➔ ${escapeHtml(item.destino || "")}</div>
              <div class="text-xs text-slate-500">${dataIdaFmt} a ${dataVoltaFmt} · ${item.distanciaTotalKm || 0} km</div>
            </td>
            <td>
              <div class="text-xs text-slate-700 max-w-[180px] truncate" title="${veiculoNome}">${veiculoNome}</div>
              <div class="text-[11px] text-slate-500">${item.numeroPassageiros || 0} passageiros</div>
            </td>
            <td>
              <div class="font-bold text-base text-slate-900">${currency(item.valorCobrado || 0)}</div>
              <div class="text-[11px] text-slate-500">Custo: ${currency(item.custoTotal || 0)}</div>
            </td>
            <td>
              <div class="font-semibold ${Number(item.lucro) >= 0 ? "text-emerald-700" : "text-red-600"}">
                ${currency(item.lucro || 0)}
              </div>
              <div class="mt-0.5">${marginBadge}</div>
            </td>
            <td>
              <div class="mb-1">${statusBadge}</div>
              <div class="text-[11px] text-slate-500">
                Até ${formatDateBR(item.dataValidade)}
              </div>
            </td>
            <td class="text-right">
              <div class="flex items-center justify-end gap-1">
                <button
                  type="button"
                  class="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium text-xs"
                  data-action="edit-orcamento"
                  data-id="${escapeHtml(item.id)}"
                  title="Editar"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 font-medium text-xs"
                  data-action="duplicate-orcamento"
                  data-id="${escapeHtml(item.id)}"
                  title="Duplicar Orçamento [MVP]"
                >
                  📋
                </button>
                ${
                  item.statusExibicao === "expirado"
                    ? `
                  <button
                    type="button"
                    class="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 font-medium text-xs"
                    data-action="renew-orcamento"
                    data-id="${escapeHtml(item.id)}"
                    title="Renovar Validade (+7 dias)"
                  >
                    🔄
                  </button>`
                    : ""
                }
                <a
                  href="/orcamento-cliente.html?id=${escapeHtml(item.id)}"
                  target="_blank"
                  class="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 font-bold text-xs"
                  title="Ver PDF do Cliente (Sem Custos)"
                >
                  📄 Cliente
                </a>
                <a
                  href="/orcamento-interno.html?id=${escapeHtml(item.id)}"
                  target="_blank"
                  class="p-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50 font-bold text-xs"
                  title="Ver PDF Interno (Planilha de Custos & Lucro)"
                >
                  📊 Interno
                </a>
                <button
                  type="button"
                  class="p-1.5 rounded-lg text-red-600 hover:bg-red-50 font-medium text-xs"
                  data-action="delete-orcamento"
                  data-id="${escapeHtml(item.id)}"
                  title="Excluir"
                >
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function saveOrcamentoFromForm(statusOverride = null) {
    const calc = recalculateLiveMetrics();
    const id = $("#orcamentoId").value || uid();
    const isNew = !$("#orcamentoId").value;
    const numero = $("#orcamentoNumero").value || getNextSequentialNumber();
    const versao = Number($("#orcamentoVersao").value || 1);

    const kmPass = Number($("#orcKmPassageiros")?.value || 0);
    const kmVazio = Number($("#orcKmDeslocamentoVazio")?.value || 0);
    const totalKm = kmPass + kmVazio;

    const dataEmissao = today();
    const diasValidade = Number($("#orcDiasValidade")?.value || 7);

    const payload = {
      id,
      numeroSequencial: numero,
      versao: isNew ? 1 : versao,
      cliente: $("#orcCliente").value.trim(),
      clienteTelefone: $("#orcClienteTelefone").value.trim(),
      clienteEmail: $("#orcClienteEmail").value.trim(),
      numeroPassageiros: Number($("#orcPassageiros").value || 44),
      origem: $("#orcOrigem").value.trim(),
      destino: $("#orcDestino").value.trim(),
      paradas: $("#orcParadas").value.trim(),
      dataHoraIda: $("#orcDataHoraIda").value,
      dataHoraVolta: $("#orcDataHoraVolta").value,
      veiculoId: $("#orcVeiculoSelect").value,
      distanciaKmPassageiros: kmPass,
      distanciaKmDeslocamentoVazio: kmVazio,
      distanciaTotalKm: totalKm,
      custoCombustivelLitro: Number($("#orcPrecoLitroDiesel").value || 6.29),
      custoCombustivelConsumo: Number($("#orcConsumoKmLitro").value || 3.5),
      custos: {
        motorista1Valor: Number($("#orcMotorista1Valor").value || 0),
        motorista2Valor: $("#orcHabilitarMotorista2").checked ? Number($("#orcMotorista2Valor").value || 0) : 0,
        hospedagem: Number($("#orcHospedagem").value || 0),
        antt: Number($("#orcAntt").value || 0),
        agua: Number($("#orcAgua").value || 0),
        stilmill: Number($("#orcStilmill").value || 0),
        pedagios: Number($("#orcPedagios").value || 0),
      },
      outrosCustos: outrosCustosState,
      aliquotaImpostoPercent: Number($("#orcAliquotaImposto").value || 6.0),
      valorCobrado: Number($("#orcValorCobrado").value || 0),
      // Métricas calculadas armazenadas
      custoTotal: calc.custoTotal,
      lucro: calc.lucro,
      margemPercent: calc.margemPercent,
      precoSugeridoMeta: calc.precoSugeridoMeta,
      status: statusOverride || "enviado",
      dataEmissao,
      diasValidade,
      dataValidade: evaluateOrcamentoValidity({ dataEmissao, diasValidade }).dataValidade,
      condicoesComerciais: {
        formaPagamento: $("#orcFormaPagamento").value.trim(),
        incluso: $("#orcIncluso").value.trim(),
        naoIncluso: $("#orcNaoIncluso").value.trim(),
      },
      regrasViagem: $("#orcRegrasViagem").value.trim(),
    };

    try {
      await saveFirestoreRecord("Orcamento", "orcamentos", payload);
      closeOrcamentoForm();
      onRenderAll();
      showToast(`Orçamento ${payload.numeroSequencial} salvo com sucesso!`, "success");
    } catch (error) {
      console.error("Erro ao salvar orçamento:", error);
      showToast(error.message || "Não foi possível salvar o orçamento.", "error");
    }
  }

  async function duplicateOrcamento(id) {
    const original = (state.data.orcamentos || []).find((item) => item.id === id);
    if (!original) return;

    const newId = uid();
    const novoNumero = getNextSequentialNumber();
    const clone = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      numeroSequencial: novoNumero,
      versao: 1,
      status: "rascunho",
      dataEmissao: today(),
      dataValidade: evaluateOrcamentoValidity({ dataEmissao: today(), diasValidade: original.diasValidade || 7 }).dataValidade,
    };

    try {
      await saveFirestoreRecord("Orcamento", "orcamentos", clone);
      onRenderAll();
      showToast(`Orçamento duplicado como #${novoNumero}!`, "success");
    } catch (error) {
      console.error("Erro ao duplicar orçamento:", error);
      showToast("Não foi possível duplicar o orçamento.", "error");
    }
  }

  async function renewOrcamento(id) {
    const item = (state.data.orcamentos || []).find((entry) => entry.id === id);
    if (!item) return;

    const dataEmissao = today();
    const diasValidade = item.diasValidade || 7;
    const dataValidade = evaluateOrcamentoValidity({ dataEmissao, diasValidade }).dataValidade;

    const payload = {
      ...item,
      versao: (item.versao || 1) + 1,
      dataEmissao,
      dataValidade,
      status: "enviado",
    };

    try {
      await saveFirestoreRecord("Orcamento", "orcamentos", payload);
      onRenderAll();
      showToast(`Orçamento #${item.numeroSequencial} renovado por mais ${diasValidade} dias!`, "success");
    } catch (error) {
      console.error("Erro ao renovar orçamento:", error);
      showToast("Não foi possível renovar o orçamento.", "error");
    }
  }

  async function deleteOrcamento(id) {
    if (!confirm("Tem certeza que deseja excluir este orçamento?")) return;
    try {
      await removeFirestoreRecord("Orcamento", "orcamentos", id);
      onRenderAll();
      showToast("Orçamento excluído.", "success");
    } catch (error) {
      console.error("Erro ao excluir orçamento:", error);
      showToast("Não foi possível excluir o orçamento.", "error");
    }
  }

  function bindEvents() {
    // Abrir formulário
    $("#btnNovoOrcamento")?.addEventListener("click", () => openOrcamentoForm());
    $("#btnFecharOrcamentoForm")?.addEventListener("click", () => closeOrcamentoForm());

    // Seletor de veículo no formulário
    $("#orcVeiculoSelect")?.addEventListener("change", (e) => {
      const vehicleId = e.target.value;
      const vehicle = (state.data.vehicles || []).find((v) => v.id === vehicleId);
      if (vehicle) {
        if ($("#orcConsumoKmLitro")) $("#orcConsumoKmLitro").value = vehicle.consumoKmPorLitro || 3.5;
        if ($("#orcManutencaoKm")) $("#orcManutencaoKm").value = vehicle.custoManutencaoKm || 0;
        if ($("#orcPassageiros")) $("#orcPassageiros").value = vehicle.capacidade || vehicle.lugares || 46;
        updateSeatMapPreview(vehicle);
      } else {
        updateSeatMapPreview(null);
      }
      recalculateLiveMetrics();
    });

    // Checkbox 2º motorista
    $("#orcHabilitarMotorista2")?.addEventListener("change", (e) => {
      const input = $("#orcMotorista2Valor");
      if (input) {
        input.disabled = !e.target.checked;
        if (input.disabled) input.value = 0;
      }
      recalculateLiveMetrics();
    });

    // Botão aplicar preço sugerido
    $("#btnAplicarPrecoSugerido")?.addEventListener("click", () => {
      const calc = getCalculatedOrcamentoFromForm();
      if (calc.precoSugeridoMeta > 0 && $("#orcValorCobrado")) {
        $("#orcValorCobrado").value = calc.precoSugeridoMeta.toFixed(2);
        recalculateLiveMetrics();
        showToast("Preço sugerido para 50% de margem aplicado!", "success");
      }
    });

    // Inputs que acionam recálculo em tempo real
    const liveInputSelectors = [
      "#orcValorCobrado",
      "#orcKmPassageiros",
      "#orcKmDeslocamentoVazio",
      "#orcConsumoKmLitro",
      "#orcPrecoLitroDiesel",
      "#orcPassageiros",
      "#orcMotorista1Valor",
      "#orcMotorista2Valor",
      "#orcHospedagem",
      "#orcAntt",
      "#orcAgua",
      "#orcStilmill",
      "#orcPedagios",
      "#orcAliquotaImposto",
    ];

    liveInputSelectors.forEach((sel) => {
      $(sel)?.addEventListener("input", () => recalculateLiveMetrics());
    });

    // Adicionar outro custo
    $("#btnAdicionarOutroCusto")?.addEventListener("click", () => {
      outrosCustosState.push({ nome: "", valor: 0 });
      renderOutrosCustosRows();
      recalculateLiveMetrics();
    });

    // Delegação de eventos no container de outros custos
    $("#containerOutrosCustos")?.addEventListener("input", (e) => {
      const row = e.target.closest("[data-custo-index]");
      if (!row) return;
      const idx = Number(row.dataset.custoIndex);
      const field = e.target.dataset.field;
      if (field === "nome") outrosCustosState[idx].nome = e.target.value;
      if (field === "valor") outrosCustosState[idx].valor = Number(e.target.value || 0);
      recalculateLiveMetrics();
    });

    $("#containerOutrosCustos")?.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="remove-custo"]');
      if (!btn) return;
      const row = btn.closest("[data-custo-index]");
      if (!row) return;
      const idx = Number(row.dataset.custoIndex);
      outrosCustosState.splice(idx, 1);
      renderOutrosCustosRows();
      recalculateLiveMetrics();
    });

    // Submissão do formulário
    $("#orcamentoForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveOrcamentoFromForm("enviado");
    });

    $("#btnSalvarRascunho")?.addEventListener("click", () => {
      saveOrcamentoFromForm("rascunho");
    });

    // Filtros e busca
    $("#orcamentoSearchInput")?.addEventListener("input", () => renderOrcamentosTable());
    $("#orcamentoStatusFilter")?.addEventListener("change", (e) => {
      state.ui.orcamentoFilter = e.target.value;
      renderOrcamentosTable();
    });

    // Delegação de cliques na tabela de orçamentos
    $("#orcamentosTableBody")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === "edit-orcamento") {
        const item = (state.data.orcamentos || []).find((o) => o.id === id);
        if (item) openOrcamentoForm(item);
      } else if (action === "duplicate-orcamento") {
        duplicateOrcamento(id);
      } else if (action === "renew-orcamento") {
        renewOrcamento(id);
      } else if (action === "delete-orcamento") {
        deleteOrcamento(id);
      }
    });
  }

  return {
    render() {
      renderOrcamentosTable();
    },
    openNewForm() {
      openOrcamentoForm();
    },
    edit(id) {
      const item = (state.data.orcamentos || []).find((o) => o.id === id);
      if (item) openOrcamentoForm(item);
    },
    duplicate: duplicateOrcamento,
    renew: renewOrcamento,
    delete: deleteOrcamento,
    init() {
      bindEvents();
      renderVehicleOptions();
      renderOrcamentosTable();
    },
  };
}

