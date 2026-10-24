import { $, $$, currency, escapeHtml, getVehicleDisplayName, uid } from "./controller-helpers.js";

export function sanitizeVehiclePayload(raw = {}, overrides = {}) {
  const merged = { ...raw, ...overrides };
  const capacidade = Math.max(1, Math.min(100, Math.round(Number(merged.capacidade || merged.lugares || 46))));
  const anoRaw = Number(merged.ano);
  const ano = Number.isFinite(anoRaw) && anoRaw >= 1900 && anoRaw <= 2100 ? Math.round(anoRaw) : new Date().getFullYear();
  const modelo = String(merged.modelo || merged.nome || "Veículo").trim().slice(0, 120);
  const nome = String(merged.nome || modelo).trim().slice(0, 120);
  const cor = String(merged.cor || "Não informada").trim().slice(0, 60);
  const placa = String(merged.placa || "").trim().toUpperCase().slice(0, 16);
  const kmAtual = Math.max(0, Math.min(5000000, Math.round(Number(merged.kmAtual || 0))));
  const status = merged.status === "inativo" ? "inativo" : "ativo";
  const tipo = ["onibus", "microonibus", "van"].includes(merged.tipo) ? merged.tipo : "onibus";
  const statusOperacional = ["disponivel", "em_viagem", "manutencao"].includes(merged.statusOperacional)
    ? merged.statusOperacional
    : "disponivel";

  const payload = {
    id: merged.id,
    ...(merged.companyId ? { companyId: merged.companyId } : {}),
    ...(merged.createdAt ? { createdAt: merged.createdAt } : {}),
    ...(merged.createdBy ? { createdBy: merged.createdBy } : {}),
    modelo,
    nome,
    tipo,
    ano,
    cor,
    placa,
    kmAtual,
    lugares: capacidade,
    capacidade,
    layout: String(merged.layout || "onibus_46").slice(0, 60),
    consumoKmPorLitro: Math.max(0, Math.min(100, Number(Number(merged.consumoKmPorLitro || 0).toFixed(2)))),
    custoManutencaoKm: Math.max(0, Math.min(1000, Number(Number(merged.custoManutencaoKm || 0).toFixed(2)))),
    statusOperacional,
    status,
  };

  if (merged.tankCapacityL !== undefined && merged.tankCapacityL !== null && merged.tankCapacityL !== "") {
    const cap = Number(merged.tankCapacityL);
    if (Number.isFinite(cap) && cap >= 0 && cap <= 5000) {
      payload.tankCapacityL = Number(cap.toFixed(1));
    }
  }

  if (merged.fuelLevelL !== undefined && merged.fuelLevelL !== null && merged.fuelLevelL !== "") {
    const lvl = Number(merged.fuelLevelL);
    if (Number.isFinite(lvl) && lvl >= 0 && lvl <= 5000) {
      payload.fuelLevelL = Number(lvl.toFixed(1));
    }
  }

  if (merged.proximaRevisaoKm !== undefined && merged.proximaRevisaoKm !== null && merged.proximaRevisaoKm !== "") {
    const revKm = Number(merged.proximaRevisaoKm);
    if (Number.isFinite(revKm) && revKm >= 0 && revKm <= 5000000) {
      payload.proximaRevisaoKm = Math.round(revKm);
    }
  }

  if (merged.proximaRevisaoTexto) {
    payload.proximaRevisaoTexto = String(merged.proximaRevisaoTexto).trim().slice(0, 120);
  }

  if (merged.motoristaPadrao) {
    payload.motoristaPadrao = String(merged.motoristaPadrao).trim().slice(0, 140);
  }

  if (merged.motoristaId) {
    payload.motoristaId = String(merged.motoristaId).trim().slice(0, 160);
  }

  if (merged.ultimaRota) {
    payload.ultimaRota = String(merged.ultimaRota).trim().slice(0, 220);
  }

  if (typeof merged.revisaoPendente === "boolean") {
    payload.revisaoPendente = merged.revisaoPendente;
  }

  return payload;
}

