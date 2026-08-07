import { $ } from "./controller-helpers.js";

export function togglePaymentBlocks(prefix) {
  const payment = $(`#${prefix}Payment`).value;
  const isCard = payment === "cartao_credito";
  const isCheque = payment === "cheque";
  const fieldPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);

  $(`#wrap${fieldPrefix}Card`).classList.toggle("hidden-section", !isCard);
  $(`#wrap${fieldPrefix}Buyer`).classList.toggle("hidden-section", !isCard);
  $(`#wrap${fieldPrefix}Installments`).classList.toggle("hidden-section", !isCard);
  $(`#${prefix}Card`).required = isCard;
  $(`#${prefix}Buyer`).required = isCard;
  $(`#${prefix}Installments`).required = isCard;
  $(`#wrap${fieldPrefix}ChequeDate`).classList.toggle("hidden-section", !isCheque);
  $(`#wrap${fieldPrefix}ChequeBank`).classList.toggle("hidden-section", !isCheque);
  $(`#${prefix}ChequeDate`).required = isCheque;
  $(`#${prefix}ChequeBank`).required = isCheque;
}

export function calculateInvoiceMonth(date, closingDay, dueDay, offset = 0) {
  const [year, month, day] = date.split("-").map(Number);
  let targetMonth = (day > Number(closingDay) ? month + 1 : month) + offset;
  let targetYear = year;
  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }
  const mm = String(targetMonth).padStart(2, "0");
  const dd = String(dueDay).padStart(2, "0");
  return {
    competencia: `${targetYear}-${mm}`,
    vencimentoDia: Number(dueDay),
    vencimento: `${targetYear}-${mm}-${dd}`,
  };
}

export function buildCardSchedules({
  cards,
  uid,
  sourceType,
  sourceId,
  description,
  cardId,
  buyerId,
  baseDate,
  totalValue,
  parcelas,
  firstStatus,
  vehicleId = "",
  employeeId = "",
  category = "",
  extra = "",
}) {
  const card = cards.find((item) => item.id === cardId);
  if (!card) return [];
  const basePart = Number((totalValue / parcelas).toFixed(2));
  const schedules = [];
  for (let index = 1; index <= parcelas; index++) {
    const due = calculateInvoiceMonth(
      baseDate,
      card.fechamento,
      card.vencimento,
      index - 1,
    );
    const value = index === parcelas
      ? Number((totalValue - basePart * (parcelas - 1)).toFixed(2))
      : basePart;
    schedules.push({
      id: uid(),
      sourceType,
      sourceId,
      description: extra ? `${description} • ${extra}` : description,
      cardId,
      buyerId,
      parcela: index,
      totalParcelas: parcelas,
      valor: value,
      vencimento: due.vencimento,
      status: index === 1 ? firstStatus : "a_pagar",
      veiculoId: vehicleId,
      vehicleId,
      funcionarioId: employeeId,
      employeeId,
      category,
    });
  }
  return schedules;
}
