function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function ensureDate(input) {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  return isValidDate(date) ? date : null;
}

function parseDateValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return ensureDate(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value === 0) {
      return null;
    }
    if (Math.abs(value) >= 1e12) {
      return ensureDate(value);
    }
    if (Math.abs(value) >= 1e9) {
      return ensureDate(value * 1000);
    }
    return null;
  }

  const str = String(value).trim();
  if (!str) {
    return null;
  }

  if (/^\d+$/.test(str)) {
    const numeric = Number(str);
    if (str.length >= 13) {
      const parsed = ensureDate(numeric);
      if (parsed) {
        return parsed;
      }
    }
    if (str.length === 10 || numeric >= 1e9) {
      const parsed = ensureDate(numeric * 1000);
      if (parsed) {
        return parsed;
      }
    }
    if (str.length === 8) {
      const year = Number(str.slice(0, 4));
      const month = Number(str.slice(4, 6));
      const day = Number(str.slice(6, 8));
      const parsed = new Date(year, month - 1, day);
      return isValidDate(parsed) ? parsed : null;
    }
  }

  const normalized = str
    .replace(/[年._/]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (isValidDate(parsed)) {
      return parsed;
    }
  }

  if (/^\d{4}-\d{1,2}$/.test(normalized)) {
    const [year, month] = normalized.split('-').map(Number);
    const parsed = new Date(year, month - 1, 1);
    if (isValidDate(parsed)) {
      return parsed;
    }
  }

  if (/^\d{4}$/.test(normalized)) {
    const year = Number(normalized);
    const parsed = new Date(year, 0, 1);
    if (isValidDate(parsed)) {
      return parsed;
    }
  }

  const isoCandidate = normalized.replace(/ /g, 'T');
  const parsedIso = ensureDate(isoCandidate);
  if (parsedIso) {
    return parsedIso;
  }

  return ensureDate(normalized);
}

function formatDate(value) {
  const date = parseDateValue(value);
  if (!date) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateAge(birthDate, referenceDate = new Date()) {
  const birth = parseDateValue(birthDate);
  const ref = parseDateValue(referenceDate) || ensureDate(referenceDate);
  if (!birth || !ref) {
    return null;
  }
  if (birth.getTime() > ref.getTime()) {
    return null;
  }
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function formatAge(birthDate, referenceDate = new Date()) {
  const age = calculateAge(birthDate, referenceDate);
  return typeof age === 'number' ? `${age}岁` : '';
}

module.exports = {
  parseDateValue,
  formatDate,
  calculateAge,
  formatAge,
};