export function createCadastrosController({
  state,
  onRenderAll,
  saveFirestoreRecord,
  removeFirestoreRecord,
  showToast,
}) {
  function renderSelectOptions() {
    const vehicles = state.data.vehicles.filter((vehicle) => vehicle.status !== "inativo");
    const employees = state.data.employees.filter((employee) => employee.status !== "inativo");
    const buyers = state.data.buyers.filter((buyer) => buyer.status !== "inativo");
    const cards = state.data.cards;

    const vehicleOptions = vehicles
      .map((vehicle) => `<option value="${escapeHtml(vehicle.id)}">${escapeHtml(getVehicleDisplayName(vehicle))}</option>`)
      .join("");
    const employeeOptions = employees
      .map((employee) => `<option value="${escapeHtml(employee.id)}">${escapeHtml(employee.nome)} - ${escapeHtml(employee.cargo)}</option>`)
      .join("");
    const buyerOptions = buyers
      .map((buyer) => `<option value="${escapeHtml(buyer.id)}">${escapeHtml(buyer.nome)}</option>`)
      .join("");
    const cardOptions = cards
      .map(
        (card) =>
          `<option value="${escapeHtml(card.id)}">${escapeHtml(card.nome)} (Fecha ${Number(card.fechamento) || "-"} / Vence ${Number(card.vencimento) || "-"})</option>`,
      )
      .join("");

    $("#expenseVehicle").innerHTML = `<option value="">Selecione</option>${vehicleOptions}`;
    $("#fuelVehicle").innerHTML = `<option value="">Selecione</option>${vehicleOptions}`;
    $("#reportVehicle").innerHTML = `<option value="">Todos</option>${vehicleOptions}`;
    $("#fuelReportVehicle").innerHTML = `<option value="">Todos os veículos</option>${vehicleOptions}`;
    if ($("#tripVehicleIds")) {
      $("#tripVehicleIds").innerHTML =
        vehicleOptions ||
        '<option value="" disabled>Nenhum veículo ativo cadastrado</option>';
    }
    $("#expenseEmployee").innerHTML = `<option value="">Selecione</option>${employeeOptions}`;
    $("#reportEmployee").innerHTML = `<option value="">Todos</option>${employeeOptions}`;
    $("#expenseBuyer").innerHTML = `<option value="">Selecione</option>${buyerOptions}`;
    $("#fuelBuyer").innerHTML = `<option value="">Selecione</option>${buyerOptions}`;
    $("#expenseCard").innerHTML = `<option value="">Selecione</option>${cardOptions}`;
    $("#fuelCard").innerHTML = `<option value="">Selecione</option>${cardOptions}`;
    if ($("#tripResponsibleSuggestions")) {
      $("#tripResponsibleSuggestions").innerHTML = buyers
        .map((buyer) => `<option value="${escapeHtml(buyer.nome)}"></option>`)
        .join("");
    }
  }

  function renderCadastros() {
    $("#employeeTable").innerHTML =
      state.data.employees
        .map(
          (item) => `
          <tr>
            <td>${escapeHtml(item.nome)}</td>
            <td>${escapeHtml(item.cargo)}</td>
            <td>${escapeHtml(item.telefone)}</td>
            <td>${currency(item.salarioBase)}</td>
            <td class="text-right">
              <button class="text-slate-700 font-semibold mr-3" data-action="open-entity" data-entity-type="employee" data-id="${escapeHtml(item.id)}">Editar</button>
              <button class="text-red-600 font-semibold" data-action="remove-entity" data-entity-type="employee" data-id="${escapeHtml(item.id)}">Inativar</button>
            </td>
          </tr>`,
        )
        .join("") ||
      '<tr><td colspan="5" class="text-center muted py-6">Nenhum funcionário cadastrado.</td></tr>';

    $("#vehicleTable").innerHTML =
      state.data.vehicles
        .map(
          (item) => `
          <tr>
            <td>
              <div class="font-medium">${escapeHtml(item.nome || item.modelo)}</div>
              <div class="text-xs muted">${escapeHtml(item.modelo)} · ${item.ano || "-"} · ${escapeHtml(item.cor || "")} ${item.placa ? `· ${escapeHtml(item.placa)}` : ""}</div>
            </td>
            <td><span class="chip">${escapeHtml((item.tipo || "ônibus").toUpperCase())}</span></td>
            <td><strong>${item.capacidade || item.lugares || 0}</strong> pass.</td>
            <td>
              ${item.tankCapacityL ? `
                <div class="font-semibold text-xs">${item.fuelLevelL ?? 0} L / ${item.tankCapacityL} L</div>
                <div class="text-[11px] muted">${Math.round(((item.fuelLevelL ?? 0) / item.tankCapacityL) * 100)}%</div>
              ` : '<span class="muted text-xs">Não informado</span>'}
            </td>
            <td>${item.consumoKmPorLitro ? `${item.consumoKmPorLitro} km/l` : "-"}</td>
            <td>${item.custoManutencaoKm ? currency(item.custoManutencaoKm) : "R$ 0,00"}</td>
            <td>${Number(item.kmAtual || 0).toLocaleString("pt-BR")} km</td>
            <td class="text-right">
              <button class="text-slate-700 font-semibold mr-3" data-action="open-entity" data-entity-type="vehicle" data-id="${escapeHtml(item.id)}">Editar</button>
              <button class="text-red-600 font-semibold" data-action="remove-entity" data-entity-type="vehicle" data-id="${escapeHtml(item.id)}">Inativar</button>
            </td>
          </tr>`,
        )
        .join("") ||
      '<tr><td colspan="8" class="text-center muted py-6">Nenhum veículo cadastrado.</td></tr>';

    $("#buyerTable").innerHTML =
      state.data.buyers
        .map(
          (item) => `
          <tr>
            <td>${escapeHtml(item.nome)}</td>
            <td>${escapeHtml(item.status)}</td>
            <td class="text-right">
              <button class="text-slate-700 font-semibold mr-3" data-action="open-entity" data-entity-type="buyer" data-id="${escapeHtml(item.id)}">Editar</button>
              <button class="text-red-600 font-semibold" data-action="remove-entity" data-entity-type="buyer" data-id="${escapeHtml(item.id)}">Inativar</button>
            </td>
          </tr>`,
        )
        .join("") ||
      '<tr><td colspan="3" class="text-center muted py-6">Nenhum gestor cadastrado.</td></tr>';

    $("#cardTable").innerHTML =
      state.data.cards
        .map(
          (item) => `
          <tr>
            <td>${escapeHtml(item.nome)}</td>
            <td>Dia ${item.fechamento}</td>
            <td>Dia ${item.vencimento}</td>
            <td class="text-right">
              <button class="text-slate-700 font-semibold mr-3" data-action="open-entity" data-entity-type="card" data-id="${escapeHtml(item.id)}">Editar</button>
              <button class="text-red-600 font-semibold" data-action="remove-entity" data-entity-type="card" data-id="${escapeHtml(item.id)}">Excluir</button>
            </td>
          </tr>`,
        )
        .join("") ||
      '<tr><td colspan="4" class="text-center muted py-6">Nenhum cartão cadastrado.</td></tr>';
  }

  function openModal(html) {
    $("#modalRoot").classList.remove("hidden");
    $("#modalRoot").classList.add("flex");
    $("#modalContent").innerHTML = html;
  }

  function closeModal() {
    $("#modalRoot").classList.add("hidden");
    $("#modalRoot").classList.remove("flex");
    $("#modalContent").innerHTML = "";
  }

  function openEntityModal(rawType, id = "") {
    const type = String(rawType || "").toLowerCase();
    const activeEmployees = (state.data.employees || []).filter((emp) => emp.status !== "inativo");

    const config = {
      employee: {
        item: state.data.employees.find((item) => item.id === id) || {},
        form: (item) => `
              <div class="flex items-center justify-between mb-6">
                <h3 class="text-2xl font-semibold">${id ? "Editar funcionário" : "Novo funcionário"}</h3>
                <button type="button" data-action="close-modal" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Fechar</button>
              </div>
              <form id="entityForm" class="grid md:grid-cols-2 gap-4">
                <input type="hidden" name="entityType" value="employee">
                <input type="hidden" name="entityId" value="${escapeHtml(id)}">
                <div><label class="block text-sm font-medium mb-2">Nome</label><input class="field" name="nome" value="${escapeHtml(item.nome || "")}" required></div>
                <div><label class="block text-sm font-medium mb-2">Cargo</label><input class="field" name="cargo" value="${escapeHtml(item.cargo || "")}" required></div>
                <div><label class="block text-sm font-medium mb-2">Telefone</label><input class="field" name="telefone" value="${escapeHtml(item.telefone || "")}" required></div>
                <div><label class="block text-sm font-medium mb-2">Valor mensal planejado (R$)</label><input type="number" min="0" step="0.01" class="field" name="salarioBase" value="${item.salarioBase ?? ""}" placeholder="Ex.: 2500,00"></div>
                <div id="entityFormError" class="hidden md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium"></div>
                <div class="md:col-span-2 flex justify-end gap-3 mt-2">
                  <button type="button" data-action="close-modal" class="rounded-2xl px-5 py-3 btn-secondary font-semibold">Cancelar</button>
                  <button type="submit" id="entitySubmitBtn" class="rounded-2xl px-6 py-3 btn-primary font-semibold">Salvar</button>
                </div>
              </form>`,
      },
      vehicle: {
        item: state.data.vehicles.find((item) => item.id === id) || {},
        form: (item) => `
              <div class="flex items-center justify-between mb-6">
                <div>
                  <h3 class="text-2xl font-semibold">${id ? "Editar veículo" : "Novo veículo"}</h3>
                  <p class="text-sm muted">Cadastro operacional da frota, tanque, odômetro e parâmetros para orçamento.</p>
                </div>
                <button type="button" data-action="close-modal" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Fechar</button>
              </div>
              <form id="entityForm" class="grid md:grid-cols-2 gap-4" novalidate>
                <input type="hidden" name="entityType" value="vehicle">
                <input type="hidden" name="entityId" value="${escapeHtml(id)}">

                <div>
                  <label class="block text-sm font-medium mb-2">Modelo do Veículo *</label>
                  <input class="field" name="modelo" value="${escapeHtml(item.modelo || item.nome || "")}" placeholder="Ex.: Marcopolo Paradiso G7 1200 Scania" required maxlength="120">
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Identificação / Nome Comercial</label>
                  <input class="field" name="nome" value="${escapeHtml(item.nome || "")}" placeholder="Ex.: Ônibus Executivo 01 (opcional)" maxlength="120">
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Placa *</label>
                  <input class="field uppercase" name="placa" value="${escapeHtml(item.placa || "")}" placeholder="Ex.: RJA2C56 ou ABC-1234" required maxlength="16">
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Status Operacional *</label>
                  <select class="field" name="statusOperacional" required>
                    <option value="disponivel" ${(item.statusOperacional || "disponivel") === "disponivel" ? "selected" : ""}>Disponível</option>
                    <option value="em_viagem" ${item.statusOperacional === "em_viagem" ? "selected" : ""}>Em viagem</option>
                    <option value="manutencao" ${item.statusOperacional === "manutencao" ? "selected" : ""}>Manutenção</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Tipo de Veículo *</label>
                  <select class="field" name="tipo" required>
                    <option value="onibus" ${(item.tipo || "onibus") === "onibus" ? "selected" : ""}>Ônibus</option>
                    <option value="microonibus" ${item.tipo === "microonibus" ? "selected" : ""}>Micro-ônibus</option>
                    <option value="van" ${item.tipo === "van" ? "selected" : ""}>Van</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Capacidade de Passageiros (Poltronas) *</label>
                  <input type="number" min="1" max="100" step="1" class="field" name="capacidade" value="${item.capacidade || item.lugares || 46}" required>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Capacidade do Tanque (em Litros — L)</label>
                  <input type="number" min="0" max="5000" step="0.1" class="field" name="tankCapacityL" value="${item.tankCapacityL ?? ""}" placeholder="Ex.: 400">
                  <span class="text-xs muted">Em litros (L). Necessário para barra de combustível da frota.</span>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Combustível Atual (em Litros — L)</label>
                  <input type="number" min="0" max="5000" step="0.1" class="field" name="fuelLevelL" value="${item.fuelLevelL ?? ""}" placeholder="Ex.: 180">
                  <span class="text-xs muted">Volume estimado atual no tanque em litros (L).</span>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Consumo Médio (km/L) *</label>
                  <input type="number" step="0.01" min="0.1" max="100" class="field" name="consumoKmPorLitro" value="${item.consumoKmPorLitro ?? ""}" placeholder="Ex.: 3.50 (ônibus) ou 8.50 (van)" required>
                  <span class="text-xs muted">Base obrigatória para o cálculo de diesel nos orçamentos.</span>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Odômetro Atual (km) *</label>
                  <input type="number" min="0" max="5000000" step="1" class="field" name="kmAtual" value="${item.kmAtual ?? 0}" required>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Próxima Revisão (Odômetro previsto em km)</label>
                  <input type="number" min="0" max="5000000" step="1" class="field" name="proximaRevisaoKm" value="${item.proximaRevisaoKm ?? ""}" placeholder="Ex.: 320000">
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Observação da Próxima Revisão</label>
                  <input class="field" name="proximaRevisaoTexto" value="${escapeHtml(item.proximaRevisaoTexto || "")}" placeholder="Ex.: Em 5.000 km ou Troca de óleo" maxlength="120">
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Motorista Escalado / Padrão</label>
                  <input class="field" name="motoristaPadrao" list="vehicleDriversDatalist" value="${escapeHtml(item.motoristaPadrao || "")}" placeholder="Nome do motorista ou Não escalado" maxlength="140">
                  <datalist id="vehicleDriversDatalist">
                    ${activeEmployees.map((emp) => `<option value="${escapeHtml(emp.nome)}"></option>`).join("")}
                  </datalist>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Última Rota Realizada</label>
                  <input class="field" name="ultimaRota" value="${escapeHtml(item.ultimaRota || "")}" placeholder="Ex.: Juazeiro → Salvador" maxlength="220">
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Ano de Fabricação *</label>
                  <input type="number" min="1900" max="2100" step="1" class="field" name="ano" value="${item.ano || new Date().getFullYear()}" required>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Cor *</label>
                  <input class="field" name="cor" value="${escapeHtml(item.cor || "Branco")}" placeholder="Ex.: Branco, Prata, Preto" required maxlength="60">
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Layout de Poltronas</label>
                  <select class="field" name="layout">
                    <option value="onibus_46" ${(item.layout || "onibus_46") === "onibus_46" ? "selected" : ""}>Ônibus 46 Lugares (2x2)</option>
                    <option value="onibus_44" ${item.layout === "onibus_44" ? "selected" : ""}>Ônibus 44 Lugares (2x2)</option>
                    <option value="micro_28" ${item.layout === "micro_28" ? "selected" : ""}>Micro-ônibus 28 Lugares (2x2)</option>
                    <option value="van_19" ${item.layout === "van_19" ? "selected" : ""}>Van 19 Lugares</option>
                    <option value="van_15" ${item.layout === "van_15" ? "selected" : ""}>Van 15 Lugares</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Custo Manutenção por KM (R$)</label>
                  <input type="number" step="0.01" min="0" max="1000" class="field" name="custoManutencaoKm" value="${item.custoManutencaoKm ?? 0}" placeholder="Ex.: 0.45">
                </div>

                <div class="flex items-center gap-2 pt-2">
                  <input id="vehicleRevisaoPendente" type="checkbox" name="revisaoPendente" class="w-4 h-4 cursor-pointer" ${item.revisaoPendente ? "checked" : ""}>
                  <label for="vehicleRevisaoPendente" class="text-sm font-medium cursor-pointer text-slate-800">Marcar alerta de revisão pendente</label>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Situação do Cadastro</label>
                  <select class="field" name="status">
                    <option value="ativo" ${item.status !== "inativo" ? "selected" : ""}>Ativo na frota</option>
                    <option value="inativo" ${item.status === "inativo" ? "selected" : ""}>Inativo</option>
                  </select>
                </div>

                <div id="entityFormError" class="hidden md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium"></div>

                <div class="md:col-span-2 flex justify-end gap-3 mt-2">
                  <button type="button" data-action="close-modal" class="rounded-2xl px-5 py-3 btn-secondary font-semibold">Cancelar</button>
                  <button type="submit" id="entitySubmitBtn" class="rounded-2xl px-6 py-3 btn-primary font-semibold">Salvar Veículo</button>
                </div>
              </form>`,
      },
      buyer: {
        item: state.data.buyers.find((item) => item.id === id) || {},
        form: (item) => `
              <div class="flex items-center justify-between mb-6">
                <h3 class="text-2xl font-semibold">${id ? "Editar gestor" : "Novo gestor"}</h3>
                <button type="button" data-action="close-modal" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Fechar</button>
              </div>
              <form id="entityForm" class="grid md:grid-cols-2 gap-4">
                <input type="hidden" name="entityType" value="buyer">
                <input type="hidden" name="entityId" value="${escapeHtml(id)}">
                <div><label class="block text-sm font-medium mb-2">Nome</label><input class="field" name="nome" value="${escapeHtml(item.nome || "")}" required></div>
                <div><label class="block text-sm font-medium mb-2">Status</label><select class="field" name="status"><option value="ativo" ${item.status !== "inativo" ? "selected" : ""}>Ativo</option><option value="inativo" ${item.status === "inativo" ? "selected" : ""}>Inativo</option></select></div>
                <div id="entityFormError" class="hidden md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium"></div>
                <div class="md:col-span-2 flex justify-end gap-3 mt-2">
                  <button type="button" data-action="close-modal" class="rounded-2xl px-5 py-3 btn-secondary font-semibold">Cancelar</button>
                  <button type="submit" id="entitySubmitBtn" class="rounded-2xl px-5 py-4 btn-primary font-semibold">Salvar</button>
                </div>
              </form>`,
      },
      card: {
        item: state.data.cards.find((item) => item.id === id) || {},
        form: (item) => `
              <div class="flex items-center justify-between mb-6">
                <h3 class="text-2xl font-semibold">${id ? "Editar cartão" : "Novo cartão"}</h3>
                <button type="button" data-action="close-modal" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Fechar</button>
              </div>
              <form id="entityForm" class="grid md:grid-cols-3 gap-4">
                <input type="hidden" name="entityType" value="card">
                <input type="hidden" name="entityId" value="${escapeHtml(id)}">
                <div><label class="block text-sm font-medium mb-2">Nome do cartão</label><input class="field" name="nome" value="${escapeHtml(item.nome || "")}" required></div>
                <div><label class="block text-sm font-medium mb-2">Dia de fechamento</label><input type="number" min="1" max="31" class="field" name="fechamento" value="${item.fechamento || ""}" required></div>
                <div><label class="block text-sm font-medium mb-2">Dia de vencimento</label><input type="number" min="1" max="31" class="field" name="vencimento" value="${item.vencimento || ""}" required></div>
                <div id="entityFormError" class="hidden md:col-span-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium"></div>
                <div class="md:col-span-3 flex justify-end gap-3 mt-2">
                  <button type="button" data-action="close-modal" class="rounded-2xl px-5 py-3 btn-secondary font-semibold">Cancelar</button>
                  <button type="submit" id="entitySubmitBtn" class="rounded-2xl px-5 py-4 btn-primary font-semibold">Salvar</button>
                </div>
              </form>`,
      },
    };
    if (!config[type]) {
      console.error("[Cadastros] Tipo de entidade desconhecido:", rawType);
      return;
    }
    openModal(config[type].form(config[type].item));
    bindEntityForm();
  }

  async function removeEntity(rawType, id) {
    const type = String(rawType || "").toLowerCase();
    if (!confirm("Tem certeza que deseja continuar?")) return;

    const configuration = {
      employee: { recordType: "Employee", listName: "employees", inactive: true },
      vehicle: { recordType: "Vehicle", listName: "vehicles", inactive: true },
      buyer: { recordType: "Buyer", listName: "buyers", inactive: true },
      card: { recordType: "Card", listName: "cards", inactive: false },
    }[type];
    if (!configuration) return;

    try {
      if (configuration.inactive) {
        const item = state.data[configuration.listName].find((entry) => entry.id === id);
        if (!item) throw new Error("Registro não encontrado.");
        const updatedRecord =
          type === "vehicle"
            ? sanitizeVehiclePayload(item, { status: "inativo" })
            : { ...item, status: "inativo" };
        await saveFirestoreRecord(configuration.recordType, configuration.listName, updatedRecord);
      } else {
        await removeFirestoreRecord(configuration.recordType, configuration.listName, id);
      }
      onRenderAll();
      showToast("Registro atualizado.", "success");
    } catch (error) {
      console.error("Erro ao atualizar registro:", error);
      showToast(error.message || "Não foi possível atualizar o registro.", "error");
    }
  }

  function showFormError(message) {
    const errorEl = $("#entityFormError");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove("hidden");
    }
    showToast(message, "error");
  }

  function bindEntityForm() {
    const form = $("#entityForm");
    if (!form) return;

    let isSubmitting = false;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (isSubmitting) return;

      const errorEl = $("#entityFormError");
      if (errorEl) {
        errorEl.textContent = "";
        errorEl.classList.add("hidden");
      }

      const data = Object.fromEntries(new FormData(form).entries());
      const id = data.entityId || uid();
      let recordType = "";
      let listName = "";
      let payload = null;

      if (data.entityType === "employee") {
        const nome = String(data.nome || "").trim();
        const cargo = String(data.cargo || "").trim();
        const telefone = String(data.telefone || "").trim();
        if (!nome || !cargo || !telefone) {
          showFormError("Preencha nome, cargo e telefone do funcionário.");
          return;
        }
        recordType = "Employee";
        listName = "employees";
        payload = {
          id,
          nome,
          cargo,
          telefone,
          salarioBase: Math.max(0, Number(data.salarioBase || 0)),
          status: "ativo",
        };
      }

      if (data.entityType === "vehicle") {
        recordType = "Vehicle";
        listName = "vehicles";
        const existingVehicle = state.data.vehicles.find((v) => v.id === id) || {};

        const modelo = String(data.modelo || data.nome || "").trim();
        const nome = String(data.nome || modelo).trim();
        const placa = String(data.placa || "").trim().toUpperCase();
        const cor = String(data.cor || "").trim();
        const ano = Number(data.ano);
        const capacidade = Number(data.capacidade || data.lugares || 0);
        const kmAtual = Number(data.kmAtual ?? 0);
        const consumoKmPorLitro = Number(data.consumoKmPorLitro || 0);
        const custoManutencaoKm = Number(data.custoManutencaoKm || 0);
        const hasTankCapacity = data.tankCapacityL !== "" && data.tankCapacityL !== undefined;
        const hasFuelLevel = data.fuelLevelL !== "" && data.fuelLevelL !== undefined;
        const tankCapacityL = hasTankCapacity ? Number(data.tankCapacityL) : undefined;
        const fuelLevelL = hasFuelLevel ? Number(data.fuelLevelL) : undefined;
        const hasProximaRevisaoKm = data.proximaRevisaoKm !== "" && data.proximaRevisaoKm !== undefined;
        const proximaRevisaoKm = hasProximaRevisaoKm ? Number(data.proximaRevisaoKm) : undefined;
        const proximaRevisaoTexto = String(data.proximaRevisaoTexto || "").trim();
        const motoristaPadrao = String(data.motoristaPadrao || "").trim();
        const ultimaRota = String(data.ultimaRota || "").trim();
        const revisaoPendente = form.querySelector('[name="revisaoPendente"]')?.checked === true;

        if (!modelo) {
          showFormError("Informe o modelo do veículo.");
          return;
        }
        if (!placa) {
          showFormError("Informe a placa do veículo.");
          return;
        }
        if (!cor) {
          showFormError("Informe a cor do veículo.");
          return;
        }
        if (!Number.isFinite(ano) || ano < 1900 || ano > 2100) {
          showFormError("Informe um ano de fabricação válido (entre 1900 e 2100).");
          return;
        }
        if (!Number.isFinite(capacidade) || capacidade < 1 || capacidade > 100) {
          showFormError("A capacidade de passageiros deve estar entre 1 e 100 lugares.");
          return;
        }
        if (!Number.isFinite(consumoKmPorLitro) || consumoKmPorLitro <= 0 || consumoKmPorLitro > 100) {
          showFormError("Informe um consumo médio válido em km/L (maior que zero).");
          return;
        }
        if (!Number.isFinite(kmAtual) || kmAtual < 0 || kmAtual > 5000000) {
          showFormError("Informe um odômetro (KM atual) válido.");
          return;
        }
        if (tankCapacityL !== undefined && (!Number.isFinite(tankCapacityL) || tankCapacityL < 0 || tankCapacityL > 5000)) {
          showFormError("Capacidade do tanque inválida (0 a 5000 L).");
          return;
        }
        if (fuelLevelL !== undefined && (!Number.isFinite(fuelLevelL) || fuelLevelL < 0 || fuelLevelL > 5000)) {
          showFormError("Nível de combustível atual inválido (0 a 5000 L).");
          return;
        }
        if (tankCapacityL !== undefined && tankCapacityL > 0 && fuelLevelL !== undefined && fuelLevelL > tankCapacityL) {
          showFormError("O combustível atual não pode ser maior que a capacidade do tanque.");
          return;
        }

        const matchedEmployee = (state.data.employees || []).find(
          (emp) => emp.nome && emp.nome.toLowerCase() === motoristaPadrao.toLowerCase(),
        );

        payload = sanitizeVehiclePayload(existingVehicle, {
          id,
          nome,
          tipo: data.tipo || "onibus",
          modelo,
          ano,
          cor,
          placa,
          kmAtual,
          lugares: capacidade,
          capacidade,
          layout: data.layout || "onibus_46",
          consumoKmPorLitro,
          custoManutencaoKm,
          tankCapacityL,
          fuelLevelL,
          proximaRevisaoKm,
          proximaRevisaoTexto: proximaRevisaoTexto || undefined,
          motoristaPadrao: motoristaPadrao || undefined,
          motoristaId: matchedEmployee?.id || undefined,
          ultimaRota: ultimaRota || undefined,
          revisaoPendente,
          statusOperacional: data.statusOperacional || "disponivel",
          status: data.status || "ativo",
        });
      }

      if (data.entityType === "buyer") {
        const nome = String(data.nome || "").trim();
        if (!nome) {
          showFormError("Informe o nome do gestor.");
          return;
        }
        recordType = "Buyer";
        listName = "buyers";
        payload = { id, nome, status: data.status === "inativo" ? "inativo" : "ativo" };
      }

      if (data.entityType === "card") {
        const nome = String(data.nome || "").trim();
        const fechamento = Number(data.fechamento);
        const vencimento = Number(data.vencimento);
        if (!nome || fechamento < 1 || fechamento > 31 || vencimento < 1 || vencimento > 31) {
          showFormError("Preencha o nome do cartão e dias válidos (1 a 31).");
          return;
        }
        recordType = "Card";
        listName = "cards";
        payload = {
          id,
          nome,
          fechamento,
          vencimento,
        };
      }

      if (!payload) return;

      const submitBtn = $("#entitySubmitBtn") || form.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.textContent : "Salvar";
      isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Salvando...";
      }

      try {
        await saveFirestoreRecord(recordType, listName, payload);
        onRenderAll();
        closeModal();
        showToast("Cadastro salvo com sucesso.", "success");
      } catch (error) {
        console.error("Erro ao salvar cadastro:", error);
        showFormError(error.message || "Não foi possível salvar o cadastro.");
      } finally {
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }
    });
  }

  function bindModalTriggers() {
    $$('[data-open-modal]').forEach((button) => {
      button.addEventListener("click", () => openEntityModal(button.dataset.openModal));
    });
    $("#modalRoot").addEventListener("click", (event) => {
      if (event.target.id === "modalRoot") closeModal();
    });
  }

  return {
    bindModalTriggers,
    closeModal,
    openEntityModal,
    removeEntity,
    renderCadastros,
    renderSelectOptions,
  };
}
