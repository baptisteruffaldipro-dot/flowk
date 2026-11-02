import { describe, it, expect } from "vitest";
import { buildPrintPresets } from "./printPresets";

describe("buildPrintPresets", () => {
  it("regroupe les commandes identiques et garde le prix le plus récent", () => {
    const p = buildPrintPresets([
      { description: "Flyer", format: "A5", amount: 50, created_at: "2026-01-01" },
      { description: "flyer ", format: "a5", amount: 70, created_at: "2026-05-01" },
      { description: "Carte de visite", format: "85x55", amount: 30, created_at: "2026-03-01" },
    ]);
    expect(p).toHaveLength(2);
    expect(p[0].description).toBe("flyer");
    expect(p[0].count).toBe(2);
    expect(p[0].amount).toBe(70);
  });
});
