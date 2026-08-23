function timestampToIsoDate(value) {
  if (!value) return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString().slice(0, 10);
  }

  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  return "";
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1000000);
  }
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function getFuelingDate(fueling = {}) {
  return timestampToIsoDate(fueling.fuelingDate)
    || timestampToIsoDate(fueling.data)
    || timestampToIsoDate(fueling.createdAt);
}

export function compareFuelingsChronologically(left = {}, right = {}) {
  const dateComparison = getFuelingDate(left).localeCompare(getFuelingDate(right));
  if (dateComparison !== 0) return dateComparison;

  const createdAtComparison = timestampToMillis(left.createdAt) - timestampToMillis(right.createdAt);
  if (createdAtComparison !== 0) return createdAtComparison;

  return String(left.id || "").localeCompare(String(right.id || ""));
}

export function sortFuelingsChronologically(fuelings = []) {
  return [...fuelings].sort(compareFuelingsChronologically);
}

export function getPreviousFueling({
  fuelings = [],
  vehicleId = "",
  fuelingDate = "",
  currentId = "",
  createdAt = Date.now(),
} = {}) {
  const currentFueling = {
    id: currentId || "~new-fueling",
    fuelingDate,
    createdAt,
  };

  return sortFuelingsChronologically(
    fuelings.filter((item) => (item.veiculoId || item.vehicleId) === vehicleId && item.id !== currentId),
  )
    .filter((item) => compareFuelingsChronologically(item, currentFueling) < 0)
    .at(-1) || null;
}

export function calculateFuelMetrics({ lastKm = 0, currentKm = 0, liters = 0, total = 0 } = {}) {
  const normalizedLastKm = Number(lastKm || 0);
  const normalizedCurrentKm = Number(currentKm || 0);
  const normalizedLiters = Number(liters || 0);
  const normalizedTotal = Number(total || 0);
  const rawDistance = normalizedCurrentKm - normalizedLastKm;
  const validKm = normalizedCurrentKm > normalizedLastKm;
  const distance = validKm ? rawDistance : 0;

  return {
    lastKm: normalizedLastKm,
    currentKm: normalizedCurrentKm,
    liters: normalizedLiters,
    total: normalizedTotal,
    distance,
    average: validKm && normalizedLiters > 0 ? distance / normalizedLiters : 0,
    pricePerLiter: normalizedLiters > 0 ? normalizedTotal / normalizedLiters : 0,
    validKm,
  };
}

export function filterFuelings({ fuelings = [], startDate = "", endDate = "", vehicleId = "" } = {}) {
  return sortFuelingsChronologically(fuelings).filter((item) => {
    const fuelingDate = getFuelingDate(item);
    return (!startDate || fuelingDate >= startDate)
      && (!endDate || fuelingDate <= endDate)
      && (!vehicleId || (item.veiculoId || item.vehicleId) === vehicleId);
  });
}

export function summarizeFuelings(fuelings = []) {
  const totals = fuelings.reduce((summary, item) => {
    summary.liters += Number(item.litros || 0);
    summary.total += Number(item.valorTotal || 0);
    summary.distance += Number(item.distanciaPercorrida || 0);
    return summary;
  }, { count: fuelings.length, liters: 0, total: 0, distance: 0 });

  return {
    ...totals,
    averagePricePerLiter: totals.liters > 0 ? totals.total / totals.liters : 0,
    averageConsumption: totals.liters > 0 ? totals.distance / totals.liters : 0,
  };
}

export function summarizeFuelingsByVehicle(fuelings = []) {
  const groups = new Map();

  fuelings.forEach((item) => {
    const vehicleId = item.veiculoId || item.vehicleId || "";
    groups.set(vehicleId, [...(groups.get(vehicleId) || []), item]);
  });

  return [...groups.entries()].map(([vehicleId, vehicleFuelings]) => ({
    vehicleId,
    ...summarizeFuelings(vehicleFuelings),
  }));
}
