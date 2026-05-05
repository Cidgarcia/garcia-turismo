export function required(value) {
  return String(value ?? '').trim().length > 0;
}

export function positiveNumber(value) {
  return Number(value) > 0;
}

export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function validateRequiredFields(fields = {}) {
  const missing = Object.entries(fields)
    .filter(([, value]) => !required(value))
    .map(([name]) => name);

  return {
    valid: missing.length === 0,
    missing
  };
}
