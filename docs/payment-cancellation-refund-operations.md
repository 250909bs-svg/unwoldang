# Payment cancellation and refund operations

This document defines the persistence and entitlement procedure for PortOne payment cancellation and refund events. It does not call a refund API. Operators must only record a cancellation or refund after verifying the provider result through an approved PortOne console or a separately reviewed server integration.

## State contract

Every server-created order is stored in the collection configured by `PORTONE_PAYMENT_ORDER_COLLECTION` (default: `portonePaymentOrders`). The supported order states are:

| Order status | Meaning | Allowed next states |
| --- | --- | --- |
| `created` | The server issued an order claim. | `pending`, `paid`, `failed`, `cancelled` |
| `pending` | PortOne has not reached a terminal result. | `paid`, `failed`, `cancelled` |
| `paid` | PortOne payment verification succeeded and an entitlement exists. | `refunded` |
| `failed` | Payment failed before completion. | none |
| `cancelled` | Payment was cancelled before a completed charge. | none |
| `refunded` | A completed payment was fully or partially cancelled and its entitlement was revoked. | none |

Provider status mapping is deterministic: `READY`, `PAY_PENDING`, `PENDING`, and `VIRTUAL_ACCOUNT_ISSUED` map to `pending`; `PAID` maps to `paid`; `FAILED` maps to `failed`; and `CANCELLED` or `PARTIAL_CANCELLED` maps to `cancelled` before payment and `refunded` after payment.

The payment order stores the verified provider status, payment ID, transaction ID, state-change timestamp, and optional adjustment audit fields (`adjustmentId`, `adjustmentKind`, `adjustmentReason`, `adjustmentAt`). The existing payment ledger remains the entitlement authority. Refunded ledger entries retain their immutable order/product/amount snapshot and are marked with `entitlementStatus=refunded`, revocation time, reason, adjustment ID, and provider status.

## Operator procedure

1. Locate the payment in PortOne using the server order ID and payment ID. Verify the store, transaction ID, currency, amount, product custom data, and current provider status against the stored order.
2. Perform the actual cancellation or refund only through an approved PortOne operation. Do not infer a refund endpoint or send an unreviewed provider request from this service.
3. The server derives one deterministic adjustment ID from the verified payment ID, provider status, and transaction ID. Immediate checkout/callback reconciliation uses the authenticated `/api/payments/portone/confirm` path, which re-fetches PortOne before changing state. Never expose Firestore state-changing access to the public browser client.
4. For an already paid order, revoke the entitlement first, then transition the order to `refunded`. Both writes use Firestore update-time preconditions so a retry with the same adjustment ID is idempotent and a conflicting concurrent change fails closed.
5. Verify that the entitlement list no longer returns the order, entitlement renewal returns a conflict response, and an old report access token is rejected. The order and ledger audit records must remain available for reconciliation.

A delayed operator-initiated refund currently has no public admin endpoint, webhook, or bundled command. After performing such a refund in PortOne, keep the incident open until an approved internal reconciliation runner invokes this same verification and repository contract. Do not directly edit Firestore and do not report the refund complete while the active entitlement remains. Adding that protected runner/webhook is a separate integration task because this change intentionally does not guess the provider refund API or webhook signature.

For a pre-payment cancellation, transition only `created` or `pending` orders to `cancelled`; no entitlement should exist. A `failed` provider result is stored as `failed` and must not create or reactivate an entitlement.

## Partial failure and reconciliation

If entitlement revocation succeeds but the order-state update fails, retry the state update with the same adjustment ID. Do not reactivate the entitlement automatically. A conflicting adjustment ID, mismatched payment identity, or unsupported transition requires manual reconciliation and must not be overwritten.

Archived report retention is intentionally outside this payment contract. Revocation prevents new report access or token renewal, but the product/archive owners must define whether an already persisted report is retained, hidden, or deleted after a refund.

## Release checks

- New orders for draft or archived products are rejected by the server catalog.
- A non-paid order has no active entitlement or report access token.
- Repeating the same paid confirmation returns the same entitlement.
- Repeating the same refund adjustment does not create a second ledger mutation.
- A refunded entitlement cannot be listed, renewed, or used to authorize a report.
- Audit records contain identifiers and verified state only, not provider secrets or customer personal data.
