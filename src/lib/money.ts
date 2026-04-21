const DIGITS_ONLY = /[^\d-]/g;

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

  if (scale === 1) {
    const integerValue = Number.parseInt(trimmed.replace(DIGITS_ONLY, ""), 10);
    return Number.isNaN(integerValue) ? 0 : clampMinor(integerValue);
  }

  const negative = trimmed.startsWith("-");
  const sanitized = trimmed.replace(/[^0-9.]/g, "");
  const [wholePart = "0", fractionPart = ""] = sanitized.split(".");
  const safeWhole = Number.parseInt(wholePart || "0", 10) || 0;
  const fractionDigits = String(scale).length - 1;
  const paddedFraction = `${fractionPart}${"0".repeat(fractionDigits)}`.slice(0, fractionDigits);
  const safeFraction = Number.parseInt(paddedFraction || "0", 10) || 0;
  const minor = safeWhole * scale + safeFraction;

  return clampMinor(negative ? -minor : minor);
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
