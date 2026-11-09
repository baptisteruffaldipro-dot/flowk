# Architecture rules

- Brand strategies and logo presentations share PresentationExchange backed by presentation_messages; admin-only RLS and published-token RPCs scope conversations, and only client messages generate studio notifications (no automatic email).

- Public payment receipt presentation uses the existing payment_state and admin confirmation timestamp through portalPayment; it never infers receipt from downloads or production state.

- PrintDeliveryFields and PrintDeliveryInfo share order-level estimated delivery dates and locations; public token payloads expose these admin-managed fields without changing production or payment state.

- Public BAT screens share ClientBatApproval and ClientOrderProgress presentation components; each page retains its existing action handlers and only derives tracking from recorded order states, so redesigns do not change billing or imply unrecorded production events.
- Client tracking uses selected linked print orders (or a recorded printing task state) for physical fulfillment and server-reported deliverable unlocking for digital availability; this keeps the presentation aligned with existing payment and delivery controls without adding parallel workflow state.

- TaskDetail supplies work and billing sections to PortalPanel's optional task workspace; PortalPanel keeps one shared set of portal state and handlers across four tabs so files, payment and conversation actions retain their existing behavior. Other entity types retain the default portal layout.
- Keep inactive task tab panels mounted but hidden so switching sections preserves unsent messages, upload inputs and edits.
- Tiime invoices are created through a Make.com webhook (function make-tiime-invoice) that groups task prestation and linked print orders into one draft invoice; per-row tiime_* columns prevent double invoicing because Tiime offers no public API.
- Client files sent from public portal links go to the private client-uploads bucket under the portal id, through the portal-client-upload function (signed upload/download URLs); portal_action_by_token only accepts attachment paths inside that portal's folder, so one link can never read or attach another client's files.
- Invoices made directly in Tiime are recorded by marking the task with tiime_invoice_status "manual" and a "manual-" tiime_invoice_id, so badges, Ventes & CA and double-invoice guards treat them like Make-created invoices.
