import { describe, it, expect } from "vitest";
import { toSales, salesTotals } from "./salesDashboard";

const base = { client_id: "c", business_unit_id: null, tiime_invoice_number: "F1", tiime_amount_ht: null };

describe("ventes Tiime", () => {
  it("ne compte que les lignes envoyées à Tiime", () => {
    const rows = toSales(
      [
        { ...base, id: "t1", title: "Logo", tiime_invoice_id: "1", tiime_sent_at: "2026-10-21T10:00:00Z", tiime_amount_ht: 240 },
        { ...base, id: "t2", title: "Non facturée", tiime_invoice_id: null, tiime_sent_at: null, flat_amount: 999 },
      ],
      [{ ...base, id: "p1", description: "Flyers", tiime_invoice_id: "1", tiime_sent_at: "2026-10-21T10:00:00Z", amount: 300 }],
      () => "Client",
    );
    expect(rows).toHaveLength(2);
    const t = salesTotals(rows);
    expect(t.ht).toBe(540);
    expect(t.ttc).toBe(648);
    expect(t.prestation).toBe(240);
    expect(t.impression).toBe(300);
    expect(t.invoices).toBe(1);
  });
});
