const CLEAN_NUMERIC_CHARS = /[^0-9.,+-]/g;
const STRICT_NUMERIC_PATTERN = /^([+-])?(\d*)(?:\.(\d*))?$/;

export const clampMinor = (value: number): number => {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Unsafe money value: ${value}`);
  }

  return value;
};

export const parseMoneyInput = (value: string, scale: number): number => {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  const normalized = trimmed.replace(CLEAN_NUMERIC_CHARS, "").replaceAll(",", "");
  const match = normalized.match(STRICT_NUMERIC_PATTERN);

  if (!match) {
    return 0;
  }

  const [, sign = "", wholeDigits = "", fractionDigitsRaw = ""] = match;
  const safeWhole = Number.parseInt(wholeDigits || "0", 10) || 0;

  if (scale === 1) {
    const signedWhole = sign === "-" ? -safeWhole : safeWhole;
    return clampMinor(signedWhole);
  }

  const fractionDigits = String(scale).length - 1;
  const paddedFraction = `${fractionDigitsRaw}${"0".repeat(fractionDigits)}`.slice(0, fractionDigits);
  const safeFraction = Number.parseInt(paddedFraction || "0", 10) || 0;
  const minor = safeWhole * scale + safeFraction;
  const signedMinor = sign === "-" ? -minor : minor;

  return clampMinor(signedMinor);
};

export const formatMoney = (valueMinor: number, currencyLabel: string, scale: number): string => {
  const sign = valueMinor < 0 ? "-" : "";
  const absoluteValue = Math.abs(valueMinor);

  if (scale === 1) {
    return `${sign}${currencyLabel} ${absoluteValue}`;
  }

  const whole = Math.floor(absoluteValue / scale);
  const fractionDigits = String(scale).length - 1;
  const fraction = String(absoluteValue % scale).padStart(fractionDigits, "0");

  return `${sign}${currencyLabel} ${whole}.${fraction}`;
};

export const formatSignedMoney = (valueMinor: number, currencyLabel: string, scale: number): string => {
  const prefix = valueMinor > 0 ? "+" : "";
  return `${prefix}${formatMoney(valueMinor, currencyLabel, scale)}`;
};

export const toAbsoluteMoney = (valueMinor: number, currencyLabel: string, scale: number): string =>
  formatMoney(Math.abs(valueMinor), currencyLabel, scale);
