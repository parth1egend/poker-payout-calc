import { describe, expect, it } from "vitest";

import { clampMinor, parseMoneyInput } from "@/lib/money";

describe("money parsing", () => {
  it("parses integer money safely at scale 1", () => {
    expect(parseMoneyInput("150", 1)).toBe(150);
    expect(parseMoneyInput("-150", 1)).toBe(-150);
    expect(parseMoneyInput("INR 1,500", 1)).toBe(1500);
  });

  it("ignores malformed numeric input instead of returning partial values", () => {
    expect(parseMoneyInput("12-3", 1)).toBe(0);
    expect(parseMoneyInput("--20", 1)).toBe(0);
    expect(parseMoneyInput("abc", 1)).toBe(0);
  });

  it("supports decimal minor-unit parsing when scale is provided", () => {
    expect(parseMoneyInput("12.34", 100)).toBe(1234);
    expect(parseMoneyInput("-12.34", 100)).toBe(-1234);
    expect(parseMoneyInput("12.3", 100)).toBe(1230);
    expect(parseMoneyInput("12.349", 100)).toBe(1234);
  });

  it("keeps empty and whitespace-only input as zero", () => {
    expect(parseMoneyInput("", 1)).toBe(0);
    expect(parseMoneyInput("   ", 100)).toBe(0);
  });

  it("throws on unsafe integer values via clampMinor", () => {
    expect(() => clampMinor(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});
