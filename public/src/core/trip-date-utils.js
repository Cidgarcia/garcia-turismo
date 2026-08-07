const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

export function addDays(dateStr, amount) {
  const base = new Date(`${dateStr}T00:00:00`);
  base.setDate(base.getDate() + amount);
  return base.toISOString().slice(0, 10);
}

export function addMonthsToMonthString(monthStr, amount) {
  const base = new Date(`${monthStr}-01T00:00:00`);
  base.setMonth(base.getMonth() + amount);
  return base.toISOString().slice(0, 7);
}

export function formatMonthLabel(monthStr) {
  const [year, month] = monthStr.split("-").map(Number);
  return monthLabelFormatter.format(new Date(year, month - 1, 1));
}

export function computeDurationDays(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diff = Math.round((end - start) / 86400000);
  return diff >= 0 ? diff + 1 : 1;
}
