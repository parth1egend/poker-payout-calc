import { describe, expect, it } from "vitest";

import { normalizeCalculatorState } from "@/lib/simple-state-schema";

describe("calculator state normalization", () => {
  it("normalizes invalid top-level fields to safe defaults", () => {
    const normalized = normalizeCalculatorState({
      mode: "bad-mode",
      currencyLabel: "us dollars",
      rows: "invalid"
    });

    expect(normalized.id).toBe("current");
    expect(normalized.mode).toBe("cashflow");
    expect(normalized.currencyLabel).toBe("USD");
    expect(normalized.rows.length).toBe(1);
  });

  it("normalizes row values with safe numeric bounds and id fallback", () => {
    const normalized = normalizeCalculatorState({
      mode: "net",
      currencyLabel: "INR",
      rows: [
        {
          id: "",
          name: "A".repeat(120),
          totalInMinor: -200,
          totalOutMinor: Number.POSITIVE_INFINITY,
          netMinor: 25.9
        }
      ]
    });

    const [row] = normalized.rows;
    expect(row.id.length).toBeGreaterThan(0);
    expect(row.name.length).toBe(80);
    expect(row.totalInMinor).toBe(0);
    expect(row.totalOutMinor).toBe(0);
    expect(row.netMinor).toBe(25);
    expect(normalized.mode).toBe("net");
    expect(normalized.currencyLabel).toBe("INR");
  });

  it("caps row count and keeps at least one row", () => {
    const oversized = normalizeCalculatorState({
      mode: "cashflow",
      currencyLabel: "USD",
      rows: Array.from({ length: 300 }, (_, index) => ({
        id: `row-${index}`,
        name: `p${index}`,
        totalInMinor: 0,
        totalOutMinor: 0,
        netMinor: 0
      }))
    });

    expect(oversized.rows.length).toBe(150);

    const empty = normalizeCalculatorState({
      mode: "cashflow",
      currencyLabel: "USD",
      rows: []
    });
    expect(empty.rows.length).toBe(1);
  });
});
