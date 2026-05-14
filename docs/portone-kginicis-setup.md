# PortOne KG Inicis Setup

## Console Checklist

1. Create or open the Unwoldang PortOne store.
2. Add KG Inicis as a payment channel.
3. Copy the Store ID and KG Inicis Channel Key.
4. Create a V2 API Secret for server payment verification.

## Frontend

The browser uses only public values:

```env
VITE_PAYMENT_MODE=live
VITE_PORTONE_STORE_ID=store-...
VITE_PORTONE_CHANNEL_KEY=channel-key-...
VITE_PORTONE_CONFIRM_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/payments/portone/confirm
```

## Server

Cloud Run uses the secret value:

```env
PORTONE_API_SECRET=...
PORTONE_STORE_ID=store-...
PORTONE_API_BASE_URL=https://api.portone.io
```

## Flow

1. Checkout creates an order ID like `UW-...`.
2. PortOne opens KG Inicis with `paymentId` set to the same order ID.
3. On success, the browser calls Cloud Run.
4. Cloud Run exchanges the API Secret for an access token, fetches the payment from PortOne, and verifies status, amount, and store.
5. Only verified payments continue to report generation.
