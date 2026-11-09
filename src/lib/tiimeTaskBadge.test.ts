import { describe, it, expect } from "vitest";
import { tiimeTaskBadge } from "./tiimeInvoice";

describe("étiquette Tiime sur les cartes de tâche", () => {
  it("affiche la facture créée avec son numéro", () => {
    const b = tiimeTaskBadge({ tiime_invoice_id: "abc", tiime_invoice_number: "F-12", tiime_amount_ht: 60 });
    expect(b?.state).toBe("invoiced");
    expect(b?.label).toBe("Facturé Tiime n° F-12");
    expect(b?.title).toContain("60,00 € HT");
  });
  it("affiche une facture en cours de création", () => {
    expect(tiimeTaskBadge({ tiime_invoice_status: "pending" })?.state).toBe("pending");
  });
  it("n'affiche rien pour une tâche non facturée", () => {
    expect(tiimeTaskBadge({})).toBeNull();
    expect(tiimeTaskBadge({ tiime_invoice_status: null })).toBeNull();
  });
});
