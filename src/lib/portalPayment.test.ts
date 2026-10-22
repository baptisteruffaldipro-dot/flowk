import { describe, expect, it } from "vitest";
import { isPortalPaymentReceived } from "./portalPayment";

describe("Portal payment receipt", () => {
  it("confirms receipt when the administrator selects Solde réglé", () => {
    expect(isPortalPaymentReceived({ payment_state: "paid" })).toBe(true);
  });
  it("recognizes the existing administrator confirmation", () => {
    expect(isPortalPaymentReceived({ admin_confirmed_paid_at: "2026-10-22T08:15:00Z" })).toBe(true);
  });
  it.each(["unpaid", "deposit_paid", "balance_unpaid"])("does not report full payment for %s", (payment_state) => {
    expect(isPortalPaymentReceived({ payment_state, admin_confirmed_paid_at: null })).toBe(false);
  });
});