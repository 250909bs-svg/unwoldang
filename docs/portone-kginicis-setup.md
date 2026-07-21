# PortOne KG Inicis Setup

## Console Checklist

1. Create or open the Unwoldang PortOne store.
2. Add KG Inicis as a payment channel.
3. Copy the Store ID and KG Inicis channel key.
4. Create a PortOne V2 API Secret for server verification.

## Frontend

Only public values belong in the browser:

```env
VITE_PAYMENT_MODE=live
VITE_PORTONE_STORE_ID=store-...
VITE_PORTONE_CHANNEL_KEY=channel-key-...
VITE_PORTONE_CONFIRM_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/payments/portone/confirm
```

The client derives the order, entitlement-list, and entitlement-renew URLs from the confirmation URL. It must also have a valid user bearer token from Kakao before starting the server order flow.

## Server

Keep private values in Secret Manager. `PORTONE_STORE_ID` is a normal Cloud Run environment value.

```env
PORTONE_API_SECRET=...
PORTONE_STORE_ID=store-...
PORTONE_API_BASE_URL=https://api.portone.io
PORTONE_PAYMENT_LEDGER_COLLECTION=portonePaymentConfirmations
PORTONE_PAYMENT_ORDER_COLLECTION=portonePaymentOrders
PAYMENT_ORDER_CLAIM_TTL_MS=7200000
REPORT_ACCESS_SECRET=...
USER_ACCESS_SECRET=...
```

Firestore must be enabled and the Cloud Run runtime service account needs read/write access to both the payment ledger and payment order collections.

For verified cancellation and refund persistence, entitlement revocation, reconciliation, and audit requirements, follow [Payment cancellation and refund operations](./payment-cancellation-refund-operations.md). The service intentionally does not guess or call a PortOne refund API.

## Authenticated Order and Confirmation Flow

1. The browser calls `POST /api/payments/portone/order` with `Authorization: Bearer USER_TOKEN` and `productId`.
2. Cloud Run chooses the amount from its server-only product catalog and returns `orderId`, `amount`, `currency`, signed `orderClaim`, and expiry.
3. PortOne opens with `paymentId=orderId`. Its `customData` contains the exact returned `productId` and `orderClaim`.
4. On success, the browser calls `POST /api/payments/portone/confirm` with the same user bearer token and the payment/order/product/amount data.
5. Cloud Run fetches the payment from PortOne and verifies:
   - payment ID equals the server order ID;
   - the signed order claim belongs to the user and matches order, product, and catalog amount;
   - PortOne `customData` contains the same product and order claim;
   - amount is an integer matching the server catalog;
   - currency is `KRW` and status is `PAID`;
   - store ID matches `PORTONE_STORE_ID`;
   - transaction ID exists and matches the supplied result when present.
6. Cloud Run atomically creates one Firestore entitlement. An identical confirmation retry reuses it and returns a newly valid short-lived report token.
7. The browser supplies that token to `/api/report`. A completed enhanced report is cached for the identical paid input; deterministic fallback remains retryable if Gemini is unavailable.

Never let the browser invent or sign `orderClaim`, choose the authoritative amount, call the PortOne secret API, or write the entitlement ledger directly.

## Recovery Without a Second Charge

- `GET /api/payments/portone/entitlements` lists active entitlements owned by the current user.
- `POST /api/payments/portone/entitlement/renew` accepts an owned `orderId` and returns a fresh report token.
- Both routes require the user bearer token and verify Firestore ownership.
- Renewal does not create a payment or charge the customer again.

## Release Checks

- A request without user auth cannot create or confirm an order.
- A copied order claim cannot be used by another user.
- A modified product, amount, store, or customData is rejected.
- Duplicate callbacks do not create duplicate entitlements.
- Entitlement recovery works after the original report token expires.
