type PortalPayment = {
  payment_state?: string | null;
  admin_confirmed_paid_at?: string | null;
};

/** Match the recorded payment signals used by the existing delivery gate. */
export function isPortalPaymentReceived(portal: PortalPayment): boolean {
  return Boolean(portal.admin_confirmed_paid_at) || portal.payment_state === "paid";
}