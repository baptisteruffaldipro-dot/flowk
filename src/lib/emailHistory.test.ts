import { describe, it, expect } from "vitest";
import { summarizeHistory } from "./emailHistory";

describe("summarizeHistory", () => {
  it("compte les relances séparément des envois, du plus récent au plus ancien", () => {
    const r = summarizeHistory([
      { kind: "link", sent_at: "2026-10-01T10:00:00Z" },
      { kind: "payment_reminder", sent_at: "2026-10-05T10:00:00Z" },
      { kind: "payment_reminder", sent_at: "2026-10-03T10:00:00Z" },
    ]);
    expect(r.reminders).toBe(2);
    expect(r.sends).toBe(1);
    expect(r.list[0].sent_at).toBe("2026-10-05T10:00:00Z");
  });
});
