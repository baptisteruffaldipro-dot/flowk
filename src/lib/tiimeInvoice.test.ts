import { describe, it, expect } from "vitest";
import { prestationLine, printLine, invoiceTotals, sendableLines } from "./tiimeInvoice";

describe("facture Tiime prestation + impression", () => {
  it("regroupe prestation et impression sur une seule facture avec totaux HT/TTC", () => {
    const lines = [
      prestationLine({ id: "t1", title: "Logo" }, 500),
      printLine({ id: "p1", description: "Cartes de visite", quantity: 250, amount: 80 }),
    ];
    const t = invoiceTotals(lines);
    expect(t.ht).toBe(580);
    expect(t.vat).toBe(116);
    expect(t.ttc).toBe(696);
  });

  it("garde la quantité choisie et le total HT de l'impression", () => {
    const l = printLine({ id: "p1", quantity: 250, amount: 80 });
    expect(l.quantity).toBe(250);
    expect(l.line_amount_ht).toBe(80);
  });

  it("n'envoie jamais une ligne déjà facturée dans Tiime", () => {
    const lines = [
      prestationLine({ id: "t1", title: "Logo", tiime_invoice_id: "X1" }, 500),
      printLine({ id: "p1", quantity: 100, amount: 50 }),
    ];
    const out = sendableLines(lines, new Set(["task:t1", "print:p1"]));
    expect(out.map((l) => l.key)).toEqual(["print:p1"]);
  });
});
