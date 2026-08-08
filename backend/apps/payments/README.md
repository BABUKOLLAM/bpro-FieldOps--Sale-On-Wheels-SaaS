# UPI/card payment collection (BRD §18)

Gateway-ready scaffolding, mirroring `apps.integrations`' ERP-connector
shape (single active `PaymentGatewayConnection` row, Fernet-encrypted
credentials, `GATEWAY_MOCK` as the safe default).

**This app can never move money by itself.** `create_payment_order`
only ever creates a record of *intent*:

- With no real gateway configured (the default, and the only state this
  codebase itself ever exercises), it fabricates a `MOCK-ORDER-...` id
  and prints to the console — no network call happens, nothing can be
  confused for a real transaction.
- With a real gateway configured by a deployment operator (never done
  in this codebase — that's an operator action against their own
  account), it creates an *order* on the gateway's side. The actual
  transfer only ever happens on the gateway's own hosted checkout page,
  between the customer and their bank/UPI app — entirely outside this
  code's control.

The only way a `PaymentOrder` ever moves to `STATUS_PAID` is
`verify_and_record_payment`, which HMAC-SHA256-verifies the calling
webhook against the configured `webhook_secret` first and rejects
anything that doesn't match. A confirmed payment is recorded through
the existing `apps.sales.services.finalize_receipt` — the same path a
manually-entered cash/cheque receipt goes through — so it's auditable
the same way.

Razorpay's Orders/webhook API shape in `services.py` is illustrative,
not verified against their live API in this session — same caveat as
`apps.integrations.connectors.local_json_api`'s docstring makes about
Busy/Marg. Confirm against current vendor docs before relying on it in
production, and never enable a real gateway without also configuring
its webhook secret.
