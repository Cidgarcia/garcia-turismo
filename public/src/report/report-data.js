function stringId(value) {
  return String(value ?? "").trim();
}

export function getRecordVehicleId(item = {}) {
  return [item.veiculoId, item.vehicleId, item.veiculo_id]
    .map(stringId)
    .find(Boolean) || "";
}

function getRecordDate(item = {}) {
  return String(item.data || item.vencimento || "");
}

function getVehicleName(data, vehicleId) {
  const vehicle = (data.vehicles || []).find((item) => stringId(item.id) === stringId(vehicleId));
  if (!vehicle) return "Não vinculado";

  return [vehicle.modelo, vehicle.ano, vehicle.cor].filter(Boolean).join(" ").trim() || "Veículo";
}

function paymentLabel(value) {
  const labels = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    cheque: "Cheque",
    cartao_credito: "Cartão de crédito",
  };
  return labels[value] || value || "-";
}

function categoryLabel(value) {
  const labels = {
    combustivel: "Combustível",
    manutencao: "Manutenção",
    pedagio: "Pedágio",
    alimentacao: "Alimentação",
    outros: "Outros",
  };
  return labels[value] || value || "-";
}

function isWithinPeriod(item, period) {
  const date = getRecordDate(item);
  return date >= period.start && date <= period.end;
}

function isForVehicle(item, vehicleId) {
  return !vehicleId || getRecordVehicleId(item) === vehicleId;
}

function rowFromExpense(data, item) {
  const vehicleId = getRecordVehicleId(item);
  return {
    data: getRecordDate(item),
    tipo: "Despesa",
    categoria: categoryLabel(item.categoria || item.category),
    descricao: item.descricao || item.descricaoGasto || item.description || "-",
    veiculo: getVehicleName(data, vehicleId),
    pagamento: paymentLabel(item.paymentMethod),
    status: item.status === "pago" ? "Pago" : "A pagar",
    valor: Number(item.valor || item.value || 0),
  };
}

function rowFromFueling(data, item) {
  const vehicleId = getRecordVehicleId(item);
  return {
    data: getRecordDate(item),
    tipo: "Combustível",
    categoria: "Abastecimento",
    descricao: `${Number(item.litros || 0)} L · ${Number(item.mediaKmLitro || 0)} km/l`,
    veiculo: getVehicleName(data, vehicleId),
    pagamento: paymentLabel(item.paymentMethod),
    status: item.status === "pago" ? "Pago" : "A pagar",
    valor: Number(item.valorTotal || item.valor || item.value || 0),
  };
}

function rowFromCardSchedule(data, item) {
  const vehicleId = getRecordVehicleId(item);
  return {
    data: getRecordDate(item),
    tipo: item.sourceType === "fuel" ? "Combustível" : "Despesa",
    categoria: item.sourceType === "fuel" ? "Abastecimento" : categoryLabel(item.category || item.categoria),
    descricao: item.description || item.descricao || "Parcela de cartão",
    veiculo: getVehicleName(data, vehicleId),
    pagamento: "Cartão de crédito",
    status: item.status === "pago" ? "Pago" : "A pagar",
    valor: Number(item.valor || item.value || 0),
  };
}

export function buildReportRows(data, period, vehicle = null) {
  const vehicleId = stringId(vehicle?.id);
  const include = (item) => isWithinPeriod(item, period) && isForVehicle(item, vehicleId);

  const expenses = (data.expenses || [])
    .filter((item) => item.paymentMethod !== "cartao_credito")
    .filter(include)
    .map((item) => rowFromExpense(data, item));
  const fuelings = (data.fuelings || [])
    .filter((item) => item.paymentMethod !== "cartao_credito")
    .filter(include)
    .map((item) => rowFromFueling(data, item));
  const cardSchedules = (data.cardSchedules || [])
    .filter(include)
    .map((item) => rowFromCardSchedule(data, item));

  return [...expenses, ...fuelings, ...cardSchedules]
    .sort((left, right) => String(left.data).localeCompare(String(right.data)));
}
