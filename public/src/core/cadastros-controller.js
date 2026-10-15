import { $, $$, currency, escapeHtml, getVehicleDisplayName, uid } from "./controller-helpers.js";

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
              <div class="text-xs muted">${escapeHtml(item.modelo)} · ${item.ano || "-"} · ${escapeHtml(item.cor || "")}</div>
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
            <td>${item.kmAtual || 0} km</td>
            <td class="text-right">
              <button class="text-slate-700 font-semibold mr-3" data-action="open-entity" data-entity-type="vehicle" data-id="${escapeHtml(item.id)}">Editar</button>
              <button class="text-red-600 font-semibold" data-action="remove-entity" data-entity-type="vehicle" data-id="${escapeHtml(item.id)}">Inativar</button>
            </td>
          </tr>`,
        )
        .join("") ||
      '<tr><td colspan="7" class="text-center muted py-6">Nenhum veículo cadastrado.</td></tr>';

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

  function openEntityModal(type, id = "") {
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
                <div><label class="block text-sm font-medium mb-2">Valor mensal planejado</label><input type="number" min="0" step="0.01" class="field" name="salarioBase" value="${item.salarioBase || ""}" placeholder="Ex.: 2500,00"></div>
                <div class="md:col-span-2 flex justify-end"><button class="rounded-2xl px-5 py-4 btn-primary font-semibold">Salvar</button></div>
              </form>`,
      },
      vehicle: {
        item: state.data.vehicles.find((item) => item.id === id) || {},
        form: (item) => `
              <div class="flex items-center justify-between mb-6">
                <div>
                  <h3 class="text-2xl font-semibold">${id ? "Editar veículo" : "Novo veículo"}</h3>
                  <p class="text-sm muted">Parâmetros essenciais para cálculo automático de orçamentos e relatórios.</p>
                </div>
                <button type="button" data-action="close-modal" class="rounded-2xl px-4 py-3 btn-secondary font-semibold">Fechar</button>
              </div>
              <form id="entityForm" class="grid md:grid-cols-2 gap-4">
                <input type="hidden" name="entityType" value="vehicle">
                <input type="hidden" name="entityId" value="${escapeHtml(id)}">
                
                <div>
                  <label class="block text-sm font-medium mb-2">Identificação / Nome Comercial</label>
                  <input class="field" name="nome" value="${escapeHtml(item.nome || "")}" placeholder="Ex.: Ônibus Executivo 01" required>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Tipo de Veículo</label>
                  <select class="field" name="tipo" required>
                    <option value="onibus" ${(item.tipo || "onibus") === "onibus" ? "selected" : ""}>Ônibus</option>
                    <option value="microonibus" ${item.tipo === "microonibus" ? "selected" : ""}>Micro-ônibus</option>
                    <option value="van" ${item.tipo === "van" ? "selected" : ""}>Van</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Modelo do Chassi/Carroceria</label>
                  <input class="field" name="modelo" value="${escapeHtml(item.modelo || "")}" placeholder="Ex.: Marcopolo G7 1200" required>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Ano de Fabricação</label>
                  <input type="number" class="field" name="ano" value="${item.ano || ""}" required>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Capacidade (Passageiros)</label>
                  <input type="number" min="1" max="100" class="field" name="capacidade" value="${item.capacidade || item.lugares || 46}" required>
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
                  <label class="block text-sm font-medium mb-2">Consumo Médio (KM por Litro)</label>
                  <input type="number" step="0.01" min="0.1" class="field" name="consumoKmPorLitro" value="${item.consumoKmPorLitro || ""}" placeholder="Ex.: 3.20 (ônibus) ou 8.50 (van)" required>
                  <span class="text-xs muted">Base para cálculo automático de diesel no orçamento.</span>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Custo Manutenção/Desgaste por KM (R$)</label>
                  <input type="number" step="0.01" min="0" class="field" name="custoManutencaoKm" value="${item.custoManutencaoKm || "0"}" placeholder="Ex.: 0.45">
                  <span class="text-xs muted">Custo por km rodado (óleo, pneus, freios).</span>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Placa</label>
                  <input class="field" name="placa" value="${escapeHtml(item.placa || "")}" placeholder="ABC-1234">
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Cor</label>
                  <input class="field" name="cor" value="${escapeHtml(item.cor || "")}" required>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Capacidade do Tanque (Litros)</label>
                  <input type="number" min="0" max="5000" step="1" class="field" name="tankCapacityL" value="${item.tankCapacityL ?? ""}" placeholder="Ex.: 300">
                  <span class="text-xs muted">Usado para exibir o tanque visual e alerta de reserva.</span>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Nível Atual de Combustível (Litros)</label>
                  <input type="number" min="0" max="5000" step="1" class="field" name="fuelLevelL" value="${item.fuelLevelL ?? ""}" placeholder="Ex.: 150">
                  <span class="text-xs muted">Estimativa atual. Atualizado automaticamente nos abastecimentos.</span>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">KM Atual</label>
                  <input type="number" class="field" name="kmAtual" value="${item.kmAtual || 0}" required>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Status Operacional</label>
                  <select class="field" name="statusOperacional">
                    <option value="disponivel" ${(item.statusOperacional || "disponivel") === "disponivel" ? "selected" : ""}>Disponível</option>
                    <option value="em_viagem" ${item.statusOperacional === "em_viagem" ? "selected" : ""}>Indisponível: Em viagem</option>
                    <option value="manutencao" ${item.statusOperacional === "manutencao" ? "selected" : ""}>Indisponível: Manutenção</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Cadastro do Veículo</label>
                  <select class="field" name="status">
                    <option value="ativo" ${item.status !== "inativo" ? "selected" : ""}>Ativo na frota</option>
                    <option value="inativo" ${item.status === "inativo" ? "selected" : ""}>Inativo</option>
                  </select>
                </div>

                <div class="md:col-span-2 flex justify-end gap-3 mt-2">
                  <button type="button" data-action="close-modal" class="rounded-2xl px-5 py-3 btn-secondary font-semibold">Cancelar</button>
                  <button class="rounded-2xl px-6 py-3 btn-primary font-semibold">Salvar Veículo</button>
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
                <div class="md:col-span-2 flex justify-end"><button class="rounded-2xl px-5 py-4 btn-primary font-semibold">Salvar</button></div>
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
                <div class="md:col-span-3 flex justify-end"><button class="rounded-2xl px-5 py-4 btn-primary font-semibold">Salvar</button></div>
              </form>`,
      },
    };
    openModal(config[type].form(config[type].item));
    bindEntityForm();
  }

  async function removeEntity(type, id) {
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
        await saveFirestoreRecord(configuration.recordType, configuration.listName, {
          ...item,
          status: "inativo",
        });
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

  function bindEntityForm() {
    const form = $("#entityForm");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const id = data.entityId || uid();
      let recordType = "";
      let listName = "";
      let payload = null;

      if (data.entityType === "employee") {
        recordType = "Employee";
        listName = "employees";
        payload = {
          id,
          nome: data.nome,
          cargo: data.cargo,
          telefone: data.telefone,
          salarioBase: Number(data.salarioBase),
          status: "ativo",
        };
      }

      if (data.entityType === "vehicle") {
        recordType = "Vehicle";
        listName = "vehicles";
        const capacidade = Math.max(Number(data.capacidade || data.lugares || 0), 1);
        const tankCapacityL = data.tankCapacityL !== "" && data.tankCapacityL !== undefined ? Math.max(0, Number(data.tankCapacityL)) : undefined;
        const fuelLevelL = data.fuelLevelL !== "" && data.fuelLevelL !== undefined ? Math.max(0, Number(data.fuelLevelL)) : undefined;
        payload = {
          id,
          nome: data.nome || data.modelo,
          tipo: data.tipo || "onibus",
          modelo: data.modelo,
          ano: Number(data.ano),
          cor: data.cor,
          placa: data.placa || "",
          kmAtual: Number(data.kmAtual || 0),
          lugares: capacidade,
          capacidade,
          layout: data.layout || "onibus_46",
          consumoKmPorLitro: Number(data.consumoKmPorLitro || 0),
          custoManutencaoKm: Number(data.custoManutencaoKm || 0),
          ...(tankCapacityL !== undefined ? { tankCapacityL } : {}),
          ...(fuelLevelL !== undefined ? { fuelLevelL } : {}),
          statusOperacional: data.statusOperacional || "disponivel",
          status: data.status,
        };
      }

      if (data.entityType === "buyer") {
        recordType = "Buyer";
        listName = "buyers";
        payload = { id, nome: data.nome, status: data.status };
      }

      if (data.entityType === "card") {
        recordType = "Card";
        listName = "cards";
        payload = {
          id,
          nome: data.nome,
          fechamento: Number(data.fechamento),
          vencimento: Number(data.vencimento),
        };
      }

      if (!payload) return;
      try {
        await saveFirestoreRecord(recordType, listName, payload);
        onRenderAll();
        closeModal();
        showToast("Cadastro salvo com sucesso.", "success");
      } catch (error) {
        console.error("Erro ao salvar cadastro:", error);
        showToast(error.message || "Não foi possível salvar o cadastro.", "error");
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
