
export function sanitizeText(value = '') {
  return String(value).replace(/[<>]/g, '').trim();
}

export function sanitizeNumber(value, fallback = 0) {
  const normalized = Number(String(value).replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : fallback;
}

export function sanitizePayload(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (typeof value === 'string') return [key, sanitizeText(value)];
      if (typeof value === 'number') return [key, sanitizeNumber(value)];
      return [key, value];
    })
  );
}
