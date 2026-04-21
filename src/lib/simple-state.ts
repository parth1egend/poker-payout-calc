import Dexie, { type Table } from "dexie";

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

const createBlankRow = (): CalculatorRow => ({
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

class SimpleCalculatorDatabase extends Dexie {
  calculatorState!: Table<CalculatorState, "current">;

  constructor() {
    super("poker-settlement-simple");

    this.version(1).stores({
      calculatorState: "id, updatedAt"
    });

    this.on("populate", async () => {
      await this.calculatorState.put(createDefaultCalculatorState());
    });
  }
}

const calculatorDb = new SimpleCalculatorDatabase();

export const getCalculatorState = async (): Promise<CalculatorState> => {
  const existing = await calculatorDb.calculatorState.get("current");

  if (existing) {
    return existing;
  }

  const initial = createDefaultCalculatorState();
  await calculatorDb.calculatorState.put(initial);
  return initial;
};

export const saveCalculatorState = async (state: CalculatorState): Promise<void> => {
  await calculatorDb.calculatorState.put({
    ...state,
    id: "current",
    updatedAt: nowIso()
  });
};

export const resetCalculatorState = async (): Promise<CalculatorState> => {
  const initial = createDefaultCalculatorState();
  await calculatorDb.calculatorState.clear();
  await calculatorDb.calculatorState.put(initial);
  return initial;
};
