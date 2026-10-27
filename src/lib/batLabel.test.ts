import { describe, it, expect } from "vitest";
import { batLabel } from "./batLabel";

describe("batLabel", () => {
  it("ajoute le nom du BAT", () => expect(batLabel(0, "Flyer")).toBe("BAT 1 : Flyer"));
  it("garde BAT n sans nom", () => expect(batLabel(1, "  ")).toBe("BAT 2"));
});
