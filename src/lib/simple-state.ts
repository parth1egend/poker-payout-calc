import Dexie, { type Table } from "dexie";

import {
  createDefaultCalculatorState,
  normalizeCalculatorState,
  type CalculatorState
} from "@/lib/simple-state-schema";

export type { CalculatorRow, CalculatorState, EntryMode } from "@/lib/simple-state-schema";
export { createDefaultCalculatorState } from "@/lib/simple-state-schema";

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
    const normalized = normalizeCalculatorState(existing);
    await calculatorDb.calculatorState.put(normalized);
    return normalized;
  }

  const initial = createDefaultCalculatorState();
  await calculatorDb.calculatorState.put(initial);
  return initial;
};

export const saveCalculatorState = async (state: CalculatorState): Promise<void> => {
  await calculatorDb.calculatorState.put(normalizeCalculatorState(state));
};

export const resetCalculatorState = async (): Promise<CalculatorState> => {
  const initial = createDefaultCalculatorState();
  await calculatorDb.calculatorState.clear();
  await calculatorDb.calculatorState.put(initial);
  return initial;
};
