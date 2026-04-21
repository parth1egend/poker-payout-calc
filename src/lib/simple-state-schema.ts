import { createId, nowIso } from "@/lib/ids";

export type EntryMode = "cashflow" | "net";

export interface CalculatorRow {
  id: string;
  name: string;
  totalInMinor: number;
  totalOutMinor: number;
  netMinor: number;
}

export interface CalculatorState {
  id: "current";
  mode: EntryMode;
  currencyLabel: string;
  rows: CalculatorRow[];
  updatedAt: string;
}

const MAX_ROWS = 150;
const MAX_NAME_LENGTH = 80;
const CURRENCY_PATTERN = /^[A-Z]{2,6}$/;

const isEntryMode = (value: unknown): value is EntryMode => value === "cashflow" || value === "net";

const toSafeInteger = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  const truncated = Math.trunc(value);
  return Number.isSafeInteger(truncated) ? truncated : 0;
};

export const createBlankRow = (): CalculatorRow => ({
  id: createId(),
  name: "",
  totalInMinor: 0,
  totalOutMinor: 0,
  netMinor: 0
});

export const createDefaultCalculatorState = (): CalculatorState => ({
  id: "current",
  mode: "cashflow",
  currencyLabel: "USD",
  rows: [createBlankRow(), createBlankRow(), createBlankRow(), createBlankRow()],
  updatedAt: nowIso()
});

const normalizeRow = (candidate: unknown): CalculatorRow => {
  const source = typeof candidate === "object" && candidate ? (candidate as Partial<CalculatorRow>) : {};
  const totalInMinor = Math.max(0, toSafeInteger(source.totalInMinor));
  const totalOutMinor = Math.max(0, toSafeInteger(source.totalOutMinor));

  return {
    id: typeof source.id === "string" && source.id.trim().length > 0 ? source.id : createId(),
    name: typeof source.name === "string" ? source.name.slice(0, MAX_NAME_LENGTH) : "",
    totalInMinor,
    totalOutMinor,
    netMinor: toSafeInteger(source.netMinor)
  };
};

export const normalizeCalculatorState = (candidate: unknown): CalculatorState => {
  const source = typeof candidate === "object" && candidate ? (candidate as Partial<CalculatorState>) : {};
  const rowsSource = Array.isArray(source.rows) ? source.rows.slice(0, MAX_ROWS) : [];
  const rows = rowsSource.map((row) => normalizeRow(row));

  if (rows.length === 0) {
    rows.push(createBlankRow());
  }

  const currencyLabel =
    typeof source.currencyLabel === "string" && CURRENCY_PATTERN.test(source.currencyLabel)
      ? source.currencyLabel
      : "USD";

  return {
    id: "current",
    mode: isEntryMode(source.mode) ? source.mode : "cashflow",
    currencyLabel,
    rows,
    updatedAt: nowIso()
  };
};
