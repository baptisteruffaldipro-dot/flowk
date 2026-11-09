import { describe, it, expect } from "vitest";
import { manualTiimePatch, tiimeTaskBadge } from "./tiimeInvoice";

describe("manualTiimePatch", () => {
  it("marque la tâche comme facturée dans Tiime avec n°, date et montant HT", () => {
    const p = manualTiimePatch({ number: " F-2026-042 ", date: "2026-11-09", amountHT: 60 }, "abc");
    expect(p.tiime_invoice_id).toBe("manual-abc");
    expect(p.tiime_invoice_number).toBe("F-2026-042");
    expect(p.tiime_invoice_status).toBe("manual");
    expect(p.tiime_sent_at.slice(0, 10)).toBe("2026-11-09");
    expect(p.tiime_amount_ht).toBe(60);
    expect(tiimeTaskBadge(p)?.state).toBe("invoiced");
  });
  it("accepte une facture sans numéro ni montant", () => {
    const p = manualTiimePatch({ number: "", date: "2026-11-09", amountHT: null }, "x");
    expect(p.tiime_invoice_number).toBeNull();
    expect(p.tiime_amount_ht).toBeNull();
  });
});
