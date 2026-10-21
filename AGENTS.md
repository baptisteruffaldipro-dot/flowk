# Architecture rules

- Public BAT screens share ClientBatApproval and ClientOrderProgress presentation components; each page retains its existing action handlers and only derives tracking from recorded order states, so redesigns do not change billing or imply unrecorded production events.
- Client tracking uses selected linked print orders (or a recorded printing task state) for physical fulfillment and server-reported deliverable unlocking for digital availability; this keeps the presentation aligned with existing payment and delivery controls without adding parallel workflow state.

- TaskDetail supplies work and billing sections to PortalPanel's optional task workspace; PortalPanel keeps one shared set of portal state and handlers across four tabs so files, payment and conversation actions retain their existing behavior. Other entity types retain the default portal layout.
- Keep inactive task tab panels mounted but hidden so switching sections preserves unsent messages, upload inputs and edits.
- Tiime invoices are created through a Make.com webhook (function make-tiime-invoice) that groups task prestation and linked print orders into one draft invoice; per-row tiime_* columns prevent double invoicing because Tiime offers no public API.
